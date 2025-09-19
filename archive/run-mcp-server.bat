@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM Cursor Context MCP Server Launcher
REM =============================================================================
REM This script launches the Node.js MCP server for Claude Desktop integration
REM Author: Generated for cursor-context-mcp project
REM Version: 1.0.0
REM =============================================================================

REM Set script metadata
set "SCRIPT_NAME=run-mcp-server.bat"
set "PROJECT_NAME=cursor-context-mcp"
set "PROJECT_VERSION=1.0.0"

REM Configuration
set "PROJECT_DIR=C:\Users\manay\Desktop\cursor-context-mcp"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "SERVER_SCRIPT=dist\index.js"
set "LOG_FILE=%PROJECT_DIR%\mcp-server.log"

REM Colors for output (Windows 10+)
set "COLOR_RED=[91m"
set "COLOR_GREEN=[92m"
set "COLOR_YELLOW=[93m"
set "COLOR_BLUE=[94m"
set "COLOR_RESET=[0m"

REM =============================================================================
REM Utility Functions
REM =============================================================================

:log_info
echo %~1
echo [%date% %time%] INFO: %~1 >> "%LOG_FILE%" 2>nul
goto :eof

:log_error
echo %COLOR_RED%ERROR: %~1%COLOR_RESET%
echo [%date% %time%] ERROR: %~1 >> "%LOG_FILE%" 2>nul
goto :eof

:log_warning
echo %COLOR_YELLOW%WARNING: %~1%COLOR_RESET%
echo [%date% %time%] WARNING: %~1 >> "%LOG_FILE%" 2>nul
goto :eof

:log_success
echo %COLOR_GREEN%SUCCESS: %~1%COLOR_RESET%
echo [%date% %time%] SUCCESS: %~1 >> "%LOG_FILE%" 2>nul
goto :eof

:check_file_exists
if not exist "%~1" (
    call :log_error "File not found: %~1"
    exit /b 1
)
exit /b 0

:check_command_exists
where "%~1" >nul 2>&1
if errorlevel 1 (
    call :log_error "Command not found: %~1"
    exit /b 1
)
exit /b 0

REM =============================================================================
REM Main Script Execution
REM =============================================================================

call :log_info "Starting %PROJECT_NAME% MCP Server v%PROJECT_VERSION%"
call :log_info "Script: %SCRIPT_NAME%"
call :log_info "Timestamp: %date% %time%"

REM Check if running as administrator (optional but recommended for production)
net session >nul 2>&1
if errorlevel 1 (
    call :log_warning "Not running as administrator. Some features may be limited."
) else (
    call :log_info "Running with administrator privileges."
)

REM Verify Node.js installation
call :log_info "Checking Node.js installation..."
call :check_command_exists "%NODE_EXE%"
if errorlevel 1 (
    call :log_error "Node.js not found at: %NODE_EXE%"
    call :log_error "Please install Node.js or update the NODE_EXE path in this script."
    pause
    exit /b 1
)

REM Get Node.js version
for /f "tokens=*" %%i in ('"%NODE_EXE%" --version 2^>nul') do set "NODE_VERSION=%%i"
call :log_info "Node.js version: %NODE_VERSION%"

REM Change to project directory
call :log_info "Changing to project directory: %PROJECT_DIR%"
if not exist "%PROJECT_DIR%" (
    call :log_error "Project directory not found: %PROJECT_DIR%"
    pause
    exit /b 1
)
cd /d "%PROJECT_DIR%"
if errorlevel 1 (
    call :log_error "Failed to change to project directory"
    pause
    exit /b 1
)

REM Verify server script exists
call :log_info "Checking server script..."
call :check_file_exists "%SERVER_SCRIPT%"
if errorlevel 1 (
    call :log_error "Server script not found: %SERVER_SCRIPT%"
    call :log_error "Please run 'npm run build' to compile the TypeScript code."
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    call :log_warning "node_modules not found. Installing dependencies..."
    call :log_info "Running: npm install"
    "%NODE_EXE%" install
    if errorlevel 1 (
        call :log_error "Failed to install dependencies"
        pause
        exit /b 1
    )
    call :log_success "Dependencies installed successfully"
)

REM Check package.json for required dependencies
call :log_info "Verifying package.json..."
if not exist "package.json" (
    call :log_error "package.json not found in project directory"
    pause
    exit /b 1
)

REM Set environment variables for production
set "NODE_ENV=production"
set "MCP_SERVER_NAME=%PROJECT_NAME%"
set "MCP_SERVER_VERSION=%PROJECT_VERSION%"

REM Log environment setup
call :log_info "Environment variables set:"
call :log_info "  NODE_ENV=%NODE_ENV%"
call :log_info "  MCP_SERVER_NAME=%MCP_SERVER_NAME%"
call :log_info "  MCP_SERVER_VERSION=%MCP_SERVER_VERSION%"

REM Create log directory if it doesn't exist
if not exist "logs" mkdir logs >nul 2>&1

REM =============================================================================
REM Launch MCP Server
REM =============================================================================

call :log_info "Launching MCP Server..."
call :log_info "Command: %NODE_EXE% %SERVER_SCRIPT%"
call :log_info "Working Directory: %CD%"
call :log_info "Log File: %LOG_FILE%"

REM Display startup banner
echo.
echo %COLOR_BLUE%=============================================================================%COLOR_RESET%
echo %COLOR_BLUE%                    CURSOR CONTEXT MCP SERVER%COLOR_RESET%
echo %COLOR_BLUE%=============================================================================%COLOR_RESET%
echo %COLOR_GREEN%Project: %PROJECT_NAME% v%PROJECT_VERSION%%COLOR_RESET%
echo %COLOR_GREEN%Node.js: %NODE_VERSION%%COLOR_RESET%
echo %COLOR_GREEN%Server: %SERVER_SCRIPT%%COLOR_RESET%
echo %COLOR_GREEN%Started: %date% %time%%COLOR_RESET%
echo %COLOR_BLUE%=============================================================================%COLOR_RESET%
echo.

REM Launch the server with error handling
call :log_info "Starting server process..."
"%NODE_EXE%" "%SERVER_SCRIPT%"
set "EXIT_CODE=%ERRORLEVEL%"

REM Handle exit codes
if %EXIT_CODE% equ 0 (
    call :log_success "MCP Server stopped gracefully"
) else (
    call :log_error "MCP Server exited with error code: %EXIT_CODE%"
    call :log_error "Check the log file for details: %LOG_FILE%"
)

REM Display final status
echo.
echo %COLOR_BLUE%=============================================================================%COLOR_RESET%
echo %COLOR_YELLOW%MCP Server Session Ended%COLOR_RESET%
echo %COLOR_BLUE%=============================================================================%COLOR_RESET%
echo %COLOR_GREEN%Exit Code: %EXIT_CODE%%COLOR_RESET%
echo %COLOR_GREEN%Ended: %date% %time%%COLOR_RESET%
echo %COLOR_GREEN%Log File: %LOG_FILE%%COLOR_RESET%
echo.

REM Keep window open if there was an error
if %EXIT_CODE% neq 0 (
    call :log_warning "Press any key to exit..."
    pause >nul
)

exit /b %EXIT_CODE%
