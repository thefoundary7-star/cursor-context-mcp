"""
Comprehensive unit tests for enhanced MCP server features.

Tests all new MCP tools including code indexing, git integration, security features,
performance monitoring, and configuration management.

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
from unittest.mock import patch, MagicMock, mock_open, call
from dataclasses import dataclass
import pytest

# Mock imports that might block during module loading
with patch('mcp.server.fastmcp.FastMCP'), \
     patch('mcp_config_manager.MCPConfigManager'):

    # Import the modules to test
    try:
        from official_mcp_server import (
            # Core functions
            _list_files_sync,
            _read_file_sync,
            _get_git_status_sync,
            
            # Enhanced features
            CodeIndexer,
            FileWatcher,
            PerformanceMonitor,
            SecurityManager,
            
            # Tool functions (mocked)
            search_symbols,
            find_references,
            run_tests,
            get_documentation,
            analyze_dependencies,
            get_recent_changes,
            get_index_statistics,
            start_file_monitoring,
            stop_file_monitoring,
            performance_stats,
            cache_stats,
            clear_caches,
            configure_performance_limits,
            security_audit,
            get_security_summary,
            validate_configuration,
            get_privilege_status,
            set_read_only_mode,
            security_scan_directory,
            
            # Git tools
            get_git_diff,
            get_commit_history,
            get_file_blame,
            get_branch_info,
            find_commits_touching_file,
            
            # Configuration tools
            get_config_summary,
            list_watched_directories,
            check_path_access,
            
            # Global instances
            code_indexer,
            file_watcher,
            performance_monitor,
            security_manager,
            config_manager
        )
    except ImportError as e:
        pytest.skip(f"Enhanced MCP server modules not available: {e}", allow_module_level=True)


@dataclass
class MockSymbol:
    """Mock symbol for testing"""
    name: str
    type: str
    file_path: str
    line_number: int
    definition: str
    docstring: Optional[str] = None


@dataclass
class MockReference:
    """Mock reference for testing"""
    symbol_name: str
    file_path: str
    line_number: int
    context: str
    ref_type: str


class TestCodeIndexer:
    """Test cases for CodeIndexer class."""
    
    @pytest.mark.unit
    def test_code_indexer_initialization(self):
        """Test CodeIndexer initialization."""
        indexer = CodeIndexer()
        
        assert indexer.symbols == {}
        assert indexer.references == {}
        assert indexer.file_hashes == {}
        assert indexer.stats == {
            'files_indexed': 0,
            'symbols_found': 0,
            'references_found': 0,
            'indexing_time': 0.0
        }
    
    @pytest.mark.unit
    def test_index_file_success(self, test_project_dir):
        """Test successful file indexing."""
        indexer = CodeIndexer()
        test_file = os.path.join(test_project_dir, "test.py")
        
        # Create a test Python file
        with open(test_file, 'w') as f:
            f.write("""
def test_function():
    \"\"\"Test function docstring.\"\"\"
    return "hello"

class TestClass:
    def method(self):
        pass

variable = "test"
""")
        
        result = indexer.index_file(test_file)
        
        assert result["success"] is True
        assert result["symbols_found"] > 0
        assert result["references_found"] >= 0
        
        # Check that symbols were indexed
        assert "test_function" in [s.name for s in indexer.symbols.values()]
        assert "TestClass" in [s.name for s in indexer.symbols.values()]
    
    @pytest.mark.unit
    def test_index_file_nonexistent(self):
        """Test indexing non-existent file."""
        indexer = CodeIndexer()
        result = indexer.index_file("/non/existent/file.py")
        
        assert result["success"] is False
        assert "does not exist" in result["error"]
    
    @pytest.mark.unit
    def test_index_file_syntax_error(self, test_project_dir):
        """Test indexing file with syntax errors."""
        indexer = CodeIndexer()
        test_file = os.path.join(test_project_dir, "syntax_error.py")
        
        # Create a file with syntax errors
        with open(test_file, 'w') as f:
            f.write("def broken_function(\n    return 'missing closing paren'")
        
        result = indexer.index_file(test_file)
        
        assert result["success"] is False
        assert "syntax error" in result["error"].lower()
    
    @pytest.mark.unit
    def test_search_symbols(self, test_project_dir):
        """Test symbol search functionality."""
        indexer = CodeIndexer()
        test_file = os.path.join(test_project_dir, "search_test.py")
        
        # Create test file
        with open(test_file, 'w') as f:
            f.write("""
