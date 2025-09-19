'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Header } from './header'
import { Sidebar } from './sidebar'
import { Toaster } from '@/components/ui/toaster'
import { Loader2 } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
  }, [])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // For unauthenticated users, show full-width layout
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Toaster />
      </div>
    )
  }

  // For authenticated users, show dashboard layout with sidebar
  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={toggleMenu} isMenuOpen={isMenuOpen} />
      <div className="flex">
        <Sidebar isOpen={isMenuOpen} onToggle={toggleMenu} />
        
        {/* Overlay for mobile */}
        {isMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={toggleMenu}
          />
        )}
        
        <main className="flex-1 lg:ml-64">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
