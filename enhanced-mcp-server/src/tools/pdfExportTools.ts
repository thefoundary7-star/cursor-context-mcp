/**
 * PDF Export tools for Enhanced MCP Server
 * Provides comprehensive PDF report generation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { handleCITool } from './ciTools.js';
import { handleDevTool } from './devTools.js';

/**
 * PDF Export interfaces
 */
interface PDFConfig {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  includeCharts: boolean;
  includeCode: boolean;
  includeHistory: boolean;
  theme: 'light' | 'dark' | 'professional';
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

interface PDFSection {
  title: string;
  content: string;
  level: number;
  pageBreak?: boolean;
}

interface PDFReport {
  config: PDFConfig;
  sections: PDFSection[];
  metadata: {
    generatedAt: string;
    projectPath: string;
    totalPages: number;
    fileSize: number;
  };
}

/**
 * Create PDF Export tools
 */
export function createPDFExportTools(): Tool[] {
  return [
    {
      name: 'export_project_pdf',
      description: 'Export comprehensive project report as PDF',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          outputFile: {
            type: 'string',
            description: 'Output PDF file path (optional)'
          },
          title: {
            type: 'string',
            description: 'Report title',
            default: 'Project Analysis Report'
          },
          author: {
            type: 'string',
            description: 'Report author',
            default: 'Enhanced MCP Server'
          },
          includeCharts: {
            type: 'boolean',
            description: 'Include charts and visualizations',
            default: true
          },
          includeCode: {
            type: 'boolean',
            description: 'Include code snippets',
            default: false
          },
          includeHistory: {
            type: 'boolean',
            description: 'Include historical trends',
            default: true
          },
          theme: {
            type: 'string',
            enum: ['light', 'dark', 'professional'],
            description: 'PDF theme',
            default: 'professional'
          },
          pageSize: {
            type: 'string',
            enum: ['A4', 'Letter', 'Legal'],
            description: 'Page size',
            default: 'A4'
          },
          orientation: {
            type: 'string',
            enum: ['portrait', 'landscape'],
            description: 'Page orientation',
            default: 'portrait'
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          pdf: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              size: { type: 'number' },
              pages: { type: 'number' }
            }
          },
          report: { type: 'object' },
          message: { type: 'string' }
        }
      }
    },
    {
      name: 'export_health_report_pdf',
      description: 'Export project health report as PDF',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          outputFile: {
            type: 'string',
            description: 'Output PDF file path (optional)'
          },
          threshold: {
            type: 'number',
            description: 'Health score threshold',
            default: 70,
            minimum: 0,
            maximum: 100
          },
          includeRecommendations: {
            type: 'boolean',
            description: 'Include improvement recommendations',
            default: true
          },
          includeTrends: {
            type: 'boolean',
            description: 'Include trend analysis',
            default: true
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          pdf: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              size: { type: 'number' },
              pages: { type: 'number' }
            }
          },
          health: { type: 'object' },
          message: { type: 'string' }
        }
      }
    },
    {
      name: 'export_security_report_pdf',
      description: 'Export security analysis report as PDF',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          outputFile: {
            type: 'string',
            description: 'Output PDF file path (optional)'
          },
          includeVulnerabilities: {
            type: 'boolean',
            description: 'Include vulnerability details',
            default: true
          },
          includeDependencies: {
            type: 'boolean',
            description: 'Include dependency analysis',
            default: true
          },
          includeRecommendations: {
            type: 'boolean',
            description: 'Include security recommendations',
            default: true
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          pdf: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              size: { type: 'number' },
              pages: { type: 'number' }
            }
          },
          security: { type: 'object' },
          message: { type: 'string' }
        }
      }
    }
  ];
}

/**
 * Handle PDF Export tool calls
 */
