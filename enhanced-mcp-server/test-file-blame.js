#!/usr/bin/env node

/**
 * Test script to verify the get_file_blame implementation
 */

import { handleGitTool } from './src/tools/gitTools.js';

async function testFileBlame() {
  console.log('🔍 Testing get_file_blame Implementation');
  console.log('======================================');
  
  try {
    // Test 1: Basic file blame
    console.log('\n1️⃣ Testing Basic File Blame:');
    console.log('------------------------------');
    
    const basicResult = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'package.json'
    });
    
    console.log('✅ Basic File Blame Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: File blame with line range
    console.log('\n2️⃣ Testing Line Range Blame:');
    console.log('------------------------------');
    
    const lineRangeResult = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'package.json',
      lineStart: 1,
      lineEnd: 10
    });
    
    console.log('✅ Line Range Blame Result:');
    console.log(JSON.stringify(lineRangeResult, null, 2));
    
    // Test 3: File blame with specific revision
    console.log('\n3️⃣ Testing Revision Blame:');
    console.log('-----------------------------');
    
    const revisionResult = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'package.json',
      revision: 'HEAD'
    });
    
    console.log('✅ Revision Blame Result:');
    console.log(JSON.stringify(revisionResult, null, 2));
    
    // Test 4: Test with non-existent file
    console.log('\n4️⃣ Testing Non-existent File:');
    console.log('--------------------------------');
    
    const nonExistentResult = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'non-existent-file.js'
    });
    
    console.log('✅ Non-existent File Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 5: Test with invalid revision
    console.log('\n5️⃣ Testing Invalid Revision:');
    console.log('------------------------------');
    
    const invalidRevisionResult = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'package.json',
      revision: 'invalid-revision-12345'
    });
    
    console.log('✅ Invalid Revision Result:');
    console.log(JSON.stringify(invalidRevisionResult, null, 2));
    
    // Test 6: Test with missing filePath
    console.log('\n6️⃣ Testing Missing filePath:');
    console.log('------------------------------');
    
    const missingPathResult = await handleGitTool('get_file_blame', {
      repository: '.',
      revision: 'HEAD'
      // No filePath provided
    });
    
    console.log('✅ Missing filePath Result:');
    console.log(JSON.stringify(missingPathResult, null, 2));
    
    // Test 7: Test with non-existent repository
    console.log('\n7️⃣ Testing Non-existent Repository:');
    console.log('-------------------------------------');
    
    const nonExistentRepoResult = await handleGitTool('get_file_blame', {
      repository: '/non/existent/path',
      filePath: 'package.json'
    });
    
    console.log('✅ Non-existent Repository Result:');
    console.log(JSON.stringify(nonExistentRepoResult, null, 2));
    
    // Test 8: Test with different file types
    console.log('\n8️⃣ Testing Different File Types:');
    console.log('----------------------------------');
    
    const fileTypes = [
      'README.md',
      'src/index.ts',
      'package.json',
      'tsconfig.json'
    ];
    
    for (const file of fileTypes) {
      console.log(`\n🔍 Testing ${file}:`);
      
      try {
        const result = await handleGitTool('get_file_blame', {
          repository: '.',
          filePath: file,
          lineStart: 1,
          lineEnd: 5
        });
        
        if (result.success) {
          console.log(`✅ ${file} - Success (${result.data.total} lines)`);
        } else {
          console.log(`⚠️ ${file} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${file} - Exception: ${error.message}`);
      }
    }
    
    console.log('\n🎉 All file blame tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testBlameParsing() {
  console.log('\n🔍 Testing Blame Parsing:');
  console.log('==========================');
  
  try {
    // Test with a known file
    const result = await handleGitTool('get_file_blame', {
      repository: '.',
      filePath: 'package.json',
      lineStart: 1,
      lineEnd: 10
    });
    
    if (result.success && result.data.lines) {
      console.log('✅ Blame Data Structure:');
      console.log(`- Total lines: ${result.data.total}`);
      console.log(`- Repository: ${result.data.repository}`);
      console.log(`- File path: ${result.data.filePath}`);
      console.log(`- Revision: ${result.data.revision}`);
      
      if (result.data.lineRange) {
        console.log(`- Line range: ${result.data.lineRange.start}-${result.data.lineRange.end}`);
      }
      
      if (result.data.lines.length > 0) {
        console.log('\n📝 Sample Blame Lines:');
        result.data.lines.slice(0, 3).forEach((line, index) => {
          console.log(`${index + 1}. Line ${line.lineNumber}: ${line.content.substring(0, 50)}...`);
          console.log(`   Author: ${line.author} <${line.email}>`);
          console.log(`   Date: ${line.date}`);
          console.log(`   SHA: ${line.sha.substring(0, 8)}`);
        });
      }
    } else {
      console.log('⚠️ Blame parsing failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Blame parsing test failed:', error.message);
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
        args: { repository: '.' }
      },
      {
        name: 'Non-existent file',
        args: { repository: '.', filePath: 'non-existent.js' }
      },
      {
        name: 'Invalid revision',
        args: { repository: '.', filePath: 'package.json', revision: 'invalid' }
      },
      {
        name: 'Non-existent repository',
        args: { repository: '/tmp/non-existent', filePath: 'package.json' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleGitTool('get_file_blame', test.args);
        
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
    await testFileBlame();
    await testBlameParsing();
    await testErrorHandling();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
