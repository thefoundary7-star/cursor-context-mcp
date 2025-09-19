'use client'

import { useUsageStats } from '@/hooks/useAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  Server, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

export function AnalyticsOverview() {
  const { stats, isLoading } = useUsageStats()

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded mb-2"></div>
              <div className="h-2 w-full bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const requestUsagePercentage = (stats.quotaUsage.requests / stats.quotaLimits.requests) * 100
  const deviceUsagePercentage = (stats.quotaUsage.devices / stats.quotaLimits.devices) * 100

  const getUsageStatus = (percentage: number) => {
    if (percentage >= 90) return { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-500' }
    if (percentage >= 75) return { variant: 'warning' as const, icon: AlertTriangle, color: 'text-yellow-500' }
    return { variant: 'success' as const, icon: CheckCircle, color: 'text-green-500' }
  }

  const requestStatus = getUsageStatus(requestUsagePercentage)
  const deviceStatus = getUsageStatus(deviceUsagePercentage)

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
            <div className="flex items-center space-x-2 mt-2">
              <Progress value={requestUsagePercentage} className="flex-1" />
              <Badge variant={requestStatus.variant} className="text-xs">
                {requestUsagePercentage.toFixed(0)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.quotaUsage.requests.toLocaleString()} / {stats.quotaLimits.requests.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDevices}</div>
            <div className="flex items-center space-x-2 mt-2">
              <Progress value={deviceUsagePercentage} className="flex-1" />
              <Badge variant={deviceStatus.variant} className="text-xs">
                {deviceUsagePercentage.toFixed(0)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.quotaUsage.devices} / {stats.quotaLimits.devices}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.requestsThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.devicesThisMonth} devices active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45ms</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 inline mr-1" />
              12% faster than last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Alerts */}
      {(requestUsagePercentage > 75 || deviceUsagePercentage > 75) && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-5 w-5" />
              <span>Usage Alerts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requestUsagePercentage > 75 && (
              <div className="flex items-center space-x-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span>
                  API requests are at {requestUsagePercentage.toFixed(0)}% of your limit.
                  {requestUsagePercentage > 90 && ' Consider upgrading your plan.'}
                </span>
              </div>
            )}
            {deviceUsagePercentage > 75 && (
              <div className="flex items-center space-x-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span>
                  Device usage is at {deviceUsagePercentage.toFixed(0)}% of your limit.
                  {deviceUsagePercentage > 90 && ' Consider upgrading your plan.'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">99.9%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +0.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Peak Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,847</div>
            <p className="text-xs text-muted-foreground">
              Requests per hour (yesterday)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Data Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2 GB</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
