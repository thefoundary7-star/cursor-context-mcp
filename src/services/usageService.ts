import { PrismaClient } from '@prisma/client';
import { 
  NotFoundError, 
  QuotaExceededError,
  ValidationError 
} from '@/utils/errors';
import { UsageStats, TrialInfo } from '@/types';
import { SUBSCRIPTION_TIERS, isTrialEligible, isTrialActive, isTrialExpired } from '@/config/stripe';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

export class UsageService {
  // Track usage for a user
  static async trackUsage(
    userId: string,
    operationType: string,
    count: number = 1,
    metadata?: Record<string, any>,
    licenseId?: string,
    serverId?: string
  ): Promise<void> {
    try {
      // Get current billing period
      const billingPeriod = this.getCurrentBillingPeriod();
      
      // Create usage record
      await prisma.usage.create({
        data: {
          userId,
          licenseId,
          serverId,
          operationType,
          count,
          metadata,
          billingPeriod,
        },
      });

      logger.info('Usage tracked', {
        userId,
        operationType,
        count,
        licenseId,
        serverId,
        billingPeriod,
      });
    } catch (error) {
      logger.error('Usage tracking failed', {
        error: (error as Error).message,
        userId,
        operationType,
        count,
      });
      throw error;
    }
  }

  // Check if user has exceeded quota
  static async checkQuota(
    userId: string,
    operationType: string = 'api_call'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if user is on trial
      const trialInfo = this.getTrialInfo(user);
      if (trialInfo.isActive) {
        // Allow usage during trial
        return { allowed: true };
      }

      // Get user's current subscription
      const subscription = user.subscriptions[0];
      if (!subscription) {
        // No active subscription, check if they have a free tier
        const tier = 'FREE';
        return await this.checkTierQuota(userId, tier, operationType);
      }

      // Check subscription tier quota
      const tier = subscription.plan as keyof typeof SUBSCRIPTION_TIERS;
      return await this.checkTierQuota(userId, tier, operationType);
    } catch (error) {
      logger.error('Quota check failed', {
        error: (error as Error).message,
        userId,
        operationType,
      });
      throw error;
    }
  }

  // Check quota for specific tier
  private static async checkTierQuota(
    userId: string,
    tier: keyof typeof SUBSCRIPTION_TIERS,
    operationType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    // Get usage for current hour
    const hourlyUsage = await prisma.usage.aggregate({
      where: {
        userId,
        operationType,
        timestamp: {
          gte: currentHour,
        },
      },
      _sum: {
        count: true,
      },
    });

    const currentUsage = hourlyUsage._sum.count || 0;
    const limit = tierConfig.operationsPerHour;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        reason: `Hourly quota exceeded. Used ${currentUsage}/${limit} operations.`,
      };
    }

    return { allowed: true };
  }

  // Get usage statistics for a user
  static async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          licenses: {
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const billingPeriod = this.getCurrentBillingPeriod();
      const tier = user.subscriptions[0]?.plan as keyof typeof SUBSCRIPTION_TIERS || 'FREE';
      const tierConfig = SUBSCRIPTION_TIERS[tier];

      // Get current period usage
      const [operationsUsage, serversCount, licensesCount] = await Promise.all([
        prisma.usage.aggregate({
          where: {
            userId,
            billingPeriod: {
              gte: billingPeriod.start,
              lt: billingPeriod.end,
            },
          },
          _sum: {
            count: true,
          },
        }),
        prisma.server.count({
          where: {
            license: {
              userId,
            },
            isActive: true,
          },
        }),
        prisma.license.count({
          where: {
            userId,
            isActive: true,
          },
        }),
      ]);

      const currentOperations = operationsUsage._sum.count || 0;
      const currentServers = serversCount;
      const currentLicenses = licensesCount;

      // Calculate usage percentages
      const operationsPercentage = Math.round((currentOperations / (tierConfig.operationsPerHour * 24 * 30)) * 100);
      const serversPercentage = Math.round((currentServers / tierConfig.limits.maxServers) * 100);
      const licensesPercentage = Math.round((currentLicenses / tierConfig.limits.maxLicenses) * 100);

      return {
        currentPeriod: {
          operations: currentOperations,
          servers: currentServers,
          licenses: currentLicenses,
        },
        limits: {
          operationsPerHour: tierConfig.operationsPerHour,
          maxServers: tierConfig.limits.maxServers,
          maxLicenses: tierConfig.limits.maxLicenses,
        },
        usagePercentage: {
          operations: operationsPercentage,
          servers: serversPercentage,
          licenses: licensesPercentage,
        },
        billingPeriod: {
          start: billingPeriod.start,
          end: billingPeriod.end,
        },
      };
    } catch (error) {
      logger.error('Get usage stats failed', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  // Get trial information for a user
  static getTrialInfo(user: { createdAt: Date; trialEndsAt?: Date | null }): TrialInfo {
    const isEligible = isTrialEligible(user.createdAt);
    const trialEnd = user.trialEndsAt;
    
    if (!trialEnd) {
      return {
        isEligible,
        isActive: false,
        isExpired: false,
      };
    }

    const isActive = isTrialActive(trialEnd);
    const isExpired = isTrialExpired(trialEnd);
    const daysRemaining = isActive ? Math.ceil((trialEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      isEligible,
      isActive,
      isExpired,
      trialEnd,
      daysRemaining: Math.max(0, daysRemaining),
    };
  }

  // Get current billing period
  private static getCurrentBillingPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return { start, end };
  }

  // Get usage history for a user
  static async getUsageHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    operationType?: string
  ): Promise<any[]> {
    try {
      const where: any = { userId };
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }
      
      if (operationType) {
        where.operationType = operationType;
      }

      const usage = await prisma.usage.findMany({
        where,
        include: {
          license: {
            select: {
              id: true,
              name: true,
              licenseKey: true,
            },
          },
          server: {
            select: {
              id: true,
              serverId: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 1000, // Limit to prevent large responses
      });

      return usage;
    } catch (error) {
      logger.error('Get usage history failed', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  // Get usage summary by operation type
  static async getUsageSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    try {
      const where: any = { userId };
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const usage = await prisma.usage.groupBy({
        by: ['operationType'],
        where,
        _sum: {
          count: true,
        },
      });

      const summary: Record<string, number> = {};
      usage.forEach(item => {
        summary[item.operationType] = item._sum.count || 0;
      });

      return summary;
    } catch (error) {
      logger.error('Get usage summary failed', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  // Clean up old usage data
  static async cleanupOldUsage(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.usage.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Usage cleanup completed', {
        deletedCount: result.count,
        retentionDays,
      });

      return result.count;
    } catch (error) {
      logger.error('Usage cleanup failed', {
        error: (error as Error).message,
        retentionDays,
      });
      throw error;
    }
  }

  // Reset usage for a user (admin function)
  static async resetUsage(userId: string, operationType?: string): Promise<void> {
    try {
      const where: any = { userId };
      if (operationType) {
        where.operationType = operationType;
      }

      await prisma.usage.deleteMany({ where });

      logger.info('Usage reset completed', {
        userId,
        operationType,
      });
    } catch (error) {
      logger.error('Usage reset failed', {
        error: (error as Error).message,
        userId,
        operationType,
      });
      throw error;
    }
  }

  // Get quota status for a user
  static async getQuotaStatus(userId: string): Promise<{
    tier: string;
    limits: any;
    currentUsage: any;
    isOverQuota: boolean;
    trialInfo: TrialInfo;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const tier = user.subscriptions[0]?.plan as keyof typeof SUBSCRIPTION_TIERS || 'FREE';
      const tierConfig = SUBSCRIPTION_TIERS[tier];
      const trialInfo = this.getTrialInfo(user);

      // Get current usage
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);

      const hourlyUsage = await prisma.usage.aggregate({
        where: {
          userId,
          timestamp: {
            gte: currentHour,
          },
        },
        _sum: {
          count: true,
        },
      });

      const currentOperations = hourlyUsage._sum.count || 0;
      const isOverQuota = currentOperations >= tierConfig.operationsPerHour;

      return {
        tier,
        limits: tierConfig,
        currentUsage: {
          operations: currentOperations,
          operationsPerHour: tierConfig.operationsPerHour,
        },
        isOverQuota,
        trialInfo,
      };
    } catch (error) {
      logger.error('Get quota status failed', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }
}
