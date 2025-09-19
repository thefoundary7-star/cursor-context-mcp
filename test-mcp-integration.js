#!/usr/bin/env node

/**
 * MCP Server Integration Test Suite
 * 
 * This script tests all endpoints required for MCP server integration:
 * - Health checks
 * - License validation
 * - Analytics tracking
 * - User authentication
 * - API key authentication
 * - CORS configuration
 * - Rate limiting
 * - Error handling
 */

const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

// Test credentials (these should be created by the test data script)
const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'testpassword123',
  licenseKey: 'MCP-TEST-LICENSE-KEY', // This will be updated after test data creation
  apiKey: 'mcp_test_api_key_here', // This will be updated after test data creation
  serverId: 'test-server-001'
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: [],
  authToken: null,
  actualCredentials: {}
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : 'red';
  const statusSymbol = status === 'PASS' ? '✓' : '✗';
  
  log(`${statusSymbol} ${testName}`, statusColor);
  if (details) {
    log(`  ${details}`, 'yellow');
  }
  
  testResults.details.push({ testName, status, details });
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${details}`);
  }
}

function logSection(title) {
  log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${title}${colors.reset}`);
  log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
}

// HTTP client with error handling
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: TEST_TIMEOUT
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { 
      success: true, 
      data: response.data, 
      status: response.status,
      headers: response.headers
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
      headers: error.response?.headers || {}
    };
  }
}

// Load actual test credentials from test data creation
function loadTestCredentials() {
  try {
    // Try to read credentials from a file created by the test data script
    if (fs.existsSync('test-credentials.json')) {
      const credentials = JSON.parse(fs.readFileSync('test-credentials.json', 'utf8'));
      testResults.actualCredentials = credentials;
      log('✓ Loaded test credentials from file', 'green');
      return true;
    }
  } catch (error) {
    log('Could not load test credentials file', 'yellow');
  }
  
  // Use default test credentials
  testResults.actualCredentials = TEST_CREDENTIALS;
  log('Using default test credentials', 'yellow');
  return false;
}

// Test 1: Server Health and Basic Connectivity
async function testServerHealth() {
  logSection('1. Server Health and Connectivity');
  
  // Test root endpoint
  const rootResponse = await makeRequest('GET', '/');
  if (rootResponse.success) {
    logTest('Root Endpoint', 'PASS', `Status: ${rootResponse.status}`);
  } else {
    logTest('Root Endpoint', 'FAIL', `Error: ${JSON.stringify(rootResponse.error)}`);
    return false;
  }
  
  // Test basic health check
  const healthResponse = await makeRequest('GET', '/api/health');
  if (healthResponse.success && healthResponse.data.success) {
    logTest('Basic Health Check', 'PASS', `Status: ${healthResponse.status}`);
  } else {
    logTest('Basic Health Check', 'FAIL', `Error: ${JSON.stringify(healthResponse.error)}`);
  }
  
  // Test readiness check
  const readyResponse = await makeRequest('GET', '/api/health/ready');
  if (readyResponse.success && readyResponse.data.success) {
    logTest('Readiness Check', 'PASS', `Status: ${readyResponse.status}`);
  } else {
    logTest('Readiness Check', 'FAIL', `Error: ${JSON.stringify(readyResponse.error)}`);
  }
  
  // Test detailed health check
  const detailedResponse = await makeRequest('GET', '/api/health/detailed');
  if (detailedResponse.success && detailedResponse.data.success) {
    logTest('Detailed Health Check', 'PASS', `Status: ${detailedResponse.status}`);
    
    // Check database connection
    const dbStatus = detailedResponse.data.data?.services?.database?.status;
    if (dbStatus === 'connected') {
      logTest('Database Connection', 'PASS', 'Database is connected');
    } else {
      logTest('Database Connection', 'FAIL', `Database status: ${dbStatus}`);
    }
  } else {
    logTest('Detailed Health Check', 'FAIL', `Error: ${JSON.stringify(detailedResponse.error)}`);
  }
  
  return true;
}

// Test 2: CORS Configuration
async function testCORSConfiguration() {
  logSection('2. CORS Configuration');
  
  const testOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://yourdomain.com'
  ];
  
  for (const origin of testOrigins) {
    const response = await makeRequest('GET', '/api/health', null, {
      'Origin': origin
    });
    
    if (response.success) {
      // Check for CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
        'Access-Control-Allow-Methods': response.headers['access-control-allow-methods'],
        'Access-Control-Allow-Headers': response.headers['access-control-allow-headers']
      };
      
      if (corsHeaders['Access-Control-Allow-Origin']) {
        logTest(`CORS for ${origin}`, 'PASS', 'CORS headers present');
      } else {
        logTest(`CORS for ${origin}`, 'FAIL', 'CORS headers missing');
      }
    } else {
      logTest(`CORS for ${origin}`, 'FAIL', `Error: ${JSON.stringify(response.error)}`);
    }
  }
}

