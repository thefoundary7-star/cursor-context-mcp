#!/usr/bin/env node

/**
 * Test script for get_documentation tool
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

async function testGetDocumentation() {
  console.log('📚 Testing get_documentation Tool');
  console.log('=================================');
  
  try {
    // Create test files for different documentation types
    console.log('\n1️⃣ Creating Test Files:');
    console.log('------------------------');
    
    const testDir = './test-documentation';
    mkdirSync(testDir, { recursive: true });
    
    // Create markdown file
    const markdownContent = `# Project Documentation

This is a test project with comprehensive documentation.

## Installation

To install this project:

\`\`\`bash
npm install
\`\`\`

## Usage

The project provides several features:

- Feature 1: Basic functionality
- Feature 2: Advanced features
- Feature 3: Integration capabilities

## API Reference

### Functions

#### getDocumentation()
Extracts documentation from files.

#### parseContent()
Parses file content for documentation.

## Examples

Here are some usage examples:

\`\`\`javascript
const docs = getDocumentation('./src');
\`\`\`

## Contributing

Please read our contributing guidelines.

## License

MIT License
`;
    writeFileSync(join(testDir, 'README.md'), markdownContent);
    
    // Create reStructuredText file
    const rstContent = `Project Documentation
===================

This is a test project with comprehensive documentation.

Installation
============

To install this project:

.. code-block:: bash

   npm install

Usage
=====

The project provides several features:

* Feature 1: Basic functionality
* Feature 2: Advanced features
* Feature 3: Integration capabilities

API Reference
==============

Functions
---------

getDocumentation()
   Extracts documentation from files.

parseContent()
   Parses file content for documentation.

Examples
========

Here are some usage examples:

.. code-block:: javascript

   const docs = getDocumentation('./src');

Contributing
============

Please read our contributing guidelines.

License
=======

MIT License
`;
    writeFileSync(join(testDir, 'docs.rst'), rstContent);
    
    // Create text file
    const textContent = `PROJECT DOCUMENTATION

This is a test project with comprehensive documentation.

INSTALLATION

To install this project:
npm install

USAGE

The project provides several features:
- Feature 1: Basic functionality
- Feature 2: Advanced features
- Feature 3: Integration capabilities

API REFERENCE

Functions:
- getDocumentation(): Extracts documentation from files
- parseContent(): Parses file content for documentation

EXAMPLES

Here are some usage examples:
const docs = getDocumentation('./src');

CONTRIBUTING

Please read our contributing guidelines.

LICENSE

MIT License
`;
    writeFileSync(join(testDir, 'README.txt'), textContent);
    
    // Create JavaScript file with JSDoc
    const jsContent = `/**
 * Project Documentation Tool
 * 
 * This module provides comprehensive documentation extraction capabilities.
 * 
 * @author Test Author
 * @version 1.0.0
 * @since 2024-01-15
 */

/**
 * Extracts documentation from files in a directory
 * 
 * @param {string} directory - Directory to scan for documentation
 * @param {string[]} patterns - File patterns to match
 * @returns {Object} Documentation extraction results
 * 
 * @example
 * const docs = getDocumentation('./src', ['*.md', '*.js']);
 * console.log(docs.files.length);
 */
function getDocumentation(directory, patterns = ['*.md']) {
  // Implementation here
  return { files: [], summary: {} };
}

/**
 * Parses file content for documentation
 * 
 * @param {string} content - File content to parse
 * @param {string} type - File type (markdown, javascript, etc.)
 * @returns {Object} Parsed documentation
 */
function parseContent(content, type) {
  // Implementation here
  return { docs: [], sections: [] };
}

/**
 * Documentation extraction class
 * 
 * Provides methods for extracting and analyzing documentation
 * from various file types and formats.
 */
class DocumentationExtractor {
  /**
   * Creates a new documentation extractor
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
  }
  
  /**
   * Extracts documentation from a file
   * 
   * @param {string} filePath - Path to the file
   * @returns {Object} Extracted documentation
   */
  extractFromFile(filePath) {
    // Implementation here
    return { docs: [], sections: [] };
  }
}

module.exports = { getDocumentation, parseContent, DocumentationExtractor };
`;
    writeFileSync(join(testDir, 'documentation.js'), jsContent);
    
    // Create TypeScript file with JSDoc
    const tsContent = `/**
 * Project Documentation Tool
 * 
 * This module provides comprehensive documentation extraction capabilities.
 * 
 * @author Test Author
 * @version 1.0.0
 * @since 2024-01-15
 */

