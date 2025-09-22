#!/usr/bin/env python3
"""
Comprehensive Logging System for MCP Server

This module provides advanced logging with usage statistics, performance metrics,
log rotation, and cleanup for the enhanced MCP server.
"""

import os
import sys
import json
import time
import threading
import logging
import logging.handlers
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, field, asdict
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, deque
import traceback
import gzip
import shutil

logger = logging.getLogger(__name__)

@dataclass
class UsageMetrics:
    """Usage metrics for tracking feature usage"""
    operation_count: int = 0
    total_execution_time: float = 0.0
    average_execution_time: float = 0.0
    min_execution_time: float = float('inf')
    max_execution_time: float = 0.0
    error_count: int = 0
    success_count: int = 0
    last_used: Optional[str] = None
    peak_memory_usage: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0

@dataclass
class PerformanceMetrics:
    """Performance metrics for monitoring"""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0
    active_operations: int = 0
    cache_hit_rate: float = 0.0
    average_response_time: float = 0.0
    error_rate: float = 0.0
    throughput_ops_per_second: float = 0.0

@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: str
    level: str
    logger_name: str
    message: str
    operation: Optional[str] = None
    execution_time: Optional[float] = None
    memory_usage: Optional[float] = None
    error_details: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None

class UsageTracker:
    """Tracks usage statistics for all operations"""
    
    def __init__(self, max_history: int = 1000):
        self.metrics: Dict[str, UsageMetrics] = defaultdict(UsageMetrics)
        self.history: deque = deque(maxlen=max_history)
        self._lock = threading.RLock()
        self._start_time = time.time()
    
    def record_operation(self, operation_name: str, execution_time: float, 
                        success: bool, memory_usage: float = 0.0,
                        cache_hit: bool = False, error_details: Dict[str, Any] = None):
        """Record an operation for usage tracking"""
        with self._lock:
            metrics = self.metrics[operation_name]
            
            # Update basic metrics
            metrics.operation_count += 1
            metrics.total_execution_time += execution_time
            metrics.average_execution_time = metrics.total_execution_time / metrics.operation_count
            metrics.min_execution_time = min(metrics.min_execution_time, execution_time)
            metrics.max_execution_time = max(metrics.max_execution_time, execution_time)
            metrics.last_used = datetime.now().isoformat()
            metrics.peak_memory_usage = max(metrics.peak_memory_usage, memory_usage)
            
            if cache_hit:
                metrics.cache_hits += 1
            else:
                metrics.cache_misses += 1
            
            if success:
                metrics.success_count += 1
            else:
                metrics.error_count += 1
            
            # Add to history
            self.history.append({
                "timestamp": datetime.now().isoformat(),
                "operation": operation_name,
                "execution_time": execution_time,
                "success": success,
                "memory_usage": memory_usage,
                "cache_hit": cache_hit,
                "error_details": error_details
            })
    
    def get_usage_summary(self) -> Dict[str, Any]:
        """Get a summary of usage statistics"""
        with self._lock:
            uptime = time.time() - self._start_time
            
            # Calculate overall statistics
            total_operations = sum(m.operation_count for m in self.metrics.values())
            total_errors = sum(m.error_count for m in self.metrics.values())
            total_success = sum(m.success_count for m in self.metrics.values())
            
            # Most used operations
            most_used = sorted(
                [(name, metrics.operation_count) for name, metrics in self.metrics.items()],
                key=lambda x: x[1], reverse=True
            )[:10]
            
            # Slowest operations
            slowest = sorted(
                [(name, metrics.average_execution_time) for name, metrics in self.metrics.items()],
                key=lambda x: x[1], reverse=True
            )[:10]
            
            # Operations with most errors
            error_prone = sorted(
                [(name, metrics.error_count) for name, metrics in self.metrics.items()],
                key=lambda x: x[1], reverse=True
            )[:10]
            
            return {
                "uptime_seconds": uptime,
                "total_operations": total_operations,
                "total_errors": total_errors,
                "total_success": total_success,
                "error_rate": (total_errors / total_operations * 100) if total_operations > 0 else 0,
                "throughput_ops_per_second": total_operations / uptime if uptime > 0 else 0,
                "most_used_operations": most_used,
                "slowest_operations": slowest,
                "error_prone_operations": error_prone,
                "detailed_metrics": {
                    name: asdict(metrics) for name, metrics in self.metrics.items()
                }
            }

