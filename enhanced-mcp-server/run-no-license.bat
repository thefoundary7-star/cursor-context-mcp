@echo off
REM Script to run the Enhanced MCP Server without license checks for testing
REM This bypasses all Pro license gating and allows testing of all tools

echo 🚀 Starting Enhanced MCP Server without license checks...
echo 📝 All Pro features will be available for testing
echo ⚠️  This is for testing purposes only

REM Set environment variable to disable license checks
set DISABLE_LICENSE=true

REM Build and run the server
npm run build && node dist/index.js
