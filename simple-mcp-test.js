#!/usr/bin/env node

/**
 * Simple test to verify MCP server tools are working
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, 'enhanced-mcp-server', 'dist', 'index.js');

console.log('Testing Enhanced MCP Server with debug mode...');

const server = spawn(process.execPath, [SERVER_PATH, '--debug-mode', '--directories', process.cwd()], {
  stdio: ['pipe', 'pipe', 'inherit'],
  cwd: path.dirname(SERVER_PATH)
});

let responses = [];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());

  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      console.log('Response received:', JSON.stringify(response, null, 2));
    } catch (e) {
      // Not JSON, ignore
    }
  });
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Wait for server to start, then send test requests
setTimeout(() => {
  console.log('Sending initialize request...');

  // Initialize
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

  // Test simple tool
  setTimeout(() => {
    console.log('Sending get_server_config request...');

    const toolMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_server_config',
        arguments: {}
      }
    }) + '\n';

    server.stdin.write(toolMsg);

    // Check results after a delay
    setTimeout(() => {
      console.log('\n=== TEST RESULTS ===');
      console.log(`Received ${responses.length} responses`);

      const toolResponse = responses.find(r => r.id === 2);
      if (toolResponse) {
        console.log('✅ Tool execution successful!');
        console.log('Tool responded with:', toolResponse.result?.content?.[0]?.text ? 'Valid response' : 'Unexpected format');

        // Test if response contains expected data
        if (toolResponse.result?.content?.[0]?.text) {
          try {
            const data = JSON.parse(toolResponse.result.content[0].text);
            if (data.success && data.data) {
              console.log('✅ Response contains valid data structure');
              console.log('✅ All basic functionality working correctly!');
            } else {
              console.log('❌ Response missing expected data structure');
            }
          } catch (e) {
            console.log('❌ Response not valid JSON');
          }
        }
      } else {
        console.log('❌ No tool response received');
      }

      server.kill();
      process.exit(toolResponse ? 0 : 1);
    }, 3000);

  }, 2000);

}, 3000);

process.on('SIGINT', () => {
  server.kill();
  process.exit(1);
});