# Enhanced Configuration System Documentation

## Overview

The Cursor Context MCP Server now includes a comprehensive, production-ready configuration management system that supports SaaS integration, environment variables, configuration validation, profiles, and runtime updates. This system is designed for enterprise deployments with full automation support.

## Features

### 🔧 Enhanced Configuration Management
- **Environment Variable Support**: Override any configuration setting via environment variables
- **Configuration Validation**: Comprehensive validation with helpful error messages
- **Profile-Based Configurations**: Predefined configurations for different deployment scenarios
- **Runtime Configuration Updates**: Update settings without server restart
- **Configuration Migration**: Automatic migration between configuration versions
- **Comprehensive Error Handling**: Detailed error messages and troubleshooting guidance

### 🌍 Environment Variable Support
- **Deployment Automation**: Configure via environment variables for CI/CD
- **Type Conversion**: Automatic conversion of string values to appropriate types
- **Priority System**: Environment variables override file configuration
- **Security**: Sensitive values can be set via environment variables

### 🏷️ Configuration Profiles
- **Development**: Optimized for local development with debugging enabled
- **Staging**: Pre-production testing with limited analytics
- **Production**: Full production configuration with all features enabled

### ✅ Configuration Validation
- **Comprehensive Checks**: Validates all configuration sections
- **Type Validation**: Ensures correct data types for all settings
- **Dependency Validation**: Validates relationships between configuration options
- **Helpful Error Messages**: Clear error messages with troubleshooting guidance

## Configuration Structure

### Core Configuration Sections

#### Server Configuration
```json
{
  "server": {
    "name": "Cursor Context MCP Server",
    "version": "2.0.0",
    "max_file_size": 1048576,
    "allowed_extensions": [],
    "blocked_extensions": [".exe", ".dll", ".so", ".dylib", ".bin"],
    "max_directory_depth": 10,
    "enable_caching": true,
    "cache_ttl": 300,
    "enable_compression": false,
    "max_concurrent_operations": 10,
    "operation_timeout": 30
  }
}
```

#### SaaS Integration Configuration
```json
{
  "saas": {
    "enabled": false,
    "api_endpoint": "https://api.cursor-context.com",
    "api_key": "",
    "user_id": "",
    "session_id": "",
    "enable_analytics": true,
    "enable_telemetry": true,
    "offline_mode": false,
    "sync_interval": 300,
    "max_retry_attempts": 3,
    "retry_backoff_factor": 2.0,
    "http_client": {
      "timeout": 30,
      "max_retries": 3,
      "retry_delay": 1.0,
      "retry_backoff_factor": 2.0,
      "max_retry_delay": 60.0,
      "offline_grace_period": 300,
      "enable_caching": true,
      "cache_ttl": 300,
      "verify_ssl": true,
      "user_agent": "Cursor-Context-MCP-Server/2.0.0",
      "connection_pool_size": 10,
      "keepalive_timeout": 30
    },
    "endpoints": {
      "auth": "/api/auth",
      "analytics": "/api/analytics",
      "license": "/api/license",
      "usage": "/api/usage",
      "health": "/api/health"
    },
    "rate_limiting": {
      "enabled": true,
      "requests_per_minute": 60,
      "burst_limit": 10
    }
  }
}
```

#### License Management Configuration
```json
{
  "license": {
    "enabled": true,
    "license_key": "",
    "validation_interval": 86400,
    "offline_grace_period": 7200,
    "validation_timeout": 30,
    "retry_attempts": 3,
    "cache_validation": true,
    "device_fingerprint": {
      "enabled": true,
      "include_hardware": true,
      "include_software": true,
      "include_network": false,
      "include_user_agent": true
    },
    "tiers": {
      "free": {
        "max_file_size": 1048576,
        "max_operations_per_hour": 100,
        "max_concurrent_sessions": 1,
        "features": ["basic_file_ops", "basic_stats"],
        "rate_limits": {
          "requests_per_minute": 10,
          "burst_limit": 5
        }
      },
      "pro": {
        "max_file_size": 10485760,
        "max_operations_per_hour": 1000,
        "max_concurrent_sessions": 3,
        "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching", "analytics"],
        "rate_limits": {
          "requests_per_minute": 60,
          "burst_limit": 20
        }
      },
      "enterprise": {
        "max_file_size": 104857600,
        "max_operations_per_hour": 10000,
        "max_concurrent_sessions": 10,
        "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching", "analytics", "telemetry", "custom_integrations", "sso", "audit_logging"],
        "rate_limits": {
          "requests_per_minute": 300,
          "burst_limit": 100
        }
      }
    }
  }
}
```

