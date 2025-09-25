import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define enum constants since SQLite doesn't support enums
export const SubscriptionTier = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
} as const;

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const;

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELED: 'CANCELED',
  PAST_DUE: 'PAST_DUE',
  TRIALING: 'TRIALING',
  UNPAID: 'UNPAID'
} as const;

export interface UsageResult {
  allowed: boolean;
  remaining?: number | 'unlimited';
  resetTime?: string;
  error?: string;
}

export class UsageTracker {
  static async trackMCPCall(licenseKey: string, operation: string): Promise<UsageResult> {
    try {
      // DISABLE_LICENSE: Always allow unlimited usage
      if (process.env.DISABLE_LICENSE === 'true') {
        console.log('[DISABLE_LICENSE] Usage tracking bypassed - allowing unlimited usage');
        return { allowed: true, remaining: 'unlimited' };
      }

      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: { user: { include: { subscriptions: true } } }
      });

      if (!license || !license.isActive) {
        throw new Error('Invalid or inactive license');
      }

      // Check if this is a free tier user
      if (license.tier === SubscriptionTier.FREE) {
        return await this.handleFreeTierUsage(license.id, operation);
      }

      // For paid plans, just log the usage without limits
      await this.logUsage(license.id, operation);
      return { allowed: true, remaining: 'unlimited' };

    } catch (error) {
      console.error('Usage tracking error:', error);
      return { allowed: false, error: (error as Error).message };
    }
  }

  static async handleFreeTierUsage(licenseId: string, operation: string): Promise<UsageResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const DAILY_LIMIT = parseInt(process.env.FREE_TIER_DAILY_LIMIT || '50');

    // Get or create today's usage record
    const todayUsage = await prisma.dailyUsage.upsert({
      where: {
        licenseId_date: {
          licenseId,
          date: today
        }
      },
      update: {},
      create: {
        licenseId,
        date: today,
        callCount: 0
      }
    });

    if (todayUsage.callCount >= DAILY_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        error: 'Daily limit exceeded. Upgrade to Pro for unlimited usage.',
        resetTime: tomorrow.toISOString()
      };
    }

    // Increment usage count
    await prisma.dailyUsage.update({
      where: { id: todayUsage.id },
      data: { callCount: { increment: 1 } }
    });

    // Log the detailed usage
    await this.logUsage(licenseId, operation);
    
    return {
      allowed: true,
      remaining: DAILY_LIMIT - todayUsage.callCount - 1,
      resetTime: tomorrow.toISOString()
    };
  }

  static async logUsage(licenseId: string, operation: string): Promise<void> {
    const license = await prisma.license.findUnique({
      where: { id: licenseId }
    });

    if (!license) return;

    await prisma.usage.create({
      data: {
        userId: license.userId,
        licenseId,
        operationType: operation,
        count: 1,
        timestamp: new Date(),
        billingPeriod: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });
  }

  static async getDailyUsage(licenseKey: string) {
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: { user: true }
      });

      if (!license) {
        throw new Error('License not found');
      }

      if (license.tier !== SubscriptionTier.FREE) {
        return { usage: 'unlimited', remaining: 'unlimited' };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayUsage = await prisma.dailyUsage.findUnique({
        where: {
          licenseId_date: {
            licenseId: license.id,
            date: today
          }
        }
      });

      const DAILY_LIMIT = parseInt(process.env.FREE_TIER_DAILY_LIMIT || '50');
      const usedCalls = todayUsage?.callCount || 0;
      
      return {
        usage: usedCalls,
        remaining: Math.max(0, DAILY_LIMIT - usedCalls),
        limit: DAILY_LIMIT,
        resetTime: tomorrow.toISOString()
      };

    } catch (error) {
      console.error('Get usage error:', error);
      throw error;
    }
  }

  static generateFreeLicenseKey(email: string): string {
    const crypto = require('crypto');
    const salt = process.env.LICENSE_SALT || 'default-salt';
    const hash = crypto.createHash('sha256').update(email + salt).digest('hex');
    const shortHash = hash.substring(0, 8).toUpperCase();
    return `FILEBRIDGE-FREE-${shortHash}`;
  }
}

export default UsageTracker;
