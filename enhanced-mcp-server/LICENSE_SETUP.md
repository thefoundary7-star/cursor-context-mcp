# FileBridge Enhanced MCP Server - License Protection System

## 🛡️ Complete License Protection Implementation

This document outlines the bulletproof license protection system for FileBridge Enhanced MCP Server, designed to protect revenue while providing an excellent user experience.

## 🏗️ Architecture Overview

### 1. License Validation API Server (`src/licensing/api-server.ts`)
- **Express server** on port 3001
- **PostgreSQL database** for license storage
- **Dodo Payments integration** for billing webhooks
- **Rate limiting** and security measures
- **RESTful API** for license validation

### 2. License Manager (`src/licensing/license-manager.ts`)
- **Client-side protection** built into MCP server
- **Feature gating** for FREE vs PRO vs ENTERPRISE
- **Usage tracking** with daily limits (50 calls FREE)
- **Offline support** with validation caching
- **Graceful degradation** when API is unavailable

### 3. Security Manager (`src/licensing/security-manager.ts`)
- **License key encryption** and validation
- **Machine fingerprinting** for anti-sharing
- **Request signing** to prevent API abuse
- **Tamper detection** and integrity checks

## 🚀 Quick Setup Guide

### 1. Database Setup

```bash
# Install PostgreSQL
# Create database
createdb filebridge_licenses

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=filebridge_licenses
export DB_USER=postgres
export DB_PASSWORD=your_password
```

### 2. Start License API Server

```bash
# Build the project
npm run build

# Start license server
node dist/licensing/index.js --port 3001 --init-db
```

### 3. Configure Environment Variables

```bash
# License validation
export LICENSE_API_URL=http://localhost:3001/api/validate-license

# Dodo Payments integration
export DODO_API_KEY=your_dodo_api_key
export DODO_API_SECRET=your_dodo_api_secret
export DODO_WEBHOOK_SECRET=your_webhook_secret

# Security
export JWT_SECRET=your_jwt_secret
export ENCRYPTION_KEY=your_encryption_key
export WEBHOOK_SECRET=your_webhook_secret
```

### 4. Start Enhanced MCP Server

```bash
# Start with license support
enhanced-mcp-server

# Or activate license during startup
enhanced-mcp-server --license YOUR_LICENSE_KEY

# Interactive license setup
enhanced-mcp-server --setup-license
```

## 🎯 Feature Tiers

### FREE Tier (Default)
- ✅ **4 basic features**: `list_files`, `read_file`, `search_files`, `get_file_stats`
- ✅ **50 API calls per day**
- ✅ **1 machine limit**
- ✅ **No license required** - works automatically

### PRO Tier ($29/month)
- ✅ **26+ advanced features** including:
  - File writing and editing
  - Code navigation and symbol search
  - Test framework integration
  - Git operations and analysis
  - Performance monitoring
  - Security scanning
- ✅ **Unlimited API calls**
- ✅ **3 machine limit**
- ✅ **Priority support**

### ENTERPRISE Tier ($99/month)
- ✅ **All PRO features plus**:
  - Team collaboration features
  - Audit logging
  - Custom integrations
- ✅ **10 machine limit**
- ✅ **Dedicated support**

## 🔐 License Key Format

```
PRO-1A2B3C4D-12345678-ABCDEFGHIJKLMNOP-A1B2
│   │        │        │                │
│   │        │        │                └─ Checksum (4 chars)
│   │        │        └─ Random component (16 chars)
│   │        └─ User hash (8 chars)
│   └─ Timestamp (8 chars)
└─ Tier prefix (3 chars)
```

## 🛡️ Security Features

### Anti-Piracy Protection
- ✅ **Machine fingerprinting** prevents license sharing
- ✅ **Request signing** prevents API abuse
- ✅ **License key validation** with checksums
- ✅ **Encrypted storage** for sensitive data
- ✅ **Rate limiting** on validation endpoints

### Offline Protection
- ✅ **24-hour validation cache** for offline usage
- ✅ **Graceful degradation** when API is unreachable
- ✅ **Tamper-evident storage** prevents manipulation
- ✅ **Automatic re-validation** every 24 hours

## 📊 Usage Tracking

### Daily Limits
```typescript
FREE: 50 calls/day → Reset at midnight
PRO: Unlimited calls
ENTERPRISE: Unlimited calls
```

### Machine Limits
```typescript
FREE: 1 machine per license
PRO: 3 machines per license
ENTERPRISE: 10 machines per license
```

### Grace Periods
```typescript
Subscription cancelled → 7-day grace period
Payment failed → 7-day grace period
License expired → Automatic downgrade to FREE
```

## 🔄 Dodo Payments Integration

### Webhook Events
```typescript
subscription.created → Auto-generate license
subscription.updated → Update license tier
subscription.cancelled → Start grace period
subscription.renewed → Extend license
payment.failed → Grace period warning
```

