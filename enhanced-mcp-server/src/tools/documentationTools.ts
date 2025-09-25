import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { minimatch } from 'minimatch';

// Types for documentation extraction
interface DocumentationFile {
  path: string;
  type: 'markdown' | 'restructuredtext' | 'text' | 'javascript' | 'typescript' | 'python' | 'other';
  docs: string[];
  sections: string[];
}

interface DocumentationResult {
  files: DocumentationFile[];
  summary: {
    totalFiles: number;
    totalDocs: number;
    byType: Record<string, number>;
  };
}

/**
 * Get file type based on extension
 */
function getFileType(filePath: string): DocumentationFile['type'] {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath).toLowerCase();
  
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.rst' || ext === '.rest') return 'restructuredtext';
  if (ext === '.txt') return 'text';
  if (ext === '.js' || ext === '.jsx') return 'javascript';
  if (ext === '.ts' || ext === '.tsx') return 'typescript';
  if (ext === '.py') return 'python';
  
  return 'other';
}

/**
 * Check if file matches any of the patterns
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => minimatch(filePath, pattern));
}

/**
 * Extract markdown documentation
 */
function extractMarkdownDocs(content: string): { docs: string[]; sections: string[] } {
  const docs: string[] = [];
  const sections: string[] = [];
  
  const lines = content.split('\n');
  let currentDoc = '';
  let inCodeBlock = false;
  
  for (const line of lines) {
    // Check for code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    
    // Skip code blocks
    if (inCodeBlock) continue;
    
    // Extract headings as sections
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      sections.push(`${'  '.repeat(level - 1)}${title}`);
      
      // Start new documentation section
      if (currentDoc.trim()) {
        docs.push(currentDoc.trim());
        currentDoc = '';
      }
      currentDoc += line + '\n';
    } else if (line.trim() && !line.match(/^[-*+]\s/) && !line.match(/^\d+\.\s/)) {
      // Regular documentation content
      currentDoc += line + '\n';
    }
  }
  
  // Add final documentation
  if (currentDoc.trim()) {
    docs.push(currentDoc.trim());
  }
  
  return { docs, sections };
}

/**
 * Extract reStructuredText documentation
 */
function extractRstDocs(content: string): { docs: string[]; sections: string[] } {
  const docs: string[] = [];
  const sections: string[] = [];
  
  const lines = content.split('\n');
  let currentDoc = '';
  let inCodeBlock = false;
  
  for (const line of lines) {
    // Check for code blocks
    if (line.trim().startsWith('.. code-block::') || line.trim().startsWith('::')) {
      inCodeBlock = true;
      continue;
    }
    
    if (inCodeBlock && line.trim() === '') {
      inCodeBlock = false;
      continue;
    }
    
    // Skip code blocks
    if (inCodeBlock) continue;
    
    // Extract headings as sections
    const headingMatch = line.match(/^([=~-]+)$/);
    if (headingMatch && lines[lines.indexOf(line) - 1]) {
      const title = lines[lines.indexOf(line) - 1].trim();
      sections.push(title);
      
      // Start new documentation section
      if (currentDoc.trim()) {
        docs.push(currentDoc.trim());
        currentDoc = '';
      }
      currentDoc += lines[lines.indexOf(line) - 1] + '\n';
    } else if (line.trim() && !line.match(/^\.\.\s/) && !line.match(/^:\w+:/)) {
      // Regular documentation content
      currentDoc += line + '\n';
    }
  }
  
  // Add final documentation
  if (currentDoc.trim()) {
    docs.push(currentDoc.trim());
  }
  
  return { docs, sections };
}

/**
 * Extract text documentation
 */
function extractTextDocs(content: string): { docs: string[]; sections: string[] } {
  const docs: string[] = [];
  const sections: string[] = [];
  
  const lines = content.split('\n');
  let currentDoc = '';
  
  for (const line of lines) {
    // Extract simple headings (lines with only caps or title case)
    if (line.trim() && line === line.toUpperCase() && line.length > 3 && !line.includes(' ')) {
      sections.push(line.trim());
      
      // Start new documentation section
      if (currentDoc.trim()) {
        docs.push(currentDoc.trim());
        currentDoc = '';
      }
    } else if (line.trim()) {
      currentDoc += line + '\n';
    }
  }
  
  // Add final documentation
  if (currentDoc.trim()) {
    docs.push(currentDoc.trim());
  }
  
  return { docs, sections };
}

