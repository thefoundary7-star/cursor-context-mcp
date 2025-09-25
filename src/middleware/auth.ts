import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/utils/crypto';
import { AuthenticationError, AuthorizationError } from '@/utils/errors';
import { AuthenticatedRequest } from '@/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Authentication middleware
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify the token
    const payload = verifyAccessToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('User account is deactivated');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication middleware (doesn't throw error if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    // Verify the token
    const payload = verifyAccessToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Don't throw error for optional auth, just continue without user
    next();
  }
};

// Authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }

    next();
  };
};

// Admin only middleware
export const adminOnly = authorize('ADMIN', 'SUPER_ADMIN');

// Super admin only middleware
export const superAdminOnly = authorize('SUPER_ADMIN');

// License validation middleware
export const validateLicense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // DISABLE_LICENSE: Bypass license validation
    if (process.env.DISABLE_LICENSE === 'true') {
      console.log('[DISABLE_LICENSE] License validation bypassed - creating mock PRO license');
      req.license = {
        id: 'disabled-license',
        licenseKey: 'DISABLED-PRO-LICENSE',
        tier: 'PRO',
        isActive: true,
        expiresAt: null,
        user: {
          id: 'disabled-user',
          email: 'disabled@example.com',
          isActive: true
        }
      } as any;
      return next();
    }

    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      throw new AuthenticationError('License key is required');
    }

    // Find license
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!license) {
      throw new AuthenticationError('Invalid license key');
    }

    if (!license.isActive) {
      throw new AuthenticationError('License is deactivated');
    }

    if (!license.user.isActive) {
      throw new AuthenticationError('License owner account is deactivated');
    }

    // Check if license is expired
    if (license.expiresAt && license.expiresAt < new Date()) {
      throw new AuthenticationError('License has expired');
    }

    // Attach license to request
    req.license = license;
    next();
  } catch (error) {
    next(error);
  }
};

// API key authentication middleware
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new AuthenticationError('API key is required');
    }

    // Hash the provided API key
    const { hashApiKey } = await import('@/utils/crypto');
    const hashedKey = hashApiKey(apiKey);

    // Find API key in database
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash: hashedKey },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            company: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      throw new AuthenticationError('Invalid API key');
    }

    if (!apiKeyRecord.isActive) {
      throw new AuthenticationError('API key is deactivated');
    }

    if (!apiKeyRecord.user.isActive) {
      throw new AuthenticationError('API key owner account is deactivated');
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsed: new Date() },
    });

    // Attach user to request
    req.user = apiKeyRecord.user;
    next();
  } catch (error) {
    next(error);
  }
};

// Rate limiting by user
export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < now) {
        requests.delete(key);
      }
    }

    // Get or create user request record
    let userRequests = requests.get(userId);
    if (!userRequests || userRequests.resetTime < now) {
      userRequests = { count: 0, resetTime: now + windowMs };
      requests.set(userId, userRequests);
    }

    // Check if user has exceeded rate limit
    if (userRequests.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for user',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
      });
      return;
    }

    // Increment request count
    userRequests.count++;
    next();
  };
};
