# License Management System Documentation

## Overview

The Cursor Context MCP Server now includes a comprehensive license management system that integrates with your Node.js SaaS backend. This system provides secure license validation, device fingerprinting, tier-based feature access control, and offline operation support.

## Features

### 🔐 License Validation
- **Online Validation**: Validates licenses with SaaS backend via `/api/auth/validate-license`
- **Offline Support**: Caches license status for offline operation with configurable grace period
- **Automatic Refresh**: Validates licenses every 24 hours (configurable)
- **Device Fingerprinting**: Generates unique device IDs for license enforcement
- **Graceful Degradation**: Falls back to free tier when validation fails

### 🏷️ Subscription Tiers
- **Free Tier**: Basic file operations and statistics
- **Pro Tier**: Advanced search, caching, and enhanced features
- **Enterprise Tier**: Full analytics, telemetry, and custom integrations

### 🛡️ Security Features
- **Device Fingerprinting**: Secure hardware/software identification
- **License Caching**: Encrypted local cache with expiration
- **Offline Grace Period**: Configurable offline operation time
- **Comprehensive Logging**: All license operations are logged

## Configuration

### Basic License Configuration

Add the following to your `config/server_config.json`:

```json
{
  "license": {
    "enabled": true,
    "license_key": "your-license-key-here",
    "validation_interval": 86400,
    "offline_grace_period": 7200,
    "device_fingerprint": {
      "enabled": true,
      "include_hardware": true,
      "include_software": true,
      "include_network": false
    },
    "tiers": {
      "free": {
        "max_file_size": 1048576,
        "max_operations_per_hour": 100,
        "features": ["basic_file_ops", "basic_stats"]
      },
      "pro": {
        "max_file_size": 10485760,
        "max_operations_per_hour": 1000,
        "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching"]
      },
      "enterprise": {
        "max_file_size": 104857600,
        "max_operations_per_hour": 10000,
        "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching", "analytics", "telemetry", "custom_integrations"]
      }
    }
  }
}
```

### Configuration Options

#### License Settings
- `enabled`: Enable/disable license management
- `license_key`: Your license key for validation
- `validation_interval`: How often to validate license (seconds, default: 86400 = 24 hours)
- `offline_grace_period`: How long to work offline after validation fails (seconds, default: 7200 = 2 hours)

#### Device Fingerprinting
- `enabled`: Enable device fingerprinting
- `include_hardware`: Include hardware information (CPU, MAC address, etc.)
- `include_software`: Include software information (OS, Python version, etc.)
- `include_network`: Include network information (IP address, etc.)

#### Tier Configuration
Each tier can have:
- `max_file_size`: Maximum file size for operations
- `max_operations_per_hour`: Rate limiting
- `features`: List of available features

## Usage

### License Validation Decorators

The system provides three types of decorators for protecting MCP tools:

#### @require_license
Basic license validation - requires any valid license:

```python
@mcp.tool()
@require_license(license_manager)
def basic_tool():
    return "This tool requires a valid license"
```

#### @require_tier("pro")
Requires specific tier or higher:

```python
@mcp.tool()
@require_tier('pro', license_manager)
def pro_feature():
    return "This is a PRO tier feature"
```

#### @require_feature("custom_integrations")
Requires specific feature:

```python
@mcp.tool()
@require_feature('custom_integrations', license_manager)
def custom_integration():
    return "This requires custom_integrations feature"
```

### Built-in MCP Tools

The system provides several MCP tools for license management:

#### get_license_status()
Get comprehensive license status information:
```python
get_license_status()
```

#### validate_license(force_refresh=False)
Force license validation:
```python
validate_license(force_refresh=True)
```

#### get_device_info()
Get device fingerprinting information:
```python
get_device_info()
```

#### get_server_stats()
Enhanced server statistics including license information:
```python
get_server_stats()
```

## API Integration

### License Validation Endpoint

