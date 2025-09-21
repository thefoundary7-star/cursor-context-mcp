// scripts/create-filebridge-products-fixed.js
// Create FileBridge products with correct Dodo Payments API structure
// Based on research from docs.dodopayments.com and live examples

require('dotenv').config();
const axios = require('axios');

async function createFileBridgeProducts() {
  console.log('🚀 Creating FileBridge products in Dodo Payments (Fixed Version)...\n');

  const apiKey = process.env.DODO_API_KEY || process.env.DODO_PAYMENTS_API_KEY;
  const environment = process.env.DODO_ENVIRONMENT || 'test';

  if (!apiKey) {
    console.error('❌ DODO_API_KEY or DODO_PAYMENTS_API_KEY not found in environment variables');
    console.log('💡 Add to your .env file:');
    console.log('   DODO_API_KEY="your_api_key_here"');
    process.exit(1);
  }

  console.log(`🔑 Using API Key: ${apiKey.substring(0, 15)}...`);
  console.log(`🌍 Environment: ${environment}`);
  console.log('');

  // Try multiple possible API base URLs based on research
  const possibleBaseUrls = [
    environment === 'production' ? 'https://api.dodopayments.com' : 'https://test-api.dodopayments.com',
    environment === 'production' ? 'https://api.dodopayments.com/v1' : 'https://test-api.dodopayments.com/v1',
    environment === 'production' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com',
    environment === 'production' ? 'https://live.dodopayments.com/api' : 'https://test.dodopayments.com/api',
    environment === 'production' ? 'https://app.dodopayments.com/api' : 'https://test.app.dodopayments.com/api',
    'https://api.dodopayments.com/v1',
    'https://api.dodopayments.com'
  ];

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'FileBridge/1.0'
  };

  // Test different product creation formats based on documentation research
  const productFormats = [
    // Format 1: Based on documentation structure
    {
      name: 'format1_docs_structure',
      data: {
        name: 'FileBridge Pro',
        description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
        pricing: {
          type: 'recurring_price',
          price: 1900, // $19.00 in cents
          currency: 'USD',
          payment_frequency: {
            interval: 'month',
            count: 1
          },
          subscription_period: {
            interval: 'month',
            count: 1
          }
        },
        tax_category: 'digital_products'
      }
    },
    // Format 2: Simplified recurring structure
    {
      name: 'format2_simple_recurring',
      data: {
        name: 'FileBridge Pro',
        description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
        type: 'subscription',
        price: 1900,
        currency: 'USD',
        interval: 'month',
        tax_category: 'saas'
      }
    },
    // Format 3: Nested price object
    {
      name: 'format3_nested_price',
      data: {
        name: 'FileBridge Pro',
        description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
        price: {
          amount: 1900,
          currency: 'USD',
          interval: 'month',
          type: 'recurring'
        },
        tax_category: 'digital_products'
      }
    },
    // Format 4: Full structure with metadata
    {
      name: 'format4_full_structure',
      data: {
        name: 'FileBridge Pro',
        description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
        type: 'recurring',
        pricing: {
          price: 1900,
          currency: 'USD',
          interval: 'month',
          interval_count: 1
        },
        tax_category: 'saas',
        metadata: {
          tier: 'pro',
          max_projects: '10',
          support_level: 'email'
        }
      }
    }
  ];

  let successfulFormat = null;
  let workingBaseUrl = null;
  let createdProducts = [];

  // Try each base URL with each format
  for (const baseUrl of possibleBaseUrls) {
    console.log(`🧪 Testing API base URL: ${baseUrl}`);

    // First test if the API endpoint exists
    try {
      const healthCheck = await axios.get(`${baseUrl}/health`, {
        headers,
        timeout: 5000,
        validateStatus: () => true
      });

      if (healthCheck.status === 404) {
        console.log(`   ❌ ${baseUrl} - No /health endpoint found`);
        continue;
      } else {
        console.log(`   ✅ ${baseUrl} - API endpoint responds (${healthCheck.status})`);
      }
    } catch (error) {
      console.log(`   ❌ ${baseUrl} - Connection failed: ${error.message.substring(0, 50)}`);
      continue;
    }

    // Try product creation with different formats
    for (const format of productFormats) {
      console.log(`   🔧 Testing ${format.name}...`);

      try {
        const response = await axios.post(`${baseUrl}/products`, format.data, {
          headers,
          timeout: 10000
        });

        console.log(`   ✅ SUCCESS! Product created with ${format.name}`);
        console.log(`      Product ID: ${response.data.id}`);
        console.log(`      Response: ${JSON.stringify(response.data, null, 2)}`);

        successfulFormat = format;
        workingBaseUrl = baseUrl;
        createdProducts.push({ type: 'pro', data: response.data, format: format.name });
        break;

      } catch (error) {
        if (error.response) {
          console.log(`   ❌ ${format.name} failed - Status: ${error.response.status}`);
          console.log(`      Error: ${JSON.stringify(error.response.data, null, 2)}`);

          // Analyze specific errors
          if (error.response.status === 422) {
            console.log(`      💡 Validation error - checking requirements...`);
            const errorData = error.response.data;
            if (errorData.message) {
              console.log(`         Message: ${errorData.message}`);
            }
            if (errorData.errors) {
              console.log(`         Field errors:`, errorData.errors);
            }
          }
        } else {
          console.log(`   ❌ ${format.name} failed - ${error.message.substring(0, 50)}`);
        }
      }
    }

    if (successfulFormat) {
      console.log(`\n🎉 Found working API configuration!`);
      console.log(`   Base URL: ${workingBaseUrl}`);
      console.log(`   Format: ${successfulFormat.name}`);
      break;
    }
  }

  if (!successfulFormat) {
    console.log('\n❌ All API formats and URLs failed. Recommendations:');
    console.log('1. Verify your Dodo Payments API key is correct');
    console.log('2. Check if your account has product creation permissions');
    console.log('3. Contact Dodo support at support@dodopayments.com');
    console.log('4. Try creating a product manually in the dashboard first');
    console.log('5. Check the official API documentation at docs.dodopayments.com');
    return null;
  }

  // Now create Enterprise product with the working format
  console.log(`\n🏢 Creating FileBridge Enterprise with working format...`);

  try {
    const enterpriseData = { ...successfulFormat.data };
    enterpriseData.name = 'FileBridge Enterprise';
    enterpriseData.description = 'Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.';

    // Update price to $99
    if (enterpriseData.pricing?.price) {
      enterpriseData.pricing.price = 9900;
    } else if (enterpriseData.price?.amount) {
      enterpriseData.price.amount = 9900;
    } else if (enterpriseData.price) {
      enterpriseData.price = 9900;
    }

    // Update metadata if present
    if (enterpriseData.metadata) {
      enterpriseData.metadata = {
        tier: 'enterprise',
        max_projects: 'unlimited',
        support_level: 'priority',
        team_features: 'true'
      };
    }

    const enterpriseResponse = await axios.post(`${workingBaseUrl}/products`, enterpriseData, {
      headers,
      timeout: 10000
    });

    console.log(`✅ FileBridge Enterprise created successfully!`);
    console.log(`   Product ID: ${enterpriseResponse.data.id}`);
    createdProducts.push({ type: 'enterprise', data: enterpriseResponse.data, format: successfulFormat.name });

  } catch (error) {
    console.log(`❌ Enterprise product creation failed:`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   ${error.message}`);
    }
  }

  // Generate environment file
  if (createdProducts.length > 0) {
    console.log('\n🔧 Environment Variables:');
    console.log('');

    const proProduct = createdProducts.find(p => p.type === 'pro');
    const enterpriseProduct = createdProducts.find(p => p.type === 'enterprise');

    let envContent = `# FileBridge Product IDs - Dodo Payments (Created: ${new Date().toISOString()})\n`;
    envContent += `# API Base URL: ${workingBaseUrl}\n`;
    envContent += `# Working Format: ${successfulFormat.name}\n\n`;

    if (proProduct) {
      envContent += `DODO_PRO_PRODUCT_ID="${proProduct.data.id}"\n`;
      console.log(`DODO_PRO_PRODUCT_ID="${proProduct.data.id}"`);
    }

    if (enterpriseProduct) {
      envContent += `DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"\n`;
      console.log(`DODO_ENTERPRISE_PRODUCT_ID="${enterpriseProduct.data.id}"`);
    }

    envContent += `\nDODO_API_BASE_URL="${workingBaseUrl}"\n`;
    console.log(`DODO_API_BASE_URL="${workingBaseUrl}"`);

    const fs = require('fs');
    fs.writeFileSync('product-ids-working.env', envContent);

    console.log('\n💾 Configuration saved to product-ids-working.env');
    console.log('📋 Copy these values to your main .env file');
  }

  return {
    products: createdProducts,
    apiConfig: {
      baseUrl: workingBaseUrl,
      format: successfulFormat?.name
    }
  };
}

if (require.main === module) {
  createFileBridgeProducts();
}

module.exports = { createFileBridgeProducts };