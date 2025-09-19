import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, handleError } from '@/utils/errors';
import logger from '@/utils/logger';
import { config } from '@/utils/config';

// Global error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const appError = handleError(error);
  
  // Log error
  logger.error('Error occurred', {
    error: appError.message,
    stack: appError.stack,
    statusCode: appError.statusCode,
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Don't leak error details in production
  const isDevelopment = config.nodeEnv === 'development';
  
  const errorResponse = {
    success: false,
    error: isDevelopment ? appError.message : 'Internal server error',
    ...(isDevelopment && { stack: appError.stack }),
    requestId: req.id,
  };

  // Add validation errors if present
  if (appError.statusCode === 400 && (appError as any).errors) {
    (errorResponse as any).errors = (appError as any).errors;
  }

  res.status(appError.statusCode).json(errorResponse);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
    requestId: req.id,
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Prisma error handler
export const handlePrismaError = (error: any): AppError => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new AppError('Unique constraint violation', 409);
      case 'P2025':
        return new AppError('Record not found', 404);
      case 'P2003':
        return new AppError('Foreign key constraint violation', 400);
      case 'P2014':
        return new AppError('Invalid ID provided', 400);
      default:
        return new AppError('Database operation failed', 500);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError('Invalid data provided', 400);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AppError('Database connection failed', 500);
  }

  return new AppError('Database operation failed', 500);
};

// Validation error handler
export const handleValidationError = (error: any): AppError => {
  if (error.name === 'ValidationError') {
    const errors: Record<string, string[]> = {};
    
    if (error.details) {
      error.details.forEach((detail: any) => {
        const field = detail.path.join('.');
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(detail.message);
      });
    }

    const appError = new AppError('Validation failed', 400);
    (appError as any).errors = errors;
    return appError;
  }

  return new AppError('Validation failed', 400);
};

// JWT error handler
export const handleJWTError = (error: any): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401);
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401);
  }

  if (error.name === 'NotBeforeError') {
    return new AppError('Token not active', 401);
  }

  return new AppError('Authentication failed', 401);
};

// Stripe error handler
export const handleStripeError = (error: any): AppError => {
  if (error.type === 'StripeCardError') {
    return new AppError('Card declined', 402);
  }

  if (error.type === 'StripeRateLimitError') {
    return new AppError('Rate limit exceeded', 429);
  }

  if (error.type === 'StripeInvalidRequestError') {
    return new AppError('Invalid request', 400);
  }

  if (error.type === 'StripeAPIError') {
    return new AppError('Payment service error', 502);
  }

  if (error.type === 'StripeConnectionError') {
    return new AppError('Payment service unavailable', 503);
  }

  if (error.type === 'StripeAuthenticationError') {
    return new AppError('Payment authentication failed', 401);
  }

  return new AppError('Payment processing error', 500);
};

// Unhandled promise rejection handler
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });
    
    // Exit the process in production
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  });
};

// Uncaught exception handler
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    
    // Exit the process
    process.exit(1);
  });
};

// Graceful shutdown handler
export const handleGracefulShutdown = (server: any): void => {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