The system expects your Node.js backend to provide:

**POST /api/auth/validate-license**

Request payload:
```json
{
  "license_key": "your-license-key",
  "device_id": "device-fingerprint-hash",
  "server_version": "2.0.0",
  "python_version": "3.9.0",
  "system_info": {
    "system": "Windows",
    "release": "10",
    "machine": "AMD64"
  }
}
```

Response payload:
```json
{
  "success": true,
  "license": {
    "tier": "pro",
    "expires_at": "2024-12-31T23:59:59Z",
    "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching"],
    "limits": {
      "max_file_size": 10485760,
      "max_operations_per_hour": 1000
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "License key not found or expired"
}
```

## Device Fingerprinting

### Security and Privacy

The device fingerprinting system is designed to be secure and privacy-conscious:

- **No Personal Data**: Only collects system characteristics, no personal information
- **Secure Hashing**: Uses SHA-256 to create device IDs
- **Configurable**: You can disable or customize what information is collected
- **Local Processing**: All fingerprinting is done locally

### Information Collected

#### Hardware Information (if enabled)
- CPU processor information
- Machine architecture
- MAC address
- Hostname

#### Software Information (if enabled)
- Operating system details
- Python version
- Server version

#### Network Information (if enabled, disabled by default)
- Local IP address

### Device ID Generation

The device ID is generated by:
1. Collecting system information based on configuration
2. Creating a JSON representation
3. Generating a SHA-256 hash
4. Using the hash as the device ID

## Offline Operation

### Grace Period

When the server cannot reach the SaaS backend:
1. **First 24 hours**: Uses cached license status
2. **Next 2 hours**: Continues with cached status (offline grace period)
3. **After grace period**: Falls back to free tier

### Cache Management

License status is cached in `~/.cursor-mcp/license_cache.json`:
- Automatically created and managed
- Encrypted and secure
- Automatically expires based on validation interval
- Cleared on license changes

## Error Handling

### User-Friendly Error Messages

The system provides clear error messages for common issues:

- **No License Key**: "No license key configured. Please set your license key in the configuration."
- **Network Issues**: "License validation service is not available. Please check your SaaS configuration."
- **Invalid License**: "License validation failed. Please check your license key and internet connection."
- **Offline Mode**: "License validation is in offline mode. Please check your internet connection."

### Graceful Degradation

When license validation fails:
1. Server continues to operate
2. Falls back to free tier features
3. Logs all license issues
4. Provides clear error messages to users

## Security Considerations

### Best Practices

1. **Secure License Keys**: Store license keys securely, never in version control
2. **Network Security**: Use HTTPS for all license validation requests
3. **Device Fingerprinting**: Enable hardware fingerprinting for better security
4. **Regular Validation**: Set appropriate validation intervals
5. **Offline Limits**: Configure reasonable offline grace periods

### Security Features

- **SSL/TLS**: All communication with SaaS backend uses HTTPS
- **Device Binding**: Licenses are tied to specific devices
- **Secure Caching**: License cache is stored securely
- **Audit Logging**: All license operations are logged
- **Input Validation**: All license data is validated

## Troubleshooting

### Common Issues

#### License Validation Fails
```
❌ License Error: License validation failed. Please check your license key and internet connection.
```

**Solutions:**
1. Check your license key in configuration
2. Verify SaaS backend is accessible
3. Check network connectivity
4. Review server logs for detailed errors

#### Device ID Issues
```
❌ License Error: Device fingerprinting failed
```

**Solutions:**
1. Check device fingerprinting configuration
2. Verify system permissions
3. Review hardware/software information collection

#### Offline Mode
```
❌ License Error: License validation is in offline mode. Please check your internet connection.
```

**Solutions:**
1. Check internet connectivity
2. Verify SaaS backend availability
3. Wait for grace period to expire
4. Force license refresh

### Debug Mode

Enable debug logging to see detailed license information:

