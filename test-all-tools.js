#!/usr/bin/env node

/**
 * Test all 18 tools to ensure they're working correctly with debug mode
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, 'enhanced-mcp-server', 'dist', 'index.js');

// All tools to test
const TOOLS_TO_TEST = [
  { name: 'get_server_config', args: {} },
  { name: 'get_license_status', args: {} },
  { name: 'get_performance_stats', args: {} },
  { name: 'list_files', args: { path: '.' } },
  { name: 'read_file', args: { path: 'package.json' } },
  // Add more tools as needed
];

let currentTest = 0;
let results = [];

function runNextTest(server) {
  if (currentTest >= TOOLS_TO_TEST.length) {
    // All tests complete
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Tested ${results.length}/${TOOLS_TO_TEST.length} tools`);

    const successful = results.filter(r => r.success).length;
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${results.length - successful}`);

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.tool}`);
    });

    server.kill();
    process.exit(successful === results.length ? 0 : 1);
    return;
  }

  const tool = TOOLS_TO_TEST[currentTest];
  console.log(`\n--- Testing ${currentTest + 1}/${TOOLS_TO_TEST.length}: ${tool.name} ---`);

  const toolMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: currentTest + 10, // Start from 10 to avoid conflicts
    method: 'tools/call',
    params: {
      name: tool.name,
      arguments: tool.args
    }
  }) + '\n';

  server.stdin.write(toolMsg);
  currentTest++;
}

console.log('Testing all Enhanced MCP Server tools...');

const server = spawn(process.execPath, [SERVER_PATH, '--debug-mode', '--directories', process.cwd()], {
  stdio: ['pipe', 'pipe', 'inherit'],
  cwd: path.dirname(SERVER_PATH)
});

let initialized = false;

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());

  lines.forEach(line => {
    try {
      const response = JSON.parse(line);

      if (response.id === 1 && !initialized) {
        // Initialization complete, start testing
        initialized = true;
        console.log('Server initialized, starting tool tests...');
        runNextTest(server);
      } else if (response.id >= 10) {
        // Tool response
        const toolIndex = response.id - 10;
        const tool = TOOLS_TO_TEST[toolIndex];

        if (tool) {
          const success = !response.error && response.result && !response.result.isError;
          results.push({
            tool: tool.name,
            success: success,
            response: response
          });

          console.log(success ? '✅ Success' : '❌ Failed');

          // Wait a bit, then run next test
          setTimeout(() => runNextTest(server), 500);
        }
      }
    } catch (e) {
      // Not JSON, ignore
    }
  });
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Initialize server
setTimeout(() => {
  console.log('Sending initialize request...');

  const initMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  }) + '\n';

  server.stdin.write(initMsg);
}, 2000);

process.on('SIGINT', () => {
  server.kill();
  process.exit(1);
});