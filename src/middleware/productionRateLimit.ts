import { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'
import { logger } from '@/utils/logger'
import { productionConfig } from '@/config/production'

// Redis client for rate limiting
const redis = new Redis(productionConfig.redisUrl, {
  password: productionConfig.redisPassword,
  db: productionConfig.redisDb,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
})

// Rate limit configurations for different endpoints
export const rateLimitConfigs = {
  // General API rate limiting
  general: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: productionConfig.rateLimitWindowMs,
    max: productionConfig.rateLimitMaxRequests,
    message: {
      success: false,
      error: 'Too many requests',
      retryAfter: Math.ceil(productionConfig.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded - general', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(productionConfig.rateLimitWindowMs / 1000)
      })
    }
  }),

  // Strict rate limiting for authentication endpoints
  auth: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      success: false,
      error: 'Too many authentication attempts',
      retryAfter: 900 // 15 minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded - auth', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts',
        retryAfter: 900
      })
    }
  }),

  // Webhook rate limiting (more lenient)
  webhook: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 webhooks per minute
    message: {
      success: false,
      error: 'Webhook rate limit exceeded',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded - webhook', {
        ip: req.ip,
        path: req.path,
        webhookId: req.headers['webhook-id'],
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        success: false,
        error: 'Webhook rate limit exceeded',
        retryAfter: 60
      })
    }
  }),

  // File upload rate limiting
  upload: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: {
      success: false,
      error: 'Upload rate limit exceeded',
      retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded - upload', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        success: false,
        error: 'Upload rate limit exceeded',
        retryAfter: 3600
      })
    }
  }),

  // Email sending rate limiting
  email: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 emails per hour per IP
    message: {
      success: false,
      error: 'Email rate limit exceeded',
      retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded - email', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        success: false,
        error: 'Email rate limit exceeded',
        retryAfter: 3600
      })
    }
  })
}

// Custom rate limiting middleware for user-specific limits
export const userRateLimit = (maxRequests: number, windowMs: number) => {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs,
    max: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user ? maxRequests * 2 : maxRequests
    },
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`
    },
    message: {
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('User rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        method: req.method
      })
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000)
      })
    }
  })
}

// IP-based rate limiting with different tiers
export const ipRateLimit = (tier: 'free' | 'basic' | 'pro' | 'enterprise') => {
  const limits = {
    free: { max: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
    basic: { max: 500, windowMs: 15 * 60 * 1000 }, // 500 requests per 15 minutes
    pro: { max: 1000, windowMs: 15 * 60 * 1000 }, // 1000 requests per 15 minutes
    enterprise: { max: 5000, windowMs: 15 * 60 * 1000 } // 5000 requests per 15 minutes
  }

  const limit = limits[tier]

  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: limit.windowMs,
    max: limit.max,
    keyGenerator: (req: Request) => `ip:${req.ip}`,
    message: {
      success: false,
      error: `Rate limit exceeded for ${tier} tier`,
      retryAfter: Math.ceil(limit.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('IP rate limit exceeded', {
        ip: req.ip,
        tier,
        path: req.path,
        method: req.method,
        limit: limit.max,
        windowMs: limit.windowMs
      })
      res.status(429).json({
        success: false,
        error: `Rate limit exceeded for ${tier} tier`,
        retryAfter: Math.ceil(limit.windowMs / 1000)
      })
    }
  })
}

// Dynamic rate limiting based on user subscription
export const subscriptionRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // This middleware should be used after authentication
  if (!req.user) {
    return next()
  }

  // Get user's subscription tier
  const tier = req.user.subscription?.tier || 'free'
  
  // Apply appropriate rate limit
  const rateLimitMiddleware = ipRateLimit(tier as any)
  return rateLimitMiddleware(req, res, next)
}

// Rate limit bypass for trusted IPs (e.g., monitoring services)
export const trustedIpBypass = (trustedIps: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (trustedIps.includes(req.ip)) {
      logger.info('Rate limit bypassed for trusted IP', {
        ip: req.ip,
        path: req.path
      })
      return next()
    }
    next()
  }
}

// Rate limit monitoring and alerting
export const rateLimitMonitor = {
  // Track rate limit violations
  trackViolation: (req: Request, limitType: string) => {
    logger.warn('Rate limit violation tracked', {
      ip: req.ip,
      userId: req.user?.id,
      limitType,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    })

    // In production, you might want to send alerts for repeated violations
    // or implement progressive penalties
  },

  // Get rate limit status for an IP or user
  getStatus: async (identifier: string, type: 'ip' | 'user' = 'ip') => {
    try {
      const key = type === 'ip' ? `ip:${identifier}` : `user:${identifier}`
      const count = await redis.get(key)
      return {
        identifier,
        type,
        currentCount: count ? parseInt(count) : 0,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Failed to get rate limit status', { identifier, type, error })
      return null
    }
  },

  // Reset rate limit for an IP or user (admin function)
  reset: async (identifier: string, type: 'ip' | 'user' = 'ip') => {
    try {
      const key = type === 'ip' ? `ip:${identifier}` : `user:${identifier}`
      await redis.del(key)
      logger.info('Rate limit reset', { identifier, type })
      return true
    } catch (error) {
      logger.error('Failed to reset rate limit', { identifier, type, error })
      return false
    }
  }
}

// Health check for rate limiting system
export const rateLimitHealthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy'
  redis: 'connected' | 'disconnected'
  timestamp: string
}> => {
  try {
    await redis.ping()
    return {
      status: 'healthy',
      redis: 'connected',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    logger.error('Rate limiting health check failed', { error })
    return {
      status: 'unhealthy',
      redis: 'disconnected',
      timestamp: new Date().toISOString()
    }
  }
}

// Cleanup function for graceful shutdown
export const cleanupRateLimit = async (): Promise<void> => {
  try {
    await redis.quit()
    logger.info('Rate limiting Redis connection closed')
  } catch (error) {
    logger.error('Error closing rate limiting Redis connection', { error })
  }
}
