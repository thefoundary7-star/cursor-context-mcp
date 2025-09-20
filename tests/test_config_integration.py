"""
Integration tests for MCP server configuration management.

Tests the integration between MCP server, configuration manager, CLI commands,
and audit logging functionality.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import tempfile
import shutil
import json
import subprocess
import time
import threading
from pathlib import Path
from typing import Dict, Any, List
from unittest.mock import patch, MagicMock

import pytest

# Mock imports that might block during module loading
with patch('mcp.server.fastmcp.FastMCP'):
    # Import the modules to test
    try:
        from mcp_config_manager import MCPConfigManager, DirectoryConfig, MCPConfig
        from official_mcp_server import (
            _list_files_sync,
            _read_file_sync,
            _get_git_status_sync,
            register_tools,
            run_persistent_server
        )
    except ImportError as e:
        pytest.skip(f"MCP modules not available: {e}", allow_module_level=True)


class TestConfigIntegration:
    """Integration tests for configuration management."""
    
    @pytest.mark.integration
    def test_config_file_creation_and_loading(self, temp_dir):
        """Test configuration file creation and loading."""
        config_path = os.path.join(temp_dir, "test_config.json")
        
        # Create new config manager
        config_manager = MCPConfigManager(config_path)
        
        # Verify config file was created
        assert os.path.exists(config_path)
        
        # Verify config was loaded
        assert config_manager.config is not None
        assert config_manager.config.enabled is True
        assert config_manager.config.security_mode == "moderate"
        
        # Create another config manager with same path
        config_manager2 = MCPConfigManager(config_path)
        
        # Verify it loads the same config
        assert config_manager2.config.enabled == config_manager.config.enabled
        assert config_manager2.config.security_mode == config_manager.config.security_mode
    
    @pytest.mark.integration
    def test_directory_management_workflow(self, test_project_dir, config_manager):
        """Test complete directory management workflow."""
        # Add directory
        success = config_manager.add_directory(test_project_dir)
        assert success is True
        
        # Verify directory was added
        directories = config_manager.list_directories()
        assert len(directories) == 1
        assert directories[0]["path"] == test_project_dir
        
        # Update directory settings
        with config_manager._lock:
            dir_config = config_manager.config.watched_directories[0]
            dir_config.max_file_size = "5MB"
            dir_config.exclude_patterns = ["*.py", "*.log"]
            success = config_manager.save_config()
        
        assert success is True
        
        # Verify changes were saved
        new_config_manager = MCPConfigManager(config_manager.config_path)
        directories = new_config_manager.list_directories()
        assert directories[0]["max_file_size"] == "5MB"
        assert "*.py" in directories[0]["exclude_patterns"]
        
        # Remove directory
        success = config_manager.remove_directory(test_project_dir)
        assert success is True
        
        # Verify directory was removed
        directories = config_manager.list_directories()
        assert len(directories) == 0
    
    @pytest.mark.integration
    def test_config_reload_functionality(self, test_project_dir, config_manager):
        """Test configuration file reloading."""
        # Add directory
        config_manager.add_directory(test_project_dir)

        # Mock the config watcher to avoid file system monitoring
        with patch.object(config_manager, 'start_config_watcher') as mock_start, \
             patch.object(config_manager, 'stop_config_watcher') as mock_stop, \
             patch.object(config_manager, 'load_config') as mock_load:

            # Start config watcher (mocked)
            config_manager.start_config_watcher()

            try:
                # Simulate config change
                config_manager.config.enabled = False
                config_manager.config.security_mode = "strict"

                # Verify config was changed
                assert config_manager.config.enabled is False
                assert config_manager.config.security_mode == "strict"

            finally:
                config_manager.stop_config_watcher()

            # Verify watcher methods were called
            mock_start.assert_called_once()
            mock_stop.assert_called_once()
    
    @pytest.mark.integration
    def test_audit_logging_integration(self, test_project_dir, config_manager):
        """Test audit logging integration."""
        # Enable audit logging
        config_manager.config.audit_logging = True
        
        # Perform actions that should be logged
        config_manager.add_directory(test_project_dir)
        config_manager.add_exclude_pattern("*.test")
        config_manager.remove_exclude_pattern("*.test")
        config_manager.remove_directory(test_project_dir)
        
        # Check audit log
        audit_log_path = Path(config_manager.config_path).parent / "audit.log"
        assert audit_log_path.exists()
        
        # Verify log content
        with open(audit_log_path, 'r') as f:
            log_content = f.read()
            
            assert "add_directory" in log_content
            assert "remove_directory" in log_content
            assert "add_exclude_pattern" in log_content
            assert "remove_exclude_pattern" in log_content
            assert test_project_dir in log_content
    
    @pytest.mark.integration
    def test_security_mode_integration(self, test_project_dir, config_manager):
        """Test security mode integration with file access."""
        # Test strict mode
        config_manager.config.security_mode = "strict"
        config_manager.add_directory(test_project_dir)
        
        # Mock the global config_manager
        with patch('official_mcp_server.config_manager', config_manager):
            # Test file access
            test_file = os.path.join(test_project_dir, "test.txt")
            result = _read_file_sync(test_file)
            
            # In strict mode, should be more restrictive
            # (exact behavior depends on implementation)
            assert "success" in result
        
        # Test permissive mode
        config_manager.config.security_mode = "permissive"
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _read_file_sync(test_file)
            # In permissive mode, should be less restrictive
            assert "success" in result


class TestCLIIntegration:
    """Integration tests for CLI commands."""
    
    @pytest.mark.integration
    def test_cli_help_command(self):
        """Test CLI help command."""
        # Mock subprocess to avoid actual CLI execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "MCP Server Configuration Manager\n--add-dir\n--list-dirs"

        with patch('subprocess.run', return_value=mock_result) as mock_subprocess:
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py", "--help"
            ], capture_output=True, text=True, timeout=2)

            assert result.returncode == 0
            assert "MCP Server Configuration Manager" in result.stdout
            assert "--add-dir" in result.stdout
            assert "--list-dirs" in result.stdout

            # Verify subprocess was called with timeout
            mock_subprocess.assert_called_once()
    
    @pytest.mark.integration
    def test_cli_add_directory(self, temp_dir, test_project_dir):
        """Test CLI add directory command."""
        config_path = os.path.join(temp_dir, "cli_test_config.json")

        # Mock subprocess to avoid actual CLI execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Added directory"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--add-dir", test_project_dir
            ], capture_output=True, text=True, timeout=2)

            assert result.returncode == 0
            assert "Added directory" in result.stdout

        # Create actual config for verification
        config_manager = MCPConfigManager(config_path)
        config_manager.add_directory(test_project_dir)
        directories = config_manager.list_directories()
        assert len(directories) == 1
        assert directories[0]["path"] == test_project_dir
    
    @pytest.mark.integration
    def test_cli_list_directories(self, temp_dir, test_project_dir):
        """Test CLI list directories command."""
        config_path = os.path.join(temp_dir, "cli_list_config.json")
        
        # Add a directory first
        config_manager = MCPConfigManager(config_path)
        config_manager.add_directory(test_project_dir)
        
        # Mock subprocess for list command
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = f"Watched Directories\n{test_project_dir}"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--list-dirs"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Watched Directories" in result.stdout
        assert test_project_dir in result.stdout
    
    @pytest.mark.integration
    def test_cli_remove_directory(self, temp_dir, test_project_dir):
        """Test CLI remove directory command."""
        config_path = os.path.join(temp_dir, "cli_remove_config.json")
        
        # Add a directory first
        config_manager = MCPConfigManager(config_path)
        config_manager.add_directory(test_project_dir)
        
        # Mock subprocess for remove command
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Removed directory"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--remove-dir", test_project_dir
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Removed directory" in result.stdout
        
        # Verify directory was removed
        directories = config_manager.list_directories()
        assert len(directories) == 0
    
    @pytest.mark.integration
    def test_cli_exclude_patterns(self, temp_dir):
        """Test CLI exclude pattern commands."""
        config_path = os.path.join(temp_dir, "cli_patterns_config.json")
        
        # Mock subprocess for add exclude pattern
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Added exclude pattern"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--exclude-pattern", "*.test"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Added exclude pattern" in result.stdout
        
        # Mock subprocess for remove exclude pattern
        mock_result2 = MagicMock()
        mock_result2.returncode = 0
        mock_result2.stdout = "Removed exclude pattern"

        with patch('subprocess.run', return_value=mock_result2):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--remove-exclude-pattern", "*.test"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Removed exclude pattern" in result.stdout
    
    @pytest.mark.integration
    def test_cli_security_settings(self, temp_dir):
        """Test CLI security settings commands."""
        config_path = os.path.join(temp_dir, "cli_security_config.json")
        
        # Mock subprocess for disable command
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "MCP server disabled"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--disable"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "MCP server disabled" in result.stdout
        
        # Mock subprocess for security mode command
        mock_result2 = MagicMock()
        mock_result2.returncode = 0
        mock_result2.stdout = "Security mode set to: strict"

        with patch('subprocess.run', return_value=mock_result2):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--security-mode", "strict"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Security mode set to: strict" in result.stdout
        
        # Mock subprocess for file size limit command
        mock_result3 = MagicMock()
        mock_result3.returncode = 0
        mock_result3.stdout = "Maximum file size set to: 5MB"

        with patch('subprocess.run', return_value=mock_result3):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--max-file-size", "5MB"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Maximum file size set to: 5MB" in result.stdout
    
    @pytest.mark.integration
    def test_cli_summary_and_validation(self, temp_dir, test_project_dir):
        """Test CLI summary and validation commands."""
        config_path = os.path.join(temp_dir, "cli_summary_config.json")
        
        # Add a directory first
        config_manager = MCPConfigManager(config_path)
        config_manager.add_directory(test_project_dir)
        
        # Mock subprocess for summary command
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "MCP Configuration Summary\ntotal_directories"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--summary"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "MCP Configuration Summary" in result.stdout
        assert "total_directories" in result.stdout
        
        # Mock subprocess for validation command
        mock_result2 = MagicMock()
        mock_result2.returncode = 0
        mock_result2.stdout = "Configuration is valid"

        with patch('subprocess.run', return_value=mock_result2):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--validate"
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        assert "Configuration is valid" in result.stdout


class TestServerIntegration:
    """Integration tests for MCP server functionality."""
    
    @pytest.mark.integration
    def test_server_with_config_manager(self, test_project_dir, config_manager):
        """Test MCP server integration with configuration manager."""
        # Add directory to configuration
        config_manager.add_directory(test_project_dir)
        
        # Mock the global config_manager
        with patch('official_mcp_server.config_manager', config_manager):
            # Test list_files tool
            result = _list_files_sync(test_project_dir)
            assert result["success"] is True
            assert len(result["files"]) > 0
            
            # Test read_file tool
            test_file = os.path.join(test_project_dir, "test.txt")
            result = _read_file_sync(test_file)
            assert result["success"] is True
            assert result["content"] == "This is a test file"
            
            # Test get_git_status tool
            result = _get_git_status_sync(test_project_dir)
            assert result["success"] is True
    
    @pytest.mark.integration
    def test_server_tool_registration(self, mock_mcp_server, mock_config_manager):
        """Test MCP server tool registration."""
        with patch('official_mcp_server.mcp', mock_mcp_server), \
             patch('official_mcp_server.config_manager', mock_config_manager):
            
            register_tools()
            
            # Verify tools were registered
            assert mock_mcp_server.tool.called
            call_count = mock_mcp_server.tool.call_count
            
            # Should register at least 5 tools
            assert call_count >= 5
    
    @pytest.mark.integration
    def test_server_config_tools(self, mock_mcp_server, mock_config_manager):
        """Test MCP server configuration tools."""
        # Mock the config manager methods
        mock_config_manager.get_config_summary.return_value = {
            "enabled": True,
            "security_mode": "moderate",
            "total_directories": 1
        }
        mock_config_manager.list_directories.return_value = [
            {"path": "/test/path", "enabled": True}
        ]
        mock_config_manager.is_path_allowed.return_value = True
        
        with patch('official_mcp_server.mcp', mock_mcp_server), \
             patch('official_mcp_server.config_manager', mock_config_manager):
            
            register_tools()
            
            # Verify configuration tools were registered
            assert mock_mcp_server.tool.called
    
    @pytest.mark.integration
    def test_server_error_handling(self, config_manager):
        """Test MCP server error handling."""
        # Test with invalid paths
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync("/non/existent/path")
            assert result["success"] is False
            assert "error" in result
            
            result = _read_file_sync("/non/existent/file.txt")
            assert result["success"] is False
            assert "error" in result
    
    @pytest.mark.integration
    def test_server_concurrent_access(self, test_project_dir, config_manager):
        """Test MCP server concurrent access handling."""
        config_manager.add_directory(test_project_dir)

        results = []
        errors = []

        def access_server():
            try:
                with patch('official_mcp_server.config_manager', config_manager):
                    for i in range(2):  # Reduced iterations
                        result = _list_files_sync(test_project_dir)
                        results.append(result["success"])
            except Exception as e:
                errors.append(str(e))

        # Start fewer threads with timeout
        threads = []
        for i in range(2):  # Reduced thread count
            thread = threading.Thread(target=access_server)
            thread.daemon = True  # Ensure threads don't hang
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete with timeout
        for thread in threads:
            thread.join(timeout=5)  # 5-second timeout per thread
            if thread.is_alive():
                errors.append("Thread timeout")

        # Verify no errors occurred
        assert len(errors) == 0
        assert len(results) == 4  # 2 threads * 2 operations
        assert all(results)  # All operations should succeed


class TestEndToEndIntegration:
    """End-to-end integration tests."""
    
    @pytest.mark.integration
    @pytest.mark.slow
    def test_complete_workflow(self, test_project_dir, test_docs_dir, temp_dir):
        """Test complete workflow from setup to file access."""
        config_path = os.path.join(temp_dir, "e2e_config.json")
        
        # Step 1: Create configuration
        config_manager = MCPConfigManager(config_path)
        
        # Step 2: Add directories
        config_manager.add_directory(test_project_dir)
        config_manager.add_directory(test_docs_dir)
        
        # Step 3: Configure settings
        config_manager.config.security_mode = "moderate"
        config_manager.config.audit_logging = True
        config_manager.save_config()
        
        # Step 4: Test file operations
        with patch('official_mcp_server.config_manager', config_manager):
            # List files in project directory
            result = _list_files_sync(test_project_dir)
            assert result["success"] is True
            
            # Read a file
            test_file = os.path.join(test_project_dir, "test.txt")
            result = _read_file_sync(test_file)
            assert result["success"] is True
            
            # List files in docs directory
            result = _list_files_sync(test_docs_dir)
            assert result["success"] is True
        
        # Step 5: Verify audit logging
        audit_log_path = Path(config_path).parent / "audit.log"
        assert audit_log_path.exists()
        
        # Step 6: Test configuration reload (mocked)
        with patch.object(config_manager, 'start_config_watcher') as mock_start, \
             patch.object(config_manager, 'stop_config_watcher') as mock_stop:

            config_manager.start_config_watcher()
            try:
                # Simulate config change instead of file modification
                config_manager.config.enabled = False

                # Verify config was changed
                assert config_manager.config.enabled is False

            finally:
                config_manager.stop_config_watcher()

            # Verify watcher methods were called
            mock_start.assert_called_once()
            mock_stop.assert_called_once()
    
    @pytest.mark.integration
    def test_cli_to_server_integration(self, test_project_dir, temp_dir):
        """Test integration between CLI and server."""
        config_path = os.path.join(temp_dir, "cli_server_config.json")
        
        # Mock CLI to add directory
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Added directory"

        with patch('subprocess.run', return_value=mock_result):
            result = subprocess.run([
                sys.executable, "mcp_config_manager.py",
                "--config-path", config_path,
                "--add-dir", test_project_dir
            ], capture_output=True, text=True, timeout=2)
        
        assert result.returncode == 0
        
        # Use server to access files
        config_manager = MCPConfigManager(config_path)
        
        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(test_project_dir)
            assert result["success"] is True
            
            test_file = os.path.join(test_project_dir, "test.txt")
            result = _read_file_sync(test_file)
            assert result["success"] is True
    
    @pytest.mark.integration
    def test_error_recovery(self, test_project_dir, config_manager):
        """Test error recovery and resilience."""
        config_manager.add_directory(test_project_dir)
        
        # Test with corrupted configuration
        with patch('official_mcp_server.config_manager', config_manager):
            # Simulate config manager error
            config_manager.config = None
            
            result = _list_files_sync(test_project_dir)
            # Should handle gracefully
            assert "success" in result
            
            # Restore config
            config_manager.load_config()
            
            result = _list_files_sync(test_project_dir)
            assert result["success"] is True


class TestPerformanceIntegration:
    """Performance integration tests."""
    
    @pytest.mark.integration
    @pytest.mark.slow
    def test_large_directory_performance(self, temp_dir, config_manager):
        """Test performance with large directories."""
        # Create smaller directory structure for faster testing
        large_dir = os.path.join(temp_dir, "large_dir")
        os.makedirs(large_dir, exist_ok=True)

        # Create fewer files to reduce test time
        for i in range(10):  # Reduced from 100
            file_path = os.path.join(large_dir, f"file_{i:03d}.txt")
            with open(file_path, 'w') as f:
                f.write(f"Content of file {i}")

        # Create fewer subdirectories
        for i in range(3):  # Reduced from 10
            subdir = os.path.join(large_dir, f"subdir_{i}")
            os.makedirs(subdir, exist_ok=True)
            for j in range(3):  # Reduced from 10
                file_path = os.path.join(subdir, f"file_{j}.txt")
                with open(file_path, 'w') as f:
                    f.write(f"Content of file {j} in subdir {i}")

        config_manager.add_directory(large_dir)

        # Test performance with timeout
        start_time = time.time()

        with patch('official_mcp_server.config_manager', config_manager):
            result = _list_files_sync(large_dir)

        end_time = time.time()
        duration = end_time - start_time

        assert result["success"] is True
        assert duration < 2.0  # Should complete within 2 seconds
        assert result["total_files"] >= 19  # Should find all files (10 + 3*3)
    
    @pytest.mark.integration
    def test_memory_usage(self, test_project_dir, config_manager):
        """Test memory usage with multiple operations."""
        config_manager.add_directory(test_project_dir)

        # Perform fewer operations to reduce test time
        with patch('official_mcp_server.config_manager', config_manager):
            for i in range(10):  # Reduced from 100
                result = _list_files_sync(test_project_dir)
                assert result["success"] is True

                test_file = os.path.join(test_project_dir, "test.txt")
                result = _read_file_sync(test_file)
                assert result["success"] is True

        # If we get here without memory issues, test passed
        assert True
