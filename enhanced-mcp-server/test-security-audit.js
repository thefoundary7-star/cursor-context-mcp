#!/usr/bin/env node

/**
 * Test script to verify the security_audit implementation
 */

import { handleSecurityTool } from './src/tools/securityTools.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testSecurityAudit() {
  console.log('🔒 Testing Security Audit Implementation');
  console.log('=======================================');
  
  try {
    // Test 1: Basic security audit
    console.log('\n1️⃣ Testing Basic Security Audit:');
    console.log('----------------------------------');
    
    const basicResult = await handleSecurityTool('security_audit', {
      directory: '.',
      severity: 'medium',
      outputFormat: 'json'
    });
    
    console.log('✅ Basic Security Audit Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: Security audit with high severity
    console.log('\n2️⃣ Testing High Severity Filter:');
    console.log('----------------------------------');
    
    const highSeverityResult = await handleSecurityTool('security_audit', {
      directory: '.',
      severity: 'high',
      includeDevDependencies: true,
      outputFormat: 'json'
    });
    
    console.log('✅ High Severity Filter Result:');
    console.log(JSON.stringify(highSeverityResult, null, 2));
    
    // Test 3: Security audit with critical severity
    console.log('\n3️⃣ Testing Critical Severity Filter:');
    console.log('------------------------------------');
    
    const criticalResult = await handleSecurityTool('security_audit', {
      directory: '.',
      severity: 'critical',
      outputFormat: 'json'
    });
    
    console.log('✅ Critical Severity Filter Result:');
    console.log(JSON.stringify(criticalResult, null, 2));
    
    // Test 4: Test with non-existent directory
    console.log('\n4️⃣ Testing Non-existent Directory:');
    console.log('------------------------------------');
    
    const nonExistentResult = await handleSecurityTool('security_audit', {
      directory: '/non/existent/path',
      severity: 'medium'
    });
    
    console.log('✅ Non-existent Directory Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 5: Test with all parameters
    console.log('\n5️⃣ Testing All Parameters:');
    console.log('-----------------------------');
    
    const allParamsResult = await handleSecurityTool('security_audit', {
      directory: '.',
      includeDevDependencies: true,
      severity: 'low',
      outputFormat: 'json'
    });
    
    console.log('✅ All Parameters Result:');
    console.log(JSON.stringify(allParamsResult, null, 2));
    
    console.log('\n🎉 All security audit tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testSecurityAuditWithTestFiles() {
  console.log('\n🧪 Testing Security Audit with Test Files');
  console.log('==========================================');
  
  try {
    // Create test directory
    const testDir = './test-security-audit';
    mkdirSync(testDir, { recursive: true });
    
    // Create test .env file with secrets
    const envContent = `
API_KEY=sk-1234567890abcdef
SECRET=my-secret-key
PASSWORD=admin123
TOKEN=abc123def456
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
`;
    writeFileSync(join(testDir, '.env'), envContent);
    
    // Create test JavaScript file with dangerous functions
    const jsContent = `
const { exec } = require('child_process');
const fs = require('fs');

// Dangerous functions
eval('console.log("dangerous")');
exec('rm -rf /', (error) => {});
fs.writeFileSync('test.txt', 'data');
`;
    writeFileSync(join(testDir, 'dangerous.js'), jsContent);
    
    // Create test Python file with dangerous functions
    const pyContent = `
import os
import subprocess

# Dangerous functions
os.system('rm -rf /')
subprocess.Popen(['ls', '-la'])
exec('print("dangerous")')
eval('1 + 1')
`;
    writeFileSync(join(testDir, 'dangerous.py'), pyContent);
    
    // Create package.json for npm audit test
    const packageJson = {
      "name": "test-security-audit",
      "version": "1.0.0",
      "dependencies": {
        "lodash": "^4.17.20"
      }
    };
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    console.log('✅ Test files created');
    
    // Test security audit on test directory
    console.log('\n🔍 Running security audit on test directory:');
    
    const testResult = await handleSecurityTool('security_audit', {
      directory: testDir,
      severity: 'low',
      outputFormat: 'json'
    });
    
    console.log('✅ Test Directory Security Audit Result:');
    console.log(JSON.stringify(testResult, null, 2));
    
    // Clean up test directory
    const { rmSync } = await import('fs');
    rmSync(testDir, { recursive: true, force: true });
    console.log('✅ Test directory cleaned up');
    
  } catch (error) {
    console.error('❌ Test with files failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

async function testSecurityAuditParsing() {
  console.log('\n🔍 Testing Security Audit Parsing:');
  console.log('===================================');
  
  try {
    // Test with basic parameters
    const result = await handleSecurityTool('security_audit', {
      directory: '.',
      severity: 'medium',
      outputFormat: 'json'
    });
    
    if (result.success && result.data) {
      console.log('✅ Security Audit Structure:');
      console.log(`- Total issues: ${result.data.summary?.total || 0}`);
      console.log(`- Directory: ${result.data.directory}`);
      console.log(`- Timestamp: ${result.data.timestamp}`);
      
      if (result.data.packageManager) {
        console.log(`- Package Manager: ${result.data.packageManager}`);
      }
      
      if (result.data.summary?.bySeverity) {
        console.log('\n🔍 Issues by Severity:');
        Object.entries(result.data.summary.bySeverity).forEach(([severity, count]) => {
          if (count > 0) {
            console.log(`- ${severity}: ${count}`);
          }
        });
      }
      
      if (result.data.issues && result.data.issues.length > 0) {
        console.log('\n📝 Sample Issues:');
        result.data.issues.slice(0, 3).forEach((issue, index) => {
          console.log(`${index + 1}. ${issue.type} - ${issue.severity}`);
          console.log(`   File: ${issue.file}`);
          if (issue.line) {
            console.log(`   Line: ${issue.line}`);
          }
          console.log(`   Message: ${issue.message}`);
        });
      }
    } else {
      console.log('⚠️ Security audit failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Security audit parsing test failed:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling:');
  console.log('===========================');
  
  try {
    // Test various error scenarios
    const errorTests = [
      {
        name: 'Non-existent directory',
        args: { directory: '/tmp/non-existent-security-test' }
      },
      {
        name: 'Invalid severity',
        args: { directory: '.', severity: 'invalid' }
      },
      {
        name: 'Invalid output format',
        args: { directory: '.', outputFormat: 'invalid' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('security_audit', test.args);
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
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

async function testSeverityFiltering() {
  console.log('\n🔍 Testing Severity Filtering:');
  console.log('===============================');
  
  try {
    // Test different severity levels
    const severityTests = [
      { name: 'Low severity', severity: 'low' },
      { name: 'Medium severity', severity: 'medium' },
      { name: 'High severity', severity: 'high' },
      { name: 'Critical severity', severity: 'critical' }
    ];
    
    for (const test of severityTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('security_audit', {
          directory: '.',
          severity: test.severity,
          outputFormat: 'json'
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Total issues: ${result.data.summary?.total || 0}`);
          
          if (result.data.summary?.bySeverity) {
            const severityCounts = result.data.summary.bySeverity;
            console.log(`   Severity breakdown:`, severityCounts);
          }
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Severity filtering test failed:', error.message);
  }
}

async function main() {
  try {
    await testSecurityAudit();
    await testSecurityAuditWithTestFiles();
    await testSecurityAuditParsing();
    await testErrorHandling();
    await testSeverityFiltering();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
