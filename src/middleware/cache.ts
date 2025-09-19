import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '@/utils/config';

// Redis client for caching
const redis = new Redis(config.redisUrl, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Cache configuration
interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  skipCacheHeaders?: string[];
}

// Default cache configuration
const defaultCacheConfig: CacheConfig = {
  ttl: config.cacheTtl,
  keyGenerator: (req: Request) => {
    const baseKey = `${req.method}:${req.originalUrl}`;
    const queryString = req.query ? JSON.stringify(req.query) : '';
    const userId = (req as any).user?.id || 'anonymous';
    return `cache:${userId}:${baseKey}:${queryString}`;
  },
  skipCache: (req: Request) => {
    // Skip cache for POST, PUT, DELETE requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return true;
    }
    
    // Skip cache if no-cache header is present
    if (req.headers['cache-control']?.includes('no-cache')) {
      return true;
    }
    
    // Skip cache for authenticated requests that might contain user-specific data
    if ((req as any).user && req.originalUrl.includes('/user/')) {
      return true;
    }
    
    return false;
  },
  skipCacheHeaders: ['authorization', 'cookie', 'x-api-key'],
};

// Cache middleware factory
export const createCacheMiddleware = (cacheConfig: Partial<CacheConfig> = {}) => {
  const config = { ...defaultCacheConfig, ...cacheConfig };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip caching if configured to do so
      if (config.skipCache?.(req)) {
        return next();
      }
      
      // Generate cache key
      const cacheKey = config.keyGenerator!(req);
      
      // Try to get cached response
      const cachedResponse = await redis.get(cacheKey);
      
      if (cachedResponse) {
        const { data, headers, statusCode } = JSON.parse(cachedResponse);
        
        // Set cached headers
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
        
        // Add cache hit header
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.status(statusCode).json(data);
      }
      
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to cache the response
      res.json = function(data: any) {
        // Don't cache error responses
        if (res.statusCode >= 400) {
          return originalJson.call(this, data);
        }
        
        // Prepare response for caching
        const responseToCache = {
          data,
          headers: res.getHeaders(),
          statusCode: res.statusCode,
        };
        
        // Cache the response
        redis.setex(cacheKey, config.ttl, JSON.stringify(responseToCache))
          .catch(error => {
            console.error('Cache set error:', error);
          });
        
        // Add cache miss header
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Cache invalidation middleware
export const createCacheInvalidationMiddleware = (patterns: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to invalidate cache after successful operations
      res.json = function(data: any) {
        // Only invalidate cache for successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          invalidateCache(req, patterns).catch(error => {
            console.error('Cache invalidation error:', error);
          });
        }
        
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache invalidation middleware error:', error);
      next();
    }
  };
};

// Cache invalidation function
export const invalidateCache = async (req: Request, patterns: string[] = []) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';
    const basePatterns = [
      `cache:${userId}:*`,
      `cache:anonymous:*`,
    ];
    
    const allPatterns = [...basePatterns, ...patterns];
    
    for (const pattern of allPatterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// Cache statistics
export const getCacheStats = async () => {
  try {
    const info = await redis.info('memory');
    const keyspace = await redis.info('keyspace');
    
    return {
      memory: info,
      keyspace: keyspace,
      connected: redis.status === 'ready',
    };
  } catch (error) {
    console.error('Cache stats error:', error);
    return null;
  }
};

// Clear all cache
export const clearAllCache = async () => {
  try {
    const keys = await redis.keys('cache:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error('Clear cache error:', error);
    return 0;
  }
};

// Cache warming function
export const warmCache = async (urls: string[], userId?: string) => {
  try {
    const promises = urls.map(async (url) => {
      const cacheKey = `cache:${userId || 'anonymous'}:GET:${url}:`;
      const exists = await redis.exists(cacheKey);
      return { url, cached: exists === 1 };
    });
    
    return await Promise.all(promises);
  } catch (error) {
    console.error('Cache warming error:', error);
    return [];
  }
};

// Export default cache middleware
export const cacheMiddleware = createCacheMiddleware();
export const cacheInvalidationMiddleware = createCacheInvalidationMiddleware();

export default cacheMiddleware;
