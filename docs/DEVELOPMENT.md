# Development Guide

This guide covers development-specific configurations and features for the MCP SaaS platform.

## License Management

### Disabling License Validation

For development and testing purposes, you can disable all license validation by setting the `DISABLE_LICENSE` environment variable to `true`.

#### Configuration

Add the following to your `.env` file:

```bash
DISABLE_LICENSE=true
```

#### Behavior When Disabled

When `DISABLE_LICENSE=true`:

- **All license checks are bypassed** - No license key validation occurs
- **PRO tier access is granted** - All features are available as if you have a PRO license
- **No usage limits** - Unlimited API calls and features
- **Mock license data** - Returns a fake PRO license for compatibility
- **Development logging** - Clear console messages indicate when licensing is disabled

#### ⚠️ Important Warnings

**NEVER use `DISABLE_LICENSE=true` in production environments!**

- This setting completely bypasses all license validation
- It grants unlimited access to all premium features
- It should only be used for local development and testing
- Production deployments should always have proper license validation enabled

#### Usage Examples

**For local development:**
```bash
# .env.local
DISABLE_LICENSE=true
NODE_ENV=development
```

**For testing:**
```bash
# .env.test
DISABLE_LICENSE=true
NODE_ENV=test
```

**For production (default):**
```bash
# .env.production
DISABLE_LICENSE=false
NODE_ENV=production
```

### License System Architecture

The license system consists of several components:

1. **License Manager** (`enhanced-mcp-server/src/licensing/license-manager.ts`)
   - Handles feature access checks
   - Manages usage limits and quotas
   - Validates license keys

2. **License Service** (`src/services/licenseService.ts`)
   - Database operations for licenses
   - Hardware fingerprinting validation
   - Digital signature verification

3. **Middleware** (`src/middleware/auth.ts`)
   - API route protection
   - License validation for requests
   - User authentication

4. **MCP Tools** (`enhanced-mcp-server/src/index.ts`)
   - Feature gating for MCP operations
   - Usage tracking and limits
   - Upgrade prompts for locked features

### Development Workflow

1. **Start with licensing disabled** for initial development
2. **Test with licensing enabled** to verify restrictions work
3. **Use proper license keys** for integration testing
4. **Verify production behavior** with licensing enabled

### Testing License Features

To test license restrictions:

1. Set `DISABLE_LICENSE=false` in your environment
2. Use a valid license key or no license key (FREE tier)
3. Test feature access and usage limits
4. Verify upgrade prompts appear for locked features

### Troubleshooting

**Issue: License validation not working**
- Check that `DISABLE_LICENSE` is set correctly
- Verify environment variables are loaded
- Check console logs for license-related messages

**Issue: Features still locked with DISABLE_LICENSE=true**
- Restart the application after changing environment variables
- Check that the environment variable is properly set
- Verify no caching is interfering with the setting

**Issue: Production deployment with licensing disabled**
- This is a security risk and should be avoided
- Always verify `DISABLE_LICENSE=false` in production
- Use proper license keys for production deployments

### Security Considerations

- The `DISABLE_LICENSE` setting is a development convenience
- It should never be used in production environments
- Always use proper license validation in production
- Monitor for any accidental production deployments with licensing disabled

### Related Files

- `enhanced-mcp-server/src/licensing/license-manager.ts` - Main license manager
- `src/services/licenseService.ts` - License service layer
- `src/middleware/auth.ts` - Authentication middleware
- `env.example` - Environment configuration template
- `LICENSE_MANAGEMENT.md` - Production license management guide
