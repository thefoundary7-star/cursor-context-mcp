# MCP Server Directory Configuration Guide

## Overview

The MCP Server now includes a comprehensive directory configuration system that allows users to easily control which folders the server can access without editing Claude Desktop configurations. This system is designed for commercial use with security, audit logging, and user-friendly management.

## Features

- **User-friendly Configuration**: JSON-based configuration in `~/.mcp/config.json`
- **CLI Management**: Easy command-line tools for configuration
- **Auto-reload**: Configuration changes are automatically detected and applied
- **Security Controls**: Prevents access to system directories and sensitive files
- **Audit Logging**: Tracks all directory access for security auditing
- **Git Integration**: Automatically respects `.gitignore` patterns
- **File Size Limits**: Configurable limits to prevent reading large files
- **Pattern Exclusions**: Flexible file and directory exclusion patterns

## Quick Start

### 1. Add a Directory to Monitor

```bash
python mcp_config_manager.py --add-dir /path/to/your/project
```

### 2. List Current Directories

```bash
python mcp_config_manager.py --list-dirs
```

### 3. Add Exclusion Patterns

```bash
python mcp_config_manager.py --exclude-pattern "*.env"
python mcp_config_manager.py --exclude-pattern "node_modules"
```

### 4. Run the Server

```bash
python official_mcp_server.py
```

## Configuration File Structure

The configuration file is located at `~/.mcp/config.json` and has the following structure:

```json
{
  "watchedDirectories": [
    {
      "path": "/path/to/project",
      "enabled": true,
      "maxFileSize": "10MB",
      "excludePatterns": [".env*", "node_modules", ".git"],
      "includeGitignore": true,
      "lastAccessed": "2024-01-15T10:30:00.000Z"
    }
  ],
  "globalExcludePatterns": [
    ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log"
  ],
  "maxFileSize": "10MB",
  "enabled": true,
  "auditLogging": true,
  "securityMode": "moderate",
  "configVersion": "2.0.0",
  "lastModified": "2024-01-15T10:30:00.000Z"
}
```

### Configuration Fields

#### Watched Directories
- **path**: Absolute path to the directory to monitor
- **enabled**: Whether this directory is currently being monitored
- **maxFileSize**: Maximum file size that can be read from this directory
- **excludePatterns**: Directory-specific exclusion patterns
- **includeGitignore**: Whether to automatically respect `.gitignore` files
- **lastAccessed**: Timestamp of last access (automatically updated)

#### Global Settings
- **globalExcludePatterns**: Patterns that apply to all directories
- **maxFileSize**: Default maximum file size for all directories
- **enabled**: Whether the MCP server is enabled
- **auditLogging**: Whether to log all access for security auditing
- **securityMode**: Security level (`strict`, `moderate`, `permissive`)
- **configVersion**: Configuration file version
- **lastModified**: When the configuration was last changed

## CLI Commands

### Directory Management

```bash
# Add a directory to monitor
python mcp_config_manager.py --add-dir /path/to/project

# Remove a directory from monitoring
python mcp_config_manager.py --remove-dir /path/to/project

# List all monitored directories
python mcp_config_manager.py --list-dirs
```

### Exclusion Patterns

```bash
# Add a global exclusion pattern
python mcp_config_manager.py --exclude-pattern "*.env"

# Remove an exclusion pattern
python mcp_config_manager.py --remove-exclude-pattern "*.env"
```

### Server Control

```bash
# Enable the MCP server
python mcp_config_manager.py --enable

# Disable the MCP server
python mcp_config_manager.py --disable

# Set security mode
python mcp_config_manager.py --security-mode strict
```

### Configuration Management

```bash
# Show configuration summary
python mcp_config_manager.py --summary

# Validate current configuration
python mcp_config_manager.py --validate

# Use custom config file
python mcp_config_manager.py --config-path ~/.mcp/custom-config.json
```

## Security Features

### Directory Access Control

