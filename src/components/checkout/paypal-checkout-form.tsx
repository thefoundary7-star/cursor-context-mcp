'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Shield, Check } from 'lucide-react'

declare global {
  interface Window {
    paypal?: any
  }
}

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

export function PayPalCheckoutForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const plan = searchParams?.get('plan') || 'pro'
  const userId = searchParams?.get('userId')
  
  const planDetails = PLAN_DETAILS[plan as keyof typeof PLAN_DETAILS]

  useEffect(() => {
    // Load PayPal SDK
    const loadPayPalScript = () => {
      if (window.paypal) {
        setPaypalLoaded(true)
        renderPayPalButton()
        return
      }

      const script = document.createElement('script')
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD&intent=capture`
      script.onload = () => {
        setPaypalLoaded(true)
        renderPayPalButton()
      }
      document.body.appendChild(script)
    }

    loadPayPalScript()
  }, [plan, userId])

  const renderPayPalButton = () => {
    if (!window.paypal || !paypalLoaded) return

    // Clear any existing buttons
    const container = document.getElementById('paypal-button-container')
    if (container) {
      container.innerHTML = ''
    }

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal'
      },
      
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: planDetails.price.toString(),
              currency_code: 'USD'
            },
            description: `MCP Server ${planDetails.name} - Monthly Subscription`
          }],
          application_context: {
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW'
          }
        })
      },

      onApprove: async (data: any, actions: any) => {
        try {
          setIsLoading(true)
          setError('')

          // Capture the payment
          const order = await actions.order.capture()
          
          // Send to our backend to create subscription
          const response = await fetch('/api/billing/create-paypal-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              plan,
              paypalOrderId: order.id
            })
          })

          if (!response.ok) {
            throw new Error('Failed to create subscription')
          }

          const result = await response.json()

          // Track successful payment
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'purchase', {
              transaction_id: order.id,
              value: planDetails.price,
              currency: 'USD',
              items: [{
                item_id: plan,
                item_name: planDetails.name,
                category: 'subscription',
                quantity: 1,
                price: planDetails.price
              }]
            })
          }

          // Redirect to success page
          router.push(`/success?subscription_id=${result.subscription.id}&plan=${plan}`)

        } catch (error) {
          console.error('Payment processing error:', error)
          setError(error instanceof Error ? error.message : 'Payment failed')
        } finally {
          setIsLoading(false)
        }
      },

      onError: (err: any) => {
        console.error('PayPal Error:', err)
        setError('Payment failed. Please try again.')
      },

      onCancel: (data: any) => {
        console.log('Payment cancelled:', data)
        setError('Payment was cancelled')
      }
    }).render('#paypal-button-container')
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
              First month only, then ${planDetails.price}/{planDetails.period}
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
                  Secure Payment
                </div>
                <div className="text-xs text-blue-700">
                  Pay with PayPal or credit card. Cancel anytime.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Payment</CardTitle>
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
                <li>1. Complete secure payment with PayPal</li>
                <li>2. Receive your license key via email</li>
                <li>3. Download and setup your MCP server</li>
                <li>4. Begin using Claude Desktop with local file access</li>
              </ul>
            </div>

            {/* PayPal Button Container */}
            <div className="w-full">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Processing payment...</span>
                </div>
              )}
              
              <div id="paypal-button-container" className={isLoading ? 'opacity-50 pointer-events-none' : ''}></div>
              
              {!paypalLoaded && !isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading PayPal...</span>
                </div>
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-xs text-gray-500">
                By completing payment, you agree to our{' '}
                <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
              </p>
              
              <div className="flex justify-center items-center space-x-4 text-xs text-gray-400">
                <div>🔒 Secure payment</div>
                <div>💳 PayPal protected</div>
                <div>🛡️ No account required</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}