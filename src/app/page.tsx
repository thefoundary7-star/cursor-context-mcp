import { redirect } from 'next/navigation'
import { Layout } from '@/components/layout/layout'
import { LoginForm } from '@/components/auth/login-form'

export default function HomePage() {
  // This will be handled by middleware or auth check
  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">M</span>
            </div>
            <h1 className="text-3xl font-bold">Welcome to MCP SaaS</h1>
            <p className="text-muted-foreground mt-2">
              Manage your MCP server subscriptions and licenses
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </Layout>
  )
}
