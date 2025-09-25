/**
 * Test Automation Tools for MCP Server
 * 
 * This module provides implementations for test automation tools.
 * Includes framework detection, subprocess execution, and result parsing.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

// Types for test execution
interface TestExecutionResult {
  framework: 'jest' | 'pytest' | 'mocha';
  passed: number;
  failed: number;
  errors: string[];
  duration: number;
  output?: string;
  stderr?: string;
}

interface FrameworkDetectionResult {
  framework: 'jest' | 'pytest' | 'mocha' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

// Types for test run tracking
interface TestRun {
  runId: string;
  framework: 'jest' | 'pytest' | 'mocha';
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  progress: number;
  results?: TestExecutionResult;
  errors?: string[];
  directory: string;
  testPattern?: string;
  coverage: boolean;
  timeout: number;
}

// Types for coverage analysis
interface CoverageFile {
  file: string;
  covered: number;
  uncovered: number;
  coverage: number;
}

interface CoverageAnalysisResult {
  framework: string;
  coverage: number;
  files: CoverageFile[];
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number;
}

// In-memory storage for test runs
const testRuns = new Map<string, TestRun>();

/**
 * Create a new test run entry
 */
function createTestRun(
  framework: 'jest' | 'pytest' | 'mocha',
  directory: string,
  testPattern?: string,
  coverage: boolean = false,
  timeout: number = 60000
): TestRun {
  const runId = randomUUID();
  const testRun: TestRun = {
    runId,
    framework,
    startTime: Date.now(),
    status: 'running',
    progress: 0,
    directory,
    testPattern,
    coverage,
    timeout
  };
  
  testRuns.set(runId, testRun);
  return testRun;
}

/**
 * Update test run status
 */
function updateTestRun(
  runId: string,
  updates: Partial<Pick<TestRun, 'status' | 'progress' | 'results' | 'errors'>>
): void {
  const testRun = testRuns.get(runId);
  if (testRun) {
    Object.assign(testRun, updates);
    testRuns.set(runId, testRun);
  }
}

/**
 * Get test run by ID
 */
function getTestRun(runId: string): TestRun | undefined {
  return testRuns.get(runId);
}

/**
 * Clean up old test runs (older than 1 hour)
 */
function cleanupOldTestRuns(): void {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [runId, testRun] of testRuns.entries()) {
    if (testRun.startTime < oneHourAgo) {
      testRuns.delete(runId);
    }
  }
}

/**
 * Detect the test framework used in a project
 */
