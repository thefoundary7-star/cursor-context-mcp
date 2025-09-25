# Dependency Analysis Tool

The `analyze_dependencies` tool provides comprehensive dependency analysis across multiple package managers, with auto-detection and structured output for modern development workflows.

## Features

- **Multi-Package Manager Support**: NPM, PIP, Poetry, Cargo, Maven, Gradle
- **Auto-Detection**: Automatically detects package manager based on files
- **Dependency Parsing**: Extracts name, version, and type information
- **Runtime vs Dev Dependencies**: Distinguishes between runtime and development dependencies
- **Structured Output**: Normalized dependency data across all package managers
- **Error Handling**: Comprehensive error handling for various scenarios

## Usage

### Basic Dependency Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "analyze_dependencies",
    "arguments": {
      "directory": ".",
      "packageManager": "auto",
      "includeDevDependencies": true
    }
  }
}
```

### NPM-Specific Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "analyze_dependencies",
    "arguments": {
      "directory": ".",
      "packageManager": "npm",
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
- **`includeDevDependencies`** (boolean): Include development dependencies (default: true)

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "manager": "npm",
    "dependencies": [
      {
        "name": "lodash",
        "version": "^4.17.20",
        "type": "runtime"
      },
      {
        "name": "jest",
        "version": "^29.0.0",
        "type": "dev"
      }
    ],
    "total": 2,
    "runtime": 1,
    "dev": 1,
    "directory": "/path/to/directory",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "files": ["package.json"],
    "message": "Dependency analysis completed: 2 dependencies found (1 runtime, 1 dev) using npm"
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

#### Unsupported Package Manager
```json
{
  "success": false,
  "error": "Unsupported package manager",
  "data": {
    "error": "Unsupported package manager",
    "message": "Package manager unknown is not supported or no dependency files found",
    "directory": "/path/to/directory",
    "detectedManager": "unknown",
    "supportedManagers": ["npm", "pip", "poetry", "cargo", "maven", "gradle"]
  }
}
```

#### Dependency File Not Found
```json
{
  "success": false,
  "error": "Dependency file not found",
  "data": {
    "error": "Dependency file not found",
    "message": "No dependency files found for npm in /path/to/directory",
    "directory": "/path/to/directory",
    "packageManager": "npm"
  }
}
```

## Package Manager Support

### NPM (Node.js)
- **File**: `package.json`
- **Dependencies**: `dependencies` and `devDependencies` sections
- **Format**: JSON with name and version pairs

### PIP (Python)
- **File**: `requirements.txt`
- **Dependencies**: Line-by-line package specifications
- **Format**: `package>=version` or `package==version`

### Poetry (Python)
- **File**: `pyproject.toml`
- **Dependencies**: `[tool.poetry.dependencies]` and `[tool.poetry.group.dev.dependencies]`
- **Format**: TOML with name and version pairs

### Cargo (Rust)
- **File**: `Cargo.toml`
- **Dependencies**: `[dependencies]` and `[dev-dependencies]` sections
- **Format**: TOML with name and version pairs

### Maven (Java)
- **File**: `pom.xml`
- **Dependencies**: `<dependency>` elements
- **Format**: XML with groupId, artifactId, and version

### Gradle (Java)
- **File**: `build.gradle`
- **Dependencies**: `implementation` and `testImplementation` configurations
- **Format**: Groovy DSL with dependency strings

## Implementation Details

### Package Manager Detection
```typescript
function detectPackageManager(directory: string): string {
  const files = readdirSync(directory);
  
  if (files.includes('package.json')) return 'npm';
  else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'pip';
  else if (files.includes('Cargo.toml')) return 'cargo';
  else if (files.includes('pom.xml')) return 'maven';
  else if (files.includes('build.gradle')) return 'gradle';
  
  return 'unknown';
}
```

### NPM Dependency Parsing
```typescript
function parseNpmDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const packageJson = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const dependencies: Dependency[] = [];
  
  // Parse runtime dependencies
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      dependencies.push({ name, version: version as string, type: 'runtime' });
    }
  }
  
  // Parse dev dependencies if requested
  if (includeDevDependencies && packageJson.devDependencies) {
    for (const [name, version] of Object.entries(packageJson.devDependencies)) {
      dependencies.push({ name, version: version as string, type: 'dev' });
    }
  }
  
  return dependencies;
}
```

### Python Requirements Parsing
```typescript
function parsePipDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const content = readFileSync(join(directory, 'requirements.txt'), 'utf8');
  const dependencies: Dependency[] = [];
  
  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const parts = trimmedLine.split(/[>=<!=]/);
      const name = parts[0].trim();
      const version = trimmedLine.replace(name, '').trim() || '*';
      
      dependencies.push({ name, version, type: 'runtime' });
    }
  }
  
  return dependencies;
}
```

### Rust Cargo Parsing
```typescript
function parseCargoDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const content = readFileSync(join(directory, 'Cargo.toml'), 'utf8');
  const dependencies: Dependency[] = [];
  let inDependencies = false;
  let inDevDependencies = false;
  
  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '[dependencies]') {
      inDependencies = true;
      inDevDependencies = false;
    } else if (trimmedLine === '[dev-dependencies]') {
      inDependencies = false;
      inDevDependencies = true;
    } else if (inDependencies && trimmedLine && !trimmedLine.startsWith('#')) {
      const [name, version] = trimmedLine.split('=');
      if (name && version) {
        dependencies.push({
          name: name.trim(),
          version: version.trim().replace(/"/g, ''),
          type: 'runtime'
        });
      }
    } else if (inDevDependencies && includeDevDependencies && trimmedLine && !trimmedLine.startsWith('#')) {
      const [name, version] = trimmedLine.split('=');
      if (name && version) {
        dependencies.push({
          name: name.trim(),
          version: version.trim().replace(/"/g, ''),
          type: 'dev'
        });
      }
    }
  }
  
  return dependencies;
}
```

## Examples

### Auto-Detection
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": "."
  }
}
```

