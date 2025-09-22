#!/usr/bin/env python3
"""
Optimized Startup Sequence for MCP Server

This module provides lazy loading, optimal initialization order, health checks,
and graceful shutdown for the enhanced MCP server.
"""

import os
import sys
import time
import threading
import logging
import signal
import atexit
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import traceback
from datetime import datetime
import weakref

logger = logging.getLogger(__name__)

class ComponentStatus(Enum):
    """Status of startup components"""
    NOT_STARTED = "not_started"
    STARTING = "starting"
    RUNNING = "running"
    FAILED = "failed"
    STOPPING = "stopping"
    STOPPED = "stopped"

class HealthStatus(Enum):
    """Health status levels"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CRITICAL = "critical"

@dataclass
class ComponentInfo:
    """Information about a startup component"""
    name: str
    status: ComponentStatus = ComponentStatus.NOT_STARTED
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    error_message: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)
    priority: int = 0  # Lower numbers start first
    is_critical: bool = True
    health_check: Optional[Callable] = None
    cleanup_function: Optional[Callable] = None

@dataclass
class HealthCheckResult:
    """Result of a health check"""
    status: HealthStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

class LazyLoader:
    """Lazy loading system for heavy dependencies"""
    
    def __init__(self):
        self._loaded_modules: Dict[str, Any] = {}
        self._loading_locks: Dict[str, threading.Lock] = {}
        self._loading_functions: Dict[str, Callable] = {}
    
    def register_loader(self, name: str, loader_function: Callable):
        """Register a lazy loader function"""
        self._loading_functions[name] = loader_function
        self._loading_locks[name] = threading.Lock()
    
    def get(self, name: str) -> Any:
        """Get a lazily loaded module/object"""
        if name in self._loaded_modules:
            return self._loaded_modules[name]
        
        if name not in self._loading_functions:
            raise ValueError(f"No loader registered for: {name}")
        
        with self._loading_locks[name]:
            # Double-check after acquiring lock
            if name in self._loaded_modules:
                return self._loaded_modules[name]
            
            try:
                logger.info(f"Lazy loading {name}...")
                start_time = time.time()
                self._loaded_modules[name] = self._loading_functions[name]()
                elapsed = time.time() - start_time
                logger.info(f"Successfully loaded {name} in {elapsed:.2f}s")
                return self._loaded_modules[name]
            except Exception as e:
                logger.error(f"Failed to load {name}: {e}")
                raise
    
    def is_loaded(self, name: str) -> bool:
        """Check if a module is already loaded"""
        return name in self._loaded_modules
    
    def preload(self, names: List[str]):
        """Preload multiple modules in parallel"""
        threads = []
        for name in names:
            if not self.is_loaded(name):
                thread = threading.Thread(target=self.get, args=(name,), daemon=True)
                thread.start()
                threads.append(thread)
        
        # Wait for all to complete
        for thread in threads:
            thread.join(timeout=30)  # 30 second timeout per module

class StartupManager:
    """Manages the startup sequence with optimal ordering and health checks"""
    
    def __init__(self):
        self.components: Dict[str, ComponentInfo] = {}
        self.startup_order: List[str] = []
        self._lock = threading.RLock()
        self._startup_complete = False
        self._shutdown_initiated = False
        self._health_check_interval = 30  # seconds
        self._health_check_thread: Optional[threading.Thread] = None
        self._health_check_stop = threading.Event()
        self.lazy_loader = LazyLoader()
        
        # Register cleanup handlers
        atexit.register(self._cleanup_on_exit)
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        if hasattr(signal, 'SIGBREAK'):  # Windows
            signal.signal(signal.SIGBREAK, self._signal_handler)
    
    def register_component(self, name: str, dependencies: List[str] = None,
                          priority: int = 0, is_critical: bool = True,
                          health_check: Callable = None, cleanup_function: Callable = None):
        """Register a component for startup management"""
        with self._lock:
            self.components[name] = ComponentInfo(
                name=name,
                dependencies=dependencies or [],
                priority=priority,
                is_critical=is_critical,
                health_check=health_check,
                cleanup_function=cleanup_function
            )
            logger.debug(f"Registered component: {name}")
    
    def register_lazy_loader(self, name: str, loader_function: Callable):
        """Register a lazy loader for heavy dependencies"""
        self.lazy_loader.register_loader(name, loader_function)
        logger.debug(f"Registered lazy loader: {name}")
    
    def _calculate_startup_order(self) -> List[str]:
        """Calculate optimal startup order based on dependencies and priorities"""
        # Create a copy of components for processing
        remaining = {name: comp for name, comp in self.components.items()}
        ordered = []
        
        while remaining:
            # Find components with no unmet dependencies
            ready = []
            for name, comp in remaining.items():
                if all(dep in ordered for dep in comp.dependencies):
                    ready.append((name, comp))
            
            if not ready:
                # Circular dependency or missing dependency
                remaining_names = list(remaining.keys())
                logger.error(f"Circular dependency or missing dependency detected: {remaining_names}")
                # Add remaining components in priority order
                ready = [(name, comp) for name, comp in remaining.items()]
            
            # Sort by priority (lower numbers first)
            ready.sort(key=lambda x: x[1].priority)
            
            # Add the first ready component
            name, comp = ready[0]
            ordered.append(name)
            del remaining[name]
        
        return ordered
    
    def start_components(self) -> Dict[str, Any]:
        """Start all registered components in optimal order"""
        with self._lock:
            if self._startup_complete:
                logger.warning("Startup already completed")
                return self._get_startup_summary()
            
            logger.info("Starting MCP server components...")
            start_time = time.time()
            
            # Calculate startup order
            self.startup_order = self._calculate_startup_order()
            logger.info(f"Startup order: {self.startup_order}")
            
            # Start components
            failed_components = []
            for component_name in self.startup_order:
                try:
                    self._start_component(component_name)
                except Exception as e:
                    component = self.components[component_name]
                    if component.is_critical:
                        logger.error(f"Critical component {component_name} failed to start: {e}")
                        failed_components.append(component_name)
                        # Stop already started components
                        self._stop_started_components()
                        break
                    else:
                        logger.warning(f"Non-critical component {component_name} failed to start: {e}")
            
            # Mark startup as complete if no critical failures
            if not failed_components:
                self._startup_complete = True
                self._start_health_monitoring()
                elapsed = time.time() - start_time
                logger.info(f"Startup completed successfully in {elapsed:.2f}s")
            else:
                logger.error(f"Startup failed due to critical component failures: {failed_components}")
            
            return self._get_startup_summary()
    
    def _start_component(self, component_name: str):
        """Start a specific component"""
        component = self.components[component_name]
        component.status = ComponentStatus.STARTING
        component.start_time = time.time()
        
        logger.info(f"Starting component: {component_name}")
        
        try:
            # The actual component startup is handled by the main server
            # This is just for tracking and health monitoring
            component.status = ComponentStatus.RUNNING
            component.end_time = time.time()
            
            elapsed = component.end_time - component.start_time
            logger.info(f"Component {component_name} started in {elapsed:.2f}s")
            
        except Exception as e:
            component.status = ComponentStatus.FAILED
            component.error_message = str(e)
            component.end_time = time.time()
            logger.error(f"Component {component_name} failed to start: {e}")
            raise
    
    def _stop_started_components(self):
        """Stop all successfully started components"""
        logger.info("Stopping started components due to startup failure...")
        
        # Stop in reverse order
        for component_name in reversed(self.startup_order):
            component = self.components[component_name]
            if component.status == ComponentStatus.RUNNING:
                self._stop_component(component_name)
    
    def _stop_component(self, component_name: str):
        """Stop a specific component"""
        component = self.components[component_name]
        component.status = ComponentStatus.STOPPING
        
        logger.info(f"Stopping component: {component_name}")
        
        try:
            if component.cleanup_function:
                component.cleanup_function()
            
            component.status = ComponentStatus.STOPPED
            logger.info(f"Component {component_name} stopped successfully")
            
        except Exception as e:
            logger.error(f"Error stopping component {component_name}: {e}")
            component.status = ComponentStatus.FAILED
            component.error_message = str(e)
    
    def _start_health_monitoring(self):
        """Start background health monitoring"""
        if self._health_check_thread and self._health_check_thread.is_alive():
            return
        
        self._health_check_stop.clear()
        self._health_check_thread = threading.Thread(
            target=self._health_monitoring_loop, 
            daemon=True
        )
        self._health_check_thread.start()
        logger.info("Health monitoring started")
    
    def _health_monitoring_loop(self):
        """Background health monitoring loop"""
        while not self._health_check_stop.wait(self._health_check_interval):
            try:
                self._perform_health_checks()
            except Exception as e:
                logger.error(f"Error in health monitoring: {e}")
    
    def _perform_health_checks(self):
        """Perform health checks on all components"""
        with self._lock:
            for component_name, component in self.components.items():
                if component.status == ComponentStatus.RUNNING and component.health_check:
                    try:
                        result = component.health_check()
                        if isinstance(result, HealthCheckResult):
                            if result.status in [HealthStatus.UNHEALTHY, HealthStatus.CRITICAL]:
                                logger.warning(f"Health check failed for {component_name}: {result.message}")
                    except Exception as e:
                        logger.error(f"Health check error for {component_name}: {e}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get overall health status"""
        with self._lock:
            component_statuses = {}
            overall_status = HealthStatus.HEALTHY
            
            for name, component in self.components.items():
                if component.status == ComponentStatus.RUNNING:
                    if component.health_check:
                        try:
                            result = component.health_check()
                            if isinstance(result, HealthCheckResult):
                                component_statuses[name] = {
                                    "status": result.status.value,
                                    "message": result.message,
                                    "details": result.details
                                }
                                
                                # Update overall status
                                if result.status == HealthStatus.CRITICAL:
                                    overall_status = HealthStatus.CRITICAL
                                elif result.status == HealthStatus.UNHEALTHY and overall_status != HealthStatus.CRITICAL:
                                    overall_status = HealthStatus.UNHEALTHY
                                elif result.status == HealthStatus.DEGRADED and overall_status == HealthStatus.HEALTHY:
                                    overall_status = HealthStatus.DEGRADED
                            else:
                                component_statuses[name] = {"status": "unknown", "message": "Invalid health check result"}
                        except Exception as e:
                            component_statuses[name] = {"status": "error", "message": str(e)}
                            overall_status = HealthStatus.DEGRADED
                    else:
                        component_statuses[name] = {"status": "no_health_check", "message": "No health check defined"}
                else:
                    component_statuses[name] = {"status": component.status.value, "message": "Component not running"}
            
            return {
                "overall_status": overall_status.value,
                "components": component_statuses,
                "timestamp": datetime.now().isoformat()
            }
    
    def graceful_shutdown(self, timeout: float = 30.0):
        """Perform graceful shutdown of all components"""
        with self._lock:
            if self._shutdown_initiated:
                logger.warning("Shutdown already initiated")
                return
            
            self._shutdown_initiated = True
            logger.info("Initiating graceful shutdown...")
            
            # Stop health monitoring
            self._health_check_stop.set()
            if self._health_check_thread:
                self._health_check_thread.join(timeout=5)
            
            # Stop components in reverse order
            shutdown_start = time.time()
            for component_name in reversed(self.startup_order):
                component = self.components[component_name]
                if component.status == ComponentStatus.RUNNING:
                    self._stop_component(component_name)
                
                # Check timeout
                if time.time() - shutdown_start > timeout:
                    logger.warning(f"Shutdown timeout reached, forcing shutdown")
                    break
            
            logger.info("Graceful shutdown completed")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.graceful_shutdown()
        sys.exit(0)
    
    def _cleanup_on_exit(self):
        """Cleanup on program exit"""
        if not self._shutdown_initiated:
            logger.info("Program exiting, performing cleanup...")
            self.graceful_shutdown(timeout=5.0)
    
    def _get_startup_summary(self) -> Dict[str, Any]:
        """Get a summary of startup status"""
        with self._lock:
            summary = {
                "startup_complete": self._startup_complete,
                "shutdown_initiated": self._shutdown_initiated,
                "components": {}
            }
            
            for name, component in self.components.items():
                summary["components"][name] = {
                    "status": component.status.value,
                    "start_time": component.start_time,
                    "end_time": component.end_time,
                    "duration": (component.end_time - component.start_time) if component.end_time and component.start_time else None,
                    "error_message": component.error_message,
                    "is_critical": component.is_critical
                }
            
            return summary

