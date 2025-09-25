/**
 * Enhanced MCP Server Types
 * Professional-grade TypeScript types for all enhanced features
 */

export interface Symbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'import' | 'interface' | 'type' | 'enum';
  filePath: string;
  lineNumber: number;
  definition: string;
  docstring?: string;
  scope?: string;
  parameters?: Parameter[];
  returnType?: string;
  isExported?: boolean;
  isAsync?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

export interface Parameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface Reference {
  symbolName: string;
  filePath: string;
  lineNumber: number;
  context: string;
  refType: 'call' | 'import' | 'assignment' | 'inheritance' | 'reference' | 'definition';
  columnStart?: number;
  columnEnd?: number;
}

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  errorMessage?: string;
  filePath?: string;
  stackTrace?: string;
  stdout?: string;
  stderr?: string;
}

export interface TestFrameworkResult {
  framework: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: CoverageReport;
  results: TestResult[];
}

export interface CoverageReport {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncoveredLines: number[];
}

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export interface GitBlameInfo {
  lineNumber: number;
  author: string;
  email: string;
  hash: string;
  date: string;
  content: string;
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  lastCommit: string;
  ahead?: number;
  behind?: number;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  license?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  vulnerabilities?: SecurityVulnerability[];
  outdated?: boolean;
  latestVersion?: string;
}

export interface SecurityVulnerability {
  id: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  references: string[];
  patchedIn?: string;
}

export interface DocumentationItem {
  type: 'readme' | 'docstring' | 'comment' | 'jsdoc' | 'typescript';
  filePath: string;
  lineNumber?: number;
  content: string;
  title?: string;
  description?: string;
  examples?: string[];
  parameters?: Parameter[];
  returns?: string;
  throws?: string[];
  see?: string[];
  since?: string;
  deprecated?: boolean;
}

export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  startTime: number;
  endTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  success: boolean;
  errorMessage?: string;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry?: number;
  newestEntry?: number;
}

export interface FileChange {
  filePath: string;
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  timestamp: number;
  size?: number;
  previousPath?: string; // for renames
}

export interface IndexStats {
  totalFiles: number;
  indexedFiles: number;
  totalSymbols: number;
  lastIndexTime: number;
  indexDuration: number;
  filesByLanguage: Record<string, number>;
  symbolsByType: Record<string, number>;
  errors: string[];
}

export interface SecurityAuditResult {
  filePath: string;
  issues: SecurityIssue[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  scannedAt: number;
}

export interface SecurityIssue {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  lineNumber?: number;
  columnNumber?: number;
  rule: string;
  recommendation?: string;
}

export interface ConfigurationOptions {
  allowedDirectories: string[];
  maxFileSize: number;
  maxCacheSize: number;
  cacheTimeout: number;
  enableFileWatching: boolean;
  enablePerformanceMonitoring: boolean;
  enableSecurityScanning: boolean;
  readOnlyMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimits: RateLimitConfig;
  supportedLanguages: string[];
  indexingOptions: IndexingOptions;
  debugMode?: boolean;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxConcurrentOperations: number;
  slowOperationThreshold: number;
}

export interface IndexingOptions {
  autoIndex: boolean;
  maxFilesPerBatch: number;
  debounceDelay: number;
  excludePatterns: string[];
  includePatterns: string[];
  maxFileSize: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  diskSpace: number;
  activeConnections: number;
  lastError?: string;
  components: ComponentHealth[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  details?: Record<string, any>;
}

export interface SearchOptions {
  query: string;
  directory?: string;
  fileExtensions?: string[];
  symbolType?: string;
  fuzzy?: boolean;
  maxResults?: number;
  includeDefinition?: boolean;
  includeReferences?: boolean;
}

export interface SearchResult {
  symbols: Symbol[];
  references: Reference[];
  totalResults: number;
  searchTime: number;
  fromCache: boolean;
}

export enum ErrorCategory {
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not_found',
  INVALID_INPUT = 'invalid_input',
  SYSTEM_ERROR = 'system_error',
  NETWORK_ERROR = 'network_error',
  SECURITY_ERROR = 'security_error',
  CACHE_ERROR = 'cache_error',
  INDEX_ERROR = 'index_error',
}

export interface ErrorContext {
  operation: string;
  filePath?: string;
  userId?: string;
  timestamp: number;
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCategory?: ErrorCategory;
  duration?: number;
  cached?: boolean;
  metadata?: Record<string, any>;
}

// Tool response interfaces for MCP compatibility
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Common response structure for all tools
export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  operation: string;
  duration?: number;
  cached?: boolean;
  metadata?: Record<string, any>;
}

// Re-export for convenience
export * from './schemas.js';