/**
 * Extract JavaScript/TypeScript documentation
 */
function extractJsDocs(content: string): { docs: string[]; sections: string[] } {
  const docs: string[] = [];
  const sections: string[] = [];
  
  const lines = content.split('\n');
  let currentDoc = '';
  let inComment = false;
  let inJSDoc = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for JSDoc comments
    if (line.trim().startsWith('/**')) {
      inJSDoc = true;
      currentDoc = line + '\n';
      continue;
    }
    
    if (inJSDoc) {
      currentDoc += line + '\n';
      if (line.trim().endsWith('*/')) {
        inJSDoc = false;
        docs.push(currentDoc.trim());
        currentDoc = '';
        continue;
      }
    }
    
    // Check for block comments
    if (line.trim().startsWith('/*')) {
      inComment = true;
      currentDoc = line + '\n';
      continue;
    }
    
    if (inComment) {
      currentDoc += line + '\n';
      if (line.trim().endsWith('*/')) {
        inComment = false;
        docs.push(currentDoc.trim());
        currentDoc = '';
        continue;
      }
    }
    
    // Check for function/class declarations (sections)
    const funcMatch = line.match(/^(export\s+)?(function|class|interface|type|enum)\s+(\w+)/);
    if (funcMatch) {
      sections.push(`${funcMatch[2]} ${funcMatch[3]}`);
    }
  }
  
  return { docs, sections };
}

/**
 * Extract Python documentation
 */
function extractPythonDocs(content: string): { docs: string[]; sections: string[] } {
  const docs: string[] = [];
  const sections: string[] = [];
  
  const lines = content.split('\n');
  let currentDoc = '';
  let inDocstring = false;
  let docstringType = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for docstrings
    if (line.trim().startsWith('"""') || line.trim().startsWith("'''")) {
      if (!inDocstring) {
        inDocstring = true;
        docstringType = line.trim().substring(0, 3);
        currentDoc = line + '\n';
      } else {
        inDocstring = false;
        currentDoc += line + '\n';
        docs.push(currentDoc.trim());
        currentDoc = '';
      }
      continue;
    }
    
    if (inDocstring) {
      currentDoc += line + '\n';
      continue;
    }
    
    // Check for function/class declarations (sections)
    const funcMatch = line.match(/^(def|class)\s+(\w+)/);
    if (funcMatch) {
      sections.push(`${funcMatch[1]} ${funcMatch[2]}`);
    }
  }
  
  return { docs, sections };
}

/**
 * Recursively scan directory for documentation files
 */
function scanDirectoryForDocs(dirPath: string, patterns: string[]): DocumentationFile[] {
  const results: DocumentationFile[] = [];
  
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip common non-documentation directories
        if (['node_modules', '.git', '.vscode', 'dist', 'build', '__pycache__'].includes(item)) {
          continue;
        }
        
        // Recursively scan subdirectories
        results.push(...scanDirectoryForDocs(fullPath, patterns));
      } else if (stat.isFile()) {
        // Check if file matches patterns
        if (matchesPatterns(fullPath, patterns)) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const fileType = getFileType(fullPath);
            let docs: string[] = [];
            let sections: string[] = [];
            
            // Extract documentation based on file type
            switch (fileType) {
              case 'markdown':
                ({ docs, sections } = extractMarkdownDocs(content));
                break;
              case 'restructuredtext':
                ({ docs, sections } = extractRstDocs(content));
                break;
              case 'text':
                ({ docs, sections } = extractTextDocs(content));
                break;
              case 'javascript':
              case 'typescript':
                ({ docs, sections } = extractJsDocs(content));
                break;
              case 'python':
                ({ docs, sections } = extractPythonDocs(content));
                break;
              default:
                // For other file types, extract basic documentation
                ({ docs, sections } = extractTextDocs(content));
            }
            
            results.push({
              path: fullPath,
              type: fileType,
              docs,
              sections
            });
          } catch (error) {
            console.error(`[DOCUMENTATION] Error reading file ${fullPath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[DOCUMENTATION] Error scanning directory ${dirPath}:`, error);
  }
  
  return results;
}

