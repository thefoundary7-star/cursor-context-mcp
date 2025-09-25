#!/usr/bin/env node

/**
 * Comprehensive MCP Tools Test Script
 * Executes all MCP tools systematically against the sandbox project
 */

const { spawn } = require('child_process');
const { writeFileSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

const SANDBOX_DIR = '/c/Users/manay/Desktop/cursor-context-mcp/mcp-sandbox';
const MCP_SERVER_DIR = '/c/Users/manay/Desktop/cursor-context-mcp/enhanced-mcp-server';
const TEST_TIMEOUT = 20000;

// Results collector
const results = {
    success: 0,
    warnings: 0,
    failures: 0,
    skipped: 0,
    details: []
};

console.log('🚀 Starting Comprehensive MCP Tools Test');
console.log(`📁 Sandbox Directory: ${SANDBOX_DIR}`);
console.log(`🔧 MCP Server Directory: ${MCP_SERVER_DIR}`);
console.log('=' .repeat(80));

// Helper function to run MCP tool
async function runMCPTool(toolName, args = {}) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing: ${toolName}`);

        const child = spawn(process.execPath, ['dist/index.js'], {
            cwd: MCP_SERVER_DIR,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasTimedOut = false;

        const timeout = setTimeout(() => {
            hasTimedOut = true;
            child.kill();
            resolve({
                success: false,
                status: 'failure',
                reason: 'Timeout after 20s',
                data: null
            });
        }, TEST_TIMEOUT);

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        // Send initialize request
        const initRequest = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "comprehensive-test",
                    version: "1.0.0"
                }
            }
        };

        // Send tool call request
        const toolRequest = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: { directory: SANDBOX_DIR, ...args }
            }
        };

        try {
            child.stdin.write(JSON.stringify(initRequest) + '\n');
            child.stdin.write(JSON.stringify(toolRequest) + '\n');
            child.stdin.end();
        } catch (e) {
            resolve({
                success: false,
                status: 'failure',
                reason: `Write error: ${e.message}`,
                data: null
            });
            return;
        }

        child.on('close', (code) => {
            if (hasTimedOut) return;

            clearTimeout(timeout);

            try {
                // Parse MCP responses
                const lines = output.split('\n').filter(line => line.trim());
                let toolResponse = null;
                let hasError = false;

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.id === 2 && parsed.result) {
                            toolResponse = parsed.result;
                            break;
                        }
                        if (parsed.id === 2 && parsed.error) {
                            hasError = true;
                            resolve({
                                success: false,
                                status: 'failure',
                                reason: parsed.error.message || 'Tool error',
                                data: null
                            });
                            return;
                        }
                    } catch (e) {
                        // Skip non-JSON lines
                    }
                }

                if (toolResponse && !hasError) {
                    // Check for tool-specific indicators
                    const responseStr = JSON.stringify(toolResponse);

                    if (responseStr.includes('error') || responseStr.includes('failed') ||
                        responseStr.includes('Unable') || responseStr.includes('not found')) {
                        resolve({
                            success: false,
                            status: 'warning',
                            reason: 'Tool executed with warnings/errors',
                            data: toolResponse
                        });
                    } else {
                        resolve({
                            success: true,
                            status: 'success',
                            reason: 'Executed successfully',
                            data: toolResponse
                        });
                    }
                } else if (!hasError) {
                    resolve({
                        success: false,
                        status: 'failure',
                        reason: 'No valid response received',
                        data: null
                    });
                }
            } catch (error) {
                resolve({
                    success: false,
                    status: 'failure',
                    reason: `Parse error: ${error.message}`,
                    data: null
                });
            }
        });

        child.on('error', (error) => {
            if (hasTimedOut) return;
            clearTimeout(timeout);
            resolve({
                success: false,
                status: 'failure',
                reason: `Spawn error: ${error.message}`,
                data: null
            });
        });
    });
}

// Test configuration - tools to test with their specific arguments
const toolsToTest = [
    { name: 'self_test', args: { mode: 'quick' } },
    { name: 'project_health_check', args: {} },
    { name: 'code_quality_metrics', args: {} },
    { name: 'refactoring_suggestions', args: { outputMode: 'text' } },
    { name: 'documentation_coverage', args: {} },
    { name: 'analyze_dependencies', args: {} },
    { name: 'security_audit', args: {} },
    { name: 'check_vulnerabilities', args: {} },
    { name: 'license_compliance_check', args: {} },
    { name: 'run_tests', args: {} },
    { name: 'test_coverage_analysis', args: {} },
    { name: 'detect_test_framework', args: {} },
    { name: 'get_commit_history', args: {} },
    { name: 'get_branch_info', args: {} },
    { name: 'get_file_blame', args: { filePath: 'src/index.js' } },
    { name: 'find_commits_touching_file', args: { filePath: 'src/index.js' } },
    { name: 'ide_feedback_stream', args: {} },
    { name: 'ci_health_gate', args: { threshold: 70 } },
    { name: 'generate_project_report', args: { format: 'markdown' } },
];

// Execute all tools
async function runAllTests() {
    for (let i = 0; i < toolsToTest.length; i++) {
        const { name, args } = toolsToTest[i];
        console.log(`\n[${i + 1}/${toolsToTest.length}] Running ${name}...`);

        const result = await runMCPTool(name, args);

        let statusIcon = '';
        switch (result.status) {
            case 'success': statusIcon = '✅'; results.success++; break;
            case 'warning': statusIcon = '⚠️'; results.warnings++; break;
            case 'failure': statusIcon = '❌'; results.failures++; break;
            case 'skipped': statusIcon = '⏭️'; results.skipped++; break;
        }

        console.log(`${statusIcon} ${name}: ${result.reason}`);

        // Show key data points if available
        if (result.data && typeof result.data === 'object') {
            const dataStr = JSON.stringify(result.data);
            if (dataStr.includes('healthScore')) {
                try {
                    const score = JSON.stringify(result.data).match(/"healthScore"\s*:\s*(\d+)/);
                    if (score) console.log(`   📊 Health Score: ${score[1]}`);
                } catch (e) {}
            }
            if (dataStr.includes('coverage')) {
                try {
                    const coverage = JSON.stringify(result.data).match(/"coverage"\s*:\s*(\d+)/);
                    if (coverage) console.log(`   📈 Coverage: ${coverage[1]}%`);
                } catch (e) {}
            }
            if (dataStr.includes('vulnerabilities')) {
                try {
                    console.log(`   🔒 Security data available`);
                } catch (e) {}
            }
        }

        // Store detailed results
        results.details.push({
            tool: name,
            status: result.status,
            reason: result.reason,
            hasData: !!result.data,
            dataSize: result.data ? JSON.stringify(result.data).length : 0
        });

        // Short delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate summary
    console.log('\n' + '=' .repeat(80));
    console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
    console.log('=' .repeat(80));
    console.log(`✅ Success: ${results.success}`);
    console.log(`⚠️  Warnings: ${results.warnings}`);
    console.log(`❌ Failures: ${results.failures}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`📋 Total Tools: ${results.details.length}`);

    // Calculate health score
    const total = results.success + results.warnings + results.failures;
    const healthScore = total > 0 ? Math.round((results.success + results.warnings * 0.5) / total * 100) : 0;
    console.log(`🏥 Overall Health Score: ${healthScore}%`);

    // Show top performing tools
    console.log('\n🌟 Successfully Executed Tools:');
    results.details.filter(d => d.status === 'success').forEach(d => {
        console.log(`   ✅ ${d.tool}`);
    });

    // Show tools with warnings
    if (results.warnings > 0) {
        console.log('\n⚠️  Tools with Warnings:');
        results.details.filter(d => d.status === 'warning').forEach(d => {
            console.log(`   ⚠️  ${d.tool}: ${d.reason}`);
        });
    }

    // Show failed tools
    if (results.failures > 0) {
        console.log('\n❌ Failed Tools:');
        results.details.filter(d => d.status === 'failure').forEach(d => {
            console.log(`   ❌ ${d.tool}: ${d.reason}`);
        });
    }

    // Write detailed results to file
    const reportPath = `./mcp_test_results_${Date.now()}.json`;
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        sandboxDir: SANDBOX_DIR,
        summary: {
            success: results.success,
            warnings: results.warnings,
            failures: results.failures,
            skipped: results.skipped,
            total: results.details.length,
            healthScore
        },
        details: results.details
    }, null, 2));

    console.log(`\n📄 Detailed results saved to: ${reportPath}`);
}

// Run the comprehensive test
runAllTests().catch(console.error);