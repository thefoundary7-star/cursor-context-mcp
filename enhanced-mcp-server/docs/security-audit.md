# Security Audit Tool

The `security_audit` tool provides comprehensive security analysis of codebases, including secret detection, dangerous function identification, and dependency vulnerability checking.

## Features

- **Secret Detection**: Scans for hardcoded secrets in .env files
- **Dangerous Function Detection**: Identifies potentially dangerous code patterns
- **Dependency Vulnerability Checking**: Runs npm audit for known vulnerabilities
- **Severity Filtering**: Filter issues by severity level
- **Multi-language Support**: Supports JavaScript, TypeScript, Python, and other languages
- **Structured Output**: Normalized security issue reporting

## Usage

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

### High Severity Only
```json
{
  "method": "tools/call",
  "params": {
    "name": "security_audit",
    "arguments": {
      "directory": ".",
      "severity": "high",
      "includeDevDependencies": true
    }
  }
}
```

## Parameters

### Required Parameters
None - all parameters are optional

### Optional Parameters
- **`directory`** (string): Directory to audit (default: ".")
- **`includeDevDependencies`** (boolean): Include development dependencies (default: true)
- **`severity`** (string): Minimum severity level to report (default: "medium")
- **`outputFormat`** (string): Output format for results (default: "json")

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "type": "secret",
        "file": "/path/to/.env",
        "line": 3,
        "message": "API key found in environment file",
        "severity": "high"
      },
      {
        "type": "dangerous_function",
        "file": "/path/to/dangerous.js",
        "line": 5,
        "message": "Use of eval() function detected",
        "severity": "critical"
      },
      {
        "type": "vulnerability",
        "file": "package.json",
        "message": "lodash: Prototype pollution vulnerability",
        "severity": "high"
      }
    ],
    "summary": {
      "total": 3,
      "bySeverity": {
        "low": 0,
        "medium": 0,
        "high": 2,
        "critical": 1
      }
    },
    "directory": "/path/to/directory",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "packageManager": "npm",
    "message": "Security audit completed: 3 issues found (1 critical, 2 high, 0 medium, 0 low)"
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

#### Security Audit Failed
```json
{
  "success": false,
  "error": "Security audit failed",
  "data": {
    "error": "Security audit failed",
    "message": "Security audit failed: Permission denied",
    "directory": "/path/to/directory"
  }
}
```

## Security Issue Types

### 1. Secret Detection
Scans for hardcoded secrets in .env files:

**Patterns Detected:**
- `API_KEY=...`
- `SECRET=...`
- `PASSWORD=...`
- `TOKEN=...`
- `PRIVATE_KEY=...`

**Severity:** High

### 2. Dangerous Function Detection
Identifies potentially dangerous code patterns:

**Node.js Patterns:**
- `eval()` - Critical severity
- `child_process.exec()` - High severity
- `child_process.spawn()` - Medium severity
- `fs.writeFileSync()` - Medium severity
- Dynamic `require()` - Medium severity

**Python Patterns:**
- `os.system()` - Critical severity
- `subprocess.Popen()` - High severity
- `subprocess.call()` - High severity
- `exec()` - Critical severity
- `eval()` - Critical severity

### 3. Dependency Vulnerabilities
Runs npm audit to check for known vulnerabilities:

**Supported Package Managers:**
- npm (primary)
- yarn (future)
- pnpm (future)

**Vulnerability Sources:**
- npm audit database
- CVE database
- Security advisories

## Implementation Details

### Secret Detection Algorithm
```typescript
// Scans for patterns like:
const secretPatterns = [
  { pattern: /API_KEY\s*=\s*['"][^'"]+['"]/i, message: 'API key found' },
  { pattern: /SECRET\s*=\s*['"][^'"]+['"]/i, message: 'Secret found' },
  { pattern: /PASSWORD\s*=\s*['"][^'"]+['"]/i, message: 'Password found' },
  { pattern: /TOKEN\s*=\s*['"][^'"]+['"]/i, message: 'Token found' },
  { pattern: /PRIVATE_KEY\s*=\s*['"][^'"]+['"]/i, message: 'Private key found' }
];
```

### Dangerous Function Detection
```typescript
// Node.js dangerous patterns
const nodePatterns = [
  { pattern: /eval\s*\(/g, message: 'Use of eval() function detected', severity: 'critical' },
  { pattern: /child_process\.exec\s*\(/g, message: 'Use of child_process.exec() detected', severity: 'high' },
  { pattern: /child_process\.spawn\s*\(/g, message: 'Use of child_process.spawn() detected', severity: 'medium' }
];

// Python dangerous patterns
const pythonPatterns = [
  { pattern: /os\.system\s*\(/g, message: 'Use of os.system() detected', severity: 'critical' },
  { pattern: /subprocess\.Popen\s*\(/g, message: 'Use of subprocess.Popen() detected', severity: 'high' },
  { pattern: /exec\s*\(/g, message: 'Use of exec() function detected', severity: 'critical' }
];
```

