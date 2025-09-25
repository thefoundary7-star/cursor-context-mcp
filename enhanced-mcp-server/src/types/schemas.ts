/**
 * Zod schemas for enhanced MCP server validation
 */

import { z } from 'zod';

// Base schemas
export const FilePathSchema = z.string().min(1, 'File path cannot be empty');
export const DirectoryPathSchema = z.string().min(1, 'Directory path cannot be empty');

// Symbol schemas
export const SymbolTypeSchema = z.enum([
  'function',
  'class',
  'variable',
  'import',
  'interface',
  'type',
  'enum',
]);

export const ParameterSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  optional: z.boolean().optional(),
  defaultValue: z.string().optional(),
});

export const SymbolSchema = z.object({
  name: z.string(),
  type: SymbolTypeSchema,
  filePath: z.string(),
  lineNumber: z.number().int().positive(),
  definition: z.string(),
  docstring: z.string().optional(),
  scope: z.string().optional(),
  parameters: z.array(ParameterSchema).optional(),
  returnType: z.string().optional(),
  isExported: z.boolean().optional(),
  isAsync: z.boolean().optional(),
  visibility: z.enum(['public', 'private', 'protected']).optional(),
});

// Reference schemas
export const ReferenceTypeSchema = z.enum([
  'call',
  'import',
  'assignment',
  'inheritance',
  'reference',
  'definition',
]);

export const ReferenceSchema = z.object({
  symbolName: z.string(),
  filePath: z.string(),
  lineNumber: z.number().int().positive(),
  context: z.string(),
  refType: ReferenceTypeSchema,
  columnStart: z.number().int().optional(),
  columnEnd: z.number().int().optional(),
});

// Test schemas
export const TestStatusSchema = z.enum(['passed', 'failed', 'skipped', 'pending']);

export const TestResultSchema = z.object({
  testName: z.string(),
  status: TestStatusSchema,
  duration: z.number().nonnegative(),
  errorMessage: z.string().optional(),
  filePath: z.string().optional(),
  stackTrace: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

// Git schemas
export const GitCommitSchema = z.object({
  hash: z.string(),
  author: z.string(),
  email: z.string().email(),
  date: z.string(),
  message: z.string(),
  filesChanged: z.array(z.string()),
  insertions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const GitBlameInfoSchema = z.object({
  lineNumber: z.number().int().positive(),
  author: z.string(),
  email: z.string().email(),
  hash: z.string(),
  date: z.string(),
  content: z.string(),
});

// Tool input schemas
export const ListFilesArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  pattern: z.string().optional(),
  recursive: z.boolean().default(true),
  includeHidden: z.boolean().default(false),
});

export const ReadFileArgsSchema = z.object({
  filePath: FilePathSchema,
  maxLines: z.number().int().positive().optional(),
  encoding: z.string().default('utf-8'),
});

export const WriteFileArgsSchema = z.object({
  filePath: FilePathSchema,
  content: z.string(),
  createDirectories: z.boolean().default(false),
  backup: z.boolean().default(false),
});

export const SearchSymbolsArgsSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  directory: DirectoryPathSchema.default('.'),
  symbolType: SymbolTypeSchema.optional(),
  autoIndex: z.boolean().default(true),
  fuzzy: z.boolean().default(false),
  fileExtensions: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().default(100),
  includeDefinition: z.boolean().default(true),
  includeReferences: z.boolean().default(false),
});

export const FindReferencesArgsSchema = z.object({
  symbolName: z.string().min(1, 'Symbol name cannot be empty'),
  directory: DirectoryPathSchema.default('.'),
  fileExtensions: z.array(z.string()).optional(),
  contextLines: z.number().int().nonnegative().default(2),
  includeDefinition: z.boolean().default(true),
});

export const RunTestsArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  testPattern: z.string().optional(),
  framework: z.enum(['jest', 'mocha', 'vitest', 'pytest', 'auto']).default('auto'),
  coverage: z.boolean().default(false),
  timeout: z.number().int().positive().default(30000),
});

export const GetDocumentationArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  includeComments: z.boolean().default(true),
  docTypes: z.array(z.enum(['readme', 'docstring', 'comment', 'jsdoc', 'typescript'])).optional(),
  fileExtensions: z.array(z.string()).optional(),
});

