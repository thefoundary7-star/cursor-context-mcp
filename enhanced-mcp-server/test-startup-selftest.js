#!/usr/bin/env node

/**
 * Test script to verify the startup self-test functionality
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Enhanced MCP Server startup self-test...\n');

// Test 1: Normal startup (no self-test)
console.log('1. Testing normal startup (no self-test)...');
const normalStart = spawn(process.execPath, ['dist/index.js'], {
  cwd: __dirname,
  stdio: 'pipe',
  timeout: 5000
});

let normalOutput = '';
normalStart.stdout.on('data', (data) => {
  normalOutput += data.toString();
});

normalStart.stderr.on('data', (data) => {
  normalOutput += data.toString();
});

normalStart.on('close', (code) => {
  console.log('Normal startup completed');
  console.log('Output contains SELF_TEST:', normalOutput.includes('SELF_TEST'));
  console.log('---');
});

// Test 2: Startup with self-test enabled
setTimeout(() => {
  console.log('\n2. Testing startup with self-test enabled...');
  const selftestStart = spawn(process.execPath, ['dist/index.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, SELF_TEST_ON_STARTUP: 'true' },
    timeout: 10000
  });

  let selftestOutput = '';
  selftestStart.stdout.on('data', (data) => {
    selftestOutput += data.toString();
  });

  selftestStart.stderr.on('data', (data) => {
    selftestOutput += data.toString();
  });

  selftestStart.on('close', (code) => {
    console.log('Self-test startup completed');
    console.log('Output contains SELF_TEST:', selftestOutput.includes('SELF_TEST'));
    console.log('Output contains self-test results:', selftestOutput.includes('Self-test completed'));
    console.log('---');
    
    // Clean up
    process.exit(0);
  });
}, 2000);
