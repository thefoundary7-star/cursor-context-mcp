# Enhanced MCP Server API Documentation

## Overview

The Enhanced MCP Server v2.0.0 provides a comprehensive set of tools for code analysis, git integration, security auditing, performance monitoring, and file management. This document covers all available MCP tools and their usage.

## Base URL
```
https://yourdomain.com/api
```

## Enhanced Features Overview

### 🚀 New in v2.0.0
- **Code Indexing System**: Automatic symbol discovery and reference tracking
- **Real-time File Monitoring**: Auto-reindexing when files are modified  
- **Advanced Git Integration**: Comprehensive git tools for repository analysis
- **Security Auditing**: Automated security scanning and vulnerability detection
- **Performance Monitoring**: Detailed performance metrics and optimization tools
- **Intelligent Caching**: Optimized caching for improved performance

## Authentication

### JWT Authentication
Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### API Key Authentication
Include the API key in the X-API-Key header:
```
X-API-Key: <your-api-key>
```

## Response Format

All API responses follow this format:

```json
{
  "success": true|false,
  "data": <response-data>,
  "message": "Success message",
  "error": "Error message (if success is false)",
  "errors": {
    "field": ["validation error messages"]
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Enhanced MCP Tools

### Code Analysis Tools

#### search_symbols
Search for code symbols (functions, classes, variables) across the codebase.

**Parameters:**
- `query` (str): Search query
- `directory` (str): Directory to search (default: ".")
- `symbol_type` (str, optional): Filter by symbol type ("function", "class", "variable", "import")
- `auto_index` (bool): Automatically index files if needed (default: True)
- `fuzzy` (bool): Enable fuzzy matching (default: False)
- `file_extensions` (list, optional): File extensions to include

**Returns:**
```json
{
  "success": true,
  "symbols": [
    {
      "name": "create_user",
      "type": "function",
      "file_path": "/path/to/user.py",
      "line_number": 15,
      "definition": "def create_user(name: str) -> User:",
      "docstring": "Create a new user with the given name."
    }
  ],
  "total_found": 1,
  "search_time": 0.05
}
```

#### find_references
Find all references to a specific symbol across the codebase.

**Parameters:**
- `symbol_name` (str): Name of the symbol to find references for
- `directory` (str): Directory to search (default: ".")
- `file_extensions` (list, optional): File extensions to include
- `context_lines` (int): Number of context lines to include (default: 2)

**Returns:**
```json
{
  "success": true,
  "symbol_name": "create_user",
  "references": [
    {
      "symbol_name": "create_user",
      "file_path": "/path/to/main.py",
      "line_number": 25,
      "context": "user = create_user('John')",
      "ref_type": "call"
    }
  ],
  "total_found": 1
}
```

### Git Integration Tools

#### get_git_diff
Get git diff for specific files or entire repository.

**Parameters:**
- `directory` (str): Directory path (default: ".")
- `file_path` (str, optional): Specific file to diff
- `staged` (bool): Show staged changes (default: False)
- `unstaged` (bool): Show unstaged changes (default: True)

**Returns:**
```json
{
  "success": true,
  "diff": "diff --git a/file.py b/file.py\n+new line",
  "files_changed": 1
}
```

#### get_commit_history
Get recent commit history with filtering options.

**Parameters:**
- `directory` (str): Directory path (default: ".")
- `limit` (int): Number of commits to return (default: 10)
- `file_path` (str, optional): Filter commits by file
- `author` (str, optional): Filter commits by author
- `since` (str, optional): Filter commits since date
- `until` (str, optional): Filter commits until date

**Returns:**
```json
{
  "success": true,
  "commits": [
    {
      "hash": "abc123",
      "author": "John Doe",
      "date": "2024-01-01T12:00:00Z",
      "message": "Add user management feature",
      "files_changed": 3
    }
  ],
  "total_commits": 1
}
```

### Security Tools

#### security_audit
Perform comprehensive security audit on a file.

**Parameters:**
- `file_path` (str): Path to the file to audit

**Returns:**
```json
{
  "success": true,
  "issues": [
    {
      "type": "hardcoded_password",
      "line": 15,
      "description": "Hardcoded password found",
      "severity": "high",
      "suggestion": "Use environment variables or secure configuration"
    }
  ],
  "total_issues": 1,
  "security_score": 7.5
}
```

#### get_security_summary
Get security audit summary and statistics.

**Returns:**
```json
{
  "success": true,
  "summary": {
    "total_audits": 25,
    "issues_found": 3,
    "high_severity": 1,
    "medium_severity": 2,
    "low_severity": 0,
    "read_only_mode": false,
    "last_audit": "2024-01-01T12:00:00Z"
  }
}
```

### Performance Monitoring Tools

#### performance_stats
Get comprehensive performance statistics for all MCP operations.

**Returns:**
```json
{
  "success": true,
  "statistics": {
    "operation_times": {
      "search_symbols": 0.05,
      "find_references": 0.12,
      "get_git_status": 0.03
    },
    "operation_counts": {
      "search_symbols": 25,
      "find_references": 10,
      "get_git_status": 5
    },
    "average_times": {
      "search_symbols": 0.05,
      "find_references": 0.12
    },
    "memory_usage": 1048576,
    "uptime": 3600
  }
}
```

#### cache_stats
Get cache statistics and performance metrics.

**Returns:**
```json
{
  "success": true,
  "cache_stats": {
    "file_cache": {
      "hits": 150,
      "misses": 25,
      "hit_rate": 0.857,
      "size": 1048576
    },
    "symbol_cache": {
      "hits": 300,
      "misses": 50,
      "hit_rate": 0.857,
      "size": 2097152
    }
  }
}
```

### File Monitoring Tools

#### start_file_monitoring
Start real-time file monitoring for automatic code indexing.

**Returns:**
```json
{
  "success": true,
  "monitoring_active": true,
  "watched_directories": ["/path/to/project"],
  "message": "File monitoring started"
}
```

#### get_recent_changes
Get list of recently modified files with change tracking information.

**Parameters:**
- `hours` (int): Number of hours to look back (default: 24)

**Returns:**
```json
{
  "success": true,
  "changes": [
    {
      "file_path": "/path/to/file.py",
      "change_type": "modified",
      "timestamp": 1704110400,
      "formatted_time": "2024-01-01 12:00:00",
      "file_size": 1024
    }
  ],
  "total_changes": 1
}
```

---

## Authentication Endpoints

### POST /api/auth/login

Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER"
    },
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
  },
  "message": "Login successful"
}
```

### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token"
  },
  "message": "Token refreshed successfully"
}
```

### POST /api/auth/validate-license

Validate license key for MCP server.

**Request Body:**
```json
{
  "licenseKey": "MCP-abc123-def456",
  "serverId": "server-001",
  "serverName": "Production Server",
  "serverVersion": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "license": {
      "id": "license-id",
      "licenseKey": "MCP-abc123-def456",
      "name": "Production License",
      "plan": "PRO",
      "maxServers": 20,
      "isActive": true
    },
    "server": {
      "id": "server-id",
      "serverId": "server-001",
      "name": "Production Server",
      "version": "1.0.0"
    }
  },
  "message": "License validated successfully"
}
```

### POST /api/auth/create-license

Create a new license key.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New License",
  "description": "License for new server",
  "plan": "PRO",
  "maxServers": 10,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "license-id",
    "licenseKey": "MCP-xyz789-abc123",
    "name": "New License",
    "plan": "PRO",
    "maxServers": 10,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "License created successfully"
}
```

---

## Analytics Endpoints

### POST /api/analytics/track

Track analytics events from MCP server.

**Headers:** `X-API-Key: <api-key>`

**Request Body:**
```json
{
  "licenseKey": "MCP-abc123-def456",
  "serverId": "server-001",
  "events": [
    {
      "eventType": "REQUEST_COUNT",
      "eventData": {
        "count": 1,
        "endpoint": "/api/chat"
      },
      "metadata": {
        "userAgent": "MCP-Client/1.0",
        "responseTime": 150
      },
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "processed": 1
  },
  "message": "Successfully tracked 1 events"
}
```

### GET /api/analytics

Get analytics data with filtering and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `licenseId` (optional) - Filter by license ID
- `serverId` (optional) - Filter by server ID
- `eventType` (optional) - Filter by event type
- `startDate` (optional) - Start date (ISO string)
- `endDate` (optional) - End date (ISO string)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "analytics-id",
      "eventType": "REQUEST_COUNT",
      "eventData": {
        "count": 1,
        "endpoint": "/api/chat"
      },
      "metadata": {
        "userAgent": "MCP-Client/1.0"
      },
      "timestamp": "2024-01-01T12:00:00Z",
      "license": {
        "id": "license-id",
        "name": "Production License",
        "plan": "PRO"
      },
      "server": {
        "id": "server-id",
        "serverId": "server-001",
        "name": "Production Server"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "message": "Analytics retrieved successfully"
}
```

### GET /api/analytics/summary

Get analytics summary with aggregated data.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `licenseId` (optional) - Filter by license ID
- `serverId` (optional) - Filter by server ID
- `startDate` (optional) - Start date (ISO string)
- `endDate` (optional) - End date (ISO string)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 1000,
    "eventsByType": {
      "REQUEST_COUNT": 800,
      "ERROR_COUNT": 50,
      "HEARTBEAT": 150
    },
    "eventsByDay": {
      "2024-01-01": 100,
      "2024-01-02": 120,
      "2024-01-03": 90
    },
    "topServers": [
      {
        "serverId": "server-001",
        "count": 500
      },
      {
        "serverId": "server-002",
        "count": 300
      }
    ]
  },
  "message": "Analytics summary retrieved successfully"
}
```

### GET /api/analytics/realtime/:licenseId

