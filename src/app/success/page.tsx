'use client'

import { Suspense } from 'react'
import { SuccessContent } from '@/components/success/success-content'
import { Layout } from '@/components/layout/layout'

export default function SuccessPage() {
  return (
    <Layout>
      <Suspense fallback={<div>Loading...</div>}>
        <SuccessContent />
      </Suspense>
    </Layout>
  )
}