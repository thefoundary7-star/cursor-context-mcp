# MCP Integration Testing Guide

This guide provides comprehensive instructions for testing the integration between your Python MCP server and Node.js backend.

## Overview

The testing suite includes:
- **Python Integration Tests** (`test_mcp_integration.py`) - Tests MCP→Node.js communication
- **Node.js Simulator Tests** (`test_mcp_simulator.js`) - Simulates MCP requests from server perspective
- **Integration Test Suite** (`integration_test_suite.js`) - Orchestrates all tests
- **Debug Monitor** (`debug_monitor.py`) - Real-time debugging and monitoring
- **Network Monitor** (`network_monitor.js`) - Network health monitoring
- **Performance Benchmark** (`performance_benchmark.py`) - Load and performance testing
- **Test Runner** (`test_runner.py`) - Unified test execution interface

## Quick Start

### 1. Prerequisites

Ensure you have the following installed:
```bash
# Python dependencies
pip install aiohttp requests psutil

# Node.js dependencies
npm install axios uuid

# Make scripts executable
chmod +x *.py *.js
```

### 2. Start Backend Server

Make sure your Node.js backend is running:
```bash
npm start
# or
node src/server.ts
```

### 3. Run Quick Tests

```bash
# Run basic connectivity and integration tests
python test_runner.py --quick

# Or run individual tests
python test_mcp_integration.py
node test_mcp_simulator.js
```

## Test Categories

### 1. Communication Flow Tests

Test the basic communication between Python MCP server and Node.js backend.

**Python Tests:**
```bash
python test_mcp_integration.py --backend-url http://localhost:3000
```

**Node.js Tests:**
```bash
node test_mcp_simulator.js --backend-url http://localhost:3000
```

**What's Tested:**
- ✅ Backend connectivity
- ✅ License validation (valid/invalid)
- ✅ Usage tracking data transmission
- ✅ Network failure recovery
- ✅ Authentication flow

### 2. Integration Tests

Run comprehensive integration tests that combine both Python and Node.js testing.

```bash
node integration_test_suite.js --verbose
```

**What's Tested:**
- ✅ End-to-end workflow
- ✅ License validation flow
- ✅ Usage tracking flow
- ✅ Error handling flow
- ✅ Network recovery flow

### 3. Performance Tests

Benchmark the performance of your MCP integration.

```bash
# Load test
python performance_benchmark.py --test-type load --concurrent 10 --duration 60

# Stress test
python performance_benchmark.py --test-type stress --max-concurrent 50 --duration 120

# Endurance test
python performance_benchmark.py --test-type endurance --concurrent 5 --duration 300
```

**Performance Targets:**
- Average response time: < 500ms
- 95th percentile: < 2 seconds
- Throughput: > 50 requests/second
- Error rate: < 1%

### 4. Monitoring and Debugging

Real-time monitoring and debugging tools.

**Debug Monitor:**
```bash
python debug_monitor.py --interactive
```

**Network Monitor:**
```bash
node network_monitor.js --interactive
```

**Features:**
- Real-time request/response logging
- Network timing measurements
- Error tracking and reporting
- Connection status monitoring
- Performance metrics collection

## Test Scenarios

### Scenario 1: Valid License Validation

```bash
# Test valid license key
python test_mcp_integration.py --test license-validation-valid
```

**Expected Results:**
- HTTP 200 response
- `valid: true` in response
- Server registration successful
- Response time < 500ms

### Scenario 2: Invalid License Handling

```bash
# Test invalid license key
python test_mcp_integration.py --test license-validation-invalid
```

**Expected Results:**
- HTTP 200 response
- `valid: false` in response
- Appropriate error message
- Response time < 500ms

### Scenario 3: Usage Tracking

```bash
# Test usage tracking
python test_mcp_integration.py --test usage-tracking
```

**Expected Results:**
- Events transmitted successfully
- Data stored in backend
- Real-time metrics updated
- Quota limits enforced

### Scenario 4: Network Failure Recovery

```bash
# Test network failure handling
python test_mcp_integration.py --test network-failure
```

