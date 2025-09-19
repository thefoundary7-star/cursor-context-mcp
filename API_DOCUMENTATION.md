# API Documentation

## Base URL
```
https://yourdomain.com/api
```

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