class PerformanceMonitor:
    """Monitors system performance metrics"""
    
    def __init__(self, collection_interval: float = 30.0):
        self.collection_interval = collection_interval
        self.metrics_history: deque = deque(maxlen=1000)
        self._lock = threading.RLock()
        self._monitoring = False
        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
    
    def start_monitoring(self):
        """Start performance monitoring"""
        if self._monitoring:
            return
        
        self._monitoring = True
        self._stop_event.clear()
        self._monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self._monitor_thread.start()
        logger.info("Performance monitoring started")
    
    def stop_monitoring(self):
        """Stop performance monitoring"""
        if not self._monitoring:
            return
        
        self._monitoring = False
        self._stop_event.set()
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        logger.info("Performance monitoring stopped")
    
    def _monitoring_loop(self):
        """Background monitoring loop"""
        while not self._stop_event.wait(self.collection_interval):
            try:
                metrics = self._collect_metrics()
                with self._lock:
                    self.metrics_history.append(metrics)
            except Exception as e:
                logger.error(f"Error collecting performance metrics: {e}")
    
    def _collect_metrics(self) -> PerformanceMetrics:
        """Collect current performance metrics"""
        try:
            import psutil
            
            # System metrics
            memory_info = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Process metrics
            process = psutil.Process()
            process_memory = process.memory_info().rss / 1024 / 1024  # MB
            
            # Calculate derived metrics
            active_operations = len([t for t in threading.enumerate() if t.is_alive()])
            
            return PerformanceMetrics(
                memory_usage_mb=process_memory,
                cpu_usage_percent=cpu_percent,
                active_operations=active_operations,
                cache_hit_rate=self._calculate_cache_hit_rate(),
                average_response_time=self._calculate_average_response_time(),
                error_rate=self._calculate_error_rate(),
                throughput_ops_per_second=self._calculate_throughput()
            )
        except ImportError:
            # Fallback if psutil not available
            return PerformanceMetrics(
                memory_usage_mb=0.0,
                cpu_usage_percent=0.0,
                active_operations=len(threading.enumerate()),
                cache_hit_rate=0.0,
                average_response_time=0.0,
                error_rate=0.0,
                throughput_ops_per_second=0.0
            )
    
    def _calculate_cache_hit_rate(self) -> float:
        """Calculate cache hit rate from usage tracker"""
        try:
            from comprehensive_logging import usage_tracker
            with usage_tracker._lock:
                total_hits = sum(m.cache_hits for m in usage_tracker.metrics.values())
                total_misses = sum(m.cache_misses for m in usage_tracker.metrics.values())
                total_requests = total_hits + total_misses
                return (total_hits / total_requests * 100) if total_requests > 0 else 0.0
        except:
            return 0.0
    
    def _calculate_average_response_time(self) -> float:
        """Calculate average response time from usage tracker"""
        try:
            from comprehensive_logging import usage_tracker
            with usage_tracker._lock:
                total_time = sum(m.total_execution_time for m in usage_tracker.metrics.values())
                total_ops = sum(m.operation_count for m in usage_tracker.metrics.values())
                return total_time / total_ops if total_ops > 0 else 0.0
        except:
            return 0.0
    
    def _calculate_error_rate(self) -> float:
        """Calculate error rate from usage tracker"""
        try:
            from comprehensive_logging import usage_tracker
            with usage_tracker._lock:
                total_errors = sum(m.error_count for m in usage_tracker.metrics.values())
                total_ops = sum(m.operation_count for m in usage_tracker.metrics.values())
                return (total_errors / total_ops * 100) if total_ops > 0 else 0.0
        except:
            return 0.0
    
    def _calculate_throughput(self) -> float:
        """Calculate operations per second"""
        try:
            from comprehensive_logging import usage_tracker
            with usage_tracker._lock:
                uptime = time.time() - usage_tracker._start_time
                total_ops = sum(m.operation_count for m in usage_tracker.metrics.values())
                return total_ops / uptime if uptime > 0 else 0.0
        except:
            return 0.0
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get a summary of performance metrics"""
        with self._lock:
            if not self.metrics_history:
                return {"error": "No performance data available"}
            
            recent_metrics = list(self.metrics_history)[-10:]  # Last 10 measurements
            
            # Calculate averages
            avg_memory = sum(m.memory_usage_mb for m in recent_metrics) / len(recent_metrics)
            avg_cpu = sum(m.cpu_usage_percent for m in recent_metrics) / len(recent_metrics)
            avg_operations = sum(m.active_operations for m in recent_metrics) / len(recent_metrics)
            avg_cache_hit_rate = sum(m.cache_hit_rate for m in recent_metrics) / len(recent_metrics)
            avg_response_time = sum(m.average_response_time for m in recent_metrics) / len(recent_metrics)
            avg_error_rate = sum(m.error_rate for m in recent_metrics) / len(recent_metrics)
            avg_throughput = sum(m.throughput_ops_per_second for m in recent_metrics) / len(recent_metrics)
            
            return {
                "monitoring_active": self._monitoring,
                "collection_interval": self.collection_interval,
                "data_points": len(self.metrics_history),
                "averages": {
                    "memory_usage_mb": avg_memory,
                    "cpu_usage_percent": avg_cpu,
                    "active_operations": avg_operations,
                    "cache_hit_rate": avg_cache_hit_rate,
                    "average_response_time": avg_response_time,
                    "error_rate": avg_error_rate,
                    "throughput_ops_per_second": avg_throughput
                },
                "latest_metrics": asdict(recent_metrics[-1]) if recent_metrics else None,
                "trends": self._calculate_trends(recent_metrics)
            }
    
    def _calculate_trends(self, metrics: List[PerformanceMetrics]) -> Dict[str, str]:
        """Calculate trends for performance metrics"""
        if len(metrics) < 2:
            return {}
        
        trends = {}
        
        # Memory trend
        memory_start = metrics[0].memory_usage_mb
        memory_end = metrics[-1].memory_usage_mb
        if memory_end > memory_start * 1.1:
            trends["memory"] = "increasing"
        elif memory_end < memory_start * 0.9:
            trends["memory"] = "decreasing"
        else:
            trends["memory"] = "stable"
        
        # CPU trend
        cpu_start = metrics[0].cpu_usage_percent
        cpu_end = metrics[-1].cpu_usage_percent
        if cpu_end > cpu_start + 10:
            trends["cpu"] = "increasing"
        elif cpu_end < cpu_start - 10:
            trends["cpu"] = "decreasing"
        else:
            trends["cpu"] = "stable"
        
        return trends

class StructuredLogger:
    """Enhanced logger with structured logging and performance tracking"""
    
    def __init__(self, name: str, log_file: Optional[str] = None, 
                 max_file_size_mb: int = 10, backup_count: int = 5):
        self.name = name
        self.logger = logging.getLogger(name)
        self.log_file = log_file
        self.max_file_size_mb = max_file_size_mb
        self.backup_count = backup_count
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup the logger with appropriate handlers"""
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)
        
        # File handler with rotation
        if self.log_file:
            file_handler = logging.handlers.RotatingFileHandler(
                self.log_file,
                maxBytes=self.max_file_size_mb * 1024 * 1024,
                backupCount=self.backup_count
            )
            file_handler.setLevel(logging.DEBUG)
            file_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
        
        self.logger.setLevel(logging.DEBUG)
    
    def log_operation(self, level: str, message: str, operation: str = None,
                     execution_time: float = None, memory_usage: float = None,
                     error_details: Dict[str, Any] = None, context: Dict[str, Any] = None):
        """Log an operation with structured data"""
        
        # Create structured log entry
        log_entry = LogEntry(
            timestamp=datetime.now().isoformat(),
            level=level.upper(),
            logger_name=self.name,
            message=message,
            operation=operation,
            execution_time=execution_time,
            memory_usage=memory_usage,
            error_details=error_details,
            context=context
        )
        
        # Format message with additional context
        formatted_message = message
        if operation:
            formatted_message = f"[{operation}] {formatted_message}"
        if execution_time is not None:
            formatted_message += f" (took {execution_time:.3f}s)"
        if memory_usage is not None:
            formatted_message += f" (memory: {memory_usage:.1f}MB)"
        
        # Log with appropriate level
        log_level = getattr(logging, level.upper(), logging.INFO)
        self.logger.log(log_level, formatted_message)
        
        # Log structured data to file if available
        if self.log_file and log_level >= logging.DEBUG:
            structured_log_file = self.log_file.replace('.log', '_structured.jsonl')
            try:
                with open(structured_log_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(asdict(log_entry)) + '\n')
            except Exception as e:
                self.logger.error(f"Failed to write structured log: {e}")

