@echo off
echo Testing MCP Configuration System
echo ================================

echo.
echo 1. Testing Python availability...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python not found
    exit /b 1
)

echo.
echo 2. Testing basic file operations...
echo test > test_file.txt
if exist test_file.txt (
    echo ✓ File creation works
    del test_file.txt
) else (
    echo ✗ File creation failed
    exit /b 1
)

echo.
echo 3. Testing directory creation...
if not exist test_dir mkdir test_dir
if exist test_dir (
    echo ✓ Directory creation works
    rmdir test_dir
) else (
    echo ✗ Directory creation failed
    exit /b 1
)

echo.
echo 4. Testing JSON import...
python -c "import json; print('✓ JSON module available')"
if %errorlevel% neq 0 (
    echo ✗ JSON module not available
    exit /b 1
)

echo.
echo 5. Testing pathlib import...
python -c "from pathlib import Path; print('✓ pathlib module available')"
if %errorlevel% neq 0 (
    echo ✗ pathlib module not available
    exit /b 1
)

echo.
echo ✓ All basic tests passed!
echo.
echo Now testing MCP configuration...
python test_config_quick.py

echo.
echo Test completed.
pause
