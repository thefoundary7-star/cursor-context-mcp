// scripts/test-dodo-connection.js
// Updated test script with correct Dodo Payments endpoints

require('dotenv').config();
const axios = require('axios');

async function testDodoConnection() {
  console.log('🧪 Testing Dodo Payments connectivity...\n');
  
  const apiKey = process.env.DODO_API_KEY;
  const environment = process.env.DODO_ENVIRONMENT || 'sandbox';
  
  if (!apiKey) {
    console.error('❌ DODO_API_KEY not found in environment variables');
    console.log('💡 Add your Dodo test API key to .env file');
    process.exit(1);
  }
  
  // Use correct endpoints from documentation
  const baseURL = environment === 'production' 
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';
    
  console.log(`🔗 Testing connection to: ${baseURL}`);
  console.log(`🔑 Using API key: ${apiKey.substring(0, 20)}...`);
  console.log(`🌍 Environment: ${environment}\n`);
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  try {
    // Test 1: List products (common endpoint)
    console.log('📋 Test 1: Fetching products...');
    const productsResponse = await axios.get(`${baseURL}/products`, {
      headers,
      timeout: 10000,
    });
    
    console.log('✅ Products API successful!');
    console.log(`   Found ${productsResponse.data.data?.length || 0} products`);
    if (productsResponse.data.data?.length > 0) {
      productsResponse.data.data.slice(0, 3).forEach(product => {
        console.log(`   - ${product.name}: $${product.pricing?.amount ? product.pricing.amount/100 : 'N/A'}`);
      });
    }
    console.log('');
    
    // Test 2: Test customer creation
    console.log('👤 Test 2: Creating test customer...');
    const customerResponse = await axios.post(`${baseURL}/customers`, {
      email: `test-${Date.now()}@filebridge-test.com`,
      name: 'FileBridge Test Customer',
      metadata: {
        source: 'integration_test',
        timestamp: new Date().toISOString(),
        test: 'true'
      }
    }, {
      headers,
      timeout: 10000,
    });
    
    console.log('✅ Customer created successfully!');
    console.log(`   Customer ID: ${customerResponse.data.id || customerResponse.data.customer_id}`);
    console.log(`   Email: ${customerResponse.data.email}\n`);
    
    // Test 3: Test subscription creation (if we have products)
    if (productsResponse.data.data?.length > 0) {
      console.log('📊 Test 3: Testing subscription creation...');
      const testProduct = productsResponse.data.data[0];
      
      try {
        const subscriptionResponse = await axios.post(`${baseURL}/subscriptions`, {
          customer_id: customerResponse.data.id || customerResponse.data.customer_id,
          product_id: testProduct.id,
          payment_link: true, // Get payment link instead of immediate charge
          return_url: 'https://test.filebridge.com/success',
          metadata: {
            test: 'true',
            purpose: 'integration_test'
          }
        }, {
          headers,
          timeout: 10000,
        });
        
        console.log('✅ Subscription creation successful!');
        console.log(`   Subscription ID: ${subscriptionResponse.data.subscription_id}`);
        console.log(`   Payment Link: ${subscriptionResponse.data.payment_link}`);
        console.log('');
        
      } catch (subError) {
        console.log('⚠️  Subscription test skipped (may need billing setup)');
        console.log(`   ${subError.response?.data?.message || subError.message}`);
        console.log('');
      }
    }
    
    console.log('🎉 Dodo Payments integration test completed successfully!');
    console.log('\n📋 Next steps for FileBridge:');
    console.log('1. Create FileBridge Pro ($19/month) and Enterprise ($99/month) products');
    console.log('2. Set up webhook endpoint for subscription events');
    console.log('3. Implement license key generation on subscription.active');
    console.log('4. Test complete customer journey from signup to license delivery');
    console.log('\n🔗 Useful Dodo endpoints for FileBridge:');
    console.log(`   Dashboard: https://dashboard.dodopayments.com`);
    console.log(`   API Docs: https://docs.dodopayments.com`);
    console.log(`   Webhooks: ${baseURL}/webhooks`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      
      // Specific error handling based on Dodo documentation
      if (error.response.status === 401) {
        console.log('\n💡 Authentication error - check your API key:');
        console.log('   1. Verify DODO_API_KEY in your .env file');
        console.log('   2. Ensure you\'re using the correct environment (test/live)');
        console.log('   3. Check if your API key has proper permissions');
      } else if (error.response.status === 403) {
        console.log('\n💡 Permission error:');
        console.log('   1. Your API key may not have required permissions');
        console.log('   2. Your account may need additional verification');
        console.log('   3. Contact Dodo support if account is approved');
      }
    }
    
    console.log('\n📞 Support contacts:');
    console.log('   Email: support@dodopayments.com');
    console.log('   Docs: https://docs.dodopayments.com');
    
    process.exit(1);
  }
}

if (require.main === module) {
  testDodoConnection();
}

module.exports = { testDodoConnection };
