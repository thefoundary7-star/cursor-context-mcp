#!/usr/bin/env python3
"""
Python 3.13 Compatible MCP Server using FastMCP framework

A stable, production-ready MCP server providing file system and git tools
for Claude Desktop integration with Python 3.13 asyncio compatibility fixes.
Enhanced with user-friendly directory configuration for commercial use.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import subprocess
import signal
import argparse
from pathlib import Path
from typing import List, Optional, Dict, Any
import logging

# Python 3.13 compatibility imports
try:
    from mcp.server.fastmcp import FastMCP
except ImportError as e:
    print(f"Error importing FastMCP: {e}", file=sys.stderr)
    print("Please ensure FastMCP is installed: pip install fastmcp", file=sys.stderr)
    sys.exit(1)

# Import our configuration manager
try:
    from mcp_config_manager import MCPConfigManager
except ImportError as e:
    print(f"Error importing MCPConfigManager: {e}", file=sys.stderr)
    print("Please ensure mcp_config_manager.py is in the same directory", file=sys.stderr)
    sys.exit(1)

# Configure logging with better error handling
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)  # Use stderr to avoid interfering with stdio transport
    ]
)
logger = logging.getLogger(__name__)

# Global server instance and configuration manager
mcp = None
config_manager = None


def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        sys.exit(0)
    
    # Handle common termination signals
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Windows-specific signal handling
    if hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, signal_handler)


def run_persistent_server(config_path: Optional[str] = None, bypass_config: bool = False):
    """Run the MCP server persistently for continuous requests"""
    global mcp, config_manager
    
    try:
        logger.info("Starting persistent MCP server...")
        
        # Initialize configuration manager
        config_manager = MCPConfigManager(config_path)
        
        # Set bypass mode if requested
        if bypass_config:
            logger.warning("BYPASS MODE ENABLED: All configuration checks are disabled for testing")
            config_manager.bypass_mode = True
        
        # Start configuration file watcher
        config_manager.start_config_watcher()
        
        # Initialize FastMCP server
        mcp = FastMCP("File System MCP Server")
        
        # Register tools
        register_tools()
        
        # Run the server persistently - this will handle multiple requests
        # FastMCP's run() method is designed to be persistent for stdio transport
        logger.info("Server ready, waiting for requests...")
        mcp.run()
        
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise
    finally:
        if config_manager:
            config_manager.stop_config_watcher()
        logger.info("Server shutdown completed")


def register_tools():
    """Register all MCP tools with proper error handling"""
    global mcp
    
    @mcp.tool()
    def list_files(directory: str = ".") -> Dict[str, Any]:
        """List files and directories in the specified path."""
        return _list_files_sync(directory)
    
    @mcp.tool()
    def read_file(file_path: str, max_lines: Optional[int] = None) -> Dict[str, Any]:
        """Read the contents of a file."""
        return _read_file_sync(file_path, max_lines)
    
    @mcp.tool()
    def get_git_status(directory: str = ".") -> Dict[str, Any]:
        """Get the git status of a repository."""
        return _get_git_status_sync(directory)
    
    @mcp.tool()
    def get_config_summary() -> Dict[str, Any]:
        """Get a summary of the current MCP configuration."""
        if not config_manager:
            return {
                "success": False,
                "error": "Configuration manager not initialized"
            }
        
        try:
            summary = config_manager.get_config_summary()
            return {
                "success": True,
                "config": summary
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to get config summary: {str(e)}"
            }
    
    @mcp.tool()
    def list_watched_directories() -> Dict[str, Any]:
        """List all directories currently being watched by the MCP server."""
        if not config_manager:
            return {
                "success": False,
                "error": "Configuration manager not initialized"
            }
        
        try:
            directories = config_manager.list_directories()
            return {
                "success": True,
                "directories": directories,
                "total_count": len(directories)
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to list directories: {str(e)}"
            }
    
    @mcp.tool()
    def check_path_access(path: str) -> Dict[str, Any]:
        """Check if a specific path is accessible according to current configuration."""
        if not config_manager:
            return {
                "success": False,
                "error": "Configuration manager not initialized"
            }
        
        try:
            is_allowed = config_manager.is_path_allowed(path)
            
            # Get detailed information about why access is allowed/denied
            debug_info = {
                "path": path,
                "resolved_path": str(Path(path).resolve()),
                "allowed": is_allowed,
                "bypass_mode": getattr(config_manager, 'bypass_mode', False),
                "config_enabled": config_manager.config.enabled if config_manager.config else False,
                "watched_directories_count": len(config_manager.config.watched_directories) if config_manager.config else 0,
                "security_mode": config_manager.config.security_mode if config_manager.config else "unknown"
            }
            
            if config_manager.config and config_manager.config.watched_directories:
                debug_info["watched_directories"] = [d.path for d in config_manager.config.watched_directories]
            
            return {
                "success": True,
                **debug_info,
                "reason": "Path is allowed" if is_allowed else "Path is not in watched directories or is excluded"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to check path access: {str(e)}"
            }


def _list_files_sync(directory: str = ".") -> Dict[str, Any]:
    """
    Synchronous version of list_files for executor usage.
    Enhanced with configuration-based access control.
    
    Args:
        directory: The directory path to list (defaults to current directory)
        
    Returns:
        Dictionary containing the list of files and directories
    """
    try:
        # Convert to Path object for cross-platform compatibility
        path = Path(directory).resolve()
        
        # Check if path exists
        if not path.exists():
            return {
                "success": False,
                "error": f"Directory does not exist: {directory}",
                "files": [],
                "directories": []
            }
        
        # Check if it's a directory
        if not path.is_dir():
            return {
                "success": False,
                "error": f"Path is not a directory: {directory}",
                "files": [],
                "directories": []
            }
        
        # Check if directory access is allowed by configuration
        if config_manager and not config_manager.is_path_allowed(str(path)):
            return {
                "success": False,
                "error": f"Directory access not allowed by configuration: {directory}",
                "files": [],
                "directories": []
            }
        
        # List files and directories
        files = []
        directories = []
        
        try:
            for item in path.iterdir():
                # Check if item access is allowed
                if config_manager and not config_manager.is_path_allowed(str(item)):
                    continue
                
                if item.is_file():
                    files.append({
                        "name": item.name,
                        "path": str(item),
                        "size": item.stat().st_size
                    })
                elif item.is_dir():
                    directories.append({
                        "name": item.name,
                        "path": str(item)
                    })
        except PermissionError:
            return {
                "success": False,
                "error": f"Permission denied accessing directory: {directory}",
                "files": [],
                "directories": []
            }
        
        # Sort results
        files.sort(key=lambda x: x["name"])
        directories.sort(key=lambda x: x["name"])
        
        return {
            "success": True,
            "directory": str(path),
            "files": files,
            "directories": directories,
            "total_files": len(files),
            "total_directories": len(directories)
        }
        
    except Exception as e:
        logger.error(f"Error listing files in {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "files": [],
            "directories": []
        }


def _read_file_sync(file_path: str, max_lines: Optional[int] = None) -> Dict[str, Any]:
    """
    Synchronous version of read_file for executor usage.
    Enhanced with configuration-based access control and file size limits.
    
    Args:
        file_path: The path to the file to read
        max_lines: Maximum number of lines to read (optional)
        
    Returns:
        Dictionary containing the file contents and metadata
    """
    try:
        # Convert to Path object for cross-platform compatibility
        path = Path(file_path).resolve()
        
        # Check if file exists
        if not path.exists():
            return {
                "success": False,
                "error": f"File does not exist: {file_path}",
                "content": "",
                "lines": 0
            }
        
        # Check if it's a file
        if not path.is_file():
            return {
                "success": False,
                "error": f"Path is not a file: {file_path}",
                "content": "",
                "lines": 0
            }
        
        # Check if file access is allowed by configuration
        if config_manager and not config_manager.is_path_allowed(str(path)):
            return {
                "success": False,
                "error": f"File access not allowed by configuration: {file_path}",
                "content": "",
                "lines": 0
            }
        
        # Check file size using configuration limits
        file_size = path.stat().st_size
        max_size = 10 * 1024 * 1024  # Default 10MB limit
        
        if config_manager and config_manager.config:
            try:
                max_size = config_manager._parse_file_size(config_manager.config.max_file_size)
            except Exception:
                pass  # Use default if parsing fails
        
        if file_size > max_size:
            return {
                "success": False,
                "error": f"File too large ({file_size} bytes). Maximum size is {max_size} bytes.",
                "content": "",
                "lines": 0
            }
        
        # Read file content
        try:
            with open(path, 'r', encoding='utf-8') as f:
                if max_lines:
                    lines = []
                    for i, line in enumerate(f):
                        if i >= max_lines:
                            break
                        lines.append(line.rstrip('\n\r'))
                    content = '\n'.join(lines)
                    truncated = i >= max_lines
                else:
                    content = f.read()
                    truncated = False
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(path, 'r', encoding='latin-1') as f:
                    if max_lines:
                        lines = []
                        for i, line in enumerate(f):
                            if i >= max_lines:
                                break
                            lines.append(line.rstrip('\n\r'))
                        content = '\n'.join(lines)
                        truncated = i >= max_lines
                    else:
                        content = f.read()
                        truncated = False
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Could not read file (encoding issue): {str(e)}",
                    "content": "",
                    "lines": 0
                }
        except PermissionError:
            return {
                "success": False,
                "error": f"Permission denied reading file: {file_path}",
                "content": "",
                "lines": 0
            }
        
        # Count lines
        line_count = content.count('\n') + (1 if content else 0)
        
        return {
            "success": True,
            "file_path": str(path),
            "content": content,
            "lines": line_count,
            "size": file_size,
            "truncated": truncated
        }
        
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "content": "",
            "lines": 0
        }


def _get_git_status_sync(directory: str = ".") -> Dict[str, Any]:
    """
    Synchronous version of get_git_status for executor usage.
    
    Args:
        directory: The directory path to check git status (defaults to current directory)
        
    Returns:
        Dictionary containing git status information
    """
    try:
        # Convert to Path object for cross-platform compatibility
        path = Path(directory).resolve()
        
        # Check if directory exists
        if not path.exists():
            return {
                "success": False,
                "error": f"Directory does not exist: {directory}",
                "is_git_repo": False
            }
        
        # Check if it's a directory
        if not path.is_dir():
            return {
                "success": False,
                "error": f"Path is not a directory: {directory}",
                "is_git_repo": False
            }
        
        # Check if it's a git repository
        git_dir = path / ".git"
        if not git_dir.exists():
            return {
                "success": True,
                "is_git_repo": False,
                "message": "Not a git repository"
            }
        
        # Run git status command
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Git command failed: {result.stderr}",
                    "is_git_repo": True
                }
            
            # Parse git status output
            status_lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
            
            modified_files = []
            added_files = []
            deleted_files = []
            untracked_files = []
            
            for line in status_lines:
                if len(line) >= 3:
                    status = line[:2]
                    filename = line[3:]
                    
                    if status[0] == 'M' or status[1] == 'M':
                        modified_files.append(filename)
                    elif status[0] == 'A' or status[1] == 'A':
                        added_files.append(filename)
                    elif status[0] == 'D' or status[1] == 'D':
                        deleted_files.append(filename)
                    elif status == '??':
                        untracked_files.append(filename)
            
            # Get current branch
            branch_result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "unknown"
            
            return {
                "success": True,
                "is_git_repo": True,
                "directory": str(path),
                "current_branch": current_branch,
                "modified_files": modified_files,
                "added_files": added_files,
                "deleted_files": deleted_files,
                "untracked_files": untracked_files,
                "total_changes": len(modified_files) + len(added_files) + len(deleted_files) + len(untracked_files)
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Git command timed out",
                "is_git_repo": True
            }
        except FileNotFoundError:
            return {
                "success": False,
                "error": "Git command not found. Please ensure git is installed and in PATH.",
                "is_git_repo": True
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Error running git command: {str(e)}",
                "content": "",
                "lines": 0
            }
        
    except Exception as e:
        logger.error(f"Error getting git status for {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "is_git_repo": False
        }


def main():
    """Main entry point with CLI argument handling and persistent connection"""
    parser = argparse.ArgumentParser(
        description="MCP Server with Directory Configuration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                           # Run server with default config
  %(prog)s --config ~/.mcp/config.json  # Run with custom config file
  %(prog)s --help                    # Show this help message

Configuration Management:
  Use mcp_config_manager.py for managing directories and settings:
  python mcp_config_manager.py --add-dir /path/to/project
  python mcp_config_manager.py --list-dirs
  python mcp_config_manager.py --exclude-pattern "*.env"
        """
    )
    
    parser.add_argument('--config', help='Path to configuration file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    parser.add_argument('--bypass-config', action='store_true', help='Bypass configuration checks for testing (allows all access)')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        # Setup signal handlers for graceful shutdown
        setup_signal_handlers()
        
        # Run the persistent server with configuration
        run_persistent_server(args.config, args.bypass_config)
        
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