class LogManager:
    """Manages all logging components and log rotation"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.loggers: Dict[str, StructuredLogger] = {}
        self.usage_tracker = UsageTracker()
        self.performance_monitor = PerformanceMonitor()
        self._log_rotation_thread: Optional[threading.Thread] = None
        self._rotation_stop_event = threading.Event()
        
        # Setup main logger
        self._setup_main_logger()
        
        # Start performance monitoring
        self.performance_monitor.start_monitoring()
        
        # Start log rotation if enabled
        if self.config.get('log_rotation', True):
            self._start_log_rotation()
    
    def _setup_main_logger(self):
        """Setup the main application logger"""
        log_config = self.config.get('logging', {})
        
        main_logger = StructuredLogger(
            name='mcp_server',
            log_file=log_config.get('file_path'),
            max_file_size_mb=log_config.get('max_file_size_mb', 10),
            backup_count=log_config.get('backup_count', 5)
        )
        
        self.loggers['main'] = main_logger
    
    def get_logger(self, name: str) -> StructuredLogger:
        """Get or create a logger for a specific component"""
        if name not in self.loggers:
            self.loggers[name] = StructuredLogger(name)
        return self.loggers[name]
    
    def _start_log_rotation(self):
        """Start background log rotation"""
        self._rotation_stop_event.clear()
        self._log_rotation_thread = threading.Thread(
            target=self._log_rotation_loop, 
            daemon=True
        )
        self._log_rotation_thread.start()
        logger.info("Log rotation started")
    
    def _log_rotation_loop(self):
        """Background log rotation loop"""
        rotation_interval = self.config.get('log_rotation_interval', 3600)  # 1 hour
        
        while not self._rotation_stop_event.wait(rotation_interval):
            try:
                self._rotate_logs()
            except Exception as e:
                logger.error(f"Error in log rotation: {e}")
    
    def _rotate_logs(self):
        """Rotate and compress old logs"""
        log_dir = Path(self.config.get('log_directory', '.'))
        
        for log_file in log_dir.glob('*.log.*'):
            if log_file.suffix == '.1':  # Only compress the first backup
                compressed_file = log_file.with_suffix('.log.1.gz')
                if not compressed_file.exists():
                    try:
                        with open(log_file, 'rb') as f_in:
                            with gzip.open(compressed_file, 'wb') as f_out:
                                shutil.copyfileobj(f_in, f_out)
                        log_file.unlink()  # Remove original after compression
                        logger.debug(f"Compressed log file: {log_file}")
                    except Exception as e:
                        logger.error(f"Failed to compress log file {log_file}: {e}")
    
    def cleanup_old_logs(self, days_to_keep: int = 30):
        """Clean up old log files"""
        log_dir = Path(self.config.get('log_directory', '.'))
        cutoff_time = time.time() - (days_to_keep * 24 * 3600)
        
        cleaned_count = 0
        for log_file in log_dir.glob('*.log*'):
            if log_file.stat().st_mtime < cutoff_time:
                try:
                    log_file.unlink()
                    cleaned_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete old log file {log_file}: {e}")
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} old log files")
    
    def get_logging_summary(self) -> Dict[str, Any]:
        """Get a summary of logging status and statistics"""
        return {
            "loggers": list(self.loggers.keys()),
            "usage_summary": self.usage_tracker.get_usage_summary(),
            "performance_summary": self.performance_monitor.get_performance_summary(),
            "log_rotation_active": self._log_rotation_thread is not None and self._log_rotation_thread.is_alive(),
            "config": self.config
        }
    
    def shutdown(self):
        """Shutdown logging system"""
        logger.info("Shutting down logging system...")
        
        # Stop performance monitoring
        self.performance_monitor.stop_monitoring()
        
        # Stop log rotation
        self._rotation_stop_event.set()
        if self._log_rotation_thread:
            self._log_rotation_thread.join(timeout=5)
        
        # Cleanup old logs
        self.cleanup_old_logs()
        
        logger.info("Logging system shutdown complete")

# Global instances
usage_tracker = UsageTracker()
performance_monitor = PerformanceMonitor()
log_manager = LogManager()

def get_logger(name: str) -> StructuredLogger:
    """Get a logger for a specific component"""
    return log_manager.get_logger(name)

def record_operation(operation_name: str, execution_time: float, success: bool,
                   memory_usage: float = 0.0, cache_hit: bool = False,
                   error_details: Dict[str, Any] = None):
    """Record an operation for usage tracking"""
    usage_tracker.record_operation(operation_name, execution_time, success, 
                                 memory_usage, cache_hit, error_details)

def get_usage_summary() -> Dict[str, Any]:
    """Get usage statistics summary"""
    return usage_tracker.get_usage_summary()

def get_performance_summary() -> Dict[str, Any]:
    """Get performance metrics summary"""
    return performance_monitor.get_performance_summary()

def get_logging_summary() -> Dict[str, Any]:
    """Get comprehensive logging summary"""
    return log_manager.get_logging_summary()

def cleanup_logs(days_to_keep: int = 30):
    """Clean up old log files"""
    log_manager.cleanup_old_logs(days_to_keep)

def shutdown_logging():
    """Shutdown the logging system"""
    log_manager.shutdown()