// Types for documentation coverage analysis
interface CoverageItem {
  file: string;
  type: 'function' | 'class' | 'module';
  name: string;
}

interface CoverageData {
  coverage: {
    overall: number;
    functions: { total: number; documented: number; coverage: number };
    classes: { total: number; documented: number; coverage: number };
    modules: { total: number; documented: number; coverage: number };
  };
  undocumented: CoverageItem[];
  summary: {
    totalFiles: number;
    totalItems: number;
    documentedItems: number;
    undocumentedItems: number;
  };
}

/**
 * Analyze documentation coverage for code files
 */
function analyzeDocumentationCoverage(files: DocumentationFile[]): CoverageData {
  const functions: CoverageItem[] = [];
  const classes: CoverageItem[] = [];
  const modules: CoverageItem[] = [];
  const undocumented: CoverageItem[] = [];
  
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalModules = 0;
  let documentedFunctions = 0;
  let documentedClasses = 0;
  let documentedModules = 0;

  for (const file of files) {
    const content = readFileSync(file.path, 'utf-8');
    const lines = content.split('\n');
    
    // Analyze based on file type
    if (file.type === 'javascript' || file.type === 'typescript') {
      const jsAnalysis = analyzeJavaScriptFile(file.path, content, lines);
      functions.push(...jsAnalysis.functions);
      classes.push(...jsAnalysis.classes);
      modules.push(...jsAnalysis.modules);
      undocumented.push(...jsAnalysis.undocumented);
      
      totalFunctions += jsAnalysis.functions.length;
      totalClasses += jsAnalysis.classes.length;
      totalModules += jsAnalysis.modules.length;
      documentedFunctions += jsAnalysis.functions.filter(f => f.name !== 'undocumented').length;
      documentedClasses += jsAnalysis.classes.filter(c => c.name !== 'undocumented').length;
      documentedModules += jsAnalysis.modules.filter(m => m.name !== 'undocumented').length;
    } else if (file.type === 'python') {
      const pyAnalysis = analyzePythonFile(file.path, content, lines);
      functions.push(...pyAnalysis.functions);
      classes.push(...pyAnalysis.classes);
      modules.push(...pyAnalysis.modules);
      undocumented.push(...pyAnalysis.undocumented);
      
      totalFunctions += pyAnalysis.functions.length;
      totalClasses += pyAnalysis.classes.length;
      totalModules += pyAnalysis.modules.length;
      documentedFunctions += pyAnalysis.functions.filter(f => f.name !== 'undocumented').length;
      documentedClasses += pyAnalysis.classes.filter(c => c.name !== 'undocumented').length;
      documentedModules += pyAnalysis.modules.filter(m => m.name !== 'undocumented').length;
    }
  }

  // Calculate coverage percentages
  const functionCoverage = totalFunctions > 0 ? (documentedFunctions / totalFunctions) * 100 : 0;
  const classCoverage = totalClasses > 0 ? (documentedClasses / totalClasses) * 100 : 0;
  const moduleCoverage = totalModules > 0 ? (documentedModules / totalModules) * 100 : 0;
  
  const totalItems = totalFunctions + totalClasses + totalModules;
  const documentedItems = documentedFunctions + documentedClasses + documentedModules;
  const overallCoverage = totalItems > 0 ? (documentedItems / totalItems) * 100 : 0;

  return {
    coverage: {
      overall: Math.round(overallCoverage * 10) / 10,
      functions: {
        total: totalFunctions,
        documented: documentedFunctions,
        coverage: Math.round(functionCoverage * 10) / 10
      },
      classes: {
        total: totalClasses,
        documented: documentedClasses,
        coverage: Math.round(classCoverage * 10) / 10
      },
      modules: {
        total: totalModules,
        documented: documentedModules,
        coverage: Math.round(moduleCoverage * 10) / 10
      }
    },
    undocumented: undocumented.filter(item => item.name === 'undocumented'),
    summary: {
      totalFiles: files.length,
      totalItems,
      documentedItems,
      undocumentedItems: totalItems - documentedItems
    }
  };
}