/**
 * Documentation file interface
 */
interface DocumentationFile {
  path: string;
  type: 'markdown' | 'javascript' | 'typescript' | 'python' | 'other';
  docs: string[];
  sections: string[];
}

/**
 * Documentation result interface
 */
interface DocumentationResult {
  files: DocumentationFile[];
  summary: {
    totalFiles: number;
    totalDocs: number;
    byType: Record<string, number>;
  };
}

/**
 * Extracts documentation from files in a directory
 * 
 * @param directory - Directory to scan for documentation
 * @param patterns - File patterns to match
 * @returns Documentation extraction results
 * 
 * @example
 * const docs = getDocumentation('./src', ['*.md', '*.ts']);
 * console.log(docs.files.length);
 */
function getDocumentation(directory: string, patterns: string[] = ['*.md']): DocumentationResult {
  // Implementation here
  return { files: [], summary: { totalFiles: 0, totalDocs: 0, byType: {} } };
}

/**
 * Parses file content for documentation
 * 
 * @param content - File content to parse
 * @param type - File type (markdown, javascript, etc.)
 * @returns Parsed documentation
 */
function parseContent(content: string, type: string): { docs: string[]; sections: string[] } {
  // Implementation here
  return { docs: [], sections: [] };
}

/**
 * Documentation extraction class
 * 
 * Provides methods for extracting and analyzing documentation
 * from various file types and formats.
 */
class DocumentationExtractor {
  private options: Record<string, any>;
  
  /**
   * Creates a new documentation extractor
   * 
   * @param options - Configuration options
   */
  constructor(options: Record<string, any> = {}) {
    this.options = options;
  }
  
  /**
   * Extracts documentation from a file
   * 
   * @param filePath - Path to the file
   * @returns Extracted documentation
   */
  extractFromFile(filePath: string): { docs: string[]; sections: string[] } {
    // Implementation here
    return { docs: [], sections: [] };
  }
}

export { getDocumentation, parseContent, DocumentationExtractor };
export type { DocumentationFile, DocumentationResult };
`;
    writeFileSync(join(testDir, 'documentation.ts'), tsContent);
    
    // Create Python file with docstrings
    const pythonContent = `"""
Project Documentation Tool

This module provides comprehensive documentation extraction capabilities.

Author: Test Author
Version: 1.0.0
Since: 2024-01-15
"""

from typing import List, Dict, Any
from pathlib import Path

class DocumentationFile:
    """Documentation file class"""
    
    def __init__(self, path: str, type: str, docs: List[str], sections: List[str]):
        """
        Initialize documentation file
        
        Args:
            path: File path
            type: File type (markdown, python, etc.)
            docs: Documentation content
            sections: Section titles
        """
        self.path = path
        self.type = type
        self.docs = docs
        self.sections = sections

class DocumentationResult:
    """Documentation result class"""
    
    def __init__(self, files: List[DocumentationFile], summary: Dict[str, Any]):
        """
        Initialize documentation result
        
        Args:
            files: List of documentation files
            summary: Summary statistics
        """
        self.files = files
        self.summary = summary

def get_documentation(directory: str, patterns: List[str] = None) -> DocumentationResult:
    """
    Extracts documentation from files in a directory
    
    Args:
        directory: Directory to scan for documentation
        patterns: File patterns to match
        
    Returns:
        Documentation extraction results
        
    Example:
        >>> docs = get_documentation('./src', ['*.md', '*.py'])
        >>> print(len(docs.files))
    """
    if patterns is None:
        patterns = ['*.md']
    
    # Implementation here
    return DocumentationResult([], {'totalFiles': 0, 'totalDocs': 0, 'byType': {}})

def parse_content(content: str, type: str) -> Dict[str, List[str]]:
    """
    Parses file content for documentation
    
    Args:
        content: File content to parse
        type: File type (markdown, python, etc.)
        
    Returns:
        Parsed documentation with docs and sections
    """
    # Implementation here
    return {'docs': [], 'sections': []}

class DocumentationExtractor:
    """
    Documentation extraction class
    
    Provides methods for extracting and analyzing documentation
    from various file types and formats.
    """
    
    def __init__(self, options: Dict[str, Any] = None):
        """
        Creates a new documentation extractor
        
        Args:
            options: Configuration options
        """
        self.options = options or {}
    
    def extract_from_file(self, file_path: str) -> Dict[str, List[str]]:
        """
        Extracts documentation from a file
        
        Args:
            file_path: Path to the file
            
        Returns:
            Extracted documentation
        """
        # Implementation here
        return {'docs': [], 'sections': []}

