"""
Unit tests for official_mcp_server.py

Comprehensive test suite covering all MCP tools, error handling, security,
and configuration integration.

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
from pathlib import Path
from typing import Dict, Any
from unittest.mock import patch, MagicMock, mock_open

import pytest

# Mock imports that might block during module loading
with patch('mcp.server.fastmcp.FastMCP'), \
     patch('mcp_config_manager.MCPConfigManager'):

    # Import the modules to test
    try:
        from official_mcp_server import (
            _list_files_sync,
            _read_file_sync,
            _get_git_status_sync,
            register_tools,
            run_persistent_server,
            setup_signal_handlers
        )
    except ImportError as e:
        pytest.skip(f"MCP server modules not available: {e}", allow_module_level=True)


class TestListFilesSync:
    """Test cases for _list_files_sync function."""
    
    @pytest.mark.unit
    def test_list_files_success(self, test_project_dir, config_manager):
        """Test successful file listing."""
        # Add directory to configuration
        config_manager.add_directory(test_project_dir)
        
        # Mock the global config_manager
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(test_project_dir)
        
        assert result["success"] is True
        assert result["directory"] == test_project_dir
        assert "files" in result
        assert "directories" in result
        assert result["total_files"] >= 0
        assert result["total_directories"] >= 0
    
    @pytest.mark.unit
    def test_list_files_nonexistent_directory(self):
        """Test listing files in non-existent directory."""
        result = _list_files_sync("/non/existent/path")
        
        assert result["success"] is False
        assert "does not exist" in result["error"]
        assert result["files"] == []
        assert result["directories"] == []
    
    @pytest.mark.unit
    def test_list_files_not_directory(self, test_project_dir):
        """Test listing files when path is not a directory."""
        test_file = os.path.join(test_project_dir, "test.py")
        result = _list_files_sync(test_file)
        
        assert result["success"] is False
        assert "not a directory" in result["error"]
        assert result["files"] == []
        assert result["directories"] == []
    
    @pytest.mark.unit
    def test_list_files_permission_denied(self, config_manager):
        """Test listing files with permission denied."""
        # Create a directory that we can't access
        with patch('pathlib.Path.iterdir', side_effect=PermissionError("Permission denied")):
            result = _list_files_sync("/some/path")
        
        assert result["success"] is False
        assert "Permission denied" in result["error"]
        assert result["files"] == []
        assert result["directories"] == []
    
    @pytest.mark.unit
    def test_list_files_config_restriction(self, test_project_dir, config_manager):
        """Test file listing with configuration restrictions."""
        # Don't add directory to configuration
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(test_project_dir)
        
        assert result["success"] is False
        assert "not allowed by configuration" in result["error"]
        assert result["files"] == []
        assert result["directories"] == []
    
    @pytest.mark.unit
    def test_list_files_excluded_files(self, test_project_dir, config_manager):
        """Test that excluded files are not listed."""
        # Add directory with exclusion patterns
        config_manager.add_directory(
            test_project_dir,
            exclude_patterns=["*.py", ".env*"]
        )
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(test_project_dir)
        
        assert result["success"] is True
        
        # Check that excluded files are not in the result
        file_names = [f["name"] for f in result["files"]]
        assert "test.py" not in file_names
        assert ".env" not in file_names
        assert "test.txt" in file_names  # Should be included
    
    @pytest.mark.unit
    def test_list_files_current_directory(self, config_manager):
        """Test listing files in current directory."""
        current_dir = os.getcwd()
        config_manager.add_directory(current_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(".")
        
        assert result["success"] is True
        assert result["directory"] == current_dir
    
    @pytest.mark.unit
    def test_list_files_relative_path(self, test_project_dir, config_manager):
        """Test listing files with relative path."""
        config_manager.add_directory(test_project_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(os.path.relpath(test_project_dir))
        
        assert result["success"] is True
    
    @pytest.mark.unit
    def test_list_files_empty_directory(self, temp_dir, config_manager):
        """Test listing files in empty directory."""
        empty_dir = os.path.join(temp_dir, "empty")
        os.makedirs(empty_dir)
        config_manager.add_directory(empty_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(empty_dir)
        
        assert result["success"] is True
        assert result["files"] == []
        assert result["directories"] == []
        assert result["total_files"] == 0
        assert result["total_directories"] == 0


class TestReadFileSync:
    """Test cases for _read_file_sync function."""
    
    @pytest.mark.unit
    def test_read_file_success(self, test_project_dir, config_manager):
        """Test successful file reading."""
        config_manager.add_directory(test_project_dir)
        test_file = os.path.join(test_project_dir, "test.txt")
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(test_file)
        
        assert result["success"] is True
        assert result["file_path"] == test_file
        assert result["content"] == "This is a test file"
        assert result["lines"] == 1
        assert result["size"] > 0
        assert result["truncated"] is False
    
    @pytest.mark.unit
    def test_read_file_nonexistent(self, config_manager):
        """Test reading non-existent file."""
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync("/non/existent/file.txt")
        
        assert result["success"] is False
        assert "does not exist" in result["error"]
        assert result["content"] == ""
        assert result["lines"] == 0
    
    @pytest.mark.unit
    def test_read_file_not_file(self, test_project_dir, config_manager):
        """Test reading when path is not a file."""
        config_manager.add_directory(test_project_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(test_project_dir)
        
        assert result["success"] is False
        assert "not a file" in result["error"]
        assert result["content"] == ""
        assert result["lines"] == 0
    
    @pytest.mark.unit
    def test_read_file_config_restriction(self, test_project_dir, config_manager):
        """Test file reading with configuration restrictions."""
        # Don't add directory to configuration
        test_file = os.path.join(test_project_dir, "test.txt")
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(test_file)
        
        assert result["success"] is False
        assert "not allowed by configuration" in result["error"]
        assert result["content"] == ""
        assert result["lines"] == 0
    
    @pytest.mark.unit
    def test_read_file_size_limit(self, test_project_dir, config_manager):
        """Test file reading with size limit."""
        # Add directory with small size limit
        config_manager.add_directory(test_project_dir, max_file_size="1KB")
        large_file = os.path.join(test_project_dir, "large_file.txt")
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(large_file)
        
        assert result["success"] is False
        assert "too large" in result["error"]
        assert result["content"] == ""
        assert result["lines"] == 0
    
    @pytest.mark.unit
    def test_read_file_max_lines(self, test_project_dir, config_manager):
        """Test file reading with max_lines parameter."""
        config_manager.add_directory(test_project_dir)
        
        # Create a multi-line file
        multiline_file = os.path.join(test_project_dir, "multiline.txt")
        with open(multiline_file, 'w') as f:
            f.write("line1\nline2\nline3\nline4\nline5")
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(multiline_file, max_lines=3)
        
        assert result["success"] is True
        assert result["lines"] == 3
        assert result["truncated"] is True
        assert "line1" in result["content"]
        assert "line3" in result["content"]
        assert "line4" not in result["content"]
    
    @pytest.mark.unit
    def test_read_file_encoding_error(self, test_project_dir, config_manager):
        """Test file reading with encoding errors."""
        config_manager.add_directory(test_project_dir)
        
        # Create a file with invalid UTF-8 content
        binary_file = os.path.join(test_project_dir, "binary.bin")
        with open(binary_file, 'wb') as f:
            f.write(b'\xff\xfe\x00\x00')  # Invalid UTF-8
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(binary_file)
        
        # Should fall back to latin-1 encoding
        assert result["success"] is True
        assert result["content"] is not None
    
    @pytest.mark.unit
    def test_read_file_permission_denied(self, test_project_dir, config_manager):
        """Test file reading with permission denied."""
        config_manager.add_directory(test_project_dir)
        test_file = os.path.join(test_project_dir, "test.txt")
        
        with patch('builtins.open', side_effect=PermissionError("Permission denied")):
            with patch('official_mcp_server.config_manager', config_manager):
                result = _read_file_sync(test_file)
        
        assert result["success"] is False
        assert "Permission denied" in result["error"]
        assert result["content"] == ""
        assert result["lines"] == 0
    
    @pytest.mark.unit
    def test_read_file_line_counting(self, test_project_dir, config_manager):
        """Test accurate line counting."""
        config_manager.add_directory(test_project_dir)
        
        # Create files with different line endings
        test_cases = [
            ("no_newline.txt", "single line", 1),
            ("with_newline.txt", "line1\nline2", 2),
            ("empty.txt", "", 1),  # Empty file should have 1 line
            ("windows_newlines.txt", "line1\r\nline2\r\n", 2),
        ]
        
        for filename, content, expected_lines in test_cases:
            file_path = os.path.join(test_project_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
            
            with patch('official_mcp_server.config_manager', config_manager):
                result = _read_file_sync(file_path)
            
            assert result["success"] is True
            assert result["lines"] == expected_lines, f"Failed for {filename}"


class TestGetGitStatusSync:
    """Test cases for _get_git_status_sync function."""
    
    @pytest.mark.unit
    def test_get_git_status_success(self, git_repo):
        """Test successful git status retrieval."""
        result = _get_git_status_sync(git_repo)
        
        assert result["success"] is True
        assert result["is_git_repo"] is True
        assert result["directory"] == git_repo
        assert "current_branch" in result
        assert "modified_files" in result
        assert "added_files" in result
        assert "deleted_files" in result
        assert "untracked_files" in result
        assert "total_changes" in result
    
    @pytest.mark.unit
    def test_get_git_status_not_git_repo(self, test_project_dir):
        """Test git status on non-git directory."""
        result = _get_git_status_sync(test_project_dir)
        
        assert result["success"] is True
        assert result["is_git_repo"] is False
        assert "Not a git repository" in result["message"]
    
    @pytest.mark.unit
    def test_get_git_status_nonexistent_directory(self):
        """Test git status on non-existent directory."""
        result = _get_git_status_sync("/non/existent/path")
        
        assert result["success"] is False
        assert "does not exist" in result["error"]
        assert result["is_git_repo"] is False
    
    @pytest.mark.unit
    def test_get_git_status_not_directory(self, test_project_dir):
        """Test git status when path is not a directory."""
        test_file = os.path.join(test_project_dir, "test.py")
        result = _get_git_status_sync(test_file)
        
        assert result["success"] is False
        assert "not a directory" in result["error"]
        assert result["is_git_repo"] is False
    
    @pytest.mark.unit
    def test_get_git_status_git_not_found(self, git_repo):
        """Test git status when git command is not found."""
        with patch('subprocess.run', side_effect=FileNotFoundError("git not found")):
            result = _get_git_status_sync(git_repo)
        
        assert result["success"] is False
        assert "Git command not found" in result["error"]
        assert result["is_git_repo"] is True
    
    @pytest.mark.unit
    def test_get_git_status_timeout(self, git_repo):
        """Test git status with command timeout."""
        with patch('subprocess.run', side_effect=subprocess.TimeoutExpired("git", 30)):
            result = _get_git_status_sync(git_repo)
        
        assert result["success"] is False
        assert "timed out" in result["error"]
        assert result["is_git_repo"] is True
    
    @pytest.mark.unit
    def test_get_git_status_command_failure(self, git_repo):
        """Test git status with command failure."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "Git error"
        
        with patch('subprocess.run', return_value=mock_result):
            result = _get_git_status_sync(git_repo)
        
        assert result["success"] is False
        assert "Git command failed" in result["error"]
        assert result["is_git_repo"] is True
    
    @pytest.mark.unit
    def test_get_git_status_parse_output(self, git_repo):
        """Test parsing of git status output."""
        # Mock git status output
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = " M modified.py\nA  added.py\nD  deleted.py\n?? untracked.py"
        
        # Mock branch command
        mock_branch_result = MagicMock()
        mock_branch_result.returncode = 0
        mock_branch_result.stdout = "main"
        
        with patch('subprocess.run', side_effect=[mock_result, mock_branch_result]):
            result = _get_git_status_sync(git_repo)
        
        assert result["success"] is True
        assert result["current_branch"] == "main"
        assert "modified.py" in result["modified_files"]
        assert "added.py" in result["added_files"]
        assert "deleted.py" in result["deleted_files"]
        assert "untracked.py" in result["untracked_files"]
        assert result["total_changes"] == 4


