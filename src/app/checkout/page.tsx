'use client'

import { Suspense } from 'react'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { Layout } from '@/components/layout/layout'

export default function CheckoutPage() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Complete Your Purchase</h1>
            <p className="text-gray-600 mt-2">Start your 14-day free trial</p>
          </div>
          
          <Suspense fallback={<div>Loading checkout...</div>}>
            <CheckoutForm />
          </Suspense>
        </div>
      </div>
    </Layout>
  )
}
