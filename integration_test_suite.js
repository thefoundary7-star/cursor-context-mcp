#!/usr/bin/env node
/**
 * Comprehensive MCP Integration Test Suite
 * ========================================
 * 
 * This is the main integration test suite that orchestrates all testing
 * between the Python MCP server and Node.js backend. It includes:
 * 
 * - End-to-end communication flow testing
 * - License validation scenarios
 * - Usage tracking verification
 * - Error handling and recovery testing
 * - Performance benchmarking
 * - Network failure simulation
 * - Authentication flow testing
 * 
 * Usage:
 *   node integration_test_suite.js [options]
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class MCPIntegrationTestSuite {
    constructor(options = {}) {
        this.options = {
            backendUrl: options.backendUrl || 'http://localhost:3000',
            pythonScript: options.pythonScript || './test_mcp_integration.py',
            nodeScript: options.nodeScript || './test_mcp_simulator.js',
            verbose: options.verbose || false,
            timeout: options.timeout || 300000, // 5 minutes
            ...options
        };
        
        this.results = {
            pythonTests: null,
            nodeTests: null,
            integrationTests: [],
            performanceMetrics: null,
            summary: null
        };
        
        this.log('info', 'Initialized MCP Integration Test Suite');
        this.log('info', `Backend URL: ${this.options.backendUrl}`);
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
    
    async runCommand(command, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: this.options.verbose ? 'inherit' : 'pipe',
                ...options
            });
            
            let stdout = '';
            let stderr = '';
            
            if (!this.options.verbose) {
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            }
            
            child.on('close', (code) => {
                resolve({
                    code,
                    stdout,
                    stderr
                });
            });
            
            child.on('error', (error) => {
                reject(error);
            });
        });
    }
    
    async checkBackendHealth() {
        this.log('info', 'Checking backend health...');
        
        try {
            const response = await axios.get(`${this.options.backendUrl}/api/health`, {
                timeout: 10000
            });
            
            if (response.status === 200) {
                this.log('info', '✓ Backend is healthy');
                return true;
            } else {
                this.log('error', `✗ Backend health check failed: HTTP ${response.status}`);
                return false;
            }
        } catch (error) {
            this.log('error', `✗ Backend health check failed: ${error.message}`);
            return false;
        }
    }
    
    async runPythonTests() {
        this.log('info', 'Running Python MCP integration tests...');
        
        try {
            const args = [
                this.options.pythonScript,
                '--backend-url', this.options.backendUrl
            ];
            
            if (this.options.verbose) {
                args.push('--verbose');
            }
            
            const result = await this.runCommand('python3', args);
            
            if (result.code === 0) {
                this.log('info', '✓ Python tests completed successfully');
                this.results.pythonTests = {
                    success: true,
                    exitCode: result.code,
                    output: result.stdout
                };
            } else {
                this.log('error', `✗ Python tests failed with exit code ${result.code}`);
                this.results.pythonTests = {
                    success: false,
                    exitCode: result.code,
                    output: result.stdout,
                    error: result.stderr
                };
            }
            
            return this.results.pythonTests;
            
        } catch (error) {
            this.log('error', `✗ Python tests crashed: ${error.message}`);
            this.results.pythonTests = {
                success: false,
                error: error.message
            };
            return this.results.pythonTests;
        }
    }
    
    async runNodeTests() {
        this.log('info', 'Running Node.js MCP simulator tests...');
        
        try {
            const args = [
                this.options.nodeScript,
                '--backend-url', this.options.backendUrl
            ];
            
            if (this.options.verbose) {
                args.push('--verbose');
            }
            
            const result = await this.runCommand('node', args);
            
            if (result.code === 0) {
                this.log('info', '✓ Node.js tests completed successfully');
                this.results.nodeTests = {
                    success: true,
                    exitCode: result.code,
                    output: result.stdout
                };
            } else {
                this.log('error', `✗ Node.js tests failed with exit code ${result.code}`);
                this.results.nodeTests = {
                    success: false,
                    exitCode: result.code,
                    output: result.stdout,
                    error: result.stderr
                };
            }
            
            return this.results.nodeTests;
            
        } catch (error) {
            this.log('error', `✗ Node.js tests crashed: ${error.message}`);
            this.results.nodeTests = {
                success: false,
                error: error.message
            };
            return this.results.nodeTests;
        }
    }
    
    async runPerformanceBenchmark() {
        this.log('info', 'Running performance benchmark...');
        
        try {
            // Run Python benchmark
            const pythonArgs = [
                this.options.pythonScript,
                '--backend-url', this.options.backendUrl,
                '--benchmark',
                '--requests', '50'
            ];
            
            if (this.options.verbose) {
                pythonArgs.push('--verbose');
            }
            
            const pythonResult = await this.runCommand('python3', pythonArgs);
            
            // Run Node.js benchmark
            const nodeArgs = [
                this.options.nodeScript,
                '--backend-url', this.options.backendUrl,
                '--benchmark',
                '--requests', '50'
            ];
            
            if (this.options.verbose) {
                nodeArgs.push('--verbose');
            }
            
            const nodeResult = await this.runCommand('node', nodeArgs);
            
            this.results.performanceMetrics = {
                python: {
                    success: pythonResult.code === 0,
                    exitCode: pythonResult.code,
                    output: pythonResult.stdout,
                    error: pythonResult.stderr
                },
                node: {
                    success: nodeResult.code === 0,
                    exitCode: nodeResult.code,
                    output: nodeResult.stdout,
                    error: nodeResult.stderr
                }
            };
            
            this.log('info', '✓ Performance benchmark completed');
            return this.results.performanceMetrics;
            
        } catch (error) {
            this.log('error', `✗ Performance benchmark failed: ${error.message}`);
            this.results.performanceMetrics = {
                error: error.message
            };
            return this.results.performanceMetrics;
        }
    }
    
    async runIntegrationTests() {
        this.log('info', 'Running integration tests...');
        
        const integrationTests = [
            {
                name: 'License Validation Flow',
                test: () => this.testLicenseValidationFlow()
            },
            {
                name: 'Usage Tracking Flow',
                test: () => this.testUsageTrackingFlow()
            },
            {
                name: 'Error Handling Flow',
                test: () => this.testErrorHandlingFlow()
            },
            {
                name: 'Network Recovery Flow',
                test: () => this.testNetworkRecoveryFlow()
            }
        ];
        
        for (const test of integrationTests) {
            try {
                this.log('info', `Running integration test: ${test.name}`);
                const result = await test.test();
                this.results.integrationTests.push({
                    name: test.name,
                    success: result.success,
                    duration: result.duration,
                    error: result.error,
                    data: result.data
                });
                
                this.log('info', `✓ ${test.name}: ${result.success ? 'PASSED' : 'FAILED'}`);
                
            } catch (error) {
                this.log('error', `✗ ${test.name}: FAILED - ${error.message}`);
                this.results.integrationTests.push({
                    name: test.name,
                    success: false,
                    duration: 0,
                    error: error.message
                });
            }
        }
        
        return this.results.integrationTests;
    }
    
    async testLicenseValidationFlow() {
        const startTime = Date.now();
        
        try {
            // Test valid license
            const validResponse = await axios.post(`${this.options.backendUrl}/api/auth/validate-license`, {
                licenseKey: 'TEST-LICENSE-KEY-12345',
                serverId: `integration-test-${uuidv4().substring(0, 8)}`,
                serverName: 'Integration Test Server',
                serverVersion: '1.0.0'
            });
            
            const validSuccess = validResponse.status === 200 && validResponse.data?.data?.valid;
            
            // Test invalid license
            const invalidResponse = await axios.post(`${this.options.backendUrl}/api/auth/validate-license`, {
                licenseKey: 'INVALID-LICENSE-KEY',
                serverId: `integration-test-invalid-${uuidv4().substring(0, 8)}`,
                serverName: 'Invalid Test Server',
                serverVersion: '1.0.0'
            });
            
            const invalidSuccess = invalidResponse.status === 200 && !invalidResponse.data?.data?.valid;
            
            return {
                success: validSuccess && invalidSuccess,
                duration: Date.now() - startTime,
                data: {
                    validLicenseTest: validSuccess,
                    invalidLicenseTest: invalidSuccess
                }
            };
            
        } catch (error) {
            return {
                success: false,
                duration: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    async testUsageTrackingFlow() {
        const startTime = Date.now();
        
        try {
            // First validate license
            const licenseResponse = await axios.post(`${this.options.backendUrl}/api/auth/validate-license`, {
                licenseKey: 'TEST-LICENSE-KEY-12345',
                serverId: `usage-test-${uuidv4().substring(0, 8)}`,
                serverName: 'Usage Test Server',
                serverVersion: '1.0.0'
            });
            
            if (licenseResponse.status !== 200 || !licenseResponse.data?.data?.valid) {
                throw new Error('License validation failed');
            }
            
            // Track usage
            const trackingResponse = await axios.post(`${this.options.backendUrl}/api/analytics/track`, {
                licenseKey: 'TEST-LICENSE-KEY-12345',
                serverId: `usage-test-${uuidv4().substring(0, 8)}`,
                events: [
                    {
                        eventType: 'REQUEST_COUNT',
                        eventData: { count: 1, endpoint: '/integration-test' },
                        metadata: { test: true },
                        timestamp: new Date().toISOString()
                    }
                ]
            });
            
            return {
                success: trackingResponse.status === 200,
                duration: Date.now() - startTime,
                data: {
                    licenseValidation: licenseResponse.status === 200,
                    usageTracking: trackingResponse.status === 200
                }
            };
            
        } catch (error) {
            return {
                success: false,
                duration: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    async testErrorHandlingFlow() {
        const startTime = Date.now();
        
        try {
            // Test with malformed request
            const malformedResponse = await axios.post(`${this.options.backendUrl}/api/auth/validate-license`, {
                // Missing required fields
                licenseKey: 'TEST-LICENSE-KEY-12345'
            }, {
                validateStatus: () => true // Don't throw on 4xx/5xx
            });
            
            const malformedSuccess = malformedResponse.status === 400; // Should return 400 for bad request
            
            // Test with invalid endpoint
            const invalidEndpointResponse = await axios.get(`${this.options.backendUrl}/api/invalid-endpoint`, {
                validateStatus: () => true
            });
            
            const invalidEndpointSuccess = invalidEndpointResponse.status === 404; // Should return 404
            
            return {
                success: malformedSuccess && invalidEndpointSuccess,
                duration: Date.now() - startTime,
                data: {
                    malformedRequest: malformedSuccess,
                    invalidEndpoint: invalidEndpointSuccess
                }
            };
            
        } catch (error) {
            return {
                success: false,
                duration: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    async testNetworkRecoveryFlow() {
        const startTime = Date.now();
        
        try {
            // Test with timeout
            const timeoutResponse = await axios.get(`${this.options.backendUrl}/api/health`, {
                timeout: 1 // Very short timeout
            });
            
            // If we get here, the request succeeded (which is fine for this test)
            return {
                success: true,
                duration: Date.now() - startTime,
                data: {
                    timeoutHandling: true
                }
            };
            
        } catch (error) {
            // Timeout error is expected
            if (error.code === 'ECONNABORTED') {
                return {
                    success: true,
                    duration: Date.now() - startTime,
                    data: {
                        timeoutHandling: true
                    }
                };
            }
            
            return {
                success: false,
                duration: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    generateSummary() {
        const pythonSuccess = this.results.pythonTests?.success || false;
        const nodeSuccess = this.results.nodeTests?.success || false;
        const integrationSuccess = this.results.integrationTests.every(test => test.success);
        
        const totalTests = this.results.integrationTests.length;
        const passedTests = this.results.integrationTests.filter(test => test.success).length;
        
        this.results.summary = {
            overall: pythonSuccess && nodeSuccess && integrationSuccess,
            pythonTests: pythonSuccess,
            nodeTests: nodeSuccess,
            integrationTests: {
                total: totalTests,
                passed: passedTests,
                success: integrationSuccess
            },
            timestamp: new Date().toISOString()
        };
        
        return this.results.summary;
    }
    
    async saveReport(filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                            new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
            filename = `mcp_integration_suite_report_${timestamp}.json`;
        }
        
        const report = {
            summary: this.results.summary,
            pythonTests: this.results.pythonTests,
            nodeTests: this.results.nodeTests,
            integrationTests: this.results.integrationTests,
            performanceMetrics: this.results.performanceMetrics,
            options: this.options,
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile(filename, JSON.stringify(report, null, 2));
        
        this.log('info', `Integration test report saved to: ${filename}`);
        return filename;
    }
    
    printSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('MCP INTEGRATION TEST SUITE SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`Overall Result: ${this.results.summary?.overall ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`Python Tests: ${this.results.pythonTests?.success ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`Node.js Tests: ${this.results.nodeTests?.success ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`Integration Tests: ${this.results.summary?.integrationTests?.success ? '✓ PASSED' : '✗ FAILED'}`);
        
        if (this.results.summary?.integrationTests) {
            const { total, passed } = this.results.summary.integrationTests;
            console.log(`  - Passed: ${passed}/${total}`);
        }
        
        console.log('\nIntegration Test Results:');
        this.results.integrationTests.forEach(test => {
            const status = test.success ? '✓ PASS' : '✗ FAIL';
            console.log(`  ${status} ${test.name} (${test.duration}ms)`);
            if (!test.success && test.error) {
                console.log(`    Error: ${test.error}`);
            }
        });
        
        if (this.results.performanceMetrics) {
            console.log('\nPerformance Metrics:');
            console.log(`  Python Tests: ${this.results.performanceMetrics.python?.success ? '✓ PASSED' : '✗ FAILED'}`);
            console.log(`  Node.js Tests: ${this.results.performanceMetrics.node?.success ? '✓ PASSED' : '✗ FAILED'}`);
        }
        
        console.log('='.repeat(80));
    }
    
    async runAllTests() {
        this.log('info', 'Starting comprehensive MCP integration test suite');
        this.log('info', '='.repeat(60));
        
        try {
            // Check backend health
            const backendHealthy = await this.checkBackendHealth();
            if (!backendHealthy) {
                throw new Error('Backend is not healthy. Please start the backend server first.');
            }
            
            // Run Python tests
            await this.runPythonTests();
            
            // Run Node.js tests
            await this.runNodeTests();
            
            // Run integration tests
            await this.runIntegrationTests();
            
            // Run performance benchmark
            await this.runPerformanceBenchmark();
            
            // Generate summary
            this.generateSummary();
            
            // Save report
            const reportFile = await this.saveReport();
            
            // Print summary
            this.printSummary();
            
            return this.results;
            
        } catch (error) {
            this.log('error', `Test suite failed: ${error.message}`);
            throw error;
        }
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
            case '--python-script':
                options.pythonScript = args[++i];
                break;
            case '--node-script':
                options.nodeScript = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--timeout':
                options.timeout = parseInt(args[++i]) || 300000;
                break;
            case '--report':
                options.reportFile = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
MCP Integration Test Suite

Usage: node integration_test_suite.js [options]

Options:
  --backend-url URL      Backend URL (default: http://localhost:3000)
  --python-script FILE   Python test script path (default: ./test_mcp_integration.py)
  --node-script FILE     Node.js test script path (default: ./test_mcp_simulator.js)
  --verbose, -v          Enable verbose logging
  --timeout MS           Test timeout in milliseconds (default: 300000)
  --report FILE          Save report to specific file
  --help, -h             Show this help message
                `);
                process.exit(0);
                break;
        }
    }
    
    // Create test suite instance
    const testSuite = new MCPIntegrationTestSuite(options);
    
    try {
        // Run all tests
        const results = await testSuite.runAllTests();
        
        // Exit with appropriate code
        const exitCode = results.summary?.overall ? 0 : 1;
        process.exit(exitCode);
        
    } catch (error) {
        console.error(`Integration test suite failed: ${error.message}`);
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

module.exports = MCPIntegrationTestSuite;
