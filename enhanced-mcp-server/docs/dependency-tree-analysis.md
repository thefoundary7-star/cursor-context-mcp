# Dependency Tree Analysis Tool

The `dependency_tree_analysis` tool provides comprehensive dependency tree analysis across multiple package managers, with structured output and depth control for modern development workflows.

## Features

- **Multi-Package Manager Support**: NPM, PIP, Cargo with auto-detection
- **Dependency Tree Visualization**: Hierarchical dependency structure analysis
- **Depth Control**: Configurable maximum depth for tree analysis
- **Dev Dependencies**: Optional inclusion of development dependencies
- **Structured Output**: Normalized dependency tree data across all managers
- **Tool Availability**: Check if dependency tree tools are available
- **Error Handling**: Comprehensive error handling for various scenarios

## Usage

### Basic Dependency Tree Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "dependency_tree_analysis",
    "arguments": {
      "directory": ".",
      "packageManager": "auto",
      "maxDepth": 3,
      "includeDevDependencies": true,
      "outputFormat": "json"
    }
  }
}
```

### NPM-Specific Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "dependency_tree_analysis",
    "arguments": {
      "directory": ".",
      "packageManager": "npm",
      "maxDepth": 2,
      "includeDevDependencies": true
    }
  }
}
```

## Parameters

### Required Parameters
None - all parameters are optional

### Optional Parameters
- **`directory`** (string): Directory to analyze (default: ".")
- **`packageManager`** (string): Package manager to use (default: "auto")
- **`maxDepth`** (number): Maximum depth for tree analysis (default: 3)
- **`includeDevDependencies`** (boolean): Include development dependencies (default: true)
- **`outputFormat`** (string): Output format for results (default: "json")

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "manager": "npm",
    "tree": [
      {
        "name": "express",
        "version": "4.18.0",
        "type": "runtime",
        "dependencies": [
          {
            "name": "accepts",
            "version": "1.3.8",
            "type": "runtime",
            "dependencies": [
              {
                "name": "mime-types",
                "version": "2.1.35",
                "type": "runtime"
              }
            ]
          }
        ]
      },
      {
        "name": "lodash",
        "version": "4.17.20",
        "type": "runtime"
      }
    ],
    "total": 15,
    "maxDepth": 3,
    "directory": "/path/to/directory",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "toolAvailable": true,
    "message": "Dependency tree analysis completed: 15 dependencies found (max depth: 3) using npm"
  }
}
```

### Error Responses

#### Directory Not Found
```json
{
  "success": false,
  "error": "Directory not found",
  "data": {
    "error": "Directory not found",
    "message": "Directory /path/to/directory does not exist",
    "directory": "/path/to/directory"
  }
}
```

#### Dependency Tree Tool Not Available
```json
{
  "success": false,
  "error": "Dependency tree tool not available",
  "data": {
    "error": "Dependency tree tool not available",
    "message": "Dependency tree tool npm is not available for npm",
    "directory": "/path/to/directory",
    "manager": "npm",
    "toolName": "npm"
  }
}
```

#### Unsupported Package Manager
```json
{
  "success": false,
  "error": "Dependency tree tool not available",
  "data": {
    "error": "Dependency tree tool not available",
    "message": "Dependency tree tool not available for maven",
    "directory": "/path/to/directory",
    "manager": "maven",
    "supportedManagers": ["npm", "pip", "cargo"]
  }
}
```

#### Not Yet Supported
```json
{
  "success": true,
  "data": {
    "warning": "Dependency tree not yet supported",
    "message": "Dependency tree analysis for maven is not yet supported",
    "directory": "/path/to/directory",
    "manager": "maven",
    "supportedManagers": ["npm", "pip", "cargo"]
  }
}
```

## Package Manager Support

### Supported Package Managers
- **NPM**: Uses `npm ls --json --depth=<maxDepth>` for Node.js dependency trees
- **PIP**: Uses `pipdeptree --json-tree` for Python dependency trees
- **Cargo**: Uses `cargo tree --prefix none --depth <maxDepth> --format json` for Rust dependency trees

### Unsupported Package Managers
- **Maven**: Returns warning message (not yet supported)
- **Gradle**: Returns warning message (not yet supported)

## Implementation Details

### NPM Tree Integration
```typescript
async function runNpmTree(directory: string, maxDepth: number, includeDevDependencies: boolean): Promise<DependencyTreeNode[]> {
  const args = ['ls', '--json', '--depth', maxDepth.toString()];
  if (!includeDevDependencies) {
    args.push('--production');
  }
  
  const child = spawn('npm', args, {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  // Parse JSON output for dependency tree
  if (lsResult.dependencies) {
    for (const [name, dep] of Object.entries(lsResult.dependencies)) {
      const dependency = dep as any;
      const node = parseNpmDependencyNode(name, dependency, includeDevDependencies);
      if (node) {
        tree.push(node);
      }
    }
  }
}
```

### PIP Tree Integration
```typescript
async function runPipTree(directory: string, maxDepth: number, includeDevDependencies: boolean): Promise<DependencyTreeNode[]> {
  const child = spawn('pipdeptree', ['--json-tree'], {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  // Parse JSON output for dependency tree
  if (Array.isArray(deptreeResult)) {
    for (const item of deptreeResult) {
      const node = parsePipDependencyNode(item, maxDepth, includeDevDependencies);
      if (node) {
        tree.push(node);
      }
    }
  }
}
```

### Cargo Tree Integration
```typescript
async function runCargoTree(directory: string, maxDepth: number, includeDevDependencies: boolean): Promise<DependencyTreeNode[]> {
  const args = ['tree', '--prefix', 'none', '--depth', maxDepth.toString(), '--format', 'json'];
  if (!includeDevDependencies) {
    args.push('--no-dev-dependencies');
  }
  
  const child = spawn('cargo', args, {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  // Parse JSON output for dependency tree
  const lines = stdout.trim().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const treeItem = JSON.parse(line);
      const node = parseCargoDependencyNode(treeItem, maxDepth, includeDevDependencies);
      if (node) {
        tree.push(node);
      }
    }
  }
}
```

### Tool Availability Check
```typescript
async function checkToolAvailability(tool: string): Promise<boolean> {
  const child = spawn(tool, ['--version'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  child.on('close', (code) => {
    resolve(code === 0);
  });
  
  child.on('error', () => {
    resolve(false);
  });
}
```

## Examples

### Auto-Detection
```json
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "directory": "."
  }
}
```

### NPM Analysis
```json
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "directory": ".",
    "packageManager": "npm",
    "maxDepth": 2,
    "includeDevDependencies": true
  }
}
```

### Python Analysis
```json
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "directory": ".",
    "packageManager": "pip",
    "maxDepth": 3,
    "includeDevDependencies": false
  }
}
```

### Rust Analysis
```json
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "directory": ".",
    "packageManager": "cargo",
    "maxDepth": 4,
    "includeDevDependencies": true
  }
}
```

### Limited Depth Analysis
```json
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "directory": ".",
    "maxDepth": 1,
    "outputFormat": "tree"
  }
}
```

## Use Cases

### Dependency Analysis
- **Tree Visualization**: Understand dependency relationships
- **Depth Analysis**: Control the depth of dependency analysis
- **Dev Dependencies**: Include or exclude development dependencies
- **Package Manager Support**: Support for multiple package managers

### Development Workflow
- **Dependency Auditing**: Analyze project dependencies
- **Tree Structure**: Understand dependency hierarchies
- **Conflict Detection**: Identify potential dependency conflicts
- **Optimization**: Optimize dependency structure

### Production Readiness
- **Dependency Review**: Review production dependencies
- **Tree Analysis**: Analyze dependency tree structure
- **Dependency Management**: Manage project dependencies
- **Audit Trail**: Maintain dependency audit history

## Error Handling

### Common Error Scenarios
- **Directory Not Found**: Invalid directory path
- **Tool Not Available**: Missing dependency tree tools
- **Unsupported Manager**: Package manager not supported
- **Parse Errors**: Malformed dependency tree data
- **Timeout**: Long-running operations exceeding limits

### Error Recovery
- **Graceful Degradation**: Continue with available information
- **Partial Results**: Return results from successful analysis
- **Error Reporting**: Detailed error messages for troubleshooting
- **Fallback Behavior**: Skip problematic analysis and continue

## Performance Considerations

### Optimization Strategies
- **Tool Availability**: Check tool availability before execution
- **Timeout Management**: Prevent hanging processes
- **Efficient Parsing**: Use optimized parsing algorithms
- **Depth Control**: Limit analysis depth for performance

### Best Practices
```json
// For quick dependency tree analysis
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "maxDepth": 2,
    "includeDevDependencies": false
  }
}

