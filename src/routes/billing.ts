import { Router, Request, Response } from 'express';
import { getDodoPaymentsService } from '@/services/dodo/dodopayments';
import { PrismaClient } from '@prisma/client';
import { authenticate, adminOnly } from '@/middleware/auth';
import { 
  validateCreateSubscription,
  validateUpdateSubscription,
  validateCancelSubscription 
} from '@/utils/validation';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '@/types';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();
const dodoPayments = getDodoPaymentsService();

// FileBridge Product Configuration
const FILBRIDGE_PLANS = {
  pro: {
    id: process.env.DODO_PRO_PRODUCT_ID!,
    name: 'FileBridge Pro',
    price: 1900, // $19.00 in cents
    currency: 'USD',
    interval: 'month',
    features: [
      'Multiple project support',
      'Real-time Git integration', 
      'Advanced context detection',
      'Email support',
      'Up to 10 projects'
    ],
    limits: {
      maxProjects: 10,
      operationsPerHour: 1000,
    }
  },
  enterprise: {
    id: process.env.DODO_ENTERPRISE_PRODUCT_ID!,
    name: 'FileBridge Enterprise',
    price: 9900, // $99.00 in cents
    currency: 'USD',
    interval: 'month',
    features: [
      'Unlimited projects',
      'Team collaboration features',
      'Admin dashboard',
      'Priority support',
      'Custom integrations',
      'SSO integration'
    ],
    limits: {
      maxProjects: -1, // Unlimited
      operationsPerHour: 10000,
    }
  }
};

// POST /api/billing/create-checkout-session
router.post('/create-checkout-session', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { plan, trialDays = 7 } = req.body;
  
  if (!plan || !FILBRIDGE_PLANS[plan as keyof typeof FILBRIDGE_PLANS]) {
    return res.status(400).json({
      success: false,
      error: 'Invalid plan selected',
    });
  }

  try {
    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ['active', 'trialing'] }
      }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'User already has an active subscription',
      });
    }

    const planConfig = FILBRIDGE_PLANS[plan as keyof typeof FILBRIDGE_PLANS];
    
    // Create checkout session
    const checkoutSession = await dodoPayments.createCheckoutSession({
      product_id: planConfig.id,
      customer_email: user.email,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      trial_days: trialDays,
      metadata: {
        userId: user.id,
        plan: plan,
        source: 'filebridge_website',
      },
    });

    // Store checkout session reference
    await prisma.checkoutSession.create({
      data: {
        dodoSessionId: checkoutSession.id,
        userId: user.id,
        customerEmail: user.email,
        plan: plan,
        amount: planConfig.price,
        currency: planConfig.currency,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        checkout_url: checkoutSession.url,
        session_id: checkoutSession.id,
      },
      message: 'Checkout session created successfully',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
}));

// GET /api/billing/verify-session
router.get('/verify-session/:sessionId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;
  const user = req.user!;

  try {
    // Get checkout session from Dodo
    const session = await dodoPayments.getCheckoutSession(sessionId);
    
    // Verify session belongs to user
    const dbSession = await prisma.checkoutSession.findUnique({
      where: { dodoSessionId: sessionId },
    });

    if (!dbSession || dbSession.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Session not found or unauthorized',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        payment_status: session.payment_status,
        subscription_created: session.payment_status === 'paid',
      },
      message: 'Session verified successfully',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error verifying session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session',
    });
  }
}));

// GET /api/billing/subscription
router.get('/subscription', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: 'No subscription found',
      });
    }

    // Get latest subscription status from Dodo
    const dodoSubscription = await dodoPayments.getSubscription(subscription.dodoSubscriptionId);
    
    // Update local status if different
    if (dodoSubscription.status !== subscription.status) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: dodoSubscription.status },
      });
    }

    const planConfig = subscription.tier === 'pro' ? FILBRIDGE_PLANS.pro : FILBRIDGE_PLANS.enterprise;

    const response: ApiResponse = {
      success: true,
      data: {
        id: subscription.id,
        status: dodoSubscription.status,
        tier: subscription.tier,
        plan: planConfig,
        license_key: subscription.licenseKey,
        current_period_start: subscription.currentPeriodStart,
        current_period_end: subscription.currentPeriodEnd,
        trial_end: subscription.trialEnd,
        canceled_at: subscription.canceledAt,
        created_at: subscription.createdAt,
      },
      message: 'Subscription retrieved successfully',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error retrieving subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription',
    });
  }
}));

// POST /api/billing/customer-portal
router.post('/customer-portal', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { returnUrl } = req.body;
  
  if (!returnUrl) {
    return res.status(400).json({
      success: false,
      error: 'Return URL is required',
    });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found',
      });
    }

    // Create customer portal session in Dodo
    const portalSession = await dodoPayments.createCustomerPortalSession(
      subscription.dodoCustomerId,
      returnUrl
    );

    const response: ApiResponse = {
      success: true,
      data: { url: portalSession.url },
      message: 'Customer portal session created successfully',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error creating customer portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer portal session',
    });
  }
}));

// GET /api/billing/plans
router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  const plans = Object.entries(FILBRIDGE_PLANS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    currency: config.currency,
    interval: config.interval,
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

// GET /api/billing/license-key
router.get('/license-key', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ['active', 'trialing'] }
      }
    });

    if (!subscription || !subscription.licenseKey) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription or license key found',
      });
    }

    // Validate license key with Dodo
    const validation = await dodoPayments.validateLicenseKey(subscription.licenseKey);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'License key is no longer valid',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        license_key: subscription.licenseKey,
        tier: subscription.tier,
        expires_at: validation.expires_at,
        valid: validation.valid,
      },
      message: 'License key retrieved successfully',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error retrieving license key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve license key',
    });
  }
}));

// POST /api/billing/validate-license
router.post('/validate-license', asyncHandler(async (req: Request, res: Response) => {
  const { license_key } = req.body;
  
  if (!license_key) {
    return res.status(400).json({
      success: false,
      error: 'License key is required',
    });
  }

  try {
    // Validate with Dodo Payments
    const validation = await dodoPayments.validateLicenseKey(license_key);
    
    // Get additional info from our database
    let subscriptionInfo = null;
    if (validation.valid && validation.subscription_id) {
      const subscription = await prisma.subscription.findUnique({
        where: { dodoSubscriptionId: validation.subscription_id },
        include: { user: { select: { email: true } } }
      });
      
      if (subscription) {
        subscriptionInfo = {
          tier: subscription.tier,
          status: subscription.status,
          customer_email: subscription.user.email,
        };
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        valid: validation.valid,
        subscription: subscriptionInfo,
        expires_at: validation.expires_at,
      },
      message: validation.valid ? 'License key is valid' : 'License key is invalid',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error validating license key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate license key',
    });
  }
}));

// POST /api/billing/setup-products (Admin only - for initial setup)
router.post('/setup-products', authenticate, adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Create FileBridge products in Dodo Payments
    const products = await dodoPayments.createFileBridgeProducts();
    
    const response: ApiResponse = {
      success: true,
      data: {
        pro_product: products.pro,
        enterprise_product: products.enterprise,
        instructions: 'Add these product IDs to your environment variables:\nDODO_PRO_PRODUCT_ID=' + products.pro.id + '\nDODO_ENTERPRISE_PRODUCT_ID=' + products.enterprise.id
      },
      message: 'FileBridge products created successfully in Dodo Payments',
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Error setting up products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup products',
    });
  }
}));

export default router;
