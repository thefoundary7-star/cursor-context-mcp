#!/usr/bin/env node

/**
 * Direct MCP Tool Execution Script
 * Executes each MCP tool and collects results
 */

const { spawn } = require('child_process');
const { writeFileSync } = require('fs');

const SANDBOX_DIR = '/c/Users/manay/Desktop/cursor-context-mcp/mcp-sandbox';
const TEST_TIMEOUT = 15000; // 15 seconds per tool

// Results collector
const results = {
    success: 0,
    warnings: 0,
    failures: 0,
    skipped: 0,
    toolResults: []
};

console.log('🚀 Executing MCP Tools Direct Test');
console.log(`📁 Target Directory: ${SANDBOX_DIR}`);
console.log('=' .repeat(80));

// Helper function to execute a single MCP tool
async function executeMCPTool(toolName, args = {}) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, ['dist/index.js'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasTimedOut = false;

        const timeout = setTimeout(() => {
            hasTimedOut = true;
            child.kill();
            resolve({
                tool: toolName,
                success: false,
                status: 'timeout',
                message: 'Execution timed out',
                data: null,
                executionTime: TEST_TIMEOUT
            });
        }, TEST_TIMEOUT);

        const startTime = Date.now();

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        // Send MCP protocol messages
        const initMessage = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test-client", version: "1.0.0" }
            }
        };

        const toolMessage = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: { directory: SANDBOX_DIR, ...args }
            }
        };

        try {
            child.stdin.write(JSON.stringify(initMessage) + '\n');
            child.stdin.write(JSON.stringify(toolMessage) + '\n');
            child.stdin.end();
        } catch (error) {
            if (!hasTimedOut) {
                clearTimeout(timeout);
                resolve({
                    tool: toolName,
                    success: false,
                    status: 'error',
                    message: `Input error: ${error.message}`,
                    data: null,
                    executionTime: Date.now() - startTime
                });
            }
            return;
        }

        child.on('close', (code) => {
            if (hasTimedOut) return;

            clearTimeout(timeout);
            const executionTime = Date.now() - startTime;

            try {
                // Parse output for JSON responses
                const lines = output.split('\n').filter(line => line.trim());
                let toolResult = null;
                let errorResult = null;

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.id === 2) {
                            if (parsed.result) {
                                toolResult = parsed.result;
                            } else if (parsed.error) {
                                errorResult = parsed.error;
                            }
                            break;
                        }
                    } catch (e) {
                        // Skip non-JSON lines
                    }
                }

                if (errorResult) {
                    resolve({
                        tool: toolName,
                        success: false,
                        status: 'error',
                        message: errorResult.message || 'Tool execution error',
                        data: errorResult,
                        executionTime
                    });
                } else if (toolResult) {
                    // Check result for success indicators
                    const resultStr = JSON.stringify(toolResult);
                    let status = 'success';
                    let message = 'Executed successfully';

                    // Check for common error patterns
                    if (resultStr.includes('"error"') ||
                        resultStr.includes('"failed"') ||
                        resultStr.includes('Unable to') ||
                        resultStr.includes('not found') ||
                        resultStr.includes('ENOENT')) {
                        status = 'warning';
                        message = 'Executed with warnings/issues';
                    }

                    // Extract key metrics if available
                    let metrics = {};
                    try {
                        if (resultStr.includes('healthScore')) {
                            const match = resultStr.match(/"healthScore"\s*:\s*(\d+)/);
                            if (match) metrics.healthScore = parseInt(match[1]);
                        }
                        if (resultStr.includes('coverage')) {
                            const match = resultStr.match(/"coverage"\s*:\s*(\d+)/);
                            if (match) metrics.coverage = parseInt(match[1]);
                        }
                        if (resultStr.includes('vulnerabilities')) {
                            metrics.hasSecurityData = true;
                        }
                        if (resultStr.includes('totalFiles')) {
                            const match = resultStr.match(/"totalFiles"\s*:\s*(\d+)/);
                            if (match) metrics.totalFiles = parseInt(match[1]);
                        }
                    } catch (e) {}

                    resolve({
                        tool: toolName,
                        success: status === 'success',
                        status,
                        message,
                        data: toolResult,
                        metrics,
                        executionTime
                    });
                } else {
                    resolve({
                        tool: toolName,
                        success: false,
                        status: 'no_response',
                        message: 'No valid response received',
                        data: null,
                        executionTime
                    });
                }
            } catch (error) {
                resolve({
                    tool: toolName,
                    success: false,
                    status: 'parse_error',
                    message: `Parse error: ${error.message}`,
                    data: null,
                    executionTime
                });
            }
        });

        child.on('error', (error) => {
            if (hasTimedOut) return;
            clearTimeout(timeout);

            resolve({
                tool: toolName,
                success: false,
                status: 'spawn_error',
                message: `Spawn error: ${error.message}`,
                data: null,
                executionTime: Date.now() - startTime
            });
        });
    });
}

