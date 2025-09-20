'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Shield, Check } from 'lucide-react'

const PLAN_DETAILS = {
  pro: {
    name: 'Pro',
    price: 19,
    period: 'month',
    features: [
      '5 MCP server instances',
      'Advanced file operations',
      'Git integration',
      'Priority email support',
      'Usage analytics',
      'Team management'
    ]
  },
  enterprise: {
    name: 'Enterprise', 
    price: 99,
    period: 'month',
    features: [
      'Unlimited MCP servers',
      'Advanced security features',
      'Multi-factor authentication',
      'SSO integration',
      'Priority phone support',
      'Custom integrations',
      'SLA guarantees'
    ]
  }
}

export function CheckoutForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const plan = searchParams?.get('plan') || 'pro'
  const userId = searchParams?.get('userId')
  
  const planDetails = PLAN_DETAILS[plan as keyof typeof PLAN_DETAILS]

  useEffect(() => {
    // Track checkout page view
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: planDetails?.price || 0,
        items: [{
          item_id: plan,
          item_name: planDetails?.name || plan,
          category: 'subscription',
          quantity: 1,
          price: planDetails?.price || 0
        }]
      })
    }
  }, [plan, planDetails])

  const handleSubscribe = async () => {
    try {
      setIsLoading(true)
      setError('')

      if (!userId) {
        throw new Error('User ID missing')
      }

      // Create subscription
      const response = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          plan: plan.toUpperCase()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create subscription')
      }

      const result = await response.json()

      // Track successful subscription
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: result.subscription.id,
          value: planDetails?.price || 0,
          currency: 'USD',
          items: [{
            item_id: plan,
            item_name: planDetails?.name || plan,
            category: 'subscription',
            quantity: 1,
            price: planDetails?.price || 0
          }]
        })
      }

      // If subscription requires payment setup, handle Stripe checkout
      if (result.clientSecret) {
        // Redirect to Stripe or handle payment
        window.location.href = `/payment-setup?clientSecret=${result.clientSecret}`
        return
      }

      // If subscription is active (trial), redirect to dashboard
      router.push('/dashboard?welcome=true&trial=true')

    } catch (error) {
      console.error('Subscription error:', error)
      setError(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  if (!planDetails) {
    return <div>Invalid plan selected</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Plan Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {planDetails.name} Plan
            <Badge variant="secondary">14-day trial</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="text-3xl font-bold">
              ${planDetails.price}
              <span className="text-lg font-normal text-gray-600">/{planDetails.period}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Free for 14 days, then ${planDetails.price}/{planDetails.period}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Included features:</h4>
            {planDetails.features.map((feature, index) => (
              <div key={index} className="flex items-center">
                <Check className="w-4 h-4 text-green-600 mr-3" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <div className="text-sm font-medium text-blue-900">
                  Risk-free trial
                </div>
                <div className="text-xs text-blue-700">
                  Cancel anytime during your trial. No charges until trial ends.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Start Your Trial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">What happens next:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>1. Start your 14-day free trial immediately</li>
                <li>2. Receive your license key via email</li>
                <li>3. Download and setup your MCP server</li>
                <li>4. Begin using Claude Desktop with local file access</li>
              </ul>
            </div>

            <Button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your trial...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Start Free Trial
                </>
              )}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-xs text-gray-500">
                By starting your trial, you agree to our{' '}
                <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
              </p>
              
              <div className="flex justify-center items-center space-x-4 text-xs text-gray-400">
                <div>🔒 Secure checkout</div>
                <div>💳 Powered by Stripe</div>
                <div>🛡️ SOC 2 compliant</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}