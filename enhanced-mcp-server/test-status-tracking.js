#!/usr/bin/env node

/**
 * Test script to verify the get_test_status implementation
 */

import { handleTestTool } from './src/tools/testTools.js';

async function testStatusTracking() {
  console.log('📊 Testing Test Status Tracking');
  console.log('===============================');
  
  try {
    // Test 1: Start a test run
    console.log('\n1️⃣ Starting Test Run:');
    console.log('---------------------');
    
    const runResult = await handleTestTool('run_tests', {
      directory: '.',
      framework: 'jest',
      testPattern: 'test',
      coverage: false,
      timeout: 30000
    });
    
    console.log('✅ Test Run Started:');
    console.log(JSON.stringify(runResult, null, 2));
    
    const runId = runResult.data?.runId;
    if (!runId) {
      console.log('❌ No runId returned from test run');
      return;
    }
    
    // Test 2: Check status immediately
    console.log('\n2️⃣ Checking Status Immediately:');
    console.log('----------------------------------');
    
    const statusResult1 = await handleTestTool('get_test_status', {
      runId: runId
    });
    
    console.log('✅ Status Check 1:');
    console.log(JSON.stringify(statusResult1, null, 2));
    
    // Test 3: Wait a bit and check status again
    console.log('\n3️⃣ Checking Status After Delay:');
    console.log('--------------------------------');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResult2 = await handleTestTool('get_test_status', {
      runId: runId
    });
    
    console.log('✅ Status Check 2:');
    console.log(JSON.stringify(statusResult2, null, 2));
    
    // Test 4: Check status with invalid runId
    console.log('\n4️⃣ Testing Invalid runId:');
    console.log('---------------------------');
    
    const invalidResult = await handleTestTool('get_test_status', {
      runId: 'invalid-run-id-12345'
    });
    
    console.log('✅ Invalid runId Result:');
    console.log(JSON.stringify(invalidResult, null, 2));
    
    // Test 5: Check status without runId
    console.log('\n5️⃣ Testing Missing runId:');
    console.log('---------------------------');
    
    const missingResult = await handleTestTool('get_test_status', {
      // No runId provided
    });
    
    console.log('✅ Missing runId Result:');
    console.log(JSON.stringify(missingResult, null, 2));
    
    // Test 6: Wait for completion and check final status
    console.log('\n6️⃣ Checking Final Status:');
    console.log('---------------------------');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalStatusResult = await handleTestTool('get_test_status', {
      runId: runId
    });
    
    console.log('✅ Final Status:');
    console.log(JSON.stringify(finalStatusResult, null, 2));
    
    console.log('\n🎉 All status tracking tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testConcurrentRuns() {
  console.log('\n🔄 Testing Concurrent Test Runs:');
  console.log('=================================');
  
  try {
    // Start multiple test runs
    const run1 = await handleTestTool('run_tests', {
      directory: '.',
      framework: 'jest',
      timeout: 10000
    });
    
    const run2 = await handleTestTool('run_tests', {
      directory: '.',
      framework: 'mocha',
      timeout: 10000
    });
    
    console.log('✅ Started concurrent runs:');
    console.log(`Run 1 ID: ${run1.data?.runId}`);
    console.log(`Run 2 ID: ${run2.data?.runId}`);
    
    // Check status of both runs
    if (run1.data?.runId) {
      const status1 = await handleTestTool('get_test_status', {
        runId: run1.data.runId
      });
      console.log('✅ Run 1 Status:', JSON.stringify(status1.data, null, 2));
    }
    
    if (run2.data?.runId) {
      const status2 = await handleTestTool('get_test_status', {
        runId: run2.data.runId
      });
      console.log('✅ Run 2 Status:', JSON.stringify(status2.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Concurrent test failed:', error.message);
  }
}

async function main() {
  try {
    await testStatusTracking();
    await testConcurrentRuns();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
