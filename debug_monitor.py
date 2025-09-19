#!/usr/bin/env python3
"""
MCP Integration Debug Monitor
=============================

This tool provides comprehensive debugging and monitoring capabilities for
the MCP integration between Python server and Node.js backend. It includes:

- Real-time request/response logging
- Network timing measurements
- Error tracking and reporting
- Connection status monitoring
- Performance metrics collection
- Debug session management

Usage:
    python debug_monitor.py [--backend-url URL] [--port PORT] [--verbose]
"""

import asyncio
import json
import logging
import time
import uuid
import argparse
import sys
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
from collections import defaultdict, deque
import signal
import os

import aiohttp
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('debug_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class RequestLog:
    """Request log entry"""
    id: str
    timestamp: str
    method: str
    url: str
    headers: Dict[str, str]
    data: Optional[Dict] = None
    response_status: Optional[int] = None
    response_headers: Optional[Dict[str, str]] = None
    response_data: Optional[Dict] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None

@dataclass
class PerformanceMetrics:
    """Performance metrics"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    average_response_time_ms: float = 0.0
    min_response_time_ms: float = 0.0
    max_response_time_ms: float = 0.0
    requests_per_second: float = 0.0
    error_rate: float = 0.0
    last_updated: str = None

@dataclass
class ConnectionStatus:
    """Connection status information"""
    backend_url: str
    is_connected: bool
    last_check: str
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None

class MCPDebugMonitor:
    """Main debug monitor class"""
    
    def __init__(self, backend_url: str = "http://localhost:3000", port: int = 8080, verbose: bool = False):
        self.backend_url = backend_url.rstrip('/')
        self.port = port
        self.verbose = verbose
        self.is_running = False
        
        # Data storage
        self.request_logs: deque = deque(maxlen=1000)  # Keep last 1000 requests
        self.performance_metrics = PerformanceMetrics()
        self.connection_status = ConnectionStatus(
            backend_url=self.backend_url,
            is_connected=False,
            last_check=datetime.now().isoformat()
        )
        
        # Statistics
        self.stats = {
            'requests_by_endpoint': defaultdict(int),
            'requests_by_status': defaultdict(int),
            'errors_by_type': defaultdict(int),
            'response_times': deque(maxlen=100),
            'hourly_stats': defaultdict(lambda: {'requests': 0, 'errors': 0, 'avg_response_time': 0})
        }
        
        # Session for HTTP requests
        self.session = self._create_session()
        
        # Monitoring thread
        self.monitor_thread = None
        self.stop_event = threading.Event()
        
        logger.info(f"Initialized MCP Debug Monitor")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Monitor Port: {self.port}")

    def _create_session(self) -> requests.Session:
        """Create a requests session with retry strategy"""
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Set default headers
        session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'MCP-Debug-Monitor/1.0'
        })
        
        return session

    def _log_request(self, request_log: RequestLog):
        """Log a request"""
        self.request_logs.append(request_log)
        
        # Update statistics
        self.stats['requests_by_endpoint'][request_log.url] += 1
        if request_log.response_status:
            self.stats['requests_by_status'][request_log.response_status] += 1
        
        if request_log.error:
            self.stats['errors_by_type'][request_log.error] += 1
        
        if request_log.duration_ms:
            self.stats['response_times'].append(request_log.duration_ms)
        
        # Update hourly stats
        hour = datetime.now().strftime('%Y-%m-%d %H:00')
        self.stats['hourly_stats'][hour]['requests'] += 1
        if request_log.error:
            self.stats['hourly_stats'][hour]['errors'] += 1
        if request_log.duration_ms:
            current_avg = self.stats['hourly_stats'][hour]['avg_response_time']
            count = self.stats['hourly_stats'][hour]['requests']
            self.stats['hourly_stats'][hour]['avg_response_time'] = (
                (current_avg * (count - 1) + request_log.duration_ms) / count
            )
        
        # Update performance metrics
        self._update_performance_metrics()
        
        if self.verbose:
            self._print_request_log(request_log)

    def _print_request_log(self, request_log: RequestLog):
        """Print request log to console"""
        status = "✓" if request_log.response_status and request_log.response_status < 400 else "✗"
        duration = f"{request_log.duration_ms:.2f}ms" if request_log.duration_ms else "N/A"
        
        print(f"{status} {request_log.method} {request_log.url} -> {request_log.response_status} ({duration})")
        
        if request_log.error:
            print(f"  Error: {request_log.error}")
        
        if self.verbose and request_log.data:
            print(f"  Request: {json.dumps(request_log.data, indent=2)}")
        
        if self.verbose and request_log.response_data:
            print(f"  Response: {json.dumps(request_log.response_data, indent=2)}")

    def _update_performance_metrics(self):
        """Update performance metrics"""
        total_requests = len(self.request_logs)
        successful_requests = sum(1 for log in self.request_logs if log.response_status and log.response_status < 400)
        failed_requests = total_requests - successful_requests
        
        response_times = [log.duration_ms for log in self.request_logs if log.duration_ms is not None]
        
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = min_response_time = max_response_time = 0.0
        
        # Calculate requests per second (last minute)
        now = datetime.now()
        recent_requests = [
            log for log in self.request_logs 
            if datetime.fromisoformat(log.timestamp) > now - timedelta(minutes=1)
        ]
        requests_per_second = len(recent_requests) / 60.0 if recent_requests else 0.0
        
        error_rate = (failed_requests / total_requests * 100) if total_requests > 0 else 0.0
        
        self.performance_metrics = PerformanceMetrics(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            average_response_time_ms=avg_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            requests_per_second=requests_per_second,
            error_rate=error_rate,
            last_updated=datetime.now().isoformat()
        )

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    headers: Optional[Dict] = None) -> RequestLog:
        """Make HTTP request with detailed logging"""
        request_id = str(uuid.uuid4())
        url = f"{self.backend_url}{endpoint}"
        timestamp = datetime.now().isoformat()
        
        # Create request log
        request_log = RequestLog(
            id=request_id,
            timestamp=timestamp,
            method=method,
            url=url,
            headers=dict(self.session.headers)
        )
        
        if data:
            request_log.data = data
        if headers:
            request_log.headers.update(headers)
        
        # Make request
        start_time = time.time()
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                headers=headers,
                timeout=30
            )
            
            duration_ms = (time.time() - start_time) * 1000
            
            request_log.response_status = response.status_code
            request_log.response_headers = dict(response.headers)
            request_log.duration_ms = duration_ms
            
            try:
                request_log.response_data = response.json()
            except:
                request_log.response_data = {"text": response.text[:500]}
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            request_log.duration_ms = duration_ms
            request_log.error = str(e)
        
        # Log the request
        self._log_request(request_log)
        
        return request_log

    def check_connection(self) -> ConnectionStatus:
        """Check backend connection status"""
        start_time = time.time()
        try:
            response = self.session.get(f"{self.backend_url}/api/health", timeout=10)
            duration_ms = (time.time() - start_time) * 1000
            
            self.connection_status = ConnectionStatus(
                backend_url=self.backend_url,
                is_connected=response.status_code == 200,
                last_check=datetime.now().isoformat(),
                response_time_ms=duration_ms,
                error_message=None
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            
            self.connection_status = ConnectionStatus(
                backend_url=self.backend_url,
                is_connected=False,
                last_check=datetime.now().isoformat(),
                response_time_ms=duration_ms,
                error_message=str(e)
            )
        
        return self.connection_status

    def run_connection_monitor(self):
        """Run connection monitoring in background thread"""
        while not self.stop_event.is_set():
            try:
                self.check_connection()
                time.sleep(5)  # Check every 5 seconds
            except Exception as e:
                logger.error(f"Connection monitor error: {e}")
                time.sleep(5)

    def start_monitoring(self):
        """Start the debug monitor"""
        if self.is_running:
            logger.warning("Monitor is already running")
            return
        
        self.is_running = True
        self.stop_event.clear()
        
        # Start connection monitoring thread
        self.monitor_thread = threading.Thread(target=self.run_connection_monitor, daemon=True)
        self.monitor_thread.start()
        
        logger.info("Debug monitor started")
        logger.info("Press Ctrl+C to stop")

    def stop_monitoring(self):
        """Stop the debug monitor"""
        if not self.is_running:
            return
        
        self.is_running = False
        self.stop_event.set()
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        logger.info("Debug monitor stopped")

    def get_status_report(self) -> Dict[str, Any]:
        """Get comprehensive status report"""
        return {
            "connection_status": asdict(self.connection_status),
            "performance_metrics": asdict(self.performance_metrics),
            "statistics": {
                "requests_by_endpoint": dict(self.stats['requests_by_endpoint']),
                "requests_by_status": dict(self.stats['requests_by_status']),
                "errors_by_type": dict(self.stats['errors_by_type']),
                "hourly_stats": dict(self.stats['hourly_stats'])
            },
            "recent_requests": [asdict(log) for log in list(self.request_logs)[-10:]],  # Last 10 requests
            "timestamp": datetime.now().isoformat()
        }

    def save_debug_session(self, filename: str = None):
        """Save debug session data"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"debug_session_{timestamp}.json"
        
        session_data = {
            "session_info": {
                "backend_url": self.backend_url,
                "start_time": datetime.now().isoformat(),
                "total_requests": len(self.request_logs)
            },
            "connection_status": asdict(self.connection_status),
            "performance_metrics": asdict(self.performance_metrics),
            "statistics": {
                "requests_by_endpoint": dict(self.stats['requests_by_endpoint']),
                "requests_by_status": dict(self.stats['requests_by_status']),
                "errors_by_type": dict(self.stats['errors_by_type']),
                "hourly_stats": dict(self.stats['hourly_stats'])
            },
            "request_logs": [asdict(log) for log in self.request_logs],
            "timestamp": datetime.now().isoformat()
        }
        
        with open(filename, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        logger.info(f"Debug session saved to: {filename}")
        return filename

    def print_status(self):
        """Print current status to console"""
        print("\n" + "=" * 60)
        print("MCP DEBUG MONITOR STATUS")
        print("=" * 60)
        
        # Connection status
        status_icon = "✓" if self.connection_status.is_connected else "✗"
        print(f"Backend Connection: {status_icon} {self.connection_status.backend_url}")
        print(f"Last Check: {self.connection_status.last_check}")
        if self.connection_status.response_time_ms:
            print(f"Response Time: {self.connection_status.response_time_ms:.2f}ms")
        if self.connection_status.error_message:
            print(f"Error: {self.connection_status.error_message}")
        
        # Performance metrics
        print(f"\nPerformance Metrics:")
        print(f"  Total Requests: {self.performance_metrics.total_requests}")
        print(f"  Successful: {self.performance_metrics.successful_requests}")
        print(f"  Failed: {self.performance_metrics.failed_requests}")
        print(f"  Error Rate: {self.performance_metrics.error_rate:.2f}%")
        print(f"  Avg Response Time: {self.performance_metrics.average_response_time_ms:.2f}ms")
        print(f"  Requests/Second: {self.performance_metrics.requests_per_second:.2f}")
        
        # Recent requests
        print(f"\nRecent Requests:")
        for log in list(self.request_logs)[-5:]:  # Last 5 requests
            status_icon = "✓" if log.response_status and log.response_status < 400 else "✗"
            duration = f"{log.duration_ms:.2f}ms" if log.duration_ms else "N/A"
            print(f"  {status_icon} {log.method} {log.url} -> {log.response_status} ({duration})")
        
        print("=" * 60)

    def interactive_mode(self):
        """Run interactive debug mode"""
        self.start_monitoring()
        
        print("\nMCP Debug Monitor - Interactive Mode")
        print("Commands:")
        print("  status - Show current status")
        print("  test <endpoint> - Test an endpoint")
        print("  save - Save debug session")
        print("  quit - Exit monitor")
        print()
        
        try:
            while self.is_running:
                try:
                    command = input("debug> ").strip().split()
                    
                    if not command:
                        continue
                    
                    cmd = command[0].lower()
                    
                    if cmd == "quit" or cmd == "exit":
                        break
                    elif cmd == "status":
                        self.print_status()
                    elif cmd == "test":
                        if len(command) < 2:
                            print("Usage: test <endpoint>")
                            continue
                        endpoint = command[1]
                        print(f"Testing endpoint: {endpoint}")
                        result = self.make_request("GET", endpoint)
                        print(f"Result: {result.response_status} ({result.duration_ms:.2f}ms)")
                    elif cmd == "save":
                        filename = self.save_debug_session()
                        print(f"Debug session saved to: {filename}")
                    else:
                        print(f"Unknown command: {cmd}")
                
                except KeyboardInterrupt:
                    break
                except EOFError:
                    break
                except Exception as e:
                    print(f"Error: {e}")
        
        finally:
            self.stop_monitoring()

def signal_handler(signum, frame):
    """Handle interrupt signals"""
    print("\nShutting down debug monitor...")
    sys.exit(0)

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="MCP Integration Debug Monitor")
    parser.add_argument("--backend-url", default="http://localhost:3000", 
                       help="Backend URL (default: http://localhost:3000)")
    parser.add_argument("--port", type=int, default=8080, 
                       help="Monitor port (default: 8080)")
    parser.add_argument("--verbose", "-v", action="store_true", 
                       help="Enable verbose logging")
    parser.add_argument("--interactive", "-i", action="store_true", 
                       help="Run in interactive mode")
    parser.add_argument("--save-session", help="Save debug session to file")
    
    args = parser.parse_args()
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create monitor instance
    monitor = MCPDebugMonitor(
        backend_url=args.backend_url,
        port=args.port,
        verbose=args.verbose
    )
    
    try:
        if args.interactive:
            monitor.interactive_mode()
        else:
            # Run basic monitoring
            monitor.start_monitoring()
            
            # Keep running until interrupted
            while monitor.is_running:
                time.sleep(1)
        
    except KeyboardInterrupt:
        logger.info("Monitor interrupted by user")
    except Exception as e:
        logger.error(f"Monitor failed: {e}")
    finally:
        monitor.stop_monitoring()
        
        if args.save_session:
            monitor.save_debug_session(args.save_session)

if __name__ == "__main__":
    main()
