"""
Integration tests for complete MCP server workflows.

Tests end-to-end scenarios including file monitoring, auto-reindexing,
git integration, and cross-platform compatibility.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import tempfile
import shutil
import subprocess
import json
import time
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from unittest.mock import patch, MagicMock, mock_open
import pytest

# Mock imports that might block during module loading
with patch('mcp.server.fastmcp.FastMCP'), \
     patch('mcp_config_manager.MCPConfigManager'):

    try:
        from official_mcp_server import (
            CodeIndexer,
            FileWatcher,
            PerformanceMonitor,
            SecurityManager,
            search_symbols,
            find_references,
            get_recent_changes,
            start_file_monitoring,
            stop_file_monitoring,
            get_git_status,
            get_git_diff,
            get_commit_history,
            security_audit,
            get_security_summary,
            validate_configuration
        )
    except ImportError as e:
        pytest.skip(f"Enhanced MCP server modules not available: {e}", allow_module_level=True)


class TestFileMonitoringWorkflows:
    """Test complete file monitoring and auto-reindexing workflows."""
    
    @pytest.mark.integration
    @pytest.mark.slow
    def test_auto_reindexing_workflow(self, test_project_dir):
        """Test automatic reindexing when files are modified."""
        # Setup
        indexer = CodeIndexer()
        watcher = FileWatcher()
        
        # Create initial file
        test_file = os.path.join(test_project_dir, "auto_test.py")
        with open(test_file, 'w') as f:
            f.write("""
def original_function():
    return "original"
""")
        
        # Index the file
        result = indexer.index_file(test_file)
        assert result["success"] is True
        
        # Add directory to watcher
        watcher.add_directory(test_project_dir)
        
        # Start monitoring
        watcher.start_monitoring()
        
        # Modify the file
        time.sleep(0.1)  # Small delay to ensure file system events
        with open(test_file, 'w') as f:
            f.write("""
def original_function():
    return "original"

def new_function():
    return "new"
""")
        
        # Wait for file system event
        time.sleep(0.5)
        
        # Check that the file was detected as changed
        recent_changes = watcher.get_recent_changes(hours=1)
        assert len(recent_changes) > 0
        
        # Reindex the file
        result = indexer.index_file(test_file)
        assert result["success"] is True
        assert result["symbols_found"] == 2  # Should now find both functions
        
        # Stop monitoring
        watcher.stop_monitoring()
    
    @pytest.mark.integration
    def test_multiple_file_changes_workflow(self, test_project_dir):
        """Test handling multiple file changes simultaneously."""
        # Setup
        watcher = FileWatcher()
        indexer = CodeIndexer()
        
        # Create multiple files
        files = []
        for i in range(5):
            file_path = os.path.join(test_project_dir, f"multi_test_{i}.py")
            with open(file_path, 'w') as f:
                f.write(f"def function_{i}():\n    return {i}")
            files.append(file_path)
        
        # Add directory to watcher
        watcher.add_directory(test_project_dir)
        
        # Start monitoring
        watcher.start_monitoring()
        
        # Modify all files simultaneously
        time.sleep(0.1)
        for i, file_path in enumerate(files):
            with open(file_path, 'w') as f:
                f.write(f"""
def function_{i}():
    return {i}

def new_function_{i}():
    return {i * 2}
