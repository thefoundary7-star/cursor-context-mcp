# MCP Server Integration Testing Guide

This guide provides comprehensive testing instructions for verifying that your Node.js SaaS backend is ready for MCP server integration.

## Prerequisites

Before running the tests, ensure you have:

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database running
3. **npm** or **yarn** package manager
4. **curl** (for manual API testing)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Test Environment

```bash
node setup-test-environment.js
```

This script will:
- Create environment configuration files
- Set up the database with Prisma
- Create test data (users, licenses, API keys)
- Generate test scripts and cURL commands

### 3. Create Test Data

```bash
node create-test-data.js
```

This creates:
- Test user account (`test@example.com` / `testpassword123`)
- Test license key
- Test API key
- Test server record

### 4. Run Integration Tests

```bash
node test-mcp-integration.js
```

### 5. Start the Backend Server

```bash
npm run dev
# or
node src/server.ts
```

## Test Scripts Overview

### 1. `setup-test-environment.js`
Sets up the complete test environment including:
- Environment variables
- Database setup
- Test data creation scripts
- cURL test commands

### 2. `test-mcp-integration.js`
Comprehensive integration test suite that verifies:
- Server health and connectivity
- CORS configuration
- User authentication
- License validation
- Analytics tracking
- User profile management
- Rate limiting
- Error handling
- Security headers
- Complete MCP workflow

### 3. `test-backend.js`
Basic backend functionality tests for quick verification.

### 4. `test-api.sh`
cURL commands for manual API testing.

## Required Endpoints for MCP Integration

### 1. Health Check
```bash
GET /api/health
```
**Purpose**: Verify server is running and healthy
**Response**: Server status, database connection, service health

### 2. License Validation
```bash
POST /api/auth/validate-license
```
**Purpose**: Validate MCP server license
**Body**:
```json
{
  "licenseKey": "MCP-YOUR-LICENSE-KEY",
  "serverId": "unique-server-id",
  "serverName": "Your MCP Server",
  "serverVersion": "1.0.0"
}
```

### 3. Analytics Tracking
```bash
POST /api/analytics/track
```
**Purpose**: Track MCP server usage and events
**Headers**: `X-API-Key: your-api-key`
**Body**:
```json
{
  "licenseKey": "MCP-YOUR-LICENSE-KEY",
  "serverId": "unique-server-id",
  "events": [
    {
      "eventType": "SERVER_START",
      "eventData": {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "serverVersion": "1.0.0"
      }
    }
  ]
}
```

### 4. User Authentication
```bash
POST /api/auth/login
```
**Purpose**: Authenticate users for dashboard access
**Body**:
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

### 5. User Profile
```bash
GET /api/user/profile
```
**Purpose**: Get user profile information
**Headers**: `Authorization: Bearer jwt-token`

## Manual Testing with cURL

### 1. Health Check
```bash
curl -X GET "http://localhost:3001/api/health" \
  -H "Content-Type: application/json"
```

### 2. License Validation
```bash
curl -X POST "http://localhost:3001/api/auth/validate-license" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "MCP-YOUR-LICENSE-KEY",
    "serverId": "test-server-001",
    "serverName": "Test MCP Server",
    "serverVersion": "1.0.0"
  }'
```

### 3. Analytics Tracking
```bash
curl -X POST "http://localhost:3001/api/analytics/track" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "licenseKey": "MCP-YOUR-LICENSE-KEY",
    "serverId": "test-server-001",
    "events": [
      {
        "eventType": "SERVER_START",
        "eventData": {
          "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
          "serverVersion": "1.0.0"
        }
      }
    ]
  }'
```

### 4. User Login
```bash
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

### 5. Get User Profile (requires auth token)
```bash
curl -X GET "http://localhost:3001/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Environment Configuration

### Required Environment Variables

Create a `.env.local` file with:

```env
# Application
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/mcp_saas

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your_encryption_key_here_minimum_32_characters_long

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# API Configuration
API_RATE_LIMIT=1000
API_RATE_WINDOW=900000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your_session_secret_here_minimum_32_characters_long
```

## Database Setup

### 1. Install Prisma
```bash
npm install prisma @prisma/client
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Run Migrations
```bash
npx prisma migrate dev --name init
```

### 4. Seed Database
```bash
npx prisma db seed
```

## CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:3000` (frontend)
- `http://localhost:3001` (backend)
- Your production domain

To add more origins, update the `CORS_ORIGIN` environment variable.

## Rate Limiting

Default rate limits:
- **1000 requests per 15 minutes** per IP
- Health check endpoints are exempt
- Admin users are exempt

## Security Features

The backend includes:
- **Helmet.js** for security headers
- **CORS** protection
- **Rate limiting**
- **JWT authentication**
- **API key authentication**
- **Input validation**
- **SQL injection protection**
- **XSS protection**

## Test Results

After running the tests, you'll get:

1. **Console output** with pass/fail status
2. **JSON report** (`mcp-integration-test-report.json`)
3. **Test credentials** for MCP server configuration

### Expected Test Results

For successful MCP integration, you should see:
- ✅ All health checks passing
- ✅ Database connection established
- ✅ CORS properly configured
- ✅ Authentication working
- ✅ License validation working
- ✅ Analytics tracking working
- ✅ Rate limiting configured
- ✅ Error handling working
- ✅ Security headers present

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in .env.local
   - Run `npx prisma migrate dev`

2. **CORS Errors**
   - Update CORS_ORIGIN in .env.local
   - Restart the server

3. **Authentication Failures**
   - Check JWT_SECRET is set
   - Verify test data was created
   - Check user credentials

4. **Rate Limiting Issues**
   - Adjust API_RATE_LIMIT in .env.local
   - Check if you're hitting rate limits

5. **Port Already in Use**
   - Change PORT in .env.local
   - Kill existing processes on port 3001

### Debug Mode

Enable debug logging:
```env
DEBUG=true
LOG_LEVEL=debug
```

## MCP Server Configuration

Once testing is complete, configure your MCP server with:

1. **API Base URL**: `http://localhost:3001` (or your production URL)
2. **License Key**: From test data creation
3. **API Key**: From test data creation
4. **Server ID**: Unique identifier for your MCP server

### Example MCP Server Configuration

```json
{
  "apiBaseUrl": "http://localhost:3001",
  "licenseKey": "MCP-YOUR-LICENSE-KEY",
  "apiKey": "mcp_your_api_key_here",
  "serverId": "your-unique-server-id",
  "serverName": "Your MCP Server",
  "serverVersion": "1.0.0"
}
```

## Production Deployment

For production deployment:

1. **Update environment variables** for production
2. **Set up SSL certificates**
3. **Configure production database**
4. **Set up monitoring and logging**
5. **Configure backup systems**
6. **Set up CI/CD pipeline**

## Support

If you encounter issues:

1. Check the test reports for specific failures
2. Review the logs in `./logs/`
3. Verify all environment variables are set
4. Ensure database is properly configured
5. Check network connectivity and firewall settings

## Next Steps

After successful testing:

1. **Deploy to staging environment**
2. **Test with actual MCP server**
3. **Monitor performance and usage**
4. **Set up production monitoring**
5. **Configure backup and recovery**
6. **Document API usage for your team**
