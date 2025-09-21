// scripts/create-filebridge-products-safe.js
// Create FileBridge products with all required Dodo fields

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
    // First, let's check what tax categories are available
    console.log('🔍 Checking available fields and requirements...');
    
    // Try a minimal product first to see what's actually required
    console.log('📦 Creating FileBridge Pro product (minimal test)...');
    
    const proProductData = {
      name: 'FileBridge Pro',
      description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
      type: 'subscription',
      price: {
        type: 'recurring_price',
        price: 1900, // $19.00 in cents
        currency: 'USD',
        interval: 'monthly'
      },
      tax_category: 'saas'
    };
    
    console.log('Sending product data:', JSON.stringify(proProductData, null, 2));
    
    const proProduct = await axios.post(`${baseURL}/products`, proProductData, { headers });
    
    console.log('✅ FileBridge Pro created successfully!');
    console.log(`   Product ID: ${proProduct.data.id}`);
    console.log(`   Response:`, JSON.stringify(proProduct.data, null, 2));
    console.log('');
    
    // Now create Enterprise with the same structure
    console.log('🏢 Creating FileBridge Enterprise product...');
    
    const enterpriseProductData = {
      name: 'FileBridge Enterprise',
      description: 'Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.',
      type: 'subscription',
      price: {
        type: 'recurring_price',
        price: 9900, // $99.00 in cents
        currency: 'USD',
        interval: 'monthly'
      },
      tax_category: 'saas'
    };
    
    const enterpriseProduct = await axios.post(`${baseURL}/products`, enterpriseProductData, { headers });
    
    console.log('✅ FileBridge Enterprise created successfully!');
    console.log(`   Product ID: ${enterpriseProduct.data.id}`);
    console.log(`   Response:`, JSON.stringify(enterpriseProduct.data, null, 2));
    console.log('');
    
    // Display environment variable updates
    console.log('🔧 Add these to your .env file:');
    console.log('');
    console.log(`DODO_PRO_PRODUCT_ID="${proProduct.data.id}"`);
    console.log(`DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"`);
    console.log('');
    
    // Save to file
    const envUpdate = `
# FileBridge Product IDs for Dodo Payments
DODO_PRO_PRODUCT_ID="${proProduct.data.id}"
DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"
`;
    
    const fs = require('fs');
    fs.writeFileSync('product-ids.env', envUpdate.trim());
    
    console.log('💾 Product IDs saved to product-ids.env file');
    console.log('📋 Copy these values to your main .env file');
    console.log('');
    
    console.log('🎉 FileBridge products created successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Copy the product IDs to your .env file');
    console.log('2. Update your billing routes to use these product IDs');
    console.log('3. Set up webhook endpoint and configure in Dodo dashboard');
    console.log('4. Test subscription creation with payment links');
    
    return {
      pro: proProduct.data,
      enterprise: enterpriseProduct.data
    };
    
  } catch (error) {
    console.error('❌ Failed to create products:', error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.data?.code === 'INVALID_REQUEST_BODY') {
        console.log('\n💡 Request body validation error:');
        console.log('   The API expects specific field names and formats');
        console.log('   Check the exact API specification for required fields');
      } else if (error.response.data?.code === 'UNSUPPORTED_TAX_CATEGORY') {
        console.log('\n💡 Invalid tax category. Supported categories might be:');
        console.log('   - software, digital_goods, subscription, saas, etc.');
        console.log('   Check Dodo documentation for valid tax_category values');
      }
    }
    
    console.log('\n📞 If this continues to fail:');
    console.log('   1. Check Dodo Payments documentation for exact API spec');
    console.log('   2. Contact support@dodopayments.com for help');
    console.log('   3. Try creating products manually in the dashboard first');
    
    // Don't exit - show the error but let user understand what happened
    return null;
  }
}

if (require.main === module) {
  createFileBridgeProducts();
}

module.exports = { createFileBridgeProducts };
