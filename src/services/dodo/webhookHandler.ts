// src/services/dodo/webhookHandler.ts - Complete file
import { Request, Response } from 'express';
import { getDodoPaymentsService } from './dodopayments';
import { PrismaClient } from '@prisma/client';
import { generateLicenseKey } from '../licenseService';
import { sendEmail } from '../email/emailService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();
const dodoPayments = getDodoPaymentsService();

interface DodoWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode: boolean;
}

export class DodoWebhookHandler {
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['dodo-signature'] as string;
      const payload = JSON.stringify(req.body);

      // Verify webhook signature
      const isValid = dodoPayments.verifyWebhookSignature(
        payload,
        signature,
        process.env.DODO_WEBHOOK_SECRET!
      );

      if (!isValid) {
        logger.error('Invalid webhook signature from Dodo Payments');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      const event: DodoWebhookEvent = req.body;

      // Check if we've already processed this event (idempotency)
      const existingEvent = await prisma.webhookEvent.findUnique({
        where: { dodoEventId: event.id },
      });

      if (existingEvent && existingEvent.processed) {
        logger.info(`Webhook event ${event.id} already processed`);
        res.status(200).json({ received: true });
        return;
      }

      // Store the webhook event
      await prisma.webhookEvent.upsert({
        where: { dodoEventId: event.id },
        update: { 
          attempts: { increment: 1 },
          data: event.data,
        },
        create: {
          dodoEventId: event.id,
          eventType: event.type,
          data: event.data,
          attempts: 1,
        },
      });

      // Process the event based on type
      await this.processEvent(event);

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { dodoEventId: event.id },
        data: { 
          processed: true,
          processedAt: new Date(),
        },
      });

      res.status(200).json({ received: true });

    } catch (error) {
      logger.error('Webhook processing error:', error);
      
      // Store the error
      if (req.body?.id) {
        await prisma.webhookEvent.upsert({
          where: { dodoEventId: req.body.id },
          update: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: { increment: 1 },
          },
          create: {
            dodoEventId: req.body.id,
            eventType: req.body.type || 'unknown',
            data: req.body.data || {},
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: 1,
          },
        });
      }

      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  private async processEvent(event: DodoWebhookEvent): Promise<void> {
    switch (event.type) {
      case 'subscription.created':
        await this.handleSubscriptionCreated(event.data.object);
        break;
      
      case 'subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'subscription.canceled':
        await this.handleSubscriptionCanceled(event.data.object);
        break;
      
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      
      case 'payment.failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    try {
      logger.info(`Processing subscription created: ${subscription.id}`);

      // Get or create customer in our database
      let user = await prisma.user.findUnique({
        where: { email: subscription.customer.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: subscription.customer.email,
            name: subscription.customer.name || '',
            emailVerified: new Date(),
          },
        });
      }

      // Get product details to determine tier
      const product = await dodoPayments.getProduct(subscription.product_id);
      const tier = product.metadata?.tier || 'pro';

      // Generate license key using Dodo's built-in feature
      const licenseData = await dodoPayments.generateLicenseKey(subscription.id, {
        metadata: {
          userId: user.id,
          tier: tier,
          email: user.email,
        },
      });

      // Create subscription record in our database
      await prisma.subscription.create({
        data: {
          userId: user.id,
          dodoSubscriptionId: subscription.id,
          dodoCustomerId: subscription.customer_id,
          dodoProductId: subscription.product_id,
          status: subscription.status,
          tier: tier as any,
          licenseKey: licenseData.license_key,
          currentPeriodStart: new Date(subscription.current_period_start),
          currentPeriodEnd: new Date(subscription.current_period_end),
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end) : null,
        },
      });

      // Send welcome email with license key
      await this.sendWelcomeEmail(user, licenseData.license_key, tier);

      logger.info(`Subscription created successfully for user ${user.id}`);

    } catch (error) {
      logger.error('Error processing subscription created:', error);
      throw error;
    }
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    try {
      logger.info(`Processing subscription updated: ${subscription.id}`);

      await prisma.subscription.update({
        where: { dodoSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start),
          currentPeriodEnd: new Date(subscription.current_period_end),
          updatedAt: new Date(),
        },
      });

      // If subscription was reactivated, send notification
      if (subscription.status === 'active') {
        const dbSubscription = await prisma.subscription.findUnique({
          where: { dodoSubscriptionId: subscription.id },
          include: { user: true },
        });

        if (dbSubscription) {
          await this.sendSubscriptionReactivatedEmail(dbSubscription.user, dbSubscription.tier);
        }
      }

      logger.info(`Subscription updated successfully: ${subscription.id}`);

    } catch (error) {
      logger.error('Error processing subscription updated:', error);
      throw error;
    }
  }

  private async handleSubscriptionCanceled(subscription: any): Promise<void> {
    try {
      logger.info(`Processing subscription canceled: ${subscription.id}`);

      const dbSubscription = await prisma.subscription.findUnique({
        where: { dodoSubscriptionId: subscription.id },
        include: { user: true },
      });

      if (!dbSubscription) {
        logger.error(`Subscription not found in database: ${subscription.id}`);
        return;
      }

      // Update subscription status
      await prisma.subscription.update({
        where: { dodoSubscriptionId: subscription.id },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Revoke license key
      if (dbSubscription.licenseKey) {
        await dodoPayments.revokeLicenseKey(dbSubscription.licenseKey);
      }

      // Send cancellation email
      await this.sendCancellationEmail(dbSubscription.user, dbSubscription.tier);

      logger.info(`Subscription canceled successfully: ${subscription.id}`);

    } catch (error) {
      logger.error('Error processing subscription canceled:', error);
      throw error;
    }
  }

  private async handlePaymentSucceeded(payment: any): Promise<void> {
    try {
      logger.info(`Processing payment succeeded: ${payment.id}`);

      // Update payment status and extend subscription if needed
      if (payment.subscription_id) {
        await prisma.subscription.update({
          where: { dodoSubscriptionId: payment.subscription_id },
          data: {
            lastPaymentAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Record successful payment
      await prisma.payment.create({
        data: {
          dodoPaymentId: payment.id,
          subscriptionId: payment.subscription_id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'succeeded',
          paidAt: new Date(payment.created * 1000),
        },
      });

      logger.info(`Payment processed successfully: ${payment.id}`);

    } catch (error) {
      logger.error('Error processing payment succeeded:', error);
      throw error;
    }
  }

  private async handlePaymentFailed(payment: any): Promise<void> {
    try {
      logger.info(`Processing payment failed: ${payment.id}`);

      // Record failed payment
      await prisma.payment.create({
        data: {
          dodoPaymentId: payment.id,
          subscriptionId: payment.subscription_id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'failed',
          failureReason: payment.failure_reason,
          createdAt: new Date(payment.created * 1000),
        },
      });

      // Get subscription and user info
      const subscription = await prisma.subscription.findUnique({
        where: { dodoSubscriptionId: payment.subscription_id },
        include: { user: true },
      });

      if (subscription) {
        // Send payment failed email
        await this.sendPaymentFailedEmail(subscription.user, subscription.tier);
      }

      logger.info(`Payment failure processed: ${payment.id}`);

    } catch (error) {
      logger.error('Error processing payment failed:', error);
      throw error;
    }
  }

  private async handleCheckoutCompleted(session: any): Promise<void> {
    try {
      logger.info(`Processing checkout completed: ${session.id}`);

      // The subscription should already be created by subscription.created event
      // This is just for additional tracking
      await prisma.checkoutSession.create({
        data: {
          dodoSessionId: session.id,
          customerEmail: session.customer_email,
          paymentStatus: session.payment_status,
          subscriptionId: session.subscription_id,
          completedAt: new Date(),
        },
      });

      logger.info(`Checkout session recorded: ${session.id}`);

    } catch (error) {
      logger.error('Error processing checkout completed:', error);
      throw error;
    }
  }

  // Email notification methods
  private async sendWelcomeEmail(user: any, licenseKey: string, tier: string): Promise<void> {
    const subject = `Welcome to FileBridge ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`;
    const setupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/setup?key=${licenseKey}`;
    
    const content = `
      <h2>Welcome to FileBridge!</h2>
      <p>Thank you for subscribing to FileBridge ${tier.charAt(0).toUpperCase() + tier.slice(1)}. Your privacy-first MCP server is ready to use!</p>
      
      <h3>Your License Key:</h3>
      <code style="background: #f4f4f4; padding: 10px; display: block; margin: 10px 0;">${licenseKey}</code>
      
      <h3>Quick Setup:</h3>
      <ol>
        <li><a href="${setupUrl}">Click here for automatic setup</a></li>
        <li>Or follow our <a href="${process.env.NEXT_PUBLIC_APP_URL}/docs/setup">manual setup guide</a></li>
      </ol>
      
      <h3>What's included in your ${tier} plan:</h3>
      ${tier === 'pro' ? `
        <ul>
          <li>Multiple project support</li>
          <li>Real-time Git integration</li>
          <li>Advanced context detection</li>
          <li>Email support</li>
        </ul>
      ` : `
        <ul>
          <li>Unlimited projects</li>
          <li>Team collaboration features</li>
          <li>Admin dashboard</li>
          <li>Priority support</li>
          <li>Custom integrations</li>
        </ul>
      `}
      
      <p>If you need help getting started, reply to this email or visit our <a href="${process.env.NEXT_PUBLIC_APP_URL}/support">support center</a>.</p>
      
      <p>Happy coding!<br>The FileBridge Team</p>
    `;

    await sendEmail(user.email, subject, content);
  }

  private async sendSubscriptionReactivatedEmail(user: any, tier: string): Promise<void> {
    const subject = 'Your FileBridge subscription has been reactivated';
    
    const content = `
      <h2>Welcome back to FileBridge!</h2>
      <p>Great news! Your FileBridge ${tier} subscription has been successfully reactivated.</p>
      <p>You can now continue using all your ${tier} features without interruption.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">Access your dashboard</a></p>
    `;

    await sendEmail(user.email, subject, content);
  }

  private async sendCancellationEmail(user: any, tier: string): Promise<void> {
    const subject = 'Your FileBridge subscription has been canceled';
    
    const content = `
      <h2>Sorry to see you go!</h2>
      <p>Your FileBridge ${tier} subscription has been canceled as requested.</p>
      <p>Your access will continue until the end of your current billing period.</p>
      <p>If you change your mind, you can resubscribe anytime at <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing">our pricing page</a>.</p>
      <p>We'd love to hear your feedback about how we can improve FileBridge.</p>
    `;

    await sendEmail(user.email, subject, content);
  }

  private async sendPaymentFailedEmail(user: any, tier: string): Promise<void> {
    const subject = 'Payment failed for your FileBridge subscription';
    
    const content = `
      <h2>Payment Issue with Your FileBridge Subscription</h2>
      <p>We had trouble processing your payment for FileBridge ${tier}.</p>
      <p>To avoid service interruption, please update your payment method in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing">billing dashboard</a>.</p>
      <p>If you need assistance, please contact our support team.</p>
      <p>Thank you for using FileBridge!</p>
    `;

    await sendEmail(user.email, subject, content);
  }
}

export const dodoWebhookHandler = new DodoWebhookHandler();
