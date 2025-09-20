#!/usr/bin/env python3
"""
Quick test script for MCP configuration
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

def test_basic_config_creation():
    """Test basic configuration creation without the full manager"""
    print("Testing basic configuration creation...")
    
    # Test 1: Create config directory
    try:
        home = Path.home()
        config_dir = home / ".mcp"
        config_dir.mkdir(exist_ok=True)
        print(f"✓ Config directory created: {config_dir}")
    except Exception as e:
        print(f"✗ Failed to create config directory: {e}")
        return False
    
    # Test 2: Create basic config file
    try:
        config_path = config_dir / "config.json"
        
        # Simple config structure
        config = {
            "watched_directories": [],
            "global_exclude_patterns": [
                ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log"
            ],
            "max_file_size": "10MB",
            "enabled": True,
            "audit_logging": True,
            "security_mode": "moderate",
            "config_version": "2.0.0",
            "last_modified": datetime.now().isoformat()
        }
        
        # Write config file
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Config file created: {config_path}")
        
        # Test 3: Read it back
        with open(config_path, 'r', encoding='utf-8') as f:
            loaded_config = json.load(f)
        
        print(f"✓ Config file loaded successfully")
        print(f"  - Watched directories: {len(loaded_config['watched_directories'])}")
        print(f"  - Security mode: {loaded_config['security_mode']}")
        print(f"  - Enabled: {loaded_config['enabled']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to create/read config file: {e}")
        return False

if __name__ == "__main__":
    print("MCP Configuration Quick Test")
    print("=" * 40)
    
    success = test_basic_config_creation()
    
    if success:
        print("\n✓ All tests passed! Basic configuration system works.")
    else:
        print("\n✗ Tests failed. Check the errors above.")
        sys.exit(1)
