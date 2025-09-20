'use client'

import { Shield, Github, Twitter, Mail } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">MCP Server</span>
            </Link>
            <p className="text-gray-400 mb-4">
              Privacy-first AI development tools for modern developers.
            </p>
            <div className="flex space-x-4">
              <Link href="https://github.com" className="text-gray-400 hover:text-white">
                <Github className="w-5 h-5" />
              </Link>
              <Link href="https://twitter.com" className="text-gray-400 hover:text-white">
                <Twitter className="w-5 h-5" />
              </Link>
              <Link href="mailto:support@mcpserver.dev" className="text-gray-400 hover:text-white">
                <Mail className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="#features" className="hover:text-white">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
              <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
              <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
              <li><Link href="/support" className="hover:text-white">Support</Link></li>
              <li><Link href="/status" className="hover:text-white">Status</Link></li>
              <li><Link href="/security" className="hover:text-white">Security</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm mb-4 md:mb-0">
            © 2025 MCP Server. All rights reserved.
          </div>
          <div className="flex space-x-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-white">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}