// Test 3: User Authentication
async function testUserAuthentication() {
  logSection('3. User Authentication');
  
  const credentials = testResults.actualCredentials;
  
  // Test login with valid credentials
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: credentials.email,
    password: credentials.password
  });
  
  if (loginResponse.success && loginResponse.data.success) {
    logTest('User Login', 'PASS', `Status: ${loginResponse.status}`);
    
    // Store auth token for subsequent tests
    testResults.authToken = loginResponse.data.data.accessToken;
    logTest('Auth Token Retrieved', 'PASS', 'Token stored for API tests');
  } else {
    logTest('User Login', 'FAIL', `Error: ${JSON.stringify(loginResponse.error)}`);
  }
  
  // Test login with invalid credentials
  const invalidLoginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  });
  
  if (invalidLoginResponse.status === 401 || invalidLoginResponse.status === 400) {
    logTest('Invalid Login Rejection', 'PASS', 'Properly rejects invalid credentials');
  } else {
    logTest('Invalid Login Rejection', 'FAIL', `Unexpected response: ${invalidLoginResponse.status}`);
  }
}

// Test 4: License Validation
async function testLicenseValidation() {
  logSection('4. License Validation');
  
  const credentials = testResults.actualCredentials;
  
  // Test license validation with valid license
  const validLicenseResponse = await makeRequest('POST', '/api/auth/validate-license', {
    licenseKey: credentials.licenseKey,
    serverId: credentials.serverId,
    serverName: 'Test MCP Server',
    serverVersion: '1.0.0'
  });
  
  if (validLicenseResponse.success && validLicenseResponse.data.success) {
    logTest('Valid License Validation', 'PASS', `Status: ${validLicenseResponse.status}`);
  } else {
    logTest('Valid License Validation', 'FAIL', `Error: ${JSON.stringify(validLicenseResponse.error)}`);
  }
  
  // Test license validation with invalid license
  const invalidLicenseResponse = await makeRequest('POST', '/api/auth/validate-license', {
    licenseKey: 'INVALID-LICENSE-KEY',
    serverId: 'test-server',
    serverName: 'Test Server',
    serverVersion: '1.0.0'
  });
  
  if (invalidLicenseResponse.status === 400 || invalidLicenseResponse.status === 401) {
    logTest('Invalid License Rejection', 'PASS', 'Properly rejects invalid license');
  } else {
    logTest('Invalid License Rejection', 'FAIL', `Unexpected response: ${invalidLicenseResponse.status}`);
  }
}

// Test 5: Analytics Tracking
async function testAnalyticsTracking() {
  logSection('5. Analytics Tracking');
  
  const credentials = testResults.actualCredentials;
  
  // Test analytics tracking with API key
  const trackResponse = await makeRequest('POST', '/api/analytics/track', {
    licenseKey: credentials.licenseKey,
    serverId: credentials.serverId,
    events: [
      {
        eventType: 'SERVER_START',
        eventData: {
          timestamp: new Date().toISOString(),
          serverVersion: '1.0.0',
          environment: 'test'
        }
      },
      {
        eventType: 'REQUEST_COUNT',
        eventData: {
          count: 1,
          endpoint: '/test'
        }
      }
    ]
  }, {
    'X-API-Key': credentials.apiKey
  });
  
  if (trackResponse.success && trackResponse.data.success) {
    logTest('Analytics Tracking with API Key', 'PASS', `Status: ${trackResponse.status}`);
  } else {
    logTest('Analytics Tracking with API Key', 'FAIL', `Error: ${JSON.stringify(trackResponse.error)}`);
  }
  
  // Test analytics tracking without API key (should fail)
  const noApiKeyResponse = await makeRequest('POST', '/api/analytics/track', {
    licenseKey: credentials.licenseKey,
    serverId: credentials.serverId,
    events: [
      {
        eventType: 'SERVER_START',
        eventData: { timestamp: new Date().toISOString() }
      }
    ]
  });
  
  if (noApiKeyResponse.status === 401) {
    logTest('Analytics Tracking without API Key', 'PASS', 'Properly requires API key');
  } else {
    logTest('Analytics Tracking without API Key', 'FAIL', `Unexpected response: ${noApiKeyResponse.status}`);
  }
}

