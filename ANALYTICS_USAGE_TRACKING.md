# Analytics and Usage Tracking Documentation

## Overview

The Cursor Context MCP Server now includes a comprehensive analytics and usage tracking system designed for SaaS billing, business intelligence, and user insights. The system is GDPR compliant, privacy-respectful, and production-ready with advanced features for data collection, processing, and reporting.

## Features

### 📊 Comprehensive Usage Tracking
- **Tool Usage**: Track every MCP tool call with metadata (duration, file size, success/failure)
- **File Operations**: Detailed tracking of file operations with size and type information
- **Search Queries**: Track search patterns and result counts
- **Performance Metrics**: Monitor response times, error rates, and system performance
- **Error Tracking**: Comprehensive error logging with context and categorization

### 🔄 Batch Processing & Local Storage
- **Intelligent Batching**: Collects usage data in batches for efficient transmission
- **Local Storage**: Stores data locally when backend is unavailable
- **Automatic Cleanup**: Configurable data retention and cleanup policies
- **Offline Support**: Continues tracking during network outages

### 🔒 Privacy & GDPR Compliance
- **Privacy Modes**: Configurable privacy levels (strict, balanced, permissive)
- **Data Anonymization**: Automatic anonymization of sensitive data
- **User Control**: Users can control what data is collected
- **Data Retention**: Configurable retention periods with automatic cleanup
- **Transparency**: Clear reporting of what data is collected

### 🎯 Quota Enforcement & Rate Limiting
- **Real-time Monitoring**: Track usage against license tier limits
- **Graceful Degradation**: Handle quota exceeded scenarios
- **Visual Indicators**: Clear quota status and usage visualization
- **Automatic Enforcement**: Background quota checking and enforcement

## Configuration

### Basic Analytics Configuration

Add the following to your `config/server_config.json`:

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
    "local_storage": {
      "enabled": true,
      "max_entries": 10000,
      "cleanup_interval": 3600
    },
    "quota_enforcement": {
      "enabled": true,
      "check_interval": 60,
      "grace_period": 300
    },
    "data_types": {
      "file_operations": true,
      "git_operations": true,
      "search_queries": true,
      "performance_metrics": true,
      "error_tracking": true
    }
  }
}
```

### Configuration Options

#### Core Analytics Settings
- `enabled`: Enable/disable analytics tracking
- `privacy_mode`: Privacy level ("strict", "balanced", "permissive")
- `track_usage`: Track general tool usage
- `track_performance`: Track performance metrics
- `track_errors`: Track error information
- `anonymize_data`: Automatically anonymize sensitive data

#### Batch Processing
- `batch_size`: Number of events to collect before sending (default: 100)
- `batch_interval`: Time interval for batch processing in seconds (default: 300 = 5 minutes)
- `retention_days`: How long to keep data locally (default: 30 days)

#### Local Storage
- `enabled`: Enable local storage of usage data
- `max_entries`: Maximum number of events to store locally (default: 10000)
- `cleanup_interval`: How often to cleanup old data in seconds (default: 3600 = 1 hour)

#### Quota Enforcement
- `enabled`: Enable quota enforcement
- `check_interval`: How often to check quota status in seconds (default: 60)
- `grace_period`: Grace period after quota exceeded in seconds (default: 300 = 5 minutes)

#### Data Types
- `file_operations`: Track file operations
- `git_operations`: Track Git operations
- `search_queries`: Track search queries
- `performance_metrics`: Track performance metrics
- `error_tracking`: Track error information

## Privacy Modes

### Strict Mode
- Maximum data anonymization
- Minimal data collection
- No personal information stored
- Aggressive data cleanup

### Balanced Mode (Default)
- Moderate data anonymization
- Standard data collection
- Some metadata preserved for analytics
- Standard retention periods

### Permissive Mode
- Minimal data anonymization
- Comprehensive data collection
- Full metadata for detailed analytics
- Extended retention periods

## Usage

### Automatic Tracking

The system automatically tracks usage when you use the `@track_usage` decorator:

```python
@mcp.tool()
@track_usage(usage_tracker, 'my_tool')
def my_tool():
    return "This tool usage is automatically tracked"