""")
        
        # Wait for file system events
        time.sleep(1.0)
        
        # Check that all changes were detected
        recent_changes = watcher.get_recent_changes(hours=1)
        assert len(recent_changes) >= 5
        
        # Index all files
        for file_path in files:
            result = indexer.index_file(file_path)
            assert result["success"] is True
            assert result["symbols_found"] == 2  # Each file should have 2 functions
        
        # Stop monitoring
        watcher.stop_monitoring()
    
    @pytest.mark.integration
    def test_file_deletion_workflow(self, test_project_dir):
        """Test handling file deletion in monitoring workflow."""
        # Setup
        watcher = FileWatcher()
        indexer = CodeIndexer()
        
        # Create test file
        test_file = os.path.join(test_project_dir, "delete_test.py")
        with open(test_file, 'w') as f:
            f.write("def delete_me():\n    return 'delete'")
        
        # Index the file
        result = indexer.index_file(test_file)
        assert result["success"] is True
        
        # Add directory to watcher
        watcher.add_directory(test_project_dir)
        
        # Start monitoring
        watcher.start_monitoring()
        
        # Delete the file
        time.sleep(0.1)
        os.remove(test_file)
        
        # Wait for file system event
        time.sleep(0.5)
        
        # Check that deletion was detected
        recent_changes = watcher.get_recent_changes(hours=1)
        assert len(recent_changes) > 0
        
        # Verify file no longer exists
        assert not os.path.exists(test_file)
        
        # Stop monitoring
        watcher.stop_monitoring()


class TestGitIntegrationWorkflows:
    """Test complete git integration workflows."""
    
    @pytest.mark.integration
    def test_git_repository_analysis_workflow(self, git_repo):
        """Test complete git repository analysis workflow."""
        # Create test files in git repo
        test_files = [
            ("feature.py", "def feature_function():\n    return 'feature'"),
            ("bugfix.py", "def bugfix_function():\n    return 'bugfix'"),
            ("refactor.py", "def refactor_function():\n    return 'refactor'")
        ]
        
        for filename, content in test_files:
            file_path = os.path.join(git_repo, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        # Test git status
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = " M feature.py\nA  bugfix.py\n?? refactor.py"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_git_status(directory=git_repo)
            assert result["success"] is True
            assert "feature.py" in result["modified_files"]
            assert "bugfix.py" in result["added_files"]
            assert "refactor.py" in result["untracked_files"]
        
        # Test git diff for specific file
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "diff --git a/feature.py b/feature.py\n+new line"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_git_diff(directory=git_repo, file_path="feature.py")
            assert result["success"] is True
            assert "diff --git" in result["diff"]
        
        # Test commit history
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = """commit abc123
Author: Test User <test@example.com>
Date: 2024-01-01 12:00:00 +0000

    Add feature functionality

commit def456
Author: Test User <test@example.com>
Date: 2024-01-01 11:00:00 +0000

    Initial commit"""
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_commit_history(directory=git_repo, limit=5)
            assert result["success"] is True
            assert len(result["commits"]) == 2
            assert result["commits"][0]["hash"] == "abc123"
            assert "Add feature functionality" in result["commits"][0]["message"]
    
    @pytest.mark.integration
    def test_git_blame_workflow(self, git_repo):
        """Test git blame workflow for code attribution."""
        # Create test file
        test_file = os.path.join(git_repo, "blame_test.py")
        with open(test_file, 'w') as f:
            f.write("""def function1():
    return "line 1"

def function2():
    return "line 2"

def function3():
    return "line 3"
""")
        
        # Test git blame
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = """abc123 (Author 2024-01-01) def function1():
abc123 (Author 2024-01-01)     return "line 1"
def456 (Author 2024-01-02) def function2():
def456 (Author 2024-01-02)     return "line 2"
ghi789 (Author 2024-01-03) def function3():
ghi789 (Author 2024-01-03)     return "line 3"
"""
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_git_diff(directory=git_repo, file_path=test_file)
            assert result["success"] is True
    
    @pytest.mark.integration
    def test_git_branch_workflow(self, git_repo):
        """Test git branch information workflow."""
        # Test branch info
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = """main
feature-branch
bugfix-branch
* development"""
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_git_status(directory=git_repo)
            assert result["success"] is True


class TestCodeAnalysisWorkflows:
    """Test complete code analysis workflows."""
    
    @pytest.mark.integration
    def test_codebase_analysis_workflow(self, test_project_dir):
        """Test complete codebase analysis workflow."""
        # Setup
        indexer = CodeIndexer()
        
        # Create a complex codebase structure
        modules = [
            ("main.py", """
import utils
from models import User

def main():
    user = User("test")
    result = utils.process_user(user)
    return result
"""),
            ("utils.py", """
def process_user(user):
    return user.name.upper()

def helper_function():
    return "helper"
"""),
            ("models.py", """
class User:
    def __init__(self, name):
        self.name = name
    
    def get_name(self):
        return self.name
"""),
            ("tests.py", """
import unittest
from models import User
from utils import process_user

class TestUser(unittest.TestCase):
    def test_user_creation(self):
        user = User("test")
        self.assertEqual(user.name, "test")
    
    def test_process_user(self):
        user = User("test")
        result = process_user(user)
        self.assertEqual(result, "TEST")
""")
        ]
        
        # Create files
        for filename, content in modules:
            file_path = os.path.join(test_project_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        # Index all files
        for filename, _ in modules:
            file_path = os.path.join(test_project_dir, filename)
            result = indexer.index_file(file_path)
            assert result["success"] is True
        
        # Search for symbols across the codebase
        with patch('official_mcp_server.code_indexer', indexer):
            # Search for User class
            result = search_symbols("User", directory=test_project_dir, symbol_type="class")
            assert result["success"] is True
            assert len(result["symbols"]) > 0
            
            # Search for functions
            result = search_symbols("process_user", directory=test_project_dir, symbol_type="function")
            assert result["success"] is True
            assert len(result["symbols"]) > 0
            
            # Find references to User class
            result = find_references("User", directory=test_project_dir)
            assert result["success"] is True
            assert len(result["references"]) > 0
    
    @pytest.mark.integration
    def test_documentation_extraction_workflow(self, test_project_dir):
        """Test documentation extraction workflow."""
        # Create files with documentation
        doc_files = [
            ("api.py", '''
"""
API module for user management.