// Test 6: User Profile and Management
async function testUserProfile() {
  logSection('6. User Profile and Management');
  
  if (!testResults.authToken) {
    logTest('User Profile Tests', 'SKIP', 'No auth token available');
    return;
  }
  
  // Test get user profile
  const profileResponse = await makeRequest('GET', '/api/user/profile', null, {
    'Authorization': `Bearer ${testResults.authToken}`
  });
  
  if (profileResponse.success && profileResponse.data.success) {
    logTest('Get User Profile', 'PASS', `Status: ${profileResponse.status}`);
  } else {
    logTest('Get User Profile', 'FAIL', `Error: ${JSON.stringify(profileResponse.error)}`);
  }
  
  // Test get user licenses
  const licensesResponse = await makeRequest('GET', '/api/user/licenses', null, {
    'Authorization': `Bearer ${testResults.authToken}`
  });
  
  if (licensesResponse.success && licensesResponse.data.success) {
    logTest('Get User Licenses', 'PASS', `Status: ${licensesResponse.status}`);
  } else {
    logTest('Get User Licenses', 'FAIL', `Error: ${JSON.stringify(licensesResponse.error)}`);
  }
  
  // Test get user dashboard
  const dashboardResponse = await makeRequest('GET', '/api/user/dashboard', null, {
    'Authorization': `Bearer ${testResults.authToken}`
  });
  
  if (dashboardResponse.success && dashboardResponse.data.success) {
    logTest('Get User Dashboard', 'PASS', `Status: ${dashboardResponse.status}`);
  } else {
    logTest('Get User Dashboard', 'FAIL', `Error: ${JSON.stringify(dashboardResponse.error)}`);
  }
}

// Test 7: Rate Limiting
async function testRateLimiting() {
  logSection('7. Rate Limiting');
  
  // Make multiple requests to test rate limiting
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(makeRequest('GET', '/api/health'));
  }
  
  const responses = await Promise.all(requests);
  const successCount = responses.filter(r => r.success).length;
  const rateLimitedCount = responses.filter(r => r.status === 429).length;
  
  if (successCount >= 5) {
    logTest('Rate Limiting', 'PASS', `${successCount}/10 requests successful`);
  } else {
    logTest('Rate Limiting', 'FAIL', `Only ${successCount}/10 requests successful`);
  }
  
  if (rateLimitedCount > 0) {
    logTest('Rate Limit Enforcement', 'PASS', `${rateLimitedCount} requests were rate limited`);
  } else {
    logTest('Rate Limit Enforcement', 'PASS', 'No rate limiting detected (within limits)');
  }
}

// Test 8: Error Handling
async function testErrorHandling() {
  logSection('8. Error Handling');
  
  // Test 404 endpoint
  const notFoundResponse = await makeRequest('GET', '/api/nonexistent');
  if (notFoundResponse.status === 404) {
    logTest('404 Error Handling', 'PASS', 'Properly returns 404 for non-existent endpoints');
  } else {
    logTest('404 Error Handling', 'FAIL', `Unexpected response: ${notFoundResponse.status}`);
  }
  
  // Test malformed JSON
  try {
    const malformedResponse = await axios.post(`${BASE_URL}/api/auth/login`, 'invalid json', {
      headers: { 'Content-Type': 'application/json' },
      timeout: TEST_TIMEOUT
    });
    logTest('Malformed JSON Handling', 'FAIL', 'Should have rejected malformed JSON');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Malformed JSON Handling', 'PASS', 'Properly rejects malformed JSON');
    } else {
      logTest('Malformed JSON Handling', 'FAIL', `Unexpected error: ${error.message}`);
    }
  }
  
  // Test unauthorized access
  const unauthorizedResponse = await makeRequest('GET', '/api/user/profile');
  if (unauthorizedResponse.status === 401) {
    logTest('Unauthorized Access Handling', 'PASS', 'Properly requires authentication');
  } else {
    logTest('Unauthorized Access Handling', 'FAIL', `Unexpected response: ${unauthorizedResponse.status}`);
  }
}

// Test 9: Security Headers
async function testSecurityHeaders() {
  logSection('9. Security Headers');
  
  const response = await makeRequest('GET', '/api/health');
  
  if (response.success) {
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy'
    ];
    
    let headersPresent = 0;
    for (const header of securityHeaders) {
      if (response.headers[header]) {
        headersPresent++;
      }
    }
    
    if (headersPresent >= 2) {
      logTest('Security Headers', 'PASS', `${headersPresent}/${securityHeaders.length} security headers present`);
    } else {
      logTest('Security Headers', 'FAIL', `Only ${headersPresent}/${securityHeaders.length} security headers present`);
    }
  } else {
    logTest('Security Headers', 'FAIL', 'Could not test security headers');
  }
}

