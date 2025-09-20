'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Analytics events for conversion tracking
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, properties)
  }
  
  // PostHog (if used)
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(eventName, properties)
  }
  
  // Console for development
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics Event:', eventName, properties)
  }
}

// Page view tracking
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
      page_path: url,
    })
  }
}

// Conversion funnel events
export const trackConversion = {
  landingPageView: () => trackEvent('landing_page_view'),
  
  planSelected: (plan: string) => trackEvent('plan_selected', { 
    plan,
    currency: 'USD',
    value: plan === 'pro' ? 19 : plan === 'enterprise' ? 99 : 0
  }),
  
  registrationStarted: (plan: string) => trackEvent('registration_started', { plan }),
  
  registrationCompleted: (plan: string, userId: string) => trackEvent('registration_completed', { 
    plan, 
    user_id: userId 
  }),
  
  checkoutStarted: (plan: string, value: number) => trackEvent('begin_checkout', {
    currency: 'USD',
    value,
    items: [{
      item_id: plan,
      item_name: `MCP Server ${plan}`,
      category: 'subscription',
      quantity: 1,
      price: value
    }]
  }),
  
  purchaseCompleted: (plan: string, value: number, transactionId: string) => trackEvent('purchase', {
    transaction_id: transactionId,
    value,
    currency: 'USD',
    items: [{
      item_id: plan,
      item_name: `MCP Server ${plan}`,
      category: 'subscription',
      quantity: 1,
      price: value
    }]
  }),
  
  mcpSetupCompleted: (plan: string) => trackEvent('mcp_setup_completed', { plan }),
  
  firstMcpUse: (plan: string) => trackEvent('first_mcp_use', { plan })
}

// Main analytics component
export function Analytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Track page views
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    trackPageView(url)
  }, [pathname, searchParams])

  return null
}

// Hook for easy analytics usage in components
export function useAnalytics() {
  return {
    track: trackEvent,
    trackConversion
  }
}

// Google Analytics script component
export function GoogleAnalytics() {
  if (!process.env.NEXT_PUBLIC_GA_ID) return null

  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  )
}