// Tools to test with their configurations
const toolsToTest = [
    { name: 'self_test', args: { mode: 'quick' } },
    { name: 'detect_test_framework', args: {} },
    { name: 'project_health_check', args: {} },
    { name: 'documentation_coverage', args: {} },
    { name: 'analyze_dependencies', args: {} },
    { name: 'security_audit', args: {} },
    { name: 'check_vulnerabilities', args: {} },
    { name: 'license_compliance_check', args: {} },
    { name: 'get_commit_history', args: { limit: 10 } },
    { name: 'get_branch_info', args: {} },
    { name: 'get_file_blame', args: { filePath: 'src/index.js' } },
    { name: 'find_commits_touching_file', args: { filePath: 'src/index.js', limit: 5 } },
    { name: 'run_tests', args: {} },
    { name: 'test_coverage_analysis', args: {} },
    { name: 'run_test_file', args: { filePath: 'tests/app.test.js' } },
    { name: 'ide_feedback_stream', args: {} },
    { name: 'ci_health_gate', args: { threshold: 70 } },
    { name: 'generate_project_report', args: { format: 'markdown' } }
];

// Execute all tools
async function executeAllTools() {
    console.log(`📋 Testing ${toolsToTest.length} tools...\n`);

    for (let i = 0; i < toolsToTest.length; i++) {
        const { name, args } = toolsToTest[i];

        process.stdout.write(`[${String(i + 1).padStart(2)}/${toolsToTest.length}] ${name.padEnd(30)} `);

        const result = await executeMCPTool(name, args);

        let statusIcon = '';
        switch (result.status) {
            case 'success': statusIcon = '✅'; results.success++; break;
            case 'warning': statusIcon = '⚠️'; results.warnings++; break;
            default: statusIcon = '❌'; results.failures++; break;
        }

        console.log(`${statusIcon} ${result.message} (${result.executionTime}ms)`);

        // Show key metrics if available
        if (result.metrics && Object.keys(result.metrics).length > 0) {
            const metrics = [];
            if (result.metrics.healthScore !== undefined) metrics.push(`Health: ${result.metrics.healthScore}%`);
            if (result.metrics.coverage !== undefined) metrics.push(`Coverage: ${result.metrics.coverage}%`);
            if (result.metrics.totalFiles !== undefined) metrics.push(`Files: ${result.metrics.totalFiles}`);
            if (result.metrics.hasSecurityData) metrics.push('Security data available');

            if (metrics.length > 0) {
                console.log(`    📊 ${metrics.join(' | ')}`);
            }
        }

        results.toolResults.push(result);
    }

    // Generate summary report
    console.log('\n' + '=' .repeat(80));
    console.log('📊 EXECUTION RESULTS SUMMARY');
    console.log('=' .repeat(80));

    console.log(`✅ Successful: ${results.success}`);
    console.log(`⚠️  Warnings: ${results.warnings}`);
    console.log(`❌ Failed: ${results.failures}`);
    console.log(`📋 Total: ${results.toolResults.length}`);

    const healthScore = results.toolResults.length > 0
        ? Math.round((results.success + results.warnings * 0.5) / results.toolResults.length * 100)
        : 0;
    console.log(`🏥 Overall Health Score: ${healthScore}%`);

    // Show successful tools
    const successfulTools = results.toolResults.filter(r => r.success);
    if (successfulTools.length > 0) {
        console.log('\n🌟 Successfully Executed:');
        successfulTools.forEach(tool => {
            console.log(`   ✅ ${tool.tool}`);
        });
    }

    // Show tools with warnings
    const warningTools = results.toolResults.filter(r => r.status === 'warning');
    if (warningTools.length > 0) {
        console.log('\n⚠️  Tools with Warnings:');
        warningTools.forEach(tool => {
            console.log(`   ⚠️  ${tool.tool}: ${tool.message}`);
        });
    }

    // Show failed tools
    const failedTools = results.toolResults.filter(r => !r.success && r.status !== 'warning');
    if (failedTools.length > 0) {
        console.log('\n❌ Failed Tools:');
        failedTools.forEach(tool => {
            console.log(`   ❌ ${tool.tool}: ${tool.message}`);
        });
    }

    // Save detailed results
    const reportPath = `./mcp_execution_results_${Date.now()}.json`;
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        sandboxDirectory: SANDBOX_DIR,
        summary: {
            total: results.toolResults.length,
            successful: results.success,
            warnings: results.warnings,
            failures: results.failures,
            healthScore
        },
        executionResults: results.toolResults,
        averageExecutionTime: Math.round(
            results.toolResults.reduce((sum, r) => sum + r.executionTime, 0) / results.toolResults.length
        )
    }, null, 2));

    console.log(`\n📄 Detailed results saved to: ${reportPath}`);
}

// Run the execution
executeAllTools().catch(console.error);