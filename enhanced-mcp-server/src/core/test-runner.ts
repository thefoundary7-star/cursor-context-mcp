/**
 * Test framework integration with support for Jest, Mocha, Vitest, and pytest
 */

import { spawn, ChildProcess } from 'child_process';
import { readdir, readFile, stat } from 'fs/promises';
import { resolve, extname, join } from 'path';
import which from 'which';
import { EventEmitter } from 'events';

import { PathValidator } from '../utils/path-validation.js';
import { PerformanceMonitor, withPerformanceMonitoring } from '../performance/monitor.js';
import type {
  TestResult,
  TestFrameworkResult,
  CoverageReport,
  ConfigurationOptions,
  ToolResponse,
} from '../types/index.js';
import { validateSchema, createSafeResult, RunTestsArgsSchema } from '../types/schemas.js';

type TestFramework = 'jest' | 'mocha' | 'vitest' | 'pytest' | 'auto';

interface TestFrameworkInfo {
  name: string;
  command: string;
  args: string[];
  configFiles: string[];
  testPatterns: string[];
  coverageSupport: boolean;
}

const FRAMEWORK_CONFIGS: Record<TestFramework, TestFrameworkInfo | null> = {
  jest: {
    name: 'Jest',
    command: 'npx',
    args: ['jest'],
    configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
    testPatterns: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}', '**/__tests__/**/*.{js,ts}'],
    coverageSupport: true,
  },
  mocha: {
    name: 'Mocha',
    command: 'npx',
    args: ['mocha'],
    configFiles: ['.mocharc.json', '.mocharc.js', 'mocha.opts'],
    testPatterns: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}', '**/test/**/*.{js,ts}'],
    coverageSupport: false, // Requires nyc
  },
  vitest: {
    name: 'Vitest',
    command: 'npx',
    args: ['vitest'],
    configFiles: ['vitest.config.js', 'vitest.config.ts', 'vite.config.js', 'vite.config.ts'],
    testPatterns: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    coverageSupport: true,
  },
  pytest: {
    name: 'pytest',
    command: 'python',
    args: ['-m', 'pytest'],
    configFiles: ['pytest.ini', 'pyproject.toml', 'tox.ini', 'setup.cfg'],
    testPatterns: ['**/*_test.py', '**/test_*.py', '**/tests/**/*.py'],
    coverageSupport: true, // With pytest-cov
  },
  auto: null, // Will be detected automatically
};

