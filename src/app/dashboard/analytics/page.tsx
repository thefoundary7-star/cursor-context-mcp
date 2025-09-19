'use client'

import { Layout } from '@/components/layout/layout'
import { AnalyticsOverview } from '@/components/analytics/analytics-overview'
import { UsageChart } from '@/components/dashboard/usage-chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AnalyticsPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Detailed insights into your MCP server usage and performance.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage Trends</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AnalyticsOverview />
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <div className="space-y-6">
              <UsageChart timeRange="7d" />
              <UsageChart timeRange="30d" />
              <UsageChart timeRange="90d" />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Performance analytics coming soon...
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
