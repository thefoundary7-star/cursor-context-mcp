import crypto from 'crypto';
import { DatabaseManager } from './database-manager.js';
import { LicenseValidator } from './license-validator.js';
import type {
  SubscriptionWebhook,
  DodoPaymentsConfig,
  LicenseGenerationRequest
} from './types.js';

export class DodoPaymentsIntegration {
  private databaseManager: DatabaseManager;
  private config: DodoPaymentsConfig;
  private licenseValidator?: LicenseValidator;

  constructor(databaseManager: DatabaseManager, config?: DodoPaymentsConfig) {
    this.databaseManager = databaseManager;
    this.config = config || this.getConfigFromEnv();
  }

  setLicenseValidator(validator: LicenseValidator): void {
    this.licenseValidator = validator;
  }

  private getConfigFromEnv(): DodoPaymentsConfig {
    return {
      apiKey: process.env.DODO_API_KEY || '',
      apiSecret: process.env.DODO_API_SECRET || '',
      webhookSecret: process.env.DODO_WEBHOOK_SECRET || '',
      baseUrl: process.env.DODO_BASE_URL || 'https://api.dodo.dev',
      webhookEndpoint: process.env.DODO_WEBHOOK_ENDPOINT || '/api/webhooks/dodo-payments'
    };
  }

