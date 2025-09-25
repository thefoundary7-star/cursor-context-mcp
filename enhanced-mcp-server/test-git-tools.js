#!/usr/bin/env node

/**
 * Test script to verify the Git tools are discoverable via MCP protocol
 */

import { handleGitTool } from './src/tools/gitTools.js';

async function testGitTools() {
  console.log('🔧 Testing Git Tools Discovery');
  console.log('==============================');
  
  try {
    // Test 1: get_commit_history
    console.log('\n1️⃣ Testing get_commit_history:');
    console.log('-------------------------------');
    
    const commitHistoryResult = await handleGitTool('get_commit_history', {
      repository: '.',
      branch: 'HEAD',
      limit: 10
    });
    
    console.log('✅ get_commit_history Result:');
    console.log(JSON.stringify(commitHistoryResult, null, 2));
    
    // Test 2: get_file_blame
    console.log('\n2️⃣ Testing get_file_blame:');
    console.log('---------------------------');
    
    const fileBlameResult = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'package.json',
      revision: 'HEAD'
    });
    
    console.log('✅ get_file_blame Result:');
    console.log(JSON.stringify(fileBlameResult, null, 2));
    
    // Test 3: get_branch_info
    console.log('\n3️⃣ Testing get_branch_info:');
    console.log('-----------------------------');
    
    const branchInfoResult = await handleGitTool('get_branch_info', {
      repository: '.',
      includeRemote: true,
      includeMerged: false
    });
    
    console.log('✅ get_branch_info Result:');
    console.log(JSON.stringify(branchInfoResult, null, 2));
    
    // Test 4: find_commits_touching_file
    console.log('\n4️⃣ Testing find_commits_touching_file:');
    console.log('--------------------------------------');
    
    const fileCommitsResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'README.md',
      limit: 5
    });
    
    console.log('✅ find_commits_touching_file Result:');
    console.log(JSON.stringify(fileCommitsResult, null, 2));
    
    // Test 5: Test with invalid tool name
    console.log('\n5️⃣ Testing Invalid Tool Name:');
    console.log('-------------------------------');
    
    const invalidResult = await handleGitTool('invalid_git_tool', {
      repository: '.'
    });
    
    console.log('✅ Invalid Tool Result:');
    console.log(JSON.stringify(invalidResult, null, 2));
    
    console.log('\n🎉 All Git tools tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testGitToolSchemas() {
  console.log('\n📋 Testing Git Tool Schemas:');
  console.log('============================');
  
  try {
    // Test get_commit_history with various parameters
    console.log('\n🔍 Testing get_commit_history with different parameters:');
    
    const params1 = await handleGitTool('get_commit_history', {
      repository: '.',
      branch: 'main',
      limit: 20,
      author: 'test@example.com',
      since: '2024-01-01',
      until: '2024-12-31'
    });
    
    console.log('✅ get_commit_history with all parameters:');
    console.log(JSON.stringify(params1, null, 2));
    
    // Test get_file_blame with line range
    console.log('\n🔍 Testing get_file_blame with line range:');
    
    const params2 = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'src/index.ts',
      revision: 'HEAD',
      lineStart: 1,
      lineEnd: 50
    });
    
    console.log('✅ get_file_blame with line range:');
    console.log(JSON.stringify(params2, null, 2));
    
    // Test get_branch_info with specific branch
    console.log('\n🔍 Testing get_branch_info with specific branch:');
    
    const params3 = await handleGitTool('get_branch_info', {
      repository: '.',
      branch: 'main',
      includeRemote: false,
      includeMerged: true
    });
    
    console.log('✅ get_branch_info with specific branch:');
    console.log(JSON.stringify(params3, null, 2));
    
    // Test find_commits_touching_file with filters
    console.log('\n🔍 Testing find_commits_touching_file with filters:');
    
    const params4 = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      limit: 10,
      author: 'test@example.com',
      since: '2024-01-01',
      includeMerges: false
    });
    
    console.log('✅ find_commits_touching_file with filters:');
    console.log(JSON.stringify(params4, null, 2));
    
  } catch (error) {
    console.error('❌ Schema test failed:', error.message);
  }
}

async function main() {
  try {
    await testGitTools();
    await testGitToolSchemas();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
