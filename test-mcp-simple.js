#!/usr/bin/env node

// Minimal MCP server for testing configuration without dependencies
console.error('Simple test MCP server starting... PID:', process.pid);

let messageId = 0;

// Simple JSON-RPC message handler
function handleMessage(message) {
  console.error('Received message:', JSON.stringify(message));

  if (message.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'test-mcp-simple',
          version: '1.0.0',
        },
      },
    };
  } else if (message.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'test_tool',
            description: 'A simple test tool',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id: message.id,
    error: {
      code: -32601,
      message: 'Method not found',
    },
  };
}

// Handle stdin/stdout communication
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  try {
    const lines = data.trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        const message = JSON.parse(line);
        const response = handleMessage(message);
        console.log(JSON.stringify(response));
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

console.error('Test MCP server ready for connections');