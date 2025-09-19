'use client'

import { Layout } from '@/components/layout/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react'

export default function SupportPage() {
  const faqItems = [
    {
      question: "How do I get started with the MCP server?",
      answer: "You can get started by downloading the latest version from the Downloads page and following our Quick Start guide in the documentation.",
      category: "Getting Started"
    },
    {
      question: "What are the rate limits for the API?",
      answer: "Rate limits depend on your subscription plan. Free plans have 1,000 requests per month, while paid plans have higher limits. Check your dashboard for current usage.",
      category: "API"
    },
    {
      question: "How do I manage my license keys?",
      answer: "You can create, view, and manage your license keys from the Licenses page in your dashboard. Each license key can be used on multiple devices up to your plan limit.",
      category: "Licenses"
    },
    {
      question: "How do I upgrade my subscription?",
      answer: "You can upgrade your subscription from the Billing page. Click on 'Manage Plan' to see available options and upgrade instantly.",
      category: "Billing"
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express) and PayPal. All payments are processed securely through Stripe.",
      category: "Billing"
    },
    {
      question: "How do I cancel my subscription?",
      answer: "You can cancel your subscription from the Billing page. Your access will continue until the end of your current billing period.",
      category: "Billing"
    }
  ]

  const supportChannels = [
    {
      title: "Email Support",
      description: "Get help via email within 24 hours",
      icon: Mail,
      availability: "24/7",
      responseTime: "Within 24 hours",
      action: "Send Email"
    },
    {
      title: "Live Chat",
      description: "Chat with our support team in real-time",
      icon: MessageCircle,
      availability: "Mon-Fri, 9AM-6PM EST",
      responseTime: "Immediate",
      action: "Start Chat"
    },
    {
      title: "Phone Support",
      description: "Speak directly with our support team",
      icon: Phone,
      availability: "Mon-Fri, 9AM-6PM EST",
      responseTime: "Immediate",
      action: "Call Now"
    }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">
            Get help with your MCP server integration and account.
          </p>
        </div>

        {/* Contact Support */}
        <div className="grid gap-6 md:grid-cols-3">
          {supportChannels.map((channel) => {
            const Icon = channel.icon
            return (
              <Card key={channel.title}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Icon className="h-5 w-5" />
                    <span>{channel.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{channel.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{channel.availability}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{channel.responseTime}</span>
                    </div>
                  </div>
                  <Button className="w-full">
                    {channel.action}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HelpCircle className="h-5 w-5" />
              <span>Frequently Asked Questions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">{item.question}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{item.answer}</p>
                      <span className="inline-block px-2 py-1 text-xs bg-muted rounded">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="What can we help you with?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select className="w-full p-2 border rounded-lg">
                    <option>General Question</option>
                    <option>Technical Issue</option>
                    <option>Billing Question</option>
                    <option>Feature Request</option>
                    <option>Bug Report</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  rows={6}
                  className="w-full p-2 border rounded-lg resize-none"
                  placeholder="Please provide as much detail as possible..."
                />
              </div>
              <Button type="submit">
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="text-sm">All systems operational</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
