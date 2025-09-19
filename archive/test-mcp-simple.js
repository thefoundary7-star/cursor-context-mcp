#!/usr/bin/env node

/**
 * Simple MCP Server Test Script
 * Quick verification of Node.js MCP server functionality
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🧪 Simple MCP Server Test');
console.log('========================');

// Test 1: Check if server file exists
console.log('\n1. Checking server files...');
const serverPath = path.resolve('./dist/index.js');
if (fs.existsSync(serverPath)) {
  console.log('✅ Server file exists:', serverPath);
} else {
  console.log('❌ Server file not found:', serverPath);
  console.log('   Run "npm run build" first');
  process.exit(1);
}

// Test 2: Start server and test basic functionality
console.log('\n2. Testing server startup and basic functionality...');

const serverProcess = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

let serverReady = false;
let startupOutput = '';

serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  startupOutput += output;
  if (output.includes('ready for MCP connections')) {
    serverReady = true;
    console.log('✅ Server started successfully');
    console.log(`   PID: ${serverProcess.pid}`);
  }
});

serverProcess.on('error', (error) => {
  console.log('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Wait for server to start
setTimeout(async () => {
  if (!serverReady) {
    console.log('❌ Server startup timeout');
    console.log('   Startup output:', startupOutput);
    serverProcess.kill();
    process.exit(1);
  }

  // Test 3: Send initialize message
  console.log('\n3. Testing MCP protocol...');
  
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
    }
  };

  try {
    const response = await sendMessage(initMessage);
    const parsed = JSON.parse(response);
    
    if (parsed.result && parsed.result.protocolVersion) {
      console.log('✅ Initialize request successful');
      console.log(`   Protocol: ${parsed.result.protocolVersion}`);
      console.log(`   Server: ${parsed.result.serverInfo.name} v${parsed.result.serverInfo.version}`);
    } else {
      console.log('❌ Initialize request failed');
      console.log('   Response:', response);
    }
  } catch (error) {
    console.log('❌ Initialize request error:', error.message);
  }

  // Test 4: Test tools list
  console.log('\n4. Testing tools list...');
  
  const toolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  };

  try {
    const response = await sendMessage(toolsMessage);
    const parsed = JSON.parse(response);
    
    if (parsed.result && parsed.result.tools) {
      console.log('✅ Tools list successful');
      console.log(`   Available tools: ${parsed.result.tools.length}`);
      parsed.result.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
    } else {
      console.log('❌ Tools list failed');
    }
  } catch (error) {
    console.log('❌ Tools list error:', error.message);
  }

  // Test 5: Test a tool call
  console.log('\n5. Testing tool call (listFiles)...');
  
  const toolMessage = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "listFiles",
      arguments: { directory: "." }
    }
  };

  try {
    const response = await sendMessage(toolMessage);
    const parsed = JSON.parse(response);
    
    if (parsed.result && parsed.result.content) {
      console.log('✅ Tool call successful');
      const content = parsed.result.content[0].text;
      console.log('   Output preview:', content.substring(0, 100) + '...');
    } else {
      console.log('❌ Tool call failed');
      console.log('   Response:', response);
    }
  } catch (error) {
    console.log('❌ Tool call error:', error.message);
  }

  // Test 6: Test Git status
  console.log('\n6. Testing Git status...');
  
  const gitMessage = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "getGitStatus",
      arguments: {}
    }
  };

  try {
    const response = await sendMessage(gitMessage);
    const parsed = JSON.parse(response);
    
    if (parsed.result && parsed.result.content) {
      console.log('✅ Git status successful');
      const content = parsed.result.content[0].text;
      console.log('   Output preview:', content.substring(0, 100) + '...');
    } else {
      console.log('❌ Git status failed');
    }
  } catch (error) {
    console.log('❌ Git status error:', error.message);
  }

  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Claude Desktop Configuration:');
  console.log('Add this to your claude_desktop_config.json:');
  console.log(JSON.stringify({
    "cursor-context-mcp-nodejs": {
      "command": "cmd",
      "args": ["/c", path.resolve('./run-mcp-server.bat')],
      "cwd": process.cwd(),
      "env": {
        "NODE_ENV": "production",
        "MCP_SERVER_NAME": "cursor-context-mcp-nodejs",
        "MCP_SERVER_VERSION": "1.0.0",
        "PATH": "C:\\Program Files\\nodejs;%PATH%"
      }
    }
  }, null, 2));

  serverProcess.kill();
  process.exit(0);

}, 3000);

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    let response = '';
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, 5000);

    serverProcess.stdout.once('data', (data) => {
      clearTimeout(timeout);
      response = data.toString().trim();
      resolve(response);
    });

    serverProcess.stdin.write(JSON.stringify(message) + '\n');
  });
}