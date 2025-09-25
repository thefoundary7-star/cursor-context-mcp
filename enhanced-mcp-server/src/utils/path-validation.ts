/**
 * Enhanced path validation and security utilities
 */

import { resolve, normalize, relative, dirname, extname, isAbsolute, sep } from 'path';
import { access, stat, constants } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { minimatch } from 'minimatch';
import type { ConfigurationOptions } from '../types/index.js';

export class PathValidator {
  private allowedDirectories: Set<string>;
  private maxFileSize: number;
  private excludePatterns: string[];
  private includePatterns: string[];
  private readOnlyMode: boolean;

  constructor(config: ConfigurationOptions) {
    this.allowedDirectories = new Set(config.allowedDirectories.map(dir => resolve(dir)));
    this.maxFileSize = config.maxFileSize;
    this.excludePatterns = config.indexingOptions.excludePatterns;
    this.includePatterns = config.indexingOptions.includePatterns;
    this.readOnlyMode = config.readOnlyMode;
  }

  updateConfig(config: Partial<ConfigurationOptions>): void {
    if (config.allowedDirectories) {
      this.allowedDirectories = new Set(config.allowedDirectories.map(dir => resolve(dir)));
    }
    if (config.maxFileSize !== undefined) {
      this.maxFileSize = config.maxFileSize;
    }
    if (config.readOnlyMode !== undefined) {
      this.readOnlyMode = config.readOnlyMode;
    }
    if (config.indexingOptions?.excludePatterns) {
      this.excludePatterns = config.indexingOptions.excludePatterns;
    }
    if (config.indexingOptions?.includePatterns) {
      this.includePatterns = config.indexingOptions.includePatterns;
    }
  }

  /**
   * Validate and resolve a file path
   */
  async validatePath(inputPath: string, operation: 'read' | 'write' | 'execute' = 'read'): Promise<string> {
    if (!inputPath || inputPath.trim() === '') {
      throw new Error('Path cannot be empty');
    }

    // Normalize and resolve the path
    const normalizedPath = normalize(inputPath);
    const resolvedPath = resolve(normalizedPath);

    // Security checks
    this.checkPathTraversal(resolvedPath);
    await this.checkPathAccess(resolvedPath, operation);
    this.checkAllowedDirectories(resolvedPath);

    if (operation === 'write' && this.readOnlyMode) {
      throw new Error('Write operations are disabled in read-only mode');
    }

    return resolvedPath;
  }

