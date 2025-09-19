# User Authentication System Documentation

## Overview

The Cursor Context MCP Server now includes a comprehensive user authentication system that integrates with your Node.js SaaS backend. This system provides secure, user-friendly authentication with enterprise-ready features including JWT token management, secure credential storage, session management, and future-ready SSO support.

## Features

### 🔐 Multiple Authentication Methods
- **Email/Password**: Traditional email and password authentication
- **API Key**: API key-based authentication for service accounts
- **Enterprise SSO**: Future-ready Single Sign-On support (OAuth2, SAML)

### 🛡️ Secure Token Management
- **JWT Tokens**: Industry-standard JSON Web Token authentication
- **Automatic Refresh**: Seamless token refresh before expiration
- **Secure Storage**: OS keyring integration with encryption fallback
- **Token Validation**: Real-time token validation with backend

### 🔒 Enterprise Security
- **OS Keyring Integration**: Secure credential storage using system keyring
- **Token Encryption**: AES encryption for stored tokens
- **Password Policies**: Configurable password complexity requirements
- **Device Registration**: Track and manage authenticated devices
- **Session Management**: Concurrent session limits and timeout handling

### 👤 User Experience
- **Auto-Login**: Seamless authentication on startup
- **User-Friendly Prompts**: Clear console prompts for credentials
- **Graceful Error Handling**: Helpful error messages and troubleshooting
- **Session Persistence**: Remember authentication across restarts

## Configuration

### Basic Authentication Configuration

Add the following to your `config/server_config.json`:

```json
{
  "authentication": {
    "enabled": true,
    "method": "email_password",
    "auto_login": true,
    "remember_credentials": true,
    "session_timeout": 3600,
    "token_refresh_threshold": 300,
    "max_concurrent_sessions": 3,
    "device_registration": {
      "enabled": true,
      "auto_register": true,
      "require_approval": false
    },
    "sso": {
      "enabled": false,
      "provider": "none",
      "endpoint": "",
      "client_id": "",
      "redirect_uri": ""
    },
    "security": {
      "use_keyring": true,
      "encrypt_tokens": true,
      "require_2fa": false,
      "password_policy": {
        "min_length": 8,
        "require_uppercase": true,
        "require_lowercase": true,
        "require_numbers": true,
        "require_symbols": false
      }
    }
  }
}
```

### Configuration Options

#### Core Authentication Settings
- `enabled`: Enable/disable authentication system
- `method`: Authentication method ("email_password", "api_key")
- `auto_login`: Attempt automatic login on startup
- `remember_credentials`: Store credentials for future use
- `session_timeout`: Session timeout in seconds (default: 3600 = 1 hour)
- `token_refresh_threshold`: Refresh token before expiration (default: 300 = 5 minutes)
- `max_concurrent_sessions`: Maximum concurrent sessions per user

#### Device Registration
- `enabled`: Enable device registration and tracking
- `auto_register`: Automatically register new devices
- `require_approval`: Require manual approval for new devices

#### SSO Configuration (Future-Ready)
- `enabled`: Enable SSO authentication
- `provider`: SSO provider ("oauth2", "saml", "azure", "google")
- `endpoint`: SSO provider endpoint URL
- `client_id`: SSO client ID
- `redirect_uri`: OAuth redirect URI

#### Security Settings
- `use_keyring`: Use OS keyring for credential storage
- `encrypt_tokens`: Encrypt stored tokens
- `require_2fa`: Require two-factor authentication
- `password_policy`: Password complexity requirements

## Authentication Methods

### Email/Password Authentication

The default authentication method using email and password:

```json
{
  "authentication": {
    "method": "email_password",
    "security": {
      "password_policy": {
        "min_length": 8,
        "require_uppercase": true,
        "require_lowercase": true,
        "require_numbers": true,
        "require_symbols": false
      }
    }
  }
}
```

### API Key Authentication

For service accounts and automated systems:

```json
{
  "authentication": {
    "method": "api_key"
  }
}
```

### Enterprise SSO (Future-Ready)

Ready for enterprise SSO integration:

```json
{
  "authentication": {
    "method": "email_password",
    "sso": {
      "enabled": true,
      "provider": "oauth2",
      "endpoint": "https://your-sso-provider.com/oauth",
      "client_id": "your-client-id",
      "redirect_uri": "https://your-app.com/callback"
    }
  }
}
```

## Usage

### Automatic Authentication

The system automatically attempts authentication on startup:

1. **Auto-Login**: If enabled, tries to use stored credentials
2. **Token Validation**: Validates existing tokens with backend
3. **Token Refresh**: Automatically refreshes expired tokens
4. **Prompt for Credentials**: Prompts user if auto-login fails

### Manual Authentication

Use the built-in MCP tools for authentication:

#### Login
```python
# Interactive login (will prompt for credentials)
login()

# Login with provided credentials
login(email="user@example.com", password="password123")

# Force credential prompt
login(force_prompt=True)
```

