'use client'

import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    content: "Finally, I can use Claude Desktop for code review without worrying about my proprietary code being sent to the cloud. The setup was surprisingly simple.",
    author: "Sarah Chen",
    role: "Senior Developer",
    company: "TechStart Inc",
    rating: 5
  },
  {
    content: "Our security team was hesitant about AI coding tools, but the local MCP server convinced them. We get the productivity benefits with complete data control.",
    author: "Marcus Rodriguez",
    role: "Engineering Manager",
    company: "SecureCode Corp",
    rating: 5
  },
  {
    content: "The license management is perfect for our distributed team. Everyone gets AI assistance while keeping client code confidential.",
    author: "Lisa Thompson",
    role: "CTO",
    company: "Consulting Solutions",
    rating: 5
  }
]

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Developers Worldwide
          </h2>
          <p className="text-xl text-gray-600">
            See what teams are saying about our privacy-first approach
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-lg">
              {/* Rating */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>

              {/* Quote */}
              <div className="mb-6">
                <Quote className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-gray-700 leading-relaxed">
                  "{testimonial.content}"
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                  <div className="text-sm text-gray-500">{testimonial.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 text-center">
          <div>
            <div className="text-3xl font-bold text-gray-900">500+</div>
            <div className="text-gray-600">Active Developers</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">50+</div>
            <div className="text-gray-600">Enterprise Customers</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">99.9%</div>
            <div className="text-gray-600">Uptime</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">24/7</div>
            <div className="text-gray-600">Support</div>
          </div>
        </div>
      </div>
    </section>
  )
}