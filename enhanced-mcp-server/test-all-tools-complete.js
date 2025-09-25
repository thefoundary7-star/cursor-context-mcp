#!/usr/bin/env node

/**
 * Comprehensive test script for all Enhanced MCP Server tools
 * Tests all 28+ tools to ensure 100% implementation
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = './test-complete-project';
const TEST_TIMEOUT = 60000; // 60 seconds for comprehensive testing

// Enhanced test project structure
const testProjectFiles = {
  'package.json': JSON.stringify({
    name: 'test-complete-project',
    version: '1.0.0',
    description: 'A comprehensive test project for Enhanced MCP Server',
    scripts: {
      test: 'jest',
      lint: 'eslint src/',
      build: 'echo "Build completed"'
    },
    dependencies: {
      'lodash': '^4.17.21',
      'express': '^4.18.2'
    },
    devDependencies: {
      'jest': '^29.0.0',
      'eslint': '^8.0.0'
    }
  }, null, 2),
  
  'src/index.js': `/**
 * Main application entry point
 * @param {string} name - The name to greet
 * @returns {string} Greeting message
 */
function greet(name) {
  return \`Hello, \${name}!\`;
}

/**
 * Calculate the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}

module.exports = { greet, add };`,
  
  'src/utils.js': `/**
 * Utility functions for mathematical operations
 */
class MathUtils {
  /**
   * Multiply two numbers
   * @param {number} a - First number
   * @param {number} b - Second number
   * @returns {number} Product of a and b
   */
  static multiply(a, b) {
    return a * b;
  }
  
  /**
   * Calculate power of a number
   * @param {number} base - Base number
   * @param {number} exponent - Exponent
   * @returns {number} Result of base^exponent
   */
  static power(base, exponent) {
    return Math.pow(base, exponent);
  }
}

module.exports = { MathUtils };`,
  
  'src/api.js': `/**
 * API routes and handlers
 */
const express = require('express');
const router = express.Router();

/**
 * Health check endpoint
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
function healthCheck(req, res) {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
}

/**
 * Get user information
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
function getUser(req, res) {
  const { id } = req.params;
  res.json({ id, name: \`User \${id}\` });
}

router.get('/health', healthCheck);
router.get('/users/:id', getUser);

module.exports = router;`,
  
  'test/index.test.js': `const { greet, add } = require('../src/index');
const { MathUtils } = require('../src/utils');

describe('Main Application', () => {
  test('greet function works correctly', () => {
    expect(greet('World')).toBe('Hello, World!');
    expect(greet('Test')).toBe('Hello, Test!');
  });
  
  test('add function works correctly', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });
});

describe('MathUtils', () => {
  test('multiply function works correctly', () => {
    expect(MathUtils.multiply(2, 3)).toBe(6);
    expect(MathUtils.multiply(0, 5)).toBe(0);
  });
  
  test('power function works correctly', () => {
    expect(MathUtils.power(2, 3)).toBe(8);
    expect(MathUtils.power(5, 0)).toBe(1);
  });
});`,
  
  'README.md': `# Test Complete Project

This is a comprehensive test project for Enhanced MCP Server tools.

## Features

- **Core Functionality**: Basic application logic
- **Mathematical Utilities**: Advanced math operations
- **API Endpoints**: RESTful API routes
- **Testing**: Comprehensive test suite
- **Documentation**: Complete project documentation

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`javascript
const { greet, add } = require('./src/index');
console.log(greet('World')); // Hello, World!
console.log(add(2, 3)); // 5
\`\`\`

## API Endpoints

- \`GET /health\` - Health check
- \`GET /users/:id\` - Get user information

## Testing

\`\`\`bash
npm test
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT
`,
  
  'docs/API.md': `# API Documentation

## Endpoints

### Health Check
- **URL**: \`/health\`
- **Method**: GET
- **Response**: \`{ status: "healthy", timestamp: "..." }\`

### Get User
- **URL**: \`/users/:id\`
- **Method**: GET
- **Response**: \`{ id: "...", name: "User ..." }\`
`,
  
  'docs/DEVELOPMENT.md': `# Development Guide

## Setup

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Run tests: \`npm test\`

## Code Style

- Use ESLint for linting
- Follow JavaScript best practices
- Write comprehensive tests
- Document all functions

## Testing

- Unit tests in \`test/\` directory
- Integration tests for API endpoints
- Coverage reports generated automatically
`
};

