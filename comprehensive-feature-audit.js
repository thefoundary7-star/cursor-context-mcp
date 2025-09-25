#!/usr/bin/env node

/**
 * Comprehensive FileBridge MCP Server Feature Audit
 *
 * This script discovers and tests ALL 26+ enhanced features in the FileBridge MCP server
 * by bypassing license restrictions and systematically validating each tool.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

// Feature discovery from source code analysis
const DISCOVERED_TOOLS = {
  // Basic File Operations (FREE tier)
  FILE_OPERATIONS: [
    'list_files',
    'read_file',
    'write_file',
    'search_files',
    'get_file_diff',
    'get_file_stats'
  ],

  // Code Navigation & Analysis (PRO tier)
  CODE_ANALYSIS: [
    'search_symbols',
    'find_references',
    'index_directory',
    'get_index_stats',
    'clear_index',
    'get_symbol_info'
  ],

  // Test Framework Integration (PRO tier)
  TEST_EXECUTION: [
    'run_tests',
    'detect_test_framework',
    'list_test_files',
    'get_test_status',
    'stop_tests'
  ],

  // Server Management & Configuration
  SERVER_MANAGEMENT: [
    'get_server_config',
    'update_config',
    'get_performance_stats',
    'clear_caches',
    'get_license_status',
    'activate_license'
  ],

  // Advanced Features (Based on license manager feature lists)
  ADVANCED_PRO: [
    'analyze_dependencies',
    'security_scan',
    'git_diff',
    'git_log',
    'git_blame',
    'analyze_performance',
    'monitor_files',
    'code_quality_check',
    'documentation_analysis',
    'refactor_suggestions',
    'bulk_operations',
    'advanced_search',
    'project_analytics',
    'code_metrics'
  ],

  // Enterprise Features
  ENTERPRISE: [
    'team_collaboration',
    'audit_logging',
    'priority_support',
    'custom_integrations'
  ]
};

class ComprehensiveFeatureAudit {
  constructor() {
    this.results = new Map();
    this.benchmarks = new Map();
    this.serverProcess = null;
    this.testDirectory = path.join(process.cwd(), 'test-workspace');
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🔍 Comprehensive FileBridge MCP Server Feature Audit');
    console.log('=' .repeat(60));

    // Create test workspace
    await this.setupTestEnvironment();

    // Start server in debug mode (bypasses all license restrictions)
    await this.startServerInDebugMode();

    // Wait for server to fully initialize
    await this.waitForServer();
  }

  async setupTestEnvironment() {
    console.log('📁 Setting up test environment...');

    try {
      await fs.mkdir(this.testDirectory, { recursive: true });

      // Create various test files for comprehensive testing
      const testFiles = {
        'package.json': JSON.stringify({
          name: 'test-project',
          scripts: { test: 'jest' },
          dependencies: { jest: '^29.0.0' }
        }, null, 2),

        'index.js': `
          function hello(name) {
            return \`Hello, \${name}!\`;
          }

          class TestClass {
            constructor(value) {
              this.value = value;
            }

            getValue() {
              return this.value;
            }
          }

          module.exports = { hello, TestClass };
        `,

        'index.test.js': `
          const { hello, TestClass } = require('./index');

          test('hello function', () => {
            expect(hello('World')).toBe('Hello, World!');
          });

          test('TestClass', () => {
            const instance = new TestClass(42);
            expect(instance.getValue()).toBe(42);
          });
        `,

        'main.py': `
          def calculate_sum(a, b):
              """Calculate the sum of two numbers"""
              return a + b

          class Calculator:
              def __init__(self):
                  self.history = []

              def add(self, a, b):
                  result = a + b
                  self.history.append(('add', a, b, result))
                  return result
        `,

        'README.md': `
          # Test Project

          This is a test project for comprehensive feature testing.

          ## Features
          - JavaScript functions
          - Python classes
          - Jest tests
        `
      };

      for (const [filename, content] of Object.entries(testFiles)) {
        await fs.writeFile(path.join(this.testDirectory, filename), content);
      }

      console.log('✅ Test environment created');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      throw error;
    }
  }

  async startServerInDebugMode() {
    console.log('🚀 Starting MCP server in debug mode (license bypass)...');

    return new Promise((resolve, reject) => {
      const serverPath = path.join(process.cwd(), 'enhanced-mcp-server', 'dist', 'index.js');

      this.serverProcess = spawn(process.execPath, [
        serverPath,
        '--debug-mode',  // This bypasses ALL license restrictions
        '--directories', this.testDirectory,
        '--log-level', 'debug'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_DEBUG_MODE: 'true',
          NODE_ENV: 'test'
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.log('SERVER:', message.trim());

        if (message.includes('Enhanced MCP Server') && message.includes('started successfully')) {
          console.log('✅ Server started in debug mode');
          resolve();
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('❌ Server startup error:', error);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          reject(new Error('Server startup timeout'));
        }
      }, 10000);
    });
  }

  async waitForServer() {
    console.log('⏳ Waiting for server initialization...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async testAllFeatures() {
    console.log('\n🧪 Testing All Features');
    console.log('=' .repeat(40));

    // Get all tools from flattened discovery
    const allTools = Object.values(DISCOVERED_TOOLS).flat();
    const totalTools = allTools.length;

    console.log(`📋 Discovered ${totalTools} potential tools to test`);
    console.log(`🔓 Debug mode enabled - all license restrictions bypassed\n`);

    // Test each category
    for (const [category, tools] of Object.entries(DISCOVERED_TOOLS)) {
      console.log(`\n📂 Testing ${category} (${tools.length} tools)`);
      console.log('-'.repeat(50));

      for (const tool of tools) {
        await this.testSingleTool(tool, category);
      }
    }
  }

  async testSingleTool(toolName, category) {
    const startTime = performance.now();

    try {
      console.log(`🔧 Testing: ${toolName}`);

      // Get tool definition first
      const toolDefinition = await this.getToolDefinition(toolName);

      if (!toolDefinition) {
        this.results.set(toolName, {
          category,
          status: 'NOT_IMPLEMENTED',
          error: 'Tool not found in server tool list',
          executionTime: performance.now() - startTime
        });
        console.log(`   ❌ NOT IMPLEMENTED`);
        return;
      }

      // Create appropriate test arguments based on tool schema
      const testArgs = this.generateTestArguments(toolName, toolDefinition.inputSchema);

      // Execute the tool
      const result = await this.invokeTool(toolName, testArgs);

      const executionTime = performance.now() - startTime;
      this.benchmarks.set(toolName, executionTime);

      if (result.success) {
        this.results.set(toolName, {
          category,
          status: 'WORKING',
          definition: toolDefinition,
          testArgs,
          result: result.data,
          executionTime,
          metadata: result.metadata
        });
        console.log(`   ✅ WORKING (${executionTime.toFixed(2)}ms)`);

        // Log interesting details
        if (result.metadata) {
          console.log(`      📊 ${JSON.stringify(result.metadata)}`);
        }
      } else {
        this.results.set(toolName, {
          category,
          status: 'ERROR',
          definition: toolDefinition,
          testArgs,
          error: result.error,
          executionTime
        });
        console.log(`   ⚠️  ERROR: ${result.error}`);
      }

    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.results.set(toolName, {
        category,
        status: 'EXCEPTION',
        error: error.message,
        executionTime
      });
      console.log(`   💥 EXCEPTION: ${error.message}`);
    }
  }

  generateTestArguments(toolName, inputSchema) {
    // Generate appropriate test arguments based on the tool and its schema
    const testArgs = {};

    if (!inputSchema || !inputSchema.properties) {
      return {};
    }

    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
      switch (toolName) {
        case 'list_files':
          testArgs.directory = this.testDirectory;
          testArgs.recursive = true;
          break;

        case 'read_file':
          testArgs.filePath = path.join(this.testDirectory, 'index.js');
          break;

        case 'write_file':
          testArgs.filePath = path.join(this.testDirectory, 'test-write.txt');
          testArgs.content = 'Test content for write operation';
          break;

        case 'search_files':
          testArgs.directory = this.testDirectory;
          testArgs.pattern = '*.js';
          break;

        case 'get_file_diff':
          testArgs.filePath1 = path.join(this.testDirectory, 'index.js');
          testArgs.filePath2 = path.join(this.testDirectory, 'main.py');
          break;

        case 'search_symbols':
          testArgs.query = 'hello';
          testArgs.directory = this.testDirectory;
          testArgs.autoIndex = true;
          break;

        case 'find_references':
          testArgs.symbolName = 'TestClass';
          testArgs.directory = this.testDirectory;
          break;

        case 'index_directory':
          testArgs.directory = this.testDirectory;
          testArgs.recursive = true;
          break;

        case 'run_tests':
          testArgs.directory = this.testDirectory;
          testArgs.framework = 'auto';
          break;

        case 'detect_test_framework':
          testArgs.directory = this.testDirectory;
          break;

        case 'clear_caches':
          testArgs.confirm = true;
          break;

        case 'clear_index':
          testArgs.confirm = true;
          break;

        case 'activate_license':
          testArgs.licenseKey = 'test-license-key';
          break;

        default:
          // Try to generate sensible defaults based on property types
          if (propDef.type === 'string' && propDef.default === undefined) {
            if (propName.includes('directory') || propName.includes('Directory')) {
              testArgs[propName] = this.testDirectory;
            } else if (propName.includes('file') || propName.includes('File') || propName.includes('path') || propName.includes('Path')) {
              testArgs[propName] = path.join(this.testDirectory, 'index.js');
            } else {
              testArgs[propName] = 'test-value';
            }
          } else if (propDef.type === 'boolean') {
            testArgs[propName] = propDef.default !== undefined ? propDef.default : true;
          } else if (propDef.type === 'number') {
            testArgs[propName] = propDef.default !== undefined ? propDef.default : 100;
          }
          break;
      }
    }

    return testArgs;
  }

  async getToolDefinition(toolName) {
    try {
      const result = await this.invokeMCPMethod('list_tools', {});
      if (result.tools) {
        return result.tools.find(tool => tool.name === toolName);
      }
      return null;
    } catch (error) {
      console.error(`Failed to get tool definition for ${toolName}:`, error);
      return null;
    }
  }

  async invokeTool(toolName, args) {
    return this.invokeMCPMethod('call_tool', {
      name: toolName,
      arguments: args
    });
  }

  async invokeMCPMethod(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess) {
        reject(new Error('Server not running'));
        return;
      }

      const request = {
        jsonrpc: '2.0',
        id: Math.random().toString(36).substring(7),
        method: method === 'list_tools' ? 'tools/list' : 'tools/call',
        params
      };

      const requestStr = JSON.stringify(request) + '\n';

      let responseData = '';
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const onData = (data) => {
        responseData += data.toString();

        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              clearTimeout(timeout);
              this.serverProcess.stdout.off('data', onData);

              if (response.error) {
                resolve({
                  success: false,
                  error: response.error.message || JSON.stringify(response.error)
                });
              } else if (response.result) {
                // Handle both direct results and MCP tool call format
                if (response.result.content && Array.isArray(response.result.content)) {
                  try {
                    const content = JSON.parse(response.result.content[0].text);
                    resolve({
                      success: content.success !== false,
                      data: content.data || content,
                      error: content.error,
                      metadata: content.metadata
                    });
                  } catch (e) {
                    resolve({
                      success: true,
                      data: response.result.content[0].text
                    });
                  }
                } else {
                  resolve({
                    success: true,
                    data: response.result
                  });
                }
              } else {
                resolve({
                  success: false,
                  error: 'No result in response'
                });
              }
              return;
            }
          }
        } catch (e) {
          // Continue accumulating data
        }
      };

      this.serverProcess.stdout.on('data', onData);
      this.serverProcess.stdin.write(requestStr);
    });
  }

  generateComprehensiveReport() {
    console.log('\n📊 Comprehensive Audit Report');
    console.log('=' .repeat(60));

    const summary = this.generateSummaryStatistics();
    this.printSummary(summary);

    this.printDetailedResults();
    this.printPerformanceBenchmarks();
    this.printRecommendations();

    // Save report to file
    this.saveReportToFile(summary);
  }

  generateSummaryStatistics() {
    const total = this.results.size;
    const working = Array.from(this.results.values()).filter(r => r.status === 'WORKING').length;
    const errors = Array.from(this.results.values()).filter(r => r.status === 'ERROR').length;
    const notImplemented = Array.from(this.results.values()).filter(r => r.status === 'NOT_IMPLEMENTED').length;
    const exceptions = Array.from(this.results.values()).filter(r => r.status === 'EXCEPTION').length;

    const byCategory = {};
    for (const [toolName, result] of this.results.entries()) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { total: 0, working: 0, errors: 0, notImplemented: 0 };
      }
      byCategory[result.category].total++;
      if (result.status === 'WORKING') byCategory[result.category].working++;
      else if (result.status === 'ERROR') byCategory[result.category].errors++;
      else if (result.status === 'NOT_IMPLEMENTED') byCategory[result.category].notImplemented++;
    }

    const totalExecutionTime = Date.now() - this.startTime;
    const avgBenchmark = Array.from(this.benchmarks.values()).reduce((a, b) => a + b, 0) / this.benchmarks.size || 0;

    return {
      total,
      working,
      errors,
      notImplemented,
      exceptions,
      byCategory,
      totalExecutionTime,
      avgBenchmark,
      successRate: ((working / total) * 100).toFixed(1)
    };
  }

  printSummary(summary) {
    console.log(`\n📈 Summary Statistics:`);
    console.log(`   Total Tools Tested: ${summary.total}`);
    console.log(`   ✅ Working: ${summary.working} (${((summary.working/summary.total)*100).toFixed(1)}%)`);
    console.log(`   ❌ Errors: ${summary.errors} (${((summary.errors/summary.total)*100).toFixed(1)}%)`);
    console.log(`   🚫 Not Implemented: ${summary.notImplemented} (${((summary.notImplemented/summary.total)*100).toFixed(1)}%)`);
    console.log(`   💥 Exceptions: ${summary.exceptions} (${((summary.exceptions/summary.total)*100).toFixed(1)}%)`);
    console.log(`   🎯 Success Rate: ${summary.successRate}%`);
    console.log(`   ⏱️  Total Execution Time: ${(summary.totalExecutionTime/1000).toFixed(2)}s`);
    console.log(`   📊 Average Tool Response Time: ${summary.avgBenchmark.toFixed(2)}ms`);

    console.log(`\n📊 By Category:`);
    for (const [category, stats] of Object.entries(summary.byCategory)) {
      const rate = ((stats.working / stats.total) * 100).toFixed(1);
      console.log(`   ${category}: ${stats.working}/${stats.total} (${rate}%) working`);
    }
  }

  printDetailedResults() {
    console.log(`\n📋 Detailed Results:`);
    console.log('-'.repeat(60));

    for (const [category, tools] of Object.entries(DISCOVERED_TOOLS)) {
      console.log(`\n${category}:`);

      for (const toolName of tools) {
        const result = this.results.get(toolName);
        if (!result) continue;

        const statusIcon = {
          'WORKING': '✅',
          'ERROR': '❌',
          'NOT_IMPLEMENTED': '🚫',
          'EXCEPTION': '💥'
        }[result.status] || '❓';

        console.log(`   ${statusIcon} ${toolName} (${result.executionTime?.toFixed(2) || 0}ms)`);

        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }

        if (result.metadata) {
          console.log(`      Metadata: ${JSON.stringify(result.metadata)}`);
        }
      }
    }
  }

  printPerformanceBenchmarks() {
    console.log(`\n⚡ Performance Benchmarks (Top 10 Fastest):`);
    console.log('-'.repeat(40));

    const sortedBenchmarks = Array.from(this.benchmarks.entries())
      .sort(([,a], [,b]) => a - b)
      .slice(0, 10);

    for (const [toolName, time] of sortedBenchmarks) {
      console.log(`   ${toolName}: ${time.toFixed(2)}ms`);
    }
  }

  printRecommendations() {
    console.log(`\n💡 Recommendations:`);
    console.log('-'.repeat(30));

    const notImplemented = Array.from(this.results.entries())
      .filter(([, result]) => result.status === 'NOT_IMPLEMENTED')
      .map(([name]) => name);

    const errors = Array.from(this.results.entries())
      .filter(([, result]) => result.status === 'ERROR')
      .map(([name]) => name);

    if (notImplemented.length > 0) {
      console.log(`\n🚫 Tools claimed but not implemented (${notImplemented.length}):`);
      notImplemented.forEach(tool => console.log(`   - ${tool}`));
    }

    if (errors.length > 0) {
      console.log(`\n❌ Tools with errors requiring fixes (${errors.length}):`);
      errors.forEach(tool => {
        const result = this.results.get(tool);
        console.log(`   - ${tool}: ${result.error}`);
      });
    }

    const workingCount = Array.from(this.results.values()).filter(r => r.status === 'WORKING').length;
    console.log(`\n✅ Successfully validated ${workingCount} working tools`);

    if (workingCount >= 26) {
      console.log(`   🎉 PASSED: Server delivers on 26+ enhanced features promise!`);
    } else {
      console.log(`   ⚠️  ATTENTION: Only ${workingCount} tools are working, less than advertised 26+`);
    }
  }

  async saveReportToFile(summary) {
    const reportPath = path.join(process.cwd(), 'comprehensive-audit-report.json');

    const report = {
      timestamp: new Date().toISOString(),
      summary,
      results: Object.fromEntries(this.results),
      benchmarks: Object.fromEntries(this.benchmarks),
      discoveredTools: DISCOVERED_TOOLS,
      testEnvironment: {
        nodeVersion: process.version,
        platform: process.platform,
        testDirectory: this.testDirectory
      }
    };

    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Full report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      console.log('   Server process terminated');
    }

    try {
      await fs.rm(this.testDirectory, { recursive: true, force: true });
      console.log('   Test environment cleaned up');
    } catch (error) {
      console.warn('   Failed to cleanup test environment:', error);
    }
  }
}

// Main execution
async function main() {
  const audit = new ComprehensiveFeatureAudit();

  try {
    await audit.initialize();
    await audit.testAllFeatures();
    audit.generateComprehensiveReport();
  } catch (error) {
    console.error('\n💥 Audit failed:', error);
    process.exit(1);
  } finally {
    await audit.cleanup();
  }

  console.log('\n🎯 Comprehensive audit completed!');
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⏹️  Audit interrupted');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled rejection:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ComprehensiveFeatureAudit };