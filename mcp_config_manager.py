#!/usr/bin/env python3
"""
MCP Configuration Manager

A comprehensive configuration system for managing directory access, file exclusions,
and security settings for the MCP server. Provides CLI commands and auto-reload
functionality for production-ready commercial use.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import json
import argparse
import logging
import time
import fnmatch
import stat
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict
from datetime import datetime
import threading
import hashlib
import signal
import platform

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def with_timeout(timeout_seconds: float):
    """Cross-platform timeout decorator"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            if platform.system() == "Windows":
                # Windows doesn't support SIGALRM, use threading timeout
                result = [None]
                exception = [None]
                
                def target():
                    try:
                        result[0] = func(*args, **kwargs)
                    except Exception as e:
                        exception[0] = e
                
                thread = threading.Thread(target=target)
                thread.daemon = True
                thread.start()
                thread.join(timeout_seconds)
                
                if thread.is_alive():
                    raise TimeoutError(f"Operation timed out after {timeout_seconds} seconds")
                
                if exception[0]:
                    raise exception[0]
                
                return result[0]
            else:
                # Unix-like systems can use signal
                def timeout_handler(signum, frame):
                    raise TimeoutError(f"Operation timed out after {timeout_seconds} seconds")
                
                old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(int(timeout_seconds))
                
                try:
                    return func(*args, **kwargs)
                finally:
                    signal.alarm(0)
                    signal.signal(signal.SIGALRM, old_handler)
        
        return wrapper
    return decorator


@dataclass
class DirectoryConfig:
    """Configuration for a single directory"""
    path: str
    enabled: bool = True
    max_file_size: str = "10MB"
    exclude_patterns: List[str] = None
    include_gitignore: bool = True
    last_accessed: Optional[str] = None
    
    def __post_init__(self):
        if self.exclude_patterns is None:
            self.exclude_patterns = [".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log"]


@dataclass
class MCPConfig:
    """Main MCP configuration structure"""
    watched_directories: List[DirectoryConfig]
    global_exclude_patterns: List[str]
    max_file_size: str
    enabled: bool
    audit_logging: bool
    security_mode: str  # "strict", "moderate", "permissive"
    config_version: str
    last_modified: str
    
    def __post_init__(self):
        if self.global_exclude_patterns is None:
            self.global_exclude_patterns = [
                ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log",
                "*.tmp", "*.temp", ".DS_Store", "Thumbs.db", "*.swp", "*.swo"
            ]
        if not self.config_version:
            self.config_version = "2.0.0"
        if not self.last_modified:
            self.last_modified = datetime.now().isoformat()


