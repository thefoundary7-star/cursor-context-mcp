import nodemailer from 'nodemailer'
import { logger } from '@/utils/logger'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  pool?: boolean
  maxConnections?: number
  maxMessages?: number
  rateDelta?: number
  rateLimit?: number
}

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  replyTo?: string
  headers?: Record<string, string>
}

interface LicenseEmailData {
  to: string
  customerName?: string
  licenseKey: string
  plan: string
  subscriptionId?: string
  expiresAt?: Date
  downloadUrl: string
  supportEmail?: string
}

interface WelcomeEmailData {
  to: string
  customerName?: string
  plan: string
  loginUrl: string
  supportEmail?: string
}

interface PaymentFailedEmailData {
  to: string
  customerName?: string
  plan: string
  amount: number
  currency: string
  retryUrl: string
  supportUrl: string
  nextRetryDate?: Date
}

interface SubscriptionCancelledEmailData {
  to: string
  customerName?: string
  plan: string
  cancellationReason?: string
  reactivationUrl: string
  supportEmail?: string
}

interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  retryable?: boolean
}

class ProductionEmailService {
  private transporter: nodemailer.Transporter
  private isConfigured: boolean
  private fromEmail: string
  private fromName: string
  private supportEmail: string

  constructor() {
    this.isConfigured = this.validateConfiguration()
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@filebridge.com'
    this.fromName = process.env.FROM_NAME || 'FileBridge'
    this.supportEmail = process.env.SUPPORT_EMAIL || 'support@filebridge.com'
    
    if (this.isConfigured) {
      const config: EmailConfig = {
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 20000,
        rateLimit: 5
      }

      this.transporter = nodemailer.createTransporter(config)
      
      // Verify connection configuration
      this.verifyConnection()
    } else {
      logger.warn('Email service not configured - SMTP settings missing')
    }
  }