// For comprehensive analysis
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "maxDepth": 4,
    "includeDevDependencies": true
  }
}
```

## Integration with Other Tools

### With Dependency Analysis
```javascript
// Get dependency information
const dependencies = await handleSecurityTool('analyze_dependencies', {
  directory: '.',
  packageManager: 'npm'
});

// Then analyze dependency tree
const tree = await handleSecurityTool('dependency_tree_analysis', {
  directory: '.',
  packageManager: dependencies.data.manager,
  maxDepth: 3
});
```

### With Vulnerability Check
```javascript
// Get dependency tree
const tree = await handleSecurityTool('dependency_tree_analysis', {
  directory: '.',
  packageManager: 'npm',
  maxDepth: 2
});

// Then check for vulnerabilities
const vulnerabilities = await handleSecurityTool('check_vulnerabilities', {
  directory: '.',
  packageManager: 'npm',
  severity: 'high'
});
```

## Limitations

### Current Limitations
- **Tool Dependency**: Requires external dependency tree tools
- **Limited Support**: Only supports npm, pip, and cargo
- **No Real-time**: Doesn't provide real-time dependency updates
- **Basic Parsing**: Simple parsing without advanced features

### Future Enhancements
- **Multi-Source**: Integration with multiple dependency sources
- **Real-time Updates**: Live dependency data
- **Advanced Analysis**: More sophisticated dependency analysis
- **Visualization**: Advanced dependency tree visualization
- **Conflict Detection**: Automated dependency conflict detection

## Troubleshooting

### Common Issues
1. **Tool Not Found**: Ensure dependency tree tools are installed
2. **Permission Denied**: Check file system permissions
3. **Parse Errors**: Verify dependency tree data format
4. **Timeout**: Large projects may require longer timeouts

### Debug Mode
Enable debug logging for detailed troubleshooting:
```json
{
  "name": "dependency_tree_analysis",
  "arguments": {
    "directory": ".",
    "debug": true
  }
}
```

## Support and Documentation

### Additional Resources
- **Dependency Management**: Best practices for dependency management
- **Tree Analysis**: Advanced dependency tree analysis techniques
- **Tool Documentation**: Official documentation for dependency tree tools
- **Package Manager Guides**: Package manager specific guides

### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices
- **Contributions**: Community contributions and improvements