#### Analytics Configuration
```json
{
  "analytics": {
    "enabled": true,
    "privacy_mode": "balanced",
    "track_usage": true,
    "track_performance": true,
    "track_errors": true,
    "anonymize_data": false,
    "batch_size": 100,
    "batch_interval": 300,
    "retention_days": 30,
    "max_queue_size": 10000,
    "flush_on_shutdown": true,
    "local_storage": {
      "enabled": true,
      "max_entries": 10000,
      "cleanup_interval": 3600,
      "compression": true,
      "encryption": true
    },
    "quota_enforcement": {
      "enabled": true,
      "check_interval": 60,
      "grace_period": 300,
      "warning_threshold": 0.8
    },
    "data_types": {
      "file_operations": true,
      "git_operations": true,
      "search_queries": true,
      "performance_metrics": true,
      "error_tracking": true,
      "user_behavior": true,
      "system_metrics": true
    },
    "export": {
      "enabled": false,
      "format": "json",
      "schedule": "daily",
      "destination": "local"
    }
  }
}
```

#### Authentication Configuration
```json
{
  "authentication": {
    "enabled": true,
    "method": "email_password",
    "auto_login": true,
    "remember_credentials": true,
    "session_timeout": 3600,
    "token_refresh_threshold": 300,
    "max_concurrent_sessions": 3,
    "idle_timeout": 1800,
    "device_registration": {
      "enabled": true,
      "auto_register": true,
      "require_approval": false,
      "max_devices": 5,
      "device_timeout": 86400
    },
    "sso": {
      "enabled": false,
      "provider": "none",
      "endpoint": "",
      "client_id": "",
      "client_secret": "",
      "redirect_uri": "",
      "scope": "openid profile email",
      "auto_refresh": true
    },
    "security": {
      "use_keyring": true,
      "encrypt_tokens": true,
      "require_2fa": false,
      "password_policy": {
        "min_length": 8,
        "require_uppercase": true,
        "require_lowercase": true,
        "require_numbers": true,
        "require_symbols": false,
        "max_age_days": 90,
        "history_count": 5
      },
      "session_security": {
        "secure_cookies": true,
        "http_only": true,
        "same_site": "strict",
        "csrf_protection": true
      }
    }
  }
}
```

#### Feature Flags Configuration
```json
{
  "feature_flags": {
    "advanced_search": true,
    "caching": true,
    "analytics": true,
    "telemetry": true,
    "custom_integrations": false,
    "sso": false,
    "audit_logging": true,
    "performance_monitoring": true,
    "error_tracking": true,
    "usage_analytics": true
  }
}
```

#### Deployment Configuration
```json
{
  "deployment": {
    "environment": "production",
    "region": "us-east-1",
    "cluster": "default",
    "replicas": 1,
    "resources": {
      "cpu": "100m",
      "memory": "256Mi",
      "storage": "1Gi"
    },
    "health_checks": {
      "enabled": true,
      "interval": 30,
      "timeout": 10,
      "retries": 3
    }
  }
}
```

## Environment Variable Support

### Supported Environment Variables

| Environment Variable | Configuration Key | Description |
|---------------------|-------------------|-------------|
| `API_ENDPOINT` | `saas.api_endpoint` | SaaS backend API endpoint |
| `LICENSE_KEY` | `license.license_key` | License key for validation |
| `DEBUG_MODE` | `logging.level` | Enable debug logging |
| `OFFLINE_MODE` | `saas.enabled` | Disable SaaS integration |
| `SAAS_API_KEY` | `saas.api_key` | SaaS API key |
| `USER_ID` | `saas.user_id` | User ID for SaaS |
| `SESSION_ID` | `saas.session_id` | Session ID for SaaS |
| `AUTH_METHOD` | `authentication.method` | Authentication method |
| `AUTO_LOGIN` | `authentication.auto_login` | Enable auto-login |
| `PRIVACY_MODE` | `analytics.privacy_mode` | Analytics privacy mode |
| `BATCH_SIZE` | `analytics.batch_size` | Analytics batch size |
| `RETENTION_DAYS` | `analytics.retention_days` | Data retention period |
| `MAX_FILE_SIZE` | `server.max_file_size` | Maximum file size |
| `CACHE_TTL` | `server.cache_ttl` | Cache TTL in seconds |
| `LOG_LEVEL` | `logging.level` | Logging level |
| `LOG_FILE` | `logging.file` | Log file path |
| `CONFIG_PROFILE` | `profile` | Configuration profile |

### Environment Variable Usage

