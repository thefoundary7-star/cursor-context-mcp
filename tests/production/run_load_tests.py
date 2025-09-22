#!/usr/bin/env python3
"""
Load Testing Runner for FileBridge Production

This script runs Artillery load tests and generates comprehensive reports
for production validation.
"""

import os
import sys
import json
import time
import subprocess
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import asyncio
import aiohttp
import aiofiles


class LoadTestRunner:
    """Load testing runner for FileBridge production validation."""
    
    def __init__(self, config_dir: str = "tests/production"):
        self.config_dir = Path(config_dir)
        self.results_dir = Path("test_results/load_tests")
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Test configurations
        self.test_configs = {
            "general": "artillery_config.yml",
            "webhooks": "artillery_webhook_load.yml",
            "database": "artillery_database_load.yml"
        }
        
        # Performance thresholds
        self.thresholds = {
            "response_time_p95": 2000,  # 2 seconds
            "response_time_p99": 5000,  # 5 seconds
            "success_rate": 0.95,       # 95%
            "error_rate_4xx": 0.05,     # 5%
            "error_rate_5xx": 0.01      # 1%
        }
    
    def check_artillery_installation(self) -> bool:
        """Check if Artillery is installed."""
        try:
            result = subprocess.run(
                ["artillery", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"Artillery version: {result.stdout.strip()}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Artillery is not installed. Please install it with: npm install -g artillery")
            return False
    
    def run_load_test(self, test_name: str, config_file: str, environment: str = "production") -> Dict[str, Any]:
        """Run a single load test."""
        config_path = self.config_dir / config_file
        
        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        # Generate output file path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = self.results_dir / f"{test_name}_{timestamp}.json"
        
        print(f"Running {test_name} load test...")
        print(f"Config: {config_path}")
        print(f"Environment: {environment}")
        print(f"Output: {output_file}")
        
        # Run Artillery
        cmd = [
            "artillery",
            "run",
            str(config_path),
            "--environment", environment,
            "--output", str(output_file)
        ]
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            print(f"Load test completed in {duration:.2f} seconds")
            
            # Load results
            if output_file.exists():
                with open(output_file, 'r') as f:
                    results = json.load(f)
                
                return {
                    "test_name": test_name,
                    "config_file": config_file,
                    "environment": environment,
                    "duration": duration,
                    "results": results,
                    "output_file": str(output_file),
                    "success": True
                }
            else:
                return {
                    "test_name": test_name,
                    "config_file": config_file,
                    "environment": environment,
                    "duration": duration,
                    "results": None,
                    "output_file": str(output_file),
                    "success": False,
                    "error": "Output file not created"
                }
                
        except subprocess.CalledProcessError as e:
            end_time = time.time()
            duration = end_time - start_time
            
            print(f"Load test failed: {e}")
            print(f"Error output: {e.stderr}")
            
            return {
                "test_name": test_name,
                "config_file": config_file,
                "environment": environment,
                "duration": duration,
                "results": None,
                "output_file": str(output_file),
                "success": False,
                "error": str(e)
            }
    
    def analyze_results(self, test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze load test results."""
        if not test_results["success"] or not test_results["results"]:
            return {
                "passed": False,
                "error": test_results.get("error", "No results to analyze")
            }
        
        results = test_results["results"]
        
        # Extract metrics
        metrics = {}
        
        if "aggregate" in results:
            aggregate = results["aggregate"]
            
            # Response time metrics
            if "latency" in aggregate:
                latency = aggregate["latency"]
                metrics["response_time_min"] = latency.get("min", 0)
                metrics["response_time_max"] = latency.get("max", 0)
                metrics["response_time_median"] = latency.get("median", 0)
                metrics["response_time_p95"] = latency.get("p95", 0)
                metrics["response_time_p99"] = latency.get("p99", 0)
            
            # Request metrics
            if "requests" in aggregate:
                requests = aggregate["requests"]
                metrics["total_requests"] = requests.get("total", 0)
                metrics["requests_per_second"] = requests.get("rate", 0)
            
            # Response code metrics
            if "codes" in aggregate:
                codes = aggregate["codes"]
                total_requests = sum(codes.values())
                
                if total_requests > 0:
                    metrics["success_rate"] = codes.get("200", 0) / total_requests
                    metrics["error_rate_4xx"] = sum(
                        codes.get(str(code), 0) for code in range(400, 500)
                    ) / total_requests
                    metrics["error_rate_5xx"] = sum(
                        codes.get(str(code), 0) for code in range(500, 600)
                    ) / total_requests
        
        # Check thresholds
        threshold_checks = {}
        
        if "response_time_p95" in metrics:
            threshold_checks["response_time_p95"] = {
                "value": metrics["response_time_p95"],
                "threshold": self.thresholds["response_time_p95"],
                "passed": metrics["response_time_p95"] <= self.thresholds["response_time_p95"]
            }
        
        if "response_time_p99" in metrics:
            threshold_checks["response_time_p99"] = {
                "value": metrics["response_time_p99"],
                "threshold": self.thresholds["response_time_p99"],
                "passed": metrics["response_time_p99"] <= self.thresholds["response_time_p99"]
            }
        
        if "success_rate" in metrics:
            threshold_checks["success_rate"] = {
                "value": metrics["success_rate"],
                "threshold": self.thresholds["success_rate"],
                "passed": metrics["success_rate"] >= self.thresholds["success_rate"]
            }
        
        if "error_rate_4xx" in metrics:
            threshold_checks["error_rate_4xx"] = {
                "value": metrics["error_rate_4xx"],
                "threshold": self.thresholds["error_rate_4xx"],
                "passed": metrics["error_rate_4xx"] <= self.thresholds["error_rate_4xx"]
            }
        
        if "error_rate_5xx" in metrics:
            threshold_checks["error_rate_5xx"] = {
                "value": metrics["error_rate_5xx"],
                "threshold": self.thresholds["error_rate_5xx"],
                "passed": metrics["error_rate_5xx"] <= self.thresholds["error_rate_5xx"]
            }
        
        # Overall pass/fail
        all_passed = all(check["passed"] for check in threshold_checks.values())
        
        return {
            "passed": all_passed,
            "metrics": metrics,
            "threshold_checks": threshold_checks,
            "summary": {
                "total_requests": metrics.get("total_requests", 0),
                "requests_per_second": metrics.get("requests_per_second", 0),
                "response_time_p95": metrics.get("response_time_p95", 0),
                "response_time_p99": metrics.get("response_time_p99", 0),
                "success_rate": metrics.get("success_rate", 0),
                "error_rate_4xx": metrics.get("error_rate_4xx", 0),
                "error_rate_5xx": metrics.get("error_rate_5xx", 0)
            }
        }
    
    def generate_report(self, all_results: List[Dict[str, Any]]) -> str:
        """Generate comprehensive load test report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.results_dir / f"load_test_report_{timestamp}.md"
        
        with open(report_file, 'w') as f:
            f.write("# FileBridge Production Load Test Report\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Summary
            f.write("## Summary\n\n")
            total_tests = len(all_results)
            passed_tests = sum(1 for result in all_results if result["analysis"]["passed"])
            failed_tests = total_tests - passed_tests
            
            f.write(f"- **Total Tests:** {total_tests}\n")
            f.write(f"- **Passed:** {passed_tests}\n")
            f.write(f"- **Failed:** {failed_tests}\n")
            f.write(f"- **Success Rate:** {(passed_tests/total_tests)*100:.1f}%\n\n")
            
            # Test Results
            f.write("## Test Results\n\n")
            
            for result in all_results:
                test_name = result["test_name"]
                analysis = result["analysis"]
                
                f.write(f"### {test_name}\n\n")
                f.write(f"**Status:** {'✅ PASSED' if analysis['passed'] else '❌ FAILED'}\n")
                f.write(f"**Duration:** {result['duration']:.2f} seconds\n")
                f.write(f"**Config:** {result['config_file']}\n")
                f.write(f"**Environment:** {result['environment']}\n\n")
                
                if analysis["passed"]:
                    summary = analysis["summary"]
                    f.write("**Performance Metrics:**\n")
                    f.write(f"- Total Requests: {summary['total_requests']:,}\n")
                    f.write(f"- Requests/Second: {summary['requests_per_second']:.2f}\n")
                    f.write(f"- Response Time P95: {summary['response_time_p95']:.2f}ms\n")
                    f.write(f"- Response Time P99: {summary['response_time_p99']:.2f}ms\n")
                    f.write(f"- Success Rate: {summary['success_rate']:.1%}\n")
                    f.write(f"- 4xx Error Rate: {summary['error_rate_4xx']:.1%}\n")
                    f.write(f"- 5xx Error Rate: {summary['error_rate_5xx']:.1%}\n\n")
                else:
                    f.write(f"**Error:** {analysis.get('error', 'Unknown error')}\n\n")
                
                # Threshold Checks
                if "threshold_checks" in analysis:
                    f.write("**Threshold Checks:**\n")
                    for check_name, check in analysis["threshold_checks"].items():
                        status = "✅" if check["passed"] else "❌"
                        f.write(f"- {check_name}: {status} {check['value']:.2f} (threshold: {check['threshold']})\n")
                    f.write("\n")
            
            # Recommendations
            f.write("## Recommendations\n\n")
            
            if failed_tests > 0:
                f.write("### Performance Issues Detected\n\n")
                f.write("The following performance issues were detected:\n\n")
                
                for result in all_results:
                    if not result["analysis"]["passed"]:
                        test_name = result["test_name"]
                        analysis = result["analysis"]
                        
                        f.write(f"**{test_name}:**\n")
                        
                        if "threshold_checks" in analysis:
                            for check_name, check in analysis["threshold_checks"].items():
                                if not check["passed"]:
                                    f.write(f"- {check_name}: {check['value']:.2f} exceeds threshold of {check['threshold']}\n")
                        
                        f.write("\n")
                
                f.write("### Recommended Actions\n\n")
                f.write("1. **Optimize Database Queries:** Review and optimize slow database queries\n")
                f.write("2. **Increase Server Resources:** Consider scaling up server instances\n")
                f.write("3. **Implement Caching:** Add caching layers for frequently accessed data\n")
                f.write("4. **Load Balancing:** Implement load balancing for better distribution\n")
                f.write("5. **Connection Pooling:** Optimize database connection pooling\n")
                f.write("6. **Code Optimization:** Profile and optimize application code\n\n")
            else:
                f.write("### All Tests Passed! 🎉\n\n")
                f.write("The system is performing well under load. Consider the following for continued optimization:\n\n")
                f.write("1. **Monitor Performance:** Set up continuous performance monitoring\n")
                f.write("2. **Regular Testing:** Schedule regular load tests\n")
                f.write("3. **Capacity Planning:** Plan for future growth\n")
                f.write("4. **Optimization:** Continue optimizing for better performance\n\n")
            
            # Technical Details
            f.write("## Technical Details\n\n")
            f.write("### Test Configuration\n\n")
            f.write("```yaml\n")
            f.write("Thresholds:\n")
            for key, value in self.thresholds.items():
                f.write(f"  {key}: {value}\n")
            f.write("```\n\n")
            
            f.write("### Test Files\n\n")
            for result in all_results:
                f.write(f"- **{result['test_name']}:** {result['config_file']}\n")
            f.write("\n")
        
        return str(report_file)
    
    def run_all_tests(self, environment: str = "production") -> List[Dict[str, Any]]:
        """Run all load tests."""
        print("Starting FileBridge Production Load Tests")
        print("=" * 50)
        
        # Check Artillery installation
        if not self.check_artillery_installation():
            return []
        
        all_results = []
        
        for test_name, config_file in self.test_configs.items():
            print(f"\n{'='*20} {test_name.upper()} {'='*20}")
            
            try:
                # Run test
                result = self.run_load_test(test_name, config_file, environment)
                
                # Analyze results
                analysis = self.analyze_results(result)
                result["analysis"] = analysis
                
                all_results.append(result)
                
                # Print summary
                if analysis["passed"]:
                    print(f"✅ {test_name} test PASSED")
                    summary = analysis["summary"]
                    print(f"   Requests: {summary['total_requests']:,}")
                    print(f"   RPS: {summary['requests_per_second']:.2f}")
                    print(f"   P95: {summary['response_time_p95']:.2f}ms")
                    print(f"   Success Rate: {summary['success_rate']:.1%}")
                else:
                    print(f"❌ {test_name} test FAILED")
                    if "error" in analysis:
                        print(f"   Error: {analysis['error']}")
                    else:
                        print("   Threshold checks failed")
                
            except Exception as e:
                print(f"❌ {test_name} test ERROR: {e}")
                all_results.append({
                    "test_name": test_name,
                    "config_file": config_file,
                    "environment": environment,
                    "duration": 0,
                    "results": None,
                    "output_file": None,
                    "success": False,
                    "error": str(e),
                    "analysis": {"passed": False, "error": str(e)}
                })
        
        return all_results
    
    def save_results(self, all_results: List[Dict[str, Any]]) -> str:
        """Save test results to JSON file."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = self.results_dir / f"load_test_results_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        
        return str(results_file)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Run FileBridge production load tests")
    parser.add_argument(
        "--environment",
        choices=["staging", "production"],
        default="production",
        help="Environment to test against"
    )
    parser.add_argument(
        "--test",
        choices=["general", "webhooks", "database", "all"],
        default="all",
        help="Specific test to run"
    )
    parser.add_argument(
        "--config-dir",
        default="tests/production",
        help="Directory containing test configurations"
    )
    
    args = parser.parse_args()
    
    # Create runner
    runner = LoadTestRunner(args.config_dir)
    
    if args.test == "all":
        # Run all tests
        results = runner.run_all_tests(args.environment)
    else:
        # Run specific test
        config_file = runner.test_configs[args.test]
        result = runner.run_load_test(args.test, config_file, args.environment)
        analysis = runner.analyze_results(result)
        result["analysis"] = analysis
        results = [result]
    
    if results:
        # Save results
        results_file = runner.save_results(results)
        print(f"\nResults saved to: {results_file}")
        
        # Generate report
        report_file = runner.generate_report(results)
        print(f"Report generated: {report_file}")
        
        # Print final summary
        print("\n" + "="*50)
        print("LOAD TEST SUMMARY")
        print("="*50)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results if result["analysis"]["passed"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ Some tests failed. Check the report for details.")
            sys.exit(1)
        else:
            print("\n✅ All tests passed!")
            sys.exit(0)
    else:
        print("No tests were run.")
        sys.exit(1)


if __name__ == "__main__":
    main()
