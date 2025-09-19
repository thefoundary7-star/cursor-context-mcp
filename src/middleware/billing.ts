import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { UsageService } from '@/services/usageService';
import { BillingService } from '@/services/billingService';
import { 
  NotFoundError, 
  QuotaExceededError,
  AuthenticationError 
} from '@/utils/errors';
import { AuthenticatedRequest } from '@/types';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

// Middleware to check subscription status
export const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const userId = req.user.id;
    const subscription = await BillingService.getSubscription(userId);

    // Check if subscription is active
    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
      res.status(403).json({
        success: false,
        error: 'Active subscription required',
        subscription: {
          status: subscription.status,
          plan: subscription.plan,
        },
      });
      return;
    }

    // Check if trial is expired
    if (subscription.trialInfo?.isExpired) {
      res.status(403).json({
        success: false,
        error: 'Trial period has expired. Please upgrade your subscription.',
        trialInfo: subscription.trialInfo,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check quota before processing requests
export const checkQuota = (operationType: string = 'api_call') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userId = req.user.id;
      const quotaCheck = await UsageService.checkQuota(userId, operationType);

      if (!quotaCheck.allowed) {
        res.status(429).json({
          success: false,
          error: quotaCheck.reason,
          quotaExceeded: true,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to track usage after successful requests
export const trackUsage = (operationType: string = 'api_call', count: number = 1) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      
      // Track usage in background (don't wait for it)
      UsageService.trackUsage(
        userId,
        operationType,
        count,
        {
          endpoint: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        }
      ).catch(error => {
        logger.error('Usage tracking failed', {
          error: error.message,
          userId,
          operationType,
          count,
        });
      });

      next();
    } catch (error) {
      // Don't fail the request if usage tracking fails
      logger.error('Usage tracking middleware error', {
        error: error.message,
        operationType,
        count,
      });
      next();
    }
  };
};

// Middleware to check subscription tier
export const requireSubscriptionTier = (...allowedTiers: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userId = req.user.id;
      const subscription = await BillingService.getSubscription(userId);

      if (!allowedTiers.includes(subscription.plan)) {
        res.status(403).json({
          success: false,
          error: `This feature requires one of the following subscription tiers: ${allowedTiers.join(', ')}`,
          currentPlan: subscription.plan,
          requiredTiers: allowedTiers,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check feature access based on subscription
export const checkFeatureAccess = (feature: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userId = req.user.id;
      const subscription = await BillingService.getSubscription(userId);

      // Define feature access by tier
      const featureAccess: Record<string, string[]> = {
        'advanced_analytics': ['PRO', 'ENTERPRISE'],
        'api_access': ['PRO', 'ENTERPRISE'],
        'custom_integrations': ['PRO', 'ENTERPRISE'],
        'priority_support': ['PRO', 'ENTERPRISE'],
        'unlimited_servers': ['ENTERPRISE'],
        'sla_guarantee': ['ENTERPRISE'],
        'custom_deployment': ['ENTERPRISE'],
      };

      const requiredTiers = featureAccess[feature];
      if (!requiredTiers) {
        // Feature not defined, allow access
        return next();
      }

      if (!requiredTiers.includes(subscription.plan)) {
        res.status(403).json({
          success: false,
          error: `Feature '${feature}' is not available in your current subscription tier`,
          currentPlan: subscription.plan,
          requiredTiers,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check server limits
export const checkServerLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const userId = req.user.id;
    const subscription = await BillingService.getSubscription(userId);

    // Get current server count
    const serverCount = await prisma.server.count({
      where: {
        license: {
          userId,
        },
        isActive: true,
      },
    });

    // Get tier limits
    const { SUBSCRIPTION_TIERS } = await import('@/config/stripe');
    const tierConfig = SUBSCRIPTION_TIERS[subscription.plan as keyof typeof SUBSCRIPTION_TIERS];
    
    if (serverCount >= tierConfig.limits.maxServers) {
      res.status(403).json({
        success: false,
        error: 'Server limit exceeded',
        currentCount: serverCount,
        maxServers: tierConfig.limits.maxServers,
        plan: subscription.plan,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check license limits
export const checkLicenseLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const userId = req.user.id;
    const subscription = await BillingService.getSubscription(userId);

    // Get current license count
    const licenseCount = await prisma.license.count({
      where: {
        userId,
        isActive: true,
      },
    });

    // Get tier limits
    const { SUBSCRIPTION_TIERS } = await import('@/config/stripe');
    const tierConfig = SUBSCRIPTION_TIERS[subscription.plan as keyof typeof SUBSCRIPTION_TIERS];
    
    if (licenseCount >= tierConfig.limits.maxLicenses) {
      res.status(403).json({
        success: false,
        error: 'License limit exceeded',
        currentCount: licenseCount,
        maxLicenses: tierConfig.limits.maxLicenses,
        plan: subscription.plan,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check API key limits
export const checkApiKeyLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const userId = req.user.id;
    const subscription = await BillingService.getSubscription(userId);

    // Get current API key count
    const apiKeyCount = await prisma.apiKey.count({
      where: {
        userId,
        isActive: true,
      },
    });

    // Get tier limits
    const { SUBSCRIPTION_TIERS } = await import('@/config/stripe');
    const tierConfig = SUBSCRIPTION_TIERS[subscription.plan as keyof typeof SUBSCRIPTION_TIERS];
    
    if (apiKeyCount >= tierConfig.limits.maxApiKeys) {
      res.status(403).json({
        success: false,
        error: 'API key limit exceeded',
        currentCount: apiKeyCount,
        maxApiKeys: tierConfig.limits.maxApiKeys,
        plan: subscription.plan,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to add subscription info to request
export const addSubscriptionInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const subscription = await BillingService.getSubscription(userId);
    
    // Add subscription info to request
    (req as any).subscription = subscription;
    
    next();
  } catch (error) {
    // Don't fail the request if subscription info can't be retrieved
    logger.error('Failed to add subscription info', {
      error: error.message,
      userId: req.user?.id,
    });
    next();
  }
};

// Middleware to check if user is on trial
export const requireTrialOrActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const userId = req.user.id;
    const subscription = await BillingService.getSubscription(userId);

    // Allow if subscription is active or user is on trial
    if (subscription.status === 'ACTIVE' || subscription.trialInfo?.isActive) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'Active subscription or trial required',
      subscription: {
        status: subscription.status,
        plan: subscription.plan,
        trialInfo: subscription.trialInfo,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Middleware to enforce rate limiting based on subscription tier
export const tierBasedRateLimit = () => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const subscription = await BillingService.getSubscription(userId);

      // Get tier configuration
      const { SUBSCRIPTION_TIERS } = await import('@/config/stripe');
      const tierConfig = SUBSCRIPTION_TIERS[subscription.plan as keyof typeof SUBSCRIPTION_TIERS];

      // Check if user has exceeded hourly quota
      const quotaCheck = await UsageService.checkQuota(userId, 'api_call');
      if (!quotaCheck.allowed) {
        res.status(429).json({
          success: false,
          error: quotaCheck.reason,
          tier: subscription.plan,
          operationsPerHour: tierConfig.operationsPerHour,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