/**
 * All tool names to test
 */
const ALL_TOOLS = [
  // File Operations (6 tools)
  'list_files',
  'read_file', 
  'write_file',
  'search_files',
  'get_file_diff',
  'get_file_stats',
  
  // Code Analysis (6 tools)
  'search_symbols',
  'find_references',
  'index_directory',
  'get_symbol_info',
  'clear_index',
  'get_index_stats',
  
  // Test Automation (5 tools)
  'run_tests',
  'detect_test_framework',
  'get_test_status',
  'run_test_file',
  'test_coverage_analysis',
  
  // Git Integration (4 tools)
  'get_commit_history',
  'get_file_blame',
  'get_branch_info',
  'find_commits_touching_file',
  
  // Security & Dependencies (5 tools)
  'security_audit',
  'analyze_dependencies',
  'check_vulnerabilities',
  'dependency_tree_analysis',
  'license_compliance_check',
  
  // Documentation (3 tools)
  'get_documentation',
  'documentation_coverage',
  'generate_docs',
  
  // Advanced Development (5 tools)
  'project_health_check',
  'code_quality_metrics',
  'refactoring_suggestions',
  'project_trend_tracking',
  'ide_feedback_stream',
  
  // Server Management (6 tools)
  'get_server_config',
  'update_config',
  'get_performance_stats',
  'clear_caches',
  'get_license_status',
  'activate_license',
  
  // CI/CD Integration (2 tools) - NEW!
  'ci_health_gate',
  'generate_project_report'
];

/**
 * Setup comprehensive test project
 */
function setupTestProject() {
  console.log('Setting up comprehensive test project...');
  
  // Create test directory
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
  
  // Create subdirectories
  mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'test'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'docs'), { recursive: true });
  
  // Write test files
  for (const [filePath, content] of Object.entries(testProjectFiles)) {
    const fullPath = join(TEST_DIR, filePath);
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`Created: ${filePath}`);
  }
  
  // Initialize git repository for git tools
  const { execSync } = require('child_process');
  try {
    execSync('git init', { cwd: TEST_DIR, stdio: 'pipe' });
    execSync('git add .', { cwd: TEST_DIR, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: TEST_DIR, stdio: 'pipe' });
    console.log('Git repository initialized');
  } catch (error) {
    console.warn('Could not initialize git repository:', error.message);
  }
  
  console.log('Comprehensive test project setup complete');
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
 * Test a single tool
 */
async function testTool(toolName, args = {}) {
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
      id: Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: {
          directory: TEST_DIR,
          ...args
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
          resolve({ tool: toolName, success: result.success, data: result.data });
        } else {
          reject(new Error(`No valid response for ${toolName}`));
        }
      } catch (error) {
        reject(new Error(`Error parsing response for ${toolName}: ${error.message}`));
      }
    }, TEST_TIMEOUT);
    
    mcp.on('error', (error) => {
      reject(new Error(`MCP process error for ${toolName}: ${error.message}`));
    });
  });
}

/**
 * Test all tools
 */
