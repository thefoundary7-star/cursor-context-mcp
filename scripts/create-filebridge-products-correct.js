// scripts/create-filebridge-products-correct.js
// Create FileBridge products using correct Dodo API structure

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
    // Create FileBridge Pro - Based on Dodo documentation structure
    console.log('📦 Creating FileBridge Pro product...');
    const proProductData = {
      name: 'FileBridge Pro',
      description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
      price: {
        type: 'recurring_price',
        price: 1900, // $19.00 in cents
        currency: 'USD',
        interval: 'monthly'
      },
      recurring: true,
      billing_cycle: 'monthly',
      tax_category: 'saas'
    };
    
    console.log('Sending Pro product data:', JSON.stringify(proProductData, null, 2));
    
    const proProduct = await axios.post(`${baseURL}/products`, proProductData, { headers });
    
    console.log('✅ FileBridge Pro created successfully!');
    console.log(`   Product ID: ${proProduct.data.id}`);
    console.log(`   Price: $${proProduct.data.price?.price/100}/${proProduct.data.billing_cycle}`);
    console.log('');
    
    // Create FileBridge Enterprise
    console.log('🏢 Creating FileBridge Enterprise product...');
    const enterpriseProductData = {
      name: 'FileBridge Enterprise',
      description: 'Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.',
      price: {
        type: 'recurring_price',
        price: 9900, // $99.00 in cents
        currency: 'USD',
        interval: 'monthly'
      },
      recurring: true,
      billing_cycle: 'monthly',
      tax_category: 'saas'
    };
    
    console.log('Sending Enterprise product data:', JSON.stringify(enterpriseProductData, null, 2));
    
    const enterpriseProduct = await axios.post(`${baseURL}/products`, enterpriseProductData, { headers });
    
    console.log('✅ FileBridge Enterprise created successfully!');
    console.log(`   Product ID: ${enterpriseProduct.data.id}`);
    console.log(`   Price: $${enterpriseProduct.data.price?.price/100}/${enterpriseProduct.data.billing_cycle}`);
    console.log('');
    
    // Display environment variable updates
    console.log('🔧 Add these to your .env file:');
    console.log('');
    console.log(`DODO_PRO_PRODUCT_ID="${proProduct.data.id}"`);
    console.log(`DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"`);
    console.log('');
    
    // Save to file
    const envUpdate = `
# FileBridge Product IDs for Dodo Payments (Created: ${new Date().toISOString()})
DODO_PRO_PRODUCT_ID="${proProduct.data.id}"
DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"

# Product Details:
# Pro: $19/month - ${proProduct.data.id}
# Enterprise: $99/month - ${enterpriseProduct.data.id}
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
    console.log('2. Set up webhook endpoint in Dodo dashboard');
    console.log('3. Test subscription creation with payment links');
    console.log('4. Implement license key delivery on subscription events');
    
    return {
      pro: proProduct.data,
      enterprise: enterpriseProduct.data
    };
    
  } catch (error) {
    console.error('❌ Failed to create products:', error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      
      // Provide specific guidance based on error
      if (error.response.status === 422) {
        console.log('\n💡 API Validation Error - Check field requirements:');
        console.log('   - Ensure "recurring: true" for subscription products');
        console.log('   - Check "billing_cycle" is one of: daily, weekly, monthly, yearly');
        console.log('   - Verify "tax_category" is valid (e.g., "saas")');
        console.log('   - Confirm price structure matches API specification');
      } else if (error.response.status === 401) {
        console.log('\n💡 Authentication Error:');
        console.log('   - Check your DODO_API_KEY is correct');
        console.log('   - Verify you have product creation permissions');
      }
    }
    
    console.log('\n📞 If this continues to fail:');
    console.log('   1. Check exact API specification at docs.dodopayments.com');
    console.log('   2. Try creating a product manually in dashboard first');
    console.log('   3. Contact support@dodopayments.com for assistance');
    
    return null;
  }
}

if (require.main === module) {
  createFileBridgeProducts();
}

module.exports = { createFileBridgeProducts };