def search_function():
    pass

class SearchClass:
    def search_method(self):
        pass

search_variable = "test"
""")
        
        # Index the file
        indexer.index_file(test_file)
        
        # Search for symbols
        results = indexer.search_symbols("search", symbol_type="function")
        
        assert len(results) > 0
        assert any(s.name == "search_function" for s in results)
    
    @pytest.mark.unit
    def test_find_references(self, test_project_dir):
        """Test reference finding functionality."""
        indexer = CodeIndexer()
        test_file = os.path.join(test_project_dir, "ref_test.py")
        
        # Create test file with references
        with open(test_file, 'w') as f:
            f.write("""
def target_function():
    pass

def caller_function():
    target_function()  # Reference here

class TestClass:
    def method(self):
        target_function()  # Another reference
""")
        
        # Index the file
        indexer.index_file(test_file)
        
        # Find references
        references = indexer.find_references("target_function")
        
        assert len(references) >= 2
        assert all(ref.symbol_name == "target_function" for ref in references)
    
    @pytest.mark.unit
    def test_get_statistics(self):
        """Test getting indexer statistics."""
        indexer = CodeIndexer()
        stats = indexer.get_statistics()
        
        assert "files_indexed" in stats
        assert "symbols_found" in stats
        assert "references_found" in stats
        assert "indexing_time" in stats


class TestFileWatcher:
    """Test cases for FileWatcher class."""
    
    @pytest.mark.unit
    def test_file_watcher_initialization(self):
        """Test FileWatcher initialization."""
        watcher = FileWatcher()
        
        assert watcher.watched_directories == set()
        assert watcher.is_monitoring is False
        assert watcher.change_callbacks == []
        assert watcher.recent_changes == []
    
    @pytest.mark.unit
    def test_add_directory(self, test_project_dir):
        """Test adding directory to watch."""
        watcher = FileWatcher()
        result = watcher.add_directory(test_project_dir)
        
        assert result["success"] is True
        assert test_project_dir in watcher.watched_directories
    
    @pytest.mark.unit
    def test_remove_directory(self, test_project_dir):
        """Test removing directory from watch."""
        watcher = FileWatcher()
        
        # Add then remove directory
        watcher.add_directory(test_project_dir)
        result = watcher.remove_directory(test_project_dir)
        
        assert result["success"] is True
        assert test_project_dir not in watcher.watched_directories
    
    @pytest.mark.unit
    def test_start_monitoring(self):
        """Test starting file monitoring."""
        watcher = FileWatcher()
        result = watcher.start_monitoring()
        
        assert result["success"] is True
        assert watcher.is_monitoring is True
    
    @pytest.mark.unit
    def test_stop_monitoring(self):
        """Test stopping file monitoring."""
        watcher = FileWatcher()
        
        # Start then stop monitoring
        watcher.start_monitoring()
        result = watcher.stop_monitoring()
        
        assert result["success"] is True
        assert watcher.is_monitoring is False
    
    @pytest.mark.unit
    def test_get_recent_changes(self):
        """Test getting recent changes."""
        watcher = FileWatcher()
        
        # Add a mock change
        from official_mcp_server import FileChange
        change = FileChange(
            file_path="/test/file.py",
            change_type="modified",
            timestamp=time.time(),
            file_size=1024
        )
        watcher.recent_changes.append(change)
        
        recent = watcher.get_recent_changes(hours=24)
        
        assert len(recent) == 1
        assert recent[0]["file_path"] == "/test/file.py"
        assert recent[0]["change_type"] == "modified"


class TestPerformanceMonitor:
    """Test cases for PerformanceMonitor class."""
    
    @pytest.mark.unit
    def test_performance_monitor_initialization(self):
        """Test PerformanceMonitor initialization."""
        monitor = PerformanceMonitor()
        
        assert monitor.operation_times == {}
        assert monitor.operation_counts == {}
        assert monitor.memory_usage == 0
        assert monitor.max_files_per_operation == 1000
        assert monitor.max_search_results == 100
    
    @pytest.mark.unit
    def test_record_operation(self):
        """Test recording operation performance."""
        monitor = PerformanceMonitor()
        
        with monitor.record_operation("test_operation"):
            time.sleep(0.01)  # Simulate work
        
        assert "test_operation" in monitor.operation_times
        assert "test_operation" in monitor.operation_counts
        assert monitor.operation_counts["test_operation"] == 1
        assert monitor.operation_times["test_operation"] > 0.01
    
    @pytest.mark.unit
    def test_get_statistics(self):
        """Test getting performance statistics."""
        monitor = PerformanceMonitor()
        
        # Record some operations
        with monitor.record_operation("op1"):
            pass
        with monitor.record_operation("op2"):
            pass
        
        stats = monitor.get_statistics()
        
        assert "operation_times" in stats
        assert "operation_counts" in stats
        assert "memory_usage" in stats
        assert stats["operation_counts"]["op1"] == 1
        assert stats["operation_counts"]["op2"] == 1


class TestSecurityManager:
    """Test cases for SecurityManager class."""
    
    @pytest.mark.unit
    def test_security_manager_initialization(self):
        """Test SecurityManager initialization."""
        manager = SecurityManager()
        
        assert manager.audit_log == []
        assert manager.read_only_mode is False
        assert manager.security_patterns == []
    
    @pytest.mark.unit
    def test_log_access(self):
        """Test logging access attempts."""
        manager = SecurityManager()
        
        manager.log_access("/test/file.py", "read", "user", success=True)
        
        assert len(manager.audit_log) == 1
        assert manager.audit_log[0]["path"] == "/test/file.py"
        assert manager.audit_log[0]["operation"] == "read"
        assert manager.audit_log[0]["success"] is True
    
    @pytest.mark.unit
    def test_scan_file_security(self, test_project_dir):
        """Test security scanning of files."""
        manager = SecurityManager()
        test_file = os.path.join(test_project_dir, "security_test.py")
        
        # Create file with potential security issues
        with open(test_file, 'w') as f:
            f.write("""
