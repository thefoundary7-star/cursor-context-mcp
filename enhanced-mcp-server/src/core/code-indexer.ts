/**
 * Advanced code indexer with symbol extraction and reference tracking
 */

import { readFile } from 'fs/promises';
import { extname, basename } from 'path';
import { EventEmitter } from 'events';
import * as acorn from 'acorn';
import { simple as walkSimple } from 'acorn-walk';
import { parse as parseTypeScript } from '@typescript-eslint/parser';
import { parse as parseComments } from 'comment-parser';

import { PathValidator, isTextFile } from '../utils/path-validation.js';
import { EnhancedCache } from '../performance/cache.js';
import { PerformanceMonitor, withPerformanceMonitoring } from '../performance/monitor.js';
import type {
  Symbol,
  Reference,
  IndexStats,
  SearchOptions,
  SearchResult,
  ConfigurationOptions,
} from '../types/index.js';

// Language-specific parsers
const LANGUAGE_PARSERS = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.rs': 'rust',
} as const;

export interface IndexedFile {
  filePath: string;
  language: string;
  symbols: Symbol[];
  references: Reference[];
  lastModified: number;
  indexedAt: number;
  errors: string[];
}

export class CodeIndexer extends EventEmitter {
  private pathValidator: PathValidator;
  private cache: EnhancedCache<any>;
  private performanceMonitor: PerformanceMonitor;
  private config: ConfigurationOptions;
  private indexedFiles: Map<string, IndexedFile> = new Map();
  private symbolIndex: Map<string, Symbol[]> = new Map();
  private referenceIndex: Map<string, Reference[]> = new Map();
  private isIndexing: boolean = false;

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
   * Index a single file and extract symbols/references
   */
  async indexFile(filePath: string, force: boolean = false): Promise<IndexedFile | null> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'indexFile',
      async () => {
        try {
          // Validate file path
          const validPath = await this.pathValidator.validatePath(filePath, 'read');

          // Check if file should be processed
          if (!this.pathValidator.shouldProcessFile(validPath)) {
            return null;
          }

          // Check cache if not forcing
          if (!force) {
            const cached = this.cache.get(`index:${validPath}`);
            if (cached) {
              this.indexedFiles.set(validPath, cached);
              this.updateIndices(cached);
              return cached;
            }
          }

          // Check if file is text
          if (!isTextFile(validPath)) {
            return null;
          }

          // Get file language
          const language = this.detectLanguage(validPath);
          if (!language) {
            return null;
          }

          // Read file content
          const content = await readFile(validPath, 'utf8');

          // Parse and extract symbols/references
          const { symbols, references, errors } = await this.parseFile(
            validPath,
            content,
            language
          );

          const indexedFile: IndexedFile = {
            filePath: validPath,
            language,
            symbols,
            references,
            lastModified: Date.now(),
            indexedAt: Date.now(),
            errors,
          };

          // Store in cache and indices
          this.cache.set(`index:${validPath}`, indexedFile, 300000); // 5 minutes
          this.indexedFiles.set(validPath, indexedFile);
          this.updateIndices(indexedFile);

          this.emit('fileIndexed', { filePath: validPath, symbolCount: symbols.length });

          return indexedFile;
        } catch (error) {
          this.emit('indexError', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }
    );
  }

