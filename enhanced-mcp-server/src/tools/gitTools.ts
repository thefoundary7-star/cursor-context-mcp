/**
 * Git Integration Tools for MCP Server
 * 
 * This module provides implementations for Git integration tools.
 * Includes commit history, file blame, branch info, and file tracking.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve as pathResolve } from 'path';

// Types for Git operations
interface Commit {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface CommitHistoryResult {
  commits: Commit[];
  total: number;
  repository: string;
  branch: string;
  filters?: {
    author?: string;
    since?: string;
    until?: string;
    filePath?: string;
  };
}

// Types for file blame
interface BlameLine {
  lineNumber: number;
  sha: string;
  author: string;
  email: string;
  date: string;
  content: string;
}

interface FileBlameResult {
  lines: BlameLine[];
  total: number;
  repository: string;
  filePath: string;
  revision: string;
  lineRange?: {
    start: number;
    end: number;
  };
}

// Types for branch information
interface BranchInfo {
  name: string;
  sha: string;
  author: string;
  email: string;
  date: string;
  upstream?: string;
  tracking?: string;
  isCurrent: boolean;
  isRemote: boolean;
}

interface BranchInfoResult {
  branches: BranchInfo[];
  total: number;
  repository: string;
  currentBranch: string;
  filters?: {
    branch?: string;
    includeRemote?: boolean;
    includeMerged?: boolean;
  };
}

// Types for file commit tracking
interface FileCommit {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface FileCommitsResult {
  commits: FileCommit[];
  total: number;
  repository: string;
  filePath: string;
  filters?: {
    author?: string;
    since?: string;
    until?: string;
    includeMerges?: boolean;
  };
}

/**
 * Create Git integration tools
 */
export function createGitTools(): Tool[] {
  return [
    {
      name: 'get_commit_history',
      description: 'Get commit history for a repository or specific branch',
      inputSchema: {
        type: 'object',
        properties: {
          repository: {
            type: 'string',
            description: 'Path to the Git repository',
            default: '.',
          },
          branch: {
            type: 'string',
            description: 'Branch to get commit history for',
            default: 'HEAD',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of commits to return',
            default: 50,
            minimum: 1,
            maximum: 1000,
          },
          author: {
            type: 'string',
            description: 'Filter commits by author email or name',
          },
          since: {
            type: 'string',
            description: 'Show commits since this date (ISO format)',
          },
          until: {
            type: 'string',
            description: 'Show commits until this date (ISO format)',
          },
          filePath: {
            type: 'string',
            description: 'Filter commits that modified this file',
          },
        },
        required: [],
      },
    },

    {
      name: 'get_file_blame',
      description: 'Get blame information for a specific file',
      inputSchema: {
        type: 'object',
        properties: {
          repository: {
            type: 'string',
            description: 'Path to the Git repository',
            default: '.',
          },
          filePath: {
            type: 'string',
            description: 'Path to the file to get blame for',
          },
          revision: {
            type: 'string',
            description: 'Git revision to get blame for (commit hash, branch, tag)',
            default: 'HEAD',
          },
          lineStart: {
            type: 'number',
            description: 'Start line number for blame (1-based)',
            minimum: 1,
          },
          lineEnd: {
            type: 'number',
            description: 'End line number for blame (1-based)',
            minimum: 1,
          },
        },
        required: ['filePath'],
      },
    },

    {
      name: 'get_branch_info',
      description: 'Get information about branches in the repository',
      inputSchema: {
        type: 'object',
        properties: {
          repository: {
            type: 'string',
            description: 'Path to the Git repository',
            default: '.',
          },
          branch: {
            type: 'string',
            description: 'Specific branch to get info for',
          },
          includeRemote: {
            type: 'boolean',
            description: 'Include remote branches',
            default: true,
          },
          includeMerged: {
            type: 'boolean',
            description: 'Include merged branches',
            default: false,
          },
        },
        required: [],
      },
    },

    {
      name: 'find_commits_touching_file',
      description: 'Find commits that modified a specific file',
      inputSchema: {
        type: 'object',
        properties: {
          repository: {
            type: 'string',
            description: 'Path to the Git repository',
            default: '.',
          },
          filePath: {
            type: 'string',
            description: 'Path to the file to find commits for',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of commits to return',
            default: 50,
            minimum: 1,
            maximum: 1000,
          },
          author: {
            type: 'string',
            description: 'Filter commits by author email or name',
          },
          since: {
            type: 'string',
            description: 'Show commits since this date (ISO format)',
          },
          until: {
            type: 'string',
            description: 'Show commits until this date (ISO format)',
          },
          includeMerges: {
            type: 'boolean',
            description: 'Include merge commits',
            default: true,
          },
        },
        required: ['filePath'],
      },
    },
  ];
}

