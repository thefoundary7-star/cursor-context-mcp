import { NextRequest, NextResponse } from 'next/server'
import { monitoringService } from '@/services/monitoring/monitoringService'
import { rateLimitHealthCheck } from '@/middleware/productionRateLimit'

export async function GET(req: NextRequest) {
  try {
    // Get monitoring dashboard data
    const dashboardData = await monitoringService.getDashboardData()
    
    // Get rate limiting health
    const rateLimitHealth = await rateLimitHealthCheck()
    
    const response = {
      ...dashboardData,
      rateLimit: rateLimitHealth,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get monitoring data',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
