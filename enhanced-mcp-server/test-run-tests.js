#!/usr/bin/env node

/**
 * Test script to verify the run_tests implementation
 */

import { handleTestTool } from './src/tools/testTools.js';

async function testRunTests() {
  console.log('🧪 Testing run_tests Implementation');
  console.log('===================================');
  
  try {
    // Test 1: Framework detection
    console.log('\n1️⃣ Testing Framework Detection:');
    console.log('--------------------------------');
    
    const detectResult = await handleTestTool('detect_test_framework', {
      directory: '.'
    });
    
    console.log('✅ Framework Detection Result:');
    console.log(JSON.stringify(detectResult, null, 2));
    
    // Test 2: Run tests with auto-detection
    console.log('\n2️⃣ Testing run_tests with auto-detection:');
    console.log('------------------------------------------');
    
    const runResult = await handleTestTool('run_tests', {
      directory: '.',
      framework: 'auto',
      coverage: false,
      timeout: 30000
    });
    
    console.log('✅ Run Tests Result:');
    console.log(JSON.stringify(runResult, null, 2));
    
    // Test 3: Run tests with specific framework
    console.log('\n3️⃣ Testing run_tests with Jest:');
    console.log('-------------------------------');
    
    const jestResult = await handleTestTool('run_tests', {
      directory: '.',
      framework: 'jest',
      testPattern: 'test',
      coverage: false,
      timeout: 30000
    });
    
    console.log('✅ Jest Tests Result:');
    console.log(JSON.stringify(jestResult, null, 2));
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function main() {
  try {
    await testRunTests();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