### NPM Audit Integration
```typescript
// Runs: npm audit --json
const child = spawn('npm', ['audit', '--json'], {
  cwd: directory,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

// Parses JSON output for vulnerabilities
if (auditResult.vulnerabilities) {
  for (const [packageName, vuln] of Object.entries(auditResult.vulnerabilities)) {
    // Convert npm severity to internal severity
    let severity = 'low';
    if (vulnerability.severity === 'critical') severity = 'critical';
    else if (vulnerability.severity === 'high') severity = 'high';
    else if (vulnerability.severity === 'moderate') severity = 'medium';
  }
}
```

## Examples

### Basic Security Audit
```json
{
  "name": "security_audit",
  "arguments": {
    "directory": "."
  }
}
```

### High Severity Only
```json
{
  "name": "security_audit",
  "arguments": {
    "directory": ".",
    "severity": "high"
  }
}
```

### Include Dev Dependencies
```json
{
  "name": "security_audit",
  "arguments": {
    "directory": ".",
    "includeDevDependencies": true,
    "severity": "medium"
  }
}
```

### Custom Output Format
```json
{
  "name": "security_audit",
  "arguments": {
    "directory": ".",
    "outputFormat": "summary"
  }
}
```

## Use Cases

### Development Security
- **Pre-commit Hooks**: Run security audits before commits
- **CI/CD Integration**: Automated security checking in pipelines
- **Code Review**: Security issue identification during reviews
- **Compliance**: Meet security compliance requirements

### Production Readiness
- **Deployment Checks**: Verify security before deployment
- **Vulnerability Management**: Track and remediate security issues
- **Risk Assessment**: Evaluate security risks in codebase
- **Audit Trail**: Maintain security audit history

## Error Handling

### Common Error Scenarios
- **Directory Not Found**: Invalid directory path
- **Permission Denied**: Insufficient file system permissions
- **NPM Not Available**: Missing npm installation
- **File Read Errors**: Unreadable files or directories
- **Timeout**: Long-running operations exceeding limits

### Error Recovery
- **Graceful Degradation**: Continue with available checks if some fail
- **Partial Results**: Return results from successful checks
- **Error Reporting**: Detailed error messages for troubleshooting
- **Fallback Behavior**: Skip problematic checks and continue

## Performance Considerations

### Optimization Strategies
- **File Filtering**: Skip unnecessary files and directories
- **Pattern Matching**: Efficient regex patterns for detection
- **Parallel Processing**: Concurrent file scanning where possible
- **Caching**: Cache results for repeated scans

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
  "name": "security_audit",
  "arguments": {
    "severity": "low",
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
const vulnerabilities = await handleSecurityTool('security_audit', {
  directory: 'src'
});
```

## Security Considerations

### Data Protection
- **Sensitive Information**: Avoid logging sensitive data
- **Local Storage**: Secure temporary files and cache
- **Network Security**: Use secure connections for vulnerability databases
- **Access Control**: Implement proper access controls

### Compliance
- **GDPR**: Ensure compliance with data protection regulations
- **SOX**: Follow Sarbanes-Oxley compliance requirements
- **HIPAA**: Healthcare data protection compliance
- **PCI DSS**: Payment card industry security standards

## Limitations

### Current Limitations
- **NPM Only**: Currently supports npm audit only
- **Pattern-based**: Relies on hardcoded patterns for detection
- **File-based**: Limited to file system scanning
- **Language Support**: Limited to JavaScript, TypeScript, Python

### Future Enhancements
- **Multi-package Manager**: Support for yarn, pnpm, pip, cargo
- **AI-powered Detection**: Machine learning-based security analysis
- **Real-time Monitoring**: Continuous security monitoring
- **Advanced Patterns**: More sophisticated detection patterns

## Troubleshooting

### Common Issues
1. **No Issues Found**: Check severity filter and directory path
2. **NPM Audit Fails**: Ensure npm is installed and package.json exists
3. **Permission Denied**: Check file system permissions
4. **Timeout**: Large codebases may require longer timeouts

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
- **Pattern Libraries**: Security pattern detection libraries
- **Compliance Guides**: Regulatory compliance documentation

### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive tool documentation
- **Examples**: Usage examples and best practices
- **Contributions**: Community contributions and improvements