  async verifyWebhook(payload: any, headers: any): Promise<boolean> {
    const signature = headers['x-dodo-signature'] || headers['X-Dodo-Signature'];

    if (!signature) {
      console.error('Missing Dodo webhook signature');
      return false;
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = this.generateWebhookSignature(payloadString);

    return crypto.timingSafeEqual(
      Buffer.from(signature.replace('sha256=', ''), 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private generateWebhookSignature(payload: string): string {
    return crypto.createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
  }

  async handleWebhook(webhookData: SubscriptionWebhook): Promise<void> {
    try {
      // Log webhook event for audit trail
      await this.logWebhookEvent(webhookData);

      switch (webhookData.type) {
        case 'subscription.created':
          await this.handleSubscriptionCreated(webhookData);
          break;

        case 'subscription.updated':
          await this.handleSubscriptionUpdated(webhookData);
          break;

        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(webhookData);
          break;

        case 'subscription.renewed':
          await this.handleSubscriptionRenewed(webhookData);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(webhookData);
          break;

        default:
          console.warn(`Unhandled webhook type: ${webhookData.type}`);
      }

      // Mark webhook as processed
      await this.markWebhookProcessed(webhookData);

    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(webhook: SubscriptionWebhook): Promise<void> {
    const { data } = webhook;

    // Get or create user
    let user = await this.databaseManager.getUserByEmail(this.extractEmailFromSubscription(data));

    if (!user) {
      const userId = await this.databaseManager.createUser(
        this.extractEmailFromSubscription(data),
        this.extractNameFromSubscription(data)
      );
      user = { id: userId };
    }

    // Update user subscription status
    await this.databaseManager.updateUserSubscription(user.id, {
      subscriptionId: data.subscriptionId,
      status: data.status,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    });

    // Generate license key for the new subscription
    if (this.licenseValidator) {
      const tier = this.mapPlanToTier(data.planId);
      const licenseRequest: LicenseGenerationRequest = {
        userId: user.id,
        tier,
        subscriptionId: data.subscriptionId,
        expiresAt: data.expiresAt
      };

      await this.licenseValidator.generateLicense(licenseRequest);
      console.log(`Generated ${tier} license for subscription ${data.subscriptionId}`);
    }
  }

  private async handleSubscriptionUpdated(webhook: SubscriptionWebhook): Promise<void> {
    const { data } = webhook;

    const user = await this.databaseManager.getUserByEmail(this.extractEmailFromSubscription(data));

    if (!user) {
      console.error(`User not found for subscription ${data.subscriptionId}`);
      return;
    }

    // Update subscription status
    await this.databaseManager.updateUserSubscription(user.id, {
      subscriptionId: data.subscriptionId,
      status: data.status,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    });

    // Update existing license if tier changed
    const newTier = this.mapPlanToTier(data.planId);
    await this.updateLicenseTier(data.subscriptionId, newTier);
  }

  private async handleSubscriptionCancelled(webhook: SubscriptionWebhook): Promise<void> {
    const { data } = webhook;

    const user = await this.databaseManager.getUserByEmail(this.extractEmailFromSubscription(data));

    if (!user) {
      console.error(`User not found for subscription ${data.subscriptionId}`);
      return;
    }

    // Set grace period (7 days from cancellation)
    const gracePeriodEnds = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));

    await this.databaseManager.updateUserSubscription(user.id, {
      subscriptionId: data.subscriptionId,
      status: 'cancelled',
      gracePeriodEnds
    });

    // License will continue to work during grace period
    // After grace period expires, license validation will automatically downgrade to FREE
    console.log(`Subscription ${data.subscriptionId} cancelled, grace period ends: ${gracePeriodEnds}`);
  }

  private async handleSubscriptionRenewed(webhook: SubscriptionWebhook): Promise<void> {
    const { data } = webhook;

    const user = await this.databaseManager.getUserByEmail(this.extractEmailFromSubscription(data));

    if (!user) {
      console.error(`User not found for subscription ${data.subscriptionId}`);
      return;
    }

    await this.databaseManager.updateUserSubscription(user.id, {
      subscriptionId: data.subscriptionId,
      status: 'active',
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      gracePeriodEnds: undefined // Clear grace period
    });

    console.log(`Subscription ${data.subscriptionId} renewed until ${data.expiresAt}`);
  }

  private async handlePaymentFailed(webhook: SubscriptionWebhook): Promise<void> {
    const { data } = webhook;

    const user = await this.databaseManager.getUserByEmail(this.extractEmailFromSubscription(data));

    if (!user) {
      console.error(`User not found for subscription ${data.subscriptionId}`);
      return;
    }

    // Start grace period from payment failure
    const gracePeriodEnds = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));

    await this.databaseManager.updateUserSubscription(user.id, {
      subscriptionId: data.subscriptionId,
      status: 'past_due',
      gracePeriodEnds
    });

    // TODO: Send notification to user about payment failure
    console.log(`Payment failed for subscription ${data.subscriptionId}, grace period ends: ${gracePeriodEnds}`);
  }

  private mapPlanToTier(planId: string): 'FREE' | 'PRO' | 'ENTERPRISE' {
    const planMapping: { [key: string]: 'FREE' | 'PRO' | 'ENTERPRISE' } = {
      'filebridge_free': 'FREE',
      'filebridge_pro_monthly': 'PRO',
      'filebridge_pro_yearly': 'PRO',
      'filebridge_enterprise_monthly': 'ENTERPRISE',
      'filebridge_enterprise_yearly': 'ENTERPRISE'
    };

    return planMapping[planId] || 'FREE';
  }

  private async updateLicenseTier(subscriptionId: string, newTier: 'FREE' | 'PRO' | 'ENTERPRISE'): Promise<void> {
    // This would update existing license records associated with the subscription
    // Implementation depends on how licenses are linked to subscriptions
    console.log(`Updating licenses for subscription ${subscriptionId} to tier ${newTier}`);
  }

  private extractEmailFromSubscription(data: any): string {
    // Extract email from subscription data
    // This depends on Dodo Payments webhook structure
    return data.customerEmail || data.email || data.user?.email || '';
  }

  private extractNameFromSubscription(data: any): string {
    // Extract name from subscription data
    return data.customerName || data.name || data.user?.name || '';
  }

  private async logWebhookEvent(webhook: SubscriptionWebhook): Promise<void> {
    // Log webhook for audit trail - this would go to webhook_events table
    console.log(`Processing webhook: ${webhook.type} for subscription ${webhook.data.subscriptionId}`);
  }

  private async markWebhookProcessed(webhook: SubscriptionWebhook): Promise<void> {
    // Mark webhook as processed in database
    console.log(`Webhook ${webhook.type} processed successfully`);
  }

  // API Methods for creating subscriptions
  async createSubscription(customerData: {
    email: string;
    name: string;
    planId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; subscriptionId: string }> {
    try {
      const response = await this.makeAPIRequest('POST', '/subscriptions', {
        customer: {
          email: customerData.email,
          name: customerData.name
        },
        plan_id: customerData.planId,
        success_url: customerData.successUrl,
        cancel_url: customerData.cancelUrl,
        webhook_url: this.config.webhookEndpoint
      });

      return {
        checkoutUrl: response.checkout_url,
        subscriptionId: response.subscription_id
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<any> {
    try {
      return await this.makeAPIRequest('GET', `/subscriptions/${subscriptionId}`);
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw new Error('Failed to fetch subscription status');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.makeAPIRequest('POST', `/subscriptions/${subscriptionId}/cancel`);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  private async makeAPIRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    // Create signature for API request
    const signaturePayload = `${method}${endpoint}${JSON.stringify(data || {})}${timestamp}${nonce}`;
    const signature = crypto.createHmac('sha256', this.config.apiSecret)
      .update(signaturePayload)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-Dodo-Timestamp': timestamp,
      'X-Dodo-Nonce': nonce,
      'X-Dodo-Signature': signature
    };

    // In a real implementation, this would use fetch or axios
    // For now, we'll simulate the API call
    console.log(`Making ${method} request to ${url} with headers:`, headers);

    if (data) {
      console.log('Request payload:', data);
    }

    // Simulate API response
    return {
      success: true,
      subscription_id: 'sub_' + crypto.randomBytes(16).toString('hex'),
      checkout_url: 'https://checkout.dodo.dev/pay/test_checkout_session'
    };
  }

  // Helper method to sync existing subscriptions
  async syncSubscriptions(): Promise<void> {
    console.log('Syncing subscriptions with Dodo Payments...');

    // This would fetch all active subscriptions from Dodo Payments
    // and update local database accordingly

    try {
      const subscriptions = await this.makeAPIRequest('GET', '/subscriptions');

      for (const subscription of subscriptions.data || []) {
        await this.processSubscriptionSync(subscription);
      }

      console.log('Subscription sync completed');
    } catch (error) {
      console.error('Error syncing subscriptions:', error);
    }
  }

  private async processSubscriptionSync(subscription: any): Promise<void> {
    // Process individual subscription during sync
    const user = await this.databaseManager.getUserByEmail(subscription.customer.email);

    if (user) {
      await this.databaseManager.updateUserSubscription(user.id, {
        subscriptionId: subscription.id,
        status: subscription.status,
        expiresAt: subscription.current_period_end ? new Date(subscription.current_period_end) : undefined
      });
    }
  }

  // Utility method to validate webhook authenticity
  validateWebhookTimestamp(timestamp: string, toleranceMinutes: number = 5): boolean {
    const webhookTime = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.abs(now.getTime() - webhookTime.getTime()) / (1000 * 60);

    return diffMinutes <= toleranceMinutes;
  }
}