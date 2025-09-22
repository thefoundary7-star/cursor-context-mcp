import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { userManagementService } from '@/services/user/userManagementService';
import { productionEmailService } from '@/services/email/productionEmailService';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  console.log('Received Dodo webhook:', new Date().toISOString());

  try {
    // Extract headers for signature verification
    const webhookId = req.headers.get('webhook-id');
    const webhookSignature = req.headers.get('webhook-signature');
    const webhookTimestamp = req.headers.get('webhook-timestamp');

    console.log('Webhook headers:', { webhookId, webhookSignature, webhookTimestamp });

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, webhookSignature, webhookTimestamp, webhookId);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Parse the verified payload
    const event = JSON.parse(rawBody);
    console.log('Event type:', event.type);
    console.log('Event data:', JSON.stringify(event.data, null, 2));

    // Store webhook event in database
    await storeWebhookEvent({
      dodoEventId: webhookId || crypto.randomUUID(),
      eventType: event.type,
      payload: event,
      processed: false,
      createdAt: new Date()
    });

    // Handle different webhook events
    let processingResult = null;
    switch (event.type) {
      case 'subscription.created':
        processingResult = await handleSubscriptionCreated(event.data);
        break;

      case 'subscription.activated':
        processingResult = await handleSubscriptionActivated(event.data);
        break;

      case 'subscription.cancelled':
      case 'subscription.expired':
        processingResult = await handleSubscriptionCancelled(event.data);
        break;

      case 'payment.failed':
        processingResult = await handlePaymentFailed(event.data);
        break;

      case 'payment.succeeded':
        processingResult = await handlePaymentSucceeded(event.data);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        processingResult = { handled: false, message: `Unhandled event type: ${event.type}` };
    }

    // Update webhook event as processed (commented out for testing)
    // if (webhookId) {
    //   await updateWebhookEventProcessed(webhookId, true, processingResult);
    // }

    // Always respond with 200 to acknowledge receipt
    return NextResponse.json({
      received: true,
      event_type: event.type,
      processing_result: processingResult
    });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Try to store failed webhook event
    try {
      await storeWebhookEvent({
        eventId: crypto.randomUUID(),
        eventType: 'error',
        payload: { error: error.message },
        processed: false,
        createdAt: new Date()
      });
    } catch (dbError) {
      console.error('Failed to store webhook error:', dbError);
    }

    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}

