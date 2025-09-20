#!/usr/bin/env python3
"""
Test script to verify MCP directory access fixes
"""

import os
import sys
from pathlib import Path

# Add current directory to path to import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from mcp_config_manager import MCPConfigManager
except ImportError as e:
    print(f"Error importing MCPConfigManager: {e}")
    sys.exit(1)

def test_directory_access():
    """Test directory access with the fixed configuration manager"""
    print("Testing MCP Directory Access Fixes")
    print("=" * 50)
    
    # Test 1: Initialize config manager
    print("1. Initializing configuration manager...")
    try:
        config_manager = MCPConfigManager()
        print("   ✓ Configuration manager initialized")
    except Exception as e:
        print(f"   ✗ Failed to initialize: {e}")
        return False
    
    # Test 2: Check current directory access (should work now)
    print("2. Testing current directory access...")
    current_dir = "."
    try:
        is_allowed = config_manager.is_path_allowed(current_dir)
        print(f"   Current directory access: {'✓ ALLOWED' if is_allowed else '✗ BLOCKED'}")
        if not is_allowed:
            print("   This should now be allowed by default!")
            return False
    except Exception as e:
        print(f"   ✗ Error checking access: {e}")
        return False
    
    # Test 3: Check bypass mode
    print("3. Testing bypass mode...")
    try:
        config_manager.bypass_mode = True
        is_allowed = config_manager.is_path_allowed(current_dir)
        print(f"   Bypass mode access: {'✓ ALLOWED' if is_allowed else '✗ BLOCKED'}")
        if not is_allowed:
            print("   Bypass mode should allow all access!")
            return False
    except Exception as e:
        print(f"   ✗ Error testing bypass mode: {e}")
        return False
    
    # Test 4: Test with no directories configured
    print("4. Testing with empty configuration...")
    try:
        config_manager.bypass_mode = False
        # Simulate empty configuration
        original_dirs = config_manager.config.watched_directories
        config_manager.config.watched_directories = []
        
        is_allowed = config_manager.is_path_allowed(current_dir)
        print(f"   Empty config access: {'✓ ALLOWED' if is_allowed else '✗ BLOCKED'}")
        if not is_allowed:
            print("   Empty configuration should allow current directory access!")
            return False
        
        # Restore original configuration
        config_manager.config.watched_directories = original_dirs
    except Exception as e:
        print(f"   ✗ Error testing empty config: {e}")
        return False
    
    # Test 5: Test permissive mode
    print("5. Testing permissive security mode...")
    try:
        original_mode = config_manager.config.security_mode
        config_manager.config.security_mode = "permissive"
        
        is_allowed = config_manager.is_path_allowed(current_dir)
        print(f"   Permissive mode access: {'✓ ALLOWED' if is_allowed else '✗ BLOCKED'}")
        if not is_allowed:
            print("   Permissive mode should allow access!")
            return False
        
        # Restore original mode
        config_manager.config.security_mode = original_mode
    except Exception as e:
        print(f"   ✗ Error testing permissive mode: {e}")
        return False
    
    print("\n✓ All tests passed! Directory access issues are fixed.")
    return True

def test_config_summary():
    """Test configuration summary functionality"""
    print("\nTesting Configuration Summary")
    print("=" * 30)
    
    try:
        config_manager = MCPConfigManager()
        summary = config_manager.get_config_summary()
        
        print("Configuration Summary:")
        for key, value in summary.items():
            print(f"  {key}: {value}")
        
        return True
    except Exception as e:
        print(f"✗ Error getting config summary: {e}")
        return False

if __name__ == "__main__":
    print("MCP Directory Access Test")
    print("=" * 50)
    
    success1 = test_directory_access()
    success2 = test_config_summary()
    
    if success1 and success2:
        print("\n🎉 All tests passed! MCP server should now work properly.")
        print("\nNext steps:")
        print("1. Run: python official_mcp_server.py --bypass-config (for testing)")
        print("2. Or configure directories: python mcp_config_manager.py --add-dir .")
        print("3. Then run: python official_mcp_server.py")
    else:
        print("\n❌ Some tests failed. Check the errors above.")
        sys.exit(1)
