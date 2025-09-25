#!/usr/bin/env node

/**
 * Test script to verify the detect_test_framework implementation
 */

import { handleTestTool } from './src/tools/testTools.js';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testFrameworkDetection() {
  console.log('🔍 Testing Framework Detection Implementation');
  console.log('===========================================');
  
  try {
    // Test 1: Detect Jest framework
    console.log('\n1️⃣ Testing Jest Detection:');
    console.log('----------------------------');
    
    // Create a temporary Jest project structure
    const jestDir = './test-jest-project';
    if (!existsSync(jestDir)) {
      mkdirSync(jestDir, { recursive: true });
    }
    
    const jestPackageJson = {
      "name": "test-jest-project",
      "scripts": {
        "test": "jest",
        "test:watch": "jest --watch"
      },
      "devDependencies": {
        "jest": "^29.0.0",
        "@jest/core": "^29.0.0"
      }
    };
    
    writeFileSync(join(jestDir, 'package.json'), JSON.stringify(jestPackageJson, null, 2));
    
    const jestResult = await handleTestTool('detect_test_framework', {
      directory: jestDir
    });
    
    console.log('✅ Jest Detection Result:');
    console.log(JSON.stringify(jestResult, null, 2));
    
    // Test 2: Detect Pytest framework
    console.log('\n2️⃣ Testing Pytest Detection:');
    console.log('------------------------------');
    
    const pytestDir = './test-pytest-project';
    if (!existsSync(pytestDir)) {
      mkdirSync(pytestDir, { recursive: true });
    }
    
    writeFileSync(join(pytestDir, 'pytest.ini'), '[pytest]\ntestpaths = tests\n');
    writeFileSync(join(pytestDir, 'conftest.py'), '# Pytest configuration\n');
    
    const pytestResult = await handleTestTool('detect_test_framework', {
      directory: pytestDir
    });
    
    console.log('✅ Pytest Detection Result:');
    console.log(JSON.stringify(pytestResult, null, 2));
    
    // Test 3: Detect Mocha framework
    console.log('\n3️⃣ Testing Mocha Detection:');
    console.log('-----------------------------');
    
    const mochaDir = './test-mocha-project';
    if (!existsSync(mochaDir)) {
      mkdirSync(mochaDir, { recursive: true });
    }
    
    const mochaPackageJson = {
      "name": "test-mocha-project",
      "scripts": {
        "test": "mocha",
        "test:watch": "mocha --watch"
      },
      "devDependencies": {
        "mocha": "^10.0.0"
      }
    };
    
    writeFileSync(join(mochaDir, 'package.json'), JSON.stringify(mochaPackageJson, null, 2));
    
    const mochaResult = await handleTestTool('detect_test_framework', {
      directory: mochaDir
    });
    
    console.log('✅ Mocha Detection Result:');
    console.log(JSON.stringify(mochaResult, null, 2));
    
    // Test 4: Unknown framework (no test setup)
    console.log('\n4️⃣ Testing Unknown Framework:');
    console.log('------------------------------');
    
    const unknownDir = './test-unknown-project';
    if (!existsSync(unknownDir)) {
      mkdirSync(unknownDir, { recursive: true });
    }
    
    const unknownResult = await handleTestTool('detect_test_framework', {
      directory: unknownDir
    });
    
    console.log('✅ Unknown Framework Result:');
    console.log(JSON.stringify(unknownResult, null, 2));
    
    // Test 5: Test script detection
    console.log('\n5️⃣ Testing Script-based Detection:');
    console.log('-----------------------------------');
    
    const scriptDir = './test-script-project';
    if (!existsSync(scriptDir)) {
      mkdirSync(scriptDir, { recursive: true });
    }
    
    const scriptPackageJson = {
      "name": "test-script-project",
      "scripts": {
        "test": "jest --config jest.config.js",
        "test:unit": "jest --testPathPattern=unit"
      }
    };
    
    writeFileSync(join(scriptDir, 'package.json'), JSON.stringify(scriptPackageJson, null, 2));
    
    const scriptResult = await handleTestTool('detect_test_framework', {
      directory: scriptDir
    });
    
    console.log('✅ Script Detection Result:');
    console.log(JSON.stringify(scriptResult, null, 2));
    
    console.log('\n🎉 All framework detection tests completed!');
    
    // Cleanup test directories
    console.log('\n🧹 Cleaning up test directories...');
    // Note: In a real implementation, you'd want to clean up these test directories
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function main() {
  try {
    await testFrameworkDetection();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
