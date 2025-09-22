#!/usr/bin/env python3
"""
Enhanced Error Handling and Progress Tracking for MCP Server

This module provides comprehensive error handling, user-friendly error messages,
and progress indicators for long-running operations in the MCP server.
"""

import os
import sys
import time
import threading
import logging
from typing import Dict, Any, Optional, List, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import traceback
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class ErrorSeverity(Enum):
    """Error severity levels for better categorization"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class OperationType(Enum):
    """Types of operations for progress tracking"""
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    DIRECTORY_SCAN = "directory_scan"
    CODE_INDEXING = "code_indexing"
    GIT_OPERATION = "git_operation"
    SEARCH_OPERATION = "search_operation"
    SECURITY_SCAN = "security_scan"
    CONFIG_LOAD = "config_load"
    CACHE_OPERATION = "cache_operation"

@dataclass
class ErrorContext:
    """Context information for errors"""
    operation: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    user_action: Optional[str] = None
    system_info: Optional[Dict[str, Any]] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

@dataclass
class ProgressInfo:
    """Progress information for long-running operations"""
    operation_id: str
    operation_type: OperationType
    total_items: int
    completed_items: int = 0
    current_item: Optional[str] = None
    start_time: float = field(default_factory=time.time)
    estimated_completion: Optional[float] = None
    status_message: str = "Starting..."
    percentage: float = 0.0
    is_cancellable: bool = False
    error_count: int = 0
    warning_count: int = 0

class ProgressTracker:
    """Thread-safe progress tracking for long-running operations"""
    
    def __init__(self):
        self._active_operations: Dict[str, ProgressInfo] = {}
        self._lock = threading.RLock()
        self._callbacks: List[Callable[[ProgressInfo], None]] = []
    
    def start_operation(self, operation_id: str, operation_type: OperationType, 
                       total_items: int, status_message: str = "Starting...",
                       is_cancellable: bool = False) -> ProgressInfo:
        """Start tracking a new operation"""
        with self._lock:
            progress = ProgressInfo(
                operation_id=operation_id,
                operation_type=operation_type,
                total_items=total_items,
                status_message=status_message,
                is_cancellable=is_cancellable
            )
            self._active_operations[operation_id] = progress
            self._notify_callbacks(progress)
            logger.info(f"Started operation {operation_id}: {status_message}")
            return progress
    
    def update_progress(self, operation_id: str, completed_items: int = None,
                       current_item: str = None, status_message: str = None,
                       error_count: int = None, warning_count: int = None):
        """Update progress for an operation"""
        with self._lock:
            if operation_id not in self._active_operations:
                logger.warning(f"Attempted to update non-existent operation: {operation_id}")
                return
            
            progress = self._active_operations[operation_id]
            
            if completed_items is not None:
                progress.completed_items = completed_items
                progress.percentage = (completed_items / progress.total_items) * 100
                
                # Estimate completion time
                if completed_items > 0:
                    elapsed = time.time() - progress.start_time
                    rate = completed_items / elapsed
                    remaining = progress.total_items - completed_items
                    progress.estimated_completion = time.time() + (remaining / rate)
            
            if current_item is not None:
                progress.current_item = current_item
            
            if status_message is not None:
                progress.status_message = status_message
            
            if error_count is not None:
                progress.error_count = error_count
            
            if warning_count is not None:
                progress.warning_count = warning_count
            
            self._notify_callbacks(progress)
    
    def complete_operation(self, operation_id: str, status_message: str = "Completed"):
        """Mark an operation as completed"""
        with self._lock:
            if operation_id in self._active_operations:
                progress = self._active_operations[operation_id]
                progress.completed_items = progress.total_items
                progress.percentage = 100.0
                progress.status_message = status_message
                progress.estimated_completion = time.time()
                
                self._notify_callbacks(progress)
                del self._active_operations[operation_id]
                
                elapsed = time.time() - progress.start_time
                logger.info(f"Completed operation {operation_id} in {elapsed:.2f}s")
    
    def cancel_operation(self, operation_id: str):
        """Cancel an operation"""
        with self._lock:
            if operation_id in self._active_operations:
                progress = self._active_operations[operation_id]
                progress.status_message = "Cancelled"
                self._notify_callbacks(progress)
                del self._active_operations[operation_id]
                logger.info(f"Cancelled operation {operation_id}")
    
    def get_active_operations(self) -> List[ProgressInfo]:
        """Get all active operations"""
        with self._lock:
            return list(self._active_operations.values())
    
    def add_callback(self, callback: Callable[[ProgressInfo], None]):
        """Add a callback for progress updates"""
        with self._lock:
            self._callbacks.append(callback)
    
    def _notify_callbacks(self, progress: ProgressInfo):
        """Notify all callbacks of progress updates"""
        for callback in self._callbacks:
            try:
                callback(progress)
            except Exception as e:
                logger.error(f"Error in progress callback: {e}")

class EnhancedErrorHandler:
    """Enhanced error handling with user-friendly messages and context"""
    
    def __init__(self):
        self.error_counts: Dict[str, int] = {}
        self.recent_errors: List[Dict[str, Any]] = []
        self.max_recent_errors = 100
    
    def handle_error(self, error: Exception, context: ErrorContext, 
                    severity: ErrorSeverity = ErrorSeverity.MEDIUM) -> Dict[str, Any]:
        """Handle an error with enhanced context and user-friendly messages"""
        
        # Generate user-friendly error message
        user_message = self._generate_user_message(error, context, severity)
        
        # Create error record
        error_record = {
            "timestamp": context.timestamp,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "user_message": user_message,
            "severity": severity.value,
            "context": {
                "operation": context.operation,
                "file_path": context.file_path,
                "line_number": context.line_number,
                "user_action": context.user_action
            },
            "system_info": context.system_info or {},
            "traceback": traceback.format_exc()
        }
        
        # Update error counts
        error_key = f"{type(error).__name__}:{context.operation}"
        self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
        
        # Store recent errors
        self.recent_errors.append(error_record)
        if len(self.recent_errors) > self.max_recent_errors:
            self.recent_errors.pop(0)
        
        # Log based on severity
        if severity == ErrorSeverity.CRITICAL:
            logger.critical(f"CRITICAL ERROR in {context.operation}: {user_message}")
        elif severity == ErrorSeverity.HIGH:
            logger.error(f"HIGH SEVERITY ERROR in {context.operation}: {user_message}")
        elif severity == ErrorSeverity.MEDIUM:
            logger.warning(f"MEDIUM SEVERITY ERROR in {context.operation}: {user_message}")
        else:
            logger.info(f"LOW SEVERITY ERROR in {context.operation}: {user_message}")
        
        return error_record
    
    def _generate_user_message(self, error: Exception, context: ErrorContext, 
                              severity: ErrorSeverity) -> str:
        """Generate user-friendly error messages"""
        
        error_type = type(error).__name__
        operation = context.operation
        
        # File operation errors
        if isinstance(error, FileNotFoundError):
            if context.file_path:
                return f"File not found: {Path(context.file_path).name}. Please check if the file exists and you have access to it."
            return "The requested file could not be found. Please verify the file path and try again."
        
        elif isinstance(error, PermissionError):
            if context.file_path:
                return f"Permission denied accessing {Path(context.file_path).name}. Please check your file permissions or run with appropriate privileges."
            return "Permission denied. Please check your file permissions or contact your administrator."
        
        elif isinstance(error, IsADirectoryError):
            return f"Expected a file but found a directory: {Path(context.file_path).name}. Please specify a file path instead."
        
        elif isinstance(error, NotADirectoryError):
            return f"Expected a directory but found a file: {Path(context.file_path).name}. Please specify a directory path instead."
        
        # Network errors
        elif isinstance(error, ConnectionError):
            return "Network connection failed. Please check your internet connection and try again."
        
        elif isinstance(error, TimeoutError):
            return f"Operation timed out. The {operation} took too long to complete. Please try again or contact support if the issue persists."
        
        # Configuration errors
        elif "config" in operation.lower():
            return f"Configuration error in {operation}. Please check your configuration file and ensure all required settings are present."
        
        # Search and indexing errors
        elif "search" in operation.lower() or "index" in operation.lower():
            return f"Search/indexing error in {operation}. The operation may have been interrupted or encountered invalid data."
        
        # Git operation errors
        elif "git" in operation.lower():
            return f"Git operation failed in {operation}. Please ensure you're in a valid Git repository and have the necessary permissions."
        
        # Memory errors
        elif isinstance(error, MemoryError):
            return "Insufficient memory to complete the operation. Please try with a smaller dataset or increase available memory."
        
        # Generic errors with context
        else:
            if context.user_action:
                return f"An error occurred while {context.user_action}. {str(error)}"
            else:
                return f"An unexpected error occurred in {operation}: {str(error)}"
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get a summary of recent errors"""
        return {
            "total_errors": len(self.recent_errors),
            "error_counts": self.error_counts,
            "recent_errors": self.recent_errors[-10:],  # Last 10 errors
            "severity_breakdown": self._get_severity_breakdown()
        }
    
    def _get_severity_breakdown(self) -> Dict[str, int]:
        """Get breakdown of errors by severity"""
        breakdown = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for error in self.recent_errors:
            severity = error.get("severity", "medium")
            if severity in breakdown:
                breakdown[severity] += 1
        return breakdown