class TestRegisterTools:
    """Test cases for register_tools function."""
    
    @pytest.mark.unit
    def test_register_tools_success(self, mock_mcp_server):
        """Test successful tool registration."""
        with patch('official_mcp_server.mcp', mock_mcp_server):
            register_tools()
        
        # Verify that tools were registered
        assert mock_mcp_server.tool.called
        assert mock_mcp_server.tool.call_count >= 5  # At least 5 tools should be registered
    
    @pytest.mark.unit
    def test_register_tools_with_config_manager(self, mock_mcp_server, mock_config_manager):
        """Test tool registration with configuration manager."""
        with patch('official_mcp_server.mcp', mock_mcp_server), \
             patch('official_mcp_server.config_manager', mock_config_manager):
            register_tools()
        
        # Verify tools were registered
        assert mock_mcp_server.tool.called


class TestRunPersistentServer:
    """Test cases for run_persistent_server function."""
    
    @pytest.mark.unit
    def test_run_persistent_server_success(self, mock_mcp_server, mock_config_manager):
        """Test successful server startup."""
        with patch('official_mcp_server.MCPConfigManager', return_value=mock_config_manager), \
             patch('official_mcp_server.FastMCP', return_value=mock_mcp_server), \
             patch('official_mcp_server.register_tools'), \
             patch('official_mcp_server.mcp', mock_mcp_server), \
             patch('official_mcp_server.setup_signal_handlers'):

            # Mock the run method to avoid infinite loop
            mock_mcp_server.run.side_effect = KeyboardInterrupt()

            with pytest.raises(KeyboardInterrupt):
                run_persistent_server()
    
    @pytest.mark.unit
    def test_run_persistent_server_config_error(self):
        """Test server startup with configuration error."""
        with patch('official_mcp_server.MCPConfigManager', side_effect=Exception("Config error")):
            with pytest.raises(Exception, match="Config error"):
                run_persistent_server()
    
    @pytest.mark.unit
    def test_run_persistent_server_with_config_path(self, mock_mcp_server, mock_config_manager):
        """Test server startup with custom config path."""
        config_path = "/custom/config.json"

        with patch('official_mcp_server.MCPConfigManager', return_value=mock_config_manager) as mock_manager, \
             patch('official_mcp_server.FastMCP', return_value=mock_mcp_server), \
             patch('official_mcp_server.register_tools'), \
             patch('official_mcp_server.mcp', mock_mcp_server), \
             patch('official_mcp_server.setup_signal_handlers'):

            mock_mcp_server.run.side_effect = KeyboardInterrupt()

            with pytest.raises(KeyboardInterrupt):
                run_persistent_server(config_path)

            # Verify config manager was called with correct path
            mock_manager.assert_called_once_with(config_path)


