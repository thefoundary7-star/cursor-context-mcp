#!/usr/bin/env node

/**
 * Test script to verify the license_compliance_check implementation
 */

import { handleSecurityTool } from './src/tools/securityTools.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testLicenseComplianceCheck() {
  console.log('📄 Testing License Compliance Check Implementation');
  console.log('==================================================');
  
  try {
    // Test 1: Basic license compliance check
    console.log('\n1️⃣ Testing Basic License Compliance Check:');
    console.log('--------------------------------------------');
    
    const basicResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'auto',
      includeDevDependencies: true,
      outputFormat: 'json'
    });
    
    console.log('✅ Basic License Compliance Check Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: NPM-specific license compliance check
    console.log('\n2️⃣ Testing NPM License Compliance Check:');
    console.log('-------------------------------------------');
    
    const npmResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'npm',
      includeDevDependencies: true
    });
    
    console.log('✅ NPM License Compliance Check Result:');
    console.log(JSON.stringify(npmResult, null, 2));
    
    // Test 3: With allowed licenses
    console.log('\n3️⃣ Testing With Allowed Licenses:');
    console.log('-----------------------------------');
    
    const allowedResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'auto',
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause'],
      includeDevDependencies: true
    });
    
    console.log('✅ Allowed Licenses Result:');
    console.log(JSON.stringify(allowedResult, null, 2));
    
    // Test 4: With denied licenses
    console.log('\n4️⃣ Testing With Denied Licenses:');
    console.log('----------------------------------');
    
    const deniedResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'auto',
      deniedLicenses: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
      includeDevDependencies: true
    });
    
    console.log('✅ Denied Licenses Result:');
    console.log(JSON.stringify(deniedResult, null, 2));
    
    // Test 5: Production dependencies only
    console.log('\n5️⃣ Testing Production Dependencies Only:');
    console.log('------------------------------------------');
    
    const productionResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'auto',
      includeDevDependencies: false
    });
    
    console.log('✅ Production Dependencies Only Result:');
    console.log(JSON.stringify(productionResult, null, 2));
    
    // Test 6: Test with non-existent directory
    console.log('\n6️⃣ Testing Non-existent Directory:');
    console.log('------------------------------------');
    
    const nonExistentResult = await handleSecurityTool('license_compliance_check', {
      directory: '/non/existent/path',
      packageManager: 'auto'
    });
    
    console.log('✅ Non-existent Directory Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 7: Test with unsupported package manager
    console.log('\n7️⃣ Testing Unsupported Package Manager:');
    console.log('------------------------------------------');
    
    const unsupportedResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'maven'
    });
    
    console.log('✅ Unsupported Package Manager Result:');
    console.log(JSON.stringify(unsupportedResult, null, 2));
    
    // Test 8: Test with all parameters
    console.log('\n8️⃣ Testing All Parameters:');
    console.log('-----------------------------');
    
    const allParamsResult = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'auto',
      allowedLicenses: ['MIT', 'Apache-2.0'],
      deniedLicenses: ['GPL-2.0', 'GPL-3.0'],
      includeDevDependencies: true,
      outputFormat: 'summary'
    });
    
    console.log('✅ All Parameters Result:');
    console.log(JSON.stringify(allParamsResult, null, 2));
    
    console.log('\n🎉 All license compliance check tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testLicenseComplianceCheckWithTestFiles() {
  console.log('\n🧪 Testing License Compliance Check with Test Files');
  console.log('=====================================================');
  
  try {
    // Create test directory
    const testDir = './test-license-compliance';
    mkdirSync(testDir, { recursive: true });
    
    // Test 1: NPM project with dependencies
    console.log('\n📦 Testing NPM Project with Dependencies:');
    const npmDir = join(testDir, 'npm-project');
    mkdirSync(npmDir, { recursive: true });
    
    const packageJson = {
      "name": "test-npm-project",
      "version": "1.0.0",
      "dependencies": {
        "lodash": "^4.17.20",
        "express": "^4.18.0",
        "axios": "^0.21.0"
      },
      "devDependencies": {
        "jest": "^29.0.0",
        "typescript": "^4.9.0"
      }
    };
    writeFileSync(join(npmDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    const npmResult = await handleSecurityTool('license_compliance_check', {
      directory: npmDir,
      packageManager: 'npm',
      includeDevDependencies: true
    });
    
    console.log('✅ NPM Project Result:');
    console.log(JSON.stringify(npmResult, null, 2));
    
    // Test 2: Python project with requirements.txt
    console.log('\n🐍 Testing Python Project:');
    const pythonDir = join(testDir, 'python-project');
    mkdirSync(pythonDir, { recursive: true });
    
    const requirementsContent = `
requests>=2.25.0
numpy==1.21.0
pandas>=1.3.0
flask==2.0.0
`;
    writeFileSync(join(pythonDir, 'requirements.txt'), requirementsContent);
    
    const pythonResult = await handleSecurityTool('license_compliance_check', {
      directory: pythonDir,
      packageManager: 'pip',
      includeDevDependencies: true
    });
    
    console.log('✅ Python Project Result:');
    console.log(JSON.stringify(pythonResult, null, 2));
    
    // Test 3: Rust project
    console.log('\n🦀 Testing Rust Project:');
    const rustDir = join(testDir, 'rust-project');
    mkdirSync(rustDir, { recursive: true });
    
    const cargoToml = `
[package]
name = "test-rust-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
criterion = "0.3"
`;
    writeFileSync(join(rustDir, 'Cargo.toml'), cargoToml);
    
    const rustResult = await handleSecurityTool('license_compliance_check', {
      directory: rustDir,
      packageManager: 'cargo',
      includeDevDependencies: true
    });
    
    console.log('✅ Rust Project Result:');
    console.log(JSON.stringify(rustResult, null, 2));
    
    // Test 4: Maven project (unsupported)
    console.log('\n☕ Testing Maven Project (Unsupported):');
    const mavenDir = join(testDir, 'maven-project');
    mkdirSync(mavenDir, { recursive: true });
    
    const pomXml = `
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-maven-project</artifactId>
  <version>1.0.0</version>
  
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.0</version>
    </dependency>
  </dependencies>
</project>
`;
    writeFileSync(join(mavenDir, 'pom.xml'), pomXml);
    
    const mavenResult = await handleSecurityTool('license_compliance_check', {
      directory: mavenDir,
      packageManager: 'maven',
      includeDevDependencies: true
    });
    
    console.log('✅ Maven Project Result:');
    console.log(JSON.stringify(mavenResult, null, 2));
    
    // Clean up test directory
    const { rmSync } = await import('fs');
    rmSync(testDir, { recursive: true, force: true });
    console.log('✅ Test directory cleaned up');
    
  } catch (error) {
    console.error('❌ Test with files failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

async function testLicenseComplianceCheckParsing() {
  console.log('\n🔍 Testing License Compliance Check Parsing:');
  console.log('==============================================');
  
  try {
    // Test with basic parameters
    const result = await handleSecurityTool('license_compliance_check', {
      directory: '.',
      packageManager: 'auto',
      includeDevDependencies: true
    });
    
    if (result.success && result.data) {
      console.log('✅ License Compliance Check Structure:');
      console.log(`- Manager: ${result.data.manager}`);
      console.log(`- Total dependencies: ${result.data.summary?.total || 0}`);
      console.log(`- Directory: ${result.data.directory}`);
      console.log(`- Tool available: ${result.data.toolAvailable}`);
      
      if (result.data.summary) {
        console.log('\n📄 License Compliance Summary:');
        console.log(`- Allowed: ${result.data.summary.allowed}`);
        console.log(`- Denied: ${result.data.summary.denied}`);
        console.log(`- Unknown: ${result.data.summary.unknown}`);
      }
      
      if (result.data.compliance && result.data.compliance.length > 0) {
        console.log('\n📝 Sample License Compliance:');
        result.data.compliance.slice(0, 3).forEach((item, index) => {
          console.log(`${index + 1}. ${item.name}@${item.version} - ${item.license} (${item.status})`);
        });
      }
    } else {
      console.log('⚠️ License compliance check failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ License compliance check parsing test failed:', error.message);
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
        args: { directory: '/tmp/non-existent-license-compliance-test' }
      },
      {
        name: 'Unsupported package manager',
        args: { directory: '.', packageManager: 'maven' }
      },
      {
        name: 'Invalid allowed licenses',
        args: { directory: '.', allowedLicenses: 'invalid' }
      },
      {
        name: 'Invalid output format',
        args: { directory: '.', outputFormat: 'invalid' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('license_compliance_check', test.args);
        
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

async function testLicenseFiltering() {
  console.log('\n🔍 Testing License Filtering:');
  console.log('==============================');
  
  try {
    // Test different license filtering scenarios
    const licenseTests = [
      {
        name: 'MIT and Apache allowed',
        args: {
          directory: '.',
          allowedLicenses: ['MIT', 'Apache-2.0'],
          includeDevDependencies: true
        }
      },
      {
        name: 'GPL denied',
        args: {
          directory: '.',
          deniedLicenses: ['GPL-2.0', 'GPL-3.0'],
          includeDevDependencies: true
        }
      },
      {
        name: 'Mixed allowed and denied',
        args: {
          directory: '.',
          allowedLicenses: ['MIT', 'Apache-2.0'],
          deniedLicenses: ['GPL-2.0', 'GPL-3.0'],
          includeDevDependencies: true
        }
      },
      {
        name: 'No license filtering',
        args: {
          directory: '.',
          includeDevDependencies: true
        }
      }
    ];
    
    for (const test of licenseTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('license_compliance_check', test.args);
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Total dependencies: ${result.data.summary?.total || 0}`);
          
          if (result.data.summary) {
            console.log(`   Allowed: ${result.data.summary.allowed}`);
            console.log(`   Denied: ${result.data.summary.denied}`);
            console.log(`   Unknown: ${result.data.summary.unknown}`);
          }
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ License filtering test failed:', error.message);
  }
}

async function testDevDependenciesFiltering() {
  console.log('\n🔍 Testing Dev Dependencies Filtering:');
  console.log('======================================');
  
  try {
    // Test with and without dev dependencies
    const devTests = [
      { name: 'Include dev dependencies', includeDevDependencies: true },
      { name: 'Exclude dev dependencies', includeDevDependencies: false }
    ];
    
    for (const test of devTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('license_compliance_check', {
          directory: '.',
          packageManager: 'auto',
          includeDevDependencies: test.includeDevDependencies
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Total dependencies: ${result.data.summary?.total || 0}`);
          console.log(`   Include dev: ${test.includeDevDependencies}`);
          
          if (result.data.compliance && result.data.compliance.length > 0) {
            const runtimeCount = result.data.compliance.filter(item => item.name.includes('runtime')).length;
            const devCount = result.data.compliance.filter(item => item.name.includes('dev')).length;
            console.log(`   Runtime dependencies: ${runtimeCount}`);
            console.log(`   Dev dependencies: ${devCount}`);
          }
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Dev dependencies filtering test failed:', error.message);
  }
}

async function testToolAvailability() {
  console.log('\n🔧 Testing Tool Availability:');
  console.log('==============================');
  
  try {
    // Test different package managers
    const managerTests = [
      { name: 'NPM', manager: 'npm' },
      { name: 'PIP', manager: 'pip' },
      { name: 'Cargo', manager: 'cargo' },
      { name: 'Maven', manager: 'maven' },
      { name: 'Gradle', manager: 'gradle' }
    ];
    
    for (const test of managerTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('license_compliance_check', {
          directory: '.',
          packageManager: test.manager,
          includeDevDependencies: true
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Manager: ${result.data.manager}`);
          console.log(`   Tool available: ${result.data.toolAvailable}`);
          console.log(`   Dependencies: ${result.data.summary?.total || 0}`);
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Tool availability test failed:', error.message);
  }
}

async function main() {
  try {
    await testLicenseComplianceCheck();
    await testLicenseComplianceCheckWithTestFiles();
    await testLicenseComplianceCheckParsing();
    await testErrorHandling();
    await testLicenseFiltering();
    await testDevDependenciesFiltering();
    await testToolAvailability();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
