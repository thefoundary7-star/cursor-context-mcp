// scripts/dodo-api-adaptive-test.js
// Adaptive test script that discovers the correct Dodo Payments API structure
// by analyzing error responses and iterating through possible configurations

require('dotenv').config();
const axios = require('axios');

class DodoAPITester {
  constructor() {
    this.apiKey = process.env.DODO_API_KEY || process.env.DODO_PAYMENTS_API_KEY;
    this.environment = process.env.DODO_ENVIRONMENT || 'test';
    this.workingConfig = null;
    this.testResults = [];
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️ ',
      test: '🧪'
    }[level] || 'ℹ️ ';

    console.log(`${prefix} ${message}`);
    if (data) {
      console.log(`   ${JSON.stringify(data, null, 2)}`);
    }
  }

  async discoverAPIEndpoints() {
    this.log('info', 'Starting Dodo Payments API discovery...');

    if (!this.apiKey) {
      this.log('error', 'API key not found. Set DODO_API_KEY or DODO_PAYMENTS_API_KEY in .env file');
      return false;
    }

    const baseUrlPatterns = [
      // Production patterns
      'https://api.dodopayments.com',
      'https://api.dodopayments.com/v1',
      'https://app.dodopayments.com/api',
      'https://app.dodopayments.com/api/v1',
      'https://live.dodopayments.com',
      'https://live.dodopayments.com/api',

      // Test/staging patterns
      'https://test-api.dodopayments.com',
      'https://test-api.dodopayments.com/v1',
      'https://test.dodopayments.com',
      'https://test.dodopayments.com/api',
      'https://staging.dodopayments.com/api',
      'https://sandbox.dodopayments.com/api',

      // Alternative patterns
      'https://payments.dodo.com/api',
      'https://api.dodo.payments',
      'https://checkout.dodopayments.com/api'
    ];

    this.log('info', `Testing ${baseUrlPatterns.length} potential API endpoints...`);

    for (const baseUrl of baseUrlPatterns) {
      await this.testAPIEndpoint(baseUrl);
    }

    const workingEndpoints = this.testResults.filter(r => r.status === 'working' || r.status === 'auth_required');

    if (workingEndpoints.length > 0) {
      this.log('success', `Found ${workingEndpoints.length} working API endpoint(s):`);
      workingEndpoints.forEach(endpoint => {
        this.log('info', `  ${endpoint.baseUrl} - ${endpoint.status}`);
      });
      return workingEndpoints[0]; // Use the first working endpoint
    } else {
      this.log('error', 'No working API endpoints found');
      return null;
    }
  }

  async testAPIEndpoint(baseUrl) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FileBridge-API-Tester/1.0'
    };

    const testEndpoints = [
      { path: '/health', method: 'GET' },
      { path: '/status', method: 'GET' },
      { path: '/products', method: 'GET' },
      { path: '/me', method: 'GET' },
      { path: '/account', method: 'GET' }
    ];

    let endpointResult = {
      baseUrl,
      status: 'failed',
      responses: [],
      errors: []
    };

    try {
      this.log('test', `Testing ${baseUrl}...`);

      for (const endpoint of testEndpoints) {
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${baseUrl}${endpoint.path}`,
            headers,
            timeout: 8000,
            validateStatus: () => true
          });

          const result = {
            endpoint: endpoint.path,
            status: response.status,
            statusText: response.statusText
          };

          if (response.status === 200) {
            endpointResult.status = 'working';
            this.log('success', `${baseUrl}${endpoint.path} - Working (200)`);
          } else if (response.status === 401) {
            endpointResult.status = 'auth_required';
            this.log('warning', `${baseUrl}${endpoint.path} - Auth required (401)`);
          } else if (response.status === 403) {
            endpointResult.status = 'forbidden';
            this.log('warning', `${baseUrl}${endpoint.path} - Forbidden (403)`);
          }

          endpointResult.responses.push(result);

        } catch (error) {
          endpointResult.errors.push({
            endpoint: endpoint.path,
            error: error.message
          });
        }
      }

    } catch (error) {
      endpointResult.errors.push({
        endpoint: 'base',
        error: error.message
      });
    }

    this.testResults.push(endpointResult);
    return endpointResult;
  }

  async discoverProductSchema(baseUrl) {
    this.log('info', 'Discovering product schema through iterative testing...');

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FileBridge-Schema-Discovery/1.0'
    };

    // Start with minimal payload and build up based on errors
    const schemaIterations = [
      // Iteration 1: Minimal
      {
        name: 'minimal',
        data: {
          name: 'Test Product'
        }
      },
      // Iteration 2: Add description
      {
        name: 'with_description',
        data: {
          name: 'Test Product',
          description: 'Test product for schema discovery'
        }
      },
      // Iteration 3: Add basic pricing
      {
        name: 'basic_pricing',
        data: {
          name: 'Test Product',
          description: 'Test product for schema discovery',
          price: 1900,
          currency: 'USD'
        }
      },
      // Iteration 4: Subscription type
      {
        name: 'subscription_type',
        data: {
          name: 'Test Product',
          description: 'Test product for schema discovery',
          type: 'subscription',
          price: 1900,
          currency: 'USD',
          interval: 'month'
        }
      },
      // Iteration 5: Nested pricing object
      {
        name: 'nested_pricing',
        data: {
          name: 'Test Product',
          description: 'Test product for schema discovery',
          pricing: {
            type: 'recurring_price',
            price: 1900,
            currency: 'USD',
            interval: 'month'
          }
        }
      },
      // Iteration 6: Complex pricing structure
      {
        name: 'complex_pricing',
        data: {
          name: 'Test Product',
          description: 'Test product for schema discovery',
          pricing: {
            type: 'recurring_price',
            price: 1900,
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
      }
    ];

    for (const iteration of schemaIterations) {
      this.log('test', `Testing schema: ${iteration.name}`);
      console.log(`   Payload:`, JSON.stringify(iteration.data, null, 2));

      try {
        const response = await axios.post(`${baseUrl}/products`, iteration.data, {
          headers,
          timeout: 10000
        });

        this.log('success', `Schema ${iteration.name} worked! Product created.`);
        this.log('info', `Full response:`, response.data);

        // Extract product ID from various possible locations
        const productId = response.data.id || response.data.product_id || response.data.productId ||
                         response.data.data?.id || response.data.data?.product_id;

        this.log('info', `Product ID: ${productId}`);

        // Clean up test product if possible
        if (productId) {
          try {
            await axios.delete(`${baseUrl}/products/${productId}`, { headers });
            this.log('info', 'Test product cleaned up');
          } catch (cleanupError) {
            this.log('warning', 'Could not delete test product - clean up manually');
          }
        }

        return {
          schema: iteration,
          response: response.data,
          baseUrl,
          productId
        };

      } catch (error) {
        if (error.response) {
          this.log('error', `Schema ${iteration.name} failed - ${error.response.status}`);

          const errorData = error.response.data;
          if (errorData.message) {
            console.log(`   Message: ${errorData.message}`);
          }
          if (errorData.errors) {
            console.log(`   Field errors:`, errorData.errors);
          }
          if (errorData.code) {
            console.log(`   Error code: ${errorData.code}`);
          }

          // Analyze 422 errors for missing fields
          if (error.response.status === 422) {
            await this.analyzeValidationError(errorData, iteration);
          }

        } else {
          this.log('error', `Schema ${iteration.name} failed - ${error.message}`);
        }
      }
    }

    return null;
  }

  async analyzeValidationError(errorData, currentIteration) {
    this.log('info', 'Analyzing validation error for schema improvements...');

    // Look for common error patterns that indicate missing required fields
    const errorMessage = errorData.message || '';
    const errors = errorData.errors || {};

    const missingFieldPatterns = [
      /missing field `(\w+)`/g,
      /field `(\w+)` is required/g,
      /required field: (\w+)/g,
      /'(\w+)' is required/g
    ];

    const unknownVariantPatterns = [
      /unknown variant `(\w+)`/g,
      /invalid value for `(\w+)`/g,
      /(\w+) must be one of:/g
    ];

    let suggestedFields = [];
    let suggestedValues = [];

    // Extract missing fields
    for (const pattern of missingFieldPatterns) {
      let match;
      while ((match = pattern.exec(errorMessage)) !== null) {
        suggestedFields.push(match[1]);
      }
    }

    // Extract invalid values
    for (const pattern of unknownVariantPatterns) {
      let match;
      while ((match = pattern.exec(errorMessage)) !== null) {
        suggestedValues.push(match[1]);
      }
    }

    if (suggestedFields.length > 0) {
      this.log('info', `Missing required fields detected: ${suggestedFields.join(', ')}`);
    }

    if (suggestedValues.length > 0) {
      this.log('info', `Invalid values detected: ${suggestedValues.join(', ')}`);
    }

    // Look at error object structure for more hints
    if (typeof errors === 'object' && Object.keys(errors).length > 0) {
      this.log('info', `Field-specific errors:`, errors);
    }
  }

  async createFileBridgeProducts(workingConfig) {
    if (!workingConfig) {
      this.log('error', 'No working API configuration found');
      return null;
    }

    this.log('info', 'Creating FileBridge products with discovered schema...');

    const { schema, baseUrl } = workingConfig;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const products = [
      {
        name: 'FileBridge Pro',
        description: 'Privacy-first MCP server for individual developers with multiple project support and advanced Git integration.',
        price: 1900, // $19/month
        tier: 'pro'
      },
      {
        name: 'FileBridge Enterprise',
        description: 'Privacy-first MCP server for teams with unlimited projects, team collaboration features, and priority support.',
        price: 9900, // $99/month
        tier: 'enterprise'
      }
    ];

    const createdProducts = [];

    for (const product of products) {
      try {
        // Build product data based on working schema
        const productData = { ...schema.data };
        productData.name = product.name;
        productData.description = product.description;

        // Update price in the correct location
        if (productData.pricing?.price) {
          productData.pricing.price = product.price;
        } else if (productData.price) {
          productData.price = product.price;
        }

        // Add metadata if the schema supports it
        if (schema.data.metadata || schema.data.pricing?.metadata) {
          const metadata = {
            tier: product.tier,
            max_projects: product.tier === 'pro' ? '10' : 'unlimited',
            support_level: product.tier === 'pro' ? 'email' : 'priority'
          };

          if (productData.metadata !== undefined) {
            productData.metadata = metadata;
          } else if (productData.pricing?.metadata !== undefined) {
            productData.pricing.metadata = metadata;
          }
        }

        this.log('info', `Creating ${product.name}...`);
        console.log(`   Data:`, JSON.stringify(productData, null, 2));

        const response = await axios.post(`${baseUrl}/products`, productData, {
          headers,
          timeout: 15000
        });

        // Extract product ID from various possible locations
        const productId = response.data.id || response.data.product_id || response.data.productId ||
                         response.data.data?.id || response.data.data?.product_id;

        this.log('success', `${product.name} created successfully!`);
        this.log('info', `Product ID: ${productId}`);
        this.log('info', `Full response:`, response.data);

        createdProducts.push({
          tier: product.tier,
          name: product.name,
          id: productId,
          data: response.data
        });

      } catch (error) {
        this.log('error', `Failed to create ${product.name}`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Error:`, error.response.data);
        } else {
          console.log(`   Error: ${error.message}`);
        }
      }
    }

    return createdProducts;
  }

  async run() {
    console.log('🚀 Dodo Payments API Adaptive Test Starting...\n');

    // Step 1: Discover working API endpoint
    const workingEndpoint = await this.discoverAPIEndpoints();
    if (!workingEndpoint) {
      this.log('error', 'No working API endpoints found. Cannot proceed.');
      return null;
    }

    // Step 2: Discover working product schema
    const workingSchema = await this.discoverProductSchema(workingEndpoint.baseUrl);
    if (!workingSchema) {
      this.log('error', 'Could not discover working product schema');
      return null;
    }

    this.log('success', 'Schema discovery complete!');
    console.log(`   Working endpoint: ${workingSchema.baseUrl}`);
    console.log(`   Working schema: ${workingSchema.schema.name}`);

    // Step 3: Create actual FileBridge products
    const products = await this.createFileBridgeProducts(workingSchema);

    if (products && products.length > 0) {
      this.log('success', 'FileBridge products created successfully!');

      // Generate environment file
      let envContent = `# FileBridge Dodo Payments Configuration (Auto-discovered: ${new Date().toISOString()})\n`;
      envContent += `DODO_API_BASE_URL="${workingSchema.baseUrl}"\n`;
      envContent += `DODO_WORKING_SCHEMA="${workingSchema.schema.name}"\n\n`;

      products.forEach(product => {
        const envKey = `DODO_${product.tier.toUpperCase()}_PRODUCT_ID`;
        envContent += `${envKey}="${product.id}"\n`;
        console.log(`${envKey}="${product.id}"`);
      });

      const fs = require('fs');
      fs.writeFileSync('dodo-api-discovered.env', envContent);

      this.log('success', 'Configuration saved to dodo-api-discovered.env');
    }

    return {
      endpoint: workingEndpoint,
      schema: workingSchema,
      products
    };
  }
}

// Run the adaptive test
if (require.main === module) {
  const tester = new DodoAPITester();
  tester.run().then(result => {
    if (result) {
      console.log('\n🎉 Adaptive test completed successfully!');
      console.log('📋 Check the generated .env file for your configuration');
    } else {
      console.log('\n❌ Adaptive test failed');
      console.log('💡 Recommendations:');
      console.log('   1. Verify your API key has the correct permissions');
      console.log('   2. Check Dodo Payments documentation: docs.dodopayments.com');
      console.log('   3. Contact support@dodopayments.com for API guidance');
    }
  }).catch(error => {
    console.error('\n💥 Test crashed:', error.message);
  });
}

module.exports = { DodoAPITester };