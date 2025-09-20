#!/usr/bin/env node

require('dotenv').config();
const Stripe = require('stripe');

async function testStripeConfiguration() {
  console.log('🔵 Testing Stripe Configuration...\n');

  // Check environment variables
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
    return;
  }

  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    console.error('❌ STRIPE_PUBLISHABLE_KEY not found in environment variables');
    return;
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // Test 1: API Connection
    console.log('1. Testing API connection...');
    const balance = await stripe.balance.retrieve();
    console.log('✅ Stripe API connection successful');
    console.log(`   Available balance: ${balance.available[0]?.amount || 0} ${balance.available[0]?.currency || 'usd'}`);

    // Test 2: Create test customer
    console.log('\n2. Testing customer creation...');
    const customer = await stripe.customers.create({
      email: 'test@mcpserver.com',
      name: 'Test Customer',
      description: 'Test customer for MCP Server platform'
    });
    console.log(`✅ Customer created successfully: ${customer.id}`);

    // Test 3: Create subscription (if products exist)
    console.log('\n3. Testing subscription creation...');
    try {
      const products = await stripe.products.list({ limit: 5 });
      if (products.data.length > 0) {
        console.log(`✅ Found ${products.data.length} products in Stripe`);
        products.data.forEach(product => {
          console.log(`   - ${product.name} (${product.id})`);
        });
      } else {
        console.log('⚠️  No products found. You need to create subscription products in Stripe Dashboard.');
        console.log('   Go to: https://dashboard.stripe.com/products');
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve products:', error.message);
    }

    // Test 4: Webhook endpoints (if configured)
    console.log('\n4. Testing webhook configuration...');
    try {
      const webhooks = await stripe.webhookEndpoints.list({ limit: 5 });
      if (webhooks.data.length > 0) {
        console.log(`✅ Found ${webhooks.data.length} webhook endpoints`);
        webhooks.data.forEach(webhook => {
          console.log(`   - ${webhook.url} (${webhook.status})`);
        });
      } else {
        console.log('⚠️  No webhook endpoints configured.');
        console.log('   Add webhook at: https://dashboard.stripe.com/webhooks');
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve webhooks:', error.message);
    }

    // Clean up test customer
    console.log('\n5. Cleaning up test data...');
    await stripe.customers.del(customer.id);
    console.log('✅ Test customer deleted');

    console.log('\n🎉 Stripe configuration test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Create subscription products if not done');
    console.log('2. Configure webhook endpoints');
    console.log('3. Test payment flows in your application');

  } catch (error) {
    console.error('\n❌ Stripe test failed:', error.message);
    
    if (error.code === 'invalid_api_key') {
      console.log('\nTroubleshooting:');
      console.log('- Check that your STRIPE_SECRET_KEY is correct');
      console.log('- Ensure you\'re using the right key for test/live mode');
      console.log('- Verify the key starts with sk_test_ or sk_live_');
    }
  }
}

// Run the test
testStripeConfiguration().catch(console.error);