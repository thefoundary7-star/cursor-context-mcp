#!/usr/bin/env python3
"""
End-to-End Integration Test Suite for Python MCP Server and Node.js Backend
================================================================================

This script tests the complete communication flow between the Python MCP server
and the Node.js backend, including:
- License validation
- Usage tracking
- Error handling
- Network failure recovery
- Performance benchmarking

Usage:
    python test_mcp_integration.py [--backend-url URL] [--verbose] [--benchmark]
"""

import asyncio
import json
import logging
import time
import uuid
import argparse
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

import aiohttp
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_mcp_integration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TestResult:
    """Test result data structure"""
    test_name: str
    success: bool
    duration_ms: float
    error_message: Optional[str] = None
    response_data: Optional[Dict] = None
    request_data: Optional[Dict] = None
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()

@dataclass
class PerformanceMetrics:
    """Performance metrics for benchmarking"""
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    requests_per_second: float
    total_duration_seconds: float

class MCPIntegrationTester:
    """Main test class for MCP integration testing"""
    
    def __init__(self, backend_url: str = "http://localhost:3000", verbose: bool = False):
        self.backend_url = backend_url.rstrip('/')
        self.verbose = verbose
        self.session = self._create_session()
        self.test_results: List[TestResult] = []
        self.performance_metrics: Optional[PerformanceMetrics] = None
        
        # Test data
        self.test_license_key = "TEST-LICENSE-KEY-12345"
        self.test_server_id = f"test-server-{uuid.uuid4().hex[:8]}"
        self.test_server_name = "Test MCP Server"
        self.test_server_version = "1.0.0"
        
        logger.info(f"Initialized MCP Integration Tester")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Test Server ID: {self.test_server_id}")

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
            'User-Agent': 'MCP-Integration-Test/1.0'
        })
        
        return session

    def _log_request(self, method: str, url: str, data: Optional[Dict] = None, headers: Optional[Dict] = None):
        """Log request details"""
        if self.verbose:
            logger.info(f"Making {method} request to {url}")
            if data:
                logger.debug(f"Request data: {json.dumps(data, indent=2)}")
            if headers:
                logger.debug(f"Request headers: {headers}")

    def _log_response(self, response: requests.Response, duration_ms: float):
        """Log response details"""
        if self.verbose:
            logger.info(f"Response: {response.status_code} ({duration_ms:.2f}ms)")
            try:
                response_data = response.json()
                logger.debug(f"Response data: {json.dumps(response_data, indent=2)}")
            except:
                logger.debug(f"Response text: {response.text[:500]}")

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                     headers: Optional[Dict] = None) -> Tuple[requests.Response, float]:
        """Make HTTP request with timing"""
        url = f"{self.backend_url}{endpoint}"
        
        self._log_request(method, url, data, headers)
        
        start_time = time.time()
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                headers=headers,
                timeout=30
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"Request failed: {e}")
            raise
        
        duration_ms = (time.time() - start_time) * 1000
        self._log_response(response, duration_ms)
        
        return response, duration_ms

    def test_backend_connectivity(self) -> TestResult:
        """Test basic backend connectivity"""
        test_name = "Backend Connectivity"
        logger.info(f"Running test: {test_name}")
        
        try:
            response, duration_ms = self._make_request("GET", "/api/health")
            
            success = response.status_code == 200
            error_message = None if success else f"HTTP {response.status_code}: {response.text}"
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                error_message=error_message,
                response_data=response.json() if success else None
            )
            
            logger.info(f"✓ {test_name}: {'PASSED' if success else 'FAILED'}")
            return result
            
        except Exception as e:
            logger.error(f"✗ {test_name}: FAILED - {e}")
            return TestResult(
                test_name=test_name,
                success=False,
                duration_ms=0,
                error_message=str(e)
            )

    def test_license_validation_valid(self) -> TestResult:
        """Test license validation with valid license"""
        test_name = "License Validation (Valid)"
        logger.info(f"Running test: {test_name}")
        
        try:
            data = {
                "licenseKey": self.test_license_key,
                "serverId": self.test_server_id,
                "serverName": self.test_server_name,
                "serverVersion": self.test_server_version
            }
            
            response, duration_ms = self._make_request("POST", "/api/auth/validate-license", data)
            
            success = response.status_code == 200
            error_message = None if success else f"HTTP {response.status_code}: {response.text}"
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                error_message=error_message,
                response_data=response.json() if success else None,
                request_data=data
            )
            
            logger.info(f"✓ {test_name}: {'PASSED' if success else 'FAILED'}")
            return result
            
        except Exception as e:
            logger.error(f"✗ {test_name}: FAILED - {e}")
            return TestResult(
                test_name=test_name,
                success=False,
                duration_ms=0,
                error_message=str(e),
                request_data=data
            )

    def test_license_validation_invalid(self) -> TestResult:
        """Test license validation with invalid license"""
        test_name = "License Validation (Invalid)"
        logger.info(f"Running test: {test_name}")
        
        try:
            data = {
                "licenseKey": "INVALID-LICENSE-KEY",
                "serverId": self.test_server_id,
                "serverName": self.test_server_name,
                "serverVersion": self.test_server_version
            }
            
            response, duration_ms = self._make_request("POST", "/api/auth/validate-license", data)
            
            # Should return 200 but with valid: false
            success = response.status_code == 200
            if success:
                response_data = response.json()
                success = not response_data.get('data', {}).get('valid', True)
                error_message = None if not success else "Expected invalid license but got valid response"
            else:
                error_message = f"HTTP {response.status_code}: {response.text}"
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                error_message=error_message,
                response_data=response.json() if response.status_code == 200 else None,
                request_data=data
            )
            
            logger.info(f"✓ {test_name}: {'PASSED' if success else 'FAILED'}")
            return result
            
        except Exception as e:
            logger.error(f"✗ {test_name}: FAILED - {e}")
            return TestResult(
                test_name=test_name,
                success=False,
                duration_ms=0,
                error_message=str(e),
                request_data=data
            )

    def test_usage_tracking(self) -> TestResult:
        """Test usage tracking data transmission"""
        test_name = "Usage Tracking"
        logger.info(f"Running test: {test_name}")
        
        try:
            # First validate license to get server registered
            license_data = {
                "licenseKey": self.test_license_key,
                "serverId": self.test_server_id,
                "serverName": self.test_server_name,
                "serverVersion": self.test_server_version
            }
            
            # Validate license first
            response, _ = self._make_request("POST", "/api/auth/validate-license", license_data)
            if response.status_code != 200:
                raise Exception(f"License validation failed: {response.text}")
            
            # Now test usage tracking
            events = [
                {
                    "eventType": "REQUEST_COUNT",
                    "eventData": {"count": 1, "endpoint": "/test"},
                    "metadata": {"user_agent": "test-client"},
                    "timestamp": datetime.now().isoformat()
                },
                {
                    "eventType": "FEATURE_USAGE",
                    "eventData": {"feature": "test_feature", "duration_ms": 150},
                    "metadata": {"version": "1.0.0"},
                    "timestamp": datetime.now().isoformat()
                }
            ]
            
            tracking_data = {
                "licenseKey": self.test_license_key,
                "serverId": self.test_server_id,
                "events": events
            }
            
            response, duration_ms = self._make_request("POST", "/api/analytics/track", tracking_data)
            
            success = response.status_code == 200
            error_message = None if success else f"HTTP {response.status_code}: {response.text}"
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                error_message=error_message,
                response_data=response.json() if success else None,
                request_data=tracking_data
            )
            
            logger.info(f"✓ {test_name}: {'PASSED' if success else 'FAILED'}")
            return result
            
        except Exception as e:
            logger.error(f"✗ {test_name}: FAILED - {e}")
            return TestResult(
                test_name=test_name,
                success=False,
                duration_ms=0,
                error_message=str(e),
                request_data=tracking_data if 'tracking_data' in locals() else None
            )

    def test_network_failure_recovery(self) -> TestResult:
        """Test error handling when backend is unavailable"""
        test_name = "Network Failure Recovery"
        logger.info(f"Running test: {test_name}")
        
        try:
            # Test with invalid backend URL
            original_url = self.backend_url
            self.backend_url = "http://localhost:9999"  # Non-existent port
            
            data = {
                "licenseKey": self.test_license_key,
                "serverId": self.test_server_id,
                "serverName": self.test_server_name,
                "serverVersion": self.test_server_version
            }
            
            start_time = time.time()
            try:
                response, duration_ms = self._make_request("POST", "/api/auth/validate-license", data)
                # If we get here, the test should fail because we expect a connection error
                success = False
                error_message = "Expected connection error but got response"
            except requests.exceptions.ConnectionError:
                duration_ms = (time.time() - start_time) * 1000
                success = True  # This is what we expect
                error_message = None
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                success = False
                error_message = f"Unexpected error: {e}"
            
            # Restore original URL
            self.backend_url = original_url
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                error_message=error_message,
                request_data=data
            )
            
            logger.info(f"✓ {test_name}: {'PASSED' if success else 'FAILED'}")
            return result
            
        except Exception as e:
            # Restore original URL in case of exception
            self.backend_url = original_url
            logger.error(f"✗ {test_name}: FAILED - {e}")
            return TestResult(
                test_name=test_name,
                success=False,
                duration_ms=0,
                error_message=str(e),
                request_data=data if 'data' in locals() else None
            )

    def test_authentication_flow(self) -> TestResult:
        """Test complete authentication flow"""
        test_name = "Authentication Flow"
        logger.info(f"Running test: {test_name}")
        
        try:
            # Step 1: Validate license
            license_data = {
                "licenseKey": self.test_license_key,
                "serverId": self.test_server_id,
                "serverName": self.test_server_name,
                "serverVersion": self.test_server_version
            }
            
            response, duration_ms = self._make_request("POST", "/api/auth/validate-license", license_data)
            
            if response.status_code != 200:
                raise Exception(f"License validation failed: {response.text}")
            
            response_data = response.json()
            if not response_data.get('data', {}).get('valid', False):
                raise Exception(f"License validation returned invalid: {response_data}")
            
            # Step 2: Track some usage
            events = [
                {
                    "eventType": "LICENSE_VALIDATION",
                    "eventData": {"success": True},
                    "metadata": {"test": True},
                    "timestamp": datetime.now().isoformat()
                }
            ]
            
            tracking_data = {
                "licenseKey": self.test_license_key,
                "serverId": self.test_server_id,
                "events": events
            }
            
            response, duration_ms = self._make_request("POST", "/api/analytics/track", tracking_data)
            
            success = response.status_code == 200
            error_message = None if success else f"HTTP {response.status_code}: {response.text}"
            
            result = TestResult(
                test_name=test_name,
                success=success,
                duration_ms=duration_ms,
                error_message=error_message,
                response_data=response.json() if success else None,
                request_data={"license_validation": license_data, "usage_tracking": tracking_data}
            )
            
            logger.info(f"✓ {test_name}: {'PASSED' if success else 'FAILED'}")
            return result
            
        except Exception as e:
            logger.error(f"✗ {test_name}: FAILED - {e}")
            return TestResult(
                test_name=test_name,
                success=False,
                duration_ms=0,
                error_message=str(e),
                request_data={"license_validation": license_data, "usage_tracking": tracking_data} if 'license_data' in locals() else None
            )

    def run_performance_benchmark(self, num_requests: int = 100) -> PerformanceMetrics:
        """Run performance benchmark"""
        logger.info(f"Running performance benchmark with {num_requests} requests")
        
        response_times = []
        successful_requests = 0
        failed_requests = 0
        
        start_time = time.time()
        
        for i in range(num_requests):
            try:
                data = {
                    "licenseKey": self.test_license_key,
                    "serverId": f"{self.test_server_id}-{i}",
                    "serverName": f"Test Server {i}",
                    "serverVersion": self.test_server_version
                }
                
                response, duration_ms = self._make_request("POST", "/api/auth/validate-license", data)
                
                response_times.append(duration_ms)
                
                if response.status_code == 200:
                    successful_requests += 1
                else:
                    failed_requests += 1
                    
            except Exception as e:
                logger.warning(f"Request {i+1} failed: {e}")
                failed_requests += 1
        
        total_duration = time.time() - start_time
        
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = min_response_time = max_response_time = 0
        
        requests_per_second = num_requests / total_duration if total_duration > 0 else 0
        
        metrics = PerformanceMetrics(
            total_requests=num_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            average_response_time_ms=avg_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            requests_per_second=requests_per_second,
            total_duration_seconds=total_duration
        )
        
        self.performance_metrics = metrics
        
        logger.info(f"Performance Benchmark Results:")
        logger.info(f"  Total Requests: {metrics.total_requests}")
        logger.info(f"  Successful: {metrics.successful_requests}")
        logger.info(f"  Failed: {metrics.failed_requests}")
        logger.info(f"  Average Response Time: {metrics.average_response_time_ms:.2f}ms")
        logger.info(f"  Min Response Time: {metrics.min_response_time_ms:.2f}ms")
        logger.info(f"  Max Response Time: {metrics.max_response_time_ms:.2f}ms")
        logger.info(f"  Requests/Second: {metrics.requests_per_second:.2f}")
        logger.info(f"  Total Duration: {metrics.total_duration_seconds:.2f}s")
        
        return metrics

    def run_all_tests(self) -> List[TestResult]:
        """Run all integration tests"""
        logger.info("Starting MCP Integration Test Suite")
        logger.info("=" * 50)
        
        tests = [
            self.test_backend_connectivity,
            self.test_license_validation_valid,
            self.test_license_validation_invalid,
            self.test_usage_tracking,
            self.test_network_failure_recovery,
            self.test_authentication_flow,
        ]
        
        self.test_results = []
        
        for test_func in tests:
            try:
                result = test_func()
                self.test_results.append(result)
            except Exception as e:
                logger.error(f"Test {test_func.__name__} crashed: {e}")
                self.test_results.append(TestResult(
                    test_name=test_func.__name__,
                    success=False,
                    duration_ms=0,
                    error_message=f"Test crashed: {e}"
                ))
        
        return self.test_results

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.success)
        failed_tests = total_tests - passed_tests
        
        total_duration = sum(result.duration_ms for result in self.test_results)
        avg_duration = total_duration / total_tests if total_tests > 0 else 0
        
        report = {
            "test_summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0,
                "total_duration_ms": total_duration,
                "average_duration_ms": avg_duration,
                "timestamp": datetime.now().isoformat()
            },
            "test_results": [asdict(result) for result in self.test_results],
            "performance_metrics": asdict(self.performance_metrics) if self.performance_metrics else None,
            "backend_url": self.backend_url,
            "test_server_id": self.test_server_id
        }
        
        return report

    def save_report(self, filename: str = None):
        """Save test report to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mcp_integration_test_report_{timestamp}.json"
        
        report = self.generate_report()
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Test report saved to: {filename}")
        return filename

    def print_summary(self):
        """Print test summary to console"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.success)
        failed_tests = total_tests - passed_tests
        
        print("\n" + "=" * 60)
        print("MCP INTEGRATION TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests / total_tests * 100):.1f}%")
        
        if self.performance_metrics:
            print(f"\nPerformance Metrics:")
            print(f"  Requests/Second: {self.performance_metrics.requests_per_second:.2f}")
            print(f"  Average Response Time: {self.performance_metrics.average_response_time_ms:.2f}ms")
        
        print("\nTest Results:")
        for result in self.test_results:
            status = "✓ PASS" if result.success else "✗ FAIL"
            print(f"  {status} {result.test_name} ({result.duration_ms:.2f}ms)")
            if not result.success and result.error_message:
                print(f"    Error: {result.error_message}")
        
        print("=" * 60)

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="MCP Integration Test Suite")
    parser.add_argument("--backend-url", default="http://localhost:3000", 
                       help="Backend URL (default: http://localhost:3000)")
    parser.add_argument("--verbose", "-v", action="store_true", 
                       help="Enable verbose logging")
    parser.add_argument("--benchmark", action="store_true", 
                       help="Run performance benchmark")
    parser.add_argument("--requests", type=int, default=100, 
                       help="Number of requests for benchmark (default: 100)")
    parser.add_argument("--report", help="Save report to specific file")
    
    args = parser.parse_args()
    
    # Create tester instance
    tester = MCPIntegrationTester(
        backend_url=args.backend_url,
        verbose=args.verbose
    )
    
    try:
        # Run integration tests
        results = tester.run_all_tests()
        
        # Run performance benchmark if requested
        if args.benchmark:
            tester.run_performance_benchmark(args.requests)
        
        # Generate and save report
        report_file = tester.save_report(args.report)
        
        # Print summary
        tester.print_summary()
        
        # Exit with appropriate code
        failed_tests = sum(1 for result in results if not result.success)
        sys.exit(failed_tests)
        
    except KeyboardInterrupt:
        logger.info("Test suite interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test suite failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
