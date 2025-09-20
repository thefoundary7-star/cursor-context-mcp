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

async function checkRequiredPackages() {
  console.log('2. Checking required packages...\n');
  
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    console.log('❌ package.json not found');
    return false;
  }
  
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
  
  const requiredPackages = ['stripe', 'nodemailer', '@anthropic-ai/mcp-sdk'];
  const missing = requiredPackages.filter(pkg => !dependencies[pkg]);
  
  if (missing.length > 0) {
    console.log(`⚠️  Missing packages: ${missing.join(', ')}`);
    console.log('Installing missing packages...');
    
    try {
      await runCommand(`npm install ${missing.join(' ')}`);
      console.log('✅ Packages installed successfully');
    } catch (error) {
      console.log('❌ Failed to install packages:', error.message);
      return false;
    }
  } else {
    console.log('✅ All required packages are installed');
  }
  
  console.log('');
  return true;
}

async function runConfigurationTests() {
  console.log('3. Running configuration tests...\n');
  
  const tests = [
    { name: 'Stripe', script: './scripts/test/test-stripe.js' },
    { name: 'Email', script: './scripts/test/test-email.js' },
    { name: 'Analytics', script: './scripts/test/test-analytics.js' }
  ];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Running ${test.name} Configuration Test`);
    console.log('='.repeat(50));
    
    try {
      if (fs.existsSync(test.script)) {
        await runCommand(`node ${test.script}`);
        console.log(`✅ ${test.name} test completed`);
      } else {
        console.log(`⚠️  Test script not found: ${test.script}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} test failed:`, error.message);
    }
  }
}

async function generateConfigurationSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 CONFIGURATION SUMMARY');
  console.log('='.repeat(60));
  
  const requiredVars = [
    'DATABASE_URL',
    'STRIPE_SECRET_KEY', 
    'STRIPE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_GA_ID',
    'SMTP_HOST',
    'SMTP_PASS',
    'FROM_EMAIL'
  ];
  
  console.log('\nEnvironment Variables Status:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName.includes('SECRET') || varName.includes('PASS') 
        ? `${value.substring(0, 10)}...` 
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    } else {
      console.log(`❌ ${varName}: Not configured`);
    }
  });
  
  console.log('\nNext Steps:');
  console.log('1. 🔧 Complete any missing environment variables');
  console.log('2. 🌐 Set up your domain and SSL certificate');
  console.log('3. 🗄️  Configure your production database');
  console.log('4. 🚀 Test the complete customer journey');
  console.log('5. 📊 Verify analytics tracking in production');
  
  console.log('\nQuick Start Commands:');
  console.log('npm run dev          # Start development server');
  console.log('npm run build        # Build for production');
  console.log('npm run test         # Run all tests');
  
  console.log('\nManual Testing Checklist:');
  console.log('- [ ] Landing page loads correctly');
  console.log('- [ ] Plan selection works');
  console.log('- [ ] Registration flow completes');
  console.log('- [ ] Email delivery works');
  console.log('- [ ] Payment processing works');
  console.log('- [ ] License generation works');
  console.log('- [ ] Analytics events fire');
  console.log('- [ ] Customer dashboard loads');
}

async function main() {
  try {
    const envExists = await checkEnvironmentFile();
    
    if (!envExists) {
      console.log('Please configure your .env file and run this script again.');
      process.exit(1);
    }
    
    await checkRequiredPackages();
    await runConfigurationTests();
    await generateConfigurationSummary();
    
    console.log('\n🎉 Environment setup completed!');
    console.log('\nYour MCP Server platform is ready for testing and deployment.');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();