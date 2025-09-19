import { AppError } from '@/types';

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

export class QuotaExceededError extends CustomError {
  public quotaType: 'servers' | 'requests' | 'analytics';
  public currentUsage: number;
  public limit: number;

  constructor(
    quotaType: 'servers' | 'requests' | 'analytics',
    currentUsage: number,
    limit: number,
    message?: string
  ) {
    super(
      message || `Quota exceeded for ${quotaType}. Current: ${currentUsage}, Limit: ${limit}`,
      429
    );
    this.quotaType = quotaType;
    this.currentUsage = currentUsage;
    this.limit = limit;
  }
}

export class LicenseValidationError extends CustomError {
  constructor(message: string = 'Invalid license') {
    super(message, 403);
  }
}

export class StripeError extends CustomError {
  constructor(message: string = 'Payment processing error') {
    super(message, 402);
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500);
  }
}

// Error handler utility
export const handleError = (error: Error): AppError => {
  if (error instanceof CustomError) {
    return error;
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return new DatabaseError('Database operation failed');
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message);
  }

  // Default to internal server error
  return new CustomError('Internal server error', 500, false);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
