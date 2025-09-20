import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/services/authService'
import { BillingService } from '@/services/billingService'
import { LicenseService } from '@/services/licenseService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, password, company, selectedPlan = 'free' } = body

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Register user
    const user = await AuthService.register({
      firstName,
      lastName,
      email,
      password,
      company
    })

    // For free tier, create subscription and license immediately
    if (selectedPlan === 'free') {
      try {
        // Create free subscription
        const subscription = await BillingService.createSubscription(user.id, {
          plan: 'FREE'
        })

        return NextResponse.json({
          user,
          subscription,
          message: 'Account created successfully'
        })
      } catch (error) {
        console.error('Free subscription creation failed:', error)
        // User is created but subscription failed - they can retry in dashboard
        return NextResponse.json({
          user,
          message: 'Account created. Please complete setup in your dashboard.',
          warning: 'Subscription setup incomplete'
        })
      }
    }

    // For paid plans, return user info for payment flow
    return NextResponse.json({
      user,
      selectedPlan,
      message: 'Account created. Redirecting to payment...'
    })

  } catch (error) {
    console.error('Registration error:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