  /**
   * Check for path traversal attacks
   */
  private checkPathTraversal(path: string): void {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\./,
      /~/,
      /\0/,
      /\x00/,
      /\|/,
      /;/,
      /&&/,
      /\|\|/,
      /`/,
      /\$\(/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(path)) {
        throw new Error(`Invalid path: contains dangerous pattern '${pattern.source}'`);
      }
    }

    // Check for absolute paths outside allowed directories
    if (isAbsolute(path)) {
      const hasValidRoot = Array.from(this.allowedDirectories).some(allowed => {
        try {
          const rel = relative(allowed, path);
          return !rel.startsWith('..') && !isAbsolute(rel);
        } catch {
          return false;
        }
      });

      if (!hasValidRoot) {
        throw new Error('Path is outside allowed directories');
      }
    }
  }

  /**
   * Check if path is within allowed directories
   */
  private checkAllowedDirectories(path: string): void {
    const isAllowed = Array.from(this.allowedDirectories).some(allowed => {
      try {
        const rel = relative(allowed, path);
        return !rel.startsWith('..') && !isAbsolute(rel);
      } catch {
        return false;
      }
    });

    if (!isAllowed) {
      throw new Error(`Access denied: '${path}' is outside allowed directories`);
    }
  }

  /**
   * Check path access permissions
   */
  private async checkPathAccess(path: string, operation: 'read' | 'write' | 'execute'): Promise<void> {
    try {
      let mode: number;
      switch (operation) {
        case 'read':
          mode = constants.R_OK;
          break;
        case 'write':
          mode = constants.W_OK;
          break;
        case 'execute':
          mode = constants.X_OK;
          break;
        default:
          mode = constants.F_OK;
      }

      await access(path, mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Access denied: cannot ${operation} '${path}' - ${message}`);
    }
  }

  /**
   * Validate file size
   */
  async validateFileSize(path: string): Promise<void> {
    try {
      const stats = await stat(path);
      if (stats.size > this.maxFileSize) {
        throw new Error(
          `File too large: ${Math.round(stats.size / 1024)}KB > ${Math.round(this.maxFileSize / 1024)}KB limit`
        );
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if file matches include/exclude patterns
   */
  shouldProcessFile(filePath: string): boolean {
    const relativePath = this.getRelativePath(filePath);

    // Check exclude patterns first
    for (const pattern of this.excludePatterns) {
      if (minimatch(relativePath, pattern)) {
        return false;
      }
    }

    // Check include patterns
    if (this.includePatterns.length === 0) {
      return true; // No include patterns means include all
    }

    for (const pattern of this.includePatterns) {
      if (minimatch(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get relative path from allowed directories
   */
  private getRelativePath(filePath: string): string {
    for (const allowed of this.allowedDirectories) {
      try {
        const rel = relative(allowed, filePath);
        if (!rel.startsWith('..') && !isAbsolute(rel)) {
          return rel;
        }
      } catch {
        continue;
      }
    }
    return filePath;
  }

  /**
   * Safe file extension check
   */
  hasAllowedExtension(filePath: string, allowedExtensions?: string[]): boolean {
    if (!allowedExtensions || allowedExtensions.length === 0) {
      return true;
    }

    const ext = extname(filePath).toLowerCase();
    return allowedExtensions.some(allowed =>
      ext === (allowed.startsWith('.') ? allowed : '.' + allowed).toLowerCase()
    );
  }

  /**
   * Check if path exists safely
   */
  async pathExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get safe path info
   */
  async getPathInfo(path: string): Promise<{
    exists: boolean;
    isFile: boolean;
    isDirectory: boolean;
    size?: number;
    modified?: Date;
    accessible: boolean;
  }> {
    try {
      const stats = await stat(path);
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        accessible: true,
      };
    } catch {
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        accessible: false,
      };
    }
  }

  /**
   * Sanitize filename for safe usage
   */
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid characters
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\.+$/, '') // Remove trailing dots
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 255); // Limit length
  }

  /**
   * Get safe directory path
   */
  getSafeDirectoryPath(path: string): string {
    try {
      const normalized = normalize(path);
      const resolved = resolve(normalized);

      // Ensure it's within allowed directories
      this.checkAllowedDirectories(resolved);

      return resolved;
    } catch {
      // Fallback to first allowed directory
      return Array.from(this.allowedDirectories)[0] || process.cwd();
    }
  }

  /**
   * Validate directory for operations
   */
  async validateDirectory(dirPath: string): Promise<string> {
    const validPath = await this.validatePath(dirPath, 'read');
    const pathInfo = await this.getPathInfo(validPath);

    if (!pathInfo.exists) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    if (!pathInfo.isDirectory) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    return validPath;
  }

  /**
   * Create safe backup filename
   */
  createBackupFilename(originalPath: string): string {
    const ext = extname(originalPath);
    const base = originalPath.slice(0, -ext.length);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${base}.backup.${timestamp}${ext}`;
  }
}

// Utility functions
export function isHiddenFile(path: string): boolean {
  const filename = path.split(sep).pop() || '';
  return filename.startsWith('.') && filename !== '.' && filename !== '..';
}

export function getFileExtension(path: string): string {
  return extname(path).toLowerCase().slice(1);
}

export function isTextFile(path: string): boolean {
  const textExtensions = [
    'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java',
    'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'swift', 'kt', 'scala',
    'html', 'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'toml',
    'ini', 'cfg', 'conf', 'log', 'sql', 'sh', 'bat', 'ps1'
  ];

  const ext = getFileExtension(path);
  return textExtensions.includes(ext);
}

export function isBinaryFile(path: string): boolean {
  const binaryExtensions = [
    'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'db', 'sqlite', 'sqlite3',
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'webp',
    'mp3', 'mp4', 'avi', 'mov', 'wav', 'ogg', 'flac',
    'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
  ];

  const ext = getFileExtension(path);
  return binaryExtensions.includes(ext);
}

export default PathValidator;