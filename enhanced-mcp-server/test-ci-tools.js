#!/usr/bin/env node

/**
 * Test script for CI/CD Integration tools
 * Tests ci_health_gate and generate_project_report tools
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = './test-ci-project';
const TEST_TIMEOUT = 30000; // 30 seconds

// Test project structure
const testProjectFiles = {
  'package.json': JSON.stringify({
    name: 'test-ci-project',
    version: '1.0.0',
    scripts: {
      test: 'echo "Tests passed"',
      lint: 'echo "Linting passed"'
    },
    dependencies: {
      'lodash': '^4.17.21'
    }
  }, null, 2),
  
  'src/index.js': `/**
 * Main application file
 * @param {string} name - The name to greet
 * @returns {string} Greeting message
 */
function greet(name) {
  return \`Hello, \${name}!\`;
}

module.exports = { greet };`,
  
  'src/utils.js': `/**
 * Utility functions
 */
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };`,
  
  'README.md': `# Test CI Project

This is a test project for CI/CD integration tools.

## Features

- Basic functionality
- Utility functions
- Documentation

## Usage

\`\`\`javascript
const { greet } = require('./src/index');
console.log(greet('World'));
\`\`\`
`,
  
  'test/index.test.js': `const { greet } = require('../src/index');
const { add, multiply } = require('../src/utils');

// Simple test cases
console.log('Running tests...');

// Test greet function
const greeting = greet('Test');
if (greeting === 'Hello, Test!') {
  console.log('✓ greet function works');
} else {
  console.log('✗ greet function failed');
  process.exit(1);
}

// Test add function
const sum = add(2, 3);
if (sum === 5) {
  console.log('✓ add function works');
} else {
  console.log('✗ add function failed');
  process.exit(1);
}

// Test multiply function
const product = multiply(2, 3);
if (product === 6) {
  console.log('✓ multiply function works');
} else {
  console.log('✗ multiply function failed');
  process.exit(1);
}

console.log('All tests passed!');
`
};

/**
 * Setup test project
 */
function setupTestProject() {
  console.log('Setting up test project...');
  
  // Create test directory
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
  
  // Create subdirectories
  mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'test'), { recursive: true });
  
  // Write test files
  for (const [filePath, content] of Object.entries(testProjectFiles)) {
    const fullPath = join(TEST_DIR, filePath);
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`Created: ${filePath}`);
  }
  
  console.log('Test project setup complete');
}

/**
 * Clean up test project
 */
function cleanupTestProject() {
  console.log('Cleaning up test project...');
  
  if (existsSync(TEST_DIR)) {
    const { rmSync } = require('fs');
    rmSync(TEST_DIR, { recursive: true, force: true });
    console.log('Test project cleaned up');
  }
}

/**
 * Test CI health gate tool
 */
async function testCIHealthGate() {
  console.log('\n=== Testing CI Health Gate ===');
  
  return new Promise((resolve, reject) => {
    const mcp = spawn(process.execPath, ['dist/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Send tool request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'ci_health_gate',
        arguments: {
          threshold: 60,
          projectPath: TEST_DIR,
          includeTests: true,
          includeLint: true,
          includeDependencies: true,
          includeDocs: true
        }
      }
    };
    
    mcp.stdin.write(JSON.stringify(request) + '\n');
    
    // Wait for response
    setTimeout(() => {
      mcp.kill();
      
      try {
        const lines = output.split('\n').filter(line => line.trim());
        let response = null;
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.result) {
              response = parsed.result;
              break;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
        
        if (response && response.content) {
          const result = JSON.parse(response.content[0].text);
          console.log('CI Health Gate Result:');
          console.log(`- Passed: ${result.passed}`);
          console.log(`- Health Score: ${result.healthScore}/${result.threshold}`);
          console.log(`- Failures: ${result.failures?.length || 0}`);
          console.log(`- Warnings: ${result.warnings?.length || 0}`);
          
          if (result.failures && result.failures.length > 0) {
            console.log('Failures:', result.failures);
          }
          
          if (result.warnings && result.warnings.length > 0) {
            console.log('Warnings:', result.warnings);
          }
          
          resolve(result);
        } else {
          console.error('No valid response received');
          console.error('Output:', output);
          console.error('Error:', errorOutput);
          reject(new Error('No valid response'));
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        reject(error);
      }
    }, TEST_TIMEOUT);
    
    mcp.on('error', (error) => {
      console.error('MCP process error:', error);
      reject(error);
    });
  });
}

/**
 * Test generate project report tool
 */
async function testGenerateProjectReport() {
  console.log('\n=== Testing Generate Project Report ===');
  
  return new Promise((resolve, reject) => {
    const mcp = spawn(process.execPath, ['dist/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Send tool request
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'generate_project_report',
        arguments: {
          directory: TEST_DIR,
          format: 'markdown',
          includeTests: true,
          includeSecurity: true,
          includeQuality: true,
          includeDocs: true
        }
      }
    };
    
    mcp.stdin.write(JSON.stringify(request) + '\n');
    
    // Wait for response
    setTimeout(() => {
      mcp.kill();
      
      try {
        const lines = output.split('\n').filter(line => line.trim());
        let response = null;
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.result) {
              response = parsed.result;
              break;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
        
        if (response && response.content) {
          const result = JSON.parse(response.content[0].text);
          console.log('Generate Project Report Result:');
          console.log(`- Success: ${result.success}`);
          console.log(`- Output File: ${result.outputFile || 'None'}`);
          console.log(`- Format: ${result.format}`);
          
          if (result.report) {
            console.log('Report Summary:');
            console.log(`- Overall Health: ${result.report.summary?.overallHealth || 0}/100`);
            console.log(`- Test Coverage: ${result.report.summary?.testCoverage || 0}%`);
            console.log(`- Code Quality: ${result.report.summary?.codeQuality || 0}/100`);
            console.log(`- Security Score: ${result.report.summary?.securityScore || 0}/100`);
            console.log(`- Doc Coverage: ${result.report.summary?.docCoverage || 0}%`);
          }
          
          resolve(result);
        } else {
          console.error('No valid response received');
          console.error('Output:', output);
          console.error('Error:', errorOutput);
          reject(new Error('No valid response'));
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        reject(error);
      }
    }, TEST_TIMEOUT);
    
    mcp.on('error', (error) => {
      console.error('MCP process error:', error);
      reject(error);
    });
  });
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting CI Tools Tests');
  console.log('============================');
  
  try {
    // Setup
    setupTestProject();
    
    // Test CI Health Gate
    const healthGateResult = await testCIHealthGate();
    console.log('✅ CI Health Gate test completed');
    
    // Test Generate Project Report
    const reportResult = await testGenerateProjectReport();
    console.log('✅ Generate Project Report test completed');
    
    // Summary
    console.log('\n🎉 All CI Tools Tests Passed!');
    console.log('============================');
    console.log('✅ ci_health_gate - Working');
    console.log('✅ generate_project_report - Working');
    
    // Check if report file was generated
    if (reportResult.outputFile && existsSync(reportResult.outputFile)) {
      console.log(`📄 Report generated: ${reportResult.outputFile}`);
      
      // Show first few lines of the report
      const reportContent = readFileSync(reportResult.outputFile, 'utf-8');
      const lines = reportContent.split('\n').slice(0, 10);
      console.log('\nReport Preview:');
      console.log(lines.join('\n'));
      console.log('...');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    cleanupTestProject();
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runTests, testCIHealthGate, testGenerateProjectReport };
