# Security & Dependency Tools

The Security & Dependency tools provide comprehensive security auditing, vulnerability checking, dependency analysis, and license compliance capabilities for modern development workflows.

## Overview

These tools are designed to help developers and teams:
- **Security Auditing**: Comprehensive security analysis of codebases and dependencies
- **Vulnerability Management**: Identify and track known security vulnerabilities
- **Dependency Analysis**: Understand dependency relationships and potential issues
- **License Compliance**: Ensure license compatibility and compliance
- **Risk Assessment**: Evaluate security risks and provide remediation guidance

## Available Tools

### 1. Security Audit (`security_audit`)
Comprehensive security audit of the codebase and dependencies.

**Features:**
- Multi-package manager support (npm, yarn, pnpm, pip, cargo, maven, gradle)
- Severity-based filtering (low, medium, high, critical)
- Development dependency inclusion control
- Multiple output formats (json, table, summary)

**Input Parameters:**
- `directory` (string): Directory to audit (default: ".")
- `includeDevDependencies` (boolean): Include dev dependencies (default: true)
- `severity` (string): Minimum severity level (default: "medium")
- `outputFormat` (string): Output format (default: "json")

### 2. Dependency Analysis (`analyze_dependencies`)
Analyze project dependencies and their relationships.

**Features:**
- Auto-detection of package managers
- Dependency relationship mapping
- Version conflict detection
- Development dependency analysis

**Input Parameters:**
- `directory` (string): Directory to analyze (default: ".")
- `packageManager` (string): Package manager to use (default: "auto")
- `includeDevDependencies` (boolean): Include dev dependencies (default: true)
- `depth` (number): Maximum analysis depth (default: 3)

### 3. Vulnerability Check (`check_vulnerabilities`)
Check for known security vulnerabilities in dependencies.

**Features:**
- Multiple vulnerability databases
- Severity-based filtering
- Remediation recommendations
- Real-time vulnerability data

**Input Parameters:**
- `directory` (string): Directory to check (default: ".")
- `packageManager` (string): Package manager to use (default: "auto")
- `severity` (string): Minimum severity level (default: "medium")
- `includeDevDependencies` (boolean): Include dev dependencies (default: true)
- `outputFormat` (string): Output format (default: "json")

### 4. Dependency Tree Analysis (`dependency_tree_analysis`)
Analyze dependency tree structure and relationships.

**Features:**
- Hierarchical dependency visualization
- Circular dependency detection
- Tree depth analysis
- Multiple output formats

**Input Parameters:**
- `directory` (string): Directory to analyze (default: ".")
- `packageManager` (string): Package manager to use (default: "auto")
- `maxDepth` (number): Maximum tree depth (default: 5)
- `includeDevDependencies` (boolean): Include dev dependencies (default: true)
- `outputFormat` (string): Output format (default: "json")

### 5. License Compliance Check (`license_compliance_check`)
Check license compliance and compatibility.

**Features:**
- License extraction and analysis
- Compatibility checking
- Allowed/denied license lists
- Compliance reporting

**Input Parameters:**
- `directory` (string): Directory to check (default: ".")
- `packageManager` (string): Package manager to use (default: "auto")
- `allowedLicenses` (array): List of allowed licenses
- `deniedLicenses` (array): List of denied licenses
- `includeDevDependencies` (boolean): Include dev dependencies (default: true)
- `outputFormat` (string): Output format (default: "json")

## Usage Examples

### Basic Security Audit
```json
{
  "method": "tools/call",
  "params": {
    "name": "security_audit",
    "arguments": {
      "directory": ".",
      "severity": "medium",
      "outputFormat": "json"
    }
  }
}
```

