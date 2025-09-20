'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, Zap, Lock } from 'lucide-react'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />
      
      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-8">
            <Shield className="w-4 h-4 mr-2" />
            Privacy-First AI Development
          </div>

          {/* Headline */}
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Your AI Assistant,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Your Data
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Keep Claude Desktop productive while your code stays private. Our local MCP server gives you 
            AI assistance without sending your files to the cloud.
          </p>

          {/* Value props */}
          <div className="flex flex-wrap justify-center items-center gap-6 mb-10 text-sm text-gray-600">
            <div className="flex items-center">
              <Lock className="w-4 h-4 mr-2 text-green-600" />
              Code Never Leaves Your Machine
            </div>
            <div className="flex items-center">
              <Zap className="w-4 h-4 mr-2 text-blue-600" />
              Works with Claude Desktop
            </div>
            <div className="flex items-center">
              <Shield className="w-4 h-4 mr-2 text-purple-600" />
              Enterprise Security
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register">
              <Button size="lg" className="px-8 py-4 text-lg">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
              Watch Demo
            </Button>
          </div>

          {/* Social proof */}
          <p className="text-sm text-gray-500">
            Trusted by developers at startups and enterprises
          </p>
        </div>
      </div>

      {/* Hero illustration/demo */}
      <div className="relative max-w-5xl mx-auto mt-16 px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Browser mockup */}
          <div className="bg-white rounded-lg shadow-2xl border overflow-hidden">
            {/* Browser header */}
            <div className="bg-gray-100 px-4 py-3 flex items-center">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="flex-1 text-center">
                <div className="bg-white rounded px-3 py-1 text-sm text-gray-600 inline-block">
                  Claude Desktop with MCP Server
                </div>
              </div>
            </div>
            
            {/* Chat interface mockup */}
            <div className="p-6 h-96 bg-gray-50">
              <div className="space-y-4">
                <div className="flex">
                  <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-md">
                    Can you help me review the files in my React project?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-white rounded-lg px-4 py-2 max-w-md shadow-sm border">
                    I can see your project files locally. You have 23 React components, 
                    5 test files, and your main App.tsx. Would you like me to review 
                    any specific components?
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-md">
                    Check my authentication components for security issues
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-white rounded-lg px-4 py-2 max-w-md shadow-sm border">
                    <div className="flex items-center text-green-600 mb-2">
                      <Shield className="w-4 h-4 mr-2" />
                      Files accessed locally - no data sent to cloud
                    </div>
                    Reviewing your authentication components... I found proper JWT 
                    validation and secure password hashing. All looks good!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}