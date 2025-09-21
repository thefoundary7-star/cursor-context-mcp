import { NextRequest, NextResponse } from 'next/server'
import { PayPalService } from '@/services/paypalService'
import { LicenseService } from '@/services/licenseService'
import { emailService } from '@/services/email/emailService'
import { BillingService } from '@/services/billingService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, plan, paypalOrderId } = body

    // Validate required fields
    if (!userId || !plan || !paypalOrderId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, plan, and paypalOrderId' },
        { status: 400 }
      )
    }

    // Verify PayPal payment
    const paypalPayment = await PayPalService.captureOrder(paypalOrderId)
    
    if (paypalPayment.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    // Create subscription in your system
    const subscription = await BillingService.createSubscription(userId, {
      plan: plan.toUpperCase(),
      paypalOrderId,
      paypalPayerId: paypalPayment.payer.payer_id,
      amount: paypalPayment.purchase_units[0].amount.value
    })

    // Generate license key
    const licenseKey = await LicenseService.generateLicense({
      userId,
      plan: plan.toUpperCase(),
      subscriptionId: subscription.id
    })

    // Get user details for email
    const user = await BillingService.getUserById(userId)
    
    // Send welcome email with license key
    const emailSent = await emailService.sendLicenseKey({
      firstName: user.firstName,
      email: user.email,
      licenseKey,
      plan: plan.toUpperCase(),
      subscriptionId: subscription.id,
      downloadUrl: 'https://releases.mcpserver.com/latest'
    })

    return NextResponse.json({
      subscription,
      licenseKey,
      emailSent,
      downloadUrl: 'https://releases.mcpserver.com/latest',
      setupGuideUrl: 'https://docs.mcpserver.com/setup',
      message: 'Payment successful. Check your email for license key and setup instructions.'
    })

  } catch (error) {
    console.error('PayPal subscription creation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to process payment. Please try again.' },
      { status: 500 }
    )
  }
}