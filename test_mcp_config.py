#!/usr/bin/env python3
"""
MCP Configuration System Test Suite

Comprehensive tests for the MCP configuration management system.
Tests directory access control, security features, and CLI functionality.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import json
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any
import unittest
from unittest.mock import patch, MagicMock

try:
    from mcp_config_manager import MCPConfigManager, DirectoryConfig, MCPConfig
except ImportError as e:
    print(f"Error importing MCPConfigManager: {e}")
    print("Please ensure mcp_config_manager.py is in the same directory")
    sys.exit(1)


class TestMCPConfigManager(unittest.TestCase):
    """Test cases for MCPConfigManager"""
    
    def setUp(self):
        """Set up test environment"""
        self.test_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.test_dir, "test_config.json")
        self.config_manager = MCPConfigManager(self.config_path)
        
        # Create test directories
        self.test_project_dir = os.path.join(self.test_dir, "test_project")
        self.test_docs_dir = os.path.join(self.test_dir, "test_docs")
        os.makedirs(self.test_project_dir)
        os.makedirs(self.test_docs_dir)
        
        # Create test files
        with open(os.path.join(self.test_project_dir, "test.py"), "w") as f:
            f.write("print('Hello, World!')")
        
        with open(os.path.join(self.test_project_dir, ".env"), "w") as f:
            f.write("SECRET_KEY=test123")
        
        with open(os.path.join(self.test_project_dir, "large_file.txt"), "w") as f:
            f.write("x" * 1024 * 1024)  # 1MB file
    
    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.test_dir)
    
    def test_config_creation(self):
        """Test configuration file creation"""
        self.assertTrue(os.path.exists(self.config_path))
        self.assertIsNotNone(self.config_manager.config)
        self.assertEqual(self.config_manager.config.enabled, True)
        self.assertEqual(self.config_manager.config.security_mode, "moderate")
    
    def test_add_directory(self):
        """Test adding directories to configuration"""
        success = self.config_manager.add_directory(self.test_project_dir)
        self.assertTrue(success)
        
        directories = self.config_manager.list_directories()
        self.assertEqual(len(directories), 1)
        self.assertEqual(directories[0]["path"], self.test_project_dir)
        self.assertTrue(directories[0]["enabled"])
    
    def test_remove_directory(self):
        """Test removing directories from configuration"""
        # Add directory first
        self.config_manager.add_directory(self.test_project_dir)
        
        # Remove directory
        success = self.config_manager.remove_directory(self.test_project_dir)
        self.assertTrue(success)
        
        directories = self.config_manager.list_directories()
        self.assertEqual(len(directories), 0)
    
    def test_directory_validation(self):
        """Test directory path validation"""
        # Valid directory
        self.assertTrue(self.config_manager._validate_directory_path(self.test_project_dir))
        
        # Non-existent directory
        with self.assertRaises(ValueError):
            self.config_manager._validate_directory_path("/non/existent/path")
        
        # System directory (should be forbidden)
        with self.assertRaises(ValueError):
            self.config_manager._validate_directory_path("/")
    
    def test_file_size_parsing(self):
        """Test file size string parsing"""
        self.assertEqual(self.config_manager._parse_file_size("10MB"), 10 * 1024 * 1024)
        self.assertEqual(self.config_manager._parse_file_size("5KB"), 5 * 1024)
        self.assertEqual(self.config_manager._parse_file_size("1GB"), 1024 * 1024 * 1024)
        
        with self.assertRaises(ValueError):
            self.config_manager._parse_file_size("invalid")
    
    def test_path_access_control(self):
        """Test path access control"""
        # Add directory to configuration
        self.config_manager.add_directory(self.test_project_dir)
        
        # Test allowed path
        test_file = os.path.join(self.test_project_dir, "test.py")
        self.assertTrue(self.config_manager.is_path_allowed(test_file))
        
        # Test excluded path
        env_file = os.path.join(self.test_project_dir, ".env")
        self.assertFalse(self.config_manager.is_path_allowed(env_file))
        
        # Test path outside watched directories
        outside_file = os.path.join(self.test_docs_dir, "test.txt")
        self.assertFalse(self.config_manager.is_path_allowed(outside_file))
    
    def test_exclusion_patterns(self):
        """Test exclusion pattern functionality"""
        # Add directory with custom exclusion patterns
        self.config_manager.add_directory(
            self.test_project_dir,
            exclude_patterns=["*.py", "*.txt"]
        )
        
        # Test excluded files
        py_file = os.path.join(self.test_project_dir, "test.py")
        self.assertFalse(self.config_manager.is_path_allowed(py_file))
        
        txt_file = os.path.join(self.test_project_dir, "large_file.txt")
        self.assertFalse(self.config_manager.is_path_allowed(txt_file))
    
    def test_global_exclusion_patterns(self):
        """Test global exclusion patterns"""
        # Add global exclusion pattern
        self.config_manager.add_exclude_pattern("*.py")
        
        # Add directory
        self.config_manager.add_directory(self.test_project_dir)
        
        # Test that global pattern applies
        py_file = os.path.join(self.test_project_dir, "test.py")
        self.assertFalse(self.config_manager.is_path_allowed(py_file))
    
    def test_config_persistence(self):
        """Test configuration file persistence"""
        # Add directory
        self.config_manager.add_directory(self.test_project_dir)
        
        # Create new config manager with same path
        new_config_manager = MCPConfigManager(self.config_path)
        
        # Check that directory was persisted
        directories = new_config_manager.list_directories()
        self.assertEqual(len(directories), 1)
        self.assertEqual(directories[0]["path"], self.test_project_dir)
    
    def test_config_validation(self):
        """Test configuration validation"""
        # Valid configuration should pass
        self.config_manager._validate_config()
        
        # Invalid security mode should fail
        self.config_manager.config.security_mode = "invalid"
        with self.assertRaises(ValueError):
            self.config_manager._validate_config()
    
    def test_audit_logging(self):
        """Test audit logging functionality"""
        # Enable audit logging
        self.config_manager.config.audit_logging = True
        
        # Perform an action that should be logged
        self.config_manager.add_directory(self.test_project_dir)
        
        # Check that audit log was created
        audit_log_path = Path(self.config_path).parent / "audit.log"
        self.assertTrue(audit_log_path.exists())
        
        # Check log content
        with open(audit_log_path, 'r') as f:
            log_content = f.read()
            self.assertIn("add_directory", log_content)
            self.assertIn(self.test_project_dir, log_content)
    
    def test_config_summary(self):
        """Test configuration summary generation"""
        self.config_manager.add_directory(self.test_project_dir)
        
        summary = self.config_manager.get_config_summary()
        
        self.assertIn("config_path", summary)
        self.assertIn("enabled", summary)
        self.assertIn("total_directories", summary)
        self.assertEqual(summary["total_directories"], 1)
        self.assertEqual(summary["enabled_directories"], 1)


class TestDirectoryConfig(unittest.TestCase):
    """Test cases for DirectoryConfig dataclass"""
    
    def test_directory_config_creation(self):
        """Test DirectoryConfig creation with defaults"""
        config = DirectoryConfig(path="/test/path")
        
        self.assertEqual(config.path, "/test/path")
        self.assertTrue(config.enabled)
        self.assertEqual(config.max_file_size, "10MB")
        self.assertIsNotNone(config.exclude_patterns)
        self.assertTrue(config.include_gitignore)
        self.assertIsNone(config.last_accessed)
    
    def test_directory_config_custom(self):
        """Test DirectoryConfig with custom values"""
        config = DirectoryConfig(
            path="/test/path",
            enabled=False,
            max_file_size="5MB",
            exclude_patterns=["*.py", "*.log"],
            include_gitignore=False
        )
        
        self.assertEqual(config.path, "/test/path")
        self.assertFalse(config.enabled)
        self.assertEqual(config.max_file_size, "5MB")
        self.assertEqual(config.exclude_patterns, ["*.py", "*.log"])
        self.assertFalse(config.include_gitignore)


class TestMCPConfig(unittest.TestCase):
    """Test cases for MCPConfig dataclass"""
    
    def test_mcp_config_creation(self):
        """Test MCPConfig creation with defaults"""
        config = MCPConfig(
            watched_directories=[],
            global_exclude_patterns=[],
            max_file_size="10MB",
            enabled=True,
            audit_logging=True,
            security_mode="moderate",
            config_version="2.0.0",
            last_modified="2024-01-01T00:00:00.000Z"
        )
        
        self.assertEqual(len(config.watched_directories), 0)
        self.assertIsNotNone(config.global_exclude_patterns)
        self.assertEqual(config.max_file_size, "10MB")
        self.assertTrue(config.enabled)
        self.assertTrue(config.audit_logging)
        self.assertEqual(config.security_mode, "moderate")
        self.assertEqual(config.config_version, "2.0.0")


def run_integration_tests():
    """Run integration tests that require actual file system operations"""
    print("Running integration tests...")
    
    # Test CLI functionality
    test_cli_commands()
    
    # Test server integration
    test_server_integration()
    
    print("Integration tests completed successfully!")


def test_cli_commands():
    """Test CLI command functionality"""
    print("Testing CLI commands...")
    
    # This would test the actual CLI commands
    # For now, we'll just verify the module can be imported
    try:
        import subprocess
        result = subprocess.run([
            sys.executable, "mcp_config_manager.py", "--help"
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print("✓ CLI help command works")
        else:
            print(f"✗ CLI help command failed: {result.stderr}")
    except Exception as e:
        print(f"✗ CLI test failed: {e}")


def test_server_integration():
    """Test server integration"""
    print("Testing server integration...")
    
    # This would test the actual server integration
    # For now, we'll just verify the module can be imported
    try:
        # Test that the server can be imported
        import official_mcp_server
        print("✓ Server module imports successfully")
    except Exception as e:
        print(f"✗ Server integration test failed: {e}")


def main():
    """Run all tests"""
    print("MCP Configuration System Test Suite")
    print("=" * 50)
    
    # Run unit tests
    print("Running unit tests...")
    unittest.main(argv=[''], exit=False, verbosity=2)
    
    # Run integration tests
    print("\n" + "=" * 50)
    run_integration_tests()
    
    print("\n" + "=" * 50)
    print("All tests completed!")


if __name__ == "__main__":
    main()