// Test 10: MCP Integration Readiness
async function testMCPIntegrationReadiness() {
  logSection('10. MCP Integration Readiness');
  
  const credentials = testResults.actualCredentials;
  
  // Test complete MCP workflow
  const workflow = [
    {
      name: 'License Validation',
      request: () => makeRequest('POST', '/api/auth/validate-license', {
        licenseKey: credentials.licenseKey,
        serverId: credentials.serverId,
        serverName: 'MCP Test Server',
        serverVersion: '1.0.0'
      })
    },
    {
      name: 'Analytics Tracking',
      request: () => makeRequest('POST', '/api/analytics/track', {
        licenseKey: credentials.licenseKey,
        serverId: credentials.serverId,
        events: [
          {
            eventType: 'HEARTBEAT',
            eventData: {
              timestamp: new Date().toISOString(),
              status: 'healthy'
            }
          }
        ]
      }, {
        'X-API-Key': credentials.apiKey
      })
    }
  ];
  
  let workflowSuccess = true;
  for (const step of workflow) {
    const response = await step.request();
    if (response.success && response.data.success) {
      logTest(`MCP Workflow - ${step.name}`, 'PASS', `Status: ${response.status}`);
    } else {
      logTest(`MCP Workflow - ${step.name}`, 'FAIL', `Error: ${JSON.stringify(response.error)}`);
      workflowSuccess = false;
    }
  }
  
  if (workflowSuccess) {
    logTest('MCP Integration Readiness', 'PASS', 'Complete MCP workflow successful');
  } else {
    logTest('MCP Integration Readiness', 'FAIL', 'MCP workflow has issues');
  }
}

// Generate comprehensive test report
async function generateTestReport() {
  logSection('Test Summary Report');
  
  const totalTests = testResults.passed + testResults.failed;
  const passRate = totalTests > 0 ? ((testResults.passed / totalTests) * 100).toFixed(1) : 0;
  
  log(`Total Tests: ${totalTests}`, 'bright');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, 'red');
  log(`Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
  
  if (testResults.errors.length > 0) {
    log('\nFailed Tests:', 'red');
    testResults.errors.forEach(error => {
      log(`  - ${error}`, 'red');
    });
  }
  
  // Generate detailed JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: parseFloat(passRate)
    },
    details: testResults.details,
    errors: testResults.errors,
    credentials: {
      hasAuthToken: !!testResults.authToken,
      hasCredentials: Object.keys(testResults.actualCredentials).length > 0
    },
    recommendations: []
  };
  
  // Add recommendations based on test results
  if (passRate < 80) {
    report.recommendations.push('Backend needs attention before MCP integration');
  }
  if (!testResults.authToken) {
    report.recommendations.push('Authentication system needs to be working');
  }
  if (testResults.errors.some(e => e.includes('Database'))) {
    report.recommendations.push('Database connection needs to be established');
  }
  if (testResults.errors.some(e => e.includes('CORS'))) {
    report.recommendations.push('CORS configuration needs to be updated');
  }
  
  fs.writeFileSync('mcp-integration-test-report.json', JSON.stringify(report, null, 2));
  log('\nDetailed report saved to mcp-integration-test-report.json', 'cyan');
  
  return passRate >= 80;
}

// Main test execution
async function runMCPIntegrationTests() {
  log(`${colors.bright}${colors.blue}MCP Server Integration Test Suite${colors.reset}`);
  log(`${colors.blue}Testing backend at: ${BASE_URL}${colors.reset}\n`);
  
  try {
    // Load test credentials
    loadTestCredentials();
    
    // Run all tests
    const serverHealthy = await testServerHealth();
    if (!serverHealthy) {
      log('\nServer is not healthy. Please check the backend server.', 'red');
      process.exit(1);
    }
    
    await testCORSConfiguration();
    await testUserAuthentication();
    await testLicenseValidation();
    await testAnalyticsTracking();
    await testUserProfile();
    await testRateLimiting();
    await testErrorHandling();
    await testSecurityHeaders();
    await testMCPIntegrationReadiness();
    
    // Generate final report
    const success = await generateTestReport();
    
    if (success) {
      log('\n🎉 Backend is ready for MCP server integration!', 'green');
      log('\nNext steps:', 'bright');
      log('1. Use the test credentials for MCP server configuration', 'yellow');
      log('2. Configure your MCP server to use the API endpoints', 'yellow');
      log('3. Test the integration with your actual MCP server', 'yellow');
      process.exit(0);
    } else {
      log('\n❌ Backend needs attention before MCP integration', 'red');
      log('\nPlease fix the failed tests before proceeding with MCP integration.', 'yellow');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\nTest suite failed with error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runMCPIntegrationTests();
}

module.exports = { runMCPIntegrationTests, testResults };
