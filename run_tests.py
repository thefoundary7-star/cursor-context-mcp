#!/usr/bin/env python3
"""
Test Runner for MCP Server Platform

Comprehensive test runner that executes all test suites with proper configuration,
coverage reporting, and result analysis.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import subprocess
import argparse
import json
import time
from pathlib import Path
from typing import List, Dict, Any

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


class TestRunner:
    """Test runner for MCP server platform."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.results = {}
        self.start_time = None
    
    def run_command(self, command: List[str], description: str) -> Dict[str, Any]:
        """Run a command and return results."""
        print(f"\n{'='*60}")
        print(f"Running: {description}")
        print(f"Command: {' '.join(command)}")
        print(f"{'='*60}")
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "duration": duration,
                "description": description
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": "Command timed out after 5 minutes",
                "duration": 300,
                "description": description
            }
        except Exception as e:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": str(e),
                "duration": 0,
                "description": description
            }
    
    def run_unit_tests(self) -> Dict[str, Any]:
        """Run unit tests."""
        command = [
            sys.executable, "-m", "pytest",
            "tests/test_mcp_server.py",
            "-v",
            "--tb=short",
            "--cov=official_mcp_server",
            "--cov=mcp_config_manager",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov/unit",
            "--cov-report=xml:coverage_unit.xml",
            "--junitxml=test_results_unit.xml"
        ]
        
        if not self.verbose:
            command.append("-q")
        
        return self.run_command(command, "Unit Tests")
    
    def run_integration_tests(self) -> Dict[str, Any]:
        """Run integration tests."""
        command = [
            sys.executable, "-m", "pytest",
            "tests/test_config_integration.py",
            "-v",
            "--tb=short",
            "--cov=official_mcp_server",
            "--cov=mcp_config_manager",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov/integration",
            "--cov-report=xml:coverage_integration.xml",
            "--junitxml=test_results_integration.xml"
        ]
        
        if not self.verbose:
            command.append("-q")
        
        return self.run_command(command, "Integration Tests")
    
    def run_security_tests(self) -> Dict[str, Any]:
        """Run security audit tests."""
        command = [
            sys.executable, "test_directory_access.py",
            "--verbose" if self.verbose else "",
            "--output", "security_audit_results.json"
        ]
        
        # Remove empty strings
        command = [c for c in command if c]
        
        return self.run_command(command, "Security Audit Tests")
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests together."""
        command = [
            sys.executable, "-m", "pytest",
            "tests/",
            "-v",
            "--tb=short",
            "--cov=official_mcp_server",
            "--cov=mcp_config_manager",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov/all",
            "--cov-report=xml:coverage_all.xml",
            "--junitxml=test_results_all.xml",
            "--maxfail=5"  # Stop after 5 failures
        ]
        
        if not self.verbose:
            command.append("-q")
        
        return self.run_command(command, "All Tests")
    
    def run_code_quality_checks(self) -> Dict[str, Any]:
        """Run code quality checks."""
        results = {}
        
        # Flake8 linting
        flake8_command = [sys.executable, "-m", "flake8", "official_mcp_server.py", "mcp_config_manager.py", "tests/"]
        results["flake8"] = self.run_command(flake8_command, "Flake8 Linting")
        
        # Black formatting check
        black_command = [sys.executable, "-m", "black", "--check", "official_mcp_server.py", "mcp_config_manager.py", "tests/"]
        results["black"] = self.run_command(black_command, "Black Formatting Check")
        
        # isort import sorting check
        isort_command = [sys.executable, "-m", "isort", "--check-only", "official_mcp_server.py", "mcp_config_manager.py", "tests/"]
        results["isort"] = self.run_command(isort_command, "Import Sorting Check")
        
        # MyPy type checking
        mypy_command = [sys.executable, "-m", "mypy", "official_mcp_server.py", "mcp_config_manager.py"]
        results["mypy"] = self.run_command(mypy_command, "MyPy Type Checking")
        
        return results
    
    def run_security_checks(self) -> Dict[str, Any]:
        """Run security checks."""
        results = {}
        
        # Bandit security linting
        bandit_command = [sys.executable, "-m", "bandit", "-r", "official_mcp_server.py", "mcp_config_manager.py"]
        results["bandit"] = self.run_command(bandit_command, "Bandit Security Linting")
        
        # Safety dependency check
        safety_command = [sys.executable, "-m", "safety", "check"]
        results["safety"] = self.run_command(safety_command, "Safety Dependency Check")
        
        return results
    
    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate a comprehensive test report."""
        report = []
        report.append("MCP Server Platform Test Report")
        report.append("=" * 50)
        report.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Duration: {sum(r.get('duration', 0) for r in results.values()):.2f} seconds")
        report.append("")
        
        # Summary
        total_tests = len(results)
        passed_tests = sum(1 for r in results.values() if r.get('success', False))
        failed_tests = total_tests - passed_tests
        
        report.append("SUMMARY")
        report.append("-" * 20)
        report.append(f"Total Test Suites: {total_tests}")
        report.append(f"Passed: {passed_tests}")
        report.append(f"Failed: {failed_tests}")
        report.append(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        report.append("")
        
        # Detailed results
        report.append("DETAILED RESULTS")
        report.append("-" * 20)
        
        for name, result in results.items():
            status = "PASS" if result.get('success', False) else "FAIL"
            duration = result.get('duration', 0)
            description = result.get('description', name)
            
            report.append(f"{status}: {description} ({duration:.2f}s)")
            
            if not result.get('success', False) and result.get('stderr'):
                report.append(f"  Error: {result['stderr'][:200]}...")
        
        report.append("")
        
        # Coverage information
        coverage_files = [
            "coverage_unit.xml",
            "coverage_integration.xml", 
            "coverage_all.xml"
        ]
        
        for coverage_file in coverage_files:
            if os.path.exists(coverage_file):
                report.append(f"Coverage report available: {coverage_file}")
        
        report.append("")
        report.append("HTML reports available in htmlcov/ directory")
        
        return "\n".join(report)
    
    def run_tests(self, test_types: List[str]) -> Dict[str, Any]:
        """Run specified test types."""
        self.start_time = time.time()
        results = {}
        
        if "unit" in test_types:
            results["unit_tests"] = self.run_unit_tests()
        
        if "integration" in test_types:
            results["integration_tests"] = self.run_integration_tests()
        
        if "security" in test_types:
            results["security_tests"] = self.run_security_tests()
        
        if "all" in test_types:
            results["all_tests"] = self.run_all_tests()
        
        if "quality" in test_types:
            quality_results = self.run_code_quality_checks()
            results.update(quality_results)
        
        if "security_checks" in test_types:
            security_results = self.run_security_checks()
            results.update(security_results)
        
        return results


def main():
    """Main function for test runner."""
    parser = argparse.ArgumentParser(
        description="Test Runner for MCP Server Platform",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --unit                    # Run unit tests only
  %(prog)s --integration             # Run integration tests only
  %(prog)s --security                # Run security tests only
  %(prog)s --all                     # Run all tests
  %(prog)s --quality                 # Run code quality checks
  %(prog)s --full                    # Run everything
  %(prog)s --verbose                 # Verbose output
  %(prog)s --report report.txt       # Save report to file
        """
    )
    
    parser.add_argument('--unit', action='store_true', help='Run unit tests')
    parser.add_argument('--integration', action='store_true', help='Run integration tests')
    parser.add_argument('--security', action='store_true', help='Run security tests')
    parser.add_argument('--all', action='store_true', help='Run all tests')
    parser.add_argument('--quality', action='store_true', help='Run code quality checks')
    parser.add_argument('--security-checks', action='store_true', help='Run security checks')
    parser.add_argument('--full', action='store_true', help='Run everything')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--report', help='Save report to file')
    
    args = parser.parse_args()
    
    # Determine which tests to run
    test_types = []
    
    if args.full:
        test_types = ["unit", "integration", "security", "all", "quality", "security_checks"]
    else:
        if args.unit:
            test_types.append("unit")
        if args.integration:
            test_types.append("integration")
        if args.security:
            test_types.append("security")
        if args.all:
            test_types.append("all")
        if args.quality:
            test_types.append("quality")
        if args.security_checks:
            test_types.append("security_checks")
    
    # Default to unit tests if nothing specified
    if not test_types:
        test_types = ["unit"]
    
    # Run tests
    runner = TestRunner(verbose=args.verbose)
    results = runner.run_tests(test_types)
    
    # Generate and display report
    report = runner.generate_report(results)
    print("\n" + report)
    
    # Save report to file if requested
    if args.report:
        try:
            with open(args.report, 'w') as f:
                f.write(report)
            print(f"\nReport saved to: {args.report}")
        except Exception as e:
            print(f"\nFailed to save report: {e}")
    
    # Save detailed results as JSON
    try:
        with open("test_results_detailed.json", 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print("Detailed results saved to: test_results_detailed.json")
    except Exception as e:
        print(f"Failed to save detailed results: {e}")
    
    # Exit with appropriate code
    failed_tests = sum(1 for r in results.values() if not r.get('success', False))
    sys.exit(1 if failed_tests > 0 else 0)


if __name__ == "__main__":
    main()
