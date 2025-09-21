// scripts/inspect-dodo-response.js
// Quick script to inspect the actual Dodo API response structure

require('dotenv').config();
const axios = require('axios');

async function inspectDodoResponse() {
  const apiKey = process.env.DODO_API_KEY;
  const baseURL = 'https://test.dodopayments.com';
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  // Use the working product structure you discovered
  const testProductData = {
    name: "FileBridge Enterprise",
    description: "Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.",
    price: {
      currency: "USD",
      discount: 0,
      price: 9900, // $99.00
      type: "recurring_price",
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 10,
      subscription_period_interval: "Year",
      tax_inclusive: false,
      pay_what_you_want: false,
      purchasing_power_parity: false
    },
    tax_category: "saas"
  };
  
  try {
    console.log('Creating FileBridge Enterprise to inspect response...\n');
    
    const response = await axios.post(`${baseURL}/products`, testProductData, { headers });
    
    console.log('✅ Product created successfully!');
    console.log('\n📋 FULL API RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n🔍 RESPONSE ANALYSIS:');
    console.log('Response keys:', Object.keys(response.data));
    console.log('Product ID field:', response.data.id || 'NOT FOUND');
    console.log('Product identifier:', response.data.product_id || 'NOT FOUND');
    console.log('Any ID-like fields:', Object.keys(response.data).filter(key => key.toLowerCase().includes('id')));
    
    // Try to find the product ID in any nested objects
    if (typeof response.data === 'object') {
      const findIds = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (key.toLowerCase().includes('id') && typeof value === 'string') {
            console.log(`Potential ID at ${currentPath}:`, value);
          }
          if (typeof value === 'object' && value !== null) {
            findIds(value, currentPath);
          }
        }
      };
      
      console.log('\n🔎 ALL ID-LIKE FIELDS:');
      findIds(response.data);
    }
    
  } catch (error) {
    console.error('❌ Failed to create product:', error.message);
    if (error.response?.data) {
      console.log('Error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

inspectDodoResponse();
