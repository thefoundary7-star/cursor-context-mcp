'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Star, Crown, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const plans = {
  free: {
    name: 'FileBridge Free',
    price: '$0',
    period: 'forever',
    description: '50 MCP calls per day, perfect for trying FileBridge',
    features: [
      '50 MCP calls per day',
      'Single project support',
      'Basic file watching',
      'Git integration',
      'Community support'
    ],
    icon: CheckCircle,
    color: 'green'
  },
  pro: {
    name: 'FileBridge Pro',
    price: '$19',
    period: 'per month',
    description: 'Unlimited MCP calls for professional developers',
    features: [
      'Unlimited MCP calls',
      'Multiple projects',
      'Real-time file watching',
      'Priority support',
      'Usage analytics'
    ],
    icon: Star,
    color: 'purple'
  },
  enterprise: {
    name: 'FileBridge Enterprise',
    price: '$99',
    period: 'per month',
    description: 'Advanced features for teams and organizations',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Admin dashboard',
      'SSO integration',
      'Custom integrations'
    ],
    icon: Crown,
    color: 'gray'
  }
}

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const selectedPlan = searchParams.get('plan') || 'free'
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')

  const plan = plans[selectedPlan] || plans.free
  const IconComponent = plan.icon

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (selectedPlan === 'free') {
        // Handle free tier registration
        const response = await fetch('/api/auth/register-free', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        })

        const data = await response.json()

        if (data.success) {
          setSuccess(true)
          setLicenseKey(data.licenseKey)
        } else {
          setError(data.error || 'Registration failed')
        }
      } else {
        // Handle paid plan registration - redirect to checkout
        const response = await fetch('/api/subscriptions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            productId: selectedPlan === 'pro' ? process.env.NEXT_PUBLIC_DODO_PRO_PRODUCT_ID : process.env.NEXT_PUBLIC_DODO_ENTERPRISE_PRODUCT_ID,
            planName: plan.name
          }),
        })

        const data = await response.json()

        if (data.success) {
          // Redirect to payment
          window.location.href = data.paymentUrl
        } else {
          setError(data.error || 'Checkout failed')
        }
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success && selectedPlan === 'free') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to FileBridge!
          </h1>
          
          <p className="text-gray-600 mb-6">
            Your free account is ready. You get 50 MCP calls per day.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Your License Key:</p>
            <div className="bg-white border rounded px-3 py-2 font-mono text-sm break-all">
              {licenseKey}
            </div>
          </div>
          
          <div className="space-y-3 mb-6">
            <Button className="w-full" asChild>
              <Link href="/docs/setup">
                Get Started - Setup Guide
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard">
                Go to Dashboard
              </Link>
            </Button>
          </div>
          
          <p className="text-xs text-gray-500">
            We've sent your license key to {email}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              FileBridge
            </Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
              Change Plan
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Plan Details */}
          <div className="lg:sticky lg:top-8">
            <div className={`p-8 rounded-2xl border-2 ${
              plan.color === 'green' ? 'border-green-200 bg-green-50' :
              plan.color === 'purple' ? 'border-purple-200 bg-purple-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-full mr-4 ${
                  plan.color === 'green' ? 'bg-green-100' :
                  plan.color === 'purple' ? 'bg-purple-100' :
                  'bg-gray-100'
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    plan.color === 'green' ? 'text-green-600' :
                    plan.color === 'purple' ? 'text-purple-600' :
                    'text-gray-600'
                  }`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-gray-600">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-600 ml-2">/{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className={`w-5 h-5 mr-3 ${
                      plan.color === 'green' ? 'text-green-600' :
                      plan.color === 'purple' ? 'text-purple-600' :
                      'text-gray-600'
                    }`} />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {selectedPlan === 'free' && (
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2">Free Tier Benefits</h4>
                  <p className="text-green-700 text-sm">
                    Experience FileBridge's full power with 50 daily MCP calls. 
                    No credit card required, upgrade anytime when you need more.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {selectedPlan === 'free' ? 'Start Free' : 'Get Started'}
            </h1>
            <p className="text-gray-600 mb-8">
              {selectedPlan === 'free' 
                ? 'Create your free FileBridge account in seconds'
                : 'Start your 14-day free trial'
              }
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email" className="text-base font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="mt-2 h-12 text-base"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className={`w-full h-12 text-lg font-semibold ${
                  plan.color === 'green' ? 'bg-green-600 hover:bg-green-700' :
                  plan.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' :
                  'bg-gray-900 hover:bg-black'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {isLoading 
                  ? 'Processing...' 
                  : selectedPlan === 'free'
                    ? 'Create Free Account'
                    : 'Start Free Trial'
                }
              </Button>

              <div className="text-center space-y-2">
                <p className="text-xs text-gray-500">
                  {selectedPlan === 'free'
                    ? 'By creating an account, you agree to our Terms of Service and Privacy Policy.'
                    : 'No credit card required for trial. Cancel anytime during the trial period.'
                  }
                </p>
                {selectedPlan !== 'free' && (
                  <p className="text-xs text-gray-500">
                    After your 14-day trial, you'll be charged {plan.price}/{plan.period}.
                  </p>
                )}
              </div>
            </form>

            {/* Alternative plans */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center mb-4">
                Looking for a different plan?
              </p>
              <div className="flex justify-center space-x-4">
                {Object.entries(plans).map(([key, p]) => (
                  key !== selectedPlan ? (
                    <Link
                      key={key}
                      href={`/register?plan=${key}`}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      {p.name}
                    </Link>
                  ) : null
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
