'use client'

import { Button } from '@/components/ui/button'
import { Check, Star } from 'lucide-react'
import Link from 'next/link'
import { useAnalytics } from '@/components/analytics/analytics'

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out the MCP server",
    features: [
      "1 MCP server instance",
      "Basic file access",
      "Community support",
      "Standard security",
      "Personal use only"
    ],
    cta: "Start Free",
    href: "/register?plan=free",
    popular: false,
    value: 0
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For professional developers and small teams",
    features: [
      "5 MCP server instances",
      "Advanced file operations",
      "Git integration",
      "Priority email support",
      "Usage analytics",
      "Team management",
      "Commercial use allowed"
    ],
    cta: "Start Pro Trial",
    href: "/register?plan=pro",
    popular: true,
    value: 19
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "per month",
    description: "For teams that need advanced security and support",
    features: [
      "Unlimited MCP servers",
      "Advanced security features",
      "Multi-factor authentication",
      "SSO integration",
      "Priority phone support",
      "Custom integrations",
      "SLA guarantees",
      "Dedicated account manager"
    ],
    cta: "Contact Sales",
    href: "/contact?plan=enterprise",
    popular: false,
    value: 99
  }
]

export function PricingSection() {
  const { trackConversion } = useAnalytics()

  const handlePlanClick = (planName: string, value: number) => {
    trackConversion.planSelected(planName.toLowerCase())
    
    // Track as begin_checkout for paid plans
    if (value > 0) {
      trackConversion.checkoutStarted(planName.toLowerCase(), value)
    }
  }

  return (
    <section className="py-20 bg-gray-50" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Start free and scale as your team grows. All plans include core MCP functionality.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div key={index} className={`relative ${plan.popular ? 'lg:scale-105' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium">
                    <Star className="w-4 h-4 mr-2" />
                    Most Popular
                  </div>
                </div>
              )}
              
              <div className={`h-full p-8 bg-white rounded-2xl shadow-lg ${plan.popular ? 'border-2 border-blue-600' : 'border border-gray-200'}`}>
                {/* Plan header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-2">/{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>

                {/* Features list */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <Link 
                  href={plan.href} 
                  className="block"
                  onClick={() => handlePlanClick(plan.name, plan.value)}
                >
                  <Button 
                    className={`w-full py-3 ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </Link>

                {/* Trial info for paid plans */}
                {plan.value > 0 && (
                  <p className="text-center text-sm text-gray-500 mt-3">
                    14-day free trial • No credit card required
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Additional info */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-gray-600">
            All plans include 14-day free trial • No setup fees • Cancel anytime
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
            <div>💳 Secure payments with Stripe</div>
            <div>🔒 SOC 2 compliant</div>
            <div>🛡️ 99.9% uptime SLA</div>
          </div>
        </div>

        {/* Money back guarantee */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <h3 className="font-semibold text-green-900 mb-2">30-Day Money Back Guarantee</h3>
            <p className="text-green-700 text-sm">
              Not satisfied? Get a full refund within 30 days, no questions asked.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}