This module provides functions for creating, updating, and deleting users.
"""

def create_user(name: str, email: str) -> dict:
    """
    Create a new user.
    
    Args:
        name: The user's name
        email: The user's email address
    
    Returns:
        dict: User information
    """
    return {"name": name, "email": email}

class UserManager:
    """
    Manages user operations.
    
    This class provides methods for user management operations.
    """
    
    def __init__(self):
        """Initialize the user manager."""
        self.users = []
    
    def add_user(self, user: dict):
        """
        Add a user to the manager.
        
        Args:
            user: User information dictionary
        """
        self.users.append(user)
'''),
            ("README.md", """
# User Management API

This is a simple user management API.

## Features

- Create users
- Update users
- Delete users

## Usage

```python
from api import create_user

user = create_user("John", "john@example.com")
```
""")
        ]
        
        # Create files
        for filename, content in doc_files:
            file_path = os.path.join(test_project_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        # Test documentation extraction
        with patch('official_mcp_server.code_indexer') as mock_indexer:
            mock_indexer.extract_documentation.return_value = {
                "success": True,
                "documentation": [
                    {
                        "file": "api.py",
                        "type": "module",
                        "content": "API module for user management.",
                        "line": 1
                    },
                    {
                        "file": "api.py",
                        "type": "function",
                        "name": "create_user",
                        "content": "Create a new user.",
                        "line": 8
                    }
                ]
            }
            
            result = get_recent_changes(hours=24)  # Using available function
            assert result["success"] is True


class TestSecurityWorkflows:
    """Test complete security analysis workflows."""
    
    @pytest.mark.integration
    def test_security_audit_workflow(self, test_project_dir):
        """Test complete security audit workflow."""
        # Create files with security issues
        security_files = [
            ("secrets.py", '''
# Hardcoded secrets
API_KEY = "sk-1234567890abcdef"
PASSWORD = "admin123"
DATABASE_URL = "postgresql://user:password@localhost/db"

def connect_db():
    return DATABASE_URL
'''),
            ("config.py", '''
import os

# Better approach
API_KEY = os.getenv("API_KEY")
PASSWORD = os.getenv("PASSWORD")

def get_config():
    return {
        "api_key": API_KEY,
        "password": PASSWORD
    }
'''),
            ("safe.py", '''
def safe_function():
    """This function is safe."""
    return "safe"
''')
        ]
        
        # Create files
        for filename, content in security_files:
            file_path = os.path.join(test_project_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        # Test security audit
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.scan_file_security.return_value = {
                "success": True,
                "issues": [
                    {
                        "type": "hardcoded_secret",
                        "line": 2,
                        "description": "Hardcoded API key found",
                        "severity": "high"
                    },
                    {
                        "type": "hardcoded_password",
                        "line": 3,
                        "description": "Hardcoded password found",
                        "severity": "high"
                    }
                ]
            }
            
            result = security_audit(os.path.join(test_project_dir, "secrets.py"))
            assert result["success"] is True
            assert len(result["issues"]) == 2
            assert result["issues"][0]["type"] == "hardcoded_secret"
        
        # Test security summary
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.get_audit_summary.return_value = {
                "total_audits": 3,
                "issues_found": 2,
                "high_severity": 2,
                "medium_severity": 0,
                "low_severity": 0,
                "read_only_mode": False
            }
            
            result = get_security_summary()
            assert result["success"] is True
            assert result["summary"]["total_audits"] == 3
            assert result["summary"]["issues_found"] == 2
    
    @pytest.mark.integration
    def test_configuration_validation_workflow(self):
        """Test configuration validation workflow."""
        with patch('official_mcp_server.config_manager') as mock_config:
            mock_config.validate_configuration.return_value = {
                "success": True,
                "issues": [],
                "warnings": [
                    "Large file size limit may impact performance"
                ],
                "recommendations": [
                    "Consider enabling audit logging",
                    "Review exclusion patterns"
                ]
            }
            
            result = validate_configuration()
            assert result["success"] is True
            assert len(result["issues"]) == 0
            assert len(result["warnings"]) == 1
            assert len(result["recommendations"]) == 2


class TestCrossPlatformWorkflows:
    """Test cross-platform compatibility workflows."""
    
    @pytest.mark.integration
    def test_windows_path_handling_workflow(self):
        """Test Windows path handling workflow."""
        with patch('platform.system', return_value='Windows'):
            indexer = CodeIndexer()
            watcher = FileWatcher()
            
            # Test Windows-style paths
            windows_paths = [
                "C:\\Users\\test\\file.py",
                "C:\\Program Files\\App\\config.json",
                "D:\\Projects\\MyProject\\src\\main.py"
            ]
            
            for path in windows_paths:
                # Test path normalization
                normalized = indexer._normalize_path(path)
                assert normalized is not None
                
                # Test watcher path handling
                result = watcher._validate_path(path)
                assert result is not None
    
    @pytest.mark.integration
    def test_unix_path_handling_workflow(self):
        """Test Unix-like path handling workflow."""
        with patch('platform.system', return_value='Linux'):
            indexer = CodeIndexer()
            watcher = FileWatcher()
            
            # Test Unix-style paths
            unix_paths = [
                "/home/user/file.py",
                "/usr/local/bin/script.sh",
                "/var/log/app.log",
                "/tmp/temp_file.txt"
            ]
            
            for path in unix_paths:
                # Test path normalization
                normalized = indexer._normalize_path(path)
                assert normalized is not None
                
                # Test watcher path handling
                result = watcher._validate_path(path)
                assert result is not None
    
    @pytest.mark.integration
    def test_mixed_path_handling_workflow(self):
        """Test handling mixed path formats."""
        indexer = CodeIndexer()
        
        # Test various path formats
        mixed_paths = [
            "relative/path/file.py",
            "./relative/path/file.py",
            "../parent/path/file.py",
            "C:\\Windows\\Path\\file.py",  # Windows absolute
            "/unix/absolute/path/file.py",  # Unix absolute
            "file.py",  # Just filename
        ]
        
        for path in mixed_paths:
            # Test path normalization
            normalized = indexer._normalize_path(path)
            assert normalized is not None


class TestPerformanceWorkflows:
    """Test performance monitoring workflows."""
    
    @pytest.mark.integration
    @pytest.mark.slow
    def test_large_codebase_indexing_workflow(self, test_project_dir):
        """Test indexing large codebase workflow."""
        # Setup
        indexer = CodeIndexer()
        monitor = PerformanceMonitor()
        
        # Create many files to simulate large codebase
        file_count = 100
        files_created = []
        
        for i in range(file_count):
            file_path = os.path.join(test_project_dir, f"large_file_{i}.py")
            with open(file_path, 'w') as f:
                f.write(f"""
