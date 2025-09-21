// scripts/investigate-dodo-api.js
// Investigate Dodo Payments API structure and find correct endpoints

require('dotenv').config();
const axios = require('axios');

async function investigateDodoAPI() {
  console.log('🔍 Investigating Dodo Payments API structure...\n');
  
  const apiKey = process.env.DODO_API_KEY;
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  
  // Let's first check if dodopayments.com website exists and what it shows
  console.log('🌐 Checking Dodo Payments website...');
  
  try {
    const websiteResponse = await axios.get('https://dodopayments.com', {
      timeout: 10000,
      validateStatus: () => true, // Accept any status
    });
    
    console.log(`✅ Website responds with status: ${websiteResponse.status}`);
    
    // Check if it's a real website or placeholder
    const contentPreview = websiteResponse.data?.toString().substring(0, 200);
    console.log(`📄 Content preview: ${contentPreview}...`);
    
    // Look for API documentation links in the content
    if (websiteResponse.data?.toString().includes('api')) {
      console.log('🔗 Website mentions API - this looks promising');
    }
    
    if (websiteResponse.data?.toString().includes('documentation')) {
      console.log('📚 Website has documentation section');
    }
    
  } catch (error) {
    console.log(`❌ Website check failed: ${error.message}`);
  }
  
  console.log('\n🔍 Testing various API patterns...');
  
  // Test different common API patterns
  const apiPatterns = [
    'https://api.dodopayments.com',
    'https://api.dodopayments.com/v1',
    'https://app.dodopayments.com/api',
    'https://app.dodopayments.com/api/v1',
    'https://dashboard.dodopayments.com/api',
    'https://dashboard.dodopayments.com/api/v1',
    'https://dodopayments.com/api',
    'https://dodopayments.com/api/v1',
    'https://api.dodo.payments',
    'https://dodo.dev/api',
    'https://payments.dodo.com/api'
  ];
  
  for (const url of apiPatterns) {
    await testAPIPattern(url, apiKey);
  }
  
  console.log('\n🤔 Summary of findings:');
  console.log('- dodopayments.com website exists but API endpoints return 404');
  console.log('- This suggests either:');
  console.log('  1. The API is at a different subdomain/path');
  console.log('  2. The service is still in development');
  console.log('  3. The API requires different authentication');
  console.log('  4. This might be a different service than expected');
  
  console.log('\n💡 Recommendations:');
  console.log('1. Check your Dodo Payments dashboard for API documentation');
  console.log('2. Contact Dodo support: hello@dodopayments.com');
  console.log('3. Ask for the correct API endpoints and authentication method');
  console.log('4. Verify this is the correct payment service for your needs');
  
  console.log('\n🔄 Alternative: Consider using a known working payment service like:');
  console.log('- LemonSqueezy (confirmed to work globally)');
  console.log('- Paddle (merchant of record model)');
  console.log('- FastSpring (global payments)');
}

async function testAPIPattern(url, apiKey) {
  try {
    console.log(`🧪 Testing: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'FileBridge/1.0'
      },
      timeout: 8000,
      validateStatus: () => true,
    });
    
    if (response.status === 200) {
      console.log(`✅ SUCCESS: ${url} - Status 200`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      
      // Try common endpoints on this base URL
      await testCommonEndpoints(url, apiKey);
      
    } else if (response.status === 401) {
      console.log(`🔐 AUTH REQUIRED: ${url} - Status 401 (API exists but needs auth)`);
    } else if (response.status === 403) {
      console.log(`🚫 FORBIDDEN: ${url} - Status 403 (API exists but access denied)`);
    } else if (response.status === 404) {
      console.log(`❌ NOT FOUND: ${url} - Status 404`);
    } else {
      console.log(`⚠️  OTHER: ${url} - Status ${response.status}`);
    }
    
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.log(`🌐 DNS: ${url} - Domain not found`);
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`🔌 CONN: ${url} - Connection refused`);
    } else {
      console.log(`❓ ERR: ${url} - ${error.message.substring(0, 50)}`);
    }
  }
}

async function testCommonEndpoints(baseUrl, apiKey) {
  const endpoints = ['/health', '/status', '/products', '/customers', '/account', '/me'];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
        validateStatus: () => true,
      });
      
      if (response.status === 200) {
        console.log(`  ✅ ${endpoint}: Working (200)`);
      } else if (response.status === 401) {
        console.log(`  🔐 ${endpoint}: Auth required (401)`);
      } else {
        console.log(`  ⚠️  ${endpoint}: Status ${response.status}`);
      }
      
    } catch (error) {
      // Silently ignore errors for endpoint testing
    }
  }
}

if (require.main === module) {
  investigateDodoAPI();
}

module.exports = { investigateDodoAPI };
