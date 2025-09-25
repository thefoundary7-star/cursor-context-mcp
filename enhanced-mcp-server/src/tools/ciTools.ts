/**
 * CI/CD Integration tools for Enhanced MCP Server
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { existsSync } from 'fs';
import { handleDevTool } from './devTools.js';
import { handleTestTool } from './testTools.js';
import { handleSecurityTool } from './securityTools.js';
import { handleDocumentationTool } from './documentationTools.js';

/**
 * Create CI/CD Integration tools
 */
export function createCITools(): Tool[] {
  return [
    {
      name: 'ci_health_gate',
      description: 'Run project_health_check + code_quality_metrics before CI/CD deploys',
      inputSchema: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Minimum health score threshold to pass (0-100)',
            minimum: 0,
            maximum: 100,
            default: 70
          },
          projectPath: {
            type: 'string',
            description: 'Path to the project directory to check',
            default: '.'
          },
          includeTests: {
            type: 'boolean',
            description: 'Include test results in health check',
            default: true
          },
          includeLint: {
            type: 'boolean',
            description: 'Include linting results in health check',
            default: true
          },
          includeDependencies: {
            type: 'boolean',
            description: 'Include dependency analysis in health check',
            default: true
          },
          includeDocs: {
            type: 'boolean',
            description: 'Include documentation coverage in health check',
            default: true
          },
          failOnWarnings: {
            type: 'boolean',
            description: 'Fail the gate if warnings are found',
            default: false
          }
        },
        required: ['threshold']
      },
      outputSchema: {
        type: 'object',
        properties: {
          passed: { type: 'boolean' },
          healthScore: { type: 'number' },
          threshold: { type: 'number' },
          breakdown: {
            type: 'object',
            properties: {
              tests: {
                type: 'object',
                properties: {
                  passed: { type: 'number' },
                  failed: { type: 'number' },
                  score: { type: 'number' }
                }
              },
              lint: {
                type: 'object',
                properties: {
                  errors: { type: 'number' },
                  warnings: { type: 'number' },
                  score: { type: 'number' }
                }
              },
              dependencies: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  vulnerable: { type: 'number' },
                  score: { type: 'number' }
                }
              },
              documentation: {
                type: 'object',
                properties: {
                  coverage: { type: 'number' },
                  score: { type: 'number' }
                }
              }
            }
          },
          failures: {
            type: 'array',
            items: { type: 'string' }
          },
          warnings: {
            type: 'array',
            items: { type: 'string' }
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' }
          },
          timestamp: { type: 'string' },
          projectPath: { type: 'string' }
        }
      }
    },
    {
      name: 'generate_project_report',
      description: 'Unified report for managers and devs aggregating tests, docs, code quality, and security',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          format: {
            type: 'string',
            enum: ['markdown', 'html', 'json'],
            description: 'Output format for the report',
            default: 'markdown'
          },
          includeTests: {
            type: 'boolean',
            description: 'Include test results in report',
            default: true
          },
          includeSecurity: {
            type: 'boolean',
            description: 'Include security analysis in report',
            default: true
          },
          includeQuality: {
            type: 'boolean',
            description: 'Include code quality metrics in report',
            default: true
          },
          includeDocs: {
            type: 'boolean',
            description: 'Include documentation analysis in report',
            default: true
          },
          includeTrends: {
            type: 'boolean',
            description: 'Include trend analysis in report',
            default: false
          },
          outputFile: {
            type: 'string',
            description: 'Output file path (optional, will generate if not provided)'
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          report: {
            type: 'object',
            properties: {
              summary: {
                type: 'object',
                properties: {
                  overallHealth: { type: 'number' },
                  testCoverage: { type: 'number' },
                  codeQuality: { type: 'number' },
                  securityScore: { type: 'number' },
                  docCoverage: { type: 'number' }
                }
              },
              sections: {
                type: 'object',
                properties: {
                  tests: { type: 'object' },
                  security: { type: 'object' },
                  quality: { type: 'object' },
                  documentation: { type: 'object' },
                  trends: { type: 'object' }
                }
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' }
              },
              generatedAt: { type: 'string' },
              projectPath: { type: 'string' }
            }
          },
          outputFile: { type: 'string' },
          format: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  ];
}

