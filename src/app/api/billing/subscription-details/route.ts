import { NextRequest, NextResponse } from 'next/server'
import { BillingService } from '@/services/billingService'
import { LicenseService } from '@/services/licenseService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Get subscription details
    const subscription = await BillingService.getSubscriptionById(subscriptionId)
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Get license key for this subscription
    const license = await LicenseService.getLicenseBySubscriptionId(subscriptionId)

    // Calculate trial info
    const trialInfo = subscription.trial_end ? {
      isTrialActive: new Date(subscription.trial_end) > new Date(),
      trialDaysLeft: Math.ceil((new Date(subscription.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    } : null

    return NextResponse.json({
      plan: subscription.plan.toUpperCase(),
      licenseKey: license?.key || '',
      subscriptionId: subscription.id,
      downloadUrl: 'https://releases.mcpserver.com/latest',
      setupGuideUrl: 'https://docs.mcpserver.com/setup',
      isTrialActive: trialInfo?.isTrialActive || false,
      trialDaysLeft: trialInfo?.trialDaysLeft || 0
    })

  } catch (error) {
    console.error('Failed to fetch subscription details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription details' },
      { status: 500 }
    )
  }
}