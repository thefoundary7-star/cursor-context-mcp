#!/usr/bin/env python3
"""
Quick setup script to add current directory to MCP configuration
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

def quick_setup():
    """Quick setup to add current directory to MCP configuration"""
    print("MCP Quick Setup")
    print("=" * 30)
    
    # Get current directory
    current_dir = os.getcwd()
    print(f"Current directory: {current_dir}")
    
    # Initialize config manager
    print("Initializing configuration manager...")
    try:
        config_manager = MCPConfigManager()
        print("✓ Configuration manager initialized")
    except Exception as e:
        print(f"✗ Failed to initialize: {e}")
        return False
    
    # Check if current directory is already configured
    directories = config_manager.list_directories()
    current_dir_resolved = str(Path(current_dir).resolve())
    
    for dir_info in directories:
        if str(Path(dir_info['path']).resolve()) == current_dir_resolved:
            print(f"✓ Current directory is already configured: {current_dir}")
            return True
    
    # Add current directory to configuration
    print(f"Adding current directory to MCP configuration...")
    try:
        success = config_manager.add_directory(current_dir)
        if success:
            print(f"✓ Successfully added directory: {current_dir}")
        else:
            print(f"✗ Failed to add directory: {current_dir}")
            return False
    except Exception as e:
        print(f"✗ Error adding directory: {e}")
        return False
    
    # Show configuration summary
    print("\nConfiguration Summary:")
    summary = config_manager.get_config_summary()
    print(f"  Config file: {summary['config_path']}")
    print(f"  Security mode: {summary['security_mode']}")
    print(f"  Watched directories: {summary['enabled_directories']}")
    print(f"  Enabled: {summary['enabled']}")
    
    print("\n✓ Setup complete! You can now run the MCP server:")
    print("  python official_mcp_server.py")
    
    return True

if __name__ == "__main__":
    try:
        success = quick_setup()
        if not success:
            print("\n❌ Setup failed. You can still use bypass mode for testing:")
            print("  python official_mcp_server.py --bypass-config")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\nSetup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)
