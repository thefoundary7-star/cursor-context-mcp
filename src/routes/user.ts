import { Router, Request, Response } from 'express';
import { AuthService } from '@/services/authService';
import { LicenseService } from '@/services/licenseService';
import { BillingService } from '@/services/billingService';
import { authenticate, adminOnly } from '@/middleware/auth';
import { 
  validateUpdateProfile, 
  validateCreateSubscription,
  validatePagination 
} from '@/utils/validation';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '@/types';

const router = Router();

// GET /api/user/profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const user = await AuthService.getUserProfile(userId);
  
  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'Profile retrieved successfully',
  };
  
  res.json(response);
}));

// PUT /api/user/profile
router.put('/profile', authenticate, validateUpdateProfile, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { firstName, lastName, company } = req.body;
  
  const user = await AuthService.updateUserProfile(userId, {
    firstName,
    lastName,
    company,
  });
  
  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'Profile updated successfully',
  };
  
  res.json(response);
}));

// GET /api/user/licenses
router.get('/licenses', authenticate, validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 10 } = req.query;
  
  const { licenses, total } = await LicenseService.getUserLicenses(
    userId,
    parseInt(page as string),
    parseInt(limit as string)
  );
  
  const totalPages = Math.ceil(total / parseInt(limit as string));
  
  const response: PaginatedResponse<typeof licenses> = {
    success: true,
    data: licenses,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages,
    },
    message: 'Licenses retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/user/licenses/:id
router.get('/licenses/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const license = await LicenseService.getLicenseById(id, userId);
  
  const response: ApiResponse = {
    success: true,
    data: license,
    message: 'License retrieved successfully',
  };
  
  res.json(response);
}));

// PUT /api/user/licenses/:id
router.put('/licenses/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { name, description, maxServers, expiresAt } = req.body;
  
  const license = await LicenseService.updateLicense(id, userId, {
    name,
    description,
    maxServers,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });
  
  const response: ApiResponse = {
    success: true,
    data: license,
    message: 'License updated successfully',
  };
  
  res.json(response);
}));

// DELETE /api/user/licenses/:id
router.delete('/licenses/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  await LicenseService.deactivateLicense(id, userId);
  
  const response: ApiResponse = {
    success: true,
    message: 'License deactivated successfully',
  };
  
  res.json(response);
}));

// GET /api/user/subscription
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

// POST /api/user/subscription
router.post('/subscription', authenticate, validateCreateSubscription, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { plan, paymentMethodId } = req.body;
  
  const result = await BillingService.createSubscription(userId, {
    plan,
    paymentMethodId,
  });
  
  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Subscription created successfully',
  };
  
  res.json(response);
}));

// PUT /api/user/subscription
router.put('/subscription', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { plan } = req.body;
  
  if (!plan) {
    return res.status(400).json({
      success: false,
      error: 'Plan is required',
    });
  }
  
  const subscription = await BillingService.updateSubscription(userId, plan);
  
  const response: ApiResponse = {
    success: true,
    data: subscription,
    message: 'Subscription updated successfully',
  };
  
  res.json(response);
}));

// DELETE /api/user/subscription
router.delete('/subscription', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { cancelAtPeriodEnd = true } = req.body;
  
  const subscription = await BillingService.cancelSubscription(userId, cancelAtPeriodEnd);
  
  const response: ApiResponse = {
    success: true,
    data: subscription,
    message: cancelAtPeriodEnd 
      ? 'Subscription will be canceled at the end of the current period'
      : 'Subscription canceled immediately',
  };
  
  res.json(response);
}));

// GET /api/user/payment-methods
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

// POST /api/user/setup-intent
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

// GET /api/user/quota/:licenseId
router.get('/quota/:licenseId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { licenseId } = req.params;
  
  // Verify user owns this license
  const license = await LicenseService.getLicenseById(licenseId, userId);
  
  const quota = await LicenseService.getUsageQuota(licenseId);
  
  const response: ApiResponse = {
    success: true,
    data: quota,
    message: 'Usage quota retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/user/dashboard
router.get('/dashboard', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  // Get user data, licenses, and subscription in parallel
  const [user, { licenses }, subscription] = await Promise.all([
    AuthService.getUserProfile(userId),
    LicenseService.getUserLicenses(userId, 1, 5), // Get first 5 licenses
    BillingService.getSubscription(userId).catch(() => null), // Subscription might not exist
  ]);
  
  // Get analytics summary for all licenses
  const { AnalyticsService } = await import('@/services/analyticsService');
  const analyticsSummary = await AnalyticsService.getAnalyticsSummary(userId);
  
  const dashboard = {
    user,
    licenses: licenses.slice(0, 5), // Limit to 5 for dashboard
    subscription,
    analytics: analyticsSummary,
    totalLicenses: licenses.length,
  };
  
  const response: ApiResponse = {
    success: true,
    data: dashboard,
    message: 'Dashboard data retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/user/api-keys
router.get('/api-keys', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      permissions: true,
      lastUsed: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  const response: ApiResponse = {
    success: true,
    data: apiKeys,
    message: 'API keys retrieved successfully',
  };
  
  res.json(response);
}));

// POST /api/user/api-keys
router.post('/api-keys', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { name, permissions } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'API key name is required',
    });
  }
  
  const { generateApiKey, hashApiKey } = await import('@/utils/crypto');
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const apiKeyRecord = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      permissions: permissions || {},
    },
    select: {
      id: true,
      name: true,
      permissions: true,
      createdAt: true,
    },
  });
  
  const response: ApiResponse = {
    success: true,
    data: {
      ...apiKeyRecord,
      apiKey, // Only return the actual key once
    },
    message: 'API key created successfully. Save this key securely.',
  };
  
  res.json(response);
}));

// DELETE /api/user/api-keys/:id
router.delete('/api-keys/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });
  
  const response: ApiResponse = {
    success: true,
    message: 'API key deactivated successfully',
  };
  
  res.json(response);
}));

export default router;