class TestSetupSignalHandlers:
    """Test cases for setup_signal_handlers function."""
    
    @pytest.mark.unit
    def test_setup_signal_handlers(self):
        """Test signal handler setup."""
        with patch('signal.signal') as mock_signal:
            setup_signal_handlers()
            
            # Verify signal handlers were set up
            assert mock_signal.called
            # Should set up SIGINT and SIGTERM at minimum
            assert mock_signal.call_count >= 2


class TestErrorHandling:
    """Test cases for error handling and edge cases."""
    
    @pytest.mark.unit
    def test_unexpected_errors_handled(self, config_manager):
        """Test that unexpected errors are properly handled."""
        with patch('pathlib.Path.resolve', side_effect=Exception("Unexpected error")):
            result = _list_files_sync("/some/path")
        
        assert result["success"] is False
        assert "Unexpected error" in result["error"]
    
    @pytest.mark.unit
    def test_file_access_without_config_manager(self):
        """Test file access when config_manager is None."""
        with patch('official_mcp_server.config_manager', None):
            result = _list_files_sync("/some/path")
        
        # Should work without config manager (permissive mode)
        assert "success" in result
    
    @pytest.mark.unit
    def test_config_manager_without_config(self, config_manager):
        """Test operations when config_manager has no config."""
        config_manager.config = None
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync("/some/path")
        
        # Should work without config (permissive mode)
        assert "success" in result