### NPM Analysis
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": ".",
    "packageManager": "npm",
    "includeDevDependencies": true
  }
}
```

### Python Analysis
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": ".",
    "packageManager": "pip",
    "includeDevDependencies": false
  }
}
```

### Rust Analysis
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": ".",
    "packageManager": "cargo",
    "includeDevDependencies": true
  }
}
```

### Java Maven Analysis
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": ".",
    "packageManager": "maven",
    "includeDevDependencies": true
  }
}
```

### Java Gradle Analysis
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": ".",
    "packageManager": "gradle",
    "includeDevDependencies": true
  }
}
```

## Use Cases

### Project Analysis
- **Dependency Overview**: Get comprehensive dependency information
- **Version Tracking**: Track dependency versions across projects
- **Type Analysis**: Distinguish between runtime and development dependencies
- **Manager Detection**: Automatically detect package manager

### Development Workflow
- **Dependency Auditing**: Analyze dependency usage patterns
- **Version Management**: Track dependency version changes
- **Compliance Checking**: Ensure dependency compliance
- **Documentation**: Generate dependency documentation

### CI/CD Integration
- **Build Validation**: Validate dependencies before builds
- **Version Checking**: Check for outdated dependencies
- **Security Scanning**: Identify vulnerable dependencies
- **Compliance Reporting**: Generate dependency compliance reports

## Error Handling

### Common Error Scenarios
- **Directory Not Found**: Invalid directory path
- **Unsupported Package Manager**: Package manager not supported
- **Dependency File Not Found**: No dependency files found
- **Parse Errors**: Malformed dependency files
- **Permission Denied**: Insufficient file system permissions

### Error Recovery
- **Graceful Degradation**: Continue with available information
- **Partial Results**: Return results from successful parsing
- **Error Reporting**: Detailed error messages for troubleshooting
- **Fallback Behavior**: Skip problematic files and continue

## Performance Considerations

### Optimization Strategies
- **File Filtering**: Only read necessary dependency files
- **Efficient Parsing**: Use optimized parsing algorithms
- **Caching**: Cache parsed dependency information
- **Parallel Processing**: Parse multiple files concurrently

### Best Practices
```json
// For quick dependency overview
{
  "name": "analyze_dependencies",
  "arguments": {
    "packageManager": "auto",
    "includeDevDependencies": false
  }
}

// For comprehensive analysis
{
  "name": "analyze_dependencies",
  "arguments": {
    "packageManager": "npm",
    "includeDevDependencies": true
  }
}
```

## Integration with Other Tools

### With Security Audit
```javascript
// Get dependency information
const dependencies = await handleSecurityTool('analyze_dependencies', {
  directory: '.',
  packageManager: 'npm'
});

// Then run security audit
const audit = await handleSecurityTool('security_audit', {
  directory: '.',
  severity: 'medium'
});
```

### With Vulnerability Check
```javascript
// Get dependency information
const dependencies = await handleSecurityTool('analyze_dependencies', {
  directory: '.',
  packageManager: 'auto'
});

// Then check for vulnerabilities
const vulnerabilities = await handleSecurityTool('check_vulnerabilities', {
  directory: '.',
  packageManager: dependencies.data.manager
});
```

## Limitations

### Current Limitations
- **File-based Only**: Limited to file system scanning
- **Basic Parsing**: Simple parsing without advanced features
- **No Version Resolution**: Doesn't resolve version ranges
- **Limited Error Recovery**: Basic error handling

### Future Enhancements
- **Advanced Parsing**: More sophisticated dependency parsing
- **Version Resolution**: Resolve version ranges and constraints
- **Dependency Trees**: Build dependency relationship trees
- **Conflict Detection**: Detect dependency conflicts
- **License Analysis**: Analyze dependency licenses

## Troubleshooting

### Common Issues
1. **No Dependencies Found**: Check if dependency files exist
2. **Parse Errors**: Verify dependency file format
3. **Permission Denied**: Check file system permissions
4. **Unsupported Manager**: Use supported package managers

### Debug Mode
Enable debug logging for detailed troubleshooting:
```json
{
  "name": "analyze_dependencies",
  "arguments": {
    "directory": ".",
    "debug": true
  }
}
```

## Support and Documentation

### Additional Resources
- **Package Manager Documentation**: Official documentation for each package manager
- **Dependency Management**: Best practices for dependency management
- **Version Control**: Dependency version control strategies
- **Security**: Dependency security best practices

### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices
- **Contributions**: Community contributions and improvements
