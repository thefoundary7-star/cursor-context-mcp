#!/usr/bin/env node

/**
 * Test script to verify test tools are properly registered and discoverable
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function testTestTools() {
  return new Promise((resolve, reject) => {
    console.log('Testing test tools registration...');
    
    const serverPath = join(__dirname, 'dist', 'index.js');
    const server = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let stdoutData = '';
    let stderrData = '';
    let responseReceived = false;

    server.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    server.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    server.on('error', (error) => {
      reject(new Error(`Server failed to start: ${error.message}`));
    });

    // Send a basic MCP request after server startup
    setTimeout(() => {
      const initRequest = {
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
      };

      console.log('Sending initialize request...');
      server.stdin.write(JSON.stringify(initRequest) + '\n');

      // Send list_tools request
      setTimeout(() => {
        const toolsRequest = {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {}
        };

        console.log('Sending tools/list request...');
        server.stdin.write(JSON.stringify(toolsRequest) + '\n');

        // Wait for responses then cleanup
        setTimeout(() => {
          server.kill();

          // Check if test tools are in the response
          const hasTestTools = stdoutData.includes('run_tests') && 
                              stdoutData.includes('detect_test_framework') &&
                              stdoutData.includes('get_test_status') &&
                              stdoutData.includes('run_test_file') &&
                              stdoutData.includes('test_coverage_analysis');

          resolve({
            stdoutData,
            stderrData,
            responseReceived,
            hasTestTools,
            testToolsFound: {
              run_tests: stdoutData.includes('run_tests'),
              detect_test_framework: stdoutData.includes('detect_test_framework'),
              get_test_status: stdoutData.includes('get_test_status'),
              run_test_file: stdoutData.includes('run_test_file'),
              test_coverage_analysis: stdoutData.includes('test_coverage_analysis')
            }
          });
        }, 3000);
      }, 1000);
    }, 2000);
  });
}

async function main() {
  try {
    console.log('🧪 Testing Test Tools Registration');
    console.log('=====================================');
    
    const result = await testTestTools();
    
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`✅ Server started: ${result.responseReceived ? 'Yes' : 'No'}`);
    console.log(`✅ Test tools registered: ${result.hasTestTools ? 'Yes' : 'No'}`);
    
    console.log('\n🔍 Individual Tool Status:');
    Object.entries(result.testToolsFound).forEach(([tool, found]) => {
      console.log(`  ${found ? '✅' : '❌'} ${tool}`);
    });
    
    if (result.hasTestTools) {
      console.log('\n🎉 SUCCESS: All test tools are properly registered and discoverable!');
    } else {
      console.log('\n❌ FAILURE: Some test tools are missing from the tool list.');
    }
    
    console.log('\n📝 Server Output:');
    console.log('=================');
    console.log(result.stdoutData);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
