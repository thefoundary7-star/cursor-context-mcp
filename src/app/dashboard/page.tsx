'use client'

import { Layout } from '@/components/layout/layout'
import { UsageStats } from '@/components/dashboard/usage-stats'
import { UsageChart } from '@/components/dashboard/usage-chart'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { 
  Download, 
  Key, 
  CreditCard, 
  BarChart3,
  ArrowRight,
  Zap,
  Server,
  Shield
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user } = useAuth()
  const { subscription } = useSubscription()

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your MCP server today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {subscription && (
              <Badge 
                variant={subscription.status === 'active' ? 'success' : 'warning'}
                className="text-sm"
              >
                {subscription.plan.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <UsageStats />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Usage Chart */}
          <div className="lg:col-span-2">
            <UsageChart />
          </div>

          {/* Recent Activity */}
          <div>
            <RecentActivity />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Download MCP Server</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Get the latest version of your MCP server
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard/downloads">
                  Download
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manage Licenses</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Create and manage your license keys
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/licenses">
                  Manage
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Billing & Usage</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                View usage and manage your subscription
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/billing">
                  View
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Analytics</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Detailed usage analytics and insights
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/analytics">
                  View
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Plan Overview */}
        {subscription && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Current Plan</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <h4 className="font-medium">{subscription.plan.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {subscription.plan.price === 0 ? 'Free' : `$${subscription.plan.price / 100}/${subscription.plan.interval}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Usage</h4>
                  <p className="text-sm text-muted-foreground">
                    {subscription.usage.requests.toLocaleString()} / {subscription.usage.requestsLimit.toLocaleString()} requests
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Devices</h4>
                  <p className="text-sm text-muted-foreground">
                    {subscription.usage.devices} / {subscription.usage.devicesLimit} devices
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <Button asChild>
                  <Link href="/dashboard/billing">
                    Manage Plan
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/analytics">
                    View Analytics
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}
