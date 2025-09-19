import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '@/utils/config';

// Redis client for rate limiting
const redis = new Redis(config.redisUrl, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Rate limit configuration interface
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string; // Error message when limit is exceeded
  standardHeaders?: boolean; // Send standard rate limit headers
  legacyHeaders?: boolean; // Send legacy rate limit headers
  keyGenerator?: (req: Request) => string; // Function to generate rate limit key
  skip?: (req: Request) => boolean; // Function to skip rate limiting
  onLimitReached?: (req: Request, res: Response) => void; // Callback when limit is reached
}

// Default rate limit configuration
const defaultConfig: RateLimitConfig = {
  windowMs: config.apiRateWindow,
  max: config.apiRateLimit,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return userId ? `rate_limit:user:${userId}` : `rate_limit:ip:${ip}`;
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    if (req.originalUrl === '/api/health' || req.originalUrl === '/health') {
      return true;
    }
    
    // Skip for admin users (if you have admin role)
    const user = (req as any).user;
    if (user && user.role === 'SUPER_ADMIN') {
      return true;
    }
    
    return false;
  },
  onLimitReached: (req: Request, res: Response) => {
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.originalUrl}`);
  },
};

// Rate limiting middleware factory
export const createRateLimitMiddleware = (config: Partial<RateLimitConfig> = {}) => {
  const rateLimitConfig = { ...defaultConfig, ...config };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip rate limiting if configured to do so
      if (rateLimitConfig.skip?.(req)) {
        return next();
      }
      
      // Generate rate limit key
      const key = rateLimitConfig.keyGenerator!(req);
      const window = Math.floor(Date.now() / rateLimitConfig.windowMs);
      const rateLimitKey = `${key}:${window}`;
      
      // Get current request count
      const current = await redis.incr(rateLimitKey);
      
      // Set expiration for the key if it's the first request in this window
      if (current === 1) {
        await redis.expire(rateLimitKey, Math.ceil(rateLimitConfig.windowMs / 1000));
      }
      
      // Check if limit is exceeded
      if (current > rateLimitConfig.max) {
        // Call limit reached callback
        rateLimitConfig.onLimitReached?.(req, res);
        
        // Set rate limit headers
        if (rateLimitConfig.standardHeaders) {
          res.setHeader('RateLimit-Limit', rateLimitConfig.max.toString());
          res.setHeader('RateLimit-Remaining', '0');
          res.setHeader('RateLimit-Reset', new Date(window * rateLimitConfig.windowMs + rateLimitConfig.windowMs).toISOString());
        }
        
        if (rateLimitConfig.legacyHeaders) {
          res.setHeader('X-RateLimit-Limit', rateLimitConfig.max.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', new Date(window * rateLimitConfig.windowMs + rateLimitConfig.windowMs).toISOString());
        }
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: rateLimitConfig.message,
          retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
        });
      }
      
      // Set rate limit headers
      if (rateLimitConfig.standardHeaders) {
        res.setHeader('RateLimit-Limit', rateLimitConfig.max.toString());
        res.setHeader('RateLimit-Remaining', Math.max(0, rateLimitConfig.max - current).toString());
        res.setHeader('RateLimit-Reset', new Date(window * rateLimitConfig.windowMs + rateLimitConfig.windowMs).toISOString());
      }
      
      if (rateLimitConfig.legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', rateLimitConfig.max.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitConfig.max - current).toString());
        res.setHeader('X-RateLimit-Reset', new Date(window * rateLimitConfig.windowMs + rateLimitConfig.windowMs).toISOString());
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting if Redis is down
      next();
    }
  };
};

// Specific rate limiters for different endpoints
export const authRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `auth_rate_limit:${ip}`;
  },
});

export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: 'API rate limit exceeded, please try again later.',
});

export const webhookRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 webhooks per minute
  message: 'Webhook rate limit exceeded, please try again later.',
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `webhook_rate_limit:${ip}`;
  },
});

export const uploadRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 uploads per hour
  message: 'Upload rate limit exceeded, please try again later.',
});

export const licenseValidationRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 validations per minute
  message: 'License validation rate limit exceeded, please try again later.',
});

// Rate limit statistics
export const getRateLimitStats = async (key: string) => {
  try {
    const window = Math.floor(Date.now() / defaultConfig.windowMs);
    const rateLimitKey = `${key}:${window}`;
    const current = await redis.get(rateLimitKey);
    const ttl = await redis.ttl(rateLimitKey);
    
    return {
      current: parseInt(current || '0'),
      limit: defaultConfig.max,
      remaining: Math.max(0, defaultConfig.max - parseInt(current || '0')),
      resetTime: new Date(window * defaultConfig.windowMs + defaultConfig.windowMs),
      ttl: ttl,
    };
  } catch (error) {
    console.error('Rate limit stats error:', error);
    return null;
  }
};

// Reset rate limit for a specific key
export const resetRateLimit = async (key: string) => {
  try {
    const window = Math.floor(Date.now() / defaultConfig.windowMs);
    const rateLimitKey = `${key}:${window}`;
    await redis.del(rateLimitKey);
    return true;
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return false;
  }
};

// Get all rate limit keys
export const getAllRateLimitKeys = async () => {
  try {
    const keys = await redis.keys('rate_limit:*');
    return keys;
  } catch (error) {
    console.error('Get rate limit keys error:', error);
    return [];
  }
};

// Clear all rate limits
export const clearAllRateLimits = async () => {
  try {
    const keys = await redis.keys('rate_limit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error('Clear rate limits error:', error);
    return 0;
  }
};

// Export default rate limiter
export const rateLimitMiddleware = createRateLimitMiddleware();

export default rateLimitMiddleware;
