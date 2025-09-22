'use client'

import { Button } from '@/components/ui/button'
import { Check, Star, Zap, Crown } from 'lucide-react'
import Link from 'next/link'
import { useAnalytics } from '@/components/analytics/analytics'
import { useState } from 'react'

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying FileBridge with real projects",
    features: [
      "50 MCP calls per day",
      "Single project support",
      "Basic file watching",
      "Git status integration",
      "Community support",
      "No credit card required"
    ],
    cta: "Get Started Free",
    href: "/register?plan=free",
    popular: false,
    value: 0,
    badge: "Start Free",
    badgeColor: "bg-green-600",
    icon: Check
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For developers who need unlimited MCP calls",
    features: [
      "Unlimited MCP calls",
      "Multiple project support",
      "Real-time file watching",
      "Advanced Git integration",
      "Priority email support",
      "Usage analytics",
      "Commercial license"
    ],
    cta: "Start Pro Trial",
    href: "/register?plan=pro",
    popular: true,
    value: 19,
    badge: "Most Popular",
    badgeColor: "bg-purple-600",
    icon: Star
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "per month",
    description: "For teams that need advanced features and support",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Admin dashboard",
      "SSO integration",
      "Priority phone support",
      "Custom integrations",
      "SLA guarantees",
      "Dedicated success manager"
    ],
    cta: "Contact Sales",
    href: "/contact?plan=enterprise",
    popular: false,
    value: 99,
    badge: "Enterprise",
    badgeColor: "bg-gray-900",
    icon: Crown
  }
]

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false)
  const { trackConversion } = useAnalytics()

  const handlePlanClick = (planName: string, value: number) => {
    trackConversion.planSelected(planName.toLowerCase())
    
    // Track as begin_checkout for paid plans
    if (value > 0) {
      trackConversion.checkoutStarted(planName.toLowerCase(), value)
    }
  }

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.value === 0) return "$0"
    if (isAnnual) {
      const annualPrice = Math.floor(plan.value * 12 * 0.83) // 17% discount
      return `$${annualPrice}`
    }
    return plan.price
  }

  const getPeriod = (plan: typeof plans[0]) => {
    if (plan.value === 0) return "forever"
    if (isAnnual) return "per year"
    return plan.period
  }

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Start Free, Scale When Ready
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Experience FileBridge with 50 free MCP calls per day. No credit card required.
          </p>
          
          {/* Annual/Monthly toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span className={`text-sm ${!isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isAnnual ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAnnual ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Annual
            </span>
            {isAnnual && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Save 17%
              </span>
            )}
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const IconComponent = plan.icon
            return (
              <div key={index} className={`relative ${plan.popular ? 'lg:scale-105 lg:-mt-4' : ''}`}>
                {/* Badge */}
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className={`inline-flex items-center px-4 py-2 rounded-full text-white text-sm font-medium ${plan.badgeColor}`}>
                    <IconComponent className="w-4 h-4 mr-2" />
                    {plan.badge}
                  </div>
                </div>
                
                <div className={`h-full p-8 bg-white rounded-2xl shadow-xl ${
                  plan.popular ? 'border-2 border-purple-500 shadow-purple-100' : 
                  plan.value === 0 ? 'border-2 border-green-500 shadow-green-100' :
                  'border border-gray-200'
                } transition-all duration-300 hover:shadow-2xl`}>
                  
                  {/* Plan header */}
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-5xl font-bold text-gray-900">{getPrice(plan)}</span>
                      <span className="text-gray-600 ml-2">/{getPeriod(plan)}</span>
                      {isAnnual && plan.value > 0 && (
                        <div className="text-sm text-gray-500 mt-1">
                          <span className="line-through">${plan.value * 12}</span> billed annually
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600">{plan.description}</p>
                  </div>

                  {/* Special highlight for free plan */}
                  {plan.value === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-center text-green-800">
                        <Zap className="w-5 h-5 mr-2" />
                        <span className="font-semibold">50 MCP calls daily</span>
                      </div>
                      <p className="text-green-700 text-sm text-center mt-1">
                        Perfect for experiencing FileBridge's power
                      </p>
                    </div>
                  )}

                  {/* Features list */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                          plan.value === 0 ? 'text-green-600' :
                          plan.popular ? 'text-purple-600' : 'text-blue-600'
                        }`} />
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
                      className={`w-full py-4 text-lg font-semibold transition-all duration-300 ${
                        plan.value === 0 ? 'bg-green-600 hover:bg-green-700 border-green-600' :
                        plan.popular ? 'bg-purple-600 hover:bg-purple-700 border-purple-600' : 
                        'bg-gray-900 hover:bg-black border-gray-900'
                      }`}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>

                  {/* Additional info */}
                  <div className="text-center mt-4">
                    {plan.value === 0 ? (
                      <p className="text-sm text-gray-500">
                        No credit card • Instant setup • Upgrade anytime
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        14-day free trial • Cancel anytime
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Usage comparison */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
              How Many MCP Calls Do You Need?
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="p-6 bg-green-50 rounded-xl border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">50</div>
                <div className="text-sm text-gray-600 mb-3">calls per day</div>
                <div className="text-sm text-gray-700">
                  Perfect for:<br/>
                  • Learning FileBridge<br/>
                  • Small personal projects<br/>
                  • Occasional development
                </div>
              </div>
              <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">∞</div>
                <div className="text-sm text-gray-600 mb-3">unlimited calls</div>
                <div className="text-sm text-gray-700">
                  Perfect for:<br/>
                  • Daily development work<br/>
                  • Multiple active projects<br/>
                  • Professional use
                </div>
              </div>
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-gray-600 mb-2">∞</div>
                <div className="text-sm text-gray-600 mb-3">+ team features</div>
                <div className="text-sm text-gray-700">
                  Perfect for:<br/>
                  • Development teams<br/>
                  • Enterprise workflows<br/>
                  • Advanced integrations
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="text-center mt-12 space-y-4">
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">🔒</span>
              <span>Secure payments</span>
            </div>
            <div className="flex items-center">
              <span className="text-blue-500 mr-2">⚡</span>
              <span>Instant activation</span>
            </div>
            <div className="flex items-center">
              <span className="text-purple-500 mr-2">💾</span>
              <span>Privacy-first</span>
            </div>
            <div className="flex items-center">
              <span className="text-orange-500 mr-2">🛡️</span>
              <span>30-day guarantee</span>
            </div>
          </div>
        </div>

        {/* FAQ teaser */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Questions about FileBridge pricing or features?
          </p>
          <Link href="/faq" className="text-blue-600 hover:text-blue-700 font-medium">
            View Pricing FAQ →
          </Link>
        </div>
      </div>
    </section>
  )
}
