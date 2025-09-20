"""
Pytest configuration and fixtures for MCP server tests.

This module provides common fixtures and configuration for all test modules.
"""

import os
import sys
import tempfile
import shutil
import json
import signal
import threading
import time
from pathlib import Path
from typing import Dict, Any, Generator
from unittest.mock import patch, MagicMock

import pytest

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from mcp_config_manager import MCPConfigManager, DirectoryConfig, MCPConfig
except ImportError:
    pytest.skip("MCPConfigManager not available", allow_module_level=True)


@pytest.fixture
def temp_dir() -> Generator[str, None, None]:
    """Create a temporary directory for testing."""
    temp_path = tempfile.mkdtemp()
    yield temp_path
    shutil.rmtree(temp_path)


@pytest.fixture
def test_config_path(temp_dir: str) -> str:
    """Create a test configuration file path."""
    return os.path.join(temp_dir, "test_config.json")


@pytest.fixture
def config_manager(test_config_path: str) -> Generator[MCPConfigManager, None, None]:
    """Create a test configuration manager with proper cleanup."""
    manager = MCPConfigManager(test_config_path)

    yield manager

    # Cleanup: stop any config watchers
    try:
        if hasattr(manager, '_config_watcher') and manager._config_watcher:
            manager.stop_config_watcher()
    except Exception:
        pass  # Ignore cleanup errors


@pytest.fixture
def test_project_dir(temp_dir: str) -> str:
    """Create a test project directory with sample files."""
    project_dir = os.path.join(temp_dir, "test_project")
    os.makedirs(project_dir, exist_ok=True)
    
    # Create test files
    test_files = {
        "test.py": "print('Hello, World!')",
        "test.txt": "This is a test file",
        ".env": "SECRET_KEY=test123",
        "config.json": '{"test": true}',
        "large_file.txt": "x" * (10 * 1024),  # 10KB file (reduced for faster tests)
        "subdir/test_sub.py": "print('Subdirectory test')",
    }
    
    for file_path, content in test_files.items():
        full_path = os.path.join(project_dir, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return project_dir


@pytest.fixture
def test_docs_dir(temp_dir: str) -> str:
    """Create a test documents directory."""
    docs_dir = os.path.join(temp_dir, "test_docs")
    os.makedirs(docs_dir, exist_ok=True)
    
    with open(os.path.join(docs_dir, "readme.txt"), 'w') as f:
        f.write("Test documentation")
    
    return docs_dir


@pytest.fixture
def sample_config() -> Dict[str, Any]:
    """Sample configuration data for testing."""
    return {
        "watched_directories": [
            {
                "path": "/test/project",
                "enabled": True,
                "max_file_size": "10MB",
                "exclude_patterns": [".env*", "*.pyc", "*.log"],
                "include_gitignore": True,
                "last_accessed": None
            }
        ],
        "global_exclude_patterns": [
            ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log"
        ],
        "max_file_size": "10MB",
        "enabled": True,
        "audit_logging": True,
        "security_mode": "moderate",
        "config_version": "2.0.0",
        "last_modified": "2024-01-01T00:00:00.000Z"
    }


@pytest.fixture
def mock_mcp_server():
    """Mock MCP server for testing."""
    with patch('official_mcp_server.FastMCP') as mock_fastmcp:
        mock_server = MagicMock()
        mock_fastmcp.return_value = mock_server
        yield mock_server


@pytest.fixture
def mock_config_manager():
    """Mock configuration manager for testing."""
    with patch('official_mcp_server.MCPConfigManager') as mock_manager:
        mock_instance = MagicMock()
        mock_manager.return_value = mock_instance
        mock_instance.is_path_allowed.return_value = True
        mock_instance.config = MagicMock()
        mock_instance.config.max_file_size = "10MB"
        yield mock_instance


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Set up test environment before each test."""
    # Set test environment variables
    os.environ['TESTING'] = 'true'
    os.environ['PYTHONPATH'] = str(project_root)

    # Track running threads at start
    initial_threads = set(threading.enumerate())

    yield

    # Clean up after test
    if 'TESTING' in os.environ:
        del os.environ['TESTING']

    # Clean up any leftover threads
    current_threads = set(threading.enumerate())
    new_threads = current_threads - initial_threads

    for thread in new_threads:
        if thread.is_alive() and thread != threading.current_thread():
            # Give thread a chance to finish
            thread.join(timeout=1)
            if thread.is_alive():
                # Force terminate if still alive (daemon threads will be cleaned up)
                if hasattr(thread, '_stop'):
                    thread._stop()


@pytest.fixture
def git_repo(temp_dir: str) -> str:
    """Create a test git repository."""
    repo_dir = os.path.join(temp_dir, "git_repo")
    os.makedirs(repo_dir, exist_ok=True)
    
    # Create .git directory to simulate git repo
    git_dir = os.path.join(repo_dir, ".git")
    os.makedirs(git_dir, exist_ok=True)
    
    # Create .gitignore
    with open(os.path.join(repo_dir, ".gitignore"), 'w') as f:
        f.write("*.pyc\n__pycache__\n.env\n")
    
    # Create some files
    with open(os.path.join(repo_dir, "main.py"), 'w') as f:
        f.write("print('Hello from git repo')")
    
    with open(os.path.join(repo_dir, "ignored.pyc"), 'w') as f:
        f.write("compiled python")
    
    return repo_dir


# Pytest configuration
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "security: mark test as a security test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on test names."""
    for item in items:
        # Add markers based on test file names
        if "test_mcp_server" in item.nodeid:
            item.add_marker(pytest.mark.mcp_server)
        elif "test_config" in item.nodeid:
            item.add_marker(pytest.mark.config)
        elif "test_directory_access" in item.nodeid:
            item.add_marker(pytest.mark.security)

        # Add markers based on test function names
        if "integration" in item.name:
            item.add_marker(pytest.mark.integration)
        elif "security" in item.name:
            item.add_marker(pytest.mark.security)
        elif "slow" in item.name:
            item.add_marker(pytest.mark.slow)
        else:
            item.add_marker(pytest.mark.unit)


@pytest.fixture(autouse=True)
def cleanup_processes():
    """Ensure no hanging processes after tests."""
    yield

    # Force garbage collection to clean up any resources
    import gc
    gc.collect()

    # Small delay to allow cleanup
    time.sleep(0.01)
