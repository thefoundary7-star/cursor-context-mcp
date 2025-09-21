// src/services/dodo/dodopayments.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface DodoConfig {
  apiKey: string;
  environment: 'sandbox' | 'production' | 'test';
  baseUrl?: string; // Allow custom base URL override
}

interface DodoCustomer {
  id: string;
  email: string;
  name: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface DodoProduct {
  id: string;
  name: string;
  description: string;
  type: 'recurring' | 'one_time';
  pricing: {
    amount: number;
    currency: string;
    interval?: 'month' | 'year';
    interval_count?: number;
  };
  metadata?: Record<string, any>;
}

interface DodoSubscription {
  id: string;
  customer_id: string;
  product_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  metadata?: Record<string, any>;
  license_key?: string;
}

interface DodoCheckoutSession {
  id: string;
  url: string;
  customer_email?: string;
  success_url: string;
  cancel_url: string;
  payment_status: 'pending' | 'paid' | 'failed';
  metadata?: Record<string, any>;
}

interface CreateCheckoutSessionParams {
  product_id: string;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  trial_days?: number;
  metadata?: Record<string, any>;
}

interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode: boolean;
}

export class DodoPaymentsService {
  private apiKey: string;
  private client: AxiosInstance;

  constructor(config: DodoConfig) {
    this.apiKey = config.apiKey;

    // Allow custom base URL override, otherwise use environment-based defaults
    const baseURL = config.baseUrl || this.getDefaultBaseUrl(config.environment);

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'FileBridge/1.0',
      },
      timeout: 30000,
    });

    // Add response interceptor for enhanced error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Dodo Payments API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        });

        // Provide more specific error messages based on status codes
        if (error.response?.status === 422) {
          const validationError = new Error(`Validation Error: ${error.response.data?.message || 'Invalid request format'}`);
          (validationError as any).validationErrors = error.response.data?.errors;
          throw validationError;
        }

        if (error.response?.status === 401) {
          throw new Error('Authentication failed: Check your API key and permissions');
        }

        if (error.response?.status === 403) {
          throw new Error('Access forbidden: Your API key may not have the required permissions');
        }

        throw new Error(error.response?.data?.message || 'Payment service error');
      }
    );
  }

  private getDefaultBaseUrl(environment: string): string {
    // Try multiple possible base URLs for each environment
    switch (environment) {
      case 'production':
        return process.env.DODO_API_BASE_URL || 'https://api.dodopayments.com';
      case 'test':
        return process.env.DODO_API_BASE_URL || 'https://test-api.dodopayments.com';
      case 'sandbox':
      default:
        return process.env.DODO_API_BASE_URL || 'https://test.dodopayments.com';
    }
  }

  // Customer Management
  async createCustomer(data: {
    email: string;
    name: string;
    metadata?: Record<string, any>;
  }): Promise<DodoCustomer> {
    const response: AxiosResponse<DodoCustomer> = await this.client.post('/customers', data);
    return response.data;
  }

  async getCustomer(customerId: string): Promise<DodoCustomer> {
    const response: AxiosResponse<DodoCustomer> = await this.client.get(`/customers/${customerId}`);
    return response.data;
  }

  async updateCustomer(customerId: string, data: {
    email?: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<DodoCustomer> {
    const response: AxiosResponse<DodoCustomer> = await this.client.patch(`/customers/${customerId}`, data);
    return response.data;
  }

  async listCustomers(params?: {
    limit?: number;
    starting_after?: string;
    email?: string;
  }): Promise<{ data: DodoCustomer[]; has_more: boolean }> {
    const response = await this.client.get('/customers', { params });
    return response.data;
  }

  // Product Management with adaptive format support
  async createProduct(data: {
    name: string;
    description: string;
    type?: 'recurring' | 'one_time' | 'subscription';
    pricing?: {
      amount?: number;
      price?: number;
      currency: string;
      interval?: 'month' | 'year' | 'monthly' | 'yearly';
      interval_count?: number;
      type?: string;
      payment_frequency?: {
        interval: string;
        count: number;
      };
      subscription_period?: {
        interval: string;
        count: number;
      };
    };
    price?: number | {
      amount?: number;
      price?: number;
      currency: string;
      interval?: string;
      type?: string;
    };
    currency?: string;
    interval?: string;
    tax_category?: string;
    metadata?: Record<string, any>;
  }): Promise<DodoProduct> {
    // Try to create product with adaptive format handling
    const adaptedData = this.adaptProductData(data);

    try {
      const response: AxiosResponse<DodoProduct> = await this.client.post('/products', adaptedData);
      return response.data;
    } catch (error: any) {
      // If we get a validation error, try alternative formats
      if (error.message?.includes('Validation Error')) {
        console.log('Trying alternative product format...');

        // Try format variations
        const alternatives = this.generateProductFormatAlternatives(data);

        for (const alt of alternatives) {
          try {
            console.log(`Attempting format: ${alt.name}`, alt.data);
            const response: AxiosResponse<DodoProduct> = await this.client.post('/products', alt.data);
            console.log(`Success with format: ${alt.name}`);
            return response.data;
          } catch (altError: any) {
            console.log(`Format ${alt.name} failed:`, altError.message);
            continue;
          }
        }
      }

      throw error;
    }
  }

  private adaptProductData(data: any) {
    // Start with the original data structure
    const adapted = { ...data };

    // Ensure we have required fields
    if (!adapted.name || !adapted.description) {
      throw new Error('Product name and description are required');
    }

    // Add tax_category if not present
    if (!adapted.tax_category) {
      adapted.tax_category = 'digital_products';
    }

    return adapted;
  }

  private generateProductFormatAlternatives(originalData: any) {
    const baseData = {
      name: originalData.name,
      description: originalData.description,
      tax_category: originalData.tax_category || 'digital_products',
      metadata: originalData.metadata
    };

    const price = originalData.pricing?.amount || originalData.pricing?.price || originalData.price || 1900;
    const currency = originalData.pricing?.currency || originalData.currency || 'USD';
    const interval = originalData.pricing?.interval || originalData.interval || 'month';

    return [
      // Format 1: Simple structure
      {
        name: 'simple',
        data: {
          ...baseData,
          type: 'subscription',
          price,
          currency,
          interval
        }
      },
      // Format 2: Nested pricing
      {
        name: 'nested_pricing',
        data: {
          ...baseData,
          pricing: {
            type: 'recurring_price',
            price,
            currency,
            interval
          }
        }
      },
      // Format 3: Complex pricing structure
      {
        name: 'complex_pricing',
        data: {
          ...baseData,
          pricing: {
            type: 'recurring_price',
            price,
            currency,
            payment_frequency: {
              interval,
              count: 1
            },
            subscription_period: {
              interval,
              count: 1
            }
          }
        }
      },
      // Format 4: Alternative price object
      {
        name: 'price_object',
        data: {
          ...baseData,
          price: {
            amount: price,
            currency,
            interval,
            type: 'recurring'
          }
        }
      },
      // Format 5: With recurring flag
      {
        name: 'with_recurring',
        data: {
          ...baseData,
          recurring: true,
          billing_cycle: interval === 'month' ? 'monthly' : interval,
          price: {
            type: 'recurring_price',
            price,
            currency,
            interval
          }
        }
      }
    ];
  }

  async getProduct(productId: string): Promise<DodoProduct> {
    const response: AxiosResponse<DodoProduct> = await this.client.get(`/products/${productId}`);
    return response.data;
  }

  async listProducts(): Promise<{ data: DodoProduct[] }> {
    const response = await this.client.get('/products');
    return response.data;
  }

  // Subscription Management
  async createSubscription(data: {
    customer_id: string;
    product_id: string;
    trial_days?: number;
    metadata?: Record<string, any>;
  }): Promise<DodoSubscription> {
    const response: AxiosResponse<DodoSubscription> = await this.client.post('/subscriptions', data);
    return response.data;
  }

  async getSubscription(subscriptionId: string): Promise<DodoSubscription> {
    const response: AxiosResponse<DodoSubscription> = await this.client.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  }

  async updateSubscription(subscriptionId: string, data: {
    product_id?: string;
    metadata?: Record<string, any>;
  }): Promise<DodoSubscription> {
    const response: AxiosResponse<DodoSubscription> = await this.client.patch(`/subscriptions/${subscriptionId}`, data);
    return response.data;
  }

  async cancelSubscription(subscriptionId: string, data?: {
    at_period_end?: boolean;
  }): Promise<DodoSubscription> {
    const response: AxiosResponse<DodoSubscription> = await this.client.delete(`/subscriptions/${subscriptionId}`, { data });
    return response.data;
  }

  async listSubscriptions(params?: {
    customer_id?: string;
    status?: string;
    limit?: number;
  }): Promise<{ data: DodoSubscription[] }> {
    const response = await this.client.get('/subscriptions', { params });
    return response.data;
  }

  // Checkout Sessions
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<DodoCheckoutSession> {
    const response: AxiosResponse<DodoCheckoutSession> = await this.client.post('/checkout/sessions', params);
    return response.data;
  }

  async getCheckoutSession(sessionId: string): Promise<DodoCheckoutSession> {
    const response: AxiosResponse<DodoCheckoutSession> = await this.client.get(`/checkout/sessions/${sessionId}`);
    return response.data;
  }

  // License Key Management (Dodo's built-in feature)
  async generateLicenseKey(subscriptionId: string, data?: {
    metadata?: Record<string, any>;
    expires_at?: string;
  }): Promise<{ license_key: string; expires_at?: string }> {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/license-key`, data);
    return response.data;
  }

  async validateLicenseKey(licenseKey: string): Promise<{
    valid: boolean;
    subscription_id?: string;
    customer_id?: string;
    product_id?: string;
    expires_at?: string;
    metadata?: Record<string, any>;
  }> {
    const response = await this.client.post('/license-keys/validate', { license_key: licenseKey });
    return response.data;
  }

  async revokeLicenseKey(licenseKey: string): Promise<{ success: boolean }> {
    const response = await this.client.delete('/license-keys', { data: { license_key: licenseKey } });
    return response.data;
  }

  // Webhook Verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      // Dodo uses HMAC SHA-256 for webhook signatures
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  // Customer Portal (for subscription management)
  async createCustomerPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const response = await this.client.post('/customer-portal/sessions', {
      customer_id: customerId,
      return_url: returnUrl,
    });
    return response.data;
  }

  // Usage-based billing (for future enterprise features)
  async recordUsage(subscriptionId: string, data: {
    quantity: number;
    timestamp?: number;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean }> {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/usage`, data);
    return response.data;
  }

  // Analytics and reporting
  async getSubscriptionMetrics(params?: {
    start_date?: string;
    end_date?: string;
    product_id?: string;
  }): Promise<{
    total_subscriptions: number;
    active_subscriptions: number;
    monthly_recurring_revenue: number;
    churn_rate: number;
  }> {
    const response = await this.client.get('/analytics/subscriptions', { params });
    return response.data;
  }

  // Utility methods for FileBridge with improved error handling
  async createFileBridgeProducts(): Promise<{ pro: DodoProduct; enterprise: DodoProduct }> {
    console.log('Creating FileBridge products with adaptive format detection...');

    try {
      const [pro, enterprise] = await Promise.all([
        this.createProduct({
          name: 'FileBridge Pro',
          description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
          type: 'subscription',
          pricing: {
            price: 1900, // $19.00 in cents
            currency: 'USD',
            interval: 'month',
          },
          tax_category: 'digital_products',
          metadata: {
            tier: 'pro',
            max_projects: '10',
            support_level: 'email',
            features: 'Multiple projects, Git integration, Context detection, Email support'
          },
        }),
        this.createProduct({
          name: 'FileBridge Enterprise',
          description: 'Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.',
          type: 'subscription',
          pricing: {
            price: 9900, // $99.00 in cents
            currency: 'USD',
            interval: 'month',
          },
          tax_category: 'digital_products',
          metadata: {
            tier: 'enterprise',
            max_projects: 'unlimited',
            support_level: 'priority',
            team_features: 'true',
            features: 'Unlimited projects, Team collaboration, Admin dashboard, Priority support, Custom integrations'
          },
        }),
      ]);

      console.log('✅ Both FileBridge products created successfully!');
      console.log(`Pro Product ID: ${pro.id}`);
      console.log(`Enterprise Product ID: ${enterprise.id}`);

      return { pro, enterprise };

    } catch (error: any) {
      console.error('❌ Failed to create FileBridge products:', error.message);

      if (error.validationErrors) {
        console.error('Validation errors:', error.validationErrors);
      }

      // Try to provide helpful suggestions
      if (error.message.includes('missing field')) {
        console.log('\n💡 Try adding missing required fields to your product data');
      }

      if (error.message.includes('unknown variant')) {
        console.log('\n💡 The API may expect different field values than what we\'re sending');
      }

      if (error.message.includes('Authentication failed')) {
        console.log('\n💡 Check your DODO_API_KEY environment variable');
      }

      throw error;
    }
  }

  async createFileBridgeCheckout(productId: string, userEmail: string): Promise<DodoCheckoutSession> {
    return this.createCheckoutSession({
      product_id: productId,
      customer_email: userEmail,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      trial_days: 7, // 7-day free trial
      metadata: {
        source: 'filebridge_website',
        version: '1.0',
      },
    });
  }
}

// Singleton instance
let dodoPay: DodoPaymentsService | null = null;

export function getDodoPaymentsService(): DodoPaymentsService {
  if (!dodoPay) {
    if (!process.env.DODO_API_KEY) {
      throw new Error('DODO_API_KEY environment variable is required');
    }

    dodoPay = new DodoPaymentsService({
      apiKey: process.env.DODO_API_KEY,
      environment: (process.env.DODO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    });
  }

  return dodoPay;
}

export default DodoPaymentsService;
