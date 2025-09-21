import { Router, Request, Response } from 'express';
import { dodoWebhookHandler } from '@/services/dodo/webhookHandler';
import { asyncHandler } from '@/middleware/errorHandler';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';

const router = Router();

// Middleware to validate Dodo webhook signature
const validateDodoWebhookSignature = (req: Request, res: Response, next: any) => {
  const sig = req.headers['dodo-signature'] as string;
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
  const timestamp = req.headers['x-timestamp'] as string;
  const userAgent = req.headers['user-agent'] as string;

  // Security checks
  if (!webhookSecret) {
    logger.error('Dodo webhook secret not configured');
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

  // Verify User-Agent contains Dodo
  if (userAgent && !userAgent.includes('Dodo')) {
    logger.warn('Suspicious webhook user agent', {
      ip: req.ip,
      userAgent,
    });
  }

  next();
};

// POST /api/webhooks/dodo
router.post('/dodo', validateDodoWebhookSignature, asyncHandler(async (req: Request, res: Response) => {
  try {
    // Delegate to the webhook handler
    await dodoWebhookHandler.handleWebhook(req, res);
  } catch (error) {
    logger.error('Dodo webhook handling failed:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook handling failed',
    });
  }
}));

// Legacy Stripe webhook endpoint (for migration period)
router.post('/stripe', asyncHandler(async (req: Request, res: Response) => {
  logger.warn('Received Stripe webhook - should be migrated to Dodo Payments', {
    ip: req.ip,
    eventType: req.body?.type,
  });

  // Return success to prevent Stripe from retrying
  res.status(200).json({
    success: true,
    message: 'Stripe webhooks are deprecated - please use Dodo Payments',
  });
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

  // Create a mock Dodo event for testing
  const mockEvent = {
    id: `evt_test_${Date.now()}`,
    type: eventType,
    data: {
      object: data || {},
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  };

  // Create a mock request object
  const mockReq = {
    ...req,
    body: mockEvent,
    headers: {
      ...req.headers,
      'dodo-signature': 'test_signature',
    },
  } as Request;

  try {
    await dodoWebhookHandler.handleWebhook(mockReq, res);

    logger.info('Test webhook processed successfully', {
      eventType: mockEvent.type,
      eventId: mockEvent.id,
    });

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
      dodoWebhookSecret: !!process.env.DODO_WEBHOOK_SECRET,
      environment: process.env.DODO_ENVIRONMENT || 'sandbox',
    },
    message: 'Webhook endpoint is healthy',
  };

  res.json(response);
}));

export default router;
