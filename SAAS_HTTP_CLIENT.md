# SaaS HTTP Client Documentation

## Overview

The Cursor Context MCP Server now includes a production-ready HTTP client for communicating with Node.js SaaS backends. This client provides comprehensive features for reliable API communication including authentication, retry logic, caching, and offline support.

## Features

### 🔐 Authentication
- **API Key Authentication**: Simple bearer token authentication
- **Username/Password Authentication**: Full OAuth-style authentication with token refresh
- **Automatic Token Management**: Handles token expiration and refresh automatically

### 🔄 Retry Logic
- **Exponential Backoff**: Configurable retry delays with exponential backoff
- **Smart Retry Strategy**: Retries server errors (5xx) and rate limits (429), but not client errors (4xx)
- **Configurable Limits**: Set maximum retries, initial delay, and backoff factor

### 💾 Caching & Offline Support
- **Response Caching**: Caches GET requests with configurable TTL
- **Offline Grace Period**: Continues working with cached data during network outages
- **Cache Management**: Automatic cache expiration and cleanup

### 🛡️ Security & Reliability
- **SSL Verification**: Configurable SSL certificate verification
- **Request Timeouts**: Prevents hanging requests
- **Comprehensive Logging**: Detailed request/response logging for debugging
- **Error Handling**: Structured error information with context

## Configuration

### Basic Configuration

Add the following to your `config/server_config.json`:

```json
{
  "saas": {
    "enabled": true,
    "api_endpoint": "https://api.cursor-context.com",
    "api_key": "your-api-key-here",
    "user_id": "your-user-id",
    "session_id": "your-session-id",
    "enable_analytics": true,
    "enable_telemetry": true,
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
      "user_agent": "Cursor-Context-MCP-Server/2.0.0"
    }
  }
}
```

### Configuration Options

#### SaaS Settings
- `enabled`: Enable/disable SaaS integration
- `api_endpoint`: Base URL for the SaaS API
- `api_key`: API key for authentication
- `user_id`: User identifier for requests
- `session_id`: Session identifier for requests
- `enable_analytics`: Enable analytics event sending
- `enable_telemetry`: Enable telemetry data collection

#### HTTP Client Settings
- `timeout`: Request timeout in seconds (default: 30)
- `max_retries`: Maximum number of retry attempts (default: 3)
- `retry_delay`: Initial delay between retries in seconds (default: 1.0)
- `retry_backoff_factor`: Exponential backoff multiplier (default: 2.0)
- `max_retry_delay`: Maximum delay between retries in seconds (default: 60.0)
- `offline_grace_period`: Time to use cached data when offline in seconds (default: 300)
- `enable_caching`: Enable response caching (default: true)
- `cache_ttl`: Cache time-to-live in seconds (default: 300)
- `verify_ssl`: Enable SSL certificate verification (default: true)
- `user_agent`: User agent string for requests

## Usage

### Testing the Connection

Use the built-in MCP tools to test your SaaS integration:

```bash
# Test SaaS connection
test_saas_connection()

# Get detailed HTTP client statistics
get_saas_client_stats()
```

### Programmatic Usage

The HTTP client is automatically initialized when SaaS integration is enabled. You can access it through the SaaS integration:

```python
# The client is available at saas.http_client
if saas.enabled and saas.http_client:
    # Make a GET request
    response = saas.http_client.get('/api/data')
    
    # Make a POST request
    response = saas.http_client.post('/api/data', data={'key': 'value'})
    
    # Make a PUT request
    response = saas.http_client.put('/api/data/123', data={'key': 'updated_value'})
    
    # Make a DELETE request
    response = saas.http_client.delete('/api/data/123')
```

### Authentication

#### API Key Authentication
```python
# Set API key in configuration or programmatically
saas.http_client.api_key = "your-api-key"
```

#### Username/Password Authentication
```python
# Authenticate with username and password
success = saas.http_client.authenticate(
    username="your-username",
    password="your-password"
)

# Refresh token if needed
if not success:
    success = saas.http_client.refresh_token()
```

## API Endpoints

The HTTP client expects the following API endpoints on your Node.js backend:

### Authentication Endpoints
- `POST /auth/login` - Username/password authentication
- `POST /auth/refresh` - Token refresh

### Health Check
- `GET /api/health` - API health status

### Analytics & Operations
- `POST /api/operations/log` - Log operation events
- `POST /api/analytics/event` - Send analytics events

## Error Handling

The client provides comprehensive error handling:

