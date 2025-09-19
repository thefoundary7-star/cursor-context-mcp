# MCP Server Process Monitor for Claude Desktop Debugging
param(
    [int]$Duration = 60  # Monitor for 60 seconds by default
)

Write-Host "Starting MCP Process Monitor..."
Write-Host "Monitoring for $Duration seconds"
Write-Host "Looking for cursor-context-mcp processes..."
Write-Host ""

$startTime = Get-Date
$processes = @()

while ((Get-Date) -lt $startTime.AddSeconds($Duration)) {
    # Check for node processes running our MCP server
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*cursor-context-mcp*" -or
            $_.CommandLine -like "*dist\index.js*"
        }

    # Check for Claude Desktop processes
    $claudeProcesses = Get-Process -Name "*Claude*" -ErrorAction SilentlyContinue

    $timestamp = Get-Date -Format "HH:mm:ss.fff"

    foreach ($proc in $nodeProcesses) {
        $processInfo = "[$timestamp] Node MCP Server Found - PID: $($proc.Id), Command: $($proc.CommandLine)"
        Write-Host $processInfo -ForegroundColor Green
        $processes += $processInfo
    }

    if ($claudeProcesses) {
        foreach ($proc in $claudeProcesses) {
            $processInfo = "[$timestamp] Claude Desktop - PID: $($proc.Id), Name: $($proc.ProcessName)"
            Write-Host $processInfo -ForegroundColor Cyan
        }
    }

    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Monitoring complete. Summary:"
Write-Host "Total MCP server processes detected: $($processes.Count)"
if ($processes.Count -eq 0) {
    Write-Host "No MCP server processes were started by Claude Desktop" -ForegroundColor Red
    Write-Host "This indicates Claude Desktop is not attempting to launch the MCP server"
} else {
    Write-Host "MCP server processes detected:" -ForegroundColor Green
    $processes | ForEach-Object { Write-Host "  $_" }
}