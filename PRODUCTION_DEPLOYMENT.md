# Production Deployment Guide

This guide covers deploying the optimized Cursor Context MCP Server in production environments.

## Quick Start

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure the server**:
   ```bash
   cp config/server_config.json config/production_config.json
   # Edit production_config.json with your settings
   ```

3. **Start the server**:
   ```bash
   python official_mcp_server.py
   ```

## Configuration

### Server Configuration (`config/server_config.json`)

```json
{
  "server": {
    "name": "Cursor Context MCP Server",
    "version": "2.0.0",
    "max_file_size": 1048576,
    "allowed_extensions": [],
    "blocked_extensions": [".exe", ".dll", ".so", ".dylib"],
    "max_directory_depth": 10,
    "enable_caching": true,
    "cache_ttl": 300
  }
}
```

### Security Configuration

```json
{
  "security": {
    "allowed_paths": ["/home/user/projects", "C:\\Users\\User\\Documents"],
    "blocked_paths": ["/etc", "/sys", "/proc", "C:\\Windows\\System32"],
    "enable_path_validation": true,
    "enable_audit_logging": true
  }
}
```

### Logging Configuration

```json
{
  "logging": {
    "level": "INFO",
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "file": "logs/mcp_server.log",
    "max_size": 10485760,
    "backup_count": 5
  }
}
```

## Production Features

### 1. Logging and Monitoring

- **Structured logging** with configurable levels
- **Log rotation** to prevent disk space issues
- **Performance monitoring** with operation metrics
- **Audit logging** for security compliance

### 2. Security Features

- **Path validation** to prevent unauthorized access
- **File extension filtering** for security
- **Size limits** to prevent resource exhaustion
- **Permission checking** for file operations

### 3. Performance Optimizations

- **Intelligent caching** with TTL support
- **Operation monitoring** and metrics
- **Memory-efficient** file operations
- **Concurrent operation** support (future)

### 4. SaaS Integration Hooks

- **Analytics tracking** for usage patterns
- **Telemetry collection** for performance insights
- **User session management** for multi-user environments
- **API integration** for external services

## Deployment Options

### Option 1: Direct Python Execution

```bash
# Development/Testing
python official_mcp_server.py

# Production with logging
python official_mcp_server.py > server.log 2>&1 &
```

### Option 2: Systemd Service (Linux)

Create `/etc/systemd/system/cursor-mcp.service`:

```ini
[Unit]
Description=Cursor Context MCP Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/cursor-mcp
ExecStart=/usr/bin/python3 /opt/cursor-mcp/official_mcp_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable cursor-mcp
sudo systemctl start cursor-mcp
```

### Option 3: Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN mkdir -p logs

EXPOSE 8000
CMD ["python", "official_mcp_server.py"]
```

Build and run:
```bash
docker build -t cursor-mcp .
docker run -d -p 8000:8000 --name cursor-mcp cursor-mcp
```

## Monitoring and Maintenance

### Health Checks

Use the `get_server_stats()` tool to monitor:
- Operation counts and performance
- Error rates
- Cache hit rates
- Memory usage

### Log Management

- Logs are automatically rotated when they reach 10MB
- Keep 5 backup files by default
- Monitor log files for errors and performance issues

### Performance Tuning

1. **Adjust cache TTL** based on usage patterns
2. **Configure file size limits** for your use case
3. **Set appropriate directory depth limits**
4. **Monitor and adjust security policies**

## Security Considerations

### File System Access

- Configure `allowed_paths` to restrict access
- Use `blocked_paths` to prevent system access
- Enable `enable_path_validation` for security

### File Type Restrictions

- Use `blocked_extensions` to prevent dangerous file types
- Configure `allowed_extensions` for specific use cases
- Monitor file access patterns

### Audit Logging

- Enable `enable_audit_logging` for compliance
- Monitor audit logs for suspicious activity
- Implement log retention policies

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Check file system permissions
   - Verify user has access to target directories
   - Review security configuration

2. **Configuration Errors**
   - Validate JSON syntax in config files
   - Check file paths in configuration
   - Verify all required settings are present

3. **Performance Issues**
   - Monitor cache hit rates
   - Check file size limits
   - Review operation timeouts

### Debug Mode

Enable debug logging:
```json
{
  "logging": {
    "level": "DEBUG"
  }
}
```

## Scaling Considerations

### Horizontal Scaling

- Deploy multiple server instances
- Use load balancer for distribution
- Implement shared caching (Redis)

### Vertical Scaling

- Increase memory for larger caches
- Optimize file size limits
- Adjust concurrent operation limits

## Future Enhancements

### Planned Features

1. **Async Operations** - Non-blocking file operations
2. **Distributed Caching** - Redis/Memcached integration
3. **API Gateway** - REST API for external access
4. **User Management** - Multi-user authentication
5. **Plugin System** - Extensible tool architecture

### SaaS Platform Integration

- User analytics and insights
- Team collaboration features
- Enterprise security policies
- Custom tool development
- API rate limiting and quotas

---

For support and questions, please refer to the main README.md or create an issue in the project repository.
