# License Compliance Check Tool

The `license_compliance_check` tool provides comprehensive license compliance checking across multiple package managers, with structured output and license filtering for modern development workflows.

## Features

- **Multi-Package Manager Support**: NPM, PIP, Cargo with auto-detection
- **License Information Extraction**: Collect license information from dependencies
- **License Filtering**: Allow/deny specific licenses with compliance status
- **Dev Dependencies**: Optional inclusion of development dependencies
- **Structured Output**: Normalized license compliance data across all managers
- **Tool Availability**: Check if license tools are available
- **Error Handling**: Comprehensive error handling for various scenarios

## Usage

### Basic License Compliance Check
```json
{
  "method": "tools/call",
  "params": {
    "name": "license_compliance_check",
    "arguments": {
      "directory": ".",
      "packageManager": "auto",
      "includeDevDependencies": true,
      "outputFormat": "json"
    }
  }
}
```

### NPM-Specific Check
```json
{
  "method": "tools/call",
  "params": {
    "name": "license_compliance_check",
    "arguments": {
      "directory": ".",
      "packageManager": "npm",
      "allowedLicenses": ["MIT", "Apache-2.0"],
      "deniedLicenses": ["GPL-2.0", "GPL-3.0"],
      "includeDevDependencies": true
    }
  }
}
```

## Parameters

### Required Parameters
None - all parameters are optional

### Optional Parameters
- **`directory`** (string): Directory to check (default: ".")
- **`packageManager`** (string): Package manager to use (default: "auto")
- **`allowedLicenses`** (string[]): List of allowed licenses (default: [])
- **`deniedLicenses`** (string[]): List of denied licenses (default: [])
- **`includeDevDependencies`** (boolean): Include development dependencies (default: true)
- **`outputFormat`** (string): Output format for results (default: "json")

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "manager": "npm",
    "compliance": [
      {
        "name": "lodash",
        "version": "4.17.20",
        "license": "MIT",
        "status": "allowed"
      },
      {
        "name": "express",
        "version": "4.18.0",
        "license": "MIT",
        "status": "allowed"
      },
      {
        "name": "axios",
        "version": "0.21.0",
        "license": "MIT",
        "status": "allowed"
      }
    ],
    "summary": {
      "total": 3,
      "allowed": 3,
      "denied": 0,
      "unknown": 0
    },
    "directory": "/path/to/directory",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "toolAvailable": true,
    "allowedLicenses": ["MIT", "Apache-2.0"],
    "deniedLicenses": ["GPL-2.0", "GPL-3.0"],
    "message": "License compliance check completed: 3 dependencies checked (3 allowed, 0 denied, 0 unknown) using npm"
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

#### License Tool Not Available
```json
{
  "success": false,
  "error": "License tool not available",
  "data": {
    "error": "License tool not available",
    "message": "License tool npm is not available for npm",
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
  "error": "License tool not available",
  "data": {
    "error": "License tool not available",
    "message": "License tool not available for maven",
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
    "warning": "License compliance not yet supported",
    "message": "License compliance checking for maven is not yet supported",
    "directory": "/path/to/directory",
    "manager": "maven",
    "supportedManagers": ["npm", "pip", "cargo"]
  }
}
```

## Package Manager Support

### Supported Package Managers
- **NPM**: Uses `npm ls --json --long` for Node.js license information
- **PIP**: Uses `pip-licenses --format=json` for Python license information
- **Cargo**: Uses `cargo metadata --format-version 1` for Rust license information

### Unsupported Package Managers
- **Maven**: Returns warning message (not yet supported)
- **Gradle**: Returns warning message (not yet supported)

## Implementation Details

### NPM License Integration
```typescript
async function runNpmLicenseCheck(directory: string, includeDevDependencies: boolean): Promise<LicenseCompliance[]> {
  const args = ['ls', '--json', '--long'];
  if (!includeDevDependencies) {
    args.push('--production');
  }
  
  const child = spawn('npm', args, {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  // Parse JSON output for license information
  if (lsResult.dependencies) {
    for (const [name, dep] of Object.entries(lsResult.dependencies)) {
      const dependency = dep as any;
      const licenseInfo = parseNpmLicenseInfo(name, dependency, includeDevDependencies);
      if (licenseInfo) {
        compliance.push(licenseInfo);
      }
    }
  }
}
```

### PIP License Integration
```typescript
async function runPipLicenseCheck(directory: string, includeDevDependencies: boolean): Promise<LicenseCompliance[]> {
  const child = spawn('pip-licenses', ['--format=json'], {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  // Parse JSON output for license information
  if (Array.isArray(licensesResult)) {
    for (const item of licensesResult) {
      const licenseInfo = parsePipLicenseInfo(item, includeDevDependencies);
      if (licenseInfo) {
        compliance.push(licenseInfo);
      }
    }
  }
}
```

### Cargo License Integration
```typescript
async function runCargoLicenseCheck(directory: string, includeDevDependencies: boolean): Promise<LicenseCompliance[]> {
  const child = spawn('cargo', ['metadata', '--format-version', '1'], {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  
  // Parse JSON output for license information
  if (metadataResult.packages && Array.isArray(metadataResult.packages)) {
    for (const pkg of metadataResult.packages) {
      const licenseInfo = parseCargoLicenseInfo(pkg, includeDevDependencies);
      if (licenseInfo) {
        compliance.push(licenseInfo);
      }
    }
  }
}
```