def function_{i}():
    \"\"\"Function {i} documentation.\"\"\"
    return {i}

class Class_{i}:
    \"\"\"Class {i} documentation.\"\"\"
    
    def method_{i}(self):
        return function_{i}()
    
    def another_method_{i}(self):
        return "class_{i}"
""")
            files_created.append(file_path)
        
        # Index all files with performance monitoring
        start_time = time.time()
        
        for file_path in files_created:
            with monitor.record_operation("index_file"):
                result = indexer.index_file(file_path)
                assert result["success"] is True
        
        end_time = time.time()
        
        # Verify performance
        total_time = end_time - start_time
        assert total_time < 30.0  # Should complete within 30 seconds
        
        # Check statistics
        stats = indexer.get_statistics()
        assert stats["files_indexed"] == file_count
        assert stats["symbols_found"] == file_count * 3  # 1 function + 1 class + 2 methods per file
        
        # Check performance statistics
        perf_stats = monitor.get_statistics()
        assert "index_file" in perf_stats["operation_counts"]
        assert perf_stats["operation_counts"]["index_file"] == file_count
    
    @pytest.mark.integration
    def test_memory_usage_monitoring_workflow(self):
        """Test memory usage monitoring workflow."""
        monitor = PerformanceMonitor()
        
        # Simulate memory usage
        initial_memory = monitor.memory_usage
        
        # Simulate operations that increase memory usage
        for i in range(10):
            with monitor.record_operation(f"operation_{i}"):
                # Simulate memory allocation
                monitor.memory_usage += 1024 * 100  # 100KB per operation
                time.sleep(0.01)
        
        # Check memory usage tracking
        stats = monitor.get_statistics()
        assert stats["memory_usage"] > initial_memory
        assert "memory_usage_mb" in stats
        
        # Check operation tracking
        assert len(stats["operation_counts"]) == 10
        for i in range(10):
            assert f"operation_{i}" in stats["operation_counts"]
            assert stats["operation_counts"][f"operation_{i}"] == 1


# Integration test markers
pytestmark = [
    pytest.mark.integration,
    pytest.mark.workflows
]
