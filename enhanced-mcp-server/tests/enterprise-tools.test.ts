/**
 * Comprehensive tests for Enterprise tools
 * Tests dashboard, Git hooks, and PDF export functionality
 */

import { createDashboardTools, handleDashboardTool } from '../src/tools/dashboardTools.js';
import { createGitHookTools, handleGitHookTool } from '../src/tools/gitHookTools.js';
import { createPDFExportTools, handlePDFExportTool } from '../src/tools/pdfExportTools.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

// Mock dependencies
jest.mock('../src/tools/devTools.js');
jest.mock('../src/tools/ciTools.js');

const TEST_DIR = './test-enterprise-project';

describe('Enterprise Tools', () => {
  beforeAll(() => {
    // Setup test project
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Create test files
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'test-enterprise-project',
      version: '1.0.0',
      scripts: { test: 'echo "Tests passed"' }
    }));
    
    writeFileSync(join(TEST_DIR, 'src/index.js'), `
      /**
       * Main application
       * @param {string} name - Name to greet
       * @returns {string} Greeting
       */
      function greet(name) {
        return \`Hello, \${name}!\`;
      }
      
      module.exports = { greet };
    `);
  });

  afterAll(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Dashboard Tools', () => {
    describe('createDashboardTools', () => {
      it('should create dashboard tools with correct schemas', () => {
        const tools = createDashboardTools();
        
        expect(tools).toHaveLength(3);
        expect(tools[0].name).toBe('create_dashboard');
        expect(tools[1].name).toBe('get_dashboard_metrics');
        expect(tools[2].name).toBe('export_dashboard_pdf');
        
        // Verify input schemas
        expect(tools[0].inputSchema.properties.directory).toBeDefined();
        expect(tools[0].inputSchema.properties.title).toBeDefined();
        expect(tools[0].inputSchema.properties.theme).toBeDefined();
        expect(tools[1].inputSchema.properties.includeHistory).toBeDefined();
        expect(tools[2].inputSchema.properties.includeCharts).toBeDefined();
      });
    });

    describe('create_dashboard', () => {
      it('should create dashboard successfully', async () => {
        // Mock successful tool results
        const mockHealthResult = {
          success: true,
          data: { healthScore: 85, breakdown: {}, recommendations: [] }
        };

        const { handleDevTool } = require('../src/tools/devTools.js');
        handleDevTool.mockResolvedValue(mockHealthResult);

        const result = await handleDashboardTool('create_dashboard', {
          directory: TEST_DIR,
          title: 'Test Dashboard',
          theme: 'light',
          widgets: ['health', 'tests', 'security']
        });

        expect(result.success).toBe(true);
        expect(result.data.dashboard).toBeDefined();
        expect(result.data.dashboard.config).toBeDefined();
        expect(result.data.dashboard.metrics).toBeDefined();
        expect(result.data.message).toContain('Dashboard created successfully');
      });

      it('should handle missing directory', async () => {
        const result = await handleDashboardTool('create_dashboard', {
          directory: './non-existent-directory',
          title: 'Test Dashboard'
        });

        expect(result.success).toBe(true);
        expect(result.data.dashboard.url).toBe('');
        expect(result.data.message).toBe('Directory not found');
      });
    });

    describe('get_dashboard_metrics', () => {
      it('should collect dashboard metrics successfully', async () => {
        const mockHealthResult = {
          success: true,
          data: { healthScore: 85, breakdown: {}, recommendations: [] }
        };

        const { handleDevTool } = require('../src/tools/devTools.js');
        handleDevTool.mockResolvedValue(mockHealthResult);

        const result = await handleDashboardTool('get_dashboard_metrics', {
          directory: TEST_DIR,
          includeHistory: true,
          historyDays: 7
        });

        expect(result.success).toBe(true);
        expect(result.data.metrics).toBeDefined();
        expect(result.data.metrics.timestamp).toBeDefined();
        expect(result.data.metrics.projectPath).toBe(TEST_DIR);
        expect(result.data.history).toBeDefined();
      });
    });

    describe('export_dashboard_pdf', () => {
      it('should export dashboard PDF successfully', async () => {
        const mockHealthResult = {
          success: true,
          data: { healthScore: 85, breakdown: {}, recommendations: [] }
        };

        const { handleDevTool } = require('../src/tools/devTools.js');
        handleDevTool.mockResolvedValue(mockHealthResult);

        const result = await handleDashboardTool('export_dashboard_pdf', {
          directory: TEST_DIR,
          includeCharts: true,
          includeHistory: true
        });

        expect(result.success).toBe(true);
        expect(result.data.pdf).toBeDefined();
        expect(result.data.pdf.file).toBeDefined();
        expect(result.data.pdf.size).toBeGreaterThan(0);
        expect(result.data.pdf.pages).toBeGreaterThan(0);
      });
    });
  });

  describe('Git Hook Tools', () => {
    describe('createGitHookTools', () => {
      it('should create Git hook tools with correct schemas', () => {
        const tools = createGitHookTools();
        
        expect(tools).toHaveLength(3);
        expect(tools[0].name).toBe('setup_git_hooks');
        expect(tools[1].name).toBe('run_pre_commit_checks');
        expect(tools[2].name).toBe('remove_git_hooks');
        
        // Verify input schemas
        expect(tools[0].inputSchema.properties.directory).toBeDefined();
        expect(tools[0].inputSchema.properties.hooks).toBeDefined();
        expect(tools[1].inputSchema.properties.config).toBeDefined();
        expect(tools[2].inputSchema.properties.hooks).toBeDefined();
      });
    });

    describe('setup_git_hooks', () => {
      it('should setup Git hooks successfully', async () => {
        // Mock Git repository
        const gitDir = join(TEST_DIR, '.git', 'hooks');
        mkdirSync(gitDir, { recursive: true });

        const result = await handleGitHookTool('setup_git_hooks', {
          directory: TEST_DIR,
          hooks: ['pre-commit'],
          config: {
            healthGate: true,
            linting: true,
            tests: true,
            thresholds: { healthScore: 70 }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.hooks).toHaveLength(1);
        expect(result.data.hooks[0].type).toBe('pre-commit');
        expect(result.data.hooks[0].installed).toBe(true);
        expect(result.data.message).toContain('Successfully installed');
      });

      it('should handle non-Git repository', async () => {
        const result = await handleGitHookTool('setup_git_hooks', {
          directory: './non-git-directory',
          hooks: ['pre-commit']
        });

        expect(result.success).toBe(true);
        expect(result.data.hooks).toHaveLength(0);
        expect(result.data.message).toBe('Not a Git repository');
      });
    });

    describe('run_pre_commit_checks', () => {
      it('should run pre-commit checks successfully', async () => {
        // Mock successful health check
        const mockHealthResult = {
          success: true,
          data: {
            passed: true,
            healthScore: 85,
            breakdown: { tests: { passed: 10, failed: 0, score: 100 } },
            recommendations: []
          }
        };

        const { handleDevTool } = require('../src/tools/devTools.js');
        handleDevTool.mockResolvedValue(mockHealthResult);

        const result = await handleGitHookTool('run_pre_commit_checks', {
          directory: TEST_DIR,
          config: {
            healthGate: true,
            linting: true,
            tests: true,
            thresholds: { healthScore: 70 }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.result.passed).toBe(true);
        expect(result.data.result.checks.healthGate.passed).toBe(true);
        expect(result.data.result.summary.totalChecks).toBeGreaterThan(0);
      });

      it('should fail when health score is low', async () => {
        // Mock low health score
        const mockHealthResult = {
          success: true,
          data: {
            passed: false,
            healthScore: 60,
            breakdown: { tests: { passed: 5, failed: 3, score: 62 } },
            recommendations: ['Fix failing tests']
          }
        };

        const { handleDevTool } = require('../src/tools/devTools.js');
        handleDevTool.mockResolvedValue(mockHealthResult);

        const result = await handleGitHookTool('run_pre_commit_checks', {
          directory: TEST_DIR,
          config: {
            healthGate: true,
            thresholds: { healthScore: 70 }
          }
        });

        expect(result.success).toBe(true);
        expect(result.data.result.passed).toBe(false);
        expect(result.data.result.checks.healthGate.passed).toBe(false);
        expect(result.data.result.recommendations.length).toBeGreaterThan(0);
      });

      it('should bypass checks when requested', async () => {
        const result = await handleGitHookTool('run_pre_commit_checks', {
          directory: TEST_DIR,
          bypass: true
        });

        expect(result.success).toBe(true);
        expect(result.data.result.passed).toBe(true);
        expect(result.data.message).toBe('Checks bypassed');
      });
    });

    describe('remove_git_hooks', () => {
      it('should remove Git hooks successfully', async () => {
        // Setup mock Git hooks
        const gitDir = join(TEST_DIR, '.git', 'hooks');
        mkdirSync(gitDir, { recursive: true });
        
        const hookFile = join(gitDir, 'pre-commit');
        writeFileSync(hookFile, '# Enhanced MCP Server Git Hook\n', 'utf-8');

        const result = await handleGitHookTool('remove_git_hooks', {
          directory: TEST_DIR,
          hooks: ['pre-commit']
        });

        expect(result.success).toBe(true);
        expect(result.data.removed).toContain('pre-commit');
        expect(result.data.message).toContain('Removed');
      });
    });
  });

  describe('PDF Export Tools', () => {
    describe('createPDFExportTools', () => {
      it('should create PDF export tools with correct schemas', () => {
        const tools = createPDFExportTools();
        
        expect(tools).toHaveLength(3);
        expect(tools[0].name).toBe('export_project_pdf');
        expect(tools[1].name).toBe('export_health_report_pdf');
        expect(tools[2].name).toBe('export_security_report_pdf');
        
        // Verify input schemas
        expect(tools[0].inputSchema.properties.directory).toBeDefined();
        expect(tools[0].inputSchema.properties.title).toBeDefined();
        expect(tools[0].inputSchema.properties.theme).toBeDefined();
        expect(tools[1].inputSchema.properties.threshold).toBeDefined();
        expect(tools[2].inputSchema.properties.includeVulnerabilities).toBeDefined();
      });
    });

    describe('export_project_pdf', () => {
      it('should export project PDF successfully', async () => {
        // Mock successful tool results
        const mockHealthResult = {
          success: true,
          data: { healthScore: 85, breakdown: {}, recommendations: [] }
        };

        const mockTestResult = {
          success: true,
          data: { passed: 10, failed: 0, coverage: 85 }
        };

        const { handleDevTool } = require('../src/tools/devTools.js');
        const { handleCITool } = require('../src/tools/ciTools.js');

        handleDevTool
          .mockResolvedValueOnce(mockHealthResult)  // project_health_check
          .mockResolvedValueOnce(mockTestResult);   // run_tests

        handleCITool
          .mockResolvedValueOnce(mockHealthResult)  // ci_health_gate
          .mockResolvedValueOnce({ success: true, data: { score: 90, vulnerabilities: [] } }); // security_audit

        const result = await handlePDFExportTool('export_project_pdf', {
          directory: TEST_DIR,
          title: 'Test Project Report',
          author: 'Test Author',
          theme: 'professional',
          includeCharts: true,
          includeCode: false,
          includeHistory: true
        });

        expect(result.success).toBe(true);
        expect(result.data.pdf).toBeDefined();
        expect(result.data.pdf.file).toBeDefined();
        expect(result.data.pdf.size).toBeGreaterThan(0);
        expect(result.data.pdf.pages).toBeGreaterThan(0);
        expect(result.data.report).toBeDefined();
        expect(result.data.message).toContain('Project PDF exported successfully');
      });

      it('should handle missing directory', async () => {
        const result = await handlePDFExportTool('export_project_pdf', {
          directory: './non-existent-directory',
          title: 'Test Report'
        });

        expect(result.success).toBe(true);
        expect(result.data.pdf.file).toBe('');
        expect(result.data.message).toBe('Directory not found');
      });
    });

    describe('export_health_report_pdf', () => {
      it('should export health report PDF successfully', async () => {
        // Mock successful health check
        const mockHealthResult = {
          success: true,
          data: {
            passed: true,
            healthScore: 85,
            breakdown: { tests: { passed: 10, failed: 0, score: 100 } },
            recommendations: []
          }
        };

        const { handleCITool } = require('../src/tools/ciTools.js');
        handleCITool.mockResolvedValue(mockHealthResult);

        const result = await handlePDFExportTool('export_health_report_pdf', {
          directory: TEST_DIR,
          threshold: 80,
          includeRecommendations: true,
          includeTrends: true
        });

        expect(result.success).toBe(true);
        expect(result.data.pdf).toBeDefined();
        expect(result.data.pdf.file).toBeDefined();
        expect(result.data.pdf.size).toBeGreaterThan(0);
        expect(result.data.health).toBeDefined();
        expect(result.data.message).toContain('Health report PDF exported successfully');
      });
    });

    describe('export_security_report_pdf', () => {
      it('should export security report PDF successfully', async () => {
        // Mock successful security audit
        const mockSecurityResult = {
          success: true,
          data: {
            score: 90,
            vulnerabilities: [],
            dependencies: { total: 5, vulnerable: 0 }
          }
        };

        const { handleCITool } = require('../src/tools/ciTools.js');
        handleCITool.mockResolvedValue(mockSecurityResult);

        const result = await handlePDFExportTool('export_security_report_pdf', {
          directory: TEST_DIR,
          includeVulnerabilities: true,
          includeDependencies: true,
          includeRecommendations: true
        });

        expect(result.success).toBe(true);
        expect(result.data.pdf).toBeDefined();
        expect(result.data.pdf.file).toBeDefined();
        expect(result.data.pdf.size).toBeGreaterThan(0);
        expect(result.data.security).toBeDefined();
        expect(result.data.message).toContain('Security report PDF exported successfully');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockRejectedValue(new Error('Tool execution failed'));

      const result = await handleDashboardTool('create_dashboard', {
        directory: TEST_DIR,
        title: 'Test Dashboard'
      });

      expect(result.success).toBe(true);
      expect(result.data.dashboard.metrics.health.score).toBe(0);
    });

    it('should handle unknown tool names', async () => {
      const result = await handleDashboardTool('unknown_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown Dashboard tool');
    });
  });
});