```

### Manual Tracking

You can also manually track specific events:

```python
# Track tool usage
usage_tracker.track_tool_usage(
    tool_name='custom_operation',
    duration=1.5,
    success=True,
    file_size=1024,
    file_path='/path/to/file.txt'
)

# Track file operations
usage_tracker.track_file_operation(
    operation='read',
    file_path='/path/to/file.txt',
    file_size=1024,
    duration=0.5,
    success=True
)

# Track search queries
usage_tracker.track_search_query(
    query='python function',
    result_count=25,
    duration=0.8,
    search_type='text'
)

# Track errors
usage_tracker.track_error(
    tool_name='read_file',
    error_type='FileNotFoundError',
    error_message='File not found',
    duration=0.1
)

# Track performance metrics
usage_tracker.track_performance_metric(
    metric_name='memory_usage',
    value=128.5,
    unit='MB'
)
```

### Built-in MCP Tools

The system provides several MCP tools for analytics:

#### get_usage_stats()
Get comprehensive usage statistics:
```python
get_usage_stats()
```

#### get_usage_summary(days=7)
Get usage summary for specified days:
```python
get_usage_summary(days=30)
```

#### get_quota_status()
Get current quota status and limits:
```python
get_quota_status()
```

#### get_server_stats()
Enhanced server statistics including usage information:
```python
get_server_stats()
```

## API Integration

### Analytics Endpoint

The system sends usage data to your Node.js backend:

**POST /api/analytics/track**

Request payload:
```json
{
  "events": [
    {
      "event_id": "uuid",
      "timestamp": "2024-01-01T12:00:00Z",
      "event_type": "tool_usage",
      "tool_name": "read_file",
      "session_id": "session123",
      "device_id": "device456...",
      "license_tier": "pro",
      "server_version": "2.0.0",
      "python_version": "3.9.0",
      "system_info": {
        "system": "Windows",
        "release": "10"
      },
      "duration": 0.5,
      "success": true,
      "file_size": 1024,
      "file_path": "/path/to/file.txt"
    }
  ],
  "batch_id": "batch-uuid",
  "timestamp": "2024-01-01T12:00:00Z",
  "total_events": 1
}
```

Response payload:
```json
{
  "success": true,
  "processed_events": 1,
  "quota_status": {
    "current_usage": 45,
    "quota_limit": 1000,
    "quota_exceeded": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Quota exceeded",
  "quota_status": {
    "current_usage": 1000,
    "quota_limit": 1000,
    "quota_exceeded": true
  }
}
```

## Data Structure

### Usage Event Structure

Each usage event contains:

```json
{
  "event_id": "unique-event-id",
  "timestamp": "ISO-8601-timestamp",
  "event_type": "tool_usage|file_operation|search_query|error|performance_metric",
  "tool_name": "name-of-tool",
  "session_id": "user-session-id",
  "device_id": "device-fingerprint-hash",
  "license_tier": "free|pro|enterprise",
  "server_version": "2.0.0",
  "python_version": "3.9.0",
  "system_info": {
    "system": "Windows|Linux|macOS",
    "release": "system-version"
  },
  "duration": 0.5,
  "success": true,
  "file_size": 1024,
  "file_path": "/path/to/file.txt",
  "error_type": "ErrorType",
  "error_message": "Error description",
  "query": "search query",
  "result_count": 25,
  "search_type": "text|regex|fuzzy",
  "metric_name": "performance_metric_name",
  "metric_value": 128.5,
  "metric_unit": "MB|seconds|count"
}
```

## Privacy and Security

### Data Anonymization

The system provides multiple levels of data anonymization:

#### File Path Anonymization
- Keeps directory structure
- Hashes filenames
- Preserves file extensions for analytics

#### Search Query Anonymization
- Keeps first and last words
- Hashes middle words
- Preserves query structure for analytics

#### User Data Anonymization
- Hashes user IDs with salt
- Removes personal information
- Preserves analytics value

### Data Retention

- **Local Storage**: Configurable retention period (default: 30 days)
- **Automatic Cleanup**: Background cleanup of expired data
- **User Control**: Users can clear their data at any time
- **Compliance**: GDPR-compliant data handling

### Security Features

- **Encrypted Storage**: Local data stored securely
- **Secure Transmission**: HTTPS for all data transmission
- **Access Control**: License-based access to analytics features
- **Audit Logging**: All analytics operations are logged

## Quota Enforcement

### Real-time Monitoring

The system continuously monitors usage against license tier limits:

- **Free Tier**: 100 operations/hour
- **Pro Tier**: 1,000 operations/hour
- **Enterprise Tier**: 10,000 operations/hour

### Quota Status

The system provides real-time quota information:

```json
{
  "current_usage": 45,
  "quota_limit": 1000,
  "quota_reset_time": "2024-01-01T13:00:00Z",
  "quota_exceeded": false,
  "last_check": "2024-01-01T12:30:00Z"
}
```

### Graceful Degradation

When quota is exceeded:
1. **Warning Phase**: User is warned of approaching limit
2. **Grace Period**: Short grace period for current operations
3. **Enforcement**: New operations are blocked or limited
4. **Reset**: Quota resets at the next hour

## Performance Considerations

### Efficient Data Collection

- **Minimal Overhead**: Tracking adds <1ms per operation
- **Background Processing**: All data processing happens in background threads
- **Batch Optimization**: Efficient batching reduces network overhead
- **Local Caching**: Reduces network requests and improves reliability

### Resource Usage

- **Memory**: Minimal memory footprint with configurable limits
- **Storage**: Efficient local storage with automatic cleanup
- **Network**: Batched transmission reduces network usage
- **CPU**: Background processing with minimal impact

### Scalability

- **Horizontal Scaling**: Designed for multiple server instances
- **Load Balancing**: Efficient handling of high-volume usage
- **Data Partitioning**: Automatic data organization for large datasets
- **Performance Monitoring**: Built-in performance tracking

## Troubleshooting

### Common Issues

#### Analytics Not Working
```
❌ Analytics Error: Usage tracking is disabled
```

**Solutions:**
1. Check `analytics.enabled` in configuration
2. Verify SaaS backend connectivity
3. Check license tier for analytics feature
4. Review privacy settings

#### Quota Exceeded
```
⚠️ Quota exceeded: 1000/1000 operations this hour
```

**Solutions:**
1. Wait for quota reset (next hour)
2. Upgrade to higher tier
3. Optimize operations to reduce usage
4. Check for unnecessary repeated operations

#### Data Not Syncing
```
❌ Backend Error: Failed to send usage data
```

**Solutions:**
1. Check SaaS backend connectivity
2. Verify API endpoint configuration
3. Check authentication credentials
4. Review network connectivity

### Debug Mode

Enable debug logging to see detailed analytics information:

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
# Check analytics status
get_usage_stats()

# Check quota status
get_quota_status()

# Test SaaS connection
test_saas_connection()

# Get usage summary
get_usage_summary(days=1)
```

## Business Intelligence

### Usage Analytics

The system provides comprehensive usage analytics:

- **Tool Popularity**: Most used tools and features
- **Usage Patterns**: Daily, weekly, monthly usage trends
- **Performance Metrics**: Response times and error rates
- **User Behavior**: Search patterns and file operations
- **Error Analysis**: Common errors and failure points

### Billing Integration

Usage data can be used for:

- **Usage-based Billing**: Charge based on actual usage
- **Tier Enforcement**: Enforce license tier limits
- **Upgrade Recommendations**: Suggest tier upgrades
- **Cost Optimization**: Identify cost-saving opportunities

### Business Insights

The analytics provide insights for:

- **Product Development**: Feature usage and user needs
- **Performance Optimization**: Identify bottlenecks
- **User Experience**: Improve user workflows
- **Business Growth**: Usage trends and growth patterns

## Example Implementation

### Basic Usage Tracking

```python
@mcp.tool()
@performance_monitor(monitor, 'my_tool')
@audit_log('my_tool', saas)
@track_usage(usage_tracker, 'my_tool')
def my_tool(file_path: str):
    """Tool with automatic usage tracking."""
    # Tool implementation
    return "Result"
```

### Advanced Usage Tracking

```python
@mcp.tool()
@performance_monitor(monitor, 'advanced_tool')
@audit_log('advanced_tool', saas)
@track_usage(usage_tracker, 'advanced_tool')
@require_tier('pro', license_manager)
def advanced_tool(query: str, search_type: str = 'text'):
    """Advanced tool with comprehensive tracking."""
    start_time = time.time()
    
    try:
        # Perform search
        results = perform_search(query, search_type)
        
        # Track search query
        usage_tracker.track_search_query(
            query=query,
            result_count=len(results),
            duration=time.time() - start_time,
            search_type=search_type
        )
        
        return f"Found {len(results)} results"
        
    except Exception as e:
        # Track error
        usage_tracker.track_error(
            tool_name='advanced_tool',
            error_type=type(e).__name__,
            error_message=str(e),
            duration=time.time() - start_time
        )
        raise
```

### Custom Analytics

```python
# Track custom metrics
usage_tracker.track_performance_metric(
    metric_name='custom_processing_time',
    value=processing_time,
    unit='seconds',
    context={'operation': 'data_processing'}
)

# Track custom events
usage_tracker.track_tool_usage(
    tool_name='custom_operation',
    duration=duration,
    success=success,
    custom_metric=value,
    operation_type='custom'
)
```

## Migration Guide

### From No Analytics

1. **Enable Analytics**:
   ```json
   {
     "analytics": {
       "enabled": true,
       "privacy_mode": "balanced"
     }
   }
   ```

2. **Add Tracking Decorators**:
   ```python
   @track_usage(usage_tracker, 'tool_name')
   def your_tool():
       # Your tool implementation
   ```

3. **Test Analytics**:
   ```python
   get_usage_stats()
   ```

### From Basic Analytics

1. **Update Configuration**:
   - Add privacy settings
   - Configure data types
   - Set retention policies

2. **Add Advanced Tracking**:
   - File operations
   - Search queries
   - Performance metrics

3. **Enable Quota Enforcement**:
   - Configure quota limits
   - Set enforcement policies
   - Test quota handling

## Support and Maintenance

### Monitoring

Monitor analytics system health using:
- Usage statistics reports
- Quota status monitoring
- Error rate tracking
- Performance metrics

### Maintenance

Regular maintenance tasks:
- Review analytics configuration
- Monitor data retention
- Check quota enforcement
- Update privacy settings

### Support

For analytics-related issues:
1. Check configuration settings
2. Review privacy and quota settings
3. Test SaaS backend connectivity
4. Use diagnostic tools
5. Check server logs

## Conclusion

The analytics and usage tracking system provides a comprehensive, privacy-compliant solution for SaaS billing and business intelligence. It offers:

- **Comprehensive Tracking**: Detailed usage and performance data
- **Privacy Compliance**: GDPR-compliant with user control
- **Production Ready**: Robust error handling and offline support
- **Business Intelligence**: Rich analytics for business insights
- **Quota Enforcement**: Real-time usage monitoring and limits
- **User-Friendly**: Clear reporting and diagnostic tools

The system is designed to scale with your business while respecting user privacy and providing valuable insights for product development and business growth.
