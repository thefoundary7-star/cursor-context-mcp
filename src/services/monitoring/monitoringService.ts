import { PrismaClient } from '@prisma/client'
import { logger } from '@/utils/logger'
import { productionConfig } from '@/config/production'
import { productionEmailService } from '../email/productionEmailService'
import * as Sentry from '@sentry/node'

const prisma = new PrismaClient()

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  error?: string
  timestamp: string
  details?: any
}

interface SystemMetrics {
  timestamp: string
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    free: number
    total: number
    usage: number
  }
  disk: {
    used: number
    free: number
    total: number
    usage: number
  }
  network: {
    bytesIn: number
    bytesOut: number
  }
}

interface AlertConfig {
  type: 'email' | 'webhook' | 'slack'
  enabled: boolean
  recipients: string[]
  thresholds: {
    [key: string]: number
  }
}

export class MonitoringService {
  private alertConfigs: Map<string, AlertConfig> = new Map()
  private metricsHistory: SystemMetrics[] = []
  private healthCheckHistory: HealthCheckResult[] = []

  constructor() {
    this.initializeAlertConfigs()
    this.startPeriodicMonitoring()
  }

  /**
   * Initialize alert configurations
   */
  private initializeAlertConfigs(): void {
    // Database health alerts
    this.alertConfigs.set('database', {
      type: 'email',
      enabled: true,
      recipients: [productionConfig.supportEmail],
      thresholds: {
        responseTime: 5000, // 5 seconds
        connectionErrors: 3
      }
    })

    // Email service alerts
    this.alertConfigs.set('email', {
      type: 'email',
      enabled: true,
      recipients: [productionConfig.supportEmail],
      thresholds: {
        failureRate: 0.1, // 10% failure rate
        responseTime: 10000 // 10 seconds
      }
    })

    // Webhook processing alerts
    this.alertConfigs.set('webhook', {
      type: 'email',
      enabled: true,
      recipients: [productionConfig.supportEmail],
      thresholds: {
        failureRate: 0.05, // 5% failure rate
        processingTime: 30000 // 30 seconds
      }
    })

    // System resource alerts
    this.alertConfigs.set('system', {
      type: 'email',
      enabled: true,
      recipients: [productionConfig.supportEmail],
      thresholds: {
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        diskUsage: 90 // 90%
      }
    })

    // License generation alerts
    this.alertConfigs.set('license', {
      type: 'email',
      enabled: true,
      recipients: [productionConfig.supportEmail],
      thresholds: {
        failureRate: 0.02, // 2% failure rate
        generationTime: 5000 // 5 seconds
      }
    })
  }

