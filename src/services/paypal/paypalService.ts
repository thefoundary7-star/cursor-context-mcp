interface PayPalConfig {
  clientId: string
  clientSecret: string
  mode: 'sandbox' | 'live'
}

interface PayPalOrder {
  id: string
  status: string
  payer: {
    payer_id: string
    email_address: string
    name: {
      given_name: string
      surname: string
    }
  }
  purchase_units: Array<{
    amount: {
      value: string
      currency_code: string
    }
  }>
}

class PayPalService {
  private config: PayPalConfig
  private baseUrl: string

  constructor() {
    this.config = {
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox'
    }
    
    this.baseUrl = this.config.mode === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'
  }

  async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')
    
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      throw new Error('Failed to get PayPal access token')
    }

    const data = await response.json()
    return data.access_token
  }

  async createOrder(amount: number, currency: string = 'USD'): Promise<any> {
    const accessToken = await this.getAccessToken()
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString()
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'UNRESTRICTED', // Allows guest checkout
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING'
          }
        }
      }
    }

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      throw new Error('Failed to create PayPal order')
    }

    return response.json()
  }

  async captureOrder(orderId: string): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to capture PayPal order')
    }

    return response.json()
  }

  async getOrderDetails(orderId: string): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get PayPal order details')
    }

    return response.json()
  }

  // For future recurring payments (manual implementation)
  async createPaymentToken(orderId: string): Promise<string> {
    // This would store payment method for future charges
    // PayPal's vault API can be used for this
    const accessToken = await this.getAccessToken()
    
    // Implementation depends on PayPal's vault API
    // For now, we'll store the order ID and payer ID
    return orderId
  }

  async chargeStoredPayment(paymentToken: string, amount: number): Promise<any> {
    // This would charge a stored payment method
    // Implementation depends on PayPal's recurring payments API
    throw new Error('Recurring payments not yet implemented')
  }
}

export const PayPalService = new PayPalService()