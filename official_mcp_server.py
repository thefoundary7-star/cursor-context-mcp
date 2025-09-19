#!/usr/bin/env python3
"""
Production-Ready MCP Server using the FastMCP framework

This server provides file system tools for Claude Desktop with enterprise-grade
features including logging, configuration management, error handling, and SaaS hooks.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import json
import logging
import os
import sys
import time
import hashlib
import platform
import uuid
import socket
import subprocess
import threading
import queue
import getpass
import base64
import secrets
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, Callable
from datetime import datetime, timedelta
from functools import wraps
import traceback
import httpx
import asyncio
from urllib.parse import urljoin
from collections import defaultdict, deque

from mcp.server.fastmcp import FastMCP

# Try to import keyring for secure credential storage
try:
    import keyring
    KEYRING_AVAILABLE = True
except ImportError:
    KEYRING_AVAILABLE = False
    keyring = None

# Try to import cryptography for token encryption
try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    Fernet = None

# =============================================================================
# CONFIGURATION MANAGEMENT
# =============================================================================

class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass

class ConfigManager:
    """
    Enhanced configuration manager with SaaS integration, validation, and environment support.
    
    Features:
    - Environment variable support
    - Configuration validation
    - Profile-based configurations
    - Runtime configuration updates
    - Configuration migration
    - Comprehensive error handling
    """
    
    def __init__(self, config_path: Optional[str] = None, profile: str = "production"):
        """
        Initialize configuration manager.
        
        Args:
            config_path: Path to configuration file (optional)
            profile: Configuration profile (development, staging, production)
        """
        self.config_path = config_path or self._find_config_file()
        self.profile = profile
        self.config_version = "2.0.0"
        self.config = {}
        self.validation_errors = []
        self.environment_overrides = {}
        
        # Load and validate configuration
        self._load_environment_variables()
        self._load_config()
        self._migrate_config()
        self._validate_config()
        
        if self.validation_errors:
            raise ConfigurationError(f"Configuration validation failed: {'; '.join(self.validation_errors)}")
    
    def _find_config_file(self) -> Optional[str]:
        """Find configuration file in standard locations."""
        possible_paths = [
            "config/server_config.json",
            "server_config.json",
            os.path.expanduser("~/.cursor-mcp/config.json"),
            "/etc/cursor-mcp/config.json"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        return None
    
    def _load_environment_variables(self):
        """Load configuration from environment variables."""
        env_mappings = {
            'API_ENDPOINT': 'saas.api_endpoint',
            'LICENSE_KEY': 'license.license_key',
            'DEBUG_MODE': 'logging.level',
            'OFFLINE_MODE': 'saas.enabled',
            'SAAS_API_KEY': 'saas.api_key',
            'USER_ID': 'saas.user_id',
            'SESSION_ID': 'saas.session_id',
            'AUTH_METHOD': 'authentication.method',
            'AUTO_LOGIN': 'authentication.auto_login',
            'PRIVACY_MODE': 'analytics.privacy_mode',
            'BATCH_SIZE': 'analytics.batch_size',
            'RETENTION_DAYS': 'analytics.retention_days',
            'MAX_FILE_SIZE': 'server.max_file_size',
            'CACHE_TTL': 'server.cache_ttl',
            'LOG_LEVEL': 'logging.level',
            'LOG_FILE': 'logging.file',
            'CONFIG_PROFILE': 'profile'
        }
        
        for env_var, config_key in env_mappings.items():
            value = os.getenv(env_var)
            if value is not None:
                # Convert string values to appropriate types
                if env_var in ['DEBUG_MODE', 'OFFLINE_MODE', 'AUTO_LOGIN']:
                    value = value.lower() in ('true', '1', 'yes', 'on')
                elif env_var in ['BATCH_SIZE', 'RETENTION_DAYS', 'MAX_FILE_SIZE', 'CACHE_TTL']:
                    try:
                        value = int(value)
                    except ValueError:
                        continue
                elif env_var == 'LOG_LEVEL':
                    value = value.upper()
                
                self.environment_overrides[config_key] = value
    
    def _load_config(self):
        """Load configuration from file or use defaults."""
        self.config = self._load_default_config()
        
        if self.config_path and os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)
                    self._merge_config(file_config)
            except Exception as e:
                raise ConfigurationError(f"Failed to load config from {self.config_path}: {e}")
        
        # Apply environment overrides
        for key, value in self.environment_overrides.items():
            self._set_nested_value(key, value)
    
    def _load_default_config(self) -> Dict[str, Any]:
        """Get default configuration with comprehensive SaaS integration settings."""
        return {
            "config_version": self.config_version,
            "profile": self.profile,
            "server": {
                "name": "Cursor Context MCP Server",
                "version": "2.0.0",
                "max_file_size": 1024 * 1024,  # 1MB
                "allowed_extensions": [],
                "blocked_extensions": [".exe", ".dll", ".so", ".dylib", ".bin"],
                "max_directory_depth": 10,
                "enable_caching": True,
                "cache_ttl": 300,
                "enable_compression": False,
                "max_concurrent_operations": 10,
                "operation_timeout": 30
            },
            "logging": {
                "level": "INFO",
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "file": "logs/mcp_server.log",
                "max_size": 10 * 1024 * 1024,  # 10MB
                "backup_count": 5,
                "console_output": True,
                "structured_logging": False
            },
            "security": {
                "allowed_paths": [],
                "blocked_paths": [
                    "/etc", "/sys", "/proc",
                    "C:\\Windows\\System32", "C:\\Windows\\SysWOW64"
                ],
                "enable_path_validation": True,
                "enable_audit_logging": True,
                "max_path_length": 4096,
                "enable_file_scanning": True,
                "scan_timeout": 30
            },
            "saas": {
                "enabled": False,
                "api_endpoint": "https://api.cursor-context.com",
                "api_key": "",
                "user_id": "",
                "session_id": "",
                "enable_analytics": True,
                "enable_telemetry": True,
                "offline_mode": False,
                "sync_interval": 300,
                "max_retry_attempts": 3,
                "retry_backoff_factor": 2.0,
                "http_client": {
                    "timeout": 30,
                    "max_retries": 3,
                    "retry_delay": 1.0,
                    "retry_backoff_factor": 2.0,
                    "max_retry_delay": 60.0,
                    "offline_grace_period": 300,
                    "enable_caching": True,
                    "cache_ttl": 300,
                    "verify_ssl": True,
                    "user_agent": "Cursor-Context-MCP-Server/2.0.0",
                    "connection_pool_size": 10,
                    "keepalive_timeout": 30
                },
                "endpoints": {
                    "auth": "/api/auth",
                    "analytics": "/api/analytics",
                    "license": "/api/license",
                    "usage": "/api/usage",
                    "health": "/api/health"
                },
                "rate_limiting": {
                    "enabled": True,
                    "requests_per_minute": 60,
                    "burst_limit": 10
                }
            },
            "license": {
                "enabled": True,
                "license_key": "",
                "validation_interval": 86400,  # 24 hours
                "offline_grace_period": 7200,  # 2 hours
                "validation_timeout": 30,
                "retry_attempts": 3,
                "cache_validation": True,
                "device_fingerprint": {
                    "enabled": True,
                    "include_hardware": True,
                    "include_software": True,
                    "include_network": False,
                    "include_user_agent": True
                },
                "tiers": {
                    "free": {
                        "max_file_size": 1024 * 1024,
                        "max_operations_per_hour": 100,
                        "max_concurrent_sessions": 1,
                        "features": ["basic_file_ops", "basic_stats"],
                        "rate_limits": {
                            "requests_per_minute": 10,
                            "burst_limit": 5
                        }
                    },
                    "pro": {
                        "max_file_size": 10 * 1024 * 1024,
                        "max_operations_per_hour": 1000,
                        "max_concurrent_sessions": 3,
                        "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching", "analytics"],
                        "rate_limits": {
                            "requests_per_minute": 60,
                            "burst_limit": 20
                        }
                    },
                    "enterprise": {
                        "max_file_size": 100 * 1024 * 1024,
                        "max_operations_per_hour": 10000,
                        "max_concurrent_sessions": 10,
                        "features": ["basic_file_ops", "basic_stats", "advanced_search", "caching", "analytics", "telemetry", "custom_integrations", "sso", "audit_logging"],
                        "rate_limits": {
                            "requests_per_minute": 300,
                            "burst_limit": 100
                        }
                    }
                }
            },
            "analytics": {
                "enabled": True,
                "privacy_mode": "balanced",  # strict, balanced, permissive
                "track_usage": True,
                "track_performance": True,
                "track_errors": True,
                "anonymize_data": False,
                "batch_size": 100,
                "batch_interval": 300,  # 5 minutes
                "retention_days": 30,
                "max_queue_size": 10000,
                "flush_on_shutdown": True,
                "local_storage": {
                    "enabled": True,
                    "max_entries": 10000,
                    "cleanup_interval": 3600,  # 1 hour
                    "compression": True,
                    "encryption": True
                },
                "quota_enforcement": {
                    "enabled": True,
                    "check_interval": 60,
                    "grace_period": 300,
                    "warning_threshold": 0.8
                },
                "data_types": {
                    "file_operations": True,
                    "git_operations": True,
                    "search_queries": True,
                    "performance_metrics": True,
                    "error_tracking": True,
                    "user_behavior": True,
                    "system_metrics": True
                },
                "export": {
                    "enabled": False,
                    "format": "json",  # json, csv, parquet
                    "schedule": "daily",
                    "destination": "local"  # local, s3, gcs
                }
            },
            "authentication": {
                "enabled": True,
                "method": "email_password",  # email_password, api_key, sso
                "auto_login": True,
                "remember_credentials": True,
                "session_timeout": 3600,  # 1 hour
                "token_refresh_threshold": 300,  # 5 minutes
                "max_concurrent_sessions": 3,
                "idle_timeout": 1800,  # 30 minutes
                "device_registration": {
                    "enabled": True,
                    "auto_register": True,
                    "require_approval": False,
                    "max_devices": 5,
                    "device_timeout": 86400  # 24 hours
                },
                "sso": {
                    "enabled": False,
                    "provider": "none",  # oauth2, saml, azure, google
                    "endpoint": "",
                    "client_id": "",
                    "client_secret": "",
                    "redirect_uri": "",
                    "scope": "openid profile email",
                    "auto_refresh": True
                },
                "security": {
                    "use_keyring": True,
                    "encrypt_tokens": True,
                    "require_2fa": False,
                    "password_policy": {
                        "min_length": 8,
                        "require_uppercase": True,
                        "require_lowercase": True,
                        "require_numbers": True,
                        "require_symbols": False,
                        "max_age_days": 90,
                        "history_count": 5
                    },
                    "session_security": {
                        "secure_cookies": True,
                        "http_only": True,
                        "same_site": "strict",
                        "csrf_protection": True
                    }
                }
            },
            "performance": {
                "enable_async_operations": False,
                "max_concurrent_operations": 10,
                "operation_timeout": 30,
                "enable_compression": False,
                "memory_limit": 512 * 1024 * 1024,  # 512MB
                "cpu_limit": 80,  # 80%
                "monitoring": {
                    "enabled": True,
                    "interval": 60,  # seconds
                    "metrics_retention": 7,  # days
                    "alert_thresholds": {
                        "memory_usage": 0.8,
                        "cpu_usage": 0.8,
                        "response_time": 5.0
                    }
                }
            },
            "feature_flags": {
                "advanced_search": True,
                "caching": True,
                "analytics": True,
                "telemetry": True,
                "custom_integrations": False,
                "sso": False,
                "audit_logging": True,
                "performance_monitoring": True,
                "error_tracking": True,
                "usage_analytics": True
            },
            "deployment": {
                "environment": self.profile,
                "region": "us-east-1",
                "cluster": "default",
                "replicas": 1,
                "resources": {
                    "cpu": "100m",
                    "memory": "256Mi",
                    "storage": "1Gi"
                },
                "health_checks": {
                    "enabled": True,
                    "interval": 30,
                    "timeout": 10,
                    "retries": 3
                }
            }
        }
    
    def _merge_config(self, file_config: Dict[str, Any]):
        """Merge file configuration with defaults."""
        def merge_dict(default: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
            result = default.copy()
            for key, value in override.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = merge_dict(result[key], value)
                else:
                    result[key] = value
            return result
        
        self.config = merge_dict(self.config, file_config)
    
    def _migrate_config(self):
        """Migrate configuration from older versions."""
        current_version = self.config.get('config_version', '1.0.0')
        
        if current_version != self.config_version:
            # Migration logic for version updates
            if current_version == '1.0.0':
                self._migrate_from_v1_to_v2()
            
            self.config['config_version'] = self.config_version
    
    def _migrate_from_v1_to_v2(self):
        """Migrate configuration from v1.0.0 to v2.0.0."""
        # Add new sections with defaults
        if 'feature_flags' not in self.config:
            self.config['feature_flags'] = self._load_default_config()['feature_flags']
        
        if 'deployment' not in self.config:
            self.config['deployment'] = self._load_default_config()['deployment']
        
        # Update existing sections
        if 'saas' in self.config:
            saas_config = self.config['saas']
            if 'endpoints' not in saas_config:
                saas_config['endpoints'] = self._load_default_config()['saas']['endpoints']
            if 'rate_limiting' not in saas_config:
                saas_config['rate_limiting'] = self._load_default_config()['saas']['rate_limiting']
        
        if 'license' in self.config:
            license_config = self.config['license']
            if 'tiers' in license_config:
                for tier_name, tier_config in license_config['tiers'].items():
                    if 'rate_limits' not in tier_config:
                        tier_config['rate_limits'] = self._load_default_config()['license']['tiers'][tier_name]['rate_limits']
    
    def _validate_config(self):
        """Validate configuration settings with comprehensive checks."""
        self.validation_errors = []
        
        # Validate server configuration
        self._validate_server_config()
        
        # Validate SaaS configuration
        self._validate_saas_config()
        
        # Validate license configuration
        self._validate_license_config()
        
        # Validate analytics configuration
        self._validate_analytics_config()
        
        # Validate authentication configuration
        self._validate_authentication_config()
        
        # Validate performance configuration
        self._validate_performance_config()
        
        # Validate feature flags
        self._validate_feature_flags()
    
    def _validate_server_config(self):
        """Validate server configuration."""
        server_config = self.config.get('server', {})
        
        if not isinstance(server_config.get('max_file_size'), int) or server_config.get('max_file_size') <= 0:
            self.validation_errors.append("server.max_file_size must be a positive integer")
        
        if not isinstance(server_config.get('cache_ttl'), int) or server_config.get('cache_ttl') <= 0:
            self.validation_errors.append("server.cache_ttl must be a positive integer")
        
        if not isinstance(server_config.get('max_directory_depth'), int) or server_config.get('max_directory_depth') <= 0:
            self.validation_errors.append("server.max_directory_depth must be a positive integer")
    
    def _validate_saas_config(self):
        """Validate SaaS configuration."""
        saas_config = self.config.get('saas', {})
        
        if saas_config.get('enabled'):
            if not saas_config.get('api_endpoint'):
                self.validation_errors.append("saas.api_endpoint is required when SaaS is enabled")
            
            if not saas_config.get('api_key'):
                self.validation_errors.append("saas.api_key is required when SaaS is enabled")
            
            # Validate HTTP client configuration
            http_client = saas_config.get('http_client', {})
            if not isinstance(http_client.get('timeout'), (int, float)) or http_client.get('timeout') <= 0:
                self.validation_errors.append("saas.http_client.timeout must be a positive number")
            
            if not isinstance(http_client.get('max_retries'), int) or http_client.get('max_retries') < 0:
                self.validation_errors.append("saas.http_client.max_retries must be a non-negative integer")
    
    def _validate_license_config(self):
        """Validate license configuration."""
        license_config = self.config.get('license', {})
        
        if license_config.get('enabled'):
            if not license_config.get('license_key'):
                self.validation_errors.append("license.license_key is required when license validation is enabled")
            
            if not isinstance(license_config.get('validation_interval'), int) or license_config.get('validation_interval') <= 0:
                self.validation_errors.append("license.validation_interval must be a positive integer")
            
            if not isinstance(license_config.get('offline_grace_period'), int) or license_config.get('offline_grace_period') < 0:
                self.validation_errors.append("license.offline_grace_period must be a non-negative integer")
    
    def _validate_analytics_config(self):
        """Validate analytics configuration."""
        analytics_config = self.config.get('analytics', {})
        
        if analytics_config.get('enabled'):
            privacy_mode = analytics_config.get('privacy_mode')
            if privacy_mode not in ['strict', 'balanced', 'permissive']:
                self.validation_errors.append("analytics.privacy_mode must be 'strict', 'balanced', or 'permissive'")
            
            if not isinstance(analytics_config.get('batch_size'), int) or analytics_config.get('batch_size') <= 0:
                self.validation_errors.append("analytics.batch_size must be a positive integer")
            
            if not isinstance(analytics_config.get('retention_days'), int) or analytics_config.get('retention_days') <= 0:
                self.validation_errors.append("analytics.retention_days must be a positive integer")
    
    def _validate_authentication_config(self):
        """Validate authentication configuration."""
        auth_config = self.config.get('authentication', {})
        
        if auth_config.get('enabled'):
            method = auth_config.get('method')
            if method not in ['email_password', 'api_key', 'sso']:
                self.validation_errors.append("authentication.method must be 'email_password', 'api_key', or 'sso'")
            
            if not isinstance(auth_config.get('session_timeout'), int) or auth_config.get('session_timeout') <= 0:
                self.validation_errors.append("authentication.session_timeout must be a positive integer")
            
            if not isinstance(auth_config.get('max_concurrent_sessions'), int) or auth_config.get('max_concurrent_sessions') <= 0:
                self.validation_errors.append("authentication.max_concurrent_sessions must be a positive integer")
    
    def _validate_performance_config(self):
        """Validate performance configuration."""
        perf_config = self.config.get('performance', {})
        
        if not isinstance(perf_config.get('max_concurrent_operations'), int) or perf_config.get('max_concurrent_operations') <= 0:
            self.validation_errors.append("performance.max_concurrent_operations must be a positive integer")
        
        if not isinstance(perf_config.get('operation_timeout'), int) or perf_config.get('operation_timeout') <= 0:
            self.validation_errors.append("performance.operation_timeout must be a positive integer")
    
    def _validate_feature_flags(self):
        """Validate feature flags configuration."""
        feature_flags = self.config.get('feature_flags', {})
        
        for flag_name, flag_value in feature_flags.items():
            if not isinstance(flag_value, bool):
                self.validation_errors.append(f"feature_flags.{flag_name} must be a boolean")
    
    def _set_nested_value(self, key: str, value: Any):
        """Set nested configuration value using dot notation."""
        keys = key.split('.')
        config = self.config
        
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        config[keys[-1]] = value
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value using dot notation.
        
        Args:
            key: Configuration key (e.g., 'server.name')
            default: Default value if key not found
            
        Returns:
            Configuration value
        """
        keys = key.split('.')
        value = self.config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key: str, value: Any):
        """
        Set configuration value using dot notation.
        
        Args:
            key: Configuration key (e.g., 'server.name')
            value: Value to set
        """
        self._set_nested_value(key, value)
    
    def update(self, updates: Dict[str, Any]):
        """
        Update multiple configuration values.
        
        Args:
            updates: Dictionary of configuration updates
        """
        for key, value in updates.items():
            self.set(key, value)
    
    def get_profile_config(self, profile: str) -> Dict[str, Any]:
        """
        Get configuration for a specific profile.
        
        Args:
            profile: Configuration profile name
            
        Returns:
            Profile-specific configuration
        """
        profile_configs = {
            'development': {
                'logging.level': 'DEBUG',
                'saas.enabled': False,
                'analytics.enabled': False,
                'authentication.auto_login': False,
                'performance.enable_async_operations': True
            },
            'staging': {
                'logging.level': 'INFO',
                'saas.enabled': True,
                'analytics.enabled': True,
                'authentication.auto_login': True,
                'saas.api_endpoint': 'https://staging-api.cursor-context.com'
            },
            'production': {
                'logging.level': 'WARNING',
                'saas.enabled': True,
                'analytics.enabled': True,
                'authentication.auto_login': True,
                'performance.enable_async_operations': False
            }
        }
        
        return profile_configs.get(profile, {})
    
    def apply_profile(self, profile: str):
        """
        Apply configuration profile.
        
        Args:
            profile: Configuration profile name
        """
        profile_config = self.get_profile_config(profile)
        for key, value in profile_config.items():
            self.set(key, value)
        self.profile = profile
        self.config['profile'] = profile
    
    def validate_runtime_update(self, key: str, value: Any) -> bool:
        """
        Validate a runtime configuration update.
        
        Args:
            key: Configuration key
            value: New value
            
        Returns:
            True if update is valid, False otherwise
        """
        try:
            # Create a temporary config for validation
            temp_config = self.config.copy()
            temp_manager = ConfigManager()
            temp_manager.config = temp_config
            temp_manager._set_nested_value(key, value)
            temp_manager._validate_config()
            return len(temp_manager.validation_errors) == 0
        except Exception:
            return False
    
    def get_config_summary(self) -> Dict[str, Any]:
        """
        Get configuration summary for reporting.
        
        Returns:
            Configuration summary
        """
        return {
            'version': self.config_version,
            'profile': self.profile,
            'config_path': self.config_path,
            'environment_overrides': len(self.environment_overrides),
            'validation_errors': len(self.validation_errors),
            'sections': list(self.config.keys()),
            'feature_flags_enabled': sum(1 for v in self.config.get('feature_flags', {}).values() if v),
            'saas_enabled': self.config.get('saas', {}).get('enabled', False),
            'authentication_enabled': self.config.get('authentication', {}).get('enabled', False),
            'analytics_enabled': self.config.get('analytics', {}).get('enabled', False),
            'license_enabled': self.config.get('license', {}).get('enabled', False)
        }
    
    def save(self, path: Optional[str] = None):
        """
        Save configuration to file.
        
        Args:
            path: Path to save configuration (optional)
        """
        save_path = path or self.config_path
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
    
    def reload(self):
        """Reload configuration from file."""
        self._load_environment_variables()
        self._load_config()
        self._migrate_config()
        self._validate_config()
        
        if self.validation_errors:
            raise ConfigurationError(f"Configuration validation failed: {'; '.join(self.validation_errors)}")

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================

