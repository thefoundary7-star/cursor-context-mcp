#!/usr/bin/env python3
"""
Quick Test Runner for MCP Server Platform

A simplified test runner for quick verification of the testing system.
"""

import os
import sys
import subprocess
from pathlib import Path

def run_quick_test():
    """Run a quick test to verify the testing system works."""
    print("MCP Server Platform - Quick Test Runner")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("official_mcp_server.py"):
        print("Error: official_mcp_server.py not found. Please run from project root.")
        return False
    
    # Check if test files exist
    test_files = [
        "tests/test_mcp_server.py",
        "tests/test_config_integration.py", 
        "test_directory_access.py",
        "run_tests.py"
    ]
    
    missing_files = [f for f in test_files if not os.path.exists(f)]
    if missing_files:
        print(f"Error: Missing test files: {missing_files}")
        return False
    
    print("✓ All test files found")
    
    # Try to import the main modules
    try:
        import official_mcp_server
        print("✓ official_mcp_server.py imports successfully")
    except ImportError as e:
        print(f"✗ Failed to import official_mcp_server.py: {e}")
        return False
    
    try:
        import mcp_config_manager
        print("✓ mcp_config_manager.py imports successfully")
    except ImportError as e:
        print(f"✗ Failed to import mcp_config_manager.py: {e}")
        return False
    
    # Check if pytest is available
    try:
        result = subprocess.run([sys.executable, "-m", "pytest", "--version"], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("✓ pytest is available")
        else:
            print("✗ pytest not available")
            return False
    except Exception as e:
        print(f"✗ Error checking pytest: {e}")
        return False
    
    # Run a simple test
    print("\nRunning a simple test...")
    try:
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/test_mcp_server.py::TestListFilesSync::test_list_files_nonexistent_directory",
            "-v", "--tb=short"
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✓ Simple test passed")
        else:
            print(f"✗ Simple test failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"✗ Error running test: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("✓ Quick test completed successfully!")
    print("The testing system is ready to use.")
    print("\nTo run all tests:")
    print("  python run_tests.py --full")
    print("\nTo run specific test types:")
    print("  python run_tests.py --unit")
    print("  python run_tests.py --integration")
    print("  python run_tests.py --security")
    
    return True

if __name__ == "__main__":
    success = run_quick_test()
    sys.exit(0 if success else 1)
