#!/usr/bin/env python3
"""
Security Audit Script for MCP Server Directory Access

Comprehensive security testing script that validates directory access restrictions,
tests for path traversal vulnerabilities, and ensures security settings work correctly.

This script performs automated security audits of the MCP server configuration
and access controls to identify potential security vulnerabilities.

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
from pathlib import Path
from typing import List, Dict, Any, Tuple
import argparse
import logging

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    from mcp_config_manager import MCPConfigManager
    from official_mcp_server import _list_files_sync, _read_file_sync
except ImportError as e:
    print(f"Error importing MCP modules: {e}")
    print("Please ensure you're running this script from the project root directory")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SecurityAuditResult:
    """Container for security audit results."""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.results = []
    
    def add_result(self, test_name: str, status: str, message: str, details: str = ""):
        """Add a test result."""
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details
        }
        self.results.append(result)
        
        if status == "PASS":
            self.passed += 1
        elif status == "FAIL":
            self.failed += 1
        elif status == "WARN":
            self.warnings += 1
    
    def print_summary(self):
        """Print audit summary."""
        print("\n" + "=" * 60)
        print("SECURITY AUDIT SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {len(self.results)}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Warnings: {self.warnings}")
        print("=" * 60)
        
        if self.failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if result["status"] == "FAIL":
                    print(f"  ✗ {result['test']}: {result['message']}")
        
        if self.warnings > 0:
            print("\nWARNINGS:")
            for result in self.results:
                if result["status"] == "WARN":
                    print(f"  ⚠ {result['test']}: {result['message']}")
        
        print(f"\nOverall Status: {'PASS' if self.failed == 0 else 'FAIL'}")


class DirectoryAccessAuditor:
    """Security auditor for directory access controls."""
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path
        self.temp_dir = None
        self.test_dirs = {}
        self.audit_result = SecurityAuditResult()
    
    def setup_test_environment(self):
        """Set up test environment with various directory structures."""
        self.temp_dir = tempfile.mkdtemp(prefix="mcp_security_audit_")
        logger.info(f"Created test environment: {self.temp_dir}")
        
        # Create test directory structure
        test_structure = {
            "safe_dir": {
                "files": ["safe_file.txt", "config.json", "readme.md"],
                "subdirs": ["src", "docs", "tests"]
            },
            "sensitive_dir": {
                "files": [".env", "secrets.txt", "private.key", "database.conf"],
                "subdirs": ["private", "confidential"]
            },
            "system_like_dir": {
                "files": ["passwd", "shadow", "hosts", "services"],
                "subdirs": ["etc", "var", "usr"]
            },
            "mixed_dir": {
                "files": ["public.txt", ".env", "config.py", "secrets.json"],
                "subdirs": ["public", "private"]
            }
        }
        
        for dir_name, structure in test_structure.items():
            dir_path = os.path.join(self.temp_dir, dir_name)
            os.makedirs(dir_path, exist_ok=True)
            self.test_dirs[dir_name] = dir_path
            
            # Create files
            for file_name in structure["files"]:
                file_path = os.path.join(dir_path, file_name)
                with open(file_path, 'w') as f:
                    f.write(f"Test content for {file_name}")
            
            # Create subdirectories
            for subdir_name in structure["subdirs"]:
                subdir_path = os.path.join(dir_path, subdir_name)
                os.makedirs(subdir_path, exist_ok=True)
                
                # Add a file to each subdirectory
                with open(os.path.join(subdir_path, "test.txt"), 'w') as f:
                    f.write(f"Test file in {subdir_name}")
    
    def cleanup_test_environment(self):
        """Clean up test environment."""
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            logger.info("Cleaned up test environment")
    
    def test_path_traversal_protection(self, config_manager: MCPConfigManager):
        """Test protection against path traversal attacks."""
        logger.info("Testing path traversal protection...")
        
        # Add only safe_dir to configuration
        config_manager.add_directory(self.test_dirs["safe_dir"])
        
        # Test various path traversal attempts
        traversal_attempts = [
            # Basic traversal
            "../sensitive_dir/secrets.txt",
            "../../sensitive_dir/secrets.txt",
            "../../../sensitive_dir/secrets.txt",
            
            # Encoded traversal
            "%2e%2e%2fsensitive_dir%2fsecrets.txt",
            "..%2fsensitive_dir%2fsecrets.txt",
            
            # Mixed separators
            "..\\sensitive_dir\\secrets.txt",
            "../sensitive_dir\\secrets.txt",
            
            # Double encoding
            "%252e%252e%252fsensitive_dir%252fsecrets.txt",
            
            # Null byte injection
            "../sensitive_dir/secrets.txt\x00",
            
            # Unicode traversal
            "..\u2215sensitive_dir\u2215secrets.txt",
            
            # Long traversal
            "../" * 100 + "sensitive_dir/secrets.txt",
        ]
        
        for attempt in traversal_attempts:
            test_path = os.path.join(self.test_dirs["safe_dir"], attempt)
            
            # Test file reading
            # Mock the global config_manager for this test
            import official_mcp_server
            original_config_manager = getattr(official_mcp_server, 'config_manager', None)
            official_mcp_server.config_manager = config_manager
            
            try:
                result = _read_file_sync(test_path)
            finally:
                official_mcp_server.config_manager = original_config_manager
            if result["success"]:
                self.audit_result.add_result(
                    "path_traversal_protection",
                    "FAIL",
                    f"Path traversal successful: {attempt}",
                    f"Was able to access: {test_path}"
                )
            else:
                self.audit_result.add_result(
                    "path_traversal_protection",
                    "PASS",
                    f"Path traversal blocked: {attempt}"
                )
    
    def test_system_directory_protection(self, config_manager: MCPConfigManager):
        """Test protection against accessing system directories."""
        logger.info("Testing system directory protection...")
        
        # Test system-like paths
        system_paths = [
            "/etc/passwd",
            "/etc/shadow",
            "/etc/hosts",
            "/usr/bin/ls",
            "/var/log/syslog",
            "/proc/1/status",
            "/sys/kernel/version",
            "C:\\Windows\\System32\\cmd.exe",
            "C:\\Windows\\System32\\config\\SAM",
            "C:\\Program Files\\Common Files\\System",
        ]
        
        for system_path in system_paths:
            # Mock the global config_manager for this test
            import official_mcp_server
            original_config_manager = getattr(official_mcp_server, 'config_manager', None)
            official_mcp_server.config_manager = config_manager
            
            try:
                result = _read_file_sync(system_path)
            finally:
                official_mcp_server.config_manager = original_config_manager
            if result["success"]:
                self.audit_result.add_result(
                    "system_directory_protection",
                    "FAIL",
                    f"System path accessible: {system_path}",
                    "System directories should be protected"
                )
            else:
                self.audit_result.add_result(
                    "system_directory_protection",
                    "PASS",
                    f"System path blocked: {system_path}"
                )
    
    def test_file_size_limits(self, config_manager: MCPConfigManager):
        """Test file size limit enforcement."""
        logger.info("Testing file size limits...")
        
        # Create files of different sizes
        size_tests = [
            ("small_file.txt", 1024, "1KB"),  # 1KB
            ("medium_file.txt", 1024 * 1024, "1MB"),  # 1MB
            ("large_file.txt", 10 * 1024 * 1024, "10MB"),  # 10MB
        ]
        
        test_dir = os.path.join(self.temp_dir, "size_test")
        os.makedirs(test_dir, exist_ok=True)
        
        for filename, size, size_str in size_tests:
            file_path = os.path.join(test_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(b'x' * size)
        
        # Test with different size limits
        size_limits = ["1KB", "1MB", "5MB", "10MB"]
        
        for limit in size_limits:
            # Create new config manager for each test
            test_config_manager = MCPConfigManager()
            test_config_manager.add_directory(test_dir, max_file_size=limit)
            
            for filename, size, size_str in size_tests:
                file_path = os.path.join(test_dir, filename)
                
                # Mock the global config_manager for this test
                import official_mcp_server
                original_config_manager = getattr(official_mcp_server, 'config_manager', None)
                official_mcp_server.config_manager = test_config_manager
                
                try:
                    result = _read_file_sync(file_path)
                finally:
                    official_mcp_server.config_manager = original_config_manager
                
                # Parse the limit to bytes
                limit_bytes = test_config_manager._parse_file_size(limit)
                
                if size <= limit_bytes:
                    if result["success"]:
                        self.audit_result.add_result(
                            "file_size_limits",
                            "PASS",
                            f"File {filename} ({size_str}) within limit {limit}"
                        )
                    else:
                        self.audit_result.add_result(
                            "file_size_limits",
                            "FAIL",
                            f"File {filename} ({size_str}) blocked despite being within limit {limit}"
                        )
                else:
                    if not result["success"]:
                        self.audit_result.add_result(
                            "file_size_limits",
                            "PASS",
                            f"File {filename} ({size_str}) correctly blocked by limit {limit}"
                        )
                    else:
                        self.audit_result.add_result(
                            "file_size_limits",
                            "FAIL",
                            f"File {filename} ({size_str}) not blocked by limit {limit}"
                        )
    
    def test_exclusion_patterns(self, config_manager: MCPConfigManager):
        """Test exclusion pattern functionality."""
        logger.info("Testing exclusion patterns...")
        
        # Add directory with various exclusion patterns
        exclusion_patterns = [
            "*.env",
            "*.key",
            "*.log",
            "secrets.*",
            "private/*",
            "confidential/*",
            "*.tmp",
            "*.temp",
        ]
        
        config_manager.add_directory(
            self.test_dirs["mixed_dir"],
            exclude_patterns=exclusion_patterns
        )
        
        # Test files that should be excluded
        excluded_files = [
            ".env",
            "private.key",
            "secrets.json",
            "app.log",
            "temp.tmp",
        ]
        
        for filename in excluded_files:
            file_path = os.path.join(self.test_dirs["mixed_dir"], filename)
            
            # Create the file if it doesn't exist
            if not os.path.exists(file_path):
                with open(file_path, 'w') as f:
                    f.write("Test content")
            
            # Mock the global config_manager for this test
            import official_mcp_server
            original_config_manager = getattr(official_mcp_server, 'config_manager', None)
            official_mcp_server.config_manager = config_manager
            
            try:
                result = _read_file_sync(file_path)
            finally:
                official_mcp_server.config_manager = original_config_manager
            if not result["success"]:
                self.audit_result.add_result(
                    "exclusion_patterns",
                    "PASS",
                    f"File {filename} correctly excluded"
                )
            else:
                self.audit_result.add_result(
                    "exclusion_patterns",
                    "FAIL",
                    f"File {filename} not excluded by patterns"
                )
        
        # Test files that should be accessible
        allowed_files = [
            "public.txt",
            "config.py",
            "readme.md",
        ]
        
        for filename in allowed_files:
            file_path = os.path.join(self.test_dirs["mixed_dir"], filename)
            
            # Create the file if it doesn't exist
            if not os.path.exists(file_path):
                with open(file_path, 'w') as f:
                    f.write("Test content")
            
            # Mock the global config_manager for this test
            import official_mcp_server
            original_config_manager = getattr(official_mcp_server, 'config_manager', None)
            official_mcp_server.config_manager = config_manager
            
            try:
                result = _read_file_sync(file_path)
            finally:
                official_mcp_server.config_manager = original_config_manager
            if result["success"]:
                self.audit_result.add_result(
                    "exclusion_patterns",
                    "PASS",
                    f"File {filename} correctly accessible"
                )
            else:
                self.audit_result.add_result(
                    "exclusion_patterns",
                    "FAIL",
                    f"File {filename} incorrectly blocked"
                )
    
    def test_configuration_security(self, config_manager: MCPConfigManager):
        """Test configuration security settings."""
        logger.info("Testing configuration security...")
        
        # Test security mode validation
        security_modes = ["strict", "moderate", "permissive", "invalid"]
        
        for mode in security_modes:
            try:
                config_manager.config.security_mode = mode
                config_manager._validate_config()
                
                if mode == "invalid":
                    self.audit_result.add_result(
                        "configuration_security",
                        "FAIL",
                        f"Invalid security mode '{mode}' was accepted"
                    )
                else:
                    self.audit_result.add_result(
                        "configuration_security",
                        "PASS",
                        f"Valid security mode '{mode}' accepted"
                    )
            except ValueError:
                if mode == "invalid":
                    self.audit_result.add_result(
                        "configuration_security",
                        "PASS",
                        f"Invalid security mode '{mode}' correctly rejected"
                    )
                else:
                    self.audit_result.add_result(
                        "configuration_security",
                        "FAIL",
                        f"Valid security mode '{mode}' incorrectly rejected"
                    )
        
        # Test forbidden path validation
        forbidden_paths = [
            "/",
            "/usr",
            "/etc",
            "/var",
            "/sys",
            "/proc",
            "/dev",
            "C:\\",
            "C:\\Windows",
            "C:\\System32",
        ]
        
        for path in forbidden_paths:
            try:
                config_manager._validate_directory_path(path)
                self.audit_result.add_result(
                    "configuration_security",
                    "FAIL",
                    f"Forbidden path '{path}' was accepted"
                )
            except ValueError:
                self.audit_result.add_result(
                    "configuration_security",
                    "PASS",
                    f"Forbidden path '{path}' correctly rejected"
                )
    
    def test_audit_logging(self, config_manager: MCPConfigManager):
        """Test audit logging functionality."""
        logger.info("Testing audit logging...")
        
        # Enable audit logging
        config_manager.config.audit_logging = True
        
        # Perform actions that should be logged
        config_manager.add_directory(self.test_dirs["safe_dir"])
        config_manager.remove_directory(self.test_dirs["safe_dir"])
        
        # Check if audit log was created
        audit_log_path = Path(config_manager.config_path).parent / "audit.log"
        
        if audit_log_path.exists():
            self.audit_result.add_result(
                "audit_logging",
                "PASS",
                "Audit log file created"
            )
            
            # Check log content
            with open(audit_log_path, 'r') as f:
                log_content = f.read()
                
                if "add_directory" in log_content and "remove_directory" in log_content:
                    self.audit_result.add_result(
                        "audit_logging",
                        "PASS",
                        "Audit log contains expected actions"
                    )
                else:
                    self.audit_result.add_result(
                        "audit_logging",
                        "WARN",
                        "Audit log missing expected actions"
                    )
        else:
            self.audit_result.add_result(
                "audit_logging",
                "FAIL",
                "Audit log file not created"
            )
    
    def test_permission_handling(self, config_manager: MCPConfigManager):
        """Test permission handling and error cases."""
        logger.info("Testing permission handling...")
        
        # Test with read-only directory
        read_only_dir = os.path.join(self.temp_dir, "read_only")
        os.makedirs(read_only_dir, exist_ok=True)
        
        # Make directory read-only (Unix-like systems)
        if hasattr(os, 'chmod'):
            os.chmod(read_only_dir, 0o444)
        
        config_manager.add_directory(read_only_dir)
        
        # Test listing files in read-only directory
        # Mock the global config_manager for this test
        import official_mcp_server
        original_config_manager = getattr(official_mcp_server, 'config_manager', None)
        official_mcp_server.config_manager = config_manager
        
        try:
            result = _list_files_sync(read_only_dir)
        finally:
            official_mcp_server.config_manager = original_config_manager
        if result["success"]:
            self.audit_result.add_result(
                "permission_handling",
                "PASS",
                "Read-only directory access handled correctly"
            )
        else:
            self.audit_result.add_result(
                "permission_handling",
                "WARN",
                f"Read-only directory access failed: {result.get('error', 'Unknown error')}"
            )
    
    def test_concurrent_access(self, config_manager: MCPConfigManager):
        """Test concurrent access scenarios."""
        logger.info("Testing concurrent access...")
        
        import threading
        import time
        
        config_manager.add_directory(self.test_dirs["safe_dir"])
        
        results = []
        errors = []
        
        def access_files():
            try:
                # Mock the global config_manager for this test
                import official_mcp_server
                original_config_manager = getattr(official_mcp_server, 'config_manager', None)
                official_mcp_server.config_manager = config_manager
                
                try:
                    for i in range(10):
                        result = _list_files_sync(self.test_dirs["safe_dir"])
                        results.append(result["success"])
                        time.sleep(0.01)
                finally:
                    official_mcp_server.config_manager = original_config_manager
            except Exception as e:
                errors.append(str(e))
        
        # Start multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=access_files)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        if errors:
            self.audit_result.add_result(
                "concurrent_access",
                "FAIL",
                f"Concurrent access errors: {errors}"
            )
        elif all(results):
            self.audit_result.add_result(
                "concurrent_access",
                "PASS",
                "Concurrent access handled correctly"
            )
        else:
            self.audit_result.add_result(
                "concurrent_access",
                "WARN",
                "Some concurrent access attempts failed"
            )
    
    def run_security_audit(self) -> SecurityAuditResult:
        """Run complete security audit."""
        logger.info("Starting security audit...")
        
        try:
            self.setup_test_environment()
            
            # Create configuration manager
            config_manager = MCPConfigManager(self.config_path)
            
            # Run all security tests
            self.test_path_traversal_protection(config_manager)
            self.test_system_directory_protection(config_manager)
            self.test_file_size_limits(config_manager)
            self.test_exclusion_patterns(config_manager)
            self.test_configuration_security(config_manager)
            self.test_audit_logging(config_manager)
            self.test_permission_handling(config_manager)
            self.test_concurrent_access(config_manager)
            
        except Exception as e:
            logger.error(f"Security audit failed: {e}")
            self.audit_result.add_result(
                "audit_execution",
                "FAIL",
                f"Audit execution failed: {str(e)}"
            )
        finally:
            self.cleanup_test_environment()
        
        return self.audit_result


def main():
    """Main function for security audit script."""
    parser = argparse.ArgumentParser(
        description="Security Audit Script for MCP Server Directory Access",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                           # Run audit with default config
  %(prog)s --config /path/to/config.json  # Run with custom config
  %(prog)s --output audit_report.json     # Save results to file
  %(prog)s --verbose                      # Verbose output
        """
    )
    
    parser.add_argument('--config', help='Path to configuration file')
    parser.add_argument('--output', help='Output file for audit results (JSON)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Run security audit
    auditor = DirectoryAccessAuditor(args.config)
    audit_result = auditor.run_security_audit()
    
    # Print results
    audit_result.print_summary()
    
    # Save results to file if requested
    if args.output:
        try:
            with open(args.output, 'w') as f:
                json.dump(audit_result.results, f, indent=2)
            logger.info(f"Audit results saved to {args.output}")
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
    
    # Exit with appropriate code
    sys.exit(1 if audit_result.failed > 0 else 0)


if __name__ == "__main__":
    main()