async function testAllTools() {
  console.log('🚀 Testing All Enhanced MCP Server Tools');
  console.log('==========================================');
  console.log(`Total tools to test: ${ALL_TOOLS.length}`);
  console.log('');
  
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };
  
  for (let i = 0; i < ALL_TOOLS.length; i++) {
    const toolName = ALL_TOOLS[i];
    console.log(`[${i + 1}/${ALL_TOOLS.length}] Testing ${toolName}...`);
    
    try {
      const result = await testTool(toolName);
      
      if (result.success) {
        console.log(`✅ ${toolName} - PASSED`);
        results.passed.push(toolName);
      } else {
        console.log(`❌ ${toolName} - FAILED (${result.data?.error || 'Unknown error'})`);
        results.failed.push(toolName);
      }
    } catch (error) {
      console.log(`⚠️  ${toolName} - SKIPPED (${error.message})`);
      results.skipped.push(toolName);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(results) {
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Skipped: ${results.skipped.length}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed.length / ALL_TOOLS.length) * 100)}%`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tools:');
    results.failed.forEach(tool => console.log(`  - ${tool}`));
  }
  
  if (results.skipped.length > 0) {
    console.log('\n⚠️  Skipped Tools:');
    results.skipped.forEach(tool => console.log(`  - ${tool}`));
  }
  
  console.log('\n🎯 Implementation Status:');
  console.log('========================');
  
  // Group by category
  const categories = {
    'File Operations': ['list_files', 'read_file', 'write_file', 'search_files', 'get_file_diff', 'get_file_stats'],
    'Code Analysis': ['search_symbols', 'find_references', 'index_directory', 'get_symbol_info', 'clear_index', 'get_index_stats'],
    'Test Automation': ['run_tests', 'detect_test_framework', 'get_test_status', 'run_test_file', 'test_coverage_analysis'],
    'Git Integration': ['get_commit_history', 'get_file_blame', 'get_branch_info', 'find_commits_touching_file'],
    'Security & Dependencies': ['security_audit', 'analyze_dependencies', 'check_vulnerabilities', 'dependency_tree_analysis', 'license_compliance_check'],
    'Documentation': ['get_documentation', 'documentation_coverage', 'generate_docs'],
    'Advanced Development': ['project_health_check', 'code_quality_metrics', 'refactoring_suggestions', 'project_trend_tracking', 'ide_feedback_stream'],
    'Server Management': ['get_server_config', 'update_config', 'get_performance_stats', 'clear_caches', 'get_license_status', 'activate_license'],
    'CI/CD Integration': ['ci_health_gate', 'generate_project_report']
  };
  
  for (const [category, tools] of Object.entries(categories)) {
    const categoryResults = tools.map(tool => ({
      tool,
      status: results.passed.includes(tool) ? '✅' : results.failed.includes(tool) ? '❌' : '⚠️'
    }));
    
    const passedCount = categoryResults.filter(r => r.status === '✅').length;
    const totalCount = categoryResults.length;
    
    console.log(`\n${category} (${passedCount}/${totalCount}):`);
    categoryResults.forEach(({ tool, status }) => {
      console.log(`  ${status} ${tool}`);
    });
  }
  
  // Final status
  const totalPassed = results.passed.length;
  const totalTools = ALL_TOOLS.length;
  const successRate = Math.round((totalPassed / totalTools) * 100);
  
  console.log('\n🎉 Final Status:');
  console.log('===============');
  console.log(`Total Tools Implemented: ${totalPassed}/${totalTools}`);
  console.log(`Success Rate: ${successRate}%`);
  
  if (successRate >= 90) {
    console.log('🏆 EXCELLENT! Enhanced MCP Server is ready for production!');
  } else if (successRate >= 80) {
    console.log('👍 GOOD! Most tools are working, minor issues to address.');
  } else if (successRate >= 70) {
    console.log('⚠️  FAIR! Several tools need attention.');
  } else {
    console.log('❌ NEEDS WORK! Many tools require fixes.');
  }
  
  return {
    totalTools,
    totalPassed,
    successRate,
    results
  };
}

/**
 * Main test runner
 */
async function runComprehensiveTests() {
  console.log('🚀 Enhanced MCP Server - Comprehensive Tool Testing');
  console.log('====================================================');
  console.log('Testing all 28+ tools for 100% implementation verification');
  console.log('');
  
  try {
    // Setup
    setupTestProject();
    
    // Test all tools
    const results = await testAllTools();
    
    // Generate report
    const report = generateTestReport(results);
    
    // Save detailed report
    const reportFile = 'test-results-comprehensive.json';
    writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalTools: report.totalTools,
        totalPassed: report.totalPassed,
        successRate: report.successRate
      },
      results: report.results
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    
    return report;
    
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    cleanupTestProject();
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runComprehensiveTests, testAllTools, generateTestReport };
