import { PrismaClient, User, Subscription, License } from '@prisma/client'
import { logger } from '@/utils/logger'
import { productionEmailService } from '../email/productionEmailService'
import crypto from 'crypto'

const prisma = new PrismaClient()

interface CreateUserFromWebhookData {
  email: string
  customerId: string
  subscriptionId: string
  productId: string
  plan: string
  customerName?: string
  company?: string
}

interface UserWithRelations extends User {
  subscriptions: Subscription[]
  licenses: License[]
}

export class UserManagementService {
  
  /**
   * Create or update user from webhook data
   */
  async createOrUpdateUserFromWebhook(data: CreateUserFromWebhookData): Promise<UserWithRelations> {
    try {
      // Check if user already exists by email
      let user = await prisma.user.findUnique({
        where: { email: data.email },
        include: {
          subscriptions: true,
          licenses: true
        }
      })

      if (user) {
        // Update existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: data.customerName || user.name,
            company: data.company || user.company,
            updatedAt: new Date()
          },
          include: {
            subscriptions: true,
            licenses: true
          }
        })
        
        logger.info('Updated existing user from webhook', { 
          userId: user.id, 
          email: user.email,
          subscriptionId: data.subscriptionId 
        })
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.customerName,
            company: data.company,
            role: 'USER',
            isActive: true,
            emailVerified: new Date(), // Assume verified if coming from payment system
            createdAt: new Date(),
            updatedAt: new Date()
          },
          include: {
            subscriptions: true,
            licenses: true
          }
        })
        
        logger.info('Created new user from webhook', { 
          userId: user.id, 
          email: user.email,
          subscriptionId: data.subscriptionId 
        })

        // Send welcome email
        await this.sendWelcomeEmail(user)
      }

      return user
    } catch (error) {
      logger.error('Failed to create/update user from webhook:', error)
      throw error
    }
  }

  /**
   * Create subscription and link to user
   */
  async createSubscriptionForUser(
    userId: string, 
    subscriptionData: {
      dodoSubscriptionId: string
      dodoCustomerId: string
      dodoProductId: string
      tier: string
      status: string
      currentPeriodStart: Date
      currentPeriodEnd: Date
      amount?: number
      currency?: string
      metadata?: any
    }
  ): Promise<Subscription> {
    try {
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          dodoSubscriptionId: subscriptionData.dodoSubscriptionId,
          dodoCustomerId: subscriptionData.dodoCustomerId,
          dodoProductId: subscriptionData.dodoProductId,
          tier: subscriptionData.tier,
          status: subscriptionData.status,
          currentPeriodStart: subscriptionData.currentPeriodStart,
          currentPeriodEnd: subscriptionData.currentPeriodEnd,
          metadata: subscriptionData.metadata ? JSON.stringify(subscriptionData.metadata) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      logger.info('Created subscription for user', { 
        userId, 
        subscriptionId: subscription.id,
        dodoSubscriptionId: subscriptionData.dodoSubscriptionId 
      })

      return subscription
    } catch (error) {
      logger.error('Failed to create subscription for user:', error)
      throw error
    }
  }

  /**
   * Create license and link to user and subscription
   */
  async createLicenseForUser(
    userId: string,
    subscriptionId: string,
    licenseData: {
      tier: string
      name?: string
      description?: string
      maxServers?: number
      expiresAt?: Date
    }
  ): Promise<License> {
    try {
      const licenseKey = this.generateLicenseKey(licenseData.tier, userId, subscriptionId)
      
      const license = await prisma.license.create({
        data: {
          userId,
          licenseKey,
          name: licenseData.name || `${licenseData.tier.toUpperCase()} License`,
          description: licenseData.description || `Generated for subscription ${subscriptionId}`,
          tier: licenseData.tier,
          maxServers: licenseData.maxServers || this.getMaxServersForTier(licenseData.tier),
          isActive: true,
          expiresAt: licenseData.expiresAt,
          subscriptionId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      logger.info('Created license for user', { 
        userId, 
        licenseId: license.id,
        licenseKey: license.licenseKey,
        tier: licenseData.tier 
      })

      return license
    } catch (error) {
      logger.error('Failed to create license for user:', error)
      throw error
    }
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(
    dodoSubscriptionId: string,
    status: string,
    additionalData?: {
      canceledAt?: Date
      cancellationReason?: string
      lastPaymentAt?: Date
    }
  ): Promise<Subscription | null> {
    try {
      const subscription = await prisma.subscription.update({
        where: { dodoSubscriptionId },
        data: {
          status,
          canceledAt: additionalData?.canceledAt,
          cancellationReason: additionalData?.cancellationReason,
          lastPaymentAt: additionalData?.lastPaymentAt,
          updatedAt: new Date()
        }
      })

      logger.info('Updated subscription status', { 
        dodoSubscriptionId, 
        status,
        subscriptionId: subscription.id 
      })

      return subscription
    } catch (error) {
      logger.error('Failed to update subscription status:', error)
      return null
    }
  }

  /**
   * Revoke license (set inactive)
   */
  async revokeLicense(subscriptionId: string): Promise<void> {
    try {
      await prisma.license.updateMany({
        where: { subscriptionId },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      })

      logger.info('Revoked license for subscription', { subscriptionId })
    } catch (error) {
      logger.error('Failed to revoke license:', error)
      throw error
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserWithRelations | null> {
    try {
      return await prisma.user.findUnique({
        where: { email },
        include: {
          subscriptions: true,
          licenses: true
        }
      })
    } catch (error) {
      logger.error('Failed to get user by email:', error)
      return null
    }
  }

  /**
   * Get user by Dodo customer ID
   */
  async getUserByDodoCustomerId(dodoCustomerId: string): Promise<UserWithRelations | null> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { dodoCustomerId },
        include: {
          user: {
            include: {
              subscriptions: true,
              licenses: true
            }
          }
        }
      })

      return subscription?.user || null
    } catch (error) {
      logger.error('Failed to get user by Dodo customer ID:', error)
      return null
    }
  }

  /**
   * Send license key email to user
   */
  async sendLicenseKeyEmail(
    user: UserWithRelations,
    license: License,
    subscription: Subscription
  ): Promise<boolean> {
    try {
      const result = await productionEmailService.sendLicenseKey({
        to: user.email,
        customerName: user.name || user.firstName,
        licenseKey: license.licenseKey,
        plan: license.tier,
        subscriptionId: subscription.dodoSubscriptionId,
        expiresAt: license.expiresAt,
        downloadUrl: this.getDownloadUrl(),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@filebridge.com'
      })

      if (result.success) {
        logger.info('License key email sent successfully', { 
          userId: user.id, 
          email: user.email,
          licenseKey: license.licenseKey 
        })
        return true
      } else {
        logger.error('Failed to send license key email', { 
          userId: user.id, 
          email: user.email,
          error: result.error 
        })
        return false
      }
    } catch (error) {
      logger.error('Failed to send license key email:', error)
      return false
    }
  }

  /**
   * Send payment failed email to user
   */
  async sendPaymentFailedEmail(
    user: UserWithRelations,
    subscription: Subscription,
    paymentData: {
      amount: number
      currency: string
      failureReason?: string
    }
  ): Promise<boolean> {
    try {
      const result = await productionEmailService.sendPaymentFailedEmail({
        to: user.email,
        customerName: user.name || user.firstName,
        plan: subscription.tier,
        amount: paymentData.amount,
        currency: paymentData.currency,
        retryUrl: this.getRetryPaymentUrl(subscription.dodoSubscriptionId),
        supportUrl: this.getSupportUrl(),
        nextRetryDate: this.getNextRetryDate()
      })

      if (result.success) {
        logger.info('Payment failed email sent successfully', { 
          userId: user.id, 
          email: user.email,
          subscriptionId: subscription.dodoSubscriptionId 
        })
        return true
      } else {
        logger.error('Failed to send payment failed email', { 
          userId: user.id, 
          email: user.email,
          error: result.error 
        })
        return false
      }
    } catch (error) {
      logger.error('Failed to send payment failed email:', error)
      return false
    }
  }

  /**
   * Send subscription cancelled email to user
   */
  async sendSubscriptionCancelledEmail(
    user: UserWithRelations,
    subscription: Subscription,
    cancellationReason?: string
  ): Promise<boolean> {
    try {
      const result = await productionEmailService.sendSubscriptionCancelledEmail({
        to: user.email,
        customerName: user.name || user.firstName,
        plan: subscription.tier,
        cancellationReason,
        reactivationUrl: this.getReactivationUrl(subscription.dodoSubscriptionId),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@filebridge.com'
      })

      if (result.success) {
        logger.info('Subscription cancelled email sent successfully', { 
          userId: user.id, 
          email: user.email,
          subscriptionId: subscription.dodoSubscriptionId 
        })
        return true
      } else {
        logger.error('Failed to send subscription cancelled email', { 
          userId: user.id, 
          email: user.email,
          error: result.error 
        })
        return false
      }
    } catch (error) {
      logger.error('Failed to send subscription cancelled email:', error)
      return false
    }
  }

  /**
   * Generate license key
   */
  private generateLicenseKey(tier: string, userId: string, subscriptionId: string): string {
    const timestamp = Date.now()
    const hash = crypto.createHash('sha256')
      .update(`${tier}-${userId}-${subscriptionId}-${timestamp}`)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()

    return `FB-${tier.toUpperCase()}-${hash}`
  }

  /**
   * Get max servers for tier
   */
  private getMaxServersForTier(tier: string): number {
    const limits = {
      free: 1,
      basic: 3,
      pro: 10,
      enterprise: 999
    }
    return limits[tier.toLowerCase() as keyof typeof limits] || 1
  }

  /**
   * Send welcome email
   */
  private async sendWelcomeEmail(user: UserWithRelations): Promise<void> {
    try {
      await productionEmailService.sendWelcomeEmail({
        to: user.email,
        customerName: user.name || user.firstName,
        plan: 'FREE', // Default for new users
        loginUrl: this.getLoginUrl(),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@filebridge.com'
      })
    } catch (error) {
      logger.error('Failed to send welcome email:', error)
    }
  }

  /**
   * Get download URL
   */
  private getDownloadUrl(): string {
    return process.env.DOWNLOAD_URL || 'https://releases.filebridge.com/latest'
  }

  /**
   * Get login URL
   */
  private getLoginUrl(): string {
    return process.env.LOGIN_URL || 'https://app.filebridge.com/login'
  }

  /**
   * Get retry payment URL
   */
  private getRetryPaymentUrl(subscriptionId: string): string {
    return `${process.env.APP_URL || 'https://app.filebridge.com'}/billing/retry?subscription=${subscriptionId}`
  }

  /**
   * Get support URL
   */
  private getSupportUrl(): string {
    return process.env.SUPPORT_URL || 'https://support.filebridge.com'
  }

  /**
   * Get reactivation URL
   */
  private getReactivationUrl(subscriptionId: string): string {
    return `${process.env.APP_URL || 'https://app.filebridge.com'}/billing/reactivate?subscription=${subscriptionId}`
  }

  /**
   * Get next retry date (3 days from now)
   */
  private getNextRetryDate(): Date {
    const date = new Date()
    date.setDate(date.getDate() + 3)
    return date
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number
    activeUsers: number
    totalSubscriptions: number
    activeSubscriptions: number
    totalLicenses: number
    activeLicenses: number
  }> {
    try {
      const [
        totalUsers,
        activeUsers,
        totalSubscriptions,
        activeSubscriptions,
        totalLicenses,
        activeLicenses
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.subscription.count(),
        prisma.subscription.count({ where: { status: 'active' } }),
        prisma.license.count(),
        prisma.license.count({ where: { isActive: true } })
      ])

      return {
        totalUsers,
        activeUsers,
        totalSubscriptions,
        activeSubscriptions,
        totalLicenses,
        activeLicenses
      }
    } catch (error) {
      logger.error('Failed to get user stats:', error)
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalLicenses: 0,
        activeLicenses: 0
      }
    }
  }
}

export const userManagementService = new UserManagementService()
