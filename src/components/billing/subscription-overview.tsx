'use client'

import { useState } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  CreditCard, 
  Calendar, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Download,
  Settings
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export function SubscriptionOverview() {
  const { subscription, isLoading } = useSubscription()
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-32 bg-muted rounded"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 w-48 bg-muted rounded"></div>
              <div className="h-2 w-full bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
          <p className="text-muted-foreground text-center mb-6">
            Choose a plan to get started with MCP SaaS
          </p>
          <Button>
            View Plans
          </Button>
        </CardContent>
      </Card>
    )
  }

  const requestUsagePercentage = (subscription.usage.requests / subscription.usage.requestsLimit) * 100
  const deviceUsagePercentage = (subscription.usage.devices / subscription.usage.devicesLimit) * 100

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'trialing':
        return 'warning'
      case 'past_due':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Current Plan</span>
            </CardTitle>
            <Badge variant={getStatusColor(subscription.status)}>
              {subscription.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
              {subscription.status === 'past_due' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="text-2xl font-bold">{subscription.plan.name}</h3>
              <p className="text-muted-foreground">
                {subscription.plan.price === 0 
                  ? 'Free' 
                  : `${formatCurrency(subscription.plan.price)}/${subscription.plan.interval}`
                }
              </p>
            </div>
            <div>
              <h4 className="font-medium">Billing Period</h4>
              <p className="text-sm text-muted-foreground">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div>
              <h4 className="font-medium">Next Billing Date</h4>
              <p className="text-sm text-muted-foreground">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Manage Plan
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Invoice
            </Button>
            {subscription.cancelAtPeriodEnd && (
              <Button variant="outline">
                Reactivate Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>API Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used this month</span>
                <span className="font-medium">
                  {subscription.usage.requests.toLocaleString()} / {subscription.usage.requestsLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={requestUsagePercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>{subscription.usage.requestsLimit.toLocaleString()}</span>
              </div>
            </div>
            {requestUsagePercentage > 80 && (
              <div className="flex items-center space-x-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Approaching usage limit</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Active Devices</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Connected devices</span>
                <span className="font-medium">
                  {subscription.usage.devices} / {subscription.usage.devicesLimit}
                </span>
              </div>
              <Progress value={deviceUsagePercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>{subscription.usage.devicesLimit}</span>
              </div>
            </div>
            {deviceUsagePercentage > 80 && (
              <div className="flex items-center space-x-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Approaching device limit</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Features */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {subscription.plan.features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Your Plan</DialogTitle>
            <DialogDescription>
              Choose a plan that better fits your usage needs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Plan options would go here */}
            <p className="text-sm text-muted-foreground">
              Plan upgrade options will be displayed here.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
