#!/usr/bin/env python3
"""
MCP Performance Benchmark Suite
===============================

This script provides comprehensive performance benchmarking for the MCP
integration between Python server and Node.js backend. It includes:

- Load testing with concurrent requests
- Response time analysis
- Throughput measurement
- Memory usage monitoring
- Error rate analysis
- Performance regression detection
- Detailed reporting and visualization

Usage:
    python performance_benchmark.py [--backend-url URL] [--concurrent N] [--duration S]
"""

import asyncio
import aiohttp
import json
import time
import statistics
import argparse
import sys
import psutil
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import uuid
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class BenchmarkResult:
    """Individual benchmark result"""
    request_id: str
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    success: bool
    error_message: Optional[str] = None
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()

@dataclass
class PerformanceMetrics:
    """Performance metrics summary"""
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time_ms: float
    median_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    requests_per_second: float
    error_rate_percent: float
    throughput_mbps: float
    memory_usage_mb: float
    cpu_usage_percent: float
    duration_seconds: float

@dataclass
class LoadTestConfig:
    """Load test configuration"""
    concurrent_users: int
    duration_seconds: int
    ramp_up_seconds: int
    ramp_down_seconds: int
    target_endpoints: List[str]
    request_interval_ms: int

class MCPPerformanceBenchmark:
    """Main performance benchmark class"""
    
    def __init__(self, backend_url: str = "http://localhost:3000", verbose: bool = False):
        self.backend_url = backend_url.rstrip('/')
        self.verbose = verbose
        self.results: List[BenchmarkResult] = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        
        # System monitoring
        self.process = psutil.Process()
        self.memory_samples: List[float] = []
        self.cpu_samples: List[float] = []
        
        # Test data
        self.test_license_key = "TEST-LICENSE-KEY-12345"
        self.test_server_id = f"benchmark-server-{uuid.uuid4().hex[:8]}"
        
        logger.info(f"Initialized MCP Performance Benchmark")
        logger.info(f"Backend URL: {self.backend_url}")

    def _log_result(self, result: BenchmarkResult):
        """Log a benchmark result"""
        self.results.append(result)
        
        if self.verbose:
            status = "✓" if result.success else "✗"
            logger.info(f"{status} {result.method} {result.endpoint} -> {result.status_code} ({result.response_time_ms:.2f}ms)")

    def _sample_system_metrics(self):
        """Sample system metrics"""
        try:
            memory_mb = self.process.memory_info().rss / 1024 / 1024
            cpu_percent = self.process.cpu_percent()
            
            self.memory_samples.append(memory_mb)
            self.cpu_samples.append(cpu_percent)
            
        except Exception as e:
            logger.warning(f"Failed to sample system metrics: {e}")

    async def _make_request(self, session: aiohttp.ClientSession, endpoint: str, 
                           method: str = "GET", data: Optional[Dict] = None) -> BenchmarkResult:
        """Make a single HTTP request"""
        request_id = str(uuid.uuid4())
        url = f"{self.backend_url}{endpoint}"
        
        start_time = time.time()
        
        try:
            async with session.request(method, url, json=data) as response:
                response_time_ms = (time.time() - start_time) * 1000
                
                # Read response body
                try:
                    response_data = await response.json()
                except:
                    response_data = await response.text()
                
                result = BenchmarkResult(
                    request_id=request_id,
                    endpoint=endpoint,
                    method=method,
                    status_code=response.status,
                    response_time_ms=response_time_ms,
                    success=200 <= response.status < 400,
                    timestamp=datetime.now().isoformat()
                )
                
                self._log_result(result)
                return result
                
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            
            result = BenchmarkResult(
                request_id=request_id,
                endpoint=endpoint,
                method=method,
                status_code=0,
                response_time_ms=response_time_ms,
                success=False,
                error_message=str(e),
                timestamp=datetime.now().isoformat()
            )
            
            self._log_result(result)
            return result

    async def _worker(self, session: aiohttp.ClientSession, config: LoadTestConfig, 
                     stop_event: asyncio.Event):
        """Worker coroutine for load testing"""
        endpoints = config.target_endpoints
        request_count = 0
        
        while not stop_event.is_set():
            try:
                # Select endpoint (round-robin)
                endpoint = endpoints[request_count % len(endpoints)]
                
                # Prepare request data based on endpoint
                data = None
                if endpoint == "/api/auth/validate-license":
                    data = {
                        "licenseKey": self.test_license_key,
                        "serverId": f"{self.test_server_id}-{request_count}",
                        "serverName": f"Benchmark Server {request_count}",
                        "serverVersion": "1.0.0"
                    }
                elif endpoint == "/api/analytics/track":
                    data = {
                        "licenseKey": self.test_license_key,
                        "serverId": f"{self.test_server_id}-{request_count}",
                        "events": [
                            {
                                "eventType": "REQUEST_COUNT",
                                "eventData": {"count": 1, "endpoint": endpoint},
                                "metadata": {"benchmark": True},
                                "timestamp": datetime.now().isoformat()
                            }
                        ]
                    }
                
                # Make request
                await self._make_request(session, endpoint, "POST" if data else "GET", data)
                request_count += 1
                
                # Wait between requests
                if config.request_interval_ms > 0:
                    await asyncio.sleep(config.request_interval_ms / 1000.0)
                    
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(1)

    async def run_load_test(self, config: LoadTestConfig) -> PerformanceMetrics:
        """Run load test with given configuration"""
        logger.info(f"Starting load test with {config.concurrent_users} concurrent users")
        logger.info(f"Duration: {config.duration_seconds} seconds")
        logger.info(f"Target endpoints: {config.target_endpoints}")
        
        self.start_time = datetime.now()
        
        # Create HTTP session
        timeout = aiohttp.ClientTimeout(total=30)
        connector = aiohttp.TCPConnector(limit=config.concurrent_users * 2)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            # Create stop event
            stop_event = asyncio.Event()
            
            # Start system monitoring
            monitoring_task = asyncio.create_task(self._monitor_system_metrics(stop_event))
            
            # Ramp up phase
            if config.ramp_up_seconds > 0:
                logger.info(f"Ramping up over {config.ramp_up_seconds} seconds")
                await self._ramp_up(session, config, stop_event)
            
            # Main test phase
            logger.info("Starting main test phase")
            workers = []
            for i in range(config.concurrent_users):
                worker = asyncio.create_task(self._worker(session, config, stop_event))
                workers.append(worker)
            
            # Run for specified duration
            await asyncio.sleep(config.duration_seconds)
            
            # Stop workers
            stop_event.set()
            await asyncio.gather(*workers, return_exceptions=True)
            
            # Ramp down phase
            if config.ramp_down_seconds > 0:
                logger.info(f"Ramping down over {config.ramp_down_seconds} seconds")
                await asyncio.sleep(config.ramp_down_seconds)
            
            # Stop monitoring
            monitoring_task.cancel()
            try:
                await monitoring_task
            except asyncio.CancelledError:
                pass
        
        self.end_time = datetime.now()
        
        # Calculate metrics
        metrics = self._calculate_metrics()
        
        logger.info("Load test completed")
        logger.info(f"Total requests: {metrics.total_requests}")
        logger.info(f"Successful requests: {metrics.successful_requests}")
        logger.info(f"Failed requests: {metrics.failed_requests}")
        logger.info(f"Average response time: {metrics.average_response_time_ms:.2f}ms")
        logger.info(f"Requests per second: {metrics.requests_per_second:.2f}")
        logger.info(f"Error rate: {metrics.error_rate_percent:.2f}%")
        
        return metrics

    async def _ramp_up(self, session: aiohttp.ClientSession, config: LoadTestConfig, 
                      stop_event: asyncio.Event):
        """Ramp up phase"""
        ramp_up_delay = config.ramp_up_seconds / config.concurrent_users
        
        for i in range(config.concurrent_users):
            if stop_event.is_set():
                break
                
            worker = asyncio.create_task(self._worker(session, config, stop_event))
            await asyncio.sleep(ramp_up_delay)

    async def _monitor_system_metrics(self, stop_event: asyncio.Event):
        """Monitor system metrics during test"""
        while not stop_event.is_set():
            self._sample_system_metrics()
            await asyncio.sleep(1)

    def _calculate_metrics(self) -> PerformanceMetrics:
        """Calculate performance metrics from results"""
        if not self.results:
            return PerformanceMetrics(
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                average_response_time_ms=0,
                median_response_time_ms=0,
                p95_response_time_ms=0,
                p99_response_time_ms=0,
                min_response_time_ms=0,
                max_response_time_ms=0,
                requests_per_second=0,
                error_rate_percent=0,
                throughput_mbps=0,
                memory_usage_mb=0,
                cpu_usage_percent=0,
                duration_seconds=0
            )
        
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r.success)
        failed_requests = total_requests - successful_requests
        
        response_times = [r.response_time_ms for r in self.results]
        
        # Calculate response time statistics
        average_response_time = statistics.mean(response_times)
        median_response_time = statistics.median(response_times)
        p95_response_time = self._percentile(response_times, 95)
        p99_response_time = self._percentile(response_times, 99)
        min_response_time = min(response_times)
        max_response_time = max(response_times)
        
        # Calculate throughput
        duration_seconds = (self.end_time - self.start_time).total_seconds()
        requests_per_second = total_requests / duration_seconds if duration_seconds > 0 else 0
        
        # Calculate error rate
        error_rate_percent = (failed_requests / total_requests * 100) if total_requests > 0 else 0
        
        # Calculate throughput in MB/s (rough estimate)
        avg_response_size = 1024  # Assume 1KB average response
        throughput_mbps = (requests_per_second * avg_response_size) / (1024 * 1024) * 8
        
        # System metrics
        memory_usage_mb = statistics.mean(self.memory_samples) if self.memory_samples else 0
        cpu_usage_percent = statistics.mean(self.cpu_samples) if self.cpu_samples else 0
        
        return PerformanceMetrics(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            average_response_time_ms=average_response_time,
            median_response_time_ms=median_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            requests_per_second=requests_per_second,
            error_rate_percent=error_rate_percent,
            throughput_mbps=throughput_mbps,
            memory_usage_mb=memory_usage_mb,
            cpu_usage_percent=cpu_usage_percent,
            duration_seconds=duration_seconds
        )

    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of data"""
        if not data:
            return 0
        
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]

    async def run_stress_test(self, max_concurrent: int = 100, duration_seconds: int = 60) -> PerformanceMetrics:
        """Run stress test to find breaking point"""
        logger.info(f"Starting stress test with up to {max_concurrent} concurrent users")
        
        config = LoadTestConfig(
            concurrent_users=max_concurrent,
            duration_seconds=duration_seconds,
            ramp_up_seconds=10,
            ramp_down_seconds=5,
            target_endpoints=["/api/health", "/api/auth/validate-license"],
            request_interval_ms=0
        )
        
        return await self.run_load_test(config)

    async def run_endurance_test(self, concurrent_users: int = 10, duration_seconds: int = 300) -> PerformanceMetrics:
        """Run endurance test for stability"""
        logger.info(f"Starting endurance test with {concurrent_users} concurrent users for {duration_seconds} seconds")
        
        config = LoadTestConfig(
            concurrent_users=concurrent_users,
            duration_seconds=duration_seconds,
            ramp_up_seconds=30,
            ramp_down_seconds=30,
            target_endpoints=["/api/health", "/api/auth/validate-license", "/api/analytics/track"],
            request_interval_ms=100
        )
        
        return await self.run_load_test(config)

    async def run_spike_test(self, base_concurrent: int = 10, spike_concurrent: int = 50, 
                           duration_seconds: int = 120) -> PerformanceMetrics:
        """Run spike test to test system recovery"""
        logger.info(f"Starting spike test: {base_concurrent} -> {spike_concurrent} -> {base_concurrent}")
        
        # Phase 1: Base load
        config1 = LoadTestConfig(
            concurrent_users=base_concurrent,
            duration_seconds=duration_seconds // 3,
            ramp_up_seconds=5,
            ramp_down_seconds=0,
            target_endpoints=["/api/health", "/api/auth/validate-license"],
            request_interval_ms=200
        )
        
        # Phase 2: Spike load
        config2 = LoadTestConfig(
            concurrent_users=spike_concurrent,
            duration_seconds=duration_seconds // 3,
            ramp_up_seconds=5,
            ramp_down_seconds=0,
            target_endpoints=["/api/health", "/api/auth/validate-license"],
            request_interval_ms=50
        )
        
        # Phase 3: Back to base load
        config3 = LoadTestConfig(
            concurrent_users=base_concurrent,
            duration_seconds=duration_seconds // 3,
            ramp_up_seconds=5,
            ramp_down_seconds=5,
            target_endpoints=["/api/health", "/api/auth/validate-license"],
            request_interval_ms=200
        )
        
        # Run phases sequentially
        await self.run_load_test(config1)
        await self.run_load_test(config2)
        await self.run_load_test(config3)
        
        return self._calculate_metrics()

    def generate_report(self, metrics: PerformanceMetrics) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        return {
            "test_info": {
                "backend_url": self.backend_url,
                "start_time": self.start_time.isoformat() if self.start_time else None,
                "end_time": self.end_time.isoformat() if self.end_time else None,
                "duration_seconds": metrics.duration_seconds,
                "test_server_id": self.test_server_id
            },
            "performance_metrics": asdict(metrics),
            "response_time_distribution": self._get_response_time_distribution(),
            "endpoint_breakdown": self._get_endpoint_breakdown(),
            "error_analysis": self._get_error_analysis(),
            "system_metrics": {
                "memory_samples": self.memory_samples,
                "cpu_samples": self.cpu_samples,
                "peak_memory_mb": max(self.memory_samples) if self.memory_samples else 0,
                "peak_cpu_percent": max(self.cpu_samples) if self.cpu_samples else 0
            },
            "recommendations": self._generate_recommendations(metrics),
            "timestamp": datetime.now().isoformat()
        }

    def _get_response_time_distribution(self) -> Dict[str, int]:
        """Get response time distribution"""
        if not self.results:
            return {}
        
        distribution = {
            "0-100ms": 0,
            "100-500ms": 0,
            "500ms-1s": 0,
            "1-5s": 0,
            "5s+": 0
        }
        
        for result in self.results:
            if result.response_time_ms < 100:
                distribution["0-100ms"] += 1
            elif result.response_time_ms < 500:
                distribution["100-500ms"] += 1
            elif result.response_time_ms < 1000:
                distribution["500ms-1s"] += 1
            elif result.response_time_ms < 5000:
                distribution["1-5s"] += 1
            else:
                distribution["5s+"] += 1
        
        return distribution

    def _get_endpoint_breakdown(self) -> Dict[str, Dict[str, Any]]:
        """Get performance breakdown by endpoint"""
        if not self.results:
            return {}
        
        endpoint_stats = {}
        
        for result in self.results:
            if result.endpoint not in endpoint_stats:
                endpoint_stats[result.endpoint] = {
                    "total_requests": 0,
                    "successful_requests": 0,
                    "failed_requests": 0,
                    "response_times": [],
                    "error_messages": []
                }
            
            stats = endpoint_stats[result.endpoint]
            stats["total_requests"] += 1
            
            if result.success:
                stats["successful_requests"] += 1
            else:
                stats["failed_requests"] += 1
                if result.error_message:
                    stats["error_messages"].append(result.error_message)
            
            stats["response_times"].append(result.response_time_ms)
        
        # Calculate averages
        for endpoint, stats in endpoint_stats.items():
            if stats["response_times"]:
                stats["average_response_time_ms"] = statistics.mean(stats["response_times"])
                stats["median_response_time_ms"] = statistics.median(stats["response_times"])
                stats["p95_response_time_ms"] = self._percentile(stats["response_times"], 95)
            else:
                stats["average_response_time_ms"] = 0
                stats["median_response_time_ms"] = 0
                stats["p95_response_time_ms"] = 0
            
            # Remove raw response times to keep report clean
            del stats["response_times"]
        
        return endpoint_stats

    def _get_error_analysis(self) -> Dict[str, Any]:
        """Get error analysis"""
        if not self.results:
            return {}
        
        failed_results = [r for r in self.results if not r.success]
        
        error_types = {}
        status_codes = {}
        
        for result in failed_results:
            # Count by error type
            if result.error_message:
                error_type = result.error_message.split(':')[0]  # Get first part of error
                error_types[error_type] = error_types.get(error_type, 0) + 1
            
            # Count by status code
            status_codes[result.status_code] = status_codes.get(result.status_code, 0) + 1
        
        return {
            "total_errors": len(failed_results),
            "error_rate_percent": (len(failed_results) / len(self.results) * 100) if self.results else 0,
            "error_types": error_types,
            "status_codes": status_codes,
            "most_common_error": max(error_types.items(), key=lambda x: x[1])[0] if error_types else None
        }

    def _generate_recommendations(self, metrics: PerformanceMetrics) -> List[str]:
        """Generate performance recommendations"""
        recommendations = []
        
        if metrics.error_rate_percent > 5:
            recommendations.append("High error rate detected. Consider investigating backend stability.")
        
        if metrics.average_response_time_ms > 1000:
            recommendations.append("Average response time is high. Consider optimizing backend performance.")
        
        if metrics.p95_response_time_ms > 5000:
            recommendations.append("95th percentile response time is very high. Some requests are taking too long.")
        
        if metrics.requests_per_second < 10:
            recommendations.append("Low throughput detected. Consider scaling or optimization.")
        
        if metrics.memory_usage_mb > 500:
            recommendations.append("High memory usage detected. Monitor for memory leaks.")
        
        if metrics.cpu_usage_percent > 80:
            recommendations.append("High CPU usage detected. Consider load balancing or optimization.")
        
        if not recommendations:
            recommendations.append("Performance looks good! No major issues detected.")
        
        return recommendations

    def save_report(self, metrics: PerformanceMetrics, filename: str = None):
        """Save performance report to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"performance_benchmark_report_{timestamp}.json"
        
        report = self.generate_report(metrics)
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Performance report saved to: {filename}")
        return filename

    def print_summary(self, metrics: PerformanceMetrics):
        """Print performance summary to console"""
        print("\n" + "=" * 80)
        print("MCP PERFORMANCE BENCHMARK SUMMARY")
        print("=" * 80)
        
        print(f"Backend URL: {self.backend_url}")
        print(f"Test Duration: {metrics.duration_seconds:.2f} seconds")
        print(f"Test Server ID: {self.test_server_id}")
        
        print(f"\nRequest Statistics:")
        print(f"  Total Requests: {metrics.total_requests}")
        print(f"  Successful: {metrics.successful_requests}")
        print(f"  Failed: {metrics.failed_requests}")
        print(f"  Error Rate: {metrics.error_rate_percent:.2f}%")
        
        print(f"\nResponse Time Statistics:")
        print(f"  Average: {metrics.average_response_time_ms:.2f}ms")
        print(f"  Median: {metrics.median_response_time_ms:.2f}ms")
        print(f"  95th Percentile: {metrics.p95_response_time_ms:.2f}ms")
        print(f"  99th Percentile: {metrics.p99_response_time_ms:.2f}ms")
        print(f"  Min: {metrics.min_response_time_ms:.2f}ms")
        print(f"  Max: {metrics.max_response_time_ms:.2f}ms")
        
        print(f"\nThroughput:")
        print(f"  Requests/Second: {metrics.requests_per_second:.2f}")
        print(f"  Throughput: {metrics.throughput_mbps:.2f} Mbps")
        
        print(f"\nSystem Metrics:")
        print(f"  Memory Usage: {metrics.memory_usage_mb:.2f} MB")
        print(f"  CPU Usage: {metrics.cpu_usage_percent:.2f}%")
        
        print(f"\nRecommendations:")
        for recommendation in self._generate_recommendations(metrics):
            print(f"  • {recommendation}")
        
        print("=" * 80)

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="MCP Performance Benchmark Suite")
    parser.add_argument("--backend-url", default="http://localhost:3000", 
                       help="Backend URL (default: http://localhost:3000)")
    parser.add_argument("--test-type", choices=["load", "stress", "endurance", "spike"], 
                       default="load", help="Type of test to run")
    parser.add_argument("--concurrent", type=int, default=10, 
                       help="Number of concurrent users (default: 10)")
    parser.add_argument("--duration", type=int, default=60, 
                       help="Test duration in seconds (default: 60)")
    parser.add_argument("--max-concurrent", type=int, default=100, 
                       help="Maximum concurrent users for stress test (default: 100)")
    parser.add_argument("--verbose", "-v", action="store_true", 
                       help="Enable verbose logging")
    parser.add_argument("--report", help="Save report to specific file")
    
    args = parser.parse_args()
    
    # Create benchmark instance
    benchmark = MCPPerformanceBenchmark(
        backend_url=args.backend_url,
        verbose=args.verbose
    )
    
    try:
        # Run appropriate test
        if args.test_type == "load":
            config = LoadTestConfig(
                concurrent_users=args.concurrent,
                duration_seconds=args.duration,
                ramp_up_seconds=10,
                ramp_down_seconds=5,
                target_endpoints=["/api/health", "/api/auth/validate-license", "/api/analytics/track"],
                request_interval_ms=100
            )
            metrics = await benchmark.run_load_test(config)
            
        elif args.test_type == "stress":
            metrics = await benchmark.run_stress_test(args.max_concurrent, args.duration)
            
        elif args.test_type == "endurance":
            metrics = await benchmark.run_endurance_test(args.concurrent, args.duration)
            
        elif args.test_type == "spike":
            metrics = await benchmark.run_spike_test(args.concurrent, args.max_concurrent, args.duration)
        
        # Generate and save report
        report_file = benchmark.save_report(metrics, args.report)
        
        # Print summary
        benchmark.print_summary(metrics)
        
        # Exit with appropriate code
        exit_code = 0 if metrics.error_rate_percent < 5 else 1
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        logger.info("Benchmark interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Benchmark failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