The system prevents access to sensitive system directories:
- `/` (root)
- `/usr`, `/etc`, `/var`, `/sys`, `/proc`, `/dev` (Linux)
- `C:\`, `C:\Windows`, `C:\System32`, `C:\Program Files` (Windows)

### File Size Limits

Configurable file size limits prevent reading large files that could impact performance:
- Default: 10MB
- Configurable per directory
- Supports B, KB, MB, GB suffixes

### Exclusion Patterns

Multiple levels of exclusion patterns:
1. **Global patterns**: Apply to all directories
2. **Directory-specific patterns**: Apply only to specific directories
3. **Gitignore integration**: Automatically respect `.gitignore` files

### Audit Logging

All directory access is logged to `~/.mcp/audit.log` for security auditing:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "action": "add_directory",
  "path": "/path/to/project",
  "details": {"enabled": true},
  "user": "username"
}
```

## Security Modes

### Strict Mode
- Maximum security restrictions
- Limited file access
- Enhanced audit logging
- Stricter path validation

### Moderate Mode (Default)
- Balanced security and functionality
- Standard file access controls
- Normal audit logging
- Standard path validation

### Permissive Mode
- Minimal security restrictions
- Broader file access
- Basic audit logging
- Relaxed path validation

## Integration with Claude Desktop

The MCP server integrates seamlessly with Claude Desktop. Update your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "cursor-context": {
      "command": "python",
      "args": [
        "official_mcp_server.py",
        "--config",
        "~/.mcp/config.json"
      ]
    }
  }
}
```

## New MCP Tools

The enhanced server provides additional tools for configuration management:

### get_config_summary
Get a summary of the current configuration:
```json
{
  "success": true,
  "config": {
    "enabled": true,
    "security_mode": "moderate",
    "total_directories": 2,
    "enabled_directories": 2
  }
}
```

### list_watched_directories
List all directories currently being monitored:
```json
{
  "success": true,
  "directories": [
    {
      "path": "/path/to/project",
      "enabled": true,
      "max_file_size": "10MB"
    }
  ],
  "total_count": 1
}
```

### check_path_access
Check if a specific path is accessible:
```json
{
  "success": true,
  "path": "/path/to/file.txt",
  "allowed": true,
  "reason": "Path is allowed"
}
```

## Best Practices

### For Development Teams

1. **Shared Configuration**: Store configuration in version control
2. **Environment-Specific Settings**: Use different configs for dev/staging/prod
3. **Regular Audits**: Review audit logs regularly
4. **Minimal Access**: Only add necessary directories

### For Commercial Use

1. **Security First**: Use strict mode in production
2. **Audit Everything**: Enable comprehensive audit logging
3. **Regular Updates**: Keep configuration up to date
4. **Access Control**: Limit who can modify configurations

### For Individual Users

1. **Start Simple**: Begin with a few key directories
2. **Use Patterns**: Leverage exclusion patterns for efficiency
3. **Monitor Usage**: Check audit logs occasionally
4. **Backup Config**: Keep configuration backups

## Troubleshooting

### Common Issues

**"Directory access not allowed by configuration"**
- Check if the directory is in the watched list
- Verify the directory is enabled
- Check exclusion patterns

**"File too large"**
- Increase the max file size limit
- Use directory-specific limits if needed

**"Configuration file not found"**
- Run the config manager to create default config
- Check file permissions

### Debug Mode

Run with verbose logging for troubleshooting:
```bash
python official_mcp_server.py --verbose
```

### Configuration Validation

Always validate your configuration:
```bash
python mcp_config_manager.py --validate
```

## Migration from Previous Versions

If you're upgrading from a previous version:

1. **Backup Current Config**: Save your existing configuration
2. **Run Migration**: The system will automatically migrate old formats
3. **Validate Settings**: Check that all settings are correct
4. **Test Access**: Verify that directory access works as expected

## Support

For commercial support and advanced configuration options, contact the MCP team.

## License

This configuration system is part of the MCP Server and is licensed under the ISC License.
