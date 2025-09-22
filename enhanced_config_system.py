#!/usr/bin/env python3
"""
Enhanced Configuration System for MCP Server

This module extends the existing MCP configuration system with support for
all enhanced features, performance tuning, and feature enable/disable flags.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, field, asdict
from pathlib import Path
from datetime import datetime
import threading

logger = logging.getLogger(__name__)

@dataclass
class PerformanceConfig:
    """Performance tuning configuration"""
    max_files_per_operation: int = 1000
    max_search_results: int = 500
    max_file_size_mb: int = 100
    operation_timeout: int = 300  # 5 minutes
    cache_size_file: int = 500
    cache_size_symbol: int = 1000
    cache_size_git: int = 100
    cache_ttl_seconds: int = 300
    indexing_batch_size: int = 100
    indexing_parallel_workers: int = 4
    monitoring_frequency: float = 1.0  # seconds
    memory_limit_mb: int = 1024
    cpu_limit_percent: int = 80

@dataclass
class FeatureFlags:
    """Feature enable/disable flags"""
    code_indexing: bool = True
    real_time_monitoring: bool = True
    git_integration: bool = True
    security_scanning: bool = True
    performance_monitoring: bool = True
    advanced_search: bool = True
    symbol_analysis: bool = True
    reference_tracking: bool = True
    test_discovery: bool = True
    audit_logging: bool = True
    usage_tracking: bool = True
    progress_indicators: bool = True
    error_recovery: bool = True
    auto_cleanup: bool = True

@dataclass
class LoggingConfig:
    """Logging configuration"""
    level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    file_path: Optional[str] = None
    max_file_size_mb: int = 10
    backup_count: int = 5
    format_string: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    include_performance_metrics: bool = True
    include_usage_statistics: bool = True
    log_rotation: bool = True
    debug_mode: bool = False

@dataclass
class SecurityConfig:
    """Security configuration"""
    mode: str = "moderate"  # strict, moderate, permissive
    scan_file_extensions: List[str] = field(default_factory=lambda: [
        ".py", ".js", ".ts", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".php", ".rb", ".go", ".rs"
    ])
    scan_max_file_size_mb: int = 5
    scan_timeout_seconds: int = 30
    audit_sensitive_operations: bool = True
    block_system_directories: bool = True
    require_authentication: bool = False
    api_rate_limit: int = 100  # requests per minute

@dataclass
class IndexingConfig:
    """Code indexing configuration"""
    auto_index_on_startup: bool = True
    index_file_extensions: List[str] = field(default_factory=lambda: [
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".h", ".hpp", 
        ".cs", ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".scala", ".clj"
    ])
    skip_binary_files: bool = True
    skip_large_files: bool = True
    large_file_threshold_mb: int = 1
    index_comments: bool = True
    index_strings: bool = False
    max_symbols_per_file: int = 1000
    index_depth_limit: int = 10

@dataclass
class MonitoringConfig:
    """File monitoring configuration"""
    enabled: bool = True
    watch_subdirectories: bool = True
    debounce_seconds: float = 0.5
    max_watched_directories: int = 50
    ignore_patterns: List[str] = field(default_factory=lambda: [
        "*.tmp", "*.temp", "*.log", "*.cache", "*.pyc", "__pycache__", 
        ".git", "node_modules", ".vscode", ".idea"
    ])
    health_check_interval: int = 30  # seconds
    performance_report_interval: int = 300  # 5 minutes

@dataclass
class EnhancedMCPConfig:
    """Enhanced MCP configuration with all new features"""
    # Core configuration (from original MCPConfig)
    watched_directories: List[Dict[str, Any]] = field(default_factory=list)
    global_exclude_patterns: List[str] = field(default_factory=lambda: [
        ".env*", "node_modules", ".git", "__pycache__", "*.pyc", "*.log",
        "*.tmp", "*.temp", ".DS_Store", "Thumbs.db", "*.swp", "*.swo"
    ])
    max_file_size: str = "10MB"
    enabled: bool = True
    audit_logging: bool = True
    security_mode: str = "moderate"
    config_version: str = "2.1.0"
    last_modified: str = field(default_factory=lambda: datetime.now().isoformat())
    
    # Enhanced features configuration
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    features: FeatureFlags = field(default_factory=FeatureFlags)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    indexing: IndexingConfig = field(default_factory=IndexingConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    
    # Additional metadata
    installation_id: Optional[str] = None
    last_upgrade: Optional[str] = None
    feature_usage_stats: Dict[str, int] = field(default_factory=dict)
    performance_history: List[Dict[str, Any]] = field(default_factory=list)

class EnhancedConfigManager:
    """Enhanced configuration manager with feature detection and auto-configuration"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._get_default_config_path()
        self.config: Optional[EnhancedMCPConfig] = None
        self._lock = threading.RLock()
        self._migration_needed = False
        
        # Load and migrate configuration
        self._load_and_migrate_config()
    
    def _get_default_config_path(self) -> str:
        """Get the default configuration file path"""
        try:
            home = Path.home()
            config_dir = home / ".mcp"
            config_dir.mkdir(exist_ok=True)
            return str(config_dir / "enhanced_config.json")
        except Exception as e:
            logger.error(f"Failed to create config directory: {e}")
            return "enhanced_config.json"
    
    def _load_and_migrate_config(self):
        """Load configuration and migrate from old format if needed"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check if migration is needed
                if data.get('config_version', '1.0.0') < '2.1.0':
                    self._migration_needed = True
                    logger.info("Configuration migration needed from version %s to 2.1.0", 
                               data.get('config_version', '1.0.0'))
                
                # Convert to enhanced config
                self.config = self._convert_to_enhanced_config(data)
            else:
                # Create new enhanced configuration
                self.config = EnhancedMCPConfig()
                self._auto_configure_features()
                self.save_config()
                logger.info("Created new enhanced configuration")
                
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            # Create minimal fallback configuration
            self.config = EnhancedMCPConfig()
            self._auto_configure_features()
    
    def _convert_to_enhanced_config(self, data: Dict[str, Any]) -> EnhancedMCPConfig:
        """Convert old configuration format to enhanced format"""
        # Create enhanced config with defaults
        enhanced_config = EnhancedMCPConfig()
        
        # Migrate core configuration
        enhanced_config.watched_directories = data.get('watched_directories', [])
        enhanced_config.global_exclude_patterns = data.get('global_exclude_patterns', 
                                                          enhanced_config.global_exclude_patterns)
        enhanced_config.max_file_size = data.get('max_file_size', enhanced_config.max_file_size)
        enhanced_config.enabled = data.get('enabled', enhanced_config.enabled)
        enhanced_config.audit_logging = data.get('audit_logging', enhanced_config.audit_logging)
        enhanced_config.security_mode = data.get('security_mode', enhanced_config.security_mode)
        enhanced_config.config_version = data.get('config_version', enhanced_config.config_version)
        enhanced_config.last_modified = data.get('last_modified', enhanced_config.last_modified)
        
        # Migrate enhanced features if present
        if 'performance' in data:
            perf_data = data['performance']
            enhanced_config.performance = PerformanceConfig(**perf_data)
        
        if 'features' in data:
            feat_data = data['features']
            enhanced_config.features = FeatureFlags(**feat_data)
        
        if 'logging' in data:
            log_data = data['logging']
            enhanced_config.logging = LoggingConfig(**log_data)
        
        if 'security' in data:
            sec_data = data['security']
            enhanced_config.security = SecurityConfig(**sec_data)
        
        if 'indexing' in data:
            idx_data = data['indexing']
            enhanced_config.indexing = IndexingConfig(**idx_data)
        
        if 'monitoring' in data:
            mon_data = data['monitoring']
            enhanced_config.monitoring = MonitoringConfig(**mon_data)
        
        # Auto-configure features if this is a migration
        if self._migration_needed:
            self._auto_configure_features()
            enhanced_config.last_upgrade = datetime.now().isoformat()
        
        return enhanced_config
    
    def _auto_configure_features(self):
        """Auto-configure features based on system capabilities and project type"""
        if not self.config:
            return
        
        logger.info("Auto-configuring features based on system capabilities...")
        
        # Detect project type
        project_type = self._detect_project_type()
        
        # Configure based on project type
        if project_type == "python":
            self.config.indexing.index_file_extensions = [".py", ".pyi", ".pyx"]
            self.config.security.scan_file_extensions = [".py"]
        elif project_type == "javascript":
            self.config.indexing.index_file_extensions = [".js", ".jsx", ".ts", ".tsx", ".json"]
            self.config.security.scan_file_extensions = [".js", ".ts"]
        elif project_type == "java":
            self.config.indexing.index_file_extensions = [".java", ".kt", ".scala"]
            self.config.security.scan_file_extensions = [".java"]
        elif project_type == "cpp":
            self.config.indexing.index_file_extensions = [".cpp", ".c", ".h", ".hpp", ".cc", ".cxx"]
            self.config.security.scan_file_extensions = [".cpp", ".c", ".h"]
        else:
            # Multi-language project, use comprehensive defaults
            pass
        
        # Adjust performance settings based on system resources
        self._optimize_performance_settings()
        
        # Configure monitoring based on directory count
        if len(self.config.watched_directories) > 10:
            self.config.monitoring.debounce_seconds = 1.0  # Slower for large projects
            self.config.performance.indexing_parallel_workers = 2  # Reduce parallelism
        
        logger.info(f"Auto-configured for {project_type} project type")
    
    def _detect_project_type(self) -> str:
        """Detect the primary project type based on watched directories"""
        if not self.config or not self.config.watched_directories:
            return "unknown"
        
        file_extensions = {}
        
        for dir_config in self.config.watched_directories:
            dir_path = dir_config.get('path', '')
            if not os.path.exists(dir_path):
                continue
            
            try:
                for root, dirs, files in os.walk(dir_path):
                    # Skip common directories
                    dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', '__pycache__', '.vscode'}]
                    
                    for file in files:
                        ext = Path(file).suffix.lower()
                        if ext:
                            file_extensions[ext] = file_extensions.get(ext, 0) + 1
            except Exception:
                continue
        
        # Determine primary language
        if file_extensions.get('.py', 0) > file_extensions.get('.js', 0):
            return "python"
        elif file_extensions.get('.js', 0) > 0 or file_extensions.get('.ts', 0) > 0:
            return "javascript"
        elif file_extensions.get('.java', 0) > 0:
            return "java"
        elif file_extensions.get('.cpp', 0) > 0 or file_extensions.get('.c', 0) > 0:
            return "cpp"
        else:
            return "multi"
    
    def _optimize_performance_settings(self):
        """Optimize performance settings based on system resources"""
        try:
            import psutil
            
            # Get system resources
            memory_gb = psutil.virtual_memory().total / (1024**3)
            cpu_count = psutil.cpu_count()
            
            # Adjust cache sizes based on available memory
            if memory_gb < 4:
                self.config.performance.cache_size_file = 100
                self.config.performance.cache_size_symbol = 200
                self.config.performance.cache_size_git = 50
                self.config.performance.memory_limit_mb = 512
            elif memory_gb < 8:
                self.config.performance.cache_size_file = 250
                self.config.performance.cache_size_symbol = 500
                self.config.performance.cache_size_git = 75
                self.config.performance.memory_limit_mb = 1024
            else:
                self.config.performance.cache_size_file = 500
                self.config.performance.cache_size_symbol = 1000
                self.config.performance.cache_size_git = 100
                self.config.performance.memory_limit_mb = 2048
            
            # Adjust parallelism based on CPU count
            if cpu_count <= 2:
                self.config.performance.indexing_parallel_workers = 1
            elif cpu_count <= 4:
                self.config.performance.indexing_parallel_workers = 2
            else:
                self.config.performance.indexing_parallel_workers = min(4, cpu_count // 2)
            
            logger.info(f"Optimized performance settings for {memory_gb:.1f}GB RAM, {cpu_count} CPUs")
            
        except ImportError:
            logger.warning("psutil not available, using default performance settings")
        except Exception as e:
            logger.error(f"Failed to optimize performance settings: {e}")
    
    def save_config(self) -> bool:
        """Save the enhanced configuration"""
        try:
            with self._lock:
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
                
                # Create backup of existing config
                if os.path.exists(self.config_path):
                    backup_path = self.config_path + ".backup"
                    try:
                        import shutil
                        shutil.copy2(self.config_path, backup_path)
                    except Exception as e:
                        logger.warning(f"Failed to create config backup: {e}")
                
                # Save configuration
                with open(self.config_path, 'w', encoding='utf-8') as f:
                    json.dump(config_dict, f, indent=2, ensure_ascii=False)
                
                logger.info(f"Enhanced configuration saved to {self.config_path}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to save enhanced configuration: {e}")
            return False
    
    def get_feature_config(self, feature_name: str) -> Dict[str, Any]:
        """Get configuration for a specific feature"""
        if not self.config:
            return {}
        
        feature_configs = {
            'performance': asdict(self.config.performance),
            'features': asdict(self.config.features),
            'logging': asdict(self.config.logging),
            'security': asdict(self.config.security),
            'indexing': asdict(self.config.indexing),
            'monitoring': asdict(self.config.monitoring)
        }
        
        return feature_configs.get(feature_name, {})
    
    def update_feature_config(self, feature_name: str, updates: Dict[str, Any]) -> bool:
        """Update configuration for a specific feature"""
        try:
            with self._lock:
                if not self.config:
                    return False
                
                if feature_name == 'performance':
                    for key, value in updates.items():
                        if hasattr(self.config.performance, key):
                            setattr(self.config.performance, key, value)
                elif feature_name == 'features':
                    for key, value in updates.items():
                        if hasattr(self.config.features, key):
                            setattr(self.config.features, key, value)
                elif feature_name == 'logging':
                    for key, value in updates.items():
                        if hasattr(self.config.logging, key):
                            setattr(self.config.logging, key, value)
                elif feature_name == 'security':
                    for key, value in updates.items():
                        if hasattr(self.config.security, key):
                            setattr(self.config.security, key, value)
                elif feature_name == 'indexing':
                    for key, value in updates.items():
                        if hasattr(self.config.indexing, key):
                            setattr(self.config.indexing, key, value)
                elif feature_name == 'monitoring':
                    for key, value in updates.items():
                        if hasattr(self.config.monitoring, key):
                            setattr(self.config.monitoring, key, value)
                else:
                    logger.error(f"Unknown feature: {feature_name}")
                    return False
                
                return self.save_config()
                
        except Exception as e:
            logger.error(f"Failed to update feature config {feature_name}: {e}")
            return False
    
    def is_feature_enabled(self, feature_name: str) -> bool:
        """Check if a feature is enabled"""
        if not self.config or not hasattr(self.config.features, feature_name):
            return False
        
        return getattr(self.config.features, feature_name, False)
    
    def enable_feature(self, feature_name: str) -> bool:
        """Enable a specific feature"""
        return self.update_feature_config('features', {feature_name: True})
    
    def disable_feature(self, feature_name: str) -> bool:
        """Disable a specific feature"""
        return self.update_feature_config('features', {feature_name: False})
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a comprehensive configuration summary"""
        if not self.config:
            return {"error": "No configuration loaded"}
        
        return {
            "config_version": self.config.config_version,
            "last_modified": self.config.last_modified,
            "enabled": self.config.enabled,
            "watched_directories_count": len(self.config.watched_directories),
            "features_enabled": {
                name: getattr(self.config.features, name, False)
                for name in dir(self.config.features)
                if not name.startswith('_')
            },
            "performance_settings": {
                "max_files_per_operation": self.config.performance.max_files_per_operation,
                "cache_sizes": {
                    "file": self.config.performance.cache_size_file,
                    "symbol": self.config.performance.cache_size_symbol,
                    "git": self.config.performance.cache_size_git
                },
                "memory_limit_mb": self.config.performance.memory_limit_mb,
                "parallel_workers": self.config.performance.indexing_parallel_workers
            },
            "security_mode": self.config.security.mode,
            "logging_level": self.config.logging.level,
            "monitoring_enabled": self.config.monitoring.enabled,
            "indexing_auto_enabled": self.config.indexing.auto_index_on_startup
        }
    
    def validate_configuration(self) -> Dict[str, Any]:
        """Validate the current configuration"""
        validation_results = {
            "valid": True,
            "warnings": [],
            "errors": [],
            "recommendations": []
        }
        
        if not self.config:
            validation_results["valid"] = False
            validation_results["errors"].append("No configuration loaded")
            return validation_results
        
        # Validate performance settings
        if self.config.performance.max_files_per_operation > 10000:
            validation_results["warnings"].append("max_files_per_operation is very high, may cause performance issues")
        
        if self.config.performance.memory_limit_mb < 256:
            validation_results["warnings"].append("memory_limit_mb is very low, may cause out-of-memory errors")
        
        # Validate security settings
        if self.config.security.mode not in ["strict", "moderate", "permissive"]:
            validation_results["errors"].append("Invalid security mode")
            validation_results["valid"] = False
        
        # Validate logging settings
        if self.config.logging.level not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            validation_results["errors"].append("Invalid logging level")
            validation_results["valid"] = False
        
        # Check for recommended settings
        if len(self.config.watched_directories) > 20:
            validation_results["recommendations"].append("Consider reducing the number of watched directories for better performance")
        
        if not self.config.features.auto_cleanup:
            validation_results["recommendations"].append("Enable auto_cleanup to prevent cache bloat")
        
        return validation_results

# Global enhanced config manager instance
enhanced_config_manager = EnhancedConfigManager()

def get_enhanced_config() -> Optional[EnhancedMCPConfig]:
    """Get the global enhanced configuration"""
    return enhanced_config_manager.config

def is_feature_enabled(feature_name: str) -> bool:
    """Check if a feature is enabled globally"""
    return enhanced_config_manager.is_feature_enabled(feature_name)

def get_performance_config() -> PerformanceConfig:
    """Get performance configuration"""
    if enhanced_config_manager.config:
        return enhanced_config_manager.config.performance
    return PerformanceConfig()

def get_feature_flags() -> FeatureFlags:
    """Get feature flags"""
    if enhanced_config_manager.config:
        return enhanced_config_manager.config.features
    return FeatureFlags()
