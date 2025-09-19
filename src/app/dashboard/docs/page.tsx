'use client'

import { Layout } from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Book, 
  Code, 
  Play,
  ExternalLink,
  Download,
  Search
} from 'lucide-react'

export default function DocumentationPage() {
  const documentationSections = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of MCP server integration',
      icon: Play,
      items: [
        { title: 'Quick Start Guide', description: 'Get up and running in 5 minutes', type: 'guide' },
        { title: 'Installation', description: 'Install and configure your MCP server', type: 'guide' },
        { title: 'First API Call', description: 'Make your first API request', type: 'tutorial' },
      ]
    },
    {
      title: 'API Reference',
      description: 'Complete API documentation and endpoints',
      icon: Code,
      items: [
        { title: 'Authentication', description: 'API keys and authentication methods', type: 'reference' },
        { title: 'Endpoints', description: 'All available API endpoints', type: 'reference' },
        { title: 'Rate Limits', description: 'Understanding rate limits and quotas', type: 'reference' },
        { title: 'Error Codes', description: 'Common error codes and troubleshooting', type: 'reference' },
      ]
    },
    {
      title: 'SDKs & Libraries',
      description: 'Official SDKs and community libraries',
      icon: Book,
      items: [
        { title: 'Python SDK', description: 'Official Python SDK documentation', type: 'sdk' },
        { title: 'JavaScript SDK', description: 'Official JavaScript/TypeScript SDK', type: 'sdk' },
        { title: 'Community Libraries', description: 'Third-party libraries and tools', type: 'community' },
      ]
    },
    {
      title: 'Guides & Tutorials',
      description: 'Step-by-step guides and best practices',
      icon: FileText,
      items: [
        { title: 'Webhook Integration', description: 'Setting up webhooks for real-time updates', type: 'tutorial' },
        { title: 'Batch Processing', description: 'Processing large amounts of data efficiently', type: 'tutorial' },
        { title: 'Security Best Practices', description: 'Keeping your integration secure', type: 'guide' },
        { title: 'Performance Optimization', description: 'Optimizing your API usage', type: 'guide' },
      ]
    }
  ]

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'guide':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'tutorial':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'reference':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'sdk':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'community':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
          <p className="text-muted-foreground">
            Everything you need to integrate and use the MCP server effectively.
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documentation..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* Documentation Sections */}
        <div className="grid gap-6 md:grid-cols-2">
          {documentationSections.map((section) => {
            const Icon = section.icon
            return (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Icon className="h-5 w-5" />
                    <span>{section.title}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {section.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={getTypeColor(item.type)}>
                          {item.type}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                <Download className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Download SDKs</div>
                  <div className="text-sm text-muted-foreground">Get the latest SDKs</div>
                </div>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                <Code className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">API Explorer</div>
                  <div className="text-sm text-muted-foreground">Try the API interactively</div>
                </div>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Changelog</div>
                  <div className="text-sm text-muted-foreground">See what's new</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
