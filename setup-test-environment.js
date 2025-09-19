#!/usr/bin/env node

/**
 * Setup Test Environment for MCP SaaS Backend
 * 
 * This script sets up the test environment including:
 * - Environment variables
 * - Database setup
 * - Test data creation
 * - Server startup
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${title}${colors.reset}`);
  log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
}

// Environment setup
function setupEnvironment() {
  logSection('Setting up Environment Variables');
  
  const envContent = `# Development Environment Configuration
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/mcp_saas

# Redis Configuration (Optional for development)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_minimum_32_characters_long_for_development_only
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Encryption Configuration
ENCRYPTION_KEY=your_encryption_key_here_minimum_32_characters_long_for_development
ENCRYPTION_ALGORITHM=aes-256-gcm

# Stripe Configuration (Test keys)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# API Configuration
API_RATE_LIMIT=1000
API_RATE_WINDOW=900000
API_TIMEOUT=30000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Email Configuration
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=MCP SaaS Platform

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_SECRET=your_session_secret_here_minimum_32_characters_long_for_development
COOKIE_SECURE=false
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=lax

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=simple
LOG_FILE=./logs/app.log

# Feature Flags
FEATURE_ANALYTICS=true
FEATURE_BILLING=true
FEATURE_LICENSES=true
FEATURE_API_KEYS=true
FEATURE_WEBHOOKS=true

# Development Configuration
DEBUG=true
ENABLE_SWAGGER=true
ENABLE_GRAPHQL_PLAYGROUND=false
`;

  try {
    fs.writeFileSync('.env.local', envContent);
    log('✓ Environment file created (.env.local)', 'green');
  } catch (error) {
    log(`✗ Failed to create environment file: ${error.message}`, 'red');
    return false;
  }
  
  return true;
}

// Database setup
function setupDatabase() {
  logSection('Setting up Database');
  
  try {
    // Check if Prisma is installed
    log('Checking Prisma installation...', 'yellow');
    execSync('npx prisma --version', { stdio: 'pipe' });
    log('✓ Prisma is installed', 'green');
    
    // Generate Prisma client
    log('Generating Prisma client...', 'yellow');
    execSync('npx prisma generate', { stdio: 'inherit' });
    log('✓ Prisma client generated', 'green');
    
    // Run database migrations
    log('Running database migrations...', 'yellow');
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
    log('✓ Database migrations completed', 'green');
    
    // Seed database with test data
    log('Seeding database with test data...', 'yellow');
    execSync('npx prisma db seed', { stdio: 'inherit' });
    log('✓ Database seeded with test data', 'green');
    
    return true;
  } catch (error) {
    log(`✗ Database setup failed: ${error.message}`, 'red');
    log('Please ensure PostgreSQL is running and accessible', 'yellow');
    return false;
  }
}

// Create test data script
function createTestDataScript() {
  logSection('Creating Test Data Script');
  
  const testDataScript = `#!/usr/bin/env node

/**
 * Test Data Creation Script
 * Creates test users, licenses, and subscriptions for MCP integration testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createTestData() {
  console.log('Creating test data...');
  
  try {
    // Create test user
    const hashedPassword = await bcrypt.hash('testpassword123', 12);
    
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        company: 'Test Company',
        role: 'USER',
        isActive: true,
      },
    });
    
    console.log('✓ Test user created:', testUser.email);
    
    // Create test subscription
    const testSubscription = await prisma.subscription.upsert({
      where: { userId: testUser.id },
      update: {},
      create: {
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
    
    console.log('✓ Test subscription created:', testSubscription.plan);
    
    // Create test license
    const licenseKey = \`MCP-\${crypto.randomBytes(8).toString('hex').toUpperCase()}\`;
    
    const testLicense = await prisma.license.upsert({
      where: { licenseKey },
      update: {},
      create: {
        userId: testUser.id,
        licenseKey,
        name: 'Test MCP License',
        description: 'Test license for MCP server integration',
        plan: 'PRO',
        maxServers: 5,
        isActive: true,
        subscriptionId: testSubscription.id,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });
    
    console.log('✓ Test license created:', testLicense.licenseKey);
    
    // Create test API key
    const apiKey = \`mcp_\${crypto.randomBytes(32).toString('hex')}\`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const testApiKey = await prisma.apiKey.upsert({
      where: { keyHash },
      update: {},
      create: {
        userId: testUser.id,
        name: 'Test API Key',
        keyHash,
        permissions: { analytics: true, licenses: true },
        isActive: true,
      },
    });
    
    console.log('✓ Test API key created:', apiKey);
    
    // Create test server
    const testServer = await prisma.server.upsert({
      where: { serverId: 'test-server-001' },
      update: {},
      create: {
        licenseId: testLicense.id,
        serverId: 'test-server-001',
        name: 'Test MCP Server',
        version: '1.0.0',
        isActive: true,
      },
    });
    
    console.log('✓ Test server created:', testServer.serverId);
    
    // Output test credentials
    console.log('\\n' + '='.repeat(60));
    console.log('TEST CREDENTIALS FOR MCP INTEGRATION:');
    console.log('='.repeat(60));
    console.log('User Email:', testUser.email);
    console.log('User Password: testpassword123');
    console.log('License Key:', testLicense.licenseKey);
    console.log('API Key:', apiKey);
    console.log('Server ID:', testServer.serverId);
    console.log('='.repeat(60));
    
    console.log('\\n✓ Test data creation completed successfully!');
    
  } catch (error) {
    console.error('✗ Failed to create test data:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { createTestData };
`;

  try {
    fs.writeFileSync('create-test-data.js', testDataScript);
    log('✓ Test data script created (create-test-data.js)', 'green');
    return true;
  } catch (error) {
    log(`✗ Failed to create test data script: ${error.message}`, 'red');
    return false;
  }
}

// Create curl test commands
function createCurlTestCommands() {
  logSection('Creating cURL Test Commands');
  
  const curlCommands = `#!/bin/bash

# MCP SaaS Backend API Test Commands
# Run these commands to test the API endpoints

BASE_URL="http://localhost:3001"
API_KEY="mcp_your_test_api_key_here"
LICENSE_KEY="MCP-YOUR-LICENSE-KEY-HERE"
AUTH_TOKEN="your_jwt_token_here"

echo "Testing MCP SaaS Backend API..."
echo "Base URL: $BASE_URL"
echo ""

# 1. Health Check
echo "1. Testing Health Check..."
curl -X GET "$BASE_URL/api/health" \\
  -H "Content-Type: application/json" \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 2. License Validation
echo "2. Testing License Validation..."
curl -X POST "$BASE_URL/api/auth/validate-license" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "'$LICENSE_KEY'",
    "serverId": "test-server-001",
    "serverName": "Test MCP Server",
    "serverVersion": "1.0.0"
  }' \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 3. Analytics Tracking
echo "3. Testing Analytics Tracking..."
curl -X POST "$BASE_URL/api/analytics/track" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $API_KEY" \\
  -d '{
    "licenseKey": "'$LICENSE_KEY'",
    "serverId": "test-server-001",
    "events": [
      {
        "eventType": "SERVER_START",
        "eventData": {
          "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
          "serverVersion": "1.0.0"
        }
      }
    ]
  }' \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 4. User Login
echo "4. Testing User Login..."
curl -X POST "$BASE_URL/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }' \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 5. Get User Profile (requires authentication)
echo "5. Testing User Profile (requires auth token)..."
curl -X GET "$BASE_URL/api/user/profile" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AUTH_TOKEN" \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 6. Get User Licenses
echo "6. Testing User Licenses..."
curl -X GET "$BASE_URL/api/user/licenses" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AUTH_TOKEN" \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 7. Get Analytics Summary
echo "7. Testing Analytics Summary..."
curl -X GET "$BASE_URL/api/analytics/summary" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $AUTH_TOKEN" \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

# 8. Test CORS
echo "8. Testing CORS..."
curl -X GET "$BASE_URL/api/health" \\
  -H "Origin: http://localhost:3000" \\
  -H "Content-Type: application/json" \\
  -v \\
  -w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\n\\n"

echo "API testing completed!"
`;

  try {
    fs.writeFileSync('test-api.sh', curlCommands);
    fs.chmodSync('test-api.sh', '755');
    log('✓ cURL test commands created (test-api.sh)', 'green');
    return true;
  } catch (error) {
    log(`✗ Failed to create cURL test commands: ${error.message}`, 'red');
    return false;
  }
}

// Start server function
function startServer() {
  logSection('Starting Backend Server');
  
  log('Starting the backend server...', 'yellow');
  log('Server will be available at: http://localhost:3001', 'cyan');
  log('Press Ctrl+C to stop the server', 'yellow');
  
  try {
    const serverProcess = spawn('node', ['src/server.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    serverProcess.on('error', (error) => {
      log(`✗ Failed to start server: ${error.message}`, 'red');
    });
    
    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        log(`Server exited with code ${code}`, 'red');
      }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log('\nShutting down server...', 'yellow');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
    
    return serverProcess;
  } catch (error) {
    log(`✗ Failed to start server: ${error.message}`, 'red');
    return null;
  }
}

// Main setup function
async function setupTestEnvironment() {
  log(`${colors.bright}${colors.blue}MCP SaaS Backend Test Environment Setup${colors.reset}`);
  log(`${colors.blue}This script will set up the test environment for MCP integration${colors.reset}\n`);
  
  try {
    // Setup environment
    if (!setupEnvironment()) {
      log('Environment setup failed. Exiting.', 'red');
      process.exit(1);
    }
    
    // Setup database
    if (!setupDatabase()) {
      log('Database setup failed. Please check your PostgreSQL connection.', 'red');
      log('You can continue with manual database setup and run the server manually.', 'yellow');
    }
    
    // Create test data script
    if (!createTestDataScript()) {
      log('Test data script creation failed.', 'red');
    }
    
    // Create curl test commands
    if (!createCurlTestCommands()) {
      log('cURL test commands creation failed.', 'red');
    }
    
    logSection('Setup Complete');
    log('✓ Environment file created (.env.local)', 'green');
    log('✓ Test data script created (create-test-data.js)', 'green');
    log('✓ cURL test commands created (test-api.sh)', 'green');
    
    log('\nNext steps:', 'bright');
    log('1. Update the API keys and credentials in .env.local', 'yellow');
    log('2. Run: node create-test-data.js (to create test data)', 'yellow');
    log('3. Run: node test-backend.js (to test the backend)', 'yellow');
    log('4. Run: ./test-api.sh (to test with cURL)', 'yellow');
    log('5. Start the server: npm run dev or node src/server.ts', 'yellow');
    
    // Ask if user wants to start the server
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\nDo you want to start the server now? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        startServer();
      } else {
        log('Setup completed. You can start the server manually when ready.', 'green');
        rl.close();
      }
    });
    
  } catch (error) {
    log(`Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupTestEnvironment();
}

module.exports = { setupTestEnvironment, setupEnvironment, setupDatabase };