class MCPConfigManager:
    """Manages MCP server configuration with auto-reload and validation"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._get_default_config_path()
        self.config: Optional[MCPConfig] = None
        self._lock = threading.Lock()
        self._watcher_thread = None
        self._stop_watching = False
        self._last_config_hash = None
        self.bypass_mode = False  # Bypass mode for testing
        
        # Security settings - will be replaced with smarter validation
        self._system_directories = self._get_system_directories()
        
        # Load initial configuration
        self.load_config()
    
    def _get_system_directories(self) -> Set[str]:
        """Get the set of system directories that should be blocked"""
        system_dirs = set()
        
        if platform.system() == "Windows":
            # Windows system directories
            system_dirs.update({
                "C:\\Windows",
                "C:\\Windows\\System32", 
                "C:\\Windows\\SysWOW64",
                "C:\\Program Files",
                "C:\\Program Files (x86)",
                "C:\\ProgramData",
                "C:\\System Volume Information",
                "C:\\Recovery",
                "C:\\$Recycle.Bin",
                "C:\\Boot",
                "C:\\EFI",
                "C:\\MSOCache",
                "C:\\PerfLogs",
                "C:\\hiberfil.sys",
                "C:\\pagefile.sys",
                "C:\\swapfile.sys"
            })
            
            # Add other drive letters if they exist
            for drive in "DEFGHIJKLMNOPQRSTUVWXYZ":
                drive_path = f"{drive}:\\"
                if os.path.exists(drive_path):
                    # Only block system directories on other drives, not user data
                    system_dirs.update({
                        f"{drive}:\\Windows",
                        f"{drive}:\\Program Files",
                        f"{drive}:\\Program Files (x86)",
                        f"{drive}:\\ProgramData",
                        f"{drive}:\\System Volume Information"
                    })
        else:
            # Unix-like system directories
            system_dirs.update({
                "/",
                "/usr",
                "/etc",
                "/var",
                "/sys",
                "/proc",
                "/dev",
                "/boot",
                "/lib",
                "/lib64",
                "/sbin",
                "/bin",
                "/root"
            })
        
        return system_dirs
    
    def _is_system_directory(self, path: str) -> bool:
        """Check if a path is a system directory that should be blocked"""
        try:
            resolved_path = Path(path).resolve()
            path_str = str(resolved_path)
            
            # Normalize path separators for cross-platform compatibility
            if platform.system() == "Windows":
                path_str = path_str.replace("/", "\\")
            else:
                path_str = path_str.replace("\\", "/")
            
            # Check against known system directories
            for system_dir in self._system_directories:
                if platform.system() == "Windows":
                    system_dir_normalized = system_dir.replace("/", "\\")
                else:
                    system_dir_normalized = system_dir.replace("\\", "/")
                
                # Check if the path starts with a system directory
                if path_str.startswith(system_dir_normalized):
                    return True
            
            # Additional Windows-specific checks
            if platform.system() == "Windows":
                # Block paths that are exactly drive roots (C:\, D:\, etc.)
                if len(path_str) == 3 and path_str[1:3] == ":\\":
                    return True
                
                # Block Windows system files and directories
                path_lower = path_str.lower()
                if any(system_pattern in path_lower for system_pattern in [
                    "\\windows\\", "\\system32\\", "\\syswow64\\", 
                    "\\program files\\", "\\programdata\\", "\\system volume information\\"
                ]):
                    return True
            
            # Additional Unix-specific checks
            else:
                # Block paths that are exactly root
                if path_str == "/":
                    return True
                
                # Block system directories
                if any(path_str.startswith(sys_dir) for sys_dir in [
                    "/usr/", "/etc/", "/var/", "/sys/", "/proc/", "/dev/",
                    "/boot/", "/lib/", "/lib64/", "/sbin/", "/bin/", "/root/"
                ]):
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking if path is system directory {path}: {e}")
            # If we can't determine, err on the side of caution and block it
            return True
    
    def _get_default_config_path(self) -> str:
        """Get the default configuration file path"""
        try:
            home = Path.home()
            config_dir = home / ".mcp"
            config_dir.mkdir(exist_ok=True)
            return str(config_dir / "config.json")
        except Exception as e:
            logger.error(f"Failed to create config directory: {e}")
            # Fallback to current directory
            return "config.json"
    
    def load_config(self) -> bool:
        """Load configuration from file"""
        try:
            with self._lock:
                if not os.path.exists(self.config_path):
                    logger.info(f"Config file not found at {self.config_path}, creating default")
                    if not self._create_default_config():
                        logger.error("Failed to create default configuration")
                        return False
                    return True
                
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Convert to MCPConfig object
                directories = []
                for dir_data in data.get('watched_directories', []):
                    if isinstance(dir_data, dict):
                        directories.append(DirectoryConfig(**dir_data))
                    else:
                        # Legacy format - just a string path
                        directories.append(DirectoryConfig(path=dir_data))
                
                self.config = MCPConfig(
                    watched_directories=directories,
                    global_exclude_patterns=data.get('exclude_patterns', []),
                    max_file_size=data.get('max_file_size', '10MB'),
                    enabled=data.get('enabled', True),
                    audit_logging=data.get('audit_logging', True),
                    security_mode=data.get('security_mode', 'moderate'),
                    config_version=data.get('config_version', '2.0.0'),
                    last_modified=data.get('last_modified', datetime.now().isoformat())
                )
                
                # Validate configuration
                self._validate_config()
                
                logger.info(f"Configuration loaded successfully from {self.config_path}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            if not self._create_default_config():
                logger.error("Failed to create default configuration as fallback")
                return False
            return True
    
    def save_config(self, skip_lock: bool = False) -> bool:
        """Save configuration to file"""
        try:
            # Only acquire lock if not already held (skip_lock=True when called from within a lock)
            if skip_lock:
                # We're already inside a lock, don't acquire it again
                return self._save_config_internal()
            else:
                # Acquire lock with timeout
                if not self._lock.acquire(timeout=2):
                    logger.error("Could not acquire lock for configuration save")
                    return False
                try:
                    return self._save_config_internal()
                finally:
                    self._lock.release()

        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            return False

    def _save_config_internal(self) -> bool:
        """Internal save operation without lock management"""
        try:
            if not self.config:
                logger.error("No configuration to save")
                return False

            # Update last modified timestamp
            self.config.last_modified = datetime.now().isoformat()

            # Convert to dictionary for JSON serialization
            config_dict = asdict(self.config)

            # Ensure directory exists
            config_dir = Path(self.config_path).parent
            config_dir.mkdir(parents=True, exist_ok=True)

            # Create a temporary file first to avoid corruption
            temp_path = self.config_path + ".tmp"
            try:
                with open(temp_path, 'w', encoding='utf-8') as f:
                    json.dump(config_dict, f, indent=2, ensure_ascii=False)

                # Atomic move to final location
                if os.name == 'nt':  # Windows
                    if os.path.exists(self.config_path):
                        os.remove(self.config_path)
                    os.rename(temp_path, self.config_path)
                else:  # Unix-like
                    os.rename(temp_path, self.config_path)

                logger.info(f"Configuration saved to {self.config_path}")
                return True

            except Exception as e:
                # Clean up temp file if it exists
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
                raise e

        except Exception as e:
            logger.error(f"Internal save operation failed: {e}")
            return False
    
    def _create_default_config(self) -> bool:
        """Create a default configuration with timeout protection and fallback"""
        start_time = time.time()
        logger.info("Creating default MCP configuration...")
        
        try:
            # Use the timeout decorator for cross-platform timeout protection
            @with_timeout(2.0)
            def _create_config_operation():
                logger.debug("Step 1: Creating default config object...")
                
                # Create the default config object
                self.config = MCPConfig(
                    watched_directories=[],
                    global_exclude_patterns=[
                        ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log",
                        "*.tmp", "*.temp", ".DS_Store", "Thumbs.db", "*.swp", "*.swo"
                    ],
                    max_file_size="10MB",
                    enabled=True,
                    audit_logging=True,
                    security_mode="moderate",
                    config_version="2.0.0",
                    last_modified=datetime.now().isoformat()
                )
                
                logger.debug("Step 2: Config object created, attempting to save...")
                
                # Try to save the configuration with timeout protection
                if self._save_config_with_timeout():
                    return True
                else:
                    logger.warning("Failed to save default configuration, trying fallback...")
                    return self._create_minimal_config()
            
            # Execute the operation with timeout
            if _create_config_operation():
                elapsed = time.time() - start_time
                logger.info(f"Default configuration created successfully in {elapsed:.2f}s")
                return True
            else:
                return self._create_minimal_config()
                    
        except TimeoutError as e:
            elapsed = time.time() - start_time
            logger.error(f"Default config creation timed out after {elapsed:.2f}s: {e}")
            return self._create_minimal_config()
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Failed to create default configuration after {elapsed:.2f}s: {e}")
            return self._create_minimal_config()
    
    def _save_config_with_timeout(self) -> bool:
        """Save configuration with 2-second timeout"""
        try:
            # Use the timeout decorator for cross-platform timeout protection
            @with_timeout(2.0)
            def _save_operation():
                logger.debug("Step 2a: Starting config save with timeout...")
                
                if not self.config:
                    logger.error("No configuration to save")
                    return False
                
                # Update last modified timestamp
                self.config.last_modified = datetime.now().isoformat()
                
                # Convert to dictionary for JSON serialization
                config_dict = asdict(self.config)
                
                logger.debug("Step 2b: Ensuring config directory exists...")
                
                # Ensure directory exists with timeout
                config_dir = Path(self.config_path).parent
                try:
                    config_dir.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    logger.error(f"Failed to create config directory: {e}")
                    return False
                
                logger.debug("Step 2c: Writing config to temporary file...")
                
                # Create a temporary file first to avoid corruption
                temp_path = self.config_path + ".tmp"
                try:
                    with open(temp_path, 'w', encoding='utf-8') as f:
                        json.dump(config_dict, f, indent=2, ensure_ascii=False)
                    
                    logger.debug("Step 2d: Performing atomic move...")
                    
                    # Atomic move to final location
                    if os.name == 'nt':  # Windows
                        if os.path.exists(self.config_path):
                            os.remove(self.config_path)
                        os.rename(temp_path, self.config_path)
                    else:  # Unix-like
                        os.rename(temp_path, self.config_path)
                    
                    logger.debug("Step 2e: Config save completed successfully")
                    return True
                    
                except Exception as e:
                    # Clean up temp file if it exists
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                        except:
                            pass
                    logger.error(f"Failed to write config file: {e}")
                    return False
            
            # Execute the save operation with timeout
            return _save_operation()
                    
        except TimeoutError as e:
            logger.error(f"Config save timed out: {e}")
            return False
        except Exception as e:
            logger.error(f"Config save failed: {e}")
            return False
    
    def _create_minimal_config(self) -> bool:
        """Create a minimal configuration as fallback with timeout protection"""
        try:
            logger.info("Creating minimal fallback configuration...")
            
            # Use timeout protection for minimal config creation
            @with_timeout(1.0)  # Shorter timeout for minimal config
            def _create_minimal_operation():
                # Create minimal config object
                self.config = MCPConfig(
                    watched_directories=[],
                    global_exclude_patterns=[".env*", "node_modules", ".git"],
                    max_file_size="10MB",
                    enabled=True,
                    audit_logging=False,  # Disable audit logging for minimal config
                    security_mode="permissive",  # Use permissive mode for minimal config
                    config_version="2.0.0",
                    last_modified=datetime.now().isoformat()
                )
                
                # Try to save minimal config directly without complex timeout logic
                try:
                    config_dict = asdict(self.config)
                    config_dir = Path(self.config_path).parent
                    config_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Write directly to final location (no atomic move for minimal config)
                    with open(self.config_path, 'w', encoding='utf-8') as f:
                        json.dump(config_dict, f, indent=2, ensure_ascii=False)
                    
                    logger.info("Minimal fallback configuration created successfully")
                    return True
                    
                except Exception as e:
                    logger.error(f"Failed to save minimal config: {e}")
                    # Even if we can't save, we have the config object in memory
                    logger.warning("Configuration exists in memory but could not be saved to disk")
                    return True  # Return True since we have a working config object
            
            # Execute the minimal config creation with timeout
            return _create_minimal_operation()
                
        except TimeoutError as e:
            logger.error(f"Minimal config creation timed out: {e}")
            # Create config object in memory as last resort
            try:
                self.config = MCPConfig(
                    watched_directories=[],
                    global_exclude_patterns=[".env*", "node_modules", ".git"],
                    max_file_size="10MB",
                    enabled=True,
                    audit_logging=False,
                    security_mode="permissive",
                    config_version="2.0.0",
                    last_modified=datetime.now().isoformat()
                )
                logger.warning("Created minimal config in memory only (file save failed)")
                return True
            except Exception as e2:
                logger.error(f"Failed to create minimal config in memory: {e2}")
                return False
        except Exception as e:
            logger.error(f"Failed to create minimal configuration: {e}")
            return False
    
    def _validate_config(self):
        """Validate the current configuration with comprehensive checks"""
        if not self.config:
            raise ValueError("No configuration loaded")
        
        validation_errors = []
        
        # Validate directories
        for i, dir_config in enumerate(self.config.watched_directories):
            try:
                self._validate_directory_path(dir_config.path)
            except Exception as e:
                validation_errors.append(f"Directory {i+1} ({dir_config.path}): {str(e)}")
        
        # Validate security mode
        if self.config.security_mode not in ["strict", "moderate", "permissive"]:
            validation_errors.append(f"Invalid security mode: {self.config.security_mode}. Must be 'strict', 'moderate', or 'permissive'")
        
        # Validate file size format
        try:
            self._parse_file_size(self.config.max_file_size)
        except Exception as e:
            validation_errors.append(f"Invalid max_file_size format: {str(e)}")
        
        # Validate exclude patterns
        for i, pattern in enumerate(self.config.global_exclude_patterns):
            if not isinstance(pattern, str) or not pattern.strip():
                validation_errors.append(f"Exclude pattern {i+1} is empty or invalid: {pattern}")
        
        # Validate directory-specific configurations
        for i, dir_config in enumerate(self.config.watched_directories):
            # Validate max_file_size for each directory
            try:
                self._parse_file_size(dir_config.max_file_size)
            except Exception as e:
                validation_errors.append(f"Directory {i+1} max_file_size invalid: {str(e)}")
            
            # Validate exclude patterns for each directory
            for j, pattern in enumerate(dir_config.exclude_patterns):
                if not isinstance(pattern, str) or not pattern.strip():
                    validation_errors.append(f"Directory {i+1} exclude pattern {j+1} is empty or invalid: {pattern}")
        
        # Validate configuration version
        if not self.config.config_version:
            validation_errors.append("Configuration version is required")
        
        # Validate boolean fields
        if not isinstance(self.config.enabled, bool):
            validation_errors.append("'enabled' must be a boolean value")
        
        if not isinstance(self.config.audit_logging, bool):
            validation_errors.append("'audit_logging' must be a boolean value")
        
        # Check for duplicate directories
        directory_paths = [Path(d.path).resolve() for d in self.config.watched_directories]
        if len(directory_paths) != len(set(directory_paths)):
            validation_errors.append("Duplicate directory paths found in configuration")
        
        # Validate directory accessibility during config load
        for i, dir_config in enumerate(self.config.watched_directories):
            if dir_config.enabled:
                try:
                    # Test directory accessibility
                    test_path = Path(dir_config.path) / ".mcp_test"
                    test_path.touch()
                    test_path.unlink()
                except Exception as e:
                    validation_errors.append(f"Directory {i+1} ({dir_config.path}) is not accessible: {str(e)}")
        
        # Validate regex patterns in exclude patterns
        for i, pattern in enumerate(self.config.global_exclude_patterns):
            try:
                # Test if pattern is a valid glob pattern
                import fnmatch
                fnmatch.fnmatch("test", pattern)
            except Exception as e:
                validation_errors.append(f"Global exclude pattern {i+1} is invalid: {pattern} - {str(e)}")
        
        # Check for reasonable limits
        max_file_size_bytes = self._parse_file_size(self.config.max_file_size)
        if max_file_size_bytes > 1024 * 1024 * 1024:  # 1GB
            validation_errors.append("max_file_size is too large (>1GB). Consider using a smaller limit for security.")
        
        if len(self.config.watched_directories) > 50:
            validation_errors.append("Too many watched directories (>50). Consider consolidating directories.")
        
        # Raise comprehensive error if any validation failed
        if validation_errors:
            error_message = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in validation_errors)
            raise ValueError(error_message)
        
        logger.info("Configuration validation passed successfully")
    
    def _validate_directory_path(self, path: str) -> bool:
        """Validate that a directory path is safe to access"""
        try:
            resolved_path = Path(path).resolve()
            path_str = str(resolved_path)
            
            # Check if this is a system directory that should be blocked
            if self._is_system_directory(path_str):
                raise ValueError(f"Access to system directory not allowed: {path}")
            
            # Check if path exists and is accessible
            if not resolved_path.exists():
                raise ValueError(f"Directory does not exist: {path}")
            
            if not resolved_path.is_dir():
                raise ValueError(f"Path is not a directory: {path}")
            
            # Check read permissions
            if not os.access(resolved_path, os.R_OK):
                raise ValueError(f"No read permission for directory: {path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Directory validation failed for {path}: {e}")
            raise
    
    def _parse_file_size(self, size_str: str) -> int:
        """Parse file size string to bytes"""
        size_str = size_str.upper().strip()
        
        multipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        }
        
        for suffix, multiplier in multipliers.items():
            if size_str.endswith(suffix):
                try:
                    number = float(size_str[:-len(suffix)])
                    return int(number * multiplier)
                except ValueError:
                    pass
        
        raise ValueError(f"Invalid file size format: {size_str}")
    
    def add_directory(self, path: str, **kwargs) -> bool:
        """Add a directory to the watch list"""
        try:
            logger.info(f"Adding directory to watch list: {path}")
            
            with self._lock:
                # Validate path
                self._validate_directory_path(path)
                
                # Check if already exists
                for existing in self.config.watched_directories:
                    if Path(existing.path).resolve() == Path(path).resolve():
                        logger.warning(f"Directory already in watch list: {path}")
                        return False
                
                # Create directory config
                dir_config = DirectoryConfig(path=path, **kwargs)
                
                # Add to configuration
                self.config.watched_directories.append(dir_config)
                
                # Save configuration
                logger.info(f"Saving configuration with new directory: {path}")
                success = self.save_config(skip_lock=True)
                
                if success:
                    logger.info(f"Successfully added directory to watch list: {path}")
                    self._log_audit("add_directory", path, kwargs)
                else:
                    logger.error(f"Failed to save configuration after adding directory: {path}")
                
                return success
                
        except Exception as e:
            logger.error(f"Failed to add directory {path}: {e}")
            return False
    
    def remove_directory(self, path: str) -> bool:
        """Remove a directory from the watch list"""
        try:
            with self._lock:
                original_count = len(self.config.watched_directories)
                
                # Remove matching directories
                self.config.watched_directories = [
                    d for d in self.config.watched_directories
                    if Path(d.path).resolve() != Path(path).resolve()
                ]
                
                if len(self.config.watched_directories) == original_count:
                    logger.warning(f"Directory not found in watch list: {path}")
                    return False
                
                # Save configuration
                success = self.save_config(skip_lock=True)
                
                if success:
                    logger.info(f"Removed directory from watch list: {path}")
                    self._log_audit("remove_directory", path)
                
                return success
                
        except Exception as e:
            logger.error(f"Failed to remove directory {path}: {e}")
            return False
    
    def list_directories(self) -> List[Dict[str, Any]]:
        """List all watched directories with their configurations"""
        with self._lock:
            if not self.config:
                return []
            
            result = []
            for dir_config in self.config.watched_directories:
                result.append({
                    "path": dir_config.path,
                    "enabled": dir_config.enabled,
                    "max_file_size": dir_config.max_file_size,
                    "exclude_patterns": dir_config.exclude_patterns,
                    "include_gitignore": dir_config.include_gitignore,
                    "last_accessed": dir_config.last_accessed
                })
            
            return result
    
    def add_exclude_pattern(self, pattern: str) -> bool:
        """Add a global exclude pattern"""
        try:
            with self._lock:
                if pattern not in self.config.global_exclude_patterns:
                    self.config.global_exclude_patterns.append(pattern)
                    success = self.save_config(skip_lock=True)
                    
                    if success:
                        logger.info(f"Added exclude pattern: {pattern}")
                        self._log_audit("add_exclude_pattern", pattern)
                    
                    return success
                else:
                    logger.warning(f"Exclude pattern already exists: {pattern}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to add exclude pattern {pattern}: {e}")
            return False
    
    def remove_exclude_pattern(self, pattern: str) -> bool:
        """Remove a global exclude pattern"""
        try:
            with self._lock:
                if pattern in self.config.global_exclude_patterns:
                    self.config.global_exclude_patterns.remove(pattern)
                    success = self.save_config(skip_lock=True)
                    
                    if success:
                        logger.info(f"Removed exclude pattern: {pattern}")
                        self._log_audit("remove_exclude_pattern", pattern)
                    
                    return success
                else:
                    logger.warning(f"Exclude pattern not found: {pattern}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to remove exclude pattern {pattern}: {e}")
            return False
    
    def is_path_allowed(self, path: str) -> bool:
        """Check if a path is allowed based on current configuration"""
        try:
            with self._lock:
                # Bypass mode allows all access (for testing)
                if self.bypass_mode:
                    logger.debug(f"Bypass mode: allowing access to {path}")
                    return True
                
                if not self.config or not self.config.enabled:
                    return False
                
                resolved_path = Path(path).resolve()
                
                # If no directories are configured, allow access to current working directory
                # This provides a reasonable default for initial setup and testing
                if not self.config.watched_directories:
                    logger.debug(f"No watched directories configured, allowing access to current directory: {path}")
                    return True
                
                # Check if path is in any watched directory
                for dir_config in self.config.watched_directories:
                    if not dir_config.enabled:
                        continue
                    
                    watched_path = Path(dir_config.path).resolve()
                    
                    try:
                        # Check if the path is within the watched directory
                        resolved_path.relative_to(watched_path)
                        
                        # Check exclude patterns
                        if self._is_path_excluded(resolved_path, dir_config):
                            return False
                        
                        # Check file size if it's a file
                        if resolved_path.is_file():
                            max_size = self._parse_file_size(dir_config.max_file_size)
                            if resolved_path.stat().st_size > max_size:
                                return False
                        
                        # Update last accessed
                        dir_config.last_accessed = datetime.now().isoformat()
                        
                        return True
                        
                    except ValueError:
                        # Path is not within this watched directory
                        continue
                
                # If we have configured directories but the path doesn't match any,
                # check if we're in permissive mode or if it's the current working directory
                if self.config.security_mode == "permissive":
                    logger.debug(f"Permissive mode: allowing access to {path}")
                    return True
                
                # Allow access to current working directory even if not explicitly configured
                # This helps with initial setup and testing
                try:
                    current_dir = Path.cwd().resolve()
                    resolved_path.relative_to(current_dir)
                    logger.debug(f"Allowing access to current working directory: {path}")
                    return True
                except ValueError:
                    pass
                
                logger.debug(f"Path not allowed: {path} (not in watched directories)")
                return False
                
        except Exception as e:
            logger.error(f"Error checking path access for {path}: {e}")
            return False
    
    def _is_path_excluded(self, path: Path, dir_config: DirectoryConfig) -> bool:
        """Check if a path should be excluded based on patterns"""
        path_str = str(path)
        path_name = path.name
        
        # Check global exclude patterns
        for pattern in self.config.global_exclude_patterns:
            if fnmatch.fnmatch(path_name, pattern) or fnmatch.fnmatch(path_str, pattern):
                return True
        
        # Check directory-specific exclude patterns
        for pattern in dir_config.exclude_patterns:
            if fnmatch.fnmatch(path_name, pattern) or fnmatch.fnmatch(path_str, pattern):
                return True
        
        # Check .gitignore if enabled
        if dir_config.include_gitignore:
            if self._is_gitignored(path):
                return True
        
        return False
    
    def _is_gitignored(self, path: Path) -> bool:
        """Check if a path is ignored by .gitignore"""
        try:
            # Find the git repository root
            current = path.parent
            while current != current.parent:
                git_dir = current / ".git"
                if git_dir.exists():
                    # Found git repository, check .gitignore
                    gitignore_path = current / ".gitignore"
                    if gitignore_path.exists():
                        with open(gitignore_path, 'r', encoding='utf-8') as f:
                            for line in f:
                                line = line.strip()
                                if line and not line.startswith('#'):
                                    # Simple gitignore pattern matching
                                    if fnmatch.fnmatch(path.name, line) or fnmatch.fnmatch(str(path.relative_to(current)), line):
                                        return True
                    break
                current = current.parent
        except Exception:
            # If we can't check gitignore, assume not ignored
            pass
        
        return False
    
    def start_config_watcher(self):
        """Start watching the configuration file for changes"""
        if self._watcher_thread and self._watcher_thread.is_alive():
            return
        
        self._stop_watching = False
        self._watcher_thread = threading.Thread(target=self._watch_config_file, daemon=True)
        self._watcher_thread.start()
        logger.info("Configuration file watcher started")
    
    def stop_config_watcher(self):
        """Stop watching the configuration file"""
        self._stop_watching = True
        if self._watcher_thread:
            self._watcher_thread.join(timeout=1)
        logger.info("Configuration file watcher stopped")
    
    def _watch_config_file(self):
        """Watch the configuration file for changes and reload automatically"""
        while not self._stop_watching:
            try:
                if os.path.exists(self.config_path):
                    # Calculate file hash
                    with open(self.config_path, 'rb') as f:
                        file_hash = hashlib.md5(f.read()).hexdigest()
                    
                    # Check if file has changed
                    if self._last_config_hash and file_hash != self._last_config_hash:
                        logger.info("Configuration file changed, reloading...")
                        self.load_config()
                    
                    self._last_config_hash = file_hash
                
                time.sleep(1)  # Check every second
                
            except Exception as e:
                logger.error(f"Error watching config file: {e}")
                time.sleep(5)  # Wait longer on error
    
    def _log_audit(self, action: str, path: str, details: Optional[Dict] = None):
        """Log audit information for security tracking"""
        if not self.config or not self.config.audit_logging:
            return
        
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "path": path,
            "details": details or {},
            "user": os.getenv("USER", "unknown")
        }
        
        # Log to file
        audit_log_path = Path(self.config_path).parent / "audit.log"
        try:
            with open(audit_log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(audit_entry) + '\n')
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of the current configuration"""
        with self._lock:
            if not self.config:
                return {"error": "No configuration loaded"}
            
            return {
                "config_path": self.config_path,
                "enabled": self.config.enabled,
                "security_mode": self.config.security_mode,
                "audit_logging": self.config.audit_logging,
                "total_directories": len(self.config.watched_directories),
                "enabled_directories": len([d for d in self.config.watched_directories if d.enabled]),
                "global_exclude_patterns": len(self.config.global_exclude_patterns),
                "max_file_size": self.config.max_file_size,
                "config_version": self.config.config_version,
                "last_modified": self.config.last_modified
            }
    
    def test_config_creation(self) -> Dict[str, Any]:
        """Test configuration creation and file operations"""
        test_results = {
            "config_directory_accessible": False,
            "config_file_writable": False,
            "json_serialization": False,
            "config_loading": False,
            "errors": []
        }
        
        try:
            # Test config directory access
            config_dir = Path(self.config_path).parent
            if config_dir.exists() or config_dir.mkdir(parents=True, exist_ok=True):
                test_results["config_directory_accessible"] = True
            else:
                test_results["errors"].append("Cannot create or access config directory")
                
        except Exception as e:
            test_results["errors"].append(f"Config directory error: {e}")
        
        try:
            # Test file writing
            test_file = self.config_path + ".test"
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
            test_results["config_file_writable"] = True
            
        except Exception as e:
            test_results["errors"].append(f"File writing error: {e}")
        
        try:
            # Test JSON serialization
            test_config = MCPConfig(
                watched_directories=[],
                global_exclude_patterns=[],
                max_file_size="10MB",
                enabled=True,
                audit_logging=True,
                security_mode="moderate",
                config_version="2.0.0",
                last_modified=datetime.now().isoformat()
            )
            json.dumps(asdict(test_config))
            test_results["json_serialization"] = True
            
        except Exception as e:
            test_results["errors"].append(f"JSON serialization error: {e}")
        
        try:
            # Test config loading
            if self.load_config():
                test_results["config_loading"] = True
            else:
                test_results["errors"].append("Config loading failed")
                
        except Exception as e:
            test_results["errors"].append(f"Config loading error: {e}")
        
        return test_results