  /**
   * Start periodic monitoring
   */
  private startPeriodicMonitoring(): void {
    // Health checks every 30 seconds
    setInterval(() => {
      this.performHealthChecks()
    }, 30000)

    // System metrics every 60 seconds
    setInterval(() => {
      this.collectSystemMetrics()
    }, 60000)

    // Cleanup old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics()
    }, 3600000)
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    const checks: Promise<HealthCheckResult>[] = [
      this.checkDatabaseHealth(),
      this.checkEmailServiceHealth(),
      this.checkWebhookProcessingHealth(),
      this.checkSystemResources(),
      this.checkLicenseGenerationHealth()
    ]

    const results = await Promise.allSettled(checks)
    const healthResults: HealthCheckResult[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        healthResults.push(result.value)
      } else {
        healthResults.push({
          service: `check_${index}`,
          status: 'unhealthy',
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        })
      }
    })

    // Store health check results
    this.healthCheckHistory.push(...healthResults)
    this.healthCheckHistory = this.healthCheckHistory.slice(-100) // Keep last 100 results

    // Check for alerts
    await this.checkAlerts(healthResults)

    return healthResults
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`
      
      // Check connection pool status
      const poolStatus = await prisma.$queryRaw`
        SELECT 
          count(*) as active_connections,
          max_connections,
          (count(*)::float / max_connections::float * 100) as usage_percentage
        FROM pg_stat_activity, 
        (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') mc
      `

      const responseTime = Date.now() - startTime
      const status = responseTime > 5000 ? 'degraded' : 'healthy'

      return {
        service: 'database',
        status,
        responseTime,
        timestamp: new Date().toISOString(),
        details: poolStatus
      }
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Check email service health
   */
  private async checkEmailServiceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Test email service configuration
      const testResult = await productionEmailService.sendEmail({
        to: 'test@example.com',
        subject: 'Health Check Test',
        html: '<p>This is a health check test email.</p>',
        text: 'This is a health check test email.'
      })

      const responseTime = Date.now() - startTime
      const status = testResult.success ? 'healthy' : 'unhealthy'

      return {
        service: 'email',
        status,
        responseTime,
        timestamp: new Date().toISOString(),
        details: { success: testResult.success, messageId: testResult.messageId }
      }
    } catch (error) {
      return {
        service: 'email',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Check webhook processing health
   */
  private async checkWebhookProcessingHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Check recent webhook processing stats
      const recentWebhooks = await prisma.webhookEvent.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })

      const totalWebhooks = recentWebhooks.length
      const failedWebhooks = recentWebhooks.filter(w => !w.processed).length
      const failureRate = totalWebhooks > 0 ? failedWebhooks / totalWebhooks : 0

      const responseTime = Date.now() - startTime
      const status = failureRate > 0.05 ? 'degraded' : 'healthy'

      return {
        service: 'webhook',
        status,
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          totalWebhooks,
          failedWebhooks,
          failureRate,
          recentEvents: recentWebhooks.slice(0, 5)
        }
      }
    } catch (error) {
      return {
        service: 'webhook',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Check system resources
   */
  private async checkSystemResources(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()
      
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      const status = memoryUsagePercent > 85 ? 'degraded' : 'healthy'

      return {
        service: 'system',
        status,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        details: {
          memory: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            usage: memoryUsagePercent
          },
          cpu: cpuUsage,
          uptime: process.uptime()
        }
      }
    } catch (error) {
      return {
        service: 'system',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Check license generation health
   */
  private async checkLicenseGenerationHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Check recent license generation stats
      const recentLicenses = await prisma.license.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      const totalLicenses = recentLicenses.length
      const activeLicenses = recentLicenses.filter(l => l.isActive).length
      const successRate = totalLicenses > 0 ? activeLicenses / totalLicenses : 1

      const responseTime = Date.now() - startTime
      const status = successRate < 0.98 ? 'degraded' : 'healthy'

      return {
        service: 'license',
        status,
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          totalLicenses,
          activeLicenses,
          successRate
        }
      }
    } catch (error) {
      return {
        service: 'license',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()
      
      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: process.platform === 'linux' ? require('os').loadavg() : [0, 0, 0]
        },
        memory: {
          used: memoryUsage.heapUsed,
          free: memoryUsage.heapTotal - memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          usage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        disk: {
          used: 0, // Would need additional library to get disk usage
          free: 0,
          total: 0,
          usage: 0
        },
        network: {
          bytesIn: 0, // Would need additional monitoring
          bytesOut: 0
        }
      }

      this.metricsHistory.push(metrics)
      this.metricsHistory = this.metricsHistory.slice(-1440) // Keep last 24 hours (1 per minute)

      // Store metrics in database for historical analysis
      await this.storeMetrics(metrics)
    } catch (error) {
      logger.error('Failed to collect system metrics:', error)
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await prisma.analytics.create({
        data: {
          userId: 'system',
          eventType: 'SYSTEM_METRICS',
          eventData: JSON.stringify(metrics),
          timestamp: new Date()
        }
      })
    } catch (error) {
      logger.error('Failed to store metrics:', error)
    }
  }

  /**
   * Check for alerts based on health check results
   */
  private async checkAlerts(healthResults: HealthCheckResult[]): Promise<void> {
    for (const result of healthResults) {
      const alertConfig = this.alertConfigs.get(result.service)
      if (!alertConfig || !alertConfig.enabled) continue

      let shouldAlert = false
      let alertMessage = ''

      switch (result.service) {
        case 'database':
          if (result.status === 'unhealthy') {
            shouldAlert = true
            alertMessage = `Database is unhealthy: ${result.error}`
          } else if (result.responseTime && result.responseTime > alertConfig.thresholds.responseTime) {
            shouldAlert = true
            alertMessage = `Database response time is high: ${result.responseTime}ms`
          }
          break

        case 'email':
          if (result.status === 'unhealthy') {
            shouldAlert = true
            alertMessage = `Email service is unhealthy: ${result.error}`
          }
          break

        case 'webhook':
          if (result.details?.failureRate > alertConfig.thresholds.failureRate) {
            shouldAlert = true
            alertMessage = `Webhook failure rate is high: ${(result.details.failureRate * 100).toFixed(2)}%`
          }
          break

        case 'system':
          if (result.details?.memory?.usage > alertConfig.thresholds.memoryUsage) {
            shouldAlert = true
            alertMessage = `Memory usage is high: ${result.details.memory.usage.toFixed(2)}%`
          }
          break

        case 'license':
          if (result.details?.successRate < (1 - alertConfig.thresholds.failureRate)) {
            shouldAlert = true
            alertMessage = `License generation success rate is low: ${(result.details.successRate * 100).toFixed(2)}%`
          }
          break
      }

      if (shouldAlert) {
        await this.sendAlert(alertConfig, result.service, alertMessage, result)
      }
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(
    alertConfig: AlertConfig,
    service: string,
    message: string,
    details: HealthCheckResult
  ): Promise<void> {
    try {
      const alertData = {
        service,
        message,
        severity: details.status === 'unhealthy' ? 'critical' : 'warning',
        timestamp: new Date().toISOString(),
        details
      }

      // Log alert
      logger.error('System alert triggered', alertData)

      // Report to Sentry
      if (productionConfig.sentryDsn) {
        Sentry.captureMessage(message, {
          level: details.status === 'unhealthy' ? 'error' : 'warning',
          tags: {
            service,
            alertType: 'monitoring'
          },
          extra: details
        })
      }

      // Send email alert
      if (alertConfig.type === 'email') {
        await this.sendEmailAlert(alertConfig.recipients, alertData)
      }

      // Store alert in database
      await this.storeAlert(alertData)
    } catch (error) {
      logger.error('Failed to send alert:', error)
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(recipients: string[], alertData: any): Promise<void> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>FileBridge System Alert</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
        .critical { background: #fee2e2; border-color: #ef4444; }
        .warning { background: #fef3c7; border-color: #f59e0b; }
        .details { background: #f8fafc; border-radius: 6px; padding: 15px; margin: 15px 0; }
        pre { background: #1e293b; color: #f1f5f9; padding: 10px; border-radius: 4px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h2>🚨 FileBridge System Alert</h2>
      
      <div class="alert ${alertData.severity}">
        <strong>Service:</strong> ${alertData.service}<br>
        <strong>Severity:</strong> ${alertData.severity.toUpperCase()}<br>
        <strong>Time:</strong> ${alertData.timestamp}
      </div>
      
      <p><strong>Message:</strong> ${alertData.message}</p>
      
      <div class="details">
        <h3>Details:</h3>
        <pre>${JSON.stringify(alertData.details, null, 2)}</pre>
      </div>
      
      <p>Please investigate this issue immediately.</p>
      
      <p>Best regards,<br>FileBridge Monitoring System</p>
    </body>
    </html>
    `

    for (const recipient of recipients) {
      await productionEmailService.sendEmail({
        to: recipient,
        subject: `🚨 FileBridge Alert: ${alertData.service} - ${alertData.severity.toUpperCase()}`,
        html
      })
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alertData: any): Promise<void> {
    try {
      await prisma.analytics.create({
        data: {
          userId: 'system',
          eventType: 'SYSTEM_ALERT',
          eventData: JSON.stringify(alertData),
          timestamp: new Date()
        }
      })
    } catch (error) {
      logger.error('Failed to store alert:', error)
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    health: HealthCheckResult[]
    metrics: SystemMetrics[]
    alerts: any[]
    summary: {
      overallStatus: 'healthy' | 'degraded' | 'unhealthy'
      servicesUp: number
      servicesDown: number
      lastCheck: string
    }
  }> {
    const health = this.healthCheckHistory.slice(-10) // Last 10 health checks
    const metrics = this.metricsHistory.slice(-60) // Last 60 minutes
    const alerts = await this.getRecentAlerts()

    const servicesUp = health.filter(h => h.status === 'healthy').length
    const servicesDown = health.filter(h => h.status === 'unhealthy').length
    const overallStatus = servicesDown > 0 ? 'unhealthy' : 
                         health.some(h => h.status === 'degraded') ? 'degraded' : 'healthy'

    return {
      health,
      metrics,
      alerts,
      summary: {
        overallStatus,
        servicesUp,
        servicesDown,
        lastCheck: health[health.length - 1]?.timestamp || new Date().toISOString()
      }
    }
  }

  /**
   * Get recent alerts
   */
  private async getRecentAlerts(): Promise<any[]> {
    try {
      const alerts = await prisma.analytics.findMany({
        where: {
          eventType: 'SYSTEM_ALERT',
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 20
      })

      return alerts.map(alert => JSON.parse(alert.eventData))
    } catch (error) {
      logger.error('Failed to get recent alerts:', error)
      return []
    }
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    // Keep only last 7 days of metrics
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    this.metricsHistory = this.metricsHistory.filter(m => new Date(m.timestamp) > cutoffTime)
    this.healthCheckHistory = this.healthCheckHistory.filter(h => new Date(h.timestamp) > cutoffTime)
  }
}

export const monitoringService = new MonitoringService()
