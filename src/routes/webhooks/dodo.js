// src/routes/webhooks/dodo.js
// Dodo Payments webhook handler for FileBridge subscriptions

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Raw body parser middleware for webhook signature verification
router.use(express.raw({ type: 'application/json' }));

router.post('/', async (req, res) => {
  console.log('Received Dodo webhook:', new Date().toISOString());
  
  try {
    // Extract headers for signature verification
    const webhookId = req.headers['webhook-id'];
    const webhookSignature = req.headers['webhook-signature'];
    const webhookTimestamp = req.headers['webhook-timestamp'];
    
    console.log('Webhook headers:', { webhookId, webhookSignature, webhookTimestamp });
    
    // Verify webhook signature (implement this based on Dodo's spec)
    const rawBody = req.body.toString();
    const isValid = verifyWebhookSignature(rawBody, webhookSignature, webhookTimestamp);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    // Parse the verified payload
    const event = JSON.parse(rawBody);
    console.log('Event type:', event.type);
    console.log('Event data:', JSON.stringify(event.data, null, 2));
    
    // Handle different webhook events
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event.data);
        break;
        
      case 'subscription.activated':
        await handleSubscriptionActivated(event.data);
        break;
        
      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionCancelled(event.data);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(event.data);
        break;
        
      case 'payment.succeeded':
        await handlePaymentSucceeded(event.data);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true, event_type: event.type });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Verify webhook signature using HMAC SHA256
function verifyWebhookSignature(body, signature, timestamp) {
  try {
    // Construct the payload for verification: webhook-id.webhook-timestamp.body
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('DODO_WEBHOOK_SECRET not configured');
      return false;
    }
    
    // Extract the actual signature from the header (format: "v1,signature")
    const signatureParts = signature.split(',');
    const actualSignature = signatureParts[1];
    
    // Create the expected signature
    const payload = `${req.headers['webhook-id']}.${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(actualSignature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Event handlers
async function handleSubscriptionCreated(data) {
  console.log('New subscription created:', data.subscription_id);
  console.log('Customer:', data.customer_email);
  console.log('Product:', data.product_name);
  console.log('Amount:', `$${data.amount / 100}`);
}

async function handleSubscriptionActivated(data) {
  console.log('Subscription activated - delivering license key');
  
  try {
    // Determine product tier
    const productId = data.product_id;
    let tier = 'unknown';
    
    if (productId === process.env.DODO_PRO_PRODUCT_ID) {
      tier = 'pro';
    } else if (productId === process.env.DODO_ENTERPRISE_PRODUCT_ID) {
      tier = 'enterprise';
    }
    
    console.log('Product tier:', tier);
    
    // Generate license key
    const licenseKey = generateLicenseKey(tier, data.customer_email, data.subscription_id);
    
    // Store in database
    await storeLicense({
      subscriptionId: data.subscription_id,
      customerId: data.customer_id,
      customerEmail: data.customer_email,
      productId: productId,
      tier: tier,
      licenseKey: licenseKey,
      status: 'active',
      createdAt: new Date()
    });
    
    // Send license key via email
    await sendLicenseKeyEmail({
      email: data.customer_email,
      licenseKey: licenseKey,
      tier: tier,
      productName: data.product_name
    });
    
    console.log('License key delivered successfully');
    
  } catch (error) {
    console.error('Failed to deliver license key:', error);
  }
}

async function handleSubscriptionCancelled(data) {
  console.log('Subscription cancelled/expired:', data.subscription_id);
  
  try {
    await revokeLicense(data.subscription_id);
    console.log('License access revoked');
  } catch (error) {
    console.error('Failed to revoke license:', error);
  }
}

async function handlePaymentFailed(data) {
  console.log('Payment failed for subscription:', data.subscription_id);
  console.log('Failed amount:', `$${data.amount / 100}`);
}

async function handlePaymentSucceeded(data) {
  console.log('Payment succeeded for subscription:', data.subscription_id);
  console.log('Amount:', `$${data.amount / 100}`);
}

// Helper functions
function generateLicenseKey(tier, email, subscriptionId) {
  const timestamp = Date.now();
  const hash = crypto.createHash('sha256')
    .update(`${tier}-${email}-${subscriptionId}-${timestamp}`)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  
  return `FB-${tier.toUpperCase()}-${hash}`;
}

async function storeLicense(licenseData) {
  console.log('Storing license:', licenseData.licenseKey);
  // TODO: Implement database storage
}

async function revokeLicense(subscriptionId) {
  console.log('Revoking license for subscription:', subscriptionId);
  // TODO: Update database to mark license as inactive
}

async function sendLicenseKeyEmail({ email, licenseKey, tier, productName }) {
  console.log('Sending license key email to:', email);
  console.log('License key:', licenseKey);
  // TODO: Implement email sending with setup instructions
}

module.exports = router;
