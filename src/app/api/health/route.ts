import { NextRequest, NextResponse } from 'next/server'
import { monitoringService } from '@/services/monitoring/monitoringService'
import { productionConfig } from '@/config/production'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Basic health check
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: productionConfig.nodeEnv,
      responseTime: 0
    }

    // Quick database check
    try {
      await prisma.$queryRaw`SELECT 1`
      healthCheck['database'] = 'connected'
    } catch (error) {
      healthCheck['database'] = 'disconnected'
      healthCheck.status = 'unhealthy'
    }

    // Quick email service check
    try {
      // Just check if SMTP is configured, don't actually send
      if (productionConfig.smtpHost && productionConfig.smtpUser && productionConfig.smtpPass) {
        healthCheck['email'] = 'configured'
      } else {
        healthCheck['email'] = 'not_configured'
      }
    } catch (error) {
      healthCheck['email'] = 'error'
    }

    healthCheck.responseTime = Date.now() - startTime

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503
    
    return NextResponse.json(healthCheck, { status: statusCode })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      responseTime: Date.now() - startTime
    }, { status: 503 })
  }
}

// Detailed health check endpoint
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Perform comprehensive health checks
    const healthResults = await monitoringService.performHealthChecks()
    
    const overallStatus = healthResults.some(h => h.status === 'unhealthy') ? 'unhealthy' :
                         healthResults.some(h => h.status === 'degraded') ? 'degraded' : 'healthy'

    const detailedHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: productionConfig.nodeEnv,
      responseTime: Date.now() - startTime,
      services: healthResults,
      summary: {
        total: healthResults.length,
        healthy: healthResults.filter(h => h.status === 'healthy').length,
        degraded: healthResults.filter(h => h.status === 'degraded').length,
        unhealthy: healthResults.filter(h => h.status === 'unhealthy').length
      }
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503
    
    return NextResponse.json(detailedHealth, { status: statusCode })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      responseTime: Date.now() - startTime
    }, { status: 503 })
  }
}
