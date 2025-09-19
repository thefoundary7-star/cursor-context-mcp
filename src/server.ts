import express from 'express';
import 'express-async-errors';
import compression from 'compression';
import { config } from '@/utils/config';
import logger from '@/utils/logger';
import {
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  securityHeaders,
  requestId,
  requestLogger,
  errorResponse,
  timeout,
} from '@/middleware/security';
import { errorHandler, notFoundHandler, handleUnhandledRejection, handleUncaughtException, handleGracefulShutdown } from '@/middleware/errorHandler';

// Import routes
import authRoutes from '@/routes/auth';
import analyticsRoutes from '@/routes/analytics';
import userRoutes from '@/routes/user';
import billingRoutes from '@/routes/billing';
import webhookRoutes from '@/routes/webhooks';
import healthRoutes from '@/routes/health';

// Initialize Express app
const app = express();

// Trust proxy (for rate limiting and IP detection)
app.set('trust proxy', 1);

// Global middleware
app.use(compression());
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(requestId);
app.use(requestLogger);
app.use(errorResponse);
app.use(timeout(30000)); // 30 second timeout

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimitMiddleware);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MCP Server SaaS Backend API',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      analytics: '/api/analytics',
      user: '/api/user',
      webhooks: '/api/webhooks',
      health: '/api/health',
    },
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'MCP Server SaaS Backend API',
    version: process.env.npm_package_version || '1.0.0',
    documentation: {
      authentication: {
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        validateLicense: 'POST /api/auth/validate-license',
        createLicense: 'POST /api/auth/create-license',
      },
      analytics: {
        track: 'POST /api/analytics/track',
        get: 'GET /api/analytics',
        summary: 'GET /api/analytics/summary',
        realtime: 'GET /api/analytics/realtime/:licenseId',
        export: 'GET /api/analytics/export',
      },
      user: {
        profile: 'GET /api/user/profile',
        updateProfile: 'PUT /api/user/profile',
        licenses: 'GET /api/user/licenses',
        subscription: 'GET /api/user/subscription',
        dashboard: 'GET /api/user/dashboard',
        apiKeys: 'GET /api/user/api-keys',
      },
      webhooks: {
        stripe: 'POST /api/webhooks/stripe',
        test: 'POST /api/webhooks/test',
        health: 'GET /api/webhooks/health',
      },
      health: {
        basic: 'GET /api/health',
        ready: 'GET /api/health/ready',
        live: 'GET /api/health/live',
        detailed: 'GET /api/health/detailed',
      },
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Set up error handlers
    handleUnhandledRejection();
    handleUncaughtException();

    // Start the server
    const server = app.listen(config.port, () => {
      logger.info(`Server started successfully`, {
        port: config.port,
        environment: config.nodeEnv,
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
      });
    });

    // Set up graceful shutdown
    handleGracefulShutdown(server);

    // Test database connection
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      await prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed', { error: (error as Error).message });
      process.exit(1);
    }

    // Test Stripe connection
    try {
      const Stripe = require('stripe');
      const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });
      await stripe.balance.retrieve();
      logger.info('Stripe connected successfully');
    } catch (error) {
      logger.error('Stripe connection failed', { error: (error as Error).message });
      // Don't exit for Stripe connection failure in development
      if (config.nodeEnv === 'production') {
        process.exit(1);
      }
    }

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
};

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
export { startServer };
