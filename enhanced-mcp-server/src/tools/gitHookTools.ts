/**
 * Git Hook Integration tools for Enhanced MCP Server
 * Provides pre-commit, pre-push, and commit-msg hook support
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { existsSync, writeFileSync, readFileSync, statSync, chmodSync } from 'fs';
import { join } from 'path';
import { handleCITool } from './ciTools.js';
import { handleDevTool } from './devTools.js';

/**
 * Git hook types
 */
type HookType = 'pre-commit' | 'pre-push' | 'commit-msg' | 'post-commit';

interface HookConfig {
  type: HookType;
  enabled: boolean;
  checks: {
    healthGate: boolean;
    linting: boolean;
    tests: boolean;
    security: boolean;
    documentation: boolean;
  };
  thresholds: {
    healthScore: number;
    testCoverage: number;
    securityScore: number;
  };
  autoFix: boolean;
  skipOnBypass: boolean;
}

interface HookResult {
  passed: boolean;
  checks: {
    healthGate: { passed: boolean; score?: number; message?: string };
    linting: { passed: boolean; errors?: number; warnings?: number; message?: string };
    tests: { passed: boolean; failed?: number; message?: string };
    security: { passed: boolean; vulnerabilities?: number; message?: string };
    documentation: { passed: boolean; coverage?: number; message?: string };
  };
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    duration: number;
  };
  recommendations: string[];
}

/**
 * Create Git Hook tools
 */
export function createGitHookTools(): Tool[] {
  return [
    {
      name: 'setup_git_hooks',
      description: 'Setup Git hooks with Enhanced MCP Server integration',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Git repository directory (default: current directory)',
            default: '.'
          },
          hooks: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['pre-commit', 'pre-push', 'commit-msg', 'post-commit']
            },
            description: 'Git hooks to setup',
            default: ['pre-commit', 'pre-push']
          },
          config: {
            type: 'object',
            description: 'Hook configuration',
            properties: {
              healthGate: { type: 'boolean', default: true },
              linting: { type: 'boolean', default: true },
              tests: { type: 'boolean', default: true },
              security: { type: 'boolean', default: false },
              documentation: { type: 'boolean', default: false },
              autoFix: { type: 'boolean', default: false },
              thresholds: {
                type: 'object',
                properties: {
                  healthScore: { type: 'number', default: 70, minimum: 0, maximum: 100 },
                  testCoverage: { type: 'number', default: 80, minimum: 0, maximum: 100 },
                  securityScore: { type: 'number', default: 90, minimum: 0, maximum: 100 }
                }
              }
            }
          },
          backup: {
            type: 'boolean',
            description: 'Backup existing hooks',
            default: true
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          hooks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                file: { type: 'string' },
                installed: { type: 'boolean' },
                executable: { type: 'boolean' }
              }
            }
          },
          config: { type: 'object' },
          message: { type: 'string' }
        }
      }
    },
    {
      name: 'run_pre_commit_checks',
      description: 'Run pre-commit checks manually (same as pre-commit hook)',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to check (default: current directory)',
            default: '.'
          },
          config: {
            type: 'object',
            description: 'Check configuration',
            properties: {
              healthGate: { type: 'boolean', default: true },
              linting: { type: 'boolean', default: true },
              tests: { type: 'boolean', default: true },
              security: { type: 'boolean', default: false },
              documentation: { type: 'boolean', default: false },
              autoFix: { type: 'boolean', default: false },
              thresholds: {
                type: 'object',
                properties: {
                  healthScore: { type: 'number', default: 70 },
                  testCoverage: { type: 'number', default: 80 },
                  securityScore: { type: 'number', default: 90 }
                }
              }
            }
          },
          bypass: {
            type: 'boolean',
            description: 'Bypass checks (for testing)',
            default: false
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              passed: { type: 'boolean' },
              checks: { type: 'object' },
              summary: { type: 'object' },
              recommendations: { type: 'array', items: { type: 'string' } }
            }
          },
          message: { type: 'string' }
        }
      }
    },
    {
      name: 'remove_git_hooks',
      description: 'Remove Enhanced MCP Server Git hooks',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Git repository directory (default: current directory)',
            default: '.'
          },
          hooks: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['pre-commit', 'pre-push', 'commit-msg', 'post-commit']
            },
            description: 'Hooks to remove',
            default: ['pre-commit', 'pre-push']
          },
          restore: {
            type: 'boolean',
            description: 'Restore backed up hooks',
            default: true
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          removed: {
            type: 'array',
            items: { type: 'string' }
          },
          restored: {
            type: 'array',
            items: { type: 'string' }
          },
          message: { type: 'string' }
        }
      }
    }
  ];
}

