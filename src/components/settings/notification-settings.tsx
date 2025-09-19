'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Bell, Mail, Smartphone, CreditCard, Activity, Shield } from 'lucide-react'

interface NotificationSetting {
  id: string
  name: string
  description: string
  email: boolean
  push: boolean
  icon: React.ComponentType<{ className?: string }>
}

const notificationSettings: NotificationSetting[] = [
  {
    id: 'billing',
    name: 'Billing & Payments',
    description: 'Payment confirmations, failed payments, and subscription updates',
    email: true,
    push: false,
    icon: CreditCard,
  },
  {
    id: 'usage',
    name: 'Usage Alerts',
    description: 'Notifications when you approach your usage limits',
    email: true,
    push: true,
    icon: Activity,
  },
  {
    id: 'security',
    name: 'Security Alerts',
    description: 'Login attempts, password changes, and security events',
    email: true,
    push: true,
    icon: Shield,
  },
  {
    id: 'product',
    name: 'Product Updates',
    description: 'New features, updates, and maintenance notifications',
    email: false,
    push: false,
    icon: Bell,
  },
]

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSetting[]>(notificationSettings)

  const updateSetting = (id: string, type: 'email' | 'push', value: boolean) => {
    setSettings(prev => 
      prev.map(setting => 
        setting.id === id 
          ? { ...setting, [type]: value }
          : setting
      )
    )
  }

  const handleSave = () => {
    // In a real app, you would save these settings to the server
    console.log('Saving notification settings:', settings)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Preferences</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.map((setting) => {
            const Icon = setting.icon
            return (
              <div key={setting.id} className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <h4 className="font-medium">{setting.name}</h4>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pl-8">
                  <div className="space-y-2">
                    <Label htmlFor={`${setting.id}-email`} className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </Label>
                    <Switch
                      id={`${setting.id}-email`}
                      checked={setting.email}
                      onCheckedChange={(value) => updateSetting(setting.id, 'email', value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`${setting.id}-push`} className="flex items-center space-x-2">
                      <Smartphone className="h-4 w-4" />
                      <span>Push</span>
                    </Label>
                    <Switch
                      id={`${setting.id}-push`}
                      checked={setting.push}
                      onCheckedChange={(value) => updateSetting(setting.id, 'push', value)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
          
          <div className="pt-4 border-t">
            <Button onClick={handleSave}>
              Save Notification Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="font-medium">Email Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <Badge variant="success">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="font-medium">Push Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications in your browser
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
