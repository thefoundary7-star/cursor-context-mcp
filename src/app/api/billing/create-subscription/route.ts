import { NextRequest, NextResponse } from 'next/server'
import { BillingService } from '@/services/billingService'
import { LicenseService } from '@/services/licenseService'
import { emailService } from '@/services/email/emailService'
import { trackConversion } from '@/components/analytics/analytics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, plan } = body

    // Validate required fields
    if (!userId || !plan) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and plan' },
        { status: 400 }
      )
    }

    // Validate plan
    const validPlans = ['FREE', 'PRO', 'ENTERPRISE']
    if (!validPlans.includes(plan.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid plan specified' },
        { status: 400 }
      )
    }

    // Create subscription using your billing service
    const subscriptionResult = await BillingService.createSubscription(userId, {
      plan: plan.toUpperCase()
    })

    // Generate license key for the user
    const licenseKey = await LicenseService.generateLicense({
      userId,
      plan: plan.toUpperCase(),
      subscriptionId: subscriptionResult.subscription.id
    })

    // Get user details for email
    const user = await BillingService.getUserById(userId)
    
    // Send welcome email with license key
    const emailSent = await emailService.sendLicenseKey({
      firstName: user.firstName,
      email: user.email,
      licenseKey,
      plan: plan.toUpperCase(),
      subscriptionId: subscriptionResult.subscription.id,
      downloadUrl: 'https://releases.mcpserver.com/latest'
    })

    // Send welcome sequence
    await emailService.sendWelcomeSequence(user.email, user.firstName, plan.toUpperCase())

    // Track conversion in analytics
    const planValue = plan === 'PRO' ? 19 : plan === 'ENTERPRISE' ? 99 : 0
    
    // For trials, track as conversion but with trial flag
    if (subscriptionResult.trialInfo?.isTrialActive) {
      // Track trial start
      if (typeof window !== 'undefined') {
        trackConversion.checkoutStarted(plan, planValue)
      }
    } else {
      // Track immediate purchase
      if (typeof window !== 'undefined') {
        trackConversion.purchaseCompleted(plan, planValue, subscriptionResult.subscription.id)
      }
    }

    return NextResponse.json({
      subscription: subscriptionResult.subscription,
      licenseKey,
      trialInfo: subscriptionResult.trialInfo,
      emailSent,
      downloadUrl: 'https://releases.mcpserver.com/latest',
      setupGuideUrl: 'https://docs.mcpserver.com/setup',
      message: 'Subscription created successfully. Check your email for license key and setup instructions.'
    })

  } catch (error) {
    console.error('Subscription creation error:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('already has an active subscription')) {
        return NextResponse.json(
          { error: 'User already has an active subscription' },
          { status: 409 }
        )
      }
      
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      if (error.message.includes('payment required')) {
        // Return client secret for Stripe payment
        return NextResponse.json({
          requiresPayment: true,
          clientSecret: error.message.split(':')[1], // Extract client secret
          message: 'Payment required to complete subscription'
        })
      }
    }

    return NextResponse.json(
      { error: 'Failed to create subscription. Please try again.' },
      { status: 500 }
    )
  }
}