#### Logout
```python
# Logout current user
logout()
```

#### Check Authentication Status
```python
# Get detailed authentication status
get_auth_status()
```

#### Refresh Token
```python
# Refresh authentication token
refresh_auth()
```

### Authentication Decorator

Protect MCP tools with authentication:

```python
@mcp.tool()
@require_authentication(auth_manager)
def protected_tool():
    return "This tool requires authentication"
```

## API Integration

### Authentication Endpoints

Your Node.js SaaS backend should provide these endpoints:

#### POST /api/auth/login
Login endpoint for user authentication:

**Request:**
```json
{
  "method": "email_password",
  "email": "user@example.com",
  "password": "password123",
  "device_info": {
    "device_id": "uuid",
    "device_name": "Windows 10",
    "device_type": "desktop",
    "os": "Windows",
    "os_version": "10",
    "architecture": "AMD64",
    "python_version": "3.9.0",
    "server_version": "2.0.0",
    "hostname": "user-pc",
    "ip_address": "192.168.1.100",
    "user_agent": "Cursor-Context-MCP-Server/2.0.0 (Windows)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "auth": {
    "access_token": "jwt-access-token",
    "refresh_token": "jwt-refresh-token",
    "expires_in": 3600,
    "session_id": "session-uuid",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "license_tier": "pro",
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### POST /api/auth/refresh
Token refresh endpoint:

**Request:**
```json
{
  "refresh_token": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "auth": {
    "access_token": "new-jwt-access-token",
    "refresh_token": "new-jwt-refresh-token",
    "expires_in": 3600
  }
}
```

#### GET /api/auth/validate
Token validation endpoint:

**Request Headers:**
```
Authorization: Bearer jwt-access-token
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "license_tier": "pro"
  }
}
```

#### POST /api/auth/register-device
Device registration endpoint:

**Request:**
```json
{
  "device_info": {
    "device_id": "uuid",
    "device_name": "Windows 10",
    "device_type": "desktop",
    "os": "Windows",
    "os_version": "10"
  },
  "session_id": "session-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "device": {
    "device_id": "uuid",
    "registered_at": "2024-01-01T12:00:00Z",
    "status": "active"
  }
}
```

#### POST /api/auth/logout
Logout endpoint:

**Request Headers:**
```
Authorization: Bearer jwt-access-token
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Secure Storage

### OS Keyring Integration

The system uses the OS keyring for secure credential storage:

- **Windows**: Windows Credential Manager
- **macOS**: Keychain Access
- **Linux**: Secret Service (GNOME Keyring, KDE Wallet)

### Fallback Storage

If keyring is not available, credentials are stored in encrypted files:

- **Location**: `~/.cursor-mcp/auth/`
- **Encryption**: AES encryption using Fernet
- **Permissions**: Restrictive file permissions (600)

### Token Encryption

All stored tokens are encrypted using:

- **Algorithm**: AES-256-GCM (Fernet)
- **Key Derivation**: PBKDF2 with SHA-256
- **Key Storage**: OS keyring or encrypted file

## Session Management

### Session Tracking

The system tracks user sessions with:

- **Session ID**: Unique session identifier
- **User Information**: User ID, email, license tier
- **Device Information**: Device ID, IP address, user agent
- **Timestamps**: Creation time, last activity, expiration
- **Concurrent Limits**: Maximum sessions per user

### Session Timeout

Sessions automatically expire after:

- **Default Timeout**: 1 hour (3600 seconds)
- **Configurable**: Set via `session_timeout` configuration
- **Activity Tracking**: Last activity timestamp
- **Automatic Cleanup**: Expired sessions are cleaned up

### Device Registration

Devices are automatically registered with:

- **Device Fingerprinting**: Unique device identification
- **Device Information**: OS, architecture, hostname
- **Registration Status**: Active, pending, blocked
- **Approval Workflow**: Optional manual approval

## Security Features

### Password Policies

Configurable password requirements:

```json
{
  "password_policy": {
    "min_length": 8,
    "require_uppercase": true,
    "require_lowercase": true,
    "require_numbers": true,
    "require_symbols": false
  }
}
```

### Token Security

- **JWT Tokens**: Industry-standard token format
- **Short Expiration**: Access tokens expire quickly
- **Refresh Tokens**: Long-lived refresh tokens
- **Secure Transmission**: HTTPS for all token operations
- **Token Validation**: Real-time validation with backend

### Device Security

- **Device Fingerprinting**: Unique device identification
- **IP Tracking**: Track device IP addresses
- **Concurrent Limits**: Limit concurrent sessions
- **Device Approval**: Optional device approval workflow

## Error Handling

### Authentication Errors

The system provides clear error messages for:

- **Invalid Credentials**: Wrong email/password
- **Network Issues**: Backend connectivity problems
- **Token Expiration**: Expired or invalid tokens
- **Device Limits**: Too many concurrent sessions
- **Account Issues**: Disabled or locked accounts

