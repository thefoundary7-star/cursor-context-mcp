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
import re
import ast
import json
import threading
import time
import hashlib
import psutil
import functools
import weakref
import stat
import stat
import platform
from pathlib import Path
from typing import List, Optional, Dict, Any, Set, Tuple, Callable, Union
import logging
from dataclasses import dataclass, field
from collections import defaultdict, OrderedDict, deque
from enum import Enum
import traceback
from datetime import datetime, timedelta
import fnmatch

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

# Enhanced Features Data Structures
@dataclass
class Symbol:
    name: str
    type: str  # function, class, variable, import
    file_path: str
    line_number: int
    definition: str
    docstring: Optional[str] = None

@dataclass
class Reference:
    symbol_name: str
    file_path: str
    line_number: int
    context: str
    ref_type: str  # call, import, assignment

@dataclass
class TestResult:
    test_name: str
    status: str  # passed, failed, skipped
    duration: float
    error_message: Optional[str] = None
    file_path: Optional[str] = None

class ErrorCategory(Enum):
    """Error categories for better error handling and reporting"""
    PERMISSION = "permission"
    TIMEOUT = "timeout"
    NOT_FOUND = "not_found"
    INVALID_INPUT = "invalid_input"
    SYSTEM_ERROR = "system_error"
    NETWORK_ERROR = "network_error"
    VALIDATION_ERROR = "validation_error"
    RESOURCE_LIMIT = "resource_limit"

@dataclass
class ErrorInfo:
    """Structured error information"""
    category: ErrorCategory
    message: str
    suggestion: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    timestamp: float = field(default_factory=time.time)

@dataclass
class PerformanceMetrics:
    """Performance metrics for a single operation"""
    operation_name: str
    execution_time: float
    memory_usage_mb: float
    success: bool
    error_category: Optional[ErrorCategory] = None
    timestamp: float = field(default_factory=time.time)
    context: Optional[Dict[str, Any]] = None

@dataclass
class CacheStats:
    """Cache statistics"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    max_size: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

# Security-related data structures
@dataclass
class SecurityIssue:
    """Represents a security issue found during audit"""
    severity: str  # "critical", "high", "medium", "low"
    category: str  # "hardcoded_secret", "dangerous_function", "weak_permissions", "path_traversal"
    file_path: str
    line_number: int
    description: str
    recommendation: str
    context: Optional[str] = None

@dataclass
class SecurityAuditResult:
    """Results of a security audit"""
    file_path: str
    security_score: int  # 0-100
    issues: List[SecurityIssue]
    recommendations: List[str]
    scan_timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class RateLimitInfo:
    """Rate limiting information for a tool"""
    tool_name: str
    requests: deque
    limit: int
    window_seconds: int
    blocked_until: Optional[datetime] = None

@dataclass
class AuditLogEntry:
    """Audit log entry for security tracking"""
    timestamp: datetime
    action: str
    tool_name: str
    file_path: Optional[str]
    user_context: str
    success: bool
    error_message: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None

class LRUCache:
    """Thread-safe LRU cache implementation"""
    
    def __init__(self, max_size: int = 1000, ttl: Optional[float] = None):
        self.max_size = max_size
        self.ttl = ttl
        self._cache: OrderedDict = OrderedDict()
        self._timestamps: Dict[str, float] = {}
        self._lock = threading.RLock()
        self.stats = CacheStats(max_size=max_size)
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                self.stats.misses += 1
                return None
            
            # Check TTL
            if self.ttl and time.time() - self._timestamps[key] > self.ttl:
                del self._cache[key]
                del self._timestamps[key]
                self.stats.misses += 1
                self.stats.evictions += 1
                return None
            
            # Move to end (most recently used)
            value = self._cache.pop(key)
            self._cache[key] = value
            self.stats.hits += 1
            return value
    
    def put(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._cache:
                # Update existing
                self._cache.pop(key)
            elif len(self._cache) >= self.max_size:
                # Evict least recently used
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                del self._timestamps[oldest_key]
                self.stats.evictions += 1
            
            self._cache[key] = value
            self._timestamps[key] = time.time()
            self.stats.size = len(self._cache)
    
    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()
            self.stats.size = 0
    
    def get_stats(self) -> CacheStats:
        with self._lock:
            self.stats.size = len(self._cache)
            return CacheStats(
                hits=self.stats.hits,
                misses=self.stats.misses,
                evictions=self.stats.evictions,
                size=self.stats.size,
                max_size=self.stats.max_size
            )

class SecurityManager:
    """Comprehensive security management for the MCP server"""
    
    def __init__(self, config_manager: 'MCPConfigManager'):
        self.config_manager = config_manager
        self.audit_log: List[AuditLogEntry] = []
        self.rate_limits: Dict[str, RateLimitInfo] = {}
        self.allowed_extensions = {
            '.py', '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml',
            '.xml', '.html', '.css', '.scss', '.less', '.sql', '.sh', '.bat', '.ps1',
            '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb',
            '.swift', '.kt', '.scala', '.r', '.m', '.pl', '.lua', '.dart', '.vue',
            '.svelte', '.astro', '.toml', '.ini', '.cfg', '.conf', '.env.example'
        }
        self.dangerous_functions = {
            'eval', 'exec', 'compile', '__import__', 'open', 'file', 'input', 'raw_input',
            'os.system', 'os.popen', 'subprocess.call', 'subprocess.run', 'subprocess.Popen',
            'os.exec', 'os.spawn', 'os.spawnl', 'os.spawnle', 'os.spawnlp', 'os.spawnlpe',
            'os.spawnv', 'os.spawnve', 'os.spawnvp', 'os.spawnvpe', 'pickle.loads',
            'pickle.load', 'marshal.loads', 'marshal.load', 'shelve.open'
        }
        self.secret_patterns = [
            (r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'password'),
            (r'(?i)(api[_-]?key|apikey)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'api_key'),
            (r'(?i)(secret|secret[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'secret'),
            (r'(?i)(token|access[_-]?token)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'token'),
            (r'(?i)(private[_-]?key|privkey)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'private_key'),
            (r'(?i)(database[_-]?url|db[_-]?url)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'database_url'),
            (r'(?i)(connection[_-]?string|conn[_-]?str)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'connection_string'),
            (r'(?i)(aws[_-]?access[_-]?key|aws[_-]?secret)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'aws_credentials'),
            (r'(?i)(github[_-]?token|git[_-]?token)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'github_token'),
            (r'(?i)(slack[_-]?token|discord[_-]?token)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'chat_token'),
            (r'(?i)(stripe[_-]?key|paypal[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'payment_key'),
            (r'(?i)(jwt[_-]?secret|jwt[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'jwt_secret'),
            (r'(?i)(encryption[_-]?key|encrypt[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'encryption_key'),
            (r'(?i)(oauth[_-]?secret|oauth[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'oauth_secret'),
            (r'(?i)(session[_-]?secret|session[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'session_secret')
        ]
        self._lock = threading.RLock()
        
        # Privilege management
        self.read_only_mode = False
        self.minimal_privileges = True
        self._original_umask = None
        
        # Initialize rate limits
        self._init_rate_limits()
        
        # Initialize privilege management
        self._init_privilege_management()
    
    def _init_rate_limits(self):
        """Initialize rate limits for different tools"""
        rate_limit_config = {
            'read_file': (60, 60),  # 60 requests per minute
            'list_files': (30, 60),  # 30 requests per minute
            'search_files': (20, 60),  # 20 requests per minute
            'security_audit': (5, 60),  # 5 requests per minute
            'get_git_status': (30, 60),  # 30 requests per minute
            'get_git_diff': (20, 60),  # 20 requests per minute
            'get_commit_history': (15, 60),  # 15 requests per minute
            'default': (100, 60)  # 100 requests per minute for other tools
        }
        
        for tool_name, (limit, window) in rate_limit_config.items():
            self.rate_limits[tool_name] = RateLimitInfo(
                tool_name=tool_name,
                requests=deque(),
                limit=limit,
                window_seconds=window
            )
    
    def check_rate_limit(self, tool_name: str) -> Tuple[bool, Optional[str]]:
        """Check if a tool request is within rate limits"""
        with self._lock:
            now = datetime.now()
            rate_info = self.rate_limits.get(tool_name, self.rate_limits['default'])
            
            # Check if currently blocked
            if rate_info.blocked_until and now < rate_info.blocked_until:
                remaining = (rate_info.blocked_until - now).total_seconds()
                return False, f"Rate limit exceeded. Try again in {remaining:.1f} seconds."
            
            # Clean old requests outside the window
            cutoff = now - timedelta(seconds=rate_info.window_seconds)
            while rate_info.requests and rate_info.requests[0] < cutoff:
                rate_info.requests.popleft()
            
            # Check if limit exceeded
            if len(rate_info.requests) >= rate_info.limit:
                rate_info.blocked_until = now + timedelta(seconds=rate_info.window_seconds)
                return False, f"Rate limit exceeded. Maximum {rate_info.limit} requests per {rate_info.window_seconds} seconds."
            
            # Add current request
            rate_info.requests.append(now)
            return True, None
    
    def validate_path(self, path: str, operation: str = "read") -> Tuple[bool, Optional[str]]:
        """Enhanced path validation with security checks"""
        try:
            resolved_path = Path(path).resolve()
            path_str = str(resolved_path)
            
            # Check for path traversal attacks
            if '..' in path or path.startswith('/') and not path.startswith(str(Path.cwd())):
                return False, "Path traversal attack detected"
            
            # Check for symlink attacks
            if resolved_path.is_symlink():
                return False, "Symlink access not allowed for security"
            
            # Check if path is within allowed directories
            if not self.config_manager.is_path_allowed(path_str):
                return False, "Path not in allowed directories"
            
            # Check file extension for write operations
            if operation in ['write', 'create', 'delete'] and resolved_path.is_file():
                if resolved_path.suffix.lower() not in self.allowed_extensions:
                    return False, f"File extension {resolved_path.suffix} not allowed for {operation} operations"
            
            # Check file size limits
            if resolved_path.is_file():
                max_size = self.config_manager._parse_file_size(
                    self.config_manager.config.max_file_size
                )
                if resolved_path.stat().st_size > max_size:
                    return False, f"File size exceeds limit of {self.config_manager.config.max_file_size}"
            
            return True, None
            
        except Exception as e:
            return False, f"Path validation error: {str(e)}"
    
    def audit_file_security(self, file_path: str) -> SecurityAuditResult:
        """Perform comprehensive security audit on a file"""
        issues = []
        recommendations = []
        
        try:
            if not os.path.exists(file_path):
                return SecurityAuditResult(
                    file_path=file_path,
                    security_score=0,
                    issues=[SecurityIssue(
                        severity="high",
                        category="file_not_found",
                        file_path=file_path,
                        line_number=0,
                        description="File does not exist",
                        recommendation="Verify file path and permissions"
                    )],
                    recommendations=["Check file path and permissions"]
                )
            
            # Check file permissions
            file_stat = os.stat(file_path)
            if platform.system() != "Windows":
                # Check for overly permissive permissions on Unix-like systems
                mode = file_stat.st_mode
                if mode & stat.S_IWOTH:  # World writable
                    issues.append(SecurityIssue(
                        severity="high",
                        category="weak_permissions",
                        file_path=file_path,
                        line_number=0,
                        description="File is world-writable",
                        recommendation="Remove world-write permissions: chmod o-w"
                    ))
                elif mode & stat.S_IWGRP:  # Group writable
                    issues.append(SecurityIssue(
                        severity="medium",
                        category="weak_permissions",
                        file_path=file_path,
                        line_number=0,
                        description="File is group-writable",
                        recommendation="Consider removing group-write permissions if not needed"
                    ))
            
            # Scan file content for security issues
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                
                for line_num, line in enumerate(lines, 1):
                    # Check for hardcoded secrets
                    for pattern, secret_type in self.secret_patterns:
                        if re.search(pattern, line):
                            issues.append(SecurityIssue(
                                severity="critical",
                                category="hardcoded_secret",
                                file_path=file_path,
                                line_number=line_num,
                                description=f"Potential {secret_type} found",
                                recommendation=f"Move {secret_type} to environment variables or secure config",
                                context=line.strip()
                            ))
                    
                    # Check for dangerous function calls
                    for func in self.dangerous_functions:
                        if func in line and not line.strip().startswith('#'):
                            issues.append(SecurityIssue(
                                severity="high",
                                category="dangerous_function",
                                file_path=file_path,
                                line_number=line_num,
                                description=f"Dangerous function '{func}' detected",
                                recommendation=f"Review usage of '{func}' and consider safer alternatives",
                                context=line.strip()
                            ))
                    
                    # Check for potential path traversal
                    if '../' in line or '..\\' in line:
                        issues.append(SecurityIssue(
                            severity="medium",
                            category="path_traversal",
                            file_path=file_path,
                            line_number=line_num,
                            description="Potential path traversal pattern",
                            recommendation="Validate and sanitize file paths",
                            context=line.strip()
                        ))
                
            except Exception as e:
                issues.append(SecurityIssue(
                    severity="medium",
                    category="file_read_error",
                    file_path=file_path,
                    line_number=0,
                    description=f"Could not read file content: {str(e)}",
                    recommendation="Check file permissions and encoding"
                ))
            
            # Calculate security score
            critical_issues = len([i for i in issues if i.severity == "critical"])
            high_issues = len([i for i in issues if i.severity == "high"])
            medium_issues = len([i for i in issues if i.severity == "medium"])
            low_issues = len([i for i in issues if i.severity == "low"])
            
            security_score = max(0, 100 - (critical_issues * 25 + high_issues * 15 + medium_issues * 10 + low_issues * 5))
            
            # Generate recommendations
            if critical_issues > 0:
                recommendations.append("CRITICAL: Address all critical security issues immediately")
            if high_issues > 0:
                recommendations.append("HIGH: Review and fix high-severity security issues")
            if medium_issues > 0:
                recommendations.append("MEDIUM: Consider addressing medium-severity issues")
            if security_score < 50:
                recommendations.append("Overall security score is low - comprehensive review recommended")
            
            return SecurityAuditResult(
                file_path=file_path,
                security_score=security_score,
                issues=issues,
                recommendations=recommendations
            )
            
        except Exception as e:
            return SecurityAuditResult(
                file_path=file_path,
                security_score=0,
                issues=[SecurityIssue(
                    severity="high",
                    category="audit_error",
                    file_path=file_path,
                    line_number=0,
                    description=f"Security audit failed: {str(e)}",
                    recommendation="Check file accessibility and permissions"
                )],
                recommendations=["Fix audit errors and re-run security scan"]
            )
    
    def log_audit_event(self, action: str, tool_name: str, file_path: Optional[str] = None, 
                       success: bool = True, error_message: Optional[str] = None,
                       additional_data: Optional[Dict[str, Any]] = None):
        """Log security audit events"""
        with self._lock:
            entry = AuditLogEntry(
                timestamp=datetime.now(),
                action=action,
                tool_name=tool_name,
                file_path=file_path,
                user_context=os.getenv("USER", "unknown"),
                success=success,
                error_message=error_message,
                additional_data=additional_data
            )
            self.audit_log.append(entry)
            
            # Keep only last 1000 entries to prevent memory issues
            if len(self.audit_log) > 1000:
                self.audit_log = self.audit_log[-1000:]
            
            # Also log to file if audit logging is enabled
            if self.config_manager.config and self.config_manager.config.audit_logging:
                self._write_audit_log_entry(entry)
    
    def _write_audit_log_entry(self, entry: AuditLogEntry):
        """Write audit log entry to file"""
        try:
            audit_log_path = Path(self.config_manager.config_path).parent / "security_audit.log"
            with open(audit_log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps({
                    "timestamp": entry.timestamp.isoformat(),
                    "action": entry.action,
                    "tool_name": entry.tool_name,
                    "file_path": entry.file_path,
                    "user_context": entry.user_context,
                    "success": entry.success,
                    "error_message": entry.error_message,
                    "additional_data": entry.additional_data
                }) + '\n')
        except Exception as e:
            logger.error(f"Failed to write audit log entry: {e}")
    
    def get_audit_summary(self) -> Dict[str, Any]:
        """Get summary of audit logs"""
        with self._lock:
            if not self.audit_log:
                return {"total_events": 0}
            
            total_events = len(self.audit_log)
            failed_events = len([e for e in self.audit_log if not e.success])
            recent_events = len([e for e in self.audit_log if e.timestamp > datetime.now() - timedelta(hours=1)])
            
            tool_usage = defaultdict(int)
            for entry in self.audit_log:
                tool_usage[entry.tool_name] += 1
            
            return {
                "total_events": total_events,
                "failed_events": failed_events,
                "recent_events_1h": recent_events,
                "success_rate": (total_events - failed_events) / total_events * 100 if total_events > 0 else 0,
                "tool_usage": dict(tool_usage),
                "last_event": self.audit_log[-1].timestamp.isoformat() if self.audit_log else None
            }
    
    def _init_privilege_management(self):
        """Initialize privilege management and security settings"""
        try:
            # Store original umask for restoration
            self._original_umask = os.umask(0o077)  # Restrict file permissions
            os.umask(self._original_umask)  # Restore original umask
            
            # Set read-only mode based on configuration
            if self.config_manager.config and self.config_manager.config.security_mode == "strict":
                self.read_only_mode = True
                logger.info("Read-only mode enabled due to strict security mode")
            
            # Drop privileges if running as root (Unix-like systems)
            if platform.system() != "Windows" and os.geteuid() == 0:
                logger.warning("Running as root - consider running with minimal privileges")
                self.minimal_privileges = False
            
        except Exception as e:
            logger.error(f"Failed to initialize privilege management: {e}")
    
    def set_read_only_mode(self, enabled: bool) -> bool:
        """Enable or disable read-only mode"""
        try:
            with self._lock:
                self.read_only_mode = enabled
                self.log_audit_event(
                    "set_read_only_mode", "privilege_management", None,
                    success=True, additional_data={"read_only_mode": enabled}
                )
                logger.info(f"Read-only mode {'enabled' if enabled else 'disabled'}")
                return True
        except Exception as e:
            logger.error(f"Failed to set read-only mode: {e}")
            return False
    
    def check_write_permission(self, operation: str, file_path: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """Check if write operations are allowed"""
        if self.read_only_mode:
            return False, f"Write operation '{operation}' not allowed in read-only mode"
        
        if self.minimal_privileges and operation in ['delete', 'modify', 'create']:
            return False, f"Operation '{operation}' requires elevated privileges"
        
        return True, None
    
    def drop_privileges(self) -> bool:
        """Drop elevated privileges if possible"""
        try:
            if platform.system() == "Windows":
                # Windows privilege dropping is complex and requires specific APIs
                logger.info("Privilege dropping not implemented for Windows")
                return False
            
            # For Unix-like systems, we can't actually drop privileges from within Python
            # This is more of a documentation/configuration check
            if os.geteuid() == 0:
                logger.warning("Cannot drop root privileges from within Python process")
                logger.warning("Consider running the MCP server as a non-root user")
                return False
            
            self.minimal_privileges = True
            self.log_audit_event(
                "drop_privileges", "privilege_management", None,
                success=True
            )
            logger.info("Running with minimal privileges")
            return True
            
        except Exception as e:
            logger.error(f"Failed to drop privileges: {e}")
            return False
    
    def get_privilege_status(self) -> Dict[str, Any]:
        """Get current privilege and security status"""
        try:
            status = {
                "read_only_mode": self.read_only_mode,
                "minimal_privileges": self.minimal_privileges,
                "platform": platform.system(),
                "user_id": os.getuid() if hasattr(os, 'getuid') else None,
                "effective_user_id": os.geteuid() if hasattr(os, 'geteuid') else None,
                "is_root": os.geteuid() == 0 if hasattr(os, 'geteuid') else False,
                "umask": oct(self._original_umask) if self._original_umask else None
            }
            
            # Add security recommendations
            recommendations = []
            if status["is_root"]:
                recommendations.append("Consider running as non-root user for better security")
            if not self.read_only_mode and self.config_manager.config.security_mode == "strict":
                recommendations.append("Consider enabling read-only mode for strict security")
            if not self.minimal_privileges:
                recommendations.append("Consider running with minimal privileges")
            
            status["recommendations"] = recommendations
            return status
            
        except Exception as e:
            logger.error(f"Failed to get privilege status: {e}")
            return {"error": str(e)}

class PerformanceMonitor:
    """Comprehensive performance monitoring and error handling"""
    
    def __init__(self, slow_operation_threshold: float = 5.0):
        self.slow_operation_threshold = slow_operation_threshold
        self.metrics: List[PerformanceMetrics] = []
        self.error_counts: Dict[ErrorCategory, int] = defaultdict(int)
        self.operation_counts: Dict[str, int] = defaultdict(int)
        self.operation_times: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.RLock()
        self._start_time = time.time()
        
        # Resource limits
        self.max_files_per_operation = 1000
        self.max_search_results = 500
        self.max_file_size_mb = 100
        self.operation_timeout = 300  # 5 minutes
        
        # Caches
        self.file_cache = LRUCache(max_size=500, ttl=300)  # 5 minutes
        self.symbol_cache = LRUCache(max_size=1000, ttl=600)  # 10 minutes
        self.git_cache = LRUCache(max_size=100, ttl=300)  # 5 minutes
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024
        except Exception:
            return 0.0
    
    def record_operation(self, operation_name: str, execution_time: float, 
                        success: bool, error_category: Optional[ErrorCategory] = None,
                        context: Optional[Dict[str, Any]] = None) -> None:
        """Record performance metrics for an operation"""
        with self._lock:
            memory_usage = self.get_memory_usage()
            metrics = PerformanceMetrics(
                operation_name=operation_name,
                execution_time=execution_time,
                memory_usage_mb=memory_usage,
                success=success,
                error_category=error_category,
                context=context
            )
            
            self.metrics.append(metrics)
            self.operation_counts[operation_name] += 1
            self.operation_times[operation_name].append(execution_time)
            
            if not success and error_category:
                self.error_counts[error_category] += 1
            
            # Log slow operations
            if execution_time > self.slow_operation_threshold:
                logger.warning(f"Slow operation detected: {operation_name} took {execution_time:.2f}s")
                if context:
                    logger.warning(f"Context: {context}")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive performance statistics"""
        with self._lock:
            uptime = time.time() - self._start_time
            total_operations = sum(self.operation_counts.values())
            successful_operations = sum(1 for m in self.metrics if m.success)
            failed_operations = total_operations - successful_operations
            
            # Calculate averages
            avg_times = {}
            for op_name, times in self.operation_times.items():
                if times:
                    avg_times[op_name] = sum(times) / len(times)
            
            # Get slowest operations
            slow_operations = [
                {
                    "operation": m.operation_name,
                    "time": m.execution_time,
                    "timestamp": m.timestamp,
                    "context": m.context
                }
                for m in self.metrics 
                if m.execution_time > self.slow_operation_threshold
            ]
            slow_operations.sort(key=lambda x: x["time"], reverse=True)
            
            return {
                "uptime_seconds": uptime,
                "total_operations": total_operations,
                "successful_operations": successful_operations,
                "failed_operations": failed_operations,
                "success_rate": successful_operations / total_operations if total_operations > 0 else 0,
                "average_execution_times": avg_times,
                "operation_counts": dict(self.operation_counts),
                "error_counts": {cat.value: count for cat, count in self.error_counts.items()},
                "slow_operations": slow_operations[:10],  # Top 10 slowest
                "current_memory_mb": self.get_memory_usage(),
                "cache_stats": {
                    "file_cache": self.file_cache.get_stats(),
                    "symbol_cache": self.symbol_cache.get_stats(),
                    "git_cache": self.git_cache.get_stats()
                }
            }
    
    def validate_input(self, input_type: str, value: Any, **kwargs) -> None:
        """Validate input parameters and raise appropriate errors"""
        if input_type == "directory_path":
            if not isinstance(value, str):
                raise ValueError("Directory path must be a string")
            if not os.path.exists(value):
                raise FileNotFoundError(f"Directory does not exist: {value}")
            if not os.path.isdir(value):
                raise ValueError(f"Path is not a directory: {value}")
            if not os.access(value, os.R_OK):
                raise PermissionError(f"No read access to directory: {value}")
        
        elif input_type == "file_path":
            if not isinstance(value, str):
                raise ValueError("File path must be a string")
            if not os.path.exists(value):
                raise FileNotFoundError(f"File does not exist: {value}")
            if not os.path.isfile(value):
                raise ValueError(f"Path is not a file: {value}")
            if not os.access(value, os.R_OK):
                raise PermissionError(f"No read access to file: {value}")
            
            # Check file size
            file_size_mb = os.path.getsize(value) / 1024 / 1024
            if file_size_mb > self.max_file_size_mb:
                raise ValueError(f"File too large: {file_size_mb:.1f}MB > {self.max_file_size_mb}MB")
        
        elif input_type == "regex_pattern":
            if not isinstance(value, str):
                raise ValueError("Regex pattern must be a string")
            try:
                re.compile(value)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern: {e}")
        
        elif input_type == "file_count":
            if not isinstance(value, int) or value < 0:
                raise ValueError("File count must be a non-negative integer")
            if value > self.max_files_per_operation:
                raise ValueError(f"Too many files: {value} > {self.max_files_per_operation}")
        
        elif input_type == "search_limit":
            if not isinstance(value, int) or value < 0:
                raise ValueError("Search limit must be a non-negative integer")
            if value > self.max_search_results:
                raise ValueError(f"Search limit too high: {value} > {self.max_search_results}")

