#!/usr/bin/env node

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
    const licenseKey = `MCP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    
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
    const apiKey = `mcp_${crypto.randomBytes(32).toString('hex')}`;
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
    console.log('\n' + '='.repeat(60));
    console.log('TEST CREDENTIALS FOR MCP INTEGRATION:');
    console.log('='.repeat(60));
    console.log('User Email:', testUser.email);
    console.log('User Password: testpassword123');
    console.log('License Key:', testLicense.licenseKey);
    console.log('API Key:', apiKey);
    console.log('Server ID:', testServer.serverId);
    console.log('='.repeat(60));
    
    console.log('\n✓ Test data creation completed successfully!');
    
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