/**
 * Execute git log command and parse results
 */
async function executeGitLog(
  repository: string,
  branch: string = 'HEAD',
  limit: number = 50,
  author?: string,
  since?: string,
  until?: string,
  filePath?: string
): Promise<CommitHistoryResult> {
  return new Promise((resolve, reject) => {
    // Validate repository
    const repoPath = repository ? pathResolve(repository) : process.cwd();
    const gitDir = join(repoPath, '.git');
    
    if (!existsSync(gitDir)) {
      reject(new Error('Not a git repository'));
      return;
    }

    // Build git log command
    const args = [
      'log',
      '--pretty=format:%H|%an|%ae|%ad|%s',
      '--date=iso',
      `-n${limit}`
    ];

    // Add filters
    if (author) {
      args.push('--author', author);
    }
    if (since) {
      args.push('--since', since);
    }
    if (until) {
      args.push('--until', until);
    }
    if (filePath) {
      args.push('--', filePath);
    }
    if (branch && branch !== 'HEAD') {
      args.push(branch);
    }

    console.log(`[GIT_LOG] Executing: git ${args.join(' ')} in ${repoPath}`);

    const child: ChildProcess = spawn('git', args, {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error('Git log command timed out'));
      }
    }, 30000); // 30 second timeout

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      if (code !== 0) {
        // Handle specific error cases
        if (stderr.includes('not a git repository')) {
          reject(new Error('Not a git repository'));
        } else if (stderr.includes('ambiguous argument') || stderr.includes('pathspec')) {
          reject(new Error('Branch not found'));
        } else {
          reject(new Error(`Git command failed: ${stderr.trim()}`));
        }
        return;
      }

      try {
        const commits = parseGitLogOutput(stdout);
        resolve({
          commits,
          total: commits.length,
          repository: repoPath as string,
          branch,
          filters: {
            author,
            since,
            until,
            filePath
          }
        });
      } catch (error) {
        reject(new Error(`Failed to parse git log output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      reject(new Error(`Git command execution failed: ${error.message}`));
    });
  });
}

/**
 * Parse git log output into structured commits
 */
function parseGitLogOutput(output: string): Commit[] {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const commits: Commit[] = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length >= 5) {
      commits.push({
        sha: parts[0],
        author: parts[1],
        email: parts[2],
        date: parts[3],
        message: parts[4]
      });
    }
  }

  return commits;
}

/**
 * Execute git blame command and parse results
 */
async function executeGitBlame(
  repository: string,
  filePath: string,
  revision: string = 'HEAD',
  lineStart?: number,
  lineEnd?: number
): Promise<FileBlameResult> {
  return new Promise((resolve, reject) => {
    // Validate repository
    const repoPath = repository ? pathResolve(repository) : process.cwd();
    const gitDir = join(repoPath, '.git');
    
    if (!existsSync(gitDir)) {
      reject(new Error('Not a git repository'));
      return;
    }

    // Build git blame command
    const args = [
      'blame',
      '--line-porcelain',
      revision,
      '--',
      filePath
    ];

    // Add line range if specified
    if (lineStart !== undefined && lineEnd !== undefined) {
      args.splice(2, 0, `-L${lineStart},${lineEnd}`);
    }

    console.log(`[GIT_BLAME] Executing: git ${args.join(' ')} in ${repoPath}`);

    const child: ChildProcess = spawn('git', args, {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error('Git blame command timed out'));
      }
    }, 30000); // 30 second timeout

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      if (code !== 0) {
        // Handle specific error cases
        if (stderr.includes('not a git repository')) {
          reject(new Error('Not a git repository'));
        } else if (stderr.includes('no such path') || stderr.includes('pathspec')) {
          reject(new Error('File not under version control'));
        } else if (stderr.includes('ambiguous argument') || stderr.includes('unknown revision')) {
          reject(new Error('Invalid revision'));
        } else {
          reject(new Error(`Git blame command failed: ${stderr.trim()}`));
        }
        return;
      }

      try {
        const lines = parseGitBlameOutput(stdout);
        resolve({
          lines,
          total: lines.length,
          repository: repoPath as string,
          filePath,
          revision,
          lineRange: lineStart !== undefined && lineEnd !== undefined ? {
            start: lineStart,
            end: lineEnd
          } : undefined
        });
      } catch (error) {
        reject(new Error(`Failed to parse git blame output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      reject(new Error(`Git blame command execution failed: ${error.message}`));
    });
  });
}

