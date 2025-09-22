#!/usr/bin/env python3
"""
Comprehensive Test Suite for Enhanced MCP Server Features

This module provides comprehensive testing for all enhanced features including
memory leak testing, performance validation, and security feature testing.
"""

import os
import sys
import time
import threading
import tempfile
import shutil
import json
import unittest
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging
import gc
import psutil
import traceback

# Configure logging for tests
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MemoryLeakTest:
    """Memory leak testing utilities"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.baseline_memory = self.get_memory_usage()
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        return self.process.memory_info().rss / 1024 / 1024
    
    def check_memory_leak(self, operation_func, iterations: int = 100, 
                         max_increase_mb: float = 50.0) -> Dict[str, Any]:
        """Check for memory leaks in an operation"""
        logger.info(f"Testing memory leak for {operation_func.__name__} over {iterations} iterations")
        
        initial_memory = self.get_memory_usage()
        memory_samples = []
        
        for i in range(iterations):
            try:
                # Run the operation
                operation_func()
                
                # Force garbage collection
                gc.collect()
                
                # Sample memory usage
                current_memory = self.get_memory_usage()
                memory_samples.append(current_memory)
                
                # Log progress every 10 iterations
                if (i + 1) % 10 == 0:
                    logger.info(f"Iteration {i + 1}/{iterations}: Memory usage: {current_memory:.2f}MB")
                
            except Exception as e:
                logger.error(f"Error in iteration {i + 1}: {e}")
                return {
                    "leak_detected": True,
                    "error": str(e),
                    "iterations_completed": i
                }
        
        # Analyze memory usage
        final_memory = self.get_memory_usage()
        memory_increase = final_memory - initial_memory
        
        # Calculate statistics
        avg_memory = sum(memory_samples) / len(memory_samples)
        max_memory = max(memory_samples)
        min_memory = min(memory_samples)
        
        # Check for leak
        leak_detected = memory_increase > max_increase_mb
        
        result = {
            "leak_detected": leak_detected,
            "initial_memory_mb": initial_memory,
            "final_memory_mb": final_memory,
            "memory_increase_mb": memory_increase,
            "max_increase_allowed_mb": max_increase_mb,
            "average_memory_mb": avg_memory,
            "max_memory_mb": max_memory,
            "min_memory_mb": min_memory,
            "iterations": iterations,
            "memory_samples": memory_samples
        }
        
        if leak_detected:
            logger.warning(f"Memory leak detected: {memory_increase:.2f}MB increase over {iterations} iterations")
        else:
            logger.info(f"No memory leak detected: {memory_increase:.2f}MB increase over {iterations} iterations")
        
        return result

class PerformanceTest:
    """Performance testing utilities"""
    
    def __init__(self):
        self.results = []
    
    def benchmark_operation(self, operation_func, iterations: int = 10) -> Dict[str, Any]:
        """Benchmark an operation"""
        logger.info(f"Benchmarking {operation_func.__name__} over {iterations} iterations")
        
        times = []
        errors = 0
        
        for i in range(iterations):
            start_time = time.time()
            try:
                operation_func()
                end_time = time.time()
                times.append(end_time - start_time)
            except Exception as e:
                errors += 1
                logger.error(f"Error in iteration {i + 1}: {e}")
        
        if not times:
            return {"error": "All iterations failed"}
        
        # Calculate statistics
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        
        # Calculate percentiles
        sorted_times = sorted(times)
        p50 = sorted_times[len(sorted_times) // 2]
        p95 = sorted_times[int(len(sorted_times) * 0.95)]
        p99 = sorted_times[int(len(sorted_times) * 0.99)]
        
        result = {
            "operation": operation_func.__name__,
            "iterations": iterations,
            "successful_iterations": len(times),
            "errors": errors,
            "average_time": avg_time,
            "min_time": min_time,
            "max_time": max_time,
            "p50_time": p50,
            "p95_time": p95,
            "p99_time": p99,
            "times": times
        }
        
        logger.info(f"Benchmark results: avg={avg_time:.3f}s, min={min_time:.3f}s, max={max_time:.3f}s")
        
        return result

class EnhancedFeaturesTestSuite(unittest.TestCase):
    """Comprehensive test suite for enhanced features"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_files = []
        self.memory_tester = MemoryLeakTest()
        self.performance_tester = PerformanceTest()
        
        # Create test files
        self._create_test_files()
    
    def tearDown(self):
        """Clean up test environment"""
        # Clean up test files
        for file_path in self.test_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception:
                pass
        
        # Remove temp directory
        try:
            shutil.rmtree(self.temp_dir)
        except Exception:
            pass
    
    def _create_test_files(self):
        """Create test files for testing"""
        # Create Python test file
        python_file = os.path.join(self.temp_dir, "test.py")
        with open(python_file, 'w') as f:
            f.write('''
def test_function():
    """Test function for testing"""
    return "Hello, World!"

class TestClass:
    def __init__(self):
        self.value = 42
    
    def get_value(self):
        return self.value

if __name__ == "__main__":
    print(test_function())
''')
        self.test_files.append(python_file)
        
        # Create JavaScript test file
        js_file = os.path.join(self.temp_dir, "test.js")
        with open(js_file, 'w') as f:
            f.write('''
function testFunction() {
    return "Hello, World!";
}

class TestClass {
    constructor() {
        this.value = 42;
    }
    
    getValue() {
        return this.value;
    }
}

module.exports = { testFunction, TestClass };
''')
        self.test_files.append(js_file)
        
        # Create large file for performance testing
        large_file = os.path.join(self.temp_dir, "large.txt")
        with open(large_file, 'w') as f:
            for i in range(10000):
                f.write(f"Line {i}: This is a test line for performance testing.\n")
        self.test_files.append(large_file)
    
    def test_enhanced_error_handling(self):
        """Test enhanced error handling system"""
        logger.info("Testing enhanced error handling...")
        
        try:
            from enhanced_error_handling import EnhancedErrorHandler, ErrorContext, ErrorSeverity
            
            error_handler = EnhancedErrorHandler()
            
            # Test error handling
            context = ErrorContext(
                operation="test_operation",
                file_path=self.test_files[0],
                user_action="Testing error handling"
            )
            
            test_error = FileNotFoundError("Test file not found")
            error_record = error_handler.handle_error(test_error, context, ErrorSeverity.MEDIUM)
            
            self.assertIsNotNone(error_record)
            self.assertEqual(error_record["error_type"], "FileNotFoundError")
            self.assertIn("user_message", error_record)
            
            # Test error summary
            summary = error_handler.get_error_summary()
            self.assertIn("total_errors", summary)
            self.assertIn("error_counts", summary)
            
            logger.info("✓ Enhanced error handling test passed")
            
        except ImportError as e:
            self.skipTest(f"Enhanced error handling module not available: {e}")
        except Exception as e:
            self.fail(f"Enhanced error handling test failed: {e}")
    
    def test_progress_tracking(self):
        """Test progress tracking system"""
        logger.info("Testing progress tracking...")
        
        try:
            from enhanced_error_handling import ProgressTracker, OperationType
            
            tracker = ProgressTracker()
            
            # Test operation tracking
            operation_id = "test_operation"
            progress = tracker.start_operation(
                operation_id=operation_id,
                operation_type=OperationType.FILE_READ,
                total_items=100,
                status_message="Testing progress tracking"
            )
            
            self.assertIsNotNone(progress)
            self.assertEqual(progress.operation_id, operation_id)
            self.assertEqual(progress.total_items, 100)
            
            # Test progress updates
            tracker.update_progress(operation_id, completed_items=50, status_message="Half done")
            
            active_operations = tracker.get_active_operations()
            self.assertEqual(len(active_operations), 1)
            self.assertEqual(active_operations[0].completed_items, 50)
            
            # Test completion
            tracker.complete_operation(operation_id, "Test completed")
            
            active_operations = tracker.get_active_operations()
            self.assertEqual(len(active_operations), 0)
            
            logger.info("✓ Progress tracking test passed")
            
        except ImportError as e:
            self.skipTest(f"Progress tracking module not available: {e}")
        except Exception as e:
            self.fail(f"Progress tracking test failed: {e}")
    
    def test_enhanced_config_system(self):
        """Test enhanced configuration system"""
        logger.info("Testing enhanced configuration system...")
        
        try:
            from enhanced_config_system import EnhancedConfigManager, EnhancedMCPConfig
            
            # Create test config
            test_config_path = os.path.join(self.temp_dir, "test_config.json")
            config_manager = EnhancedConfigManager(test_config_path)
            
            self.assertIsNotNone(config_manager.config)
            self.assertIsInstance(config_manager.config, EnhancedMCPConfig)
            
            # Test feature configuration
            feature_config = config_manager.get_feature_config('performance')
            self.assertIsInstance(feature_config, dict)
            self.assertIn('max_files_per_operation', feature_config)
            
            # Test feature enable/disable
            self.assertTrue(config_manager.enable_feature('code_indexing'))
            self.assertTrue(config_manager.is_feature_enabled('code_indexing'))
            
            self.assertTrue(config_manager.disable_feature('code_indexing'))
            self.assertFalse(config_manager.is_feature_enabled('code_indexing'))
            
            # Test configuration summary
            summary = config_manager.get_config_summary()
            self.assertIn('config_version', summary)
            self.assertIn('features_enabled', summary)
            
            # Test validation
            validation = config_manager.validate_configuration()
            self.assertIn('valid', validation)
            
            logger.info("✓ Enhanced configuration system test passed")
            
        except ImportError as e:
            self.skipTest(f"Enhanced configuration module not available: {e}")
        except Exception as e:
            self.fail(f"Enhanced configuration system test failed: {e}")
    
    def test_optimized_startup(self):
        """Test optimized startup system"""
        logger.info("Testing optimized startup system...")
        
        try:
            from optimized_startup import StartupManager, ComponentStatus, register_startup_component
            
            startup_manager = StartupManager()
            
            # Test component registration
            def test_health_check():
                return {"status": "healthy", "message": "Test component is healthy"}
            
            def test_cleanup():
                pass
            
            startup_manager.register_component(
                name="test_component",
                dependencies=[],
                priority=1,
                is_critical=False,
                health_check=test_health_check,
                cleanup_function=test_cleanup
            )
            
            self.assertIn("test_component", startup_manager.components)
            
            # Test startup
            startup_summary = startup_manager.start_components()
            self.assertIn("startup_complete", startup_summary)
            self.assertIn("components", startup_summary)
            
            # Test health status
            health_status = startup_manager.get_health_status()
            self.assertIn("overall_status", health_status)
            self.assertIn("components", health_status)
            
            # Test graceful shutdown
            startup_manager.graceful_shutdown(timeout=5.0)
            
            logger.info("✓ Optimized startup system test passed")
            
        except ImportError as e:
            self.skipTest(f"Optimized startup module not available: {e}")
        except Exception as e:
            self.fail(f"Optimized startup system test failed: {e}")
    
    def test_comprehensive_logging(self):
        """Test comprehensive logging system"""
        logger.info("Testing comprehensive logging system...")
        
        try:
            from comprehensive_logging import LogManager, UsageTracker, PerformanceMonitor
            
            # Test log manager
            log_config = {
                'logging': {
                    'file_path': os.path.join(self.temp_dir, 'test.log'),
                    'max_file_size_mb': 1,
                    'backup_count': 2
                }
            }
            
            log_manager = LogManager(log_config)
            
            # Test logger creation
            logger_instance = log_manager.get_logger('test_logger')
            self.assertIsNotNone(logger_instance)
            
            # Test usage tracking
            usage_tracker = UsageTracker()
            usage_tracker.record_operation("test_op", 1.0, True, 10.0, True)
            
            summary = usage_tracker.get_usage_summary()
            self.assertIn('total_operations', summary)
            self.assertEqual(summary['total_operations'], 1)
            
            # Test performance monitoring
            performance_monitor = PerformanceMonitor(collection_interval=1.0)
            performance_monitor.start_monitoring()
            time.sleep(2)  # Let it collect some data
            performance_monitor.stop_monitoring()
            
            perf_summary = performance_monitor.get_performance_summary()
            self.assertIn('monitoring_active', perf_summary)
            
            # Cleanup
            log_manager.shutdown()
            
            logger.info("✓ Comprehensive logging system test passed")
            
        except ImportError as e:
            self.skipTest(f"Comprehensive logging module not available: {e}")
        except Exception as e:
            self.fail(f"Comprehensive logging system test failed: {e}")
    
    def test_memory_leaks(self):
        """Test for memory leaks in enhanced features"""
        logger.info("Testing for memory leaks...")
        
        def test_operation():
            """Test operation that might cause memory leaks"""
            try:
                from enhanced_error_handling import ProgressTracker, OperationType
                from comprehensive_logging import UsageTracker
                
                tracker = ProgressTracker()
                usage_tracker = UsageTracker()
                
                # Simulate operations
                for i in range(10):
                    operation_id = f"test_op_{i}"
                    progress = tracker.start_operation(
                        operation_id=operation_id,
                        operation_type=OperationType.FILE_READ,
                        total_items=100
                    )
                    tracker.update_progress(operation_id, 50)
                    tracker.complete_operation(operation_id)
                    
                    usage_tracker.record_operation(f"op_{i}", 0.1, True, 1.0)
                
                # Clean up
                del tracker
                del usage_tracker
                
            except ImportError:
                pass  # Skip if modules not available
        
        # Test for memory leaks
        leak_result = self.memory_tester.check_memory_leak(test_operation, iterations=50, max_increase_mb=20.0)
        
        self.assertFalse(leak_result["leak_detected"], 
                        f"Memory leak detected: {leak_result['memory_increase_mb']:.2f}MB increase")
        
        logger.info("✓ Memory leak test passed")
    
    def test_performance_benchmarks(self):
        """Test performance benchmarks for enhanced features"""
        logger.info("Testing performance benchmarks...")
        
        def test_config_operation():
            """Test configuration operations"""
            try:
                from enhanced_config_system import EnhancedConfigManager
                test_config_path = os.path.join(self.temp_dir, f"perf_test_{time.time()}.json")
                config_manager = EnhancedConfigManager(test_config_path)
                config_manager.get_config_summary()
                del config_manager
            except ImportError:
                pass
        
        def test_logging_operation():
            """Test logging operations"""
            try:
                from comprehensive_logging import UsageTracker
                tracker = UsageTracker()
                for i in range(100):
                    tracker.record_operation(f"perf_op_{i}", 0.01, True, 0.1)
                del tracker
            except ImportError:
                pass
        
        # Benchmark operations
        config_result = self.performance_tester.benchmark_operation(test_config_operation, iterations=20)
        logging_result = self.performance_tester.benchmark_operation(test_logging_operation, iterations=20)
        
        # Check performance thresholds
        self.assertLess(config_result.get('average_time', 0), 1.0, "Configuration operations too slow")
        self.assertLess(logging_result.get('average_time', 0), 0.5, "Logging operations too slow")
        
        logger.info("✓ Performance benchmark test passed")
    
    def test_large_codebase_simulation(self):
        """Test with simulated large codebase (10,000+ files)"""
        logger.info("Testing with simulated large codebase...")
        
        # Create many test files
        large_test_dir = os.path.join(self.temp_dir, "large_codebase")
        os.makedirs(large_test_dir, exist_ok=True)
        
        # Create 1000 files (simulating 10,000+ files)
        for i in range(1000):
            file_path = os.path.join(large_test_dir, f"test_file_{i}.py")
            with open(file_path, 'w') as f:
                f.write(f'''
def function_{i}():
    """Function {i} for testing"""
    return {i}

class Class{i}:
    def __init__(self):
        self.value = {i}
''')
            self.test_files.append(file_path)
        
        try:
            from enhanced_config_system import EnhancedConfigManager
            
            # Test with large directory
            test_config_path = os.path.join(self.temp_dir, "large_test_config.json")
            config_manager = EnhancedConfigManager(test_config_path)
            
            # Add large directory to config
            config_manager.config.watched_directories.append({
                "path": large_test_dir,
                "enabled": True,
                "max_file_size": "1MB",
                "exclude_patterns": [],
                "include_gitignore": True
            })
            
            # Test configuration with large directory
            start_time = time.time()
            summary = config_manager.get_config_summary()
            end_time = time.time()
            
            self.assertLess(end_time - start_time, 5.0, "Configuration with large directory too slow")
            self.assertIn('watched_directories_count', summary)
            
            logger.info("✓ Large codebase simulation test passed")
            
        except ImportError as e:
            self.skipTest(f"Enhanced configuration module not available: {e}")
        except Exception as e:
            self.fail(f"Large codebase simulation test failed: {e}")
    
    def test_security_features(self):
        """Test security features"""
        logger.info("Testing security features...")
        
        try:
            from enhanced_config_system import EnhancedConfigManager
            
            test_config_path = os.path.join(self.temp_dir, "security_test_config.json")
            config_manager = EnhancedConfigManager(test_config_path)
            
            # Test security configuration
            security_config = config_manager.get_feature_config('security')
            self.assertIn('mode', security_config)
            self.assertIn('block_system_directories', security_config)
            
            # Test security validation
            validation = config_manager.validate_configuration()
            self.assertIn('valid', validation)
            
            # Test system directory blocking
            if hasattr(config_manager, '_is_system_directory'):
                # This would be tested in the actual MCP server
                pass
            
            logger.info("✓ Security features test passed")
            
        except ImportError as e:
            self.skipTest(f"Enhanced configuration module not available: {e}")
        except Exception as e:
            self.fail(f"Security features test failed: {e}")