password = "secret123"
api_key = "sk-1234567890abcdef"
def connect_db():
    return "mysql://user:pass@localhost/db"
""")
        
        result = manager.scan_file_security(test_file)
        
        assert result["success"] is True
        assert result["issues_found"] > 0
        assert any("password" in issue["description"].lower() for issue in result["issues"])
    
    @pytest.mark.unit
    def test_set_read_only_mode(self):
        """Test setting read-only mode."""
        manager = SecurityManager()
        
        result = manager.set_read_only_mode(True)
        
        assert result["success"] is True
        assert manager.read_only_mode is True
        
        result = manager.set_read_only_mode(False)
        
        assert result["success"] is True
        assert manager.read_only_mode is False


class TestEnhancedMCPTools:
    """Test cases for enhanced MCP tools."""
    
    @pytest.mark.unit
    def test_search_symbols_tool(self, test_project_dir):
        """Test search_symbols MCP tool."""
        # Mock the global code_indexer
        with patch('official_mcp_server.code_indexer') as mock_indexer:
            mock_indexer.search_symbols.return_value = [
                MockSymbol("test_func", "function", "/test.py", 1, "def test_func():")
            ]
            
            result = search_symbols("test", directory=test_project_dir)
            
            assert result["success"] is True
            assert len(result["symbols"]) == 1
            assert result["symbols"][0]["name"] == "test_func"
    
    @pytest.mark.unit
    def test_find_references_tool(self, test_project_dir):
        """Test find_references MCP tool."""
        with patch('official_mcp_server.code_indexer') as mock_indexer:
            mock_indexer.find_references.return_value = [
                MockReference("test_func", "/test.py", 5, "test_func()", "call")
            ]
            
            result = find_references("test_func", directory=test_project_dir)
            
            assert result["success"] is True
            assert len(result["references"]) == 1
            assert result["references"][0]["symbol_name"] == "test_func"
    
    @pytest.mark.unit
    def test_run_tests_tool(self, test_project_dir):
        """Test run_tests MCP tool."""
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "test passed"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = run_tests(directory=test_project_dir)
            
            assert result["success"] is True
            assert "test passed" in result["output"]
    
    @pytest.mark.unit
    def test_get_documentation_tool(self, test_project_dir):
        """Test get_documentation MCP tool."""
        # Create test files with documentation
        doc_file = os.path.join(test_project_dir, "module.py")
        with open(doc_file, 'w') as f:
            f.write('''
"""
Module documentation.
"""

def documented_function():
    """Function documentation."""
    pass

class DocumentedClass:
    """Class documentation."""
    pass
''')
        
        result = get_documentation(directory=test_project_dir)
        
        assert result["success"] is True
        assert len(result["documentation"]) > 0
    
    @pytest.mark.unit
    def test_analyze_dependencies_tool(self, test_project_dir):
        """Test analyze_dependencies MCP tool."""
        # Create requirements.txt
        req_file = os.path.join(test_project_dir, "requirements.txt")
        with open(req_file, 'w') as f:
            f.write("requests==2.28.0\npytest==7.0.0\n")
        
        result = analyze_dependencies(directory=test_project_dir)
        
        assert result["success"] is True
        assert "dependencies" in result
        assert len(result["dependencies"]) >= 2
    
    @pytest.mark.unit
    def test_get_recent_changes_tool(self):
        """Test get_recent_changes MCP tool."""
        with patch('official_mcp_server.file_watcher') as mock_watcher:
            mock_watcher.get_recent_changes.return_value = [
                {
                    "file_path": "/test/file.py",
                    "change_type": "modified",
                    "timestamp": time.time(),
                    "formatted_time": "2024-01-01 12:00:00"
                }
            ]
            
            result = get_recent_changes(hours=24)
            
            assert result["success"] is True
            assert len(result["changes"]) == 1
            assert result["changes"][0]["file_path"] == "/test/file.py"
    
    @pytest.mark.unit
    def test_get_index_statistics_tool(self):
        """Test get_index_statistics MCP tool."""
        with patch('official_mcp_server.code_indexer') as mock_indexer:
            mock_indexer.get_statistics.return_value = {
                "files_indexed": 10,
                "symbols_found": 50,
                "references_found": 100
            }
            
            result = get_index_statistics()
            
            assert result["success"] is True
            assert result["statistics"]["files_indexed"] == 10
            assert result["statistics"]["symbols_found"] == 50
    
    @pytest.mark.unit
    def test_start_file_monitoring_tool(self):
        """Test start_file_monitoring MCP tool."""
        with patch('official_mcp_server.file_watcher') as mock_watcher:
            mock_watcher.start_monitoring.return_value = {"success": True}
            
            result = start_file_monitoring()
            
            assert result["success"] is True
            mock_watcher.start_monitoring.assert_called_once()
    
    @pytest.mark.unit
    def test_stop_file_monitoring_tool(self):
        """Test stop_file_monitoring MCP tool."""
        with patch('official_mcp_server.file_watcher') as mock_watcher:
            mock_watcher.stop_monitoring.return_value = {"success": True}
            
            result = stop_file_monitoring()
            
            assert result["success"] is True
            mock_watcher.stop_monitoring.assert_called_once()
    
    @pytest.mark.unit
    def test_performance_stats_tool(self):
        """Test performance_stats MCP tool."""
        with patch('official_mcp_server.performance_monitor') as mock_monitor:
            mock_monitor.get_statistics.return_value = {
                "operation_times": {"test": 0.1},
                "operation_counts": {"test": 5}
            }
            
            result = performance_stats()
            
            assert result["success"] is True
            assert "operation_times" in result["statistics"]
            assert "operation_counts" in result["statistics"]
    
    @pytest.mark.unit
    def test_cache_stats_tool(self):
        """Test cache_stats MCP tool."""
        with patch('official_mcp_server.performance_monitor') as mock_monitor:
            mock_monitor.get_cache_stats.return_value = {
                "file_cache": {"hits": 10, "misses": 5},
                "symbol_cache": {"hits": 20, "misses": 3}
            }
            
            result = cache_stats()
            
            assert result["success"] is True
            assert "file_cache" in result["cache_stats"]
            assert "symbol_cache" in result["cache_stats"]
    
    @pytest.mark.unit
    def test_clear_caches_tool(self):
        """Test clear_caches MCP tool."""
        with patch('official_mcp_server.performance_monitor') as mock_monitor:
            mock_monitor.clear_caches.return_value = {"success": True}
            
            result = clear_caches()
            
            assert result["success"] is True
            mock_monitor.clear_caches.assert_called_once()
    
    @pytest.mark.unit
    def test_configure_performance_limits_tool(self):
        """Test configure_performance_limits MCP tool."""
        with patch('official_mcp_server.performance_monitor') as mock_monitor:
            mock_monitor.configure_limits.return_value = {"success": True}
            
            result = configure_performance_limits(
                max_files_per_operation=500,
                max_search_results=50
            )
            
            assert result["success"] is True
            mock_monitor.configure_limits.assert_called_once()
    
    @pytest.mark.unit
    def test_security_audit_tool(self, test_project_dir):
        """Test security_audit MCP tool."""
        test_file = os.path.join(test_project_dir, "security_test.py")
        
        # Create file with security issues
        with open(test_file, 'w') as f:
            f.write('password = "secret123"')
        
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.scan_file_security.return_value = {
                "success": True,
                "issues": [
                    {
                        "type": "hardcoded_password",
                        "line": 1,
                        "description": "Hardcoded password found"
                    }
                ]
            }
            
            result = security_audit(test_file)
            
            assert result["success"] is True
            assert len(result["issues"]) == 1
            assert result["issues"][0]["type"] == "hardcoded_password"
    
    @pytest.mark.unit
    def test_get_security_summary_tool(self):
        """Test get_security_summary MCP tool."""
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.get_audit_summary.return_value = {
                "total_audits": 10,
                "issues_found": 3,
                "read_only_mode": False
            }
            
            result = get_security_summary()
            
            assert result["success"] is True
            assert result["summary"]["total_audits"] == 10
            assert result["summary"]["issues_found"] == 3
    
    @pytest.mark.unit
    def test_validate_configuration_tool(self):
        """Test validate_configuration MCP tool."""
        with patch('official_mcp_server.config_manager') as mock_config:
            mock_config.validate_configuration.return_value = {
                "success": True,
                "issues": [],
                "warnings": []
            }
            
            result = validate_configuration()
            
            assert result["success"] is True
            assert len(result["issues"]) == 0
            assert len(result["warnings"]) == 0
    
    @pytest.mark.unit
    def test_get_privilege_status_tool(self):
        """Test get_privilege_status MCP tool."""
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.get_privilege_status.return_value = {
                "read_only_mode": False,
                "security_level": "moderate",
                "audit_enabled": True
            }
            
            result = get_privilege_status()
            
            assert result["success"] is True
            assert result["status"]["read_only_mode"] is False
            assert result["status"]["security_level"] == "moderate"
    
    @pytest.mark.unit
    def test_set_read_only_mode_tool(self):
        """Test set_read_only_mode MCP tool."""
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.set_read_only_mode.return_value = {"success": True}
            
            result = set_read_only_mode(enabled=True)
            
            assert result["success"] is True
            mock_security.set_read_only_mode.assert_called_once_with(True)
    
    @pytest.mark.unit
    def test_security_scan_directory_tool(self, test_project_dir):
        """Test security_scan_directory MCP tool."""
        with patch('official_mcp_server.security_manager') as mock_security:
            mock_security.scan_directory_security.return_value = {
                "success": True,
                "files_scanned": 5,
                "issues_found": 2,
                "issues": [
                    {
                        "file": "/test/file1.py",
                        "type": "hardcoded_password",
                        "line": 1
                    }
                ]
            }
            
            result = security_scan_directory(directory=test_project_dir)
            
            assert result["success"] is True
            assert result["files_scanned"] == 5
            assert result["issues_found"] == 2


class TestGitTools:
    """Test cases for enhanced Git tools."""
    
    @pytest.mark.unit
    def test_get_git_diff_tool(self, git_repo):
        """Test get_git_diff MCP tool."""
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "diff --git a/test.py b/test.py\n+new line"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_git_diff(directory=git_repo)
            
            assert result["success"] is True
            assert "diff --git" in result["diff"]
    
    @pytest.mark.unit
    def test_get_commit_history_tool(self, git_repo):
        """Test get_commit_history MCP tool."""
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "commit abc123\nAuthor: Test User\nDate: 2024-01-01\n\nTest commit"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_commit_history(directory=git_repo, limit=5)
            
            assert result["success"] is True
            assert len(result["commits"]) > 0
            assert "abc123" in result["commits"][0]["hash"]
    
    @pytest.mark.unit
    def test_get_file_blame_tool(self, git_repo):
        """Test get_file_blame MCP tool."""
        test_file = os.path.join(git_repo, "test.py")
        
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "abc123 (Author 2024-01-01) line content"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_file_blame(directory=git_repo, file_path=test_file)
            
            assert result["success"] is True
            assert len(result["blame_lines"]) > 0
            assert "abc123" in result["blame_lines"][0]["commit_hash"]
    
    @pytest.mark.unit
    def test_get_branch_info_tool(self, git_repo):
        """Test get_branch_info MCP tool."""
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "main\nfeature-branch"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_branch_info(directory=git_repo)
            
            assert result["success"] is True
            assert "main" in result["local_branches"]
            assert "feature-branch" in result["local_branches"]
    
    @pytest.mark.unit
    def test_find_commits_touching_file_tool(self, git_repo):
        """Test find_commits_touching_file MCP tool."""
        test_file = os.path.join(git_repo, "test.py")
        
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "abc123 Test commit"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = find_commits_touching_file(directory=git_repo, file_path=test_file)
            
            assert result["success"] is True
            assert len(result["commits"]) > 0
            assert "abc123" in result["commits"][0]["hash"]


class TestConfigurationTools:
    """Test cases for configuration management tools."""
    
    @pytest.mark.unit
    def test_get_config_summary_tool(self):
        """Test get_config_summary MCP tool."""
        with patch('official_mcp_server.config_manager') as mock_config:
            mock_config.get_summary.return_value = {
                "enabled": True,
                "security_mode": "moderate",
                "total_directories": 2,
                "enabled_directories": 2
            }
            
            result = get_config_summary()
            
            assert result["success"] is True
            assert result["config"]["enabled"] is True
            assert result["config"]["security_mode"] == "moderate"
    
    @pytest.mark.unit
    def test_list_watched_directories_tool(self):
        """Test list_watched_directories MCP tool."""
        with patch('official_mcp_server.config_manager') as mock_config:
            mock_config.list_directories.return_value = [
                {
                    "path": "/test/dir1",
                    "enabled": True,
                    "max_file_size": "10MB"
                },
                {
                    "path": "/test/dir2",
                    "enabled": False,
                    "max_file_size": "5MB"
                }
            ]
            
            result = list_watched_directories()
            
            assert result["success"] is True
            assert len(result["directories"]) == 2
            assert result["total_count"] == 2
            assert result["directories"][0]["path"] == "/test/dir1"
    
    @pytest.mark.unit
    def test_check_path_access_tool(self):
        """Test check_path_access MCP tool."""
        with patch('official_mcp_server.config_manager') as mock_config:
            mock_config.is_path_allowed.return_value = True
            
            result = check_path_access("/test/path")
            
            assert result["success"] is True
            assert result["allowed"] is True
            assert "allowed" in result["reason"].lower()


class TestErrorHandling:
    """Test cases for error handling in enhanced features."""
    
    @pytest.mark.unit
    def test_code_indexer_error_handling(self):
        """Test error handling in CodeIndexer."""
        indexer = CodeIndexer()
        
        # Test with invalid file
        result = indexer.index_file("/invalid/path/file.py")
        
        assert result["success"] is False
        assert "error" in result
    
    @pytest.mark.unit
    def test_file_watcher_error_handling(self):
        """Test error handling in FileWatcher."""
        watcher = FileWatcher()
        
        # Test removing non-existent directory
        result = watcher.remove_directory("/non/existent/dir")
        
        assert result["success"] is False
        assert "not found" in result["error"].lower()
    
    @pytest.mark.unit
    def test_performance_monitor_error_handling(self):
        """Test error handling in PerformanceMonitor."""
        monitor = PerformanceMonitor()
        
        # Test with invalid operation
        with pytest.raises(Exception):
            with monitor.record_operation(""):
                pass
    
    @pytest.mark.unit
    def test_security_manager_error_handling(self):
        """Test error handling in SecurityManager."""
        manager = SecurityManager()
        
        # Test scanning non-existent file
        result = manager.scan_file_security("/non/existent/file.py")
        
        assert result["success"] is False
        assert "does not exist" in result["error"]


class TestPerformanceBenchmarks:
    """Performance benchmark tests for enhanced features."""
    
    @pytest.mark.performance
    @pytest.mark.slow
    def test_code_indexing_performance(self, test_project_dir):
        """Test code indexing performance with large files."""
        indexer = CodeIndexer()
        
        # Create a large Python file
        large_file = os.path.join(test_project_dir, "large_file.py")
        with open(large_file, 'w') as f:
            for i in range(1000):
                f.write(f"def function_{i}():\n    return {i}\n\n")
        
        start_time = time.time()
        result = indexer.index_file(large_file)
        end_time = time.time()
        
        assert result["success"] is True
        assert (end_time - start_time) < 5.0  # Should complete within 5 seconds
        assert result["symbols_found"] == 1000
    
    @pytest.mark.performance
    @pytest.mark.slow
    def test_symbol_search_performance(self, test_project_dir):
        """Test symbol search performance with many symbols."""
        indexer = CodeIndexer()
        
        # Create multiple files with symbols
        for i in range(100):
            file_path = os.path.join(test_project_dir, f"file_{i}.py")
            with open(file_path, 'w') as f:
                f.write(f"def function_{i}():\n    return {i}\n")
            indexer.index_file(file_path)
        
        start_time = time.time()
        results = indexer.search_symbols("function_50")
        end_time = time.time()
        
        assert len(results) > 0
        assert (end_time - start_time) < 1.0  # Should complete within 1 second
    
    @pytest.mark.performance
    def test_memory_usage_tracking(self):
        """Test memory usage tracking."""
        monitor = PerformanceMonitor()
        
        # Simulate memory usage
        monitor.memory_usage = 1024 * 1024  # 1MB
        
        stats = monitor.get_statistics()
        
        assert stats["memory_usage"] == 1024 * 1024
        assert "memory_usage_mb" in stats
        assert stats["memory_usage_mb"] == 1.0


class TestCrossPlatformCompatibility:
    """Test cases for cross-platform compatibility."""
    
    @pytest.mark.unit
    def test_path_handling_windows(self):
        """Test path handling on Windows."""
        with patch('platform.system', return_value='Windows'):
            indexer = CodeIndexer()
            
            # Test Windows-style path
            windows_path = "C:\\Users\\test\\file.py"
            result = indexer._normalize_path(windows_path)
            
            assert result == windows_path
    
    @pytest.mark.unit
    def test_path_handling_unix(self):
        """Test path handling on Unix-like systems."""
        with patch('platform.system', return_value='Linux'):
            indexer = CodeIndexer()
            
            # Test Unix-style path
            unix_path = "/home/user/file.py"
            result = indexer._normalize_path(unix_path)
            
            assert result == unix_path
    
    @pytest.mark.unit
    def test_file_separator_handling(self):
        """Test file separator handling across platforms."""
        watcher = FileWatcher()
        
        # Test with different separators
        path1 = "dir1/dir2/file.py"  # Unix style
        path2 = "dir1\\dir2\\file.py"  # Windows style
        
        # Both should be handled correctly
        result1 = watcher._normalize_path(path1)
        result2 = watcher._normalize_path(path2)
        
        assert result1 is not None
        assert result2 is not None


class TestIntegrationWorkflows:
    """Integration tests for complete workflows."""
    
    @pytest.mark.integration
    def test_complete_indexing_workflow(self, test_project_dir):
        """Test complete code indexing workflow."""
        # Setup
        indexer = CodeIndexer()
        watcher = FileWatcher()
        
        # Create test files
        test_files = [
            "module1.py",
            "module2.py",
            "test_module.py"
        ]
        
        for filename in test_files:
            file_path = os.path.join(test_project_dir, filename)
            with open(file_path, 'w') as f:
                f.write(f"""
