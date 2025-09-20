'use client'

import { Shield, Zap, Lock, Users, Settings, BarChart3 } from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: "Privacy-First Architecture",
    description: "Your code never leaves your machine. Work with Claude Desktop while keeping all files local and secure."
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Multi-factor authentication, license validation, and comprehensive audit logging protect your development environment."
  },
  {
    icon: Zap,
    title: "Instant Setup",
    description: "Get productive in minutes. Simple configuration connects Claude Desktop to your local MCP server seamlessly."
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Manage licenses across your development team with role-based access control and usage monitoring."
  },
  {
    icon: Settings,
    title: "Flexible Configuration",
    description: "Control exactly which directories Claude can access. Fine-grained permissions keep sensitive files protected."
  },
  {
    icon: BarChart3,
    title: "Usage Analytics",
    description: "Track productivity gains and monitor usage patterns with detailed analytics and reporting."
  }
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Local MCP Server?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get the productivity benefits of AI assistance without compromising on security or privacy
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="relative group">
              <div className="h-full p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200">
                {/* Icon */}
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center px-6 py-3 rounded-full bg-green-100 text-green-800 text-sm font-medium">
            <Shield className="w-4 h-4 mr-2" />
            Start with a free tier - no credit card required
          </div>
        </div>
      </div>
    </section>
  )
}