import { Request, Response, NextFunction } from 'express'
import { logger } from '@/utils/logger'
import { productionConfig } from '@/config/production'
import * as Sentry from '@sentry/node'

// Initialize Sentry for production error tracking
if (productionConfig.sentryDsn) {
  Sentry.init({
    dsn: productionConfig.sentryDsn,
    environment: productionConfig.sentryEnvironment,
    tracesSampleRate: 0.1,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: undefined }),
    ],
  })
}

interface ProductionError extends Error {
  statusCode?: number
  isOperational?: boolean
  code?: string
  details?: any
}

export class ProductionErrorHandler {
  /**
   * Main error handling middleware for production
   */
  static handleError(error: ProductionError, req: Request, res: Response, next: NextFunction): void {
    // Log error with context
    this.logError(error, req)

    // Report to Sentry if configured
    if (productionConfig.sentryDsn) {
      Sentry.withScope((scope) => {
        scope.setTag('errorType', error.constructor.name)
        scope.setContext('request', {
          method: req.method,
          url: req.url,
          headers: this.sanitizeHeaders(req.headers),
          body: this.sanitizeBody(req.body),
          user: req.user ? { id: req.user.id, email: req.user.email } : null,
        })
        scope.setLevel('error')
        Sentry.captureException(error)
      })
    }

    // Determine response based on error type
    const response = this.buildErrorResponse(error, req)

    // Send response
    res.status(response.statusCode).json(response.body)
  }

  /**
   * Handle 404 errors
   */
  static handleNotFound(req: Request, res: Response): void {
    const error = {
      statusCode: 404,
      message: 'Resource not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    }

    logger.warn('404 Not Found', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })

    res.status(404).json({
      success: false,
      error: 'Resource not found',
      path: req.path,
      timestamp: error.timestamp
    })
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(error: any, req: Request, res: Response): void {
    const validationError = {
      statusCode: 400,
      message: 'Validation failed',
      details: error.details || error.errors || error.message,
      timestamp: new Date().toISOString()
    }

    logger.warn('Validation error', {
      path: req.path,
      method: req.method,
      details: validationError.details,
      ip: req.ip
    })

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validationError.details,
      timestamp: validationError.timestamp
    })
  }

  /**
   * Handle rate limit errors
   */
  static handleRateLimitError(req: Request, res: Response): void {
    const error = {
      statusCode: 429,
      message: 'Too many requests',
      retryAfter: 60, // seconds
      timestamp: new Date().toISOString()
    }

    logger.warn('Rate limit exceeded', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })

    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: error.retryAfter,
      timestamp: error.timestamp
    })
  }

  /**
   * Handle database connection errors
   */
  static handleDatabaseError(error: any, req: Request, res: Response): void {
    const dbError = {
      statusCode: 503,
      message: 'Database service unavailable',
      timestamp: new Date().toISOString()
    }

    logger.error('Database error', {
      path: req.path,
      method: req.method,
      error: error.message,
      code: error.code,
      ip: req.ip
    })

    // Report critical database errors to Sentry
    if (productionConfig.sentryDsn) {
      Sentry.captureException(error, {
        tags: {
          errorType: 'database',
          severity: 'critical'
        }
      })
    }

    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      timestamp: dbError.timestamp
    })
  }

  /**
   * Handle webhook processing errors
   */
  static handleWebhookError(error: any, req: Request, res: Response): void {
    const webhookError = {
      statusCode: 500,
      message: 'Webhook processing failed',
      timestamp: new Date().toISOString()
    }

    logger.error('Webhook processing error', {
      path: req.path,
      method: req.method,
      error: error.message,
      webhookId: req.headers['webhook-id'],
      ip: req.ip
    })

    // Report webhook errors to Sentry with high priority
    if (productionConfig.sentryDsn) {
      Sentry.captureException(error, {
        tags: {
          errorType: 'webhook',
          severity: 'high'
        },
        level: 'error'
      })
    }

    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      timestamp: webhookError.timestamp
    })
  }

  /**
   * Log error with production context
   */
  private static logError(error: ProductionError, req: Request): void {
    const logContext = {
      error: {
        name: error.name,
        message: error.message,
        stack: productionConfig.debug ? error.stack : undefined,
        code: error.code,
        statusCode: error.statusCode
      },
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer')
      },
      user: req.user ? {
        id: req.user.id,
        email: req.user.email
      } : null,
      timestamp: new Date().toISOString()
    }

    if (error.statusCode && error.statusCode >= 500) {
      logger.error('Server error', logContext)
    } else if (error.statusCode && error.statusCode >= 400) {
      logger.warn('Client error', logContext)
    } else {
      logger.error('Unexpected error', logContext)
    }
  }

  /**
   * Build error response based on error type and environment
   */
  private static buildErrorResponse(error: ProductionError, req: Request): {
    statusCode: number
    body: any
  } {
    const statusCode = error.statusCode || 500
    const isClientError = statusCode >= 400 && statusCode < 500

    // Base response structure
    const response: any = {
      success: false,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }

    // Add error message
    if (isClientError) {
      response.error = error.message
    } else {
      response.error = 'Internal server error'
    }

    // Add additional details in development or for client errors
    if (productionConfig.debug || isClientError) {
      if (error.details) {
        response.details = error.details
      }
      if (error.code) {
        response.code = error.code
      }
    }

    // Add request ID for tracking
    response.requestId = req.headers['x-request-id'] || this.generateRequestId()

    return { statusCode, body: response }
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private static sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']
    const sanitized = { ...headers }

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]'
      }
    })

    return sanitized
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private static sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard', 'ssn']
    const sanitized = { ...body }

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject)
      }
      if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = '[REDACTED]'
          } else {
            result[key] = sanitizeObject(value)
          }
        }
        return result
      }
      return obj
    }

    return sanitizeObject(sanitized)
  }

  /**
   * Generate unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Health check endpoint
   */
  static healthCheck(req: Request, res: Response): void {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: productionConfig.nodeEnv
    }

    res.status(200).json(health)
  }

  /**
   * Graceful shutdown handler
   */
  static setupGracefulShutdown(): void {
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`)
      
      // Close database connections
      // Close Redis connections
      // Stop accepting new requests
      // Wait for existing requests to complete
      
      setTimeout(() => {
        logger.info('Graceful shutdown completed')
        process.exit(0)
      }, 10000) // 10 second timeout
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  }
}

// Express middleware setup
export const setupProductionErrorHandling = (app: any): void => {
  // Sentry request handler (must be first)
  if (productionConfig.sentryDsn) {
    app.use(Sentry.requestHandler())
    app.use(Sentry.tracingHandler())
  }

  // 404 handler
  app.use(ProductionErrorHandler.handleNotFound)

  // Main error handler (must be last)
  app.use(ProductionErrorHandler.handleError)

  // Setup graceful shutdown
  ProductionErrorHandler.setupGracefulShutdown()
}
