#!/usr/bin/env node
// scripts/setup-dodo-integration.js
// Run with: node scripts/setup-dodo-integration.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Dodo Payments integration for FileBridge...\n');

// Step 1: Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install axios', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Step 2: Generate Prisma client
console.log('🔧 Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated successfully\n');
} catch (error) {
  console.error('❌ Failed to generate Prisma client:', error.message);
  console.log('💡 You may need to run database migrations first\n');
}

// Step 3: Create migration
console.log('📊 Creating database migration...');
try {
  execSync('npx prisma migrate dev --name dodo-payments-integration', { stdio: 'inherit' });
  console.log('✅ Database migration created successfully\n');
} catch (error) {
  console.error('❌ Failed to create migration:', error.message);
  console.log('💡 You may need to set up your database connection first\n');
}

// Step 4: Check environment variables
console.log('🔍 Checking environment configuration...');
const envPath = path.join(process.cwd(), '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  
  const requiredVars = [
    'DODO_API_KEY',
    'DODO_WEBHOOK_SECRET',
    'DODO_ENVIRONMENT',
    'DODO_PRO_PRODUCT_ID',
    'DODO_ENTERPRISE_PRODUCT_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
  
  if (missingVars.length > 0) {
    console.log('⚠️  Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 Add these to your .env file after setting up your Dodo Payments account\n');
  } else {
    console.log('✅ All required environment variables are present\n');
  }
} else {
  console.log('⚠️  .env file not found');
  console.log('💡 Copy .env.example to .env and configure your Dodo Payments settings\n');
}

// Step 5: Create test script
console.log('🧪 Creating test script...');
const testScript = `// scripts/test-dodo-integration.js
// Test script for Dodo Payments integration

const { getDodoPaymentsService } = require('../src/services/dodo/dodopayments');

async function testDodoIntegration() {
  try {
    console.log('🧪 Testing Dodo Payments integration...');
    
    const dodo = getDodoPaymentsService();
    
    // Test 1: List existing products
    console.log('📋 Fetching existing products...');
    const products = await dodo.listProducts();
    console.log(\`Found \${products.data.length} products\`);
    
    // Test 2: Create a test customer
    console.log('👤 Creating test customer...');
    const customer = await dodo.createCustomer({
      email: 'test@example.com',
      name: 'Test Customer',
      metadata: { source: 'integration_test' }
    });
    console.log(\`Created customer: \${customer.id}\`);
    
    // Clean up test customer
    console.log('🧹 Cleaning up test data...');
    // Note: Add customer deletion if Dodo supports it
    
    console.log('✅ Dodo Payments integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Dodo Payments integration test failed:', error.message);
    console.log('💡 Make sure your DODO_API_KEY is set correctly in .env');
    process.exit(1);
  }
}

if (require.main === module) {
  testDodoIntegration();
}

module.exports = { testDodoIntegration };
`;

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'test-dodo-integration.js'), testScript);
console.log('✅ Test script created at scripts/test-dodo-integration.js\n');

// Step 6: Display next steps
console.log('🎉 Dodo Payments integration setup complete!\n');
console.log('📋 Next steps:');
console.log('1. Complete your Dodo Payments account verification');
console.log('2. Get your API keys from Dodo Payments dashboard');
console.log('3. Update your .env file with Dodo credentials:');
console.log('   DODO_API_KEY=your_api_key_here');
console.log('   DODO_WEBHOOK_SECRET=your_webhook_secret_here');
console.log('   DODO_ENVIRONMENT=sandbox (or production)');
console.log('4. Create your FileBridge products in Dodo:');
console.log('   npm run dev');
console.log('   curl -X POST http://localhost:3000/api/billing/setup-products');
console.log('5. Test the integration:');
console.log('   node scripts/test-dodo-integration.js');
console.log('6. Update your webhook URL in Dodo dashboard:');
console.log('   https://yourdomain.com/api/webhooks/dodo');
console.log('\\n🔗 Useful links:');
console.log('- Dodo Payments Dashboard: https://dashboard.dodopayments.com');
console.log('- Dodo API Documentation: https://docs.dodopayments.com');
console.log('- FileBridge Documentation: ./README.md');
console.log('\\n🚀 Ready to launch FileBridge with global payment support!');
