/**
 * Code navigation and analysis tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CodeIndexer } from '../core/code-indexer.js';
import type { ToolResponse, SearchOptions } from '../types/index.js';
import {
  SearchSymbolsArgsSchema,
  FindReferencesArgsSchema,
  validateSchema,
  createSafeResult,
} from '../types/schemas.js';

export function createCodeTools(codeIndexer: CodeIndexer): Tool[] {
  return [
    {
      name: 'search_symbols',
      description: 'Search for code symbols (functions, classes, variables) with fuzzy matching and filtering',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Symbol name or pattern to search for',
          },
          directory: {
            type: 'string',
            description: 'Directory to search in',
            default: '.',
          },
          symbolType: {
            type: 'string',
            description: 'Type of symbol to search for',
            enum: ['function', 'class', 'variable', 'import', 'interface', 'type', 'enum'],
          },
          autoIndex: {
            type: 'boolean',
            description: 'Whether to automatically index files if needed',
            default: true,
          },
          fuzzy: {
            type: 'boolean',
            description: 'Whether to use fuzzy matching',
            default: false,
          },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by file extensions (e.g., ["js", "ts", "py"])',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 100,
            minimum: 1,
            maximum: 1000,
          },
          includeDefinition: {
            type: 'boolean',
            description: 'Whether to include symbol definitions in results',
            default: true,
          },
          includeReferences: {
            type: 'boolean',
            description: 'Whether to include symbol references in results',
            default: false,
          },
        },
        required: ['query'],
      },
    },

    {
      name: 'find_references',
      description: 'Find all references to a specific symbol across the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          symbolName: {
            type: 'string',
            description: 'Name of the symbol to find references for',
          },
          directory: {
            type: 'string',
            description: 'Directory to search in',
            default: '.',
          },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by file extensions (e.g., ["js", "ts", "py"])',
          },
          contextLines: {
            type: 'number',
            description: 'Number of context lines to include around each reference',
            default: 2,
            minimum: 0,
            maximum: 10,
          },
          includeDefinition: {
            type: 'boolean',
            description: 'Whether to include the symbol definition in results',
            default: true,
          },
        },
        required: ['symbolName'],
      },
    },

    {
      name: 'index_directory',
      description: 'Index a directory for symbol search and reference tracking',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to index',
            default: '.',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to index subdirectories recursively',
            default: true,
          },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'File extensions to index (e.g., ["js", "ts", "py"])',
          },
          maxFiles: {
            type: 'number',
            description: 'Maximum number of files to index',
            default: 1000,
            minimum: 1,
            maximum: 10000,
          },
          force: {
            type: 'boolean',
            description: 'Whether to force re-indexing of already indexed files',
            default: false,
          },
        },
        required: [],
      },
    },

    {
      name: 'get_index_stats',
      description: 'Get statistics about the current code index',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },

    {
      name: 'clear_index',
      description: 'Clear the code index to free memory and start fresh',
      inputSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            description: 'Confirmation that you want to clear the index',
            default: false,
          },
        },
        required: [],
      },
    },

    {
      name: 'get_symbol_info',
      description: 'Get detailed information about a specific symbol',
      inputSchema: {
        type: 'object',
        properties: {
          symbolName: {
            type: 'string',
            description: 'Name of the symbol to get information for',
          },
          filePath: {
            type: 'string',
            description: 'Optional file path to narrow down the search',
          },
        },
        required: ['symbolName'],
      },
    },
  ];
}

export async function handleCodeTool(
  toolName: string,
  args: unknown,
  codeIndexer: CodeIndexer
): Promise<ToolResponse> {
  try {
    switch (toolName) {
      case 'search_symbols': {
        const validArgs = validateSchema(SearchSymbolsArgsSchema, args, 'search_symbols');

        const searchOptions: SearchOptions = {
          query: validArgs.query,
          directory: validArgs.directory,
          fileExtensions: validArgs.fileExtensions,
          symbolType: validArgs.symbolType,
          fuzzy: validArgs.fuzzy,
          maxResults: validArgs.maxResults,
          includeDefinition: validArgs.includeDefinition,
          includeReferences: validArgs.includeReferences,
        };

        const result = await codeIndexer.searchSymbols(searchOptions);

        return createSafeResult('search_symbols', result, undefined, {
          symbolCount: result.symbols.length,
          referenceCount: result.references.length,
          searchTime: result.searchTime,
          fromCache: result.fromCache,
        });
      }

      case 'find_references': {
        const validArgs = validateSchema(FindReferencesArgsSchema, args, 'find_references');

        const references = await codeIndexer.findReferences(
          validArgs.symbolName,
          validArgs.directory,
          {
            fileExtensions: validArgs.fileExtensions,
            contextLines: validArgs.contextLines,
            includeDefinition: validArgs.includeDefinition,
          }
        );

        return createSafeResult('find_references', references, undefined, {
          symbolName: validArgs.symbolName,
          referenceCount: references.length,
        });
      }

      case 'index_directory': {
        const indexArgs = args as any;

        const stats = await codeIndexer.indexDirectory(
          indexArgs.directory || '.',
          {
            recursive: indexArgs.recursive,
            fileExtensions: indexArgs.fileExtensions,
            maxFiles: indexArgs.maxFiles,
            force: indexArgs.force,
          }
        );

        return createSafeResult('index_directory', stats, undefined, {
          directory: indexArgs.directory || '.',
          indexDuration: stats.indexDuration,
          symbolCount: stats.totalSymbols,
        });
      }

      case 'get_index_stats': {
        const stats = codeIndexer.getStats();
        return createSafeResult('get_index_stats', stats);
      }

      case 'clear_index': {
        const clearArgs = args as any;

        if (!clearArgs.confirm) {
          return createSafeResult(
            'clear_index',
            undefined,
            'Index clearing requires confirmation. Set "confirm": true to proceed.'
          );
        }

        codeIndexer.clearIndex();
        return createSafeResult('clear_index', { cleared: true }, undefined, {
          message: 'Code index has been cleared successfully',
        });
      }

      case 'get_symbol_info': {
        const symbolArgs = args as any;

        if (!symbolArgs.symbolName) {
          return createSafeResult(
            'get_symbol_info',
            undefined,
            'symbolName is required'
          );
        }

        // Get symbols matching the name
        const searchResult = await codeIndexer.searchSymbols({
          query: symbolArgs.symbolName,
          directory: '.',
          maxResults: 50,
          includeReferences: true,
        });

        // Filter by file path if provided
        let symbols = searchResult.symbols.filter(s => s.name === symbolArgs.symbolName);
        if (symbolArgs.filePath) {
          symbols = symbols.filter(s => s.filePath === symbolArgs.filePath);
        }

        const references = searchResult.references.filter(r => r.symbolName === symbolArgs.symbolName);

        return createSafeResult('get_symbol_info', {
          symbols,
          references,
          symbolCount: symbols.length,
          referenceCount: references.length,
        });
      }

      default:
        return createSafeResult(
          toolName,
          undefined,
          `Unknown code tool: ${toolName}`
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