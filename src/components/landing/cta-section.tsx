'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Shield } from 'lucide-react'
import Link from 'next/link'

export function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-6">
          <Shield className="w-4 h-4 mr-2" />
          Start your free trial today
        </div>
        
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
          Ready to Keep Your Code Private?
        </h2>
        
        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
          Join thousands of developers who trust our local MCP server for secure AI assistance. 
          No credit card required to start.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="lg" 
            className="border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 text-lg"
          >
            Contact Sales
          </Button>
        </div>
        
        <p className="text-blue-100 text-sm mt-6">
          14-day free trial • No setup fees • Cancel anytime
        </p>
      </div>
    </section>
  )
}