Get real-time metrics for a specific license.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "activeServers": 5,
    "requestsLastHour": 100,
    "errorsLastHour": 2,
    "averageResponseTime": 150
  },
  "message": "Real-time metrics retrieved successfully"
}
```

---

## User Management Endpoints

### GET /api/user/profile

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Example Corp",
    "role": "USER",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "Profile retrieved successfully"
}
```

### PUT /api/user/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "company": "Updated Corp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Updated Corp",
    "role": "USER",
    "isActive": true,
    "updatedAt": "2024-01-01T12:00:00Z"
  },
  "message": "Profile updated successfully"
}
```

### GET /api/user/licenses

Get user's licenses with pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "license-id",
      "licenseKey": "MCP-abc123-def456",
      "name": "Production License",
      "description": "License for production server",
      "plan": "PRO",
      "maxServers": 20,
      "isActive": true,
      "expiresAt": "2024-12-31T23:59:59Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "servers": [
        {
          "id": "server-id",
          "serverId": "server-001",
          "name": "Production Server",
          "version": "1.0.0",
          "lastSeen": "2024-01-01T12:00:00Z"
        }
      ],
      "_count": {
        "servers": 1,
        "analytics": 1000
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  },
  "message": "Licenses retrieved successfully"
}
```

### GET /api/user/subscription

Get user's subscription details.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "subscription-id",
    "plan": "PRO",
    "status": "ACTIVE",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "stripeSubscription": {
      "id": "sub_stripe_id",
      "status": "active",
      "current_period_start": 1704067200,
      "current_period_end": 1706745600
    }
  },
  "message": "Subscription retrieved successfully"
}
```

### POST /api/user/subscription

Create a new subscription.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "plan": "PRO",
  "paymentMethodId": "pm_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "subscription-id",
      "plan": "PRO",
      "status": "INCOMPLETE",
      "stripeCustomerId": "cus_stripe_id",
      "stripeSubscriptionId": "sub_stripe_id"
    },
    "clientSecret": "pi_client_secret"
  },
  "message": "Subscription created successfully"
}
```

### GET /api/user/dashboard

Get user dashboard data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "licenses": [
      {
        "id": "license-id",
        "name": "Production License",
        "plan": "PRO",
        "maxServers": 20,
        "isActive": true
      }
    ],
    "subscription": {
      "plan": "PRO",
      "status": "ACTIVE",
      "currentPeriodEnd": "2024-02-01T00:00:00Z"
    },
    "analytics": {
      "totalEvents": 1000,
      "eventsByType": {
        "REQUEST_COUNT": 800,
        "ERROR_COUNT": 50
      }
    },
    "totalLicenses": 5
  },
  "message": "Dashboard data retrieved successfully"
}
```

---

## Webhook Endpoints

### POST /api/webhooks/stripe

Handle Stripe webhook events.

**Headers:**
```
Stripe-Signature: <stripe-signature>
Content-Type: application/json
```

**Request Body:** Raw Stripe webhook payload

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

### POST /api/webhooks/test

Test webhook endpoint for development.

**Request Body:**
```json
{
  "eventType": "customer.subscription.updated",
  "data": {
    "id": "sub_test_id",
    "status": "active"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test webhook processed successfully"
}
```

---

## Health Check Endpoints

### GET /api/health

Basic health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "uptime": 3600,
    "services": {
      "database": "connected",
      "redis": "connected",
      "stripe": "connected"
    },
    "version": "1.0.0",
    "responseTime": "50ms"
  },
  "message": "All services are healthy"
}
```

### GET /api/health/ready

Readiness check for Kubernetes.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "timestamp": "2024-01-01T12:00:00Z"
  },
  "message": "Service is ready to accept requests"
}
```

### GET /api/health/live

Liveness check for Kubernetes.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "alive",
    "timestamp": "2024-01-01T12:00:00Z",
    "uptime": 3600,
    "memory": {
      "rss": 50000000,
      "heapTotal": 30000000,
      "heapUsed": 20000000
    },
    "pid": 12345
  },
  "message": "Service is alive"
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit information is included in response headers
- **Exceeded**: Returns 429 status code with retry information

## Event Types

Available analytics event types:

- `SERVER_START` - Server started
- `SERVER_STOP` - Server stopped
- `REQUEST_COUNT` - API request made
- `ERROR_COUNT` - Error occurred
- `FEATURE_USAGE` - Feature used
- `QUOTA_EXCEEDED` - Quota limit exceeded
- `LICENSE_VALIDATION` - License validated
- `HEARTBEAT` - Server heartbeat

## License Plans

Available license plans:

- `FREE` - Free tier with limited features
- `BASIC` - Basic tier with standard features
- `PRO` - Professional tier with advanced features
- `ENTERPRISE` - Enterprise tier with unlimited features

## Subscription Status

Possible subscription statuses:

- `ACTIVE` - Subscription is active
- `CANCELED` - Subscription is canceled
- `INCOMPLETE` - Payment incomplete
- `INCOMPLETE_EXPIRED` - Payment incomplete and expired
- `PAST_DUE` - Payment past due
- `TRIALING` - In trial period
- `UNPAID` - Payment failed
