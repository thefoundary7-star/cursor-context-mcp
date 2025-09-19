import { Router, Request, Response } from 'express';
import { BillingService } from '@/services/billingService';
import { UsageService } from '@/services/usageService';
import { authenticate, adminOnly } from '@/middleware/auth';
import { 
  validateCreateSubscription,
  validateUpdateSubscription,
  validateCancelSubscription 
} from '@/utils/validation';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '@/types';
import { SUBSCRIPTION_TIERS } from '@/config/stripe';

const router = Router();

// POST /api/billing/create-subscription
router.post('/create-subscription', authenticate, validateCreateSubscription, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { plan, paymentMethodId, trialPeriodDays } = req.body;
  
  const result = await BillingService.createSubscription(userId, {
    plan,
    paymentMethodId,
    trialPeriodDays,
  });
  
  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Subscription created successfully',
  };
  
  res.json(response);
}));

// POST /api/billing/update-subscription
router.post('/update-subscription', authenticate, validateUpdateSubscription, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { plan, prorationBehavior } = req.body;
  
  const subscription = await BillingService.updateSubscription(userId, {
    plan,
    prorationBehavior,
  });
  
  const response: ApiResponse = {
    success: true,
    data: subscription,
    message: 'Subscription updated successfully',
  };
  
  res.json(response);
}));

// POST /api/billing/cancel-subscription
router.post('/cancel-subscription', authenticate, validateCancelSubscription, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { cancelAtPeriodEnd = true, cancellationReason } = req.body;
  
  const subscription = await BillingService.cancelSubscription(userId, {
    cancelAtPeriodEnd,
    cancellationReason,
  });
  
  const response: ApiResponse = {
    success: true,
    data: subscription,
    message: cancelAtPeriodEnd 
      ? 'Subscription will be canceled at the end of the current period'
      : 'Subscription canceled immediately',
  };
  
  res.json(response);
}));

// GET /api/billing/subscription
router.get('/subscription', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const subscription = await BillingService.getSubscription(userId);
  
  const response: ApiResponse = {
    success: true,
    data: subscription,
    message: 'Subscription retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/invoices
router.get('/invoices', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { limit = 10 } = req.query;
  
  const invoices = await BillingService.getInvoices(userId, parseInt(limit as string));
  
  const response: ApiResponse = {
    success: true,
    data: invoices,
    message: 'Invoices retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/usage-stats
router.get('/usage-stats', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const usageStats = await BillingService.getUsageStats(userId);
  
  const response: ApiResponse = {
    success: true,
    data: usageStats,
    message: 'Usage statistics retrieved successfully',
  };
  
  res.json(response);
}));

// POST /api/billing/create-portal-session
router.post('/create-portal-session', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { returnUrl } = req.body;
  
  if (!returnUrl) {
    return res.status(400).json({
      success: false,
      error: 'Return URL is required',
    });
  }
  
  const session = await BillingService.createCustomerPortalSession(userId, returnUrl);
  
  const response: ApiResponse = {
    success: true,
    data: session,
    message: 'Customer portal session created successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/plans
router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  const plans = Object.entries(SUBSCRIPTION_TIERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    priceId: config.priceId,
    operationsPerHour: config.operationsPerHour,
    features: config.features,
    limits: config.limits,
  }));
  
  const response: ApiResponse = {
    success: true,
    data: plans,
    message: 'Subscription plans retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/usage-history
router.get('/usage-history', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { 
    startDate, 
    endDate, 
    operationType,
    page = 1,
    limit = 50 
  } = req.query;
  
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  
  const usage = await UsageService.getUsageHistory(
    userId,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined,
    operationType as string
  );
  
  // Apply pagination
  const paginatedUsage = usage.slice(skip, skip + parseInt(limit as string));
  const total = usage.length;
  const totalPages = Math.ceil(total / parseInt(limit as string));
  
  const response: PaginatedResponse<typeof paginatedUsage> = {
    success: true,
    data: paginatedUsage,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages,
    },
    message: 'Usage history retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/usage-summary
router.get('/usage-summary', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { startDate, endDate } = req.query;
  
  const summary = await UsageService.getUsageSummary(
    userId,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined
  );
  
  const response: ApiResponse = {
    success: true,
    data: summary,
    message: 'Usage summary retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/quota-status
router.get('/quota-status', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const quotaStatus = await UsageService.getQuotaStatus(userId);
  
  const response: ApiResponse = {
    success: true,
    data: quotaStatus,
    message: 'Quota status retrieved successfully',
  };
  
  res.json(response);
}));

// POST /api/billing/track-usage
router.post('/track-usage', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { 
    operationType, 
    count = 1, 
    metadata,
    licenseId,
    serverId 
  } = req.body;
  
  if (!operationType) {
    return res.status(400).json({
      success: false,
      error: 'Operation type is required',
    });
  }
  
  // Check quota before tracking
  const quotaCheck = await UsageService.checkQuota(userId, operationType);
  if (!quotaCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: quotaCheck.reason,
    });
  }
  
  await UsageService.trackUsage(
    userId,
    operationType,
    count,
    metadata,
    licenseId,
    serverId
  );
  
  const response: ApiResponse = {
    success: true,
    message: 'Usage tracked successfully',
  };
  
  res.json(response);
}));

// GET /api/billing/payment-methods
router.get('/payment-methods', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  // Get user's subscription to find Stripe customer ID
  const subscription = await BillingService.getSubscription(userId);
  
  if (!subscription.stripeCustomerId) {
    return res.json({
      success: true,
      data: [],
      message: 'No payment methods found',
    });
  }
  
  const paymentMethods = await BillingService.getPaymentMethods(subscription.stripeCustomerId);
  
  const response: ApiResponse = {
    success: true,
    data: paymentMethods,
    message: 'Payment methods retrieved successfully',
  };
  
  res.json(response);
}));

// POST /api/billing/setup-intent
router.post('/setup-intent', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  // Get user's subscription to find Stripe customer ID
  const subscription = await BillingService.getSubscription(userId);
  
  if (!subscription.stripeCustomerId) {
    return res.status(400).json({
      success: false,
      error: 'No Stripe customer found. Please create a subscription first.',
    });
  }
  
  const setupIntent = await BillingService.createSetupIntent(subscription.stripeCustomerId);
  
  const response: ApiResponse = {
    success: true,
    data: { clientSecret: setupIntent.client_secret },
    message: 'Setup intent created successfully',
  };
  
  res.json(response);
}));

// POST /api/billing/cleanup-usage (Admin only)
router.post('/cleanup-usage', authenticate, adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { retentionDays = 90 } = req.body;
  
  const deletedCount = await UsageService.cleanupOldUsage(retentionDays);
  
  const response: ApiResponse = {
    success: true,
    data: { deletedCount, retentionDays },
    message: `Cleaned up ${deletedCount} old usage records`,
  };
  
  res.json(response);
}));

// POST /api/billing/reset-usage (Admin only)
router.post('/reset-usage', authenticate, adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, operationType } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required',
    });
  }
  
  await UsageService.resetUsage(userId, operationType);
  
  const response: ApiResponse = {
    success: true,
    message: 'Usage reset successfully',
  };
  
  res.json(response);
}));

export default router;