#### Docker Deployment
```bash
docker run -e API_ENDPOINT=https://api.cursor-context.com \
           -e LICENSE_KEY=your-license-key \
           -e DEBUG_MODE=false \
           -e CONFIG_PROFILE=production \
           cursor-mcp-server
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cursor-mcp-server
spec:
  template:
    spec:
      containers:
      - name: cursor-mcp-server
        image: cursor-mcp-server:latest
        env:
        - name: API_ENDPOINT
          value: "https://api.cursor-context.com"
        - name: LICENSE_KEY
          valueFrom:
            secretKeyRef:
              name: cursor-mcp-secrets
              key: license-key
        - name: CONFIG_PROFILE
          value: "production"
```

#### Local Development
```bash
export API_ENDPOINT=https://dev-api.cursor-context.com
export DEBUG_MODE=true
export CONFIG_PROFILE=development
python official_mcp_server.py
```

## Configuration Profiles

### Development Profile
- **Logging**: DEBUG level with console output
- **SaaS**: Disabled for offline development
- **Analytics**: Minimal tracking with strict privacy
- **Authentication**: Disabled for easy testing
- **Performance**: Async operations enabled
- **Security**: Relaxed settings for development

### Staging Profile
- **Logging**: INFO level with structured logging
- **SaaS**: Enabled with staging endpoint
- **Analytics**: Balanced privacy with anonymization
- **Authentication**: Enabled with auto-login
- **Performance**: Optimized for testing
- **Security**: Production-like settings

### Production Profile
- **Logging**: WARNING level with file output only
- **SaaS**: Fully enabled with production endpoint
- **Analytics**: Full tracking with minimal anonymization
- **Authentication**: Full security with 2FA support
- **Performance**: Optimized for production load
- **Security**: Maximum security settings

## Configuration Validation

### Validation Rules

#### Server Configuration
- `max_file_size`: Must be a positive integer
- `cache_ttl`: Must be a positive integer
- `max_directory_depth`: Must be a positive integer
- `max_concurrent_operations`: Must be a positive integer
- `operation_timeout`: Must be a positive integer

#### SaaS Configuration
- `api_endpoint`: Required when SaaS is enabled
- `api_key`: Required when SaaS is enabled
- `http_client.timeout`: Must be a positive number
- `http_client.max_retries`: Must be a non-negative integer

#### License Configuration
- `license_key`: Required when license validation is enabled
- `validation_interval`: Must be a positive integer
- `offline_grace_period`: Must be a non-negative integer

#### Analytics Configuration
- `privacy_mode`: Must be 'strict', 'balanced', or 'permissive'
- `batch_size`: Must be a positive integer
- `retention_days`: Must be a positive integer

#### Authentication Configuration
- `method`: Must be 'email_password', 'api_key', or 'sso'
- `session_timeout`: Must be a positive integer
- `max_concurrent_sessions`: Must be a positive integer

#### Feature Flags
- All feature flags must be boolean values

### Validation Error Messages

The system provides clear, actionable error messages:

```
Configuration validation failed: 
- saas.api_endpoint is required when SaaS is enabled
- analytics.privacy_mode must be 'strict', 'balanced', or 'permissive'
- server.max_file_size must be a positive integer
```

## Configuration Management Tools

### Get Configuration Status
```python
get_config_status()
```

Returns comprehensive configuration information including:
- Configuration version and profile
- Environment overrides
- Validation errors
- Feature flags status
- Service status

### Update Configuration
```python
update_config(key="server.max_file_size", value="2097152", save_to_file=True)
```

Updates configuration values at runtime with:
- Automatic type conversion
- Validation before update
- Option to save to file
- Impact assessment

### Apply Configuration Profile
```python
apply_config_profile("production")
```

Applies predefined configuration profiles with:
- Profile validation
- Settings application
- Impact assessment

### Reload Configuration
```python
reload_config()
```

Reloads configuration from file and environment variables with:
- File reload
- Environment variable reapplication
- Validation
- Change detection

## Configuration Migration

### Automatic Migration

The system automatically migrates configurations between versions:

#### v1.0.0 to v2.0.0 Migration
- Adds `feature_flags` section with defaults
- Adds `deployment` section with defaults
- Updates SaaS configuration with new endpoints
- Updates license tiers with rate limits

### Migration Process

1. **Version Detection**: System detects current configuration version
2. **Migration Execution**: Applies appropriate migration logic
3. **Validation**: Validates migrated configuration
4. **Version Update**: Updates configuration version

## Example Configurations