/**
 * Parse git blame porcelain output into structured lines
 */
function parseGitBlameOutput(output: string): BlameLine[] {
  const lines = output.trim().split('\n');
  const blameLines: BlameLine[] = [];
  
  let currentLine: Partial<BlameLine> = {};
  let lineNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('filename ')) {
      // This is the end of a blame entry, process the current line
      if (currentLine.sha && currentLine.author && currentLine.email && currentLine.date && currentLine.content) {
        blameLines.push({
          lineNumber: currentLine.lineNumber || lineNumber,
          sha: currentLine.sha,
          author: currentLine.author,
          email: currentLine.email,
          date: currentLine.date,
          content: currentLine.content
        });
        lineNumber++;
      }
      
      // Reset for next entry
      currentLine = {};
    } else if (line.startsWith('author ')) {
      currentLine.author = line.substring(7);
    } else if (line.startsWith('author-mail ')) {
      currentLine.email = line.substring(12).replace(/[<>]/g, '');
    } else if (line.startsWith('author-time ')) {
      const timestamp = parseInt(line.substring(12));
      currentLine.date = new Date(timestamp * 1000).toISOString();
    } else if (line.startsWith('committer ')) {
      // Skip committer info for now
    } else if (line.startsWith('committer-mail ')) {
      // Skip committer email for now
    } else if (line.startsWith('committer-time ')) {
      // Skip committer time for now
    } else if (line.startsWith('summary ')) {
      // Skip summary for now
    } else if (line.startsWith('previous ')) {
      // Skip previous commit info for now
    } else if (line.startsWith('boundary')) {
      // Skip boundary marker for now
    } else if (line.startsWith('')) {
      // Empty line, skip
    } else {
      // This should be the commit hash and line content
      const parts = line.split('\t');
      if (parts.length >= 2) {
        currentLine.sha = parts[0];
        currentLine.content = parts.slice(1).join('\t');
      }
    }
  }

  // Process the last line if it exists
  if (currentLine.sha && currentLine.author && currentLine.email && currentLine.date && currentLine.content) {
    blameLines.push({
      lineNumber: currentLine.lineNumber || lineNumber,
      sha: currentLine.sha,
      author: currentLine.author,
      email: currentLine.email,
      date: currentLine.date,
      content: currentLine.content
    });
  }

  return blameLines;
}

/**
 * Execute git for-each-ref command and parse results
 */
