import * as fs from 'fs';
import * as path from 'path';
import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { MCPTool } from './types.js';

// Context tracking for recently accessed files
interface FileContext {
  path: string;
  lastAccessed: Date;
  accessCount: number;
}

export class MCPTools {
  private static fileContext: Map<string, FileContext> = new Map();
  private static projectRoot: string | null = null;

  // Define available tools
  static getToolDefinitions(): MCPTool[] {
    return [
      {
        name: "listFiles",
        description: "List files and directories in a given path with smart project root detection",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory path to list files from. Defaults to current directory or project root."
            },
            showHidden: {
              type: "boolean",
              description: "Whether to show hidden files and directories (default: false)"
            }
          }
        }
      },
      {
        name: "readFile",
        description: "Read the contents of a file with context tracking",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The path to the file to read (can be relative to project root)"
            },
            maxLines: {
              type: "number",
              description: "Maximum number of lines to read (default: 1000, 0 for all)"
            }
          },
          required: ["filePath"]
        }
      },
      {
        name: "getFileInfo",
        description: "Get detailed information about a file or directory",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The path to the file or directory"
            }
          },
          required: ["filePath"]
        }
      },
      {
        name: "getGitStatus",
        description: "Get comprehensive Git repository status and information",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory to check Git status for (defaults to project root)"
            }
          }
        }
      },
      {
        name: "searchFiles",
        description: "Search for files by name pattern across the project",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "File name pattern to search for (supports glob patterns)"
            },
            directory: {
              type: "string",
              description: "Directory to search in (defaults to project root)"
            },
            includeHidden: {
              type: "boolean",
              description: "Whether to include hidden files (default: false)"
            }
          },
          required: ["pattern"]
        }
      },
      {
        name: "getProjectRoot",
        description: "Get the detected project root directory",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "getRecentFiles",
        description: "Get list of recently accessed files with context",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of recent files to return (default: 10)"
            }
          }
        }
      },
      {
        name: "getGitLog",
        description: "Get recent Git commit history",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of commits to show (default: 10)"
            },
            directory: {
              type: "string",
              description: "Directory to get Git log for (defaults to project root)"
            }
          }
        }
      }
    ];
  }

  // Execute tool commands
  static async executeTool(toolName: string, params: any): Promise<any> {
    try {
    switch (toolName) {
      case "listFiles":
          return await this.listFiles(params.directory, params.showHidden);
      
      case "readFile":
          return await this.readFile(params.filePath, params.maxLines);
        
        case "getFileInfo":
          return await this.getFileInfo(params.filePath);
      
      case "getGitStatus":
          return await this.getGitStatus(params.directory);
        
        case "searchFiles":
          return await this.searchFiles(params.pattern, params.directory, params.includeHidden);
        
        case "getProjectRoot":
          return await this.getProjectRoot();
        
        case "getRecentFiles":
          return await this.getRecentFiles(params.limit);
        
        case "getGitLog":
          return await this.getGitLog(params.limit, params.directory);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    } catch (error) {
      return this.formatError(`Tool execution failed: ${error}`);
    }
  }

  // Smart project root detection
  private static async detectProjectRoot(startDir: string = process.cwd()): Promise<string> {
    if (this.projectRoot) {
      return this.projectRoot;
    }

    let currentDir = path.resolve(startDir);
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const indicators = [
        '.git',
        'package.json',
        'pyproject.toml',
        'Cargo.toml',
        'go.mod',
        'requirements.txt',
        'Pipfile',
        'composer.json',
        'pom.xml',
        'build.gradle',
        'CMakeLists.txt'
      ];

      for (const indicator of indicators) {
        const indicatorPath = path.join(currentDir, indicator);
        try {
          await fs.promises.access(indicatorPath);
          this.projectRoot = currentDir;
          return currentDir;
        } catch {
          // Continue checking
        }
      }

      currentDir = path.dirname(currentDir);
    }

    // Fallback to current working directory
    this.projectRoot = process.cwd();
    return this.projectRoot;
  }

  // Resolve path relative to project root
  private static async resolvePath(inputPath: string): Promise<string> {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }

    const projectRoot = await this.detectProjectRoot();
    return path.resolve(projectRoot, inputPath);
  }

  // Track file access for context
  private static trackFileAccess(filePath: string): void {
    const normalizedPath = path.resolve(filePath);
    const existing = this.fileContext.get(normalizedPath);
    
    if (existing) {
      existing.lastAccessed = new Date();
      existing.accessCount++;
    } else {
      this.fileContext.set(normalizedPath, {
        path: normalizedPath,
        lastAccessed: new Date(),
        accessCount: 1
      });
    }
  }

  // Format error messages consistently
  private static formatError(message: string): string {
    return `❌ ${message}`;
  }

  // Format success messages
  private static formatSuccess(message: string): string {
    return `✅ ${message}`;
  }

  // Tool implementations
  static async listFiles(directory?: string, showHidden: boolean = false): Promise<string> {
    try {
      const targetDir = directory ? await this.resolvePath(directory) : await this.detectProjectRoot();
      
      // Check if path exists
      try {
        await fs.promises.access(targetDir);
      } catch {
        return this.formatError(`Path '${directory || 'current directory'}' does not exist`);
      }
      
      const stats = await fs.promises.stat(targetDir);
      if (!stats.isDirectory()) {
        return this.formatError(`Path '${directory || 'current directory'}' is not a directory`);
      }
      
      const items = await fs.promises.readdir(targetDir);
      const files: string[] = [];
      const directories: string[] = [];
      
      for (const item of items) {
        // Skip hidden files unless requested
        if (!showHidden && item.startsWith('.')) {
          continue;
        }

        const itemPath = path.join(targetDir, item);
        const itemStats = await fs.promises.stat(itemPath);
        if (itemStats.isDirectory()) {
          directories.push(item);
        } else {
          files.push(item);
        }
      }
      
      // Sort the results
      files.sort();
      directories.sort();
      
      let result = `📁 Contents of '${path.relative(process.cwd(), targetDir)}':\n\n`;
      
      if (directories.length > 0) {
        result += "📂 Directories:\n";
        for (const dir of directories) {
          result += `  📁 ${dir}\n`;
        }
        result += "\n";
      }
      
      if (files.length > 0) {
        result += "📄 Files:\n";
        for (const file of files) {
          result += `  📄 ${file}\n`;
        }
      }
      
      if (directories.length === 0 && files.length === 0) {
        result += "📭 Directory is empty.\n";
      }

      // Add project root info if this is the project root
      const projectRoot = await this.detectProjectRoot();
      if (targetDir === projectRoot) {
        result += `\n🏠 This is the project root directory`;
      }
      
      return result;
    } catch (error) {
      return this.formatError(`Failed to list files: ${error}`);
    }
  }

  static async readFile(filePath: string, maxLines: number = 1000): Promise<string> {
    try {
      const resolvedPath = await this.resolvePath(filePath);
      
      // Track file access
      this.trackFileAccess(resolvedPath);
      
      // Check if file exists
      try {
        await fs.promises.access(resolvedPath);
      } catch {
        return this.formatError(`File '${filePath}' does not exist`);
      }
      
      const stats = await fs.promises.stat(resolvedPath);
      if (!stats.isFile()) {
        return this.formatError(`Path '${filePath}' is not a file`);
      }
      
      // Check file size to avoid reading huge files (5MB limit)
      if (stats.size > 5 * 1024 * 1024) {
        return this.formatError(`File '${filePath}' is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is 5MB.`);
      }
      
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');
      
      let result = `📄 Contents of '${path.relative(process.cwd(), resolvedPath)}':\n`;
      result += "=".repeat(60) + "\n";
      
      if (maxLines > 0 && lines.length > maxLines) {
        result += content.split('\n').slice(0, maxLines).join('\n');
        result += `\n\n... (${lines.length - maxLines} more lines, use maxLines: 0 to see all)`;
      } else {
        result += content;
      }
      
      result += `\n\n📊 File Info: ${lines.length} lines, ${stats.size} bytes`;
      result += `\n📅 Modified: ${new Date(stats.mtime).toLocaleString()}`;
      
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('binary')) {
        return this.formatError(`File '${filePath}' contains binary data and cannot be displayed as text`);
      }
      return this.formatError(`Failed to read file: ${error}`);
    }
  }

  static async getFileInfo(filePath: string): Promise<string> {
    try {
      const resolvedPath = await this.resolvePath(filePath);
      
      // Check if path exists
      try {
        await fs.promises.access(resolvedPath);
      } catch {
        return this.formatError(`Path '${filePath}' does not exist`);
      }
      
      const stats = await fs.promises.stat(resolvedPath);
      
      let result = `📋 Information for '${path.relative(process.cwd(), resolvedPath)}':\n`;
      result += "=".repeat(50) + "\n";
      result += `📁 Type: ${stats.isDirectory() ? 'Directory' : 'File'}\n`;
      result += `📏 Size: ${this.formatFileSize(stats.size)}\n`;
      result += `📅 Modified: ${new Date(stats.mtime).toLocaleString()}\n`;
      result += `📅 Created: ${new Date(stats.birthtime).toLocaleString()}\n`;
      result += `🔗 Absolute path: ${resolvedPath}\n`;
      
      if (stats.isFile()) {
        const ext = path.extname(filePath);
        const name = path.basename(filePath);
        const stem = path.basename(filePath, ext);
        result += `📄 Extension: ${ext || 'none'}\n`;
        result += `📄 Name: ${name}\n`;
        result += `📄 Stem: ${stem}\n`;
        
        // Add context info if available
        const context = this.fileContext.get(resolvedPath);
        if (context) {
          result += `\n📊 Access Info:\n`;
          result += `  🔢 Times accessed: ${context.accessCount}\n`;
          result += `  ⏰ Last accessed: ${context.lastAccessed.toLocaleString()}\n`;
        }
      }
      
      return result;
    } catch (error) {
      return this.formatError(`Failed to get file info: ${error}`);
    }
  }

  static async getGitStatus(directory?: string): Promise<string> {
    try {
      const targetDir = directory ? await this.resolvePath(directory) : await this.detectProjectRoot();
      
      // Check if directory is a git repository
      const git: SimpleGit = simpleGit(targetDir);
      
      try {
        await git.status();
      } catch {
        return this.formatError(`Directory '${path.relative(process.cwd(), targetDir)}' is not a Git repository`);
      }
      
      const status: StatusResult = await git.status();
      const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
      const remote = await git.getRemotes(true);
      const log = await git.log({ maxCount: 1 });
      
      let result = `🌿 Git Status for '${path.relative(process.cwd(), targetDir)}':\n`;
      result += "=".repeat(50) + "\n";
      result += `🌿 Branch: ${branch.trim()}\n`;
      
      if (remote.length > 0) {
        result += `🔗 Remote: ${remote[0].name} (${remote[0].refs.fetch})\n`;
      }
      
      if (log.latest) {
        result += `📝 Latest commit: ${log.latest.message.trim()}\n`;
        result += `👤 Author: ${log.latest.author_name} <${log.latest.author_email}>\n`;
        result += `📅 Date: ${new Date(log.latest.date).toLocaleString()}\n`;
      }
      
      result += `\n📊 Working Directory Status:\n`;
      
      if (status.ahead > 0) {
        result += `  ⬆️  ${status.ahead} commits ahead of remote\n`;
      }
      
      if (status.behind > 0) {
        result += `  ⬇️  ${status.behind} commits behind remote\n`;
      }
      
      if (status.modified.length > 0) {
        result += `  ✏️  Modified files (${status.modified.length}):\n`;
        status.modified.slice(0, 10).forEach(file => {
          result += `    📄 ${file}\n`;
        });
        if (status.modified.length > 10) {
          result += `    ... and ${status.modified.length - 10} more\n`;
        }
      }
      
      if (status.not_added.length > 0) {
        result += `  ➕ Untracked files (${status.not_added.length}):\n`;
        status.not_added.slice(0, 10).forEach(file => {
          result += `    📄 ${file}\n`;
        });
        if (status.not_added.length > 10) {
          result += `    ... and ${status.not_added.length - 10} more\n`;
        }
      }
      
      if (status.staged.length > 0) {
        result += `  📋 Staged files (${status.staged.length}):\n`;
        status.staged.slice(0, 10).forEach(file => {
          result += `    📄 ${file}\n`;
        });
        if (status.staged.length > 10) {
          result += `    ... and ${status.staged.length - 10} more\n`;
        }
      }
      
      if (status.modified.length === 0 && status.not_added.length === 0 && status.staged.length === 0) {
        result += `  ✅ Working directory is clean\n`;
      }
      
      return result;
    } catch (error) {
      return this.formatError(`Failed to get Git status: ${error}`);
    }
  }

  static async searchFiles(pattern: string, directory?: string, includeHidden: boolean = false): Promise<string> {
    try {
      const searchDir = directory ? await this.resolvePath(directory) : await this.detectProjectRoot();
      
      const results: string[] = [];
      
      const searchRecursive = async (dir: string, currentDepth: number = 0): Promise<void> => {
        // Limit search depth to prevent infinite loops
        if (currentDepth > 10) return;
        
        try {
          const items = await fs.promises.readdir(dir);
          
          for (const item of items) {
            // Skip hidden files unless requested
            if (!includeHidden && item.startsWith('.')) {
              continue;
            }
            
            // Skip common directories that shouldn't be searched
            if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(item)) {
              continue;
            }
            
            const itemPath = path.join(dir, item);
            const stats = await fs.promises.stat(itemPath);
            
            if (stats.isDirectory()) {
              await searchRecursive(itemPath, currentDepth + 1);
            } else if (this.matchesPattern(item, pattern)) {
              results.push(path.relative(searchDir, itemPath));
            }
          }
        } catch (error) {
          // Skip directories we can't read
        }
      };
      
      await searchRecursive(searchDir);
      
      let result = `🔍 Search results for pattern '${pattern}' in '${path.relative(process.cwd(), searchDir)}':\n`;
      result += "=".repeat(60) + "\n";
      
      if (results.length === 0) {
        result += "📭 No files found matching the pattern.\n";
      } else {
        result += `📊 Found ${results.length} file(s):\n\n`;
        results.sort().forEach((file, index) => {
          result += `  ${index + 1}. 📄 ${file}\n`;
        });
      }
      
      return result;
    } catch (error) {
      return this.formatError(`Failed to search files: ${error}`);
    }
  }

  private static matchesPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(filename);
  }

  static async getProjectRoot(): Promise<string> {
    try {
      const root = await this.detectProjectRoot();
      return this.formatSuccess(`Project root: ${root}`);
    } catch (error) {
      return this.formatError(`Failed to detect project root: ${error}`);
    }
  }

  static async getRecentFiles(limit: number = 10): Promise<string> {
    try {
      const recentFiles = Array.from(this.fileContext.values())
        .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
        .slice(0, limit);
      
      let result = `📚 Recently accessed files (last ${limit}):\n`;
      result += "=".repeat(50) + "\n";
      
      if (recentFiles.length === 0) {
        result += "📭 No files have been accessed yet.\n";
      } else {
        recentFiles.forEach((file, index) => {
          const relativePath = path.relative(process.cwd(), file.path);
          result += `  ${index + 1}. 📄 ${relativePath}\n`;
          result += `     🔢 Accessed ${file.accessCount} time(s)\n`;
          result += `     ⏰ Last: ${file.lastAccessed.toLocaleString()}\n\n`;
        });
      }
      
      return result;
    } catch (error) {
      return this.formatError(`Failed to get recent files: ${error}`);
    }
  }

  static async getGitLog(limit: number = 10, directory?: string): Promise<string> {
    try {
      const targetDir = directory ? await this.resolvePath(directory) : await this.detectProjectRoot();
      
      const git: SimpleGit = simpleGit(targetDir);
      
      try {
        await git.status();
      } catch {
        return this.formatError(`Directory '${path.relative(process.cwd(), targetDir)}' is not a Git repository`);
      }
      
      const log = await git.log({ maxCount: limit });
      
      let result = `📝 Recent Git commits (last ${limit}):\n`;
      result += "=".repeat(60) + "\n";
      
      if (log.total === 0) {
        result += "📭 No commits found.\n";
      } else {
        log.all.forEach((commit, index) => {
          result += `  ${index + 1}. ${commit.message.trim()}\n`;
          result += `     👤 ${commit.author_name} <${commit.author_email}>\n`;
          result += `     📅 ${new Date(commit.date).toLocaleString()}\n`;
          result += `     🔗 ${commit.hash.substring(0, 8)}\n\n`;
        });
      }
      
      return result;
    } catch (error) {
      return this.formatError(`Failed to get Git log: ${error}`);
    }
  }

  private static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}