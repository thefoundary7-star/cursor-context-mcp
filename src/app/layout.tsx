import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Analytics, GoogleAnalytics } from '@/components/analytics/analytics'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MCP Server - Privacy-First AI Development Tools',
  description: 'Secure MCP server for Claude Desktop. Keep your code private while enabling powerful AI assistance. Start your free trial today.',
  keywords: 'MCP server, Claude Desktop, AI development, privacy-first, code security, local AI',
  openGraph: {
    title: 'MCP Server - Privacy-First AI Development Tools',
    description: 'Secure MCP server for Claude Desktop. Keep your code private while enabling powerful AI assistance.',
    type: 'website',
    url: 'https://mcpserver.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCP Server - Privacy-First AI Development Tools',
    description: 'Secure MCP server for Claude Desktop. Keep your code private while enabling powerful AI assistance.',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleAnalytics />
      </head>
      <body className={inter.className}>
        <Providers>
          <Analytics />
          {children}
        </Providers>
      </body>
    </html>
  )
}