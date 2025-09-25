# Documentation Tools

The Documentation Tools provide comprehensive documentation analysis, coverage assessment, and generation capabilities for modern development workflows.

## Features

- **Documentation Extraction**: Analyze and extract documentation from codebase
- **Coverage Analysis**: Assess documentation completeness across files
- **Documentation Generation**: Generate documentation in multiple formats
- **Multi-Format Support**: Support for Markdown, JSDoc, Sphinx, and more
- **File Pattern Matching**: Flexible file pattern matching for documentation discovery
- **Metadata Extraction**: Extract documentation metadata and structure

## Tools

### 1. get_documentation

Extract and analyze documentation from codebase.

#### Parameters
- **`directory`** (string, optional): Directory to analyze (default: ".")
- **`filePatterns`** (string[], optional): File patterns to include (default: ["*.md", "*.rst", "*.txt", "*.js", "*.ts", "*.py"])

#### Response
```json
{
  "documentation": [
    {
      "file": "README.md",
      "type": "markdown",
      "content": "# Project Documentation...",
      "metadata": {
        "title": "Project Documentation",
        "sections": ["Introduction", "Installation", "Usage"],
        "links": ["https://example.com"]
      }
    }
  ],
  "summary": {
    "totalFiles": 5,
    "documentationTypes": {
      "markdown": 3,
      "jsdoc": 2,
      "sphinx": 1
    },
    "coverage": 85.5
  }
}
```

### 2. documentation_coverage

Analyze documentation coverage across the codebase.

#### Parameters
- **`directory`** (string, optional): Directory to analyze (default: ".")

#### Response
```json
{
  "coverage": {
    "overall": 75.5,
    "byFile": [
      {
        "file": "src/utils.js",
        "coverage": 90.0,
        "documentedLines": 45,
        "totalLines": 50
      }
    ],
    "byType": {
      "functions": 80.0,
      "classes": 70.0,
      "modules": 85.0
    }
  },
  "recommendations": [
    "Add documentation for undocumented functions",
    "Improve class documentation",
    "Add module-level documentation"
  ]
}
```

### 3. generate_docs

Generate documentation from codebase.

#### Parameters
- **`directory`** (string, optional): Directory to analyze (default: ".")
- **`format`** (string, optional): Output format - "markdown" | "jsdoc" | "sphinx" (default: "markdown")

#### Response
```json
{
  "generated": {
    "files": [
      {
        "path": "docs/API.md",
        "content": "# API Documentation...",
        "type": "markdown"
      }
    ],
    "summary": {
      "totalFiles": 3,
      "format": "markdown",
      "generatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

## Usage Examples

### Basic Documentation Extraction
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_documentation",
    "arguments": {
      "directory": ".",
      "filePatterns": ["*.md", "*.rst"]
    }
  }
}
```

### Documentation Coverage Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "documentation_coverage",
    "arguments": {
      "directory": "./src"
    }
  }
}
```

### Generate Markdown Documentation
```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_docs",
    "arguments": {
      "directory": ".",
      "format": "markdown"
    }
  }
}
```

### Generate JSDoc Documentation
```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_docs",
    "arguments": {
      "directory": "./src",
      "format": "jsdoc"
    }
  }
}
```

### Generate Sphinx Documentation
```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_docs",
    "arguments": {
      "directory": ".",
      "format": "sphinx"
    }
  }
}
```

## Implementation Status

### Current Status: Placeholder Implementation

All documentation tools are currently implemented as placeholders that return:
```json
{
  "status": "not yet implemented",
  "tool": "<tool_name>",
  "message": "Description of what the tool will do",
  "args": { /* provided arguments */ }
}
```

### Planned Implementation

#### get_documentation
- **Documentation Scanning**: Scan directory for documentation files (README, docs/, etc.)
- **Format Parsing**: Parse markdown, reStructuredText, and other documentation formats
- **Metadata Extraction**: Extract titles, sections, links, and other metadata
- **Code Analysis**: Analyze code comments and docstrings
- **Structured Output**: Return structured documentation data with coverage metrics

#### documentation_coverage
- **Code Analysis**: Analyze code files for documentation coverage
- **Coverage Calculation**: Check for missing documentation on functions, classes, modules
- **Percentage Calculation**: Calculate coverage percentages by file and type
- **Gap Identification**: Identify undocumented code sections
- **Recommendations**: Provide recommendations for improving documentation

#### generate_docs
- **Code Parsing**: Parse code files for docstrings and comments
- **Format Generation**: Generate documentation in specified format (markdown, jsdoc, sphinx)
- **API Documentation**: Create API documentation from code structure
- **Project Documentation**: Generate README files and project documentation
- **Template Support**: Support multiple output formats and templates

## File Pattern Support

### Supported Patterns
- **Markdown**: `*.md`, `*.markdown`
- **reStructuredText**: `*.rst`, `*.rest`
- **Text**: `*.txt`
- **JavaScript**: `*.js`, `*.jsx`
- **TypeScript**: `*.ts`, `*.tsx`
- **Python**: `*.py`
- **Java**: `*.java`
- **C/C++**: `*.c`, `*.cpp`, `*.h`
- **Go**: `*.go`
- **Rust**: `*.rs`

### Pattern Examples
```javascript
// Include all documentation files
filePatterns: ['*.md', '*.rst', '*.txt']

