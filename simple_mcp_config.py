#!/usr/bin/env python3
"""
Simplified MCP Configuration Manager
No threading, minimal complexity for testing
"""

import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

def get_config_path() -> str:
    """Get the default configuration file path"""
    try:
        home = Path.home()
        config_dir = home / ".mcp"
        config_dir.mkdir(exist_ok=True)
        return str(config_dir / "config.json")
    except Exception as e:
        print(f"Error creating config directory: {e}")
        return "config.json"

def create_default_config() -> Dict[str, Any]:
    """Create a default configuration dictionary"""
    return {
        "watched_directories": [],
        "global_exclude_patterns": [
            ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log",
            "*.tmp", "*.temp", ".DS_Store", "Thumbs.db", "*.swp", "*.swo"
        ],
        "max_file_size": "10MB",
        "enabled": True,
        "audit_logging": True,
        "security_mode": "moderate",
        "config_version": "2.0.0",
        "last_modified": datetime.now().isoformat()
    }

def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from file"""
    try:
        if not os.path.exists(config_path):
            print(f"Config file not found at {config_path}, creating default")
            config = create_default_config()
            save_config(config_path, config)
            return config
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        print(f"Configuration loaded from {config_path}")
        return config
        
    except Exception as e:
        print(f"Error loading config: {e}")
        print("Creating default configuration...")
        config = create_default_config()
        save_config(config_path, config)
        return config

def save_config(config_path: str, config: Dict[str, Any]) -> bool:
    """Save configuration to file"""
    try:
        # Ensure directory exists
        config_dir = Path(config_path).parent
        config_dir.mkdir(parents=True, exist_ok=True)
        
        # Update timestamp
        config["last_modified"] = datetime.now().isoformat()
        
        # Write to temporary file first
        temp_path = config_path + ".tmp"
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        # Atomic move
        if os.name == 'nt':  # Windows
            if os.path.exists(config_path):
                os.remove(config_path)
            os.rename(temp_path, config_path)
        else:  # Unix-like
            os.rename(temp_path, config_path)
        
        print(f"Configuration saved to {config_path}")
        return True
        
    except Exception as e:
        print(f"Error saving config: {e}")
        # Clean up temp file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return False

def add_directory(config_path: str, directory_path: str) -> bool:
    """Add a directory to the configuration"""
    try:
        # Load current config
        config = load_config(config_path)
        
        # Validate directory
        if not os.path.exists(directory_path) or not os.path.isdir(directory_path):
            print(f"Error: Directory does not exist or is not accessible: {directory_path}")
            return False
        
        # Check if already exists
        for existing in config["watched_directories"]:
            if existing.get("path") == directory_path:
                print(f"Directory already in watch list: {directory_path}")
                return False
        
        # Add directory
        dir_config = {
            "path": directory_path,
            "enabled": True,
            "max_file_size": "10MB",
            "exclude_patterns": [".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log"],
            "include_gitignore": True,
            "last_accessed": None
        }
        
        config["watched_directories"].append(dir_config)
        
        # Save config
        if save_config(config_path, config):
            print(f"✓ Added directory: {directory_path}")
            return True
        else:
            print(f"✗ Failed to save configuration")
            return False
            
    except Exception as e:
        print(f"Error adding directory: {e}")
        return False

def main():
    """Simple CLI interface"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python simple_mcp_config.py <command> [args]")
        print("Commands:")
        print("  create - Create default configuration")
        print("  add <path> - Add directory to watch list")
        print("  list - List watched directories")
        print("  test - Test configuration system")
        return
    
    command = sys.argv[1]
    config_path = get_config_path()
    
    if command == "create":
        print("Creating default configuration...")
        config = create_default_config()
        if save_config(config_path, config):
            print("✓ Default configuration created successfully")
        else:
            print("✗ Failed to create default configuration")
    
    elif command == "add":
        if len(sys.argv) < 3:
            print("Error: Please provide directory path")
            return
        directory_path = sys.argv[2]
        add_directory(config_path, directory_path)
    
    elif command == "list":
        config = load_config(config_path)
        directories = config.get("watched_directories", [])
        if directories:
            print("Watched Directories:")
            for i, dir_info in enumerate(directories, 1):
                print(f"  {i}. {dir_info['path']}")
        else:
            print("No directories in watch list")
    
    elif command == "test":
        print("Testing configuration system...")
        
        # Test 1: Create config
        print("1. Testing config creation...")
        config = create_default_config()
        if save_config(config_path, config):
            print("   ✓ Config creation works")
        else:
            print("   ✗ Config creation failed")
            return
        
        # Test 2: Load config
        print("2. Testing config loading...")
        loaded_config = load_config(config_path)
        if loaded_config:
            print("   ✓ Config loading works")
        else:
            print("   ✗ Config loading failed")
            return
        
        # Test 3: Add directory
        print("3. Testing directory addition...")
        test_dir = os.getcwd()  # Use current directory as test
        if add_directory(config_path, test_dir):
            print("   ✓ Directory addition works")
        else:
            print("   ✗ Directory addition failed")
            return
        
        print("\n✓ All tests passed!")
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()
