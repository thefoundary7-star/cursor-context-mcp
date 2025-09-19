#!/bin/bash

# MCP SaaS Backend API Test Commands
# Run these commands to test the API endpoints

BASE_URL="http://localhost:3001"
API_KEY="mcp_test_api_key_here"
LICENSE_KEY="MCP-TEST-LICENSE-KEY"
AUTH_TOKEN="mock-jwt-token-for-testing"

echo "Testing MCP SaaS Backend API..."
echo "Base URL: $BASE_URL"
echo ""

# 1. Health Check
echo "1. Testing Health Check..."
curl -X GET "$BASE_URL/api/health" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# 2. License Validation
echo "2. Testing License Validation..."
curl -X POST "$BASE_URL/api/auth/validate-license" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "'$LICENSE_KEY'",
    "serverId": "test-server-001",
    "serverName": "Test MCP Server",
    "serverVersion": "1.0.0"
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# 3. Analytics Tracking
echo "3. Testing Analytics Tracking..."
curl -X POST "$BASE_URL/api/analytics/track" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "licenseKey": "'$LICENSE_KEY'",
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
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# 4. User Login
echo "4. Testing User Login..."
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# 5. Get User Profile (requires authentication)
echo "5. Testing User Profile (requires auth token)..."
curl -X GET "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# 6. Get User Licenses
echo "6. Testing User Licenses..."
curl -X GET "$BASE_URL/api/user/licenses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# 7. Test CORS
echo "7. Testing CORS..."
curl -X GET "$BASE_URL/api/health" \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -v \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "API testing completed!"
