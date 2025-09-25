/**
 * Test execution and framework integration tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { TestRunner } from '../core/test-runner.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';

export function createTestTools(testRunner: TestRunner): Tool[] {
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
      name: 'list_test_files',
      description: 'Find and list test files in a directory',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to search for test files',
            default: '.',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to search recursively',
            default: true,
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
        properties: {},
        required: [],
      },
    },

    {
      name: 'stop_tests',
      description: 'Stop running test processes',
      inputSchema: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Specific process ID to stop (optional, stops all if not provided)',
          },
        },
        required: [],
      },
    },
  ];
}

export async function handleTestTool(
  toolName: string,
  args: unknown,
  testRunner: TestRunner
): Promise<ToolResponse> {
  try {
    switch (toolName) {
      case 'run_tests':
        return await testRunner.runTests(args);

      case 'detect_test_framework': {
        const detectArgs = args as any;
        const directory = detectArgs.directory || '.';

        const framework = await testRunner.detectTestFramework(directory);

        return createSafeResult('detect_test_framework', {
          directory,
          detectedFramework: framework,
          available: framework !== null,
        }, undefined, {
          message: framework
            ? `Detected ${framework} test framework`
            : 'No test framework detected',
        });
      }

      case 'list_test_files': {
        const listArgs = args as any;
        const directory = listArgs.directory || '.';
        const recursive = listArgs.recursive !== false;

        // This would be implemented similar to the private findTestFiles method
        // For now, return a placeholder
        return createSafeResult('list_test_files', {
          directory,
          testFiles: [],
          count: 0,
        }, undefined, {
          message: 'Test file listing not yet implemented',
        });
      }

      case 'get_test_status': {
        const runningTests = testRunner.getRunningTests();

        return createSafeResult('get_test_status', {
          runningTests,
          count: runningTests.length,
          hasRunning: runningTests.length > 0,
        });
      }

      case 'stop_tests': {
        const stopArgs = args as any;
        const processId = stopArgs.processId;

        const stopped = testRunner.stopTests(processId);

        return createSafeResult('stop_tests', {
          stopped,
          processId: processId || 'all',
        }, undefined, {
          message: stopped
            ? `Successfully stopped ${processId ? 'test process' : 'all test processes'}`
            : 'No tests were running or process not found',
        });
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