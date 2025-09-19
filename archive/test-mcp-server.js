#!/usr/bin/env node

/**
 * Comprehensive MCP Server Test Script
 * Tests Node.js MCP server functionality and compares with Python version
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

class MCPServerTester {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
    this.serverPath = path.resolve('./dist/index.js');
    this.pythonServerPath = path.resolve('./official_mcp_server.py');
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'ERROR': '❌',
      'WARNING': '⚠️',
      'DEBUG': '🔍'
    }[type] || 'ℹ️';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startServer() {
    this.log('Starting Node.js MCP server...', 'INFO');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let startupOutput = '';
      let errorOutput = '';

      this.serverProcess.stdout.on('data', (data) => {
        startupOutput += data.toString();
      });

      this.serverProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      this.serverProcess.on('error', (error) => {
        this.log(`Failed to start server: ${error.message}`, 'ERROR');
        reject(error);
      });

      // Wait for server to start
      setTimeout(() => {
        if (errorOutput.includes('ready for MCP connections')) {
          this.log('Server started successfully!', 'SUCCESS');
          this.log(`Server PID: ${this.serverProcess.pid}`, 'DEBUG');
          resolve();
        } else {
          this.log('Server startup timeout or failed', 'ERROR');
          this.log(`Startup output: ${startupOutput}`, 'DEBUG');
          this.log(`Error output: ${errorOutput}`, 'DEBUG');
          reject(new Error('Server startup failed'));
        }
      }, 2000);
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      this.log('Stopping server...', 'INFO');
      this.serverProcess.kill();
      this.serverProcess = null;
      await this.delay(1000);
    }
  }

  async sendMCPMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess) {
        reject(new Error('Server not running'));
        return;
      }

      let response = '';
      let error = '';

      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      this.serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        response = data.toString().trim();
        resolve(response);
      });

      this.serverProcess.stderr.once('data', (data) => {
        error += data.toString();
      });

      this.serverProcess.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  async testServerStartup() {
    this.log('=== Testing Server Startup ===', 'INFO');
    
    try {
      // Check if server file exists
      if (!fs.existsSync(this.serverPath)) {
        throw new Error(`Server file not found: ${this.serverPath}`);
      }
      this.log('Server file exists', 'SUCCESS');

      // Check if dist directory exists
      if (!fs.existsSync('./dist')) {
        throw new Error('dist directory not found. Run "npm run build" first.');
      }
      this.log('dist directory exists', 'SUCCESS');

      await this.startServer();
      this.testResults.push({ test: 'Server Startup', status: 'PASS' });
      
    } catch (error) {
      this.log(`Server startup failed: ${error.message}`, 'ERROR');
      this.testResults.push({ test: 'Server Startup', status: 'FAIL', error: error.message });
      throw error;
    }
  }

  async testMCPProtocol() {
    this.log('=== Testing MCP Protocol ===', 'INFO');
    
    const tests = [
      {
        name: 'Initialize Request',
        message: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0"
            }
          }
        },
        expectedFields: ['jsonrpc', 'id', 'result', 'protocolVersion', 'capabilities', 'serverInfo']
      },
      {
        name: 'Tools List Request',
        message: {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list"
        },
        expectedFields: ['jsonrpc', 'id', 'result', 'tools']
      },
      {
        name: 'Invalid Method Request',
        message: {
          jsonrpc: "2.0",
          id: 3,
          method: "invalid/method"
        },
        expectedFields: ['jsonrpc', 'id', 'error']
      }
    ];

    for (const test of tests) {
      try {
        this.log(`Testing: ${test.name}`, 'DEBUG');
        const response = await this.sendMCPMessage(test.message);
        
        // Parse response
        const parsedResponse = JSON.parse(response);
        
        // Check expected fields
        const missingFields = test.expectedFields.filter(field => {
          if (field.includes('.')) {
            const parts = field.split('.');
            let obj = parsedResponse;
            for (const part of parts) {
              if (!obj || typeof obj !== 'object' || !(part in obj)) {
                return true;
              }
              obj = obj[part];
            }
            return false;
          }
          return !(field in parsedResponse);
        });

        if (missingFields.length === 0) {
          this.log(`${test.name}: PASS`, 'SUCCESS');
          this.testResults.push({ test: test.name, status: 'PASS' });
        } else {
          this.log(`${test.name}: FAIL - Missing fields: ${missingFields.join(', ')}`, 'ERROR');
          this.testResults.push({ test: test.name, status: 'FAIL', error: `Missing fields: ${missingFields.join(', ')}` });
        }

        this.log(`Response: ${response}`, 'DEBUG');
        
      } catch (error) {
        this.log(`${test.name}: FAIL - ${error.message}`, 'ERROR');
        this.testResults.push({ test: test.name, status: 'FAIL', error: error.message });
      }
    }
  }

  async testTools() {
    this.log('=== Testing MCP Tools ===', 'INFO');
    
    const tools = [
      {
        name: 'listFiles',
        message: {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: {
            name: "listFiles",
            arguments: { directory: "." }
          }
        }
      },
      {
        name: 'readFile',
        message: {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "readFile",
            arguments: { filePath: "package.json" }
          }
        }
      },
      {
        name: 'getGitStatus',
        message: {
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: {
            name: "getGitStatus",
            arguments: {}
          }
        }
      },
      {
        name: 'getProjectRoot',
        message: {
          jsonrpc: "2.0",
          id: 13,
          method: "tools/call",
          params: {
            name: "getProjectRoot",
            arguments: {}
          }
        }
      },
      {
        name: 'searchFiles',
        message: {
          jsonrpc: "2.0",
          id: 14,
          method: "tools/call",
          params: {
            name: "searchFiles",
            arguments: { pattern: "*.ts" }
          }
        }
      }
    ];

    for (const tool of tools) {
      try {
        this.log(`Testing tool: ${tool.name}`, 'DEBUG');
        const response = await this.sendMCPMessage(tool.message);
        
        const parsedResponse = JSON.parse(response);
        
        if (parsedResponse.result && parsedResponse.result.content) {
          this.log(`${tool.name}: PASS`, 'SUCCESS');
          this.testResults.push({ test: `Tool: ${tool.name}`, status: 'PASS' });
          
          // Log tool output for debugging
          const content = parsedResponse.result.content[0].text;
          this.log(`Output preview: ${content.substring(0, 100)}...`, 'DEBUG');
        } else {
          this.log(`${tool.name}: FAIL - Invalid response format`, 'ERROR');
          this.testResults.push({ test: `Tool: ${tool.name}`, status: 'FAIL', error: 'Invalid response format' });
        }
        
      } catch (error) {
        this.log(`${tool.name}: FAIL - ${error.message}`, 'ERROR');
        this.testResults.push({ test: `Tool: ${tool.name}`, status: 'FAIL', error: error.message });
      }
    }
  }

  async compareWithPython() {
    this.log('=== Comparing with Python Version ===', 'INFO');
    
    if (!fs.existsSync(this.pythonServerPath)) {
      this.log('Python server not found, skipping comparison', 'WARNING');
      return;
    }

    try {
      // Test Python server startup
      this.log('Testing Python server startup...', 'DEBUG');
      const pythonProcess = spawn('python', [this.pythonServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      await this.delay(2000);
      
      if (pythonProcess.killed || pythonProcess.exitCode !== null) {
        this.log('Python server failed to start', 'WARNING');
        pythonProcess.kill();
        return;
      }

      // Test Python tools
      const pythonTestMessage = {
        jsonrpc: "2.0",
        id: 100,
        method: "tools/call",
        params: {
          name: "list_files",
          arguments: { directory: "." }
        }
      };

      let pythonResponse = '';
      pythonProcess.stdout.once('data', (data) => {
        pythonResponse = data.toString().trim();
      });

      pythonProcess.stdin.write(JSON.stringify(pythonTestMessage) + '\n');
      
      await this.delay(1000);
      pythonProcess.kill();

      if (pythonResponse) {
        this.log('Python server response received', 'SUCCESS');
        this.log(`Python output: ${pythonResponse.substring(0, 200)}...`, 'DEBUG');
        this.testResults.push({ test: 'Python Comparison', status: 'PASS' });
      } else {
        this.log('No response from Python server', 'WARNING');
        this.testResults.push({ test: 'Python Comparison', status: 'WARN', error: 'No response received' });
      }

    } catch (error) {
      this.log(`Python comparison failed: ${error.message}`, 'WARNING');
      this.testResults.push({ test: 'Python Comparison', status: 'WARN', error: error.message });
    }
  }

  generateDebugReport() {
    this.log('=== Debug Report ===', 'INFO');
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      },
      files: {
        serverExists: fs.existsSync(this.serverPath),
        distExists: fs.existsSync('./dist'),
        packageJsonExists: fs.existsSync('./package.json'),
        pythonServerExists: fs.existsSync(this.pythonServerPath)
      },
      testResults: this.testResults
    };

    const reportPath = './mcp-server-debug-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`Debug report saved to: ${reportPath}`, 'SUCCESS');
    
    // Print summary
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const warnings = this.testResults.filter(r => r.status === 'WARN').length;
    
    this.log(`\n=== Test Summary ===`, 'INFO');
    this.log(`✅ Passed: ${passed}`, 'SUCCESS');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'ERROR' : 'SUCCESS');
    this.log(`⚠️  Warnings: ${warnings}`, warnings > 0 ? 'WARNING' : 'SUCCESS');
    
    if (failed > 0) {
      this.log('\n=== Failed Tests ===', 'ERROR');
      this.testResults.filter(r => r.status === 'FAIL').forEach(test => {
        this.log(`- ${test.test}: ${test.error}`, 'ERROR');
      });
    }
  }

  async runAllTests() {
    this.log('🚀 Starting MCP Server Test Suite', 'INFO');
    this.log(`Testing server: ${this.serverPath}`, 'DEBUG');
    
    try {
      await this.testServerStartup();
      await this.testMCPProtocol();
      await this.testTools();
      await this.compareWithPython();
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'ERROR');
    } finally {
      await this.stopServer();
      this.generateDebugReport();
    }
  }
}

// Run the tests
const tester = new MCPServerTester();
tester.runAllTests().catch(console.error);