class TestSecurityFeatures:
    """Test cases for security features."""
    
    @pytest.mark.security
    def test_path_traversal_protection(self, config_manager):
        """Test protection against path traversal attacks."""
        config_manager.add_directory("/safe/directory")
        
        malicious_paths = [
            "/safe/directory/../../../etc/passwd",
            "/safe/directory/..\\..\\..\\windows\\system32",
            "/safe/directory/./././etc/shadow",
        ]
        
        with patch('official_mcp_server.config_manager', config_manager):
            for malicious_path in malicious_paths:
                result = _read_file_sync(malicious_path)
                # Should be blocked by configuration
                assert result["success"] is False
    
    @pytest.mark.security
    def test_system_directory_protection(self, config_manager):
        """Test protection against accessing system directories."""
        system_paths = [
            "/etc/passwd",
            "/usr/bin/ls",
            "C:\\Windows\\System32\\cmd.exe",
            "/proc/1/status",
        ]
        
        with patch('official_mcp_server.config_manager', config_manager):
            for system_path in system_paths:
                result = _read_file_sync(system_path)
                # Should be blocked
                assert result["success"] is False
    
    @pytest.mark.security
    def test_file_size_limits(self, test_project_dir, config_manager):
        """Test file size limit enforcement."""
        # Set very small size limit
        config_manager.add_directory(test_project_dir, max_file_size="1B")
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(os.path.join(test_project_dir, "test.txt"))
        
        assert result["success"] is False
        assert "too large" in result["error"]