class OperationTimeout:
    """Context manager for operation timeouts with progress tracking"""
    
    def __init__(self, timeout_seconds: float, operation_id: str, 
                 progress_tracker: ProgressTracker):
        self.timeout_seconds = timeout_seconds
        self.operation_id = operation_id
        self.progress_tracker = progress_tracker
        self.start_time = None
        self._cancelled = False
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is TimeoutError:
            self.progress_tracker.cancel_operation(self.operation_id)
            return True  # Suppress the exception
    
    def check_timeout(self):
        """Check if operation has timed out"""
        if time.time() - self.start_time > self.timeout_seconds:
            raise TimeoutError(f"Operation {self.operation_id} timed out after {self.timeout_seconds} seconds")

def with_progress_tracking(operation_type: OperationType, 
                          progress_tracker: ProgressTracker,
                          timeout_seconds: float = 300):
    """Decorator for adding progress tracking to operations"""
    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            operation_id = f"{func.__name__}_{int(time.time())}"
            
            # Start progress tracking
            progress = progress_tracker.start_operation(
                operation_id=operation_id,
                operation_type=operation_type,
                total_items=kwargs.get('total_items', 1),
                status_message=f"Starting {func.__name__}...",
                is_cancellable=True
            )
            
            try:
                with OperationTimeout(timeout_seconds, operation_id, progress_tracker):
                    result = func(*args, **kwargs)
                    progress_tracker.complete_operation(operation_id, "Completed successfully")
                    return result
                    
            except Exception as e:
                progress_tracker.complete_operation(operation_id, f"Failed: {str(e)}")
                raise
        
        return wrapper
    return decorator

