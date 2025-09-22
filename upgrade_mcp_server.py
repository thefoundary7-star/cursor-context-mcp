#!/usr/bin/env python3
"""
MCP Server Upgrade Script

This script upgrades existing MCP server installations to the enhanced version.
"""

import os
import sys
import shutil
import json
from pathlib import Path

def upgrade_mcp_server():
    """Upgrade MCP server to enhanced version"""
    print("MCP Server Upgrade Script v2.1.0")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("official_mcp_server.py"):
        print("Error: official_mcp_server.py not found in current directory")
        print("Please run this script from the MCP server directory")
        return False
    
    # Backup existing configuration
    config_path = Path.home() / ".mcp" / "config.json"
    if config_path.exists():
        backup_path = config_path.with_suffix(".json.backup")
        shutil.copy2(config_path, backup_path)
        print(f"✓ Backed up existing configuration to {backup_path}")
    
    # Install enhanced features
    print("Installing enhanced features...")
    try:
        from install_enhanced_features import EnhancedMCPInstaller
        installer = EnhancedMCPInstaller()
        success = installer.install()
        
        if success:
            print("✓ Enhanced features installed successfully")
        else:
            print("✗ Enhanced features installation failed")
            return False
            
    except ImportError:
        print("Warning: Enhanced features installer not available")
        print("Please ensure all enhanced feature files are present")
    
    # Create enhanced server entry point
    print("Creating enhanced server entry point...")
    try:
        from enhanced_mcp_integration import create_enhanced_mcp_server
        enhanced_server_path = create_enhanced_mcp_server()
        print(f"✓ Enhanced server created: {enhanced_server_path}")
    except ImportError:
        print("Warning: Enhanced integration not available")
    
    print("\nUpgrade completed!")
    print("\nTo use the enhanced server:")
    print("  python enhanced_mcp_server.py")
    print("\nTo use the original server:")
    print("  python official_mcp_server.py")
    
    return True

if __name__ == "__main__":
    success = upgrade_mcp_server()
    sys.exit(0 if success else 1)