# Global startup manager instance
startup_manager = StartupManager()

def register_startup_component(name: str, dependencies: List[str] = None,
                              priority: int = 0, is_critical: bool = True,
                              health_check: Callable = None, cleanup_function: Callable = None):
    """Register a component for startup management"""
    startup_manager.register_component(name, dependencies, priority, is_critical, health_check, cleanup_function)

def register_lazy_loader(name: str, loader_function: Callable):
    """Register a lazy loader for heavy dependencies"""
    startup_manager.register_lazy_loader(name, loader_function)

def start_components() -> Dict[str, Any]:
    """Start all registered components"""
    return startup_manager.start_components()

def get_health_status() -> Dict[str, Any]:
    """Get overall health status"""
    return startup_manager.get_health_status()

def graceful_shutdown(timeout: float = 30.0):
    """Perform graceful shutdown"""
    startup_manager.graceful_shutdown(timeout)

def lazy_load(name: str) -> Any:
    """Lazy load a module/object"""
    return startup_manager.lazy_loader.get(name)

def preload_modules(names: List[str]):
    """Preload multiple modules in parallel"""
    startup_manager.lazy_loader.preload(names)

# Health check functions for common components
def config_health_check() -> HealthCheckResult:
    """Health check for configuration system"""
    try:
        from enhanced_config_system import enhanced_config_manager
        if enhanced_config_manager.config:
            return HealthCheckResult(HealthStatus.HEALTHY, "Configuration system is healthy")
        else:
            return HealthCheckResult(HealthStatus.UNHEALTHY, "No configuration loaded")
    except Exception as e:
        return HealthCheckResult(HealthStatus.CRITICAL, f"Configuration system error: {e}")

