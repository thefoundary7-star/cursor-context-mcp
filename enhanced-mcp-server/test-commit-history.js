#!/usr/bin/env node

/**
 * Test script to verify the get_commit_history implementation
 */

import { handleGitTool } from './src/tools/gitTools.js';

async function testCommitHistory() {
  console.log('📜 Testing get_commit_history Implementation');
  console.log('==========================================');
  
  try {
    // Test 1: Basic commit history
    console.log('\n1️⃣ Testing Basic Commit History:');
    console.log('----------------------------------');
    
    const basicResult = await handleGitTool('get_commit_history', {
      repository: '.',
      limit: 5
    });
    
    console.log('✅ Basic Commit History Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: Commit history with author filter
    console.log('\n2️⃣ Testing Author Filter:');
    console.log('---------------------------');
    
    const authorResult = await handleGitTool('get_commit_history', {
      repository: '.',
      limit: 10,
      author: 'test@example.com'
    });
    
    console.log('✅ Author Filter Result:');
    console.log(JSON.stringify(authorResult, null, 2));
    
    // Test 3: Commit history with date range
    console.log('\n3️⃣ Testing Date Range Filter:');
    console.log('--------------------------------');
    
    const dateResult = await handleGitTool('get_commit_history', {
      repository: '.',
      limit: 10,
      since: '2024-01-01',
      until: '2024-12-31'
    });
    
    console.log('✅ Date Range Filter Result:');
    console.log(JSON.stringify(dateResult, null, 2));
    
    // Test 4: Commit history for specific file
    console.log('\n4️⃣ Testing File Filter:');
    console.log('-------------------------');
    
    const fileResult = await handleGitTool('get_commit_history', {
      repository: '.',
      filePath: 'package.json',
      limit: 5
    });
    
    console.log('✅ File Filter Result:');
    console.log(JSON.stringify(fileResult, null, 2));
    
    // Test 5: Commit history for specific branch
    console.log('\n5️⃣ Testing Branch Filter:');
    console.log('---------------------------');
    
    const branchResult = await handleGitTool('get_commit_history', {
      repository: '.',
      branch: 'main',
      limit: 5
    });
    
    console.log('✅ Branch Filter Result:');
    console.log(JSON.stringify(branchResult, null, 2));
    
    // Test 6: Test with non-existent repository
    console.log('\n6️⃣ Testing Non-existent Repository:');
    console.log('------------------------------------');
    
    const nonExistentResult = await handleGitTool('get_commit_history', {
      repository: '/non/existent/path',
      limit: 5
    });
    
    console.log('✅ Non-existent Repository Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 7: Test with non-existent branch
    console.log('\n7️⃣ Testing Non-existent Branch:');
    console.log('---------------------------------');
    
    const nonExistentBranchResult = await handleGitTool('get_commit_history', {
      repository: '.',
      branch: 'non-existent-branch',
      limit: 5
    });
    
    console.log('✅ Non-existent Branch Result:');
    console.log(JSON.stringify(nonExistentBranchResult, null, 2));
    
    // Test 8: Test with all filters combined
    console.log('\n8️⃣ Testing All Filters Combined:');
    console.log('----------------------------------');
    
    const combinedResult = await handleGitTool('get_commit_history', {
      repository: '.',
      branch: 'main',
      limit: 3,
      author: 'test@example.com',
      since: '2024-01-01',
      until: '2024-12-31',
      filePath: 'README.md'
    });
    
    console.log('✅ Combined Filters Result:');
    console.log(JSON.stringify(combinedResult, null, 2));
    
    console.log('\n🎉 All commit history tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testCommitHistoryParsing() {
  console.log('\n🔍 Testing Commit History Parsing:');
  console.log('===================================');
  
  try {
    // Test with a small limit to see parsing
    const result = await handleGitTool('get_commit_history', {
      repository: '.',
      limit: 3
    });
    
    if (result.success && result.data.commits) {
      console.log('✅ Commit History Structure:');
      console.log(`- Total commits: ${result.data.total}`);
      console.log(`- Repository: ${result.data.repository}`);
      console.log(`- Branch: ${result.data.branch}`);
      
      if (result.data.commits.length > 0) {
        console.log('\n📝 Sample Commits:');
        result.data.commits.slice(0, 2).forEach((commit, index) => {
          console.log(`${index + 1}. ${commit.sha.substring(0, 8)} - ${commit.message}`);
          console.log(`   Author: ${commit.author} <${commit.email}>`);
          console.log(`   Date: ${commit.date}`);
        });
      }
      
      if (result.data.filters) {
        console.log('\n🔍 Applied Filters:');
        Object.entries(result.data.filters).forEach(([key, value]) => {
          if (value) {
            console.log(`- ${key}: ${value}`);
          }
        });
      }
    } else {
      console.log('⚠️ Commit history failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Parsing test failed:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling:');
  console.log('==========================');
  
  try {
    // Test various error scenarios
    const errorTests = [
      {
        name: 'Non-existent repository',
        args: { repository: '/tmp/non-existent-repo' }
      },
      {
        name: 'Non-existent branch',
        args: { repository: '.', branch: 'non-existent-branch' }
      },
      {
        name: 'Invalid date format',
        args: { repository: '.', since: 'invalid-date' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleGitTool('get_commit_history', test.args);
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success (unexpected)`);
        } else {
          console.log(`⚠️ ${test.name} - Failed as expected`);
          console.log(`   Error: ${result.error}`);
          console.log(`   Message: ${result.data?.message || 'No message'}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception`);
        console.log(`   Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  }
}

async function main() {
  try {
    await testCommitHistory();
    await testCommitHistoryParsing();
    await testErrorHandling();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
