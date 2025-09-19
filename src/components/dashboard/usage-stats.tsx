'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useUsageStats } from '@/hooks/useAnalytics'
import { useSubscription } from '@/hooks/useSubscription'
import { formatBytes } from '@/lib/utils'
import { 
  Activity, 
  Server, 
  Zap, 
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

export function UsageStats() {
  const { stats, isLoading } = useUsageStats()
  const { subscription } = useSubscription()

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
    if (percentage >= 90) return { variant: 'destructive' as const, icon: AlertTriangle }
    if (percentage >= 75) return { variant: 'warning' as const, icon: AlertTriangle }
    return { variant: 'success' as const, icon: CheckCircle }
  }

  const requestStatus = getUsageStatus(requestUsagePercentage)
  const deviceStatus = getUsageStatus(deviceUsagePercentage)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Requests */}
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

      {/* Active Devices */}
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

      {/* This Month */}
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

      {/* Plan Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {subscription?.plan.name || 'Free'}
          </div>
          <p className="text-xs text-muted-foreground">
            {subscription?.status === 'active' ? 'Active' : 'Inactive'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