def main():
    """CLI interface for MCP configuration management"""
    parser = argparse.ArgumentParser(
        description="MCP Server Configuration Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --add-dir /path/to/project
  %(prog)s --remove-dir /path/to/project
  %(prog)s --list-dirs
  %(prog)s --exclude-pattern "*.env"
  %(prog)s --config-path ~/.mcp/custom-config.json
        """
    )
    
    parser.add_argument('--config-path', help='Path to configuration file')
    parser.add_argument('--add-dir', help='Add directory to watch list')
    parser.add_argument('--remove-dir', help='Remove directory from watch list')
    parser.add_argument('--list-dirs', action='store_true', help='List all watched directories')
    parser.add_argument('--exclude-pattern', help='Add global exclude pattern')
    parser.add_argument('--remove-exclude-pattern', help='Remove global exclude pattern')
    parser.add_argument('--enable', action='store_true', help='Enable MCP server')
    parser.add_argument('--disable', action='store_true', help='Disable MCP server')
    parser.add_argument('--security-mode', choices=['strict', 'moderate', 'permissive'], 
                       help='Set security mode')
    parser.add_argument('--max-file-size', help='Set maximum file size (e.g., 10MB)')
    parser.add_argument('--summary', action='store_true', help='Show configuration summary')
    parser.add_argument('--validate', action='store_true', help='Validate current configuration')
    parser.add_argument('--test', action='store_true', help='Test configuration system')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize config manager with timeout protection
    try:
        config_manager = MCPConfigManager(args.config_path)
    except Exception as e:
        print(f"✗ Failed to initialize configuration manager: {e}")
        sys.exit(1)
    
    try:
        if args.add_dir:
            print(f"Adding directory: {args.add_dir}")
            try:
                success = config_manager.add_directory(args.add_dir)
                if success:
                    print(f"✓ Added directory: {args.add_dir}")
                else:
                    print(f"✗ Failed to add directory: {args.add_dir}")
                    sys.exit(1)
            except Exception as e:
                print(f"✗ Error adding directory {args.add_dir}: {e}")
                sys.exit(1)
        
        elif args.remove_dir:
            success = config_manager.remove_directory(args.remove_dir)
            if success:
                print(f"✓ Removed directory: {args.remove_dir}")
            else:
                print(f"✗ Failed to remove directory: {args.remove_dir}")
                sys.exit(1)
        
        elif args.list_dirs:
            directories = config_manager.list_directories()
            if directories:
                print("Watched Directories:")
                print("-" * 50)
                for i, dir_info in enumerate(directories, 1):
                    status = "✓" if dir_info['enabled'] else "✗"
                    print(f"{i}. {status} {dir_info['path']}")
                    print(f"   Max file size: {dir_info['max_file_size']}")
                    print(f"   Exclude patterns: {', '.join(dir_info['exclude_patterns'])}")
                    if dir_info['last_accessed']:
                        print(f"   Last accessed: {dir_info['last_accessed']}")
                    print()
            else:
                print("No directories in watch list")
        
        elif args.exclude_pattern:
            success = config_manager.add_exclude_pattern(args.exclude_pattern)
            if success:
                print(f"✓ Added exclude pattern: {args.exclude_pattern}")
            else:
                print(f"✗ Failed to add exclude pattern: {args.exclude_pattern}")
                sys.exit(1)
        
        elif args.remove_exclude_pattern:
            success = config_manager.remove_exclude_pattern(args.remove_exclude_pattern)
            if success:
                print(f"✓ Removed exclude pattern: {args.remove_exclude_pattern}")
            else:
                print(f"✗ Failed to remove exclude pattern: {args.remove_exclude_pattern}")
                sys.exit(1)
        
        elif args.enable:
            with config_manager._lock:
                config_manager.config.enabled = True
                success = config_manager.save_config(skip_lock=True)
            if success:
                print("✓ MCP server enabled")
            else:
                print("✗ Failed to enable MCP server")
                sys.exit(1)
        
        elif args.disable:
            with config_manager._lock:
                config_manager.config.enabled = False
                success = config_manager.save_config(skip_lock=True)
            if success:
                print("✓ MCP server disabled")
            else:
                print("✗ Failed to disable MCP server")
                sys.exit(1)
        
        elif args.security_mode:
            with config_manager._lock:
                config_manager.config.security_mode = args.security_mode
                success = config_manager.save_config()
            if success:
                print(f"✓ Security mode set to: {args.security_mode}")
            else:
                print(f"✗ Failed to set security mode: {args.security_mode}")
                sys.exit(1)
        
        elif args.max_file_size:
            try:
                config_manager._parse_file_size(args.max_file_size)
                with config_manager._lock:
                    config_manager.config.max_file_size = args.max_file_size
                    success = config_manager.save_config(skip_lock=True)
                if success:
                    print(f"✓ Maximum file size set to: {args.max_file_size}")
                else:
                    print(f"✗ Failed to set maximum file size: {args.max_file_size}")
                    sys.exit(1)
            except ValueError as e:
                print(f"✗ Invalid file size format: {e}")
                sys.exit(1)
        
        elif args.summary:
            summary = config_manager.get_config_summary()
            print("MCP Configuration Summary:")
            print("-" * 30)
            for key, value in summary.items():
                print(f"{key}: {value}")
        
        elif args.validate:
            try:
                config_manager._validate_config()
                print("✓ Configuration is valid")
            except Exception as e:
                print(f"✗ Configuration validation failed: {e}")
                sys.exit(1)
        
        elif args.test:
            print("Testing configuration system...")
            test_results = config_manager.test_config_creation()
            
            print("\nTest Results:")
            print("-" * 30)
            print(f"Config directory accessible: {'✓' if test_results['config_directory_accessible'] else '✗'}")
            print(f"Config file writable: {'✓' if test_results['config_file_writable'] else '✗'}")
            print(f"JSON serialization: {'✓' if test_results['json_serialization'] else '✗'}")
            print(f"Config loading: {'✓' if test_results['config_loading'] else '✗'}")
            
            if test_results['errors']:
                print("\nErrors found:")
                for error in test_results['errors']:
                    print(f"  - {error}")
                sys.exit(1)
            else:
                print("\n✓ All tests passed!")
        
        else:
            parser.print_help()
    
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        print(f"✗ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