async function executeGitBranchInfo(
  repository: string,
  branch?: string,
  includeRemote: boolean = false,
  includeMerged: boolean = true
): Promise<BranchInfoResult> {
  return new Promise((resolve, reject) => {
    // Validate repository
    const repoPath = repository ? pathResolve(repository) : process.cwd();
    const gitDir = join(repoPath, '.git');
    
    if (!existsSync(gitDir)) {
      reject(new Error('Not a git repository'));
      return;
    }

    // Build git for-each-ref command
    const args = [
      'for-each-ref',
      '--format=%(refname:short)|%(objectname:short)|%(authorname)|%(authoremail)|%(authordate:iso)|%(upstream:short)|%(upstream:track)',
      'refs/heads'
    ];

    // Add remote branches if requested
    if (includeRemote) {
      args.push('refs/remotes');
    }

    // Add merged filter if specified
    if (!includeMerged) {
      args.push('--no-merged');
    }

    // Filter to specific branch if requested
    if (branch) {
      args.push(`refs/heads/${branch}`);
      if (includeRemote) {
        args.push(`refs/remotes/*/${branch}`);
      }
    }

    console.log(`[GIT_BRANCH] Executing: git ${args.join(' ')} in ${repoPath}`);

    const child: ChildProcess = spawn('git', args, {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error('Git branch command timed out'));
      }
    }, 30000); // 30 second timeout

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      if (code !== 0) {
        // Handle specific error cases
        if (stderr.includes('not a git repository')) {
          reject(new Error('Not a git repository'));
        } else if (stderr.includes('ambiguous argument') || stderr.includes('pathspec')) {
          reject(new Error('Branch not found'));
        } else {
          reject(new Error(`Git branch command failed: ${stderr.trim()}`));
        }
        return;
      }

      try {
        const branches = parseGitBranchOutput(stdout);
        const currentBranch = getCurrentBranch(repoPath as string);
        
        resolve({
          branches,
          total: branches.length,
          repository: repoPath as string,
          currentBranch,
          filters: {
            branch,
            includeRemote,
            includeMerged
          }
        });
      } catch (error) {
        reject(new Error(`Failed to parse git branch output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      reject(new Error(`Git branch command execution failed: ${error.message}`));
    });
  });
}

/**
 * Parse git for-each-ref output into structured branches
 */
function parseGitBranchOutput(output: string): BranchInfo[] {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const branches: BranchInfo[] = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length >= 5) {
      const isRemote = parts[0].includes('/');
      const branchName = isRemote ? parts[0].split('/').slice(1).join('/') : parts[0];
      
      branches.push({
        name: branchName,
        sha: parts[1],
        author: parts[2],
        email: parts[3],
        date: parts[4],
        upstream: parts[5] || undefined,
        tracking: parts[6] || undefined,
        isCurrent: false, // Will be set later
        isRemote
      });
    }
  }

  return branches;
}

/**
 * Get current branch name
 */
function getCurrentBranch(repository: string): string {
  try {
    const { execSync } = require('child_process');
    const result = execSync('git branch --show-current', { 
      cwd: repository, 
      encoding: 'utf8',
      timeout: 5000 
    });
    return result.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Execute git log --follow command for file tracking
 */
async function executeGitFileCommits(
  repository: string,
  filePath: string,
  limit: number = 50,
  author?: string,
  since?: string,
  until?: string,
  includeMerges: boolean = false
): Promise<FileCommitsResult> {
  return new Promise((resolve, reject) => {
    // Validate repository
    const repoPath = repository ? pathResolve(repository) : process.cwd();
    const gitDir = join(repoPath, '.git');
    
    if (!existsSync(gitDir)) {
      reject(new Error('Not a git repository'));
      return;
    }

    // Build git log command
    const args = [
      'log',
      '--follow',
      '--pretty=format:%H|%an|%ae|%ad|%s',
      '--date=iso',
      `-n${limit}`
    ];

    // Add filters
    if (author) {
      args.push('--author', author);
    }
    if (since) {
      args.push('--since', since);
    }
    if (until) {
      args.push('--until', until);
    }
    if (!includeMerges) {
      args.push('--no-merges');
    }
    
    // Add file path
    args.push('--', filePath);

    console.log(`[GIT_FILE_COMMITS] Executing: git ${args.join(' ')} in ${repoPath}`);

    const child: ChildProcess = spawn('git', args, {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error('Git log command timed out'));
      }
    }, 30000); // 30 second timeout

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);

      if (code !== 0) {
        // Handle specific error cases
        if (stderr.includes('not a git repository')) {
          reject(new Error('Not a git repository'));
        } else if (stderr.includes('no such path') || stderr.includes('pathspec')) {
          reject(new Error('File not under version control'));
        } else {
          reject(new Error(`Git log command failed: ${stderr.trim()}`));
        }
        return;
      }

      try {
        const commits = parseGitFileCommitsOutput(stdout);
        resolve({
          commits,
          total: commits.length,
          repository: repoPath as string,
          filePath,
          filters: {
            author,
            since,
            until,
            includeMerges
          }
        });
      } catch (error) {
        reject(new Error(`Failed to parse git log output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    child.on('error', (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      reject(new Error(`Git log command execution failed: ${error.message}`));
    });
  });
}

/**
 * Parse git log output into structured file commits
 */
function parseGitFileCommitsOutput(output: string): FileCommit[] {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const commits: FileCommit[] = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length >= 5) {
      commits.push({
        sha: parts[0],
        author: parts[1],
        email: parts[2],
        date: parts[3],
        message: parts[4]
      });
    }
  }

  return commits;
}

