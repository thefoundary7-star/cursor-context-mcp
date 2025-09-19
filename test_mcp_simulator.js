#!/usr/bin/env node
/**
 * MCP Request Simulator for Node.js Backend Testing
 * ==================================================
 * 
 * This script simulates MCP server requests to test the Node.js backend
 * from the server perspective. It includes:
 * - License validation simulation
 * - Usage tracking simulation
 * - Error handling testing
 * - Performance benchmarking
 * - Connection monitoring
 * 
 * Usage:
 *   node test_mcp_simulator.js [--backend-url URL] [--verbose] [--benchmark]
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;

class MCPRequestSimulator {
    constructor(options = {}) {
        this.backendUrl = options.backendUrl || DEFAULT_BACKEND_URL;
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || DEFAULT_TIMEOUT;
        this.retryAttempts = options.retryAttempts || DEFAULT_RETRY_ATTEMPTS;
        this.retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
        
        // Test data
        this.testLicenseKey = 'TEST-LICENSE-KEY-12345';
        this.testServerId = `test-server-${uuidv4().substring(0, 8)}`;
        this.testServerName = 'Test MCP Server';
        this.testServerVersion = '1.0.0';
        
        // Results tracking
        this.testResults = [];
        this.performanceMetrics = null;
        
        // Create axios instance with configuration
        this.httpClient = axios.create({
            baseURL: this.backendUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MCP-Request-Simulator/1.0'
            }
        });
        
        // Add request/response interceptors for logging
        this.setupInterceptors();
        
        this.log('info', `Initialized MCP Request Simulator`);
        this.log('info', `Backend URL: ${this.backendUrl}`);
        this.log('info', `Test Server ID: ${this.testServerId}`);
    }
    
    setupInterceptors() {
        // Request interceptor
        this.httpClient.interceptors.request.use(
            (config) => {
                if (this.verbose) {
                    this.log('debug', `Making ${config.method.toUpperCase()} request to ${config.url}`);
                    if (config.data) {
                        this.log('debug', `Request data: ${JSON.stringify(config.data, null, 2)}`);
                    }
                }
                return config;
            },
            (error) => {
                this.log('error', `Request interceptor error: ${error.message}`);
                return Promise.reject(error);
            }
        );
        
        // Response interceptor
        this.httpClient.interceptors.response.use(
            (response) => {
                if (this.verbose) {
                    this.log('debug', `Response: ${response.status} (${response.config.metadata?.duration || 'unknown'}ms)`);
                    this.log('debug', `Response data: ${JSON.stringify(response.data, null, 2)}`);
                }
                return response;
            },
            (error) => {
                if (this.verbose) {
                    this.log('error', `Response error: ${error.message}`);
                    if (error.response) {
                        this.log('error', `Response status: ${error.response.status}`);
                        this.log('error', `Response data: ${JSON.stringify(error.response.data, null, 2)}`);
                    }
                }
                return Promise.reject(error);
            }
        );
    }
    
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
    
    async makeRequest(method, endpoint, data = null, options = {}) {
        const startTime = Date.now();
        
        try {
            const config = {
                method,
                url: endpoint,
                data,
                ...options
            };
            
            const response = await this.httpClient(config);
            const duration = Date.now() - startTime;
            
            // Add duration to response for logging
            response.config.metadata = { duration };
            
            return { response, duration, success: true };
        } catch (error) {
            const duration = Date.now() - startTime;
            return { 
                response: error.response, 
                duration, 
                success: false, 
                error: error.message 
            };
        }
    }
    
    async testBackendConnectivity() {
        const testName = 'Backend Connectivity';
        this.log('info', `Running test: ${testName}`);
        
        try {
            const { response, duration, success, error } = await this.makeRequest('GET', '/api/health');
            
            const result = {
                testName,
                success: success && response?.status === 200,
                duration,
                errorMessage: success ? null : (error || `HTTP ${response?.status}: ${response?.data}`),
                responseData: success ? response.data : null,
                timestamp: new Date().toISOString()
            };
            
            this.log('info', `✓ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
            return result;
            
        } catch (error) {
            this.log('error', `✗ ${testName}: FAILED - ${error.message}`);
            return {
                testName,
                success: false,
                duration: 0,
                errorMessage: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async testLicenseValidation(licenseKey, shouldBeValid = true) {
        const testName = `License Validation (${shouldBeValid ? 'Valid' : 'Invalid'})`;
        this.log('info', `Running test: ${testName}`);
        
        try {
            const data = {
                licenseKey,
                serverId: this.testServerId,
                serverName: this.testServerName,
                serverVersion: this.testServerVersion
            };
            
            const { response, duration, success, error } = await this.makeRequest('POST', '/api/auth/validate-license', data);
            
            let testSuccess = false;
            let errorMessage = null;
            
            if (success && response?.status === 200) {
                const responseData = response.data;
                const isValid = responseData?.data?.valid;
                
                if (shouldBeValid) {
                    testSuccess = isValid === true;
                    errorMessage = testSuccess ? null : `Expected valid license but got invalid response: ${JSON.stringify(responseData)}`;
                } else {
                    testSuccess = isValid === false;
                    errorMessage = testSuccess ? null : `Expected invalid license but got valid response: ${JSON.stringify(responseData)}`;
                }
            } else {
                testSuccess = false;
                errorMessage = error || `HTTP ${response?.status}: ${response?.data}`;
            }
            
            const result = {
                testName,
                success: testSuccess,
                duration,
                errorMessage,
                responseData: success ? response.data : null,
                requestData: data,
                timestamp: new Date().toISOString()
            };
            
            this.log('info', `✓ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
            return result;
            
        } catch (error) {
            this.log('error', `✗ ${testName}: FAILED - ${error.message}`);
            return {
                testName,
                success: false,
                duration: 0,
                errorMessage: error.message,
                requestData: data,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async testUsageTracking() {
        const testName = 'Usage Tracking';
        this.log('info', `Running test: ${testName}`);
        
        try {
            // First validate license to ensure server is registered
            const licenseData = {
                licenseKey: this.testLicenseKey,
                serverId: this.testServerId,
                serverName: this.testServerName,
                serverVersion: this.testServerVersion
            };
            
            const licenseResult = await this.makeRequest('POST', '/api/auth/validate-license', licenseData);
            if (!licenseResult.success || licenseResult.response?.status !== 200) {
                throw new Error(`License validation failed: ${licenseResult.error}`);
            }
            
            // Now test usage tracking
            const events = [
                {
                    eventType: 'REQUEST_COUNT',
                    eventData: { count: 1, endpoint: '/test' },
                    metadata: { user_agent: 'test-client' },
                    timestamp: new Date().toISOString()
                },
                {
                    eventType: 'FEATURE_USAGE',
                    eventData: { feature: 'test_feature', duration_ms: 150 },
                    metadata: { version: '1.0.0' },
                    timestamp: new Date().toISOString()
                },
                {
                    eventType: 'HEARTBEAT',
                    eventData: { status: 'healthy' },
                    metadata: { uptime: 3600 },
                    timestamp: new Date().toISOString()
                }
            ];
            
            const trackingData = {
                licenseKey: this.testLicenseKey,
                serverId: this.testServerId,
                events
            };
            
            const { response, duration, success, error } = await this.makeRequest('POST', '/api/analytics/track', trackingData);
            
            const result = {
                testName,
                success: success && response?.status === 200,
                duration,
                errorMessage: success ? null : (error || `HTTP ${response?.status}: ${response?.data}`),
                responseData: success ? response.data : null,
                requestData: trackingData,
                timestamp: new Date().toISOString()
            };
            
            this.log('info', `✓ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
            return result;
            
        } catch (error) {
            this.log('error', `✗ ${testName}: FAILED - ${error.message}`);
            return {
                testName,
                success: false,
                duration: 0,
                errorMessage: error.message,
                requestData: trackingData,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async testNetworkFailureRecovery() {
        const testName = 'Network Failure Recovery';
        this.log('info', `Running test: ${testName}`);
        
        try {
            // Test with invalid backend URL
            const originalUrl = this.backendUrl;
            this.backendUrl = 'http://localhost:9999'; // Non-existent port
            this.httpClient.defaults.baseURL = this.backendUrl;
            
            const data = {
                licenseKey: this.testLicenseKey,
                serverId: this.testServerId,
                serverName: this.testServerName,
                serverVersion: this.testServerVersion
            };
            
            const startTime = Date.now();
            const { response, duration, success, error } = await this.makeRequest('POST', '/api/auth/validate-license', data);
            
            // Restore original URL
            this.backendUrl = originalUrl;
            this.httpClient.defaults.baseURL = this.backendUrl;
            
            // We expect this to fail with a connection error
            const testSuccess = !success && (error?.includes('ECONNREFUSED') || error?.includes('connect'));
            const errorMessage = testSuccess ? null : `Expected connection error but got: ${error || 'success'}`;
            
            const result = {
                testName,
                success: testSuccess,
                duration,
                errorMessage,
                requestData: data,
                timestamp: new Date().toISOString()
            };
            
            this.log('info', `✓ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
            return result;
            
        } catch (error) {
            // Restore original URL in case of exception
            this.backendUrl = originalUrl;
            this.httpClient.defaults.baseURL = this.backendUrl;
            
            this.log('error', `✗ ${testName}: FAILED - ${error.message}`);
            return {
                testName,
                success: false,
                duration: 0,
                errorMessage: error.message,
                requestData: data,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async testAuthenticationFlow() {
        const testName = 'Authentication Flow';
        this.log('info', `Running test: ${testName}`);
        
        try {
            // Step 1: Validate license
            const licenseData = {
                licenseKey: this.testLicenseKey,
                serverId: this.testServerId,
                serverName: this.testServerName,
                serverVersion: this.testServerVersion
            };
            
            const licenseResult = await this.makeRequest('POST', '/api/auth/validate-license', licenseData);
            if (!licenseResult.success || licenseResult.response?.status !== 200) {
                throw new Error(`License validation failed: ${licenseResult.error}`);
            }
            
            const licenseResponseData = licenseResult.response.data;
            if (!licenseResponseData?.data?.valid) {
                throw new Error(`License validation returned invalid: ${JSON.stringify(licenseResponseData)}`);
            }
            
            // Step 2: Track usage
            const events = [
                {
                    eventType: 'LICENSE_VALIDATION',
                    eventData: { success: true },
                    metadata: { test: true },
                    timestamp: new Date().toISOString()
                }
            ];
            
            const trackingData = {
                licenseKey: this.testLicenseKey,
                serverId: this.testServerId,
                events
            };
            
            const trackingResult = await this.makeRequest('POST', '/api/analytics/track', trackingData);
            
            const result = {
                testName,
                success: trackingResult.success && trackingResult.response?.status === 200,
                duration: licenseResult.duration + trackingResult.duration,
                errorMessage: trackingResult.success ? null : (trackingResult.error || `HTTP ${trackingResult.response?.status}: ${trackingResult.response?.data}`),
                responseData: trackingResult.success ? trackingResult.response.data : null,
                requestData: {
                    licenseValidation: licenseData,
                    usageTracking: trackingData
                },
                timestamp: new Date().toISOString()
            };
            
            this.log('info', `✓ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
            return result;
            
        } catch (error) {
            this.log('error', `✗ ${testName}: FAILED - ${error.message}`);
            return {
                testName,
                success: false,
                duration: 0,
                errorMessage: error.message,
                requestData: {
                    licenseValidation: licenseData,
                    usageTracking: trackingData
                },
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async runPerformanceBenchmark(numRequests = 100) {
        this.log('info', `Running performance benchmark with ${numRequests} requests`);
        
        const responseTimes = [];
        let successfulRequests = 0;
        let failedRequests = 0;
        
        const startTime = Date.now();
        
        for (let i = 0; i < numRequests; i++) {
            try {
                const data = {
                    licenseKey: this.testLicenseKey,
                    serverId: `${this.testServerId}-${i}`,
                    serverName: `Test Server ${i}`,
                    serverVersion: this.testServerVersion
                };
                
                const { response, duration, success } = await this.makeRequest('POST', '/api/auth/validate-license', data);
                
                responseTimes.push(duration);
                
                if (success && response?.status === 200) {
                    successfulRequests++;
                } else {
                    failedRequests++;
                }
                
            } catch (error) {
                this.log('warn', `Request ${i + 1} failed: ${error.message}`);
                failedRequests++;
            }
        }
        
        const totalDuration = Date.now() - startTime;
        
        const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
        const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
        const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
        const requestsPerSecond = numRequests / (totalDuration / 1000);
        
        this.performanceMetrics = {
            totalRequests: numRequests,
            successfulRequests,
            failedRequests,
            averageResponseTimeMs: avgResponseTime,
            minResponseTimeMs: minResponseTime,
            maxResponseTimeMs: maxResponseTime,
            requestsPerSecond,
            totalDurationSeconds: totalDuration / 1000
        };
        
        this.log('info', 'Performance Benchmark Results:');
        this.log('info', `  Total Requests: ${this.performanceMetrics.totalRequests}`);
        this.log('info', `  Successful: ${this.performanceMetrics.successfulRequests}`);
        this.log('info', `  Failed: ${this.performanceMetrics.failedRequests}`);
        this.log('info', `  Average Response Time: ${this.performanceMetrics.averageResponseTimeMs.toFixed(2)}ms`);
        this.log('info', `  Min Response Time: ${this.performanceMetrics.minResponseTimeMs.toFixed(2)}ms`);
        this.log('info', `  Max Response Time: ${this.performanceMetrics.maxResponseTimeMs.toFixed(2)}ms`);
        this.log('info', `  Requests/Second: ${this.performanceMetrics.requestsPerSecond.toFixed(2)}`);
        this.log('info', `  Total Duration: ${this.performanceMetrics.totalDurationSeconds.toFixed(2)}s`);
        
        return this.performanceMetrics;
    }
    
    async runAllTests() {
        this.log('info', 'Starting MCP Request Simulator Test Suite');
        this.log('info', '='.repeat(50));
        
        const tests = [
            () => this.testBackendConnectivity(),
            () => this.testLicenseValidation(this.testLicenseKey, true),
            () => this.testLicenseValidation('INVALID-LICENSE-KEY', false),
            () => this.testUsageTracking(),
            () => this.testNetworkFailureRecovery(),
            () => this.testAuthenticationFlow()
        ];
        
        this.testResults = [];
        
        for (const testFunc of tests) {
            try {
                const result = await testFunc();
                this.testResults.push(result);
            } catch (error) {
                this.log('error', `Test ${testFunc.name} crashed: ${error.message}`);
                this.testResults.push({
                    testName: testFunc.name,
                    success: false,
                    duration: 0,
                    errorMessage: `Test crashed: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return this.testResults;
    }
    
    generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(result => result.success).length;
        const failedTests = totalTests - passedTests;
        
        const totalDuration = this.testResults.reduce((sum, result) => sum + result.duration, 0);
        const avgDuration = totalDuration / totalTests;
        
        return {
            testSummary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: totalTests > 0 ? (passedTests / totalTests * 100) : 0,
                totalDurationMs: totalDuration,
                averageDurationMs: avgDuration,
                timestamp: new Date().toISOString()
            },
            testResults: this.testResults,
            performanceMetrics: this.performanceMetrics,
            backendUrl: this.backendUrl,
            testServerId: this.testServerId
        };
    }
    
    async saveReport(filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                            new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
            filename = `mcp_simulator_test_report_${timestamp}.json`;
        }
        
        const report = this.generateReport();
        
        await fs.writeFile(filename, JSON.stringify(report, null, 2));
        
        this.log('info', `Test report saved to: ${filename}`);
        return filename;
    }
    
    printSummary() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(result => result.success).length;
        const failedTests = totalTests - passedTests;
        
        console.log('\n' + '='.repeat(60));
        console.log('MCP REQUEST SIMULATOR TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Success Rate: ${totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0}%`);
        
        if (this.performanceMetrics) {
            console.log(`\nPerformance Metrics:`);
            console.log(`  Requests/Second: ${this.performanceMetrics.requestsPerSecond.toFixed(2)}`);
            console.log(`  Average Response Time: ${this.performanceMetrics.averageResponseTimeMs.toFixed(2)}ms`);
        }
        
        console.log('\nTest Results:');
        this.testResults.forEach(result => {
            const status = result.success ? '✓ PASS' : '✗ FAIL';
            console.log(`  ${status} ${result.testName} (${result.duration}ms)`);
            if (!result.success && result.errorMessage) {
                console.log(`    Error: ${result.errorMessage}`);
            }
        });
        
        console.log('='.repeat(60));
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--backend-url':
                options.backendUrl = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--benchmark':
                options.benchmark = true;
                break;
            case '--requests':
                options.numRequests = parseInt(args[++i]) || 100;
                break;
            case '--report':
                options.reportFile = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
MCP Request Simulator

Usage: node test_mcp_simulator.js [options]

Options:
  --backend-url URL    Backend URL (default: http://localhost:3000)
  --verbose, -v        Enable verbose logging
  --benchmark          Run performance benchmark
  --requests N         Number of requests for benchmark (default: 100)
  --report FILE        Save report to specific file
  --help, -h           Show this help message
                `);
                process.exit(0);
                break;
        }
    }
    
    // Create simulator instance
    const simulator = new MCPRequestSimulator(options);
    
    try {
        // Run integration tests
        const results = await simulator.runAllTests();
        
        // Run performance benchmark if requested
        if (options.benchmark) {
            await simulator.runPerformanceBenchmark(options.numRequests || 100);
        }
        
        // Generate and save report
        const reportFile = await simulator.saveReport(options.reportFile);
        
        // Print summary
        simulator.printSummary();
        
        // Exit with appropriate code
        const failedTests = results.filter(result => !result.success).length;
        process.exit(failedTests);
        
    } catch (error) {
        console.error(`Test suite failed: ${error.message}`);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = MCPRequestSimulator;