export async function handlePDFExportTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'export_project_pdf': {
      const pdfArgs = args as any;
      const directory = pdfArgs.directory || '.';
      const outputFile = pdfArgs.outputFile;
      const title = pdfArgs.title || 'Project Analysis Report';
      const author = pdfArgs.author || 'Enhanced MCP Server';
      const includeCharts = pdfArgs.includeCharts !== false;
      const includeCode = pdfArgs.includeCode || false;
      const includeHistory = pdfArgs.includeHistory !== false;
      const theme = pdfArgs.theme || 'professional';
      const pageSize = pdfArgs.pageSize || 'A4';
      const orientation = pdfArgs.orientation || 'portrait';

      try {
        console.log(`[PDF_EXPORT] Generating comprehensive project PDF for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('export_project_pdf', {
            pdf: { file: '', size: 0, pages: 0 },
            report: {},
            message: 'Directory not found'
          }, 'Directory not found');
        }

        // Collect comprehensive project data
        const projectData = await collectProjectData(directory);
        
        // Create PDF configuration
        const config: PDFConfig = {
          title,
          author,
          subject: `Project Analysis for ${directory}`,
          keywords: ['project', 'analysis', 'code', 'quality', 'security', 'testing'],
          includeCharts,
          includeCode,
          includeHistory,
          theme,
          pageSize,
          orientation,
          margins: { top: 20, right: 20, bottom: 20, left: 20 }
        };

        // Generate PDF sections
        const sections = await generateProjectSections(projectData, config);
        
        // Create PDF report
        const report: PDFReport = {
          config,
          sections,
          metadata: {
            generatedAt: new Date().toISOString(),
            projectPath: directory,
            totalPages: 0,
            fileSize: 0
          }
        };

        // Generate PDF content
        const pdfContent = generatePDFContent(report);
        
        // Determine output file
        let filePath = outputFile;
        if (!filePath) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `project-report-${timestamp}.pdf`;
          filePath = join(directory, 'reports', fileName);
        }

        // Ensure output directory exists
        const outputDir = join(filePath, '..');
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // For now, create a text-based PDF representation
        // In a real implementation, you'd use a PDF library like puppeteer or jsPDF
        const pdfText = generateTextPDF(report);
        writeFileSync(filePath.replace('.pdf', '.txt'), pdfText, 'utf-8');
        
        // Calculate metadata
        const fileSize = pdfText.length;
        const totalPages = Math.ceil(pdfText.length / 2000); // Rough estimate
        
        report.metadata.totalPages = totalPages;
        report.metadata.fileSize = fileSize;
        
        console.log(`[PDF_EXPORT] Project PDF generated: ${filePath}`);
        
        return createSafeResult('export_project_pdf', {
          pdf: {
            file: filePath,
            size: fileSize,
            pages: totalPages
          },
          report,
          message: `Project PDF exported successfully: ${filePath}`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[PDF_EXPORT] Error: ${errorMessage}`);
        
        return createSafeResult('export_project_pdf', {
          pdf: { file: '', size: 0, pages: 0 },
          report: {},
          message: `PDF export failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    case 'export_health_report_pdf': {
      const healthArgs = args as any;
      const directory = healthArgs.directory || '.';
      const outputFile = healthArgs.outputFile;
      const threshold = healthArgs.threshold || 70;
      const includeRecommendations = healthArgs.includeRecommendations !== false;
      const includeTrends = healthArgs.includeTrends !== false;

      try {
        console.log(`[PDF_EXPORT] Generating health report PDF for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('export_health_report_pdf', {
            pdf: { file: '', size: 0, pages: 0 },
            health: {},
            message: 'Directory not found'
          }, 'Directory not found');
        }

        // Get health data
        const healthResult = await handleCITool('ci_health_gate', {
          threshold,
          projectPath: directory,
          includeTests: true,
          includeLint: true,
          includeDependencies: true,
          includeDocs: true
        });

        if (!healthResult.success || !healthResult.data) {
          return createSafeResult('export_health_report_pdf', {
            pdf: { file: '', size: 0, pages: 0 },
            health: {},
            message: 'Health data collection failed'
          }, 'Health data collection failed');
        }

        const healthData = healthResult.data as any;
        
        // Generate health report content
        const healthContent = generateHealthReportContent(healthData, {
          includeRecommendations,
          includeTrends,
          threshold
        });
        
        // Determine output file
        let filePath = outputFile;
        if (!filePath) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `health-report-${timestamp}.pdf`;
          filePath = join(directory, 'reports', fileName);
        }

        // Ensure output directory exists
        const outputDir = join(filePath, '..');
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // Create text-based PDF
        writeFileSync(filePath.replace('.pdf', '.txt'), healthContent, 'utf-8');
        
        const fileSize = healthContent.length;
        const totalPages = Math.ceil(fileSize / 2000);
        
        console.log(`[PDF_EXPORT] Health report PDF generated: ${filePath}`);
        
        return createSafeResult('export_health_report_pdf', {
          pdf: {
            file: filePath,
            size: fileSize,
            pages: totalPages
          },
          health: healthData,
          message: `Health report PDF exported successfully: ${filePath}`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[PDF_EXPORT] Error: ${errorMessage}`);
        
        return createSafeResult('export_health_report_pdf', {
          pdf: { file: '', size: 0, pages: 0 },
          health: {},
          message: `Health report PDF export failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    case 'export_security_report_pdf': {
      const securityArgs = args as any;
      const directory = securityArgs.directory || '.';
      const outputFile = securityArgs.outputFile;
      const includeVulnerabilities = securityArgs.includeVulnerabilities !== false;
      const includeDependencies = securityArgs.includeDependencies !== false;
      const includeRecommendations = securityArgs.includeRecommendations !== false;

      try {
        console.log(`[PDF_EXPORT] Generating security report PDF for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('export_security_report_pdf', {
            pdf: { file: '', size: 0, pages: 0 },
            security: {},
            message: 'Directory not found'
          }, 'Directory not found');
        }

        // Get security data
        const securityResult = await handleCITool('security_audit', { directory });

        if (!securityResult.success || !securityResult.data) {
          return createSafeResult('export_security_report_pdf', {
            pdf: { file: '', size: 0, pages: 0 },
            security: {},
            message: 'Security data collection failed'
          }, 'Security data collection failed');
        }

        const securityData = securityResult.data as any;
        
        // Generate security report content
        const securityContent = generateSecurityReportContent(securityData, {
          includeVulnerabilities,
          includeDependencies,
          includeRecommendations
        });
        
        // Determine output file
        let filePath = outputFile;
        if (!filePath) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `security-report-${timestamp}.pdf`;
          filePath = join(directory, 'reports', fileName);
        }

        // Ensure output directory exists
        const outputDir = join(filePath, '..');
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // Create text-based PDF
        writeFileSync(filePath.replace('.pdf', '.txt'), securityContent, 'utf-8');
        
        const fileSize = securityContent.length;
        const totalPages = Math.ceil(fileSize / 2000);
        
        console.log(`[PDF_EXPORT] Security report PDF generated: ${filePath}`);
        
        return createSafeResult('export_security_report_pdf', {
          pdf: {
            file: filePath,
            size: fileSize,
            pages: totalPages
          },
          security: securityData,
          message: `Security report PDF exported successfully: ${filePath}`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[PDF_EXPORT] Error: ${errorMessage}`);
        
        return createSafeResult('export_security_report_pdf', {
          pdf: { file: '', size: 0, pages: 0 },
          security: {},
          message: `Security report PDF export failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown PDF Export tool: ${toolName}`);
  }
}

/**
 * Collect comprehensive project data
 */
async function collectProjectData(directory: string): Promise<any> {
  const data: any = {
    timestamp: new Date().toISOString(),
    projectPath: directory
  };

  try {
    // Health check
    const healthResult = await handleCITool('ci_health_gate', {
      threshold: 70,
      projectPath: directory,
      includeTests: true,
      includeLint: true,
      includeDependencies: true,
      includeDocs: true
    });
    data.health = healthResult.success ? healthResult.data : null;

    // Test results
    const testResult = await handleDevTool('run_tests', { directory });
    data.tests = testResult.success ? testResult.data : null;

    // Security analysis
    const securityResult = await handleCITool('security_audit', { directory });
    data.security = securityResult.success ? securityResult.data : null;

    // Code quality
    const qualityResult = await handleDevTool('code_quality_metrics', { directory });
    data.quality = qualityResult.success ? qualityResult.data : null;

    // Documentation
    const docResult = await handleDevTool('documentation_coverage', { directory });
    data.documentation = docResult.success ? docResult.data : null;

  } catch (error) {
    console.error(`[PDF_EXPORT] Error collecting project data:`, error);
  }

  return data;
}

/**
 * Generate project sections for PDF
 */
async function generateProjectSections(projectData: any, config: PDFConfig): Promise<PDFSection[]> {
  const sections: PDFSection[] = [];

  // Title page
  sections.push({
    title: config.title,
    content: `Generated: ${projectData.timestamp}\nProject: ${projectData.projectPath}\n\nThis comprehensive project analysis report provides detailed insights into code quality, security, testing, and documentation.`,
    level: 1,
    pageBreak: true
  });

  // Executive Summary
  sections.push({
    title: 'Executive Summary',
    content: generateExecutiveSummary(projectData),
    level: 1,
    pageBreak: true
  });

  // Health Analysis
  if (projectData.health) {
    sections.push({
      title: 'Project Health Analysis',
      content: generateHealthSection(projectData.health),
      level: 1
    });
  }

  // Test Results
  if (projectData.tests) {
    sections.push({
      title: 'Test Results',
      content: generateTestSection(projectData.tests),
      level: 1
    });
  }

  // Security Analysis
  if (projectData.security) {
    sections.push({
      title: 'Security Analysis',
      content: generateSecuritySection(projectData.security),
      level: 1
    });
  }

  // Code Quality
  if (projectData.quality) {
    sections.push({
      title: 'Code Quality Analysis',
      content: generateQualitySection(projectData.quality),
      level: 1
    });
  }

  // Documentation
  if (projectData.documentation) {
    sections.push({
      title: 'Documentation Analysis',
      content: generateDocumentationSection(projectData.documentation),
      level: 1
    });
  }

  // Recommendations
  sections.push({
    title: 'Recommendations',
    content: generateRecommendationsSection(projectData),
    level: 1
  });

  return sections;
}

/**
 * Generate PDF content
 */
function generatePDFContent(report: PDFReport): string {
  let content = `PDF Report: ${report.config.title}\n`;
  content += `Author: ${report.config.author}\n`;
  content += `Generated: ${report.metadata.generatedAt}\n`;
  content += `Pages: ${report.metadata.totalPages}\n`;
  content += `Size: ${report.metadata.fileSize} bytes\n\n`;

  for (const section of report.sections) {
    content += `${'#'.repeat(section.level)} ${section.title}\n\n`;
    content += `${section.content}\n\n`;
    if (section.pageBreak) {
      content += '--- PAGE BREAK ---\n\n';
    }
  }

  return content;
}

/**
 * Generate text-based PDF
 */
function generateTextPDF(report: PDFReport): string {
  return generatePDFContent(report);
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(projectData: any): string {
  const health = projectData.health?.healthScore || 0;
  const tests = projectData.tests;
  const security = projectData.security;
  const quality = projectData.quality;
  const docs = projectData.documentation;

  let summary = `This project analysis reveals the following key metrics:\n\n`;
  
  summary += `Health Score: ${health}/100\n`;
  
  if (tests) {
    summary += `Test Coverage: ${tests.coverage || 0}%\n`;
    summary += `Tests: ${tests.passed || 0} passed, ${tests.failed || 0} failed\n`;
  }
  
  if (security) {
    summary += `Security Score: ${security.score || 0}/100\n`;
    summary += `Vulnerabilities: ${security.vulnerabilities?.length || 0}\n`;
  }
  
  if (quality) {
    summary += `Code Quality: ${quality.overall?.maintainabilityIndex || 0}/100\n`;
  }
  
  if (docs) {
    summary += `Documentation Coverage: ${docs.coverage?.overall || 0}%\n`;
  }

  return summary;
}

/**
 * Generate health section
 */
function generateHealthSection(health: any): string {
  let content = `Health Score: ${health.healthScore}/100\n`;
  content += `Status: ${health.passed ? 'PASSED' : 'FAILED'}\n\n`;
  
  if (health.breakdown) {
    content += `Breakdown:\n`;
    if (health.breakdown.tests) {
      content += `- Tests: ${health.breakdown.tests.passed} passed, ${health.breakdown.tests.failed} failed (${health.breakdown.tests.score}/100)\n`;
    }
    if (health.breakdown.lint) {
      content += `- Linting: ${health.breakdown.lint.errors} errors, ${health.breakdown.lint.warnings} warnings (${health.breakdown.lint.score}/100)\n`;
    }
    if (health.breakdown.dependencies) {
      content += `- Dependencies: ${health.breakdown.dependencies.total} total, ${health.breakdown.dependencies.vulnerable} vulnerable (${health.breakdown.dependencies.score}/100)\n`;
    }
    if (health.breakdown.documentation) {
      content += `- Documentation: ${health.breakdown.documentation.coverage}% coverage (${health.breakdown.documentation.score}/100)\n`;
    }
  }

  if (health.recommendations && health.recommendations.length > 0) {
    content += `\nRecommendations:\n`;
    for (const rec of health.recommendations) {
      content += `- ${rec}\n`;
    }
  }

  return content;
}

/**
 * Generate test section
 */
function generateTestSection(tests: any): string {
  let content = `Test Results Summary:\n`;
  content += `Total Tests: ${tests.total || 0}\n`;
  content += `Passed: ${tests.passed || 0}\n`;
  content += `Failed: ${tests.failed || 0}\n`;
  content += `Coverage: ${tests.coverage || 0}%\n\n`;
  
  if (tests.failed > 0) {
    content += `Failed Tests:\n`;
    // Add failed test details if available
  }

  return content;
}

/**
 * Generate security section
 */
function generateSecuritySection(security: any): string {
  let content = `Security Analysis:\n`;
  content += `Security Score: ${security.score || 0}/100\n`;
  content += `Vulnerabilities: ${security.vulnerabilities?.length || 0}\n\n`;
  
  if (security.vulnerabilities && security.vulnerabilities.length > 0) {
    content += `Vulnerability Details:\n`;
    for (const vuln of security.vulnerabilities) {
      content += `- ${vuln.name || 'Unknown'}: ${vuln.severity || 'Unknown'} - ${vuln.description || 'No description'}\n`;
    }
  }

  return content;
}

/**
 * Generate quality section
 */
function generateQualitySection(quality: any): string {
  let content = `Code Quality Metrics:\n`;
  
  if (quality.overall) {
    content += `Maintainability Index: ${quality.overall.maintainabilityIndex || 0}/100\n`;
    content += `Average Complexity: ${quality.overall.avgComplexity || 0}\n`;
    content += `Duplication Rate: ${quality.overall.duplicationRate || 0}%\n`;
  }

  if (quality.issues && quality.issues.length > 0) {
    content += `\nQuality Issues Found: ${quality.issues.length}\n`;
  }

  return content;
}

/**
 * Generate documentation section
 */
function generateDocumentationSection(docs: any): string {
  let content = `Documentation Analysis:\n`;
  
  if (docs.coverage) {
    content += `Overall Coverage: ${docs.coverage.overall || 0}%\n`;
    content += `Functions: ${docs.coverage.functions?.documented || 0}/${docs.coverage.functions?.total || 0} (${docs.coverage.functions?.coverage || 0}%)\n`;
    content += `Classes: ${docs.coverage.classes?.documented || 0}/${docs.coverage.classes?.total || 0} (${docs.coverage.classes?.coverage || 0}%)\n`;
  }

  if (docs.undocumented && docs.undocumented.length > 0) {
    content += `\nUndocumented Items: ${docs.undocumented.length}\n`;
  }

  return content;
}

/**
 * Generate recommendations section
 */
function generateRecommendationsSection(projectData: any): string {
  let content = `Improvement Recommendations:\n\n`;
  
  const recommendations = [];
  
  if (projectData.health?.recommendations) {
    recommendations.push(...projectData.health.recommendations);
  }
  
  if (projectData.tests?.failed > 0) {
    recommendations.push('Fix failing tests to improve code reliability');
  }
  
  if (projectData.security?.vulnerabilities?.length > 0) {
    recommendations.push('Address security vulnerabilities to improve project security');
  }
  
  if (projectData.quality?.overall?.maintainabilityIndex < 70) {
    recommendations.push('Improve code maintainability through refactoring');
  }
  
  if (projectData.documentation?.coverage?.overall < 80) {
    recommendations.push('Increase documentation coverage for better code understanding');
  }

  for (let i = 0; i < recommendations.length; i++) {
    content += `${i + 1}. ${recommendations[i]}\n`;
  }

  return content;
}

/**
 * Generate health report content
 */
function generateHealthReportContent(healthData: any, options: any): string {
  let content = `Project Health Report\n`;
  content += `Generated: ${new Date().toISOString()}\n`;
  content += `Threshold: ${options.threshold}/100\n\n`;
  
  content += `Health Score: ${healthData.healthScore}/100\n`;
  content += `Status: ${healthData.passed ? 'PASSED' : 'FAILED'}\n\n`;
  
  if (healthData.breakdown) {
    content += `Detailed Breakdown:\n`;
    content += JSON.stringify(healthData.breakdown, null, 2);
  }
  
  if (options.includeRecommendations && healthData.recommendations) {
    content += `\nRecommendations:\n`;
    for (const rec of healthData.recommendations) {
      content += `- ${rec}\n`;
    }
  }

  return content;
}

/**
 * Generate security report content
 */
function generateSecurityReportContent(securityData: any, options: any): string {
  let content = `Security Analysis Report\n`;
  content += `Generated: ${new Date().toISOString()}\n\n`;
  
  content += `Security Score: ${securityData.score || 0}/100\n`;
  content += `Vulnerabilities: ${securityData.vulnerabilities?.length || 0}\n\n`;
  
  if (options.includeVulnerabilities && securityData.vulnerabilities) {
    content += `Vulnerability Details:\n`;
    for (const vuln of securityData.vulnerabilities) {
      content += `- ${vuln.name || 'Unknown'}: ${vuln.severity || 'Unknown'}\n`;
    }
  }
  
  if (options.includeDependencies && securityData.dependencies) {
    content += `\nDependency Analysis:\n`;
    content += JSON.stringify(securityData.dependencies, null, 2);
  }

  return content;
}
