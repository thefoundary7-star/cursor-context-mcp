#!/usr/bin/env node

/**
 * Enhanced MCP Server - Professional-grade filesystem server with 26+ advanced features
 *
 * Extends @modelcontextprotocol/server-filesystem with:
 * - Enhanced file operations with security
 * - Code navigation and symbol search
 * - Test framework integration
 * - Documentation analysis
 * - Dependency analysis
 * - Advanced git integration
 * - Performance monitoring
 * - Security auditing
 * - Intelligent caching
 * - Real-time file watching
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { program } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Core components
import { EnhancedFileOperations } from './core/file-operations.js';
import { CodeIndexer } from './core/code-indexer.js';
import { EnhancedCache } from './performance/cache.js';
import { PerformanceMonitor } from './performance/monitor.js';
import { PathValidator } from './utils/path-validation.js';

// License system
import { LicenseManager } from './licensing/license-manager.js';

// Tools
import { createFileTools, handleFileTool } from './tools/file-tools.js';
import { createCodeTools, handleCodeTool } from './tools/code-tools.js';
import { createTestTools, handleTestTool } from './tools/testTools.js';
import { createGitTools, handleGitTool } from './tools/gitTools.js';
import { createSecurityTools, handleSecurityTool } from './tools/securityTools.js';
import { createDocumentationTools, handleDocumentationTool } from './tools/documentationTools.js';
import { createDevTools, handleDevTool } from './tools/devTools.js';
import { createCITools, handleCITool } from './tools/ciTools.js';
import { createDashboardTools, handleDashboardTool } from './tools/dashboardTools.js';
import { createGitHookTools, handleGitHookTool } from './tools/gitHookTools.js';
import { createPDFExportTools, handlePDFExportTool } from './tools/pdfExportTools.js';

// Types and schemas
import type { ConfigurationOptions, ToolResponse } from './types/index.js';
import { ConfigurationOptionsSchema, validateSchema, createSafeResult } from './types/schemas.js';

// Version
const VERSION = '2.1.0';

interface ServerComponents {
  fileOps: EnhancedFileOperations;
  codeIndexer: CodeIndexer;
  cache: EnhancedCache;
  performanceMonitor: PerformanceMonitor;
  pathValidator: PathValidator;
  licenseManager: LicenseManager;
  config: ConfigurationOptions;
}

/**
 * Run startup self-test to verify all tools are working
 */
async function runStartupSelfTest(): Promise<void> {
  try {
    console.error(chalk.blue('[SELF_TEST] Running startup self-test...'));
    
    // Call the self_test tool with quick mode
    const result = await handleDevTool('self_test', { mode: 'quick' });
    
    if (result.success && result.data) {
      const testResults = result.data as any;
      const { success, warnings, failures, skipped, details } = testResults;
      
      console.error(chalk.green(`[SELF_TEST] Self-test completed: ${success} success, ${warnings} warnings, ${failures} failures, ${skipped} skipped`));
      
      // If there are failures, print the details
      if (failures > 0) {
        console.error(chalk.red('[SELF_TEST] Failures detected:'));
        const failureDetails = details.filter((detail: any) => detail.status === 'failure');
        failureDetails.forEach((detail: any) => {
          console.error(chalk.red(`  - ${detail.tool}: ${detail.reason}`));
        });
      }
      
      // If there are warnings, print them
      if (warnings > 0) {
        console.error(chalk.yellow('[SELF_TEST] Warnings detected:'));
        const warningDetails = details.filter((detail: any) => detail.status === 'warning');
        warningDetails.forEach((detail: any) => {
          console.error(chalk.yellow(`  - ${detail.tool}: ${detail.reason}`));
        });
      }
    } else {
      console.error(chalk.red('[SELF_TEST] Self-test failed to execute properly'));
      if (result.error) {
        console.error(chalk.red(`[SELF_TEST] Error: ${result.error}`));
      }
    }
  } catch (error) {
    console.error(chalk.red('[SELF_TEST] Self-test execution failed:'), error);
  }
}

class EnhancedMCPServer {
  private server: Server;
  private components: ServerComponents;

