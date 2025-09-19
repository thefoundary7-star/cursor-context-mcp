#!/usr/bin/env node
/**
 * Network Monitor for MCP Integration
 * ===================================
 * 
 * This tool provides real-time network monitoring and debugging for
 * the MCP integration. It includes:
 * 
 * - Real-time connection monitoring
 * - Request/response logging
 * - Performance metrics tracking
 * - Error analysis and reporting
 * - Network health dashboard
 * - Alert system for failures
 * 
 * Usage:
 *   node network_monitor.js [--backend-url URL] [--port PORT] [--verbose]
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class NetworkMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            backendUrl: options.backendUrl || 'http://localhost:3000',
            port: options.port || 8081,
            verbose: options.verbose || false,
            checkInterval: options.checkInterval || 5000, // 5 seconds
            timeout: options.timeout || 10000,
            ...options
        };
        
        // Data storage
        this.connectionHistory = [];
        this.requestLogs = [];
        this.performanceMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            requestsPerSecond: 0,
            errorRate: 0,
            lastUpdated: null
        };
        
        // Statistics
        this.stats = {
            requestsByEndpoint: new Map(),
            requestsByStatus: new Map(),
            errorsByType: new Map(),
            responseTimes: [],
            hourlyStats: new Map()
        };
        
        // Monitoring state
        this.isMonitoring = false;
        this.monitorInterval = null;
        this.startTime = null;
        
        // Create axios instance
        this.httpClient = axios.create({
            baseURL: this.options.backendUrl,
            timeout: this.options.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MCP-Network-Monitor/1.0'
            }
        });
        
        // Set up interceptors
        this.setupInterceptors();
        
        this.log('info', 'Initialized Network Monitor');
        this.log('info', `Backend URL: ${this.options.backendUrl}`);
        this.log('info', `Monitor Port: ${this.options.port}`);
    }
    
    setupInterceptors() {
        // Request interceptor
        this.httpClient.interceptors.request.use(
            (config) => {
                config.metadata = {
                    startTime: Date.now(),
                    requestId: uuidv4()
                };
                
                if (this.options.verbose) {
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
                const duration = Date.now() - response.config.metadata.startTime;
                response.config.metadata.duration = duration;
                
                // Log the request
                this.logRequest({
                    id: response.config.metadata.requestId,
                    timestamp: new Date().toISOString(),
                    method: response.config.method.toUpperCase(),
                    url: response.config.url,
                    status: response.status,
                    duration,
                    success: true,
                    data: response.data
                });
                
                if (this.options.verbose) {
                    this.log('debug', `Response: ${response.status} (${duration}ms)`);
                    this.log('debug', `Response data: ${JSON.stringify(response.data, null, 2)}`);
                }
                
                return response;
            },
            (error) => {
                const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
                
                // Log the failed request
                this.logRequest({
                    id: error.config?.metadata?.requestId || uuidv4(),
                    timestamp: new Date().toISOString(),
                    method: error.config?.method?.toUpperCase() || 'UNKNOWN',
                    url: error.config?.url || 'UNKNOWN',
                    status: error.response?.status || 0,
                    duration,
                    success: false,
                    error: error.message,
                    data: error.response?.data
                });
                
                if (this.options.verbose) {
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
    
    logRequest(requestLog) {
        // Add to request logs (keep last 1000)
        this.requestLogs.push(requestLog);
        if (this.requestLogs.length > 1000) {
            this.requestLogs.shift();
        }
        
        // Update statistics
        this.stats.requestsByEndpoint.set(
            requestLog.url,
            (this.stats.requestsByEndpoint.get(requestLog.url) || 0) + 1
        );
        
        this.stats.requestsByStatus.set(
            requestLog.status,
            (this.stats.requestsByStatus.get(requestLog.status) || 0) + 1
        );
        
        if (requestLog.error) {
            this.stats.errorsByType.set(
                requestLog.error,
                (this.stats.errorsByType.get(requestLog.error) || 0) + 1
            );
        }
        
        if (requestLog.duration) {
            this.stats.responseTimes.push(requestLog.duration);
            if (this.stats.responseTimes.length > 100) {
                this.stats.responseTimes.shift();
            }
        }
        
        // Update hourly stats
        const hour = new Date().toISOString().substring(0, 13) + ':00:00';
        const hourlyStats = this.stats.hourlyStats.get(hour) || {
            requests: 0,
            errors: 0,
            totalResponseTime: 0,
            responseCount: 0
        };
        
        hourlyStats.requests++;
        if (requestLog.error) {
            hourlyStats.errors++;
        }
        if (requestLog.duration) {
            hourlyStats.totalResponseTime += requestLog.duration;
            hourlyStats.responseCount++;
        }
        
        this.stats.hourlyStats.set(hour, hourlyStats);
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Emit event
        this.emit('request', requestLog);
        
        if (this.options.verbose) {
            this.printRequestLog(requestLog);
        }
    }
    
    printRequestLog(requestLog) {
        const status = requestLog.success ? '✓' : '✗';
        const duration = `${requestLog.duration}ms`;
        
        console.log(`${status} ${requestLog.method} ${requestLog.url} -> ${requestLog.status} (${duration})`);
        
        if (requestLog.error) {
            console.log(`  Error: ${requestLog.error}`);
        }
    }
    
    updatePerformanceMetrics() {
        const totalRequests = this.requestLogs.length;
        const successfulRequests = this.requestLogs.filter(log => log.success).length;
        const failedRequests = totalRequests - successfulRequests;
        
        const responseTimes = this.stats.responseTimes;
        const averageResponseTime = responseTimes.length > 0 
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
            : 0;
        
        const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
        const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
        
        // Calculate requests per second (last minute)
        const oneMinuteAgo = Date.now() - 60000;
        const recentRequests = this.requestLogs.filter(log => 
            new Date(log.timestamp).getTime() > oneMinuteAgo
        );
        const requestsPerSecond = recentRequests.length / 60;
        
        const errorRate = totalRequests > 0 ? (failedRequests / totalRequests * 100) : 0;
        
        this.performanceMetrics = {
            totalRequests,
            successfulRequests,
            failedRequests,
            averageResponseTime,
            minResponseTime,
            maxResponseTime,
            requestsPerSecond,
            errorRate,
            lastUpdated: new Date().toISOString()
        };
    }
    
    async checkConnection() {
        try {
            const startTime = Date.now();
            const response = await this.httpClient.get('/api/health');
            const duration = Date.now() - startTime;
            
            const connectionStatus = {
                timestamp: new Date().toISOString(),
                isConnected: true,
                responseTime: duration,
                status: response.status,
                error: null
            };
            
            this.connectionHistory.push(connectionStatus);
            if (this.connectionHistory.length > 100) {
                this.connectionHistory.shift();
            }
            
            this.emit('connection', connectionStatus);
            return connectionStatus;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            const connectionStatus = {
                timestamp: new Date().toISOString(),
                isConnected: false,
                responseTime: duration,
                status: 0,
                error: error.message
            };
            
            this.connectionHistory.push(connectionStatus);
            if (this.connectionHistory.length > 100) {
                this.connectionHistory.shift();
            }
            
            this.emit('connection', connectionStatus);
            this.emit('connectionError', error);
            return connectionStatus;
        }
    }
    
    startMonitoring() {
        if (this.isMonitoring) {
            this.log('warn', 'Monitoring is already running');
            return;
        }
        
        this.isMonitoring = true;
        this.startTime = new Date();
        
        // Start periodic connection checks
        this.monitorInterval = setInterval(() => {
            this.checkConnection();
        }, this.options.checkInterval);
        
        this.log('info', 'Network monitoring started');
        
        // Set up event listeners
        this.on('connectionError', (error) => {
            this.log('error', `Connection error: ${error.message}`);
        });
        
        this.on('request', (requestLog) => {
            if (!requestLog.success) {
                this.log('warn', `Request failed: ${requestLog.method} ${requestLog.url} - ${requestLog.error}`);
            }
        });
    }
    
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        this.log('info', 'Network monitoring stopped');
    }
    
    async makeTestRequest(endpoint, method = 'GET', data = null) {
        try {
            const response = await this.httpClient.request({
                method,
                url: endpoint,
                data
            });
            
            return {
                success: true,
                status: response.status,
                data: response.data,
                duration: response.config.metadata.duration
            };
            
        } catch (error) {
            return {
                success: false,
                status: error.response?.status || 0,
                error: error.message,
                duration: error.config?.metadata?.duration || 0
            };
        }
    }
    
    getStatusReport() {
        const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const recentConnections = this.connectionHistory.slice(-10);
        const recentRequests = this.requestLogs.slice(-10);
        
        return {
            monitoring: {
                isActive: this.isMonitoring,
                startTime: this.startTime?.toISOString(),
                uptime: uptime,
                checkInterval: this.options.checkInterval
            },
            connection: {
                current: recentConnections[recentConnections.length - 1],
                history: recentConnections,
                successRate: this.calculateConnectionSuccessRate()
            },
            performance: this.performanceMetrics,
            statistics: {
                requestsByEndpoint: Object.fromEntries(this.stats.requestsByEndpoint),
                requestsByStatus: Object.fromEntries(this.stats.requestsByStatus),
                errorsByType: Object.fromEntries(this.stats.errorsByType),
                hourlyStats: Object.fromEntries(this.stats.hourlyStats)
            },
            recentRequests,
            timestamp: new Date().toISOString()
        };
    }
    
    calculateConnectionSuccessRate() {
        if (this.connectionHistory.length === 0) {
            return 0;
        }
        
        const successfulConnections = this.connectionHistory.filter(conn => conn.isConnected).length;
        return (successfulConnections / this.connectionHistory.length) * 100;
    }
    
    printStatus() {
        console.log('\n' + '='.repeat(60));
        console.log('NETWORK MONITOR STATUS');
        console.log('='.repeat(60));
        
        // Monitoring status
        console.log(`Monitoring: ${this.isMonitoring ? '✓ ACTIVE' : '✗ INACTIVE'}`);
        if (this.startTime) {
            const uptime = Date.now() - this.startTime.getTime();
            console.log(`Uptime: ${Math.floor(uptime / 1000)}s`);
        }
        
        // Connection status
        const lastConnection = this.connectionHistory[this.connectionHistory.length - 1];
        if (lastConnection) {
            const statusIcon = lastConnection.isConnected ? '✓' : '✗';
            console.log(`Backend Connection: ${statusIcon} ${this.options.backendUrl}`);
            console.log(`Last Check: ${lastConnection.timestamp}`);
            console.log(`Response Time: ${lastConnection.responseTime}ms`);
            if (lastConnection.error) {
                console.log(`Error: ${lastConnection.error}`);
            }
        }
        
        // Performance metrics
        console.log(`\nPerformance Metrics:`);
        console.log(`  Total Requests: ${this.performanceMetrics.totalRequests}`);
        console.log(`  Successful: ${this.performanceMetrics.successfulRequests}`);
        console.log(`  Failed: ${this.performanceMetrics.failedRequests}`);
        console.log(`  Error Rate: ${this.performanceMetrics.errorRate.toFixed(2)}%`);
        console.log(`  Avg Response Time: ${this.performanceMetrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`  Requests/Second: ${this.performanceMetrics.requestsPerSecond.toFixed(2)}`);
        
        // Recent requests
        console.log(`\nRecent Requests:`);
        const recentRequests = this.requestLogs.slice(-5);
        recentRequests.forEach(log => {
            const status = log.success ? '✓' : '✗';
            console.log(`  ${status} ${log.method} ${log.url} -> ${log.status} (${log.duration}ms)`);
        });
        
        console.log('='.repeat(60));
    }
    
    async saveReport(filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                            new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
            filename = `network_monitor_report_${timestamp}.json`;
        }
        
        const report = {
            sessionInfo: {
                backendUrl: this.options.backendUrl,
                startTime: this.startTime?.toISOString(),
                endTime: new Date().toISOString(),
                totalRequests: this.requestLogs.length
            },
            statusReport: this.getStatusReport(),
            connectionHistory: this.connectionHistory,
            requestLogs: this.requestLogs,
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile(filename, JSON.stringify(report, null, 2));
        
        this.log('info', `Network monitor report saved to: ${filename}`);
        return filename;
    }
    
    interactiveMode() {
        this.startMonitoring();
        
        console.log('\nNetwork Monitor - Interactive Mode');
        console.log('Commands:');
        console.log('  status - Show current status');
        console.log('  test <endpoint> - Test an endpoint');
        console.log('  save - Save monitor report');
        console.log('  quit - Exit monitor');
        console.log();
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const prompt = () => {
            rl.question('monitor> ', async (input) => {
                const command = input.trim().split(' ');
                
                if (command.length === 0) {
                    prompt();
                    return;
                }
                
                const cmd = command[0].toLowerCase();
                
                switch (cmd) {
                    case 'quit':
                    case 'exit':
                        rl.close();
                        this.stopMonitoring();
                        break;
                        
                    case 'status':
                        this.printStatus();
                        prompt();
                        break;
                        
                    case 'test':
                        if (command.length < 2) {
                            console.log('Usage: test <endpoint>');
                            prompt();
                            return;
                        }
                        
                        const endpoint = command[1];
                        console.log(`Testing endpoint: ${endpoint}`);
                        
                        const result = await this.makeTestRequest(endpoint);
                        console.log(`Result: ${result.status} (${result.duration}ms)`);
                        if (!result.success) {
                            console.log(`Error: ${result.error}`);
                        }
                        
                        prompt();
                        break;
                        
                    case 'save':
                        const filename = await this.saveReport();
                        console.log(`Monitor report saved to: ${filename}`);
                        prompt();
                        break;
                        
                    default:
                        console.log(`Unknown command: ${cmd}`);
                        prompt();
                        break;
                }
            });
        };
        
        prompt();
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
            case '--port':
                options.port = parseInt(args[++i]) || 8081;
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--interactive':
            case '-i':
                options.interactive = true;
                break;
            case '--save-report':
                options.saveReport = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
Network Monitor for MCP Integration

Usage: node network_monitor.js [options]

Options:
  --backend-url URL     Backend URL (default: http://localhost:3000)
  --port PORT          Monitor port (default: 8081)
  --verbose, -v        Enable verbose logging
  --interactive, -i    Run in interactive mode
  --save-report FILE   Save monitor report to file
  --help, -h           Show this help message
                `);
                process.exit(0);
                break;
        }
    }
    
    // Create monitor instance
    const monitor = new NetworkMonitor(options);
    
    try {
        if (options.interactive) {
            monitor.interactiveMode();
        } else {
            // Run basic monitoring
            monitor.startMonitoring();
            
            // Keep running until interrupted
            process.on('SIGINT', () => {
                console.log('\nShutting down network monitor...');
                monitor.stopMonitoring();
                
                if (options.saveReport) {
                    monitor.saveReport(options.saveReport);
                }
                
                process.exit(0);
            });
            
            // Keep the process alive
            setInterval(() => {
                // Just keep running
            }, 1000);
        }
        
    } catch (error) {
        console.error(`Network monitor failed: ${error.message}`);
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

module.exports = NetworkMonitor;