**Expected Results:**
- Graceful error handling
- Proper timeout management
- Retry mechanisms work
- System recovers when backend returns

### Scenario 5: Concurrent Users

```bash
# Test multiple concurrent connections
python test_mcp_integration.py --concurrent 5 --duration 300
```

**Expected Results:**
- Multiple servers can connect
- License quotas enforced per server
- No race conditions
- Data consistency maintained

## Debugging Tools

### 1. Debug Monitor

Interactive debugging tool with real-time monitoring:

```bash
python debug_monitor.py --interactive
```

**Commands:**
- `status` - Show current status
- `test <endpoint>` - Test an endpoint
- `save` - Save debug session
- `quit` - Exit monitor

### 2. Network Monitor

Network health monitoring with connection tracking:

```bash
node network_monitor.js --interactive
```

**Features:**
- Connection status monitoring
- Request/response logging
- Performance metrics
- Error analysis

### 3. Performance Benchmark

Comprehensive performance testing:

```bash
python performance_benchmark.py --test-type load --concurrent 10 --duration 60 --verbose
```

**Test Types:**
- `load` - Standard load test
- `stress` - Stress test to find breaking point
- `endurance` - Long-running stability test
- `spike` - Spike test for recovery testing

## Test Reports

All tests generate detailed reports in JSON format:

### Integration Test Reports
- `mcp_integration_test_report_YYYYMMDD_HHMMSS.json`
- `mcp_simulator_test_report_YYYYMMDD_HHMMSS.json`
- `mcp_integration_suite_report_YYYYMMDD_HHMMSS.json`

### Performance Reports
- `performance_benchmark_report_YYYYMMDD_HHMMSS.json`

### Debug Reports
- `debug_session_YYYYMMDD_HHMMSS.json`
- `network_monitor_report_YYYYMMDD_HHMMSS.json`

### Test Runner Reports
- `test_runner_report_YYYYMMDD_HHMMSS.json`

## Verification Checklist

Use the verification checklist to ensure all tests pass:

```bash
# Check prerequisites
python test_runner.py --check-prerequisites

# Run quick verification
python test_runner.py --quick

# Run full integration tests
python test_runner.py --full

# Run performance tests
python test_runner.py --performance
```

## Troubleshooting

### Common Issues

#### 1. Backend Connection Failed
```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Check backend logs
tail -f logs/mcp_server.log
```

#### 2. License Validation Fails
```bash
# Check database connection
npm run db:studio

# Verify test license exists
# Check license service configuration
```

#### 3. Performance Issues
```bash
# Monitor system resources
htop
iostat -x 1

# Check database performance
# Monitor network latency
```

#### 4. Test Scripts Fail
```bash
# Install dependencies
pip install -r requirements.txt
npm install

# Check file permissions
chmod +x *.py *.js

# Verify environment variables
```

### Debug Commands

```bash
# Verbose test output
python test_mcp_integration.py --verbose

# Save debug session
python debug_monitor.py --save-session debug.json

# Network monitoring
node network_monitor.js --verbose

# Performance profiling
python performance_benchmark.py --verbose
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: MCP Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Setup Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        npm install
        pip install -r requirements.txt
    
    - name: Start backend
      run: npm start &
    
    - name: Wait for backend
      run: sleep 10
    
    - name: Run tests
      run: python test_runner.py --quick
    
    - name: Upload reports
      uses: actions/upload-artifact@v2
      with:
        name: test-reports
        path: "*_report_*.json"
```

## Best Practices

### 1. Test Environment
- Use dedicated test database
- Set up test license keys
- Monitor system resources
- Clean up test data

### 2. Test Execution
- Run tests in isolated environment
- Use consistent test data
- Monitor test execution time
- Save all test reports

### 3. Performance Testing
- Start with low load
- Gradually increase load
- Monitor system resources
- Test under realistic conditions

### 4. Debugging
- Use verbose logging
- Save debug sessions
- Monitor network traffic
- Check system logs

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test reports
3. Use debugging tools
4. Check system logs
5. Contact the development team

---

**Last Updated:** $(date)
**Version:** 1.0.0
