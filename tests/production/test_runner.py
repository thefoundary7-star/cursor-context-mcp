#!/usr/bin/env python3
"""
Production Validation Test Runner

This script runs the complete production validation test suite
including unit tests, integration tests, and load tests.
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


class ProductionTestRunner:
    """Production validation test runner."""
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.results_dir = Path("test_results/production_validation")
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Test categories
        self.test_categories = {
            "unit": {
                "command": ["python", "-m", "pytest", "tests/production/", "-v", "--tb=short"],
                "description": "Unit and integration tests"
            },
            "load": {
                "command": ["python", "tests/production/run_load_tests.py"],
                "description": "Load and performance tests"
            },
            "e2e": {
                "command": ["python", "-m", "pytest", "tests/production/test_e2e_payment_flow.py", "-v"],
                "description": "End-to-end payment flow tests"
            },
            "email": {
                "command": ["python", "-m", "pytest", "tests/production/test_email_validation.py", "-v"],
                "description": "Email system validation tests"
            },
            "database": {
                "command": ["python", "-m", "pytest", "tests/production/test_database_performance.py", "-v"],
                "description": "Database performance tests"
            },
            "webhook": {
                "command": ["python", "-m", "pytest", "tests/production/test_webhook_reliability.py", "-v"],
                "description": "Webhook reliability tests"
            },
            "user": {
                "command": ["python", "-m", "pytest", "tests/production/test_user_license_activation.py", "-v"],
                "description": "User registration and license activation tests"
            }
        }
    
    def check_dependencies(self) -> bool:
        """Check if all required dependencies are installed."""
        print("Checking dependencies...")
        
        # Check Python packages
        required_packages = [
            "pytest",
            "pytest-asyncio",
            "aiohttp",
            "aiofiles",
            "psutil"
        ]
        
        missing_packages = []
        for package in required_packages:
            try:
                __import__(package.replace("-", "_"))
            except ImportError:
                missing_packages.append(package)
        
        if missing_packages:
            print(f"Missing packages: {', '.join(missing_packages)}")
            print("Install with: pip install " + " ".join(missing_packages))
            return False
        
        # Check Artillery
        try:
            subprocess.run(
                ["artillery", "--version"],
                capture_output=True,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Artillery is not installed. Install with: npm install -g artillery")
            return False
        
        print("✅ All dependencies are installed")
        return True
    
    def run_test_category(self, category: str, environment: str = "production") -> Dict[str, Any]:
        """Run a specific test category."""
        if category not in self.test_categories:
            raise ValueError(f"Unknown test category: {category}")
        
        test_config = self.test_categories[category]
        print(f"\n{'='*20} {category.upper()} TESTS {'='*20}")
        print(f"Description: {test_config['description']}")
        
        # Prepare command
        cmd = test_config["command"].copy()
        
        # Add environment-specific arguments
        if category == "load":
            cmd.extend(["--environment", environment])
        
        # Add output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = self.results_dir / f"{category}_test_{timestamp}.json"
        
        print(f"Command: {' '.join(cmd)}")
        print(f"Output: {output_file}")
        
        # Run test
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=True
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            # Save output
            with open(output_file, 'w') as f:
                json.dump({
                    "category": category,
                    "command": cmd,
                    "duration": duration,
                    "return_code": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "success": True
                }, f, indent=2)
            
            print(f"✅ {category} tests completed successfully in {duration:.2f} seconds")
            
            return {
                "category": category,
                "success": True,
                "duration": duration,
                "output_file": str(output_file),
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
        except subprocess.CalledProcessError as e:
            end_time = time.time()
            duration = end_time - start_time
            
            # Save output
            with open(output_file, 'w') as f:
                json.dump({
                    "category": category,
                    "command": cmd,
                    "duration": duration,
                    "return_code": e.returncode,
                    "stdout": e.stdout,
                    "stderr": e.stderr,
                    "success": False
                }, f, indent=2)
            
            print(f"❌ {category} tests failed after {duration:.2f} seconds")
            print(f"Return code: {e.returncode}")
            if e.stderr:
                print(f"Error output: {e.stderr}")
            
            return {
                "category": category,
                "success": False,
                "duration": duration,
                "output_file": str(output_file),
                "stdout": e.stdout,
                "stderr": e.stderr,
                "return_code": e.returncode
            }
    
    def run_all_tests(self, environment: str = "production", categories: List[str] = None) -> List[Dict[str, Any]]:
        """Run all test categories."""
        if categories is None:
            categories = list(self.test_categories.keys())
        
        print("Starting FileBridge Production Validation Tests")
        print("=" * 60)
        print(f"Environment: {environment}")
        print(f"Test Categories: {', '.join(categories)}")
        print("=" * 60)
        
        # Check dependencies
        if not self.check_dependencies():
            print("❌ Dependency check failed. Please install missing dependencies.")
            return []
        
        all_results = []
        
        for category in categories:
            try:
                result = self.run_test_category(category, environment)
                all_results.append(result)
            except Exception as e:
                print(f"❌ Error running {category} tests: {e}")
                all_results.append({
                    "category": category,
                    "success": False,
                    "duration": 0,
                    "output_file": None,
                    "stdout": "",
                    "stderr": str(e),
                    "error": str(e)
                })
        
        return all_results
    
    def generate_summary_report(self, all_results: List[Dict[str, Any]]) -> str:
        """Generate summary report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.results_dir / f"production_validation_report_{timestamp}.md"
        
        with open(report_file, 'w') as f:
            f.write("# FileBridge Production Validation Report\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Summary
            f.write("## Summary\n\n")
            total_tests = len(all_results)
            passed_tests = sum(1 for result in all_results if result["success"])
            failed_tests = total_tests - passed_tests
            total_duration = sum(result["duration"] for result in all_results)
            
            f.write(f"- **Total Test Categories:** {total_tests}\n")
            f.write(f"- **Passed:** {passed_tests}\n")
            f.write(f"- **Failed:** {failed_tests}\n")
            f.write(f"- **Success Rate:** {(passed_tests/total_tests)*100:.1f}%\n")
            f.write(f"- **Total Duration:** {total_duration:.2f} seconds\n\n")
            
            # Test Results
            f.write("## Test Results\n\n")
            
            for result in all_results:
                category = result["category"]
                success = result["success"]
                duration = result["duration"]
                
                f.write(f"### {category.upper()} Tests\n\n")
                f.write(f"**Status:** {'✅ PASSED' if success else '❌ FAILED'}\n")
                f.write(f"**Duration:** {duration:.2f} seconds\n")
                
                if result.get("output_file"):
                    f.write(f"**Output File:** {result['output_file']}\n")
                
                if not success:
                    if result.get("stderr"):
                        f.write(f"**Error:** {result['stderr']}\n")
                    elif result.get("error"):
                        f.write(f"**Error:** {result['error']}\n")
                
                f.write("\n")
            
            # Recommendations
            f.write("## Recommendations\n\n")
            
            if failed_tests > 0:
                f.write("### Issues Detected\n\n")
                f.write("The following test categories failed:\n\n")
                
                for result in all_results:
                    if not result["success"]:
                        category = result["category"]
                        f.write(f"- **{category.upper()}:** ")
                        
                        if result.get("stderr"):
                            f.write(f"{result['stderr']}\n")
                        elif result.get("error"):
                            f.write(f"{result['error']}\n")
                        else:
                            f.write("Unknown error\n")
                
                f.write("\n### Recommended Actions\n\n")
                f.write("1. **Review Failed Tests:** Check the output files for detailed error information\n")
                f.write("2. **Fix Issues:** Address the root causes of test failures\n")
                f.write("3. **Re-run Tests:** Execute the failed test categories again\n")
                f.write("4. **Monitor Performance:** Set up continuous monitoring for production\n")
                f.write("5. **Document Issues:** Record any known issues and workarounds\n\n")
            else:
                f.write("### All Tests Passed! 🎉\n\n")
                f.write("The production validation suite completed successfully. The system is ready for production deployment.\n\n")
                f.write("### Next Steps\n\n")
                f.write("1. **Deploy to Production:** Proceed with production deployment\n")
                f.write("2. **Monitor Performance:** Set up production monitoring\n")
                f.write("3. **Schedule Regular Tests:** Run validation tests regularly\n")
                f.write("4. **Update Documentation:** Keep documentation up to date\n\n")
            
            # Technical Details
            f.write("## Technical Details\n\n")
            f.write("### Test Categories\n\n")
            for category, config in self.test_categories.items():
                f.write(f"- **{category.upper()}:** {config['description']}\n")
            f.write("\n")
            
            f.write("### Environment\n\n")
            f.write(f"- **Python Version:** {sys.version}\n")
            f.write(f"- **Platform:** {sys.platform}\n")
            f.write(f"- **Working Directory:** {os.getcwd()}\n\n")
        
        return str(report_file)
    
    def save_results(self, all_results: List[Dict[str, Any]]) -> str:
        """Save test results to JSON file."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = self.results_dir / f"production_validation_results_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        
        return str(results_file)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Run FileBridge production validation tests")
    parser.add_argument(
        "--environment",
        choices=["staging", "production"],
        default="production",
        help="Environment to test against"
    )
    parser.add_argument(
        "--categories",
        nargs="+",
        choices=["unit", "load", "e2e", "email", "database", "webhook", "user", "all"],
        default=["all"],
        help="Test categories to run"
    )
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root directory"
    )
    
    args = parser.parse_args()
    
    # Handle "all" category
    if "all" in args.categories:
        categories = ["unit", "load", "e2e", "email", "database", "webhook", "user"]
    else:
        categories = args.categories
    
    # Create runner
    runner = ProductionTestRunner(args.project_root)
    
    # Run tests
    results = runner.run_all_tests(args.environment, categories)
    
    if results:
        # Save results
        results_file = runner.save_results(results)
        print(f"\nResults saved to: {results_file}")
        
        # Generate report
        report_file = runner.generate_summary_report(results)
        print(f"Report generated: {report_file}")
        
        # Print final summary
        print("\n" + "="*60)
        print("PRODUCTION VALIDATION SUMMARY")
        print("="*60)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results if result["success"])
        failed_tests = total_tests - passed_tests
        total_duration = sum(result["duration"] for result in results)
        
        print(f"Total Test Categories: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Total Duration: {total_duration:.2f} seconds")
        
        if failed_tests > 0:
            print("\n❌ Some test categories failed. Check the report for details.")
            sys.exit(1)
        else:
            print("\n✅ All test categories passed!")
            print("🎉 Production validation completed successfully!")
            sys.exit(0)
    else:
        print("No tests were run.")
        sys.exit(1)


if __name__ == "__main__":
    main()
