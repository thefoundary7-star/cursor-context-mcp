/**
 * Enhanced file operation tools for MCP server
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { EnhancedFileOperations } from '../core/file-operations.js';
import type { ToolResponse } from '../types/index.js';
import {
  ListFilesArgsSchema,
  ReadFileArgsSchema,
  WriteFileArgsSchema,
  validateSchema,
  createSafeResult,
} from '../types/schemas.js';

export function createFileTools(fileOps: EnhancedFileOperations): Tool[] {
  return [
    {
      name: 'list_files',
      description: 'List files and directories with enhanced filtering, metadata, and caching',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory path to list (defaults to current directory)',
            default: '.',
          },
          pattern: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g., "*.js", "**/*.ts")',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to recursively list subdirectories',
            default: true,
          },
          includeHidden: {
            type: 'boolean',
            description: 'Whether to include hidden files (starting with .)',
            default: false,
          },
        },
        required: [],
      },
    },

    {
      name: 'read_file',
      description: 'Read file contents with encoding detection, size limits, and caching',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to read',
          },
          maxLines: {
            type: 'number',
            description: 'Maximum number of lines to read (optional)',
            minimum: 1,
          },
          encoding: {
            type: 'string',
            description: 'Text encoding to use',
            default: 'utf-8',
            enum: ['utf-8', 'ascii', 'latin1', 'base64', 'hex'],
          },
        },
        required: ['filePath'],
      },
    },

    {
      name: 'write_file',
      description: 'Write content to a file with atomic operations, backup support, and safety checks',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
          createDirectories: {
            type: 'boolean',
            description: 'Whether to create parent directories if they don\'t exist',
            default: false,
          },
          backup: {
            type: 'boolean',
            description: 'Whether to create a backup of existing file',
            default: false,
          },
        },
        required: ['filePath', 'content'],
      },
    },

    {
      name: 'search_files',
      description: 'Search for files using advanced patterns with filtering and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to search in',
            default: '.',
          },
          pattern: {
            type: 'string',
            description: 'Search pattern (supports glob patterns)',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to search recursively',
            default: true,
          },
          includeHidden: {
            type: 'boolean',
            description: 'Whether to include hidden files',
            default: false,
          },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by file extensions (e.g., ["js", "ts"])',
          },
          excludePatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns to exclude (e.g., ["node_modules", "*.log"])',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 1000,
            minimum: 1,
          },
        },
        required: ['pattern'],
      },
    },

    {
      name: 'get_file_diff',
      description: 'Compare two files and return a unified diff',
      inputSchema: {
        type: 'object',
        properties: {
          filePath1: {
            type: 'string',
            description: 'Path to the first file',
          },
          filePath2: {
            type: 'string',
            description: 'Path to the second file',
          },
          contextLines: {
            type: 'number',
            description: 'Number of context lines to include in diff',
            default: 3,
            minimum: 0,
          },
          ignoreWhitespace: {
            type: 'boolean',
            description: 'Whether to ignore whitespace differences',
            default: false,
          },
        },
        required: ['filePath1', 'filePath2'],
      },
    },

    {
      name: 'get_file_stats',
      description: 'Get comprehensive file operation statistics and performance metrics',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ];
}

export async function handleFileTool(
  toolName: string,
  args: unknown,
  fileOps: EnhancedFileOperations
): Promise<ToolResponse> {
  try {
    switch (toolName) {
      case 'list_files':
        return await fileOps.listFiles(args);

      case 'read_file':
        return await fileOps.readFile(args);

      case 'write_file':
        return await fileOps.writeFile(args);

      case 'search_files': {
        const searchArgs = args as any;
        return await fileOps.searchFiles(
          searchArgs.directory,
          searchArgs.pattern,
          {
            recursive: searchArgs.recursive,
            includeHidden: searchArgs.includeHidden,
            fileExtensions: searchArgs.fileExtensions,
            excludePatterns: searchArgs.excludePatterns,
            maxResults: searchArgs.maxResults,
          }
        );
      }

      case 'get_file_diff': {
        const diffArgs = args as any;
        return await fileOps.getFileDiff(
          diffArgs.filePath1,
          diffArgs.filePath2,
          {
            contextLines: diffArgs.contextLines,
            ignoreWhitespace: diffArgs.ignoreWhitespace,
          }
        );
      }

      case 'get_file_stats':
        return createSafeResult('get_file_stats', fileOps.getStats());

      default:
        return createSafeResult(
          toolName,
          undefined,
          `Unknown file tool: ${toolName}`
        );
    }
  } catch (error) {
    return createSafeResult(
      toolName,
      undefined,
      error instanceof Error ? error.message : String(error)
    );
  }
}