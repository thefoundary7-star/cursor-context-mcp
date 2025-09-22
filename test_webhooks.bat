@echo off
REM FileBridge Dodo Webhook Testing Suite
REM Run this script to test your webhook integration

echo 🚀 FileBridge Webhook Testing Suite
echo =====================================
echo.

REM Check if server is running
echo 🔍 Checking if FileBridge server is running...
curl -s http://localhost:3001 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ FileBridge server is not running on port 3001
    echo Please start your server first: npm run dev
    pause
    exit /b 1
)
echo ✅ Server is running

echo.
echo 📋 Select testing mode:
echo 1. Local webhook simulation (quick test)
echo 2. Production webhook test with ngrok (real Dodo events)
echo 3. Webhook monitoring only
echo 4. Webhook health check
echo.

set /p choice="Enter choice (1-4): "

if %choice%==1 (
    echo.
    echo 🧪 Running local webhook simulation...
    python test_dodo_webhooks.py
) else if %choice%==2 (
    echo.
    echo 🌐 Setting up production webhook test...
    echo This will start ngrok and create real test payments
    set /p confirm="Continue? (y/n): "
    if /i "%confirm%"=="y" (
        python test_production_webhooks.py
    )
) else if %choice%==3 (
    echo.
    echo 📊 Starting webhook monitor...
    echo Press Ctrl+C to stop monitoring
    python monitor_webhooks.py
) else if %choice%==4 (
    echo.
    echo 🏥 Running webhook health check...
    python monitor_webhooks.py --health
) else (
    echo Invalid choice
)

echo.
echo 📋 Testing Summary:
echo - Local simulation: Tests webhook endpoint with fake events
echo - Production test: Uses ngrok + real Dodo payments  
echo - Monitoring: Real-time webhook event tracking
echo - Health check: Verify webhook system status
echo.

pause
