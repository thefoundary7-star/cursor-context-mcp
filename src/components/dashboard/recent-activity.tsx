'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDateTime } from '@/lib/utils'
import { 
  Activity, 
  Server, 
  Key, 
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'request' | 'device' | 'license' | 'billing' | 'download' | 'system'
  title: string
  description: string
  timestamp: string
  status: 'success' | 'warning' | 'error' | 'info'
  user?: string
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'request',
    title: 'API Request',
    description: 'High volume of requests detected',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'warning',
  },
  {
    id: '2',
    type: 'device',
    title: 'New Device Connected',
    description: 'Device "MacBook Pro" connected to license',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: '3',
    type: 'license',
    title: 'License Generated',
    description: 'New license key created for production',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: '4',
    type: 'billing',
    title: 'Payment Processed',
    description: 'Monthly subscription payment successful',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'success',
  },
  {
    id: '5',
    type: 'download',
    title: 'MCP Server Downloaded',
    description: 'Latest version downloaded by user',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'info',
  },
]

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'request':
      return Activity
    case 'device':
      return Server
    case 'license':
      return Key
    case 'billing':
      return CreditCard
    case 'download':
      return Download
    case 'system':
      return AlertTriangle
    default:
      return Activity
  }
}

const getStatusIcon = (status: ActivityItem['status']) => {
  switch (status) {
    case 'success':
      return CheckCircle
    case 'warning':
      return AlertTriangle
    case 'error':
      return AlertTriangle
    case 'info':
      return Clock
    default:
      return Activity
  }
}

const getStatusColor = (status: ActivityItem['status']) => {
  switch (status) {
    case 'success':
      return 'text-green-500'
    case 'warning':
      return 'text-yellow-500'
    case 'error':
      return 'text-red-500'
    case 'info':
      return 'text-blue-500'
    default:
      return 'text-muted-foreground'
  }
}

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockActivities.map((activity) => {
            const ActivityIcon = getActivityIcon(activity.type)
            const StatusIcon = getStatusIcon(activity.status)
            
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    <div className="flex items-center space-x-2">
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(activity.status)}`} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <button className="text-sm text-primary hover:underline">
            View all activity
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
