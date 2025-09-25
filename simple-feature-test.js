#!/usr/bin/env node

/**
 * Simple Feature Test for FileBridge MCP Server
 * Tests the server in debug mode to discover actual implemented features
 */

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

// All potentially available tools based on source code analysis
const EXPECTED_TOOLS = [
  // File Operations
  'list_files', 'read_file', 'write_file', 'search_files', 'get_file_diff', 'get_file_stats',

  // Code Analysis
  'search_symbols', 'find_references', 'index_directory', 'get_index_stats', 'clear_index', 'get_symbol_info',

  // Test Tools (from test-tools.ts)
  'run_tests', 'detect_test_framework', 'list_test_files', 'get_test_status', 'stop_tests',

  // Server Management
  'get_server_config', 'update_config', 'get_performance_stats', 'clear_caches', 'get_license_status', 'activate_license',

  // Advanced features mentioned in license manager
  'analyze_dependencies', 'security_scan', 'git_diff', 'git_log', 'git_blame',
  'analyze_performance', 'monitor_files', 'code_quality_check', 'documentation_analysis',
  'refactor_suggestions', 'bulk_operations', 'advanced_search', 'project_analytics', 'code_metrics',

  // Enterprise features
  'team_collaboration', 'audit_logging', 'priority_support', 'custom_integrations'
];

async function testServer() {
  console.log('🔍 FileBridge MCP Server Feature Discovery Test');
  console.log('=============================================');
  console.log(`Expected tools to test: ${EXPECTED_TOOLS.length}`);

  // Create test directory
  const testDir = path.join(__dirname, 'test-workspace');
  await fs.mkdir(testDir, { recursive: true });

  // Create test file
  await fs.writeFile(path.join(testDir, 'test.js'), `
    function hello(name) {
      return \`Hello, \${name}!\`;
    }
    module.exports = { hello };
  `);

  console.log('\n🚀 Starting server in debug mode...');

  const serverProcess = spawn(process.execPath, [
    path.join(__dirname, 'enhanced-mcp-server', 'dist', 'index.js'),
    '--debug-mode',
    '--directories', testDir
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_DEBUG_MODE: 'true'
    }
  });

  let serverReady = false;

  serverProcess.stderr.on('data', (data) => {
    const message = data.toString();
    console.log('SERVER LOG:', message.trim());

    if (message.includes('Enhanced MCP Server') && message.includes('started successfully')) {
      serverReady = true;
      console.log('✅ Server is ready!');
    }
  });

  // Wait for server to start
  await new Promise(resolve => {
    const checkReady = () => {
      if (serverReady) {
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    setTimeout(checkReady, 1000);
  });

  console.log('\n📋 Discovering available tools...');

  // Get list of tools
  const toolsResult = await sendMCPRequest(serverProcess, 'tools/list', {});

  if (!toolsResult.tools) {
    console.log('❌ Failed to get tools list');
    serverProcess.kill();
    return;
  }

  const availableTools = toolsResult.tools.map(t => t.name);
  console.log(`\n✅ Server reports ${availableTools.length} available tools:`);

  // Categorize tools
  const categorized = {
    'File Operations': [],
    'Code Analysis': [],
    'Test Tools': [],
    'Server Management': [],
    'Advanced Features': [],
    'Unknown/New': []
  };

  availableTools.forEach(tool => {
    if (['list_files', 'read_file', 'write_file', 'search_files', 'get_file_diff', 'get_file_stats'].includes(tool)) {
      categorized['File Operations'].push(tool);
    } else if (['search_symbols', 'find_references', 'index_directory', 'get_index_stats', 'clear_index', 'get_symbol_info'].includes(tool)) {
      categorized['Code Analysis'].push(tool);
    } else if (['run_tests', 'detect_test_framework', 'list_test_files', 'get_test_status', 'stop_tests'].includes(tool)) {
      categorized['Test Tools'].push(tool);
    } else if (['get_server_config', 'update_config', 'get_performance_stats', 'clear_caches', 'get_license_status', 'activate_license'].includes(tool)) {
      categorized['Server Management'].push(tool);
    } else if (EXPECTED_TOOLS.includes(tool)) {
      categorized['Advanced Features'].push(tool);
    } else {
      categorized['Unknown/New'].push(tool);
    }
  });

  for (const [category, tools] of Object.entries(categorized)) {
    if (tools.length > 0) {
      console.log(`\n${category} (${tools.length}):`);
      tools.forEach(tool => console.log(`  - ${tool}`));
    }
  }

  console.log('\n🧪 Testing core functionality...');

  // Test basic file operations
  console.log('\n📁 Testing file operations:');

  const listResult = await testTool(serverProcess, 'list_files', { directory: testDir });
  console.log(`  list_files: ${listResult ? '✅ Working' : '❌ Failed'}`);

  const readResult = await testTool(serverProcess, 'read_file', { filePath: path.join(testDir, 'test.js') });
  console.log(`  read_file: ${readResult ? '✅ Working' : '❌ Failed'}`);

  // Test code analysis if available
  if (availableTools.includes('search_symbols')) {
    console.log('\n🔍 Testing code analysis:');
    const symbolResult = await testTool(serverProcess, 'search_symbols', {
      query: 'hello',
      directory: testDir,
      autoIndex: true
    });
    console.log(`  search_symbols: ${symbolResult ? '✅ Working' : '❌ Failed'}`);
  }

  // Test server management
  console.log('\n⚙️ Testing server management:');
  const configResult = await testTool(serverProcess, 'get_server_config', {});
  console.log(`  get_server_config: ${configResult ? '✅ Working' : '❌ Failed'}`);

  const statsResult = await testTool(serverProcess, 'get_performance_stats', {});
  console.log(`  get_performance_stats: ${statsResult ? '✅ Working' : '❌ Failed'}`);

  console.log('\n📊 Summary:');
  console.log(`Total tools available: ${availableTools.length}`);
  console.log(`Expected advanced tools: ${EXPECTED_TOOLS.length}`);
  console.log(`Missing tools: ${EXPECTED_TOOLS.filter(t => !availableTools.includes(t)).length}`);

  const missingTools = EXPECTED_TOOLS.filter(t => !availableTools.includes(t));
  if (missingTools.length > 0) {
    console.log('\n❓ Missing expected tools:');
    missingTools.forEach(tool => console.log(`  - ${tool}`));
  }

  console.log('\n✅ Feature discovery complete!');

  serverProcess.kill();
  await fs.rm(testDir, { recursive: true, force: true });
}

async function testTool(serverProcess, toolName, args) {
  try {
    const result = await sendMCPRequest(serverProcess, 'tools/call', {
      name: toolName,
      arguments: args
    });
    return !result.error && result.content;
  } catch (error) {
    console.log(`    Error testing ${toolName}: ${error.message}`);
    return false;
  }
}

function sendMCPRequest(serverProcess, method, params) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    let responseData = '';
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);

    const onData = (data) => {
      responseData += data.toString();

      try {
        const lines = responseData.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const response = JSON.parse(line);
          if (response.id === id) {
            clearTimeout(timeout);
            serverProcess.stdout.off('data', onData);

            if (response.error) {
              resolve({ error: response.error });
            } else {
              resolve(response.result || {});
            }
            return;
          }
        }
      } catch (e) {
        // Continue reading
      }
    };

    serverProcess.stdout.on('data', onData);
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

if (require.main === module) {
  testServer().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}