### User-Friendly Messages

Error messages are designed to be helpful:

```
❌ Authentication failed: Invalid email or password
💡 Troubleshooting Tips:
  • Check your email and password
  • Verify your internet connection
  • Ensure the SaaS backend is accessible
  • Check your license status
```

### Graceful Degradation

The system continues to operate with limited functionality when:

- Authentication is disabled
- Backend is unavailable
- Tokens are expired
- Network connectivity is poor

## Troubleshooting

### Common Issues

#### Authentication Fails
```
❌ Authentication failed: Invalid email or password
```

**Solutions:**
1. Verify email and password
2. Check internet connectivity
3. Ensure SaaS backend is accessible
4. Verify account status

#### Token Refresh Fails
```
❌ Token refresh failed: Refresh token expired
```

**Solutions:**
1. Re-authenticate using login command
2. Check token expiration settings
3. Verify backend token refresh endpoint

#### Keyring Issues
```
❌ Failed to store credentials: Keyring not available
```

**Solutions:**
1. Install keyring package: `pip install keyring`
2. Check OS keyring service
3. Use file-based storage as fallback

#### Device Registration Fails
```
❌ Device registration failed: Device limit exceeded
```

**Solutions:**
1. Check concurrent session limits
2. Logout from other devices
3. Contact administrator for device approval

### Debug Mode

Enable debug logging for detailed authentication information:

```json
{
  "logging": {
    "level": "DEBUG"
  }
}
```

### Health Checks

Use built-in tools to diagnose issues:

```python
# Check authentication status
get_auth_status()

# Test SaaS connection
test_saas_connection()

# Get server statistics
get_server_stats()
```

## Enterprise Features

### SSO Integration (Future-Ready)

The system is designed to support enterprise SSO:

- **OAuth2**: Standard OAuth2 flow
- **SAML**: SAML 2.0 support
- **Azure AD**: Microsoft Azure Active Directory
- **Google Workspace**: Google SSO integration
- **Custom Providers**: Custom SSO implementations

### Device Management

Enterprise device management features:

- **Device Approval**: Manual device approval workflow
- **Device Limits**: Configurable concurrent session limits
- **Device Tracking**: Comprehensive device information
- **Remote Logout**: Logout from specific devices

### Audit Logging

Comprehensive audit logging for compliance:

- **Authentication Events**: Login, logout, token refresh
- **Device Events**: Registration, approval, removal
- **Security Events**: Failed attempts, suspicious activity
- **Session Events**: Creation, timeout, cleanup

## Performance Considerations

### Efficient Authentication

- **Token Caching**: Cached token validation
- **Background Refresh**: Automatic token refresh
- **Minimal Network**: Reduced authentication requests
- **Local Validation**: Local token expiration checks

### Resource Usage

- **Memory**: Minimal memory footprint
- **Storage**: Efficient credential storage
- **Network**: Optimized authentication requests
- **CPU**: Background token management

### Scalability

- **Concurrent Users**: Support for multiple users
- **Session Management**: Efficient session tracking
- **Device Limits**: Configurable concurrent limits
- **Backend Integration**: Scalable backend communication

## Migration Guide

### From No Authentication

1. **Enable Authentication**:
   ```json
   {
     "authentication": {
       "enabled": true,
       "method": "email_password"
     }
   }
   ```

2. **Add Authentication Decorators**:
   ```python
   @require_authentication(auth_manager)
   def your_tool():
       # Your tool implementation
   ```

3. **Test Authentication**:
   ```python
   login()
   get_auth_status()
   ```

### From Basic Authentication

1. **Update Configuration**:
   - Add device registration settings
   - Configure security policies
   - Set session management options

2. **Add Advanced Features**:
   - Device registration
   - Session tracking
   - Token encryption

3. **Test Advanced Features**:
   - Device registration
   - Session management
   - Token refresh

## Support and Maintenance

### Monitoring

Monitor authentication system health using:
- Authentication status reports
- Session management statistics
- Device registration tracking
- Token refresh monitoring

### Maintenance

Regular maintenance tasks:
- Review authentication logs
- Monitor session usage
- Check device registrations
- Update security policies

### Support

For authentication-related issues:
1. Check authentication configuration
2. Review security and session settings
3. Test SaaS backend connectivity
4. Use diagnostic tools
5. Check server logs

## Conclusion

The user authentication system provides a comprehensive, secure, and user-friendly solution for SaaS authentication. It offers:

- **Multiple Authentication Methods**: Email/password, API key, SSO
- **Enterprise Security**: OS keyring, token encryption, device management
- **User Experience**: Auto-login, clear prompts, helpful errors
- **Session Management**: Concurrent limits, timeouts, device tracking
- **Future-Ready**: SSO support, enterprise features, audit logging

The system is designed to scale with your business while maintaining security and providing excellent user experience. It integrates seamlessly with your existing SaaS backend and provides the foundation for enterprise-grade authentication and authorization.
