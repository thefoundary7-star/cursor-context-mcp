#!/usr/bin/env node

/**
 * Test script to verify the analyze_dependencies implementation
 */

import { handleSecurityTool } from './src/tools/securityTools.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testDependencyAnalysis() {
  console.log('📦 Testing Dependency Analysis Implementation');
  console.log('=============================================');
  
  try {
    // Test 1: Basic dependency analysis
    console.log('\n1️⃣ Testing Basic Dependency Analysis:');
    console.log('--------------------------------------');
    
    const basicResult = await handleSecurityTool('analyze_dependencies', {
      directory: '.',
      packageManager: 'auto',
      includeDevDependencies: true
    });
    
    console.log('✅ Basic Dependency Analysis Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: NPM-specific analysis
    console.log('\n2️⃣ Testing NPM Dependency Analysis:');
    console.log('--------------------------------------');
    
    const npmResult = await handleSecurityTool('analyze_dependencies', {
      directory: '.',
      packageManager: 'npm',
      includeDevDependencies: true
    });
    
    console.log('✅ NPM Dependency Analysis Result:');
    console.log(JSON.stringify(npmResult, null, 2));
    
    // Test 3: Runtime dependencies only
    console.log('\n3️⃣ Testing Runtime Dependencies Only:');
    console.log('--------------------------------------');
    
    const runtimeResult = await handleSecurityTool('analyze_dependencies', {
      directory: '.',
      packageManager: 'auto',
      includeDevDependencies: false
    });
    
    console.log('✅ Runtime Dependencies Result:');
    console.log(JSON.stringify(runtimeResult, null, 2));
    
    // Test 4: Test with non-existent directory
    console.log('\n4️⃣ Testing Non-existent Directory:');
    console.log('------------------------------------');
    
    const nonExistentResult = await handleSecurityTool('analyze_dependencies', {
      directory: '/non/existent/path',
      packageManager: 'auto'
    });
    
    console.log('✅ Non-existent Directory Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 5: Test with unsupported package manager
    console.log('\n5️⃣ Testing Unsupported Package Manager:');
    console.log('----------------------------------------');
    
    const unsupportedResult = await handleSecurityTool('analyze_dependencies', {
      directory: '.',
      packageManager: 'unsupported'
    });
    
    console.log('✅ Unsupported Package Manager Result:');
    console.log(JSON.stringify(unsupportedResult, null, 2));
    
    console.log('\n🎉 All dependency analysis tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testDependencyAnalysisWithTestFiles() {
  console.log('\n🧪 Testing Dependency Analysis with Test Files');
  console.log('===============================================');
  
  try {
    // Create test directory
    const testDir = './test-dependency-analysis';
    mkdirSync(testDir, { recursive: true });
    
    // Test 1: NPM project
    console.log('\n📦 Testing NPM Project:');
    const npmDir = join(testDir, 'npm-project');
    mkdirSync(npmDir, { recursive: true });
    
    const packageJson = {
      "name": "test-npm-project",
      "version": "1.0.0",
      "dependencies": {
        "lodash": "^4.17.20",
        "express": "^4.18.0"
      },
      "devDependencies": {
        "jest": "^29.0.0",
        "typescript": "^4.9.0"
      }
    };
    writeFileSync(join(npmDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    const npmResult = await handleSecurityTool('analyze_dependencies', {
      directory: npmDir,
      packageManager: 'npm',
      includeDevDependencies: true
    });
    
    console.log('✅ NPM Project Result:');
    console.log(JSON.stringify(npmResult, null, 2));
    
    // Test 2: Python project with requirements.txt
    console.log('\n🐍 Testing Python Project (requirements.txt):');
    const pythonDir = join(testDir, 'python-project');
    mkdirSync(pythonDir, { recursive: true });
    
    const requirementsContent = `
requests>=2.25.0
numpy==1.21.0
pandas>=1.3.0
# This is a comment
flask==2.0.0
`;
    writeFileSync(join(pythonDir, 'requirements.txt'), requirementsContent);
    
    const pythonResult = await handleSecurityTool('analyze_dependencies', {
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
    
    const rustResult = await handleSecurityTool('analyze_dependencies', {
      directory: rustDir,
      packageManager: 'cargo',
      includeDevDependencies: true
    });
    
    console.log('✅ Rust Project Result:');
    console.log(JSON.stringify(rustResult, null, 2));
    
    // Test 4: Maven project
    console.log('\n☕ Testing Maven Project:');
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
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
    </dependency>
  </dependencies>
</project>
`;
    writeFileSync(join(mavenDir, 'pom.xml'), pomXml);
    
    const mavenResult = await handleSecurityTool('analyze_dependencies', {
      directory: mavenDir,
      packageManager: 'maven',
      includeDevDependencies: true
    });
    
    console.log('✅ Maven Project Result:');
    console.log(JSON.stringify(mavenResult, null, 2));
    
    // Test 5: Gradle project
    console.log('\n🔧 Testing Gradle Project:');
    const gradleDir = join(testDir, 'gradle-project');
    mkdirSync(gradleDir, { recursive: true });
    
    const buildGradle = `
plugins {
    id 'java'
}

dependencies {
    implementation 'org.springframework:spring-core:5.3.0'
    implementation 'com.google.guava:guava:30.1.1-jre'
    testImplementation 'junit:junit:4.13.2'
    testImplementation 'org.mockito:mockito-core:3.12.4'
}
`;
    writeFileSync(join(gradleDir, 'build.gradle'), buildGradle);
    
    const gradleResult = await handleSecurityTool('analyze_dependencies', {
      directory: gradleDir,
      packageManager: 'gradle',
      includeDevDependencies: true
    });
    
    console.log('✅ Gradle Project Result:');
    console.log(JSON.stringify(gradleResult, null, 2));
    
    // Clean up test directory
    const { rmSync } = await import('fs');
    rmSync(testDir, { recursive: true, force: true });
    console.log('✅ Test directory cleaned up');
    
  } catch (error) {
    console.error('❌ Test with files failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

async function testDependencyAnalysisParsing() {
  console.log('\n🔍 Testing Dependency Analysis Parsing:');
  console.log('========================================');
  
  try {
    // Test with basic parameters
    const result = await handleSecurityTool('analyze_dependencies', {
      directory: '.',
      packageManager: 'auto',
      includeDevDependencies: true
    });
    
    if (result.success && result.data) {
      console.log('✅ Dependency Analysis Structure:');
      console.log(`- Manager: ${result.data.manager}`);
      console.log(`- Total dependencies: ${result.data.total}`);
      console.log(`- Runtime dependencies: ${result.data.runtime}`);
      console.log(`- Dev dependencies: ${result.data.dev}`);
      console.log(`- Directory: ${result.data.directory}`);
      console.log(`- Files: ${result.data.files.join(', ')}`);
      
      if (result.data.dependencies && result.data.dependencies.length > 0) {
        console.log('\n📝 Sample Dependencies:');
        result.data.dependencies.slice(0, 5).forEach((dep, index) => {
          console.log(`${index + 1}. ${dep.name}@${dep.version} (${dep.type})`);
        });
      }
    } else {
      console.log('⚠️ Dependency analysis failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Dependency analysis parsing test failed:', error.message);
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
        args: { directory: '/tmp/non-existent-dependency-test' }
      },
      {
        name: 'Unsupported package manager',
        args: { directory: '.', packageManager: 'unsupported' }
      },
      {
        name: 'No dependency files',
        args: { directory: '.', packageManager: 'pip' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('analyze_dependencies', test.args);
        
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

async function testPackageManagerDetection() {
  console.log('\n🔍 Testing Package Manager Detection:');
  console.log('======================================');
  
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
        const result = await handleSecurityTool('analyze_dependencies', {
          directory: '.',
          packageManager: test.manager,
          includeDevDependencies: true
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Manager: ${result.data.manager}`);
          console.log(`   Dependencies: ${result.data.total}`);
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Package manager detection test failed:', error.message);
  }
}

async function main() {
  try {
    await testDependencyAnalysis();
    await testDependencyAnalysisWithTestFiles();
    await testDependencyAnalysisParsing();
    await testErrorHandling();
    await testPackageManagerDetection();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