def with_enhanced_error_handling(operation_name: str, 
                                error_handler: EnhancedErrorHandler,
                                severity: ErrorSeverity = ErrorSeverity.MEDIUM):
    """Decorator for enhanced error handling"""
    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Create error context
                context = ErrorContext(
                    operation=operation_name,
                    file_path=args[0] if args and isinstance(args[0], str) else None,
                    user_action=f"Calling {func.__name__}",
                    system_info={
                        "function": func.__name__,
                        "args_count": len(args),
                        "kwargs": list(kwargs.keys())
                    }
                )
                
                # Handle the error
                error_record = error_handler.handle_error(e, context, severity)
                
                # Re-raise with user-friendly message
                raise type(e)(error_record["user_message"]) from e
        
        return wrapper
    return decorator

# Global instances
progress_tracker = ProgressTracker()
error_handler = EnhancedErrorHandler()

def get_progress_summary() -> Dict[str, Any]:
    """Get a summary of current progress and errors"""
    active_operations = progress_tracker.get_active_operations()
    error_summary = error_handler.get_error_summary()
    
    return {
        "active_operations": [
            {
                "id": op.operation_id,
                "type": op.operation_type.value,
                "progress": f"{op.percentage:.1f}%",
                "status": op.status_message,
                "current_item": op.current_item,
                "estimated_completion": op.estimated_completion,
                "errors": op.error_count,
                "warnings": op.warning_count
            }
            for op in active_operations
        ],
        "error_summary": error_summary,
        "timestamp": datetime.now().isoformat()
    }

def log_operation_start(operation_name: str, details: Dict[str, Any] = None):
    """Log the start of an operation with details"""
    logger.info(f"Starting {operation_name}" + (f": {details}" if details else ""))
    return time.time()

def log_operation_complete(operation_name: str, start_time: float, 
                          details: Dict[str, Any] = None):
    """Log the completion of an operation with timing"""
    elapsed = time.time() - start_time
    logger.info(f"Completed {operation_name} in {elapsed:.2f}s" + 
                (f": {details}" if details else ""))

def create_user_friendly_error(error: Exception, context: str = None) -> str:
    """Create a user-friendly error message"""
    if isinstance(error, FileNotFoundError):
        return "The requested file or directory could not be found. Please check the path and try again."
    elif isinstance(error, PermissionError):
        return "You don't have permission to access this file or directory. Please check your permissions."
    elif isinstance(error, TimeoutError):
        return "The operation took too long to complete. Please try again or contact support if the issue persists."
    elif isinstance(error, MemoryError):
        return "The operation requires more memory than is available. Please try with a smaller dataset."
    elif isinstance(error, ConnectionError):
        return "Network connection failed. Please check your internet connection and try again."
    else:
        base_message = str(error) if str(error) else "An unexpected error occurred."
        if context:
            return f"Error in {context}: {base_message}"
        return base_message
