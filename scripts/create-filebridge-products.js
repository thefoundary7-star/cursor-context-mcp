// scripts/create-filebridge-products.js
// Create FileBridge Pro and Enterprise products in Dodo Payments

require('dotenv').config();
const axios = require('axios');

async function createFileBridgeProducts() {
  console.log('🚀 Creating FileBridge products in Dodo Payments...\n');
  
  const apiKey = process.env.DODO_API_KEY;
  const environment = process.env.DODO_ENVIRONMENT || 'sandbox';
  
  if (!apiKey) {
    console.error('❌ DODO_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  const baseURL = environment === 'production' 
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  try {
    // Create FileBridge Pro
    console.log('📦 Creating FileBridge Pro product...');
    const proProduct = await axios.post(`${baseURL}/products`, {
      name: 'FileBridge Pro',
      description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
      type: 'subscription',
      pricing: {
        amount: 1900, // $19.00 in cents
        currency: 'USD',
        interval: 'monthly',
      },
      tax_category: 'software',
      metadata: {
        tier: 'pro',
        max_projects: '10',
        support_level: 'email',
        features: 'Multiple projects, Git integration, Context detection, Email support'
      },
    }, { headers });
    
    console.log('✅ FileBridge Pro created successfully!');
    console.log(`   Product ID: ${proProduct.data.id}`);
    console.log(`   Price: $${proProduct.data.pricing.amount/100}/${proProduct.data.pricing.interval}`);
    console.log('');
    
    // Create FileBridge Enterprise
    console.log('🏢 Creating FileBridge Enterprise product...');
    const enterpriseProduct = await axios.post(`${baseURL}/products`, {
      name: 'FileBridge Enterprise',
      description: 'Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.',
      type: 'subscription',
      pricing: {
        amount: 9900, // $99.00 in cents
        currency: 'USD',
        interval: 'monthly',
      },
      tax_category: 'software',
      metadata: {
        tier: 'enterprise',
        max_projects: 'unlimited',
        support_level: 'priority',
        team_features: 'true',
        features: 'Unlimited projects, Team collaboration, Admin dashboard, Priority support, Custom integrations'
      },
    }, { headers });
    
    console.log('✅ FileBridge Enterprise created successfully!');
    console.log(`   Product ID: ${enterpriseProduct.data.id}`);
    console.log(`   Price: $${enterpriseProduct.data.pricing.amount/100}/${enterpriseProduct.data.pricing.interval}`);
    console.log('');
    
    // Display environment variable updates
    console.log('🔧 Add these to your .env file:');
    console.log('');
    console.log(`DODO_PRO_PRODUCT_ID="${proProduct.data.id}"`);
    console.log(`DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"`);
    console.log('');
    
    // Create .env update snippet
    const envUpdate = `
# Update your .env file with these product IDs:
DODO_PRO_PRODUCT_ID="${proProduct.data.id}"
DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"
`;
    
    const fs = require('fs');
    fs.writeFileSync('product-ids.env', envUpdate.trim());
    
    console.log('💾 Product IDs saved to product-ids.env file');
    console.log('📋 Copy these values to your main .env file');
    console.log('');
    
    // Test creating a subscription with payment link
    console.log('🧪 Testing subscription creation with payment link...');
    try {
      const testSubscription = await axios.post(`${baseURL}/subscriptions`, {
        customer: {
          email: 'test-subscription@filebridge.com',
          name: 'Test FileBridge User'
        },
        product_id: proProduct.data.id,
        payment_link: true,
        return_url: 'https://test.filebridge.com/success',
        metadata: {
          source: 'test_integration',
          tier: 'pro'
        }
      }, { headers });
      
      console.log('✅ Test subscription created!');
      console.log(`   Subscription ID: ${testSubscription.data.subscription_id}`);
      console.log(`   Payment Link: ${testSubscription.data.payment_link}`);
      console.log('');
      
    } catch (subError) {
      console.log('⚠️  Subscription test failed (this may be normal):');
      console.log(`   ${subError.response?.data?.message || subError.message}`);
      console.log('');
    }
    
    console.log('🎉 FileBridge products created successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Copy the product IDs to your .env file');
    console.log('2. Set up webhook endpoint: /api/webhooks/dodo');
    console.log('3. Configure webhook URL in Dodo dashboard');
    console.log('4. Test complete customer subscription flow');
    console.log('5. Implement license key delivery on subscription.active event');
    
    return {
      pro: proProduct.data,
      enterprise: enterpriseProduct.data
    };
    
  } catch (error) {
    console.error('❌ Failed to create products:', error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 400) {
        console.log('\n💡 Bad Request - check the product data format');
        console.log('   This might be due to Dodo API expecting different field names');
        console.log('   Check the API documentation for the exact product schema');
      }
    }
    
    console.log('\n💡 Troubleshooting:');
    console.log('- Verify your Dodo account has product creation permissions');
    console.log('- Check if products with these names already exist');
    console.log('- Review the Dodo API documentation for product creation');
    console.log('- Contact Dodo support if issues persist');
    
    process.exit(1);
  }
}

if (require.main === module) {
  createFileBridgeProducts();
}

module.exports = { createFileBridgeProducts };