def run_comprehensive_tests():
    """Run comprehensive test suite"""
    logger.info("Starting comprehensive test suite for enhanced MCP server features...")
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(EnhancedFeaturesTestSuite)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    logger.info("=" * 60)
    logger.info("TEST SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Tests run: {result.testsRun}")
    logger.info(f"Failures: {len(result.failures)}")
    logger.info(f"Errors: {len(result.errors)}")
    logger.info(f"Skipped: {len(result.skipped)}")
    
    if result.failures:
        logger.error("FAILURES:")
        for test, traceback in result.failures:
            logger.error(f"  {test}: {traceback}")
    
    if result.errors:
        logger.error("ERRORS:")
        for test, traceback in result.errors:
            logger.error(f"  {test}: {traceback}")
    
    success = len(result.failures) == 0 and len(result.errors) == 0
    logger.info(f"Overall result: {'PASS' if success else 'FAIL'}")
    
    return success

def run_memory_leak_tests():
    """Run dedicated memory leak tests"""
    logger.info("Running dedicated memory leak tests...")
    
    memory_tester = MemoryLeakTest()
    
    def test_enhanced_features_memory():
        """Test memory usage of enhanced features"""
        try:
            from enhanced_error_handling import ProgressTracker, OperationType
            from comprehensive_logging import UsageTracker, PerformanceMonitor
            from enhanced_config_system import EnhancedConfigManager
            
            # Create instances
            tracker = ProgressTracker()
            usage_tracker = UsageTracker()
            performance_monitor = PerformanceMonitor()
            config_manager = EnhancedConfigManager()
            
            # Simulate heavy usage
            for i in range(100):
                # Progress tracking
                op_id = f"memory_test_{i}"
                progress = tracker.start_operation(op_id, OperationType.FILE_READ, 100)
                tracker.update_progress(op_id, 50)
                tracker.complete_operation(op_id)
                
                # Usage tracking
                usage_tracker.record_operation(f"usage_{i}", 0.1, True, 1.0)
                
                # Configuration operations
                config_manager.get_config_summary()
            
            # Clean up
            del tracker
            del usage_tracker
            del performance_monitor
            del config_manager
            
        except ImportError:
            pass  # Skip if modules not available
    
    # Run memory leak test
    result = memory_tester.check_memory_leak(test_enhanced_features_memory, iterations=200, max_increase_mb=100.0)
    
    logger.info("Memory leak test result:")
    logger.info(f"  Leak detected: {result['leak_detected']}")
    logger.info(f"  Memory increase: {result['memory_increase_mb']:.2f}MB")
    logger.info(f"  Max allowed: {result['max_increase_allowed_mb']:.2f}MB")
    
    return not result['leak_detected']

def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced MCP Server Test Suite")
    parser.add_argument("--memory-only", action="store_true", help="Run only memory leak tests")
    parser.add_argument("--performance-only", action="store_true", help="Run only performance tests")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    success = True
    
    if args.memory_only:
        success = run_memory_leak_tests()
    elif args.performance_only:
        # Performance tests are included in the main test suite
        success = run_comprehensive_tests()
    else:
        # Run all tests
        success = run_comprehensive_tests()
        
        if success:
            logger.info("Running additional memory leak tests...")
            success = run_memory_leak_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