/**
 * Analyze JavaScript/TypeScript file for documentation coverage
 */
function analyzeJavaScriptFile(filePath: string, content: string, lines: string[]): {
  functions: CoverageItem[];
  classes: CoverageItem[];
  modules: CoverageItem[];
  undocumented: CoverageItem[];
} {
  const functions: CoverageItem[] = [];
  const classes: CoverageItem[] = [];
  const modules: CoverageItem[] = [];
  const undocumented: CoverageItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for function declarations
    const funcMatch = line.match(/^(export\s+)?(function|const\s+\w+\s*=\s*(?:async\s+)?function|const\s+\w+\s*=\s*(?:async\s+)?\()\s*(\w+)/);
    if (funcMatch) {
      const funcName = funcMatch[3];
      const hasDoc = hasJSDocComment(lines, i);
      const item: CoverageItem = {
        file: filePath,
        type: 'function',
        name: hasDoc ? funcName : 'undocumented'
      };
      functions.push(item);
      if (!hasDoc) undocumented.push(item);
    }
    
    // Check for class declarations
    const classMatch = line.match(/^(export\s+)?class\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[2];
      const hasDoc = hasJSDocComment(lines, i);
      const item: CoverageItem = {
        file: filePath,
        type: 'class',
        name: hasDoc ? className : 'undocumented'
      };
      classes.push(item);
      if (!hasDoc) undocumented.push(item);
    }
    
    // Check for module exports
    const exportMatch = line.match(/^export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)/);
    if (exportMatch) {
      const moduleName = exportMatch[1];
      const hasDoc = hasJSDocComment(lines, i);
      const item: CoverageItem = {
        file: filePath,
        type: 'module',
        name: hasDoc ? moduleName : 'undocumented'
      };
      modules.push(item);
      if (!hasDoc) undocumented.push(item);
    }
  }

  return { functions, classes, modules, undocumented };
}

/**
 * Analyze Python file for documentation coverage
 */
function analyzePythonFile(filePath: string, content: string, lines: string[]): {
  functions: CoverageItem[];
  classes: CoverageItem[];
  modules: CoverageItem[];
  undocumented: CoverageItem[];
} {
  const functions: CoverageItem[] = [];
  const classes: CoverageItem[] = [];
  const modules: CoverageItem[] = [];
  const undocumented: CoverageItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for function definitions
    const funcMatch = line.match(/^def\s+(\w+)/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const hasDoc = hasPythonDocstring(lines, i);
      const item: CoverageItem = {
        file: filePath,
        type: 'function',
        name: hasDoc ? funcName : 'undocumented'
      };
      functions.push(item);
      if (!hasDoc) undocumented.push(item);
    }
    
    // Check for class definitions
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      const hasDoc = hasPythonDocstring(lines, i);
      const item: CoverageItem = {
        file: filePath,
        type: 'class',
        name: hasDoc ? className : 'undocumented'
      };
      classes.push(item);
      if (!hasDoc) undocumented.push(item);
    }
    
    // Check for module-level variables/functions (simplified)
    const moduleMatch = line.match(/^(\w+)\s*=/);
    if (moduleMatch && i < 5) { // Only check first few lines for module-level items
      const moduleName = moduleMatch[1];
      const hasDoc = hasPythonDocstring(lines, i);
      const item: CoverageItem = {
        file: filePath,
        type: 'module',
        name: hasDoc ? moduleName : 'undocumented'
      };
      modules.push(item);
      if (!hasDoc) undocumented.push(item);
    }
  }

  return { functions, classes, modules, undocumented };
}

/**
 * Check if a line has JSDoc comment above it
 */
