'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Shield, Check, Smartphone, Wallet } from 'lucide-react'

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

export function EnhancedPayPalCheckout() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const plan = searchParams?.get('plan') || 'pro'
  const userId = searchParams?.get('userId')
  
  const planDetails = PLAN_DETAILS[plan as keyof typeof PLAN_DETAILS]

  useEffect(() => {
    loadPayPalSDK()
  }, [plan, userId])

  const loadPayPalSDK = () => {
    if (window.paypal) {
      setPaypalLoaded(true)
      renderPayPalButtons()
      return
    }

    const script = document.createElement('script')
    // Enhanced SDK with multiple payment methods
    script.src = `https://www.paypal.com/sdk/js?` +
      `client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&` +
      `currency=USD&` +
      `intent=capture&` +
      `vault=true&` +
      `components=buttons,funding-eligibility&` +
      `enable-funding=venmo,paylater,card&` +
      `disable-funding=credit`
    
    script.onload = () => {
      setPaypalLoaded(true)
      detectAvailablePaymentMethods()
      renderPayPalButtons()
    }
    
    script.onerror = () => {
      setError('Failed to load PayPal. Please refresh and try again.')
    }
    
    document.body.appendChild(script)
  }

  const detectAvailablePaymentMethods = () => {
    if (!window.paypal?.getFundingSources) return

    const availableMethods = []
    
    // Check available funding sources
    const fundingSources = window.paypal.getFundingSources()
    
    if (fundingSources.includes(window.paypal.FUNDING.PAYPAL)) {
      availableMethods.push('PayPal')
    }
    if (fundingSources.includes(window.paypal.FUNDING.CARD)) {
      availableMethods.push('Credit/Debit Cards')
    }
    if (fundingSources.includes(window.paypal.FUNDING.VENMO)) {
      availableMethods.push('Venmo')
    }
    if (fundingSources.includes(window.paypal.FUNDING.PAYLATER)) {
      availableMethods.push('Pay Later')
    }

    setPaymentMethods(availableMethods)
  }

  const renderPayPalButtons = () => {
    if (!window.paypal || !paypalLoaded) return

    const container = document.getElementById('paypal-button-container')
    if (container) {
      container.innerHTML = ''
    }

    window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
      
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'subscribe',
        height: 45
      },

      createOrder: (data: any, actions: any) => {
        // Track checkout initiation
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'begin_checkout', {
            currency: 'USD',
            value: planDetails.price,
            items: [{
              item_id: plan,
              item_name: `MCP Server ${planDetails.name}`,
              category: 'subscription',
              quantity: 1,
              price: planDetails.price
            }]
          })
        }

        return fetch('/api/paypal/create-subscription-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            amount: planDetails.price,
            userId
          })
        })
        .then(response => response.json())
        .then(data => data.orderID)
      },

      onApprove: async (data: any, actions: any) => {
        try {
          setIsLoading(true)
          setError('')

          // Capture the subscription payment
          const response = await fetch('/api/paypal/capture-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderID: data.orderID,
              userId,
              plan
            })
          })

          if (!response.ok) {
            throw new Error('Failed to process subscription')
          }

          const result = await response.json()

          // Track successful subscription
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'purchase', {
              transaction_id: result.subscription.id,
              value: planDetails.price,
              currency: 'USD',
              items: [{
                item_id: plan,
                item_name: `MCP Server ${planDetails.name}`,
                category: 'subscription',
                quantity: 1,
                price: planDetails.price
              }]
            })
          }

          // Redirect to success page
          router.push(`/success?subscription_id=${result.subscription.id}&plan=${plan}`)

        } catch (error) {
          console.error('Subscription processing error:', error)
          setError(error instanceof Error ? error.message : 'Subscription failed')
        } finally {
          setIsLoading(false)
        }
      },

      onError: (err: any) => {
        console.error('PayPal Error:', err)
        setError('Payment failed. Please try again.')
      },

      onCancel: () => {
        setError('Payment was cancelled. You can try again anytime.')
      }
    }).render('#paypal-button-container')

    // Render additional payment method buttons if available
    renderAlternativePaymentButtons()
  }

  const renderAlternativePaymentButtons = () => {
    // Venmo button
    if (window.paypal.isFundingEligible(window.paypal.FUNDING.VENMO)) {
      window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.VENMO,
        style: {
          layout: 'horizontal',
          color: 'blue',
          shape: 'rect',
          height: 45
        },
        createOrder: (data: any, actions: any) => {
          return fetch('/api/paypal/create-subscription-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan,
              amount: planDetails.price,
              userId,
              fundingSource: 'venmo'
            })
          })
          .then(response => response.json())
          .then(data => data.orderID)
        },
        onApprove: async (data: any) => {
          // Same approval handler as PayPal
          return handlePaymentApproval(data)
        }
      }).render('#venmo-button-container')
    }

    // Pay Later button
    if (window.paypal.isFundingEligible(window.paypal.FUNDING.PAYLATER)) {
      window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.PAYLATER,
        style: {
          layout: 'horizontal',
          color: 'gold',
          shape: 'rect',
          height: 45
        },
        createOrder: (data: any, actions: any) => {
          return fetch('/api/paypal/create-subscription-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan,
              amount: planDetails.price,
              userId,
              fundingSource: 'paylater'
            })
          })
          .then(response => response.json())
          .then(data => data.orderID)
        },
        onApprove: async (data: any) => {
          return handlePaymentApproval(data)
        }
      }).render('#paylater-button-container')
    }
  }

  const handlePaymentApproval = async (data: any) => {
    // Unified approval handler for all payment methods
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/paypal/capture-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderID: data.orderID,
          userId,
          plan
        })
      })

      const result = await response.json()
      router.push(`/success?subscription_id=${result.subscription.id}&plan=${plan}`)
      
    } catch (error) {
      setError('Payment processing failed. Please try again.')
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
            <Badge variant="secondary">Monthly Subscription</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="text-3xl font-bold">
              ${planDetails.price}
              <span className="text-lg font-normal text-gray-600">/{planDetails.period}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Automatic monthly billing. Cancel anytime.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">What's included:</h4>
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
                  Secure & Flexible Payment
                </div>
                <div className="text-xs text-blue-700">
                  Multiple payment options. No account required for cards.
                </div>
              </div>
            </div>
          </div>

          {paymentMethods.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Available payment methods:</p>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((method, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {method}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Options */}
      <Card>
        <CardHeader>
          <CardTitle>Choose Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Subscription includes:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Instant license key delivery via email</li>
                <li>• Automatic monthly billing (cancel anytime)</li>
                <li>• Full MCP server access</li>
                <li>• Priority customer support</li>
              </ul>
            </div>

            {/* Main PayPal Button */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Pay with PayPal or Card:</h4>
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Processing payment...</span>
                </div>
              )}
              
              <div id="paypal-button-container" className={isLoading ? 'opacity-50 pointer-events-none' : ''}></div>
            </div>

            {/* Alternative Payment Methods */}
            <div className="space-y-3">
              <div id="venmo-button-container"></div>
              <div id="paylater-button-container"></div>
            </div>
              
            {!paypalLoaded && !isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading payment options...</span>
              </div>
            )}

            <div className="text-center space-y-2 pt-4 border-t">
              <p className="text-xs text-gray-500">
                By subscribing, you agree to our{' '}
                <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
              </p>
              
              <div className="flex justify-center items-center space-x-4 text-xs text-gray-400">
                <div className="flex items-center">
                  <Shield className="w-3 h-3 mr-1" />
                  Secure
                </div>
                <div className="flex items-center">
                  <CreditCard className="w-3 h-3 mr-1" />
                  No account required
                </div>
                <div className="flex items-center">
                  <Smartphone className="w-3 h-3 mr-1" />
                  Mobile optimized
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}