// Verify webhook signature using HMAC SHA256
function verifyWebhookSignature(body: string, signature: string | null, timestamp: string | null, webhookId: string | null): boolean {
  try {
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('DODO_WEBHOOK_SECRET not configured');
      return false;
    }

    if (!signature || !timestamp || !webhookId) {
      console.error('Missing required webhook headers');
      return false;
    }

    // Extract the actual signature from the header (format: "t=timestamp,v1=signature")
    const signatureParts = signature.split(',');
    if (signatureParts.length < 2) {
      console.error('Invalid signature format');
      return false;
    }

    // Find the v1 signature
    let actualSignature = '';
    for (const part of signatureParts) {
      if (part.startsWith('v1=')) {
        actualSignature = part.substring(3);
        break;
      }
    }

    if (!actualSignature) {
      console.error('No v1 signature found');
      return false;
    }

    // Create the expected signature: timestamp.body (as per Dodo's spec)
    const payload = `${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(actualSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    console.log('Signature verification:', isValid ? 'VALID' : 'INVALID');
    return isValid;

  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Event handlers
async function handleSubscriptionCreated(data: any) {
  console.log('New subscription created:', data.subscription_id);
  console.log('Customer:', data.customer_email);
  console.log('Product:', data.product_name);
  console.log('Amount:', `$${data.amount / 100}`);

  try {
    // Create or update user from webhook data
    const user = await userManagementService.createOrUpdateUserFromWebhook({
      email: data.customer_email,
      customerId: data.customer_id,
      subscriptionId: data.subscription_id,
      productId: data.product_id,
      plan: getTierFromProductId(data.product_id),
      customerName: data.customer_name,
      company: data.customer_company
    });

    // Create subscription linked to user
    const subscription = await userManagementService.createSubscriptionForUser(user.id, {
      dodoSubscriptionId: data.subscription_id,
      dodoCustomerId: data.customer_id,
      dodoProductId: data.product_id,
      tier: getTierFromProductId(data.product_id),
      status: 'created',
      currentPeriodStart: new Date(data.current_period_start * 1000),
      currentPeriodEnd: new Date(data.current_period_end * 1000),
      metadata: {
        amount: data.amount,
        currency: data.currency || 'USD',
        product_name: data.product_name
      }
    });

    console.log('Subscription created and linked to user:', {
      userId: user.id,
      subscriptionId: subscription.id,
      dodoSubscriptionId: data.subscription_id
    });

    return { 
      handled: true, 
      message: 'Subscription created successfully',
      userId: user.id,
      subscriptionId: subscription.id
    };
  } catch (error) {
    console.error('Failed to store subscription:', error);
    return { handled: false, error: error.message };
  }
}

async function handleSubscriptionActivated(data: any) {
  console.log('Subscription activated - delivering license key');

  try {
    // Get user by Dodo customer ID
    const user = await userManagementService.getUserByDodoCustomerId(data.customer_id);
    if (!user) {
      throw new Error(`User not found for customer ID: ${data.customer_id}`);
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: data.subscription_id }
    });
    if (!subscription) {
      throw new Error(`Subscription not found: ${data.subscription_id}`);
    }

    // Determine product tier
    const tier = getTierFromProductId(data.product_id);
    console.log('Product tier:', tier);

    // Create license for user
    const license = await userManagementService.createLicenseForUser(user.id, subscription.id, {
      tier,
      name: `${tier.toUpperCase()} License - ${user.email}`,
      description: `Generated from Dodo subscription ${data.subscription_id}`,
      expiresAt: new Date(data.current_period_end * 1000)
    });

    // Update subscription with license key and active status
    await userManagementService.updateSubscriptionStatus(data.subscription_id, 'active', {
      lastPaymentAt: new Date()
    });

    // Send license key via email
    const emailSent = await userManagementService.sendLicenseKeyEmail(user, license, subscription);
    
    console.log('License key generated and delivered:', {
      licenseKey: license.licenseKey,
      userId: user.id,
      emailSent
    });

    return {
      handled: true,
      message: 'License key delivered successfully',
      licenseKey: license.licenseKey,
      userId: user.id,
      emailSent
    };

  } catch (error) {
    console.error('Failed to deliver license key:', error);
    return { handled: false, error: error.message };
  }
}

async function handleSubscriptionCancelled(data: any) {
  console.log('Subscription cancelled/expired:', data.subscription_id);

  try {
    // Get subscription and user
    const subscription = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: data.subscription_id },
      include: { user: true }
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${data.subscription_id}`);
    }

    // Update subscription status
    await userManagementService.updateSubscriptionStatus(data.subscription_id, 'cancelled', {
      canceledAt: new Date(),
      cancellationReason: data.cancellation_reason
    });

    // Revoke license
    await userManagementService.revokeLicense(data.subscription_id);

    // Send cancellation email to user
    if (subscription.user) {
      await userManagementService.sendSubscriptionCancelledEmail(
        subscription.user,
        subscription,
        data.cancellation_reason
      );
    }

    console.log('Subscription cancelled and license revoked:', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      emailSent: !!subscription.user
    });

    return { 
      handled: true, 
      message: 'Subscription cancelled and license revoked',
      userId: subscription.userId,
      emailSent: !!subscription.user
    };

  } catch (error) {
    console.error('Failed to revoke license:', error);
    return { handled: false, error: error.message };
  }
}