/**
 * Handle Git Hook tool calls
 */
export async function handleGitHookTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'setup_git_hooks': {
      const setupArgs = args as any;
      const directory = setupArgs.directory || '.';
      const hooks = setupArgs.hooks || ['pre-commit', 'pre-push'];
      const config = setupArgs.config || {};
      const backup = setupArgs.backup !== false;

      try {
        console.log(`[GIT_HOOKS] Setting up Git hooks for ${directory}`);
        
        // Check if directory is a Git repository
        if (!existsSync(join(directory, '.git'))) {
          return createSafeResult('setup_git_hooks', {
            hooks: [],
            config: {},
            message: 'Not a Git repository'
          }, 'Not a Git repository');
        }

        const gitHooksDir = join(directory, '.git', 'hooks');
        const results = [];

        for (const hookType of hooks) {
          const hookFile = join(gitHooksDir, hookType);
          
          // Backup existing hook if it exists
          if (backup && existsSync(hookFile)) {
            const backupFile = `${hookFile}.backup.${Date.now()}`;
            writeFileSync(backupFile, readFileSync(hookFile, 'utf-8'));
            console.log(`[GIT_HOOKS] Backed up existing ${hookType} hook to ${backupFile}`);
          }

          // Generate hook content
          const hookContent = generateHookContent(hookType, config);
          
          // Write hook file
          writeFileSync(hookFile, hookContent, 'utf-8');
          
          // Make executable
          chmodSync(hookFile, '755');
          
          results.push({
            type: hookType,
            file: hookFile,
            installed: true,
            executable: true
          });
          
          console.log(`[GIT_HOOKS] Installed ${hookType} hook`);
        }

        // Save configuration
        const configFile = join(directory, '.mcp-hooks.json');
        writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
        
        console.log(`[GIT_HOOKS] Git hooks setup complete`);
        
        return createSafeResult('setup_git_hooks', {
          hooks: results,
          config,
          message: `Successfully installed ${results.length} Git hooks`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[GIT_HOOKS] Error: ${errorMessage}`);
        
        return createSafeResult('setup_git_hooks', {
          hooks: [],
          config: {},
          message: `Git hooks setup failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    case 'run_pre_commit_checks': {
      const checkArgs = args as any;
      const directory = checkArgs.directory || '.';
      const config = checkArgs.config || {};
      const bypass = checkArgs.bypass || false;

      try {
        console.log(`[PRE_COMMIT] Running pre-commit checks for ${directory}`);
        
        if (bypass) {
          console.log(`[PRE_COMMIT] Bypassing checks (bypass=true)`);
          return createSafeResult('run_pre_commit_checks', {
            result: {
              passed: true,
              checks: {},
              summary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, duration: 0 },
              recommendations: []
            },
            message: 'Checks bypassed'
          });
        }

        const startTime = Date.now();
        const result: HookResult = {
          passed: true,
          checks: {
            healthGate: { passed: true },
            linting: { passed: true },
            tests: { passed: true },
            security: { passed: true },
            documentation: { passed: true }
          },
          summary: {
            totalChecks: 0,
            passedChecks: 0,
            failedChecks: 0,
            duration: 0
          },
          recommendations: []
        };

        // Health Gate Check
        if (config.healthGate !== false) {
          console.log(`[PRE_COMMIT] Running health gate check...`);
          const healthResult = await handleCITool('ci_health_gate', {
            threshold: config.thresholds?.healthScore || 70,
            projectPath: directory,
            includeTests: config.tests !== false,
            includeLint: config.linting !== false,
            includeDependencies: config.security !== false,
            includeDocs: config.documentation !== false
          });

          if (healthResult.success && healthResult.data) {
            const healthData = healthResult.data as any;
            result.checks.healthGate = {
              passed: healthData.passed,
              score: healthData.healthScore,
              message: healthData.passed ? 'Health gate passed' : `Health score ${healthData.healthScore} below threshold`
            };
            
            if (!healthData.passed) {
              result.passed = false;
              result.recommendations.push(...(healthData.recommendations || []));
            }
          } else {
            result.checks.healthGate = { passed: false, message: 'Health gate check failed' };
            result.passed = false;
          }
          result.summary.totalChecks++;
          if (result.checks.healthGate.passed) result.summary.passedChecks++;
          else result.summary.failedChecks++;
        }

        // Linting Check
        if (config.linting !== false) {
          console.log(`[PRE_COMMIT] Running linting check...`);
          const lintResult = await handleDevTool('code_quality_metrics', {
            directory,
            includeFunctions: true,
            includeClasses: true
          });

          if (lintResult.success && lintResult.data) {
            const lintData = lintResult.data as any;
            const hasIssues = lintData.issues && lintData.issues.length > 0;
            result.checks.linting = {
              passed: !hasIssues,
              errors: lintData.issues?.filter((i: any) => i.type === 'error').length || 0,
              warnings: lintData.issues?.filter((i: any) => i.type === 'warning').length || 0,
              message: hasIssues ? `${lintData.issues.length} linting issues found` : 'No linting issues'
            };
            
            if (hasIssues) {
              result.passed = false;
              result.recommendations.push('Fix linting issues before committing');
            }
          } else {
            result.checks.linting = { passed: false, message: 'Linting check failed' };
            result.passed = false;
          }
          result.summary.totalChecks++;
          if (result.checks.linting.passed) result.summary.passedChecks++;
          else result.summary.failedChecks++;
        }

        // Test Check
        if (config.tests !== false) {
          console.log(`[PRE_COMMIT] Running test check...`);
          const testResult = await handleDevTool('run_tests', { directory });

          if (testResult.success && testResult.data) {
            const testData = testResult.data as any;
            const hasFailures = testData.failed > 0;
            result.checks.tests = {
              passed: !hasFailures,
              failed: testData.failed,
              message: hasFailures ? `${testData.failed} tests failed` : 'All tests passed'
            };
            
            if (hasFailures) {
              result.passed = false;
              result.recommendations.push('Fix failing tests before committing');
            }
          } else {
            result.checks.tests = { passed: false, message: 'Test check failed' };
            result.passed = false;
          }
          result.summary.totalChecks++;
          if (result.checks.tests.passed) result.summary.passedChecks++;
          else result.summary.failedChecks++;
        }

        // Security Check
        if (config.security === true) {
          console.log(`[PRE_COMMIT] Running security check...`);
          const securityResult = await handleCITool('security_audit', { directory });

          if (securityResult.success && securityResult.data) {
            const securityData = securityResult.data as any;
            const hasVulnerabilities = securityData.vulnerabilities && securityData.vulnerabilities.length > 0;
            result.checks.security = {
              passed: !hasVulnerabilities,
              vulnerabilities: securityData.vulnerabilities?.length || 0,
              message: hasVulnerabilities ? `${securityData.vulnerabilities.length} vulnerabilities found` : 'No security issues'
            };
            
            if (hasVulnerabilities) {
              result.passed = false;
              result.recommendations.push('Address security vulnerabilities before committing');
            }
          } else {
            result.checks.security = { passed: false, message: 'Security check failed' };
            result.passed = false;
          }
          result.summary.totalChecks++;
          if (result.checks.security.passed) result.summary.passedChecks++;
          else result.summary.failedChecks++;
        }

        // Documentation Check
        if (config.documentation === true) {
          console.log(`[PRE_COMMIT] Running documentation check...`);
          const docResult = await handleDevTool('documentation_coverage', { directory });

          if (docResult.success && docResult.data) {
            const docData = docResult.data as any;
            const coverage = docData.coverage?.overall || 0;
            const threshold = config.thresholds?.docCoverage || 80;
            const passed = coverage >= threshold;
            result.checks.documentation = {
              passed,
              coverage,
              message: passed ? `Documentation coverage ${coverage}% is sufficient` : `Documentation coverage ${coverage}% below threshold ${threshold}%`
            };
            
            if (!passed) {
              result.passed = false;
              result.recommendations.push('Improve documentation coverage before committing');
            }
          } else {
            result.checks.documentation = { passed: false, message: 'Documentation check failed' };
            result.passed = false;
          }
          result.summary.totalChecks++;
          if (result.checks.documentation.passed) result.summary.passedChecks++;
          else result.summary.failedChecks++;
        }

        result.summary.duration = Date.now() - startTime;
        
        console.log(`[PRE_COMMIT] Pre-commit checks completed: ${result.passed ? 'PASSED' : 'FAILED'}`);
        
        return createSafeResult('run_pre_commit_checks', {
          result,
          message: `Pre-commit checks ${result.passed ? 'passed' : 'failed'}: ${result.summary.passedChecks}/${result.summary.totalChecks} checks passed`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[PRE_COMMIT] Error: ${errorMessage}`);
        
        return createSafeResult('run_pre_commit_checks', {
          result: {
            passed: false,
            checks: {},
            summary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, duration: 0 },
            recommendations: [`Pre-commit checks failed: ${errorMessage}`]
          },
          message: `Pre-commit checks failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    case 'remove_git_hooks': {
      const removeArgs = args as any;
      const directory = removeArgs.directory || '.';
      const hooks = removeArgs.hooks || ['pre-commit', 'pre-push'];
      const restore = removeArgs.restore !== false;

      try {
        console.log(`[GIT_HOOKS] Removing Git hooks from ${directory}`);
        
        const gitHooksDir = join(directory, '.git', 'hooks');
        const removed = [];
        const restored = [];

        for (const hookType of hooks) {
          const hookFile = join(gitHooksDir, hookType);
          
          if (existsSync(hookFile)) {
            // Check if it's our hook
            const content = readFileSync(hookFile, 'utf-8');
            if (content.includes('Enhanced MCP Server')) {
              // Remove our hook
              writeFileSync(hookFile, '', 'utf-8');
              removed.push(hookType);
              console.log(`[GIT_HOOKS] Removed ${hookType} hook`);
              
              // Restore backup if it exists
              if (restore) {
                const backupFile = `${hookFile}.backup.${Date.now()}`;
                const backupFiles = require('fs').readdirSync(gitHooksDir)
                  .filter((f: string) => f.startsWith(`${hookType}.backup.`));
                
                if (backupFiles.length > 0) {
                  const latestBackup = backupFiles.sort().pop();
                  const backupPath = join(gitHooksDir, latestBackup);
                  const backupContent = readFileSync(backupPath, 'utf-8');
                  writeFileSync(hookFile, backupContent, 'utf-8');
                  chmodSync(hookFile, '755');
                  restored.push(hookType);
                  console.log(`[GIT_HOOKS] Restored ${hookType} hook from backup`);
                }
              }
            }
          }
        }

        // Remove configuration file
        const configFile = join(directory, '.mcp-hooks.json');
        if (existsSync(configFile)) {
          require('fs').unlinkSync(configFile);
        }
        
        console.log(`[GIT_HOOKS] Git hooks removal complete`);
        
        return createSafeResult('remove_git_hooks', {
          removed,
          restored,
          message: `Removed ${removed.length} Git hooks${restored.length > 0 ? `, restored ${restored.length} from backup` : ''}`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[GIT_HOOKS] Error: ${errorMessage}`);
        
        return createSafeResult('remove_git_hooks', {
          removed: [],
          restored: [],
          message: `Git hooks removal failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown Git Hook tool: ${toolName}`);
  }
}

/**
 * Generate Git hook content
 */
function generateHookContent(hookType: HookType, config: any): string {
  const hookScript = `#!/bin/bash
# Enhanced MCP Server Git Hook
# Generated: ${new Date().toISOString()}

set -e

# Configuration
DIRECTORY="$(pwd)"
CONFIG_FILE=".mcp-hooks.json"

# Load configuration if exists
if [ -f "$CONFIG_FILE" ]; then
    CONFIG=$(cat "$CONFIG_FILE")
else
    CONFIG='{"healthGate":true,"linting":true,"tests":true,"security":false,"documentation":false}'
fi

# Run Enhanced MCP Server checks
echo "🔍 Running Enhanced MCP Server ${hookType} checks..."

# Use npx to run the MCP server tool
npx @filebridge/enhanced-mcp-server run_pre_commit_checks \\
    --directory "$DIRECTORY" \\
    --config "$CONFIG" \\
    --bypass false

if [ $? -eq 0 ]; then
    echo "✅ All ${hookType} checks passed!"
    exit 0
else
    echo "❌ ${hookType} checks failed!"
    echo "💡 Run 'npx @filebridge/enhanced-mcp-server run_pre_commit_checks' for details"
    exit 1
fi
`;

  return hookScript;
}
