// scripts/create-filebridge-products-final.js
// Creates FileBridge Pro product using the correct Dodo Payments API schema

require('dotenv').config();
const axios = require('axios');

async function createFileBridgePro() {
  try {
    console.log('🔄 Creating FileBridge Pro product...');
    
    const productData = {
      name: 'FileBridge Pro',
      description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
      price: {
        currency: 'USD',
        discount: 0,
        price: 1900,
        type: 'recurring_price',
        payment_frequency_count: 1,
        payment_frequency_interval: 'Month',
        subscription_period_count: 10,
        subscription_period_interval: 'Year',
        tax_inclusive: false,
        pay_what_you_want: false,
        purchasing_power_parity: false
      },
      tax_category: 'saas'
    };
    
    console.log('📋 Product data:');
    console.log(JSON.stringify(productData, null, 2));
    
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
    
    const response = await axios.post(`${baseURL}/products`, productData, { headers });
    
    console.log('✅ Product created successfully');
    console.log(`   Product ID: ${response.data.id}`);
    console.log(`   Product Name: ${response.data.name}`);
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Failed to create product');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  createFileBridgePro();
}

module.exports = { createFileBridgePro };