### Dependency Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "analyze_dependencies",
    "arguments": {
      "directory": ".",
      "packageManager": "auto",
      "depth": 3
    }
  }
}
```

### Vulnerability Check
```json
{
  "method": "tools/call",
  "params": {
    "name": "check_vulnerabilities",
    "arguments": {
      "directory": ".",
      "severity": "high",
      "includeDevDependencies": true
    }
  }
}
```

### License Compliance
```json
{
  "method": "tools/call",
  "params": {
    "name": "license_compliance_check",
    "arguments": {
      "directory": ".",
      "allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
      "deniedLicenses": ["GPL-2.0", "GPL-3.0"]
    }
  }
}
```

## Implementation Status

### Current Status: Placeholder Implementation
All security tools are currently implemented as placeholders with:
- ✅ **Tool Discovery**: All tools are discoverable via MCP `list_tools`
- ✅ **Input Validation**: Comprehensive input schemas for all tools
- ✅ **Error Handling**: Proper error handling and response formatting
- ✅ **MCP Integration**: Full integration with MCP protocol

### Planned Implementation
Each tool will be implemented with:

#### Security Audit
- **npm audit**: `npm audit --json`
- **yarn audit**: `yarn audit --json`
- **pip-audit**: `pip-audit --format=json`
- **cargo audit**: `cargo audit --json`
- **maven dependency-check**: Maven dependency check plugin
- **gradle dependency-check**: Gradle dependency check plugin

#### Dependency Analysis
- **package.json parsing**: Extract dependency information
- **requirements.txt parsing**: Python dependency analysis
- **Cargo.toml parsing**: Rust dependency analysis
- **pom.xml parsing**: Maven dependency analysis
- **build.gradle parsing**: Gradle dependency analysis

#### Vulnerability Check
- **npm audit**: Node.js vulnerability checking
- **yarn audit**: Yarn vulnerability checking
- **pip-audit**: Python vulnerability checking
- **cargo audit**: Rust vulnerability checking
- **OWASP dependency-check**: Java vulnerability checking

#### Dependency Tree Analysis
- **npm ls**: Node.js dependency tree
- **yarn list**: Yarn dependency tree
- **pip show**: Python dependency information
- **cargo tree**: Rust dependency tree
- **mvn dependency:tree**: Maven dependency tree
- **gradle dependencies**: Gradle dependency tree

#### License Compliance Check
- **license-checker**: Node.js license checking
- **pip-licenses**: Python license checking
- **cargo-license**: Rust license checking
- **license-maven-plugin**: Maven license checking
- **gradle-license-plugin**: Gradle license checking

## Error Handling

### Common Error Scenarios
- **Directory Not Found**: Invalid directory path
- **Package Manager Not Found**: Missing package manager tools
- **Permission Denied**: Insufficient file system permissions
- **Network Issues**: Connectivity problems for vulnerability databases
- **Timeout**: Long-running operations exceeding time limits

### Error Response Format
```json
{
  "success": false,
  "error": "Error type",
  "data": {
    "error": "Error message",
    "message": "Detailed error description",
    "directory": "/path/to/directory",
    "tool": "tool_name"
  }
}
```

## Performance Considerations

### Optimization Strategies
- **Caching**: Cache vulnerability data and dependency information
- **Parallel Processing**: Run multiple checks concurrently
- **Incremental Analysis**: Only analyze changed dependencies
- **Selective Scanning**: Focus on high-risk dependencies

### Best Practices
```json
// For quick security checks
{
  "name": "security_audit",
  "arguments": {
    "severity": "high",
    "includeDevDependencies": false
  }
}

// For comprehensive analysis
{
  "name": "analyze_dependencies",
  "arguments": {
    "depth": 5,
    "includeDevDependencies": true
  }
}
```

## Integration with Other Tools

### With Git Tools
```javascript
// Get recent commits
const commits = await handleGitTool('get_commit_history', {
  repository: '.',
  limit: 10
});

// Check for security issues in recent changes
const audit = await handleSecurityTool('security_audit', {
  directory: '.',
  severity: 'medium'
});
```

### With File Tools
```javascript
// Get file information
const files = await handleFileTool('list_files', {
  directory: 'src',
  recursive: true
});

// Check for security issues in specific files
const vulnerabilities = await handleSecurityTool('check_vulnerabilities', {
  directory: 'src'
});
```

## Security Considerations

### Data Protection
- **Sensitive Information**: Avoid logging sensitive dependency information
- **Network Security**: Use secure connections for vulnerability databases
- **Local Storage**: Secure local cache and temporary files
- **Access Control**: Implement proper access controls for security tools

### Compliance
- **GDPR**: Ensure compliance with data protection regulations
- **SOX**: Follow Sarbanes-Oxley compliance requirements
- **HIPAA**: Healthcare data protection compliance
- **PCI DSS**: Payment card industry security standards

## Future Enhancements

### Advanced Features
- **Real-time Monitoring**: Continuous security monitoring
- **Automated Remediation**: Automatic vulnerability fixes
- **Risk Scoring**: Advanced risk assessment algorithms
- **Compliance Reporting**: Automated compliance reporting
- **Integration APIs**: Third-party security tool integration

### Tool Extensions
- **Custom Rules**: User-defined security rules
- **Plugin System**: Extensible security tool plugins
- **Cloud Integration**: Cloud-based security services
- **AI-Powered Analysis**: Machine learning-based security analysis

## Troubleshooting

### Common Issues
1. **Tool Not Found**: Ensure package managers are installed
2. **Permission Denied**: Check file system permissions
3. **Network Timeout**: Verify internet connectivity
4. **Invalid Output**: Check tool output format compatibility

### Debug Mode
Enable debug logging for detailed troubleshooting:
```json
{
  "name": "security_audit",
  "arguments": {
    "directory": ".",
    "debug": true
  }
}
```

## Support and Documentation

### Additional Resources
- **Security Best Practices**: Industry security guidelines
- **Vulnerability Databases**: CVE, NVD, OWASP resources
- **License Information**: SPDX license database
- **Compliance Guides**: Regulatory compliance documentation

### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices
- **Contributions**: Community contributions and improvements
