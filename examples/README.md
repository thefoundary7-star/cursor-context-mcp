# Enhanced MCP Server Examples

This directory contains comprehensive examples demonstrating the enhanced MCP server features, including code analysis, git integration, security auditing, and performance monitoring.

## Examples Overview

### 1. Enhanced Features Examples (`enhanced_features_examples.py`)

A comprehensive demonstration of all enhanced MCP server features including:

- **Code Analysis**: Symbol search, reference finding, documentation extraction
- **Git Integration**: Status, diff, commit history, blame, branch information
- **Security Features**: Security auditing, privilege management, access control
- **Performance Monitoring**: Statistics, caching, optimization
- **File Monitoring**: Real-time file system monitoring and auto-reindexing
- **Configuration Management**: Configuration validation and management

**Usage:**
```bash
# Run all examples
python enhanced_features_examples.py

# Run specific category
python enhanced_features_examples.py --category code_analysis
python enhanced_features_examples.py --category security
python enhanced_features_examples.py --category performance

# Specify project directory
python enhanced_features_examples.py --directory /path/to/project
```

### 2. Performance Optimization Examples (`performance_optimization_examples.py`)

Demonstrates performance optimization techniques and best practices:

- **Benchmarking**: Performance testing of various operations
- **Optimization**: Automatic performance tuning and configuration
- **Monitoring**: Real-time performance monitoring
- **Reporting**: Comprehensive performance reports

**Usage:**
```bash
# Run all performance optimizations
python performance_optimization_examples.py

# Run specific optimization
python performance_optimization_examples.py --action benchmark
python performance_optimization_examples.py --action optimize
python performance_optimization_examples.py --action monitor

# Monitor for specific duration
python performance_optimization_examples.py --action monitor --duration 120
```

### 3. Security Best Practices Examples (`security_best_practices_examples.py`)

Demonstrates security best practices and secure usage patterns:

- **Configuration Security**: Configuration validation and security settings
- **Path Access Control**: Testing and managing path access restrictions
- **Security Auditing**: Automated security scanning and vulnerability detection
- **Privilege Management**: Read-only mode and privilege controls
- **Directory Scanning**: Comprehensive directory security scanning
- **Security Monitoring**: Security state monitoring and alerting

**Usage:**
```bash
# Run all security demonstrations
python security_best_practices_examples.py

# Run specific security demo
python security_best_practices_examples.py --action demo
python security_best_practices_examples.py --action audit
python security_best_practices_examples.py --action report
```

## Quick Start

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Basic Examples**:
   ```bash
   # Navigate to examples directory
   cd examples
   
   # Run enhanced features demo
   python enhanced_features_examples.py
   
   # Run performance optimization
   python performance_optimization_examples.py
   
   # Run security best practices
   python security_best_practices_examples.py
   ```

3. **Customize for Your Project**:
   ```bash
   # Use your project directory
   python enhanced_features_examples.py --directory /path/to/your/project
   
   # Run specific features
   python enhanced_features_examples.py --category git_integration
   ```

## Example Outputs

### Enhanced Features Example Output
```
🚀 Enhanced MCP Server Features Demo
==================================================

📋 Code Analysis
------------------------------
1. Searching for symbols...
   Found 15 symbols
   - create_user (function) in /path/to/user.py
   - User (class) in /path/to/models.py
   - validate_email (function) in /path/to/utils.py

2. Finding references...
   Found 8 references to 'create_user'

3. Extracting documentation...
   Found 25 documentation items

4. Analyzing dependencies...
   Found 12 dependencies
   - requests 2.28.0
   - pytest 7.0.0
   - fastapi 0.68.0

✅ Code Analysis completed successfully
```

### Performance Optimization Example Output
```
🚀 Performance Benchmarking
========================================

📊 Benchmarking Symbol Search...
   ✅ Symbol Search: 0.045s average

📊 Benchmarking Reference Finding...
   ✅ Reference Finding: 0.123s average

📊 Benchmarking Index Statistics...
   ✅ Index Statistics: 0.012s average

📋 Benchmark Summary
========================================

✅ Symbol Search:
   Operations: 5
   Average time: 0.045s
   Min time: 0.032s
   Max time: 0.067s
```

