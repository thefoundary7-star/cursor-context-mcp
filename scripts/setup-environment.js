#!/usr/bin/env node

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 MCP Server Platform - Complete Environment Setup\n');

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function checkEnvironmentFile() {
  console.log('1. Checking environment configuration...\n');
  
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      console.log('⚠️  .env file not found, copying from .env.example...');
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ .env file created from template');
      console.log('❗ Please edit .env file with your actual configuration values\n');
      return false;
    } else {
      console.log('❌ Neither .env nor .env.example found');
      return false;
    }
  }
  
  console.log('✅ .env file found\n');
  return true;
}

async function runConfigurationTests() {
  console.log('2. Running configuration tests...\n');
  
  const tests = [
    { name: 'Stripe', script: './scripts/test/test-stripe.js' },
    { name: 'Email', script: './scripts/test/test-email.js' },
    { name: 'Analytics', script: './scripts/test/test-analytics.js' }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Running ${test.name} Configuration Test`);
    console.log('='.repeat(50));
    
    try {
      if (fs.existsSync(test.script)) {
        const { stdout } = await runCommand(`node ${test.script}`);
        console.log(stdout);
        results.push({ name: test.name, status: 'success' });
      } else {
        console.log(`❌ Test script not found: ${test.script}`);
        results.push({ name: test.name, status: 'missing' });
      }
    } catch (error) {
      console.error(`❌ ${test.name} test failed`);
      results.push({ name: test.name, status: 'failed' });
    }
  }
  
  return results;
}

async function main() {
  try {
    const envExists = await checkEnvironmentFile();
    if (!envExists) {
      console.log('Please configure your .env file and run this script again.');
      return;
    }
    
    const testResults = await runConfigurationTests();
    
    console.log('\n🎯 SETUP COMPLETE!');
    console.log('Run: npm run dev to start your server');
    
  } catch (error) {
    console.error('Setup failed:', error.message);
  }
}

main();