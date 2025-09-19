'use client'

import { useState } from 'react'
import { usePaymentMethods } from '@/hooks/useSubscription'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

export function PaymentMethods() {
  const { paymentMethods, isLoading, deletePaymentMethod, isDeleteLoading } = usePaymentMethods()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const handleDelete = (paymentMethodId: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      deletePaymentMethod({ paymentMethodId })
    }
  }

  const getCardIcon = (brand: string) => {
    // In a real app, you would have proper card brand icons
    return <CreditCard className="h-5 w-5" />
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-40 bg-muted rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Payment Methods</span>
            </CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Payment Method</DialogTitle>
                  <DialogDescription>
                    Add a new payment method to your account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Stripe Elements would go here */}
                  <p className="text-sm text-muted-foreground">
                    Stripe payment form will be integrated here.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getCardIcon(method.card.brand)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">
                          {method.card.brand.toUpperCase()} •••• {method.card.last4}
                        </h4>
                        {method.isDefault && (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.card.expMonth.toString().padStart(2, '0')}/{method.card.expYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(method.id)}
                        disabled={isDeleteLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
              <p className="text-muted-foreground mb-4">
                Add a payment method to manage your subscription.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Billing Address</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>John Doe</p>
                <p>123 Main Street</p>
                <p>New York, NY 10001</p>
                <p>United States</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Tax Information</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>VAT Number: Not provided</p>
                <p>Tax ID: Not provided</p>
              </div>
            </div>
          </div>
          <Button variant="outline">
            Update Billing Information
          </Button>
        </CardContent>
      </Card>

      {/* Stripe Customer Portal */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Customer Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your subscription, payment methods, and billing history through Stripe's secure customer portal.
          </p>
          <Button>
            Open Customer Portal
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