async function detectTestFramework(directory: string): Promise<FrameworkDetectionResult> {
  const evidence: string[] = [];
  let framework: 'jest' | 'pytest' | 'mocha' | 'unknown' = 'unknown';
  let confidence: 'high' | 'medium' | 'low' = 'low';

  try {
    const dirPath = resolve(directory);
    
    // Check for pytest
    if (existsSync(join(dirPath, 'pytest.ini'))) {
      framework = 'pytest';
      confidence = 'high';
      evidence.push('Found pytest.ini');
    } else if (existsSync(join(dirPath, 'conftest.py'))) {
      framework = 'pytest';
      confidence = 'high';
      evidence.push('Found conftest.py');
    } else if (existsSync(join(dirPath, 'pyproject.toml'))) {
      try {
        const pyprojectContent = readFileSync(join(dirPath, 'pyproject.toml'), 'utf-8');
        if (pyprojectContent.includes('[tool.pytest]') || pyprojectContent.includes('pytest')) {
          framework = 'pytest';
          confidence = 'medium';
          evidence.push('Found pytest configuration in pyproject.toml');
        }
      } catch (error) {
        // Ignore file read errors
      }
    }

    // Check for Jest
    if (!framework && existsSync(join(dirPath, 'package.json'))) {
      try {
        const packageJson = JSON.parse(readFileSync(join(dirPath, 'package.json'), 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (dependencies.jest) {
          framework = 'jest';
          confidence = 'high';
          evidence.push('Found jest in package.json dependencies');
        } else if (dependencies['@jest/core'] || dependencies['jest-cli']) {
          framework = 'jest';
          confidence = 'high';
          evidence.push('Found Jest packages in package.json');
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }

    // Check for Mocha
    if (!framework && existsSync(join(dirPath, 'package.json'))) {
      try {
        const packageJson = JSON.parse(readFileSync(join(dirPath, 'package.json'), 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (dependencies.mocha) {
          framework = 'mocha';
          confidence = 'high';
          evidence.push('Found mocha in package.json dependencies');
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }

    // Check for test scripts in package.json
    if (framework === 'unknown' && existsSync(join(dirPath, 'package.json'))) {
      try {
        const packageJson = JSON.parse(readFileSync(join(dirPath, 'package.json'), 'utf-8'));
        const scripts = packageJson.scripts || {};
        
        for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
          const command = String(scriptCommand).toLowerCase();
          if (command.includes('jest')) {
            framework = 'jest';
            confidence = 'medium';
            evidence.push(`Found jest in script: ${scriptName}`);
            break;
          } else if (command.includes('mocha')) {
            framework = 'mocha';
            confidence = 'medium';
            evidence.push(`Found mocha in script: ${scriptName}`);
            break;
          } else if (command.includes('pytest')) {
            framework = 'pytest';
            confidence = 'medium';
            evidence.push(`Found pytest in script: ${scriptName}`);
            break;
          }
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }

    // Check for additional evidence files
    if (framework === 'unknown') {
      // Check for common test file patterns
      const testFiles = [
        'test', 'tests', '__tests__', 'spec', 'specs'
      ];
      
      for (const testDir of testFiles) {
        if (existsSync(join(dirPath, testDir))) {
          evidence.push(`Found test directory: ${testDir}`);
          confidence = 'low';
        }
      }

      // Check for common test file extensions
      const testExtensions = ['.test.js', '.test.ts', '.spec.js', '.spec.ts', 'test_*.py'];
      for (const ext of testExtensions) {
        // This is a simplified check - in a real implementation, you'd use glob patterns
        evidence.push(`Looking for test files with pattern: ${ext}`);
      }
    }

  } catch (error) {
    evidence.push(`Error during detection: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { framework, confidence, evidence };
}

/**
 * Execute coverage analysis command
 */
async function executeCoverageAnalysis(
  framework: 'jest' | 'pytest' | 'mocha',
  directory: string,
  timeout: number = 60000
): Promise<CoverageAnalysisResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let command: string;
    let args: string[];

    // Build command based on framework
    switch (framework) {
      case 'jest':
        command = 'npx';
        args = ['jest', '--coverage', '--coverageReporters=json', '--coverageDirectory=coverage'];
        break;
      
      case 'pytest':
        command = 'python';
        args = ['-m', 'pytest', '--cov=.', '--cov-report=json', '--cov-report-file=coverage.json'];
        break;
      
      case 'mocha':
        command = 'npx';
        args = ['nyc', '--reporter=json', 'mocha'];
        break;
      
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }

    console.log(`[COVERAGE] Executing: ${command} ${args.join(' ')} in ${directory}`);

    const child = spawn(command, args, {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error('Coverage analysis timed out'));
      }
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      
      try {
        const result = parseCoverageResults(framework, stdout, stderr, directory);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse coverage results: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      reject(new Error(`Coverage analysis failed: ${error.message}`));
    });
  });
}

/**
 * Parse coverage results from framework output
 */
function parseCoverageResults(
  framework: 'jest' | 'pytest' | 'mocha',
  stdout: string,
  stderr: string,
  directory: string
): CoverageAnalysisResult {
  try {
    switch (framework) {
      case 'jest':
        return parseJestCoverage(stdout, stderr);
      case 'pytest':
        return parsePytestCoverage(stdout, stderr, directory);
      case 'mocha':
        return parseMochaCoverage(stdout, stderr);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  } catch (error) {
    // Return partial results with warning
    return {
      framework,
      coverage: 0,
      files: [],
      totalLines: 0,
      coveredLines: 0,
      uncoveredLines: 0,
    };
  }
}

/**
 * Parse Jest coverage results
 */
function parseJestCoverage(stdout: string, stderr: string): CoverageAnalysisResult {
  try {
    // Jest outputs coverage to stdout as JSON
    const coverageData = JSON.parse(stdout);
    
    const files: CoverageFile[] = [];
    let totalLines = 0;
    let coveredLines = 0;
    
    if (coverageData.coverageMap) {
      for (const [filePath, coverage] of Object.entries(coverageData.coverageMap)) {
        const fileCoverage = coverage as any;
        const statements = fileCoverage.s || {};
        const covered = Object.values(statements).filter((count: any) => count > 0).length;
        const total = Object.keys(statements).length;
        const fileCoveragePercent = total > 0 ? (covered / total) * 100 : 0;
        
        files.push({
          file: filePath,
          covered,
          uncovered: total - covered,
          coverage: fileCoveragePercent
        });
        
        totalLines += total;
        coveredLines += covered;
      }
    }
    
    const overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
    
    return {
      framework: 'jest',
      coverage: overallCoverage,
      files,
      totalLines,
      coveredLines,
      uncoveredLines: totalLines - coveredLines
    };
  } catch (error) {
    throw new Error(`Failed to parse Jest coverage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse Pytest coverage results
 */
function parsePytestCoverage(stdout: string, stderr: string, directory: string): CoverageAnalysisResult {
  try {
    // Pytest writes coverage to coverage.json file
    const coveragePath = join(directory, 'coverage.json');
    if (existsSync(coveragePath)) {
      const coverageData = JSON.parse(readFileSync(coveragePath, 'utf8'));
      
      const files: CoverageFile[] = [];
      let totalLines = 0;
      let coveredLines = 0;
      
      if (coverageData.files) {
        for (const [filePath, fileData] of Object.entries(coverageData.files)) {
          const file = fileData as any;
          const covered = file.executed_lines?.length || 0;
          const total = file.summary?.num_statements || 0;
          const fileCoveragePercent = total > 0 ? (covered / total) * 100 : 0;
          
          files.push({
            file: filePath,
            covered,
            uncovered: total - covered,
            coverage: fileCoveragePercent
          });
          
          totalLines += total;
          coveredLines += covered;
        }
      }
      
      const overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
      
      return {
        framework: 'pytest',
        coverage: overallCoverage,
        files,
        totalLines,
        coveredLines,
        uncoveredLines: totalLines - coveredLines
      };
    } else {
      throw new Error('Coverage file not found');
    }
  } catch (error) {
    throw new Error(`Failed to parse Pytest coverage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse Mocha coverage results
 */
function parseMochaCoverage(stdout: string, stderr: string): CoverageAnalysisResult {
  try {
    // Mocha with nyc outputs coverage to stdout as JSON
    const coverageData = JSON.parse(stdout);
    
    const files: CoverageFile[] = [];
    let totalLines = 0;
    let coveredLines = 0;
    
    if (coverageData.files) {
      for (const [filePath, fileData] of Object.entries(coverageData.files)) {
        const file = fileData as any;
        const covered = file.s?.filter((count: any) => count > 0).length || 0;
        const total = file.s?.length || 0;
        const fileCoveragePercent = total > 0 ? (covered / total) * 100 : 0;
        
        files.push({
          file: filePath,
          covered,
          uncovered: total - covered,
          coverage: fileCoveragePercent
        });
        
        totalLines += total;
        coveredLines += covered;
      }
    }
    
    const overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
    
    return {
      framework: 'mocha',
      coverage: overallCoverage,
      files,
      totalLines,
      coveredLines,
      uncoveredLines: totalLines - coveredLines
    };
  } catch (error) {
    throw new Error(`Failed to parse Mocha coverage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute test command for a specific file
 */
async function executeTestFile(
  framework: 'jest' | 'pytest' | 'mocha',
  directory: string,
  filePath: string,
  coverage: boolean = false,
  timeout: number = 30000
): Promise<TestExecutionResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let command: string;
    let args: string[];

    // Build command based on framework
    switch (framework) {
      case 'jest':
        command = 'npx';
        args = ['jest', filePath, '--json'];
        if (coverage) {
          args.push('--coverage', '--coverageReporters', 'json');
        }
        break;
      
      case 'pytest':
        command = 'python';
        args = ['-m', 'pytest', filePath, '-q', '--tb=short'];
        if (coverage) {
          args.push('--cov', '--cov-report=json');
        }
        break;
      
      case 'mocha':
        command = 'npx';
        args = ['mocha', filePath, '--reporter', 'json'];
        break;
      
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }

    console.log(`[TEST_FILE] Executing: ${command} ${args.join(' ')} in ${directory}`);

    const child = spawn(command, args, {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error('Test file execution timed out'));
      }
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      
      try {
        const result = parseTestResults(framework, stdout, stderr, code || 0, duration);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse test results: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      reject(new Error(`Test file execution failed: ${error.message}`));
    });
  });
}

/**
 * Execute test command with subprocess
 */
async function executeTestCommand(
  framework: 'jest' | 'pytest' | 'mocha',
  directory: string,
  testPattern?: string,
  coverage: boolean = false,
  timeout: number = 60000,
  runId?: string
): Promise<TestExecutionResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let command: string;
    let args: string[];

    // Build command based on framework
    switch (framework) {
      case 'jest':
        command = 'npx';
        args = ['jest', '--json', '--no-coverage'];
        if (testPattern) {
          args.push('--testNamePattern', testPattern);
        }
        if (coverage) {
          args.push('--coverage', '--coverageReporters', 'json');
        }
        break;
      
      case 'pytest':
        command = 'python';
        args = ['-m', 'pytest', '-q', '--tb=short'];
        if (testPattern) {
          args.push('-k', testPattern);
        }
        if (coverage) {
          args.push('--cov', '--cov-report=json');
        }
        break;
      
      case 'mocha':
        command = 'npx';
        args = ['mocha', '--reporter', 'json'];
        if (testPattern) {
          args.push('--grep', testPattern);
        }
        break;
      
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }

    console.log(`[TEST] Executing: ${command} ${args.join(' ')} in ${directory}`);

    const child = spawn(command, args, {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        
        // Update test run with timeout
        if (runId) {
          updateTestRun(runId, {
            status: 'timeout',
            progress: 100,
            errors: ['Test execution timed out']
          });
        }
        
        reject(new Error('Test execution timed out'));
      }
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      
      // Update progress based on output (simplified progress tracking)
      if (runId) {
        const progress = Math.min(90, Math.floor((Date.now() - startTime) / timeout * 100));
        updateTestRun(runId, { progress });
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      
      try {
        const result = parseTestResults(framework, stdout, stderr, code || 0, duration);
        
        // Update test run with completion
        if (runId) {
          updateTestRun(runId, {
            status: 'completed',
            progress: 100,
            results: result
          });
        }
        
        resolve(result);
      } catch (error) {
        // Update test run with failure
        if (runId) {
          updateTestRun(runId, {
            status: 'failed',
            progress: 100,
            errors: [`Failed to parse test results: ${error instanceof Error ? error.message : String(error)}`]
          });
        }
        
        reject(new Error(`Failed to parse test results: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      
      // Update test run with failure
      if (runId) {
        updateTestRun(runId, {
          status: 'failed',
          progress: 100,
          errors: [`Test execution failed: ${error.message}`]
        });
      }
      
      reject(new Error(`Test execution failed: ${error.message}`));
    });
  });
}

/**
 * Parse test results from framework output
 */
function parseTestResults(
  framework: 'jest' | 'pytest' | 'mocha',
  stdout: string,
  stderr: string,
  exitCode: number,
  duration: number
): TestExecutionResult {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  try {
    switch (framework) {
      case 'jest': {
        const result = JSON.parse(stdout);
        passed = result.numPassedTests || 0;
        failed = result.numFailedTests || 0;
        
        if (result.testResults) {
          result.testResults.forEach((test: any) => {
            if (test.status === 'failed' && test.failureMessages) {
              errors.push(...test.failureMessages);
            }
          });
        }
        break;
      }
      
      case 'pytest': {
        // Parse pytest output (not JSON by default, but we can extract info)
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes(' passed')) {
            const match = line.match(/(\d+) passed/);
            if (match) passed = parseInt(match[1]);
          }
          if (line.includes(' failed')) {
            const match = line.match(/(\d+) failed/);
            if (match) failed = parseInt(match[1]);
          }
        }
        
        // Extract errors from stderr
        if (stderr) {
          const errorLines = stderr.split('\n').filter(line => 
            line.includes('FAILED') || line.includes('ERROR')
          );
          errors.push(...errorLines);
        }
        break;
      }
      
      case 'mocha': {
        const result = JSON.parse(stdout);
        if (result.stats) {
          passed = result.stats.passes || 0;
          failed = result.stats.failures || 0;
        }
        
        if (result.failures) {
          result.failures.forEach((failure: any) => {
            if (failure.err && failure.err.message) {
              errors.push(failure.err.message);
            }
          });
        }
        break;
      }
    }
  } catch (error) {
    // If JSON parsing fails, try to extract basic info from output
    console.warn(`Failed to parse ${framework} output:`, error);
    
    // Fallback: count based on exit code and output
    if (exitCode === 0) {
      passed = 1; // Assume at least one test passed
      failed = 0;
    } else {
      passed = 0;
      failed = 1; // Assume at least one test failed
      errors.push('Failed to parse test results');
    }
  }

  return {
    framework,
    passed,
    failed,
    errors,
    duration,
    output: stdout,
    stderr: stderr
  };
}

/**
 * Create test automation tools with real implementations
 */
export function createTestTools(): Tool[] {
  return [
    {
      name: 'run_tests',
      description: 'Run tests using auto-detected or specified test framework (Jest, Mocha, Vitest, pytest)',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to run tests in',
            default: '.',
          },
          testPattern: {
            type: 'string',
            description: 'Pattern to filter tests (e.g., "user", "*.integration.*")',
          },
          framework: {
            type: 'string',
            description: 'Test framework to use',
            enum: ['jest', 'mocha', 'vitest', 'pytest', 'auto'],
            default: 'auto',
          },
          coverage: {
            type: 'boolean',
            description: 'Whether to collect test coverage',
            default: false,
          },
          timeout: {
            type: 'number',
            description: 'Test execution timeout in milliseconds',
            default: 30000,
            minimum: 1000,
            maximum: 300000,
          },
        },
        required: [],
      },
    },

    {
      name: 'detect_test_framework',
      description: 'Detect the test framework used in a project',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze',
            default: '.',
          },
        },
        required: [],
      },
    },

    {
      name: 'get_test_status',
      description: 'Get status of running tests',
      inputSchema: {
        type: 'object',
        properties: {
          runId: {
            type: 'string',
            description: 'The runId of the test run to check status for',
          },
        },
        required: ['runId'],
      },
    },

    {
      name: 'run_test_file',
      description: 'Run tests in a specific test file',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to run tests in',
            default: '.',
          },
          filePath: {
            type: 'string',
            description: 'Path to the test file to run',
          },
          framework: {
            type: 'string',
            description: 'Test framework to use',
            enum: ['jest', 'mocha', 'pytest', 'auto'],
            default: 'auto',
          },
          timeout: {
            type: 'number',
            description: 'Test execution timeout in milliseconds',
            default: 30000,
            minimum: 1000,
            maximum: 300000,
          },
          coverage: {
            type: 'boolean',
            description: 'Whether to collect test coverage',
            default: false,
          },
        },
        required: ['filePath'],
      },
    },

    {
      name: 'test_coverage_analysis',
      description: 'Analyze test coverage and generate reports',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze coverage for',
            default: '.',
          },
          framework: {
            type: 'string',
            description: 'Test framework to use',
            enum: ['jest', 'mocha', 'pytest', 'auto'],
            default: 'auto',
          },
          timeout: {
            type: 'number',
            description: 'Test execution timeout in milliseconds',
            default: 60000,
            minimum: 1000,
            maximum: 300000,
          },
        },
        required: [],
      },
    },
  ];
}

/**
 * Handle test automation tool requests
 */
export async function handleTestTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  try {
    switch (toolName) {
      case 'run_tests': {
        const runArgs = args as any;
        const directory = runArgs.directory || '.';
        const testPattern = runArgs.testPattern;
        const framework = runArgs.framework || 'auto';
        const coverage = runArgs.coverage || false;
        const timeout = runArgs.timeout || 60000;

        try {
          // Clean up old test runs
          cleanupOldTestRuns();
          
          // Detect framework if auto
          let detectedFramework: 'jest' | 'pytest' | 'mocha';
          
          if (framework === 'auto') {
            const detection = await detectTestFramework(directory);
            if (detection.framework === 'unknown') {
              return createSafeResult('run_tests', {
                error: 'No test framework detected',
                message: 'Could not detect test framework. Please specify framework manually or ensure project has test configuration.',
                evidence: detection.evidence,
                framework: 'unknown',
                confidence: detection.confidence,
              }, 'No test framework found');
            }
            detectedFramework = detection.framework as 'jest' | 'pytest' | 'mocha';
          } else {
            detectedFramework = framework as 'jest' | 'pytest' | 'mocha';
          }

          // Create test run entry
          const testRun = createTestRun(
            detectedFramework,
            directory,
            testPattern,
            coverage,
            timeout
          );

          // Execute tests with runId tracking
          const result = await executeTestCommand(
            detectedFramework,
            directory,
            testPattern,
            coverage,
            timeout,
            testRun.runId
          );

          return createSafeResult('run_tests', {
            runId: testRun.runId,
            framework: result.framework,
            passed: result.passed,
            failed: result.failed,
            errors: result.errors,
            duration: result.duration,
            success: result.failed === 0,
            message: `Tests completed: ${result.passed} passed, ${result.failed} failed`,
            // TODO: Add coverage integration when coverage is enabled
            // coverage: coverage ? await parseCoverageReport(detectedFramework, directory) : undefined,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('timed out')) {
            return createSafeResult('run_tests', {
              error: 'Test execution timed out',
              message: `Tests exceeded timeout of ${timeout}ms`,
              framework: framework === 'auto' ? 'unknown' : framework,
            }, 'Test execution timeout');
          } else {
            return createSafeResult('run_tests', {
              error: 'Test execution failed',
              message: errorMessage,
              framework: framework === 'auto' ? 'unknown' : framework,
            }, errorMessage);
          }
        }
      }

      case 'detect_test_framework': {
        const detectArgs = args as any;
        const directory = detectArgs.directory || '.';

        try {
          const detection = await detectTestFramework(directory);
          
          return createSafeResult('detect_test_framework', {
            framework: detection.framework,
            confidence: detection.confidence,
            evidence: detection.evidence,
            message: detection.framework !== 'unknown'
              ? `Detected ${detection.framework} test framework with ${detection.confidence} confidence`
              : 'No test framework detected',
            success: detection.framework !== 'unknown',
          });
        } catch (error) {
          return createSafeResult('detect_test_framework', {
            framework: 'unknown',
            confidence: 'low',
            evidence: [`Detection error: ${error instanceof Error ? error.message : String(error)}`],
            error: 'Framework detection failed',
            message: error instanceof Error ? error.message : String(error),
          }, 'Detection error');
        }
      }

      case 'get_test_status': {
        const statusArgs = args as any;
        const runId = statusArgs.runId;

        if (!runId) {
          return createSafeResult('get_test_status', {
            error: 'runId is required',
            message: 'Please provide a runId to check test status',
          }, 'Missing runId parameter');
        }

        try {
          const testRun = getTestRun(runId);
          
          if (!testRun) {
            return createSafeResult('get_test_status', {
              error: 'Unknown runId',
              message: `No test run found with runId: ${runId}`,
              runId,
            }, 'Unknown runId');
          }

          // Clean up old test runs
          cleanupOldTestRuns();

          return createSafeResult('get_test_status', {
            runId: testRun.runId,
            framework: testRun.framework,
            status: testRun.status,
            progress: testRun.progress,
            results: testRun.results,
            errors: testRun.errors,
            startTime: testRun.startTime,
            duration: Date.now() - testRun.startTime,
            message: `Test run ${testRun.status} - ${testRun.progress}% complete`,
          });

        } catch (error) {
          return createSafeResult('get_test_status', {
            error: 'Failed to get test status',
            message: error instanceof Error ? error.message : String(error),
            runId,
          }, 'Status retrieval error');
        }
      }

      case 'run_test_file': {
        const fileArgs = args as any;
        const directory = fileArgs.directory || '.';
        const filePath = fileArgs.filePath;
        const framework = fileArgs.framework || 'auto';
        const timeout = fileArgs.timeout || 30000;
        const coverage = fileArgs.coverage || false;

        if (!filePath) {
          return createSafeResult('run_test_file', {
            error: 'filePath is required',
            message: 'Please provide a filePath to run tests for',
          }, 'Missing filePath parameter');
        }

        try {
          // Validate file exists
          const fullPath = join(resolve(directory), filePath);
          if (!existsSync(fullPath)) {
            return createSafeResult('run_test_file', {
              error: 'File not found',
              message: `Test file not found: ${filePath}`,
              filePath,
              directory,
            }, 'File not found');
          }

          // Detect framework if auto
          let detectedFramework: 'jest' | 'pytest' | 'mocha';
          
          if (framework === 'auto') {
            const detection = await detectTestFramework(directory);
            if (detection.framework === 'unknown') {
              return createSafeResult('run_test_file', {
                error: 'No test framework detected',
                message: 'Could not detect test framework. Please specify framework manually.',
                evidence: detection.evidence,
                filePath,
                directory,
              }, 'No test framework found');
            }
            detectedFramework = detection.framework as 'jest' | 'pytest' | 'mocha';
          } else {
            detectedFramework = framework as 'jest' | 'pytest' | 'mocha';
          }

          // Execute test file
          const result = await executeTestFile(
            detectedFramework,
            directory,
            filePath,
            coverage,
            timeout
          );

          return createSafeResult('run_test_file', {
            framework: result.framework,
            filePath: filePath,
            passed: result.passed,
            failed: result.failed,
            errors: result.errors,
            duration: result.duration,
            success: result.failed === 0,
            message: `Test file ${filePath} completed: ${result.passed} passed, ${result.failed} failed`,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('timed out')) {
            return createSafeResult('run_test_file', {
              error: 'Test file execution timed out',
              message: `Test file ${filePath} exceeded timeout of ${timeout}ms`,
              filePath,
              framework: framework === 'auto' ? 'unknown' : framework,
            }, 'Test file execution timeout');
          } else if (errorMessage.includes('Unsupported framework')) {
            return createSafeResult('run_test_file', {
              error: 'Unsupported framework',
              message: `Framework ${framework} is not supported for file execution`,
              filePath,
              framework,
            }, 'Unsupported framework');
          } else {
            return createSafeResult('run_test_file', {
              error: 'Test file execution failed',
              message: errorMessage,
              filePath,
              framework: framework === 'auto' ? 'unknown' : framework,
            }, errorMessage);
          }
        }
      }

      case 'test_coverage_analysis': {
        const coverageArgs = args as any;
        const directory = coverageArgs.directory || '.';
        const framework = coverageArgs.framework || 'auto';
        const timeout = coverageArgs.timeout || 60000;

        try {
          // Detect framework if auto
          let detectedFramework: 'jest' | 'pytest' | 'mocha';
          
          if (framework === 'auto') {
            const detection = await detectTestFramework(directory);
            if (detection.framework === 'unknown') {
              return createSafeResult('test_coverage_analysis', {
                error: 'No test framework detected',
                message: 'Could not detect test framework. Please specify framework manually.',
                evidence: detection.evidence,
                directory,
              }, 'No test framework found');
            }
            detectedFramework = detection.framework as 'jest' | 'pytest' | 'mocha';
          } else {
            detectedFramework = framework as 'jest' | 'pytest' | 'mocha';
          }

          // Execute coverage analysis
          const result = await executeCoverageAnalysis(
            detectedFramework,
            directory,
            timeout
          );

          return createSafeResult('test_coverage_analysis', {
            framework: result.framework,
            coverage: result.coverage,
            files: result.files,
            totalLines: result.totalLines,
            coveredLines: result.coveredLines,
            uncoveredLines: result.uncoveredLines,
            message: `Coverage analysis completed: ${result.coverage.toFixed(2)}% overall coverage`,
            summary: {
              overallCoverage: result.coverage,
              totalFiles: result.files.length,
              filesWithFullCoverage: result.files.filter(f => f.coverage === 100).length,
              filesWithNoCoverage: result.files.filter(f => f.coverage === 0).length
            }
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('timed out')) {
            return createSafeResult('test_coverage_analysis', {
              error: 'Coverage analysis timed out',
              message: `Coverage analysis exceeded timeout of ${timeout}ms`,
              directory,
              framework: framework === 'auto' ? 'unknown' : framework,
            }, 'Coverage analysis timeout');
          } else if (errorMessage.includes('Unsupported framework')) {
            return createSafeResult('test_coverage_analysis', {
              error: 'Unsupported framework',
              message: `Framework ${framework} is not supported for coverage analysis`,
              directory,
              framework,
            }, 'Unsupported framework');
          } else if (errorMessage.includes('Failed to parse')) {
            return createSafeResult('test_coverage_analysis', {
              error: 'Coverage parsing failed',
              message: `Failed to parse coverage results: ${errorMessage}`,
              directory,
              framework: framework === 'auto' ? 'unknown' : framework,
              warning: 'Partial results may be available'
            }, 'Coverage parsing error');
          } else {
            return createSafeResult('test_coverage_analysis', {
              error: 'Coverage analysis failed',
              message: errorMessage,
              directory,
              framework: framework === 'auto' ? 'unknown' : framework,
            }, errorMessage);
          }
        }
      }

      default:
        return createSafeResult(
          toolName,
          undefined,
          `Unknown test tool: ${toolName}`
        );
    }
  } catch (error) {
    return createSafeResult(
      toolName,
      undefined,
      error instanceof Error ? error.message : String(error)
    );
  }
}