# Global performance monitor instance
performance_monitor = PerformanceMonitor()

def performance_timer(operation_name: str):
    """Decorator for timing operations and recording metrics"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            start_memory = performance_monitor.get_memory_usage()
            success = True
            error_category = None
            context = {}
            
            try:
                # Add context information
                if args:
                    context["args_count"] = len(args)
                    if len(args) > 0 and isinstance(args[0], str):
                        context["first_arg"] = args[0][:100]  # Truncate long paths
                
                result = func(*args, **kwargs)
                return result
                
            except FileNotFoundError as e:
                success = False
                error_category = ErrorCategory.NOT_FOUND
                logger.error(f"File not found in {operation_name}: {e}")
                raise
                
            except PermissionError as e:
                success = False
                error_category = ErrorCategory.PERMISSION
                logger.error(f"Permission error in {operation_name}: {e}")
                raise
                
            except ValueError as e:
                success = False
                error_category = ErrorCategory.INVALID_INPUT
                logger.error(f"Invalid input in {operation_name}: {e}")
                raise
                
            except TimeoutError as e:
                success = False
                error_category = ErrorCategory.TIMEOUT
                logger.error(f"Timeout in {operation_name}: {e}")
                raise
                
            except Exception as e:
                success = False
                error_category = ErrorCategory.SYSTEM_ERROR
                logger.error(f"System error in {operation_name}: {e}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
                
            finally:
                execution_time = time.time() - start_time
                performance_monitor.record_operation(
                    operation_name, execution_time, success, error_category, context
                )
        
        return wrapper
    return decorator

class CodeIndexer:
    """Indexes code symbols and references for fast searching"""
    
    def __init__(self):
        self.symbols: Dict[str, List[Symbol]] = defaultdict(list)
        self.references: Dict[str, List[Reference]] = defaultdict(list)
        self.indexed_files: Set[str] = set()
        self._index_lock = threading.Lock()
        
    def index_python_file(self, file_path: str) -> None:
        """Index symbols and references in a Python file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            tree = ast.parse(content, filename=file_path)
            lines = content.split('\n')
            
            with self._index_lock:
                # Clear existing symbols for this file
                for symbol_list in self.symbols.values():
                    symbol_list[:] = [s for s in symbol_list if s.file_path != file_path]
                
                # Index new symbols
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        docstring = ast.get_docstring(node)
                        symbol = Symbol(
                            name=node.name,
                            type='function',
                            file_path=file_path,
                            line_number=node.lineno,
                            definition=lines[node.lineno - 1].strip() if node.lineno <= len(lines) else '',
                            docstring=docstring
                        )
                        self.symbols[node.name].append(symbol)
                        
                    elif isinstance(node, ast.ClassDef):
                        docstring = ast.get_docstring(node)
                        symbol = Symbol(
                            name=node.name,
                            type='class',
                            file_path=file_path,
                            line_number=node.lineno,
                            definition=lines[node.lineno - 1].strip() if node.lineno <= len(lines) else '',
                            docstring=docstring
                        )
                        self.symbols[node.name].append(symbol)
                        
                    elif isinstance(node, (ast.Import, ast.ImportFrom)):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                symbol = Symbol(
                                    name=alias.name,
                                    type='import',
                                    file_path=file_path,
                                    line_number=node.lineno,
                                    definition=lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ''
                                )
                                self.symbols[alias.name].append(symbol)
                        else:  # ImportFrom
                            for alias in node.names:
                                symbol = Symbol(
                                    name=alias.name,
                                    type='import',
                                    file_path=file_path,
                                    line_number=node.lineno,
                                    definition=lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ''
                                )
                                self.symbols[alias.name].append(symbol)
                
                self.indexed_files.add(file_path)
                
        except Exception as e:
            logger.warning(f"Failed to index Python file {file_path}: {e}")
    
    def index_javascript_file(self, file_path: str) -> None:
        """Index symbols in a JavaScript file using regex patterns"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            lines = content.split('\n')
            
            with self._index_lock:
                # Clear existing symbols for this file
                for symbol_list in self.symbols.values():
                    symbol_list[:] = [s for s in symbol_list if s.file_path != file_path]
                
                # Function declarations (including async)
                function_pattern = r'^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\('
                for i, line in enumerate(lines):
                    match = re.search(function_pattern, line)
                    if match:
                        func_name = match.group(1)
                        symbol = Symbol(
                            name=func_name,
                            type='function',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[func_name].append(symbol)
                
                # Arrow functions
                arrow_function_pattern = r'^\s*(?:export\s+)?const\s+(\w+)\s*=.*=>'
                for i, line in enumerate(lines):
                    match = re.search(arrow_function_pattern, line)
                    if match:
                        func_name = match.group(1)
                        symbol = Symbol(
                            name=func_name,
                            type='function',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[func_name].append(symbol)
                
                # Class declarations
                class_pattern = r'^\s*(?:export\s+)?class\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(class_pattern, line)
                    if match:
                        class_name = match.group(1)
                        symbol = Symbol(
                            name=class_name,
                            type='class',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[class_name].append(symbol)
                
                # Class methods (better detection)
                method_pattern = r'^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{'
                for i, line in enumerate(lines):
                    # Skip if it's a function declaration or arrow function
                    if re.search(r'^\s*(?:export\s+)?(?:async\s+)?function\s+', line) or \
                       re.search(r'^\s*(?:export\s+)?const\s+\w+\s*=.*=>', line):
                        continue
                    
                    match = re.search(method_pattern, line)
                    if match:
                        method_name = match.group(1)
                        # Check if this looks like a method (inside a class or object)
                        context_lines = lines[max(0, i-5):i+1]
                        context = '\n'.join(context_lines)
                        if 'class ' in context or '{' in context:
                            symbol = Symbol(
                                name=method_name,
                                type='method',
                                file_path=file_path,
                                line_number=i + 1,
                                definition=line.strip()
                            )
                            self.symbols[method_name].append(symbol)
                
                # Variable/const declarations
                var_pattern = r'^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(var_pattern, line)
                    if match:
                        var_name = match.group(1)
                        symbol = Symbol(
                            name=var_name,
                            type='variable',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[var_name].append(symbol)
                
                # ES6 imports
                import_pattern = r'^\s*import.*from\s+["\']([^"\']+)["\']'
                for i, line in enumerate(lines):
                    match = re.search(import_pattern, line)
                    if match:
                        # Extract imported names from the import statement
                        import_names = re.findall(r'import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)', line)
                        for import_name in import_names:
                            # Clean up the import name
                            clean_name = re.sub(r'[{}*]', '', import_name).strip()
                            if clean_name and clean_name != 'as':
                                symbol = Symbol(
                                    name=clean_name,
                                    type='import',
                                    file_path=file_path,
                                    line_number=i + 1,
                                    definition=line.strip()
                                )
                                self.symbols[clean_name].append(symbol)
                
                self.indexed_files.add(file_path)
                
        except Exception as e:
            logger.warning(f"Failed to index JavaScript file {file_path}: {e}")
    
    def index_typescript_file(self, file_path: str) -> None:
        """Index symbols in a TypeScript file using regex patterns"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            lines = content.split('\n')
            
            with self._index_lock:
                # Clear existing symbols for this file
                for symbol_list in self.symbols.values():
                    symbol_list[:] = [s for s in symbol_list if s.file_path != file_path]
                
                # Interface declarations
                interface_pattern = r'^\s*(?:export\s+)?interface\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(interface_pattern, line)
                    if match:
                        interface_name = match.group(1)
                        symbol = Symbol(
                            name=interface_name,
                            type='interface',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[interface_name].append(symbol)
                
                # Type declarations
                type_pattern = r'^\s*(?:export\s+)?type\s+(\w+)\s*='
                for i, line in enumerate(lines):
                    match = re.search(type_pattern, line)
                    if match:
                        type_name = match.group(1)
                        symbol = Symbol(
                            name=type_name,
                            type='type',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[type_name].append(symbol)
                
                # Enum declarations
                enum_pattern = r'^\s*(?:export\s+)?enum\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(enum_pattern, line)
                    if match:
                        enum_name = match.group(1)
                        symbol = Symbol(
                            name=enum_name,
                            type='enum',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[enum_name].append(symbol)
                
                # Class declarations
                class_pattern = r'^\s*(?:export\s+)?class\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(class_pattern, line)
                    if match:
                        class_name = match.group(1)
                        symbol = Symbol(
                            name=class_name,
                            type='class',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[class_name].append(symbol)
                
                # Function declarations (including async)
                function_pattern = r'^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\('
                for i, line in enumerate(lines):
                    match = re.search(function_pattern, line)
                    if match:
                        func_name = match.group(1)
                        symbol = Symbol(
                            name=func_name,
                            type='function',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[func_name].append(symbol)
                
                # Arrow functions
                arrow_function_pattern = r'^\s*(?:export\s+)?const\s+(\w+)\s*=.*=>'
                for i, line in enumerate(lines):
                    match = re.search(arrow_function_pattern, line)
                    if match:
                        func_name = match.group(1)
                        symbol = Symbol(
                            name=func_name,
                            type='function',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[func_name].append(symbol)
                
                # Const/let declarations
                const_pattern = r'^\s*(?:export\s+)?(?:const|let)\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(const_pattern, line)
                    if match:
                        var_name = match.group(1)
                        symbol = Symbol(
                            name=var_name,
                            type='variable',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[var_name].append(symbol)
                
                # Generic type parameters (for interfaces, types, classes, functions)
                generic_patterns = [
                    r'^\s*(?:export\s+)?interface\s+(\w+)\s*<[^>]+>',
                    r'^\s*(?:export\s+)?type\s+(\w+)\s*<[^>]+>\s*=',
                    r'^\s*(?:export\s+)?class\s+(\w+)\s*<[^>]+>',
                    r'^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*<[^>]+>\s*\('
                ]
                
                for pattern in generic_patterns:
                    for i, line in enumerate(lines):
                        match = re.search(pattern, line)
                        if match:
                            symbol_name = match.group(1)
                            # Check if we already have this symbol (avoid duplicates)
                            existing = any(s.name == symbol_name and s.file_path == file_path 
                                         for s in self.symbols.get(symbol_name, []))
                            if not existing:
                                symbol_type = 'interface' if 'interface' in pattern else \
                                            'type' if 'type' in pattern else \
                                            'class' if 'class' in pattern else 'function'
                                symbol = Symbol(
                                    name=symbol_name,
                                    type=symbol_type,
                                    file_path=file_path,
                                    line_number=i + 1,
                                    definition=line.strip()
                                )
                                self.symbols[symbol_name].append(symbol)
                
                # ES6 imports
                import_pattern = r'^\s*import.*from\s+["\']([^"\']+)["\']'
                for i, line in enumerate(lines):
                    match = re.search(import_pattern, line)
                    if match:
                        # Extract imported names from the import statement
                        import_names = re.findall(r'import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)', line)
                        for import_name in import_names:
                            # Clean up the import name
                            clean_name = re.sub(r'[{}*]', '', import_name).strip()
                            if clean_name and clean_name != 'as':
                                symbol = Symbol(
                                    name=clean_name,
                                    type='import',
                                    file_path=file_path,
                                    line_number=i + 1,
                                    definition=line.strip()
                                )
                                self.symbols[clean_name].append(symbol)
                
                self.indexed_files.add(file_path)
                
        except Exception as e:
            logger.warning(f"Failed to index TypeScript file {file_path}: {e}")
    
    def index_go_file(self, file_path: str) -> None:
        """Index symbols in a Go file using regex patterns"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            lines = content.split('\n')
            
            with self._index_lock:
                # Clear existing symbols for this file
                for symbol_list in self.symbols.values():
                    symbol_list[:] = [s for s in symbol_list if s.file_path != file_path]
                
                # Package declaration
                package_pattern = r'^package\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(package_pattern, line)
                    if match:
                        package_name = match.group(1)
                        symbol = Symbol(
                            name=package_name,
                            type='package',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[package_name].append(symbol)
                
                # Function declarations (including receiver functions)
                func_pattern = r'^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\('
                for i, line in enumerate(lines):
                    match = re.search(func_pattern, line)
                    if match:
                        func_name = match.group(1)
                        symbol = Symbol(
                            name=func_name,
                            type='function',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[func_name].append(symbol)
                
                # Type declarations
                type_pattern = r'^\s*type\s+(\w+)\s+(?:struct|interface|\w+)'
                for i, line in enumerate(lines):
                    match = re.search(type_pattern, line)
                    if match:
                        type_name = match.group(1)
                        symbol = Symbol(
                            name=type_name,
                            type='type',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[type_name].append(symbol)
                
                # Struct declarations
                struct_pattern = r'^\s*type\s+(\w+)\s+struct'
                for i, line in enumerate(lines):
                    match = re.search(struct_pattern, line)
                    if match:
                        struct_name = match.group(1)
                        symbol = Symbol(
                            name=struct_name,
                            type='struct',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[struct_name].append(symbol)
                
                # Interface declarations
                interface_pattern = r'^\s*type\s+(\w+)\s+interface'
                for i, line in enumerate(lines):
                    match = re.search(interface_pattern, line)
                    if match:
                        interface_name = match.group(1)
                        symbol = Symbol(
                            name=interface_name,
                            type='interface',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[interface_name].append(symbol)
                
                # Const declarations
                const_pattern = r'^\s*const\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(const_pattern, line)
                    if match:
                        const_name = match.group(1)
                        symbol = Symbol(
                            name=const_name,
                            type='const',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[const_name].append(symbol)
                
                # Var declarations
                var_pattern = r'^\s*var\s+(\w+)'
                for i, line in enumerate(lines):
                    match = re.search(var_pattern, line)
                    if match:
                        var_name = match.group(1)
                        symbol = Symbol(
                            name=var_name,
                            type='variable',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[var_name].append(symbol)
                
                # Method declarations (receiver functions)
                method_pattern = r'^\s*func\s+\([^)]+\)\s+(\w+)\s*\('
                for i, line in enumerate(lines):
                    match = re.search(method_pattern, line)
                    if match:
                        method_name = match.group(1)
                        symbol = Symbol(
                            name=method_name,
                            type='method',
                            file_path=file_path,
                            line_number=i + 1,
                            definition=line.strip()
                        )
                        self.symbols[method_name].append(symbol)
                
                # Import statements
                import_pattern = r'^\s*import\s+(?:"([^"]+)"|`([^`]+)`|\w+\s+"([^"]+)")'
                for i, line in enumerate(lines):
                    match = re.search(import_pattern, line)
                    if match:
                        # Extract the import path
                        import_path = match.group(1) or match.group(2) or match.group(3)
                        if import_path:
                            # Extract package name from import path
                            package_name = import_path.split('/')[-1]
                            symbol = Symbol(
                                name=package_name,
                                type='import',
                                file_path=file_path,
                                line_number=i + 1,
                                definition=line.strip()
                            )
                            self.symbols[package_name].append(symbol)
                
                self.indexed_files.add(file_path)
                
        except Exception as e:
            logger.warning(f"Failed to index Go file {file_path}: {e}")
    
    def search_symbols(self, query: str, symbol_type: Optional[str] = None, fuzzy: bool = False, file_extensions: Optional[List[str]] = None) -> List[Symbol]:
        """Search for symbols by name or pattern with enhanced matching options"""
        with self._index_lock:
            results = []
            query_lower = query.lower()
            
            for name, symbol_list in self.symbols.items():
                name_lower = name.lower()
                match_found = False
                match_type = None
                
                # Exact match (highest priority)
                if query_lower == name_lower:
                    match_found = True
                    match_type = 'exact'
                # Starts with query (high priority)
                elif name_lower.startswith(query_lower):
                    match_found = True
                    match_type = 'prefix'
                # Contains query (medium priority)
                elif query_lower in name_lower:
                    match_found = True
                    match_type = 'contains'
                # Fuzzy matching (lowest priority)
                elif fuzzy and self._fuzzy_match(query_lower, name_lower):
                    match_found = True
                    match_type = 'fuzzy'
                
                if match_found:
                    for symbol in symbol_list:
                        # Filter by symbol type if specified
                        if symbol_type is not None and symbol.type != symbol_type:
                            continue
                        
                        # Filter by file extension if specified
                        if file_extensions is not None:
                            file_ext = Path(symbol.file_path).suffix.lower()
                            if file_ext not in file_extensions:
                                continue
                        
                        # Add match type for sorting
                        symbol_with_match = symbol
                        symbol_with_match.match_type = match_type
                        results.append(symbol_with_match)
            
            # Sort by relevance: exact matches first, then prefix, contains, fuzzy
            # Within each group, sort by file path and line number
            match_priority = {'exact': 0, 'prefix': 1, 'contains': 2, 'fuzzy': 3}
            return sorted(results, key=lambda s: (
                match_priority.get(getattr(s, 'match_type', 'contains'), 2),
                s.file_path,
                s.line_number
            ))
    
    def _fuzzy_match(self, query: str, text: str) -> bool:
        """Simple fuzzy matching - checks if query characters appear in order in text"""
        if not query:
            return True
        
        query_idx = 0
        for char in text:
            if query_idx < len(query) and char == query[query_idx]:
                query_idx += 1
        
        return query_idx == len(query)
    
    def find_references(self, symbol_name: str, directory: str, file_extensions: Optional[List[str]] = None, context_lines: int = 2) -> List[Reference]:
        """Find references to a symbol across files with enhanced context and filtering"""
        references = []
        
        # Default file extensions if none specified
        if file_extensions is None:
            file_extensions = ['.py', '.js', '.ts', '.go']
        
        try:
            # Search through all specified file types
            for ext in file_extensions:
                pattern = f'*{ext}'
                for file_path in Path(directory).rglob(pattern):
                    if not file_path.is_file():
                        continue
                        
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            lines = f.readlines()
                        
                        for i, line in enumerate(lines):
                            if symbol_name in line:
                                # Enhanced heuristics for reference type detection
                                ref_type = self._determine_reference_type(line, symbol_name, ext)
                                
                                # Extract context (lines before and after)
                                start_line = max(0, i - context_lines)
                                end_line = min(len(lines), i + context_lines + 1)
                                context_lines_list = [line.strip() for line in lines[start_line:end_line]]
                                
                                # Find position within the line
                                position = line.find(symbol_name)
                                
                                references.append(Reference(
                                    symbol_name=symbol_name,
                                    file_path=str(file_path),
                                    line_number=i + 1,
                                    context='\n'.join(context_lines_list),
                                    ref_type=ref_type
                                ))
                                
                    except Exception as e:
                        logger.warning(f"Failed to scan file {file_path} for references: {e}")
                        
        except Exception as e:
            logger.warning(f"Failed to find references for {symbol_name}: {e}")
        
        return references
    
    def _determine_reference_type(self, line: str, symbol_name: str, file_ext: str) -> str:
        """Determine the type of reference based on context and file extension"""
        line_lower = line.lower()
        
        # Function call detection
        if f'{symbol_name}(' in line:
            return 'call'
        
        # Import detection
        if file_ext == '.py':
            if 'import' in line_lower and symbol_name in line:
                return 'import'
            elif 'from' in line_lower and symbol_name in line:
                return 'import'
        elif file_ext in ['.js', '.ts']:
            if 'import' in line_lower and symbol_name in line:
                return 'import'
            elif 'require(' in line_lower and symbol_name in line:
                return 'import'
        elif file_ext == '.go':
            if 'import' in line_lower and symbol_name in line:
                return 'import'
        
        # Assignment detection
        if '=' in line and symbol_name in line:
            return 'assignment'
        
        # Type annotation detection
        if file_ext in ['.ts', '.py']:
            if ':' in line and symbol_name in line:
                return 'type_annotation'
        
        # Method call detection (for object methods)
        if '.' in line and symbol_name in line:
            return 'method_call'
        
        # Default to reference
        return 'reference'


@dataclass
class FileChange:
    """Represents a file change event"""
    file_path: str
    change_type: str  # 'modified', 'added', 'deleted'
    timestamp: float
    file_size: Optional[int] = None
    file_hash: Optional[str] = None


class FileWatcher:
    """Real-time file monitoring with debouncing and auto-indexing"""
    
    def __init__(self, config_manager, code_indexer, debounce_delay: float = 0.5):
        self.config_manager = config_manager
        self.code_indexer = code_indexer
        self.debounce_delay = debounce_delay
        
        # File monitoring
        self.observer = None
        self.event_handler = None
        self.is_watching = False
        
        # Change tracking
        self.pending_changes: Dict[str, FileChange] = {}
        self.recent_changes: List[FileChange] = []
        self.change_lock = threading.Lock()
        
        # Debouncing
        self.debounce_timers: Dict[str, threading.Timer] = {}
        self.debounce_lock = threading.Lock()
        
        # Statistics
        self.stats = {
            'files_indexed': 0,
            'symbols_found': 0,
            'last_update': None,
            'indexing_errors': 0,
            'supported_file_types': {'.py': 0, '.js': 0, '.ts': 0, '.go': 0},
            'memory_usage': 0
        }
        
        # File hashing for smart re-indexing
        self.file_hashes: Dict[str, str] = {}
        self.hash_lock = threading.Lock()
        
        # Progress callbacks
        self.progress_callbacks: List[callable] = []
        
        # Supported file extensions
        self.supported_extensions = {'.py', '.js', '.ts', '.go'}
        
    def start_watching(self):
        """Start file monitoring"""
        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler
            
            if self.is_watching:
                logger.warning("File watcher is already running")
                return False
            
            # Create event handler
            self.event_handler = FileSystemEventHandler()
            self.event_handler.on_modified = self._on_file_modified
            self.event_handler.on_created = self._on_file_created
            self.event_handler.on_deleted = self._on_file_deleted
            
            # Create observer
            self.observer = Observer()
            
            # Add watchers for all configured directories
            watched_dirs = 0
            for dir_config in self.config_manager.config.watched_directories:
                if dir_config.enabled:
                    try:
                        self.observer.schedule(
                            self.event_handler, 
                            dir_config.path, 
                            recursive=True
                        )
                        watched_dirs += 1
                        logger.info(f"Watching directory: {dir_config.path}")
                    except Exception as e:
                        logger.error(f"Failed to watch directory {dir_config.path}: {e}")
            
            if watched_dirs == 0:
                logger.warning("No directories configured for watching")
                return False
            
            # Start observer
            self.observer.start()
            self.is_watching = True
            
            logger.info(f"File watcher started, monitoring {watched_dirs} directories")
            return True
            
        except ImportError:
            logger.error("watchdog library not available. Install with: pip install watchdog")
            return False
        except Exception as e:
            logger.error(f"Failed to start file watcher: {e}")
            return False
    
    def stop_watching(self):
        """Stop file monitoring"""
        if not self.is_watching:
            return
        
        try:
            # Cancel all pending debounce timers
            with self.debounce_lock:
                for timer in self.debounce_timers.values():
                    timer.cancel()
                self.debounce_timers.clear()
            
            # Stop observer
            if self.observer:
                self.observer.stop()
                self.observer.join(timeout=2)
                self.observer = None
            
            self.is_watching = False
            logger.info("File watcher stopped")
            
        except Exception as e:
            logger.error(f"Error stopping file watcher: {e}")
    
    def _on_file_modified(self, event):
        """Handle file modification events"""
        if not event.is_directory and self._is_supported_file(event.src_path):
            self._queue_file_change(event.src_path, 'modified')
    
    def _on_file_created(self, event):
        """Handle file creation events"""
        if not event.is_directory and self._is_supported_file(event.src_path):
            self._queue_file_change(event.src_path, 'added')
    
    def _on_file_deleted(self, event):
        """Handle file deletion events"""
        if not event.is_directory and self._is_supported_file(event.src_path):
            self._queue_file_change(event.src_path, 'deleted')
    
    def _is_supported_file(self, file_path: str) -> bool:
        """Check if file should be monitored"""
        try:
            path = Path(file_path)
            
            # Check file extension
            if path.suffix.lower() not in self.supported_extensions:
                return False
            
            # Check if path is allowed by config
            if not self.config_manager.is_path_allowed(file_path):
                return False
            
            return True
            
        except Exception as e:
            logger.debug(f"Error checking file support for {file_path}: {e}")
            return False
    
    def _queue_file_change(self, file_path: str, change_type: str):
        """Queue a file change for debounced processing"""
        try:
            # Get file info
            file_size = None
            file_hash = None
            
            if change_type != 'deleted' and os.path.exists(file_path):
                try:
                    stat_info = os.stat(file_path)
                    file_size = stat_info.st_size
                    
                    # Calculate hash for smart re-indexing
                    if change_type in ['modified', 'added']:
                        file_hash = self._calculate_file_hash(file_path)
                except Exception as e:
                    logger.debug(f"Error getting file info for {file_path}: {e}")
            
            # Create change record
            change = FileChange(
                file_path=file_path,
                change_type=change_type,
                timestamp=time.time(),
                file_size=file_size,
                file_hash=file_hash
            )
            
            # Add to recent changes
            with self.change_lock:
                self.recent_changes.append(change)
                # Keep only last 1000 changes
                if len(self.recent_changes) > 1000:
                    self.recent_changes = self.recent_changes[-1000:]
            
            # Cancel existing timer for this file
            with self.debounce_lock:
                if file_path in self.debounce_timers:
                    self.debounce_timers[file_path].cancel()
                
                # Set new timer
                timer = threading.Timer(
                    self.debounce_delay,
                    self._process_file_change,
                    args=(change,)
                )
                self.debounce_timers[file_path] = timer
                timer.start()
            
            logger.debug(f"Queued {change_type} change for {file_path}")
            
        except Exception as e:
            logger.error(f"Error queuing file change for {file_path}: {e}")
    
    def _process_file_change(self, change: FileChange):
        """Process a file change after debounce delay"""
        try:
            # Remove from pending timers
            with self.debounce_lock:
                if change.file_path in self.debounce_timers:
                    del self.debounce_timers[change.file_path]
            
            # Process the change
            if change.change_type == 'deleted':
                self._handle_file_deletion(change)
            elif change.change_type in ['modified', 'added']:
                self._handle_file_modification(change)
            
            logger.info(f"Processed {change.change_type} change for {change.file_path}")
            
        except Exception as e:
            logger.error(f"Error processing file change for {change.file_path}: {e}")
            with self.change_lock:
                self.stats['indexing_errors'] += 1
    
    def _handle_file_deletion(self, change: FileChange):
        """Handle file deletion"""
        try:
            # Remove from indexer
            if change.file_path in self.code_indexer.indexed_files:
                with self.code_indexer._index_lock:
                    # Remove symbols for this file
                    symbols_to_remove = []
                    for symbol_name, symbols in self.code_indexer.symbols.items():
                        symbols_to_remove.extend([
                            s for s in symbols if s.file_path == change.file_path
                        ])
                    
                    for symbol in symbols_to_remove:
                        self.code_indexer.symbols[symbol_name].remove(symbol)
                        if not self.code_indexer.symbols[symbol_name]:
                            del self.code_indexer.symbols[symbol_name]
                    
                    # Remove references for this file
                    refs_to_remove = []
                    for ref_name, refs in self.code_indexer.references.items():
                        refs_to_remove.extend([
                            r for r in refs if r.file_path == change.file_path
                        ])
                    
                    for ref in refs_to_remove:
                        self.code_indexer.references[ref_name].remove(ref)
                        if not self.code_indexer.references[ref_name]:
                            del self.code_indexer.references[ref_name]
                    
                    # Remove from indexed files
                    self.code_indexer.indexed_files.discard(change.file_path)
            
            # Remove from file hashes
            with self.hash_lock:
                self.file_hashes.pop(change.file_path, None)
            
            logger.debug(f"Removed {change.file_path} from index")
            
        except Exception as e:
            logger.error(f"Error handling file deletion for {change.file_path}: {e}")
    
    def _handle_file_modification(self, change: FileChange):
        """Handle file modification or addition"""
        try:
            # Check if file actually changed (smart re-indexing)
            if not self._should_reindex(change):
                logger.debug(f"Skipping re-indexing for {change.file_path} (no content change)")
                return
            
            # Notify progress callbacks
            self._notify_progress(f"Indexing {change.file_path}")
            
            # Index the file
            file_ext = Path(change.file_path).suffix.lower()
            
            if file_ext == '.py':
                self.code_indexer.index_python_file(change.file_path)
            elif file_ext in ['.js', '.ts']:
                self.code_indexer.index_javascript_file(change.file_path)
            elif file_ext == '.go':
                self.code_indexer.index_go_file(change.file_path)
            
            # Update statistics
            with self.change_lock:
                self.stats['files_indexed'] += 1
                self.stats['last_update'] = time.time()
                self.stats['supported_file_types'][file_ext] += 1
                
                # Update memory usage
                self.stats['memory_usage'] = self._calculate_memory_usage()
            
            # Update file hash
            with self.hash_lock:
                if change.file_hash:
                    self.file_hashes[change.file_path] = change.file_hash
            
            logger.debug(f"Re-indexed {change.file_path}")
            
        except Exception as e:
            logger.error(f"Error handling file modification for {change.file_path}: {e}")
            with self.change_lock:
                self.stats['indexing_errors'] += 1
    
    def _should_reindex(self, change: FileChange) -> bool:
        """Check if file should be re-indexed based on content changes"""
        try:
            if not change.file_hash:
                return True  # No hash available, re-index
            
            with self.hash_lock:
                old_hash = self.file_hashes.get(change.file_path)
                if old_hash != change.file_hash:
                    return True  # Content changed
            
            return False  # No content change
            
        except Exception as e:
            logger.debug(f"Error checking re-index need for {change.file_path}: {e}")
            return True  # Default to re-index on error
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate MD5 hash of file content"""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
                return hashlib.md5(content).hexdigest()
        except Exception as e:
            logger.debug(f"Error calculating hash for {file_path}: {e}")
            return ""
    
    def _calculate_memory_usage(self) -> int:
        """Calculate approximate memory usage of indexer"""
        try:
            import sys
            
            # Count symbols and references
            symbol_count = sum(len(symbols) for symbols in self.code_indexer.symbols.values())
            ref_count = sum(len(refs) for refs in self.code_indexer.references.values())
            
            # Rough estimate: 1KB per symbol/reference
            return (symbol_count + ref_count) * 1024
            
        except Exception as e:
            logger.debug(f"Error calculating memory usage: {e}")
            return 0
    
    def _notify_progress(self, message: str):
        """Notify progress callbacks"""
        for callback in self.progress_callbacks:
            try:
                callback(message)
            except Exception as e:
                logger.debug(f"Error in progress callback: {e}")
    
    def add_progress_callback(self, callback: callable):
        """Add a progress callback function"""
        self.progress_callbacks.append(callback)
    
    def get_recent_changes(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent file changes within specified hours"""
        try:
            cutoff_time = time.time() - (hours * 3600)
            
            with self.change_lock:
                recent = [
                    {
                        'file_path': change.file_path,
                        'change_type': change.change_type,
                        'timestamp': change.timestamp,
                        'file_size': change.file_size,
                        'formatted_time': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(change.timestamp))
                    }
                    for change in self.recent_changes
                    if change.timestamp >= cutoff_time
                ]
            
            # Sort by timestamp (newest first)
            recent.sort(key=lambda x: x['timestamp'], reverse=True)
            return recent
            
        except Exception as e:
            logger.error(f"Error getting recent changes: {e}")
            return []
    
    def get_index_statistics(self) -> Dict[str, Any]:
        """Get indexing statistics and performance metrics"""
        try:
            with self.change_lock:
                stats = self.stats.copy()
            
            # Add current symbol counts
            stats['current_symbols'] = sum(len(symbols) for symbols in self.code_indexer.symbols.values())
            stats['current_references'] = sum(len(refs) for refs in self.code_indexer.references.values())
            stats['indexed_files_count'] = len(self.code_indexer.indexed_files)
            
            # Add file type breakdown
            stats['file_type_breakdown'] = {}
            for file_path in self.code_indexer.indexed_files:
                ext = Path(file_path).suffix.lower()
                stats['file_type_breakdown'][ext] = stats['file_type_breakdown'].get(ext, 0) + 1
            
            # Add status
            stats['is_watching'] = self.is_watching
            stats['watched_directories'] = len([
                d for d in self.config_manager.config.watched_directories 
                if d.enabled
            ])
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting index statistics: {e}")
            return {'error': str(e)}


# Global code indexer instance
code_indexer = CodeIndexer()

# Global file watcher instance
file_watcher = None

# Global server instance and configuration manager
mcp = None
config_manager = None
security_manager = None


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
    global mcp, config_manager, security_manager, file_watcher
    
    try:
        logger.info("Starting persistent MCP server...")
        
        # Initialize configuration manager
        config_manager = MCPConfigManager(config_path)
        
        # Initialize security manager
        security_manager = SecurityManager(config_manager)
        
        # Set bypass mode if requested
        if bypass_config:
            logger.warning("BYPASS MODE ENABLED: All configuration checks are disabled for testing")
            config_manager.bypass_mode = True
        
        # Start configuration file watcher
        config_manager.start_config_watcher()
        
        # Initialize file watcher for real-time monitoring
        try:
            file_watcher = FileWatcher(config_manager, code_indexer)
            logger.info("File watcher initialized successfully")
            
            # Start file monitoring if directories are configured
            if config_manager.config.watched_directories:
                if file_watcher.start_watching():
                    logger.info("Real-time file monitoring started")
                else:
                    logger.warning("Failed to start file monitoring - continuing without it")
            else:
                logger.info("No directories configured for file monitoring")
                
        except Exception as e:
            logger.error(f"Failed to initialize file watcher: {e}")
            logger.info("Continuing without real-time file monitoring")
            file_watcher = None
        
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
        # Stop file watcher
        if file_watcher:
            try:
                file_watcher.stop_watching()
                logger.info("File watcher stopped")
            except Exception as e:
                logger.error(f"Error stopping file watcher: {e}")
        
        # Stop config watcher
        if config_manager:
            config_manager.stop_config_watcher()
        
        logger.info("Server shutdown completed")


def register_tools():
    """Register all MCP tools with proper error handling"""
    global mcp
    
    @mcp.tool()
    def list_files(directory: str = ".") -> Dict[str, Any]:
        """List files and directories in the specified path."""
        try:
            global security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("list_files")
            if not rate_ok:
                security_manager.log_audit_event(
                    "list_files", "list_files", directory, 
                    success=False, error_message=rate_msg
                )
                return {
                    "success": False,
                    "error": rate_msg,
                    "files": [],
                    "directory": directory
                }
            
            # Validate path
            path_ok, path_msg = security_manager.validate_path(directory, "read")
            if not path_ok:
                security_manager.log_audit_event(
                    "list_files", "list_files", directory, 
                    success=False, error_message=path_msg
                )
                return {
                    "success": False,
                    "error": path_msg,
                    "files": [],
                    "directory": directory
                }
            
            # Perform the directory listing
            result = _list_files_sync(directory)
            
            # Log successful operation
            security_manager.log_audit_event(
                "list_files", "list_files", directory, 
                success=result.get("success", False),
                additional_data={"file_count": len(result.get("files", []))}
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in list_files: {e}")
            security_manager.log_audit_event(
                "list_files", "list_files", directory, 
                success=False, error_message=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to list files: {str(e)}",
                "files": [],
                "directory": directory
            }
    
    @mcp.tool()
    def read_file(file_path: str, max_lines: Optional[int] = None) -> Dict[str, Any]:
        """Read the contents of a file."""
        try:
            global security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("read_file")
            if not rate_ok:
                security_manager.log_audit_event(
                    "read_file", "read_file", file_path, 
                    success=False, error_message=rate_msg
                )
                return {
                    "success": False,
                    "error": rate_msg,
                    "content": "",
                    "file_path": file_path
                }
            
            # Validate path
            path_ok, path_msg = security_manager.validate_path(file_path, "read")
            if not path_ok:
                security_manager.log_audit_event(
                    "read_file", "read_file", file_path, 
                    success=False, error_message=path_msg
                )
                return {
                    "success": False,
                    "error": path_msg,
                    "content": "",
                    "file_path": file_path
                }
            
            # Perform the file read
            result = _read_file_sync(file_path, max_lines)
            
            # Log successful operation
            security_manager.log_audit_event(
                "read_file", "read_file", file_path, 
                success=result.get("success", False),
                additional_data={"max_lines": max_lines}
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in read_file: {e}")
            security_manager.log_audit_event(
                "read_file", "read_file", file_path, 
                success=False, error_message=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to read file: {str(e)}",
                "content": "",
                "file_path": file_path
            }
    
    @mcp.tool()
    def get_git_status(directory: str = ".") -> Dict[str, Any]:
        """Get the git status of a repository."""
        return _get_git_status_sync(directory)
    
    @mcp.tool()
    def get_git_diff(directory: str = ".", file_path: Optional[str] = None, staged: bool = False, unstaged: bool = True) -> Dict[str, Any]:
        """Get git diff for specific files or entire repository.
        
        Args:
            directory: The directory path to check git diff (defaults to current directory)
            file_path: Specific file to get diff for (optional)
            staged: Include staged changes (default: False)
            unstaged: Include unstaged changes (default: True)
        """
        return _get_git_diff_sync(directory, file_path, staged, unstaged)
    
    @mcp.tool()
    def get_commit_history(directory: str = ".", limit: int = 10, file_path: Optional[str] = None, author: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
        """Get recent commit history with filtering options.
        
        Args:
            directory: The directory path to check commit history (defaults to current directory)
            limit: Maximum number of commits to return (default: 10)
            file_path: Filter commits that modified specific file (optional)
            author: Filter commits by author (optional)
            since: Show commits after this date (optional, format: YYYY-MM-DD)
            until: Show commits before this date (optional, format: YYYY-MM-DD)
        """
        return _get_commit_history_sync(directory, limit, file_path, author, since, until)
    
    @mcp.tool()
    def get_file_blame(directory: str = ".", file_path: str = "", start_line: Optional[int] = None, end_line: Optional[int] = None) -> Dict[str, Any]:
        """Get git blame information for a specific file.
        
        Args:
            directory: The directory path containing the git repository (defaults to current directory)
            file_path: The file to get blame information for
            start_line: Start line number (optional, 1-based)
            end_line: End line number (optional, 1-based)
        """
        return _get_file_blame_sync(directory, file_path, start_line, end_line)
    
    @mcp.tool()
    def get_branch_info(directory: str = ".") -> Dict[str, Any]:
        """Get information about all local and remote branches.
        
        Args:
            directory: The directory path to check branch info (defaults to current directory)
        """
        return _get_branch_info_sync(directory)
    
    @mcp.tool()
    def find_commits_touching_file(directory: str = ".", file_path: str = "", pattern: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """Find commits that modified specific files or match patterns.
        
        Args:
            directory: The directory path to search in (defaults to current directory)
            file_path: Specific file to find commits for (optional)
            pattern: File pattern to match (e.g., "*.py", "src/**") (optional)
            limit: Maximum number of commits to return (default: 20)
        """
        return _find_commits_touching_file_sync(directory, file_path, pattern, limit)
    
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
    
    # Enhanced Feature 1: Code Navigation
    @mcp.tool()
    @performance_timer("search_symbols")
    def search_symbols(query: str, directory: str = ".", symbol_type: Optional[str] = None, auto_index: bool = True, fuzzy: bool = False, file_extensions: Optional[List[str]] = None) -> Dict[str, Any]:
        """Search for code symbols (functions, classes, variables) across the codebase.
        
        Args:
            query: Symbol name or pattern to search for
            directory: Directory to search in (default: current directory)
            symbol_type: Filter by symbol type: 'function', 'class', 'variable', 'import', 'interface', 'type', 'enum', 'struct', 'method', 'const', 'package' (optional)
            auto_index: Whether to automatically index files if not already indexed
            fuzzy: Enable fuzzy matching for partial string matches (default: False)
            file_extensions: List of file extensions to search in: ['.py', '.js', '.ts', '.go'] (optional)
        """
        # Input validation
        performance_monitor.validate_input("directory_path", directory)
        performance_monitor.validate_input("regex_pattern", query)
        
        # Check cache first
        cache_key = f"search_symbols:{query}:{directory}:{symbol_type}:{fuzzy}:{file_extensions}"
        cached_result = performance_monitor.symbol_cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        try:
            path = Path(directory).resolve()
            
            if not path.exists() or not path.is_dir():
                return {
                    "success": False,
                    "error": f"Directory does not exist: {directory}",
                    "symbols": []
                }
            
            # Check path access
            if config_manager and not config_manager.is_path_allowed(str(path)):
                return {
                    "success": False,
                    "error": f"Directory access not allowed: {directory}",
                    "symbols": []
                }
            
            # Auto-index files if requested
            if auto_index:
                indexed_count = 0
                
                # Index Python files
                for file_path in path.rglob('*.py'):
                    if file_path.is_file() and str(file_path) not in code_indexer.indexed_files:
                        if config_manager and not config_manager.is_path_allowed(str(file_path)):
                            continue
                        code_indexer.index_python_file(str(file_path))
                        indexed_count += 1
                
                # Index JavaScript files
                for file_path in path.rglob('*.js'):
                    if file_path.is_file() and str(file_path) not in code_indexer.indexed_files:
                        if config_manager and not config_manager.is_path_allowed(str(file_path)):
                            continue
                        code_indexer.index_javascript_file(str(file_path))
                        indexed_count += 1
                        
                # Index TypeScript files
                for file_path in path.rglob('*.ts'):
                    if file_path.is_file() and str(file_path) not in code_indexer.indexed_files:
                        if config_manager and not config_manager.is_path_allowed(str(file_path)):
                            continue
                        code_indexer.index_typescript_file(str(file_path))
                        indexed_count += 1
                
                # Index Go files
                for file_path in path.rglob('*.go'):
                    if file_path.is_file() and str(file_path) not in code_indexer.indexed_files:
                        if config_manager and not config_manager.is_path_allowed(str(file_path)):
                            continue
                        code_indexer.index_go_file(str(file_path))
                        indexed_count += 1
            
            # Search symbols
            symbols = code_indexer.search_symbols(query, symbol_type, fuzzy, file_extensions)
            
            # Apply resource limits
            if len(symbols) > performance_monitor.max_search_results:
                symbols = symbols[:performance_monitor.max_search_results]
                logger.warning(f"Search results limited to {performance_monitor.max_search_results} symbols")
            
            # Convert to serializable format
            symbol_data = []
            for symbol in symbols:
                symbol_data.append({
                    "name": symbol.name,
                    "type": symbol.type,
                    "file_path": symbol.file_path,
                    "line_number": symbol.line_number,
                    "definition": symbol.definition,
                    "docstring": symbol.docstring
                })
            
            result = {
                "success": True,
                "query": query,
                "symbol_type": symbol_type,
                "directory": str(path),
                "symbols": symbol_data,
                "total_found": len(symbol_data),
                "indexed_files": len(code_indexer.indexed_files)
            }
            
            # Cache the result
            performance_monitor.symbol_cache.put(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error searching symbols: {e}")
            return {
                "success": False,
                "error": f"Symbol search failed: {str(e)}",
                "symbols": []
            }
    
    @mcp.tool()
    @performance_timer("find_references")
    def find_references(symbol_name: str, directory: str = ".", file_extensions: Optional[List[str]] = None, context_lines: int = 2) -> Dict[str, Any]:
        """Find all references to a symbol across the codebase.
        
        Args:
            symbol_name: The symbol name to find references for
            directory: Directory to search in (default: current directory)
            file_extensions: List of file extensions to search in: ['.py', '.js', '.ts', '.go'] (optional)
            context_lines: Number of lines before/after to include in context (default: 2)
        """
        # Input validation
        performance_monitor.validate_input("directory_path", directory)
        performance_monitor.validate_input("search_limit", context_lines)
        
        # Check cache first
        cache_key = f"find_references:{symbol_name}:{directory}:{file_extensions}:{context_lines}"
        cached_result = performance_monitor.symbol_cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        try:
            path = Path(directory).resolve()
            
            if not path.exists() or not path.is_dir():
                return {
                    "success": False,
                    "error": f"Directory does not exist: {directory}",
                    "references": []
                }
            
            # Check path access
            if config_manager and not config_manager.is_path_allowed(str(path)):
                return {
                    "success": False,
                    "error": f"Directory access not allowed: {directory}",
                    "references": []
                }
            
            # Find references
            references = code_indexer.find_references(symbol_name, str(path), file_extensions, context_lines)
            
            # Apply resource limits
            if len(references) > performance_monitor.max_search_results:
                references = references[:performance_monitor.max_search_results]
                logger.warning(f"Reference results limited to {performance_monitor.max_search_results} references")
            
            # Convert to serializable format
            ref_data = []
            for ref in references:
                ref_data.append({
                    "symbol_name": ref.symbol_name,
                    "file_path": ref.file_path,
                    "line_number": ref.line_number,
                    "context": ref.context,
                    "ref_type": ref.ref_type
                })
            
            result = {
                "success": True,
                "symbol_name": symbol_name,
                "directory": str(path),
                "references": ref_data,
                "total_found": len(ref_data)
            }
            
            # Cache the result
            performance_monitor.symbol_cache.put(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error finding references: {e}")
            return {
                "success": False,
                "error": f"Reference search failed: {str(e)}",
                "references": []
            }
    
    # Enhanced Feature 2: Test Running
    @mcp.tool()
    def run_tests(directory: str = ".", test_pattern: Optional[str] = None, framework: Optional[str] = None) -> Dict[str, Any]:
        """Run tests in the specified directory and return results.
        
        Args:
            directory: Directory to run tests in (default: current directory)
            test_pattern: Pattern to match test files (optional)
            framework: Test framework to use: 'pytest', 'jest', 'mocha', 'auto' (default: auto-detect)
        """
        try:
            path = Path(directory).resolve()
            
            if not path.exists() or not path.is_dir():
                return {
                    "success": False,
                    "error": f"Directory does not exist: {directory}",
                    "test_results": []
                }
            
            # Check path access
            if config_manager and not config_manager.is_path_allowed(str(path)):
                return {
                    "success": False,
                    "error": f"Directory access not allowed: {directory}",
                    "test_results": []
                }
            
            # Auto-detect framework if not specified
            if framework is None or framework == 'auto':
                if (path / 'pytest.ini').exists() or (path / 'pyproject.toml').exists():
                    framework = 'pytest'
                elif (path / 'package.json').exists():
                    try:
                        with open(path / 'package.json', 'r') as f:
                            package_data = json.load(f)
                        if 'jest' in package_data.get('devDependencies', {}) or 'jest' in package_data.get('dependencies', {}):
                            framework = 'jest'
                        elif 'mocha' in package_data.get('devDependencies', {}) or 'mocha' in package_data.get('dependencies', {}):
                            framework = 'mocha'
                        else:
                            framework = 'jest'  # Default for Node.js projects
                    except:
                        framework = 'pytest'  # Default fallback
                else:
                    framework = 'pytest'  # Default fallback
            
            # Run tests based on framework
            if framework == 'pytest':
                return _run_pytest(str(path), test_pattern)
            elif framework == 'jest':
                return _run_jest(str(path), test_pattern)
            elif framework == 'mocha':
                return _run_mocha(str(path), test_pattern)
            else:
                return {
                    "success": False,
                    "error": f"Unsupported test framework: {framework}",
                    "test_results": []
                }
                
        except Exception as e:
            logger.error(f"Error running tests: {e}")
            return {
                "success": False,
                "error": f"Test execution failed: {str(e)}",
                "test_results": []
            }
    
    # Enhanced Feature 3: Documentation Awareness
    @mcp.tool()
    def get_documentation(directory: str = ".", include_comments: bool = True, doc_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """Extract and analyze documentation from the project with enhanced parsing capabilities.
        
        Args:
            directory: Directory to analyze (default: current directory)
            include_comments: Whether to include inline comments (default: True)
            doc_types: Types of documentation to include: 'readme', 'docstrings', 'comments', 'jsdoc', 'config' (default: all)
        """
        import re
        import json
        import yaml
        from typing import Dict, List, Any, Optional, Tuple
        
        def parse_readme_sections(content: str) -> Dict[str, Any]:
            """Parse README content into structured sections."""
            sections = {}
            current_section = None
            current_content = []
            code_blocks = []
            
            lines = content.split('\n')
            for i, line in enumerate(lines):
                # Check for headers
                header_match = re.match(r'^#+\s+(.+)$', line)
                if header_match:
                    # Save previous section
                    if current_section:
                        sections[current_section] = {
                            'content': '\n'.join(current_content).strip(),
                            'line_number': current_section_line
                        }
                    
                    # Start new section
                    current_section = header_match.group(1).strip()
                    current_section_line = i + 1
                    current_content = []
                    continue
                
                # Check for code blocks
                if line.strip().startswith('```'):
                    if line.strip() == '```' or line.strip().startswith('```'):
                        # Start or end of code block
                        if current_content and current_content[-1].startswith('```'):
                            # End of code block
                            code_language = current_content[-1].replace('```', '').strip()
                            code_content = '\n'.join(current_content[:-1])
                            code_blocks.append({
                                'language': code_language,
                                'content': code_content,
                                'line_number': i + 1
                            })
                            current_content = []
                        else:
                            # Start of code block
                            current_content.append(line)
                    else:
                        current_content.append(line)
                else:
                    current_content.append(line)
            
            # Save last section
            if current_section:
                sections[current_section] = {
                    'content': '\n'.join(current_content).strip(),
                    'line_number': current_section_line
                }
            
            # Identify special sections
            setup_sections = []
            api_sections = []
            
            for section_name, section_data in sections.items():
                section_lower = section_name.lower()
                if any(keyword in section_lower for keyword in ['setup', 'install', 'installation', 'getting started']):
                    setup_sections.append(section_name)
                elif any(keyword in section_lower for keyword in ['api', 'endpoint', 'usage', 'example']):
                    api_sections.append(section_name)
            
            return {
                'sections': sections,
                'code_blocks': code_blocks,
                'setup_sections': setup_sections,
                'api_sections': api_sections
            }
        
        def parse_docstring_advanced(docstring: str) -> Dict[str, Any]:
            """Parse docstring with support for Google and NumPy styles."""
            if not docstring:
                return {}
            
            parsed = {
                'summary': '',
                'description': '',
                'parameters': [],
                'returns': '',
                'raises': [],
                'examples': [],
                'style': 'unknown'
            }
            
            lines = docstring.strip().split('\n')
            current_section = 'summary'
            current_content = []
            
            for line in lines:
                line = line.strip()
                
                # Detect style
                if line.startswith('Args:') or line.startswith('Parameters:'):
                    parsed['style'] = 'google' if line.startswith('Args:') else 'numpy'
                    if current_content:
                        parsed[current_section] = '\n'.join(current_content).strip()
                    current_section = 'parameters'
                    current_content = []
                    continue
                elif line.startswith('Returns:') or line.startswith('Return:'):
                    if current_content:
                        parsed[current_section] = '\n'.join(current_content).strip()
                    current_section = 'returns'
                    current_content = []
                    continue
                elif line.startswith('Raises:') or line.startswith('Exceptions:'):
                    if current_content:
                        parsed[current_section] = '\n'.join(current_content).strip()
                    current_section = 'raises'
                    current_content = []
                    continue
                elif line.startswith('Example:') or line.startswith('Examples:'):
                    if current_content:
                        parsed[current_section] = '\n'.join(current_content).strip()
                    current_section = 'examples'
                    current_content = []
                    continue
                elif line.startswith('Note:') or line.startswith('Note:'):
                    if current_content:
                        parsed[current_section] = '\n'.join(current_content).strip()
                    current_section = 'description'
                    current_content = []
                    continue
                
                current_content.append(line)
            
            # Save last section
            if current_content:
                parsed[current_section] = '\n'.join(current_content).strip()
            
            # Parse parameters if found
            if parsed['parameters']:
                param_lines = parsed['parameters'].split('\n')
                for line in param_lines:
                    # Google style: param_name (type): description
                    google_match = re.match(r'^(\w+)\s*\(([^)]+)\):\s*(.+)$', line)
                    if google_match:
                        parsed['parameters'].append({
                            'name': google_match.group(1),
                            'type': google_match.group(2),
                            'description': google_match.group(3)
                        })
                        continue
                    
                    # NumPy style: param_name : type
                    numpy_match = re.match(r'^(\w+)\s*:\s*(.+)$', line)
                    if numpy_match:
                        parsed['parameters'].append({
                            'name': numpy_match.group(1),
                            'type': numpy_match.group(2),
                            'description': ''
                        })
                        continue
            
            return parsed
        
        def parse_jsdoc(content: str) -> List[Dict[str, Any]]:
            """Parse JSDoc comments from JavaScript/TypeScript content."""
            jsdoc_blocks = []
            
            # Find JSDoc blocks
            jsdoc_pattern = r'/\*\*\s*\n(.*?)\s*\*/'
            matches = re.finditer(jsdoc_pattern, content, re.DOTALL | re.MULTILINE)
            
            for match in matches:
                jsdoc_content = match.group(1)
                lines = [line.strip() for line in jsdoc_content.split('\n')]
                
                jsdoc_block = {
                    'description': '',
                    'params': [],
                    'returns': '',
                    'throws': [],
                    'examples': [],
                    'tags': []
                }
                
                current_section = 'description'
                current_content = []
                
                for line in lines:
                    if line.startswith('@'):
                        # Save previous section
                        if current_content:
                            jsdoc_block[current_section] = '\n'.join(current_content).strip()
                        
                        # Parse tag
                        tag_match = re.match(r'@(\w+)(?:\s+(.+))?', line)
                        if tag_match:
                            tag_name = tag_match.group(1)
                            tag_content = tag_match.group(2) or ''
                            
                            if tag_name == 'param':
                                # Parse @param name {type} description
                                param_match = re.match(r'(\w+)\s*\{([^}]+)\}\s*(.+)', tag_content)
                                if param_match:
                                    jsdoc_block['params'].append({
                                        'name': param_match.group(1),
                                        'type': param_match.group(2),
                                        'description': param_match.group(3)
                                    })
                                else:
                                    # Simple param without type
                                    simple_match = re.match(r'(\w+)\s+(.+)', tag_content)
                                    if simple_match:
                                        jsdoc_block['params'].append({
                                            'name': simple_match.group(1),
                                            'type': '',
                                            'description': simple_match.group(2)
                                        })
                            elif tag_name == 'returns':
                                jsdoc_block['returns'] = tag_content
                            elif tag_name == 'throws':
                                jsdoc_block['throws'].append(tag_content)
                            elif tag_name == 'example':
                                jsdoc_block['examples'].append(tag_content)
                            else:
                                jsdoc_block['tags'].append({
                                    'name': tag_name,
                                    'content': tag_content
                                })
                        
                        current_content = []
                    else:
                        current_content.append(line)
                
                # Save last section
                if current_content:
                    jsdoc_block[current_section] = '\n'.join(current_content).strip()
                
                jsdoc_blocks.append(jsdoc_block)
            
            return jsdoc_blocks
        
        def parse_config_file(file_path: Path) -> Dict[str, Any]:
            """Parse configuration files (YAML, JSON, .env)."""
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                config_info = {
                    'file_type': file_path.suffix,
                    'structure': {},
                    'environment_vars': [],
                    'sections': []
                }
                
                if file_path.suffix in ['.yaml', '.yml']:
                    try:
                        config_data = yaml.safe_load(content)
                        config_info['structure'] = config_data
                        
                        # Extract sections from YAML
                        if isinstance(config_data, dict):
                            config_info['sections'] = list(config_data.keys())
                    except yaml.YAMLError as e:
                        config_info['error'] = f"YAML parsing error: {e}"
                
                elif file_path.suffix == '.json':
                    try:
                        config_data = json.loads(content)
                        config_info['structure'] = config_data
                        
                        # Extract sections from JSON
                        if isinstance(config_data, dict):
                            config_info['sections'] = list(config_data.keys())
                    except json.JSONDecodeError as e:
                        config_info['error'] = f"JSON parsing error: {e}"
                
                elif file_path.name.endswith('.env') or 'env' in file_path.name.lower():
                    # Parse environment variables
                    env_vars = []
                    for line in content.split('\n'):
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            env_vars.append({
                                'name': key.strip(),
                                'value': value.strip(),
                                'commented': False
                            })
                        elif line.startswith('#') and '=' in line:
                            # Commented env var
                            key, value = line[1:].split('=', 1)
                            env_vars.append({
                                'name': key.strip(),
                                'value': value.strip(),
                                'commented': True
                            })
                    config_info['environment_vars'] = env_vars
                
                return config_info
                
            except Exception as e:
                return {'error': f"Failed to parse config file: {e}"}
        
        def calculate_quality_metrics(docstrings: List[Dict], jsdocs: List[Dict], functions: List[Dict]) -> Dict[str, Any]:
            """Calculate documentation quality metrics."""
            total_functions = len(functions)
            documented_functions = len(docstrings) + len(jsdocs)
            
            # Count undocumented functions
            documented_names = set()
            for doc in docstrings:
                if doc.get('type') == 'function':
                    documented_names.add(doc.get('name', ''))
            for jsdoc in jsdocs:
                # JSDoc doesn't have function names directly, so we'll estimate
                documented_names.add('jsdoc_function')
            
            undocumented_functions = total_functions - len(documented_names)
            
            # Calculate coverage percentage
            coverage_percentage = (documented_functions / total_functions * 100) if total_functions > 0 else 0
            
            # Count missing parameter documentation
            missing_params = 0
            for doc in docstrings:
                parsed = parse_docstring_advanced(doc.get('docstring', ''))
                if parsed.get('parameters'):
                    # Count parameters without descriptions
                    for param in parsed['parameters']:
                        if not param.get('description'):
                            missing_params += 1
            
            return {
                'total_functions': total_functions,
                'documented_functions': documented_functions,
                'undocumented_functions': undocumented_functions,
                'coverage_percentage': round(coverage_percentage, 2),
                'missing_parameter_docs': missing_params,
                'docstring_style_distribution': {
                    'google_style': sum(1 for doc in docstrings if 'Args:' in doc.get('docstring', '')),
                    'numpy_style': sum(1 for doc in docstrings if 'Parameters:' in doc.get('docstring', '')),
                    'simple_style': sum(1 for doc in docstrings if 'Args:' not in doc.get('docstring', '') and 'Parameters:' not in doc.get('docstring', ''))
                }
            }
        
        try:
            path = Path(directory).resolve()
            
            if not path.exists() or not path.is_dir():
                return {
                    "success": False,
                    "error": f"Directory does not exist: {directory}",
                    "documentation": {}
                }
            
            # Check path access
            if config_manager and not config_manager.is_path_allowed(str(path)):
                return {
                    "success": False,
                    "error": f"Directory access not allowed: {directory}",
                    "documentation": {}
                }
            
            if doc_types is None:
                doc_types = ['readme', 'docstrings', 'comments', 'jsdoc', 'config']
            
            documentation = {}
            all_functions = []
            
            # Enhanced README parsing
            if 'readme' in doc_types:
                readme_files = []
                for readme_pattern in ['README*', 'readme*', 'Readme*']:
                    for readme_file in path.glob(readme_pattern):
                        if readme_file.is_file():
                            try:
                                with open(readme_file, 'r', encoding='utf-8', errors='ignore') as f:
                                    content = f.read()
                                
                                parsed_readme = parse_readme_sections(content)
                                readme_files.append({
                                    "file_path": str(readme_file),
                                    "content": content[:10000],  # Increased limit
                                    "truncated": len(content) > 10000,
                                    "sections": parsed_readme['sections'],
                                    "code_blocks": parsed_readme['code_blocks'],
                                    "setup_sections": parsed_readme['setup_sections'],
                                    "api_sections": parsed_readme['api_sections']
                                })
                            except Exception as e:
                                logger.warning(f"Failed to read README {readme_file}: {e}")
                documentation['readme_files'] = readme_files
            
            # Enhanced docstring extraction
            if 'docstrings' in doc_types:
                docstrings = []
                for py_file in path.rglob('*.py'):
                    if py_file.is_file():
                        if config_manager and not config_manager.is_path_allowed(str(py_file)):
                            continue
                        try:
                            with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                            
                            tree = ast.parse(content, filename=str(py_file))
                            
                            # Module docstring
                            module_docstring = ast.get_docstring(tree)
                            if module_docstring:
                                parsed_doc = parse_docstring_advanced(module_docstring)
                                docstrings.append({
                                    "file_path": str(py_file),
                                    "type": "module",
                                    "name": py_file.stem,
                                    "docstring": module_docstring,
                                    "parsed": parsed_doc
                                })
                            
                            # Function and class docstrings
                            for node in ast.walk(tree):
                                if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                                    all_functions.append({
                                        'name': node.name,
                                        'type': 'function' if isinstance(node, ast.FunctionDef) else 'class',
                                        'file_path': str(py_file),
                                        'line_number': node.lineno
                                    })
                                    
                                    docstring = ast.get_docstring(node)
                                    if docstring:
                                        parsed_doc = parse_docstring_advanced(docstring)
                                        docstrings.append({
                                            "file_path": str(py_file),
                                            "type": "function" if isinstance(node, ast.FunctionDef) else "class",
                                            "name": node.name,
                                            "line_number": node.lineno,
                                            "docstring": docstring,
                                            "parsed": parsed_doc
                                        })
                                        
                        except Exception as e:
                            logger.warning(f"Failed to extract docstrings from {py_file}: {e}")
                documentation['docstrings'] = docstrings
            
            # JSDoc support
            if 'jsdoc' in doc_types:
                jsdoc_comments = []
                for js_file in path.rglob('*.{js,ts,jsx,tsx}'):
                    if js_file.is_file():
                        if config_manager and not config_manager.is_path_allowed(str(js_file)):
                            continue
                        try:
                            with open(js_file, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                            
                            jsdocs = parse_jsdoc(content)
                            for jsdoc in jsdocs:
                                jsdoc_comments.append({
                                    "file_path": str(js_file),
                                    "jsdoc": jsdoc
                                })
                                
                        except Exception as e:
                            logger.warning(f"Failed to extract JSDoc from {js_file}: {e}")
                documentation['jsdoc_comments'] = jsdoc_comments
            
            # Configuration file documentation
            if 'config' in doc_types:
                config_files = []
                config_patterns = ['*.yaml', '*.yml', '*.json', '*.env*', 'config.*', '*.config.*']
                
                for pattern in config_patterns:
                    for config_file in path.rglob(pattern):
                        if config_file.is_file():
                            if config_manager and not config_manager.is_path_allowed(str(config_file)):
                                continue
                            
                            config_info = parse_config_file(config_file)
                            config_files.append({
                                "file_path": str(config_file),
                                "config_info": config_info
                            })
                
                documentation['configuration_docs'] = config_files
            
            # Enhanced comment extraction with priority levels
            if 'comments' in doc_types and include_comments:
                comments = []
                todo_comments = []
                
                for code_file in list(path.rglob('*.py')) + list(path.rglob('*.js')) + list(path.rglob('*.ts')):
                    if code_file.is_file():
                        if config_manager and not config_manager.is_path_allowed(str(code_file)):
                            continue
                        try:
                            with open(code_file, 'r', encoding='utf-8', errors='ignore') as f:
                                lines = f.readlines()
                            
                            for i, line in enumerate(lines):
                                # Find comments
                                if code_file.suffix == '.py' and '#' in line:
                                    comment_idx = line.find('#')
                                    comment = line[comment_idx:].strip()
                                    if len(comment) > 3:
                                        comment_data = {
                                            "file_path": str(code_file),
                                            "line_number": i + 1,
                                            "comment": comment,
                                            "context": line.strip()
                                        }
                                        
                                        # Categorize TODO/FIXME with priority
                                        comment_upper = comment.upper()
                                        if any(keyword in comment_upper for keyword in ['TODO', 'FIXME', 'HACK', 'NOTE']):
                                            priority = 'high' if 'FIXME' in comment_upper or 'HACK' in comment_upper else 'medium'
                                            comment_data['priority'] = priority
                                            todo_comments.append(comment_data)
                                        else:
                                            comments.append(comment_data)
                                            
                                elif code_file.suffix in ['.js', '.ts'] and '//' in line:
                                    comment_idx = line.find('//')
                                    comment = line[comment_idx:].strip()
                                    if len(comment) > 3:
                                        comment_data = {
                                            "file_path": str(code_file),
                                            "line_number": i + 1,
                                            "comment": comment,
                                            "context": line.strip()
                                        }
                                        
                                        comment_upper = comment.upper()
                                        if any(keyword in comment_upper for keyword in ['TODO', 'FIXME', 'HACK', 'NOTE']):
                                            priority = 'high' if 'FIXME' in comment_upper or 'HACK' in comment_upper else 'medium'
                                            comment_data['priority'] = priority
                                            todo_comments.append(comment_data)
                                        else:
                                            comments.append(comment_data)
                                        
                        except Exception as e:
                            logger.warning(f"Failed to extract comments from {code_file}: {e}")
                
                documentation['comments'] = comments[:100]  # Increased limit
                documentation['todo_comments'] = todo_comments
            
            # Calculate quality metrics
            quality_metrics = calculate_quality_metrics(
                documentation.get('docstrings', []),
                documentation.get('jsdoc_comments', []),
                all_functions
            )
            
            return {
                "success": True,
                "directory": str(path),
                "documentation": documentation,
                "quality_metrics": quality_metrics,
                "summary": {
                    "readme_files": len(documentation.get('readme_files', [])),
                    "docstrings": len(documentation.get('docstrings', [])),
                    "jsdoc_comments": len(documentation.get('jsdoc_comments', [])),
                    "comments": len(documentation.get('comments', [])),
                    "todo_comments": len(documentation.get('todo_comments', [])),
                    "config_files": len(documentation.get('configuration_docs', [])),
                    "coverage_percentage": quality_metrics['coverage_percentage']
                }
            }
            
        except Exception as e:
            logger.error(f"Error extracting documentation: {e}")
            return {
                "success": False,
                "error": f"Documentation extraction failed: {str(e)}",
                "documentation": {}
            }
    
    # Enhanced Feature 4: Dependency Analysis
    @mcp.tool()
    def analyze_dependencies(directory: str = ".", include_dev: bool = True, check_security: bool = False) -> Dict[str, Any]:
        """Analyze project dependencies and package information.
        
        Args:
            directory: Directory to analyze (default: current directory)
            include_dev: Whether to include development dependencies (default: True)
            check_security: Whether to check for known security vulnerabilities (default: False)
        """
        try:
            path = Path(directory).resolve()
            
            if not path.exists() or not path.is_dir():
                return {
                    "success": False,
                    "error": f"Directory does not exist: {directory}",
                    "dependencies": {}
                }
            
            # Check path access
            if config_manager and not config_manager.is_path_allowed(str(path)):
                return {
                    "success": False,
                    "error": f"Directory access not allowed: {directory}",
                    "dependencies": {}
                }
            
            dependencies = {}
            
            # Analyze Python dependencies
            python_deps = _analyze_python_dependencies(path, include_dev)
            if python_deps:
                dependencies['python'] = python_deps
            
            # Analyze Node.js dependencies
            nodejs_deps = _analyze_nodejs_dependencies(path, include_dev)
            if nodejs_deps:
                dependencies['nodejs'] = nodejs_deps
            
            # Analyze other package managers
            other_deps = _analyze_other_dependencies(path)
            if other_deps:
                dependencies.update(other_deps)
            
            # Security analysis if requested
            if check_security:
                security_info = _check_dependency_security(dependencies)
                dependencies['security_analysis'] = security_info
            
            return {
                "success": True,
                "directory": str(path),
                "dependencies": dependencies,
                "summary": {
                    "package_managers": list(dependencies.keys()),
                    "total_dependencies": sum(len(deps.get('dependencies', [])) for deps in dependencies.values() if isinstance(deps, dict))
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing dependencies: {e}")
            return {
                "success": False,
                "error": f"Dependency analysis failed: {str(e)}",
                "dependencies": {}
            }

    # Enhanced Feature 5: Real-time File Monitoring
    @mcp.tool()
    def get_recent_changes(hours: int = 24) -> Dict[str, Any]:
        """Get list of recently modified files with change tracking information.
        
        Args:
            hours: Number of hours to look back for changes (default: 24)
        """
        try:
            if not file_watcher:
                return {
                    "success": False,
                    "error": "File watcher not initialized",
                    "changes": []
                }
            
            changes = file_watcher.get_recent_changes(hours)
            
            return {
                "success": True,
                "hours": hours,
                "total_changes": len(changes),
                "changes": changes,
                "summary": {
                    "modified": len([c for c in changes if c['change_type'] == 'modified']),
                    "added": len([c for c in changes if c['change_type'] == 'added']),
                    "deleted": len([c for c in changes if c['change_type'] == 'deleted'])
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting recent changes: {e}")
            return {
                "success": False,
                "error": f"Failed to get recent changes: {str(e)}",
                "changes": []
            }

    @mcp.tool()
    def get_index_statistics() -> Dict[str, Any]:
        """Get indexing statistics and performance metrics for the code indexer.
        
        Returns comprehensive statistics about file indexing, symbol discovery,
        memory usage, and performance metrics.
        """
        try:
            if not file_watcher:
                return {
                    "success": False,
                    "error": "File watcher not initialized",
                    "statistics": {}
                }
            
            stats = file_watcher.get_index_statistics()
            
            return {
                "success": True,
                "statistics": stats,
                "timestamp": time.time(),
                "formatted_time": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
            }
            
        except Exception as e:
            logger.error(f"Error getting index statistics: {e}")
            return {
                "success": False,
                "error": f"Failed to get index statistics: {str(e)}",
                "statistics": {}
            }

    @mcp.tool()
    def start_file_monitoring() -> Dict[str, Any]:
        """Start real-time file monitoring for automatic code indexing.
        
        Enables automatic re-indexing of code files when they are modified,
        added, or deleted. Uses debouncing to handle rapid file changes efficiently.
        """
        try:
            global file_watcher
            
            if not file_watcher:
                return {
                    "success": False,
                    "error": "File watcher not initialized",
                    "is_monitoring": False
                }
            
            if file_watcher.is_watching:
                return {
                    "success": True,
                    "message": "File monitoring is already active",
                    "is_monitoring": True
                }
            
            success = file_watcher.start_watching()
            
            if success:
                return {
                    "success": True,
                    "message": "File monitoring started successfully",
                    "is_monitoring": True,
                    "watched_directories": len([
                        d for d in config_manager.config.watched_directories 
                        if d.enabled
                    ])
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to start file monitoring",
                    "is_monitoring": False
                }
            
        except Exception as e:
            logger.error(f"Error starting file monitoring: {e}")
            return {
                "success": False,
                "error": f"Failed to start file monitoring: {str(e)}",
                "is_monitoring": False
            }

    @mcp.tool()
    def stop_file_monitoring() -> Dict[str, Any]:
        """Stop real-time file monitoring.
        
        Disables automatic re-indexing of code files. Manual indexing can still
        be performed using the search_symbols tool with auto_index=True.
        """
        try:
            global file_watcher
            
            if not file_watcher:
                return {
                    "success": False,
                    "error": "File watcher not initialized",
                    "is_monitoring": False
                }
            
            if not file_watcher.is_watching:
                return {
                    "success": True,
                    "message": "File monitoring is already stopped",
                    "is_monitoring": False
                }
            
            file_watcher.stop_watching()
            
            return {
                "success": True,
                "message": "File monitoring stopped successfully",
                "is_monitoring": False
            }
            
        except Exception as e:
            logger.error(f"Error stopping file monitoring: {e}")
            return {
                "success": False,
                "error": f"Failed to stop file monitoring: {str(e)}",
                "is_monitoring": False
            }

    @mcp.tool()
    def performance_stats() -> Dict[str, Any]:
        """Get comprehensive performance statistics for all MCP operations.
        
        Returns detailed metrics including:
        - Operation execution times and counts
        - Memory usage statistics
        - Error rates and categories
        - Slowest operations
        - Cache performance metrics
        """
        try:
            stats = performance_monitor.get_performance_stats()
            return {
                "success": True,
                "performance_stats": stats
            }
        except Exception as e:
            logger.error(f"Error getting performance stats: {e}")
            return {
                "success": False,
                "error": f"Failed to get performance stats: {str(e)}"
            }

    @mcp.tool()
    def cache_stats() -> Dict[str, Any]:
        """Get cache statistics and performance metrics.
        
        Returns information about:
        - Cache hit rates for file, symbol, and git caches
        - Cache sizes and eviction counts
        - Memory usage of caches
        """
        try:
            file_stats = performance_monitor.file_cache.get_stats()
            symbol_stats = performance_monitor.symbol_cache.get_stats()
            git_stats = performance_monitor.git_cache.get_stats()
            
            return {
                "success": True,
                "cache_stats": {
                    "file_cache": {
                        "hits": file_stats.hits,
                        "misses": file_stats.misses,
                        "hit_rate": file_stats.hit_rate,
                        "size": file_stats.size,
                        "max_size": file_stats.max_size,
                        "evictions": file_stats.evictions
                    },
                    "symbol_cache": {
                        "hits": symbol_stats.hits,
                        "misses": symbol_stats.misses,
                        "hit_rate": symbol_stats.hit_rate,
                        "size": symbol_stats.size,
                        "max_size": symbol_stats.max_size,
                        "evictions": symbol_stats.evictions
                    },
                    "git_cache": {
                        "hits": git_stats.hits,
                        "misses": git_stats.misses,
                        "hit_rate": git_stats.hit_rate,
                        "size": git_stats.size,
                        "max_size": git_stats.max_size,
                        "evictions": git_stats.evictions
                    }
                }
            }
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {
                "success": False,
                "error": f"Failed to get cache stats: {str(e)}"
            }

    @mcp.tool()
    def clear_caches() -> Dict[str, Any]:
        """Clear all caches to free memory and reset cache statistics.
        
        This will clear:
        - File content cache
        - Symbol indexing cache  
        - Git status cache
        """
        try:
            performance_monitor.file_cache.clear()
            performance_monitor.symbol_cache.clear()
            performance_monitor.git_cache.clear()
            
            return {
                "success": True,
                "message": "All caches cleared successfully"
            }
        except Exception as e:
            logger.error(f"Error clearing caches: {e}")
            return {
                "success": False,
                "error": f"Failed to clear caches: {str(e)}"
            }

    @mcp.tool()
    def configure_performance_limits(
        max_files_per_operation: Optional[int] = None,
        max_search_results: Optional[int] = None,
        max_file_size_mb: Optional[int] = None,
        operation_timeout: Optional[int] = None,
        slow_operation_threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """Configure performance limits and monitoring settings.
        
        Args:
            max_files_per_operation: Maximum number of files to process in a single operation (default: 1000)
            max_search_results: Maximum number of search results to return (default: 500)
            max_file_size_mb: Maximum file size in MB to process (default: 100)
            operation_timeout: Timeout for operations in seconds (default: 300)
            slow_operation_threshold: Threshold in seconds for logging slow operations (default: 5.0)
        """
        try:
            old_settings = {
                "max_files_per_operation": performance_monitor.max_files_per_operation,
                "max_search_results": performance_monitor.max_search_results,
                "max_file_size_mb": performance_monitor.max_file_size_mb,
                "operation_timeout": performance_monitor.operation_timeout,
                "slow_operation_threshold": performance_monitor.slow_operation_threshold
            }
            
            # Update settings if provided
            if max_files_per_operation is not None:
                if max_files_per_operation < 1 or max_files_per_operation > 10000:
                    return {
                        "success": False,
                        "error": "max_files_per_operation must be between 1 and 10000"
                    }
                performance_monitor.max_files_per_operation = max_files_per_operation
            
            if max_search_results is not None:
                if max_search_results < 1 or max_search_results > 10000:
                    return {
                        "success": False,
                        "error": "max_search_results must be between 1 and 10000"
                    }
                performance_monitor.max_search_results = max_search_results
            
            if max_file_size_mb is not None:
                if max_file_size_mb < 1 or max_file_size_mb > 1000:
                    return {
                        "success": False,
                        "error": "max_file_size_mb must be between 1 and 1000"
                    }
                performance_monitor.max_file_size_mb = max_file_size_mb
            
            if operation_timeout is not None:
                if operation_timeout < 1 or operation_timeout > 3600:
                    return {
                        "success": False,
                        "error": "operation_timeout must be between 1 and 3600 seconds"
                    }
                performance_monitor.operation_timeout = operation_timeout
            
            if slow_operation_threshold is not None:
                if slow_operation_threshold < 0.1 or slow_operation_threshold > 60.0:
                    return {
                        "success": False,
                        "error": "slow_operation_threshold must be between 0.1 and 60.0 seconds"
                    }
                performance_monitor.slow_operation_threshold = slow_operation_threshold
            
            new_settings = {
                "max_files_per_operation": performance_monitor.max_files_per_operation,
                "max_search_results": performance_monitor.max_search_results,
                "max_file_size_mb": performance_monitor.max_file_size_mb,
                "operation_timeout": performance_monitor.operation_timeout,
                "slow_operation_threshold": performance_monitor.slow_operation_threshold
            }
            
            return {
                "success": True,
                "message": "Performance limits updated successfully",
                "old_settings": old_settings,
                "new_settings": new_settings
            }
            
        except Exception as e:
            logger.error(f"Error configuring performance limits: {e}")
            return {
                "success": False,
                "error": f"Failed to configure performance limits: {str(e)}"
            }


@performance_timer("list_files")
def _list_files_sync(directory: str = ".") -> Dict[str, Any]:
    """
    Synchronous version of list_files for executor usage.
    Enhanced with configuration-based access control, caching, and performance monitoring.
    
    Args:
        directory: The directory path to list (defaults to current directory)
        
    Returns:
        Dictionary containing the list of files and directories
    """
    # Input validation
    performance_monitor.validate_input("directory_path", directory)
    
    # Check cache first
    cache_key = f"list_files:{directory}"
    cached_result = performance_monitor.file_cache.get(cache_key)
    if cached_result is not None:
        return cached_result
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
        file_count = 0
        
        try:
            for item in path.iterdir():
                # Check resource limits
                if file_count >= performance_monitor.max_files_per_operation:
                    logger.warning(f"File listing limited to {performance_monitor.max_files_per_operation} files")
                    break
                
                # Check if item access is allowed
                if config_manager and not config_manager.is_path_allowed(str(item)):
                    continue
                
                if item.is_file():
                    files.append({
                        "name": item.name,
                        "path": str(item),
                        "size": item.stat().st_size
                    })
                    file_count += 1
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
        
        result = {
            "success": True,
            "directory": str(path),
            "files": files,
            "directories": directories,
            "total_files": len(files),
            "total_directories": len(directories)
        }
        
        # Cache the result
        performance_monitor.file_cache.put(cache_key, result)
        return result
        
    except Exception as e:
        logger.error(f"Error listing files in {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "files": [],
            "directories": []
        }


@performance_timer("read_file")
def _read_file_sync(file_path: str, max_lines: Optional[int] = None) -> Dict[str, Any]:
    """
    Synchronous version of read_file for executor usage.
    Enhanced with configuration-based access control, file size limits, caching, and performance monitoring.
    
    Args:
        file_path: The path to the file to read
        max_lines: Maximum number of lines to read (optional)
        
    Returns:
        Dictionary containing the file contents and metadata
    """
    # Input validation
    performance_monitor.validate_input("file_path", file_path)
    
    # Check cache first
    cache_key = f"read_file:{file_path}:{max_lines}"
    cached_result = performance_monitor.file_cache.get(cache_key)
    if cached_result is not None:
        return cached_result
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
        
        result = {
            "success": True,
            "file_path": str(path),
            "content": content,
            "lines": line_count,
            "size": file_size,
            "truncated": truncated
        }
        
        # Cache the result
        performance_monitor.file_cache.put(cache_key, result)
        return result
        
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "content": "",
            "lines": 0
        }


@performance_timer("get_git_status")
def _get_git_status_sync(directory: str = ".") -> Dict[str, Any]:
    """
    Synchronous version of get_git_status for executor usage.
    Enhanced with caching and performance monitoring.
    
    Args:
        directory: The directory path to check git status (defaults to current directory)
        
    Returns:
        Dictionary containing git status information
    """
    # Input validation
    performance_monitor.validate_input("directory_path", directory)
    
    # Check cache first
    cache_key = f"git_status:{directory}"
    cached_result = performance_monitor.git_cache.get(cache_key)
    if cached_result is not None:
        return cached_result
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
            
            result = {
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
            
            # Cache the result
            performance_monitor.git_cache.put(cache_key, result)
            return result
            
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


def _validate_git_command_args(*args) -> bool:
    """
    Validate git command arguments to prevent injection attacks.
    
    Args:
        *args: Arguments to validate
        
    Returns:
        True if arguments are safe, False otherwise
    """
    dangerous_patterns = [
        ';', '&', '|', '`', '$', '$(', '${', '>', '<', '>>', '<<',
        '&&', '||', '!', '~', '..', '--', '/*', '*/', '\\'
    ]
    
    for arg in args:
        if not isinstance(arg, str):
            continue
        for pattern in dangerous_patterns:
            if pattern in arg:
                return False
    return True


def _get_git_diff_sync(directory: str = ".", file_path: Optional[str] = None, staged: bool = False, unstaged: bool = True) -> Dict[str, Any]:
    """
    Synchronous version of get_git_diff for executor usage.
    
    Args:
        directory: The directory path to check git diff (defaults to current directory)
        file_path: Specific file to get diff for (optional)
        staged: Include staged changes (default: False)
        unstaged: Include unstaged changes (default: True)
        
    Returns:
        Dictionary containing git diff information
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
        
        # Validate file_path if provided
        if file_path and not _validate_git_command_args(file_path):
            return {
                "success": False,
                "error": "Invalid file path provided",
                "is_git_repo": True
            }
        
        # Build git diff command
        cmd = ["git", "diff"]
        
        if staged and not unstaged:
            cmd.append("--cached")
        elif not staged and unstaged:
            cmd.append("--")  # Only unstaged changes
        # If both are True or both are False, show all changes
        
        if file_path:
            cmd.append(file_path)
        
        # Run git diff command
        try:
            result = subprocess.run(
                cmd,
                cwd=str(path),
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=30
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Git diff command failed: {result.stderr}",
                    "is_git_repo": True
                }
            
            # Parse diff output
            diff_content = result.stdout
            diff_lines = diff_content.split('\n') if diff_content else []
            
            # Extract statistics
            stats = {
                "files_changed": 0,
                "insertions": 0,
                "deletions": 0,
                "binary_files": []
            }
            
            current_file = None
            for line in diff_lines:
                if line.startswith('diff --git'):
                    stats["files_changed"] += 1
                    # Extract filename
                    parts = line.split()
                    if len(parts) >= 4:
                        current_file = parts[3][2:]  # Remove 'b/' prefix
                elif line.startswith('Binary files'):
                    if current_file:
                        stats["binary_files"].append(current_file)
                elif line.startswith('+') and not line.startswith('+++'):
                    stats["insertions"] += 1
                elif line.startswith('-') and not line.startswith('---'):
                    stats["deletions"] += 1
            
            return {
                "success": True,
                "is_git_repo": True,
                "directory": str(path),
                "file_path": file_path,
                "staged": staged,
                "unstaged": unstaged,
                "diff_content": diff_content,
                "diff_lines": len(diff_lines),
                "statistics": stats,
                "has_changes": len(diff_content.strip()) > 0
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Git diff command timed out",
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
                "error": f"Error running git diff command: {str(e)}",
                "is_git_repo": True
            }
        
    except Exception as e:
        logger.error(f"Error getting git diff for {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "is_git_repo": False
        }


def _get_commit_history_sync(directory: str = ".", limit: int = 10, file_path: Optional[str] = None, author: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
    """
    Synchronous version of get_commit_history for executor usage.
    
    Args:
        directory: The directory path to check commit history (defaults to current directory)
        limit: Maximum number of commits to return (default: 10)
        file_path: Filter commits that modified specific file (optional)
        author: Filter commits by author (optional)
        since: Show commits after this date (optional, format: YYYY-MM-DD)
        until: Show commits before this date (optional, format: YYYY-MM-DD)
        
    Returns:
        Dictionary containing commit history information
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
        
        # Validate arguments
        if not _validate_git_command_args(file_path or "", author or "", since or "", until or ""):
            return {
                "success": False,
                "error": "Invalid arguments provided",
                "is_git_repo": True
            }
        
        # Build git log command
        cmd = ["git", "log", f"--max-count={limit}", "--pretty=format:%H|%an|%ae|%ad|%s|%D"]
        
        if file_path:
            cmd.extend(["--", file_path])
        if author:
            cmd.extend(["--author", author])
        if since:
            cmd.extend(["--since", since])
        if until:
            cmd.extend(["--until", until])
        
        # Run git log command
        try:
            result = subprocess.run(
                cmd,
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Git log command failed: {result.stderr}",
                    "is_git_repo": True
                }
            
            # Parse commit history
            commits = []
            commit_lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
            
            for line in commit_lines:
                if '|' in line:
                    parts = line.split('|', 5)
                    if len(parts) >= 5:
                        commit = {
                            "sha": parts[0][:8],  # Short SHA
                            "full_sha": parts[0],
                            "author_name": parts[1],
                            "author_email": parts[2],
                            "date": parts[3],
                            "message": parts[4],
                            "branches": parts[5] if len(parts) > 5 else ""
                        }
                        commits.append(commit)
            
            # Get additional statistics for each commit
            for commit in commits:
                try:
                    stats_cmd = ["git", "show", "--stat", "--format=", commit["full_sha"]]
                    stats_result = subprocess.run(
                        stats_cmd,
                        cwd=str(path),
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    
                    if stats_result.returncode == 0:
                        # Parse statistics
                        stats_lines = stats_result.stdout.strip().split('\n')
                        files_changed = 0
                        insertions = 0
                        deletions = 0
                        
                        for stat_line in stats_lines:
                            if 'file' in stat_line and 'changed' in stat_line:
                                # Extract files changed count
                                match = re.search(r'(\d+) file', stat_line)
                                if match:
                                    files_changed = int(match.group(1))
                                
                                # Extract insertions and deletions
                                ins_match = re.search(r'(\d+) insertion', stat_line)
                                if ins_match:
                                    insertions = int(ins_match.group(1))
                                
                                del_match = re.search(r'(\d+) deletion', stat_line)
                                if del_match:
                                    deletions = int(del_match.group(1))
                        
                        commit["statistics"] = {
                            "files_changed": files_changed,
                            "insertions": insertions,
                            "deletions": deletions
                        }
                    else:
                        commit["statistics"] = {
                            "files_changed": 0,
                            "insertions": 0,
                            "deletions": 0
                        }
                        
                except Exception:
                    commit["statistics"] = {
                        "files_changed": 0,
                        "insertions": 0,
                        "deletions": 0
                    }
            
            return {
                "success": True,
                "is_git_repo": True,
                "directory": str(path),
                "commits": commits,
                "total_commits": len(commits),
                "filters": {
                    "limit": limit,
                    "file_path": file_path,
                    "author": author,
                    "since": since,
                    "until": until
                }
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Git log command timed out",
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
                "error": f"Error running git log command: {str(e)}",
                "is_git_repo": True
            }
        
    except Exception as e:
        logger.error(f"Error getting commit history for {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "is_git_repo": False
        }


def _get_file_blame_sync(directory: str = ".", file_path: str = "", start_line: Optional[int] = None, end_line: Optional[int] = None) -> Dict[str, Any]:
    """
    Synchronous version of get_file_blame for executor usage.
    
    Args:
        directory: The directory path containing the git repository (defaults to current directory)
        file_path: The file to get blame information for
        start_line: Start line number (optional, 1-based)
        end_line: End line number (optional, 1-based)
        
    Returns:
        Dictionary containing file blame information
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
        
        # Validate file_path
        if not file_path:
            return {
                "success": False,
                "error": "File path is required",
                "is_git_repo": True
            }
        
        if not _validate_git_command_args(file_path):
            return {
                "success": False,
                "error": "Invalid file path provided",
                "is_git_repo": True
            }
        
        # Check if file exists
        full_file_path = path / file_path
        if not full_file_path.exists():
            return {
                "success": False,
                "error": f"File does not exist: {file_path}",
                "is_git_repo": True
            }
        
        # Build git blame command
        cmd = ["git", "blame", "-l", "-w", "--date=short"]
        
        if start_line and end_line:
            cmd.extend(["-L", f"{start_line},{end_line}"])
        elif start_line:
            cmd.extend(["-L", f"{start_line},+10"])  # Show 10 lines starting from start_line
        
        cmd.append(file_path)
        
        # Run git blame command
        try:
            result = subprocess.run(
                cmd,
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Git blame command failed: {result.stderr}",
                    "is_git_repo": True
                }
            
            # Parse blame output
            blame_lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
            blame_info = []
            
            for line in blame_lines:
                # Parse blame line format: SHA (Author Date LineNumber) content
                match = re.match(r'^([a-f0-9]+)\s+\(([^)]+)\s+(\d{4}-\d{2}-\d{2})\s+(\d+)\)\s+(.*)$', line)
                if match:
                    sha, author, date, line_num, content = match.groups()
                    blame_info.append({
                        "line_number": int(line_num),
                        "sha": sha[:8],  # Short SHA
                        "full_sha": sha,
                        "author": author,
                        "date": date,
                        "content": content
                    })
                else:
                    # Handle lines that don't match the expected format
                    blame_info.append({
                        "line_number": len(blame_info) + 1,
                        "sha": "unknown",
                        "full_sha": "unknown",
                        "author": "unknown",
                        "date": "unknown",
                        "content": line
                    })
            
            return {
                "success": True,
                "is_git_repo": True,
                "directory": str(path),
                "file_path": file_path,
                "blame_info": blame_info,
                "total_lines": len(blame_info),
                "line_range": {
                    "start": start_line,
                    "end": end_line
                }
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Git blame command timed out",
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
                "error": f"Error running git blame command: {str(e)}",
                "is_git_repo": True
            }
        
    except Exception as e:
        logger.error(f"Error getting file blame for {file_path} in {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "is_git_repo": False
        }


def _get_branch_info_sync(directory: str = ".") -> Dict[str, Any]:
    """
    Synchronous version of get_branch_info for executor usage.
    
    Args:
        directory: The directory path to check branch info (defaults to current directory)
        
    Returns:
        Dictionary containing branch information
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
        
        # Get current branch
        try:
            current_result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=10
            )
            current_branch = current_result.stdout.strip() if current_result.returncode == 0 else "unknown"
        except Exception:
            current_branch = "unknown"
        
        # Get all local branches
        try:
            local_result = subprocess.run(
                ["git", "branch", "-v"],
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            local_branches = []
            if local_result.returncode == 0:
                for line in local_result.stdout.strip().split('\n'):
                    if line.strip():
                        # Parse branch line: * branch_name commit_sha commit_message
                        parts = line.split()
                        if len(parts) >= 3:
                            is_current = line.startswith('*')
                            branch_name = parts[1] if is_current else parts[0]
                            commit_sha = parts[2] if len(parts) > 2 else "unknown"
                            commit_message = ' '.join(parts[3:]) if len(parts) > 3 else ""
                            
                            local_branches.append({
                                "name": branch_name,
                                "is_current": is_current,
                                "commit_sha": commit_sha[:8],  # Short SHA
                                "commit_message": commit_message
                            })
        except Exception:
            local_branches = []
        
        # Get all remote branches
        try:
            remote_result = subprocess.run(
                ["git", "branch", "-r", "-v"],
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=10
            )
            
            remote_branches = []
            if remote_result.returncode == 0:
                for line in remote_result.stdout.strip().split('\n'):
                    if line.strip() and not 'HEAD' in line:
                        # Parse remote branch line: origin/branch_name commit_sha commit_message
                        parts = line.split()
                        if len(parts) >= 3:
                            branch_name = parts[0]
                            commit_sha = parts[1] if len(parts) > 1 else "unknown"
                            commit_message = ' '.join(parts[2:]) if len(parts) > 2 else ""
                            
                            remote_branches.append({
                                "name": branch_name,
                                "commit_sha": commit_sha[:8],  # Short SHA
                                "commit_message": commit_message
                            })
        except Exception:
            remote_branches = []
        
        # Get ahead/behind status for current branch
        ahead_behind = {"ahead": 0, "behind": 0}
        if current_branch != "unknown":
            try:
                status_result = subprocess.run(
                    ["git", "rev-list", "--left-right", "--count", f"origin/{current_branch}...{current_branch}"],
                    cwd=str(path),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if status_result.returncode == 0:
                    parts = status_result.stdout.strip().split('\t')
                    if len(parts) == 2:
                        ahead_behind["behind"] = int(parts[0])
                        ahead_behind["ahead"] = int(parts[1])
            except Exception:
                pass
        
        return {
            "success": True,
            "is_git_repo": True,
            "directory": str(path),
            "current_branch": current_branch,
            "local_branches": local_branches,
            "remote_branches": remote_branches,
            "ahead_behind": ahead_behind,
            "total_local_branches": len(local_branches),
            "total_remote_branches": len(remote_branches)
        }
        
    except Exception as e:
        logger.error(f"Error getting branch info for {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "is_git_repo": False
        }


def _find_commits_touching_file_sync(directory: str = ".", file_path: str = "", pattern: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    """
    Synchronous version of find_commits_touching_file for executor usage.
    
    Args:
        directory: The directory path to search in (defaults to current directory)
        file_path: Specific file to find commits for (optional)
        pattern: File pattern to match (e.g., "*.py", "src/**") (optional)
        limit: Maximum number of commits to return (default: 20)
        
    Returns:
        Dictionary containing commits that touched files
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
        
        # Validate arguments
        if not _validate_git_command_args(file_path or "", pattern or ""):
            return {
                "success": False,
                "error": "Invalid arguments provided",
                "is_git_repo": True
            }
        
        # Build git log command
        cmd = ["git", "log", f"--max-count={limit}", "--pretty=format:%H|%an|%ae|%ad|%s", "--name-only"]
        
        if file_path:
            cmd.extend(["--", file_path])
        elif pattern:
            # Use git log with path pattern
            cmd.extend(["--", pattern])
        
        # Run git log command
        try:
            result = subprocess.run(
                cmd,
                cwd=str(path),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Git log command failed: {result.stderr}",
                    "is_git_repo": True
                }
            
            # Parse commits and files
            commits = []
            lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
            
            current_commit = None
            current_files = []
            
            for line in lines:
                if '|' in line and not line.startswith(' '):
                    # This is a commit line
                    if current_commit:
                        current_commit["files_changed"] = current_files
                        commits.append(current_commit)
                    
                    parts = line.split('|', 4)
                    if len(parts) >= 5:
                        current_commit = {
                            "sha": parts[0][:8],  # Short SHA
                            "full_sha": parts[0],
                            "author_name": parts[1],
                            "author_email": parts[2],
                            "date": parts[3],
                            "message": parts[4],
                            "files_changed": []
                        }
                        current_files = []
                elif line.strip() and current_commit:
                    # This is a file name
                    current_files.append(line.strip())
            
            # Add the last commit
            if current_commit:
                current_commit["files_changed"] = current_files
                commits.append(current_commit)
            
            # Get additional statistics for each commit
            for commit in commits:
                try:
                    stats_cmd = ["git", "show", "--stat", "--format=", commit["full_sha"]]
                    stats_result = subprocess.run(
                        stats_cmd,
                        cwd=str(path),
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    
                    if stats_result.returncode == 0:
                        # Parse statistics
                        stats_lines = stats_result.stdout.strip().split('\n')
                        files_changed = 0
                        insertions = 0
                        deletions = 0
                        
                        for stat_line in stats_lines:
                            if 'file' in stat_line and 'changed' in stat_line:
                                # Extract files changed count
                                match = re.search(r'(\d+) file', stat_line)
                                if match:
                                    files_changed = int(match.group(1))
                                
                                # Extract insertions and deletions
                                ins_match = re.search(r'(\d+) insertion', stat_line)
                                if ins_match:
                                    insertions = int(ins_match.group(1))
                                
                                del_match = re.search(r'(\d+) deletion', stat_line)
                                if del_match:
                                    deletions = int(del_match.group(1))
                        
                        commit["statistics"] = {
                            "files_changed": files_changed,
                            "insertions": insertions,
                            "deletions": deletions
                        }
                    else:
                        commit["statistics"] = {
                            "files_changed": len(commit["files_changed"]),
                            "insertions": 0,
                            "deletions": 0
                        }
                        
                except Exception:
                    commit["statistics"] = {
                        "files_changed": len(commit["files_changed"]),
                        "insertions": 0,
                        "deletions": 0
                    }
            
            return {
                "success": True,
                "is_git_repo": True,
                "directory": str(path),
                "commits": commits,
                "total_commits": len(commits),
                "search_criteria": {
                    "file_path": file_path,
                    "pattern": pattern,
                    "limit": limit
                }
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Git log command timed out",
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
                "error": f"Error running git log command: {str(e)}",
                "is_git_repo": True
            }
        
    except Exception as e:
        logger.error(f"Error finding commits touching file {file_path or pattern} in {directory}: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "is_git_repo": False
        }


def _run_pytest(directory: str, test_pattern: Optional[str] = None) -> Dict[str, Any]:
    """
    Execute pytest with --tb=short and -v flags and parse results.
    
    Args:
        directory: Directory to run tests in
        test_pattern: Optional pattern to match test files
        
    Returns:
        Dictionary with test results and summary
    """
    try:
        # Build pytest command
        cmd = ["python", "-m", "pytest", "--tb=short", "-v"]
        
        if test_pattern:
            cmd.append(test_pattern)
        
        logger.info(f"Running pytest in {directory} with command: {' '.join(cmd)}")
        
        # Execute pytest with timeout
        result = subprocess.run(
            cmd,
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        # Parse stdout for test results
        test_results = []
        summary = {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        
        if result.stdout:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                # Look for test result lines like: test_file.py::test_name PASSED/FAILED/SKIPPED
                if '::' in line and any(status in line for status in ['PASSED', 'FAILED', 'SKIPPED']):
                    parts = line.split('::')
                    if len(parts) >= 2:
                        file_path = parts[0].strip()
                        test_info = parts[1].strip()
                        
                        # Extract test name and status
                        if ' PASSED' in test_info:
                            test_name = test_info.replace(' PASSED', '').strip()
                            status = 'passed'
                            summary['passed'] += 1
                        elif ' FAILED' in test_info:
                            test_name = test_info.replace(' FAILED', '').strip()
                            status = 'failed'
                            summary['failed'] += 1
                        elif ' SKIPPED' in test_info:
                            test_name = test_info.replace(' SKIPPED', '').strip()
                            status = 'skipped'
                            summary['skipped'] += 1
                        else:
                            continue
                        
                        # Extract duration if available
                        duration = 0.0
                        if '[' in test_info and ']' in test_info:
                            try:
                                duration_str = test_info[test_info.find('[')+1:test_info.find(']')]
                                if 's' in duration_str:
                                    duration = float(duration_str.replace('s', ''))
                            except (ValueError, IndexError):
                                pass
                        
                        test_results.append({
                            "test_name": test_name,
                            "status": status,
                            "duration": duration,
                            "error_message": None,  # Would need more complex parsing for error details
                            "file_path": file_path
                        })
        
        summary['total'] = len(test_results)
        
        return {
            "success": True,
            "framework": "pytest",
            "test_results": test_results,
            "summary": summary,
            "return_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
        
    except subprocess.TimeoutExpired:
        logger.error(f"pytest execution timed out in {directory}")
        return {
            "success": False,
            "framework": "pytest",
            "error": "Test execution timed out (5 minutes)",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }
    except FileNotFoundError:
        logger.error(f"pytest not found in {directory}")
        return {
            "success": False,
            "framework": "pytest",
            "error": "pytest not found. Please ensure pytest is installed.",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }
    except Exception as e:
        logger.error(f"Error running pytest in {directory}: {e}")
        return {
            "success": False,
            "framework": "pytest",
            "error": f"pytest execution failed: {str(e)}",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }


def _run_jest(directory: str, test_pattern: Optional[str] = None) -> Dict[str, Any]:
    """
    Execute npm test with --json and --verbose flags and parse results.
    
    Args:
        directory: Directory to run tests in
        test_pattern: Optional pattern to match test files
        
    Returns:
        Dictionary with test results and summary
    """
    try:
        # Build npm test command
        cmd = ["npm", "test", "--", "--json", "--verbose"]
        
        if test_pattern:
            cmd.extend(["--testNamePattern", test_pattern])
        
        logger.info(f"Running Jest in {directory} with command: {' '.join(cmd)}")
        
        # Execute npm test with timeout
        result = subprocess.run(
            cmd,
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        test_results = []
        summary = {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        
        # Try to parse JSON output first
        try:
            if result.stdout:
                # Look for JSON in stdout (Jest might output other text too)
                json_start = result.stdout.find('{')
                json_end = result.stdout.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_output = result.stdout[json_start:json_end]
                    jest_data = json.loads(json_output)
                    
                    # Parse Jest JSON format
                    if 'testResults' in jest_data:
                        for test_file in jest_data['testResults']:
                            file_path = test_file.get('name', '')
                            for assertion in test_file.get('assertionResults', []):
                                test_name = assertion.get('title', '')
                                status = assertion.get('status', 'unknown')
                                
                                # Map Jest status to our format
                                if status == 'passed':
                                    summary['passed'] += 1
                                elif status == 'failed':
                                    summary['failed'] += 1
                                elif status == 'pending':
                                    summary['skipped'] += 1
                                
                                duration = assertion.get('duration', 0) / 1000.0  # Convert ms to seconds
                                
                                test_results.append({
                                    "test_name": test_name,
                                    "status": status,
                                    "duration": duration,
                                    "error_message": assertion.get('failureMessages', [None])[0] if assertion.get('failureMessages') else None,
                                    "file_path": file_path
                                })
                    
                    summary['total'] = len(test_results)
                    return {
                        "success": True,
                        "framework": "jest",
                        "test_results": test_results,
                        "summary": summary,
                        "return_code": result.returncode,
                        "stdout": result.stdout,
                        "stderr": result.stderr
                    }
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse Jest JSON output: {e}, falling back to text parsing")
        
        # Fallback to text parsing
        if result.stdout:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                # Look for ✓ and ✗ symbols in output
                if '✓' in line or '✗' in line:
                    # Extract test name and status
                    if '✓' in line:
                        test_name = line.split('✓')[1].strip()
                        status = 'passed'
                        summary['passed'] += 1
                    elif '✗' in line:
                        test_name = line.split('✗')[1].strip()
                        status = 'failed'
                        summary['failed'] += 1
                    else:
                        continue
                    
                    test_results.append({
                        "test_name": test_name,
                        "status": status,
                        "duration": 0.0,  # Duration not easily extractable from text
                        "error_message": None,
                        "file_path": ""
                    })
        
        summary['total'] = len(test_results)
        
        return {
            "success": True,
            "framework": "jest",
            "test_results": test_results,
            "summary": summary,
            "return_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
        
    except subprocess.TimeoutExpired:
        logger.error(f"Jest execution timed out in {directory}")
        return {
            "success": False,
            "framework": "jest",
            "error": "Test execution timed out (5 minutes)",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }
    except FileNotFoundError:
        logger.error(f"npm not found in {directory}")
        return {
            "success": False,
            "framework": "jest",
            "error": "npm not found. Please ensure Node.js and npm are installed.",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }
    except Exception as e:
        logger.error(f"Error running Jest in {directory}: {e}")
        return {
            "success": False,
            "framework": "jest",
            "error": f"Jest execution failed: {str(e)}",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }


def _run_mocha(directory: str, test_pattern: Optional[str] = None) -> Dict[str, Any]:
    """
    Execute npx mocha with --reporter json and parse results.
    
    Args:
        directory: Directory to run tests in
        test_pattern: Optional pattern to match test files
        
    Returns:
        Dictionary with test results and summary
    """
    try:
        # Build mocha command
        cmd = ["npx", "mocha", "--reporter", "json"]
        
        if test_pattern:
            cmd.extend(["--grep", test_pattern])
        
        logger.info(f"Running Mocha in {directory} with command: {' '.join(cmd)}")
        
        # Execute mocha with timeout
        result = subprocess.run(
            cmd,
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        test_results = []
        summary = {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        
        # Parse JSON output from Mocha
        try:
            if result.stdout:
                mocha_data = json.loads(result.stdout)
                
                # Parse Mocha JSON format
                if 'tests' in mocha_data:
                    for test in mocha_data['tests']:
                        test_name = test.get('title', '')
                        status = test.get('state', 'unknown')
                        
                        # Map Mocha status to our format
                        if status == 'passed':
                            summary['passed'] += 1
                        elif status == 'failed':
                            summary['failed'] += 1
                        elif status == 'pending':
                            summary['skipped'] += 1
                        
                        # Convert duration from ms to seconds
                        duration = test.get('duration', 0) / 1000.0
                        
                        # Extract error message if test failed
                        error_message = None
                        if status == 'failed' and 'err' in test:
                            err_info = test['err']
                            if isinstance(err_info, dict):
                                error_message = err_info.get('message', '')
                            else:
                                error_message = str(err_info)
                        
                        test_results.append({
                            "test_name": test_name,
                            "status": status,
                            "duration": duration,
                            "error_message": error_message,
                            "file_path": test.get('file', '')
                        })
                
                summary['total'] = len(test_results)
                
                return {
                    "success": True,
                    "framework": "mocha",
                    "test_results": test_results,
                    "summary": summary,
                    "return_code": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse Mocha JSON output: {e}")
            return {
                "success": False,
                "framework": "mocha",
                "error": f"Failed to parse Mocha JSON output: {str(e)}",
                "test_results": [],
                "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
            }
        
    except subprocess.TimeoutExpired:
        logger.error(f"Mocha execution timed out in {directory}")
        return {
            "success": False,
            "framework": "mocha",
            "error": "Test execution timed out (5 minutes)",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }
    except FileNotFoundError:
        logger.error(f"npx not found in {directory}")
        return {
            "success": False,
            "framework": "mocha",
            "error": "npx not found. Please ensure Node.js and npm are installed.",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }
    except Exception as e:
        logger.error(f"Error running Mocha in {directory}: {e}")
        return {
            "success": False,
            "framework": "mocha",
            "error": f"Mocha execution failed: {str(e)}",
            "test_results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
        }


def _analyze_python_dependencies(path: Path, include_dev: bool) -> Optional[Dict[str, Any]]:
    """
    Analyze Python dependencies from requirements files and setup.py.
    
    Args:
        path: Path to the project directory
        include_dev: Whether to include development dependencies
        
    Returns:
        Dictionary with dependencies, dev_dependencies, and package_files, or None if no Python project found
    """
    try:
        dependencies = []
        dev_dependencies = []
        package_files = []
        
        # Check for requirements files
        requirements_files = [
            'requirements.txt',
            'requirements-dev.txt', 
            'dev-requirements.txt',
            'requirements-test.txt'
        ]
        
        for req_file in requirements_files:
            req_path = path / req_file
            if req_path.exists():
                try:
                    with open(req_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    package_files.append(str(req_path))
                    
                    # Parse dependencies using regex
                    dep_pattern = r'^([a-zA-Z0-9\-_\.]+)([><=!]+.*)?$'
                    for line in content.split('\n'):
                        line = line.strip()
                        if line and not line.startswith('#'):
                            match = re.match(dep_pattern, line)
                            if match:
                                name = match.group(1)
                                version = match.group(2) if match.group(2) else ""
                                
                                dep_info = {
                                    "name": name,
                                    "version": version,
                                    "source": str(req_path)
                                }
                                
                                # Categorize as dev dependency based on filename
                                if 'dev' in req_file or 'test' in req_file:
                                    if include_dev:
                                        dev_dependencies.append(dep_info)
                                else:
                                    dependencies.append(dep_info)
                                    
                except Exception as e:
                    logger.warning(f"Failed to parse {req_file}: {e}")
        
        # Check for setup.py
        setup_path = path / 'setup.py'
        if setup_path.exists():
            try:
                with open(setup_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                package_files.append(str(setup_path))
                
                # Extract install_requires using regex
                install_requires_pattern = r'install_requires\s*=\s*\[(.*?)\]'
                match = re.search(install_requires_pattern, content, re.DOTALL)
                if match:
                    install_requires_content = match.group(1)
                    
                    # Parse individual dependencies
                    dep_pattern = r'["\']([a-zA-Z0-9\-_\.]+)([><=!]+.*)?["\']'
                    for dep_match in re.finditer(dep_pattern, install_requires_content):
                        name = dep_match.group(1)
                        version = dep_match.group(2) if dep_match.group(2) else ""
                        
                        dependencies.append({
                            "name": name,
                            "version": version,
                            "source": str(setup_path)
                        })
                        
            except Exception as e:
                logger.warning(f"Failed to parse setup.py: {e}")
        
        # Return None if no Python project files found
        if not package_files:
            return None
            
        return {
            "dependencies": dependencies,
            "dev_dependencies": dev_dependencies,
            "package_files": package_files
        }
        
    except Exception as e:
        logger.error(f"Error analyzing Python dependencies: {e}")
        return None


def _analyze_nodejs_dependencies(path: Path, include_dev: bool) -> Optional[Dict[str, Any]]:
    """
    Analyze Node.js dependencies from package.json and package-lock.json.
    
    Args:
        path: Path to the project directory
        include_dev: Whether to include development dependencies
        
    Returns:
        Dictionary with dependencies, dev_dependencies, and package_files, or None if no Node.js project found
    """
    try:
        dependencies = []
        dev_dependencies = []
        package_files = []
        
        # Check for package.json
        package_json_path = path / 'package.json'
        if not package_json_path.exists():
            return None
            
        try:
            with open(package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            
            package_files.append(str(package_json_path))
            
            # Parse dependencies
            if 'dependencies' in package_data:
                for name, version in package_data['dependencies'].items():
                    dependencies.append({
                        "name": name,
                        "version": version,
                        "source": str(package_json_path)
                    })
            
            # Parse devDependencies if requested
            if include_dev and 'devDependencies' in package_data:
                for name, version in package_data['devDependencies'].items():
                    dev_dependencies.append({
                        "name": name,
                        "version": version,
                        "source": str(package_json_path)
                    })
                    
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse package.json: {e}")
            return None
        except Exception as e:
            logger.warning(f"Error reading package.json: {e}")
            return None
        
        # Check for package-lock.json for more detailed version info
        package_lock_path = path / 'package-lock.json'
        if package_lock_path.exists():
            try:
                with open(package_lock_path, 'r', encoding='utf-8') as f:
                    lock_data = json.load(f)
                
                package_files.append(str(package_lock_path))
                
                # Update dependencies with exact versions from lock file
                if 'dependencies' in lock_data:
                    for name, dep_info in lock_data['dependencies'].items():
                        if isinstance(dep_info, dict) and 'version' in dep_info:
                            # Update existing dependency or add new one
                            existing_dep = next((d for d in dependencies if d['name'] == name), None)
                            if existing_dep:
                                existing_dep['lock_version'] = dep_info['version']
                            else:
                                dependencies.append({
                                    "name": name,
                                    "version": dep_info['version'],
                                    "source": str(package_lock_path)
                                })
                                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse package-lock.json: {e}")
            except Exception as e:
                logger.warning(f"Error reading package-lock.json: {e}")
        
        return {
            "dependencies": dependencies,
            "dev_dependencies": dev_dependencies,
            "package_files": package_files
        }
        
    except Exception as e:
        logger.error(f"Error analyzing Node.js dependencies: {e}")
        return None


def _analyze_other_dependencies(path: Path) -> Dict[str, Any]:
    """
    Analyze other package managers (Go, Rust, PHP, Ruby).
    
    Args:
        path: Path to the project directory
        
    Returns:
        Dictionary with detected package managers as keys
    """
    result = {}
    
    try:
        # Check for Go modules
        go_mod_path = path / 'go.mod'
        if go_mod_path.exists():
            try:
                with open(go_mod_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Simple parsing of go.mod - extract module name and go version
                module_match = re.search(r'^module\s+(\S+)', content, re.MULTILINE)
                go_version_match = re.search(r'^go\s+(\S+)', content, re.MULTILINE)
                
                result['go'] = {
                    "package_files": [str(go_mod_path)],
                    "module_name": module_match.group(1) if module_match else "unknown",
                    "go_version": go_version_match.group(1) if go_version_match else "unknown",
                    "dependencies": []  # Could be enhanced to parse require statements
                }
                
            except Exception as e:
                logger.warning(f"Failed to parse go.mod: {e}")
        
        # Check for Rust Cargo
        cargo_toml_path = path / 'Cargo.toml'
        if cargo_toml_path.exists():
            try:
                with open(cargo_toml_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Simple parsing of Cargo.toml - extract package name and version
                package_match = re.search(r'\[package\]\s*\nname\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
                version_match = re.search(r'\[package\]\s*\nversion\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
                
                result['rust'] = {
                    "package_files": [str(cargo_toml_path)],
                    "package_name": package_match.group(1) if package_match else "unknown",
                    "package_version": version_match.group(1) if version_match else "unknown",
                    "dependencies": []  # Could be enhanced to parse [dependencies] section
                }
                
            except Exception as e:
                logger.warning(f"Failed to parse Cargo.toml: {e}")
        
        # Check for PHP Composer
        composer_json_path = path / 'composer.json'
        if composer_json_path.exists():
            try:
                with open(composer_json_path, 'r', encoding='utf-8') as f:
                    composer_data = json.load(f)
                
                dependencies = []
                dev_dependencies = []
                
                if 'require' in composer_data:
                    for name, version in composer_data['require'].items():
                        dependencies.append({
                            "name": name,
                            "version": version,
                            "source": str(composer_json_path)
                        })
                
                if 'require-dev' in composer_data:
                    for name, version in composer_data['require-dev'].items():
                        dev_dependencies.append({
                            "name": name,
                            "version": version,
                            "source": str(composer_json_path)
                        })
                
                result['php'] = {
                    "package_files": [str(composer_json_path)],
                    "dependencies": dependencies,
                    "dev_dependencies": dev_dependencies
                }
                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse composer.json: {e}")
            except Exception as e:
                logger.warning(f"Error reading composer.json: {e}")
        
        # Check for Ruby Gemfile
        gemfile_path = path / 'Gemfile'
        if gemfile_path.exists():
            try:
                with open(gemfile_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                dependencies = []
                dev_dependencies = []
                
                # Simple parsing of Gemfile
                gem_pattern = r'gem\s+["\']([^"\']+)["\'](?:,\s*["\']([^"\']+)["\'])?'
                for match in re.finditer(gem_pattern, content):
                    name = match.group(1)
                    version = match.group(2) if match.group(2) else ""
                    
                    # Check if it's in a development group
                    line_start = content.rfind('\n', 0, match.start())
                    line_end = content.find('\n', match.end())
                    context = content[line_start:line_end] if line_start >= 0 else content[:line_end]
                    
                    if 'group :development' in context or 'group :test' in context:
                        dev_dependencies.append({
                            "name": name,
                            "version": version,
                            "source": str(gemfile_path)
                        })
                    else:
                        dependencies.append({
                            "name": name,
                            "version": version,
                            "source": str(gemfile_path)
                        })
                
                result['ruby'] = {
                    "package_files": [str(gemfile_path)],
                    "dependencies": dependencies,
                    "dev_dependencies": dev_dependencies
                }
                
            except Exception as e:
                logger.warning(f"Failed to parse Gemfile: {e}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing other dependencies: {e}")
        return {}


def _check_dependency_security(dependencies: Dict[str, Any]) -> Dict[str, Any]:
    """
    Basic security analysis placeholder for dependencies.
    
    Args:
        dependencies: Dictionary containing dependency information
        
    Returns:
        Dictionary with security analysis results (placeholder implementation)
    """
    try:
        # This is a placeholder implementation
        # In a real implementation, this would:
        # - Check against vulnerability databases (e.g., NVD, Snyk, GitHub Security Advisories)
        # - Check for outdated packages
        # - Check for license compliance issues
        # - Check for known malicious packages
        
        vulnerability_count = 0
        outdated_count = 0
        license_issues = 0
        
        # Mock analysis - count total dependencies as a placeholder
        total_deps = 0
        for package_manager, deps_info in dependencies.items():
            if isinstance(deps_info, dict):
                if 'dependencies' in deps_info:
                    total_deps += len(deps_info['dependencies'])
                if 'dev_dependencies' in deps_info:
                    total_deps += len(deps_info['dev_dependencies'])
        
        # Placeholder calculations (would be replaced with real security checks)
        if total_deps > 0:
            vulnerability_count = max(0, total_deps // 20)  # Mock: ~5% of deps have vulnerabilities
            outdated_count = max(0, total_deps // 10)      # Mock: ~10% of deps are outdated
            license_issues = max(0, total_deps // 50)      # Mock: ~2% of deps have license issues
        
        return {
            "vulnerability_count": vulnerability_count,
            "outdated_count": outdated_count,
            "license_issues": license_issues,
            "total_dependencies_analyzed": total_deps,
            "analysis_type": "placeholder",
            "note": "This is a placeholder security analysis. Real implementation would check against vulnerability databases."
        }
        
    except Exception as e:
        logger.error(f"Error in security analysis: {e}")
        return {
            "vulnerability_count": 0,
            "outdated_count": 0,
            "license_issues": 0,
            "total_dependencies_analyzed": 0,
            "analysis_type": "error",
            "error": str(e)
        }

    @mcp.tool()
    def security_audit(file_path: str) -> Dict[str, Any]:
        """Perform comprehensive security audit on a file.
        
        Scans for common security issues including:
        - Hardcoded passwords, API keys, and secrets
        - Dangerous function calls (eval, exec, shell commands)
        - Weak file permissions
        - Path traversal vulnerabilities
        - Returns security score and recommendations
        
        Args:
            file_path: Path to the file to audit
        """
        try:
            global security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("security_audit")
            if not rate_ok:
                security_manager.log_audit_event(
                    "security_audit", "security_audit", file_path, 
                    success=False, error_message=rate_msg
                )
                return {
                    "success": False,
                    "error": rate_msg,
                    "security_score": 0,
                    "issues": [],
                    "recommendations": []
                }
            
            # Validate path
            path_ok, path_msg = security_manager.validate_path(file_path, "read")
            if not path_ok:
                security_manager.log_audit_event(
                    "security_audit", "security_audit", file_path, 
                    success=False, error_message=path_msg
                )
                return {
                    "success": False,
                    "error": path_msg,
                    "security_score": 0,
                    "issues": [],
                    "recommendations": []
                }
            
            # Perform security audit
            audit_result = security_manager.audit_file_security(file_path)
            
            # Log successful audit
            security_manager.log_audit_event(
                "security_audit", "security_audit", file_path, 
                success=True, additional_data={
                    "security_score": audit_result.security_score,
                    "issues_count": len(audit_result.issues)
                }
            )
            
            # Convert SecurityIssue objects to dictionaries for JSON serialization
            issues_data = []
            for issue in audit_result.issues:
                issues_data.append({
                    "severity": issue.severity,
                    "category": issue.category,
                    "line_number": issue.line_number,
                    "description": issue.description,
                    "recommendation": issue.recommendation,
                    "context": issue.context
                })
            
            return {
                "success": True,
                "file_path": audit_result.file_path,
                "security_score": audit_result.security_score,
                "issues": issues_data,
                "recommendations": audit_result.recommendations,
                "scan_timestamp": audit_result.scan_timestamp.isoformat(),
                "summary": {
                    "total_issues": len(audit_result.issues),
                    "critical_issues": len([i for i in audit_result.issues if i.severity == "critical"]),
                    "high_issues": len([i for i in audit_result.issues if i.severity == "high"]),
                    "medium_issues": len([i for i in audit_result.issues if i.severity == "medium"]),
                    "low_issues": len([i for i in audit_result.issues if i.severity == "low"])
                }
            }
            
        except Exception as e:
            logger.error(f"Error in security audit: {e}")
            security_manager.log_audit_event(
                "security_audit", "security_audit", file_path, 
                success=False, error_message=str(e)
            )
            return {
                "success": False,
                "error": f"Security audit failed: {str(e)}",
                "security_score": 0,
                "issues": [],
                "recommendations": []
            }

    @mcp.tool()
    def get_security_summary() -> Dict[str, Any]:
        """Get security audit summary and statistics.
        
        Returns comprehensive security information including:
        - Audit log summary
        - Rate limit status
        - Security configuration
        - Recent security events
        """
        try:
            global security_manager
            
            audit_summary = security_manager.get_audit_summary()
            
            # Get rate limit status
            rate_limit_status = {}
            for tool_name, rate_info in security_manager.rate_limits.items():
                rate_limit_status[tool_name] = {
                    "limit": rate_info.limit,
                    "window_seconds": rate_info.window_seconds,
                    "current_requests": len(rate_info.requests),
                    "blocked_until": rate_info.blocked_until.isoformat() if rate_info.blocked_until else None
                }
            
            return {
                "success": True,
                "audit_summary": audit_summary,
                "rate_limit_status": rate_limit_status,
                "security_config": {
                    "allowed_extensions": list(security_manager.allowed_extensions),
                    "dangerous_functions_count": len(security_manager.dangerous_functions),
                    "secret_patterns_count": len(security_manager.secret_patterns)
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting security summary: {e}")
            return {
                "success": False,
                "error": f"Failed to get security summary: {str(e)}"
            }

    @mcp.tool()
    def validate_configuration() -> Dict[str, Any]:
        """Validate the current MCP configuration with comprehensive checks.
        
        Performs detailed validation of:
        - Directory paths and accessibility
        - Security settings
        - File size limits
        - Exclude patterns
        - Configuration format and values
        
        Returns validation results with detailed error messages.
        """
        try:
            global config_manager, security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("validate_configuration")
            if not rate_ok:
                return {
                    "success": False,
                    "error": rate_msg,
                    "validation_passed": False,
                    "errors": []
                }
            
            validation_errors = []
            warnings = []
            
            try:
                # Run the comprehensive validation
                config_manager._validate_config()
                validation_passed = True
                
            except ValueError as e:
                validation_passed = False
                # Parse the detailed error message
                error_lines = str(e).split('\n')[1:]  # Skip the first line "Configuration validation failed:"
                validation_errors = [line.strip(' -') for line in error_lines if line.strip()]
            
            # Additional security-specific validations
            try:
                # Check if security manager is properly initialized
                if not security_manager:
                    validation_errors.append("Security manager not initialized")
                
                # Validate rate limit configuration
                for tool_name, rate_info in security_manager.rate_limits.items():
                    if rate_info.limit <= 0:
                        validation_errors.append(f"Invalid rate limit for {tool_name}: {rate_info.limit}")
                    if rate_info.window_seconds <= 0:
                        validation_errors.append(f"Invalid rate limit window for {tool_name}: {rate_info.window_seconds}")
                
                # Check security configuration
                if len(security_manager.allowed_extensions) == 0:
                    warnings.append("No allowed file extensions configured")
                
                if len(security_manager.dangerous_functions) == 0:
                    warnings.append("No dangerous functions configured for detection")
                
                if len(security_manager.secret_patterns) == 0:
                    warnings.append("No secret patterns configured for detection")
                
            except Exception as e:
                validation_errors.append(f"Security validation error: {str(e)}")
            
            # Log validation attempt
            security_manager.log_audit_event(
                "validate_configuration", "validate_configuration", None,
                success=validation_passed,
                additional_data={
                    "error_count": len(validation_errors),
                    "warning_count": len(warnings)
                }
            )
            
            return {
                "success": True,
                "validation_passed": validation_passed,
                "errors": validation_errors,
                "warnings": warnings,
                "config_summary": {
                    "total_directories": len(config_manager.config.watched_directories),
                    "enabled_directories": len([d for d in config_manager.config.watched_directories if d.enabled]),
                    "security_mode": config_manager.config.security_mode,
                    "audit_logging_enabled": config_manager.config.audit_logging,
                    "max_file_size": config_manager.config.max_file_size,
                    "global_exclude_patterns": len(config_manager.config.global_exclude_patterns)
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error validating configuration: {e}")
            return {
                "success": False,
                "error": f"Configuration validation failed: {str(e)}",
                "validation_passed": False,
                "errors": [str(e)],
                "warnings": []
            }

    @mcp.tool()
    def get_privilege_status() -> Dict[str, Any]:
        """Get current privilege and security status.
        
        Returns information about:
        - Read-only mode status
        - Privilege level
        - User permissions
        - Security recommendations
        """
        try:
            global security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("get_privilege_status")
            if not rate_ok:
                return {
                    "success": False,
                    "error": rate_msg
                }
            
            status = security_manager.get_privilege_status()
            
            # Log the request
            security_manager.log_audit_event(
                "get_privilege_status", "get_privilege_status", None,
                success=True
            )
            
            return {
                "success": True,
                "privilege_status": status,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting privilege status: {e}")
            return {
                "success": False,
                "error": f"Failed to get privilege status: {str(e)}"
            }

    @mcp.tool()
    def set_read_only_mode(enabled: bool) -> Dict[str, Any]:
        """Enable or disable read-only mode.
        
        When enabled, all write operations (create, modify, delete) will be blocked.
        This provides an additional layer of security for production environments.
        
        Args:
            enabled: True to enable read-only mode, False to disable
        """
        try:
            global security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("set_read_only_mode")
            if not rate_ok:
                return {
                    "success": False,
                    "error": rate_msg
                }
            
            success = security_manager.set_read_only_mode(enabled)
            
            if success:
                return {
                    "success": True,
                    "read_only_mode": enabled,
                    "message": f"Read-only mode {'enabled' if enabled else 'disabled'} successfully",
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to change read-only mode",
                    "read_only_mode": security_manager.read_only_mode
                }
            
        except Exception as e:
            logger.error(f"Error setting read-only mode: {e}")
            return {
                "success": False,
                "error": f"Failed to set read-only mode: {str(e)}"
            }

    @mcp.tool()
    def security_scan_directory(directory: str = ".", max_files: int = 100) -> Dict[str, Any]:
        """Perform security scan on all files in a directory.
        
        Scans multiple files for security issues including:
        - Hardcoded secrets and credentials
        - Dangerous function calls
        - Weak file permissions
        - Path traversal vulnerabilities
        
        Args:
            directory: Directory to scan (defaults to current directory)
            max_files: Maximum number of files to scan (default: 100)
        """
        try:
            global security_manager
            
            # Check rate limit
            rate_ok, rate_msg = security_manager.check_rate_limit("security_scan_directory")
            if not rate_ok:
                return {
                    "success": False,
                    "error": rate_msg,
                    "scanned_files": 0,
                    "security_issues": []
                }
            
            # Validate directory path
            path_ok, path_msg = security_manager.validate_path(directory, "read")
            if not path_ok:
                return {
                    "success": False,
                    "error": path_msg,
                    "scanned_files": 0,
                    "security_issues": []
                }
            
            # Get list of files to scan
            try:
                directory_path = Path(directory)
                files_to_scan = []
                
                for file_path in directory_path.rglob("*"):
                    if file_path.is_file() and len(files_to_scan) < max_files:
                        # Check if file extension is allowed
                        if file_path.suffix.lower() in security_manager.allowed_extensions:
                            files_to_scan.append(str(file_path))
                
                if not files_to_scan:
                    return {
                        "success": True,
                        "message": "No files found to scan",
                        "scanned_files": 0,
                        "security_issues": [],
                        "directory": directory
                    }
                
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Failed to enumerate files: {str(e)}",
                    "scanned_files": 0,
                    "security_issues": []
                }
            
            # Scan files for security issues
            all_issues = []
            scanned_count = 0
            
            for file_path in files_to_scan:
                try:
                    audit_result = security_manager.audit_file_security(file_path)
                    scanned_count += 1
                    
                    if audit_result.issues:
                        for issue in audit_result.issues:
                            all_issues.append({
                                "file_path": issue.file_path,
                                "severity": issue.severity,
                                "category": issue.category,
                                "line_number": issue.line_number,
                                "description": issue.description,
                                "recommendation": issue.recommendation,
                                "context": issue.context
                            })
                
                except Exception as e:
                    logger.warning(f"Failed to scan file {file_path}: {e}")
                    continue
            
            # Calculate overall security score
            if scanned_count > 0:
                total_critical = len([i for i in all_issues if i["severity"] == "critical"])
                total_high = len([i for i in all_issues if i["severity"] == "high"])
                total_medium = len([i for i in all_issues if i["severity"] == "medium"])
                total_low = len([i for i in all_issues if i["severity"] == "low"])
                
                overall_score = max(0, 100 - (total_critical * 25 + total_high * 15 + total_medium * 10 + total_low * 5))
            else:
                overall_score = 0
            
            # Log the scan
            security_manager.log_audit_event(
                "security_scan_directory", "security_scan_directory", directory,
                success=True,
                additional_data={
                    "scanned_files": scanned_count,
                    "total_issues": len(all_issues),
                    "overall_score": overall_score
                }
            )
            
            return {
                "success": True,
                "directory": directory,
                "scanned_files": scanned_count,
                "total_issues": len(all_issues),
                "overall_security_score": overall_score,
                "security_issues": all_issues,
                "summary": {
                    "critical_issues": len([i for i in all_issues if i["severity"] == "critical"]),
                    "high_issues": len([i for i in all_issues if i["severity"] == "high"]),
                    "medium_issues": len([i for i in all_issues if i["severity"] == "medium"]),
                    "low_issues": len([i for i in all_issues if i["severity"] == "low"])
                },
                "scan_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in security scan: {e}")
            security_manager.log_audit_event(
                "security_scan_directory", "security_scan_directory", directory,
                success=False, error_message=str(e)
            )
            return {
                "success": False,
                "error": f"Security scan failed: {str(e)}",
                "scanned_files": 0,
                "security_issues": []
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