async function handlePaymentFailed(data: any) {
  console.log('Payment failed for subscription:', data.subscription_id);
  console.log('Failed amount:', `$${data.amount / 100}`);

  try {
    // Get subscription and user
    const subscription = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: data.subscription_id },
      include: { user: true }
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${data.subscription_id}`);
    }

    // Store payment failure record
    await prisma.payment.create({
      data: {
        dodoPaymentId: data.payment_id || crypto.randomUUID(),
        subscriptionId: data.subscription_id,
        userId: subscription.userId,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: 'failed',
        failureReason: data.failure_reason || 'Unknown',
        createdAt: new Date()
      }
    });

    // Send payment failed email to user
    if (subscription.user) {
      await userManagementService.sendPaymentFailedEmail(
        subscription.user,
        subscription,
        {
          amount: data.amount,
          currency: data.currency || 'USD',
          failureReason: data.failure_reason
        }
      );
    }

    console.log('Payment failure recorded and email sent:', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      emailSent: !!subscription.user
    });

    return { 
      handled: true, 
      message: 'Payment failure recorded',
      userId: subscription.userId,
      emailSent: !!subscription.user
    };

  } catch (error) {
    console.error('Failed to record payment failure:', error);
    return { handled: false, error: error.message };
  }
}

async function handlePaymentSucceeded(data: any) {
  console.log('Payment succeeded for subscription:', data.subscription_id);
  console.log('Amount:', `$${data.amount / 100}`);

  try {
    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: data.subscription_id }
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${data.subscription_id}`);
    }

    // Store successful payment record
    await prisma.payment.create({
      data: {
        dodoPaymentId: data.payment_id || crypto.randomUUID(),
        subscriptionId: data.subscription_id,
        userId: subscription.userId,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: 'succeeded',
        paidAt: new Date(),
        createdAt: new Date()
      }
    });

    // Update subscription with last payment date
    await userManagementService.updateSubscriptionStatus(data.subscription_id, 'active', {
      lastPaymentAt: new Date()
    });

    console.log('Payment recorded successfully:', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amount: data.amount
    });

    return { 
      handled: true, 
      message: 'Payment recorded successfully',
      userId: subscription.userId
    };

  } catch (error) {
    console.error('Failed to record payment:', error);
    return { handled: false, error: error.message };
  }
}

// Helper functions
function getTierFromProductId(productId: string): string {
  if (productId === process.env.DODO_PRO_PRODUCT_ID) {
    return 'pro';
  } else if (productId === process.env.DODO_ENTERPRISE_PRODUCT_ID) {
    return 'enterprise';
  }
  return 'unknown';
}

function generateLicenseKey(tier: string, email: string, subscriptionId: string): string {
  const timestamp = Date.now();
  const hash = crypto.createHash('sha256')
    .update(`${tier}-${email}-${subscriptionId}-${timestamp}`)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();

  return `FB-${tier.toUpperCase()}-${hash}`;
}

async function storeWebhookEvent(eventData: {
  dodoEventId: string;
  eventType: string;
  payload: any;
  processed: boolean;
  createdAt: Date;
}) {
  try {
    await prisma.webhookEvent.create({
      data: {
        dodoEventId: eventData.dodoEventId,
        eventType: eventData.eventType,
        data: JSON.stringify(eventData.payload),
        processed: eventData.processed,
        attempts: 1
      }
    });
  } catch (error) {
    console.error('Failed to store webhook event:', error);
    // Don't throw here to avoid breaking webhook processing
  }
}

async function updateWebhookEventProcessed(dodoEventId: string, processed: boolean, result: any) {
  try {
    await prisma.webhookEvent.update({
      where: { dodoEventId },
      data: {
        processed,
        processedAt: new Date(),
        error: result?.error ? JSON.stringify(result) : null
      }
    });
  } catch (error) {
    console.error('Failed to update webhook event:', error);
    // Don't throw here to avoid breaking webhook processing
  }
}