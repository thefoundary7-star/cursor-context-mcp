#!/usr/bin/env python3
"""
MCP Configuration Setup Script

Interactive setup script to help users configure their MCP server
for the first time with directory access controls.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import json
from pathlib import Path
from typing import List, Optional

try:
    from mcp_config_manager import MCPConfigManager
except ImportError as e:
    print(f"Error importing MCPConfigManager: {e}")
    print("Please ensure mcp_config_manager.py is in the same directory")
    sys.exit(1)


def print_banner():
    """Print the setup banner"""
    print("=" * 60)
    print("MCP Server Configuration Setup")
    print("=" * 60)
    print("This script will help you configure your MCP server")
    print("for secure directory access management.")
    print()


def get_user_input(prompt: str, default: Optional[str] = None) -> str:
    """Get user input with optional default"""
    if default:
        full_prompt = f"{prompt} [{default}]: "
    else:
        full_prompt = f"{prompt}: "
    
    response = input(full_prompt).strip()
    return response if response else default or ""


def get_yes_no(prompt: str, default: bool = True) -> bool:
    """Get yes/no input from user"""
    default_str = "Y/n" if default else "y/N"
    response = input(f"{prompt} [{default_str}]: ").strip().lower()
    
    if not response:
        return default
    
    return response in ['y', 'yes', 'true', '1']


def validate_directory(path: str) -> bool:
    """Validate that a directory path is accessible"""
    try:
        path_obj = Path(path).resolve()
        return path_obj.exists() and path_obj.is_dir() and os.access(path_obj, os.R_OK)
    except Exception:
        return False


def get_directory_path() -> Optional[str]:
    """Get a directory path from user with validation"""
    while True:
        path = get_user_input("Enter directory path to monitor")
        if not path:
            return None
        
        if validate_directory(path):
            return str(Path(path).resolve())
        else:
            print(f"Error: Directory '{path}' does not exist or is not accessible")
            if not get_yes_no("Try again?", True):
                return None


def get_security_mode() -> str:
    """Get security mode from user"""
    print("\nSecurity Modes:")
    print("1. Strict - Maximum security, limited access")
    print("2. Moderate - Balanced security and functionality (recommended)")
    print("3. Permissive - Minimal restrictions")
    
    while True:
        choice = get_user_input("Choose security mode (1-3)", "2")
        if choice == "1":
            return "strict"
        elif choice == "2":
            return "moderate"
        elif choice == "3":
            return "permissive"
        else:
            print("Please enter 1, 2, or 3")


def get_file_size_limit() -> str:
    """Get file size limit from user"""
    print("\nFile Size Limits:")
    print("1. 5MB - Conservative")
    print("2. 10MB - Default (recommended)")
    print("3. 25MB - Large files")
    print("4. Custom")
    
    while True:
        choice = get_user_input("Choose file size limit (1-4)", "2")
        if choice == "1":
            return "5MB"
        elif choice == "2":
            return "10MB"
        elif choice == "3":
            return "25MB"
        elif choice == "4":
            custom = get_user_input("Enter custom size (e.g., 15MB)")
            if custom:
                return custom
        else:
            print("Please enter 1, 2, 3, or 4")


def setup_directories(config_manager: MCPConfigManager) -> List[str]:
    """Setup watched directories"""
    print("\n" + "=" * 40)
    print("Directory Setup")
    print("=" * 40)
    print("Add directories that the MCP server should monitor.")
    print("You can add multiple directories.")
    print()
    
    directories = []
    
    while True:
        print(f"\nCurrent directories ({len(directories)}):")
        for i, dir_path in enumerate(directories, 1):
            print(f"  {i}. {dir_path}")
        
        if not directories:
            print("  (none)")
        
        print("\nOptions:")
        print("1. Add directory")
        print("2. Remove directory")
        print("3. Continue")
        
        choice = get_user_input("Choose option (1-3)", "1")
        
        if choice == "1":
            dir_path = get_directory_path()
            if dir_path and dir_path not in directories:
                directories.append(dir_path)
                print(f"✓ Added directory: {dir_path}")
            elif dir_path in directories:
                print("Directory already added")
        
        elif choice == "2":
            if not directories:
                print("No directories to remove")
                continue
            
            try:
                index = int(get_user_input("Enter directory number to remove")) - 1
                if 0 <= index < len(directories):
                    removed = directories.pop(index)
                    print(f"✓ Removed directory: {removed}")
                else:
                    print("Invalid directory number")
            except ValueError:
                print("Please enter a valid number")
        
        elif choice == "3":
            break
        
        else:
            print("Please enter 1, 2, or 3")
    
    return directories


def setup_exclusion_patterns() -> List[str]:
    """Setup exclusion patterns"""
    print("\n" + "=" * 40)
    print("Exclusion Patterns")
    print("=" * 40)
    print("Configure patterns for files/directories to exclude.")
    print("Common patterns are pre-configured.")
    print()
    
    default_patterns = [
        ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log",
        "*.tmp", "*.temp", ".DS_Store", "Thumbs.db", "*.swp", "*.swo"
    ]
    
    print("Default exclusion patterns:")
    for pattern in default_patterns:
        print(f"  - {pattern}")
    
    if get_yes_no("\nUse default exclusion patterns?", True):
        return default_patterns
    
    print("\nCustom exclusion patterns setup:")
    patterns = []
    
    for pattern in default_patterns:
        if get_yes_no(f"Include '{pattern}'?", True):
            patterns.append(pattern)
    
    # Allow adding custom patterns
    while True:
        custom = get_user_input("\nAdd custom pattern (or press Enter to finish)")
        if not custom:
            break
        patterns.append(custom)
        print(f"✓ Added pattern: {custom}")
    
    return patterns


def main():
    """Main setup function"""
    print_banner()
    
    # Check if configuration already exists
    try:
        print("Initializing configuration manager...")
        config_manager = MCPConfigManager()
        
        if config_manager.config and config_manager.config.watched_directories:
            print("Existing configuration found!")
            print(f"Config file: {config_manager.config_path}")
            print(f"Watched directories: {len(config_manager.config.watched_directories)}")
            
            if not get_yes_no("Do you want to reconfigure?", False):
                print("Setup cancelled. Use mcp_config_manager.py to modify settings.")
                return
    except Exception as e:
        print(f"Error initializing configuration manager: {e}")
        print("Please check your system permissions and try again.")
        return
    
    print("Let's set up your MCP server configuration...")
    
    # Get basic settings
    print("\n" + "=" * 40)
    print("Basic Settings")
    print("=" * 40)
    
    security_mode = get_security_mode()
    file_size_limit = get_file_size_limit()
    audit_logging = get_yes_no("Enable audit logging?", True)
    
    # Setup directories
    directories = setup_directories(config_manager)
    
    # Setup exclusion patterns
    exclusion_patterns = setup_exclusion_patterns()
    
    # Create configuration
    print("\n" + "=" * 40)
    print("Creating Configuration")
    print("=" * 40)
    
    try:
        # Clear existing configuration
        config_manager.config.watched_directories = []
        
        # Add directories
        for dir_path in directories:
            print(f"Adding directory: {dir_path}")
            success = config_manager.add_directory(
                dir_path,
                max_file_size=file_size_limit,
                exclude_patterns=exclusion_patterns.copy(),
                include_gitignore=True
            )
            if not success:
                print(f"Warning: Failed to add directory {dir_path}")
        
        # Set global settings
        with config_manager._lock:
            config_manager.config.security_mode = security_mode
            config_manager.config.max_file_size = file_size_limit
            config_manager.config.audit_logging = audit_logging
            config_manager.config.enabled = True
            config_manager.config.global_exclude_patterns = exclusion_patterns
        
        # Save configuration
        print("Saving configuration...")
        if config_manager.save_config():
            print("✓ Configuration saved successfully!")
        else:
            print("✗ Failed to save configuration")
            return
            
    except Exception as e:
        print(f"✗ Error creating configuration: {e}")
        return
    
    # Show summary
    print("\n" + "=" * 40)
    print("Configuration Summary")
    print("=" * 40)
    
    summary = config_manager.get_config_summary()
    print(f"Config file: {summary['config_path']}")
    print(f"Security mode: {summary['security_mode']}")
    print(f"File size limit: {summary['max_file_size']}")
    print(f"Audit logging: {summary['audit_logging']}")
    print(f"Watched directories: {summary['enabled_directories']}")
    print(f"Exclusion patterns: {summary['global_exclude_patterns']}")
    
    print("\n" + "=" * 40)
    print("Next Steps")
    print("=" * 40)
    print("1. Test your configuration:")
    print("   python mcp_config_manager.py --validate")
    print()
    print("2. List your directories:")
    print("   python mcp_config_manager.py --list-dirs")
    print()
    print("3. Start the MCP server:")
    print("   python official_mcp_server.py")
    print()
    print("4. For more options, see:")
    print("   python mcp_config_manager.py --help")
    print()
    print("5. Read the full documentation:")
    print("   MCP_DIRECTORY_CONFIGURATION_GUIDE.md")
    
    print("\n✓ Setup complete!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nSetup failed: {e}")
        sys.exit(1)
