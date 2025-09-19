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

// Sanitization helpers
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};
