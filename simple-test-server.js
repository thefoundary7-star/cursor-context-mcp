#!/usr/bin/env node

/**
 * Simple Test Server for MCP SaaS Backend
 * 
 * This is a simplified version of the server for testing purposes
 * without complex TypeScript imports and dependencies.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Correlation-ID',
  ],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MCP Server SaaS Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      analytics: '/api/analytics',
      user: '/api/user',
      health: '/api/health',
    },
  });
});

// Health check endpoints
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    services: {
      database: 'not_configured', // We'll test without database for now
      redis: 'not_configured',
      stripe: 'not_configured',
    },
    version: '1.0.0',
  };

  res.json({
    success: true,
    data: healthCheck,
    message: 'Service is healthy',
  });
});

app.get('/api/health/ready', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ready',
      timestamp: new Date().toISOString(),
    },
    message: 'Service is ready to accept requests',
  });
});

app.get('/api/health/live', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    },
    message: 'Service is alive',
  });
});

// License validation endpoint (mock)
app.post('/api/auth/validate-license', (req, res) => {
  const { licenseKey, serverId, serverName, serverVersion } = req.body;
  
  if (!licenseKey || !serverId) {
    return res.status(400).json({
      success: false,
      error: 'License key and server ID are required',
    });
  }
  
  // Mock validation - accept any license key that starts with "MCP-"
  if (licenseKey.startsWith('MCP-')) {
    res.json({
      success: true,
      data: {
        valid: true,
        licenseKey,
        serverId,
        serverName,
        serverVersion,
        message: 'License validated successfully',
      },
      message: 'License validated successfully',
    });
  } else {
    res.status(401).json({
      success: false,
      data: {
        valid: false,
        message: 'Invalid license key',
      },
      message: 'Invalid license key',
    });
  }
});

// Analytics tracking endpoint (mock)
app.post('/api/analytics/track', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
    });
  }
  
  const { licenseKey, serverId, events } = req.body;
  
  if (!licenseKey || !serverId || !events) {
    return res.status(400).json({
      success: false,
      error: 'License key, server ID, and events are required',
    });
  }
  
  // Mock analytics tracking
  res.json({
    success: true,
    data: {
      processed: events.length,
      licenseKey,
      serverId,
      timestamp: new Date().toISOString(),
    },
    message: `Successfully tracked ${events.length} events`,
  });
});

// User login endpoint (mock)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }
  
  // Mock authentication - accept test credentials
  if (email === 'test@example.com' && password === 'testpassword123') {
    res.json({
      success: true,
      data: {
        accessToken: 'mock-jwt-token-for-testing',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
        },
      },
      message: 'Login successful',
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }
});

// User profile endpoint (mock)
app.get('/api/user/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token is required',
    });
  }
  
  // Mock user profile
  res.json({
    success: true,
    data: {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      company: 'Test Company',
      role: 'USER',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    message: 'Profile retrieved successfully',
  });
});

// User licenses endpoint (mock)
app.get('/api/user/licenses', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token is required',
    });
  }
  
  // Mock licenses
  res.json({
    success: true,
    data: [
      {
        id: 'test-license-id',
        licenseKey: 'MCP-TEST-LICENSE-KEY',
        name: 'Test MCP License',
        description: 'Test license for MCP server integration',
        plan: 'PRO',
        maxServers: 5,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
    message: 'Licenses retrieved successfully',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} was not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Simple test server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 License validation: POST http://localhost:${PORT}/api/auth/validate-license`);
  console.log(`📈 Analytics tracking: POST http://localhost:${PORT}/api/analytics/track`);
  console.log(`👤 User login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`👤 User profile: GET http://localhost:${PORT}/api/user/profile`);
  console.log('');
  console.log('Test credentials:');
  console.log('  Email: test@example.com');
  console.log('  Password: testpassword123');
  console.log('  License Key: MCP-TEST-LICENSE-KEY');
  console.log('  API Key: mcp_test_api_key_here');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

module.exports = app;
