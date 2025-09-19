# PowerShell MCP Server Test Script
# Tests Node.js MCP server functionality on Windows

Write-Host "🧪 MCP Server Test Script (PowerShell)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Test 1: Check if server file exists
Write-Host "`n1. Checking server files..." -ForegroundColor Yellow
$serverPath = Join-Path $PSScriptRoot "dist\index.js"
if (Test-Path $serverPath) {
    Write-Host "✅ Server file exists: $serverPath" -ForegroundColor Green
} else {
    Write-Host "❌ Server file not found: $serverPath" -ForegroundColor Red
    Write-Host "   Run 'npm run build' first" -ForegroundColor Yellow
    exit 1
}

# Test 2: Check if batch script exists
$batchPath = Join-Path $PSScriptRoot "run-mcp-server.bat"
if (Test-Path $batchPath) {
    Write-Host "✅ Batch script exists: $batchPath" -ForegroundColor Green
} else {
    Write-Host "❌ Batch script not found: $batchPath" -ForegroundColor Red
}

# Test 3: Test batch script execution
Write-Host "`n2. Testing batch script execution..." -ForegroundColor Yellow
try {
    $process = Start-Process -FilePath $batchPath -ArgumentList "" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 3
    
    if (-not $process.HasExited) {
        Write-Host "✅ Batch script started successfully" -ForegroundColor Green
        Write-Host "   PID: $($process.Id)" -ForegroundColor Gray
        $process.Kill()
        $process.WaitForExit()
    } else {
        Write-Host "❌ Batch script exited immediately" -ForegroundColor Red
        Write-Host "   Exit code: $($process.ExitCode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed to test batch script: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Test direct Node.js execution
Write-Host "`n3. Testing direct Node.js execution..." -ForegroundColor Yellow
try {
    $process = Start-Process -FilePath "node" -ArgumentList $serverPath -PassThru -WindowStyle Hidden -RedirectStandardInput -RedirectStandardOutput -RedirectStandardError
    Start-Sleep -Seconds 2
    
    if (-not $process.HasExited) {
        Write-Host "✅ Node.js server started successfully" -ForegroundColor Green
        Write-Host "   PID: $($process.Id)" -ForegroundColor Gray
        
        # Send a test message
        $testMessage = @{
            jsonrpc = "2.0"
            id = 1
            method = "initialize"
            params = @{
                protocolVersion = "2024-11-05"
                capabilities = @{}
                clientInfo = @{
                    name = "test-client"
                    version = "1.0.0"
                }
            }
        } | ConvertTo-Json -Depth 10
        
        $process.StandardInput.WriteLine($testMessage)
        Start-Sleep -Seconds 1
        
        $output = $process.StandardOutput.ReadToEnd()
        if ($output) {
            Write-Host "✅ Server responded to test message" -ForegroundColor Green
            Write-Host "   Response preview: $($output.Substring(0, [Math]::Min(100, $output.Length)))..." -ForegroundColor Gray
        } else {
            Write-Host "⚠️  No response from server" -ForegroundColor Yellow
        }
        
        $process.Kill()
        $process.WaitForExit()
    } else {
        Write-Host "❌ Node.js server exited immediately" -ForegroundColor Red
        Write-Host "   Exit code: $($process.ExitCode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed to test Node.js server: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Check Claude Desktop configuration
Write-Host "`n4. Checking Claude Desktop configuration..." -ForegroundColor Yellow
$configPath = Join-Path $PSScriptRoot "claude_desktop_config.json"
if (Test-Path $configPath) {
    Write-Host "✅ Configuration file exists: $configPath" -ForegroundColor Green
    
    try {
        $config = Get-Content $configPath | ConvertFrom-Json
        if ($config.mcpServers."cursor-context-mcp-nodejs") {
            Write-Host "✅ Node.js MCP server configuration found" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Node.js MCP server configuration not found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to parse configuration file: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Configuration file not found: $configPath" -ForegroundColor Red
}

# Test 6: Check dependencies
Write-Host "`n5. Checking dependencies..." -ForegroundColor Yellow
$packageJsonPath = Join-Path $PSScriptRoot "package.json"
if (Test-Path $packageJsonPath) {
    try {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        Write-Host "✅ Package.json found" -ForegroundColor Green
        Write-Host "   Dependencies: $($packageJson.dependencies.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Failed to parse package.json: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
if (Test-Path $nodeModulesPath) {
    Write-Host "✅ node_modules directory exists" -ForegroundColor Green
} else {
    Write-Host "❌ node_modules directory not found" -ForegroundColor Red
    Write-Host "   Run 'npm install' first" -ForegroundColor Yellow
}

# Test 7: Generate debug information
Write-Host "`n6. Generating debug information..." -ForegroundColor Yellow
$debugInfo = @{
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    environment = @{
        nodeVersion = node --version 2>$null
        npmVersion = npm --version 2>$null
        platform = $env:OS
        architecture = $env:PROCESSOR_ARCHITECTURE
        workingDirectory = $PWD.Path
    }
    files = @{
        serverExists = Test-Path $serverPath
        batchExists = Test-Path $batchPath
        configExists = Test-Path $configPath
        nodeModulesExists = Test-Path $nodeModulesPath
    }
    paths = @{
        serverPath = $serverPath
        batchPath = $batchPath
        configPath = $configPath
        workingDirectory = $PWD.Path
    }
}

$debugPath = Join-Path $PSScriptRoot "mcp-server-debug.json"
$debugInfo | ConvertTo-Json -Depth 10 | Set-Content $debugPath
Write-Host "✅ Debug information saved to: $debugPath" -ForegroundColor Green

# Summary
Write-Host "`n🎉 Test completed!" -ForegroundColor Cyan
Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. If all tests passed, your MCP server is ready for Claude Desktop" -ForegroundColor White
Write-Host "2. Restart Claude Desktop to load the new configuration" -ForegroundColor White
Write-Host "3. Check Claude Desktop logs if you encounter issues" -ForegroundColor White
Write-Host "4. Use the debug information in $debugPath for troubleshooting" -ForegroundColor White

Write-Host "`n📝 Claude Desktop Configuration:" -ForegroundColor Yellow
Write-Host "Make sure your claude_desktop_config.json includes:" -ForegroundColor White
$configExample = @{
    "cursor-context-mcp-nodejs" = @{
        command = "cmd"
        args = @("/c", $batchPath)
        cwd = $PWD.Path
        env = @{
            NODE_ENV = "production"
            MCP_SERVER_NAME = "cursor-context-mcp-nodejs"
            MCP_SERVER_VERSION = "1.0.0"
            PATH = "C:\Program Files\nodejs;%PATH%"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host $configExample -ForegroundColor Gray
