import Stripe from 'stripe';
import { config } from '@/utils/config';

// Initialize Stripe
export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2023-10-16',
});

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null, // No Stripe price ID for free tier
    operationsPerHour: 100,
    features: [
      'Basic MCP server access',
      '100 operations per hour',
      'Community support',
      'Basic analytics',
    ],
    limits: {
      maxServers: 1,
      maxLicenses: 1,
      maxApiKeys: 1,
    },
  },
  PRO: {
    name: 'Pro',
    price: 1900, // $19.00 in cents
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
    operationsPerHour: 1000,
    features: [
      'Advanced MCP server access',
      '1,000 operations per hour',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'API access',
    ],
    limits: {
      maxServers: 5,
      maxLicenses: 5,
      maxApiKeys: 3,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 9900, // $99.00 in cents
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly',
    operationsPerHour: 10000,
    features: [
      'Unlimited MCP server access',
      '10,000 operations per hour',
      '24/7 dedicated support',
      'Enterprise analytics',
      'Custom integrations',
      'Unlimited API access',
      'SLA guarantee',
      'Custom deployment',
    ],
    limits: {
      maxServers: 100,
      maxLicenses: 100,
      maxApiKeys: 10,
    },
  },
} as const;

// Trial configuration
export const TRIAL_CONFIG = {
  durationDays: 14,
  gracePeriodDays: 3,
} as const;

// Billing configuration
export const BILLING_CONFIG = {
  currency: 'usd',
  taxBehavior: 'exclusive' as const,
  billingCycleAnchor: 'now' as const,
  prorationBehavior: 'create_prorations' as const,
  collectionMethod: 'charge_automatically' as const,
  paymentBehavior: 'default_incomplete' as const,
  expand: ['latest_invoice.payment_intent'],
} as const;

// Webhook events to handle
export const WEBHOOK_EVENTS = [
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.created',
  'invoice.updated',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'payment_method.attached',
  'payment_method.detached',
  'setup_intent.succeeded',
  'checkout.session.completed',
] as const;

// Stripe product configuration
export const STRIPE_PRODUCTS = {
  MCP_SAAS: {
    name: 'MCP Server SaaS',
    description: 'Model Context Protocol Server as a Service',
    metadata: {
      service: 'mcp-saas',
      version: '1.0.0',
    },
  },
} as const;

// Helper functions
export const getTierByPriceId = (priceId: string): keyof typeof SUBSCRIPTION_TIERS | null => {
  for (const [tier, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (config.priceId === priceId) {
      return tier as keyof typeof SUBSCRIPTION_TIERS;
    }
  }
  return null;
};

export const getTierByName = (name: string): keyof typeof SUBSCRIPTION_TIERS | null => {
  const normalizedName = name.toUpperCase();
  if (normalizedName in SUBSCRIPTION_TIERS) {
    return normalizedName as keyof typeof SUBSCRIPTION_TIERS;
  }
  return null;
};

export const getTierConfig = (tier: keyof typeof SUBSCRIPTION_TIERS) => {
  return SUBSCRIPTION_TIERS[tier];
};

export const isTrialEligible = (userCreatedAt: Date): boolean => {
  const trialEligibilityPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const now = new Date();
  const timeSinceCreation = now.getTime() - userCreatedAt.getTime();
  return timeSinceCreation <= trialEligibilityPeriod;
};

export const calculateTrialEnd = (startDate: Date = new Date()): Date => {
  const trialEnd = new Date(startDate);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_CONFIG.durationDays);
  return trialEnd;
};

export const isTrialActive = (trialEnd: Date): boolean => {
  return new Date() < trialEnd;
};

export const isTrialExpired = (trialEnd: Date): boolean => {
  const gracePeriodEnd = new Date(trialEnd);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + TRIAL_CONFIG.gracePeriodDays);
  return new Date() > gracePeriodEnd;
};

// Stripe metadata helpers
export const createStripeMetadata = (data: Record<string, any>): Record<string, string> => {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      metadata[key] = String(value);
    }
  }
  return metadata;
};

export const parseStripeMetadata = (metadata: Record<string, string>): Record<string, any> => {
  const parsed: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Try to parse as JSON first
    try {
      parsed[key] = JSON.parse(value);
    } catch {
      // If not JSON, keep as string
      parsed[key] = value;
    }
  }
  return parsed;
};

// Price formatting helpers
export const formatPrice = (amountInCents: number, currency: string = 'usd'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
};

export const parsePrice = (formattedPrice: string): number => {
  const numericValue = parseFloat(formattedPrice.replace(/[^0-9.-]+/g, ''));
  return Math.round(numericValue * 100); // Convert to cents
};

// Subscription status helpers
export const isActiveSubscription = (status: string): boolean => {
  return ['active', 'trialing'].includes(status.toLowerCase());
};

export const isIncompleteSubscription = (status: string): boolean => {
  return ['incomplete', 'incomplete_expired'].includes(status.toLowerCase());
};

export const isCanceledSubscription = (status: string): boolean => {
  return ['canceled', 'unpaid'].includes(status.toLowerCase());
};

export const isPastDueSubscription = (status: string): boolean => {
  return status.toLowerCase() === 'past_due';
};

// Error handling helpers
export const handleStripeError = (error: any): never => {
  if (error.type === 'StripeCardError') {
    throw new Error(`Card declined: ${error.message}`);
  }
  if (error.type === 'StripeRateLimitError') {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  if (error.type === 'StripeInvalidRequestError') {
    throw new Error(`Invalid request: ${error.message}`);
  }
  if (error.type === 'StripeAPIError') {
    throw new Error('Payment service error. Please try again later.');
  }
  if (error.type === 'StripeConnectionError') {
    throw new Error('Payment service unavailable. Please try again later.');
  }
  if (error.type === 'StripeAuthenticationError') {
    throw new Error('Payment authentication failed.');
  }
  throw new Error(`Payment error: ${error.message}`);
};

// Webhook signature verification
export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event => {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error}`);
  }
};

// Customer portal configuration
export const CUSTOMER_PORTAL_CONFIG = {
  business_profile: {
    headline: 'MCP Server SaaS - Manage your subscription',
  },
  features: {
    customer_update: {
      enabled: true,
    },
    invoice_history: {
      enabled: true,
    },
    payment_method_update: {
      enabled: true,
    },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
    },
    subscription_pause: {
      enabled: false,
    },
  },
} as const;