export class TestRunner extends EventEmitter {
  private pathValidator: PathValidator;
  private performanceMonitor: PerformanceMonitor;
  private config: ConfigurationOptions;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(
    config: ConfigurationOptions,
    performanceMonitor: PerformanceMonitor
  ) {
    super();
    this.config = config;
    this.pathValidator = new PathValidator(config);
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Run tests in the specified directory
   */
  async runTests(args: unknown): Promise<ToolResponse<TestFrameworkResult>> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'runTests',
      async () => {
        try {
          const validArgs = validateSchema(RunTestsArgsSchema, args, 'runTests');
          const { directory, testPattern, framework, coverage, timeout } = validArgs;

          // Validate directory
          const validDirectory = await this.pathValidator.validateDirectory(directory || '.');

          // Detect or validate framework
          const detectedFramework = framework === 'auto'
            ? await this.detectTestFramework(validDirectory)
            : framework;

          if (!detectedFramework || detectedFramework === 'auto') {
            return createSafeResult(
              'runTests',
              undefined,
              'No test framework detected. Please specify a framework or ensure test configuration files exist.'
            );
          }

          const frameworkInfo = FRAMEWORK_CONFIGS[detectedFramework];
          if (!frameworkInfo) {
            return createSafeResult(
              'runTests',
              undefined,
              `Unsupported test framework: ${detectedFramework}`
            );
          }

          // Check if framework command is available
          const isAvailable = await this.checkFrameworkAvailability(frameworkInfo);
          if (!isAvailable) {
            return createSafeResult(
              'runTests',
              undefined,
              `Test framework command not found: ${frameworkInfo.command}. Please ensure it's installed.`
            );
          }

          // Run tests
          const result = await this.executeTests(
            validDirectory,
            frameworkInfo,
            {
              testPattern,
              coverage: coverage || false,
              timeout: timeout || 30000,
            }
          );

          this.emit('testsCompleted', {
            framework: detectedFramework,
            directory: validDirectory,
            totalTests: result.totalTests,
            passed: result.passed,
            failed: result.failed,
          });

          return createSafeResult('runTests', result, undefined, {
            framework: detectedFramework,
            directory: validDirectory,
            duration: result.duration,
          });
        } catch (error) {
          return createSafeResult(
            'runTests',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );
  }

  /**
   * Detect test framework in directory
   */
  async detectTestFramework(directory: string): Promise<TestFramework | null> {
    try {
      const files = await readdir(directory);
      const packageJsonPath = join(directory, 'package.json');

      // Check for package.json scripts and dependencies
      try {
        const packageContent = await readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageContent);

        // Check dependencies
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (allDeps.vitest) return 'vitest';
        if (allDeps.jest || allDeps['@jest/core']) return 'jest';
        if (allDeps.mocha) return 'mocha';

        // Check scripts
        const scripts = packageJson.scripts || {};
        for (const [scriptName, scriptValue] of Object.entries(scripts)) {
          if (typeof scriptValue === 'string') {
            if (scriptValue.includes('vitest')) return 'vitest';
            if (scriptValue.includes('jest')) return 'jest';
            if (scriptValue.includes('mocha')) return 'mocha';
          }
        }
      } catch {
        // package.json not found or invalid, continue with file detection
      }

      // Check for configuration files
      for (const [framework, info] of Object.entries(FRAMEWORK_CONFIGS)) {
        if (framework === 'auto' || !info) continue;

        for (const configFile of info.configFiles) {
          if (files.includes(configFile)) {
            return framework as TestFramework;
          }
        }
      }

      // Check for test files and patterns
      const testFiles = await this.findTestFiles(directory);

      if (testFiles.some(f => f.endsWith('_test.py') || f.includes('test_'))) {
        return 'pytest';
      }

      if (testFiles.length > 0) {
        // Default to Jest for JavaScript/TypeScript projects
        return 'jest';
      }

      return null;
    } catch (error) {
      console.error('Error detecting test framework:', error);
      return null;
    }
  }

  /**
   * Find test files in directory
   */
  private async findTestFiles(directory: string): Promise<string[]> {
    const testFiles: string[] = [];

    const scanDirectory = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 3) return; // Limit recursion depth

      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip common non-test directories
            if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
              continue;
            }
            await scanDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = extname(entry.name);
            const baseName = entry.name.toLowerCase();

            // Check for test patterns
            if (
              baseName.includes('test') ||
              baseName.includes('spec') ||
              dir.includes('test') ||
              dir.includes('__tests__')
            ) {
              if (['.js', '.ts', '.py', '.jsx', '.tsx'].includes(ext)) {
                testFiles.push(fullPath);
              }
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await scanDirectory(directory);
    return testFiles;
  }

