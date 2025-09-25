#!/usr/bin/env node

/**
 * Test script to verify the run_test_file implementation
 */

import { handleTestTool } from './src/tools/testTools.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testRunTestFile() {
  console.log('📁 Testing run_test_file Implementation');
  console.log('======================================');
  
  try {
    // Test 1: Test with non-existent file
    console.log('\n1️⃣ Testing Non-existent File:');
    console.log('-------------------------------');
    
    const nonExistentResult = await handleTestTool('run_test_file', {
      directory: '.',
      filePath: 'non-existent-test.js',
      framework: 'jest'
    });
    
    console.log('✅ Non-existent File Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 2: Test with missing filePath
    console.log('\n2️⃣ Testing Missing filePath:');
    console.log('------------------------------');
    
    const missingPathResult = await handleTestTool('run_test_file', {
      directory: '.',
      framework: 'jest'
      // No filePath provided
    });
    
    console.log('✅ Missing filePath Result:');
    console.log(JSON.stringify(missingPathResult, null, 2));
    
    // Test 3: Create a test file and run it
    console.log('\n3️⃣ Testing with Jest Test File:');
    console.log('----------------------------------');
    
    const testDir = './test-file-project';
    if (!require('fs').existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Create a simple Jest test file
    const jestTestContent = `
describe('Sample Test', () => {
  test('should pass', () => {
    expect(1 + 1).toBe(2);
  });
  
  test('should fail', () => {
    expect(1 + 1).toBe(3);
  });
});
`;
    
    writeFileSync(join(testDir, 'sample.test.js'), jestTestContent);
    
    // Create package.json with Jest
    const packageJson = {
      "name": "test-file-project",
      "scripts": {
        "test": "jest"
      },
      "devDependencies": {
        "jest": "^29.0.0"
      }
    };
    
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    const jestFileResult = await handleTestTool('run_test_file', {
      directory: testDir,
      filePath: 'sample.test.js',
      framework: 'jest',
      timeout: 10000
    });
    
    console.log('✅ Jest File Result:');
    console.log(JSON.stringify(jestFileResult, null, 2));
    
    // Test 4: Test with auto-detection
    console.log('\n4️⃣ Testing Auto-detection:');
    console.log('----------------------------');
    
    const autoResult = await handleTestTool('run_test_file', {
      directory: testDir,
      filePath: 'sample.test.js',
      framework: 'auto',
      timeout: 10000
    });
    
    console.log('✅ Auto-detection Result:');
    console.log(JSON.stringify(autoResult, null, 2));
    
    // Test 5: Test with unsupported framework
    console.log('\n5️⃣ Testing Unsupported Framework:');
    console.log('------------------------------------');
    
    const unsupportedResult = await handleTestTool('run_test_file', {
      directory: testDir,
      filePath: 'sample.test.js',
      framework: 'vitest', // Not supported
      timeout: 10000
    });
    
    console.log('✅ Unsupported Framework Result:');
    console.log(JSON.stringify(unsupportedResult, null, 2));
    
    // Test 6: Test with coverage
    console.log('\n6️⃣ Testing with Coverage:');
    console.log('---------------------------');
    
    const coverageResult = await handleTestTool('run_test_file', {
      directory: testDir,
      filePath: 'sample.test.js',
      framework: 'jest',
      coverage: true,
      timeout: 15000
    });
    
    console.log('✅ Coverage Result:');
    console.log(JSON.stringify(coverageResult, null, 2));
    
    // Test 7: Test with different directory
    console.log('\n7️⃣ Testing Different Directory:');
    console.log('---------------------------------');
    
    const differentDirResult = await handleTestTool('run_test_file', {
      directory: testDir,
      filePath: 'sample.test.js',
      framework: 'jest',
      timeout: 10000
    });
    
    console.log('✅ Different Directory Result:');
    console.log(JSON.stringify(differentDirResult, null, 2));
    
    console.log('\n🎉 All run_test_file tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testPytestFile() {
  console.log('\n🐍 Testing Pytest File Execution:');
  console.log('===================================');
  
  try {
    const testDir = './test-pytest-project';
    if (!require('fs').existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Create a simple pytest test file
    const pytestTestContent = `
def test_addition():
    assert 1 + 1 == 2

def test_subtraction():
    assert 3 - 1 == 2

def test_failure():
    assert 1 + 1 == 3  # This will fail
`;
    
    writeFileSync(join(testDir, 'test_sample.py'), pytestTestContent);
    
    // Create pytest.ini
    writeFileSync(join(testDir, 'pytest.ini'), '[pytest]\ntestpaths = .\n');
    
    const pytestResult = await handleTestTool('run_test_file', {
      directory: testDir,
      filePath: 'test_sample.py',
      framework: 'pytest',
      timeout: 10000
    });
    
    console.log('✅ Pytest File Result:');
    console.log(JSON.stringify(pytestResult, null, 2));
    
  } catch (error) {
    console.error('❌ Pytest test failed:', error.message);
  }
}

async function main() {
  try {
    await testRunTestFile();
    await testPytestFile();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
