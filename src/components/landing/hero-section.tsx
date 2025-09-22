'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Shield, Zap, Lock, Star, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-blue-50" />
      
      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Free tier badge */}
          <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-green-100 to-blue-100 text-gray-800 text-sm font-medium mb-8 border border-green-200">
            <Star className="w-4 h-4 mr-2 text-green-600" />
            Start FREE - 50 MCP calls daily, no credit card required
          </div>

          {/* Headline */}
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Give Claude Desktop{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
              Project Context
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            FileBridge connects Claude Desktop to your codebase while keeping everything private. 
            Experience intelligent file awareness with 50 free calls daily.
          </p>

          {/* Value props */}
          <div className="flex flex-wrap justify-center items-center gap-6 mb-10 text-sm text-gray-600">
            <div className="flex items-center">
              <Lock className="w-4 h-4 mr-2 text-green-600" />
              100% Local Processing
            </div>
            <div className="flex items-center">
              <Zap className="w-4 h-4 mr-2 text-blue-600" />
              Real-time File Watching
            </div>
            <div className="flex items-center">
              <Shield className="w-4 h-4 mr-2 text-purple-600" />
              Enterprise Security
            </div>
          </div>

          {/* Free tier highlight */}
          <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-6 mb-10 max-w-md mx-auto">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Free Tier Includes</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                50 MCP calls per day
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Single project support
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                File watching & Git integration
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                No credit card required
              </li>
            </ul>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register?plan=free">
              <Button size="lg" className="px-8 py-4 text-lg bg-green-600 hover:bg-green-700">
                Start Free Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-blue-300 text-blue-700 hover:bg-blue-50">
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Join thousands of developers using FileBridge
            </p>
            <div className="flex justify-center items-center space-x-8 text-xs text-gray-400">
              <div>No spam, ever</div>
              <div>•</div>
              <div>Instant setup</div>
              <div>•</div>
              <div>Upgrade anytime</div>
            </div>
          </div>
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
                  Claude Desktop + FileBridge MCP
                </div>
              </div>
            </div>
            
            {/* Chat interface mockup */}
            <div className="p-6 h-96 bg-gray-50">
              <div className="space-y-4">
                <div className="flex">
                  <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-md">
                    Can you help me review the authentication logic in my React app?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-white rounded-lg px-4 py-2 max-w-md shadow-sm border">
                    <div className="flex items-center text-green-600 mb-2 text-sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      FileBridge: Accessing local files (calls remaining: 49/50)
                    </div>
                    I can see your auth components. Looking at src/auth/AuthProvider.tsx 
                    and src/hooks/useAuth.ts - the JWT handling looks secure with proper 
                    token validation and refresh logic.
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-md">
                    What about the login form validation?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-white rounded-lg px-4 py-2 max-w-md shadow-sm border">
                    <div className="flex items-center text-green-600 mb-2 text-sm">
                      <Lock className="w-4 h-4 mr-2" />
                      Local file access - no data leaves your machine
                    </div>
                    Your LoginForm.tsx has good validation with email format checking 
                    and password strength requirements. The form sanitizes inputs properly.
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Usage indicator */}
          <div className="absolute -bottom-4 -right-4 bg-green-600 text-white rounded-lg px-4 py-2 text-sm shadow-lg">
            <div className="flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              48/50 calls remaining today
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