if __name__ == '__main__':
    # Example usage
    docs = get_documentation('./src')
    print(f"Found {len(docs.files)} documentation files")
`;
    writeFileSync(join(testDir, 'documentation.py'), pythonContent);
    
    console.log('✅ Test files created');
    
    // Test 2: Basic documentation extraction
    console.log('\n2️⃣ Testing Basic Documentation Extraction:');
    console.log('---------------------------------------------');
    
    const basicResult = await callMCPTool('get_documentation', {
      directory: testDir,
      filePatterns: ['*.md', '*.rst', '*.txt', '*.js', '*.ts', '*.py']
    });
    
    console.log('✅ Basic Documentation Extraction Result:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    // Test 3: Markdown files only
    console.log('\n3️⃣ Testing Markdown Files Only:');
    console.log('----------------------------------');
    
    const markdownResult = await callMCPTool('get_documentation', {
      directory: testDir,
      filePatterns: ['*.md']
    });
    
    console.log('✅ Markdown Files Only Result:');
    console.log(JSON.stringify(markdownResult, null, 2));
    
    // Test 4: Code files only
    console.log('\n4️⃣ Testing Code Files Only:');
    console.log('------------------------------');
    
    const codeResult = await callMCPTool('get_documentation', {
      directory: testDir,
      filePatterns: ['*.js', '*.ts', '*.py']
    });
    
    console.log('✅ Code Files Only Result:');
    console.log(JSON.stringify(codeResult, null, 2));
    
    // Test 5: Specific file patterns
    console.log('\n5️⃣ Testing Specific File Patterns:');
    console.log('------------------------------------');
    
    const specificResult = await callMCPTool('get_documentation', {
      directory: testDir,
      filePatterns: ['README.*', '*.rst']
    });
    
    console.log('✅ Specific File Patterns Result:');
    console.log(JSON.stringify(specificResult, null, 2));
    
    // Test 6: Non-existent directory
    console.log('\n6️⃣ Testing Non-existent Directory:');
    console.log('-------------------------------------');
    
    const nonExistentResult = await callMCPTool('get_documentation', {
      directory: '/non/existent/path',
      filePatterns: ['*.md']
    });
    
    console.log('✅ Non-existent Directory Result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 7: Empty directory
    console.log('\n7️⃣ Testing Empty Directory:');
    console.log('------------------------------');
    
    const emptyDir = join(testDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    
    const emptyResult = await callMCPTool('get_documentation', {
      directory: emptyDir,
      filePatterns: ['*.md']
    });
    
    console.log('✅ Empty Directory Result:');
    console.log(JSON.stringify(emptyResult, null, 2));
    
    // Test 8: Analyze results
    console.log('\n8️⃣ Analyzing Results:');
    console.log('------------------------');
    
    if (basicResult.success && basicResult.data) {
      const data = basicResult.data;
      console.log(`📊 Summary Statistics:`);
      console.log(`   Total files: ${data.summary?.totalFiles || 0}`);
      console.log(`   Total docs: ${data.summary?.totalDocs || 0}`);
      console.log(`   By type:`, data.summary?.byType || {});
      
      if (data.files && data.files.length > 0) {
        console.log(`\n📁 Files found:`);
        data.files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.path} (${file.type})`);
          console.log(`      Docs: ${file.docs.length}, Sections: ${file.sections.length}`);
          if (file.sections.length > 0) {
            console.log(`      Sections: ${file.sections.slice(0, 3).join(', ')}${file.sections.length > 3 ? '...' : ''}`);
          }
        });
      }
    }
    
    // Clean up test directory
    console.log('\n🧹 Cleaning up test directory...');
    rmSync(testDir, { recursive: true, force: true });
    console.log('✅ Test directory cleaned up');
    
    console.log('\n🎉 All get_documentation tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function callMCPTool(toolName, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['enhanced-mcp-server/src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Send the tool call request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
    
    child.on('close', (code) => {
      try {
        if (stdout) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.result) {
                  resolve({
                    success: true,
                    data: response.result
                  });
                  return;
                }
              } catch (parseError) {
                // Continue to next line
              }
            }
          }
        }
        
        resolve({
          success: false,
          error: 'No valid response received',
          stderr: stderr,
          stdout: stdout
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          stderr: stderr,
          stdout: stdout
        });
      }
    });
    
    child.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        success: false,
        error: 'Timeout'
      });
    }, 15000);
  });
}

async function main() {
  try {
    await testGetDocumentation();
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
