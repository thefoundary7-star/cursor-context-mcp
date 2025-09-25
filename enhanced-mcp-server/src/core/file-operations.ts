/**
 * Enhanced file operations with security, caching, and performance monitoring
 */

import { readFile, writeFile, mkdir, readdir, stat, access, constants } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { resolve, dirname, extname, basename } from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import * as diff from 'diff';
import { EventEmitter } from 'events';

import { PathValidator, isTextFile, isBinaryFile } from '../utils/path-validation.js';
import { EnhancedCache } from '../performance/cache.js';
import { PerformanceMonitor, withPerformanceMonitoring } from '../performance/monitor.js';
import type {
  ConfigurationOptions,
  FileChange,
  OperationResult,
  ToolResponse,
} from '../types/index.js';
import {
  validateSchema,
  createSafeResult,
  ListFilesArgsSchema,
  ReadFileArgsSchema,
  WriteFileArgsSchema,
} from '../types/schemas.js';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modified: Date;
  extension: string;
  isHidden: boolean;
  isText: boolean;
  isBinary: boolean;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export interface DirectoryListing {
  files: FileInfo[];
  directories: FileInfo[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  path: string;
  timestamp: number;
}

export class EnhancedFileOperations extends EventEmitter {
  private pathValidator: PathValidator;
  private cache: EnhancedCache<any>;
  private performanceMonitor: PerformanceMonitor;
  private config: ConfigurationOptions;

  constructor(
    config: ConfigurationOptions,
    cache: EnhancedCache<any>,
    performanceMonitor: PerformanceMonitor
  ) {
    super();
    this.config = config;
    this.pathValidator = new PathValidator(config);
    this.cache = cache;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * List files and directories with enhanced filtering and caching
   */
  async listFiles(args: unknown): Promise<ToolResponse<DirectoryListing>> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'listFiles',
      async () => {
        try {
          const validArgs = validateSchema(ListFilesArgsSchema, args, 'listFiles');
          const { directory, pattern, recursive, includeHidden } = validArgs;

          // Validate directory path
          const validDirectory = await this.pathValidator.validateDirectory(directory || '.');

          // Check cache first
          const cacheKey = `listFiles:${validDirectory}:${JSON.stringify(validArgs)}`;
          const cached = this.cache.get(cacheKey);
          if (cached) {
            return createSafeResult('listFiles', cached, undefined, { cached: true });
          }

          // Read directory
          const listing = await this.readDirectoryRecursive(
            validDirectory,
            pattern,
            recursive,
            includeHidden
          );

          // Cache result
          this.cache.set(cacheKey, listing, 30000); // 30 seconds TTL

          this.emit('filesListed', { directory: validDirectory, count: listing.totalFiles });

          return createSafeResult('listFiles', listing);
        } catch (error) {
          return createSafeResult(
            'listFiles',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );
  }

  /**
   * Read file contents with encoding detection and caching
   */
  async readFile(args: unknown): Promise<ToolResponse<string | Buffer>> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'readFile',
      async () => {
        try {
          const validArgs = validateSchema(ReadFileArgsSchema, args, 'readFile');
          const { filePath, maxLines, encoding } = validArgs;

          // Validate file path
          const validPath = await this.pathValidator.validatePath(filePath, 'read');

          // Check file size
          await this.pathValidator.validateFileSize(validPath);

          // Check cache first
          const cacheKey = `readFile:${validPath}:${maxLines || 'all'}:${encoding}`;
          const cached = this.cache.get(cacheKey);
          if (cached) {
            return createSafeResult('readFile', cached, undefined, { cached: true });
          }

          // Determine if file is text or binary
          const isText = isTextFile(validPath);
          let content: string | Buffer;

          if (isText) {
            content = await readFile(validPath, { encoding: encoding as BufferEncoding });

            // Handle maxLines limitation
            if (maxLines && typeof content === 'string') {
              const lines = content.split('\n');
              if (lines.length > maxLines) {
                content = lines.slice(0, maxLines).join('\n');
                content += `\n... (${lines.length - maxLines} more lines truncated)`;
              }
            }
          } else {
            // Read binary file as buffer
            content = await readFile(validPath);
          }

          // Cache result (shorter TTL for large files)
          const fileStats = await stat(validPath);
          const cacheTtl = fileStats.size > 1024 * 1024 ? 10000 : 60000; // 10s for large files, 1min for small
          this.cache.set(cacheKey, content, cacheTtl);

          this.emit('fileRead', { filePath: validPath, size: fileStats.size });

          return createSafeResult('readFile', content, undefined, {
            fileSize: fileStats.size,
            isText,
            encoding: isText ? encoding : undefined,
          });
        } catch (error) {
          return createSafeResult(
            'readFile',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );
  }

  /**
   * Write file contents with backup and atomic operations
   */
  async writeFile(args: unknown): Promise<ToolResponse<boolean>> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'writeFile',
      async () => {
        try {
          const validArgs = validateSchema(WriteFileArgsSchema, args, 'writeFile');
          const { filePath, content, createDirectories, backup } = validArgs;

          // Validate file path
          const validPath = await this.pathValidator.validatePath(filePath, 'write');

          // Create directories if needed
          if (createDirectories) {
            const dir = dirname(validPath);
            await mkdir(dir, { recursive: true });
          }

          // Create backup if requested and file exists
          if (backup) {
            try {
              await access(validPath, constants.F_OK);
              const backupPath = this.pathValidator.createBackupFilename(validPath);
              const originalContent = await readFile(validPath);
              await writeFile(backupPath, originalContent);
            } catch {
              // File doesn't exist, no backup needed
            }
          }

          // Write file atomically (write to temp file, then rename)
          const tempPath = `${validPath}.tmp.${Date.now()}`;
          await writeFile(tempPath, content, 'utf8');

          // On Windows, we need to remove the target file first
          try {
            await access(validPath, constants.F_OK);
            // File exists, remove it first on Windows
            if (process.platform === 'win32') {
              const { unlink, rename } = await import('fs/promises');
              await unlink(validPath);
              await rename(tempPath, validPath);
            } else {
              const { rename } = await import('fs/promises');
              await rename(tempPath, validPath);
            }
          } catch {
            // File doesn't exist, just rename
            const { rename } = await import('fs/promises');
            await rename(tempPath, validPath);
          }

          // Invalidate cache for this file
          this.invalidateFileCache(validPath);

          this.emit('fileWritten', { filePath: validPath, size: content.length });

          return createSafeResult('writeFile', true, undefined, {
            bytesWritten: content.length,
            backup: backup || false,
          });
        } catch (error) {
          return createSafeResult(
            'writeFile',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );
  }

  /**
   * Search files by pattern with advanced filtering
   */
  async searchFiles(
    directory: string = '.',
    pattern: string,
    options: {
      recursive?: boolean;
      includeHidden?: boolean;
      fileExtensions?: string[];
      excludePatterns?: string[];
      maxResults?: number;
    } = {}
  ): Promise<ToolResponse<string[]>> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'searchFiles',
      async () => {
        try {
          const validDirectory = await this.pathValidator.validateDirectory(directory);
          const {
            recursive = true,
            includeHidden = false,
            fileExtensions,
            excludePatterns = [],
            maxResults = 1000,
          } = options;

          // Build glob pattern
          const globPattern = recursive
            ? `${validDirectory}/**/${pattern}`
            : `${validDirectory}/${pattern}`;

          // Use glob to find files
          const files = await glob(globPattern, {
            dot: includeHidden,
            ignore: excludePatterns.map(p => `${validDirectory}/**/${p}`),
          });

          // Filter by file extensions if specified
          let filteredFiles = files;
          if (fileExtensions && fileExtensions.length > 0) {
            filteredFiles = files.filter(file =>
              this.pathValidator.hasAllowedExtension(file, fileExtensions)
            );
          }

          // Limit results
          if (filteredFiles.length > maxResults) {
            filteredFiles = filteredFiles.slice(0, maxResults);
          }

          // Validate each file path
          const validFiles: string[] = [];
          for (const file of filteredFiles) {
            try {
              await this.pathValidator.validatePath(file, 'read');
              if (this.pathValidator.shouldProcessFile(file)) {
                validFiles.push(file);
              }
            } catch {
              // Skip invalid files
            }
          }

          this.emit('filesSearched', {
            directory: validDirectory,
            pattern,
            found: validFiles.length,
          });

          return createSafeResult('searchFiles', validFiles, undefined, {
            totalFound: files.length,
            filtered: validFiles.length,
            pattern,
          });
        } catch (error) {
          return createSafeResult(
            'searchFiles',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );
  }

  /**
   * Get file diff between versions
   */
  async getFileDiff(
    filePath1: string,
    filePath2: string,
    options: { contextLines?: number; ignoreWhitespace?: boolean } = {}
  ): Promise<ToolResponse<string>> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'getFileDiff',
      async () => {
        try {
          const validPath1 = await this.pathValidator.validatePath(filePath1, 'read');
          const validPath2 = await this.pathValidator.validatePath(filePath2, 'read');

          const content1 = await readFile(validPath1, 'utf8');
          const content2 = await readFile(validPath2, 'utf8');

          const { contextLines = 3, ignoreWhitespace = false } = options;

          // Create unified diff
          const diffResult = diff.createPatch(
            basename(validPath1),
            content1,
            content2,
            `a/${basename(validPath1)}`,
            `b/${basename(validPath2)}`,
            { context: contextLines, ignoreWhitespace }
          );

          const diffText = diffResult;

          return createSafeResult('getFileDiff', diffText, undefined, {
            file1: basename(validPath1),
            file2: basename(validPath2),
            contextLines,
          });
        } catch (error) {
          return createSafeResult(
            'getFileDiff',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );
  }

  /**
   * Recursively read directory contents
   */
  private async readDirectoryRecursive(
    directory: string,
    pattern?: string,
    recursive: boolean = true,
    includeHidden: boolean = false
  ): Promise<DirectoryListing> {
    const files: FileInfo[] = [];
    const directories: FileInfo[] = [];
    let totalSize = 0;

    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(directory, entry.name);

      // Skip hidden files if not requested
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Check patterns
      if (pattern && !minimatch(entry.name, pattern)) {
        continue;
      }

      try {
        // Validate path access
        await this.pathValidator.validatePath(fullPath, 'read');

        const stats = await stat(fullPath);
        const fileInfo: FileInfo = {
          name: entry.name,
          path: fullPath,
          size: stats.size,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          modified: stats.mtime,
          extension: extname(entry.name).toLowerCase(),
          isHidden: entry.name.startsWith('.'),
          isText: isTextFile(fullPath),
          isBinary: isBinaryFile(fullPath),
          permissions: {
            readable: true, // We already validated read access
            writable: false, // TODO: Check write access
            executable: false, // TODO: Check execute access
          },
        };

        if (entry.isDirectory()) {
          directories.push(fileInfo);

          // Recursive directory reading
          if (recursive) {
            try {
              const subListing = await this.readDirectoryRecursive(
                fullPath,
                pattern,
                recursive,
                includeHidden
              );
              files.push(...subListing.files);
              directories.push(...subListing.directories);
              totalSize += subListing.totalSize;
            } catch {
              // Skip directories we can't read
            }
          }
        } else if (entry.isFile()) {
          files.push(fileInfo);
          totalSize += stats.size;
        }
      } catch {
        // Skip files/directories we can't access
        continue;
      }
    }

    return {
      files,
      directories,
      totalFiles: files.length,
      totalDirectories: directories.length,
      totalSize,
      path: directory,
      timestamp: Date.now(),
    };
  }

  /**
   * Invalidate cache entries related to a file
   */
  private invalidateFileCache(filePath: string): void {
    const patterns = [
      new RegExp(`^readFile:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      new RegExp(`^listFiles:${dirname(filePath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    ];

    for (const pattern of patterns) {
      this.cache.deleteByPattern(pattern);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConfigurationOptions>): void {
    this.config = { ...this.config, ...config };
    this.pathValidator.updateConfig(config);
  }

  /**
   * Get file operation statistics
   */
  getStats() {
    return {
      performance: this.performanceMonitor.getAllStatistics(),
      cache: this.cache.getStats(),
      config: {
        allowedDirectories: Array.from(this.config.allowedDirectories),
        maxFileSize: this.config.maxFileSize,
        readOnlyMode: this.config.readOnlyMode,
      },
    };
  }
}

export default EnhancedFileOperations;