  /**
   * Check if test framework is available
   */
  private async checkFrameworkAvailability(framework: TestFrameworkInfo): Promise<boolean> {
    try {
      if (framework.command === 'npx') {
        // Check if npx is available
        await which('npx');
        return true;
      } else {
        // Check if command is available
        await which(framework.command);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Execute tests with the specified framework
   */
  private async executeTests(
    directory: string,
    framework: TestFrameworkInfo,
    options: {
      testPattern?: string;
      coverage: boolean;
      timeout: number;
    }
  ): Promise<TestFrameworkResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Build command arguments
      const args = [...framework.args];

      // Add test pattern if specified
      if (options.testPattern) {
        if (framework.name === 'pytest') {
          args.push('-k', options.testPattern);
        } else {
          args.push('--testPathPattern', options.testPattern);
        }
      }

      // Add coverage if supported and requested
      if (options.coverage && framework.coverageSupport) {
        if (framework.name === 'pytest') {
          args.push('--cov=.', '--cov-report=json');
        } else if (framework.name === 'Jest') {
          args.push('--coverage', '--coverageReporters=json');
        } else if (framework.name === 'Vitest') {
          args.push('--coverage', '--coverage.reporter=json');
        }
      }

      // Add JSON output for parsing
      if (framework.name === 'Jest') {
        args.push('--json');
      } else if (framework.name === 'pytest') {
        args.push('--json-report', '--json-report-file=/dev/stdout');
      } else if (framework.name === 'Vitest') {
        args.push('--reporter=json');
      }

      // Spawn child process
      const childProcess = spawn(framework.command, args, {
        cwd: directory,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CI: 'true' }, // Force CI mode for better output
      });

      const processId = `test_${Date.now()}`;
      this.runningProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error(`Test execution timed out after ${options.timeout}ms`));
      }, options.timeout);

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(processId);

        const duration = Date.now() - startTime;

        try {
          // Parse test results based on framework
          const result = this.parseTestOutput(framework.name, stdout, stderr, code || 0);
          result.duration = duration;

          // Parse coverage if available
          if (options.coverage && framework.coverageSupport) {
            result.coverage = this.parseCoverageOutput(framework.name, directory);
          }

          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse test output: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(processId);
        reject(error);
      });

      this.emit('testStarted', {
        framework: framework.name,
        directory,
        processId,
      });
    });
  }

  /**
   * Parse test output based on framework
   */
  private parseTestOutput(
    frameworkName: string,
    stdout: string,
    stderr: string,
    exitCode: number
  ): TestFrameworkResult {
    const defaultResult: TestFrameworkResult = {
      framework: frameworkName,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [],
    };

    try {
      if (frameworkName === 'Jest') {
        return this.parseJestOutput(stdout, stderr);
      } else if (frameworkName === 'pytest') {
        return this.parsePytestOutput(stdout, stderr);
      } else if (frameworkName === 'Vitest') {
        return this.parseVitestOutput(stdout, stderr);
      } else {
        // Generic parser for other frameworks
        return this.parseGenericOutput(frameworkName, stdout, stderr, exitCode);
      }
    } catch (error) {
      console.error(`Error parsing ${frameworkName} output:`, error);
      return defaultResult;
    }
  }

  /**
   * Parse Jest JSON output
   */
  private parseJestOutput(stdout: string, stderr: string): TestFrameworkResult {
    try {
      // Jest outputs JSON to stdout when --json flag is used
      const jsonMatch = stdout.match(/\{[\s\S]*\}$/m);
      if (!jsonMatch) {
        throw new Error('No JSON output found');
      }

      const jestResult = JSON.parse(jsonMatch[0]);
      const results: TestResult[] = [];

      // Parse test suites
      for (const testSuite of jestResult.testResults || []) {
        for (const test of testSuite.assertionResults || []) {
          results.push({
            testName: test.title || test.fullName,
            status: test.status === 'passed' ? 'passed' : test.status === 'pending' ? 'skipped' : 'failed',
            duration: test.duration || 0,
            errorMessage: test.failureMessages?.join('\n'),
            filePath: testSuite.name,
          });
        }
      }

      return {
        framework: 'Jest',
        totalTests: jestResult.numTotalTests || 0,
        passed: jestResult.numPassedTests || 0,
        failed: jestResult.numFailedTests || 0,
        skipped: jestResult.numPendingTests || 0,
        duration: 0, // Will be set by caller
        results,
      };
    } catch (error) {
      throw new Error(`Failed to parse Jest output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse pytest JSON output
   */
  private parsePytestOutput(stdout: string, stderr: string): TestFrameworkResult {
    try {
      // Look for JSON report in stdout
      const jsonMatch = stdout.match(/\{[\s\S]*"tests"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON output found in pytest output');
      }

      const pytestResult = JSON.parse(jsonMatch[0]);
      const results: TestResult[] = [];

      // Parse tests
      for (const test of pytestResult.tests || []) {
        results.push({
          testName: test.nodeid || test.name,
          status: test.outcome === 'passed' ? 'passed' : test.outcome === 'skipped' ? 'skipped' : 'failed',
          duration: test.duration || 0,
          errorMessage: test.call?.longrepr,
          filePath: test.file,
          stdout: test.stdout,
          stderr: test.stderr,
        });
      }

      const summary = pytestResult.summary || {};

      return {
        framework: 'pytest',
        totalTests: summary.total || results.length,
        passed: summary.passed || 0,
        failed: summary.failed || 0,
        skipped: summary.skipped || 0,
        duration: 0, // Will be set by caller
        results,
      };
    } catch (error) {
      throw new Error(`Failed to parse pytest output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Vitest JSON output
   */
  private parseVitestOutput(stdout: string, stderr: string): TestFrameworkResult {
    try {
      // Vitest outputs JSON lines, get the final summary
      const lines = stdout.split('\n').filter(line => line.trim());
      const jsonLines = lines.filter(line => {
        try {
          JSON.parse(line);
          return true;
        } catch {
          return false;
        }
      });

      if (jsonLines.length === 0) {
        throw new Error('No JSON output found');
      }

      // Get the last JSON line which should be the summary
      const finalResult = JSON.parse(jsonLines[jsonLines.length - 1]);
      const results: TestResult[] = [];

      // Parse test files
      for (const file of finalResult.testResults || []) {
        for (const test of file.assertionResults || []) {
          results.push({
            testName: test.title,
            status: test.status === 'passed' ? 'passed' : test.status === 'pending' ? 'skipped' : 'failed',
            duration: test.duration || 0,
            errorMessage: test.failureMessages?.join('\n'),
            filePath: file.name,
          });
        }
      }

      return {
        framework: 'Vitest',
        totalTests: finalResult.numTotalTests || 0,
        passed: finalResult.numPassedTests || 0,
        failed: finalResult.numFailedTests || 0,
        skipped: finalResult.numPendingTests || 0,
        duration: 0, // Will be set by caller
        results,
      };
    } catch (error) {
      throw new Error(`Failed to parse Vitest output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generic parser for other frameworks
   */
  private parseGenericOutput(
    frameworkName: string,
    stdout: string,
    stderr: string,
    exitCode: number
  ): TestFrameworkResult {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Very basic parsing - look for common patterns
    const lines = (stdout + '\n' + stderr).split('\n');

    for (const line of lines) {
      // Look for test result patterns
      if (line.includes('✓') || line.includes('PASS') || line.includes('OK')) {
        passed++;
      } else if (line.includes('✗') || line.includes('FAIL') || line.includes('ERROR')) {
        failed++;
      } else if (line.includes('SKIP') || line.includes('PENDING')) {
        skipped++;
      }
    }

    return {
      framework: frameworkName,
      totalTests: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration: 0,
      results,
    };
  }

  /**
   * Parse coverage output (placeholder)
   */
  private parseCoverageOutput(frameworkName: string, directory: string): CoverageReport | undefined {
    // This would parse coverage.json files generated by the test frameworks
    // Implementation would depend on the specific coverage format
    return undefined;
  }

  /**
   * Stop a running test process
   */
  stopTests(processId?: string): boolean {
    if (processId) {
      const process = this.runningProcesses.get(processId);
      if (process) {
        process.kill('SIGTERM');
        this.runningProcesses.delete(processId);
        return true;
      }
      return false;
    } else {
      // Stop all running tests
      for (const [id, process] of this.runningProcesses) {
        process.kill('SIGTERM');
        this.runningProcesses.delete(id);
      }
      return true;
    }
  }

  /**
   * Get running test processes
   */
  getRunningTests(): string[] {
    return Array.from(this.runningProcesses.keys());
  }
}

export default TestRunner;