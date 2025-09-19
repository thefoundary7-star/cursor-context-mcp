import winston from 'winston';
import { config } from './config';
import path from 'path';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'mcp-saas-api',
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.nodeEnv === 'development' ? consoleFormat : logFormat,
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    }),
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
    }),
  ],
});

// Add request ID to logs
export const addRequestId = (req: any, res: any, next: any) => {
  req.requestId = req.headers['x-request-id'] || 
    req.headers['x-correlation-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log request
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req: any, res: any, next: any) => {
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    userId: req.user?.id,
  });
  
  next(error);
};

// Performance logging
export const performanceLogger = {
  start: (operation: string, metadata?: any) => {
    const startTime = Date.now();
    logger.debug('Operation started', {
      operation,
      startTime,
      ...metadata,
    });
    return startTime;
  },
  
  end: (operation: string, startTime: number, metadata?: any) => {
    const duration = Date.now() - startTime;
    logger.info('Operation completed', {
      operation,
      duration: `${duration}ms`,
      ...metadata,
    });
    return duration;
  },
};

// Business metrics logging
export const businessLogger = {
  userRegistration: (userId: string, metadata?: any) => {
    logger.info('User registered', {
      event: 'user_registration',
      userId,
      ...metadata,
    });
  },
  
  userLogin: (userId: string, metadata?: any) => {
    logger.info('User login', {
      event: 'user_login',
      userId,
      ...metadata,
    });
  },
  
  licenseCreated: (licenseId: string, userId: string, metadata?: any) => {
    logger.info('License created', {
      event: 'license_created',
      licenseId,
      userId,
      ...metadata,
    });
  },
  
  licenseValidated: (licenseId: string, serverId: string, metadata?: any) => {
    logger.info('License validated', {
      event: 'license_validated',
      licenseId,
      serverId,
      ...metadata,
    });
  },
  
  subscriptionCreated: (subscriptionId: string, userId: string, metadata?: any) => {
    logger.info('Subscription created', {
      event: 'subscription_created',
      subscriptionId,
      userId,
      ...metadata,
    });
  },
  
  paymentProcessed: (paymentId: string, userId: string, amount: number, metadata?: any) => {
    logger.info('Payment processed', {
      event: 'payment_processed',
      paymentId,
      userId,
      amount,
      ...metadata,
    });
  },
  
  apiUsage: (endpoint: string, userId: string, metadata?: any) => {
    logger.info('API usage', {
      event: 'api_usage',
      endpoint,
      userId,
      ...metadata,
    });
  },
};

// Security logging
export const securityLogger = {
  suspiciousActivity: (activity: string, ip: string, metadata?: any) => {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      activity,
      ip,
      ...metadata,
    });
  },
  
  failedLogin: (email: string, ip: string, metadata?: any) => {
    logger.warn('Failed login attempt', {
      event: 'failed_login',
      email,
      ip,
      ...metadata,
    });
  },
  
  rateLimitExceeded: (ip: string, endpoint: string, metadata?: any) => {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      ip,
      endpoint,
      ...metadata,
    });
  },
  
  unauthorizedAccess: (userId: string, resource: string, metadata?: any) => {
    logger.warn('Unauthorized access attempt', {
      event: 'unauthorized_access',
      userId,
      resource,
      ...metadata,
    });
  },
};

// System logging
export const systemLogger = {
  startup: (metadata?: any) => {
    logger.info('System startup', {
      event: 'system_startup',
      ...metadata,
    });
  },
  
  shutdown: (metadata?: any) => {
    logger.info('System shutdown', {
      event: 'system_shutdown',
      ...metadata,
    });
  },
  
  healthCheck: (status: string, metadata?: any) => {
    logger.info('Health check', {
      event: 'health_check',
      status,
      ...metadata,
    });
  },
  
  databaseConnection: (status: string, metadata?: any) => {
    logger.info('Database connection', {
      event: 'database_connection',
      status,
      ...metadata,
    });
  },
  
  redisConnection: (status: string, metadata?: any) => {
    logger.info('Redis connection', {
      event: 'redis_connection',
      status,
      ...metadata,
    });
  },
};

// Log rotation and cleanup
export const setupLogRotation = () => {
  // This would typically be handled by logrotate or similar
  // But we can add some basic cleanup here
  const cleanupOldLogs = () => {
    logger.info('Log cleanup started');
    // Add log cleanup logic here
  };
  
  // Run cleanup daily
  setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
};

// Export the main logger
export default logger;