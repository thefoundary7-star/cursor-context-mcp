/**
 * Comprehensive tests for CI/CD Integration tools
 */

import { createCITools, handleCITool } from '../src/tools/ciTools.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

// Mock dependencies
jest.mock('../src/tools/devTools.js');
jest.mock('../src/tools/testTools.js');
jest.mock('../src/tools/securityTools.js');
jest.mock('../src/tools/documentationTools.js');

const TEST_DIR = './test-ci-project';

describe('CI/CD Integration Tools', () => {
  beforeAll(() => {
    // Setup test project
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Create test files
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'test-project',
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

  describe('createCITools', () => {
    it('should create CI tools with correct schemas', () => {
      const tools = createCITools();
      
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('ci_health_gate');
      expect(tools[1].name).toBe('generate_project_report');
      
      // Verify input schemas
      expect(tools[0].inputSchema.properties.threshold).toBeDefined();
      expect(tools[0].inputSchema.properties.projectPath).toBeDefined();
      expect(tools[1].inputSchema.properties.format).toBeDefined();
      expect(tools[1].inputSchema.properties.directory).toBeDefined();
    });
  });

  describe('ci_health_gate', () => {
    it('should pass when health score meets threshold', async () => {
      // Mock successful health check
      const mockHealthResult = {
        success: true,
        data: {
          healthScore: 85,
          breakdown: {
            tests: { passed: 10, failed: 0, score: 100 },
            lint: { errors: 0, warnings: 2, score: 90 },
            dependencies: { total: 5, vulnerable: 0, score: 100 },
            documentation: { coverage: 80, score: 80 }
          },
          recommendations: []
        }
      };

      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockResolvedValue(mockHealthResult);

      const result = await handleCITool('ci_health_gate', {
        threshold: 80,
        projectPath: TEST_DIR,
        includeTests: true,
        includeLint: true,
        includeDependencies: true,
        includeDocs: true
      });

      expect(result.success).toBe(true);
      expect(result.data.passed).toBe(true);
      expect(result.data.healthScore).toBe(85);
      expect(result.data.threshold).toBe(80);
      expect(result.data.failures).toHaveLength(0);
    });

    it('should fail when health score below threshold', async () => {
      // Mock low health score
      const mockHealthResult = {
        success: true,
        data: {
          healthScore: 60,
          breakdown: {
            tests: { passed: 5, failed: 3, score: 62 },
            lint: { errors: 5, warnings: 10, score: 50 },
            dependencies: { total: 5, vulnerable: 2, score: 60 },
            documentation: { coverage: 30, score: 30 }
          },
          recommendations: ['Fix failing tests', 'Address linting errors']
        }
      };

      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockResolvedValue(mockHealthResult);

      const result = await handleCITool('ci_health_gate', {
        threshold: 80,
        projectPath: TEST_DIR
      });

      expect(result.success).toBe(true);
      expect(result.data.passed).toBe(false);
      expect(result.data.healthScore).toBe(60);
      expect(result.data.failures.length).toBeGreaterThan(0);
    });

    it('should handle missing directory', async () => {
      const result = await handleCITool('ci_health_gate', {
        threshold: 80,
        projectPath: './non-existent-directory'
      });

      expect(result.success).toBe(true);
      expect(result.data.passed).toBe(false);
      expect(result.data.failures).toContain('Directory ./non-existent-directory does not exist');
    });

    it('should fail on warnings when failOnWarnings is true', async () => {
      const mockHealthResult = {
        success: true,
        data: {
          healthScore: 85,
          breakdown: {
            tests: { passed: 10, failed: 0, score: 100 },
            lint: { errors: 0, warnings: 5, score: 90 },
            dependencies: { total: 5, vulnerable: 0, score: 100 },
            documentation: { coverage: 80, score: 80 }
          },
          recommendations: []
        }
      };

      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockResolvedValue(mockHealthResult);

      const result = await handleCITool('ci_health_gate', {
        threshold: 80,
        projectPath: TEST_DIR,
        failOnWarnings: true
      });

      expect(result.success).toBe(true);
      expect(result.data.passed).toBe(false);
      expect(result.data.failures).toContain('5 linting warning(s) found');
    });
  });

  describe('generate_project_report', () => {
    it('should generate markdown report successfully', async () => {
      // Mock successful tool results
      const mockHealthResult = {
        success: true,
        data: {
          healthScore: 85,
          breakdown: { tests: { passed: 10, failed: 0, score: 100 } },
          recommendations: []
        }
      };

      const mockTestResult = {
        success: true,
        data: { passed: 10, failed: 0, coverage: 85 }
      };

      const mockSecurityResult = {
        success: true,
        data: { score: 90, vulnerabilities: [] }
      };

      const mockQualityResult = {
        success: true,
        data: { overall: { maintainabilityIndex: 80 } }
      };

      const mockDocResult = {
        success: true,
        data: { coverage: { overall: 75 } }
      };

      // Mock all tool handlers
      const { handleDevTool } = require('../src/tools/devTools.js');
      const { handleTestTool } = require('../src/tools/testTools.js');
      const { handleSecurityTool } = require('../src/tools/securityTools.js');
      const { handleDocumentationTool } = require('../src/tools/documentationTools.js');

      handleDevTool
        .mockResolvedValueOnce(mockHealthResult)  // project_health_check
        .mockResolvedValueOnce(mockQualityResult); // code_quality_metrics

      handleTestTool.mockResolvedValue(mockTestResult);
      handleSecurityTool.mockResolvedValue(mockSecurityResult);
      handleDocumentationTool.mockResolvedValue(mockDocResult);

      const result = await handleCITool('generate_project_report', {
        directory: TEST_DIR,
        format: 'markdown',
        includeTests: true,
        includeSecurity: true,
        includeQuality: true,
        includeDocs: true
      });

      expect(result.success).toBe(true);
      expect(result.data.report).toBeDefined();
      expect(result.data.report.summary.overallHealth).toBe(85);
      expect(result.data.report.summary.testCoverage).toBe(85);
      expect(result.data.format).toBe('markdown');
    });

    it('should generate HTML report', async () => {
      // Mock minimal results
      const mockHealthResult = {
        success: true,
        data: { healthScore: 70, breakdown: {}, recommendations: [] }
      };

      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockResolvedValue(mockHealthResult);

      const result = await handleCITool('generate_project_report', {
        directory: TEST_DIR,
        format: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('html');
    });

    it('should generate JSON report', async () => {
      const mockHealthResult = {
        success: true,
        data: { healthScore: 70, breakdown: {}, recommendations: [] }
      };

      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockResolvedValue(mockHealthResult);

      const result = await handleCITool('generate_project_report', {
        directory: TEST_DIR,
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('json');
    });

    it('should handle missing directory', async () => {
      const result = await handleCITool('generate_project_report', {
        directory: './non-existent-directory',
        format: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.data.report.summary.overallHealth).toBe(0);
    });

    it('should include trends when requested', async () => {
      const mockHealthResult = {
        success: true,
        data: { healthScore: 70, breakdown: {}, recommendations: [] }
      };

      const mockTrendResult = {
        success: true,
        data: { runs: [{ timestamp: '2024-01-01', healthScore: 70 }] }
      };

      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool
        .mockResolvedValueOnce(mockHealthResult)  // project_health_check
        .mockResolvedValueOnce(mockTrendResult); // project_trend_tracking

      const result = await handleCITool('generate_project_report', {
        directory: TEST_DIR,
        format: 'markdown',
        includeTrends: true
      });

      expect(result.success).toBe(true);
      expect(result.data.report.sections.trends).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const { handleDevTool } = require('../src/tools/devTools.js');
      handleDevTool.mockRejectedValue(new Error('Health check failed'));

      const result = await handleCITool('ci_health_gate', {
        threshold: 80,
        projectPath: TEST_DIR
      });

      expect(result.success).toBe(true);
      expect(result.data.passed).toBe(false);
      expect(result.data.failures).toContain('Health gate check failed: Health check failed');
    });

    it('should handle unknown tool names', async () => {
      const result = await handleCITool('unknown_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown CI tool');
    });
  });
});