  private validateConfiguration(): boolean {
    const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']
    return required.every(key => process.env[key])
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify()
      logger.info('Email service connection verified')
    } catch (error) {
      logger.error('Email service connection failed:', error)
    }
  }

  async sendEmail(emailData: EmailData): Promise<EmailDeliveryResult> {
    if (!this.isConfigured) {
      logger.error('Email service not configured')
      return { success: false, error: 'Email service not configured' }
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        attachments: emailData.attachments,
        replyTo: emailData.replyTo || this.supportEmail,
        headers: {
          'X-Mailer': 'FileBridge-Email-Service',
          'X-Priority': '3',
          ...emailData.headers
        }
      })

      logger.info('Email sent successfully', { 
        messageId: info.messageId, 
        to: emailData.to,
        subject: emailData.subject 
      })

      // Log email delivery for analytics
      await this.logEmailDelivery({
        to: emailData.to,
        subject: emailData.subject,
        messageId: info.messageId,
        status: 'sent'
      })

      return { success: true, messageId: info.messageId }
    } catch (error) {
      logger.error('Email sending failed:', error)
      
      // Log failed delivery
      await this.logEmailDelivery({
        to: emailData.to,
        subject: emailData.subject,
        status: 'failed',
        error: (error as Error).message
      })

      // Determine if error is retryable
      const retryable = this.isRetryableError(error as Error)
      
      return { 
        success: false, 
        error: (error as Error).message,
        retryable 
      }
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'temporary failure',
      'rate limit'
    ]
    
    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    )
  }

  async sendLicenseKey(data: LicenseEmailData): Promise<EmailDeliveryResult> {
    const setupInstructions = this.getSetupInstructions(data.plan)
    const expirationText = data.expiresAt 
      ? `Your license expires on ${data.expiresAt.toLocaleDateString()}.`
      : 'Your license has no expiration date.'
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your FileBridge License</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; }
        .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .license-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; position: relative; }
        .license-key { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 16px; background: #1e293b; color: #f1f5f9; padding: 15px; border-radius: 6px; word-break: break-all; letter-spacing: 1px; }
        .copy-btn { position: absolute; top: 10px; right: 10px; background: #3b82f6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .step { margin: 15px 0; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: 600; transition: background 0.2s; }
        .button:hover { background: #2563eb; }
        .button-secondary { background: #6b7280; }
        .button-secondary:hover { background: #4b5563; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
        .success { background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to FileBridge!</h1>
          <p>Your ${data.plan.toUpperCase()} license is ready</p>
        </div>
        
        <div class="content">
          <p>Hi ${data.customerName || 'there'},</p>
          
          <div class="success">
            <strong>✅ Payment Successful!</strong><br>
            Thank you for choosing FileBridge! Your ${data.plan} plan is now active and ready to use.
          </div>
          
          <div class="license-box">
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${data.licenseKey}')">Copy</button>
            <h3>Your License Key</h3>
            <div class="license-key">${data.licenseKey}</div>
            <p><small>⚠️ Keep this license key secure - you'll need it to activate your FileBridge MCP server</small></p>
            <p><small>📅 ${expirationText}</small></p>
          </div>

          <h3>Quick Setup (5 minutes)</h3>
          ${setupInstructions}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.downloadUrl}" class="button">Download FileBridge</a>
            <a href="https://docs.filebridge.com/setup" class="button button-secondary">Setup Guide</a>
          </div>

          <div class="warning">
            <strong>🔒 Privacy First:</strong> Your FileBridge server runs locally on your machine. Your code never leaves your computer, ensuring complete privacy and security.
          </div>

          <h3>What's Next?</h3>
          <ul>
            <li>Download and install the FileBridge MCP server</li>
            <li>Configure Claude Desktop to use your local server</li>
            <li>Start coding with AI that understands your project</li>
            <li>Enjoy privacy-first AI development</li>
          </ul>

          <p>Need help? Reply to this email or visit our <a href="https://docs.filebridge.com">documentation</a>.</p>

          <p>Best regards,<br>The FileBridge Team</p>
        </div>
        
        <div class="footer">
          <p><strong>FileBridge</strong> - Privacy-First AI Development Tools</p>
          <p>Subscription ID: ${data.subscriptionId || 'N/A'}</p>
          <p>Support: ${data.supportEmail || this.supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
    `

    const text = `
    Welcome to FileBridge!
    
    Hi ${data.customerName || 'there'},
    
    Your ${data.plan} plan is now active. Here's your license key:
    
    ${data.licenseKey}
    
    ${expirationText}
    
    Download: ${data.downloadUrl}
    Setup Guide: https://docs.filebridge.com/setup
    
    Need help? Reply to this email.
    
    Best regards,
    The FileBridge Team
    `

    return this.sendEmail({
      to: data.to,
      subject: '🎉 Your FileBridge License is Ready!',
      html,
      text
    })
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailDeliveryResult> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to FileBridge</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; }
        .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: 600; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👋 Welcome to FileBridge!</h1>
          <p>Your account is ready</p>
        </div>
        
        <div class="content">
          <p>Hi ${data.customerName || 'there'},</p>
          
          <p>Welcome to FileBridge! You're now part of a community of developers who prioritize privacy without sacrificing AI capabilities.</p>
          
          <p>Your ${data.plan} plan is active and ready to use. Here's what you can do next:</p>
          
          <ul>
            <li>Access your dashboard to manage your account</li>
            <li>Download the FileBridge MCP server</li>
            <li>Configure Claude Desktop for privacy-first AI development</li>
            <li>Join our community for support and tips</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl}" class="button">Go to Dashboard</a>
          </div>
          
          <p>Need help? Reply to this email or visit our <a href="https://docs.filebridge.com">documentation</a>.</p>
          
          <p>Best regards,<br>The FileBridge Team</p>
        </div>
        
        <div class="footer">
          <p><strong>FileBridge</strong> - Privacy-First AI Development Tools</p>
          <p>Support: ${data.supportEmail || this.supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: data.to,
      subject: 'Welcome to FileBridge! 👋',
      html
    })
  }

  async sendPaymentFailedEmail(data: PaymentFailedEmailData): Promise<EmailDeliveryResult> {
    const retryDate = data.nextRetryDate 
      ? `We'll automatically retry on ${data.nextRetryDate.toLocaleDateString()}.`
      : 'Please update your payment method to continue service.'

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Failed - FileBridge</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; }
        .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: 600; }
        .button-danger { background: #ef4444; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Payment Failed</h1>
          <p>Action required for your FileBridge subscription</p>
        </div>
        
        <div class="content">
          <p>Hi ${data.customerName || 'there'},</p>
          
          <div class="warning">
            <strong>Payment Failed:</strong> We were unable to process your payment of ${data.currency} ${(data.amount / 100).toFixed(2)} for your ${data.plan} plan.
          </div>
          
          <p>${retryDate}</p>
          
          <p>To avoid service interruption, please update your payment method:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.retryUrl}" class="button">Update Payment Method</a>
            <a href="${data.supportUrl}" class="button button-danger">Contact Support</a>
          </div>
          
          <p>Common reasons for payment failures:</p>
          <ul>
            <li>Expired credit card</li>
            <li>Insufficient funds</li>
            <li>Bank security restrictions</li>
            <li>Incorrect billing information</li>
          </ul>
          
          <p>Need help? Reply to this email or contact our support team.</p>
          
          <p>Best regards,<br>The FileBridge Team</p>
        </div>
        
        <div class="footer">
          <p><strong>FileBridge</strong> - Privacy-First AI Development Tools</p>
          <p>Support: ${this.supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: data.to,
      subject: '⚠️ Payment Failed - Action Required',
      html
    })
  }

  async sendSubscriptionCancelledEmail(data: SubscriptionCancelledEmailData): Promise<EmailDeliveryResult> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Subscription Cancelled - FileBridge</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; }
        .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: 600; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .info { background: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Subscription Cancelled</h1>
          <p>We're sorry to see you go</p>
        </div>
        
        <div class="content">
          <p>Hi ${data.customerName || 'there'},</p>
          
          <p>Your ${data.plan} subscription has been cancelled${data.cancellationReason ? ` due to: ${data.cancellationReason}` : ''}.</p>
          
          <div class="info">
            <strong>What happens next:</strong>
            <ul>
              <li>Your license will remain active until the end of your current billing period</li>
              <li>You'll retain access to all features until then</li>
              <li>Your data will be securely retained for 30 days after cancellation</li>
            </ul>
          </div>
          
          <p>We'd love to have you back! If you change your mind, you can reactivate your subscription anytime:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.reactivationUrl}" class="button">Reactivate Subscription</a>
          </div>
          
          <p>We'd appreciate your feedback on how we can improve. Reply to this email to share your thoughts.</p>
          
          <p>Thank you for being part of the FileBridge community.</p>
          
          <p>Best regards,<br>The FileBridge Team</p>
        </div>
        
        <div class="footer">
          <p><strong>FileBridge</strong> - Privacy-First AI Development Tools</p>
          <p>Support: ${data.supportEmail || this.supportEmail}</p>
        </div>
      </div>
    </body>
    </html>
    `

    return this.sendEmail({
      to: data.to,
      subject: 'Subscription Cancelled - We\'re Sorry to See You Go',
      html
    })
  }

  private getSetupInstructions(plan: string): string {
    const baseInstructions = `
    <div class="step">
      <strong>Step 1:</strong> Download the FileBridge MCP server for your operating system
    </div>
    <div class="step">
      <strong>Step 2:</strong> Run the installer and enter your license key when prompted
    </div>
    <div class="step">
      <strong>Step 3:</strong> Configure Claude Desktop to connect to your local FileBridge server
    </div>
    <div class="step">
      <strong>Step 4:</strong> Start using Claude with full access to your local files
    </div>
    `

    if (plan.toLowerCase() === 'enterprise') {
      return baseInstructions + `
      <div class="step" style="border-left-color: #f59e0b;">
        <strong>Enterprise Setup:</strong> Contact ${this.supportEmail} for SSO configuration and team management setup
      </div>
      `
    }

    return baseInstructions
  }

  private async logEmailDelivery(data: {
    to: string
    subject: string
    messageId?: string
    status: 'sent' | 'failed'
    error?: string
  }): Promise<void> {
    try {
      await prisma.analytics.create({
        data: {
          userId: 'system', // Will be updated when user management is implemented
          eventType: 'EMAIL_DELIVERY',
          eventData: JSON.stringify({
            to: data.to,
            subject: data.subject,
            messageId: data.messageId,
            status: data.status,
            error: data.error
          }),
          timestamp: new Date()
        }
      })
    } catch (error) {
      logger.error('Failed to log email delivery:', error)
    }
  }

  async sendBulkEmails(emails: EmailData[]): Promise<EmailDeliveryResult[]> {
    const results: EmailDeliveryResult[] = []
    
    // Process emails in batches to avoid overwhelming the SMTP server
    const batchSize = 10
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(email => this.sendEmail(email))
      )
      
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          success: false,
          error: result.reason?.message || 'Unknown error'
        }
      ))
      
      // Add delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }

  async getEmailStats(): Promise<{
    totalSent: number
    totalFailed: number
    successRate: number
  }> {
    try {
      const stats = await prisma.analytics.groupBy({
        by: ['eventType'],
        where: {
          eventType: 'EMAIL_DELIVERY',
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        _count: true
      })

      const totalSent = stats.find(s => s.eventType === 'EMAIL_DELIVERY')?._count || 0
      const totalFailed = 0 // Would need to track failed emails separately
      const successRate = totalSent > 0 ? ((totalSent - totalFailed) / totalSent) * 100 : 0

      return { totalSent, totalFailed, successRate }
    } catch (error) {
      logger.error('Failed to get email stats:', error)
      return { totalSent: 0, totalFailed: 0, successRate: 0 }
    }
  }
}

export const productionEmailService = new ProductionEmailService()