  constructor(config: ConfigurationOptions) {
    this.server = new Server(
      {
        name: '@filebridge/enhanced-mcp-server',
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize components
    const cache = new EnhancedCache({
      maxSize: Math.floor(config.maxCacheSize / 1024), // Convert to reasonable cache size
      ttl: config.cacheTimeout,
      enableMonitoring: config.enablePerformanceMonitoring,
    });

    const performanceMonitor = new PerformanceMonitor({
      enableMetrics: config.enablePerformanceMonitoring,
      slowOperationThreshold: config.rateLimits.slowOperationThreshold * 1000,
      memoryMonitoring: true,
    });

    const pathValidator = new PathValidator(config);
    const fileOps = new EnhancedFileOperations(config, cache, performanceMonitor);
    const codeIndexer = new CodeIndexer(config, cache, performanceMonitor);

    // Initialize license manager
    const licenseManager = new LicenseManager(
      process.env.LICENSE_API_URL || 'http://localhost:3001/api/validate-license',
      config.debugMode || false
    );

    this.components = {
      fileOps,
      codeIndexer,
      cache,
      performanceMonitor,
      pathValidator,
      licenseManager,
      config,
    };

    this.setupToolHandlers();
    this.setupEventListeners();
  }

  private setupToolHandlers(): void {
    // Register list_tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const fileTools = createFileTools(this.components.fileOps);
      const codeTools = createCodeTools(this.components.codeIndexer);
      const testTools = createTestTools();
      const gitTools = createGitTools();
      const securityTools = createSecurityTools();
      const documentationTools = createDocumentationTools();
      const devTools = createDevTools();
      const ciTools = createCITools();
      const dashboardTools = createDashboardTools();
      const gitHookTools = createGitHookTools();
      const pdfExportTools = createPDFExportTools();

      return {
        tools: [
          ...fileTools,
          ...codeTools,
          ...testTools,
          ...gitTools,
          ...securityTools,
          ...documentationTools,
          ...devTools,
          ...ciTools,
          ...dashboardTools,
          ...gitHookTools,
          ...pdfExportTools,
          // Add configuration and monitoring tools
          {
            name: 'get_server_config',
            description: 'Get current server configuration and status',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'update_config',
            description: 'Update server configuration (limited subset for security)',
            inputSchema: {
              type: 'object',
              properties: {
                enableFileWatching: { type: 'boolean' },
                enablePerformanceMonitoring: { type: 'boolean' },
                logLevel: {
                  type: 'string',
                  enum: ['debug', 'info', 'warn', 'error'],
                },
                maxCacheSize: {
                  type: 'number',
                  minimum: 1024 * 1024, // 1MB minimum
                  maximum: 1024 * 1024 * 1024, // 1GB maximum
                },
                cacheTimeout: {
                  type: 'number',
                  minimum: 1000, // 1 second minimum
                  maximum: 3600000, // 1 hour maximum
                },
              },
              required: [],
            },
          },
          {
            name: 'get_performance_stats',
            description: 'Get comprehensive performance statistics',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'clear_caches',
            description: 'Clear all caches to free memory',
            inputSchema: {
              type: 'object',
              properties: {
                confirm: {
                  type: 'boolean',
                  description: 'Confirmation that you want to clear caches',
                  default: false,
                },
              },
              required: [],
            },
          },
          {
            name: 'get_license_status',
            description: 'Get current license status and usage information',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'activate_license',
            description: 'Activate a license key',
            inputSchema: {
              type: 'object',
              properties: {
                licenseKey: {
                  type: 'string',
                  description: 'The license key to activate',
                },
              },
              required: ['licenseKey'],
            },
          },
        ],
      };
    });

    // Register call_tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Log all tool invocations for debugging
      console.error(`[TOOL] Invoked: ${name} with args:`, JSON.stringify(args, null, 2));

      try {
        // Check license for the requested feature
        console.error(`[TOOL] Checking license access for: ${name}`);
        const accessCheck = await this.components.licenseManager.checkFeatureAccess(name);

        if (!accessCheck.allowed) {
          console.error(`[TOOL] Access denied for ${name}: ${accessCheck.reason}`);
          // Show upgrade prompt for premium features
          await this.components.licenseManager.showUpgradePrompt(name);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: accessCheck.reason,
                  code: 'FEATURE_LOCKED',
                  upgrade_url: 'https://filebridge.dev/pricing',
                  preview: this.components.licenseManager.getFeaturePreview(name)
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        console.error(`[TOOL] Access granted for: ${name}`);
        let result: ToolResponse;

        // Route to appropriate tool handler
        const fileToolNames = [
          'list_files', 'read_file', 'write_file', 'search_files', 'get_file_diff', 'get_file_stats'
        ];
        const codeToolNames = [
          'search_symbols', 'find_references', 'index_directory', 'get_index_stats', 'clear_index', 'get_symbol_info'
        ];
        const testToolNames = [
          'run_tests', 'detect_test_framework', 'get_test_status', 'run_test_file', 'test_coverage_analysis'
        ];
        const gitToolNames = [
          'get_commit_history', 'get_file_blame', 'get_branch_info', 'find_commits_touching_file'
        ];
        const securityToolNames = [
          'security_audit', 'analyze_dependencies', 'check_vulnerabilities', 'dependency_tree_analysis', 'license_compliance_check'
        ];
        const documentationToolNames = [
          'get_documentation', 'documentation_coverage', 'generate_docs'
        ];
        const devToolNames = [
          'project_health_check',
          'code_quality_metrics',
          'refactoring_suggestions',
          'project_trend_tracking',
          'ide_feedback_stream'
        ];
        const ciToolNames = [
          'ci_health_gate',
          'generate_project_report'
        ];
        const dashboardToolNames = [
          'create_dashboard',
          'get_dashboard_metrics',
          'export_dashboard_pdf'
        ];
        const gitHookToolNames = [
          'setup_git_hooks',
          'run_pre_commit_checks',
          'remove_git_hooks'
        ];
        const pdfExportToolNames = [
          'export_project_pdf',
          'export_health_report_pdf',
          'export_security_report_pdf'
        ];

        if (fileToolNames.includes(name)) {
          console.error(`[TOOL] Routing to file tool handler: ${name}`);
          result = await handleFileTool(name, args, this.components.fileOps);
        } else if (codeToolNames.includes(name)) {
          console.error(`[TOOL] Routing to code tool handler: ${name}`);
          result = await handleCodeTool(name, args, this.components.codeIndexer);
        } else if (testToolNames.includes(name)) {
          console.error(`[TOOL] Routing to test tool handler: ${name}`);
          result = await handleTestTool(name, args);
        } else if (gitToolNames.includes(name)) {
          console.error(`[TOOL] Routing to git tool handler: ${name}`);
          result = await handleGitTool(name, args);
        } else if (securityToolNames.includes(name)) {
          console.error(`[TOOL] Routing to security tool handler: ${name}`);
          result = await handleSecurityTool(name, args);
        } else if (documentationToolNames.includes(name)) {
          console.error(`[TOOL] Routing to documentation tool handler: ${name}`);
          result = await handleDocumentationTool(name, args);
        } else if (devToolNames.includes(name)) {
          console.error(`[TOOL] Routing to dev tool handler: ${name}`);
          result = await handleDevTool(name, args);
        } else if (ciToolNames.includes(name)) {
          console.error(`[TOOL] Routing to CI tool handler: ${name}`);
          result = await handleCITool(name, args);
        } else if (dashboardToolNames.includes(name)) {
          console.error(`[TOOL] Routing to dashboard tool handler: ${name}`);
          result = await handleDashboardTool(name, args);
        } else if (gitHookToolNames.includes(name)) {
          console.error(`[TOOL] Routing to Git hook tool handler: ${name}`);
          result = await handleGitHookTool(name, args);
        } else if (pdfExportToolNames.includes(name)) {
          console.error(`[TOOL] Routing to PDF export tool handler: ${name}`);
          result = await handlePDFExportTool(name, args);
        } else {
          console.error(`[TOOL] Routing to server tool handler: ${name}`);
          // Handle server management tools
          result = await this.handleServerTool(name, args);
        }

        console.error(`[TOOL] Execution completed for ${name}:`, {
          success: result.success,
          error: result.error,
          hasData: !!result.data
        });

        // Record usage for successful operations
        if (result.success) {
          await this.components.licenseManager.recordUsage(name);
          console.error(`[TOOL] Usage recorded for: ${name}`);
        } else {
          console.error(`[TOOL] Tool execution failed for ${name}:`, result.error);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !result.success,
        };
      } catch (error) {
        console.error(`[TOOL] Exception in tool handler for ${name}:`, error);
        console.error(`[TOOL] Error type:`, error?.constructor?.name);
        console.error(`[TOOL] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

        const errorResult = createSafeResult(
          name,
          undefined,
          error instanceof Error ? error.message : String(error)
        );

        console.error(`[TOOL] Returning error result:`, errorResult);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorResult, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleServerTool(toolName: string, args: unknown): Promise<ToolResponse> {
    switch (toolName) {
      case 'get_server_config':
        return createSafeResult('get_server_config', {
          version: VERSION,
          config: {
            allowedDirectories: this.components.config.allowedDirectories,
            enableFileWatching: this.components.config.enableFileWatching,
            enablePerformanceMonitoring: this.components.config.enablePerformanceMonitoring,
            readOnlyMode: this.components.config.readOnlyMode,
            logLevel: this.components.config.logLevel,
            supportedLanguages: this.components.config.supportedLanguages,
          },
          stats: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform,
          },
        });

      case 'update_config': {
        const updateArgs = args as any;

        // Update configuration (only safe properties)
        const updates: Partial<ConfigurationOptions> = {};

        if (updateArgs.enableFileWatching !== undefined) {
          updates.enableFileWatching = updateArgs.enableFileWatching;
        }
        if (updateArgs.enablePerformanceMonitoring !== undefined) {
          updates.enablePerformanceMonitoring = updateArgs.enablePerformanceMonitoring;
        }
        if (updateArgs.logLevel !== undefined) {
          updates.logLevel = updateArgs.logLevel;
        }
        if (updateArgs.maxCacheSize !== undefined) {
          updates.maxCacheSize = updateArgs.maxCacheSize;
        }
        if (updateArgs.cacheTimeout !== undefined) {
          updates.cacheTimeout = updateArgs.cacheTimeout;
        }

        // Apply updates to config
        Object.assign(this.components.config, updates);
        this.components.fileOps.updateConfig(updates);

        // Update cache configuration
        if (updates.maxCacheSize || updates.cacheTimeout) {
          this.components.cache.updateConfig({
            maxSize: updates.maxCacheSize ? Math.floor(updates.maxCacheSize / 1024) : undefined,
            ttl: updates.cacheTimeout,
          });
        }

        return createSafeResult('update_config', {
          updated: Object.keys(updates),
          newConfig: this.components.config,
        });
      }

      case 'get_performance_stats':
        return createSafeResult('get_performance_stats', {
          server: this.components.performanceMonitor.getAllStatistics(),
          cache: this.components.cache.getStats(),
          indexer: this.components.codeIndexer.getStats(),
          system: this.components.performanceMonitor.getResourceUsage(),
        });

      case 'clear_caches': {
        const clearArgs = args as any;

        if (!clearArgs.confirm) {
          return createSafeResult(
            'clear_caches',
            undefined,
            'Cache clearing requires confirmation. Set "confirm": true to proceed.'
          );
        }

        // Clear all caches
        this.components.cache.clear();
        this.components.codeIndexer.clearIndex();
        this.components.performanceMonitor.clearMetrics();

        return createSafeResult('clear_caches', {
          cleared: true,
          message: 'All caches have been cleared successfully',
        });
      }

      case 'get_license_status':
        return createSafeResult('get_license_status', {
          ...this.components.licenseManager.getStatus(),
          machineId: this.components.licenseManager['machineId'],
          upgradeUrl: 'https://filebridge.dev/pricing'
        });

      case 'activate_license': {
        const activateArgs = args as any;

        if (!activateArgs.licenseKey) {
          return createSafeResult(
            'activate_license',
            undefined,
            'License key is required'
          );
        }

        const success = await this.components.licenseManager.setLicenseKey(activateArgs.licenseKey);

        if (success) {
          return createSafeResult('activate_license', {
            success: true,
            message: 'License activated successfully',
            status: this.components.licenseManager.getStatus()
          });
        } else {
          return createSafeResult(
            'activate_license',
            undefined,
            'Failed to activate license. Please check your license key.'
          );
        }
      }

      default:
        return createSafeResult(
          toolName,
          undefined,
          `Unknown server tool: ${toolName}`
        );
    }
  }

  private setupEventListeners(): void {
    // File operations events
    this.components.fileOps.on('fileRead', (data) => {
      console.error(chalk.blue(`[FILE] Read: ${data.filePath} (${data.size} bytes)`));
    });

    this.components.fileOps.on('fileWritten', (data) => {
      console.error(chalk.green(`[FILE] Written: ${data.filePath} (${data.size} bytes)`));
    });

    // Code indexer events
    this.components.codeIndexer.on('fileIndexed', (data) => {
      console.error(chalk.yellow(`[INDEX] ${data.filePath} (${data.symbolCount} symbols)`));
    });

    this.components.codeIndexer.on('indexCompleted', (stats) => {
      console.error(chalk.green(
        `[INDEX] Completed: ${stats.indexedFiles}/${stats.totalFiles} files, ` +
        `${stats.totalSymbols} symbols in ${stats.indexDuration}ms`
      ));
    });

    // Performance events
    this.components.performanceMonitor.on('slowOperation', (metric) => {
      console.error(chalk.red(
        `[PERF] Slow operation: ${metric.operationName} took ${metric.duration.toFixed(2)}ms`
      ));
    });

    // Process events
    process.on('SIGINT', () => {
      console.error(chalk.yellow('\n[SERVER] Shutting down gracefully...'));
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error(chalk.red('[ERROR] Uncaught exception:'), error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error(chalk.red('[ERROR] Unhandled rejection:'), reason);
    });
  }

  async start(): Promise<void> {
    // Initialize license manager
    await this.components.licenseManager.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(chalk.green(`[SERVER] Enhanced MCP Server v${VERSION} started successfully`));
    console.error(chalk.blue(`[CONFIG] Allowed directories: ${this.components.config.allowedDirectories.join(', ')}`));

    // Show license status on startup
    const licenseStatus = this.components.licenseManager.getStatus();
    console.error(chalk.cyan(`[LICENSE] Tier: ${licenseStatus.tier} | Features: ${licenseStatus.features} | Usage: ${licenseStatus.usage.callsToday}/${licenseStatus.usage.limit === -1 ? 'unlimited' : licenseStatus.usage.limit}`));

    if (!licenseStatus.hasLicense) {
      console.error(chalk.yellow('[LICENSE] Running in FREE mode. Upgrade to PRO for unlimited access: https://filebridge.dev/pricing'));
    }

    // Run startup self-test if enabled
    if (process.env.SELF_TEST_ON_STARTUP === 'true') {
      await runStartupSelfTest();
    }
  }
}

// Configuration loading
function loadConfiguration(configPath?: string): ConfigurationOptions {
  const defaultConfig: ConfigurationOptions = {
    allowedDirectories: [process.cwd()],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    cacheTimeout: 300000, // 5 minutes
    enableFileWatching: false, // Disabled by default for stability
    enablePerformanceMonitoring: true,
    enableSecurityScanning: false, // Disabled by default
    readOnlyMode: false,
    logLevel: 'info',
    rateLimits: {
      maxRequestsPerMinute: 60,
      maxConcurrentOperations: 10,
      slowOperationThreshold: 5.0,
    },
    supportedLanguages: ['typescript', 'javascript', 'python', 'go'],
    indexingOptions: {
      autoIndex: true,
      maxFilesPerBatch: 100,
      debounceDelay: 500,
      excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.go'],
      maxFileSize: 1024 * 1024, // 1MB for indexing
    },
  };

  // Load from file if specified
  if (configPath && existsSync(configPath)) {
    try {
      const configData = require(resolve(configPath));
      const mergedConfig = { ...defaultConfig };

      // Only merge defined values
      for (const [key, value] of Object.entries(configData)) {
        if (value !== undefined) {
          (mergedConfig as any)[key] = value;
        }
      }

      return ConfigurationOptionsSchema.parse(mergedConfig);
    } catch (error) {
      console.error(chalk.red(`[CONFIG] Failed to load configuration from ${configPath}:`, error));
      console.error(chalk.yellow('[CONFIG] Using default configuration'));
    }
  }

  // Load from environment variables
  if (process.env.MCP_ALLOWED_DIRECTORIES) {
    defaultConfig.allowedDirectories = process.env.MCP_ALLOWED_DIRECTORIES.split(':');
  }

  if (process.env.MCP_READ_ONLY === 'true') {
    defaultConfig.readOnlyMode = true;
  }

  if (process.env.MCP_LOG_LEVEL) {
    defaultConfig.logLevel = process.env.MCP_LOG_LEVEL as any;
  }

  return defaultConfig;
}

// CLI setup
async function main(): Promise<void> {
  program
    .name('enhanced-mcp-server')
    .description('Enhanced MCP Server with advanced file operations and code navigation')
    .version(VERSION)
    .option('-c, --config <path>', 'Configuration file path')
    .option('-d, --directories <dirs>', 'Allowed directories (comma-separated)')
    .option('--read-only', 'Enable read-only mode')
    .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
    .option('--no-performance', 'Disable performance monitoring')
    .option('--license <key>', 'Activate license key')
    .option('--setup-license', 'Interactive license setup')
    .option('--debug-mode', 'Enable debug mode (bypass all license restrictions)')
    .parse();

  const options = program.opts();

  try {
    // Load configuration
    const config = loadConfiguration(options.config);

    // Override with CLI options
    if (options.directories) {
      config.allowedDirectories = options.directories.split(',').map((d: string) => resolve(d.trim()));
    }

    if (options.readOnly) {
      config.readOnlyMode = true;
    }

    if (options.logLevel) {
      config.logLevel = options.logLevel;
    }

    if (options.noPerformance) {
      config.enablePerformanceMonitoring = false;
    }

    if (options.debugMode) {
      config.debugMode = true;
      console.error(chalk.yellow('[DEBUG] Debug mode enabled - all license restrictions bypassed'));
    }

    // Handle license commands
    if (options.setupLicense || options.license) {
      const licenseManager = new LicenseManager(
        process.env.LICENSE_API_URL || 'http://localhost:3001/api/validate-license',
        options.debugMode || false
      );
      await licenseManager.initialize();

      if (options.setupLicense) {
        await licenseManager.setupInteractive();
        process.exit(0);
      }

      if (options.license) {
        console.error(chalk.blue('Activating license...'));
        const success = await licenseManager.setLicenseKey(options.license);

        if (success) {
          console.error(chalk.green('License activated successfully!'));
          const status = licenseManager.getStatus();
          console.error(`   Tier: ${status.tier}`);
          console.error(`   Features: ${status.features}`);
          console.error(`   Daily Usage: ${status.usage.callsToday}/${status.usage.limit === -1 ? 'unlimited' : status.usage.limit}`);
        } else {
          console.error(chalk.red('License activation failed. Please check your license key.'));
          process.exit(1);
        }

        await licenseManager.cleanup();
        process.exit(0);
      }
    }

    // Check for environment variable license
    const envLicense = process.env.FILEBRIDGE_LICENSE;
    if (envLicense) {
      console.error(chalk.blue('Found license in environment variable'));
    }

    // Validate directories exist
    for (const dir of config.allowedDirectories) {
      if (!existsSync(dir)) {
        console.error(chalk.red(`[ERROR] Directory does not exist: ${dir}`));
        process.exit(1);
      }
    }

    // Start server
    const server = new EnhancedMCPServer(config);
    await server.start();

  } catch (error) {
    console.error(chalk.red('[ERROR] Failed to start server:'), error);
    process.exit(1);
  }
}

// Start if this is the main module
// Fix for Windows path separators
const currentFile = import.meta.url.replace(/^file:\/\//, '').replace(/\//g, '\\').replace(/^\\/, '');
const scriptFile = process.argv[1]?.replace(/\//g, '\\');

if (currentFile === scriptFile || import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('[FATAL]'), error);
    process.exit(1);
  });
}

export { EnhancedMCPServer, loadConfiguration };