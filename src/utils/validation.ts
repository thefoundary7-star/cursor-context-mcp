import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const cuidSchema = z.string().cuid('Invalid ID format');
export const dateSchema = z.string().datetime().or(z.date());

// Authentication schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// User schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  company: z.string().min(1, 'Company is required').optional(),
});

// License schemas
export const licenseValidationSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
  serverId: z.string().min(1, 'Server ID is required'),
  serverName: z.string().optional(),
  serverVersion: z.string().optional(),
});

export const createLicenseSchema = z.object({
  name: z.string().min(1, 'License name is required'),
  description: z.string().optional(),
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']),
  maxServers: z.number().int().min(1, 'Max servers must be at least 1'),
  expiresAt: dateSchema.optional(),
});

// Analytics schemas
export const analyticsEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  eventData: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: dateSchema.optional(),
});

export const trackAnalyticsSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
  serverId: z.string().min(1, 'Server ID is required'),
  events: z.array(analyticsEventSchema).min(1, 'At least one event is required'),
});

export const analyticsQuerySchema = z.object({
  userId: cuidSchema.optional(),
  licenseId: cuidSchema.optional(),
  serverId: cuidSchema.optional(),
  eventType: z.string().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// Subscription schemas
export const createSubscriptionSchema = z.object({
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (Object.keys(req.body).length > 0) {
        req.body = schema.parse(req.body);
      }

      // Validate query parameters
      if (Object.keys(req.query).length > 0) {
        req.query = schema.parse(req.query);
      }

      // Validate route parameters
      if (Object.keys(req.params).length > 0) {
        req.params = schema.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError('Validation failed');
        validationError.errors = error.flatten().fieldErrors;
        return next(validationError);
      }
      next(error);
    }
  };
};

// Specific validation middlewares
export const validateLogin = validate(loginSchema);
export const validateRefreshToken = validate(refreshTokenSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateUpdateProfile = validate(updateProfileSchema);
export const validateLicenseValidation = validate(licenseValidationSchema);
export const validateCreateLicense = validate(createLicenseSchema);
export const validateTrackAnalytics = validate(trackAnalyticsSchema);
export const validateAnalyticsQuery = validate(analyticsQuerySchema);
export const validateCreateSubscription = validate(createSubscriptionSchema);
export const validatePagination = validate(paginationSchema);

// Enhanced sanitization helpers
export const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/&[#\w]+;/g, '') // Remove HTML entities
    .slice(0, 1000); // Limit string length
};

export const sanitizeFilePath = (path: string): string => {
  return path
    .replace(/\.\./g, '') // Remove directory traversal
    .replace(/[\\/:*?"<>|]/g, '') // Remove invalid filename chars
    .replace(/^\/+/, '') // Remove leading slashes
    .slice(0, 255); // Limit path length
};

export const sanitizeEmail = (email: string): string => {
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w@.\-+]/g, '') // Only allow valid email characters
    .slice(0, 254); // RFC 5321 limit
};

export const sanitizeNumeric = (value: any): number => {
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError('Invalid numeric value');
  }
  return num;
};

export const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key names
    const cleanKey = key.replace(/[^\w]/g, '').slice(0, 50);

    if (typeof value === 'string') {
      sanitized[cleanKey] = sanitizeString(value);
    } else if (typeof value === 'number') {
      sanitized[cleanKey] = sanitizeNumeric(value);
    } else if (Array.isArray(value)) {
      sanitized[cleanKey] = value.slice(0, 100).map(item => {
        if (typeof item === 'string') return sanitizeString(item);
        if (typeof item === 'object' && item !== null) return sanitizeObject(item);
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[cleanKey] = sanitizeObject(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }

  return sanitized;
};

// Advanced validation patterns
export const securityPatterns = {
  sqlInjection: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
    /(\b(OR|AND)\s+['"]\s*LIKE\s*['"])/i,
    /(\b(OR|AND)\s+['"]\s*IN\s*\([^)]*\))/i,
    /(UNION\s+(ALL\s+)?SELECT)/i,
  ],
  xss: [
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
    /onmouseover=/gi,
  ],
  directoryTraversal: [
    /\.\./g,
    /\.\/\.\./g,
    /\.\.\\/g,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /%2e%2e/gi,
  ],
  commandInjection: [
    /[;&|`$()]/g,
    /\bexec\b/gi,
    /\beval\b/gi,
    /\bsystem\b/gi,
    /\bpassthru\b/gi,
    /\bshell_exec\b/gi,
  ],
};

// Security validation function
export const validateSecurity = (input: string): { isValid: boolean; threats: string[] } => {
  const threats: string[] = [];

  // Check for SQL injection
  if (securityPatterns.sqlInjection.some(pattern => pattern.test(input))) {
    threats.push('SQL Injection');
  }

  // Check for XSS
  if (securityPatterns.xss.some(pattern => pattern.test(input))) {
    threats.push('Cross-Site Scripting (XSS)');
  }

  // Check for directory traversal
  if (securityPatterns.directoryTraversal.some(pattern => pattern.test(input))) {
    threats.push('Directory Traversal');
  }

  // Check for command injection
  if (securityPatterns.commandInjection.some(pattern => pattern.test(input))) {
    threats.push('Command Injection');
  }

  return {
    isValid: threats.length === 0,
    threats,
  };
};

// Enhanced security validation middleware
export const securityValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const logger = require('./logger').default;

  const checkInput = (obj: any, path: string = ''): void => {
    if (typeof obj === 'string') {
      const validation = validateSecurity(obj);
      if (!validation.isValid) {
        logger.warn('Security threat detected', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          path: req.originalUrl,
          threats: validation.threats,
          inputPath: path,
          value: obj.substring(0, 100),
        });

        throw new ValidationError(`Security threat detected: ${validation.threats.join(', ')}`);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        checkInput(value, `${path}.${key}`);
      }
    }
  };

  try {
    // Check all inputs for security threats
    if (req.body) checkInput(req.body, 'body');
    if (req.query) checkInput(req.query, 'query');
    if (req.params) checkInput(req.params, 'params');

    next();
  } catch (error) {
    next(error);
  }
};

// Enhanced sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    // Validate file paths in multipart uploads
    if (req.file) {
      req.file.originalname = sanitizeFilePath(req.file.originalname);
      req.file.filename = sanitizeFilePath(req.file.filename);
    }

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        file.originalname = sanitizeFilePath(file.originalname);
        file.filename = sanitizeFilePath(file.filename);
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Request size validation middleware
export const validateRequestSize = (maxSizeBytes: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > maxSizeBytes) {
      const logger = require('./logger').default;
      logger.warn('Request size exceeded', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        contentLength,
        maxSize: maxSizeBytes,
      });

      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
        message: `Request size exceeds maximum allowed size of ${maxSizeBytes} bytes`,
      });
    }

    next();
  };
};

// Rate limiting by user ID
export const userRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) return next();

    const now = Date.now();
    const userAttempts = attempts.get(userId);

    if (!userAttempts || now > userAttempts.resetTime) {
      attempts.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userAttempts.count >= maxRequests) {
      const logger = require('./logger').default;
      logger.warn('User rate limit exceeded', {
        userId,
        ip: req.ip,
        attempts: userAttempts.count,
      });

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000),
      });
    }

    userAttempts.count++;
    next();
  };
};
