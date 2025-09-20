import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { config } from '@/utils/config';
import { securityLogger } from '@/utils/logger';

// CORS configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      securityLogger.suspiciousActivity('CORS violation', origin || 'unknown', {
        origin,
        allowedOrigins,
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Correlation-ID',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
});

// Enhanced Helmet security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'"],
    },
    reportOnly: false,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

// Rate limiting middleware
export const rateLimitMiddleware = rateLimit({
  windowMs: config.apiRateWindow,
  max: config.apiRateLimit,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(config.apiRateWindow / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    securityLogger.rateLimitExceeded(req.ip || 'unknown', req.originalUrl, {
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    });
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.apiRateWindow / 1000),
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    if (req.originalUrl === '/api/health' || req.originalUrl === '/health') {
      return true;
    }
    
    // Skip for admin users
    const user = (req as any).user;
    if (user && user.role === 'SUPER_ADMIN') {
      return true;
    }
    
    return false;
  },
});

// Enhanced security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');

  // Add comprehensive security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  // Content Security Policy (CSP) for API responses
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Add request ID for tracking
  const requestId = req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;

  // Add security monitoring headers
  res.setHeader('X-Security-Version', '1.0');
  res.setHeader('X-API-Version', 'v1');

  next();
};

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || 
    req.headers['x-correlation-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip}`);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Error response middleware
export const errorResponse = (req: Request, res: Response, next: NextFunction) => {
  // Override res.json to add security headers to error responses
  const originalJson = res.json;
  res.json = function(data: any) {
    // Add security headers to all responses
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Timeout middleware
export const timeout = (ms: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process.',
        });
      }
    }, ms);
    
    // Clear timeout when response is sent
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: any) {
      clearTimeout(timer);
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// IP whitelist middleware
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (allowedIPs.includes(clientIP)) {
      next();
    } else {
      securityLogger.suspiciousActivity('IP not whitelisted', clientIP, {
        allowedIPs,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied from this IP address.',
      });
    }
  };
};

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required.',
    });
  }
  
  // Validate API key (implement your validation logic here)
  // This is a placeholder - implement actual API key validation
  if (apiKey.length < 32) {
    securityLogger.suspiciousActivity('Invalid API key format', req.ip || 'unknown', {
      apiKey: apiKey.substring(0, 8) + '...',
      userAgent: req.get('User-Agent'),
    });
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format.',
    });
  }
  
  next();
};

// Request size limiter
export const requestSizeLimiter = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      securityLogger.suspiciousActivity('Request too large', req.ip || 'unknown', {
        contentLength,
        maxSize,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(413).json({
        error: 'Payload too large',
        message: `Request size exceeds maximum allowed size of ${maxSize} bytes.`,
      });
    }
    
    next();
  };
};

// SQL injection protection middleware
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
    /(\b(OR|AND)\s+['"]\s*LIKE\s*['"])/i,
    /(\b(OR|AND)\s+['"]\s*IN\s*\([^)]*\))/i,
  ];
  
  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          securityLogger.suspiciousActivity('SQL injection attempt', req.ip || 'unknown', {
            pattern: pattern.toString(),
            value: obj.substring(0, 100),
            path,
            userAgent: req.get('User-Agent'),
          });
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForSQLInjection(value, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Invalid request data detected.',
    });
  }
  
  next();
};

// XSS protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>.*?<\/link>/gi,
    /<meta[^>]*>.*?<\/meta>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /onclick=/gi,
  ];
  
  const checkForXSS = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      for (const pattern of xssPatterns) {
        if (pattern.test(obj)) {
          securityLogger.suspiciousActivity('XSS attempt', req.ip || 'unknown', {
            pattern: pattern.toString(),
            value: obj.substring(0, 100),
            path,
            userAgent: req.get('User-Agent'),
          });
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForXSS(value, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkForXSS(req.body) || checkForXSS(req.query) || checkForXSS(req.params)) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Invalid request data detected.',
    });
  }
  
  next();
};

// Security audit middleware
export const securityAudit = (req: Request, res: Response, next: NextFunction) => {
  // Log security-relevant information
  const securityInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    method: req.method,
    url: req.originalUrl,
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  };
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /<script/i, // Script tags
    /union\s+select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /eval\(/i, // Eval function
    /document\.cookie/i, // Cookie access
  ];
  
  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      securityLogger.suspiciousActivity('Suspicious request pattern', req.ip || 'unknown', {
        pattern: pattern.toString(),
        securityInfo,
      });
      break;
    }
  }
  
  next();
};

export default {
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  securityHeaders,
  requestId,
  requestLogger,
  errorResponse,
  timeout,
  ipWhitelist,
  validateApiKey,
  requestSizeLimiter,
  sqlInjectionProtection,
  xssProtection,
  securityAudit,
};