  /**
   * Index multiple files in a directory
   */
  async indexDirectory(
    directory: string,
    options: {
      recursive?: boolean;
      fileExtensions?: string[];
      maxFiles?: number;
      force?: boolean;
    } = {}
  ): Promise<IndexStats> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'indexDirectory',
      async () => {
        const startTime = Date.now();
        this.isIndexing = true;
        const { recursive = true, fileExtensions, maxFiles = 1000, force = false } = options;

        try {
          // Validate directory
          const validDirectory = await this.pathValidator.validateDirectory(directory);

          // Find files to index
          const { glob } = await import('glob');
          const patterns = fileExtensions
            ? fileExtensions.map(ext => `**/*.${ext.replace(/^\./, '')}`)
            : ['**/*'];

          const allFiles: string[] = [];
          for (const pattern of patterns) {
            const files = await glob(
              recursive ? `${validDirectory}/${pattern}` : `${validDirectory}/${pattern.replace('**/', '')}`,
              {
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
                nodir: true,
              }
            );
            allFiles.push(...files);
          }

          // Limit files if specified
          const filesToIndex = allFiles.slice(0, maxFiles);

          // Index files in batches
          const batchSize = 50;
          const indexedFiles: IndexedFile[] = [];
          const errors: string[] = [];

          for (let i = 0; i < filesToIndex.length; i += batchSize) {
            const batch = filesToIndex.slice(i, i + batchSize);
            const batchPromises = batch.map(async (file) => {
              try {
                const result = await this.indexFile(file, force);
                return result;
              } catch (error) {
                errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
                return null;
              }
            });

            const batchResults = await Promise.all(batchPromises);
            indexedFiles.push(...batchResults.filter(Boolean) as IndexedFile[]);

            // Emit progress
            this.emit('indexProgress', {
              processed: i + batch.length,
              total: filesToIndex.length,
              directory: validDirectory,
            });
          }

          const stats: IndexStats = {
            totalFiles: filesToIndex.length,
            indexedFiles: indexedFiles.length,
            totalSymbols: indexedFiles.reduce((sum, file) => sum + file.symbols.length, 0),
            lastIndexTime: startTime,
            indexDuration: Date.now() - startTime,
            filesByLanguage: this.getFilesByLanguage(indexedFiles),
            symbolsByType: this.getSymbolsByType(indexedFiles),
            errors,
          };

          this.emit('indexCompleted', stats);

          return stats;
        } finally {
          this.isIndexing = false;
        }
      }
    );
  }

  /**
   * Search symbols with fuzzy matching and filtering
   */
  async searchSymbols(options: SearchOptions): Promise<SearchResult> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'searchSymbols',
      async () => {
        const startTime = Date.now();
        const {
          query,
          directory = '.',
          fileExtensions,
          symbolType,
          fuzzy = false,
          maxResults = 100,
        } = options;

        // Validate directory
        const validDirectory = await this.pathValidator.validateDirectory(directory);

        // Check cache
        const cacheKey = `search:${JSON.stringify(options)}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return { ...cached, fromCache: true };
        }

        // Auto-index if needed
        await this.ensureDirectoryIndexed(validDirectory, { fileExtensions });

        // Search symbols
        let allSymbols: Symbol[] = [];
        for (const [filePath, indexedFile] of this.indexedFiles) {
          // Filter by directory
          if (!filePath.startsWith(validDirectory)) {
            continue;
          }

          // Filter by file extensions
          if (fileExtensions && !this.pathValidator.hasAllowedExtension(filePath, fileExtensions)) {
            continue;
          }

          allSymbols.push(...indexedFile.symbols);
        }

        // Filter by symbol type
        if (symbolType) {
          allSymbols = allSymbols.filter(symbol => symbol.type === symbolType);
        }

        // Search symbols
        const matchedSymbols = this.filterSymbols(allSymbols, query, fuzzy);

        // Limit results
        const limitedSymbols = matchedSymbols.slice(0, maxResults);

        // Find references for matched symbols if requested
        const references: Reference[] = [];
        if (options.includeReferences) {
          for (const symbol of limitedSymbols) {
            const symbolRefs = this.referenceIndex.get(symbol.name) || [];
            references.push(...symbolRefs);
          }
        }

        const result: SearchResult = {
          symbols: limitedSymbols,
          references,
          totalResults: matchedSymbols.length,
          searchTime: Date.now() - startTime,
          fromCache: false,
        };

        // Cache result
        this.cache.set(cacheKey, result, 60000); // 1 minute

        return result;
      }
    );
  }

  /**
   * Find references to a symbol
   */
  async findReferences(
    symbolName: string,
    directory: string = '.',
    options: {
      fileExtensions?: string[];
      contextLines?: number;
      includeDefinition?: boolean;
    } = {}
  ): Promise<Reference[]> {
    return withPerformanceMonitoring(
      this.performanceMonitor,
      'findReferences',
      async () => {
        const { fileExtensions, includeDefinition = true } = options;

        // Validate directory
        const validDirectory = await this.pathValidator.validateDirectory(directory);

        // Auto-index if needed
        await this.ensureDirectoryIndexed(validDirectory, { fileExtensions });

        // Get references from index
        const references = this.referenceIndex.get(symbolName) || [];

        // Filter by directory and file extensions
        let filteredReferences = references.filter(ref => {
          if (!ref.filePath.startsWith(validDirectory)) {
            return false;
          }

          if (fileExtensions && !this.pathValidator.hasAllowedExtension(ref.filePath, fileExtensions)) {
            return false;
          }

          return true;
        });

        // Include definition if requested
        if (includeDefinition) {
          const symbols = this.symbolIndex.get(symbolName) || [];
          const definitions = symbols
            .filter(symbol => symbol.filePath.startsWith(validDirectory))
            .map(symbol => ({
              symbolName,
              filePath: symbol.filePath,
              lineNumber: symbol.lineNumber,
              context: symbol.definition,
              refType: 'definition' as const,
            }));

          filteredReferences.push(...definitions);
        }

        // Sort by file path and line number
        filteredReferences.sort((a, b) => {
          if (a.filePath !== b.filePath) {
            return a.filePath.localeCompare(b.filePath);
          }
          return a.lineNumber - b.lineNumber;
        });

        return filteredReferences;
      }
    );
  }

  /**
   * Get indexing statistics
   */
  getStats(): IndexStats {
    const allSymbols = Array.from(this.indexedFiles.values()).flatMap(file => file.symbols);
    const allErrors = Array.from(this.indexedFiles.values()).flatMap(file => file.errors);

    return {
      totalFiles: this.indexedFiles.size,
      indexedFiles: this.indexedFiles.size,
      totalSymbols: allSymbols.length,
      lastIndexTime: Math.max(...Array.from(this.indexedFiles.values()).map(f => f.indexedAt), 0),
      indexDuration: 0, // Not tracked at global level
      filesByLanguage: this.getFilesByLanguage(Array.from(this.indexedFiles.values())),
      symbolsByType: this.getSymbolsByType(Array.from(this.indexedFiles.values())),
      errors: allErrors,
    };
  }

  /**
   * Clear all indices
   */
  clearIndex(): void {
    this.indexedFiles.clear();
    this.symbolIndex.clear();
    this.referenceIndex.clear();
    this.cache.deleteByPattern(/^index:/);
    this.cache.deleteByPattern(/^search:/);
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string | null {
    const ext = extname(filePath).toLowerCase();
    return LANGUAGE_PARSERS[ext as keyof typeof LANGUAGE_PARSERS] || null;
  }

  /**
   * Parse file content to extract symbols and references
   */
  private async parseFile(
    filePath: string,
    content: string,
    language: string
  ): Promise<{ symbols: Symbol[]; references: Reference[]; errors: string[] }> {
    const symbols: Symbol[] = [];
    const references: Reference[] = [];
    const errors: string[] = [];

    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          return this.parseJavaScriptTypeScript(filePath, content, language);
        case 'python':
          return this.parsePython(filePath, content);
        default:
          // Fallback to basic regex parsing
          return this.parseGeneric(filePath, content, language);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return { symbols, references, errors };
    }
  }

  /**
   * Parse JavaScript/TypeScript files
   */
  private parseJavaScriptTypeScript(
    filePath: string,
    content: string,
    language: string
  ): { symbols: Symbol[]; references: Reference[]; errors: string[] } {
    const symbols: Symbol[] = [];
    const references: Reference[] = [];
    const errors: string[] = [];

    try {
      // Parse with appropriate parser
      let ast: any;
      if (language === 'typescript') {
        ast = parseTypeScript(content, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ecmaFeatures: { jsx: true },
        });
      } else {
        ast = acorn.parse(content, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          allowHashBang: true,
        });
      }

      // Walk AST to extract symbols and references
      walkSimple(ast, {
        FunctionDeclaration: (node: any) => {
          symbols.push({
            name: node.id?.name || 'anonymous',
            type: 'function',
            filePath,
            lineNumber: node.loc?.start?.line || 1,
            definition: this.getNodeText(content, node),
            isAsync: node.async,
            isExported: this.isExported(node),
          });
        },

        VariableDeclarator: (node: any) => {
          if (node.id?.name) {
            symbols.push({
              name: node.id.name,
              type: 'variable',
              filePath,
              lineNumber: node.loc?.start?.line || 1,
              definition: this.getNodeText(content, node),
            });
          }
        },

        ClassDeclaration: (node: any) => {
          symbols.push({
            name: node.id?.name || 'anonymous',
            type: 'class',
            filePath,
            lineNumber: node.loc?.start?.line || 1,
            definition: this.getNodeText(content, node),
            isExported: this.isExported(node),
          });
        },

        ImportDeclaration: (node: any) => {
          for (const specifier of node.specifiers || []) {
            if (specifier.local?.name) {
              symbols.push({
                name: specifier.local.name,
                type: 'import',
                filePath,
                lineNumber: node.loc?.start?.line || 1,
                definition: this.getNodeText(content, node),
              });
            }
          }
        },

        Identifier: (node: any) => {
          // Track references (simplified)
          references.push({
            symbolName: node.name,
            filePath,
            lineNumber: node.loc?.start?.line || 1,
            context: this.getLineContext(content, node.loc?.start?.line || 1),
            refType: 'reference',
          });
        },
      });
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { symbols, references, errors };
  }

  /**
   * Parse Python files (simplified regex-based approach)
   */
  private parsePython(
    filePath: string,
    content: string
  ): { symbols: Symbol[]; references: Reference[]; errors: string[] } {
    const symbols: Symbol[] = [];
    const references: Reference[] = [];
    const errors: string[] = [];

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Function definitions
      const funcMatch = line.match(/^\s*def\s+(\w+)\s*\(/);
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          filePath,
          lineNumber,
          definition: line.trim(),
        });
      }

      // Class definitions
      const classMatch = line.match(/^\s*class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          filePath,
          lineNumber,
          definition: line.trim(),
        });
      }

      // Import statements
      const importMatch = line.match(/^\s*(?:from\s+\w+\s+)?import\s+(.+)/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(imp => imp.trim().split(' as ')[0]);
        for (const imp of imports) {
          symbols.push({
            name: imp,
            type: 'import',
            filePath,
            lineNumber,
            definition: line.trim(),
          });
        }
      }
    }

    return { symbols, references, errors };
  }

  /**
   * Generic parser for unsupported languages
   */
  private parseGeneric(
    filePath: string,
    content: string,
    language: string
  ): { symbols: Symbol[]; references: Reference[]; errors: string[] } {
    const symbols: Symbol[] = [];
    const references: Reference[] = [];
    const errors: string[] = [];

    // Very basic symbol extraction using common patterns
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Try to find function-like patterns
      const patterns = [
        /(?:function|func|def|fn)\s+(\w+)/i,
        /(?:class|struct|type)\s+(\w+)/i,
        /(?:const|let|var)\s+(\w+)/i,
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          symbols.push({
            name: match[1],
            type: 'function', // Default type
            filePath,
            lineNumber,
            definition: line.trim(),
          });
        }
      }
    }

    return { symbols, references, errors };
  }

  /**
   * Update symbol and reference indices
   */
  private updateIndices(indexedFile: IndexedFile): void {
    // Update symbol index
    for (const symbol of indexedFile.symbols) {
      let symbolList = this.symbolIndex.get(symbol.name);
      if (!symbolList) {
        symbolList = [];
        this.symbolIndex.set(symbol.name, symbolList);
      }
      symbolList.push(symbol);
    }

    // Update reference index
    for (const reference of indexedFile.references) {
      let referenceList = this.referenceIndex.get(reference.symbolName);
      if (!referenceList) {
        referenceList = [];
        this.referenceIndex.set(reference.symbolName, referenceList);
      }
      referenceList.push(reference);
    }
  }

  /**
   * Ensure directory is indexed
   */
  private async ensureDirectoryIndexed(
    directory: string,
    options: { fileExtensions?: string[] } = {}
  ): Promise<void> {
    // Check if we have recent index data for this directory
    const cacheKey = `indexed:${directory}`;
    const lastIndexed = this.cache.get(cacheKey);
    const now = Date.now();

    if (!lastIndexed || now - lastIndexed > 300000) { // 5 minutes
      await this.indexDirectory(directory, options);
      this.cache.set(cacheKey, now, 300000);
    }
  }

  /**
   * Filter symbols by query with fuzzy matching support
   */
  private filterSymbols(symbols: Symbol[], query: string, fuzzy: boolean): Symbol[] {
    const lowerQuery = query.toLowerCase();

    return symbols.filter(symbol => {
      const lowerName = symbol.name.toLowerCase();

      if (fuzzy) {
        // Simple fuzzy matching
        return this.fuzzyMatch(lowerName, lowerQuery);
      } else {
        // Exact substring matching
        return lowerName.includes(lowerQuery);
      }
    });
  }

  /**
   * Simple fuzzy matching algorithm
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    let textIndex = 0;
    let patternIndex = 0;

    while (textIndex < text.length && patternIndex < pattern.length) {
      if (text[textIndex] === pattern[patternIndex]) {
        patternIndex++;
      }
      textIndex++;
    }

    return patternIndex === pattern.length;
  }

  /**
   * Get text content of a node
   */
  private getNodeText(content: string, node: any): string {
    if (node.start !== undefined && node.end !== undefined) {
      return content.slice(node.start, node.end);
    }
    return '';
  }

  /**
   * Get line context from content
   */
  private getLineContext(content: string, lineNumber: number): string {
    const lines = content.split('\n');
    return lines[lineNumber - 1] || '';
  }

  /**
   * Check if node is exported
   */
  private isExported(node: any): boolean {
    // Simplified check
    return node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration';
  }

  /**
   * Get files by language statistics
   */
  private getFilesByLanguage(files: IndexedFile[]): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const file of files) {
      stats[file.language] = (stats[file.language] || 0) + 1;
    }
    return stats;
  }

  /**
   * Get symbols by type statistics
   */
  private getSymbolsByType(files: IndexedFile[]): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const file of files) {
      for (const symbol of file.symbols) {
        stats[symbol.type] = (stats[symbol.type] || 0) + 1;
      }
    }
    return stats;
  }
}

export default CodeIndexer;