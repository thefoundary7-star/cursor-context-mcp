#!/usr/bin/env node

/**
 * Test script to verify the dependency_tree_analysis implementation
 */

import { handleSecurityTool } from './src/tools/securityTools.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testDependencyTreeAnalysis() {
  console.log('🌳 Testing Dependency Tree Analysis Implementation');
  console.log('==================================================');
  
  try {
    // Test 1: Basic dependency tree analysis
    console.log('\n1️⃣ Testing Basic Dependency Tree Analysis:');
    console.log('--------------------------------------------');
    
    const basicResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'auto',
      maxDepth: 3,
      includeDevDependencies: true,
      outputFormat: 'json'
    });
    
    console.log('✅ Basic Dependency Tree Analysis Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 2: NPM-specific dependency tree analysis
    console.log('\n2️⃣ Testing NPM Dependency Tree Analysis:');
    console.log('-------------------------------------------');
    
    const npmResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'npm',
      maxDepth: 2,
      includeDevDependencies: true
    });
    
    console.log('✅ NPM Dependency Tree Analysis Result:');
    console.log(JSON.stringify(npmResult, null, 2));
    
    // Test 3: Limited depth analysis
    console.log('\n3️⃣ Testing Limited Depth Analysis:');
    console.log('------------------------------------');
    
    const limitedDepthResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'auto',
      maxDepth: 1,
      includeDevDependencies: true
    });
    
    console.log('✅ Limited Depth Analysis Result:');
    console.log(JSON.stringify(limitedDepthResult, null, 2));
    
    // Test 4: Production dependencies only
    console.log('\n4️⃣ Testing Production Dependencies Only:');
    console.log('------------------------------------------');
    
    const productionResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'auto',
      maxDepth: 3,
      includeDevDependencies: false
    });
    
    console.log('✅ Production Dependencies Only Result:');
    console.log(JSON.stringify(productionResult, null, 2));
    
    // Test 5: Test with non-existent directory
    console.log('\n5️⃣ Testing Non-existent Directory:');
    console.log('------------------------------------');
    
    const nonExistentResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '/non/existent/path',
      packageManager: 'auto'
    });
    
    console.log('✅ Non-existent Directory Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 6: Test with unsupported package manager
    console.log('\n6️⃣ Testing Unsupported Package Manager:');
    console.log('------------------------------------------');
    
    const unsupportedResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'maven'
    });
    
    console.log('✅ Unsupported Package Manager Result:');
    console.log(JSON.stringify(unsupportedResult, null, 2));
    
    // Test 7: Test with all parameters
    console.log('\n7️⃣ Testing All Parameters:');
    console.log('-----------------------------');
    
    const allParamsResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'auto',
      maxDepth: 4,
      includeDevDependencies: true,
      outputFormat: 'tree'
    });
    
    console.log('✅ All Parameters Result:');
    console.log(JSON.stringify(allParamsResult, null, 2));
    
    console.log('\n🎉 All dependency tree analysis tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testDependencyTreeAnalysisWithTestFiles() {
  console.log('\n🧪 Testing Dependency Tree Analysis with Test Files');
  console.log('====================================================');
  
  try {
    // Create test directory
    const testDir = './test-dependency-tree';
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
    
    const npmResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: npmDir,
      packageManager: 'npm',
      maxDepth: 2,
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
    
    const pythonResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: pythonDir,
      packageManager: 'pip',
      maxDepth: 3,
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
    
    const rustResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: rustDir,
      packageManager: 'cargo',
      maxDepth: 2,
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
    
    const mavenResult = await handleSecurityTool('dependency_tree_analysis', {
      directory: mavenDir,
      packageManager: 'maven',
      maxDepth: 2,
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

async function testDependencyTreeAnalysisParsing() {
  console.log('\n🔍 Testing Dependency Tree Analysis Parsing:');
  console.log('===========================================');
  
  try {
    // Test with basic parameters
    const result = await handleSecurityTool('dependency_tree_analysis', {
      directory: '.',
      packageManager: 'auto',
      maxDepth: 2,
      includeDevDependencies: true
    });
    
    if (result.success && result.data) {
      console.log('✅ Dependency Tree Analysis Structure:');
      console.log(`- Manager: ${result.data.manager}`);
      console.log(`- Total dependencies: ${result.data.total || 0}`);
      console.log(`- Max depth: ${result.data.maxDepth || 0}`);
      console.log(`- Directory: ${result.data.directory}`);
      console.log(`- Tool available: ${result.data.toolAvailable}`);
      
      if (result.data.tree && result.data.tree.length > 0) {
        console.log('\n🌳 Sample Dependency Tree:');
        result.data.tree.slice(0, 3).forEach((node, index) => {
          console.log(`${index + 1}. ${node.name}@${node.version} (${node.type})`);
          if (node.dependencies && node.dependencies.length > 0) {
            console.log(`   Dependencies: ${node.dependencies.length}`);
            node.dependencies.slice(0, 2).forEach(dep => {
              console.log(`   - ${dep.name}@${dep.version} (${dep.type})`);
            });
          }
        });
      }
    } else {
      console.log('⚠️ Dependency tree analysis failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Dependency tree analysis parsing test failed:', error.message);
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
        args: { directory: '/tmp/non-existent-dependency-tree-test' }
      },
      {
        name: 'Unsupported package manager',
        args: { directory: '.', packageManager: 'maven' }
      },
      {
        name: 'Invalid max depth',
        args: { directory: '.', maxDepth: -1 }
      },
      {
        name: 'Invalid output format',
        args: { directory: '.', outputFormat: 'invalid' }
      }
    ];
    
    for (const test of errorTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('dependency_tree_analysis', test.args);
        
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

async function testDepthFiltering() {
  console.log('\n🔍 Testing Depth Filtering:');
  console.log('============================');
  
  try {
    // Test different depth levels
    const depthTests = [
      { name: 'Depth 1', maxDepth: 1 },
      { name: 'Depth 2', maxDepth: 2 },
      { name: 'Depth 3', maxDepth: 3 },
      { name: 'Depth 4', maxDepth: 4 }
    ];
    
    for (const test of depthTests) {
      console.log(`\n🔧 Testing ${test.name}:`);
      
      try {
        const result = await handleSecurityTool('dependency_tree_analysis', {
          directory: '.',
          packageManager: 'auto',
          maxDepth: test.maxDepth,
          includeDevDependencies: true
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Total dependencies: ${result.data.total || 0}`);
          console.log(`   Max depth: ${result.data.maxDepth || 0}`);
          
          if (result.data.tree && result.data.tree.length > 0) {
            console.log(`   Root dependencies: ${result.data.tree.length}`);
          }
        } else {
          console.log(`⚠️ ${test.name} - Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Exception: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Depth filtering test failed:', error.message);
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
        const result = await handleSecurityTool('dependency_tree_analysis', {
          directory: '.',
          packageManager: 'auto',
          maxDepth: 2,
          includeDevDependencies: test.includeDevDependencies
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Total dependencies: ${result.data.total || 0}`);
          console.log(`   Include dev: ${test.includeDevDependencies}`);
          
          if (result.data.tree && result.data.tree.length > 0) {
            const runtimeCount = result.data.tree.filter(node => node.type === 'runtime').length;
            const devCount = result.data.tree.filter(node => node.type === 'dev').length;
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
        const result = await handleSecurityTool('dependency_tree_analysis', {
          directory: '.',
          packageManager: test.manager,
          maxDepth: 2,
          includeDevDependencies: true
        });
        
        if (result.success) {
          console.log(`✅ ${test.name} - Success`);
          console.log(`   Manager: ${result.data.manager}`);
          console.log(`   Tool available: ${result.data.toolAvailable}`);
          console.log(`   Dependencies: ${result.data.total || 0}`);
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
    await testDependencyTreeAnalysis();
    await testDependencyTreeAnalysisWithTestFiles();
    await testDependencyTreeAnalysisParsing();
    await testErrorHandling();
    await testDepthFiltering();
    await testDevDependenciesFiltering();
    await testToolAvailability();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
