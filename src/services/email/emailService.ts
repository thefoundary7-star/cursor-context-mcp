import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

interface LicenseEmailData {
  firstName: string
  email: string
  licenseKey: string
  plan: string
  subscriptionId: string
  downloadUrl: string
}

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.SMTP_PASS || ''
      }
    }

    this.transporter = nodemailer.createTransporter(config)
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@mcpserver.com',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      })

      console.log('Email sent:', info.messageId)
      return true
    } catch (error) {
      console.error('Email sending failed:', error)
      return false
    }
  }

  async sendLicenseKey(data: LicenseEmailData): Promise<boolean> {
    const setupInstructions = this.getSetupInstructions(data.plan)
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your MCP Server License</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .license-box { background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .license-key { font-family: monospace; font-size: 14px; background: #f1f5f9; padding: 10px; border-radius: 4px; word-break: break-all; }
        .step { margin: 15px 0; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #2563eb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Welcome to MCP Server!</h1>
        <p>Your license is ready</p>
      </div>
      
      <div class="content">
        <p>Hi ${data.firstName},</p>
        
        <p>Thank you for choosing MCP Server! Your ${data.plan} plan is now active and ready to use.</p>
        
        <div class="license-box">
          <h3>Your License Key</h3>
          <div class="license-key">${data.licenseKey}</div>
          <p><small>⚠️ Keep this license key secure - you'll need it to activate your MCP server</small></p>
        </div>

        <h3>Quick Setup (5 minutes)</h3>
        ${setupInstructions}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.downloadUrl}" class="button">Download MCP Server</a>
          <a href="https://docs.mcpserver.com/setup" class="button" style="background: #6b7280;">View Setup Guide</a>
        </div>

        <h3>What's Next?</h3>
        <ul>
          <li>Download and install the MCP server</li>
          <li>Configure Claude Desktop to use your server</li>
          <li>Start coding with AI that understands your project</li>
          <li>Enjoy privacy-first AI development</li>
        </ul>

        <p>Need help? Reply to this email or visit our <a href="https://docs.mcpserver.com">documentation</a>.</p>

        <p>Best regards,<br>The MCP Server Team</p>
      </div>
      
      <div class="footer">
        <p>MCP Server - Privacy-First AI Development Tools</p>
        <p>Subscription ID: ${data.subscriptionId}</p>
      </div>
    </body>
    </html>
    `

    const text = `
    Welcome to MCP Server!
    
    Hi ${data.firstName},
    
    Your ${data.plan} plan is now active. Here's your license key:
    
    ${data.licenseKey}
    
    Download: ${data.downloadUrl}
    Setup Guide: https://docs.mcpserver.com/setup
    
    Need help? Reply to this email.
    
    Best regards,
    The MCP Server Team
    `

    return this.sendEmail({
      to: data.email,
      subject: '🎉 Your MCP Server License is Ready!',
      html,
      text
    })
  }

  private getSetupInstructions(plan: string): string {
    const baseInstructions = `
    <div class="step">
      <strong>Step 1:</strong> Download the MCP server for your operating system
    </div>
    <div class="step">
      <strong>Step 2:</strong> Run the installer and enter your license key when prompted
    </div>
    <div class="step">
      <strong>Step 3:</strong> Configure Claude Desktop to connect to your local MCP server
    </div>
    <div class="step">
      <strong>Step 4:</strong> Start using Claude with full access to your local files
    </div>
    `

    if (plan === 'ENTERPRISE') {
      return baseInstructions + `
      <div class="step" style="border-left-color: #f59e0b;">
        <strong>Enterprise Setup:</strong> Contact support@mcpserver.com for SSO configuration and team management setup
      </div>
      `
    }

    return baseInstructions
  }

  async sendTrialReminder(email: string, firstName: string, daysLeft: number): Promise<boolean> {
    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Your MCP Server trial expires in ${daysLeft} days</h2>
      
      <p>Hi ${firstName},</p>
      
      <p>Just a friendly reminder that your MCP Server trial will expire in ${daysLeft} days.</p>
      
      <p>To continue using your privacy-first AI development tools without interruption, update your billing information in your dashboard.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://mcpserver.com/dashboard/billing" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Billing</a>
      </div>
      
      <p>Questions? Reply to this email.</p>
      
      <p>Best regards,<br>The MCP Server Team</p>
    </body>
    </html>
    `

    return this.sendEmail({
      to: email,
      subject: `Your MCP Server trial expires in ${daysLeft} days`,
      html
    })
  }

  async sendWelcomeSequence(email: string, firstName: string, plan: string): Promise<void> {
    // Send immediate welcome
    await this.sendEmail({
      to: email,
      subject: 'Welcome to MCP Server! 👋',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome ${firstName}! 🎉</h2>
        <p>You're now part of the MCP Server community - developers who prioritize privacy without sacrificing AI capabilities.</p>
        <p>Your setup email with license key is on its way. In the meantime, here are some resources:</p>
        <ul>
          <li><a href="https://docs.mcpserver.com/quickstart">Quick Start Guide</a></li>
          <li><a href="https://docs.mcpserver.com/troubleshooting">Troubleshooting</a></li>
          <li><a href="https://community.mcpserver.com">Community Forum</a></li>
        </ul>
      </div>
      `
    })

    // Schedule follow-up emails (in real implementation, use a queue)
    // Day 3: Setup check-in
    // Day 7: Features highlight
    // Day 14: Trial reminder (if applicable)
  }
}

export const emailService = new EmailService()