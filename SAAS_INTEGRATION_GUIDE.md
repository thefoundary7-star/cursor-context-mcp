# SaaS Integration Guide

This guide explains how to integrate your Python MCP server with the Node.js SaaS backend for commercial features, analytics, and license management.

## 🚀 Quick Start

### 1. Start Node.js Backend
```bash
# In your Node.js project directory
npm run dev
# Backend should be running on http://localhost:3000
```

### 2. Configure Python MCP Server
```bash
# Use the test configuration
python official_mcp_server.py --config config/test-saas-config.json
```

### 3. Test Integration
Use the MCP tools to test the integration:
- `test_saas_connection` - Test API connectivity
- `test_license_validation` - Test license validation
- `test_usage_tracking` - Test analytics data transmission
- `get_saas_client_stats` - View HTTP client statistics

## 📋 Configuration

### Test Configuration (`config/test-saas-config.json`)
```json
{
  "saas": {
    "enabled": true,
    "api_endpoint": "http://localhost:3000",
    "api_key": "test-api-key-12345",
    "user_id": "test-user-12345",
    "session_id": "test-session-12345",
    "enable_analytics": true,
    "enable_telemetry": true,
    "enable_license_validation": true,
    "license_validation_optional": true,
    "http_client": {
      "timeout": 10,
      "max_retries": 3,
      "verify_ssl": false,
      "user_agent": "Cursor-Context-MCP-Server-Test/2.0.0"
    }
  }
}
```

### Production Configuration
For production, update the configuration:
```json
{
  "saas": {
    "enabled": true,
    "api_endpoint": "https://api.your-domain.com",
    "api_key": "your-production-api-key",
    "enable_analytics": true,
    "enable_license_validation": true,
    "license_validation_optional": false,
    "http_client": {
      "timeout": 30,
      "verify_ssl": true
    }
  }
}
```

## 🔧 Features

### 1. Connection Testing
The server automatically tests the SaaS connection on startup:
- Health check to `/api/health`
- Service status monitoring
- Connection error handling with graceful fallback

### 2. License Validation
- Validates licenses with `/api/auth/validate-license`
- Device fingerprinting for security
- Optional validation mode for testing
- License status tracking

### 3. Usage Tracking
- Sends usage data to `/api/analytics/track`
- Tracks tool usage, file operations, search queries
- Batch processing for efficiency
- Local storage fallback

### 4. Analytics Integration
- Real-time analytics events
- Performance metrics tracking
- Error monitoring and reporting
- User behavior analytics

## 🧪 Testing Tools

### `test_saas_connection`
Tests the connection to the SaaS backend and displays:
- API endpoint status
- Health check results
- Service connectivity
- HTTP client statistics

### `test_license_validation`
Tests license validation functionality:
- Sends validation request to backend
- Displays validation results
- Shows license details and features
- Handles validation errors

### `test_usage_tracking`
Tests the usage tracking system:
- Sends sample usage events
- Tests analytics data transmission
- Verifies backend connectivity
- Shows tracking statistics

### `get_saas_client_stats`
Displays detailed HTTP client statistics:
- Cache performance metrics
- Request/response statistics
- Authentication status
- Configuration details

## 📊 API Endpoints

The integration uses these Node.js backend endpoints:

### Health Check
```
GET /api/health
```
Returns backend health status and service information.

### License Validation
```
POST /api/auth/validate-license
Content-Type: application/json

{
  "licenseKey": "your-license-key",
  "serverId": "mcp-server-12345",
  "serverName": "Cursor Context MCP Server",
  "serverVersion": "2.0.0"
}
```

### Usage Tracking
```
POST /api/analytics/track
Content-Type: application/json

{
  "licenseKey": "your-license-key",
  "serverId": "mcp-server-12345",
  "events": [
    {
      "event_id": "uuid",
      "timestamp": "2024-01-01T00:00:00Z",
      "event_type": "tool_usage",
      "tool_name": "list_files",
      "duration": 0.15,
      "success": true
    }
  ]
}
```

## 🔍 Debugging

### Enable Debug Logging
Set the logging level to DEBUG in your configuration:
```json
{
  "logging": {
    "level": "DEBUG",
    "file": "logs/mcp_server_test.log"
  }
}
```

### Check Logs
Monitor the log file for detailed information:
```bash
tail -f logs/mcp_server_test.log
```

### Common Issues

1. **Connection Failed**
   - Ensure Node.js backend is running
   - Check API endpoint URL
   - Verify network connectivity

2. **License Validation Failed**
   - Check license key configuration
   - Verify backend license validation endpoint
   - Enable optional validation for testing

3. **Usage Tracking Failed**
   - Check analytics endpoint
   - Verify API key permissions
   - Check network connectivity

## 🚀 Production Deployment

### 1. Update Configuration
- Set production API endpoint
- Use production API keys
- Enable SSL verification
- Set appropriate timeouts

### 2. Security Considerations
- Use HTTPS for API endpoints
- Secure API key storage
- Enable SSL certificate verification
- Implement proper error handling

### 3. Monitoring
- Monitor connection health
- Track usage analytics
- Set up alerts for failures
- Monitor license validation

## 📈 Performance

### Optimization Tips
- Use connection pooling
- Implement request batching
- Cache frequently accessed data
- Monitor response times

### Metrics to Track
- API response times
- Connection success rates
- License validation performance
- Usage tracking throughput

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor API endpoint health
- Update license keys as needed
- Review usage analytics
- Check error logs

### Version Updates
- Test integration with new backend versions
- Update API endpoints if changed
- Verify compatibility
- Update documentation

## 📞 Support

For issues with the SaaS integration:
1. Check the logs for error details
2. Test individual components using the test tools
3. Verify backend connectivity
4. Review configuration settings

The integration is designed to be robust with graceful fallbacks, so the MCP server will continue to function even if the SaaS backend is temporarily unavailable.
