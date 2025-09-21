// scripts/get-all-products.js
// Retrieve all products to get both FileBridge product IDs

require('dotenv').config();
const axios = require('axios');

async function getAllProducts() {
  const apiKey = process.env.DODO_API_KEY;
  const baseURL = 'https://test.dodopayments.com';
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  try {
    console.log('🔍 Retrieving all products from Dodo...\n');
    
    const response = await axios.get(`${baseURL}/products`, { headers });
    
    console.log('✅ Products retrieved successfully!\n');
    console.log('📋 Raw response structure:', typeof response.data);
    console.log('📋 Response keys:', Object.keys(response.data));
    
    // Handle different response structures
    let products = [];
    if (Array.isArray(response.data)) {
      products = response.data;
    } else if (response.data.items && Array.isArray(response.data.items)) {
      products = response.data.items;
    } else if (response.data.products && Array.isArray(response.data.products)) {
      products = response.data.products;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      products = response.data.data;
    } else {
      console.log('Full response:', JSON.stringify(response.data, null, 2));
      throw new Error('Unexpected response structure - products not found as array');
    }
    
    console.log(`Found ${products.length} total products\n`);
    
    // Filter for FileBridge products
    const fileBridgeProducts = products.filter(product => 
      product.name && product.name.includes('FileBridge')
    );
    
    console.log('📦 FileBridge Products Found:');
    fileBridgeProducts.forEach(product => {
      console.log(`\n   Name: ${product.name}`);
      console.log(`   Product ID: ${product.product_id}`);
      console.log(`   Price: ${product.price / 100}/${product.price_detail?.payment_frequency_interval?.toLowerCase() || 'month'}`);
      console.log(`   Created: ${product.created_at}`);
    });
    
    // Generate environment variables
    const proProduct = fileBridgeProducts.find(p => p.name.includes('Pro'));
    const enterpriseProduct = fileBridgeProducts.find(p => p.name.includes('Enterprise'));
    
    if (proProduct && enterpriseProduct) {
      console.log('\n🔧 Environment Variables:');
      console.log(`DODO_PRO_PRODUCT_ID="${proProduct.product_id}"`);
      console.log(`DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.product_id}"`);
      
      // Save to file
      const envUpdate = `
# FileBridge Product IDs for Dodo Payments
DODO_PRO_PRODUCT_ID="${proProduct.product_id}"
DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.product_id}"

# Product Details:
# Pro: ${proProduct.price / 100}/month - ${proProduct.product_id}
# Enterprise: ${enterpriseProduct.price / 100}/month - ${enterpriseProduct.product_id}

# Next Steps:
# 1. Add these to your main .env file
# 2. Set up webhook endpoint in Dodo dashboard
# 3. Configure webhook events for subscription management
`;
      
      const fs = require('fs');
      fs.writeFileSync('filebridge-product-ids.env', envUpdate.trim());
      
      console.log('\n💾 Product IDs saved to filebridge-product-ids.env');
      console.log('\n📋 Next Steps:');
      console.log('1. Copy the environment variables to your main .env file');
      console.log('2. Set up webhook endpoint: https://yourdomain.com/api/webhooks/dodo');
      console.log('3. Configure webhook in Dodo dashboard (Settings > Webhooks)');
      console.log('4. Test subscription creation and license delivery');
      
    } else {
      console.log('\n⚠️ Could not find both Pro and Enterprise products');
      console.log('Found products:', fileBridgeProducts.map(p => p.name));
    }
    
  } catch (error) {
    console.error('❌ Failed to retrieve products:', error.message);
    if (error.response?.data) {
      console.log('Error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getAllProducts();
