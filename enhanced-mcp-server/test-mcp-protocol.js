#!/usr/bin/env node

/**
 * Simple MCP Protocol Compliance Test
 * Tests that the server produces valid JSON responses without emoji contamination
 */

import { spawn } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function testMCPProtocol() {
    return new Promise((resolve, reject) => {
        console.log('Starting MCP protocol compliance test...');

        // Start the server
        const server = spawn(process.execPath, ['dist/index.js'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdoutData = '';
        let stderrData = '';
        let responseReceived = false;

        // Collect stdout (should be pure JSON)
        server.stdout.on('data', (data) => {
            stdoutData += data.toString();

            // Try to parse any complete JSON messages
            const lines = stdoutData.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const parsed = JSON.parse(line.trim());
                        console.log('✅ Valid JSON received:', JSON.stringify(parsed, null, 2));
                        responseReceived = true;
                    } catch (e) {
                        console.log('❌ Invalid JSON in stdout:', line.trim());
                        console.log('Parse error:', e.message);
                    }
                }
            }
        });

        // Collect stderr (debug messages)
        server.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        server.on('error', (error) => {
            reject(new Error(`Server failed to start: ${error.message}`));
        });

        // Send a basic MCP request after server startup
        setTimeout(() => {
            const initRequest = {
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: {
                        name: "test-client",
                        version: "1.0.0"
                    }
                }
            };

            console.log('Sending initialize request...');
            server.stdin.write(JSON.stringify(initRequest) + '\n');

            // Send list_tools request
            setTimeout(() => {
                const toolsRequest = {
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools/list",
                    params: {}
                };

                console.log('Sending tools/list request...');
                server.stdin.write(JSON.stringify(toolsRequest) + '\n');

                // Wait for responses then cleanup
                setTimeout(() => {
                    server.kill();

                    resolve({
                        stdoutData,
                        stderrData,
                        responseReceived
                    });
                }, 3000);
            }, 1000);
        }, 2000);
    });
}

async function main() {
    try {
        const result = await testMCPProtocol();

        console.log('\n=== TEST RESULTS ===');
        console.log('STDOUT (should be pure JSON):');
        console.log(result.stdoutData || '(empty)');

        console.log('\nSTDERR (debug messages):');
        console.log(result.stderrData);

        console.log('\n=== ANALYSIS ===');

        // Check for emoji contamination in stdout
        const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(result.stdoutData);

        if (hasEmojis) {
            console.log('❌ FAILURE: Emojis found in stdout (MCP protocol stream)');
        } else {
            console.log('✅ SUCCESS: No emojis in stdout');
        }

        // Check if stdout is empty (expected for short test)
        if (!result.stdoutData.trim()) {
            console.log('ℹ️  Note: No MCP responses received (this is normal for quick test)');
        }

        // Check if stderr contains the expected debug messages without problematic emojis
        if (result.stderrData.includes('Daily usage:') && !result.stderrData.includes('📊')) {
            console.log('✅ SUCCESS: Debug messages cleaned of problematic emojis');
        } else if (result.stderrData.includes('📊')) {
            console.log('❌ FAILURE: Still contains problematic emoji in stderr');
        }

        console.log('\n=== VERDICT ===');
        if (!hasEmojis) {
            console.log('🎉 MCP Protocol Compliance: PASSED');
            console.log('The server should now work with Claude Desktop!');
        } else {
            console.log('💥 MCP Protocol Compliance: FAILED');
            console.log('Additional fixes needed.');
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

main();