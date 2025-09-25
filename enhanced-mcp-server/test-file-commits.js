#!/usr/bin/env node

/**
 * Test script to verify the find_commits_touching_file implementation
 */

import { handleGitTool } from './src/tools/gitTools.js';

async function testFileCommits() {
  console.log('📝 Testing find_commits_touching_file Implementation');
  console.log('==================================================');
  
  try {
    // Test 1: Basic file commits
    console.log('\n1️⃣ Testing Basic File Commits:');
    console.log('--------------------------------');
    
    const basicResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json'
    });
    
    console.log('✅ Basic File Commits Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: File commits with limit
    console.log('\n2️⃣ Testing File Commits with Limit:');
    console.log('------------------------------------');
    
    const limitResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      limit: 10
    });
    
    console.log('✅ File Commits with Limit Result:');
    console.log(JSON.stringify(limitResult, null, 2));
    
    // Test 3: File commits with author filter
    console.log('\n3️⃣ Testing Author Filter:');
    console.log('--------------------------');
    
    const authorResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      author: 'test@example.com',
      limit: 5
    });
    
    console.log('✅ Author Filter Result:');
    console.log(JSON.stringify(authorResult, null, 2));
    
    // Test 4: File commits with date range
    console.log('\n4️⃣ Testing Date Range Filter:');
    console.log('--------------------------------');
    
    const dateResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      since: '2024-01-01',
      until: '2024-12-31',
      limit: 5
    });
    
    console.log('✅ Date Range Filter Result:');
    console.log(JSON.stringify(dateResult, null, 2));
    
    // Test 5: File commits with merge filter
    console.log('\n5️⃣ Testing Merge Filter:');
    console.log('--------------------------');
    
    const mergeResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      includeMerges: true,
      limit: 5
    });
    
    console.log('✅ Merge Filter Result:');
    console.log(JSON.stringify(mergeResult, null, 2));
    
    // Test 6: Test with non-existent file
    console.log('\n6️⃣ Testing Non-existent File:');
    console.log('--------------------------------');
    
    const nonExistentResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'non-existent-file.js'
    });
    
    console.log('✅ Non-existent File Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 7: Test with missing filePath
    console.log('\n7️⃣ Testing Missing filePath:');
    console.log('------------------------------');
    
    const missingPathResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      limit: 10
      // No filePath provided
    });
    
    console.log('✅ Missing filePath Result:');
    console.log(JSON.stringify(missingPathResult, null, 2));
    
    // Test 8: Test with non-existent repository
    console.log('\n8️⃣ Testing Non-existent Repository:');
    console.log('-------------------------------------');
    
    const nonExistentRepoResult = await handleGitTool('find_commits_touching_file', {
      repository: '/non/existent/path',
      filePath: 'package.json'
    });
    
    console.log('✅ Non-existent Repository Result:');
    console.log(JSON.stringify(nonExistentRepoResult, null, 2));
    
    // Test 9: Test with all filters combined
    console.log('\n9️⃣ Testing All Filters Combined:');
    console.log('----------------------------------');
    
    const combinedResult = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      limit: 3,
      author: 'test@example.com',
      since: '2024-01-01',
      until: '2024-12-31',
      includeMerges: false
    });
    
    console.log('✅ Combined Filters Result:');
    console.log(JSON.stringify(combinedResult, null, 2));
    
    console.log('\n🎉 All file commits tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testFileCommitsParsing() {
  console.log('\n🔍 Testing File Commits Parsing:');
  console.log('=================================');
  
  try {
    // Test with a known file
    const result = await handleGitTool('find_commits_touching_file', {
      repository: '.',
      filePath: 'package.json',
      limit: 5
    });
    
    if (result.success && result.data.commits) {
      console.log('✅ File Commits Structure:');
      console.log(`- Total commits: ${result.data.total}`);
      console.log(`- Repository: ${result.data.repository}`);
      console.log(`- File path: ${result.data.filePath}`);
      
      if (result.data.filters) {
        console.log('\n🔍 Applied Filters:');
        Object.entries(result.data.filters).forEach(([key, value]) => {
          if (value !== undefined) {
            console.log(`- ${key}: ${value}`);
          }
        });
      }
      
      if (result.data.commits.length > 0) {
        console.log('\n📝 Sample Commits:');
        result.data.commits.slice(0, 3).forEach((commit, index) => {
          console.log(`${index + 1}. ${commit.sha.substring(0, 8)} - ${commit.message}`);
          console.log(`   Author: ${commit.author} <${commit.email}>`);
          console.log(`   Date: ${commit.date}`);
        });
      }
    } else {
      console.log('⚠️ File commits failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ File commits parsing test failed:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling:');
  console.log('===========================');
  
  try {
    // Test various error scenarios
    const errorTests = [
      {
        name: 'Missing filePath',
        args: { repository: '.', limit: 10 }
      },
      {
        name: 'Non-existent file',
        args: { repository: '.', filePath: 'non-existent.js' }
      },
      {
        name: 'Non-existent repository',
        args: { repository: '/tmp/non-existent', filePath: 'package.json' }
      },
      {
        name: 'Invalid date format',
        args: { repository: '.', filePath: 'package.json', since: 'invalid-date' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleGitTool('find_commits_touching_file', test.args);
        
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

async function testFileTracking() {
  console.log('\n🔍 Testing File Tracking:');
  console.log('==========================');
  
  try {
    // Test different file types
    const fileTests = [
      {
        name: 'package.json',
        file: 'package.json'
      },
      {
        name: 'README.md',
        file: 'README.md'
      },
      {
        name: 'TypeScript file',
        file: 'src/index.ts'
      },
      {
        name: 'JavaScript file',
        file: 'src/utils.js'
      }
    ];
    
    for (const test of fileTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleGitTool('find_commits_touching_file', {
          repository: '.',
          filePath: test.file,
          limit: 3
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Commits found: ${result.data.total}`);
          
          if (result.data.commits.length > 0) {
            console.log(`   Latest commit: ${result.data.commits[0].sha.substring(0, 8)}`);
            console.log(`   Latest author: ${result.data.commits[0].author}`);
          }
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ File tracking test failed:', error.message);
  }
}

async function main() {
  try {
    await testFileCommits();
    await testFileCommitsParsing();
    await testErrorHandling();
    await testFileTracking();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
