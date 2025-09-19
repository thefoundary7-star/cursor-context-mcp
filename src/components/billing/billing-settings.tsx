'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { 
  Settings, 
  Bell, 
  CreditCard,
  FileText,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

export function BillingSettings() {
  const [settings, setSettings] = useState({
    autoRenewal: true,
    emailInvoices: true,
    lowBalanceAlerts: true,
    usageAlerts: true,
    taxInclusive: false,
  })

  const [billingEmail, setBillingEmail] = useState('')

  const updateSetting = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    // In a real app, you would save these settings to the server
    console.log('Saving billing settings:', settings)
  }

  return (
    <div className="space-y-6">
      {/* Billing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Billing Preferences</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-renewal">Auto-renewal</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically renew your subscription when it expires
                </p>
              </div>
              <Switch
                id="auto-renewal"
                checked={settings.autoRenewal}
                onCheckedChange={(value) => updateSetting('autoRenewal', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="email-invoices">Email invoices</Label>
                <p className="text-sm text-muted-foreground">
                  Send invoice receipts to your email address
                </p>
              </div>
              <Switch
                id="email-invoices"
                checked={settings.emailInvoices}
                onCheckedChange={(value) => updateSetting('emailInvoices', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="low-balance-alerts">Low balance alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your account balance is low
                </p>
              </div>
              <Switch
                id="low-balance-alerts"
                checked={settings.lowBalanceAlerts}
                onCheckedChange={(value) => updateSetting('lowBalanceAlerts', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="usage-alerts">Usage alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when you approach your usage limits
                </p>
              </div>
              <Switch
                id="usage-alerts"
                checked={settings.usageAlerts}
                onCheckedChange={(value) => updateSetting('usageAlerts', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="tax-inclusive">Tax-inclusive pricing</Label>
                <p className="text-sm text-muted-foreground">
                  Show prices including applicable taxes
                </p>
              </div>
              <Switch
                id="tax-inclusive"
                checked={settings.taxInclusive}
                onCheckedChange={(value) => updateSetting('taxInclusive', value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Billing Email</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billing-email">Email address for billing notifications</Label>
            <Input
              id="billing-email"
              type="email"
              placeholder="billing@example.com"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              This email will receive invoices, receipts, and billing notifications.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <h4 className="font-medium">Payment Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    Powered by Stripe - secure and reliable
                  </p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <h4 className="font-medium">Failed Payment Retry</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically retry failed payments
                  </p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Tax Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vat-number">VAT Number</Label>
              <Input
                id="vat-number"
                placeholder="Enter your VAT number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-id">Tax ID</Label>
              <Input
                id="tax-id"
                placeholder="Enter your Tax ID"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Providing tax information may help reduce applicable taxes on your invoices.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </div>
  )
}
