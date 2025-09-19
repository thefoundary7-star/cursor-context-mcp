import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { stripeConfig } from '@/utils/config';
import { 
  NotFoundError, 
  ConflictError, 
  StripeError,
  ValidationError 
} from '@/utils/errors';
import { 
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  InvoiceData,
  CustomerPortalSession,
  TrialInfo 
} from '@/types';
import { 
  stripe,
  SUBSCRIPTION_TIERS,
  BILLING_CONFIG,
  TRIAL_CONFIG,
  getTierConfig,
  isTrialEligible,
  calculateTrialEnd,
  createStripeMetadata,
  handleStripeError,
  CUSTOMER_PORTAL_CONFIG 
} from '@/config/stripe';
import { UsageService } from './usageService';
import { LicenseService } from './licenseService';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

export class BillingService {
  // Create Stripe customer
  static async createCustomer(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  }): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}` 
          : undefined,
        metadata: {
          company: userData.company || '',
        },
      });

      logger.info('Stripe customer created', { 
        customerId: customer.id, 
        email: userData.email 
      });

      return customer;
    } catch (error) {
      logger.error('Stripe customer creation failed', { 
        error: (error as Error).message, 
        email: userData.email 
      });
      throw new StripeError('Failed to create customer');
    }
  }

  // Create subscription
  static async createSubscription(
    userId: string,
    subscriptionData: CreateSubscriptionRequest
  ): Promise<{ subscription: any; clientSecret?: string; trialInfo?: TrialInfo }> {
    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if user already has an active subscription
      if (user.subscriptions.length > 0) {
        throw new ConflictError('User already has an active subscription');
      }

      // Validate plan
      const tier = subscriptionData.plan as keyof typeof SUBSCRIPTION_TIERS;
      const tierConfig = getTierConfig(tier);
      if (!tierConfig) {
        throw new ValidationError('Invalid subscription plan');
      }

      // Handle free tier
      if (tier === 'FREE') {
        const subscription = await prisma.subscription.create({
          data: {
            userId,
            plan: 'FREE',
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          },
        });

        // Create default license for free tier
        await LicenseService.createLicense(userId, {
          name: 'Free License',
          description: 'Default license for free tier',
          plan: 'FREE',
          maxServers: tierConfig.limits.maxServers,
        });

        return { subscription };
      }

      // Get or create Stripe customer
      let customer: Stripe.Customer;
      if (user.stripeCustomerId) {
        customer = await stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer;
      } else {
        customer = await this.createCustomer({
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          company: user.company || undefined,
        });

        // Update user with Stripe customer ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customer.id },
        });
      }

      // Check trial eligibility
      const trialInfo = UsageService.getTrialInfo(user);
      const shouldStartTrial = trialInfo.isEligible && !trialInfo.isActive && !trialInfo.isExpired;

      // Create subscription parameters
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: tierConfig.priceId! }],
        payment_behavior: BILLING_CONFIG.paymentBehavior,
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: BILLING_CONFIG.expand,
        metadata: createStripeMetadata({
          userId,
          plan: tier,
        }),
      };

      // Add trial if eligible
      if (shouldStartTrial) {
        subscriptionParams.trial_period_days = TRIAL_CONFIG.durationDays;
        subscriptionParams.trial_end = Math.floor(calculateTrialEnd().getTime() / 1000);
      }

      // Create subscription
      const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

      // Save subscription to database
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: tierConfig.priceId!,
          plan: tier,
          status: stripeSubscription.status.toUpperCase() as any,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          metadata: stripeSubscription.metadata,
        },
      });

      // Create license for paid subscription
      if (tier !== 'FREE') {
        await LicenseService.createLicense(userId, {
          name: `${tierConfig.name} License`,
          description: `License for ${tierConfig.name} subscription`,
          plan: tier,
          maxServers: tierConfig.limits.maxServers,
        });
      }

      // Update user trial end date if trial started
      if (shouldStartTrial && stripeSubscription.trial_end) {
        await prisma.user.update({
          where: { id: userId },
          data: { trialEndsAt: new Date(stripeSubscription.trial_end * 1000) },
        });
      }

      const result: any = { subscription };

      // Add client secret for incomplete subscriptions
      if (stripeSubscription.status === 'incomplete') {
        const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
        result.clientSecret = paymentIntent.client_secret;
      }

      // Add trial info
      if (shouldStartTrial) {
        result.trialInfo = {
          isEligible: true,
          isActive: true,
          isExpired: false,
          trialEnd: new Date(stripeSubscription.trial_end! * 1000),
          daysRemaining: TRIAL_CONFIG.durationDays,
        };
      }

      logger.info('Subscription created', { 
        subscriptionId: subscription.id, 
        userId,
        plan: tier,
        trialActive: shouldStartTrial,
      });

      return result;
    } catch (error) {
      if (error instanceof Stripe.StripeError) {
        handleStripeError(error);
      }
      logger.error('Subscription creation failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Update subscription
  static async updateSubscription(
    userId: string,
    updateData: UpdateSubscriptionRequest
  ): Promise<any> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (!subscription) {
        throw new NotFoundError('Active subscription not found');
      }

      // Validate new plan
      const newTier = updateData.plan as keyof typeof SUBSCRIPTION_TIERS;
      const newTierConfig = getTierConfig(newTier);
      if (!newTierConfig) {
        throw new ValidationError('Invalid subscription plan');
      }

      // Handle free tier upgrade (no Stripe subscription needed)
      if (newTier === 'FREE') {
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            plan: 'FREE',
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        });

        // Update licenses to match new tier
        await prisma.license.updateMany({
          where: { userId },
          data: {
            plan: 'FREE',
            maxServers: newTierConfig.limits.maxServers,
          },
        });

        return updatedSubscription;
      }

      if (!subscription.stripeSubscriptionId) {
        throw new ConflictError('Stripe subscription ID not found');
      }

      // Get current subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      // Update subscription in Stripe
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [{
            id: stripeSubscription.items.data[0].id,
            price: newTierConfig.priceId!,
          }],
          proration_behavior: updateData.prorationBehavior || BILLING_CONFIG.prorationBehavior,
          metadata: createStripeMetadata({
            userId,
            plan: newTier,
            updatedAt: new Date().toISOString(),
          }),
        }
      );

      // Update subscription in database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: newTier,
          stripePriceId: newTierConfig.priceId!,
          currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
          metadata: updatedStripeSubscription.metadata,
        },
      });

      // Update licenses to match new tier
      await prisma.license.updateMany({
        where: { userId },
        data: {
          plan: newTier,
          maxServers: newTierConfig.limits.maxServers,
        },
      });

      logger.info('Subscription updated', { 
        subscriptionId: subscription.id, 
        userId,
        newPlan: newTier,
        prorationBehavior: updateData.prorationBehavior,
      });

      return updatedSubscription;
    } catch (error) {
      if (error instanceof Stripe.StripeError) {
        handleStripeError(error);
      }
      logger.error('Subscription update failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Cancel subscription
  static async cancelSubscription(
    userId: string,
    cancelData: CancelSubscriptionRequest
  ): Promise<any> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (!subscription) {
        throw new NotFoundError('Active subscription not found');
      }

      const cancelAtPeriodEnd = cancelData.cancelAtPeriodEnd ?? true;

      // Handle free tier cancellation
      if (subscription.plan === 'FREE') {
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
            cancelAtPeriodEnd: false,
          },
        });

        // Deactivate licenses
        await prisma.license.updateMany({
          where: { userId },
          data: { isActive: false },
        });

        return updatedSubscription;
      }

      if (!subscription.stripeSubscriptionId) {
        throw new ConflictError('Stripe subscription ID not found');
      }

      // Cancel subscription in Stripe
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: cancelAtPeriodEnd,
          metadata: createStripeMetadata({
            userId,
            cancellationReason: cancelData.cancellationReason || 'User requested',
            canceledAt: new Date().toISOString(),
          }),
        }
      );

      // Update subscription in database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: cancelAtPeriodEnd ? 'ACTIVE' : 'CANCELED',
          cancelAtPeriodEnd,
          cancelAt: cancelAtPeriodEnd ? new Date(updatedStripeSubscription.current_period_end * 1000) : new Date(),
          canceledAt: cancelAtPeriodEnd ? null : new Date(),
          metadata: updatedStripeSubscription.metadata,
        },
      });

      // Deactivate licenses if immediate cancellation
      if (!cancelAtPeriodEnd) {
        await prisma.license.updateMany({
          where: { userId },
          data: { isActive: false },
        });
      }

      logger.info('Subscription canceled', { 
        subscriptionId: subscription.id, 
        userId,
        cancelAtPeriodEnd,
        cancellationReason: cancelData.cancellationReason,
      });

      return updatedSubscription;
    } catch (error) {
      if (error instanceof Stripe.StripeError) {
        handleStripeError(error);
      }
      logger.error('Subscription cancellation failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Get subscription details
  static async getSubscription(userId: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const subscription = user.subscriptions[0];
      if (!subscription) {
        // Return default free subscription
        return {
          id: null,
          plan: 'FREE',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          trialInfo: UsageService.getTrialInfo(user),
        };
      }

      // Get Stripe subscription details if available
      let stripeSubscription = null;
      if (subscription.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(
            subscription.stripeSubscriptionId
          );
        } catch (error) {
          logger.warn('Failed to retrieve Stripe subscription', {
            subscriptionId: subscription.stripeSubscriptionId,
            error: (error as Error).message,
          });
        }
      }

      return {
        ...subscription,
        stripeSubscription,
        trialInfo: UsageService.getTrialInfo(user),
      };
    } catch (error) {
      logger.error('Get subscription failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Get invoices for a user
  static async getInvoices(userId: string, limit: number = 10): Promise<InvoiceData[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user || !user.stripeCustomerId) {
        return [];
      }

      const invoices = await stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit,
      });

      return invoices.data.map(invoice => ({
        id: invoice.id,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : undefined,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
        invoiceUrl: invoice.invoice_pdf || undefined,
        hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
        pdfUrl: invoice.invoice_pdf || undefined,
        createdAt: new Date(invoice.created * 1000),
      }));
    } catch (error) {
      logger.error('Get invoices failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Create customer portal session
  static async createCustomerPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<CustomerPortalSession> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user || !user.stripeCustomerId) {
        throw new NotFoundError('Stripe customer not found');
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      return {
        url: session.url,
        returnUrl,
      };
    } catch (error) {
      if (error instanceof Stripe.StripeError) {
        handleStripeError(error);
      }
      logger.error('Create customer portal session failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Get usage statistics
  static async getUsageStats(userId: string): Promise<any> {
    try {
      return await UsageService.getUsageStats(userId);
    } catch (error) {
      logger.error('Get usage stats failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Create payment method
  static async createPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId }
      );

      logger.info('Payment method attached', { 
        paymentMethodId, 
        customerId 
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Payment method attachment failed', { 
        error: (error as Error).message, 
        customerId 
      });
      throw new StripeError('Failed to attach payment method');
    }
  }

  // Get payment methods
  static async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error('Get payment methods failed', { 
        error: (error as Error).message, 
        customerId 
      });
      throw new StripeError('Failed to retrieve payment methods');
    }
  }

  // Create setup intent for saving payment methods
  static async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      return setupIntent;
    } catch (error) {
      logger.error('Setup intent creation failed', { 
        error: (error as Error).message, 
        customerId 
      });
      throw new StripeError('Failed to create setup intent');
    }
  }

  // Handle webhook events
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      // Store webhook event for tracking
      await prisma.webhookEvent.upsert({
        where: { eventId: event.id },
        update: { processed: true },
        create: {
          eventType: event.type,
          eventId: event.id,
          processed: false,
          data: event.data.object as any,
        },
      });

      switch (event.type) {
        case 'customer.created':
          await this.handleCustomerCreated(event.data.object as Stripe.Customer);
          break;
        case 'customer.updated':
          await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
          break;
        case 'customer.deleted':
          await this.handleCustomerDeleted(event.data.object as Stripe.Customer);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.created':
          await this.handleInvoiceCreated(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.updated':
          await this.handleInvoiceUpdated(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_action_required':
          await this.handlePaymentActionRequired(event.data.object as Stripe.Invoice);
          break;
        case 'payment_method.attached':
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
          break;
        case 'payment_method.detached':
          await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
          break;
        case 'setup_intent.succeeded':
          await this.handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
          break;
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      // Mark webhook as processed
      await prisma.webhookEvent.update({
        where: { eventId: event.id },
        data: { processed: true },
      });

    } catch (error) {
      logger.error('Webhook event handling failed', {
        error: (error as Error).message,
        eventType: event.type,
        eventId: event.id,
      });
      throw error;
    }
  }

  // Handle customer created
  private static async handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
    try {
      logger.info('Customer created in Stripe', { 
        customerId: customer.id,
        email: customer.email 
      });
    } catch (error) {
      logger.error('Customer created handling failed', {
        error: (error as Error).message,
        customerId: customer.id,
      });
      throw error;
    }
  }

  // Handle customer updated
  private static async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    try {
      // Update user if they have this Stripe customer ID
      await prisma.user.updateMany({
        where: { stripeCustomerId: customer.id },
        data: {
          email: customer.email || undefined,
          firstName: customer.name?.split(' ')[0] || undefined,
          lastName: customer.name?.split(' ').slice(1).join(' ') || undefined,
        },
      });

      logger.info('Customer updated in Stripe', { 
        customerId: customer.id,
        email: customer.email 
      });
    } catch (error) {
      logger.error('Customer updated handling failed', {
        error: (error as Error).message,
        customerId: customer.id,
      });
      throw error;
    }
  }

  // Handle customer deleted
  private static async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    try {
      // Deactivate user's subscription and licenses
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customer.id },
        data: { status: 'CANCELED' },
      });

      await prisma.license.updateMany({
        where: { 
          user: { stripeCustomerId: customer.id }
        },
        data: { isActive: false },
      });

      logger.info('Customer deleted in Stripe', { 
        customerId: customer.id 
      });
    } catch (error) {
      logger.error('Customer deleted handling failed', {
        error: (error as Error).message,
        customerId: customer.id,
      });
      throw error;
    }
  }

  // Handle subscription created
  private static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata?.userId;
      if (!userId) {
        logger.warn('Subscription created without userId in metadata', { 
          stripeSubscriptionId: subscription.id 
        });
        return;
      }

      // Check if subscription already exists
      const existingSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (existingSubscription) {
        logger.info('Subscription already exists in database', { 
          subscriptionId: existingSubscription.id,
          stripeSubscriptionId: subscription.id 
        });
        return;
      }

      // Get tier from price ID
      const { getTierByPriceId } = await import('@/config/stripe');
      const tier = getTierByPriceId(subscription.items.data[0]?.price?.id || '');
      
      if (!tier) {
        logger.warn('Unknown price ID in subscription', { 
          stripeSubscriptionId: subscription.id,
          priceId: subscription.items.data[0]?.price?.id 
        });
        return;
      }

      // Create subscription in database
      const dbSubscription = await prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price?.id,
          plan: tier,
          status: subscription.status.toUpperCase() as any,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          metadata: subscription.metadata,
        },
      });

      // Create license for the subscription
      if (tier !== 'FREE') {
        const { LicenseService } = await import('./licenseService');
        await LicenseService.createLicense(userId, {
          name: `${tier} License`,
          description: `License for ${tier} subscription`,
          plan: tier,
          maxServers: SUBSCRIPTION_TIERS[tier].limits.maxServers,
        });
      }

      logger.info('Subscription created from webhook', { 
        subscriptionId: dbSubscription.id,
        userId,
        tier,
        status: subscription.status 
      });
    } catch (error) {
      logger.error('Subscription created handling failed', {
        error: (error as Error).message,
        stripeSubscriptionId: subscription.id,
      });
      throw error;
    }
  }

  // Handle subscription updated
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!dbSubscription) {
        logger.warn('Subscription not found in database', { 
          stripeSubscriptionId: subscription.id 
        });
        return;
      }

      // Get tier from price ID
      const { getTierByPriceId } = await import('@/config/stripe');
      const tier = getTierByPriceId(subscription.items.data[0]?.price?.id || '');
      
      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: subscription.status.toUpperCase() as any,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
          metadata: subscription.metadata,
          ...(tier && { plan: tier }),
        },
      });

      // Update licenses if tier changed
      if (tier && tier !== dbSubscription.plan) {
        await prisma.license.updateMany({
          where: { userId: dbSubscription.userId },
          data: {
            plan: tier,
            maxServers: SUBSCRIPTION_TIERS[tier].limits.maxServers,
          },
        });
      }

      // Deactivate licenses if subscription is canceled
      if (subscription.status === 'canceled') {
        await prisma.license.updateMany({
          where: { userId: dbSubscription.userId },
          data: { isActive: false },
        });
      }

      logger.info('Subscription updated from webhook', { 
        subscriptionId: dbSubscription.id,
        status: subscription.status,
        tier: tier || dbSubscription.plan,
      });
    } catch (error) {
      logger.error('Subscription updated handling failed', {
        error: (error as Error).message,
        stripeSubscriptionId: subscription.id,
      });
      throw error;
    }
  }

  // Handle subscription deletion
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!dbSubscription) {
        logger.warn('Subscription not found in database', { 
          stripeSubscriptionId: subscription.id 
        });
        return;
      }

      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: { status: 'CANCELED' },
      });

      logger.info('Subscription canceled from webhook', { 
        subscriptionId: dbSubscription.id 
      });
    } catch (error) {
      logger.error('Subscription deletion handling failed', {
        error: (error as Error).message,
        stripeSubscriptionId: subscription.id,
      });
      throw error;
    }
  }

  // Handle successful payment
  private static async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription) return;

      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (!dbSubscription) {
        logger.warn('Subscription not found for payment', { 
          stripeSubscriptionId: invoice.subscription 
        });
        return;
      }

      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: { status: 'ACTIVE' },
      });

      logger.info('Payment succeeded, subscription activated', { 
        subscriptionId: dbSubscription.id,
        invoiceId: invoice.id 
      });
    } catch (error) {
      logger.error('Payment success handling failed', {
        error: (error as Error).message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  // Handle failed payment
  private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription) return;

      const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (!dbSubscription) {
        logger.warn('Subscription not found for failed payment', { 
          stripeSubscriptionId: invoice.subscription 
        });
        return;
      }

      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: { status: 'PAST_DUE' },
      });

      logger.info('Payment failed, subscription marked as past due', { 
        subscriptionId: dbSubscription.id,
        invoiceId: invoice.id 
      });
    } catch (error) {
      logger.error('Payment failure handling failed', {
        error: (error as Error).message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  // Handle invoice created
  private static async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.customer) return;

      const userId = await this.getUserIdFromCustomerId(invoice.customer as string);
      if (!userId) return;

      await prisma.invoice.create({
        data: {
          userId,
          stripeInvoiceId: invoice.id,
          subscriptionId: invoice.subscription as string || null,
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: invoice.status?.toUpperCase() as any,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          invoiceUrl: invoice.invoice_pdf || null,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          pdfUrl: invoice.invoice_pdf || null,
        },
      });

      logger.info('Invoice created from webhook', { 
        invoiceId: invoice.id,
        userId,
        amount: invoice.amount_due 
      });
    } catch (error) {
      logger.error('Invoice created handling failed', {
        error: (error as Error).message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  // Handle invoice updated
  private static async handleInvoiceUpdated(invoice: Stripe.Invoice): Promise<void> {
    try {
      await prisma.invoice.updateMany({
        where: { stripeInvoiceId: invoice.id },
        data: {
          amount: invoice.amount_due,
          status: invoice.status?.toUpperCase() as any,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          invoiceUrl: invoice.invoice_pdf || null,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          pdfUrl: invoice.invoice_pdf || null,
        },
      });

      logger.info('Invoice updated from webhook', { 
        invoiceId: invoice.id,
        status: invoice.status 
      });
    } catch (error) {
      logger.error('Invoice updated handling failed', {
        error: (error as Error).message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  // Handle payment action required
  private static async handlePaymentActionRequired(invoice: Stripe.Invoice): Promise<void> {
    try {
      await prisma.invoice.updateMany({
        where: { stripeInvoiceId: invoice.id },
        data: {
          status: 'OPEN',
        },
      });

      logger.info('Payment action required for invoice', { 
        invoiceId: invoice.id 
      });
    } catch (error) {
      logger.error('Payment action required handling failed', {
        error: (error as Error).message,
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  // Handle payment method attached
  private static async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    try {
      logger.info('Payment method attached', { 
        paymentMethodId: paymentMethod.id,
        customerId: paymentMethod.customer 
      });
    } catch (error) {
      logger.error('Payment method attached handling failed', {
        error: (error as Error).message,
        paymentMethodId: paymentMethod.id,
      });
      throw error;
    }
  }

  // Handle payment method detached
  private static async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    try {
      logger.info('Payment method detached', { 
        paymentMethodId: paymentMethod.id,
        customerId: paymentMethod.customer 
      });
    } catch (error) {
      logger.error('Payment method detached handling failed', {
        error: (error as Error).message,
        paymentMethodId: paymentMethod.id,
      });
      throw error;
    }
  }

  // Handle setup intent succeeded
  private static async handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<void> {
    try {
      logger.info('Setup intent succeeded', { 
        setupIntentId: setupIntent.id,
        customerId: setupIntent.customer 
      });
    } catch (error) {
      logger.error('Setup intent succeeded handling failed', {
        error: (error as Error).message,
        setupIntentId: setupIntent.id,
      });
      throw error;
    }
  }

  // Handle checkout session completed
  private static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      logger.info('Checkout session completed', { 
        sessionId: session.id,
        customerId: session.customer 
      });
    } catch (error) {
      logger.error('Checkout session completed handling failed', {
        error: (error as Error).message,
        sessionId: session.id,
      });
      throw error;
    }
  }

  // Helper method to get user ID from Stripe customer ID
  private static async getUserIdFromCustomerId(customerId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      return user?.id || null;
    } catch (error) {
      logger.error('Failed to get user ID from customer ID', {
        error: (error as Error).message,
        customerId,
      });
      return null;
    }
  }
}
