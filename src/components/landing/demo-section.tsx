'use client'

import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

export function DemoSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            See It In Action
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Watch how our MCP server integrates with Claude Desktop for secure, local AI assistance
          </p>
        </div>

        {/* Demo video container */}
        <div className="relative max-w-4xl mx-auto">
          <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
            {/* Video placeholder */}
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <Button size="lg" className="rounded-full w-20 h-20 mb-4">
                  <Play className="w-8 h-8" />
                </Button>
                <p className="text-white text-lg">Watch Demo Video</p>
                <p className="text-gray-400 text-sm">3 min overview</p>
              </div>
            </div>
            
            {/* Video controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h3 className="font-semibold">Setting up your Local MCP Server</h3>
                  <p className="text-sm text-gray-300">From installation to first AI conversation</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Quick Installation</h3>
            <p className="text-gray-600">Setup takes less than 5 minutes with our automated installer</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Configure Access</h3>
            <p className="text-gray-600">Choose which directories Claude can access with fine-grained controls</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-blue-600 font-bold">3</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Start Coding</h3>
            <p className="text-gray-600">Get AI assistance on your code while keeping everything local</p>
          </div>
        </div>
      </div>
    </section>
  )
}