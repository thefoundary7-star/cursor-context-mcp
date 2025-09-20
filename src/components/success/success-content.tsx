'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Download, 
  FileText, 
  Mail, 
  ArrowRight,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react'
import { useAnalytics } from '@/components/analytics/analytics'

interface SuccessData {
  plan: string
  licenseKey: string
  subscriptionId: string
  downloadUrl: string
  setupGuideUrl: string
  isTrialActive?: boolean
  trialDaysLeft?: number
}

export function SuccessContent() {
  const [licenseKeyCopied, setLicenseKeyCopied] = useState(false)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [loading, setLoading] = useState(true)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const { trackConversion } = useAnalytics()

  const subscriptionId = searchParams?.get('subscription_id')
  const plan = searchParams?.get('plan') || 'pro'

  useEffect(() => {
    // Fetch subscription details
    if (subscriptionId) {
      fetchSuccessData()
    } else {
      // Handle case where user navigated directly
      setLoading(false)
    }

    // Track successful setup page view
    trackConversion.mcpSetupCompleted(plan)
  }, [subscriptionId, plan])

  const fetchSuccessData = async () => {
    try {
      const response = await fetch(`/api/billing/subscription-details?id=${subscriptionId}`)
      if (response.ok) {
        const data = await response.json()
        setSuccessData(data)
      }
    } catch (error) {
      console.error('Failed to fetch subscription details:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyLicenseKey = async () => {
    if (successData?.licenseKey) {
      await navigator.clipboard.writeText(successData.licenseKey)
      setLicenseKeyCopied(true)
      setTimeout(() => setLicenseKeyCopied(false), 2000)
    }
  }

  const planDetails = {
    FREE: { name: 'Free', color: 'bg-green-100 text-green-800' },
    PRO: { name: 'Pro', color: 'bg-blue-100 text-blue-800' },
    ENTERPRISE: { name: 'Enterprise', color: 'bg-purple-100 text-purple-800' }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading your account details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to MCP Server! 🎉</h1>
          <p className="text-gray-600 mt-2">
            {successData?.isTrialActive 
              ? `Your ${successData.trialDaysLeft}-day free trial has started`
              : 'Your subscription is now active'
            }
          </p>
          {successData && (
            <Badge className={planDetails[successData.plan as keyof typeof planDetails]?.color || 'bg-gray-100'}>
              {planDetails[successData.plan as keyof typeof planDetails]?.name || successData.plan} Plan
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* License Key */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Your License Key
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono break-all">
                      {successData?.licenseKey || 'License key will be sent to your email'}
                    </code>
                    {successData?.licenseKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyLicenseKey}
                        className="ml-2 flex-shrink-0"
                      >
                        {licenseKeyCopied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-start">
                    <Mail className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        License key sent to your email
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Check your inbox for setup instructions and license details
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                onClick={() => window.open(successData?.downloadUrl || 'https://releases.mcpserver.com/latest', '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download MCP Server
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.open(successData?.setupGuideUrl || 'https://docs.mcpserver.com/setup', '_blank')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Setup Guide
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Setup Steps */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Next Steps (5 minutes setup)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold">1</div>
                <h3 className="font-medium mb-2">Download</h3>
                <p className="text-sm text-gray-600">Download the MCP server for your OS</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold">2</div>
                <h3 className="font-medium mb-2">Install</h3>
                <p className="text-sm text-gray-600">Run installer and enter your license key</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold">3</div>
                <h3 className="font-medium mb-2">Configure</h3>
                <p className="text-sm text-gray-600">Connect Claude Desktop to your MCP server</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold">✓</div>
                <h3 className="font-medium mb-2">Code</h3>
                <p className="text-sm text-gray-600">Start coding with AI that understands your files</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">Need help getting started?</p>
          <div className="flex justify-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => window.open('https://docs.mcpserver.com', '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Documentation
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open('mailto:support@mcpserver.com', '_blank')}>
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>

        {/* Trial Info */}
        {successData?.isTrialActive && (
          <Card className="mt-6 bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="font-medium text-yellow-800 mb-2">Your Free Trial is Active</h3>
                <p className="text-sm text-yellow-700">
                  You have {successData.trialDaysLeft} days left in your free trial. 
                  We'll remind you before it expires.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => router.push('/dashboard/billing')}
                >
                  Manage Billing
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}