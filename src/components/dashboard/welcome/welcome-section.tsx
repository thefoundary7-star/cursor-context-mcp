'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  Download, 
  FileText, 
  Play, 
  ExternalLink,
  Copy,
  Check,
  Clock,
  Lightbulb
} from 'lucide-react'
import { useAnalytics } from '@/components/analytics/analytics'

interface WelcomeProps {
  user: {
    firstName: string
    email: string
    plan: string
    trialDaysLeft?: number
    isTrialActive?: boolean
  }
  license: {
    key: string
    status: string
  }
  setupProgress: {
    downloaded: boolean
    installed: boolean
    configured: boolean
    firstUse: boolean
  }
}

export function WelcomeSection({ user, license, setupProgress }: WelcomeProps) {
  const [licenseKeyCopied, setLicenseKeyCopied] = useState(false)
  const { trackConversion } = useAnalytics()

  const completedSteps = Object.values(setupProgress).filter(Boolean).length
  const progressPercentage = (completedSteps / 4) * 100

  useEffect(() => {
    // Track dashboard visit for new users
    if (progressPercentage === 0) {
      trackConversion.mcpSetupCompleted(user.plan.toLowerCase())
    }
  }, [])

  const copyLicenseKey = async () => {
    await navigator.clipboard.writeText(license.key)
    setLicenseKeyCopied(true)
    setTimeout(() => setLicenseKeyCopied(false), 2000)
  }

  const setupSteps = [
    {
      id: 'downloaded',
      title: 'Download MCP Server',
      description: 'Download the MCP server for your operating system',
      completed: setupProgress.downloaded,
      action: () => window.open('https://releases.mcpserver.com/latest', '_blank'),
      actionText: 'Download Now',
      icon: Download
    },
    {
      id: 'installed',
      title: 'Install & License',
      description: 'Run the installer and enter your license key',
      completed: setupProgress.installed,
      action: () => window.open('https://docs.mcpserver.com/installation', '_blank'),
      actionText: 'View Guide',
      icon: Play
    },
    {
      id: 'configured',
      title: 'Configure Claude Desktop',
      description: 'Connect Claude Desktop to your MCP server',
      completed: setupProgress.configured,
      action: () => window.open('https://docs.mcpserver.com/claude-integration', '_blank'),
      actionText: 'Setup Guide',
      icon: FileText
    },
    {
      id: 'firstUse',
      title: 'First Coding Session',
      description: 'Start using Claude with access to your local files',
      completed: setupProgress.firstUse,
      action: () => window.open('https://docs.mcpserver.com/getting-started', '_blank'),
      actionText: 'Learn More',
      icon: Lightbulb
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome to MCP Server, {user.firstName}! 🎉
              </h1>
              <p className="text-gray-600 mt-1">
                Your privacy-first AI development environment is ready to set up
              </p>
              <div className="flex items-center mt-3 space-x-4">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {user.plan} Plan
                </Badge>
                {user.isTrialActive && (
                  <Badge variant="outline" className="border-orange-200 text-orange-700">
                    <Clock className="w-3 h-3 mr-1" />
                    {user.trialDaysLeft} days trial left
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{completedSteps}/4</div>
              <div className="text-sm text-gray-600">Setup Complete</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* License Key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileText className="w-5 h-5 mr-2" />
              Your License Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono text-gray-700 break-all">
                    {license.key}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyLicenseKey}
                    className="ml-2 flex-shrink-0"
                  >
                    {licenseKeyCopied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <Badge variant={license.status === 'active' ? 'default' : 'secondary'}>
                  {license.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start" 
              onClick={() => window.open('https://releases.mcpserver.com/latest', '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download MCP Server
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => window.open('https://docs.mcpserver.com/quickstart', '_blank')}
            >
              <Play className="w-4 h-4 mr-2" />
              5-Minute Setup Guide
            </Button>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              <div className="text-sm text-gray-600">
                {completedSteps === 4 ? (
                  "🎉 Setup complete! You're ready to code with AI."
                ) : (
                  `${4 - completedSteps} steps remaining to complete setup`
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {setupSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div 
                  key={step.id} 
                  className={`flex items-center p-4 rounded-lg border ${
                    step.completed 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${
                    step.completed 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {step.completed ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                  
                  {!step.completed && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={step.action}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {step.actionText}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => window.open('https://docs.mcpserver.com', '_blank')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Documentation
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => window.open('https://community.mcpserver.com', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Community Forum
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => window.open('mailto:support@mcpserver.com', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}