```json
{
  "logging": {
    "level": "DEBUG"
  }
}
```

### Health Checks

Use the built-in tools to diagnose issues:

```python
# Check license status
get_license_status()

# Test SaaS connection
test_saas_connection()

# Get device information
get_device_info()

# Force license validation
validate_license(force_refresh=True)
```

## Example Implementation

### Basic License-Protected Tool

```python
@mcp.tool()
@performance_monitor(monitor, 'basic_tool')
@audit_log('basic_tool', saas)
@require_license(license_manager)
def basic_tool():
    """Basic tool that requires any valid license."""
    return "This tool requires a valid license"
```

### Pro Tier Feature

```python
@mcp.tool()
@performance_monitor(monitor, 'pro_feature')
@audit_log('pro_feature', saas)
@require_tier('pro', license_manager)
def pro_feature():
    """Feature that requires PRO tier or higher."""
    return "This is a PRO tier feature"
```

### Enterprise Feature

```python
@mcp.tool()
@performance_monitor(monitor, 'enterprise_feature')
@audit_log('enterprise_feature', saas)
@require_feature('custom_integrations', license_manager)
def enterprise_feature():
    """Feature that requires custom_integrations feature."""
    return "This requires custom_integrations feature"
```

## Integration with Existing Tools

### Enhanced Server Statistics

The `get_server_stats()` tool now includes license information:
- License status and tier
- Device ID (truncated for security)
- Last validation time
- Offline mode status
- Available features

### SaaS Integration

License management integrates with the existing SaaS system:
- Uses the same HTTP client
- Shares configuration
- Includes license information in analytics
- Provides unified error handling

## Performance Considerations

### Caching Strategy

- License status is cached locally
- Validation only occurs when needed
- Offline grace period prevents frequent validation
- Cache is automatically managed

### Network Efficiency

- Minimal data transfer for validation
- Efficient device fingerprinting
- Configurable validation intervals
- Smart retry logic

### Resource Usage

- Minimal memory footprint
- Efficient device fingerprinting
- Background validation
- Automatic cleanup

## Support and Maintenance

### Monitoring

Monitor license system health using:
- Server statistics
- License status reports
- Device information
- SaaS connection tests

### Maintenance

Regular maintenance tasks:
- Review license cache
- Monitor validation logs
- Update license keys
- Review device fingerprinting

### Support

For license-related issues:
1. Check server logs
2. Use diagnostic tools
3. Verify configuration
4. Test SaaS connectivity
5. Review device fingerprinting

## Migration Guide

### From No License System

1. **Enable License Management**:
   ```json
   {
     "license": {
       "enabled": true,
       "license_key": "your-license-key"
     }
   }
   ```

2. **Add Decorators to Tools**:
   ```python
   @require_license(license_manager)
   def your_tool():
       # Your tool implementation
   ```

3. **Test License Validation**:
   ```python
   validate_license()
   ```

### From Basic License System

1. **Update Configuration**:
   - Add tier definitions
   - Configure device fingerprinting
   - Set validation intervals

2. **Add Tier Decorators**:
   ```python
   @require_tier('pro', license_manager)
   def pro_tool():
       # Pro tool implementation
   ```

3. **Test New Features**:
   - Verify tier restrictions
   - Test offline operation
   - Check device fingerprinting

## Conclusion

The license management system provides a robust, secure, and user-friendly way to manage software licensing in your MCP server. It integrates seamlessly with your existing SaaS backend and provides comprehensive features for license validation, device enforcement, and tier-based access control.

The system is designed to be:
- **Secure**: Device fingerprinting and encrypted caching
- **Reliable**: Offline operation and graceful degradation
- **Flexible**: Configurable tiers and features
- **User-Friendly**: Clear error messages and diagnostic tools
- **Production-Ready**: Comprehensive logging and monitoring

For additional support or questions about the license management system, please refer to the server logs and use the built-in diagnostic tools.
