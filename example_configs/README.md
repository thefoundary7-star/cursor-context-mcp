# Example Configurations for Enhanced MCP Server

This directory contains example configurations for different project types and use cases.

## Configuration Files

### 1. `python-project.json`
Configuration optimized for Python projects with:
- Python-specific file extensions
- Django/Flask project patterns
- Virtual environment exclusions
- Python security scanning

### 2. `javascript-project.json`
Configuration optimized for JavaScript/TypeScript projects with:
- Node.js and npm patterns
- React/Vue/Angular project structures
- Build tool exclusions
- JavaScript security scanning

### 3. `java-project.json`
Configuration optimized for Java projects with:
- Maven/Gradle build patterns
- Spring Boot project structures
- JAR file exclusions
- Java security scanning

### 4. `cpp-project.json`
Configuration optimized for C/C++ projects with:
- CMake/Make build patterns
- Header file indexing
- Binary file exclusions
- C++ security scanning

### 5. `multi-language.json`
Configuration for multi-language projects with:
- Comprehensive file type support
- Multiple build system patterns
- Cross-language symbol analysis
- Universal security scanning

### 6. `minimal.json`
Minimal configuration for:
- Lightweight installations
- Resource-constrained environments
- Basic file operations only
- Minimal security scanning

### 7. `production.json`
Production-ready configuration with:
- Enhanced security settings
- Performance optimizations
- Comprehensive monitoring
- Audit logging enabled

### 8. `development.json`
Development-focused configuration with:
- Debug logging enabled
- Fast indexing
- Development tool integration
- Relaxed security for testing

## Usage

To use an example configuration:

1. Copy the desired configuration file to your MCP config directory:
   ```bash
   cp example_configs/python-project.json ~/.mcp/enhanced_config.json
   ```

2. Customize the configuration for your specific project:
   ```bash
   python mcp_config_manager.py --add-dir /path/to/your/project
   ```

3. Start the MCP server:
   ```bash
   python official_mcp_server.py
   ```

## Customization

Each configuration can be customized by:

- Adding/removing watched directories
- Adjusting performance limits
- Enabling/disabling specific features
- Modifying security settings
- Changing logging levels

## Migration from Basic Config

If you have an existing basic MCP configuration, you can migrate it:

```bash
python install_enhanced_features.py --migrate-from ~/.mcp/config.json
```

This will automatically convert your existing configuration to the enhanced format while preserving your settings.