/**
 * Handle CI tool calls
 */
export async function handleCITool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'ci_health_gate': {
      const gateArgs = args as any;
      const threshold = gateArgs.threshold || 70;
      const projectPath = gateArgs.projectPath || '.';
      const includeTests = gateArgs.includeTests !== false;
      const includeLint = gateArgs.includeLint !== false;
      const includeDependencies = gateArgs.includeDependencies !== false;
      const includeDocs = gateArgs.includeDocs !== false;
      const failOnWarnings = gateArgs.failOnWarnings || false;

      try {
        console.log(`[CI_HEALTH_GATE] Starting health gate check for ${projectPath} with threshold ${threshold}`);
        
        // Check if directory exists
        if (!existsSync(projectPath)) {
          return createSafeResult('ci_health_gate', {
            passed: false,
            healthScore: 0,
            threshold,
            breakdown: {},
            failures: [`Directory ${projectPath} does not exist`],
            warnings: [],
            recommendations: ['Ensure the project path is correct'],
            timestamp: new Date().toISOString(),
            projectPath
          }, 'Directory not found');
        }

        // Run project health check
        const healthResult = await handleDevTool('project_health_check', {
          directory: projectPath,
          includeTests,
          includeLint,
          includeDependencies,
          includeDocs
        });

        if (!healthResult.success) {
          return createSafeResult('ci_health_gate', {
            passed: false,
            healthScore: 0,
            threshold,
            breakdown: {},
            failures: ['Health check failed to execute'],
            warnings: [],
            recommendations: ['Fix health check issues and retry'],
            timestamp: new Date().toISOString(),
            projectPath
          }, 'Health check execution failed');
        }

        const healthData = healthResult.data as any;
        const healthScore = healthData.healthScore || 0;
        const breakdown = healthData.breakdown || {};
        const recommendations = healthData.recommendations || [];

        // Determine if the gate passes
        const passed = healthScore >= threshold;
        
        // Collect failures and warnings
        const failures: string[] = [];
        const warnings: string[] = [];

        if (!passed) {
          failures.push(`Health score ${healthScore} is below threshold ${threshold}`);
        }

        // Check individual components for failures
        if (includeTests && breakdown.tests) {
          if (breakdown.tests.failed > 0) {
            failures.push(`${breakdown.tests.failed} test(s) failed`);
          }
          if (breakdown.tests.score < 80) {
            warnings.push(`Test score is low: ${breakdown.tests.score}/100`);
          }
        }

        if (includeLint && breakdown.lint) {
          if (breakdown.lint.errors > 0) {
            failures.push(`${breakdown.lint.errors} linting error(s) found`);
          }
          if (breakdown.lint.warnings > 0 && failOnWarnings) {
            failures.push(`${breakdown.lint.warnings} linting warning(s) found`);
          } else if (breakdown.lint.warnings > 5) {
            warnings.push(`${breakdown.lint.warnings} linting warning(s) found`);
          }
        }

        if (includeDependencies && breakdown.dependencies) {
          if (breakdown.dependencies.vulnerable > 0) {
            failures.push(`${breakdown.dependencies.vulnerable} vulnerable dependency(ies) found`);
          }
          if (breakdown.dependencies.score < 90) {
            warnings.push(`Dependency score is low: ${breakdown.dependencies.score}/100`);
          }
        }

        if (includeDocs && breakdown.documentation) {
          if (breakdown.documentation.coverage < 50) {
            warnings.push(`Documentation coverage is low: ${breakdown.documentation.coverage}%`);
          }
        }

        console.log(`[CI_HEALTH_GATE] Gate ${passed ? 'PASSED' : 'FAILED'}: ${healthScore}/${threshold}`);
        
        return createSafeResult('ci_health_gate', {
          passed,
          healthScore,
          threshold,
          breakdown,
          failures,
          warnings,
          recommendations,
          timestamp: new Date().toISOString(),
          projectPath
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[CI_HEALTH_GATE] Error: ${errorMessage}`);
        
        return createSafeResult('ci_health_gate', {
          passed: false,
          healthScore: 0,
          threshold,
          breakdown: {},
          failures: [`Health gate check failed: ${errorMessage}`],
          warnings: [],
          recommendations: ['Fix the error and retry the health gate'],
          timestamp: new Date().toISOString(),
          projectPath
        }, errorMessage);
      }
    }

    case 'generate_project_report': {
      const reportArgs = args as any;
      const directory = reportArgs.directory || '.';
      const format = reportArgs.format || 'markdown';
      const includeTests = reportArgs.includeTests !== false;
      const includeSecurity = reportArgs.includeSecurity !== false;
      const includeQuality = reportArgs.includeQuality !== false;
      const includeDocs = reportArgs.includeDocs !== false;
      const includeTrends = reportArgs.includeTrends || false;
      const outputFile = reportArgs.outputFile;

      try {
        console.log(`[GENERATE_PROJECT_REPORT] Starting report generation for ${directory} in ${format} format`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('generate_project_report', {
            report: {
              summary: { overallHealth: 0, testCoverage: 0, codeQuality: 0, securityScore: 0, docCoverage: 0 },
              sections: {},
              recommendations: ['Ensure the project path is correct'],
              generatedAt: new Date().toISOString(),
              projectPath: directory
            },
            outputFile: '',
            format,
            message: 'Directory not found'
          }, 'Directory not found');
        }

        // Collect data from various tools
        const reportData: any = {
          summary: {
            overallHealth: 0,
            testCoverage: 0,
            codeQuality: 0,
            securityScore: 0,
            docCoverage: 0
          },
          sections: {},
          recommendations: [],
          generatedAt: new Date().toISOString(),
          projectPath: directory
        };

        // 1. Health Check
        console.log(`[GENERATE_PROJECT_REPORT] Running health check...`);
        const healthResult = await handleDevTool('project_health_check', {
          directory,
          includeTests,
          includeLint: true,
          includeDependencies: includeSecurity,
          includeDocs
        });

        if (healthResult.success && healthResult.data) {
          const healthData = healthResult.data as any;
          reportData.summary.overallHealth = healthData.healthScore || 0;
          reportData.sections.health = healthData;
          reportData.recommendations.push(...(healthData.recommendations || []));
        }

        // 2. Test Results
        if (includeTests) {
          console.log(`[GENERATE_PROJECT_REPORT] Running test analysis...`);
          const testResult = await handleTestTool('run_tests', { directory });
          
          if (testResult.success && testResult.data) {
            const testData = testResult.data as any;
            reportData.summary.testCoverage = testData.coverage || 0;
            reportData.sections.tests = testData;
          }
        }

        // 3. Security Analysis
        if (includeSecurity) {
          console.log(`[GENERATE_PROJECT_REPORT] Running security analysis...`);
          const securityResult = await handleSecurityTool('security_audit', { directory });
          
          if (securityResult.success && securityResult.data) {
            const securityData = securityResult.data as any;
            reportData.summary.securityScore = securityData.score || 0;
            reportData.sections.security = securityData;
          }
        }

        // 4. Code Quality
        if (includeQuality) {
          console.log(`[GENERATE_PROJECT_REPORT] Running code quality analysis...`);
          const qualityResult = await handleDevTool('code_quality_metrics', { directory });
          
          if (qualityResult.success && qualityResult.data) {
            const qualityData = qualityResult.data as any;
            reportData.summary.codeQuality = qualityData.overall?.maintainabilityIndex || 0;
            reportData.sections.quality = qualityData;
          }
        }

        // 5. Documentation
        if (includeDocs) {
          console.log(`[GENERATE_PROJECT_REPORT] Running documentation analysis...`);
          const docResult = await handleDocumentationTool('documentation_coverage', { directory });
          
          if (docResult.success && docResult.data) {
            const docData = docResult.data as any;
            reportData.summary.docCoverage = docData.coverage?.overall || 0;
            reportData.sections.documentation = docData;
          }
        }

        // 6. Trends (if requested)
        if (includeTrends) {
          console.log(`[GENERATE_PROJECT_REPORT] Running trend analysis...`);
          const trendResult = await handleDevTool('project_trend_tracking', { 
            action: 'get',
            limit: 10
          });
          
          if (trendResult.success && trendResult.data) {
            reportData.sections.trends = trendResult.data;
          }
        }

        // Generate the report file
        let generatedFile = '';
        if (outputFile || format !== 'json') {
          generatedFile = await generateReportFile(reportData, directory, format, outputFile);
        }

        console.log(`[GENERATE_PROJECT_REPORT] Report generation completed`);
        
        return createSafeResult('generate_project_report', {
          report: reportData,
          outputFile: generatedFile,
          format,
          message: `Project report generated successfully in ${format} format`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[GENERATE_PROJECT_REPORT] Error: ${errorMessage}`);
        
        return createSafeResult('generate_project_report', {
          report: {
            summary: { overallHealth: 0, testCoverage: 0, codeQuality: 0, securityScore: 0, docCoverage: 0 },
            sections: {},
            recommendations: [`Report generation failed: ${errorMessage}`],
            generatedAt: new Date().toISOString(),
            projectPath: directory
          },
          outputFile: '',
          format,
          message: `Report generation failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown CI tool: ${toolName}`);
  }
}

/**
 * Generate report file in the specified format
 */
async function generateReportFile(
  reportData: any,
  directory: string,
  format: string,
  outputFile?: string
): Promise<string> {
  const { writeFileSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  
  // Determine output file path
  let filePath = outputFile;
  if (!filePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `project-report-${timestamp}.${format === 'html' ? 'html' : format === 'json' ? 'json' : 'md'}`;
    filePath = join(directory, 'reports', fileName);
  }

  // Ensure output directory exists
  const outputDir = join(filePath, '..');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let content = '';

  switch (format) {
    case 'markdown':
      content = generateMarkdownReport(reportData);
      break;
    case 'html':
      content = generateHTMLReport(reportData);
      break;
    case 'json':
      content = JSON.stringify(reportData, null, 2);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Write the file
  writeFileSync(filePath, content, 'utf-8');
  console.log(`[GENERATE_PROJECT_REPORT] Report written to: ${filePath}`);
  
  return filePath;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(reportData: any): string {
  let content = '# Project Report\n\n';
  content += `**Generated:** ${reportData.generatedAt}\n`;
  content += `**Project Path:** ${reportData.projectPath}\n\n`;

  // Summary section
  content += '## Summary\n\n';
  content += '| Metric | Score |\n';
  content += '|--------|-------|\n';
  content += `| Overall Health | ${reportData.summary.overallHealth}/100 |\n`;
  content += `| Test Coverage | ${reportData.summary.testCoverage}% |\n`;
  content += `| Code Quality | ${reportData.summary.codeQuality}/100 |\n`;
  content += `| Security Score | ${reportData.summary.securityScore}/100 |\n`;
  content += `| Documentation | ${reportData.summary.docCoverage}% |\n\n`;

  // Health section
  if (reportData.sections.health) {
    content += '## Health Check\n\n';
    const health = reportData.sections.health;
    content += `**Overall Score:** ${health.healthScore}/100\n\n`;
    
    if (health.breakdown) {
      content += '### Breakdown\n\n';
      if (health.breakdown.tests) {
        content += `- **Tests:** ${health.breakdown.tests.passed} passed, ${health.breakdown.tests.failed} failed (${health.breakdown.tests.score}/100)\n`;
      }
      if (health.breakdown.lint) {
        content += `- **Linting:** ${health.breakdown.lint.errors} errors, ${health.breakdown.lint.warnings} warnings (${health.breakdown.lint.score}/100)\n`;
      }
      if (health.breakdown.dependencies) {
        content += `- **Dependencies:** ${health.breakdown.dependencies.total} total, ${health.breakdown.dependencies.vulnerable} vulnerable (${health.breakdown.dependencies.score}/100)\n`;
      }
      if (health.breakdown.documentation) {
        content += `- **Documentation:** ${health.breakdown.documentation.coverage}% coverage (${health.breakdown.documentation.score}/100)\n`;
      }
    }
    content += '\n';
  }

  // Test section
  if (reportData.sections.tests) {
    content += '## Test Results\n\n';
    const tests = reportData.sections.tests;
    content += `**Status:** ${tests.passed} passed, ${tests.failed} failed\n`;
    content += `**Coverage:** ${tests.coverage || 0}%\n\n`;
  }

  // Security section
  if (reportData.sections.security) {
    content += '## Security Analysis\n\n';
    const security = reportData.sections.security;
    content += `**Score:** ${security.score}/100\n`;
    if (security.vulnerabilities) {
      content += `**Vulnerabilities:** ${security.vulnerabilities.length} found\n`;
    }
    content += '\n';
  }

  // Quality section
  if (reportData.sections.quality) {
    content += '## Code Quality\n\n';
    const quality = reportData.sections.quality;
    if (quality.overall) {
      content += `**Maintainability Index:** ${quality.overall.maintainabilityIndex}/100\n`;
      content += `**Average Complexity:** ${quality.overall.avgComplexity}\n`;
      content += `**Duplication Rate:** ${quality.overall.duplicationRate}%\n`;
    }
    content += '\n';
  }

  // Documentation section
  if (reportData.sections.documentation) {
    content += '## Documentation\n\n';
    const docs = reportData.sections.documentation;
    if (docs.coverage) {
      content += `**Overall Coverage:** ${docs.coverage.overall}%\n`;
      content += `**Functions:** ${docs.coverage.functions.documented}/${docs.coverage.functions.total} (${docs.coverage.functions.coverage}%)\n`;
      content += `**Classes:** ${docs.coverage.classes.documented}/${docs.coverage.classes.total} (${docs.coverage.classes.coverage}%)\n`;
    }
    content += '\n';
  }

  // Recommendations
  if (reportData.recommendations && reportData.recommendations.length > 0) {
    content += '## Recommendations\n\n';
    for (const rec of reportData.recommendations) {
      content += `- ${rec}\n`;
    }
    content += '\n';
  }

  return content;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(reportData: any): string {
  let content = '<!DOCTYPE html>\n<html>\n<head>\n';
  content += '<title>Project Report</title>\n';
  content += '<style>\n';
  content += 'body { font-family: Arial, sans-serif; margin: 40px; }\n';
  content += 'h1, h2, h3 { color: #333; }\n';
  content += 'table { border-collapse: collapse; width: 100%; margin: 20px 0; }\n';
  content += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n';
  content += 'th { background-color: #f2f2f2; }\n';
  content += '.score { font-weight: bold; }\n';
  content += '.good { color: green; }\n';
  content += '.warning { color: orange; }\n';
  content += '.error { color: red; }\n';
  content += '</style>\n</head>\n<body>\n';

  content += '<h1>Project Report</h1>\n';
  content += `<p><strong>Generated:</strong> ${reportData.generatedAt}</p>\n`;
  content += `<p><strong>Project Path:</strong> ${reportData.projectPath}</p>\n`;

  // Summary section
  content += '<h2>Summary</h2>\n';
  content += '<table>\n<tr><th>Metric</th><th>Score</th></tr>\n';
  content += `<tr><td>Overall Health</td><td class="score">${reportData.summary.overallHealth}/100</td></tr>\n`;
  content += `<tr><td>Test Coverage</td><td class="score">${reportData.summary.testCoverage}%</td></tr>\n`;
  content += `<tr><td>Code Quality</td><td class="score">${reportData.summary.codeQuality}/100</td></tr>\n`;
  content += `<tr><td>Security Score</td><td class="score">${reportData.summary.securityScore}/100</td></tr>\n`;
  content += `<tr><td>Documentation</td><td class="score">${reportData.summary.docCoverage}%</td></tr>\n`;
  content += '</table>\n';

  // Add other sections similar to markdown but with HTML formatting
  if (reportData.sections.health) {
    content += '<h2>Health Check</h2>\n';
    content += `<p><strong>Overall Score:</strong> ${reportData.sections.health.healthScore}/100</p>\n`;
  }

  if (reportData.recommendations && reportData.recommendations.length > 0) {
    content += '<h2>Recommendations</h2>\n<ul>\n';
    for (const rec of reportData.recommendations) {
      content += `<li>${rec}</li>\n`;
    }
    content += '</ul>\n';
  }

  content += '</body>\n</html>\n';
  return content;
}
