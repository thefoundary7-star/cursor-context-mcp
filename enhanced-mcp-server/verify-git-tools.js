#!/usr/bin/env node

/**
 * Verification script to test Git tool creation and handler functions
 */

import { createGitTools, handleGitTool } from './src/tools/gitTools.js';

async function verifyGitTools() {
  console.log('🔍 Verifying Git Tools Implementation');
  console.log('=====================================');
  
  try {
    // Test 1: Create Git tools
    console.log('\n1️⃣ Testing createGitTools():');
    console.log('-----------------------------');
    
    const gitTools = createGitTools();
    
    console.log('✅ Git tools created successfully');
    console.log(`📊 Number of tools: ${gitTools.length}`);
    
    // Display tool information
    gitTools.forEach((tool, index) => {
      console.log(`\n${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Required params: ${tool.inputSchema.required?.join(', ') || 'none'}`);
      console.log(`   Optional params: ${Object.keys(tool.inputSchema.properties || {}).length - (tool.inputSchema.required?.length || 0)}`);
    });
    
    // Test 2: Verify tool schemas
    console.log('\n2️⃣ Testing Tool Schemas:');
    console.log('-------------------------');
    
    const expectedTools = [
      'get_commit_history',
      'get_file_blame', 
      'get_branch_info',
      'find_commits_touching_file'
    ];
    
    const toolNames = gitTools.map(tool => tool.name);
    
    expectedTools.forEach(expectedTool => {
      if (toolNames.includes(expectedTool)) {
        console.log(`✅ ${expectedTool} - Found`);
      } else {
        console.log(`❌ ${expectedTool} - Missing`);
      }
    });
    
    // Test 3: Test handler function
    console.log('\n3️⃣ Testing handleGitTool():');
    console.log('-----------------------------');
    
    const testCases = [
      {
        tool: 'get_commit_history',
        args: { repository: '.', limit: 5 }
      },
      {
        tool: 'get_file_blame',
        args: { repository: '.', filePath: 'package.json' }
      },
      {
        tool: 'get_branch_info',
        args: { repository: '.' }
      },
      {
        tool: 'find_commits_touching_file',
        args: { repository: '.', filePath: 'README.md' }
      },
      {
        tool: 'invalid_tool',
        args: { repository: '.' }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔧 Testing ${testCase.tool}:`);
      
      try {
        const result = await handleGitTool(testCase.tool, testCase.args);
        
        if (result.success) {
          console.log(`✅ ${testCase.tool} - Success`);
          console.log(`   Status: ${result.data?.status || 'unknown'}`);
          console.log(`   Message: ${result.data?.message || 'no message'}`);
        } else {
          console.log(`⚠️ ${testCase.tool} - Failed`);
          console.log(`   Error: ${result.error || 'unknown error'}`);
        }
      } catch (error) {
        console.log(`❌ ${testCase.tool} - Exception`);
        console.log(`   Error: ${error.message}`);
      }
    }
    
    // Test 4: Verify MCP compatibility
    console.log('\n4️⃣ Testing MCP Compatibility:');
    console.log('--------------------------------');
    
    const mcpCompatible = gitTools.every(tool => {
      const hasName = typeof tool.name === 'string';
      const hasDescription = typeof tool.description === 'string';
      const hasInputSchema = tool.inputSchema && typeof tool.inputSchema === 'object';
      
      return hasName && hasDescription && hasInputSchema;
    });
    
    if (mcpCompatible) {
      console.log('✅ All tools are MCP compatible');
    } else {
      console.log('❌ Some tools are not MCP compatible');
    }
    
    // Test 5: Check placeholder responses
    console.log('\n5️⃣ Testing Placeholder Responses:');
    console.log('-----------------------------------');
    
    const placeholderTests = [
      'get_commit_history',
      'get_file_blame',
      'get_branch_info',
      'find_commits_touching_file'
    ];
    
    for (const toolName of placeholderTests) {
      const result = await handleGitTool(toolName, { repository: '.' });
      
      if (result.data?.status === 'not yet implemented') {
        console.log(`✅ ${toolName} - Placeholder response correct`);
      } else {
        console.log(`❌ ${toolName} - Placeholder response incorrect`);
        console.log(`   Expected: not yet implemented`);
        console.log(`   Got: ${result.data?.status || 'unknown'}`);
      }
    }
    
    console.log('\n🎉 Git tools verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function main() {
  try {
    await verifyGitTools();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
