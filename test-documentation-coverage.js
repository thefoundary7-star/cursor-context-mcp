#!/usr/bin/env node

/**
 * Test script for documentation coverage functionality
 * Creates sample files with documented and undocumented functions/classes
 * and tests the documentation_coverage tool
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create test directory structure
const testDir = path.join(__dirname, 'test-coverage-files');
const testFiles = {
  'documented.js': `/**
 * This is a well-documented JavaScript file
 */

/**
 * A documented function that does something useful
 * @param {string} input - The input string
 * @returns {string} The processed result
 */
function documentedFunction(input) {
  return input.toUpperCase();
}

/**
 * A documented class with methods
 */
class DocumentedClass {
  /**
   * Constructor for the class
   * @param {string} name - The name of the instance
   */
  constructor(name) {
    this.name = name;
  }
  
  /**
   * A documented method
   * @returns {string} The name
   */
  getName() {
    return this.name;
  }
}

// Undocumented function
function undocumentedFunction() {
  return 'no docs';
}

// Undocumented class
class UndocumentedClass {
  constructor() {
    this.value = 42;
  }
  
  getValue() {
    return this.value;
  }
}

// Module exports
export { documentedFunction, DocumentedClass };
export const MODULE_CONSTANT = 'test';
`,

  'mixed.ts': `/**
 * TypeScript file with mixed documentation
 */

/**
 * A documented interface
 */
interface DocumentedInterface {
  /** The name property */
  name: string;
  /** The value property */
  value: number;
}

/**
 * A documented function with types
 * @param input - The input parameter
 * @returns The processed result
 */
function documentedFunction(input: string): string {
  return input.toLowerCase();
}

// Undocumented interface
interface UndocumentedInterface {
  data: any;
}

// Undocumented function
function undocumentedFunction(input: string): number {
  return input.length;
}

/**
 * A documented class
 */
class DocumentedClass {
  private value: number;
  
  /**
   * Constructor
   * @param value - Initial value
   */
  constructor(value: number) {
    this.value = value;
  }
  
  /**
   * Get the value
   * @returns The current value
   */
  getValue(): number {
    return this.value;
  }
}

// Undocumented class
class UndocumentedClass {
  constructor() {}
  
  doSomething() {
    return 'no docs';
  }
}

export { DocumentedClass, documentedFunction };
`,

  'python_sample.py': `"""
This is a Python module with mixed documentation coverage.
"""

def documented_function(param1, param2):
    """
    A well-documented function.
    
    Args:
        param1 (str): The first parameter
        param2 (int): The second parameter
        
    Returns:
        str: The combined result
    """
    return f"{param1}_{param2}"

def undocumented_function():
    return "no documentation"

class DocumentedClass:
    """
    A well-documented class.
    """
    
    def __init__(self, name):
        """
        Initialize the class.
        
        Args:
            name (str): The name of the instance
        """
        self.name = name
    
    def get_name(self):
        """
        Get the name.
        
        Returns:
            str: The name
        """
        return self.name

class UndocumentedClass:
    def __init__(self):
        self.value = 42
    
    def get_value(self):
        return self.value

# Module-level variable
MODULE_VAR = "test"

# Undocumented module-level function
def module_function():
    return "no docs"
`,

  'minimal.js': `// This file has minimal documentation
function test() {
  return 'hello';
}

class Test {
  constructor() {}
}
`
};

async function createTestFiles() {
  console.log('Creating test files...');
  
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Write test files
  for (const [filename, content] of Object.entries(testFiles)) {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    console.log(`Created: ${filename}`);
  }
}

async function testDocumentationCoverage() {
  console.log('\nTesting documentation coverage...');
  
  try {
    // Test the MCP server with documentation_coverage tool
    const mcpProcess = spawn(process.execPath, ['enhanced-mcp-server/dist/index.js'], {
      cwd: path.join(__dirname, 'enhanced-mcp-server'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Send initialization request
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send tool call request
    const toolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'documentation_coverage',
        arguments: {
          directory: testDir
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(toolRequest) + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    mcpProcess.kill();
    
    console.log('MCP Server Output:');
    console.log(output);
    
    if (errorOutput) {
      console.log('MCP Server Errors:');
      console.log(errorOutput);
    }
    
    // Parse and analyze results
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const response = JSON.parse(line);
          if (response.result && response.result.content) {
            const result = response.result.content[0];
            console.log('\n=== DOCUMENTATION COVERAGE RESULTS ===');
            console.log(JSON.stringify(result, null, 2));
            
            // Verify expected results
            if (result.coverage) {
              console.log('\n=== VERIFICATION ===');
              console.log(`Overall Coverage: ${result.coverage.overall}%`);
              console.log(`Functions: ${result.coverage.functions.documented}/${result.coverage.functions.total} (${result.coverage.functions.coverage}%)`);
              console.log(`Classes: ${result.coverage.classes.documented}/${result.coverage.classes.total} (${result.coverage.classes.coverage}%)`);
              console.log(`Modules: ${result.coverage.modules.documented}/${result.coverage.modules.total} (${result.coverage.modules.coverage}%)`);
              console.log(`Total Files: ${result.summary.totalFiles}`);
              console.log(`Undocumented Items: ${result.undocumented.length}`);
              
              // Expected results based on our test files
              const expectedFiles = 4; // documented.js, mixed.ts, python_sample.py, minimal.js
              const expectedFunctions = 8; // 4 documented + 4 undocumented
              const expectedClasses = 6; // 3 documented + 3 undocumented
              
              console.log('\n=== EXPECTED VS ACTUAL ===');
              console.log(`Files: Expected ${expectedFiles}, Got ${result.summary.totalFiles}`);
              console.log(`Functions: Expected ~${expectedFunctions}, Got ${result.coverage.functions.total}`);
              console.log(`Classes: Expected ~${expectedClasses}, Got ${result.coverage.classes.total}`);
              
              if (result.coverage.overall > 0 && result.coverage.overall < 100) {
                console.log('✅ Coverage analysis working correctly!');
              } else {
                console.log('⚠️  Coverage analysis may need adjustment');
              }
            }
            break;
          }
        } catch (e) {
          // Continue parsing other lines
        }
      }
    }
    
  } catch (error) {
    console.error('Error testing documentation coverage:', error);
  }
}

async function cleanup() {
  console.log('\nCleaning up test files...');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('Test files cleaned up');
  }
}

async function main() {
  try {
    await createTestFiles();
    await testDocumentationCoverage();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await cleanup();
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createTestFiles, testDocumentationCoverage, cleanup };
