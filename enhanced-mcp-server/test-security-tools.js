#!/usr/bin/env node

/**
 * Test script to verify the security tools are discoverable and callable
 */

import { createSecurityTools, handleSecurityTool } from './src/tools/securityTools.js';

async function testSecurityToolsDiscovery() {
  console.log('🔒 Testing Security Tools Discovery');
  console.log('==================================');
  
  try {
    // Test tool creation
    const securityTools = createSecurityTools();
    
    console.log('✅ Security Tools Created:');
    console.log(`- Total tools: ${securityTools.length}`);
    
    securityTools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
    });
    
    // Test tool names
    const expectedTools = [
      'security_audit',
      'analyze_dependencies', 
      'check_vulnerabilities',
      'dependency_tree_analysis',
      'license_compliance_check'
    ];
    
    console.log('\n🔍 Verifying Tool Names:');
    expectedTools.forEach(toolName => {
      const tool = securityTools.find(t => t.name === toolName);
      if (tool) {
        console.log(`✅ ${toolName} - Found`);
      } else {
        console.log(`❌ ${toolName} - Missing`);
      }
    });
    
    console.log('\n🎉 Security tools discovery test completed!');
    
  } catch (error) {
    console.error('❌ Discovery test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testSecurityToolsExecution() {
  console.log('\n🔧 Testing Security Tools Execution');
  console.log('====================================');
  
  try {
    const testCases = [
      {
        name: 'security_audit',
        args: {
          directory: '.',
          includeDevDependencies: true,
          severity: 'medium',
          outputFormat: 'json'
        }
      },
      {
        name: 'analyze_dependencies',
        args: {
          directory: '.',
          packageManager: 'auto',
          includeDevDependencies: true,
          depth: 3
        }
      },
      {
        name: 'check_vulnerabilities',
        args: {
          directory: '.',
          packageManager: 'auto',
          severity: 'medium',
          includeDevDependencies: true,
          outputFormat: 'json'
        }
      },
      {
        name: 'dependency_tree_analysis',
        args: {
          directory: '.',
          packageManager: 'auto',
          maxDepth: 5,
          includeDevDependencies: true,
          outputFormat: 'json'
        }
      },
      {
        name: 'license_compliance_check',
        args: {
          directory: '.',
          packageManager: 'auto',
          allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause'],
          deniedLicenses: ['GPL-2.0', 'GPL-3.0'],
          includeDevDependencies: true,
          outputFormat: 'json'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔧 Testing ${testCase.name}:`);
      console.log('--------------------------------');
      
      try {
        const result = await handleSecurityTool(testCase.name, testCase.args);
        
        console.log('✅ Tool Execution Result:');
        console.log(JSON.stringify(result, null, 2));
        
        // Verify result structure
        if (result.success !== undefined && result.data !== undefined) {
          console.log('✅ Result structure is valid');
        } else {
          console.log('⚠️ Result structure may be invalid');
        }
        
      } catch (error) {
        console.log(`❌ ${testCase.name} execution failed: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Security tools execution test completed!');
    
  } catch (error) {
    console.error('❌ Execution test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testSecurityToolsSchemas() {
  console.log('\n📋 Testing Security Tools Schemas');
  console.log('==================================');
  
  try {
    const securityTools = createSecurityTools();
    
    securityTools.forEach(tool => {
      console.log(`\n🔍 Testing ${tool.name} schema:`);
      
      // Check required properties
      const requiredProps = ['name', 'description', 'inputSchema'];
      const missingProps = requiredProps.filter(prop => !tool[prop]);
      
      if (missingProps.length === 0) {
        console.log('✅ All required properties present');
      } else {
        console.log(`❌ Missing properties: ${missingProps.join(', ')}`);
      }
      
      // Check input schema structure
      if (tool.inputSchema && tool.inputSchema.type === 'object') {
        console.log('✅ Input schema is valid object');
        
        if (tool.inputSchema.properties) {
          const propCount = Object.keys(tool.inputSchema.properties).length;
          console.log(`✅ Input schema has ${propCount} properties`);
        } else {
          console.log('⚠️ Input schema has no properties');
        }
      } else {
        console.log('❌ Input schema is invalid');
      }
    });
    
    console.log('\n🎉 Security tools schema test completed!');
    
  } catch (error) {
    console.error('❌ Schema test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testSecurityToolsPlaceholders() {
  console.log('\n🔧 Testing Security Tools Placeholders');
  console.log('=======================================');
  
  try {
    const testCases = [
      {
        name: 'security_audit',
        description: 'Security audit placeholder'
      },
      {
        name: 'analyze_dependencies',
        description: 'Dependency analysis placeholder'
      },
      {
        name: 'check_vulnerabilities',
        description: 'Vulnerability check placeholder'
      },
      {
        name: 'dependency_tree_analysis',
        description: 'Dependency tree analysis placeholder'
      },
      {
        name: 'license_compliance_check',
        description: 'License compliance check placeholder'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔧 Testing ${testCase.name}:`);
      
      try {
        const result = await handleSecurityTool(testCase.name, {});
        
        if (result.success && result.data) {
          console.log('✅ Placeholder response received');
          console.log(`   Status: ${result.data.status}`);
          console.log(`   Tool: ${result.data.tool}`);
          console.log(`   Message: ${result.data.message}`);
        } else {
          console.log('⚠️ Unexpected response format');
        }
        
      } catch (error) {
        console.log(`❌ ${testCase.name} placeholder test failed: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Security tools placeholder test completed!');
    
  } catch (error) {
    console.error('❌ Placeholder test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function main() {
  try {
    await testSecurityToolsDiscovery();
    await testSecurityToolsExecution();
    await testSecurityToolsSchemas();
    await testSecurityToolsPlaceholders();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
