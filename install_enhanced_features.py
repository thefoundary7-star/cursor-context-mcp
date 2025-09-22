#!/usr/bin/env python3
"""
Enhanced MCP Server Installation Script

This script installs and configures the enhanced MCP server with all new features,
including automatic dependency installation, configuration setup, and feature detection.
"""

import os
import sys
import subprocess
import json
import shutil
import platform
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EnhancedMCPInstaller:
    """Installer for enhanced MCP server features"""
    
    def __init__(self):
        self.system_info = self._get_system_info()
        self.install_dir = Path.cwd()
        self.config_dir = Path.home() / ".mcp"
        self.features_to_install = []
        self.optional_features = []
        
    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information for compatibility checks"""
        return {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "python_version": sys.version,
            "python_executable": sys.executable
        }
    
    def check_prerequisites(self) -> Dict[str, bool]:
        """Check system prerequisites"""
        logger.info("Checking system prerequisites...")
        
        checks = {
            "python_version": self._check_python_version(),
            "pip_available": self._check_pip(),
            "git_available": self._check_git(),
            "write_permissions": self._check_write_permissions(),
            "network_access": self._check_network_access()
        }
        
        # Log results
        for check, result in checks.items():
            status = "✓" if result else "✗"
            logger.info(f"{status} {check}: {'PASS' if result else 'FAIL'}")
        
        return checks
    
    def _check_python_version(self) -> bool:
        """Check if Python version is compatible"""
        version = sys.version_info
        return version.major == 3 and version.minor >= 8
    
    def _check_pip(self) -> bool:
        """Check if pip is available"""
        try:
            subprocess.run([sys.executable, "-m", "pip", "--version"], 
                         capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def _check_git(self) -> bool:
        """Check if git is available"""
        try:
            subprocess.run(["git", "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def _check_write_permissions(self) -> bool:
        """Check write permissions for installation directory"""
        try:
            test_file = self.install_dir / ".mcp_install_test"
            test_file.touch()
            test_file.unlink()
            return True
        except (PermissionError, OSError):
            return False
    
    def _check_network_access(self) -> bool:
        """Check network access for package installation"""
        try:
            import urllib.request
            urllib.request.urlopen("https://pypi.org", timeout=5)
            return True
        except Exception:
            return False
    
    def detect_features(self) -> Dict[str, bool]:
        """Detect available features based on system capabilities"""
        logger.info("Detecting available features...")
        
        features = {
            "code_indexing": self._detect_code_indexing(),
            "real_time_monitoring": self._detect_file_monitoring(),
            "git_integration": self._detect_git_integration(),
            "security_scanning": self._detect_security_scanning(),
            "performance_monitoring": self._detect_performance_monitoring(),
            "advanced_logging": self._detect_advanced_logging(),
            "web_interface": self._detect_web_interface(),
            "database_integration": self._detect_database_integration(),
            "cloud_integration": self._detect_cloud_integration()
        }
        
        # Log detection results
        for feature, available in features.items():
            status = "✓" if available else "✗"
            logger.info(f"{status} {feature}: {'Available' if available else 'Not available'}")
        
        return features
    
    def _detect_code_indexing(self) -> bool:
        """Detect if code indexing features are available"""
        try:
            # Check for tree-sitter dependencies
            import tree_sitter
            return True
        except ImportError:
            return False
    
    def _detect_file_monitoring(self) -> bool:
        """Detect if file monitoring is available"""
        try:
            import watchdog
            return True
        except ImportError:
            return False
    
    def _detect_git_integration(self) -> bool:
        """Detect if git integration is available"""
        try:
            import git
            return True
        except ImportError:
            return False
    
    def _detect_security_scanning(self) -> bool:
        """Detect if security scanning is available"""
        try:
            import cryptography
            return True
        except ImportError:
            return False
    
    def _detect_performance_monitoring(self) -> bool:
        """Detect if performance monitoring is available"""
        try:
            import psutil
            return True
        except ImportError:
            return False
    
    def _detect_advanced_logging(self) -> bool:
        """Detect if advanced logging is available"""
        try:
            import structlog
            return True
        except ImportError:
            return False
    
    def _detect_web_interface(self) -> bool:
        """Detect if web interface is available"""
        try:
            import fastapi
            return True
        except ImportError:
            return False
    
    def _detect_database_integration(self) -> bool:
        """Detect if database integration is available"""
        try:
            import sqlalchemy
            return True
        except ImportError:
            return False
    
    def _detect_cloud_integration(self) -> bool:
        """Detect if cloud integration is available"""
        try:
            import boto3
            return True
        except ImportError:
            return False
    
    def install_dependencies(self, features: List[str] = None) -> bool:
        """Install required dependencies"""
        logger.info("Installing dependencies...")
        
        # Base requirements
        base_requirements = [
            "mcp>=1.0.0",
            "fastmcp>=0.1.0",
            "psutil>=5.9.0",
            "httpx>=0.24.0",
            "watchdog>=3.0.0"
        ]
        
        # Feature-specific requirements
        feature_requirements = {
            "code_indexing": [
                "tree-sitter>=0.20.0",
                "tree-sitter-python>=0.20.0",
                "tree-sitter-javascript>=0.20.0",
                "tree-sitter-typescript>=0.20.0"
            ],
            "git_integration": ["GitPython>=3.1.0"],
            "security_scanning": ["cryptography>=41.0.0", "bcrypt>=4.0.0"],
            "performance_monitoring": ["memory-profiler>=0.61.0", "py-spy>=0.3.14"],
            "advanced_logging": ["structlog>=23.0.0", "prometheus-client>=0.17.0"],
            "web_interface": ["fastapi>=0.100.0", "uvicorn>=0.23.0"],
            "database_integration": ["sqlalchemy>=2.0.0", "alembic>=1.11.0"],
            "cloud_integration": ["boto3>=1.28.0"]
        }
        
        # Collect all requirements
        all_requirements = base_requirements.copy()
        if features:
            for feature in features:
                if feature in feature_requirements:
                    all_requirements.extend(feature_requirements[feature])
        
        # Install requirements
        try:
            for requirement in all_requirements:
                logger.info(f"Installing {requirement}...")
                result = subprocess.run(
                    [sys.executable, "-m", "pip", "install", requirement],
                    capture_output=True,
                    text=True,
                    check=True
                )
                logger.info(f"✓ Installed {requirement}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies: {e}")
            logger.error(f"Error output: {e.stderr}")
            return False
    
    def setup_configuration(self, features: List[str] = None) -> bool:
        """Setup enhanced configuration"""
        logger.info("Setting up enhanced configuration...")
        
        try:
            # Create config directory
            self.config_dir.mkdir(exist_ok=True)
            
            # Create enhanced configuration
            config = self._create_enhanced_config(features)
            
            # Save configuration
            config_file = self.config_dir / "enhanced_config.json"
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✓ Configuration saved to {config_file}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup configuration: {e}")
            return False
    
    def _create_enhanced_config(self, features: List[str] = None) -> Dict[str, Any]:
        """Create enhanced configuration based on available features"""
        from datetime import datetime
        
        config = {
            "config_version": "2.1.0",
            "last_modified": datetime.now().isoformat(),
            "enabled": True,
            "watched_directories": [],
            "global_exclude_patterns": [
                ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log",
                "*.tmp", "*.temp", ".DS_Store", "Thumbs.db", "*.swp", "*.swo"
            ],
            "max_file_size": "10MB",
            "audit_logging": True,
            "security_mode": "moderate",
            "performance": {
                "max_files_per_operation": 1000,
                "max_search_results": 500,
                "max_file_size_mb": 100,
                "operation_timeout": 300,
                "cache_size_file": 500,
                "cache_size_symbol": 1000,
                "cache_size_git": 100,
                "cache_ttl_seconds": 300,
                "indexing_batch_size": 100,
                "indexing_parallel_workers": 4,
                "monitoring_frequency": 1.0,
                "memory_limit_mb": 1024,
                "cpu_limit_percent": 80
            },
            "features": {
                "code_indexing": "code_indexing" in (features or []),
                "real_time_monitoring": "real_time_monitoring" in (features or []),
                "git_integration": "git_integration" in (features or []),
                "security_scanning": "security_scanning" in (features or []),
                "performance_monitoring": "performance_monitoring" in (features or []),
                "advanced_search": True,
                "symbol_analysis": "code_indexing" in (features or []),
                "reference_tracking": "code_indexing" in (features or []),
                "test_discovery": True,
                "audit_logging": True,
                "usage_tracking": True,
                "progress_indicators": True,
                "error_recovery": True,
                "auto_cleanup": True
            },
            "logging": {
                "level": "INFO",
                "file_path": str(self.config_dir / "mcp_server.log"),
                "max_file_size_mb": 10,
                "backup_count": 5,
                "format_string": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "include_performance_metrics": True,
                "include_usage_statistics": True,
                "log_rotation": True,
                "debug_mode": False
            },
            "security": {
                "mode": "moderate",
                "scan_file_extensions": [".py", ".js", ".ts", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".php", ".rb", ".go", ".rs"],
                "scan_max_file_size_mb": 5,
                "scan_timeout_seconds": 30,
                "audit_sensitive_operations": True,
                "block_system_directories": True,
                "require_authentication": False,
                "api_rate_limit": 100
            },
            "indexing": {
                "auto_index_on_startup": True,
                "index_file_extensions": [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".scala", ".clj"],
                "skip_binary_files": True,
                "skip_large_files": True,
                "large_file_threshold_mb": 1,
                "index_comments": True,
                "index_strings": False,
                "max_symbols_per_file": 1000,
                "index_depth_limit": 10
            },
            "monitoring": {
                "enabled": True,
                "watch_subdirectories": True,
                "debounce_seconds": 0.5,
                "max_watched_directories": 50,
                "ignore_patterns": ["*.tmp", "*.temp", "*.log", "*.cache", "*.pyc", "__pycache__", ".git", "node_modules", ".vscode", ".idea"],
                "health_check_interval": 30,
                "performance_report_interval": 300
            },
            "installation_info": {
                "installed_at": datetime.now().isoformat(),
                "system_info": self.system_info,
                "features_installed": features or [],
                "installer_version": "2.1.0"
            }
        }
        
        return config
    
    def create_startup_scripts(self) -> bool:
        """Create startup scripts for different platforms"""
        logger.info("Creating startup scripts...")
        
        try:
            # Create startup script for current platform
            if self.system_info["platform"] == "Windows":
                self._create_windows_startup_script()
            else:
                self._create_unix_startup_script()
            
            # Create systemd service file for Linux
            if self.system_info["platform"] == "Linux":
                self._create_systemd_service()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create startup scripts: {e}")
            return False
    
    def _create_windows_startup_script(self):
        """Create Windows startup script"""
        script_content = f'''@echo off
REM Enhanced MCP Server Startup Script
echo Starting Enhanced MCP Server...

cd /d "{self.install_dir}"
"{sys.executable}" official_mcp_server.py --config "{self.config_dir}\\enhanced_config.json"

pause
'''
        
        script_file = self.install_dir / "start_mcp_server.bat"
        with open(script_file, 'w') as f:
            f.write(script_content)
        
        logger.info(f"✓ Created Windows startup script: {script_file}")
    
    def _create_unix_startup_script(self):
        """Create Unix startup script"""
        script_content = f'''#!/bin/bash
# Enhanced MCP Server Startup Script

echo "Starting Enhanced MCP Server..."

cd "{self.install_dir}"
"{sys.executable}" official_mcp_server.py --config "{self.config_dir}/enhanced_config.json"
'''
        
        script_file = self.install_dir / "start_mcp_server.sh"
        with open(script_file, 'w') as f:
            f.write(script_content)
        
        # Make executable
        os.chmod(script_file, 0o755)
        
        logger.info(f"✓ Created Unix startup script: {script_file}")
    
    def _create_systemd_service(self):
        """Create systemd service file for Linux"""
        service_content = f'''[Unit]
Description=Enhanced MCP Server
After=network.target

[Service]
Type=simple
User={os.getenv('USER', 'mcp')}
WorkingDirectory={self.install_dir}
ExecStart={sys.executable} official_mcp_server.py --config {self.config_dir}/enhanced_config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
'''
        
        service_file = self.install_dir / "mcp-server.service"
        with open(service_file, 'w') as f:
            f.write(service_content)
        
        logger.info(f"✓ Created systemd service file: {service_file}")
        logger.info("To install the service, run: sudo cp mcp-server.service /etc/systemd/system/")
        logger.info("Then: sudo systemctl enable mcp-server && sudo systemctl start mcp-server")
    
    def run_post_install_tests(self) -> bool:
        """Run post-installation tests"""
        logger.info("Running post-installation tests...")
        
        try:
            # Test configuration loading
            from enhanced_config_system import EnhancedConfigManager
            config_manager = EnhancedConfigManager()
            if not config_manager.config:
                logger.error("Configuration loading test failed")
                return False
            
            # Test enhanced features
            from enhanced_error_handling import progress_tracker, error_handler
            from comprehensive_logging import usage_tracker
            
            # Test startup system
            from optimized_startup import startup_manager
            
            logger.info("✓ All post-installation tests passed")
            return True
            
        except Exception as e:
            logger.error(f"Post-installation tests failed: {e}")
            return False
    
    def install(self, features: List[str] = None, skip_tests: bool = False) -> bool:
        """Perform complete installation"""
        logger.info("Starting Enhanced MCP Server installation...")
        
        # Check prerequisites
        prerequisites = self.check_prerequisites()
        if not all(prerequisites.values()):
            logger.error("Prerequisites check failed. Please resolve the issues above.")
            return False
        
        # Detect features
        available_features = self.detect_features()
        if features:
            # Filter features to only include available ones
            features = [f for f in features if available_features.get(f, False)]
        else:
            # Use all available features
            features = [f for f, available in available_features.items() if available]
        
        logger.info(f"Installing with features: {features}")
        
        # Install dependencies
        if not self.install_dependencies(features):
            logger.error("Dependency installation failed")
            return False
        
        # Setup configuration
        if not self.setup_configuration(features):
            logger.error("Configuration setup failed")
            return False
        
        # Create startup scripts
        if not self.create_startup_scripts():
            logger.error("Startup script creation failed")
            return False
        
        # Run tests
        if not skip_tests:
            if not self.run_post_install_tests():
                logger.error("Post-installation tests failed")
                return False
        
        logger.info("✓ Enhanced MCP Server installation completed successfully!")
        logger.info(f"Configuration file: {self.config_dir / 'enhanced_config.json'}")
        logger.info("Start the server with: python official_mcp_server.py")
        
        return True

def main():
    """Main installation function"""
    parser = argparse.ArgumentParser(description="Install Enhanced MCP Server")
    parser.add_argument("--features", nargs="+", help="Features to install")
    parser.add_argument("--skip-tests", action="store_true", help="Skip post-installation tests")
    parser.add_argument("--list-features", action="store_true", help="List available features")
    
    args = parser.parse_args()
    
    installer = EnhancedMCPInstaller()
    
    if args.list_features:
        features = installer.detect_features()
        print("Available features:")
        for feature, available in features.items():
            status = "✓" if available else "✗"
            print(f"  {status} {feature}")
        return
    
    success = installer.install(args.features, args.skip_tests)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
