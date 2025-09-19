#!/usr/bin/env python3
"""
MCP Integration Test Runner
===========================

This script provides a unified interface for running all MCP integration tests.
It orchestrates the execution of all test scripts and provides a comprehensive
summary of results.

Usage:
    python test_runner.py [--quick] [--full] [--performance] [--verbose]
"""

import asyncio
import subprocess
import json
import time
import argparse
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class TestResult:
    """Test execution result"""
    test_name: str
    success: bool
    duration_seconds: float
    exit_code: int
    stdout: str
    stderr: str
    error_message: Optional[str] = None
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()

@dataclass
class TestSuiteResult:
    """Test suite execution result"""
    suite_name: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    total_duration_seconds: float
    test_results: List[TestResult]
    success_rate: float
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()
        self.success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0

class MCPTestRunner:
    """Main test runner class"""
    
    def __init__(self, verbose: bool = False, backend_url: str = "http://localhost:3000"):
        self.verbose = verbose
        self.backend_url = backend_url
        self.results: List[TestSuiteResult] = []
        
        # Test configurations
        self.test_configs = {
            "python_integration": {
                "script": "test_mcp_integration.py",
                "args": ["--backend-url", self.backend_url],
                "description": "Python MCP Integration Tests"
            },
            "node_simulator": {
                "script": "test_mcp_simulator.js",
                "args": ["--backend-url", self.backend_url],
                "description": "Node.js MCP Simulator Tests"
            },
            "integration_suite": {
                "script": "integration_test_suite.js",
                "args": ["--backend-url", self.backend_url],
                "description": "Comprehensive Integration Test Suite"
            },
            "performance_benchmark": {
                "script": "performance_benchmark.py",
                "args": ["--backend-url", self.backend_url, "--test-type", "load", "--concurrent", "10", "--duration", "60"],
                "description": "Performance Benchmark Tests"
            },
            "debug_monitor": {
                "script": "debug_monitor.py",
                "args": ["--backend-url", self.backend_url, "--save-session", "debug_session.json"],
                "description": "Debug Monitor Tests",
                "timeout": 30
            },
            "network_monitor": {
                "script": "network_monitor.js",
                "args": ["--backend-url", self.backend_url, "--save-report", "network_report.json"],
                "description": "Network Monitor Tests",
                "timeout": 30
            }
        }

    def log(self, message: str, level: str = "INFO"):
        """Log a message"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def run_command(self, command: List[str], timeout: Optional[int] = None) -> TestResult:
        """Run a command and return the result"""
        start_time = time.time()
        
        try:
            if self.verbose:
                self.log(f"Running: {' '.join(command)}")
            
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name=command[0],
                success=result.returncode == 0,
                duration_seconds=duration,
                exit_code=result.returncode,
                stdout=result.stdout,
                stderr=result.stderr,
                timestamp=datetime.now().isoformat()
            )
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            return TestResult(
                test_name=command[0],
                success=False,
                duration_seconds=duration,
                exit_code=-1,
                stdout="",
                stderr="",
                error_message=f"Command timed out after {timeout} seconds",
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(
                test_name=command[0],
                success=False,
                duration_seconds=duration,
                exit_code=-1,
                stdout="",
                stderr="",
                error_message=str(e),
                timestamp=datetime.now().isoformat()
            )

    def check_prerequisites(self) -> bool:
        """Check if all prerequisites are met"""
        self.log("Checking prerequisites...")
        
        prerequisites_met = True
        
        # Check if test scripts exist
        for test_name, config in self.test_configs.items():
            script_path = Path(config["script"])
            if not script_path.exists():
                self.log(f"Missing test script: {config['script']}", "ERROR")
                prerequisites_met = False
            else:
                self.log(f"Found test script: {config['script']}")
        
        # Check if backend is accessible
        try:
            import requests
            response = requests.get(f"{self.backend_url}/api/health", timeout=10)
            if response.status_code == 200:
                self.log("Backend is accessible")
            else:
                self.log(f"Backend returned status {response.status_code}", "WARN")
        except Exception as e:
            self.log(f"Backend is not accessible: {e}", "ERROR")
            prerequisites_met = False
        
        # Check Python dependencies
        try:
            import aiohttp
            import psutil
            self.log("Python dependencies are available")
        except ImportError as e:
            self.log(f"Missing Python dependency: {e}", "ERROR")
            prerequisites_met = False
        
        # Check Node.js dependencies
        try:
            result = self.run_command(["node", "-e", "console.log('Node.js is available')"])
            if result.success:
                self.log("Node.js is available")
            else:
                self.log("Node.js is not available", "ERROR")
                prerequisites_met = False
        except Exception as e:
            self.log(f"Node.js check failed: {e}", "ERROR")
            prerequisites_met = False
        
        return prerequisites_met

    def run_test_suite(self, suite_name: str) -> TestSuiteResult:
        """Run a specific test suite"""
        if suite_name not in self.test_configs:
            raise ValueError(f"Unknown test suite: {suite_name}")
        
        config = self.test_configs[suite_name]
        self.log(f"Running {config['description']}...")
        
        # Build command
        if config["script"].endswith('.py'):
            command = ["python3", config["script"]] + config["args"]
        elif config["script"].endswith('.js'):
            command = ["node", config["script"]] + config["args"]
        else:
            raise ValueError(f"Unknown script type: {config['script']}")
        
        # Run the test
        timeout = config.get("timeout", 300)  # 5 minutes default
        result = self.run_command(command, timeout)
        
        # Create test suite result
        suite_result = TestSuiteResult(
            suite_name=suite_name,
            total_tests=1,
            passed_tests=1 if result.success else 0,
            failed_tests=0 if result.success else 1,
            total_duration_seconds=result.duration_seconds,
            test_results=[result]
        )
        
        if result.success:
            self.log(f"✓ {config['description']} completed successfully")
        else:
            self.log(f"✗ {config['description']} failed", "ERROR")
            if result.error_message:
                self.log(f"  Error: {result.error_message}", "ERROR")
            if result.stderr:
                self.log(f"  Stderr: {result.stderr}", "ERROR")
        
        return suite_result

    def run_quick_tests(self) -> List[TestSuiteResult]:
        """Run quick verification tests"""
        self.log("Running quick verification tests...")
        
        quick_suites = ["python_integration", "node_simulator"]
        results = []
        
        for suite_name in quick_suites:
            try:
                result = self.run_test_suite(suite_name)
                results.append(result)
            except Exception as e:
                self.log(f"Failed to run {suite_name}: {e}", "ERROR")
                # Create a failed result
                failed_result = TestSuiteResult(
                    suite_name=suite_name,
                    total_tests=1,
                    passed_tests=0,
                    failed_tests=1,
                    total_duration_seconds=0,
                    test_results=[]
                )
                results.append(failed_result)
        
        return results

    def run_full_tests(self) -> List[TestSuiteResult]:
        """Run full integration tests"""
        self.log("Running full integration tests...")
        
        full_suites = ["python_integration", "node_simulator", "integration_suite"]
        results = []
        
        for suite_name in full_suites:
            try:
                result = self.run_test_suite(suite_name)
                results.append(result)
            except Exception as e:
                self.log(f"Failed to run {suite_name}: {e}", "ERROR")
                # Create a failed result
                failed_result = TestSuiteResult(
                    suite_name=suite_name,
                    total_tests=1,
                    passed_tests=0,
                    failed_tests=1,
                    total_duration_seconds=0,
                    test_results=[]
                )
                results.append(failed_result)
        
        return results

    def run_performance_tests(self) -> List[TestSuiteResult]:
        """Run performance tests"""
        self.log("Running performance tests...")
        
        performance_suites = ["performance_benchmark"]
        results = []
        
        for suite_name in performance_suites:
            try:
                result = self.run_test_suite(suite_name)
                results.append(result)
            except Exception as e:
                self.log(f"Failed to run {suite_name}: {e}", "ERROR")
                # Create a failed result
                failed_result = TestSuiteResult(
                    suite_name=suite_name,
                    total_tests=1,
                    passed_tests=0,
                    failed_tests=1,
                    total_duration_seconds=0,
                    test_results=[]
                )
                results.append(failed_result)
        
        return results

    def run_monitoring_tests(self) -> List[TestSuiteResult]:
        """Run monitoring and debugging tests"""
        self.log("Running monitoring tests...")
        
        monitoring_suites = ["debug_monitor", "network_monitor"]
        results = []
        
        for suite_name in monitoring_suites:
            try:
                result = self.run_test_suite(suite_name)
                results.append(result)
            except Exception as e:
                self.log(f"Failed to run {suite_name}: {e}", "ERROR")
                # Create a failed result
                failed_result = TestSuiteResult(
                    suite_name=suite_name,
                    total_tests=1,
                    passed_tests=0,
                    failed_tests=1,
                    total_duration_seconds=0,
                    test_results=[]
                )
                results.append(failed_result)
        
        return results

    def run_all_tests(self) -> List[TestSuiteResult]:
        """Run all available tests"""
        self.log("Running all tests...")
        
        all_suites = list(self.test_configs.keys())
        results = []
        
        for suite_name in all_suites:
            try:
                result = self.run_test_suite(suite_name)
                results.append(result)
            except Exception as e:
                self.log(f"Failed to run {suite_name}: {e}", "ERROR")
                # Create a failed result
                failed_result = TestSuiteResult(
                    suite_name=suite_name,
                    total_tests=1,
                    passed_tests=0,
                    failed_tests=1,
                    total_duration_seconds=0,
                    test_results=[]
                )
                results.append(failed_result)
        
        return results

    def generate_summary(self, results: List[TestSuiteResult]) -> Dict[str, Any]:
        """Generate test summary"""
        total_tests = sum(result.total_tests for result in results)
        total_passed = sum(result.passed_tests for result in results)
        total_failed = sum(result.failed_tests for result in results)
        total_duration = sum(result.total_duration_seconds for result in results)
        
        overall_success = total_failed == 0
        
        return {
            "overall": {
                "success": overall_success,
                "total_tests": total_tests,
                "passed_tests": total_passed,
                "failed_tests": total_failed,
                "success_rate": (total_passed / total_tests * 100) if total_tests > 0 else 0,
                "total_duration_seconds": total_duration
            },
            "test_suites": [asdict(result) for result in results],
            "timestamp": datetime.now().isoformat(),
            "backend_url": self.backend_url
        }

    def print_summary(self, results: List[TestSuiteResult]):
        """Print test summary to console"""
        summary = self.generate_summary(results)
        
        print("\n" + "=" * 80)
        print("MCP INTEGRATION TEST RUNNER SUMMARY")
        print("=" * 80)
        
        # Overall results
        overall = summary["overall"]
        status = "✓ PASSED" if overall["success"] else "✗ FAILED"
        print(f"Overall Result: {status}")
        print(f"Total Tests: {overall['total_tests']}")
        print(f"Passed: {overall['passed_tests']}")
        print(f"Failed: {overall['failed_tests']}")
        print(f"Success Rate: {overall['success_rate']:.1f}%")
        print(f"Total Duration: {overall['total_duration_seconds']:.2f} seconds")
        
        # Test suite results
        print(f"\nTest Suite Results:")
        for result in results:
            status = "✓ PASS" if result.failed_tests == 0 else "✗ FAIL"
            print(f"  {status} {result.suite_name} ({result.total_duration_seconds:.2f}s)")
            print(f"    Tests: {result.passed_tests}/{result.total_tests} passed")
            
            # Show individual test results if verbose
            if self.verbose and result.test_results:
                for test_result in result.test_results:
                    test_status = "✓" if test_result.success else "✗"
                    print(f"      {test_status} {test_result.test_name} ({test_result.duration_seconds:.2f}s)")
                    if not test_result.success and test_result.error_message:
                        print(f"        Error: {test_result.error_message}")
        
        print("=" * 80)

    def save_report(self, results: List[TestSuiteResult], filename: str = None):
        """Save test report to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"test_runner_report_{timestamp}.json"
        
        summary = self.generate_summary(results)
        
        with open(filename, 'w') as f:
            json.dump(summary, f, indent=2)
        
        self.log(f"Test report saved to: {filename}")
        return filename

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="MCP Integration Test Runner")
    parser.add_argument("--quick", action="store_true", 
                       help="Run quick verification tests")
    parser.add_argument("--full", action="store_true", 
                       help="Run full integration tests")
    parser.add_argument("--performance", action="store_true", 
                       help="Run performance tests")
    parser.add_argument("--monitoring", action="store_true", 
                       help="Run monitoring tests")
    parser.add_argument("--all", action="store_true", 
                       help="Run all tests")
    parser.add_argument("--backend-url", default="http://localhost:3000", 
                       help="Backend URL (default: http://localhost:3000)")
    parser.add_argument("--verbose", "-v", action="store_true", 
                       help="Enable verbose output")
    parser.add_argument("--report", help="Save report to specific file")
    parser.add_argument("--check-prerequisites", action="store_true", 
                       help="Check prerequisites and exit")
    
    args = parser.parse_args()
    
    # Create test runner
    runner = MCPTestRunner(verbose=args.verbose, backend_url=args.backend_url)
    
    try:
        # Check prerequisites
        if not runner.check_prerequisites():
            runner.log("Prerequisites check failed", "ERROR")
            if args.check_prerequisites:
                sys.exit(1)
            else:
                runner.log("Continuing despite prerequisite failures...", "WARN")
        
        if args.check_prerequisites:
            runner.log("Prerequisites check passed")
            sys.exit(0)
        
        # Determine which tests to run
        results = []
        
        if args.quick:
            results.extend(runner.run_quick_tests())
        elif args.full:
            results.extend(runner.run_full_tests())
        elif args.performance:
            results.extend(runner.run_performance_tests())
        elif args.monitoring:
            results.extend(runner.run_monitoring_tests())
        elif args.all:
            results.extend(runner.run_all_tests())
        else:
            # Default to quick tests
            results.extend(runner.run_quick_tests())
        
        # Generate and save report
        report_file = runner.save_report(results, args.report)
        
        # Print summary
        runner.print_summary(results)
        
        # Exit with appropriate code
        summary = runner.generate_summary(results)
        exit_code = 0 if summary["overall"]["success"] else 1
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        runner.log("Test runner interrupted by user", "WARN")
        sys.exit(1)
    except Exception as e:
        runner.log(f"Test runner failed: {e}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()