class TestConfigurationIntegration:
    """Test cases for configuration integration."""
    
    @pytest.mark.config
    def test_config_manager_integration(self, test_project_dir, config_manager):
        """Test integration with configuration manager."""
        config_manager.add_directory(test_project_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            # Test that configuration is respected
            result = _list_files_sync(test_project_dir)
            assert result["success"] is True
            
            # Test that excluded files are not accessible
            env_file = os.path.join(test_project_dir, ".env")
            result = _read_file_sync(env_file)
            assert result["success"] is False
    
    @pytest.mark.config
    def test_config_reload_handling(self, test_project_dir, config_manager):
        """Test handling of configuration reloads."""
        config_manager.add_directory(test_project_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            # Initial access should work
            result = _list_files_sync(test_project_dir)
            assert result["success"] is True
            
            # Simulate config reload by changing the config
            config_manager.config.enabled = False
            
            # Access should now be denied
            result = _list_files_sync(test_project_dir)
            assert result["success"] is False


# Integration tests that require more complex setup
class TestIntegration:
    """Integration tests for MCP server functionality."""
    
    @pytest.mark.integration
    def test_full_workflow(self, test_project_dir, config_manager):
        """Test complete workflow from configuration to file access."""
        # Setup configuration
        config_manager.add_directory(test_project_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            # List files
            list_result = _list_files_sync(test_project_dir)
            assert list_result["success"] is True
            
            # Read a file
            test_file = os.path.join(test_project_dir, "test.txt")
            read_result = _read_file_sync(test_file)
            assert read_result["success"] is True
            assert read_result["content"] == "This is a test file"
            
            # Check git status (if it's a git repo)
            git_result = _get_git_status_sync(test_project_dir)
            assert git_result["success"] is True
    
    @pytest.mark.integration
    def test_multiple_directories(self, test_project_dir, test_docs_dir, config_manager):
        """Test working with multiple directories."""
        config_manager.add_directory(test_project_dir)
        config_manager.add_directory(test_docs_dir)
        
        with patch('official_mcp_server.config_manager', config_manager):
            # Test project directory
            result1 = _list_files_sync(test_project_dir)
            assert result1["success"] is True
            
            # Test docs directory
            result2 = _list_files_sync(test_docs_dir)
            assert result2["success"] is True
            
            # Test cross-directory access (should fail)
            cross_file = os.path.join(test_docs_dir, "readme.txt")
            result3 = _read_file_sync(cross_file)
            assert result3["success"] is True  # Should work since docs_dir is configured
    
    @pytest.mark.integration
    @pytest.mark.slow
    def test_large_file_handling(self, temp_dir, config_manager):
        """Test handling of large files."""
        large_dir = os.path.join(temp_dir, "large_files")
        os.makedirs(large_dir)

        # Create a smaller file for faster testing (100KB instead of 10MB)
        large_file = os.path.join(large_dir, "large.txt")
        with open(large_file, 'w') as f:
            f.write("x" * (100 * 1024))  # 100KB instead of 10MB

        config_manager.add_directory(large_dir, max_file_size="50KB")  # Set limit below file size

        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(large_file)
            assert result["success"] is False
            assert "too large" in result["error"]

            # Increase size limit
            config_manager.config.watched_directories[0].max_file_size = "200KB"
            result = _read_file_sync(large_file)
            assert result["success"] is True