### Security Best Practices Example Output
```
🔒 Security Best Practices Demo
========================================

🛡️ Configuration Security
------------------------------
1. Validating configuration security...
   Configuration issues: 0
   Configuration warnings: 2
   Security recommendations: 3
   💡 Security recommendations:
     - Consider enabling audit logging
     - Review exclusion patterns
     - Enable read-only mode in production

2. Getting configuration summary...
   Security mode: moderate
   Total directories: 3
   Configuration enabled: true

✅ Configuration Security completed successfully
```

## Integration with Your Workflow

### Development Workflow Integration

1. **Code Analysis Workflow**:
   ```python
   # Search for functions before refactoring
   functions = search_symbols("deprecated", symbol_type="function")
   
   # Find all references to update
   for func in functions["symbols"]:
       references = find_references(func["name"])
       print(f"Found {len(references['references'])} references to {func['name']}")
   ```

2. **Git Integration Workflow**:
   ```python
   # Check git status before committing
   status = get_git_status(".")
   if status["modified_files"]:
       print("Modified files:", status["modified_files"])
   
   # Get commit history for release notes
   history = get_commit_history(limit=10)
   for commit in history["commits"]:
       print(f"{commit['hash'][:8]}: {commit['message']}")
   ```

3. **Security Workflow**:
   ```python
   # Regular security audit
   audit_result = security_audit("src/main.py")
   if audit_result["total_issues"] > 0:
       print("Security issues found:", audit_result["issues"])
   
   # Enable read-only mode for production
   set_read_only_mode(True)
   ```

### CI/CD Integration

1. **Pre-commit Security Check**:
   ```bash
   # Add to pre-commit hook
   python examples/security_best_practices_examples.py --action audit
   ```

2. **Performance Regression Testing**:
   ```bash
   # Add to CI pipeline
   python examples/performance_optimization_examples.py --action benchmark
   ```

3. **Documentation Generation**:
   ```bash
   # Generate documentation in CI
   python examples/enhanced_features_examples.py --category code_analysis
   ```

## Customization

### Creating Custom Examples

You can create custom examples by extending the base classes:

```python
from examples.enhanced_features_examples import MCPEnhancedFeaturesDemo

class CustomDemo(MCPEnhancedFeaturesDemo):
    def custom_workflow(self):
        """Your custom workflow here."""
        # Your custom logic
        pass

# Run custom demo
demo = CustomDemo("/path/to/project")
demo.custom_workflow()
```

### Configuration

Examples can be configured using environment variables or configuration files:

```bash
# Set environment variables
export MCP_PROJECT_DIR="/path/to/project"
export MCP_DEBUG=true
export MCP_LOG_LEVEL=INFO

# Run examples
python enhanced_features_examples.py
```

## Troubleshooting

### Common Issues

1. **Import Errors**:
   ```
   Error importing MCP server modules: No module named 'official_mcp_server'
   ```
   **Solution**: Ensure the MCP server is properly installed and the path is correct.

2. **Permission Errors**:
   ```
   Permission denied when accessing files
   ```
   **Solution**: Check file permissions and ensure the MCP server has appropriate access.

3. **Performance Issues**:
   ```
   Operations taking too long
   ```
   **Solution**: Use performance optimization examples to tune the server.

### Getting Help

1. **Check Logs**: Enable debug logging to see detailed information
2. **Validate Configuration**: Use the configuration validation tools
3. **Run Diagnostics**: Use the performance and security monitoring tools
4. **Review Documentation**: Check the main documentation for detailed information

## Contributing

To contribute new examples:

1. Follow the existing code structure and patterns
2. Include comprehensive error handling
3. Add proper documentation and comments
4. Test with various project types and sizes
5. Update this README with new examples

## License

These examples are provided under the same license as the Enhanced MCP Server (ISC License).
