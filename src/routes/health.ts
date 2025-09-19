import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/middleware/errorHandler';
import { HealthCheckResponse, ApiResponse } from '@/types';
import { config } from '@/utils/config';
import logger from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// GET /api/health
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const healthCheck: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    services: {
      database: 'disconnected',
      redis: undefined,
      stripe: 'disconnected',
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'connected';
  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.services.database = 'disconnected';
    logger.error('Database health check failed', { error: (error as Error).message });
  }

  // Check Redis connection (if configured)
  if (config.redisUrl) {
    try {
      const Redis = require('ioredis');
      const redis = new Redis(config.redisUrl);
      await redis.ping();
      healthCheck.services.redis = 'connected';
      redis.disconnect();
    } catch (error) {
      healthCheck.status = 'unhealthy';
      healthCheck.services.redis = 'disconnected';
      logger.error('Redis health check failed', { error: (error as Error).message });
    }
  }

  // Check Stripe connection
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });
    await stripe.balance.retrieve();
    healthCheck.services.stripe = 'connected';
  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.services.stripe = 'disconnected';
    logger.error('Stripe health check failed', { error: (error as Error).message });
  }

  const responseTime = Date.now() - startTime;
  const response: ApiResponse = {
    success: healthCheck.status === 'healthy',
    data: {
      ...healthCheck,
      responseTime: `${responseTime}ms`,
    },
    message: healthCheck.status === 'healthy' 
      ? 'All services are healthy' 
      : 'Some services are unhealthy',
  };

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(response);
}));

// GET /api/health/ready
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check if database is ready
    await prisma.$queryRaw`SELECT 1`;
    
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
      },
      message: 'Service is ready to accept requests',
    };

    res.json(response);
  } catch (error) {
    logger.error('Readiness check failed', { error: (error as Error).message });
    
    const response: ApiResponse = {
      success: false,
      data: {
        status: 'not ready',
        timestamp: new Date().toISOString(),
      },
      message: 'Service is not ready',
    };

    res.status(503).json(response);
  }
}));

// GET /api/health/live
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    },
    message: 'Service is alive',
  };

  res.json(response);
}));

// GET /api/health/detailed
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    services: {
      database: {
        status: 'disconnected',
        responseTime: 0,
        error: null,
      },
      redis: {
        status: 'not configured',
        responseTime: 0,
        error: null,
      },
      stripe: {
        status: 'disconnected',
        responseTime: 0,
        error: null,
      },
    },
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
    },
    responseTime: 0,
  };

  // Test database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    detailedHealth.services.database = {
      status: 'connected',
      responseTime: Date.now() - dbStart,
      error: null,
    };
  } catch (error) {
    detailedHealth.status = 'unhealthy';
    detailedHealth.services.database = {
      status: 'disconnected',
      responseTime: 0,
      error: (error as Error).message,
    };
  }

  // Test Redis (if configured)
  if (config.redisUrl) {
    try {
      const redisStart = Date.now();
      const Redis = require('ioredis');
      const redis = new Redis(config.redisUrl);
      await redis.ping();
      detailedHealth.services.redis = {
        status: 'connected',
        responseTime: Date.now() - redisStart,
        error: null,
      };
      redis.disconnect();
    } catch (error) {
      detailedHealth.status = 'unhealthy';
      detailedHealth.services.redis = {
        status: 'disconnected',
        responseTime: 0,
        error: (error as Error).message,
      };
    }
  }

  // Test Stripe
  try {
    const stripeStart = Date.now();
    const Stripe = require('stripe');
    const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });
    await stripe.balance.retrieve();
    detailedHealth.services.stripe = {
      status: 'connected',
      responseTime: Date.now() - stripeStart,
      error: null,
    };
  } catch (error) {
    detailedHealth.status = 'unhealthy';
    detailedHealth.services.stripe = {
      status: 'disconnected',
      responseTime: 0,
      error: (error as Error).message,
    };
  }

  detailedHealth.responseTime = Date.now() - startTime;

  const response: ApiResponse = {
    success: detailedHealth.status === 'healthy',
    data: detailedHealth,
    message: detailedHealth.status === 'healthy' 
      ? 'All services are healthy' 
      : 'Some services are unhealthy',
  };

  const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(response);
}));

export default router;