### Subscription Flow
1. **User subscribes** via Dodo Payments checkout
2. **Webhook received** → License auto-generated
3. **Email sent** with license key
4. **User activates** license in MCP server
5. **Features unlocked** immediately

## 💻 User Experience

### First-Time Setup
```bash
# Automatic FREE tier - no setup required
enhanced-mcp-server

# Show current status
enhanced-mcp-server --setup-license

# Activate PRO license
enhanced-mcp-server --license PRO-1A2B3C4D-12345678-ABCDEFGHIJKLMNOP-A1B2

# Environment variable
export FILEBRIDGE_LICENSE=PRO-1A2B3C4D-12345678-ABCDEFGHIJKLMNOP-A1B2
enhanced-mcp-server
```

### Runtime Experience
```bash
📄 License Manager initialized - Tier: PRO
🎯 Available features: 26
🔑 License key: PRO-1A2B...A1B2
📊 Daily usage: 15/∞

# Feature blocked for FREE users
🔒 Premium Feature Locked
Feature 'write_file' requires PRO tier.
Current tier: FREE

💎 Upgrade Benefits:
  ✨ 26+ advanced features
  🚀 Unlimited API calls
  💰 Only $29/month

🎯 Get your license at: https://filebridge.dev/pricing
```

## 🧪 Testing the System

### Manual Testing
```bash
# Test FREE tier limits
for i in {1..55}; do
  curl -X POST http://localhost:8000/tools/list_files
done
# Should block after 50 calls

# Test license activation
enhanced-mcp-server --license PRO-1A2B3C4D-12345678-ABCDEFGHIJKLMNOP-A1B2

# Test feature access
curl -X POST http://localhost:8000/tools/write_file
# Should work with valid PRO license
```

### Database Verification
```sql
-- Check license records
SELECT * FROM license_keys WHERE license_key LIKE 'PRO-%';

-- Check usage tracking
SELECT * FROM license_usage WHERE date = CURRENT_DATE;

-- Check machine registration
SELECT * FROM license_machines WHERE is_active = true;
```

## 🔧 API Endpoints

### License Validation
```http
POST /api/validate-license
Content-Type: application/json

{
  "licenseKey": "PRO-1A2B3C4D-12345678-ABCDEFGHIJKLMNOP-A1B2",
  "machineId": "machine123",
  "features": ["write_file", "search_symbols"]
}
```

### License Generation (Internal)
```http
POST /api/generate-license
Content-Type: application/json

{
  "userId": "user-uuid",
  "tier": "PRO",
  "subscriptionId": "sub_123",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

## 📈 Monitoring & Analytics

### Key Metrics
- **License activation rate**
- **Feature usage by tier**
- **Daily API call limits**
- **Machine sharing violations**
- **Subscription conversion rate**

### Logging
```bash
[LICENSE] Tier: PRO | Features: 26 | Usage: 150/∞
[SECURITY] Machine limit exceeded for license PRO-...
[BILLING] Subscription cancelled, grace period: 7 days
[FEATURE] write_file blocked for FREE user
```

## 🚨 Revenue Protection

### Critical Success Criteria
- ✅ **FREE users get 4 features + 50 calls/day automatically**
- ✅ **PRO users with valid licenses get all 26+ features unlimited**
- ✅ **Expired/invalid licenses automatically downgrade to FREE**
- ✅ **System works offline with 24h cached validation**
- ✅ **License sharing prevented (max 3 machines per license)**
- ✅ **Zero revenue leakage - all premium features protected**

### Fail-Safe Design
- **Network failures** → Use cached validation
- **API server down** → Graceful degradation to cached state
- **Invalid license** → Automatic downgrade to FREE
- **Subscription expired** → 7-day grace period, then FREE
- **Machine limit exceeded** → Clear error message + upgrade prompt

## 🔄 Deployment Checklist

### Production Environment
- [ ] PostgreSQL database configured
- [ ] License API server deployed
- [ ] Environment variables set
- [ ] Dodo Payments webhooks configured
- [ ] SSL certificates installed
- [ ] Monitoring and logging enabled
- [ ] Backup and recovery tested

### Security Verification
- [ ] License key encryption working
- [ ] Machine fingerprinting active
- [ ] Rate limiting configured
- [ ] Webhook signature validation
- [ ] Request signing implemented
- [ ] Anti-tampering measures active

---

## 🎉 Result: Bulletproof License Protection

This implementation provides **enterprise-grade license protection** with:

- **🛡️ Zero Revenue Leakage** - All premium features protected
- **😊 Excellent UX** - FREE tier works automatically, easy upgrade flow
- **🔒 Anti-Piracy** - Machine limits and fingerprinting prevent sharing
- **📱 Offline Support** - 24h cached validation for reliability
- **⚡ Performance** - Fast validation with intelligent caching
- **🔄 Billing Integration** - Seamless Dodo Payments integration
- **📊 Usage Tracking** - Detailed analytics and monitoring

**Ready for NPM publication with confidence! 🚀**