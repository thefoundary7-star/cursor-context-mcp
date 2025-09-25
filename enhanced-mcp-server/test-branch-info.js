#!/usr/bin/env node

/**
 * Test script to verify the get_branch_info implementation
 */

import { handleGitTool } from './src/tools/gitTools.js';

async function testBranchInfo() {
  console.log('🌿 Testing get_branch_info Implementation');
  console.log('=======================================');
  
  try {
    // Test 1: Basic branch info
    console.log('\n1️⃣ Testing Basic Branch Info:');
    console.log('--------------------------------');
    
    const basicResult = await handleGitTool('get_branch_info', {
      repository: '.'
    });
    
    console.log('✅ Basic Branch Info Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: Branch info with remote branches
    console.log('\n2️⃣ Testing with Remote Branches:');
    console.log('----------------------------------');
    
    const remoteResult = await handleGitTool('get_branch_info', {
      repository: '.',
      includeRemote: true
    });
    
    console.log('✅ Remote Branches Result:');
    console.log(JSON.stringify(remoteResult, null, 2));
    
    // Test 3: Branch info with merged filter
    console.log('\n3️⃣ Testing Merged Filter:');
    console.log('--------------------------');
    
    const mergedResult = await handleGitTool('get_branch_info', {
      repository: '.',
      includeMerged: false
    });
    
    console.log('✅ Merged Filter Result:');
    console.log(JSON.stringify(mergedResult, null, 2));
    
    // Test 4: Specific branch info
    console.log('\n4️⃣ Testing Specific Branch:');
    console.log('-----------------------------');
    
    const specificResult = await handleGitTool('get_branch_info', {
      repository: '.',
      branch: 'main'
    });
    
    console.log('✅ Specific Branch Result:');
    console.log(JSON.stringify(specificResult, null, 2));
    
    // Test 5: Test with non-existent repository
    console.log('\n5️⃣ Testing Non-existent Repository:');
    console.log('-------------------------------------');
    
    const nonExistentRepoResult = await handleGitTool('get_branch_info', {
      repository: '/non/existent/path'
    });
    
    console.log('✅ Non-existent Repository Result:');
    console.log(JSON.stringify(nonExistentRepoResult, null, 2));
    
    // Test 6: Test with non-existent branch
    console.log('\n6️⃣ Testing Non-existent Branch:');
    console.log('---------------------------------');
    
    const nonExistentBranchResult = await handleGitTool('get_branch_info', {
      repository: '.',
      branch: 'non-existent-branch'
    });
    
    console.log('✅ Non-existent Branch Result:');
    console.log(JSON.stringify(nonExistentBranchResult, null, 2));
    
    // Test 7: Test with all parameters
    console.log('\n7️⃣ Testing All Parameters:');
    console.log('-----------------------------');
    
    const allParamsResult = await handleGitTool('get_branch_info', {
      repository: '.',
      branch: 'main',
      includeRemote: true,
      includeMerged: true
    });
    
    console.log('✅ All Parameters Result:');
    console.log(JSON.stringify(allParamsResult, null, 2));
    
    console.log('\n🎉 All branch info tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testBranchInfoParsing() {
  console.log('\n🔍 Testing Branch Info Parsing:');
  console.log('===============================');
  
  try {
    // Test with basic branch info
    const result = await handleGitTool('get_branch_info', {
      repository: '.',
      includeRemote: true
    });
    
    if (result.success && result.data.branches) {
      console.log('✅ Branch Info Structure:');
      console.log(`- Total branches: ${result.data.total}`);
      console.log(`- Repository: ${result.data.repository}`);
      console.log(`- Current branch: ${result.data.currentBranch}`);
      
      if (result.data.filters) {
        console.log('\n🔍 Applied Filters:');
        Object.entries(result.data.filters).forEach(([key, value]) => {
          if (value !== undefined) {
            console.log(`- ${key}: ${value}`);
          }
        });
      }
      
      if (result.data.branches.length > 0) {
        console.log('\n📝 Sample Branches:');
        result.data.branches.slice(0, 3).forEach((branch, index) => {
          console.log(`${index + 1}. ${branch.name} ${branch.isCurrent ? '(current)' : ''}`);
          console.log(`   SHA: ${branch.sha}`);
          console.log(`   Author: ${branch.author} <${branch.email}>`);
          console.log(`   Date: ${branch.date}`);
          console.log(`   Remote: ${branch.isRemote ? 'Yes' : 'No'}`);
          if (branch.upstream) {
            console.log(`   Upstream: ${branch.upstream}`);
          }
          if (branch.tracking) {
            console.log(`   Tracking: ${branch.tracking}`);
          }
        });
      }
    } else {
      console.log('⚠️ Branch info failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Branch info parsing test failed:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling:');
  console.log('===========================');
  
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
        name: 'Invalid parameters',
        args: { repository: '.', includeRemote: 'invalid' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleGitTool('get_branch_info', test.args);
        
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

async function testBranchFiltering() {
  console.log('\n🔍 Testing Branch Filtering:');
  console.log('============================');
  
  try {
    // Test different filtering combinations
    const filterTests = [
      {
        name: 'Local branches only',
        args: { repository: '.', includeRemote: false }
      },
      {
        name: 'Remote branches included',
        args: { repository: '.', includeRemote: true }
      },
      {
        name: 'Merged branches only',
        args: { repository: '.', includeMerged: true }
      },
      {
        name: 'Unmerged branches only',
        args: { repository: '.', includeMerged: false }
      }
    ];
    
    for (const test of filterTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleGitTool('get_branch_info', test.args);
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Branches found: ${result.data.total}`);
          
          if (result.data.branches.length > 0) {
            const localBranches = result.data.branches.filter(b => !b.isRemote).length;
            const remoteBranches = result.data.branches.filter(b => b.isRemote).length;
            console.log(`   Local branches: ${localBranches}`);
            console.log(`   Remote branches: ${remoteBranches}`);
          }
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Branch filtering test failed:', error.message);
  }
}

async function main() {
  try {
    await testBranchInfo();
    await testBranchInfoParsing();
    await testErrorHandling();
    await testBranchFiltering();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