/**
 * Handle Git tool calls
 */
export async function handleGitTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'get_commit_history': {
      const historyArgs = args as any;
      const repository = historyArgs.repository || '.';
      const branch = historyArgs.branch || 'HEAD';
      const limit = historyArgs.limit || 50;
      const author = historyArgs.author;
      const since = historyArgs.since;
      const until = historyArgs.until;
      const filePath = historyArgs.filePath;

      try {
        // Execute git log command
        const result = await executeGitLog(
          repository,
          branch,
          limit,
          author,
          since,
          until,
          filePath
        );

        return createSafeResult('get_commit_history', {
          commits: result.commits,
          total: result.total,
          repository: result.repository,
          branch: result.branch,
          filters: result.filters,
          message: `Retrieved ${result.total} commits from ${result.branch}`,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('Not a git repository')) {
          return createSafeResult('get_commit_history', {
            error: 'Not a git repository',
            message: `Directory ${repository} is not a Git repository`,
            repository,
          }, 'Not a git repository');
        } else if (errorMessage.includes('Branch not found')) {
          return createSafeResult('get_commit_history', {
            error: 'Branch not found',
            message: `Branch ${branch} does not exist in the repository`,
            repository,
            branch,
          }, 'Branch not found');
        } else if (errorMessage.includes('timed out')) {
          return createSafeResult('get_commit_history', {
            error: 'Git command timed out',
            message: 'Git log command exceeded timeout limit',
            repository,
            branch,
          }, 'Git command timeout');
        } else {
          return createSafeResult('get_commit_history', {
            error: 'Git command failed',
            message: errorMessage,
            repository,
            branch,
          }, errorMessage);
        }
      }
    }

    case 'get_file_blame': {
      const blameArgs = args as any;
      const repository = blameArgs.repository || '.';
      const filePath = blameArgs.filePath;
      const revision = blameArgs.revision || 'HEAD';
      const lineStart = blameArgs.lineStart;
      const lineEnd = blameArgs.lineEnd;

      if (!filePath) {
        return createSafeResult('get_file_blame', {
          error: 'filePath is required',
          message: 'Please provide a filePath to get blame information for',
        }, 'Missing filePath parameter');
      }

      try {
        // Execute git blame command
        const result = await executeGitBlame(
          repository,
          filePath,
          revision,
          lineStart,
          lineEnd
        );

        return createSafeResult('get_file_blame', {
          lines: result.lines,
          total: result.total,
          repository: result.repository,
          filePath: result.filePath,
          revision: result.revision,
          lineRange: result.lineRange,
          message: `Retrieved blame information for ${result.total} lines in ${result.filePath}`,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('Not a git repository')) {
          return createSafeResult('get_file_blame', {
            error: 'Not a git repository',
            message: `Directory ${repository} is not a Git repository`,
            repository,
          }, 'Not a git repository');
        } else if (errorMessage.includes('File not under version control')) {
          return createSafeResult('get_file_blame', {
            error: 'File not under version control',
            message: `File ${filePath} is not tracked by Git`,
            repository,
            filePath,
          }, 'File not under version control');
        } else if (errorMessage.includes('Invalid revision')) {
          return createSafeResult('get_file_blame', {
            error: 'Invalid revision',
            message: `Revision ${revision} does not exist in the repository`,
            repository,
            filePath,
            revision,
          }, 'Invalid revision');
        } else if (errorMessage.includes('timed out')) {
          return createSafeResult('get_file_blame', {
            error: 'Git blame command timed out',
            message: 'Git blame command exceeded timeout limit',
            repository,
            filePath,
          }, 'Git blame command timeout');
        } else {
          return createSafeResult('get_file_blame', {
            error: 'Git blame command failed',
            message: errorMessage,
            repository,
            filePath,
          }, errorMessage);
        }
      }
    }

    case 'get_branch_info': {
      const branchArgs = args as any;
      const repository = branchArgs.repository || '.';
      const branch = branchArgs.branch;
      const includeRemote = branchArgs.includeRemote || false;
      const includeMerged = branchArgs.includeMerged !== false; // Default to true

      try {
        // Execute git branch info command
        const result = await executeGitBranchInfo(
          repository,
          branch,
          includeRemote,
          includeMerged
        );

        // Mark current branch
        const branchesWithCurrent = result.branches.map(b => ({
          ...b,
          isCurrent: b.name === result.currentBranch
        }));

        return createSafeResult('get_branch_info', {
          branches: branchesWithCurrent,
          total: result.total,
          repository: result.repository,
          currentBranch: result.currentBranch,
          filters: result.filters,
          message: `Retrieved ${result.total} branches from ${result.repository}`,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('Not a git repository')) {
          return createSafeResult('get_branch_info', {
            error: 'Not a git repository',
            message: `Directory ${repository} is not a Git repository`,
            repository,
          }, 'Not a git repository');
        } else if (errorMessage.includes('Branch not found')) {
          return createSafeResult('get_branch_info', {
            error: 'Branch not found',
            message: `Branch ${branch} does not exist in the repository`,
            repository,
            branch,
          }, 'Branch not found');
        } else if (errorMessage.includes('timed out')) {
          return createSafeResult('get_branch_info', {
            error: 'Git branch command timed out',
            message: 'Git branch command exceeded timeout limit',
            repository,
          }, 'Git branch command timeout');
        } else {
          return createSafeResult('get_branch_info', {
            error: 'Git branch command failed',
            message: errorMessage,
            repository,
          }, errorMessage);
        }
      }
    }

    case 'find_commits_touching_file': {
      const fileCommitsArgs = args as any;
      const repository = fileCommitsArgs.repository || '.';
      const filePath = fileCommitsArgs.filePath;
      const limit = fileCommitsArgs.limit || 50;
      const author = fileCommitsArgs.author;
      const since = fileCommitsArgs.since;
      const until = fileCommitsArgs.until;
      const includeMerges = fileCommitsArgs.includeMerges || false;

      if (!filePath) {
        return createSafeResult('find_commits_touching_file', {
          error: 'filePath is required',
          message: 'Please provide a filePath to find commits for',
        }, 'Missing filePath parameter');
      }

      try {
        // Execute git log --follow command
        const result = await executeGitFileCommits(
          repository,
          filePath,
          limit,
          author,
          since,
          until,
          includeMerges
        );

        return createSafeResult('find_commits_touching_file', {
          commits: result.commits,
          total: result.total,
          repository: result.repository,
          filePath: result.filePath,
          filters: result.filters,
          message: `Found ${result.total} commits that modified ${result.filePath}`,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('Not a git repository')) {
          return createSafeResult('find_commits_touching_file', {
            error: 'Not a git repository',
            message: `Directory ${repository} is not a Git repository`,
            repository,
          }, 'Not a git repository');
        } else if (errorMessage.includes('File not under version control')) {
          return createSafeResult('find_commits_touching_file', {
            error: 'File not under version control',
            message: `File ${filePath} is not tracked by Git`,
            repository,
            filePath,
          }, 'File not under version control');
        } else if (errorMessage.includes('timed out')) {
          return createSafeResult('find_commits_touching_file', {
            error: 'Git log command timed out',
            message: 'Git log command exceeded timeout limit',
            repository,
            filePath,
          }, 'Git log command timeout');
        } else {
          return createSafeResult('find_commits_touching_file', {
            error: 'Git log command failed',
            message: errorMessage,
            repository,
            filePath,
          }, errorMessage);
        }
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown Git tool: ${toolName}`);
  }
}