export const AnalyzeDependenciesArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  includeDev: z.boolean().default(true),
  checkSecurity: z.boolean().default(false),
  checkOutdated: z.boolean().default(false),
});

export const GitDiffArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  filePath: z.string().optional(),
  staged: z.boolean().default(false),
  unstaged: z.boolean().default(true),
  contextLines: z.number().int().nonnegative().default(3),
});

export const GitCommitHistoryArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  limit: z.number().int().positive().default(10),
  filePath: z.string().optional(),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const SecurityAuditArgsSchema = z.object({
  filePath: FilePathSchema,
  rules: z.array(z.string()).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
});

export const SecurityScanDirectoryArgsSchema = z.object({
  directory: DirectoryPathSchema.default('.'),
  maxFiles: z.number().int().positive().default(100),
  recursive: z.boolean().default(true),
  excludePatterns: z.array(z.string()).optional(),
});

export const PerformanceConfigArgsSchema = z.object({
  maxFilesPerOperation: z.number().int().positive().optional(),
  maxCacheSize: z.number().int().positive().optional(),
  cacheTimeout: z.number().int().positive().optional(),
  enableMonitoring: z.boolean().optional(),
});

export const CacheConfigArgsSchema = z.object({
  enabled: z.boolean().default(true),
  maxSize: z.number().int().positive().default(1000),
  ttl: z.number().int().positive().default(300000), // 5 minutes
});

// Response schemas
export const OperationResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  duration: z.number().optional(),
  cached: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export const ToolResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
  operation: z.string(),
  duration: z.number().optional(),
  cached: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// Configuration schemas
export const RateLimitConfigSchema = z.object({
  maxRequestsPerMinute: z.number().int().positive().default(60),
  maxConcurrentOperations: z.number().int().positive().default(10),
  slowOperationThreshold: z.number().positive().default(5.0),
});

export const IndexingOptionsSchema = z.object({
  autoIndex: z.boolean().default(true),
  maxFilesPerBatch: z.number().int().positive().default(100),
  debounceDelay: z.number().int().nonnegative().default(500),
  excludePatterns: z.array(z.string()).default(['node_modules/**', '.git/**', 'dist/**']),
  includePatterns: z.array(z.string()).default(['**/*.ts', '**/*.js', '**/*.py', '**/*.go']),
  maxFileSize: z.number().int().positive().default(1024 * 1024), // 1MB
});

export const ConfigurationOptionsSchema = z.object({
  allowedDirectories: z.array(z.string()).default([process.cwd()]),
  maxFileSize: z.number().int().positive().default(10 * 1024 * 1024), // 10MB
  maxCacheSize: z.number().int().positive().default(100 * 1024 * 1024), // 100MB
  cacheTimeout: z.number().int().positive().default(300000), // 5 minutes
  enableFileWatching: z.boolean().default(true),
  enablePerformanceMonitoring: z.boolean().default(true),
  enableSecurityScanning: z.boolean().default(true),
  readOnlyMode: z.boolean().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  rateLimits: RateLimitConfigSchema.default({}),
  supportedLanguages: z.array(z.string()).default(['typescript', 'javascript', 'python', 'go']),
  indexingOptions: IndexingOptionsSchema.default({}),
}).strict();

// Error schemas
export const ErrorCategorySchema = z.enum([
  'permission',
  'timeout',
  'not_found',
  'invalid_input',
  'system_error',
  'network_error',
  'security_error',
  'cache_error',
  'index_error',
]);

export const ErrorContextSchema = z.object({
  operation: z.string(),
  filePath: z.string().optional(),
  userId: z.string().optional(),
  timestamp: z.number(),
  category: ErrorCategorySchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  metadata: z.record(z.any()).optional(),
});

// Helper function to validate and parse with detailed error messages
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Validation error in ${context}: ${errorMessages}`);
    }
    throw error;
  }
}

// Helper to create a safe result
export function createSafeResult<T>(
  operation: string,
  data?: T,
  error?: string,
  metadata?: Record<string, any>
): z.infer<typeof ToolResponseSchema> {
  return {
    success: !error,
    data,
    error,
    timestamp: Date.now(),
    operation,
    metadata,
  };
}