### License Compliance Checking
```typescript
function checkLicenseCompliance(compliance: LicenseCompliance[], allowedLicenses: string[], deniedLicenses: string[]): LicenseCompliance[] {
  return compliance.map(item => {
    let status: 'allowed' | 'denied' | 'unknown' = 'unknown';
    
    if (allowedLicenses.length > 0 && allowedLicenses.includes(item.license)) {
      status = 'allowed';
    } else if (deniedLicenses.length > 0 && deniedLicenses.includes(item.license)) {
      status = 'denied';
    } else if (allowedLicenses.length === 0 && deniedLicenses.length === 0) {
      status = 'unknown';
    }
    
    return {
      ...item,
      status
    };
  });
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
  "name": "license_compliance_check",
  "arguments": {
    "directory": "."
  }
}
```

### NPM Check
```json
{
  "name": "license_compliance_check",
  "arguments": {
    "directory": ".",
    "packageManager": "npm",
    "allowedLicenses": ["MIT", "Apache-2.0"],
    "includeDevDependencies": true
  }
}
```

### Python Check
```json
{
  "name": "license_compliance_check",
  "arguments": {
    "directory": ".",
    "packageManager": "pip",
    "deniedLicenses": ["GPL-2.0", "GPL-3.0"],
    "includeDevDependencies": false
  }
}
```

### Rust Check
```json
{
  "name": "license_compliance_check",
  "arguments": {
    "directory": ".",
    "packageManager": "cargo",
    "allowedLicenses": ["MIT", "Apache-2.0"],
    "deniedLicenses": ["GPL-2.0", "GPL-3.0"],
    "includeDevDependencies": true
  }
}
```

### License Filtering
```json
{
  "name": "license_compliance_check",
  "arguments": {
    "directory": ".",
    "allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "deniedLicenses": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
    "outputFormat": "summary"
  }
}
```

## Use Cases

### License Compliance
- **License Auditing**: Check license compatibility across dependencies
- **Compliance Validation**: Ensure license compliance with organizational policies
- **License Filtering**: Allow or deny specific licenses
- **Dependency Review**: Review license information for all dependencies

### Development Workflow
- **Pre-commit Hooks**: Check license compliance before commits
- **CI/CD Integration**: Automated license compliance checking in pipelines
- **Code Review**: License review of dependencies
- **Risk Assessment**: Evaluate license risks in dependencies

### Production Readiness
- **Deployment Checks**: Verify license compliance before deployment
- **License Management**: Track and manage license compliance
- **Compliance Monitoring**: Continuous license compliance monitoring
- **Audit Trail**: Maintain license compliance audit history

## Error Handling

### Common Error Scenarios
- **Directory Not Found**: Invalid directory path
- **Tool Not Available**: Missing license checking tools
- **Unsupported Manager**: Package manager not supported
- **Parse Errors**: Malformed license data
- **Timeout**: Long-running operations exceeding limits

### Error Recovery
- **Graceful Degradation**: Continue with available information
- **Partial Results**: Return results from successful checks
- **Error Reporting**: Detailed error messages for troubleshooting
- **Fallback Behavior**: Skip problematic checks and continue

## Performance Considerations

### Optimization Strategies
- **Tool Availability**: Check tool availability before execution
- **Timeout Management**: Prevent hanging processes
- **Efficient Parsing**: Use optimized parsing algorithms
- **Caching**: Cache license results where possible

### Best Practices
```json
// For quick license compliance checks
{
  "name": "license_compliance_check",
  "arguments": {
    "allowedLicenses": ["MIT", "Apache-2.0"],
    "includeDevDependencies": false
  }
}

// For comprehensive analysis
{
  "name": "license_compliance_check",
  "arguments": {
    "allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "deniedLicenses": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
    "includeDevDependencies": true
  }
}
```

## Integration with Other Tools

### With Security Audit
```javascript
// Get license compliance information
const licenses = await handleSecurityTool('license_compliance_check', {
  directory: '.',
  packageManager: 'npm',
  allowedLicenses: ['MIT', 'Apache-2.0']
});

// Then run comprehensive security audit
const audit = await handleSecurityTool('security_audit', {
  directory: '.',
  severity: 'medium'
});
```

### With Dependency Analysis
```javascript
// Get dependency information
const dependencies = await handleSecurityTool('analyze_dependencies', {
  directory: '.',
  packageManager: 'auto'
});

// Then check license compliance
const licenses = await handleSecurityTool('license_compliance_check', {
  directory: '.',
  packageManager: dependencies.data.manager,
  allowedLicenses: ['MIT', 'Apache-2.0']
});
```

## Limitations

### Current Limitations
- **Tool Dependency**: Requires external license checking tools
- **Limited Support**: Only supports npm, pip, and cargo
- **No Real-time**: Doesn't provide real-time license updates
- **Basic Parsing**: Simple parsing without advanced features

### Future Enhancements
- **Multi-Source**: Integration with multiple license databases
- **Real-time Updates**: Live license data
- **Advanced Analysis**: More sophisticated license analysis
- **Compliance Reporting**: Advanced license compliance reporting
- **License Recommendations**: Automated license recommendations

## Troubleshooting

### Common Issues
1. **Tool Not Found**: Ensure license checking tools are installed
2. **Permission Denied**: Check file system permissions
3. **Parse Errors**: Verify license data format
4. **Timeout**: Large projects may require longer timeouts

### Debug Mode
Enable debug logging for detailed troubleshooting:
```json
{
  "name": "license_compliance_check",
  "arguments": {
    "directory": ".",
    "debug": true
  }
}
```

## Support and Documentation

### Additional Resources
- **License Databases**: SPDX, OSI, and other license resources
- **Compliance Best Practices**: Industry compliance guidelines
- **Tool Documentation**: Official documentation for license checking tools
- **Compliance Guides**: Regulatory compliance documentation

### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices
- **Contributions**: Community contributions and improvements