function hasJSDocComment(lines: string[], lineIndex: number): boolean {
  // Look for JSDoc comment in the lines before the current line
  for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 5); i--) {
    const line = lines[i].trim();
    if (line.startsWith('/**') && line.includes('*/')) {
      return true;
    }
    if (line.startsWith('/**')) {
      // Multi-line JSDoc, check if it ends with */
      for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
        if (lines[j].trim().endsWith('*/')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if a line has Python docstring
 */
function hasPythonDocstring(lines: string[], lineIndex: number): boolean {
  // Look for docstring in the lines after the current line
  for (let i = lineIndex + 1; i < Math.min(lines.length, lineIndex + 5); i++) {
    const line = lines[i].trim();
    if (line.startsWith('"""') || line.startsWith("'''")) {
      return true;
    }
  }
  return false;
}

/**
 * Generate documentation in the specified format
 */
async function generateDocumentation(files: DocumentationFile[], directory: string, format: string): Promise<string[]> {
  const outputDir = join(directory, 'docs', 'generated');
  const generatedFiles: string[] = [];

  // Ensure output directory exists
  try {
    if (!existsSync(outputDir)) {
      const { mkdirSync } = await import('fs');
      mkdirSync(outputDir, { recursive: true });
    }
  } catch (error) {
    console.error(`[GENERATE_DOCS] Error creating output directory: ${error}`);
    throw error;
  }

  switch (format) {
    case 'markdown':
      generatedFiles.push(...await generateMarkdownDocs(files, outputDir));
      break;
    case 'jsdoc':
      generatedFiles.push(...await generateJSDocDocs(files, outputDir));
      break;
    case 'sphinx':
      generatedFiles.push(...await generateSphinxDocs(files, outputDir));
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  return generatedFiles;
}

/**
 * Generate Markdown documentation
 */
async function generateMarkdownDocs(files: DocumentationFile[], outputDir: string): Promise<string[]> {
  const outputFile = join(outputDir, 'DOCUMENTATION.md');
  const generatedFiles: string[] = [];

  let content = '# Documentation\n\n';
  content += `Generated on: ${new Date().toISOString()}\n\n`;
  content += `## Overview\n\n`;
  content += `This documentation was automatically generated from the codebase.\n\n`;

  // Group files by type
  const filesByType: Record<string, DocumentationFile[]> = {};
  for (const file of files) {
    if (!filesByType[file.type]) {
      filesByType[file.type] = [];
    }
    filesByType[file.type].push(file);
  }

  // Generate sections for each file type
  for (const [type, typeFiles] of Object.entries(filesByType)) {
    content += `## ${type.charAt(0).toUpperCase() + type.slice(1)} Files\n\n`;
    
    for (const file of typeFiles) {
      content += `### ${basename(file.path)}\n\n`;
      content += `**Path:** \`${file.path}\`\n\n`;
      
      if (file.docs.length > 0) {
        content += `**Documentation:**\n\n`;
        for (const doc of file.docs) {
          content += `${doc}\n\n`;
        }
      }
      
      if (file.sections.length > 0) {
        content += `**Sections:**\n\n`;
        for (const section of file.sections) {
          content += `- ${section}\n`;
        }
        content += '\n';
      }
      
      content += '---\n\n';
    }
  }

  // Write the file
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(outputFile, content, 'utf-8');
    generatedFiles.push(outputFile);
    console.log(`[GENERATE_DOCS] Generated Markdown documentation: ${outputFile}`);
  } catch (error) {
    console.error(`[GENERATE_DOCS] Error writing Markdown file: ${error}`);
    throw error;
  }

  return generatedFiles;
}

/**
 * Generate JSDoc-style documentation
 */
async function generateJSDocDocs(files: DocumentationFile[], outputDir: string): Promise<string[]> {
  const outputFile = join(outputDir, 'jsdoc-output.md');
  const generatedFiles: string[] = [];

  let content = '# JSDoc Documentation\n\n';
  content += `Generated on: ${new Date().toISOString()}\n\n`;

  // Filter for JavaScript/TypeScript files
  const jsFiles = files.filter(file => file.type === 'javascript' || file.type === 'typescript');
  
  if (jsFiles.length === 0) {
    content += 'No JavaScript/TypeScript files found.\n';
  } else {
    for (const file of jsFiles) {
      content += `## ${basename(file.path)}\n\n`;
      content += `**File:** \`${file.path}\`\n\n`;
      
      if (file.docs.length > 0) {
        content += `### Documentation\n\n`;
        for (const doc of file.docs) {
          // Format JSDoc comments
          const formattedDoc = doc.replace(/\/\*\*/g, '').replace(/\*\//g, '').replace(/^\s*\*/gm, '');
          content += `\`\`\`javascript\n${formattedDoc}\n\`\`\`\n\n`;
        }
      }
      
      if (file.sections.length > 0) {
        content += `### Code Sections\n\n`;
        for (const section of file.sections) {
          content += `- **${section}**\n`;
        }
        content += '\n';
      }
      
      content += '---\n\n';
    }
  }

  // Write the file
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(outputFile, content, 'utf-8');
    generatedFiles.push(outputFile);
    console.log(`[GENERATE_DOCS] Generated JSDoc documentation: ${outputFile}`);
  } catch (error) {
    console.error(`[GENERATE_DOCS] Error writing JSDoc file: ${error}`);
    throw error;
  }

  return generatedFiles;
}

/**
 * Generate Sphinx-style documentation
 */
async function generateSphinxDocs(files: DocumentationFile[], outputDir: string): Promise<string[]> {
  const outputFile = join(outputDir, 'index.rst');
  const generatedFiles: string[] = [];

  let content = 'Documentation\n';
  content += '=============\n\n';
  content += `Generated on: ${new Date().toISOString()}\n\n`;
  content += 'This documentation was automatically generated from the codebase.\n\n';

  // Table of contents
  content += 'Contents:\n\n';
  content += '.. toctree::\n';
  content += '   :maxdepth: 2\n\n';

  // Group files by type
  const filesByType: Record<string, DocumentationFile[]> = {};
  for (const file of files) {
    if (!filesByType[file.type]) {
      filesByType[file.type] = [];
    }
    filesByType[file.type].push(file);
  }

  // Generate sections for each file type
  for (const [type, typeFiles] of Object.entries(filesByType)) {
    const sectionTitle = type.charAt(0).toUpperCase() + type.slice(1) + ' Files';
    content += `${sectionTitle}\n`;
    content += `${'='.repeat(sectionTitle.length)}\n\n`;
    
    for (const file of typeFiles) {
      const fileName = basename(file.path);
      content += `${fileName}\n`;
      content += `${'-'.repeat(fileName.length)}\n\n`;
      content += `**Path:** \`${file.path}\`\n\n`;
      
      if (file.docs.length > 0) {
        content += `**Documentation:**\n\n`;
        for (const doc of file.docs) {
          // Convert to reStructuredText format
          const rstDoc = doc.replace(/\*\*(.*?)\*\*/g, '**$1**').replace(/\*(.*?)\*/g, '*$1*');
          content += `.. code-block:: text\n\n   ${rstDoc.replace(/\n/g, '\n   ')}\n\n`;
        }
      }
      
      if (file.sections.length > 0) {
        content += `**Sections:**\n\n`;
        for (const section of file.sections) {
          content += `- ${section}\n`;
        }
        content += '\n';
      }
      
      content += '\n';
    }
  }

  // Write the file
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(outputFile, content, 'utf-8');
    generatedFiles.push(outputFile);
    console.log(`[GENERATE_DOCS] Generated Sphinx documentation: ${outputFile}`);
  } catch (error) {
    console.error(`[GENERATE_DOCS] Error writing Sphinx file: ${error}`);
    throw error;
  }

  return generatedFiles;
}

/**
 * Create Documentation tools
 */
export function createDocumentationTools(): Tool[] {
  return [
    {
      name: 'get_documentation',
      description: 'Extract and analyze documentation from codebase',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          filePatterns: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'File patterns to include in documentation analysis',
            default: ['*.md', '*.rst', '*.txt', '*.js', '*.ts', '*.py']
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          documentation: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                type: { type: 'string' },
                content: { type: 'string' },
                metadata: { type: 'object' }
              }
            }
          },
          summary: {
            type: 'object',
            properties: {
              totalFiles: { type: 'number' },
              documentationTypes: { type: 'object' },
              coverage: { type: 'number' }
            }
          }
        }
      }
    },
    {
      name: 'documentation_coverage',
      description: 'Analyze documentation coverage across the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          coverage: {
            type: 'object',
            properties: {
              overall: { type: 'number' },
              functions: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  documented: { type: 'number' },
                  coverage: { type: 'number' }
                }
              },
              classes: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  documented: { type: 'number' },
                  coverage: { type: 'number' }
                }
              },
              modules: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  documented: { type: 'number' },
                  coverage: { type: 'number' }
                }
              }
            }
          },
          undocumented: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                type: { type: 'string', enum: ['function', 'class', 'module'] },
                name: { type: 'string' }
              }
            }
          },
          summary: {
            type: 'object',
            properties: {
              totalFiles: { type: 'number' },
              totalItems: { type: 'number' },
              documentedItems: { type: 'number' },
              undocumentedItems: { type: 'number' }
            }
          }
        }
      }
    },
    {
      name: 'generate_docs',
      description: 'Generate documentation from codebase',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          format: {
            type: 'string',
            enum: ['markdown', 'jsdoc', 'sphinx'],
            description: 'Output format for generated documentation',
            default: 'markdown'
          }
        },
        required: []
      },
      outputSchema: {
        type: 'object',
        properties: {
          directory: { type: 'string' },
          format: { type: 'string' },
          generatedFiles: {
            type: 'array',
            items: { type: 'string' }
          },
          message: { type: 'string' },
          summary: {
            type: 'object',
            properties: {
              totalFiles: { type: 'number' },
              format: { type: 'string' },
              generatedAt: { type: 'string' }
            }
          }
        }
      }
    }
  ];
}