// Include code files with documentation
filePatterns: ['*.js', '*.ts', '*.py']

// Include specific documentation types
filePatterns: ['README.*', 'docs/**/*.md', '*.rst']
```

## Output Formats

### Markdown
- **Standard Markdown**: GitHub-flavored markdown
- **Tables**: Support for markdown tables
- **Code Blocks**: Syntax-highlighted code blocks
- **Links**: Internal and external link support

### JSDoc
- **JavaScript Documentation**: JSDoc format for JavaScript/TypeScript
- **API Reference**: Function and class documentation
- **Type Information**: TypeScript type documentation
- **Examples**: Code examples and usage

### Sphinx
- **Python Documentation**: Sphinx format for Python projects
- **reStructuredText**: reStructuredText source format
- **Cross-references**: Internal cross-references
- **Index Generation**: Automatic index generation

## Integration with Other Tools

### With Code Analysis
```javascript
// Get code structure
const codeStructure = await handleCodeTool('search_symbols', {
  directory: './src',
  pattern: 'function|class|interface'
});

// Then generate documentation
const docs = await handleDocumentationTool('generate_docs', {
  directory: './src',
  format: 'markdown'
});
```

### With File Operations
```javascript
// Get file information
const files = await handleFileTool('list_files', {
  directory: './docs',
  pattern: '*.md'
});

// Then analyze documentation
const coverage = await handleDocumentationTool('documentation_coverage', {
  directory: './docs'
});
```

## Best Practices

### Documentation Structure
- **README Files**: Include comprehensive README files
- **API Documentation**: Document all public APIs
- **Code Comments**: Use meaningful code comments
- **Examples**: Provide usage examples
- **Changelog**: Maintain project changelog

### Coverage Goals
- **Functions**: 90%+ documentation coverage
- **Classes**: 85%+ documentation coverage
- **Modules**: 80%+ documentation coverage
- **Public APIs**: 100% documentation coverage

### Format Selection
- **Markdown**: For general project documentation
- **JSDoc**: For JavaScript/TypeScript projects
- **Sphinx**: For Python projects
- **Mixed**: Use multiple formats as needed

## Error Handling

### Common Scenarios
- **No Documentation Found**: Return empty results with recommendations
- **Parse Errors**: Handle malformed documentation gracefully
- **Format Errors**: Provide clear error messages for unsupported formats
- **Permission Errors**: Handle file access issues

### Error Recovery
- **Partial Results**: Return available documentation when possible
- **Fallback Formats**: Use alternative formats when primary fails
- **Error Reporting**: Provide detailed error information
- **Recommendations**: Suggest fixes for common issues

## Performance Considerations

### Optimization Strategies
- **Incremental Analysis**: Only analyze changed files
- **Caching**: Cache parsed documentation
- **Parallel Processing**: Process multiple files concurrently
- **Lazy Loading**: Load documentation on demand

### Best Practices
```javascript
// For large codebases, use specific directories
const docs = await handleDocumentationTool('get_documentation', {
  directory: './src',
  filePatterns: ['*.ts', '*.js']
});

// For coverage analysis, focus on specific areas
const coverage = await handleDocumentationTool('documentation_coverage', {
  directory: './src/api'
});
```

## Future Enhancements

### Planned Features
- **Real-time Updates**: Live documentation updates
- **Collaborative Editing**: Multi-user documentation editing
- **Version Control**: Documentation versioning
- **Translation**: Multi-language documentation support
- **AI Integration**: AI-powered documentation generation

### Advanced Capabilities
- **Documentation Testing**: Test documentation accuracy
- **Link Validation**: Validate internal and external links
- **Style Checking**: Enforce documentation style guidelines
- **Automated Updates**: Automatic documentation updates from code changes

## Support and Documentation

### Additional Resources
- **Documentation Best Practices**: Industry documentation guidelines
- **Format Guides**: Official format documentation
- **Tool Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices

### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices
- **Contributions**: Community contributions and improvements
