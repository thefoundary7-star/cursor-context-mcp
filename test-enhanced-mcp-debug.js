#!/usr/bin/env node

/**
 * Test script for debugging Enhanced MCP Server tool execution failures
 * Tests basic tools with debug mode enabled to bypass license restrictions
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const SERVER_PATH = path.join(__dirname, 'enhanced-mcp-server', 'dist', 'index.js');
const TEST_TIMEOUT = 30000; // 30 seconds

// Test cases - starting with simplest tools
const TEST_TOOLS = [
  {
    name: 'get_server_config',
    args: {},
    description: 'Get server configuration (simplest tool)'
  },
  {
    name: 'get_license_status',
    args: {},
    description: 'Get license status'
  },
  {
    name: 'list_files',
    args: { path: '.' },
    description: 'List files in current directory'
  },
  {
    name: 'read_file',
    args: { path: 'package.json' },
    description: 'Read package.json file'
  }
];

function createMCPMessage(id, method, params) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: id,
    method: method,
    params: params
  }) + '\n';
}

function testTool(toolName, args, description) {
  return new Promise((resolve, reject) => {
    console.error(`\n=== Testing: ${toolName} - ${description} ===`);

    // Start server with debug mode
    const server = spawn(process.execPath, [SERVER_PATH, '--debug-mode', '--directories', process.cwd()], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(SERVER_PATH)
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Timeout handler
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.kill();
        reject(new Error(`Test timeout after ${TEST_TIMEOUT}ms`));
      }
    }, TEST_TIMEOUT);

    server.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[STDOUT]', data.toString().trim());
    });

    server.stderr.on('data', (data) => {
      const message = data.toString().trim();
      stderr += message + '\n';
      console.error('[STDERR]', message);

      // Look for server startup confirmation
      if (message.includes('Enhanced MCP Server') && message.includes('started successfully')) {
        console.error('Server started, sending tool request...');

        // Send initialize request first
        const initMsg = createMCPMessage(1, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        });

        console.error('Sending initialize:', initMsg.trim());
        server.stdin.write(initMsg);

        // Send tool call
        setTimeout(() => {
          const toolMsg = createMCPMessage(2, 'tools/call', {
            name: toolName,
            arguments: args
          });

          console.error('Sending tool call:', toolMsg.trim());
          server.stdin.write(toolMsg);
        }, 1000);
      }

      // Look for tool responses
      if (message.includes('"jsonrpc":"2.0"') && message.includes('"id":2')) {
        console.error('Received tool response!');
        try {
          const response = JSON.parse(message);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            server.kill();
            resolve({
              success: !response.error,
              response: response,
              stdout: stdout,
              stderr: stderr
            });
          }
        } catch (e) {
          console.error('Failed to parse response:', e);
        }
      }
    });

    server.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve({
            success: true,
            stdout: stdout,
            stderr: stderr
          });
        } else {
          reject(new Error(`Server exited with code ${code}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
        }
      }
    });

    server.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

async function runTests() {
  console.error('Starting Enhanced MCP Server Debug Tests...');
  console.error('Server path:', SERVER_PATH);

  const results = [];

  for (const test of TEST_TOOLS) {
    try {
      const result = await testTool(test.name, test.args, test.description);
      results.push({
        tool: test.name,
        success: result.success,
        response: result.response
      });

      console.error(`✅ ${test.name}: SUCCESS`);

    } catch (error) {
      results.push({
        tool: test.name,
        success: false,
        error: error.message
      });

      console.error(`❌ ${test.name}: FAILED - ${error.message}`);
    }
  }

  // Summary
  console.error('\n=== TEST SUMMARY ===');
  const successful = results.filter(r => r.success).length;
  const total = results.length;

  console.error(`Successful: ${successful}/${total}`);

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.error(`${status} ${result.tool}`);
    if (!result.success) {
      console.error(`   Error: ${result.error}`);
    }
  }

  if (successful === total) {
    console.error('\n🎉 All tests passed! Tool execution is working.');
  } else {
    console.error('\n⚠️  Some tests failed. Check the error details above.');
  }

  process.exit(successful === total ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
  console.error('\nTest interrupted by user');
  process.exit(1);
});

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});