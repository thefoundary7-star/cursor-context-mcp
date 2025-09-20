'use client'

import { Layout } from '@/components/layout/layout'
import { RegisterForm } from '@/components/auth/register-form'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function RegisterContent() {
  const searchParams = useSearchParams()
  const selectedPlan = searchParams?.get('plan') || 'free'

  const planDetails = {
    free: { name: 'Free', price: '$0', description: 'Perfect for trying out MCP' },
    pro: { name: 'Pro', price: '$19/month', description: 'For professional developers' },
    enterprise: { name: 'Enterprise', price: '$99/month', description: 'Advanced security and support' }
  }

  const plan = planDetails[selectedPlan as keyof typeof planDetails] || planDetails.free

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">M</span>
            </div>
            <h1 className="text-3xl font-bold">Get Started</h1>
            <p className="text-muted-foreground mt-2">
              Create your MCP Server account
            </p>
            
            {/* Plan selection display */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Selected Plan</div>
              <div className="text-lg font-bold text-blue-900">{plan.name}</div>
              <div className="text-sm text-blue-700">{plan.price}</div>
              <div className="text-xs text-blue-600">{plan.description}</div>
            </div>
          </div>
          
          <RegisterForm selectedPlan={selectedPlan} />
        </div>
      </div>
    </Layout>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterContent />
    </Suspense>
  )
}
