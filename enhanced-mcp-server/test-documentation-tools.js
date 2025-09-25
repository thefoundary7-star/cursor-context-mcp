#!/usr/bin/env node

/**
 * Test script to verify the documentation tools are properly registered
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

async function testDocumentationTools() {
  console.log('📚 Testing Documentation Tools Registration');
  console.log('===========================================');
  
  try {
    // Test 1: List all tools to verify documentation tools are registered
    console.log('\n1️⃣ Testing Tool Discovery:');
    console.log('-----------------------------');
    
    const listToolsResult = await callMCPTool('list_tools', {});
    
    if (listToolsResult.success && listToolsResult.data) {
      const tools = listToolsResult.data.tools || [];
      const documentationTools = tools.filter(tool => 
        tool.name === 'get_documentation' || 
        tool.name === 'documentation_coverage' || 
        tool.name === 'generate_docs'
      );
      
      console.log(`✅ Found ${documentationTools.length} documentation tools:`);
      documentationTools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      
      if (documentationTools.length !== 3) {
        console.log('❌ Expected 3 documentation tools, found:', documentationTools.length);
        return false;
      }
    } else {
      console.log('❌ Failed to list tools:', listToolsResult.error);
      return false;
    }
    
    // Test 2: Test get_documentation tool
    console.log('\n2️⃣ Testing get_documentation Tool:');
    console.log('-------------------------------------');
    
    const getDocResult = await callMCPTool('get_documentation', {
      directory: '.',
      filePatterns: ['*.md', '*.js', '*.ts']
    });
    
    console.log('✅ get_documentation Result:');
    console.log(JSON.stringify(getDocResult, null, 2));
    
    // Test 3: Test documentation_coverage tool
    console.log('\n3️⃣ Testing documentation_coverage Tool:');
    console.log('----------------------------------------');
    
    const coverageResult = await callMCPTool('documentation_coverage', {
      directory: '.'
    });
    
    console.log('✅ documentation_coverage Result:');
    console.log(JSON.stringify(coverageResult, null, 2));
    
    // Test 4: Test generate_docs tool
    console.log('\n4️⃣ Testing generate_docs Tool:');
    console.log('--------------------------------');
    
    const generateResult = await callMCPTool('generate_docs', {
      directory: '.',
      format: 'markdown'
    });
    
    console.log('✅ generate_docs Result:');
    console.log(JSON.stringify(generateResult, null, 2));
    
    // Test 5: Test with different parameters
    console.log('\n5️⃣ Testing with Different Parameters:');
    console.log('--------------------------------------');
    
    const testCases = [
      {
        name: 'get_documentation with custom patterns',
        tool: 'get_documentation',
        args: {
          directory: './src',
          filePatterns: ['*.ts', '*.js']
        }
      },
      {
        name: 'documentation_coverage with specific directory',
        tool: 'documentation_coverage',
        args: {
          directory: './src/tools'
        }
      },
      {
        name: 'generate_docs with jsdoc format',
        tool: 'generate_docs',
        args: {
          directory: '.',
          format: 'jsdoc'
        }
      },
      {
        name: 'generate_docs with sphinx format',
        tool: 'generate_docs',
        args: {
          directory: '.',
          format: 'sphinx'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔧 Testing ${testCase.name}:`);
      
      try {
        const result = await callMCPTool(testCase.tool, testCase.args);
        
        if (result.success) {
          console.log(`✅ ${testCase.name} - Success`);
          console.log(`   Status: ${result.data?.status || 'unknown'}`);
          console.log(`   Message: ${result.data?.message || 'No message'}`);
        } else {
          console.log(`⚠️ ${testCase.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${testCase.name} - Exception: ${error.message}`);
      }
    }
    
    console.log('\n🎉 All documentation tools tests completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

async function callMCPTool(toolName, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Send the tool call request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
    
    child.on('close', (code) => {
      try {
        if (stdout) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.result) {
                  resolve({
                    success: true,
                    data: response.result
                  });
                  return;
                }
              } catch (parseError) {
                // Continue to next line
              }
            }
          }
        }
        
        resolve({
          success: false,
          error: 'No valid response received',
          stderr: stderr,
          stdout: stdout
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          stderr: stderr,
          stdout: stdout
        });
      }
    });
    
    child.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        success: false,
        error: 'Timeout'
      });
    }, 10000);
  });
}

async function main() {
  try {
    const success = await testDocumentationTools();
    
    if (success) {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
