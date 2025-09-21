interface PayPalConfig {
  clientId: string
  clientSecret: string
  mode: 'sandbox' | 'live'
}

interface PayPalSubscriptionOrder {
  id: string
  status: string
  payment_source: {
    paypal: {
      attributes: {
        vault: {
          id: string // This is the payment token for recurring billing
        }
      }
    }
  }
}

class PayPalRecurringService {
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

  // Create order with vaulting for recurring payments
  async createSubscriptionOrder(plan: string, amount: number, userInfo: any): Promise<any> {
    const accessToken = await this.getAccessToken()
    
    const planPrice = amount
    const setupFee = 0 // No setup fee for your use case
    const totalAmount = planPrice + setupFee

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: totalAmount.toString(),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: totalAmount.toString()
            }
          }
        },
        items: [{
          name: 'Billing Plan',
          quantity: '1',
          unit_amount: {
            currency_code: 'USD',
            value: totalAmount.toString()
          },
          billing_plan: {
            name: `MCP Server ${plan} - Monthly Plan`,
            billing_cycles: [{
              sequence: 1,
              tenure_type: 'REGULAR',
              pricing_scheme: {
                pricing_model: 'FIXED',
                price: {
                  currency_code: 'USD',
                  value: planPrice.toString()
                }
              },
              billing_frequency_unit: 'MONTH',
              billing_frequency: 1,
              number_of_executions: 0 // 0 means infinite
            }]
          }
        }]
      }],
      payment_source: {
        paypal: {
          attributes: {
            vault: {
              store_in_vault: 'ON_SUCCESS',
              usage_type: 'MERCHANT',
              usage_pattern: 'SUBSCRIPTION'
            }
          },
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
      const error = await response.text()
      throw new Error(`Failed to create PayPal subscription order: ${error}`)
    }

    return response.json()
  }

  // Capture initial payment and get vault token
  async captureSubscriptionOrder(orderId: string): Promise<PayPalSubscriptionOrder> {
    const accessToken = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to capture PayPal subscription order')
    }

    return response.json()
  }

  // Process recurring payment using vault token
  async processRecurringPayment(vaultId: string, amount: number, subscriptionId: string): Promise<any> {
    const accessToken = await this.getAccessToken()
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: amount.toString()
        },
        reference_id: subscriptionId // Your internal subscription ID
      }],
      payment_source: {
        paypal: {
          vault_id: vaultId,
          stored_credential: {
            payment_initiator: 'MERCHANT',
            usage: 'SUBSEQUENT',
            usage_pattern: 'SUBSCRIPTION'
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
      throw new Error('Failed to process recurring payment')
    }

    const order = await response.json()
    
    // Immediately capture the payment
    const captureResponse = await fetch(`${this.baseUrl}/v2/checkout/orders/${order.id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!captureResponse.ok) {
      throw new Error('Failed to capture recurring payment')
    }

    return captureResponse.json()
  }

  // Create order with trial period
  async createTrialSubscriptionOrder(plan: string, trialAmount: number, regularAmount: number): Promise<any> {
    const accessToken = await this.getAccessToken()
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: trialAmount.toString()
        },
        items: [{
          name: 'Billing Plan',
          quantity: '1',
          unit_amount: {
            currency_code: 'USD',
            value: trialAmount.toString()
          },
          billing_plan: {
            name: `MCP Server ${plan} - Monthly Plan with Trial`,
            billing_cycles: [
              {
                sequence: 1,
                tenure_type: 'TRIAL',
                pricing_scheme: {
                  pricing_model: 'FIXED',
                  price: {
                    currency_code: 'USD',
                    value: trialAmount.toString()
                  }
                },
                billing_frequency_unit: 'DAY',
                billing_frequency: 14, // 14-day trial
                number_of_executions: 1
              },
              {
                sequence: 2,
                tenure_type: 'REGULAR',
                pricing_scheme: {
                  pricing_model: 'FIXED',
                  price: {
                    currency_code: 'USD',
                    value: regularAmount.toString()
                  }
                },
                billing_frequency_unit: 'MONTH',
                billing_frequency: 1,
                number_of_executions: 0 // Infinite
              }
            ]
          }
        }]
      }],
      payment_source: {
        paypal: {
          attributes: {
            vault: {
              store_in_vault: 'ON_SUCCESS',
              usage_type: 'MERCHANT',
              usage_pattern: 'SUBSCRIPTION'
            }
          },
          experience_context: {
            payment_method_preference: 'UNRESTRICTED',
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
      const error = await response.text()
      throw new Error(`Failed to create trial subscription order: ${error}`)
    }

    return response.json()
  }
}

export const paypalRecurringService = new PayPalRecurringService()