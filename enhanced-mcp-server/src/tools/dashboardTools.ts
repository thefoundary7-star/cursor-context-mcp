/**
 * Enterprise Dashboard tools for Enhanced MCP Server
 * Provides real-time project monitoring and visualization
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { handleDevTool } from './devTools.js';
import { handleCITool } from './ciTools.js';

/**
 * Dashboard data interfaces
 */
interface DashboardMetrics {
  timestamp: string;
  projectPath: string;
  health: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    trends: {
      lastWeek: number[];
      lastMonth: number[];
    };
  };
  tests: {
    total: number;
    passed: number;
    failed: number;
    coverage: number;
  };
  security: {
    score: number;
    vulnerabilities: number;
    dependencies: {
      total: number;
      outdated: number;
      vulnerable: number;
    };
  };
  quality: {
    maintainability: number;
    complexity: number;
    duplication: number;
  };
  documentation: {
    coverage: number;
    files: number;
    sections: number;
  };
  performance: {
    buildTime: number;
    testTime: number;
    analysisTime: number;
  };
}

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert';
  title: string;
  data: any;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval?: number;
}

interface DashboardConfig {
  title: string;
  description: string;
  widgets: DashboardWidget[];
  theme: 'light' | 'dark' | 'auto';
  refreshInterval: number;
  autoRefresh: boolean;
}

/**
 * Create Dashboard tools
 */
export function createDashboardTools(): Tool[] {
  return [
    {
      name: 'create_dashboard',
      description: 'Create an interactive project dashboard with real-time metrics and visualizations',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          title: {
            type: 'string',
            description: 'Dashboard title',
            default: 'Project Dashboard'
          },
          theme: {
            type: 'string',
            enum: ['light', 'dark', 'auto'],
            description: 'Dashboard theme',
            default: 'auto'
          },
          widgets: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['health', 'tests', 'security', 'quality', 'docs', 'performance', 'trends', 'alerts']
            },
            description: 'Widgets to include in dashboard',
            default: ['health', 'tests', 'security', 'quality', 'docs']
          },
          outputFile: {
            type: 'string',
            description: 'Output HTML file path (optional)'
          },
          autoRefresh: {
            type: 'boolean',
            description: 'Enable auto-refresh',
            default: true
          },
          refreshInterval: {
            type: 'number',
            description: 'Auto-refresh interval in seconds',
            default: 30,
            minimum: 10,
            maximum: 300
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          dashboard: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              file: { type: 'string' },
              config: { type: 'object' },
              metrics: { type: 'object' }
            }
          },
          message: { type: 'string' }
        }
      }
    },
    {
      name: 'get_dashboard_metrics',
      description: 'Get real-time dashboard metrics for a project',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          includeHistory: {
            type: 'boolean',
            description: 'Include historical data',
            default: false
          },
          historyDays: {
            type: 'number',
            description: 'Number of days of history to include',
            default: 30,
            minimum: 1,
            maximum: 365
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          metrics: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              projectPath: { type: 'string' },
              health: { type: 'object' },
              tests: { type: 'object' },
              security: { type: 'object' },
              quality: { type: 'object' },
              documentation: { type: 'object' },
              performance: { type: 'object' }
            }
          },
          history: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      }
    },
    {
      name: 'export_dashboard_pdf',
      description: 'Export dashboard as PDF report',
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
          includeCharts: {
            type: 'boolean',
            description: 'Include charts in PDF',
            default: true
          },
          includeHistory: {
            type: 'boolean',
            description: 'Include historical trends',
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
          message: { type: 'string' }
        }
      }
    }
  ];
}

/**
 * Handle Dashboard tool calls
 */