def {filename.replace('.py', '_func')}():
    \"\"\"Function in {filename}\"\"\"
    return "{filename}"

class {filename.replace('.py', '_class').title()}:
    def method(self):
        return {filename.replace('.py', '_func')}()
""")
        
        # Add directory to watcher
        watcher.add_directory(test_project_dir)
        
        # Index all files
        for filename in test_files:
            file_path = os.path.join(test_project_dir, filename)
            result = indexer.index_file(file_path)
            assert result["success"] is True
        
        # Search for symbols
        results = indexer.search_symbols("module1", symbol_type="function")
        assert len(results) > 0
        
        # Find references
        references = indexer.find_references("module1_func")
        assert len(references) > 0
        
        # Get statistics
        stats = indexer.get_statistics()
        assert stats["files_indexed"] == 3
        assert stats["symbols_found"] > 0
    
    @pytest.mark.integration
    def test_git_integration_workflow(self, git_repo):
        """Test complete git integration workflow."""
        # Create test files in git repo
        test_file = os.path.join(git_repo, "integration_test.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    return 'test'")
        
        # Test git status
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = " M integration_test.py"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = _get_git_status_sync(git_repo)
            assert result["success"] is True
            assert "integration_test.py" in result["modified_files"]
        
        # Test git diff
        with patch('subprocess.run') as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = "diff --git a/integration_test.py b/integration_test.py"
            mock_result.stderr = ""
            mock_run.return_value = mock_result
            
            result = get_git_diff(directory=git_repo, file_path=test_file)
            assert result["success"] is True
            assert "diff --git" in result["diff"]
    
    @pytest.mark.integration
    def test_security_workflow(self, test_project_dir):
        """Test complete security workflow."""
        # Setup security manager
        security = SecurityManager()
        
        # Create files with security issues
        security_files = [
            ("secrets.py", "password = 'secret123'"),
            ("config.py", "api_key = 'sk-1234567890'"),
            ("safe.py", "def safe_function():\n    return 'safe'")
        ]
        
        for filename, content in security_files:
            file_path = os.path.join(test_project_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        # Scan files for security issues
        issues_found = 0
        for filename, _ in security_files:
            file_path = os.path.join(test_project_dir, filename)
            result = security.scan_file_security(file_path)
            if result["success"] and result["issues"]:
                issues_found += len(result["issues"])
        
        # Should find security issues in secrets.py and config.py
        assert issues_found > 0
        
        # Test audit logging
        security.log_access("/test/file.py", "read", "user", success=True)
        assert len(security.audit_log) == 1
        
        # Test read-only mode
        result = security.set_read_only_mode(True)
        assert result["success"] is True
        assert security.read_only_mode is True


# Performance test markers
pytestmark = [
    pytest.mark.unit,
    pytest.mark.enhanced_features
]