### SaaSClientError
Custom exception for unrecoverable errors:
```python
try:
    response = saas.http_client.get('/api/data')
except SaaSClientError as e:
    print(f"Client error: {e}")
```

### Error Information
All errors include structured information:
- HTTP status code
- Error reason
- Request URL
- Timestamp
- Response body (if available)
- Error type and message

## Caching

### Cache Behavior
- GET requests are cached by default
- Cache keys are generated from request method, URL, and parameters
- Cached responses include metadata about caching status
- Cache TTL is configurable per request type

### Cache Management
```python
# Clear all cached responses
saas.http_client.clear_cache()

# Get cache statistics
stats = saas.http_client.get_cache_stats()
print(f"Cache entries: {stats['total_entries']}")
print(f"Active entries: {stats['active_entries']}")
```

### Offline Mode
When network connectivity is lost:
1. Client attempts to use cached responses
2. If within grace period, cached data is returned
3. If grace period expired, connection errors are raised
4. Grace period is configurable (default: 5 minutes)

## Logging

The HTTP client provides comprehensive logging:

### Request Logging
- HTTP method and URL
- Request attempt number
- Parameter and data presence
- Authentication status

### Response Logging
- HTTP status code
- Response duration
- Success/failure status
- Content length
- Response headers

### Log Levels
- `INFO`: Successful requests and important events
- `WARNING`: Retryable errors and fallback behavior
- `ERROR`: Unrecoverable errors and exceptions
- `DEBUG`: Detailed request/response information

## Performance Considerations

### Timeout Configuration
- Set appropriate timeouts based on your API response times
- Consider network latency and server processing time
- Default timeout is 30 seconds

### Retry Configuration
- Balance between reliability and performance
- More retries = more reliability but slower failure detection
- Exponential backoff prevents overwhelming the server

### Caching Strategy
- Enable caching for frequently accessed data
- Set appropriate TTL based on data freshness requirements
- Monitor cache hit rates for optimization

## Security Best Practices

### SSL/TLS
- Always enable SSL verification in production
- Use HTTPS endpoints only
- Keep SSL certificates up to date

### Authentication
- Use strong API keys
- Rotate API keys regularly
- Implement proper token expiration

### Network Security
- Use secure networks
- Consider VPN for sensitive data
- Monitor for unusual request patterns

## Troubleshooting

### Common Issues

#### Connection Errors
```
SaaSClientError: Connection failed after 4 attempts
```
- Check network connectivity
- Verify API endpoint URL
- Check firewall settings

#### Authentication Errors
```
SaaSClientError: Client error: {'status_code': 401, 'reason': 'Unauthorized'}
```
- Verify API key is correct
- Check token expiration
- Ensure proper authentication headers

#### Timeout Errors
```
SaaSClientError: Request timeout after 4 attempts
```
- Increase timeout configuration
- Check server response times
- Verify network stability

### Debug Mode
Enable debug logging to see detailed request/response information:

```json
{
  "logging": {
    "level": "DEBUG"
  }
}
```

### Health Checks
Use the built-in health check tools:
- `test_saas_connection()` - Test basic connectivity
- `get_saas_client_stats()` - View detailed statistics

## Example Integration

Here's a complete example of integrating with a Node.js SaaS backend:

### 1. Configure the Server
```json
{
  "saas": {
    "enabled": true,
    "api_endpoint": "https://api.cursor-context.com",
    "api_key": "your-api-key",
    "user_id": "user123",
    "session_id": "session456",
    "enable_analytics": true,
    "http_client": {
      "timeout": 30,
      "max_retries": 3,
      "enable_caching": true,
      "cache_ttl": 300
    }
  }
}
```

### 2. Test the Connection
```python
# Use the MCP tool to test
test_saas_connection()
```

### 3. Monitor Performance
```python
# Get client statistics
get_saas_client_stats()
```

### 4. Handle Errors Gracefully
```python
try:
    response = saas.http_client.get('/api/data')
    if response.get('success'):
        # Process successful response
        data = response.get('data')
    else:
        # Handle API-level errors
        error = response.get('error')
except SaaSClientError as e:
    # Handle client-level errors
    logger.error(f"HTTP client error: {e}")
```

## Dependencies

The HTTP client requires the following Python package:
- `httpx>=0.24.0` - Modern HTTP client library

Install with:
```bash
pip install httpx>=0.24.0
```

## Support

For issues or questions about the SaaS HTTP client:
1. Check the logs for detailed error information
2. Use the built-in diagnostic tools
3. Verify configuration settings
4. Test network connectivity
5. Review API endpoint documentation