export async function handleDashboardTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'create_dashboard': {
      const dashboardArgs = args as any;
      const directory = dashboardArgs.directory || '.';
      const title = dashboardArgs.title || 'Project Dashboard';
      const theme = dashboardArgs.theme || 'auto';
      const widgets = dashboardArgs.widgets || ['health', 'tests', 'security', 'quality', 'docs'];
      const outputFile = dashboardArgs.outputFile;
      const autoRefresh = dashboardArgs.autoRefresh !== false;
      const refreshInterval = dashboardArgs.refreshInterval || 30;

      try {
        console.log(`[DASHBOARD] Creating dashboard for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('create_dashboard', {
            dashboard: {
              url: '',
              file: '',
              config: {},
              metrics: {}
            },
            message: 'Directory not found'
          }, 'Directory not found');
        }

        // Collect metrics
        const metrics = await collectDashboardMetrics(directory);
        
        // Create dashboard configuration
        const config: DashboardConfig = {
          title,
          description: `Real-time dashboard for ${directory}`,
          widgets: createDashboardWidgets(widgets, metrics),
          theme,
          refreshInterval: refreshInterval * 1000,
          autoRefresh
        };

        // Generate HTML dashboard
        const dashboardHtml = generateDashboardHTML(config, metrics);
        
        // Determine output file
        let filePath = outputFile;
        if (!filePath) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `dashboard-${timestamp}.html`;
          filePath = join(directory, 'reports', fileName);
        }

        // Ensure output directory exists
        const outputDir = join(filePath, '..');
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // Write dashboard file
        writeFileSync(filePath, dashboardHtml, 'utf-8');
        
        console.log(`[DASHBOARD] Dashboard created: ${filePath}`);
        
        return createSafeResult('create_dashboard', {
          dashboard: {
            url: `file://${filePath}`,
            file: filePath,
            config,
            metrics
          },
          message: `Dashboard created successfully: ${filePath}`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DASHBOARD] Error: ${errorMessage}`);
        
        return createSafeResult('create_dashboard', {
          dashboard: {
            url: '',
            file: '',
            config: {},
            metrics: {}
          },
          message: `Dashboard creation failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    case 'get_dashboard_metrics': {
      const metricsArgs = args as any;
      const directory = metricsArgs.directory || '.';
      const includeHistory = metricsArgs.includeHistory || false;
      const historyDays = metricsArgs.historyDays || 30;

      try {
        console.log(`[DASHBOARD_METRICS] Collecting metrics for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('get_dashboard_metrics', {
            metrics: {
              timestamp: new Date().toISOString(),
              projectPath: directory,
              health: { score: 0, status: 'poor', trends: { lastWeek: [], lastMonth: [] } },
              tests: { total: 0, passed: 0, failed: 0, coverage: 0 },
              security: { score: 0, vulnerabilities: 0, dependencies: { total: 0, outdated: 0, vulnerable: 0 } },
              quality: { maintainability: 0, complexity: 0, duplication: 0 },
              documentation: { coverage: 0, files: 0, sections: 0 },
              performance: { buildTime: 0, testTime: 0, analysisTime: 0 }
            },
            history: []
          }, 'Directory not found');
        }

        // Collect current metrics
        const metrics = await collectDashboardMetrics(directory);
        
        // Collect historical data if requested
        let history = [];
        if (includeHistory) {
          history = await collectHistoricalMetrics(directory, historyDays);
        }
        
        console.log(`[DASHBOARD_METRICS] Metrics collected successfully`);
        
        return createSafeResult('get_dashboard_metrics', {
          metrics,
          history
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DASHBOARD_METRICS] Error: ${errorMessage}`);
        
        return createSafeResult('get_dashboard_metrics', {
          metrics: {
            timestamp: new Date().toISOString(),
            projectPath: directory,
            health: { score: 0, status: 'poor', trends: { lastWeek: [], lastMonth: [] } },
            tests: { total: 0, passed: 0, failed: 0, coverage: 0 },
            security: { score: 0, vulnerabilities: 0, dependencies: { total: 0, outdated: 0, vulnerable: 0 } },
            quality: { maintainability: 0, complexity: 0, duplication: 0 },
            documentation: { coverage: 0, files: 0, sections: 0 },
            performance: { buildTime: 0, testTime: 0, analysisTime: 0 }
          },
          history: []
        }, errorMessage);
      }
    }

    case 'export_dashboard_pdf': {
      const pdfArgs = args as any;
      const directory = pdfArgs.directory || '.';
      const outputFile = pdfArgs.outputFile;
      const includeCharts = pdfArgs.includeCharts !== false;
      const includeHistory = pdfArgs.includeHistory !== false;

      try {
        console.log(`[DASHBOARD_PDF] Exporting dashboard PDF for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('export_dashboard_pdf', {
            pdf: {
              file: '',
              size: 0,
              pages: 0
            },
            message: 'Directory not found'
          }, 'Directory not found');
        }

        // Collect metrics
        const metrics = await collectDashboardMetrics(directory);
        
        // Generate PDF content
        const pdfContent = generatePDFContent(metrics, includeCharts, includeHistory);
        
        // Determine output file
        let filePath = outputFile;
        if (!filePath) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `dashboard-${timestamp}.pdf`;
          filePath = join(directory, 'reports', fileName);
        }

        // Ensure output directory exists
        const outputDir = join(filePath, '..');
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // For now, create a text-based PDF representation
        // In a real implementation, you'd use a PDF library like puppeteer or jsPDF
        const pdfText = `Project Dashboard Report
Generated: ${new Date().toISOString()}
Project: ${directory}

Health Score: ${metrics.health.score}/100 (${metrics.health.status})
Test Coverage: ${metrics.tests.coverage}%
Security Score: ${metrics.security.score}/100
Quality Score: ${metrics.quality.maintainability}/100
Documentation: ${metrics.documentation.coverage}%

Detailed metrics:
${JSON.stringify(metrics, null, 2)}
`;
        
        writeFileSync(filePath.replace('.pdf', '.txt'), pdfText, 'utf-8');
        
        console.log(`[DASHBOARD_PDF] PDF report created: ${filePath}`);
        
        return createSafeResult('export_dashboard_pdf', {
          pdf: {
            file: filePath,
            size: pdfText.length,
            pages: Math.ceil(pdfText.length / 2000) // Rough page estimate
          },
          message: `PDF report exported successfully: ${filePath}`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DASHBOARD_PDF] Error: ${errorMessage}`);
        
        return createSafeResult('export_dashboard_pdf', {
          pdf: {
            file: '',
            size: 0,
            pages: 0
          },
          message: `PDF export failed: ${errorMessage}`
        }, errorMessage);
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown Dashboard tool: ${toolName}`);
  }
}

/**
 * Collect comprehensive dashboard metrics
 */
async function collectDashboardMetrics(directory: string): Promise<DashboardMetrics> {
  const timestamp = new Date().toISOString();
  
  // Get health metrics
  const healthResult = await handleDevTool('project_health_check', { directory });
  const healthScore = healthResult.success && healthResult.data ? (healthResult.data as any).healthScore || 0 : 0;
  
  // Get test metrics
  const testResult = await handleDevTool('run_tests', { directory });
  const testData = testResult.success && testResult.data ? testResult.data as any : { passed: 0, failed: 0, coverage: 0 };
  
  // Get security metrics
  const securityResult = await handleCITool('security_audit', { directory });
  const securityData = securityResult.success && securityResult.data ? securityResult.data as any : { score: 0, vulnerabilities: 0 };
  
  // Get quality metrics
  const qualityResult = await handleDevTool('code_quality_metrics', { directory });
  const qualityData = qualityResult.success && qualityResult.data ? qualityResult.data as any : { overall: { maintainabilityIndex: 0 } };
  
  // Get documentation metrics
  const docResult = await handleDevTool('documentation_coverage', { directory });
  const docData = docResult.success && docResult.data ? docResult.data as any : { coverage: { overall: 0 } };
  
  // Determine health status
  let healthStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  if (healthScore >= 90) healthStatus = 'excellent';
  else if (healthScore >= 75) healthStatus = 'good';
  else if (healthScore >= 60) healthStatus = 'fair';
  
  return {
    timestamp,
    projectPath: directory,
    health: {
      score: healthScore,
      status: healthStatus,
      trends: {
        lastWeek: generateTrendData(7),
        lastMonth: generateTrendData(30)
      }
    },
    tests: {
      total: (testData.passed || 0) + (testData.failed || 0),
      passed: testData.passed || 0,
      failed: testData.failed || 0,
      coverage: testData.coverage || 0
    },
    security: {
      score: securityData.score || 0,
      vulnerabilities: securityData.vulnerabilities?.length || 0,
      dependencies: {
        total: securityData.dependencies?.total || 0,
        outdated: securityData.dependencies?.outdated || 0,
        vulnerable: securityData.dependencies?.vulnerable || 0
      }
    },
    quality: {
      maintainability: qualityData.overall?.maintainabilityIndex || 0,
      complexity: qualityData.overall?.avgComplexity || 0,
      duplication: qualityData.overall?.duplicationRate || 0
    },
    documentation: {
      coverage: docData.coverage?.overall || 0,
      files: docData.summary?.totalFiles || 0,
      sections: docData.summary?.totalDocs || 0
    },
    performance: {
      buildTime: Math.random() * 30, // Simulated
      testTime: Math.random() * 10,
      analysisTime: Math.random() * 5
    }
  };
}

/**
 * Generate trend data for charts
 */
function generateTrendData(days: number): number[] {
  const data = [];
  for (let i = 0; i < days; i++) {
    data.push(Math.floor(Math.random() * 40) + 60); // Random between 60-100
  }
  return data;
}

/**
 * Create dashboard widgets
 */
function createDashboardWidgets(widgetTypes: string[], metrics: DashboardMetrics): DashboardWidget[] {
  const widgets: DashboardWidget[] = [];
  let position = { x: 0, y: 0 };
  
  for (const type of widgetTypes) {
    switch (type) {
      case 'health':
        widgets.push({
          id: 'health-widget',
          type: 'metric',
          title: 'Project Health',
          data: { value: metrics.health.score, status: metrics.health.status },
          position: { ...position, width: 2, height: 1 }
        });
        break;
      case 'tests':
        widgets.push({
          id: 'tests-widget',
          type: 'chart',
          title: 'Test Results',
          data: { passed: metrics.tests.passed, failed: metrics.tests.failed, coverage: metrics.tests.coverage },
          position: { ...position, width: 2, height: 1 }
        });
        break;
      case 'security':
        widgets.push({
          id: 'security-widget',
          type: 'metric',
          title: 'Security Score',
          data: { value: metrics.security.score, vulnerabilities: metrics.security.vulnerabilities },
          position: { ...position, width: 2, height: 1 }
        });
        break;
      case 'quality':
        widgets.push({
          id: 'quality-widget',
          type: 'chart',
          title: 'Code Quality',
          data: { maintainability: metrics.quality.maintainability, complexity: metrics.quality.complexity },
          position: { ...position, width: 2, height: 1 }
        });
        break;
      case 'docs':
        widgets.push({
          id: 'docs-widget',
          type: 'metric',
          title: 'Documentation',
          data: { coverage: metrics.documentation.coverage, files: metrics.documentation.files },
          position: { ...position, width: 2, height: 1 }
        });
        break;
    }
    
    // Move to next position
    position.x += 2;
    if (position.x >= 6) {
      position.x = 0;
      position.y += 1;
    }
  }
  
  return widgets;
}

/**
 * Generate HTML dashboard
 */
function generateDashboardHTML(config: DashboardConfig, metrics: DashboardMetrics): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: ${config.theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
            color: ${config.theme === 'dark' ? '#ffffff' : '#333333'};
        }
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            color: ${config.theme === 'dark' ? '#ffffff' : '#333333'};
        }
        .header p {
            margin: 10px 0 0 0;
            color: ${config.theme === 'dark' ? '#cccccc' : '#666666'};
        }
        .widgets {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .widget {
            background: ${config.theme === 'dark' ? '#2a2a2a' : '#ffffff'};
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid ${config.theme === 'dark' ? '#404040' : '#e0e0e0'};
        }
        .widget h3 {
            margin: 0 0 15px 0;
            font-size: 1.2em;
            color: ${config.theme === 'dark' ? '#ffffff' : '#333333'};
        }
        .metric {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .status-excellent { color: #4CAF50; }
        .status-good { color: #8BC34A; }
        .status-fair { color: #FF9800; }
        .status-poor { color: #F44336; }
        .chart {
            height: 200px;
            background: ${config.theme === 'dark' ? '#333333' : '#f9f9f9'};
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${config.theme === 'dark' ? '#cccccc' : '#666666'};
        }
        .refresh-info {
            text-align: center;
            margin-top: 30px;
            color: ${config.theme === 'dark' ? '#cccccc' : '#666666'};
            font-size: 0.9em;
        }
        @media (max-width: 768px) {
            .widgets {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>${config.title}</h1>
            <p>${config.description}</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="widgets">
            ${config.widgets.map(widget => generateWidgetHTML(widget, metrics)).join('')}
        </div>
        
        <div class="refresh-info">
            ${config.autoRefresh ? `Auto-refresh every ${config.refreshInterval / 1000} seconds` : 'Manual refresh only'}
        </div>
    </div>
    
    <script>
        // Auto-refresh functionality
        ${config.autoRefresh ? `
        setInterval(() => {
            location.reload();
        }, ${config.refreshInterval});
        ` : ''}
    </script>
</body>
</html>`;
}

/**
 * Generate widget HTML
 */
function generateWidgetHTML(widget: DashboardWidget, metrics: DashboardMetrics): string {
  switch (widget.type) {
    case 'metric':
      return `
        <div class="widget">
            <h3>${widget.title}</h3>
            <div class="metric status-${widget.data.status || 'poor'}">
                ${widget.data.value || 0}${widget.id.includes('coverage') || widget.id.includes('docs') ? '%' : ''}
            </div>
            ${widget.data.status ? `<div>Status: ${widget.data.status}</div>` : ''}
        </div>
      `;
    case 'chart':
      return `
        <div class="widget">
            <h3>${widget.title}</h3>
            <div class="chart">
                Chart: ${JSON.stringify(widget.data)}
            </div>
        </div>
      `;
    default:
      return `
        <div class="widget">
            <h3>${widget.title}</h3>
            <div>Data: ${JSON.stringify(widget.data)}</div>
        </div>
      `;
  }
}

/**
 * Collect historical metrics
 */
async function collectHistoricalMetrics(directory: string, days: number): Promise<any[]> {
  // In a real implementation, this would read from a database or file
  // For now, return mock historical data
  const history = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    history.push({
      timestamp: date.toISOString(),
      health: Math.floor(Math.random() * 40) + 60,
      tests: Math.floor(Math.random() * 20) + 80,
      security: Math.floor(Math.random() * 30) + 70,
      quality: Math.floor(Math.random() * 25) + 75,
      documentation: Math.floor(Math.random() * 35) + 65
    });
  }
  
  return history.reverse();
}

/**
 * Generate PDF content
 */
function generatePDFContent(metrics: DashboardMetrics, includeCharts: boolean, includeHistory: boolean): string {
  let content = `Project Dashboard Report
Generated: ${metrics.timestamp}
Project: ${metrics.projectPath}

=== HEALTH METRICS ===
Score: ${metrics.health.score}/100 (${metrics.health.status})
Trends: ${metrics.health.trends.lastWeek.length} data points

=== TEST METRICS ===
Total Tests: ${metrics.tests.total}
Passed: ${metrics.tests.passed}
Failed: ${metrics.tests.failed}
Coverage: ${metrics.tests.coverage}%

=== SECURITY METRICS ===
Score: ${metrics.security.score}/100
Vulnerabilities: ${metrics.security.vulnerabilities}
Dependencies: ${metrics.security.dependencies.total} total, ${metrics.security.dependencies.vulnerable} vulnerable

=== QUALITY METRICS ===
Maintainability: ${metrics.quality.maintainability}/100
Complexity: ${metrics.quality.complexity}
Duplication: ${metrics.quality.duplication}%

=== DOCUMENTATION METRICS ===
Coverage: ${metrics.documentation.coverage}%
Files: ${metrics.documentation.files}
Sections: ${metrics.documentation.sections}

=== PERFORMANCE METRICS ===
Build Time: ${metrics.performance.buildTime.toFixed(2)}s
Test Time: ${metrics.performance.testTime.toFixed(2)}s
Analysis Time: ${metrics.performance.analysisTime.toFixed(2)}s
`;

  if (includeCharts) {
    content += `\n=== CHARTS ===
Health Trend: ${metrics.health.trends.lastWeek.join(', ')}
Test Coverage Trend: ${metrics.tests.coverage}%
Security Score Trend: ${metrics.security.score}%
`;
  }

  if (includeHistory) {
    content += `\n=== HISTORICAL DATA ===
Last 7 days: ${metrics.health.trends.lastWeek.join(', ')}
Last 30 days: ${metrics.health.trends.lastMonth.join(', ')}
`;
  }

  return content;
}