/**
 * Handle Documentation tool calls
 */
export async function handleDocumentationTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'get_documentation': {
      const docArgs = args as any;
      const directory = docArgs.directory || '.';
      const filePatterns = docArgs.filePatterns || ['*.md', '*.rst', '*.txt', '*.js', '*.ts', '*.py'];

      try {
        console.log(`[DOCUMENTATION] Starting documentation extraction for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('get_documentation', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            path: directory,
          }, 'Directory not found');
        }

        // Scan directory for documentation files
        console.log(`[DOCUMENTATION] Scanning directory with patterns: ${filePatterns.join(', ')}`);
        const files = scanDirectoryForDocs(directory, filePatterns);
        
        // Calculate summary statistics
        const totalFiles = files.length;
        const totalDocs = files.reduce((sum, file) => sum + file.docs.length, 0);
        const byType: Record<string, number> = {};
        
        for (const file of files) {
          byType[file.type] = (byType[file.type] || 0) + 1;
        }
        
        console.log(`[DOCUMENTATION] Found ${totalFiles} files with ${totalDocs} documentation sections`);
        
        // Create result
        const result: DocumentationResult = {
          files,
          summary: {
            totalFiles,
            totalDocs,
            byType
          }
        };
        
        return createSafeResult('get_documentation', {
          ...result,
          message: `Documentation extraction completed: ${totalFiles} files found with ${totalDocs} documentation sections`,
          directory,
          filePatterns
        });

        // TODO: Future improvements
        // - Advanced parsing (AST-based for code files)
        // - Support for Java, C#, Go, Rust, etc.
        // - Link extraction and validation
        // - Cross-reference analysis
        // - Documentation quality scoring
        // - Integration with documentation generators

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DOCUMENTATION] Error: ${errorMessage}`);
        
        return createSafeResult('get_documentation', {
          error: 'Documentation extraction failed',
          message: `Documentation extraction failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    case 'documentation_coverage': {
      const coverageArgs = args as any;
      const directory = coverageArgs.directory || '.';

      try {
        console.log(`[DOCUMENTATION_COVERAGE] Starting coverage analysis for ${directory}`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('documentation_coverage', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            path: directory,
          }, 'Directory not found');
        }

        // Scan for code files (JS, TS, Python)
        const codePatterns = ['*.js', '*.jsx', '*.ts', '*.tsx', '*.py'];
        const codeFiles = scanDirectoryForDocs(directory, codePatterns);
        
        if (codeFiles.length === 0) {
          return createSafeResult('documentation_coverage', {
            coverage: {
              overall: 0,
              functions: { total: 0, documented: 0, coverage: 0 },
              classes: { total: 0, documented: 0, coverage: 0 },
              modules: { total: 0, documented: 0, coverage: 0 }
            },
            undocumented: [],
            summary: {
              totalFiles: 0,
              totalItems: 0,
              documentedItems: 0,
              undocumentedItems: 0
            },
            message: 'No code files found for coverage analysis'
          });
        }

        // Analyze each code file for documentation coverage
        const coverageData = analyzeDocumentationCoverage(codeFiles);
        
        console.log(`[DOCUMENTATION_COVERAGE] Analysis complete: ${coverageData.summary.totalItems} items found`);
        
        return createSafeResult('documentation_coverage', {
          ...coverageData,
          message: `Documentation coverage analysis completed: ${coverageData.coverage.overall.toFixed(1)}% overall coverage`,
          directory
        });

        // TODO: Future improvements
        // - Deeper AST parsing for more accurate function/class detection
        // - Multi-language extension (Java, Go, C#, Rust, etc.)
        // - Integrate with coverage badges and CI/CD pipelines
        // - Support for inline documentation quality scoring
        // - Cross-reference analysis between documentation and code

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DOCUMENTATION_COVERAGE] Error: ${errorMessage}`);
        
        return createSafeResult('documentation_coverage', {
          error: 'Documentation coverage analysis failed',
          message: `Documentation coverage analysis failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    case 'generate_docs': {
      const generateArgs = args as any;
      const directory = generateArgs.directory || '.';
      const format = generateArgs.format || 'markdown';

      try {
        console.log(`[GENERATE_DOCS] Starting documentation generation for ${directory} in ${format} format`);
        
        // Check if directory exists
        if (!existsSync(directory)) {
          return createSafeResult('generate_docs', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            path: directory,
          }, 'Directory not found');
        }

        // Validate format
        const supportedFormats = ['markdown', 'jsdoc', 'sphinx'];
        if (!supportedFormats.includes(format)) {
          return createSafeResult('generate_docs', {
            error: 'Unsupported format',
            message: `Format ${format} is not supported. Supported formats: ${supportedFormats.join(', ')}`,
            supportedFormats,
          }, 'Unsupported format');
        }

        // Collect documentation from the codebase
        const filePatterns = ['*.md', '*.rst', '*.txt', '*.js', '*.ts', '*.py'];
        const files = scanDirectoryForDocs(directory, filePatterns);
        
        if (files.length === 0) {
          return createSafeResult('generate_docs', {
            warning: 'No documentation found',
            message: 'No documentation files found in the specified directory',
            directory,
            format
          });
        }

        // Generate documentation based on format
        const generatedFiles = await generateDocumentation(files, directory, format);
        
        console.log(`[GENERATE_DOCS] Generated ${generatedFiles.length} documentation files`);
        
        return createSafeResult('generate_docs', {
          directory,
          format,
          generatedFiles,
          message: 'Docs generated successfully',
          summary: {
            totalFiles: generatedFiles.length,
            format,
            generatedAt: new Date().toISOString()
          }
        });

        // TODO: Future improvements
        // - AST-based structured API documentation generation
        // - Configurable templates and themes
        // - Integration with external documentation sites (GitHub Pages, ReadTheDocs)
        // - Support for additional formats (HTML, PDF, etc.)
        // - Cross-reference linking between documentation sections
        // - Automated API documentation from TypeScript interfaces

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[GENERATE_DOCS] Error: ${errorMessage}`);
        
        return createSafeResult('generate_docs', {
          error: 'Documentation generation failed',
          message: `Documentation generation failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown Documentation tool: ${toolName}`);
  }
}
