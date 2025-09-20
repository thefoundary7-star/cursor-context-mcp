#!/usr/bin/env python3
"""
MCP Configuration System Usage Examples

This script demonstrates how to use the MCP configuration system
for managing directory access in a commercial environment.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path

try:
    from mcp_config_manager import MCPConfigManager
except ImportError as e:
    print(f"Error importing MCPConfigManager: {e}")
    print("Please ensure mcp_config_manager.py is in the same directory")
    sys.exit(1)


def create_test_environment():
    """Create a test environment with sample files"""
    test_dir = tempfile.mkdtemp(prefix="mcp_test_")
    
    # Create project structure
    project_dir = os.path.join(test_dir, "my_project")
    docs_dir = os.path.join(test_dir, "documents")
    
    os.makedirs(project_dir)
    os.makedirs(docs_dir)
    
    # Create sample files
    files_to_create = [
        (project_dir, "main.py", "print('Hello, World!')"),
        (project_dir, "config.py", "API_KEY = 'secret123'"),
        (project_dir, ".env", "SECRET_KEY=abc123"),
        (project_dir, "requirements.txt", "fastmcp>=1.0.0"),
        (project_dir, "README.md", "# My Project"),
        (docs_dir, "notes.txt", "Important notes here"),
        (docs_dir, "draft.md", "# Draft document"),
    ]
    
    for dir_path, filename, content in files_to_create:
        file_path = os.path.join(dir_path, filename)
        with open(file_path, 'w') as f:
            f.write(content)
    
    # Create .gitignore
    gitignore_path = os.path.join(project_dir, ".gitignore")
    with open(gitignore_path, 'w') as f:
        f.write(".env\n*.pyc\n__pycache__/\n")
    
    return test_dir, project_dir, docs_dir


def example_basic_setup():
    """Example: Basic configuration setup"""
    print("=" * 60)
    print("Example 1: Basic Configuration Setup")
    print("=" * 60)
    
    # Create test environment
    test_dir, project_dir, docs_dir = create_test_environment()
    
    try:
        # Create configuration manager
        config_path = os.path.join(test_dir, "config.json")
        config_manager = MCPConfigManager(config_path)
        
        print(f"Created configuration at: {config_path}")
        
        # Add directories
        print(f"\nAdding project directory: {project_dir}")
        success = config_manager.add_directory(project_dir)
        print(f"Success: {success}")
        
        print(f"\nAdding documents directory: {docs_dir}")
        success = config_manager.add_directory(docs_dir)
        print(f"Success: {success}")
        
        # List directories
        print("\nCurrent directories:")
        directories = config_manager.list_directories()
        for i, dir_info in enumerate(directories, 1):
            print(f"  {i}. {dir_info['path']} (enabled: {dir_info['enabled']})")
        
        # Show configuration summary
        print("\nConfiguration Summary:")
        summary = config_manager.get_config_summary()
        for key, value in summary.items():
            print(f"  {key}: {value}")
        
    finally:
        # Cleanup
        shutil.rmtree(test_dir)


def example_security_controls():
    """Example: Security controls and access validation"""
    print("\n" + "=" * 60)
    print("Example 2: Security Controls and Access Validation")
    print("=" * 60)
    
    test_dir, project_dir, docs_dir = create_test_environment()
    
    try:
        config_path = os.path.join(test_dir, "config.json")
        config_manager = MCPConfigManager(config_path)
        
        # Add project directory
        config_manager.add_directory(project_dir)
        
        # Test file access
        test_files = [
            os.path.join(project_dir, "main.py"),      # Should be allowed
            os.path.join(project_dir, ".env"),         # Should be excluded
            os.path.join(project_dir, "config.py"),    # Should be allowed
            os.path.join(docs_dir, "notes.txt"),       # Should be denied (not in watched dirs)
        ]
        
        print("Testing file access:")
        for file_path in test_files:
            is_allowed = config_manager.is_path_allowed(file_path)
            status = "✓ ALLOWED" if is_allowed else "✗ DENIED"
            print(f"  {status}: {file_path}")
        
        # Test directory access
        print("\nTesting directory access:")
        test_dirs = [
            project_dir,                               # Should be allowed
            docs_dir,                                  # Should be denied
            "/",                                       # Should be denied (system dir)
        ]
        
        for dir_path in test_dirs:
            try:
                is_allowed = config_manager.is_path_allowed(dir_path)
                status = "✓ ALLOWED" if is_allowed else "✗ DENIED"
                print(f"  {status}: {dir_path}")
            except Exception as e:
                print(f"  ✗ ERROR: {dir_path} - {e}")
        
    finally:
        shutil.rmtree(test_dir)


def example_exclusion_patterns():
    """Example: Exclusion patterns and customization"""
    print("\n" + "=" * 60)
    print("Example 3: Exclusion Patterns and Customization")
    print("=" * 60)
    
    test_dir, project_dir, docs_dir = create_test_environment()
    
    try:
        config_path = os.path.join(test_dir, "config.json")
        config_manager = MCPConfigManager(config_path)
        
        # Add directory with custom exclusion patterns
        print(f"Adding directory with custom exclusions: {project_dir}")
        success = config_manager.add_directory(
            project_dir,
            exclude_patterns=["*.py", "*.txt", "config.py"],
            max_file_size="1KB"
        )
        print(f"Success: {success}")
        
        # Test different file types
        test_files = [
            (os.path.join(project_dir, "main.py"), "Python file"),
            (os.path.join(project_dir, "config.py"), "Config file (explicitly excluded)"),
            (os.path.join(project_dir, "README.md"), "Markdown file"),
            (os.path.join(project_dir, ".env"), "Environment file (global exclusion)"),
        ]
        
        print("\nTesting exclusion patterns:")
        for file_path, description in test_files:
            is_allowed = config_manager.is_path_allowed(file_path)
            status = "✓ ALLOWED" if is_allowed else "✗ EXCLUDED"
            print(f"  {status}: {description} - {os.path.basename(file_path)}")
        
        # Add global exclusion pattern
        print("\nAdding global exclusion pattern: '*.md'")
        config_manager.add_exclude_pattern("*.md")
        
        print("\nTesting after adding global exclusion:")
        for file_path, description in test_files:
            is_allowed = config_manager.is_path_allowed(file_path)
            status = "✓ ALLOWED" if is_allowed else "✗ EXCLUDED"
            print(f"  {status}: {description} - {os.path.basename(file_path)}")
        
    finally:
        shutil.rmtree(test_dir)


def example_audit_logging():
    """Example: Audit logging functionality"""
    print("\n" + "=" * 60)
    print("Example 4: Audit Logging")
    print("=" * 60)
    
    test_dir, project_dir, docs_dir = create_test_environment()
    
    try:
        config_path = os.path.join(test_dir, "config.json")
        config_manager = MCPConfigManager(config_path)
        
        # Enable audit logging
        config_manager.config.audit_logging = True
        
        # Perform some actions that should be logged
        print("Performing actions that will be logged...")
        
        config_manager.add_directory(project_dir)
        config_manager.add_directory(docs_dir)
        config_manager.add_exclude_pattern("*.tmp")
        config_manager.remove_directory(docs_dir)
        
        # Check audit log
        audit_log_path = Path(config_path).parent / "audit.log"
        if audit_log_path.exists():
            print(f"\nAudit log created at: {audit_log_path}")
            
            with open(audit_log_path, 'r') as f:
                log_entries = f.readlines()
            
            print(f"Total log entries: {len(log_entries)}")
            print("\nRecent log entries:")
            for entry in log_entries[-3:]:  # Show last 3 entries
                try:
                    import json
                    log_data = json.loads(entry.strip())
                    print(f"  {log_data['timestamp']}: {log_data['action']} - {log_data['path']}")
                except:
                    print(f"  {entry.strip()}")
        else:
            print("No audit log found")
        
    finally:
        shutil.rmtree(test_dir)


def example_cli_commands():
    """Example: CLI command usage"""
    print("\n" + "=" * 60)
    print("Example 5: CLI Command Usage")
    print("=" * 60)
    
    print("Here are the main CLI commands you can use:")
    print()
    
    commands = [
        ("Add directory", "python mcp_config_manager.py --add-dir /path/to/project"),
        ("Remove directory", "python mcp_config_manager.py --remove-dir /path/to/project"),
        ("List directories", "python mcp_config_manager.py --list-dirs"),
        ("Add exclusion pattern", "python mcp_config_manager.py --exclude-pattern '*.env'"),
        ("Remove exclusion pattern", "python mcp_config_manager.py --remove-exclude-pattern '*.env'"),
        ("Enable server", "python mcp_config_manager.py --enable"),
        ("Disable server", "python mcp_config_manager.py --disable"),
        ("Set security mode", "python mcp_config_manager.py --security-mode strict"),
        ("Set file size limit", "python mcp_config_manager.py --max-file-size 25MB"),
        ("Show summary", "python mcp_config_manager.py --summary"),
        ("Validate config", "python mcp_config_manager.py --validate"),
        ("Interactive setup", "python setup_mcp_config.py"),
    ]
    
    for description, command in commands:
        print(f"  {description}:")
        print(f"    {command}")
        print()


def main():
    """Run all examples"""
    print("MCP Configuration System Usage Examples")
    print("=" * 60)
    print("This script demonstrates the key features of the MCP")
    print("configuration system for commercial use.")
    print()
    
    try:
        example_basic_setup()
        example_security_controls()
        example_exclusion_patterns()
        example_audit_logging()
        example_cli_commands()
        
        print("\n" + "=" * 60)
        print("Examples completed successfully!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Run 'python setup_mcp_config.py' for interactive setup")
        print("2. Read 'MCP_DIRECTORY_CONFIGURATION_GUIDE.md' for detailed documentation")
        print("3. Start your MCP server with 'python official_mcp_server.py'")
        
    except Exception as e:
        print(f"\nExample failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
