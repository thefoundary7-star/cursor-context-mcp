#!/usr/bin/env node

/**
 * Test script to verify the test_coverage_analysis implementation
 */

import { handleTestTool } from './src/tools/testTools.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testCoverageAnalysis() {
  console.log('📊 Testing Coverage Analysis Implementation');
  console.log('==========================================');
  
  try {
    // Test 1: Test with auto-detection
    console.log('\n1️⃣ Testing Auto-detection:');
    console.log('----------------------------');
    
    const autoResult = await handleTestTool('test_coverage_analysis', {
      directory: '.',
      framework: 'auto',
      timeout: 30000
    });
    
    console.log('✅ Auto-detection Result:');
    console.log(JSON.stringify(autoResult, null, 2));
    
    // Test 2: Test with explicit Jest framework
    console.log('\n2️⃣ Testing Jest Coverage:');
    console.log('----------------------------');
    
    const testDir = './coverage-test-project';
    if (!require('fs').existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Create a simple Jest test file with source code
    const sourceCode = `
// src/utils.js
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
`;
    
    const testCode = `
// src/utils.test.js
import { add, subtract, multiply, divide } from './utils.js';

describe('Math Utils', () => {
  test('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  
  test('should subtract two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });
  
  test('should multiply two numbers', () => {
    expect(multiply(2, 3)).toBe(6);
  });
  
  test('should divide two numbers', () => {
    expect(divide(6, 2)).toBe(3);
  });
  
  test('should throw error on division by zero', () => {
    expect(() => divide(5, 0)).toThrow('Division by zero');
  });
});
`;
    
    // Create src directory and files
    if (!require('fs').existsSync(join(testDir, 'src'))) {
      mkdirSync(join(testDir, 'src'), { recursive: true });
    }
    
    writeFileSync(join(testDir, 'src', 'utils.js'), sourceCode);
    writeFileSync(join(testDir, 'src', 'utils.test.js'), testCode);
    
    // Create package.json with Jest
    const packageJson = {
      "name": "coverage-test-project",
      "scripts": {
        "test": "jest",
        "test:coverage": "jest --coverage"
      },
      "devDependencies": {
        "jest": "^29.0.0"
      },
      "jest": {
        "testEnvironment": "node",
        "collectCoverageFrom": [
          "src/**/*.js",
          "!src/**/*.test.js"
        ]
      }
    };
    
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    const jestCoverageResult = await handleTestTool('test_coverage_analysis', {
      directory: testDir,
      framework: 'jest',
      timeout: 30000
    });
    
    console.log('✅ Jest Coverage Result:');
    console.log(JSON.stringify(jestCoverageResult, null, 2));
    
    // Test 3: Test with Pytest framework
    console.log('\n3️⃣ Testing Pytest Coverage:');
    console.log('-----------------------------');
    
    const pytestDir = './pytest-coverage-project';
    if (!require('fs').existsSync(pytestDir)) {
      mkdirSync(pytestDir, { recursive: true });
    }
    
    const pythonSource = `
# src/math_utils.py
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        raise ValueError("Division by zero")
    return a / b
`;
    
    const pythonTest = `
# tests/test_math_utils.py
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from math_utils import add, subtract, multiply, divide

def test_add():
    assert add(2, 3) == 5

def test_subtract():
    assert subtract(5, 3) == 2

def test_multiply():
    assert multiply(2, 3) == 6

def test_divide():
    assert divide(6, 2) == 3

def test_divide_by_zero():
    try:
        divide(5, 0)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert str(e) == "Division by zero"
`;
    
    // Create src and tests directories
    if (!require('fs').existsSync(join(pytestDir, 'src'))) {
      mkdirSync(join(pytestDir, 'src'), { recursive: true });
    }
    if (!require('fs').existsSync(join(pytestDir, 'tests'))) {
      mkdirSync(join(pytestDir, 'tests'), { recursive: true });
    }
    
    writeFileSync(join(pytestDir, 'src', 'math_utils.py'), pythonSource);
    writeFileSync(join(pytestDir, 'tests', 'test_math_utils.py'), pythonTest);
    
    // Create pytest.ini
    writeFileSync(join(pytestDir, 'pytest.ini'), '[pytest]\ntestpaths = tests\n');
    
    const pytestCoverageResult = await handleTestTool('test_coverage_analysis', {
      directory: pytestDir,
      framework: 'pytest',
      timeout: 30000
    });
    
    console.log('✅ Pytest Coverage Result:');
    console.log(JSON.stringify(pytestCoverageResult, null, 2));
    
    // Test 4: Test with unsupported framework
    console.log('\n4️⃣ Testing Unsupported Framework:');
    console.log('-----------------------------------');
    
    const unsupportedResult = await handleTestTool('test_coverage_analysis', {
      directory: '.',
      framework: 'vitest', // Not supported
      timeout: 30000
    });
    
    console.log('✅ Unsupported Framework Result:');
    console.log(JSON.stringify(unsupportedResult, null, 2));
    
    // Test 5: Test with timeout
    console.log('\n5️⃣ Testing Timeout:');
    console.log('---------------------');
    
    const timeoutResult = await handleTestTool('test_coverage_analysis', {
      directory: '.',
      framework: 'jest',
      timeout: 1000 // Very short timeout
    });
    
    console.log('✅ Timeout Result:');
    console.log(JSON.stringify(timeoutResult, null, 2));
    
    // Test 6: Test with different directory
    console.log('\n6️⃣ Testing Different Directory:');
    console.log('---------------------------------');
    
    const differentDirResult = await handleTestTool('test_coverage_analysis', {
      directory: testDir,
      framework: 'auto',
      timeout: 30000
    });
    
    console.log('✅ Different Directory Result:');
    console.log(JSON.stringify(differentDirResult, null, 2));
    
    console.log('\n🎉 All coverage analysis tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testCoverageParsing() {
  console.log('\n🔍 Testing Coverage Parsing:');
  console.log('============================');
  
  try {
    // Test with a project that has coverage data
    const coverageResult = await handleTestTool('test_coverage_analysis', {
      directory: '.',
      framework: 'jest',
      timeout: 30000
    });
    
    if (coverageResult.success) {
      console.log('✅ Coverage Data Structure:');
      console.log(`- Framework: ${coverageResult.data.framework}`);
      console.log(`- Overall Coverage: ${coverageResult.data.coverage}%`);
      console.log(`- Total Files: ${coverageResult.data.files.length}`);
      console.log(`- Total Lines: ${coverageResult.data.totalLines}`);
      console.log(`- Covered Lines: ${coverageResult.data.coveredLines}`);
      console.log(`- Uncovered Lines: ${coverageResult.data.uncoveredLines}`);
      
      if (coverageResult.data.files.length > 0) {
        console.log('\n📁 File Coverage Details:');
        coverageResult.data.files.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.file}: ${file.coverage.toFixed(2)}% (${file.covered}/${file.covered + file.uncovered})`);
        });
      }
    } else {
      console.log('⚠️ Coverage analysis failed:', coverageResult.error);
    }
    
  } catch (error) {
    console.error('❌ Coverage parsing test failed:', error.message);
  }
}

async function main() {
  try {
    await testCoverageAnalysis();
    await testCoverageParsing();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
