import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { stripeConfig } from '@/utils/config';
import { BillingService } from '@/services/billingService';
import { asyncHandler } from '@/middleware/errorHandler';
import { ApiResponse } from '@/types';
import { verifyHmacSignature } from '@/utils/crypto';
import logger from '@/utils/logger';

const router = Router();
const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2023-10-16',
});

// Enhanced webhook signature validation middleware
const validateWebhookSignature = (req: Request, res: Response, next: any) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = stripeConfig.webhookSecret;
  const timestamp = req.headers['x-timestamp'] as string;
  const userAgent = req.headers['user-agent'] as string;

  // Security checks
  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(500).json({
      success: false,
      error: 'Webhook secret not configured',
    });
  }

  if (!sig) {
    logger.warn('Webhook signature missing', {
      ip: req.ip,
      userAgent,
    });
    return res.status(400).json({
      success: false,
      error: 'Signature required',
    });
  }

  // Rate limiting for webhook endpoints
  if (timestamp) {
    const requestTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - requestTime);

    // Reject requests older than 5 minutes to prevent replay attacks
    if (timeDiff > 300) {
      logger.warn('Webhook timestamp too old', {
        ip: req.ip,
        timeDiff,
        userAgent,
      });
      return res.status(400).json({
        success: false,
        error: 'Request timestamp too old',
      });
    }
  }

  // Verify User-Agent contains Stripe
  if (!userAgent || !userAgent.includes('Stripe')) {
    logger.warn('Suspicious webhook user agent', {
      ip: req.ip,
      userAgent,
    });
  }

  next();
};

// POST /api/webhooks/stripe
router.post('/stripe', validateWebhookSignature, asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = stripeConfig.webhookSecret!;

  let event: Stripe.Event;

  try {
    // Verify webhook signature using Stripe's built-in verification
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    // Additional custom HMAC verification for enhanced security
    const payload = JSON.stringify(req.body);
    const sigElements = sig.split(',');
    let stripeSignature = '';

    for (const element of sigElements) {
      if (element.startsWith('v1=')) {
        stripeSignature = element.substring(3);
        break;
      }
    }

    if (!verifyHmacSignature(payload, stripeSignature, webhookSecret)) {
      logger.error('Custom HMAC verification failed', {
        ip: req.ip,
        eventType: event?.type,
      });
      return res.status(400).json({
        success: false,
        error: 'Signature verification failed',
      });
    }

  } catch (err) {
    const error = err as Error;
    logger.error('Webhook signature verification failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Don't reveal specific error details
    return res.status(400).json({
      success: false,
      error: 'Invalid signature',
    });
  }

  try {
    // Handle the webhook event
    await BillingService.handleWebhookEvent(event);

    // Log successful webhook processing
    logger.info('Webhook processed successfully', {
      eventType: event.type,
      eventId: event.id,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Webhook processed successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: (error as Error).message,
      eventType: event.type,
      eventId: event.id,
    });

    // Return 200 to prevent Stripe from retrying
    // Log the error for manual investigation
    res.status(200).json({
      success: false,
      error: 'Webhook processing failed',
    });
  }
}));

// POST /api/webhooks/test
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  const { eventType, data } = req.body;

  if (!eventType) {
    return res.status(400).json({
      success: false,
      error: 'Event type is required',
    });
  }

  // Create a mock Stripe event for testing
  const mockEvent: Stripe.Event = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data || {},
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: eventType,
  };

  try {
    await BillingService.handleWebhookEvent(mockEvent);

    logger.info('Test webhook processed successfully', {
      eventType: mockEvent.type,
      eventId: mockEvent.id,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Test webhook processed successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Test webhook processing failed', {
      error: (error as Error).message,
      eventType: mockEvent.type,
    });

    res.status(500).json({
      success: false,
      error: 'Test webhook processing failed',
    });
  }
}));

// GET /api/webhooks/health
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      webhookSecret: !!stripeConfig.webhookSecret,
    },
    message: 'Webhook endpoint is healthy',
  };

  res.json(response);
}));

export default router;