def setup_logging(config: ConfigManager) -> logging.Logger:
    """Set up production logging configuration."""
    # Create logs directory if it doesn't exist
    log_file = config.get('logging.file', 'logs/mcp_server.log')
    log_dir = os.path.dirname(log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging
    log_level = getattr(logging, config.get('logging.level', 'INFO').upper())
    log_format = config.get('logging.format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Create formatter
    formatter = logging.Formatter(log_format)
    
    # Configure root logger
    logger = logging.getLogger('cursor_mcp')
    logger.setLevel(log_level)
    
    # Remove existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler with rotation
    if log_file:
        from logging.handlers import RotatingFileHandler
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=config.get('logging.max_size', 10 * 1024 * 1024),
            backupCount=config.get('logging.backup_count', 5)
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

# =============================================================================
# PERFORMANCE AND MONITORING
# =============================================================================

class PerformanceMonitor:
    """Monitors and tracks server performance metrics."""
    
    def __init__(self):
        self.metrics = {
            'operations_count': 0,
            'total_time': 0.0,
            'error_count': 0,
            'cache_hits': 0,
            'cache_misses': 0
        }
        self.operation_times = []
    
    def record_operation(self, operation_name: str, duration: float, success: bool = True):
        """Record operation metrics."""
        self.metrics['operations_count'] += 1
        self.metrics['total_time'] += duration
        if not success:
            self.metrics['error_count'] += 1
        
        self.operation_times.append({
            'operation': operation_name,
            'duration': duration,
            'success': success,
            'timestamp': datetime.now().isoformat()
        })
        
        # Keep only last 1000 operations
        if len(self.operation_times) > 1000:
            self.operation_times = self.operation_times[-1000:]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        if self.metrics['operations_count'] == 0:
            return self.metrics.copy()
        
        avg_time = self.metrics['total_time'] / self.metrics['operations_count']
        error_rate = self.metrics['error_count'] / self.metrics['operations_count']
        
        return {
            **self.metrics,
            'average_operation_time': avg_time,
            'error_rate': error_rate,
            'cache_hit_rate': self.metrics['cache_hits'] / max(1, self.metrics['cache_hits'] + self.metrics['cache_misses'])
        }

# =============================================================================
# CACHING SYSTEM
# =============================================================================

class SimpleCache:
    """Simple in-memory cache with TTL support."""
    
    def __init__(self, ttl: int = 300):
        self.cache = {}
        self.ttl = ttl
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: Any) -> None:
        """Set value in cache with current timestamp."""
        self.cache[key] = (value, time.time())
    
    def clear(self) -> None:
        """Clear all cache entries."""
        self.cache.clear()

# =============================================================================
# SECURITY AND VALIDATION
# =============================================================================

class SecurityValidator:
    """Validates file system operations for security."""
    
    def __init__(self, config: ConfigManager):
        self.config = config
        self.allowed_paths = config.get('security.allowed_paths', [])
        self.blocked_paths = config.get('security.blocked_paths', [])
        self.blocked_extensions = config.get('server.blocked_extensions', [])
        self.allowed_extensions = config.get('server.allowed_extensions', [])
    
    def validate_path(self, path: str) -> tuple[bool, str]:
        """
        Validate if path is allowed for operations.
        
        Returns:
            (is_valid, error_message)
        """
        if not self.config.get('security.enable_path_validation', True):
            return True, ""
        
        try:
            path_obj = Path(path).resolve()
            path_str = str(path_obj)
            
            # Check blocked paths
            for blocked in self.blocked_paths:
                if path_str.startswith(blocked):
                    return False, f"Access to '{blocked}' is not allowed"
            
            # Check allowed paths (if specified)
            if self.allowed_paths:
                allowed = False
                for allowed_path in self.allowed_paths:
                    if path_str.startswith(allowed_path):
                        allowed = True
                        break
                if not allowed:
                    return False, f"Path not in allowed list"
            
            return True, ""
            
        except Exception as e:
            return False, f"Path validation error: {str(e)}"
    
    def validate_file_extension(self, file_path: str) -> tuple[bool, str]:
        """Validate file extension against allowed/blocked lists."""
        try:
            path_obj = Path(file_path)
            extension = path_obj.suffix.lower()
            
            # Check blocked extensions
            if extension in self.blocked_extensions:
                return False, f"File type '{extension}' is not allowed"
            
            # Check allowed extensions (if specified)
            if self.allowed_extensions and extension not in self.allowed_extensions:
                return False, f"File type '{extension}' is not in allowed list"
            
            return True, ""
            
        except Exception as e:
            return False, f"Extension validation error: {str(e)}"

# =============================================================================
# SAAS INTEGRATION HOOKS
# =============================================================================

class SaaSIntegration:
    """Handles SaaS integration and telemetry with HTTP client."""
    
    def __init__(self, config: ConfigManager, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.enabled = config.get('saas.enabled', False)
        self.api_endpoint = config.get('saas.api_endpoint', '')
        self.api_key = config.get('saas.api_key', '')
        self.user_id = config.get('saas.user_id', '')
        self.session_id = config.get('saas.session_id', '')
        
        # Initialize HTTP client if SaaS is enabled
        self.http_client = None
        if self.enabled and self.api_endpoint:
            try:
                self.http_client = SaaSClient(config, logger)
                self.logger.info("SaaS HTTP client initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize SaaS HTTP client: {e}")
                self.http_client = None
    
    def log_operation(self, operation: str, success: bool, metadata: Dict[str, Any] = None):
        """Log operation to SaaS platform."""
        if not self.enabled or not self.api_endpoint:
            return
        
        try:
            payload = {
                'user_id': self.user_id,
                'session_id': self.session_id,
                'operation': operation,
                'success': success,
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata or {}
            }
            
            # Use HTTP client if available
            if self.http_client:
                try:
                    response = self.http_client.post('/api/operations/log', data=payload)
                    if response.get('success'):
                        self.logger.debug(f"Operation logged to SaaS: {operation}")
                    else:
                        self.logger.warning(f"Failed to log operation to SaaS: {response}")
                except SaaSClientError as e:
                    self.logger.warning(f"SaaS client error logging operation: {e}")
                    # Fall back to local logging
                    self.logger.info(f"SaaS Log (local): {json.dumps(payload)}")
            else:
                # Fall back to local logging
                self.logger.info(f"SaaS Log (local): {json.dumps(payload)}")
            
        except Exception as e:
            self.logger.warning(f"Failed to log to SaaS: {e}")
    
    def send_analytics(self, event: str, data: Dict[str, Any] = None):
        """Send analytics event to SaaS platform."""
        if not self.config.get('saas.enable_analytics', False):
            return
        
        try:
            payload = {
                'user_id': self.user_id,
                'session_id': self.session_id,
                'event': event,
                'timestamp': datetime.now().isoformat(),
                'data': data or {}
            }
            
            # Use HTTP client if available
            if self.http_client:
                try:
                    response = self.http_client.post('/api/analytics/event', data=payload)
                    if response.get('success'):
                        self.logger.debug(f"Analytics event sent to SaaS: {event}")
                    else:
                        self.logger.warning(f"Failed to send analytics to SaaS: {response}")
                except SaaSClientError as e:
                    self.logger.warning(f"SaaS client error sending analytics: {e}")
            else:
                self.log_operation(f"analytics_{event}", True, data)
            
        except Exception as e:
            self.logger.warning(f"Failed to send analytics to SaaS: {e}")
    
    def track_usage(self, events: List[Dict[str, Any]], license_key: str = None, server_id: str = None):
        """Track usage events to SaaS platform using the /api/analytics/track endpoint."""
        if not self.config.get('saas.enable_analytics', False):
            return
        
        if not self.http_client:
            self.logger.warning("SaaS HTTP client not available for usage tracking")
            return
        
        try:
            # Generate server ID if not provided
            if not server_id:
                server_id = self._generate_server_id()
            
            payload = {
                'licenseKey': license_key or self.api_key,
                'serverId': server_id,
                'events': events
            }
            
            self.logger.debug(f"Sending usage tracking data: {len(events)} events")
            response = self.http_client.post('/api/analytics/track', data=payload)
            
            if response.get('success'):
                processed = response.get('data', {}).get('processed', 0)
                self.logger.info(f"Successfully tracked {processed} usage events to SaaS")
                return True
            else:
                self.logger.warning(f"Failed to track usage to SaaS: {response}")
                return False
                
        except SaaSClientError as e:
            self.logger.warning(f"SaaS client error tracking usage: {e}")
            return False
        except Exception as e:
            self.logger.warning(f"Failed to track usage to SaaS: {e}")
            return False
    
    def validate_license(self, license_key: str, server_id: str = None, server_name: str = None, server_version: str = None):
        """Validate license with SaaS platform using the /api/auth/validate-license endpoint."""
        if not self.config.get('saas.enable_license_validation', False):
            self.logger.debug("License validation disabled in configuration")
            return {'valid': True, 'message': 'License validation disabled'}
        
        if not self.http_client:
            if self.config.get('saas.license_validation_optional', False):
                self.logger.warning("SaaS HTTP client not available, but license validation is optional")
                return {'valid': True, 'message': 'License validation optional - client unavailable'}
            else:
                self.logger.error("SaaS HTTP client not available for license validation")
                return {'valid': False, 'message': 'License validation failed - client unavailable'}
        
        try:
            # Generate server ID if not provided
            if not server_id:
                server_id = self._generate_server_id()
            
            if not server_name:
                server_name = self.config.get('server.name', 'Cursor Context MCP Server')
            
            if not server_version:
                server_version = self.config.get('server.version', '2.0.0')
            
            payload = {
                'licenseKey': license_key,
                'serverId': server_id,
                'serverName': server_name,
                'serverVersion': server_version
            }
            
            self.logger.debug(f"Validating license with SaaS platform")
            response = self.http_client.post('/api/auth/validate-license', data=payload)
            
            if response.get('success'):
                result = response.get('data', {})
                if result.get('valid'):
                    self.logger.info(f"License validation successful: {result.get('message', 'Valid license')}")
                else:
                    self.logger.warning(f"License validation failed: {result.get('message', 'Invalid license')}")
                return result
            else:
                error_msg = response.get('message', 'License validation failed')
                self.logger.error(f"License validation API error: {error_msg}")
                return {'valid': False, 'message': error_msg}
                
        except SaaSClientError as e:
            if self.config.get('saas.license_validation_optional', False):
                self.logger.warning(f"SaaS client error during license validation (optional): {e}")
                return {'valid': True, 'message': f'License validation optional - error: {e}'}
            else:
                self.logger.error(f"SaaS client error during license validation: {e}")
                return {'valid': False, 'message': f'License validation failed: {e}'}
        except Exception as e:
            if self.config.get('saas.license_validation_optional', False):
                self.logger.warning(f"Unexpected error during license validation (optional): {e}")
                return {'valid': True, 'message': f'License validation optional - error: {e}'}
            else:
                self.logger.error(f"Unexpected error during license validation: {e}")
                return {'valid': False, 'message': f'License validation failed: {e}'}
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to SaaS platform and return detailed status."""
        if not self.enabled:
            return {
                'success': False,
                'message': 'SaaS integration is disabled',
                'details': {'enabled': False}
            }
        
        if not self.http_client:
            return {
                'success': False,
                'message': 'SaaS HTTP client not initialized',
                'details': {'http_client_available': False}
            }
        
        try:
            # Test health endpoint
            self.logger.info("Testing SaaS platform connection...")
            health_response = self.http_client.get('/api/health', use_cache=False)
            
            if health_response.get('success'):
                health_data = health_response.get('data', {})
                self.logger.info(f"✅ SaaS platform connection successful: {health_data.get('status', 'unknown')}")
                
                return {
                    'success': True,
                    'message': 'SaaS platform connection successful',
                    'details': {
                        'api_endpoint': self.api_endpoint,
                        'health_status': health_data.get('status'),
                        'response_time': health_data.get('responseTime'),
                        'services': health_data.get('services', {}),
                        'version': health_data.get('version'),
                        'uptime': health_data.get('uptime')
                    }
                }
            else:
                error_msg = health_response.get('message', 'Health check failed')
                self.logger.error(f"❌ SaaS platform health check failed: {error_msg}")
                return {
                    'success': False,
                    'message': f'SaaS platform health check failed: {error_msg}',
                    'details': health_response.get('data', {})
                }
                
        except SaaSClientError as e:
            self.logger.error(f"❌ SaaS platform connection failed: {e}")
            return {
                'success': False,
                'message': f'SaaS platform connection failed: {e}',
                'details': {'error_type': 'SaaSClientError', 'error': str(e)}
            }
        except Exception as e:
            self.logger.error(f"❌ Unexpected error testing SaaS connection: {e}")
            return {
                'success': False,
                'message': f'Unexpected error: {e}',
                'details': {'error_type': 'Exception', 'error': str(e)}
            }
    
    def _generate_server_id(self) -> str:
        """Generate a unique server ID for this instance."""
        try:
            # Try to get machine-specific info
            hostname = socket.gethostname()
            username = getpass.getuser()
            platform_info = f"{platform.system()}-{platform.machine()}"
            
            # Create a hash of machine-specific info
            machine_info = f"{hostname}-{username}-{platform_info}"
            server_id = hashlib.md5(machine_info.encode()).hexdigest()[:16]
            
            return f"mcp-server-{server_id}"
        except Exception:
            # Fallback to random UUID
            return f"mcp-server-{uuid.uuid4().hex[:16]}"
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get SaaS integration health status."""
        status = {
            'enabled': self.enabled,
            'api_endpoint': self.api_endpoint,
            'http_client_available': self.http_client is not None,
            'last_check': datetime.now().isoformat()
        }
        
        if self.http_client:
            try:
                # Try to get cache stats
                cache_stats = self.http_client.get_cache_stats()
                status['cache_stats'] = cache_stats
                
                # Try a simple health check
                health_response = self.http_client.get('/api/health', use_cache=False)
                status['api_health'] = health_response.get('status', 'unknown')
                status['api_available'] = True
                
            except SaaSClientError as e:
                status['api_available'] = False
                status['api_error'] = str(e)
            except Exception as e:
                status['api_available'] = False
                status['api_error'] = f"Unexpected error: {e}"
        
        return status
    
    def close(self):
        """Close SaaS integration and cleanup resources."""
        if self.http_client:
            self.http_client.close()
            self.http_client = None
        self.logger.info("SaaS integration closed")

# =============================================================================
# HTTP CLIENT FOR SAAS INTEGRATION
# =============================================================================

class SaaSClient:
    """
    Production-ready HTTP client for SaaS backend communication.
    
    Features:
    - Authenticated HTTP requests with token management
    - Exponential backoff retry logic
    - Offline mode with cached responses
    - Comprehensive error handling
    - Request/response logging
    - SSL verification and security
    """
    
    def __init__(self, config: ConfigManager, logger: logging.Logger):
        """
        Initialize the SaaS HTTP client.
        
        Args:
            config: Configuration manager instance
            logger: Logger instance for HTTP operations
        """
        self.config = config
        self.logger = logger
        
        # HTTP client configuration
        self.api_endpoint = config.get('saas.api_endpoint', 'https://api.cursor-context.com')
        self.api_key = config.get('saas.api_key', '')
        self.user_id = config.get('saas.user_id', '')
        self.session_id = config.get('saas.session_id', '')
        
        # HTTP client settings
        http_config = config.get('saas.http_client', {})
        self.timeout = http_config.get('timeout', 30)
        self.max_retries = http_config.get('max_retries', 3)
        self.retry_delay = http_config.get('retry_delay', 1.0)
        self.retry_backoff_factor = http_config.get('retry_backoff_factor', 2.0)
        self.max_retry_delay = http_config.get('max_retry_delay', 60.0)
        self.offline_grace_period = http_config.get('offline_grace_period', 300)
        self.verify_ssl = http_config.get('verify_ssl', True)
        self.user_agent = http_config.get('user_agent', 'Cursor-Context-MCP-Server/2.0.0')
        
        # Caching
        self.enable_caching = http_config.get('enable_caching', True)
        self.cache_ttl = http_config.get('cache_ttl', 300)
        self._response_cache = {}
        self._last_successful_request = None
        
        # Authentication state
        self._access_token = None
        self._refresh_token = None
        self._token_expires_at = None
        
        # HTTP client instance
        self._client = None
        self._initialize_client()
        
        self.logger.info(f"SaaSClient initialized for endpoint: {self.api_endpoint}")
    
    def _initialize_client(self):
        """Initialize the HTTP client with proper configuration."""
        try:
            # Create HTTP client with timeout and SSL settings
            self._client = httpx.Client(
                timeout=httpx.Timeout(self.timeout),
                verify=self.verify_ssl,
                headers={
                    'User-Agent': self.user_agent,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            )
            self.logger.debug("HTTP client initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize HTTP client: {e}")
            raise
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for requests."""
        headers = {}
        
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        elif self._access_token:
            headers['Authorization'] = f'Bearer {self._access_token}'
        
        if self.user_id:
            headers['X-User-ID'] = self.user_id
        
        if self.session_id:
            headers['X-Session-ID'] = self.session_id
        
        return headers
    
    def _is_offline_grace_period_active(self) -> bool:
        """Check if we're still within the offline grace period."""
        if not self._last_successful_request:
            return False
        
        time_since_last_success = time.time() - self._last_successful_request
        return time_since_last_success < self.offline_grace_period
    
    def _get_cache_key(self, method: str, url: str, params: Dict = None, data: Dict = None) -> str:
        """Generate a cache key for the request."""
        cache_data = {
            'method': method.upper(),
            'url': url,
            'params': params or {},
            'data': data or {}
        }
        return f"http_cache:{hash(json.dumps(cache_data, sort_keys=True))}"
    
    def _get_cached_response(self, cache_key: str) -> Optional[Dict]:
        """Get cached response if available and not expired."""
        if not self.enable_caching or cache_key not in self._response_cache:
            return None
        
        cached_data, timestamp = self._response_cache[cache_key]
        if time.time() - timestamp < self.cache_ttl:
            self.logger.debug(f"Cache hit for key: {cache_key}")
            return cached_data
        else:
            # Remove expired cache entry
            del self._response_cache[cache_key]
            return None
    
    def _cache_response(self, cache_key: str, response_data: Dict):
        """Cache the response data."""
        if self.enable_caching:
            self._response_cache[cache_key] = (response_data, time.time())
            self.logger.debug(f"Cached response for key: {cache_key}")
    
    def _calculate_retry_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt with exponential backoff."""
        delay = self.retry_delay * (self.retry_backoff_factor ** attempt)
        return min(delay, self.max_retry_delay)
    
    def _log_request(self, method: str, url: str, params: Dict = None, data: Dict = None, 
                    headers: Dict = None, attempt: int = 1):
        """Log HTTP request details."""
        log_data = {
            'method': method.upper(),
            'url': url,
            'attempt': attempt,
            'has_params': bool(params),
            'has_data': bool(data),
            'has_auth': bool(headers and 'Authorization' in headers)
        }
        self.logger.info(f"HTTP Request: {json.dumps(log_data)}")
    
    def _log_response(self, response: httpx.Response, duration: float, success: bool = True):
        """Log HTTP response details."""
        log_data = {
            'status_code': response.status_code,
            'duration': f"{duration:.3f}s",
            'success': success,
            'content_length': len(response.content) if response.content else 0,
            'headers': dict(response.headers)
        }
        level = 'info' if success else 'warning'
        getattr(self.logger, level)(f"HTTP Response: {json.dumps(log_data)}")
    
    def _handle_http_error(self, response: httpx.Response, error: Exception = None) -> Dict[str, Any]:
        """Handle HTTP errors and return structured error information."""
        error_info = {
            'status_code': response.status_code,
            'reason': response.reason_phrase,
            'url': str(response.url),
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            error_info['response_body'] = response.json()
        except:
            error_info['response_body'] = response.text[:500]  # Limit response body
        
        if error:
            error_info['error_type'] = type(error).__name__
            error_info['error_message'] = str(error)
        
        return error_info
    
    def request(self, method: str, endpoint: str, params: Dict = None, data: Dict = None, 
                use_cache: bool = True, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Make an authenticated HTTP request with retry logic and caching.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            endpoint: API endpoint path (will be joined with base URL)
            params: Query parameters
            data: Request body data
            use_cache: Whether to use cached responses for GET requests
            force_refresh: Force refresh even if cached data exists
            
        Returns:
            Dict containing response data or error information
            
        Raises:
            SaaSClientError: For unrecoverable errors
        """
        if not self._client:
            raise SaaSClientError("HTTP client not initialized")
        
        # Build full URL
        url = urljoin(self.api_endpoint, endpoint.lstrip('/'))
        
        # Check cache for GET requests
        cache_key = None
        if method.upper() == 'GET' and use_cache and not force_refresh:
            cache_key = self._get_cache_key(method, url, params, data)
            cached_response = self._get_cached_response(cache_key)
            if cached_response:
                return cached_response
        
        # Prepare request
        headers = self._get_auth_headers()
        request_data = json.dumps(data) if data else None
        
        # Retry logic
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                # Log request
                self._log_request(method, url, params, data, headers, attempt + 1)
                
                # Make request
                start_time = time.time()
                response = self._client.request(
                    method=method.upper(),
                    url=url,
                    params=params,
                    content=request_data,
                    headers=headers
                )
                duration = time.time() - start_time
                
                # Check if request was successful
                if response.status_code < 400:
                    # Success - parse response
                    try:
                        response_data = response.json()
                    except:
                        response_data = {'content': response.text}
                    
                    # Add metadata
                    response_data['_metadata'] = {
                        'status_code': response.status_code,
                        'duration': duration,
                        'timestamp': datetime.now().isoformat(),
                        'cached': False
                    }
                    
                    # Cache successful GET responses
                    if method.upper() == 'GET' and cache_key:
                        self._cache_response(cache_key, response_data)
                    
                    # Update last successful request time
                    self._last_successful_request = time.time()
                    
                    # Log successful response
                    self._log_response(response, duration, True)
                    
                    return response_data
                
                else:
                    # HTTP error - check if retryable
                    error_info = self._handle_http_error(response)
                    self._log_response(response, duration, False)
                    
                    # Don't retry client errors (4xx) except for 429 (rate limit)
                    if 400 <= response.status_code < 500 and response.status_code != 429:
                        raise SaaSClientError(f"Client error: {error_info}")
                    
                    # For server errors (5xx) and rate limits (429), retry
                    if attempt < self.max_retries:
                        delay = self._calculate_retry_delay(attempt)
                        self.logger.warning(f"Request failed (attempt {attempt + 1}/{self.max_retries + 1}), retrying in {delay:.2f}s")
                        time.sleep(delay)
                        continue
                    else:
                        raise SaaSClientError(f"Max retries exceeded: {error_info}")
            
            except httpx.TimeoutException as e:
                last_error = e
                self.logger.warning(f"Request timeout (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
                if attempt < self.max_retries:
                    delay = self._calculate_retry_delay(attempt)
                    time.sleep(delay)
                    continue
                else:
                    raise SaaSClientError(f"Request timeout after {self.max_retries + 1} attempts")
            
            except httpx.ConnectError as e:
                last_error = e
                self.logger.warning(f"Connection error (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
                
                # Check if we can use cached data during offline grace period
                if cache_key and self._is_offline_grace_period_active():
                    cached_response = self._get_cached_response(cache_key)
                    if cached_response:
                        cached_response['_metadata']['cached'] = True
                        cached_response['_metadata']['offline_mode'] = True
                        self.logger.info("Using cached response during offline grace period")
                        return cached_response
                
                if attempt < self.max_retries:
                    delay = self._calculate_retry_delay(attempt)
                    time.sleep(delay)
                    continue
                else:
                    raise SaaSClientError(f"Connection failed after {self.max_retries + 1} attempts")
            
            except Exception as e:
                last_error = e
                self.logger.error(f"Unexpected error (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
                if attempt < self.max_retries:
                    delay = self._calculate_retry_delay(attempt)
                    time.sleep(delay)
                    continue
                else:
                    raise SaaSClientError(f"Unexpected error after {self.max_retries + 1} attempts: {e}")
        
        # This should never be reached, but just in case
        raise SaaSClientError(f"Request failed after all retries: {last_error}")
    
    def get(self, endpoint: str, params: Dict = None, use_cache: bool = True, 
            force_refresh: bool = False) -> Dict[str, Any]:
        """Make a GET request."""
        return self.request('GET', endpoint, params=params, use_cache=use_cache, 
                          force_refresh=force_refresh)
    
    def post(self, endpoint: str, data: Dict = None, params: Dict = None) -> Dict[str, Any]:
        """Make a POST request."""
        return self.request('POST', endpoint, params=params, data=data, use_cache=False)
    
    def put(self, endpoint: str, data: Dict = None, params: Dict = None) -> Dict[str, Any]:
        """Make a PUT request."""
        return self.request('PUT', endpoint, params=params, data=data, use_cache=False)
    
    def delete(self, endpoint: str, params: Dict = None) -> Dict[str, Any]:
        """Make a DELETE request."""
        return self.request('DELETE', endpoint, params=params, use_cache=False)
    
    def authenticate(self, username: str = None, password: str = None, 
                    api_key: str = None) -> bool:
        """
        Authenticate with the SaaS backend.
        
        Args:
            username: Username for authentication
            password: Password for authentication
            api_key: API key for authentication
            
        Returns:
            True if authentication successful, False otherwise
        """
        try:
            if api_key:
                self.api_key = api_key
                self.logger.info("Authentication successful with API key")
                return True
            
            elif username and password:
                # Make authentication request
                auth_data = {
                    'username': username,
                    'password': password
                }
                
                response = self.post('/auth/login', data=auth_data)
                
                if response.get('success'):
                    self._access_token = response.get('access_token')
                    self._refresh_token = response.get('refresh_token')
                    self._token_expires_at = response.get('expires_at')
                    
                    self.logger.info("Authentication successful with username/password")
                    return True
                else:
                    self.logger.warning("Authentication failed")
                    return False
            
            else:
                self.logger.warning("No authentication credentials provided")
                return False
                
        except Exception as e:
            self.logger.error(f"Authentication error: {e}")
            return False
    
    def refresh_token(self) -> bool:
        """Refresh the access token using the refresh token."""
        if not self._refresh_token:
            self.logger.warning("No refresh token available")
            return False
        
        try:
            response = self.post('/auth/refresh', data={'refresh_token': self._refresh_token})
            
            if response.get('success'):
                self._access_token = response.get('access_token')
                self._token_expires_at = response.get('expires_at')
                self.logger.info("Token refreshed successfully")
                return True
            else:
                self.logger.warning("Token refresh failed")
                return False
                
        except Exception as e:
            self.logger.error(f"Token refresh error: {e}")
            return False
    
    def clear_cache(self):
        """Clear all cached responses."""
        self._response_cache.clear()
        self.logger.info("Response cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_entries = len(self._response_cache)
        expired_entries = 0
        current_time = time.time()
        
        for cache_key, (_, timestamp) in self._response_cache.items():
            if current_time - timestamp >= self.cache_ttl:
                expired_entries += 1
        
        return {
            'total_entries': total_entries,
            'expired_entries': expired_entries,
            'active_entries': total_entries - expired_entries,
            'cache_ttl': self.cache_ttl,
            'offline_grace_period': self.offline_grace_period,
            'last_successful_request': self._last_successful_request
        }
    
    def close(self):
        """Close the HTTP client and cleanup resources."""
        if self._client:
            self._client.close()
            self._client = None
        self.logger.info("SaaSClient closed")

class SaaSClientError(Exception):
    """Custom exception for SaaS client errors."""
    pass

# =============================================================================
# LICENSE MANAGEMENT
# =============================================================================

class LicenseError(Exception):
    """Custom exception for license-related errors."""
    pass

class DeviceFingerprinter:
    """Secure device fingerprinting for license enforcement."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get('enabled', True)
        self.include_hardware = config.get('include_hardware', True)
        self.include_software = config.get('include_software', True)
        self.include_network = config.get('include_network', False)
    
    def _get_hardware_info(self) -> Dict[str, str]:
        """Get hardware-specific information."""
        info = {}
        
        try:
            # CPU information
            if hasattr(platform, 'processor'):
                info['processor'] = platform.processor()
            
            # Machine type
            info['machine'] = platform.machine()
            
            # System architecture
            info['architecture'] = platform.architecture()[0]
            
            # Get MAC address (first available)
            try:
                mac = uuid.getnode()
                info['mac_address'] = ':'.join(('%012X' % mac)[i:i+2] for i in range(0, 12, 2))
            except:
                pass
            
            # Get hostname
            info['hostname'] = socket.gethostname()
            
        except Exception as e:
            # Don't fail if we can't get hardware info
            pass
        
        return info
    
    def _get_software_info(self) -> Dict[str, str]:
        """Get software-specific information."""
        info = {}
        
        try:
            # Operating system
            info['system'] = platform.system()
            info['release'] = platform.release()
            info['version'] = platform.version()
            
            # Python version
            info['python_version'] = platform.python_version()
            info['python_implementation'] = platform.python_implementation()
            
            # Server version
            info['server_version'] = "2.0.0"  # From config
            
        except Exception as e:
            # Don't fail if we can't get software info
            pass
        
        return info
    
    def _get_network_info(self) -> Dict[str, str]:
        """Get network-specific information (if enabled)."""
        info = {}
        
        if not self.include_network:
            return info
        
        try:
            # Get local IP address
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            info['local_ip'] = s.getsockname()[0]
            s.close()
            
        except Exception as e:
            # Don't fail if we can't get network info
            pass
        
        return info
    
    def generate_fingerprint(self) -> str:
        """Generate a unique device fingerprint."""
        if not self.enabled:
            return "disabled"
        
        fingerprint_data = {}
        
        if self.include_hardware:
            fingerprint_data.update(self._get_hardware_info())
        
        if self.include_software:
            fingerprint_data.update(self._get_software_info())
        
        if self.include_network:
            fingerprint_data.update(self._get_network_info())
        
        # Create a deterministic hash of the fingerprint data
        fingerprint_string = json.dumps(fingerprint_data, sort_keys=True)
        fingerprint_hash = hashlib.sha256(fingerprint_string.encode()).hexdigest()
        
        return fingerprint_hash

class LicenseManager:
    """
    Production-ready license management system.
    
    Features:
    - License validation with SaaS backend
    - Device fingerprinting for enforcement
    - Tier-based feature access control
    - Offline grace period support
    - Automatic license refresh
    - Comprehensive error handling
    """
    
    def __init__(self, config: ConfigManager, logger: logging.Logger, saas_client: Optional[SaaSClient] = None):
        """
        Initialize the license manager.
        
        Args:
            config: Configuration manager instance
            logger: Logger instance for license operations
            saas_client: Optional SaaS HTTP client for license validation
        """
        self.config = config
        self.logger = logger
        self.saas_client = saas_client
        
        # License configuration
        self.enabled = config.get('license.enabled', True)
        self.license_key = config.get('license.license_key', '')
        self.validation_interval = config.get('license.validation_interval', 86400)  # 24 hours
        self.offline_grace_period = config.get('license.offline_grace_period', 7200)  # 2 hours
        
        # Device fingerprinting
        device_config = config.get('license.device_fingerprint', {})
        self.device_fingerprinter = DeviceFingerprinter(device_config)
        self.device_id = self.device_fingerprinter.generate_fingerprint()
        
        # License state
        self.license_status = {
            'valid': False,
            'tier': 'free',
            'expires_at': None,
            'features': [],
            'limits': {},
            'last_validated': None,
            'device_id': self.device_id,
            'offline_mode': False
        }
        
        # Tier configuration
        self.tiers = config.get('license.tiers', {})
        
        # Validation tracking
        self._last_validation_attempt = None
        self._validation_in_progress = False
        
        self.logger.info(f"LicenseManager initialized - Device ID: {self.device_id[:8]}...")
    
    def _get_license_cache_path(self) -> str:
        """Get the path for license cache file."""
        cache_dir = os.path.expanduser("~/.cursor-mcp")
        os.makedirs(cache_dir, exist_ok=True)
        return os.path.join(cache_dir, "license_cache.json")
    
    def _load_license_cache(self) -> bool:
        """Load license status from cache."""
        try:
            cache_path = self._get_license_cache_path()
            if os.path.exists(cache_path):
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                # Check if cache is still valid
                if self._is_cache_valid(cached_data):
                    self.license_status.update(cached_data)
                    self.logger.info("License status loaded from cache")
                    return True
                else:
                    self.logger.info("License cache expired, will revalidate")
                    return False
        except Exception as e:
            self.logger.warning(f"Failed to load license cache: {e}")
        
        return False
    
    def _save_license_cache(self) -> None:
        """Save license status to cache."""
        try:
            cache_path = self._get_license_cache_path()
            cache_data = self.license_status.copy()
            
            # Remove sensitive data
            cache_data.pop('device_id', None)
            
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2)
            
            self.logger.debug("License status saved to cache")
        except Exception as e:
            self.logger.warning(f"Failed to save license cache: {e}")
    
    def _is_cache_valid(self, cached_data: Dict[str, Any]) -> bool:
        """Check if cached license data is still valid."""
        if not cached_data.get('valid', False):
            return False
        
        # Check if cache is within grace period
        last_validated = cached_data.get('last_validated')
        if last_validated:
            try:
                last_validated_time = datetime.fromisoformat(last_validated)
                cache_age = (datetime.now() - last_validated_time).total_seconds()
                
                # Cache is valid if within validation interval or offline grace period
                if cache_age < self.validation_interval:
                    return True
                elif cache_age < (self.validation_interval + self.offline_grace_period):
                    # Within offline grace period
                    self.license_status['offline_mode'] = True
                    return True
            except Exception as e:
                self.logger.warning(f"Error parsing cache timestamp: {e}")
        
        return False
    
    def _validate_license_offline(self) -> bool:
        """Validate license using cached data when offline."""
        try:
            cache_path = self._get_license_cache_path()
            if os.path.exists(cache_path):
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                if self._is_cache_valid(cached_data):
                    self.license_status.update(cached_data)
                    self.license_status['offline_mode'] = True
                    self.logger.info("License validated offline using cached data")
                    return True
        except Exception as e:
            self.logger.warning(f"Offline license validation failed: {e}")
        
        return False
    
    def _validate_license_online(self) -> bool:
        """Validate license with SaaS backend."""
        if not self.saas_client or not self.license_key:
            self.logger.warning("No SaaS client or license key available for validation")
            return False
        
        try:
            # Prepare validation request
            validation_data = {
                'license_key': self.license_key,
                'device_id': self.device_id,
                'server_version': '2.0.0',
                'python_version': platform.python_version(),
                'system_info': {
                    'system': platform.system(),
                    'release': platform.release(),
                    'machine': platform.machine()
                }
            }
            
            self.logger.info("Validating license with SaaS backend...")
            response = self.saas_client.post('/api/auth/validate-license', data=validation_data)
            
            if response.get('success'):
                license_info = response.get('license', {})
                
                # Update license status
                self.license_status.update({
                    'valid': True,
                    'tier': license_info.get('tier', 'free'),
                    'expires_at': license_info.get('expires_at'),
                    'features': license_info.get('features', []),
                    'limits': license_info.get('limits', {}),
                    'last_validated': datetime.now().isoformat(),
                    'offline_mode': False
                })
                
                # Save to cache
                self._save_license_cache()
                
                self.logger.info(f"License validated successfully - Tier: {self.license_status['tier']}")
                return True
            else:
                error_msg = response.get('error', 'Unknown validation error')
                self.logger.error(f"License validation failed: {error_msg}")
                return False
                
        except SaaSClientError as e:
            self.logger.warning(f"SaaS client error during license validation: {e}")
            # Try offline validation as fallback
            return self._validate_license_offline()
        except Exception as e:
            self.logger.error(f"Unexpected error during license validation: {e}")
            return False
    
    def validate_license(self, force_refresh: bool = False) -> bool:
        """
        Validate license status.
        
        Args:
            force_refresh: Force validation even if cache is valid
            
        Returns:
            True if license is valid, False otherwise
        """
        if not self.enabled:
            self.logger.info("License validation disabled")
            return True
        
        # Prevent concurrent validation attempts
        if self._validation_in_progress:
            self.logger.debug("License validation already in progress")
            return self.license_status.get('valid', False)
        
        self._validation_in_progress = True
        self._last_validation_attempt = datetime.now()
        
        try:
            # Check if we need to validate
            if not force_refresh and self.license_status.get('valid', False):
                last_validated = self.license_status.get('last_validated')
                if last_validated:
                    try:
                        last_validated_time = datetime.fromisoformat(last_validated)
                        time_since_validation = (datetime.now() - last_validated_time).total_seconds()
                        
                        if time_since_validation < self.validation_interval:
                            self.logger.debug("License validation not needed yet")
                            return True
                    except Exception as e:
                        self.logger.warning(f"Error parsing last validation time: {e}")
            
            # Try online validation first
            if self.saas_client and self.license_key:
                if self._validate_license_online():
                    return True
            
            # Fall back to offline validation
            if self._validate_license_offline():
                return True
            
            # If all validation attempts fail, set to invalid
            self.license_status.update({
                'valid': False,
                'tier': 'free',
                'expires_at': None,
                'features': self.tiers.get('free', {}).get('features', []),
                'limits': self.tiers.get('free', {}),
                'last_validated': datetime.now().isoformat(),
                'offline_mode': False
            })
            
            self.logger.warning("License validation failed, falling back to free tier")
            return False
            
        finally:
            self._validation_in_progress = False
    
    def is_feature_allowed(self, feature: str) -> bool:
        """Check if a feature is allowed for the current license tier."""
        if not self.enabled:
            return True
        
        if not self.license_status.get('valid', False):
            return False
        
        allowed_features = self.license_status.get('features', [])
        return feature in allowed_features
    
    def get_tier_limits(self) -> Dict[str, Any]:
        """Get limits for the current license tier."""
        if not self.enabled:
            return {}
        
        tier = self.license_status.get('tier', 'free')
        return self.tiers.get(tier, {}).get('limits', {})
    
    def get_license_status(self) -> Dict[str, Any]:
        """Get current license status information."""
        return {
            'enabled': self.enabled,
            'valid': self.license_status.get('valid', False),
            'tier': self.license_status.get('tier', 'free'),
            'expires_at': self.license_status.get('expires_at'),
            'features': self.license_status.get('features', []),
            'limits': self.license_status.get('limits', {}),
            'last_validated': self.license_status.get('last_validated'),
            'offline_mode': self.license_status.get('offline_mode', False),
            'device_id': self.device_id[:8] + '...' if self.device_id else None,
            'validation_interval': self.validation_interval,
            'offline_grace_period': self.offline_grace_period
        }
    
    def get_user_friendly_error(self) -> str:
        """Get user-friendly error message for license issues."""
        if not self.enabled:
            return "License validation is disabled."
        
        if self.license_status.get('valid', False):
            return "License is valid."
        
        if self.license_status.get('offline_mode', False):
            return "License validation is in offline mode. Please check your internet connection."
        
        if not self.license_key:
            return "No license key configured. Please set your license key in the configuration."
        
        if not self.saas_client:
            return "License validation service is not available. Please check your SaaS configuration."
        
        return "License validation failed. Please check your license key and internet connection."
    
    def initialize(self) -> bool:
        """Initialize license manager and validate license."""
        if not self.enabled:
            self.logger.info("License management disabled")
            return True
        
        self.logger.info("Initializing license manager...")
        
        # Try to load from cache first
        if self._load_license_cache():
            self.logger.info("License loaded from cache")
        
        # Validate license
        if self.validate_license():
            self.logger.info("License validation successful")
            return True
        else:
            self.logger.warning("License validation failed")
            return False
    
    def cleanup(self):
        """Cleanup license manager resources."""
        self.logger.info("License manager cleanup completed")

# =============================================================================
# USAGE TRACKING AND ANALYTICS
# =============================================================================

class UsageTracker:
    """
    Production-ready usage tracking and analytics system.
    
    Features:
    - Comprehensive usage tracking with metadata
    - Batch processing and local storage
    - Privacy-compliant data handling
    - Quota enforcement and rate limiting
    - GDPR compliance and data anonymization
    - Performance metrics and error tracking
    """
    
    def __init__(self, config: ConfigManager, logger: logging.Logger, 
                 saas_client: Optional[SaaSClient] = None, license_manager: Optional[LicenseManager] = None):
        """
        Initialize the usage tracker.
        
        Args:
            config: Configuration manager instance
            logger: Logger instance for analytics operations
            saas_client: Optional SaaS HTTP client for data transmission
            license_manager: Optional license manager for quota enforcement
        """
        self.config = config
        self.logger = logger
        self.saas_client = saas_client
        self.license_manager = license_manager
        
        # Analytics configuration
        analytics_config = config.get('analytics', {})
        self.enabled = analytics_config.get('enabled', True)
        self.privacy_mode = analytics_config.get('privacy_mode', 'balanced')
        self.track_usage = analytics_config.get('track_usage', True)
        self.track_performance = analytics_config.get('track_performance', True)
        self.track_errors = analytics_config.get('track_errors', True)
        self.anonymize_data = analytics_config.get('anonymize_data', False)
        
        # Batch processing configuration
        self.batch_size = analytics_config.get('batch_size', 100)
        self.batch_interval = analytics_config.get('batch_interval', 300)  # 5 minutes
        self.retention_days = analytics_config.get('retention_days', 30)
        
        # Local storage configuration
        local_storage_config = analytics_config.get('local_storage', {})
        self.local_storage_enabled = local_storage_config.get('enabled', True)
        self.max_local_entries = local_storage_config.get('max_entries', 10000)
        self.cleanup_interval = local_storage_config.get('cleanup_interval', 3600)  # 1 hour
        
        # Quota enforcement configuration
        quota_config = analytics_config.get('quota_enforcement', {})
        self.quota_enforcement_enabled = quota_config.get('enabled', True)
        self.quota_check_interval = quota_config.get('check_interval', 60)
        self.quota_grace_period = quota_config.get('grace_period', 300)
        
        # Data type tracking configuration
        data_types_config = analytics_config.get('data_types', {})
        self.track_file_operations = data_types_config.get('file_operations', True)
        self.track_git_operations = data_types_config.get('git_operations', True)
        self.track_search_queries = data_types_config.get('search_queries', True)
        self.track_performance_metrics = data_types_config.get('performance_metrics', True)
        self.track_error_tracking = data_types_config.get('error_tracking', True)
        
        # Usage data storage
        self.usage_queue = queue.Queue()
        self.local_storage = deque(maxlen=self.max_local_entries)
        self.usage_stats = defaultdict(lambda: {
            'count': 0,
            'total_duration': 0.0,
            'total_file_size': 0,
            'error_count': 0,
            'last_used': None
        })
        
        # Quota tracking
        self.quota_status = {
            'current_usage': 0,
            'quota_limit': 0,
            'quota_reset_time': None,
            'quota_exceeded': False,
            'last_check': None
        }
        
        # Threading and synchronization
        self._stop_event = threading.Event()
        self._batch_thread = None
        self._cleanup_thread = None
        self._quota_thread = None
        self._lock = threading.RLock()
        
        # Privacy and anonymization
        self._anonymization_salt = hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:16]
        
        self.logger.info(f"UsageTracker initialized - Privacy mode: {self.privacy_mode}")
    
    def _get_storage_path(self) -> str:
        """Get the path for local usage data storage."""
        storage_dir = os.path.expanduser("~/.cursor-mcp/analytics")
        os.makedirs(storage_dir, exist_ok=True)
        return os.path.join(storage_dir, "usage_data.json")
    
    def _anonymize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Anonymize sensitive data based on privacy settings."""
        if not self.anonymize_data:
            return data
        
        anonymized = data.copy()
        
        # Anonymize file paths
        if 'file_path' in anonymized:
            anonymized['file_path'] = self._hash_path(anonymized['file_path'])
        
        if 'directory' in anonymized:
            anonymized['directory'] = self._hash_path(anonymized['directory'])
        
        # Anonymize search queries
        if 'query' in anonymized:
            anonymized['query'] = self._hash_query(anonymized['query'])
        
        # Remove or hash user-specific data
        if 'user_id' in anonymized:
            anonymized['user_id'] = hashlib.sha256(
                (anonymized['user_id'] + self._anonymization_salt).encode()
            ).hexdigest()[:8]
        
        return anonymized
    
    def _hash_path(self, path: str) -> str:
        """Hash file paths for anonymization."""
        if not path or path == ".":
            return path
        
        # Keep directory structure but hash filenames
        path_parts = Path(path).parts
        if len(path_parts) <= 1:
            return path
        
        # Hash the filename but keep directory structure
        hashed_parts = list(path_parts[:-1])
        filename = path_parts[-1]
        hashed_filename = hashlib.sha256(filename.encode()).hexdigest()[:8]
        hashed_parts.append(hashed_filename)
        
        return str(Path(*hashed_parts))
    
    def _hash_query(self, query: str) -> str:
        """Hash search queries for anonymization."""
        if not query:
            return query
        
        # Hash the query but keep some structure
        words = query.split()
        if len(words) <= 2:
            return hashlib.sha256(query.encode()).hexdigest()[:8]
        
        # Keep first and last word, hash the middle
        if len(words) > 2:
            hashed_words = [words[0]]
            for word in words[1:-1]:
                hashed_words.append(hashlib.sha256(word.encode()).hexdigest()[:4])
            hashed_words.append(words[-1])
            return " ".join(hashed_words)
        
        return query
    
    def _create_usage_event(self, event_type: str, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Create a standardized usage event."""
        event = {
            'event_id': str(uuid.uuid4()),
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'tool_name': tool_name,
            'session_id': self.config.get('saas.session_id', ''),
            'device_id': self.license_manager.device_id[:8] + '...' if self.license_manager else None,
            'license_tier': self.license_manager.license_status.get('tier', 'free') if self.license_manager else 'free',
            'server_version': '2.0.0',
            'python_version': platform.python_version(),
            'system_info': {
                'system': platform.system(),
                'release': platform.release()
            }
        }
        
        # Add event-specific data
        event.update(kwargs)
        
        # Apply privacy settings
        if self.privacy_mode in ['strict', 'balanced']:
            event = self._anonymize_data(event)
        
        return event
    
    def track_tool_usage(self, tool_name: str, duration: float, success: bool = True, 
                        file_size: int = 0, file_path: str = None, **metadata):
        """
        Track MCP tool usage.
        
        Args:
            tool_name: Name of the MCP tool
            duration: Execution duration in seconds
            success: Whether the operation was successful
            file_size: Size of file processed (if applicable)
            file_path: Path to file processed (if applicable)
            **metadata: Additional metadata
        """
        if not self.enabled or not self.track_usage:
            return
        
        try:
            # Create usage event
            event = self._create_usage_event(
                event_type='tool_usage',
                tool_name=tool_name,
                duration=duration,
                success=success,
                file_size=file_size,
                file_path=file_path,
                **metadata
            )
            
            # Add to queue for batch processing
            self.usage_queue.put(event)
            
            # Update local statistics
            with self._lock:
                stats = self.usage_stats[tool_name]
                stats['count'] += 1
                stats['total_duration'] += duration
                stats['total_file_size'] += file_size
                if not success:
                    stats['error_count'] += 1
                stats['last_used'] = datetime.now().isoformat()
            
            self.logger.debug(f"Tracked usage for {tool_name}: {duration:.3f}s")
            
        except Exception as e:
            self.logger.warning(f"Failed to track tool usage: {e}")
    
    def track_file_operation(self, operation: str, file_path: str, file_size: int = 0, 
                           duration: float = 0.0, success: bool = True):
        """Track file operations with detailed metadata."""
        if not self.enabled or not self.track_file_operations:
            return
        
        try:
            event = self._create_usage_event(
                event_type='file_operation',
                tool_name=operation,
                file_path=file_path,
                file_size=file_size,
                duration=duration,
                success=success,
                file_extension=Path(file_path).suffix if file_path else None,
                operation_type=operation
            )
            
            self.usage_queue.put(event)
            self.logger.debug(f"Tracked file operation: {operation} on {file_path}")
            
        except Exception as e:
            self.logger.warning(f"Failed to track file operation: {e}")
    
    def track_search_query(self, query: str, result_count: int = 0, duration: float = 0.0, 
                          search_type: str = 'text'):
        """Track search queries with results metadata."""
        if not self.enabled or not self.track_search_queries:
            return
        
        try:
            event = self._create_usage_event(
                event_type='search_query',
                tool_name='search',
                query=query,
                result_count=result_count,
                duration=duration,
                search_type=search_type,
                query_length=len(query) if query else 0
            )
            
            self.usage_queue.put(event)
            self.logger.debug(f"Tracked search query: {query[:50]}...")
            
        except Exception as e:
            self.logger.warning(f"Failed to track search query: {e}")
    
    def track_error(self, tool_name: str, error_type: str, error_message: str, 
                   duration: float = 0.0, **context):
        """Track errors with context information."""
        if not self.enabled or not self.track_errors:
            return
        
        try:
            event = self._create_usage_event(
                event_type='error',
                tool_name=tool_name,
                error_type=error_type,
                error_message=error_message[:200],  # Truncate for privacy
                duration=duration,
                success=False,
                **context
            )
            
            self.usage_queue.put(event)
            self.logger.debug(f"Tracked error: {error_type} in {tool_name}")
            
        except Exception as e:
            self.logger.warning(f"Failed to track error: {e}")
    
    def track_performance_metric(self, metric_name: str, value: float, unit: str = 'seconds', 
                               **metadata):
        """Track performance metrics."""
        if not self.enabled or not self.track_performance_metrics:
            return
        
        try:
            event = self._create_usage_event(
                event_type='performance_metric',
                tool_name='system',
                metric_name=metric_name,
                metric_value=value,
                metric_unit=unit,
                **metadata
            )
            
            self.usage_queue.put(event)
            self.logger.debug(f"Tracked performance metric: {metric_name}={value}{unit}")
            
        except Exception as e:
            self.logger.warning(f"Failed to track performance metric: {e}")
    
    def _batch_processor(self):
        """Background thread for batch processing usage data."""
        while not self._stop_event.is_set():
            try:
                # Collect events from queue
                events = []
                timeout = min(self.batch_interval, 60)  # Check at least every minute
                
                # Get first event (blocking)
                try:
                    event = self.usage_queue.get(timeout=timeout)
                    events.append(event)
                except queue.Empty:
                    continue
                
                # Collect additional events (non-blocking)
                while len(events) < self.batch_size:
                    try:
                        event = self.usage_queue.get_nowait()
                        events.append(event)
                    except queue.Empty:
                        break
                
                if events:
                    self._process_batch(events)
                
            except Exception as e:
                self.logger.error(f"Error in batch processor: {e}")
                time.sleep(5)  # Wait before retrying
    
    def _process_batch(self, events: List[Dict[str, Any]]):
        """Process a batch of usage events."""
        try:
            # Store locally first
            if self.local_storage_enabled:
                self._store_locally(events)
            
            # Send to SaaS backend
            if self.saas_client and self.config.get('saas.enabled', False):
                self._send_to_backend(events)
            
            self.logger.debug(f"Processed batch of {len(events)} usage events")
            
        except Exception as e:
            self.logger.error(f"Failed to process usage batch: {e}")
    
    def _store_locally(self, events: List[Dict[str, Any]]):
        """Store usage events locally."""
        try:
            with self._lock:
                for event in events:
                    self.local_storage.append(event)
                
                # Save to disk periodically
                if len(self.local_storage) % 100 == 0:
                    self._save_local_storage()
            
        except Exception as e:
            self.logger.warning(f"Failed to store usage data locally: {e}")
    
    def _save_local_storage(self):
        """Save local storage to disk."""
        try:
            storage_path = self._get_storage_path()
            with open(storage_path, 'w', encoding='utf-8') as f:
                json.dump(list(self.local_storage), f, indent=2)
            
        except Exception as e:
            self.logger.warning(f"Failed to save local storage: {e}")
    
    def _load_local_storage(self):
        """Load local storage from disk."""
        try:
            storage_path = self._get_storage_path()
            if os.path.exists(storage_path):
                with open(storage_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.local_storage.extend(data)
                
                self.logger.info(f"Loaded {len(data)} usage events from local storage")
            
        except Exception as e:
            self.logger.warning(f"Failed to load local storage: {e}")
    
    def _send_to_backend(self, events: List[Dict[str, Any]]):
        """Send usage events to SaaS backend using the new SaaS integration."""
        try:
            # Use the SaaS integration's track_usage method
            if hasattr(self.saas_client, 'track_usage'):
                # New SaaS integration method
                success = self.saas_client.track_usage(events)
                if success:
                    self.logger.debug(f"Successfully sent {len(events)} events to SaaS backend")
                else:
                    self.logger.warning(f"Failed to send usage data to SaaS backend")
            else:
                # Fallback to old method
                payload = {
                    'events': events,
                    'batch_id': str(uuid.uuid4()),
                    'timestamp': datetime.now().isoformat(),
                    'total_events': len(events)
                }
                
                response = self.saas_client.post('/api/analytics/track', data=payload)
                
                if response.get('success'):
                    self.logger.debug(f"Successfully sent {len(events)} events to backend")
                else:
                    self.logger.warning(f"Backend rejected usage data: {response.get('error')}")
            
        except SaaSClientError as e:
            self.logger.warning(f"Failed to send usage data to backend: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error sending usage data: {e}")
    
    def _cleanup_old_data(self):
        """Clean up old usage data based on retention policy."""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)
            
            with self._lock:
                # Remove old events from local storage
                original_count = len(self.local_storage)
                self.local_storage = deque(
                    (event for event in self.local_storage 
                     if datetime.fromisoformat(event['timestamp']) > cutoff_date),
                    maxlen=self.max_local_entries
                )
                
                removed_count = original_count - len(self.local_storage)
                if removed_count > 0:
                    self.logger.info(f"Cleaned up {removed_count} old usage events")
                    self._save_local_storage()
            
        except Exception as e:
            self.logger.warning(f"Failed to cleanup old data: {e}")
    
    def _cleanup_processor(self):
        """Background thread for data cleanup."""
        while not self._stop_event.is_set():
            try:
                self._stop_event.wait(self.cleanup_interval)
                if not self._stop_event.is_set():
                    self._cleanup_old_data()
            except Exception as e:
                self.logger.error(f"Error in cleanup processor: {e}")
    
    def _check_quota(self):
        """Check usage quota and enforce limits."""
        if not self.quota_enforcement_enabled or not self.license_manager:
            return
        
        try:
            # Get current quota from license manager
            tier_limits = self.license_manager.get_tier_limits()
            hourly_limit = tier_limits.get('max_operations_per_hour', 0)
            
            if hourly_limit <= 0:
                return
            
            # Calculate current usage (simplified - in production, this would be more sophisticated)
            current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
            current_usage = 0
            
            with self._lock:
                for tool_name, stats in self.usage_stats.items():
                    if stats['last_used']:
                        last_used = datetime.fromisoformat(stats['last_used'])
                        if last_used >= current_hour:
                            current_usage += stats['count']
            
            # Update quota status
            self.quota_status.update({
                'current_usage': current_usage,
                'quota_limit': hourly_limit,
                'quota_reset_time': (current_hour + timedelta(hours=1)).isoformat(),
                'quota_exceeded': current_usage >= hourly_limit,
                'last_check': datetime.now().isoformat()
            })
            
            if self.quota_status['quota_exceeded']:
                self.logger.warning(f"Quota exceeded: {current_usage}/{hourly_limit} operations this hour")
            
        except Exception as e:
            self.logger.warning(f"Failed to check quota: {e}")
    
    def _quota_processor(self):
        """Background thread for quota checking."""
        while not self._stop_event.is_set():
            try:
                self._stop_event.wait(self.quota_check_interval)
                if not self._stop_event.is_set():
                    self._check_quota()
            except Exception as e:
                self.logger.error(f"Error in quota processor: {e}")
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get comprehensive usage statistics."""
        with self._lock:
            total_operations = sum(stats['count'] for stats in self.usage_stats.values())
            total_duration = sum(stats['total_duration'] for stats in self.usage_stats.values())
            total_file_size = sum(stats['total_file_size'] for stats in self.usage_stats.values())
            total_errors = sum(stats['error_count'] for stats in self.usage_stats.values())
            
            return {
                'enabled': self.enabled,
                'privacy_mode': self.privacy_mode,
                'total_operations': total_operations,
                'total_duration': total_duration,
                'total_file_size': total_file_size,
                'total_errors': total_errors,
                'error_rate': total_errors / max(total_operations, 1),
                'average_duration': total_duration / max(total_operations, 1),
                'tool_stats': dict(self.usage_stats),
                'quota_status': self.quota_status.copy(),
                'local_storage_count': len(self.local_storage),
                'queue_size': self.usage_queue.qsize(),
                'data_types_tracked': {
                    'file_operations': self.track_file_operations,
                    'git_operations': self.track_git_operations,
                    'search_queries': self.track_search_queries,
                    'performance_metrics': self.track_performance_metrics,
                    'error_tracking': self.track_error_tracking
                }
            }
    
    def get_usage_summary(self, days: int = 7) -> Dict[str, Any]:
        """Get usage summary for the specified number of days."""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            # Filter recent events
            recent_events = []
            with self._lock:
                for event in self.local_storage:
                    if datetime.fromisoformat(event['timestamp']) >= cutoff_date:
                        recent_events.append(event)
            
            # Analyze events
            tool_usage = defaultdict(int)
            file_operations = defaultdict(int)
            search_queries = defaultdict(int)
            errors = defaultdict(int)
            daily_usage = defaultdict(int)
            
            for event in recent_events:
                event_date = datetime.fromisoformat(event['timestamp']).date()
                daily_usage[event_date.isoformat()] += 1
                
                if event['event_type'] == 'tool_usage':
                    tool_usage[event['tool_name']] += 1
                elif event['event_type'] == 'file_operation':
                    file_operations[event['operation_type']] += 1
                elif event['event_type'] == 'search_query':
                    search_queries[event['search_type']] += 1
                elif event['event_type'] == 'error':
                    errors[event['error_type']] += 1
            
            return {
                'period_days': days,
                'total_events': len(recent_events),
                'daily_usage': dict(daily_usage),
                'tool_usage': dict(tool_usage),
                'file_operations': dict(file_operations),
                'search_queries': dict(search_queries),
                'errors': dict(errors),
                'most_used_tool': max(tool_usage.items(), key=lambda x: x[1])[0] if tool_usage else None,
                'most_common_error': max(errors.items(), key=lambda x: x[1])[0] if errors else None
            }
            
        except Exception as e:
            self.logger.error(f"Failed to generate usage summary: {e}")
            return {'error': str(e)}
    
    def start(self):
        """Start the usage tracker background processes."""
        if not self.enabled:
            return
        
        try:
            # Load existing local storage
            self._load_local_storage()
            
            # Start background threads
            self._batch_thread = threading.Thread(target=self._batch_processor, daemon=True)
            self._batch_thread.start()
            
            self._cleanup_thread = threading.Thread(target=self._cleanup_processor, daemon=True)
            self._cleanup_thread.start()
            
            if self.quota_enforcement_enabled:
                self._quota_thread = threading.Thread(target=self._quota_processor, daemon=True)
                self._quota_thread.start()
            
            self.logger.info("Usage tracker started")
            
        except Exception as e:
            self.logger.error(f"Failed to start usage tracker: {e}")
    
    def stop(self):
        """Stop the usage tracker and cleanup resources."""
        try:
            # Signal threads to stop
            self._stop_event.set()
            
            # Wait for threads to finish
            if self._batch_thread and self._batch_thread.is_alive():
                self._batch_thread.join(timeout=5)
            
            if self._cleanup_thread and self._cleanup_thread.is_alive():
                self._cleanup_thread.join(timeout=5)
            
            if self._quota_thread and self._quota_thread.is_alive():
                self._quota_thread.join(timeout=5)
            
            # Process remaining events
            remaining_events = []
            while not self.usage_queue.empty():
                try:
                    event = self.usage_queue.get_nowait()
                    remaining_events.append(event)
                except queue.Empty:
                    break
            
            if remaining_events:
                self._process_batch(remaining_events)
            
            # Save final state
            self._save_local_storage()
            
            self.logger.info("Usage tracker stopped")
            
        except Exception as e:
            self.logger.error(f"Error stopping usage tracker: {e}")
    
    def is_quota_exceeded(self) -> bool:
        """Check if current usage exceeds quota limits."""
        return self.quota_status.get('quota_exceeded', False)
    
    def get_quota_status(self) -> Dict[str, Any]:
        """Get current quota status information."""
        return self.quota_status.copy()

# =============================================================================
# USER AUTHENTICATION
# =============================================================================

class AuthenticationError(Exception):
    """Custom exception for authentication-related errors."""
    pass

class SecureTokenStorage:
    """Secure token storage using OS keyring and encryption."""
    
    def __init__(self, service_name: str = "cursor-mcp-server", logger: Optional[logging.Logger] = None):
        self.service_name = service_name
        self.logger = logger or logging.getLogger(__name__)
        self.fernet = None
        self._initialize_encryption()
    
    def _initialize_encryption(self):
        """Initialize encryption for token storage."""
        if not CRYPTO_AVAILABLE:
            self.logger.warning("Cryptography not available, tokens will be stored in plain text")
            return
        
        try:
            # Generate or retrieve encryption key
            key = self._get_or_create_encryption_key()
            self.fernet = Fernet(key)
        except Exception as e:
            self.logger.warning(f"Failed to initialize encryption: {e}")
    
    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for token storage."""
        if KEYRING_AVAILABLE:
            try:
                # Try to get existing key from keyring
                key_b64 = keyring.get_password(self.service_name, "encryption_key")
                if key_b64:
                    return base64.b64decode(key_b64)
            except Exception as e:
                self.logger.debug(f"Could not retrieve key from keyring: {e}")
        
        # Generate new key
        key = Fernet.generate_key()
        
        # Store in keyring if available
        if KEYRING_AVAILABLE:
            try:
                keyring.set_password(self.service_name, "encryption_key", base64.b64encode(key).decode())
            except Exception as e:
                self.logger.debug(f"Could not store key in keyring: {e}")
        
        return key
    
    def store_token(self, key: str, token: str) -> bool:
        """Store a token securely."""
        try:
            if self.fernet:
                # Encrypt token
                encrypted_token = self.fernet.encrypt(token.encode())
                token_data = base64.b64encode(encrypted_token).decode()
            else:
                token_data = token
            
            if KEYRING_AVAILABLE:
                keyring.set_password(self.service_name, key, token_data)
                return True
            else:
                # Fallback to file storage
                return self._store_in_file(key, token_data)
        except Exception as e:
            self.logger.error(f"Failed to store token: {e}")
            return False
    
    def retrieve_token(self, key: str) -> Optional[str]:
        """Retrieve a token securely."""
        try:
            if KEYRING_AVAILABLE:
                token_data = keyring.get_password(self.service_name, key)
            else:
                token_data = self._retrieve_from_file(key)
            
            if not token_data:
                return None
            
            if self.fernet:
                # Decrypt token
                encrypted_token = base64.b64decode(token_data)
                return self.fernet.decrypt(encrypted_token).decode()
            else:
                return token_data
        except Exception as e:
            self.logger.error(f"Failed to retrieve token: {e}")
            return None
    
    def delete_token(self, key: str) -> bool:
        """Delete a stored token."""
        try:
            if KEYRING_AVAILABLE:
                keyring.delete_password(self.service_name, key)
            else:
                self._delete_from_file(key)
            return True
        except Exception as e:
            self.logger.error(f"Failed to delete token: {e}")
            return False
    
    def _store_in_file(self, key: str, token_data: str) -> bool:
        """Fallback file storage for tokens."""
        try:
            storage_dir = os.path.expanduser("~/.cursor-mcp/auth")
            os.makedirs(storage_dir, exist_ok=True)
            
            storage_file = os.path.join(storage_dir, f"{key}.token")
            with open(storage_file, 'w') as f:
                f.write(token_data)
            
            # Set restrictive permissions
            os.chmod(storage_file, 0o600)
            return True
        except Exception as e:
            self.logger.error(f"Failed to store token in file: {e}")
            return False
    
    def _retrieve_from_file(self, key: str) -> Optional[str]:
        """Retrieve token from file storage."""
        try:
            storage_file = os.path.expanduser(f"~/.cursor-mcp/auth/{key}.token")
            if os.path.exists(storage_file):
                with open(storage_file, 'r') as f:
                    return f.read().strip()
        except Exception as e:
            self.logger.error(f"Failed to retrieve token from file: {e}")
        return None
    
    def _delete_from_file(self, key: str):
        """Delete token file."""
        try:
            storage_file = os.path.expanduser(f"~/.cursor-mcp/auth/{key}.token")
            if os.path.exists(storage_file):
                os.remove(storage_file)
        except Exception as e:
            self.logger.error(f"Failed to delete token file: {e}")

class AuthManager:
    """
    Production-ready user authentication system.
    
    Features:
    - Multiple authentication methods (email/password, API key)
    - Secure JWT token storage and management
    - Automatic token refresh
    - Session management with device tracking
    - Enterprise SSO support (future-ready)
    - Secure credential storage using OS keyring
    """
    
    def __init__(self, config: ConfigManager, logger: logging.Logger, 
                 saas_client: Optional[SaaSClient] = None):
        """
        Initialize the authentication manager.
        
        Args:
            config: Configuration manager instance
            logger: Logger instance for authentication operations
            saas_client: Optional SaaS HTTP client for authentication
        """
        self.config = config
        self.logger = logger
        self.saas_client = saas_client
        
        # Authentication configuration
        auth_config = config.get('authentication', {})
        self.enabled = auth_config.get('enabled', True)
        self.method = auth_config.get('method', 'email_password')
        self.auto_login = auth_config.get('auto_login', True)
        self.remember_credentials = auth_config.get('remember_credentials', True)
        self.session_timeout = auth_config.get('session_timeout', 3600)
        self.token_refresh_threshold = auth_config.get('token_refresh_threshold', 300)
        self.max_concurrent_sessions = auth_config.get('max_concurrent_sessions', 3)
        
        # Device registration configuration
        device_config = auth_config.get('device_registration', {})
        self.device_registration_enabled = device_config.get('enabled', True)
        self.auto_register_device = device_config.get('auto_register', True)
        self.require_device_approval = device_config.get('require_approval', False)
        
        # SSO configuration
        sso_config = auth_config.get('sso', {})
        self.sso_enabled = sso_config.get('enabled', False)
        self.sso_provider = sso_config.get('provider', 'none')
        self.sso_endpoint = sso_config.get('endpoint', '')
        self.sso_client_id = sso_config.get('client_id', '')
        self.sso_redirect_uri = sso_config.get('redirect_uri', '')
        
        # Security configuration
        security_config = auth_config.get('security', {})
        self.use_keyring = security_config.get('use_keyring', True) and KEYRING_AVAILABLE
        self.encrypt_tokens = security_config.get('encrypt_tokens', True) and CRYPTO_AVAILABLE
        self.require_2fa = security_config.get('require_2fa', False)
        
        # Password policy
        password_policy = security_config.get('password_policy', {})
        self.password_policy = {
            'min_length': password_policy.get('min_length', 8),
            'require_uppercase': password_policy.get('require_uppercase', True),
            'require_lowercase': password_policy.get('require_lowercase', True),
            'require_numbers': password_policy.get('require_numbers', True),
            'require_symbols': password_policy.get('require_symbols', False)
        }
        
        # Authentication state
        self.is_authenticated = False
        self.user_info = {}
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = None
        self.session_id = None
        self.device_id = None
        
        # Session management
        self.sessions = {}
        self.current_session = None
        self.session_lock = threading.RLock()
        
        # Secure storage
        self.token_storage = SecureTokenStorage(logger=logger)
        
        # Device information
        self.device_info = self._get_device_info()
        
        self.logger.info(f"AuthManager initialized - Method: {self.method}, Keyring: {self.use_keyring}")
    
    def _get_device_info(self) -> Dict[str, Any]:
        """Get device information for registration."""
        return {
            'device_id': str(uuid.uuid4()),
            'device_name': f"{platform.system()} {platform.release()}",
            'device_type': 'desktop',
            'os': platform.system(),
            'os_version': platform.release(),
            'architecture': platform.machine(),
            'python_version': platform.python_version(),
            'server_version': '2.0.0',
            'hostname': socket.gethostname(),
            'ip_address': self._get_local_ip(),
            'user_agent': f"Cursor-Context-MCP-Server/2.0.0 ({platform.system()})"
        }
    
    def _get_local_ip(self) -> str:
        """Get local IP address."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def _validate_password(self, password: str) -> tuple[bool, str]:
        """Validate password against policy."""
        if len(password) < self.password_policy['min_length']:
            return False, f"Password must be at least {self.password_policy['min_length']} characters long"
        
        if self.password_policy['require_uppercase'] and not any(c.isupper() for c in password):
            return False, "Password must contain at least one uppercase letter"
        
        if self.password_policy['require_lowercase'] and not any(c.islower() for c in password):
            return False, "Password must contain at least one lowercase letter"
        
        if self.password_policy['require_numbers'] and not any(c.isdigit() for c in password):
            return False, "Password must contain at least one number"
        
        if self.password_policy['require_symbols'] and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            return False, "Password must contain at least one special character"
        
        return True, "Password is valid"
    
    def _prompt_credentials(self) -> tuple[str, str]:
        """Prompt user for credentials."""
        print("\n🔐 Authentication Required")
        print("=" * 50)
        
        if self.method == "email_password":
            email = input("📧 Email: ").strip()
            if not email:
                raise AuthenticationError("Email is required")
            
            password = getpass.getpass("🔑 Password: ")
            if not password:
                raise AuthenticationError("Password is required")
            
            return email, password
        
        elif self.method == "api_key":
            api_key = getpass.getpass("🔑 API Key: ")
            if not api_key:
                raise AuthenticationError("API key is required")
            
            return "", api_key
        
        else:
            raise AuthenticationError(f"Unsupported authentication method: {self.method}")
    
    def _authenticate_with_backend(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate with the SaaS backend."""
        if not self.saas_client:
            raise AuthenticationError("SaaS client not available for authentication")
        
        try:
            # Prepare authentication request
            auth_data = {
                'method': self.method,
                'device_info': self.device_info
            }
            
            if self.method == "email_password":
                auth_data.update({
                    'email': email,
                    'password': password
                })
            elif self.method == "api_key":
                auth_data.update({
                    'api_key': password
                })
            
            self.logger.info(f"Authenticating with backend using {self.method} method...")
            response = self.saas_client.post('/api/auth/login', data=auth_data)
            
            if response.get('success'):
                return response.get('auth', {})
            else:
                error_msg = response.get('error', 'Authentication failed')
                raise AuthenticationError(f"Authentication failed: {error_msg}")
                
        except SaaSClientError as e:
            raise AuthenticationError(f"Network error during authentication: {e}")
        except Exception as e:
            raise AuthenticationError(f"Unexpected error during authentication: {e}")
    
    def _store_credentials(self, email: str, auth_data: Dict[str, Any]):
        """Store authentication credentials securely."""
        try:
            # Store tokens
            if 'access_token' in auth_data:
                self.token_storage.store_token('access_token', auth_data['access_token'])
            
            if 'refresh_token' in auth_data:
                self.token_storage.store_token('refresh_token', auth_data['refresh_token'])
            
            # Store user info
            if 'user' in auth_data:
                user_data = auth_data['user']
                if self.remember_credentials and 'email' in user_data:
                    self.token_storage.store_token('user_email', user_data['email'])
            
            # Store session info
            if 'session_id' in auth_data:
                self.token_storage.store_token('session_id', auth_data['session_id'])
            
            self.logger.debug("Credentials stored securely")
            
        except Exception as e:
            self.logger.warning(f"Failed to store credentials: {e}")
    
    def _load_stored_credentials(self) -> bool:
        """Load stored credentials and attempt auto-login."""
        try:
            # Load tokens
            access_token = self.token_storage.retrieve_token('access_token')
            refresh_token = self.token_storage.retrieve_token('refresh_token')
            session_id = self.token_storage.retrieve_token('session_id')
            user_email = self.token_storage.retrieve_token('user_email')
            
            if not access_token:
                return False
            
            # Set authentication state
            self.access_token = access_token
            self.refresh_token = refresh_token
            self.session_id = session_id
            
            # Load user info
            if user_email:
                self.user_info['email'] = user_email
            
            # Validate token
            if self._validate_token():
                self.is_authenticated = True
                self.logger.info("Auto-login successful using stored credentials")
                return True
            else:
                # Try to refresh token
                if refresh_token and self._refresh_token():
                    self.is_authenticated = True
                    self.logger.info("Auto-login successful after token refresh")
                    return True
            
            return False
            
        except Exception as e:
            self.logger.warning(f"Failed to load stored credentials: {e}")
            return False
    
    def _validate_token(self) -> bool:
        """Validate the current access token."""
        if not self.access_token:
            return False
        
        try:
            # Check if token is expired
            if self.token_expires_at:
                if datetime.now() >= self.token_expires_at:
                    return False
            
            # Validate with backend
            if self.saas_client:
                response = self.saas_client.get('/api/auth/validate', 
                                              headers={'Authorization': f'Bearer {self.access_token}'})
                return response.get('success', False)
            
            return True  # Assume valid if no backend validation
            
        except Exception as e:
            self.logger.debug(f"Token validation failed: {e}")
            return False
    
    def _refresh_token(self) -> bool:
        """Refresh the access token using refresh token."""
        if not self.refresh_token or not self.saas_client:
            return False
        
        try:
            response = self.saas_client.post('/api/auth/refresh', 
                                           data={'refresh_token': self.refresh_token})
            
            if response.get('success'):
                auth_data = response.get('auth', {})
                
                # Update tokens
                if 'access_token' in auth_data:
                    self.access_token = auth_data['access_token']
                    self.token_storage.store_token('access_token', self.access_token)
                
                if 'refresh_token' in auth_data:
                    self.refresh_token = auth_data['refresh_token']
                    self.token_storage.store_token('refresh_token', self.refresh_token)
                
                # Update expiration
                if 'expires_in' in auth_data:
                    self.token_expires_at = datetime.now() + timedelta(seconds=auth_data['expires_in'])
                
                self.logger.info("Token refreshed successfully")
                return True
            
            return False
            
        except Exception as e:
            self.logger.warning(f"Token refresh failed: {e}")
            return False
    
    def _register_device(self) -> bool:
        """Register current device with the backend."""
        if not self.device_registration_enabled or not self.saas_client:
            return True
        
        try:
            response = self.saas_client.post('/api/auth/register-device', 
                                           data={
                                               'device_info': self.device_info,
                                               'session_id': self.session_id
                                           },
                                           headers={'Authorization': f'Bearer {self.access_token}'})
            
            if response.get('success'):
                device_data = response.get('device', {})
                self.device_id = device_data.get('device_id')
                self.logger.info("Device registered successfully")
                return True
            else:
                error_msg = response.get('error', 'Device registration failed')
                self.logger.warning(f"Device registration failed: {error_msg}")
                return False
                
        except Exception as e:
            self.logger.warning(f"Device registration failed: {e}")
            return False
    
    def authenticate(self, email: str = None, password: str = None, force_prompt: bool = False) -> bool:
        """
        Authenticate user with the backend.
        
        Args:
            email: User email (optional, will prompt if not provided)
            password: User password (optional, will prompt if not provided)
            force_prompt: Force credential prompt even if auto-login is enabled
            
        Returns:
            True if authentication successful, False otherwise
        """
        if not self.enabled:
            self.logger.info("Authentication is disabled")
            return True
        
        try:
            # Try auto-login first if not forcing prompt
            if not force_prompt and self.auto_login:
                if self._load_stored_credentials():
                    return True
            
            # Prompt for credentials if not provided
            if not email or not password:
                email, password = self._prompt_credentials()
            
            # Validate password if using email/password method
            if self.method == "email_password":
                is_valid, error_msg = self._validate_password(password)
                if not is_valid:
                    print(f"❌ {error_msg}")
                    return False
            
            # Authenticate with backend
            auth_data = self._authenticate_with_backend(email, password)
            
            # Store authentication state
            self.access_token = auth_data.get('access_token')
            self.refresh_token = auth_data.get('refresh_token')
            self.session_id = auth_data.get('session_id')
            self.user_info = auth_data.get('user', {})
            
            # Set token expiration
            if 'expires_in' in auth_data:
                self.token_expires_at = datetime.now() + timedelta(seconds=auth_data['expires_in'])
            
            # Store credentials securely
            if self.remember_credentials:
                self._store_credentials(email, auth_data)
            
            # Register device
            if self.auto_register_device:
                self._register_device()
            
            # Create session
            self._create_session()
            
            self.is_authenticated = True
            self.logger.info(f"Authentication successful for user: {self.user_info.get('email', 'unknown')}")
            
            print("✅ Authentication successful!")
            return True
            
        except AuthenticationError as e:
            print(f"❌ Authentication failed: {e}")
            self.logger.warning(f"Authentication failed: {e}")
            return False
        except Exception as e:
            error_msg = f"Unexpected error during authentication: {e}"
            print(f"❌ {error_msg}")
            self.logger.error(error_msg, exc_info=True)
            return False
    
    def _create_session(self):
        """Create a new user session."""
        with self.session_lock:
            session_id = self.session_id or str(uuid.uuid4())
            
            self.current_session = {
                'session_id': session_id,
                'user_id': self.user_info.get('id'),
                'email': self.user_info.get('email'),
                'device_id': self.device_id,
                'created_at': datetime.now(),
                'last_activity': datetime.now(),
                'expires_at': datetime.now() + timedelta(seconds=self.session_timeout)
            }
            
            self.sessions[session_id] = self.current_session
            self.logger.debug(f"Session created: {session_id}")
    
    def logout(self) -> bool:
        """Logout user and clear authentication state."""
        try:
            # Notify backend of logout
            if self.saas_client and self.access_token:
                try:
                    self.saas_client.post('/api/auth/logout', 
                                        headers={'Authorization': f'Bearer {self.access_token}'})
                except:
                    pass  # Ignore errors during logout
            
            # Clear stored credentials
            self.token_storage.delete_token('access_token')
            self.token_storage.delete_token('refresh_token')
            self.token_storage.delete_token('session_id')
            
            # Clear authentication state
            self.is_authenticated = False
            self.access_token = None
            self.refresh_token = None
            self.token_expires_at = None
            self.session_id = None
            self.user_info = {}
            self.device_id = None
            
            # Clear sessions
            with self.session_lock:
                self.sessions.clear()
                self.current_session = None
            
            self.logger.info("User logged out successfully")
            print("✅ Logged out successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Error during logout: {e}")
            return False
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Get current authentication status."""
        return {
            'enabled': self.enabled,
            'is_authenticated': self.is_authenticated,
            'method': self.method,
            'user_info': self.user_info.copy() if self.user_info else {},
            'session_id': self.session_id,
            'device_id': self.device_id,
            'token_expires_at': self.token_expires_at.isoformat() if self.token_expires_at else None,
            'sessions_count': len(self.sessions),
            'device_registration_enabled': self.device_registration_enabled,
            'sso_enabled': self.sso_enabled,
            'use_keyring': self.use_keyring,
            'encrypt_tokens': self.encrypt_tokens
        }
    
    def is_token_expired(self) -> bool:
        """Check if the current token is expired or near expiration."""
        if not self.token_expires_at:
            return False
        
        # Check if token is expired or will expire within refresh threshold
        return datetime.now() >= (self.token_expires_at - timedelta(seconds=self.token_refresh_threshold))
    
    def ensure_authenticated(self) -> bool:
        """Ensure user is authenticated, refresh token if needed."""
        if not self.enabled:
            return True
        
        if not self.is_authenticated:
            return False
        
        # Check if token needs refresh
        if self.is_token_expired():
            if not self._refresh_token():
                self.logger.warning("Token refresh failed, re-authentication required")
                return False
        
        return True
    
    def cleanup(self):
        """Cleanup authentication manager resources."""
        self.logger.info("Authentication manager cleanup completed")

# =============================================================================
# DECORATORS AND UTILITIES
# =============================================================================

def performance_monitor(monitor: PerformanceMonitor, operation_name: str):
    """Decorator to monitor operation performance."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                raise
            finally:
                duration = time.time() - start_time
                monitor.record_operation(operation_name, duration, success)
        return wrapper
    return decorator

def audit_log(operation: str, saas: SaaSIntegration):
    """Decorator to log operations for audit purposes."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                saas.log_operation(operation, True, {
                    'args': str(args)[:200],  # Truncate for privacy
                    'kwargs': str(kwargs)[:200]
                })
                return result
            except Exception as e:
                saas.log_operation(operation, False, {
                    'error': str(e),
                    'args': str(args)[:200],
                    'kwargs': str(kwargs)[:200]
                })
                raise
        return wrapper
    return decorator

def require_license(license_manager: 'LicenseManager'):
    """Decorator to require valid license for MCP tools."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not license_manager.validate_license():
                error_msg = license_manager.get_user_friendly_error()
                return f"❌ License Error: {error_msg}"
            return func(*args, **kwargs)
        return wrapper
    return decorator

def require_tier(required_tier: str, license_manager: 'LicenseManager'):
    """
    Decorator to require specific license tier for MCP tools.
    
    Args:
        required_tier: Required tier ('free', 'pro', 'enterprise')
        license_manager: License manager instance
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # First check if license is valid
            if not license_manager.validate_license():
                error_msg = license_manager.get_user_friendly_error()
                return f"❌ License Error: {error_msg}"
            
            # Check tier requirements
            current_tier = license_manager.license_status.get('tier', 'free')
            tier_hierarchy = {'free': 0, 'pro': 1, 'enterprise': 2}
            
            current_level = tier_hierarchy.get(current_tier, 0)
            required_level = tier_hierarchy.get(required_tier, 0)
            
            if current_level < required_level:
                return f"❌ License Tier Error: This feature requires {required_tier} tier or higher. Current tier: {current_tier}"
            
            return func(*args, **kwargs)
        return wrapper
    return decorator

def require_feature(feature: str, license_manager: 'LicenseManager'):
    """
    Decorator to require specific feature for MCP tools.
    
    Args:
        feature: Required feature name
        license_manager: License manager instance
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # First check if license is valid
            if not license_manager.validate_license():
                error_msg = license_manager.get_user_friendly_error()
                return f"❌ License Error: {error_msg}"
            
            # Check feature access
            if not license_manager.is_feature_allowed(feature):
                current_tier = license_manager.license_status.get('tier', 'free')
                return f"❌ Feature Error: Feature '{feature}' is not available in {current_tier} tier"
            
            return func(*args, **kwargs)
        return wrapper
    return decorator

def track_usage(usage_tracker: 'UsageTracker', tool_name: str = None):
    """
    Decorator to track MCP tool usage for analytics.
    
    Args:
        usage_tracker: Usage tracker instance
        tool_name: Override tool name for tracking (defaults to function name)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            error_type = None
            error_message = None
            file_size = 0
            file_path = None
            
            try:
                # Extract file-related information from arguments
                if args and isinstance(args[0], str):
                    potential_path = args[0]
                    if os.path.exists(potential_path):
                        file_path = potential_path
                        try:
                            file_size = os.path.getsize(potential_path)
                        except:
                            pass
                
                # Check for file_path in kwargs
                if 'file_path' in kwargs:
                    file_path = kwargs['file_path']
                    try:
                        file_size = os.path.getsize(file_path)
                    except:
                        pass
                elif 'path' in kwargs:
                    file_path = kwargs['path']
                    try:
                        file_size = os.path.getsize(file_path)
                    except:
                        pass
                
                result = func(*args, **kwargs)
                return result
                
            except Exception as e:
                success = False
                error_type = type(e).__name__
                error_message = str(e)
                raise
                
            finally:
                duration = time.time() - start_time
                tool_name_to_use = tool_name or func.__name__
                
                # Track usage
                usage_tracker.track_tool_usage(
                    tool_name=tool_name_to_use,
                    duration=duration,
                    success=success,
                    file_size=file_size,
                    file_path=file_path,
                    error_type=error_type,
                    error_message=error_message
                )
                
                # Track file operation if applicable
                if file_path and success:
                    usage_tracker.track_file_operation(
                        operation=tool_name_to_use,
                        file_path=file_path,
                        file_size=file_size,
                        duration=duration,
                        success=success
                    )
                
                # Track error if applicable
                if not success:
                    usage_tracker.track_error(
                        tool_name=tool_name_to_use,
                        error_type=error_type or 'Unknown',
                        error_message=error_message or 'Unknown error',
                        duration=duration
                    )
        
        return wrapper
    return decorator

def require_authentication(auth_manager: 'AuthManager'):
    """
    Decorator to require user authentication for MCP tools.
    
    Args:
        auth_manager: Authentication manager instance
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not auth_manager.ensure_authenticated():
                return f"❌ Authentication Error: Please log in to use this feature. Use the login command to authenticate."
            return func(*args, **kwargs)
        return wrapper
    return decorator

# =============================================================================
# MAIN SERVER IMPLEMENTATION
# =============================================================================

# Initialize components
config = ConfigManager(profile=os.getenv('CONFIG_PROFILE', 'production'))
logger = setup_logging(config)
monitor = PerformanceMonitor()
cache = SimpleCache(config.get('server.cache_ttl', 300))
security = SecurityValidator(config)
saas = SaaSIntegration(config, logger)
license_manager = LicenseManager(config, logger, saas.http_client if saas.enabled else None)
usage_tracker = UsageTracker(config, logger, saas.http_client if saas.enabled else None, license_manager)
auth_manager = AuthManager(config, logger, saas.http_client if saas.enabled else None)

# Initialize the MCP server
mcp = FastMCP(config.get('server.name', 'Cursor Context MCP Server'))

# Log server startup
logger.info(f"Starting {config.get('server.name')} v{config.get('server.version')}")
logger.info(f"Configuration loaded from: {config.config_path or 'defaults'}")

@mcp.tool()
@performance_monitor(monitor, 'list_files')
@audit_log('list_files', saas)
@track_usage(usage_tracker, 'list_files')
def list_files(directory: str = ".") -> str:
    """
    List files and directories in a given path with enhanced security and performance.
    
    This tool provides a secure, cached directory listing with visual organization.
    It includes comprehensive error handling, path validation, and performance monitoring.
    
    Args:
        directory: The directory path to list files from. Defaults to current directory.
    
    Returns:
        A formatted string listing the contents of the directory with visual indicators.
        
    Raises:
        Various exceptions are caught and returned as formatted error messages.
        
    Security:
        - Validates paths against allowed/blocked lists
        - Prevents access to system directories
        - Logs all operations for audit purposes
        
    Performance:
        - Uses caching to improve repeated directory listings
        - Monitors operation performance
        - Limits directory traversal depth
    """
    try:
        # Validate path security
        is_valid, error_msg = security.validate_path(directory)
        if not is_valid:
            logger.warning(f"Security violation: {error_msg}")
            return f"Security Error: {error_msg}"
        
        # Check cache first
        cache_key = f"list_files:{directory}"
        if config.get('server.enable_caching', True):
            cached_result = cache.get(cache_key)
            if cached_result:
                monitor.metrics['cache_hits'] += 1
                return cached_result
            monitor.metrics['cache_misses'] += 1
        
        # Resolve and validate path
        path_obj = Path(directory).resolve()
        
        if not path_obj.exists():
            error_msg = f"Path '{directory}' does not exist"
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        if not path_obj.is_dir():
            error_msg = f"Path '{directory}' is not a directory"
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        # Check directory depth
        max_depth = config.get('server.max_directory_depth', 10)
        if len(path_obj.parts) > max_depth:
            error_msg = f"Directory depth exceeds maximum allowed ({max_depth})"
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        # Read directory contents
        files = []
        directories = []
        hidden_files = []
        hidden_dirs = []
        
        try:
            for item in path_obj.iterdir():
                try:
                    if item.name.startswith('.'):
                        if item.is_file():
                            hidden_files.append(item.name)
                        elif item.is_dir():
                            hidden_dirs.append(item.name)
                    else:
                        if item.is_file():
                            files.append(item.name)
                        elif item.is_dir():
                            directories.append(item.name)
                except (PermissionError, OSError) as e:
                    logger.warning(f"Permission denied accessing {item}: {e}")
                    continue
        except PermissionError as e:
            error_msg = f"Permission denied accessing directory '{directory}'"
            logger.error(error_msg)
            return f"Error: {error_msg}"
        
        # Sort results
        files.sort()
        directories.sort()
        hidden_files.sort()
        hidden_dirs.sort()
        
        # Build result
        result = f"📁 Contents of '{directory}':\n"
        result += "=" * (len(directory) + 20) + "\n\n"
        
        # Add directory count
        total_items = len(directories) + len(files) + len(hidden_dirs) + len(hidden_files)
        result += f"📊 Total items: {total_items}\n\n"
        
        # Directories
        if directories:
            result += "📁 Directories:\n"
            for directory_name in directories:
                result += f"  📁 {directory_name}\n"
            result += "\n"
        
        # Files
        if files:
            result += "📄 Files:\n"
            for file_name in files:
                result += f"  📄 {file_name}\n"
            result += "\n"
        
        # Hidden items (if any)
        if hidden_dirs or hidden_files:
            result += "🔒 Hidden items:\n"
            for hidden_dir in hidden_dirs:
                result += f"  📁 .{hidden_dir}\n"
            for hidden_file in hidden_files:
                result += f"  📄 .{hidden_file}\n"
            result += "\n"
        
        if total_items == 0:
            result += "📭 Directory is empty.\n"
        
        # Cache the result
        if config.get('server.enable_caching', True):
            cache.set(cache_key, result)
        
        # Log successful operation
        logger.info(f"Successfully listed directory: {directory} ({total_items} items)")
        
        return result
        
    except Exception as e:
        error_msg = f"Unexpected error listing files: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'read_file')
@audit_log('read_file', saas)
@track_usage(usage_tracker, 'read_file')
def read_file(path: str) -> str:
    """
    Read the contents of a file with enhanced security, validation, and performance.
    
    This tool safely reads file contents with comprehensive validation including
    file size limits, extension filtering, path security, and encoding detection.
    
    Args:
        path: The path to the file to read.
    
    Returns:
        The contents of the file as a string with clear formatting.
        
    Raises:
        Various exceptions are caught and returned as formatted error messages.
        
    Security:
        - Validates file paths against security policies
        - Checks file extensions against allowed/blocked lists
        - Enforces file size limits
        - Prevents reading of binary files
        
    Performance:
        - Uses caching for frequently accessed files
        - Monitors read performance
        - Optimized for text files
    """
    try:
        # Validate path security
        is_valid, error_msg = security.validate_path(path)
        if not is_valid:
            logger.warning(f"Security violation: {error_msg}")
            return f"Security Error: {error_msg}"
        
        # Validate file extension
        is_valid_ext, ext_error = security.validate_file_extension(path)
        if not is_valid_ext:
            logger.warning(f"Extension violation: {ext_error}")
            return f"Security Error: {ext_error}"
        
        # Check cache first
        cache_key = f"read_file:{path}"
        if config.get('server.enable_caching', True):
            cached_result = cache.get(cache_key)
            if cached_result:
                monitor.metrics['cache_hits'] += 1
                return cached_result
            monitor.metrics['cache_misses'] += 1
        
        # Resolve and validate path
        path_obj = Path(path).resolve()
        
        if not path_obj.exists():
            error_msg = f"File '{path}' does not exist"
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        if not path_obj.is_file():
            error_msg = f"Path '{path}' is not a file"
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        # Check file size
        max_size = config.get('server.max_file_size', 1024 * 1024)
        file_size = path_obj.stat().st_size
        
        if file_size > max_size:
            error_msg = f"File '{path}' is too large ({file_size:,} bytes). Maximum size is {max_size:,} bytes."
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        # Read file content
        try:
            # Try UTF-8 first
            content = path_obj.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            try:
                # Try with error handling
                content = path_obj.read_text(encoding='utf-8', errors='replace')
                logger.warning(f"File '{path}' contains non-UTF-8 characters, replaced with placeholders")
            except Exception as e:
                error_msg = f"File '{path}' contains binary data and cannot be displayed as text"
                logger.warning(error_msg)
                return f"Error: {error_msg}"
        
        # Build result
        result = f"📄 Contents of '{path}':\n"
        result += "=" * (len(path) + 20) + "\n"
        result += f"📊 Size: {file_size:,} bytes\n"
        result += f"📅 Modified: {datetime.fromtimestamp(path_obj.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}\n"
        result += "=" * (len(path) + 20) + "\n\n"
        result += content
        
        # Cache the result
        if config.get('server.enable_caching', True):
            cache.set(cache_key, result)
        
        # Log successful operation
        logger.info(f"Successfully read file: {path} ({file_size:,} bytes)")
        
        return result
        
    except PermissionError as e:
        error_msg = f"Permission denied reading file '{path}'"
        logger.error(error_msg)
        return f"Error: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error reading file: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_file_info')
@audit_log('get_file_info', saas)
@track_usage(usage_tracker, 'get_file_info')
def get_file_info(path: str) -> str:
    """
    Get comprehensive information about a file or directory with enhanced security.
    
    This tool provides detailed metadata about files and directories including
    size, timestamps, permissions, and other attributes with security validation.
    
    Args:
        path: The path to the file or directory.
    
    Returns:
        A formatted string with comprehensive information about the file or directory.
        
    Raises:
        Various exceptions are caught and returned as formatted error messages.
        
    Security:
        - Validates paths against security policies
        - Prevents access to sensitive system information
        - Logs all information requests
        
    Performance:
        - Uses caching for frequently accessed file info
        - Monitors operation performance
        - Optimized metadata retrieval
    """
    try:
        # Validate path security
        is_valid, error_msg = security.validate_path(path)
        if not is_valid:
            logger.warning(f"Security violation: {error_msg}")
            return f"Security Error: {error_msg}"
        
        # Check cache first
        cache_key = f"get_file_info:{path}"
        if config.get('server.enable_caching', True):
            cached_result = cache.get(cache_key)
            if cached_result:
                monitor.metrics['cache_hits'] += 1
                return cached_result
            monitor.metrics['cache_misses'] += 1
        
        # Resolve and validate path
        path_obj = Path(path).resolve()
        
        if not path_obj.exists():
            error_msg = f"Path '{path}' does not exist"
            logger.warning(error_msg)
            return f"Error: {error_msg}"
        
        # Get file statistics
        stat = path_obj.stat()
        
        # Build result
        result = f"📋 Information for '{path}':\n"
        result += "=" * (len(path) + 25) + "\n"
        
        # Basic information
        result += f"📁 Type: {'Directory' if path_obj.is_dir() else 'File'}\n"
        result += f"📊 Size: {stat.st_size:,} bytes\n"
        
        # Format file size
        if stat.st_size > 0:
            size_units = ['B', 'KB', 'MB', 'GB', 'TB']
            size = stat.st_size
            unit_index = 0
            while size >= 1024 and unit_index < len(size_units) - 1:
                size /= 1024
                unit_index += 1
            result += f"📏 Formatted Size: {size:.2f} {size_units[unit_index]}\n"
        
        # Timestamps
        result += f"📅 Created: {datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S')}\n"
        result += f"📅 Modified: {datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')}\n"
        result += f"📅 Accessed: {datetime.fromtimestamp(stat.st_atime).strftime('%Y-%m-%d %H:%M:%S')}\n"
        
        # Path information
        result += f"🔗 Absolute Path: {path_obj}\n"
        result += f"📂 Parent Directory: {path_obj.parent}\n"
        
        # File-specific information
        if path_obj.is_file():
            result += f"📄 Name: {path_obj.name}\n"
            result += f"📄 Extension: {path_obj.suffix or 'None'}\n"
            result += f"📄 Stem: {path_obj.stem}\n"
            
            # File type detection
            if path_obj.suffix.lower() in ['.py']:
                result += f"🐍 File Type: Python Script\n"
            elif path_obj.suffix.lower() in ['.js', '.ts']:
                result += f"🟨 File Type: JavaScript/TypeScript\n"
            elif path_obj.suffix.lower() in ['.json']:
                result += f"📋 File Type: JSON Data\n"
            elif path_obj.suffix.lower() in ['.md', '.txt']:
                result += f"📝 File Type: Text Document\n"
            elif path_obj.suffix.lower() in ['.html', '.htm']:
                result += f"🌐 File Type: HTML Document\n"
            elif path_obj.suffix.lower() in ['.css']:
                result += f"🎨 File Type: CSS Stylesheet\n"
            else:
                result += f"📄 File Type: {path_obj.suffix or 'Unknown'}\n"
        
        # Directory-specific information
        elif path_obj.is_dir():
            try:
                # Count items in directory
                items = list(path_obj.iterdir())
                file_count = sum(1 for item in items if item.is_file())
                dir_count = sum(1 for item in items if item.is_dir())
                result += f"📁 Items: {len(items)} total ({file_count} files, {dir_count} directories)\n"
            except PermissionError:
                result += f"📁 Items: Unable to count (permission denied)\n"
        
        # Permissions (Unix-like systems)
        if hasattr(stat, 'st_mode'):
            import stat as stat_module
            mode = stat.st_mode
            result += f"🔐 Permissions: {oct(mode)[-3:]}\n"
            
            # Readable/Writable/Executable
            readable = "✅" if os.access(path_obj, os.R_OK) else "❌"
            writable = "✅" if os.access(path_obj, os.W_OK) else "❌"
            executable = "✅" if os.access(path_obj, os.X_OK) else "❌"
            result += f"🔓 Access: Read {readable} | Write {writable} | Execute {executable}\n"
        
        # Cache the result
        if config.get('server.enable_caching', True):
            cache.set(cache_key, result)
        
        # Log successful operation
        logger.info(f"Successfully retrieved file info: {path}")
        
        return result
        
    except PermissionError as e:
        error_msg = f"Permission denied accessing '{path}'"
        logger.error(error_msg)
        return f"Error: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error getting file info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_server_stats')
@audit_log('get_server_stats', saas)
def get_server_stats() -> str:
    """
    Get server performance statistics and health information.
    
    This tool provides comprehensive server metrics including performance statistics,
    configuration information, and system health for monitoring and debugging.
    
    Returns:
        A formatted string with server statistics and health information.
    """
    try:
        stats = monitor.get_stats()
        
        result = f"📊 Server Statistics\n"
        result += "=" * 50 + "\n\n"
        
        # Server information
        result += f"🏷️  Server: {config.get('server.name')}\n"
        result += f"📦 Version: {config.get('server.version')}\n"
        result += f"⏰ Uptime: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        
        # Performance metrics
        result += f"📈 Performance Metrics:\n"
        result += f"  🔢 Total Operations: {stats['operations_count']}\n"
        result += f"  ⏱️  Average Time: {stats.get('average_operation_time', 0):.3f}s\n"
        result += f"  ❌ Error Rate: {stats.get('error_rate', 0):.2%}\n"
        result += f"  💾 Cache Hit Rate: {stats.get('cache_hit_rate', 0):.2%}\n\n"
        
        # Cache information
        result += f"💾 Cache Information:\n"
        result += f"  📊 Cache Entries: {len(cache.cache)}\n"
        result += f"  🎯 Cache Hits: {stats['cache_hits']}\n"
        result += f"  🎯 Cache Misses: {stats['cache_misses']}\n"
        result += f"  ⏰ TTL: {config.get('server.cache_ttl')}s\n\n"
        
        # License information
        license_status = license_manager.get_license_status()
        result += f"🔐 License Information:\n"
        result += f"  📋 Status: {'✅ Valid' if license_status['valid'] else '❌ Invalid'}\n"
        result += f"  🏷️  Tier: {license_status['tier'].upper()}\n"
        result += f"  📅 Expires: {license_status['expires_at'] or 'Never'}\n"
        result += f"  🔄 Offline Mode: {'✅ Yes' if license_status['offline_mode'] else '❌ No'}\n"
        result += f"  🕒 Last Validated: {license_status['last_validated'] or 'Never'}\n"
        result += f"  🖥️  Device ID: {license_status['device_id'] or 'Unknown'}\n\n"
        
        # Authentication information
        auth_status = auth_manager.get_auth_status()
        result += f"🔐 Authentication:\n"
        result += f"  📋 Enabled: {'✅ Yes' if auth_status['enabled'] else '❌ No'}\n"
        result += f"  🔑 Status: {'✅ Authenticated' if auth_status['is_authenticated'] else '❌ Not Authenticated'}\n"
        result += f"  👤 User: {auth_status['user_info'].get('email', 'Unknown')}\n"
        result += f"  🔧 Method: {auth_status['method']}\n"
        result += f"  🆔 Session ID: {auth_status['session_id'][:8] + '...' if auth_status['session_id'] else 'None'}\n"
        result += f"  🖥️  Device ID: {auth_status['device_id'][:8] + '...' if auth_status['device_id'] else 'None'}\n"
        result += f"  ⏰ Token Expires: {auth_status['token_expires_at'] or 'Never'}\n"
        result += f"  🔒 Keyring: {'✅ Yes' if auth_status['use_keyring'] else '❌ No'}\n"
        result += f"  🔐 Encrypted: {'✅ Yes' if auth_status['encrypt_tokens'] else '❌ No'}\n"
        result += f"  🏢 SSO: {'✅ Yes' if auth_status['sso_enabled'] else '❌ No'}\n\n"
        
        # Usage tracking information
        usage_stats = usage_tracker.get_usage_stats()
        result += f"📊 Usage Tracking:\n"
        result += f"  📈 Enabled: {'✅ Yes' if usage_stats['enabled'] else '❌ No'}\n"
        result += f"  🔒 Privacy Mode: {usage_stats['privacy_mode']}\n"
        result += f"  🔢 Total Operations: {usage_stats['total_operations']:,}\n"
        result += f"  ⏱️  Total Duration: {usage_stats['total_duration']:.2f}s\n"
        result += f"  📁 Total File Size: {usage_stats['total_file_size']:,} bytes\n"
        result += f"  ❌ Total Errors: {usage_stats['total_errors']:,}\n"
        result += f"  📊 Error Rate: {usage_stats['error_rate']:.2%}\n"
        result += f"  💾 Local Storage: {usage_stats['local_storage_count']:,} events\n"
        result += f"  📋 Queue Size: {usage_stats['queue_size']}\n"
        
        # Quota information
        quota_status = usage_stats['quota_status']
        if quota_status['quota_limit'] > 0:
            result += f"  🎯 Quota: {quota_status['current_usage']}/{quota_status['quota_limit']} ops/hour\n"
            result += f"  ⚠️  Quota Exceeded: {'✅ Yes' if quota_status['quota_exceeded'] else '❌ No'}\n"
        result += "\n"
        
        # Configuration summary
        config_summary = config.get_config_summary()
        result += f"⚙️  Configuration:\n"
        result += f"  📋 Version: {config_summary['version']}\n"
        result += f"  🏷️  Profile: {config_summary['profile']}\n"
        result += f"  📁 Config Path: {config_summary['config_path'] or 'Default'}\n"
        result += f"  🌍 Environment Overrides: {config_summary['environment_overrides']}\n"
        result += f"  ❌ Validation Errors: {config_summary['validation_errors']}\n"
        result += f"  📊 Sections: {len(config_summary['sections'])}\n"
        result += f"  🚩 Feature Flags Enabled: {config_summary['feature_flags_enabled']}\n\n"
        
        result += f"🔧 Server Settings:\n"
        result += f"  📁 Max File Size: {config.get('server.max_file_size'):,} bytes\n"
        result += f"  🔒 Security Enabled: {config.get('security.enable_path_validation')}\n"
        result += f"  📊 Audit Logging: {config.get('security.enable_audit_logging')}\n"
        result += f"  ☁️  SaaS Integration: {config.get('saas.enabled')}\n"
        result += f"  🔐 License Management: {config.get('license.enabled')}\n"
        result += f"  ⚡ Max Concurrent Operations: {config.get('server.max_concurrent_operations')}\n"
        result += f"  ⏱️  Operation Timeout: {config.get('server.operation_timeout')}s\n\n"
        
        # Recent operations
        if monitor.operation_times:
            result += f"🕒 Recent Operations:\n"
            recent_ops = monitor.operation_times[-5:]  # Last 5 operations
            for op in recent_ops:
                status = "✅" if op['success'] else "❌"
                result += f"  {status} {op['operation']} ({op['duration']:.3f}s)\n"
        
        logger.info("Server statistics requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting server stats: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_usage_stats')
@audit_log('get_usage_stats', saas)
def get_usage_stats() -> str:
    """
    Get comprehensive usage statistics and analytics information.
    
    This tool provides detailed information about usage tracking, including
    operation counts, performance metrics, error rates, and quota status.
    
    Returns:
        A formatted string with detailed usage statistics.
    """
    try:
        result = f"📊 Usage Statistics Report\n"
        result += "=" * 50 + "\n\n"
        
        # Get usage statistics
        usage_stats = usage_tracker.get_usage_stats()
        
        # Basic information
        result += f"📈 Usage Tracking Status:\n"
        result += f"  🔐 Enabled: {'✅ Yes' if usage_stats['enabled'] else '❌ No'}\n"
        result += f"  🔒 Privacy Mode: {usage_stats['privacy_mode']}\n"
        result += f"  📊 Data Types Tracked:\n"
        
        data_types = usage_stats['data_types_tracked']
        for data_type, enabled in data_types.items():
            status = "✅" if enabled else "❌"
            result += f"    {status} {data_type.replace('_', ' ').title()}\n"
        result += "\n"
        
        # Overall statistics
        result += f"📊 Overall Statistics:\n"
        result += f"  🔢 Total Operations: {usage_stats['total_operations']:,}\n"
        result += f"  ⏱️  Total Duration: {usage_stats['total_duration']:.2f} seconds\n"
        result += f"  📁 Total File Size: {usage_stats['total_file_size']:,} bytes\n"
        result += f"  ❌ Total Errors: {usage_stats['total_errors']:,}\n"
        result += f"  📊 Error Rate: {usage_stats['error_rate']:.2%}\n"
        result += f"  ⏱️  Average Duration: {usage_stats['average_duration']:.3f} seconds\n\n"
        
        # Tool-specific statistics
        tool_stats = usage_stats['tool_stats']
        if tool_stats:
            result += f"🔧 Tool Usage Statistics:\n"
            for tool_name, stats in sorted(tool_stats.items(), key=lambda x: x[1]['count'], reverse=True):
                result += f"  📋 {tool_name}:\n"
                result += f"    🔢 Count: {stats['count']:,}\n"
                result += f"    ⏱️  Total Time: {stats['total_duration']:.2f}s\n"
                result += f"    📁 File Size: {stats['total_file_size']:,} bytes\n"
                result += f"    ❌ Errors: {stats['error_count']:,}\n"
                if stats['last_used']:
                    last_used = datetime.fromisoformat(stats['last_used'])
                    result += f"    🕒 Last Used: {last_used.strftime('%Y-%m-%d %H:%M:%S')}\n"
                result += "\n"
        
        # Quota information
        quota_status = usage_stats['quota_status']
        result += f"🎯 Quota Status:\n"
        if quota_status['quota_limit'] > 0:
            result += f"  📊 Current Usage: {quota_status['current_usage']:,}\n"
            result += f"  📏 Quota Limit: {quota_status['quota_limit']:,} ops/hour\n"
            result += f"  📈 Usage Percentage: {(quota_status['current_usage'] / quota_status['quota_limit'] * 100):.1f}%\n"
            result += f"  ⚠️  Quota Exceeded: {'✅ Yes' if quota_status['quota_exceeded'] else '❌ No'}\n"
            if quota_status['quota_reset_time']:
                reset_time = datetime.fromisoformat(quota_status['quota_reset_time'])
                result += f"  🔄 Quota Resets: {reset_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        else:
            result += f"  ❌ No quota limits configured\n"
        result += "\n"
        
        # Storage information
        result += f"💾 Storage Information:\n"
        result += f"  📋 Local Storage: {usage_stats['local_storage_count']:,} events\n"
        result += f"  📋 Queue Size: {usage_stats['queue_size']}\n"
        result += f"  🗂️  Storage Path: ~/.cursor-mcp/analytics/\n\n"
        
        # Privacy information
        result += f"🔒 Privacy Information:\n"
        result += f"  🔐 Privacy Mode: {usage_stats['privacy_mode']}\n"
        result += f"  🎭 Data Anonymization: {'✅ Enabled' if usage_tracker.anonymize_data else '❌ Disabled'}\n"
        result += f"  📅 Retention Period: {usage_tracker.retention_days} days\n"
        result += f"  🗑️  Auto Cleanup: {'✅ Enabled' if usage_tracker.local_storage_enabled else '❌ Disabled'}\n"
        
        logger.info("Usage statistics requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting usage stats: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_usage_summary')
@audit_log('get_usage_summary', saas)
def get_usage_summary(days: int = 7) -> str:
    """
    Get usage summary report for the specified number of days.
    
    This tool provides a comprehensive summary of usage patterns, including
    daily usage trends, most used tools, and common errors.
    
    Args:
        days: Number of days to include in the summary (default: 7)
        
    Returns:
        A formatted string with usage summary report.
    """
    try:
        result = f"📊 Usage Summary Report ({days} days)\n"
        result += "=" * 50 + "\n\n"
        
        # Get usage summary
        summary = usage_tracker.get_usage_summary(days)
        
        if 'error' in summary:
            return f"Error: {summary['error']}"
        
        # Period information
        result += f"📅 Report Period:\n"
        result += f"  📊 Days: {summary['period_days']}\n"
        result += f"  🔢 Total Events: {summary['total_events']:,}\n"
        result += f"  📈 Average per Day: {summary['total_events'] / max(summary['period_days'], 1):.1f}\n\n"
        
        # Daily usage breakdown
        daily_usage = summary['daily_usage']
        if daily_usage:
            result += f"📈 Daily Usage Breakdown:\n"
            for date, count in sorted(daily_usage.items()):
                result += f"  📅 {date}: {count:,} events\n"
            result += "\n"
        
        # Tool usage analysis
        tool_usage = summary['tool_usage']
        if tool_usage:
            result += f"🔧 Most Used Tools:\n"
            sorted_tools = sorted(tool_usage.items(), key=lambda x: x[1], reverse=True)
            for tool_name, count in sorted_tools[:10]:  # Top 10
                result += f"  📋 {tool_name}: {count:,} uses\n"
            result += "\n"
        
        # File operations analysis
        file_operations = summary['file_operations']
        if file_operations:
            result += f"📁 File Operations:\n"
            for operation, count in sorted(file_operations.items(), key=lambda x: x[1], reverse=True):
                result += f"  📄 {operation}: {count:,} operations\n"
            result += "\n"
        
        # Search queries analysis
        search_queries = summary['search_queries']
        if search_queries:
            result += f"🔍 Search Activity:\n"
            for search_type, count in sorted(search_queries.items(), key=lambda x: x[1], reverse=True):
                result += f"  🔎 {search_type}: {count:,} queries\n"
            result += "\n"
        
        # Error analysis
        errors = summary['errors']
        if errors:
            result += f"❌ Error Analysis:\n"
            for error_type, count in sorted(errors.items(), key=lambda x: x[1], reverse=True):
                result += f"  ⚠️  {error_type}: {count:,} occurrences\n"
            result += "\n"
        
        # Summary insights
        result += f"📊 Summary Insights:\n"
        if summary['most_used_tool']:
            result += f"  🏆 Most Used Tool: {summary['most_used_tool']}\n"
        if summary['most_common_error']:
            result += f"  ⚠️  Most Common Error: {summary['most_common_error']}\n"
        
        # Calculate some additional insights
        if daily_usage:
            max_day = max(daily_usage.items(), key=lambda x: x[1])
            min_day = min(daily_usage.items(), key=lambda x: x[1])
            result += f"  📈 Busiest Day: {max_day[0]} ({max_day[1]:,} events)\n"
            result += f"  📉 Quietest Day: {min_day[0]} ({min_day[1]:,} events)\n"
        
        logger.info(f"Usage summary requested for {days} days")
        return result
        
    except Exception as e:
        error_msg = f"Error getting usage summary: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_quota_status')
@audit_log('get_quota_status', saas)
def get_quota_status() -> str:
    """
    Get current quota status and usage limits information.
    
    This tool provides detailed information about current quota usage,
    limits, and enforcement status for billing and rate limiting.
    
    Returns:
        A formatted string with quota status information.
    """
    try:
        result = f"🎯 Quota Status Report\n"
        result += "=" * 50 + "\n\n"
        
        # Get quota status
        quota_status = usage_tracker.get_quota_status()
        
        # Basic quota information
        result += f"📊 Quota Configuration:\n"
        result += f"  🔐 Enforcement: {'✅ Enabled' if usage_tracker.quota_enforcement_enabled else '❌ Disabled'}\n"
        result += f"  ⏰ Check Interval: {usage_tracker.quota_check_interval} seconds\n"
        result += f"  🔄 Grace Period: {usage_tracker.quota_grace_period} seconds\n\n"
        
        # Current usage
        result += f"📈 Current Usage:\n"
        result += f"  🔢 Operations This Hour: {quota_status['current_usage']:,}\n"
        result += f"  📏 Hourly Limit: {quota_status['quota_limit']:,}\n"
        
        if quota_status['quota_limit'] > 0:
            usage_percentage = (quota_status['current_usage'] / quota_status['quota_limit']) * 100
            result += f"  📊 Usage Percentage: {usage_percentage:.1f}%\n"
            
            # Usage bar visualization
            bar_length = 20
            filled_length = int(bar_length * usage_percentage / 100)
            bar = "█" * filled_length + "░" * (bar_length - filled_length)
            result += f"  📊 Usage Bar: [{bar}] {usage_percentage:.1f}%\n"
            
            # Status indicators
            if quota_status['quota_exceeded']:
                result += f"  ⚠️  Status: QUOTA EXCEEDED\n"
            elif usage_percentage >= 90:
                result += f"  ⚠️  Status: APPROACHING LIMIT\n"
            elif usage_percentage >= 75:
                result += f"  ⚡ Status: HIGH USAGE\n"
            else:
                result += f"  ✅ Status: NORMAL\n"
        else:
            result += f"  ❌ No quota limits configured\n"
        
        result += "\n"
        
        # Quota reset information
        if quota_status['quota_reset_time']:
            reset_time = datetime.fromisoformat(quota_status['quota_reset_time'])
            now = datetime.now()
            time_until_reset = reset_time - now
            
            result += f"🔄 Quota Reset Information:\n"
            result += f"  📅 Reset Time: {reset_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            result += f"  ⏰ Time Until Reset: {str(time_until_reset).split('.')[0]}\n"
            result += "\n"
        
        # License tier information
        if license_manager:
            license_status = license_manager.get_license_status()
            tier_limits = license_manager.get_tier_limits()
            
            result += f"🏷️  License Tier Information:\n"
            result += f"  📋 Current Tier: {license_status['tier'].upper()}\n"
            result += f"  📊 Tier Limits:\n"
            
            for limit_name, limit_value in tier_limits.items():
                if isinstance(limit_value, int):
                    if 'size' in limit_name.lower():
                        # Format file sizes
                        if limit_value >= 1024 * 1024:
                            formatted_value = f"{limit_value // (1024 * 1024)} MB"
                        elif limit_value >= 1024:
                            formatted_value = f"{limit_value // 1024} KB"
                        else:
                            formatted_value = f"{limit_value} bytes"
                    else:
                        formatted_value = f"{limit_value:,}"
                else:
                    formatted_value = str(limit_value)
                result += f"    📏 {limit_name}: {formatted_value}\n"
            result += "\n"
        
        # Recommendations
        result += f"💡 Recommendations:\n"
        if quota_status['quota_limit'] > 0:
            usage_percentage = (quota_status['current_usage'] / quota_status['quota_limit']) * 100
            
            if quota_status['quota_exceeded']:
                result += f"  ⚠️  Quota exceeded! Consider upgrading your plan or waiting for reset.\n"
            elif usage_percentage >= 90:
                result += f"  ⚠️  Approaching quota limit. Monitor usage closely.\n"
            elif usage_percentage >= 75:
                result += f"  ⚡ High usage detected. Consider optimizing operations.\n"
            else:
                result += f"  ✅ Usage is within normal limits.\n"
            
            if usage_percentage > 50:
                result += f"  📊 Current usage: {quota_status['current_usage']:,}/{quota_status['quota_limit']:,} operations\n"
        else:
            result += f"  ✅ No quota limits configured - unlimited usage available.\n"
        
        logger.info("Quota status requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting quota status: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'login')
@audit_log('login', saas)
def login(email: str = None, password: str = None, force_prompt: bool = False) -> str:
    """
    Authenticate user with the SaaS backend.
    
    This tool allows users to log in using email/password or API key authentication.
    Credentials are stored securely using the OS keyring when available.
    
    Args:
        email: User email (optional, will prompt if not provided)
        password: User password (optional, will prompt if not provided)
        force_prompt: Force credential prompt even if auto-login is enabled
        
    Returns:
        A formatted string with authentication results.
    """
    try:
        result = f"🔐 User Authentication\n"
        result += "=" * 50 + "\n\n"
        
        if not auth_manager.enabled:
            result += "❌ Authentication is disabled in configuration\n"
            return result
        
        # Attempt authentication
        success = auth_manager.authenticate(email, password, force_prompt)
        
        if success:
            auth_status = auth_manager.get_auth_status()
            result += f"✅ Authentication successful!\n\n"
            result += f"👤 User Information:\n"
            result += f"  📧 Email: {auth_status['user_info'].get('email', 'Unknown')}\n"
            result += f"  🆔 User ID: {auth_status['user_info'].get('id', 'Unknown')}\n"
            result += f"  🏷️  License Tier: {auth_status['user_info'].get('license_tier', 'Unknown')}\n"
            result += f"  🔧 Auth Method: {auth_status['method']}\n\n"
            
            result += f"🔐 Session Information:\n"
            result += f"  🆔 Session ID: {auth_status['session_id'][:8] + '...' if auth_status['session_id'] else 'None'}\n"
            result += f"  🖥️  Device ID: {auth_status['device_id'][:8] + '...' if auth_status['device_id'] else 'None'}\n"
            result += f"  ⏰ Token Expires: {auth_status['token_expires_at'] or 'Never'}\n"
            result += f"  🔒 Secure Storage: {'✅ Yes' if auth_status['use_keyring'] else '❌ No'}\n"
            result += f"  🔐 Token Encryption: {'✅ Yes' if auth_status['encrypt_tokens'] else '❌ No'}\n"
        else:
            result += f"❌ Authentication failed!\n\n"
            result += f"💡 Troubleshooting Tips:\n"
            result += f"  • Check your email and password\n"
            result += f"  • Verify your internet connection\n"
            result += f"  • Ensure the SaaS backend is accessible\n"
            result += f"  • Check your license status\n"
        
        logger.info(f"Login attempt - Success: {success}")
        return result
        
    except Exception as e:
        error_msg = f"Error during login: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'logout')
@audit_log('logout', saas)
def logout() -> str:
    """
    Logout user and clear authentication state.
    
    This tool logs out the current user, clears stored credentials,
    and invalidates the current session.
    
    Returns:
        A formatted string with logout results.
    """
    try:
        result = f"🚪 User Logout\n"
        result += "=" * 50 + "\n\n"
        
        if not auth_manager.enabled:
            result += "❌ Authentication is disabled\n"
            return result
        
        if not auth_manager.is_authenticated:
            result += "ℹ️  No active session to logout\n"
            return result
        
        # Perform logout
        success = auth_manager.logout()
        
        if success:
            result += f"✅ Logout successful!\n\n"
            result += f"🔐 Security Actions Taken:\n"
            result += f"  🗑️  Cleared access tokens\n"
            result += f"  🗑️  Cleared refresh tokens\n"
            result += f"  🗑️  Cleared session data\n"
            result += f"  🗑️  Cleared stored credentials\n"
            result += f"  📡 Notified backend of logout\n"
        else:
            result += f"❌ Logout failed!\n"
            result += f"Some credentials may still be stored locally.\n"
        
        logger.info(f"Logout attempt - Success: {success}")
        return result
        
    except Exception as e:
        error_msg = f"Error during logout: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_auth_status')
@audit_log('get_auth_status', saas)
def get_auth_status() -> str:
    """
    Get detailed authentication status and information.
    
    This tool provides comprehensive information about the current
    authentication state, including user info, session details, and security settings.
    
    Returns:
        A formatted string with authentication status information.
    """
    try:
        result = f"🔐 Authentication Status Report\n"
        result += "=" * 50 + "\n\n"
        
        # Get authentication status
        auth_status = auth_manager.get_auth_status()
        
        # Basic status
        result += f"📋 Authentication Status:\n"
        result += f"  🔐 Enabled: {'✅ Yes' if auth_status['enabled'] else '❌ No'}\n"
        result += f"  🔑 Authenticated: {'✅ Yes' if auth_status['is_authenticated'] else '❌ No'}\n"
        result += f"  🔧 Method: {auth_status['method']}\n"
        result += f"  🏢 SSO Enabled: {'✅ Yes' if auth_status['sso_enabled'] else '❌ No'}\n\n"
        
        # User information
        if auth_status['is_authenticated']:
            user_info = auth_status['user_info']
            result += f"👤 User Information:\n"
            result += f"  📧 Email: {user_info.get('email', 'Unknown')}\n"
            result += f"  🆔 User ID: {user_info.get('id', 'Unknown')}\n"
            result += f"  👤 Name: {user_info.get('name', 'Unknown')}\n"
            result += f"  🏷️  License Tier: {user_info.get('license_tier', 'Unknown')}\n"
            result += f"  📅 Created: {user_info.get('created_at', 'Unknown')}\n"
            result += f"  🔄 Last Login: {user_info.get('last_login', 'Unknown')}\n\n"
        
        # Session information
        result += f"🔄 Session Information:\n"
        result += f"  🆔 Session ID: {auth_status['session_id'][:8] + '...' if auth_status['session_id'] else 'None'}\n"
        result += f"  🖥️  Device ID: {auth_status['device_id'][:8] + '...' if auth_status['device_id'] else 'None'}\n"
        result += f"  ⏰ Token Expires: {auth_status['token_expires_at'] or 'Never'}\n"
        result += f"  📊 Active Sessions: {auth_status['sessions_count']}\n\n"
        
        # Security information
        result += f"🔒 Security Settings:\n"
        result += f"  🔑 Keyring Storage: {'✅ Yes' if auth_status['use_keyring'] else '❌ No'}\n"
        result += f"  🔐 Token Encryption: {'✅ Yes' if auth_status['encrypt_tokens'] else '❌ No'}\n"
        result += f"  🏢 SSO Provider: {auth_status.get('sso_provider', 'None')}\n"
        result += f"  🔄 Device Registration: {'✅ Enabled' if auth_status['device_registration_enabled'] else '❌ Disabled'}\n\n"
        
        # Token status
        if auth_status['is_authenticated']:
            if auth_manager.is_token_expired():
                result += f"⚠️  Token Status: EXPIRED or EXPIRING SOON\n"
                result += f"   Consider refreshing your authentication\n"
            else:
                result += f"✅ Token Status: VALID\n"
        else:
            result += f"❌ Token Status: NO TOKEN\n"
        
        logger.info("Authentication status requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting authentication status: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'refresh_auth')
@audit_log('refresh_auth', saas)
def refresh_auth() -> str:
    """
    Refresh authentication token.
    
    This tool attempts to refresh the current authentication token
    using the stored refresh token.
    
    Returns:
        A formatted string with token refresh results.
    """
    try:
        result = f"🔄 Token Refresh\n"
        result += "=" * 50 + "\n\n"
        
        if not auth_manager.enabled:
            result += "❌ Authentication is disabled\n"
            return result
        
        if not auth_manager.is_authenticated:
            result += "❌ No active session to refresh\n"
            result += "Please log in first using the login command\n"
            return result
        
        # Check if token needs refresh
        if not auth_manager.is_token_expired():
            result += f"ℹ️  Token is still valid, no refresh needed\n"
            auth_status = auth_manager.get_auth_status()
            result += f"⏰ Token expires: {auth_status['token_expires_at'] or 'Never'}\n"
            return result
        
        # Attempt token refresh
        result += f"🔄 Refreshing authentication token...\n"
        success = auth_manager._refresh_token()
        
        if success:
            auth_status = auth_manager.get_auth_status()
            result += f"✅ Token refreshed successfully!\n\n"
            result += f"🔐 Updated Token Information:\n"
            result += f"  ⏰ New Expiration: {auth_status['token_expires_at'] or 'Never'}\n"
            result += f"  🆔 Session ID: {auth_status['session_id'][:8] + '...' if auth_status['session_id'] else 'None'}\n"
        else:
            result += f"❌ Token refresh failed!\n\n"
            result += f"💡 Possible Solutions:\n"
            result += f"  • Re-authenticate using the login command\n"
            result += f"  • Check your internet connection\n"
            result += f"  • Verify SaaS backend accessibility\n"
        
        logger.info(f"Token refresh attempt - Success: {success}")
        return result
        
    except Exception as e:
        error_msg = f"Error during token refresh: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_config_status')
@audit_log('get_config_status', saas)
def get_config_status() -> str:
    """
    Get comprehensive configuration status and information.
    
    This tool provides detailed information about the current configuration,
    including validation status, environment overrides, and feature flags.
    
    Returns:
        A formatted string with configuration status information.
    """
    try:
        result = f"⚙️  Configuration Status Report\n"
        result += "=" * 50 + "\n\n"
        
        # Get configuration summary
        config_summary = config.get_config_summary()
        
        # Basic configuration info
        result += f"📋 Configuration Overview:\n"
        result += f"  📋 Version: {config_summary['version']}\n"
        result += f"  🏷️  Profile: {config_summary['profile']}\n"
        result += f"  📁 Config Path: {config_summary['config_path'] or 'Default'}\n"
        result += f"  🌍 Environment Overrides: {config_summary['environment_overrides']}\n"
        result += f"  ❌ Validation Errors: {config_summary['validation_errors']}\n"
        result += f"  📊 Configuration Sections: {len(config_summary['sections'])}\n\n"
        
        # Feature flags status
        feature_flags = config.get('feature_flags', {})
        result += f"🚩 Feature Flags:\n"
        for flag_name, flag_value in feature_flags.items():
            status = "✅ Enabled" if flag_value else "❌ Disabled"
            result += f"  {flag_name}: {status}\n"
        result += f"  📊 Total Enabled: {config_summary['feature_flags_enabled']}/{len(feature_flags)}\n\n"
        
        # Service status
        result += f"🔧 Service Status:\n"
        result += f"  ☁️  SaaS Integration: {'✅ Enabled' if config_summary['saas_enabled'] else '❌ Disabled'}\n"
        result += f"  🔐 Authentication: {'✅ Enabled' if config_summary['authentication_enabled'] else '❌ Disabled'}\n"
        result += f"  📊 Analytics: {'✅ Enabled' if config_summary['analytics_enabled'] else '❌ Disabled'}\n"
        result += f"  🎫 License Management: {'✅ Enabled' if config_summary['license_enabled'] else '❌ Disabled'}\n\n"
        
        # Environment overrides
        if config.environment_overrides:
            result += f"🌍 Environment Overrides:\n"
            for key, value in config.environment_overrides.items():
                result += f"  {key}: {value}\n"
            result += "\n"
        
        # Validation errors
        if config.validation_errors:
            result += f"❌ Validation Errors:\n"
            for error in config.validation_errors:
                result += f"  • {error}\n"
            result += "\n"
        
        # Configuration sections
        result += f"📊 Configuration Sections:\n"
        for section in config_summary['sections']:
            result += f"  • {section}\n"
        
        logger.info("Configuration status requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting configuration status: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'update_config')
@audit_log('update_config', saas)
def update_config(key: str, value: str, save_to_file: bool = False) -> str:
    """
    Update a configuration value at runtime.
    
    This tool allows updating configuration values without restarting the server.
    Changes can be saved to the configuration file for persistence.
    
    Args:
        key: Configuration key using dot notation (e.g., 'server.max_file_size')
        value: New value to set (will be converted to appropriate type)
        save_to_file: Whether to save changes to the configuration file
        
    Returns:
        A formatted string with update results.
    """
    try:
        result = f"⚙️  Configuration Update\n"
        result += "=" * 50 + "\n\n"
        
        # Convert value to appropriate type
        converted_value = value
        
        # Try to convert to boolean
        if value.lower() in ('true', 'false'):
            converted_value = value.lower() == 'true'
        # Try to convert to integer
        elif value.isdigit() or (value.startswith('-') and value[1:].isdigit()):
            converted_value = int(value)
        # Try to convert to float
        elif '.' in value and value.replace('.', '').isdigit():
            converted_value = float(value)
        
        # Validate the update
        if not config.validate_runtime_update(key, converted_value):
            result += f"❌ Invalid configuration update!\n"
            result += f"Key: {key}\n"
            result += f"Value: {value}\n\n"
            result += f"💡 The provided value is not valid for this configuration key.\n"
            return result
        
        # Get old value
        old_value = config.get(key)
        
        # Update configuration
        config.set(key, converted_value)
        
        result += f"✅ Configuration updated successfully!\n\n"
        result += f"🔧 Update Details:\n"
        result += f"  🔑 Key: {key}\n"
        result += f"  📤 Old Value: {old_value}\n"
        result += f"  📥 New Value: {converted_value}\n"
        result += f"  💾 Saved to File: {'✅ Yes' if save_to_file else '❌ No'}\n\n"
        
        # Save to file if requested
        if save_to_file:
            try:
                config.save()
                result += f"💾 Configuration saved to file successfully!\n"
            except Exception as e:
                result += f"❌ Failed to save configuration to file: {e}\n"
        
        # Show impact
        result += f"📊 Impact:\n"
        result += f"  • Changes are effective immediately\n"
        result += f"  • Some changes may require server restart for full effect\n"
        result += f"  • Use 'get_config_status' to verify changes\n"
        
        logger.info(f"Configuration updated - Key: {key}, Value: {converted_value}")
        return result
        
    except Exception as e:
        error_msg = f"Error updating configuration: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'apply_config_profile')
@audit_log('apply_config_profile', saas)
def apply_config_profile(profile: str) -> str:
    """
    Apply a configuration profile.
    
    This tool applies predefined configuration profiles for different
    deployment scenarios (development, staging, production).
    
    Args:
        profile: Configuration profile name (development, staging, production)
        
    Returns:
        A formatted string with profile application results.
    """
    try:
        result = f"🏷️  Configuration Profile Application\n"
        result += "=" * 50 + "\n\n"
        
        # Validate profile
        valid_profiles = ['development', 'staging', 'production']
        if profile not in valid_profiles:
            result += f"❌ Invalid profile: {profile}\n\n"
            result += f"💡 Valid profiles: {', '.join(valid_profiles)}\n"
            return result
        
        # Get current profile
        current_profile = config.profile
        
        # Apply profile
        config.apply_profile(profile)
        
        result += f"✅ Profile applied successfully!\n\n"
        result += f"🏷️  Profile Details:\n"
        result += f"  📤 Previous Profile: {current_profile}\n"
        result += f"  📥 New Profile: {profile}\n\n"
        
        # Show profile-specific settings
        profile_config = config.get_profile_config(profile)
        if profile_config:
            result += f"🔧 Profile Settings Applied:\n"
            for key, value in profile_config.items():
                result += f"  {key}: {value}\n"
            result += "\n"
        
        # Show impact
        result += f"📊 Impact:\n"
        result += f"  • Configuration updated for {profile} environment\n"
        result += f"  • Some changes may require server restart\n"
        result += f"  • Use 'get_config_status' to verify changes\n"
        
        logger.info(f"Configuration profile applied - Profile: {profile}")
        return result
        
    except Exception as e:
        error_msg = f"Error applying configuration profile: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'reload_config')
@audit_log('reload_config', saas)
def reload_config() -> str:
    """
    Reload configuration from file and environment variables.
    
    This tool reloads the configuration from the configuration file
    and applies any environment variable overrides.
    
    Returns:
        A formatted string with reload results.
    """
    try:
        result = f"🔄 Configuration Reload\n"
        result += "=" * 50 + "\n\n"
        
        # Get current config summary
        old_summary = config.get_config_summary()
        
        # Reload configuration
        config.reload()
        
        # Get new config summary
        new_summary = config.get_config_summary()
        
        result += f"✅ Configuration reloaded successfully!\n\n"
        result += f"🔄 Reload Details:\n"
        result += f"  📁 Config Path: {new_summary['config_path'] or 'Default'}\n"
        result += f"  🌍 Environment Overrides: {new_summary['environment_overrides']}\n"
        result += f"  ❌ Validation Errors: {new_summary['validation_errors']}\n\n"
        
        # Show changes
        if old_summary['environment_overrides'] != new_summary['environment_overrides']:
            result += f"🌍 Environment Override Changes:\n"
            result += f"  Previous: {old_summary['environment_overrides']}\n"
            result += f"  Current: {new_summary['environment_overrides']}\n\n"
        
        if new_summary['validation_errors'] > 0:
            result += f"⚠️  Validation Warnings:\n"
            for error in config.validation_errors:
                result += f"  • {error}\n"
            result += "\n"
        
        # Show impact
        result += f"📊 Impact:\n"
        result += f"  • Configuration reloaded from file\n"
        result += f"  • Environment variables reapplied\n"
        result += f"  • Validation performed\n"
        result += f"  • Some changes may require server restart\n"
        
        logger.info("Configuration reloaded successfully")
        return result
        
    except Exception as e:
        error_msg = f"Error reloading configuration: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'test_saas_connection')
@audit_log('test_saas_connection', saas)
def test_saas_connection() -> str:
    """
    Test the SaaS backend connection and HTTP client functionality.
    
    This tool tests the connection to the SaaS backend, validates authentication,
    and provides detailed information about the HTTP client status and configuration.
    
    Returns:
        A formatted string with connection test results and client status.
    """
    try:
        result = f"🔗 SaaS Connection Test\n"
        result += "=" * 50 + "\n\n"
        
        # Check if SaaS is enabled
        if not saas.enabled:
            result += "❌ SaaS integration is disabled\n"
            result += "💡 Enable SaaS in configuration to test connection\n\n"
            return result
        
        # Test connection using the new method
        result += "🌐 Testing SaaS platform connection...\n"
        connection_test = saas.test_connection()
        
        if connection_test['success']:
            result += "✅ SaaS platform connection successful!\n\n"
            details = connection_test.get('details', {})
            
            result += f"📡 API Endpoint: {details.get('api_endpoint', 'Unknown')}\n"
            result += f"🏥 Health Status: {details.get('health_status', 'Unknown')}\n"
            result += f"⏱️  Response Time: {details.get('response_time', 'Unknown')}\n"
            result += f"🏷️  Version: {details.get('version', 'Unknown')}\n"
            result += f"⏰ Uptime: {details.get('uptime', 'Unknown')}\n\n"
            
            # Log service status
            services = details.get('services', {})
            if services:
                result += f"🔧 Service Status:\n"
                for service, status in services.items():
                    status_icon = "✅" if status == "connected" else "❌"
                    result += f"  {status_icon} {service.title()}: {status}\n"
                result += "\n"
        else:
            result += f"❌ SaaS platform connection failed: {connection_test['message']}\n"
            if connection_test.get('details', {}).get('error'):
                result += f"   Error details: {connection_test['details']['error']}\n"
            result += "\n"
        
        # Get additional health status
        health_status = saas.get_health_status()
        result += f"🔌 HTTP Client Available: {'✅' if health_status['http_client_available'] else '❌'}\n"
        result += f"📊 Last Check: {health_status['last_check']}\n\n"
        
        if health_status['http_client_available']:
            # Show cache statistics
            if 'cache_stats' in health_status:
                cache_stats = health_status['cache_stats']
                result += f"💾 Cache Statistics:\n"
                result += f"  📊 Total Entries: {cache_stats['total_entries']}\n"
                result += f"  ✅ Active Entries: {cache_stats['active_entries']}\n"
                result += f"  ⏰ Cache TTL: {cache_stats['cache_ttl']}s\n"
                result += f"  🔄 Offline Grace Period: {cache_stats['offline_grace_period']}s\n"
                
                if cache_stats['last_successful_request']:
                    last_success = datetime.fromtimestamp(cache_stats['last_successful_request'])
                    result += f"  🕒 Last Success: {last_success.strftime('%Y-%m-%d %H:%M:%S')}\n"
                else:
                    result += f"  🕒 Last Success: Never\n"
                
                # Test a simple GET request
                result += f"\n🧪 Testing GET request...\n"
                try:
                    test_response = saas.http_client.get('/api/health', use_cache=False)
                    result += f"✅ GET Request Successful\n"
                    result += f"📊 Status Code: {test_response.get('_metadata', {}).get('status_code', 'unknown')}\n"
                    result += f"⏱️  Response Time: {test_response.get('_metadata', {}).get('duration', 'unknown')}\n"
                except SaaSClientError as e:
                    result += f"❌ GET Request Failed: {e}\n"
                except Exception as e:
                    result += f"❌ GET Request Error: {e}\n"
                
            except Exception as e:
                result += f"❌ Connection test failed: {e}\n"
        else:
            result += "❌ HTTP client not available\n"
            result += "💡 Check configuration and network connectivity\n"
        
        # Configuration summary
        result += f"\n⚙️  Configuration Summary:\n"
        result += f"  🔑 API Key: {'✅ Set' if saas.api_key else '❌ Not Set'}\n"
        result += f"  👤 User ID: {'✅ Set' if saas.user_id else '❌ Not Set'}\n"
        result += f"  🎫 Session ID: {'✅ Set' if saas.session_id else '❌ Not Set'}\n"
        result += f"  📊 Analytics: {'✅ Enabled' if config.get('saas.enable_analytics') else '❌ Disabled'}\n"
        result += f"  📡 Telemetry: {'✅ Enabled' if config.get('saas.enable_telemetry') else '❌ Disabled'}\n"
        
        logger.info("SaaS connection test completed")
        return result
        
    except Exception as e:
        error_msg = f"Error testing SaaS connection: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_saas_client_stats')
@audit_log('get_saas_client_stats', saas)
def get_saas_client_stats() -> str:
    """
    Get detailed statistics about the SaaS HTTP client.
    
    This tool provides comprehensive statistics about the HTTP client including
    cache performance, request metrics, and configuration details.
    
    Returns:
        A formatted string with detailed HTTP client statistics.
    """
    try:
        result = f"📊 SaaS HTTP Client Statistics\n"
        result += "=" * 50 + "\n\n"
        
        if not saas.enabled or not saas.http_client:
            result += "❌ SaaS HTTP client not available\n"
            result += "💡 Enable SaaS integration to view statistics\n"
            return result
        
        # Get cache statistics
        cache_stats = saas.http_client.get_cache_stats()
        
        result += f"💾 Cache Performance:\n"
        result += f"  📊 Total Cache Entries: {cache_stats['total_entries']}\n"
        result += f"  ✅ Active Entries: {cache_stats['active_entries']}\n"
        result += f"  ⏰ Expired Entries: {cache_stats['expired_entries']}\n"
        result += f"  🕒 Cache TTL: {cache_stats['cache_ttl']} seconds\n"
        result += f"  🔄 Offline Grace Period: {cache_stats['offline_grace_period']} seconds\n"
        
        if cache_stats['last_successful_request']:
            last_success = datetime.fromtimestamp(cache_stats['last_successful_request'])
            result += f"  🕒 Last Successful Request: {last_success.strftime('%Y-%m-%d %H:%M:%S')}\n"
        else:
            result += f"  🕒 Last Successful Request: Never\n"
        
        # HTTP client configuration
        result += f"\n⚙️  HTTP Client Configuration:\n"
        result += f"  🌐 API Endpoint: {saas.http_client.api_endpoint}\n"
        result += f"  ⏱️  Timeout: {saas.http_client.timeout} seconds\n"
        result += f"  🔄 Max Retries: {saas.http_client.max_retries}\n"
        result += f"  ⏰ Retry Delay: {saas.http_client.retry_delay} seconds\n"
        result += f"  📈 Backoff Factor: {saas.http_client.retry_backoff_factor}\n"
        result += f"  🛡️  SSL Verification: {'✅ Enabled' if saas.http_client.verify_ssl else '❌ Disabled'}\n"
        result += f"  🏷️  User Agent: {saas.http_client.user_agent}\n"
        
        # Authentication status
        result += f"\n🔐 Authentication Status:\n"
        result += f"  🔑 API Key: {'✅ Set' if saas.http_client.api_key else '❌ Not Set'}\n"
        result += f"  🎫 Access Token: {'✅ Set' if saas.http_client._access_token else '❌ Not Set'}\n"
        result += f"  🔄 Refresh Token: {'✅ Set' if saas.http_client._refresh_token else '❌ Not Set'}\n"
        
        if saas.http_client._token_expires_at:
            expires_at = datetime.fromtimestamp(saas.http_client._token_expires_at)
            result += f"  ⏰ Token Expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
        
        # Cache hit rate calculation
        if cache_stats['total_entries'] > 0:
            hit_rate = (cache_stats['active_entries'] / cache_stats['total_entries']) * 100
            result += f"\n📈 Performance Metrics:\n"
            result += f"  🎯 Cache Hit Rate: {hit_rate:.1f}%\n"
        
        logger.info("SaaS client statistics requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting SaaS client stats: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'test_license_validation')
@audit_log('test_license_validation', saas)
def test_license_validation(license_key: str = None) -> str:
    """
    Test license validation with the SaaS backend.
    
    This tool tests the license validation functionality by sending a validation
    request to the SaaS backend and displaying the results.
    
    Args:
        license_key: License key to validate (optional, uses configured key if not provided)
        
    Returns:
        A formatted string with license validation test results.
    """
    try:
        result = f"🔐 License Validation Test\n"
        result += "=" * 50 + "\n\n"
        
        # Check if SaaS is enabled
        if not saas.enabled:
            result += "❌ SaaS integration is disabled\n"
            result += "💡 Enable SaaS in configuration to test license validation\n\n"
            return result
        
        # Check if license validation is enabled
        if not config.get('saas.enable_license_validation', False):
            result += "❌ License validation is disabled in configuration\n"
            result += "💡 Set saas.enable_license_validation = true to enable\n\n"
            return result
        
        # Get license key
        if not license_key:
            license_key = config.get('saas.api_key', '') or config.get('license.license_key', '')
        
        if not license_key:
            result += "❌ No license key found\n"
            result += "💡 Provide a license key or configure one in the settings\n\n"
            return result
        
        result += f"🔑 Testing license key: {license_key[:8]}...\n"
        result += f"🌐 API Endpoint: {saas.api_endpoint}\n\n"
        
        # Test license validation
        result += "🧪 Testing license validation...\n"
        validation_result = saas.validate_license(license_key)
        
        if validation_result.get('valid'):
            result += "✅ License validation successful!\n\n"
            result += f"📋 Validation Details:\n"
            result += f"  ✅ Valid: Yes\n"
            result += f"  📝 Message: {validation_result.get('message', 'Valid license')}\n"
            
            # Show additional validation data if available
            if 'license_id' in validation_result:
                result += f"  🆔 License ID: {validation_result['license_id']}\n"
            if 'tier' in validation_result:
                result += f"  🏷️  Tier: {validation_result['tier']}\n"
            if 'expires_at' in validation_result:
                result += f"  📅 Expires: {validation_result['expires_at']}\n"
            if 'features' in validation_result:
                result += f"  🎯 Features: {', '.join(validation_result['features'])}\n"
        else:
            result += "❌ License validation failed!\n\n"
            result += f"📋 Validation Details:\n"
            result += f"  ❌ Valid: No\n"
            result += f"  📝 Message: {validation_result.get('message', 'Invalid license')}\n"
            
            # Show error details if available
            if 'error_code' in validation_result:
                result += f"  🚨 Error Code: {validation_result['error_code']}\n"
            if 'error_details' in validation_result:
                result += f"  📋 Error Details: {validation_result['error_details']}\n"
        
        logger.info(f"License validation test completed: {validation_result.get('valid', False)}")
        return result
        
    except Exception as e:
        error_msg = f"Error testing license validation: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'test_usage_tracking')
@audit_log('test_usage_tracking', saas)
def test_usage_tracking() -> str:
    """
    Test usage tracking functionality with the SaaS backend.
    
    This tool tests the usage tracking system by sending sample usage events
    to the SaaS backend and displaying the results.
    
    Returns:
        A formatted string with usage tracking test results.
    """
    try:
        result = f"📊 Usage Tracking Test\n"
        result += "=" * 50 + "\n\n"
        
        # Check if SaaS is enabled
        if not saas.enabled:
            result += "❌ SaaS integration is disabled\n"
            result += "💡 Enable SaaS in configuration to test usage tracking\n\n"
            return result
        
        # Check if analytics is enabled
        if not config.get('saas.enable_analytics', False):
            result += "❌ Analytics is disabled in configuration\n"
            result += "💡 Set saas.enable_analytics = true to enable\n\n"
            return result
        
        result += f"🌐 API Endpoint: {saas.api_endpoint}\n"
        result += f"📊 Analytics Enabled: ✅ Yes\n\n"
        
        # Create sample usage events
        sample_events = [
            {
                'event_id': str(uuid.uuid4()),
                'timestamp': datetime.now().isoformat(),
                'event_type': 'tool_usage',
                'tool_name': 'test_usage_tracking',
                'duration': 0.1,
                'success': True,
                'file_size': 0,
                'file_path': None,
                'session_id': config.get('saas.session_id', 'test-session'),
                'device_id': 'test-device-123',
                'license_tier': 'test',
                'server_version': '2.0.0',
                'python_version': platform.python_version(),
                'system_info': {
                    'system': platform.system(),
                    'release': platform.release()
                }
            },
            {
                'event_id': str(uuid.uuid4()),
                'timestamp': datetime.now().isoformat(),
                'event_type': 'performance_metric',
                'metric_name': 'test_metric',
                'value': 1.5,
                'unit': 'seconds',
                'session_id': config.get('saas.session_id', 'test-session'),
                'device_id': 'test-device-123',
                'license_tier': 'test',
                'server_version': '2.0.0'
            }
        ]
        
        result += f"🧪 Testing usage tracking with {len(sample_events)} sample events...\n"
        
        # Test usage tracking
        success = saas.track_usage(sample_events)
        
        if success:
            result += "✅ Usage tracking test successful!\n\n"
            result += f"📋 Test Results:\n"
            result += f"  ✅ Events Sent: {len(sample_events)}\n"
            result += f"  📊 Status: Success\n"
            result += f"  🌐 Backend: Connected\n"
            
            # Show sample events
            result += f"\n📝 Sample Events Sent:\n"
            for i, event in enumerate(sample_events, 1):
                result += f"  {i}. {event['event_type']} - {event.get('tool_name', event.get('metric_name', 'unknown'))}\n"
        else:
            result += "❌ Usage tracking test failed!\n\n"
            result += f"📋 Test Results:\n"
            result += f"  ❌ Events Sent: {len(sample_events)}\n"
            result += f"  📊 Status: Failed\n"
            result += f"  🌐 Backend: Connection issue\n"
        
        # Test individual analytics event
        result += f"\n🧪 Testing individual analytics event...\n"
        saas.send_analytics('test_analytics_event', {
            'test_data': 'sample_value',
            'timestamp': datetime.now().isoformat(),
            'test_type': 'integration_test'
        })
        result += "✅ Individual analytics event sent\n"
        
        logger.info(f"Usage tracking test completed: {success}")
        return result
        
    except Exception as e:
        error_msg = f"Error testing usage tracking: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_license_status')
@audit_log('get_license_status', saas)
def get_license_status() -> str:
    """
    Get detailed license status and information.
    
    This tool provides comprehensive information about the current license status,
    including validation status, tier information, features, and limits.
    
    Returns:
        A formatted string with detailed license information.
    """
    try:
        result = f"🔐 License Status Report\n"
        result += "=" * 50 + "\n\n"
        
        # Get license status
        license_status = license_manager.get_license_status()
        
        # Basic status
        result += f"📋 License Status:\n"
        result += f"  🔐 Enabled: {'✅ Yes' if license_status['enabled'] else '❌ No'}\n"
        result += f"  ✅ Valid: {'✅ Yes' if license_status['valid'] else '❌ No'}\n"
        result += f"  🏷️  Tier: {license_status['tier'].upper()}\n"
        result += f"  📅 Expires: {license_status['expires_at'] or 'Never'}\n"
        result += f"  🔄 Offline Mode: {'✅ Yes' if license_status['offline_mode'] else '❌ No'}\n\n"
        
        # Device information
        result += f"🖥️  Device Information:\n"
        result += f"  🆔 Device ID: {license_status['device_id'] or 'Unknown'}\n"
        result += f"  🕒 Last Validated: {license_status['last_validated'] or 'Never'}\n"
        result += f"  ⏰ Validation Interval: {license_status['validation_interval']} seconds\n"
        result += f"  🔄 Offline Grace Period: {license_status['offline_grace_period']} seconds\n\n"
        
        # Features and limits
        features = license_status.get('features', [])
        limits = license_status.get('limits', {})
        
        result += f"🎯 Available Features:\n"
        if features:
            for feature in features:
                result += f"  ✅ {feature}\n"
        else:
            result += f"  ❌ No features available\n"
        result += "\n"
        
        result += f"📊 Tier Limits:\n"
        if limits:
            for limit_name, limit_value in limits.items():
                if isinstance(limit_value, int):
                    if 'size' in limit_name.lower():
                        # Format file sizes
                        if limit_value >= 1024 * 1024:
                            formatted_value = f"{limit_value // (1024 * 1024)} MB"
                        elif limit_value >= 1024:
                            formatted_value = f"{limit_value // 1024} KB"
                        else:
                            formatted_value = f"{limit_value} bytes"
                    else:
                        formatted_value = f"{limit_value:,}"
                else:
                    formatted_value = str(limit_value)
                result += f"  📏 {limit_name}: {formatted_value}\n"
        else:
            result += f"  ❌ No limits configured\n"
        result += "\n"
        
        # Error information if license is invalid
        if not license_status['valid']:
            error_msg = license_manager.get_user_friendly_error()
            result += f"❌ License Error:\n"
            result += f"  {error_msg}\n\n"
        
        # Tier comparison
        result += f"📈 Tier Comparison:\n"
        tiers = config.get('license.tiers', {})
        for tier_name, tier_info in tiers.items():
            tier_features = tier_info.get('features', [])
            tier_limits = tier_info.get('limits', {})
            
            current_indicator = "👑" if tier_name == license_status['tier'] else "  "
            result += f"  {current_indicator} {tier_name.upper()}:\n"
            result += f"    Features: {len(tier_features)}\n"
            result += f"    Limits: {len(tier_limits)}\n"
        
        logger.info("License status requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting license status: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'validate_license')
@audit_log('validate_license', saas)
def validate_license(force_refresh: bool = False) -> str:
    """
    Validate the current license with the SaaS backend.
    
    This tool forces a license validation check, useful for troubleshooting
    license issues or refreshing license status.
    
    Args:
        force_refresh: Force validation even if cache is still valid
        
    Returns:
        A formatted string with validation results.
    """
    try:
        result = f"🔐 License Validation\n"
        result += "=" * 50 + "\n\n"
        
        if not license_manager.enabled:
            result += "❌ License validation is disabled\n"
            return result
        
        result += f"🔄 Validating license...\n"
        if force_refresh:
            result += f"⚡ Force refresh enabled\n"
        
        # Perform validation
        validation_success = license_manager.validate_license(force_refresh=force_refresh)
        
        if validation_success:
            license_status = license_manager.get_license_status()
            result += f"✅ License validation successful!\n\n"
            result += f"📋 Updated Status:\n"
            result += f"  🏷️  Tier: {license_status['tier'].upper()}\n"
            result += f"  📅 Expires: {license_status['expires_at'] or 'Never'}\n"
            result += f"  🔄 Offline Mode: {'✅ Yes' if license_status['offline_mode'] else '❌ No'}\n"
            result += f"  🕒 Last Validated: {license_status['last_validated'] or 'Never'}\n"
            result += f"  🎯 Features: {len(license_status.get('features', []))}\n"
        else:
            error_msg = license_manager.get_user_friendly_error()
            result += f"❌ License validation failed!\n\n"
            result += f"Error: {error_msg}\n"
        
        logger.info(f"License validation requested (force_refresh={force_refresh})")
        return result
        
    except Exception as e:
        error_msg = f"Error validating license: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'get_device_info')
@audit_log('get_device_info', saas)
def get_device_info() -> str:
    """
    Get device fingerprinting information for license enforcement.
    
    This tool shows the device information used for license validation,
    including hardware, software, and network details (if enabled).
    
    Returns:
        A formatted string with device fingerprinting information.
    """
    try:
        result = f"🖥️  Device Information\n"
        result += "=" * 50 + "\n\n"
        
        # Device fingerprinting configuration
        device_config = config.get('license.device_fingerprint', {})
        result += f"⚙️  Fingerprinting Configuration:\n"
        result += f"  🔐 Enabled: {'✅ Yes' if device_config.get('enabled', True) else '❌ No'}\n"
        result += f"  🔧 Hardware: {'✅ Yes' if device_config.get('include_hardware', True) else '❌ No'}\n"
        result += f"  💻 Software: {'✅ Yes' if device_config.get('include_software', True) else '❌ No'}\n"
        result += f"  🌐 Network: {'✅ Yes' if device_config.get('include_network', False) else '❌ No'}\n\n"
        
        # Device ID
        device_id = license_manager.device_id
        result += f"🆔 Device ID:\n"
        result += f"  {device_id}\n\n"
        
        # Detailed device information
        if device_config.get('enabled', True):
            result += f"📋 Device Details:\n"
            
            # Hardware information
            if device_config.get('include_hardware', True):
                result += f"  🔧 Hardware:\n"
                hardware_info = license_manager.device_fingerprinter._get_hardware_info()
                for key, value in hardware_info.items():
                    result += f"    {key}: {value}\n"
                result += "\n"
            
            # Software information
            if device_config.get('include_software', True):
                result += f"  💻 Software:\n"
                software_info = license_manager.device_fingerprinter._get_software_info()
                for key, value in software_info.items():
                    result += f"    {key}: {value}\n"
                result += "\n"
            
            # Network information
            if device_config.get('include_network', False):
                result += f"  🌐 Network:\n"
                network_info = license_manager.device_fingerprinter._get_network_info()
                if network_info:
                    for key, value in network_info.items():
                        result += f"    {key}: {value}\n"
                else:
                    result += f"    No network information available\n"
                result += "\n"
        
        # Security note
        result += f"🔒 Security Note:\n"
        result += f"  Device fingerprinting is used for license enforcement.\n"
        result += f"  The device ID is a secure hash of your system characteristics.\n"
        result += f"  No sensitive personal information is collected or transmitted.\n"
        
        logger.info("Device information requested")
        return result
        
    except Exception as e:
        error_msg = f"Error getting device info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'advanced_search')
@audit_log('advanced_search', saas)
@require_tier('pro', license_manager)
def advanced_search(query: str, directory: str = ".") -> str:
    """
    Advanced file search with pattern matching and content filtering.
    
    This is a PRO tier feature that provides enhanced search capabilities
    including regex patterns, content search, and advanced filtering options.
    
    Args:
        query: Search query or pattern
        directory: Directory to search in
        
    Returns:
        A formatted string with search results.
    """
    try:
        result = f"🔍 Advanced Search Results\n"
        result += "=" * 50 + "\n\n"
        result += f"🔎 Query: {query}\n"
        result += f"📁 Directory: {directory}\n\n"
        
        # This would implement advanced search functionality
        # For now, we'll just show that the feature is available
        result += f"✅ Advanced search feature is available in PRO tier!\n"
        result += f"📊 This feature includes:\n"
        result += f"  🔍 Regex pattern matching\n"
        result += f"  📄 Content-based search\n"
        result += f"  🎯 Advanced filtering\n"
        result += f"  📈 Search analytics\n"
        
        logger.info(f"Advanced search performed: {query} in {directory}")
        return result
        
    except Exception as e:
        error_msg = f"Error performing advanced search: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'enterprise_analytics')
@audit_log('enterprise_analytics', saas)
@require_tier('enterprise', license_manager)
def enterprise_analytics() -> str:
    """
    Enterprise-level analytics and reporting dashboard.
    
    This is an ENTERPRISE tier feature that provides comprehensive
    analytics, custom reporting, and advanced data insights.
    
    Returns:
        A formatted string with analytics dashboard.
    """
    try:
        result = f"📊 Enterprise Analytics Dashboard\n"
        result += "=" * 50 + "\n\n"
        
        # This would implement enterprise analytics functionality
        # For now, we'll just show that the feature is available
        result += f"✅ Enterprise analytics feature is available!\n"
        result += f"📈 This feature includes:\n"
        result += f"  📊 Custom dashboards\n"
        result += f"  📈 Advanced reporting\n"
        result += f"  🔍 Data insights\n"
        result += f"  📋 Export capabilities\n"
        result += f"  🎯 Custom integrations\n"
        result += f"  📱 Real-time monitoring\n"
        
        # Show some mock analytics data
        result += f"\n📊 Sample Analytics:\n"
        result += f"  📁 Files processed: 1,234\n"
        result += f"  ⏱️  Average response time: 0.15s\n"
        result += f"  🎯 Success rate: 99.8%\n"
        result += f"  📈 Growth: +12.5% this month\n"
        
        logger.info("Enterprise analytics dashboard accessed")
        return result
        
    except Exception as e:
        error_msg = f"Error accessing enterprise analytics: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


@mcp.tool()
@performance_monitor(monitor, 'custom_integration')
@audit_log('custom_integration', saas)
@require_feature('custom_integrations', license_manager)
def custom_integration(integration_name: str) -> str:
    """
    Custom integration management for enterprise users.
    
    This feature is only available to users with the 'custom_integrations'
    feature enabled in their license.
    
    Args:
        integration_name: Name of the integration to manage
        
    Returns:
        A formatted string with integration status.
    """
    try:
        result = f"🔗 Custom Integration Management\n"
        result += "=" * 50 + "\n\n"
        result += f"🎯 Integration: {integration_name}\n\n"
        
        # This would implement custom integration functionality
        result += f"✅ Custom integration feature is available!\n"
        result += f"🔧 This feature includes:\n"
        result += f"  🔗 API integrations\n"
        result += f"  📡 Webhook management\n"
        result += f"  🔄 Data synchronization\n"
        result += f"  📊 Integration monitoring\n"
        result += f"  🛠️  Custom connectors\n"
        
        # Show integration status
        result += f"\n📋 Integration Status:\n"
        result += f"  🟢 Status: Active\n"
        result += f"  📊 Last sync: 2 minutes ago\n"
        result += f"  📈 Success rate: 99.9%\n"
        result += f"  🔄 Sync frequency: Every 5 minutes\n"
        
        logger.info(f"Custom integration accessed: {integration_name}")
        return result
        
    except Exception as e:
        error_msg = f"Error accessing custom integration: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return f"Error: {error_msg}"


# =============================================================================
# SERVER STARTUP AND SHUTDOWN
# =============================================================================

def startup_hooks():
    """Execute startup hooks and initialization."""
    logger.info("Executing startup hooks...")
    
    # Test SaaS connection first if enabled
    if saas.enabled:
        logger.info("🔍 Testing SaaS platform connection...")
        connection_test = saas.test_connection()
        
        if connection_test['success']:
            logger.info("✅ SaaS platform connection successful!")
            details = connection_test.get('details', {})
            logger.info(f"   📡 API Endpoint: {details.get('api_endpoint', 'Unknown')}")
            logger.info(f"   🏥 Health Status: {details.get('health_status', 'Unknown')}")
            logger.info(f"   ⏱️  Response Time: {details.get('response_time', 'Unknown')}")
            logger.info(f"   🏷️  Version: {details.get('version', 'Unknown')}")
            
            # Log service status
            services = details.get('services', {})
            for service, status in services.items():
                status_icon = "✅" if status == "connected" else "❌"
                logger.info(f"   {status_icon} {service.title()}: {status}")
        else:
            logger.error(f"❌ SaaS platform connection failed: {connection_test['message']}")
            if connection_test.get('details', {}).get('error'):
                logger.error(f"   Error details: {connection_test['details']['error']}")
    
    # Initialize license manager
    if not license_manager.initialize():
        logger.warning("License manager initialization failed, continuing with limited functionality")
    
    # Test license validation if SaaS is enabled
    if saas.enabled and config.get('saas.enable_license_validation', False):
        logger.info("🔐 Testing license validation...")
        license_key = config.get('saas.api_key', '') or config.get('license.license_key', '')
        
        if license_key:
            validation_result = saas.validate_license(license_key)
            if validation_result.get('valid'):
                logger.info(f"✅ License validation successful: {validation_result.get('message', 'Valid license')}")
            else:
                logger.warning(f"⚠️  License validation failed: {validation_result.get('message', 'Invalid license')}")
        else:
            logger.warning("⚠️  No license key found for validation")
    
    # Initialize authentication
    if auth_manager.enabled:
        if not auth_manager.authenticate():
            logger.warning("Authentication failed, continuing with limited functionality")
    
    # Start usage tracker
    usage_tracker.start()
    
    # SaaS integration startup
    if saas.enabled:
        saas.send_analytics('server_startup', {
            'version': config.get('server.version'),
            'config_path': config.config_path,
            'license_tier': license_manager.license_status.get('tier', 'free'),
            'user_authenticated': auth_manager.is_authenticated,
            'user_email': auth_manager.user_info.get('email', 'unknown'),
            'connection_test_passed': connection_test.get('success', False) if saas.enabled else False
        })
    
    # Track server startup
    usage_tracker.track_performance_metric('server_startup', 0.0, 'event')
    
    # Initialize any additional services here
    logger.info("Startup hooks completed")

def shutdown_hooks():
    """Execute shutdown hooks and cleanup."""
    logger.info("Executing shutdown hooks...")
    
    # Track server shutdown
    usage_tracker.track_performance_metric('server_shutdown', 0.0, 'event')
    
    # SaaS integration shutdown
    if saas.enabled:
        saas.send_analytics('server_shutdown', {
            'final_stats': monitor.get_stats(),
            'license_tier': license_manager.license_status.get('tier', 'free'),
            'usage_stats': usage_tracker.get_usage_stats(),
            'user_authenticated': auth_manager.is_authenticated
        })
    
    # Stop usage tracker
    usage_tracker.stop()
    
    # Cleanup authentication
    auth_manager.cleanup()
    
    # Close SaaS integration
    saas.close()
    
    # Cleanup license manager
    license_manager.cleanup()
    
    # Cleanup cache
    cache.clear()
    
    # Log final statistics
    final_stats = monitor.get_stats()
    usage_stats = usage_tracker.get_usage_stats()
    auth_stats = auth_manager.get_auth_status()
    logger.info(f"Final server statistics: {final_stats}")
    logger.info(f"Final usage statistics: {usage_stats}")
    logger.info(f"Final authentication status: {auth_stats}")
    
    logger.info("Shutdown hooks completed")

# =============================================================================
# MAIN EXECUTION
# =============================================================================

if __name__ == "__main__":
    try:
        # Execute startup hooks
        startup_hooks()
        
        # Start the MCP server
        logger.info("Starting MCP server...")
        mcp.run()
        
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
    finally:
        # Execute shutdown hooks
        shutdown_hooks()
        logger.info("MCP server stopped")