def performance_health_check() -> HealthCheckResult:
    """Health check for performance monitoring"""
    try:
        import psutil
        memory_usage = psutil.virtual_memory().percent
        cpu_usage = psutil.cpu_percent(interval=1)
        
        if memory_usage > 90:
            return HealthCheckResult(HealthStatus.CRITICAL, f"High memory usage: {memory_usage}%")
        elif memory_usage > 80:
            return HealthCheckResult(HealthStatus.UNHEALTHY, f"Elevated memory usage: {memory_usage}%")
        elif cpu_usage > 90:
            return HealthCheckResult(HealthStatus.DEGRADED, f"High CPU usage: {cpu_usage}%")
        else:
            return HealthCheckResult(HealthStatus.HEALTHY, f"System resources normal (CPU: {cpu_usage}%, Memory: {memory_usage}%)")
    except Exception as e:
        return HealthCheckResult(HealthStatus.DEGRADED, f"Performance monitoring error: {e}")

def file_system_health_check() -> HealthCheckResult:
    """Health check for file system access"""
    try:
        # Test write access to temp directory
        import tempfile
        with tempfile.NamedTemporaryFile(delete=True) as f:
            f.write(b"health_check")
        
        return HealthCheckResult(HealthStatus.HEALTHY, "File system access is healthy")
    except Exception as e:
        return HealthCheckResult(HealthStatus.CRITICAL, f"File system access error: {e}")

# Initialize common health checks
register_startup_component("config_system", priority=1, is_critical=True, health_check=config_health_check)
register_startup_component("performance_monitor", priority=2, is_critical=False, health_check=performance_health_check)
register_startup_component("file_system", priority=1, is_critical=True, health_check=file_system_health_check)