### Development Configuration
```json
{
  "config_version": "2.0.0",
  "profile": "development",
  "server": {
    "max_file_size": 1048576,
    "max_concurrent_operations": 5
  },
  "logging": {
    "level": "DEBUG",
    "console_output": true
  },
  "saas": {
    "enabled": false
  },
  "analytics": {
    "enabled": false
  },
  "authentication": {
    "enabled": false
  },
  "feature_flags": {
    "analytics": false,
    "telemetry": false
  }
}
```

### Staging Configuration
```json
{
  "config_version": "2.0.0",
  "profile": "staging",
  "server": {
    "max_file_size": 10485760,
    "max_concurrent_operations": 8
  },
  "logging": {
    "level": "INFO",
    "structured_logging": true
  },
  "saas": {
    "enabled": true,
    "api_endpoint": "https://staging-api.cursor-context.com"
  },
  "analytics": {
    "enabled": true,
    "privacy_mode": "balanced",
    "anonymize_data": true
  },
  "authentication": {
    "enabled": true,
    "auto_login": true
  }
}
```

### Production Configuration
```json
{
  "config_version": "2.0.0",
  "profile": "production",
  "server": {
    "max_file_size": 104857600,
    "max_concurrent_operations": 20,
    "enable_compression": true
  },
  "logging": {
    "level": "WARNING",
    "console_output": false,
    "structured_logging": true
  },
  "saas": {
    "enabled": true,
    "api_endpoint": "https://api.cursor-context.com",
    "max_retry_attempts": 5
  },
  "analytics": {
    "enabled": true,
    "privacy_mode": "balanced",
    "anonymize_data": false,
    "export": {
      "enabled": true,
      "destination": "s3"
    }
  },
  "authentication": {
    "enabled": true,
    "require_2fa": true,
    "sso": {
      "enabled": true,
      "provider": "oauth2"
    }
  },
  "feature_flags": {
    "sso": true,
    "custom_integrations": true
  }
}
```

## Best Practices

### Configuration Management
1. **Use Environment Variables**: For sensitive values and deployment-specific settings
2. **Version Control**: Keep configuration files in version control
3. **Profile Selection**: Use appropriate profiles for different environments
4. **Validation**: Always validate configuration before deployment
5. **Documentation**: Document custom configuration changes

### Security Considerations
1. **Sensitive Data**: Use environment variables for API keys and secrets
2. **File Permissions**: Restrict access to configuration files
3. **Encryption**: Enable token encryption for authentication
4. **Audit Logging**: Enable audit logging for production deployments

### Performance Optimization
1. **Caching**: Enable caching for production deployments
2. **Compression**: Enable compression for large file operations
3. **Connection Pooling**: Configure appropriate connection pool sizes
4. **Rate Limiting**: Set appropriate rate limits for your use case

### Monitoring and Observability
1. **Logging**: Use structured logging for production
2. **Analytics**: Enable analytics for usage tracking
3. **Performance Monitoring**: Enable performance monitoring
4. **Health Checks**: Configure health check endpoints

## Troubleshooting

### Common Issues

#### Configuration Validation Errors
```
Error: Configuration validation failed: saas.api_endpoint is required when SaaS is enabled
```
**Solution**: Set the `API_ENDPOINT` environment variable or add `api_endpoint` to the SaaS configuration.

#### Environment Variable Not Applied
```
Error: Environment variable not taking effect
```
**Solution**: Ensure the environment variable name matches the mapping table and restart the server.

#### Profile Application Failed
```
Error: Invalid profile: invalid_profile
```
**Solution**: Use one of the valid profiles: `development`, `staging`, or `production`.

#### Configuration File Not Found
```
Error: Configuration file not found
```
**Solution**: Ensure the configuration file exists in one of the standard locations or specify the path explicitly.

### Debug Mode

Enable debug mode for detailed configuration information:

```bash
export DEBUG_MODE=true
export LOG_LEVEL=DEBUG
python official_mcp_server.py
```

### Configuration Status Check

Use the configuration status tool to diagnose issues:

```python
get_config_status()
```

This will show:
- Current configuration version and profile
- Environment overrides
- Validation errors
- Feature flags status
- Service status

## Conclusion

The enhanced configuration system provides a comprehensive, production-ready solution for managing MCP server configurations. It supports:

- **Environment Variable Overrides**: For deployment automation
- **Configuration Validation**: With helpful error messages
- **Profile-Based Configurations**: For different deployment scenarios
- **Runtime Updates**: Without server restart
- **Automatic Migration**: Between configuration versions
- **Comprehensive Documentation**: With examples and best practices

This system is designed to scale with your business while maintaining security, performance, and ease of use. It provides the foundation for enterprise-grade configuration management and deployment automation.
