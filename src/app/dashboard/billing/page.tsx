'use client'

import { Layout } from '@/components/layout/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubscriptionOverview } from '@/components/billing/subscription-overview'
import { PaymentMethods } from '@/components/billing/payment-methods'
import { InvoiceHistory } from '@/components/billing/invoice-history'
import { BillingSettings } from '@/components/billing/billing-settings'

export default function BillingPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Usage</h1>
          <p className="text-muted-foreground">
            Manage your subscription, payment methods, and view usage details.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <SubscriptionOverview />
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-6">
            <PaymentMethods />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <InvoiceHistory />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <BillingSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
