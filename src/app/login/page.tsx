import { Layout } from '@/components/layout/layout'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">M</span>
            </div>
            <h1 className="text-3xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to your MCP SaaS account
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </Layout>
  )
}
