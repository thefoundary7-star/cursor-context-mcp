#!/usr/bin/env python3
"""
Performance Optimization Examples for Enhanced MCP Server

This file demonstrates performance optimization techniques and best practices
for using the enhanced MCP server features efficiently.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import time
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add the parent directory to the path to import MCP server modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from official_mcp_server import (
        search_symbols,
        find_references,
        get_index_statistics,
        performance_stats,
        cache_stats,
        clear_caches,
        configure_performance_limits,
        start_file_monitoring,
        stop_file_monitoring,
        get_recent_changes
    )
except ImportError as e:
    print(f"Error importing MCP server modules: {e}")
    sys.exit(1)


class PerformanceOptimizer:
    """Performance optimization utilities for MCP server."""
    
    def __init__(self, project_directory: str = "."):
        """Initialize the performance optimizer."""
        self.project_directory = Path(project_directory).resolve()
        self.benchmark_results = {}
        
    def benchmark_operations(self):
        """Benchmark various MCP operations to identify performance bottlenecks."""
        print("🚀 Performance Benchmarking")
        print("=" * 40)
        
        benchmarks = [
            ("Symbol Search", self._benchmark_symbol_search),
            ("Reference Finding", self._benchmark_reference_finding),
            ("Index Statistics", self._benchmark_index_statistics),
            ("Cache Operations", self._benchmark_cache_operations),
            ("File Monitoring", self._benchmark_file_monitoring)
        ]
        
        for name, benchmark_func in benchmarks:
            print(f"\n📊 Benchmarking {name}...")
            try:
                result = benchmark_func()
                self.benchmark_results[name] = result
                print(f"   ✅ {name}: {result['average_time']:.3f}s average")
            except Exception as e:
                print(f"   ❌ {name} failed: {e}")
                self.benchmark_results[name] = {"error": str(e)}
        
        self._print_benchmark_summary()
    
    def _benchmark_symbol_search(self) -> Dict[str, Any]:
        """Benchmark symbol search operations."""
        queries = ["function", "class", "def", "import", "return"]
        times = []
        
        for query in queries:
            start_time = time.time()
            result = search_symbols(query, directory=str(self.project_directory))
            end_time = time.time()
            
            if result["success"]:
                times.append(end_time - start_time)
            else:
                print(f"   Warning: Search failed for '{query}': {result['error']}")
        
        return {
            "operations": len(times),
            "total_time": sum(times),
            "average_time": sum(times) / len(times) if times else 0,
            "min_time": min(times) if times else 0,
            "max_time": max(times) if times else 0
        }
    
    def _benchmark_reference_finding(self) -> Dict[str, Any]:
        """Benchmark reference finding operations."""
        # First, find some symbols to search references for
        search_result = search_symbols("def", directory=str(self.project_directory))
        if not search_result["success"] or not search_result["symbols"]:
            return {"error": "No symbols found for reference testing"}
        
        symbol_names = [s["name"] for s in search_result["symbols"][:5]]  # Test first 5
        times = []
        
        for symbol_name in symbol_names:
            start_time = time.time()
            result = find_references(symbol_name, directory=str(self.project_directory))
            end_time = time.time()
            
            if result["success"]:
                times.append(end_time - start_time)
            else:
                print(f"   Warning: Reference search failed for '{symbol_name}': {result['error']}")
        
        return {
            "operations": len(times),
            "total_time": sum(times),
            "average_time": sum(times) / len(times) if times else 0,
            "min_time": min(times) if times else 0,
            "max_time": max(times) if times else 0
        }
    
    def _benchmark_index_statistics(self) -> Dict[str, Any]:
        """Benchmark index statistics operations."""
        times = []
        
        for _ in range(10):  # Run 10 times
            start_time = time.time()
            result = get_index_statistics()
            end_time = time.time()
            
            if result["success"]:
                times.append(end_time - start_time)
            else:
                print(f"   Warning: Index statistics failed: {result['error']}")
        
        return {
            "operations": len(times),
            "total_time": sum(times),
            "average_time": sum(times) / len(times) if times else 0,
            "min_time": min(times) if times else 0,
            "max_time": max(times) if times else 0
        }
    
    def _benchmark_cache_operations(self) -> Dict[str, Any]:
        """Benchmark cache operations."""
        times = []
        
        # Benchmark cache stats
        for _ in range(5):
            start_time = time.time()
            result = cache_stats()
            end_time = time.time()
            
            if result["success"]:
                times.append(end_time - start_time)
            else:
                print(f"   Warning: Cache stats failed: {result['error']}")
        
        return {
            "operations": len(times),
            "total_time": sum(times),
            "average_time": sum(times) / len(times) if times else 0,
            "min_time": min(times) if times else 0,
            "max_time": max(times) if times else 0
        }
    
    def _benchmark_file_monitoring(self) -> Dict[str, Any]:
        """Benchmark file monitoring operations."""
        times = []
        
        # Benchmark start/stop monitoring
        for _ in range(3):
            start_time = time.time()
            start_result = start_file_monitoring()
            stop_result = stop_file_monitoring()
            end_time = time.time()
            
            if start_result["success"] and stop_result["success"]:
                times.append(end_time - start_time)
            else:
                print(f"   Warning: File monitoring failed")
        
        return {
            "operations": len(times),
            "total_time": sum(times),
            "average_time": sum(times) / len(times) if times else 0,
            "min_time": min(times) if times else 0,
            "max_time": max(times) if times else 0
        }
    
    def _print_benchmark_summary(self):
        """Print benchmark summary."""
        print("\n" + "=" * 40)
        print("📋 Benchmark Summary")
        print("=" * 40)
        
        for name, result in self.benchmark_results.items():
            if "error" in result:
                print(f"\n❌ {name}: {result['error']}")
            else:
                print(f"\n✅ {name}:")
                print(f"   Operations: {result['operations']}")
                print(f"   Average time: {result['average_time']:.3f}s")
                print(f"   Min time: {result['min_time']:.3f}s")
                print(f"   Max time: {result['max_time']:.3f}s")
    
    def optimize_performance(self):
        """Apply performance optimizations based on benchmark results."""
        print("\n🔧 Performance Optimization")
        print("=" * 40)
        
        optimizations = [
            ("Configure Performance Limits", self._optimize_performance_limits),
            ("Clear Caches", self._optimize_cache_clearing),
            ("Monitor File Changes", self._optimize_file_monitoring),
            ("Index Optimization", self._optimize_indexing)
        ]
        
        for name, optimization_func in optimizations:
            print(f"\n⚙️ {name}...")
            try:
                result = optimization_func()
                if result["success"]:
                    print(f"   ✅ {name} completed successfully")
                else:
                    print(f"   ⚠️ {name} completed with warnings: {result.get('message', '')}")
            except Exception as e:
                print(f"   ❌ {name} failed: {e}")
    
    def _optimize_performance_limits(self) -> Dict[str, Any]:
        """Optimize performance limits based on benchmark results."""
        # Set conservative limits for better performance
        limits = {
            "max_files_per_operation": 500,
            "max_search_results": 50,
            "max_file_size_mb": 5,
            "operation_timeout": 30
        }
        
        result = configure_performance_limits(**limits)
        return result
    
    def _optimize_cache_clearing(self) -> Dict[str, Any]:
        """Optimize cache clearing."""
        # Get current cache stats
        cache_result = cache_stats()
        if not cache_result["success"]:
            return {"success": False, "message": "Failed to get cache stats"}
        
        # Clear caches if hit rate is low
        cache_stats_data = cache_result["cache_stats"]
        low_hit_rate_caches = []
        
        for cache_name, cache_data in cache_stats_data.items():
            hit_rate = cache_data.get("hit_rate", 1.0)
            if hit_rate < 0.7:  # Less than 70% hit rate
                low_hit_rate_caches.append(cache_name)
        
        if low_hit_rate_caches:
            clear_result = clear_caches()
            return {
                "success": True,
                "message": f"Cleared caches with low hit rates: {', '.join(low_hit_rate_caches)}"
            }
        else:
            return {
                "success": True,
                "message": "Cache hit rates are good, no clearing needed"
            }
    
    def _optimize_file_monitoring(self) -> Dict[str, Any]:
        """Optimize file monitoring."""
        # Start monitoring for better performance
        start_result = start_file_monitoring()
        if start_result["success"]:
            return {
                "success": True,
                "message": "File monitoring started for automatic indexing"
            }
        else:
            return {
                "success": False,
                "message": f"Failed to start file monitoring: {start_result['error']}"
            }
    
    def _optimize_indexing(self) -> Dict[str, Any]:
        """Optimize indexing performance."""
        # Get current index statistics
        index_result = get_index_statistics()
        if not index_result["success"]:
            return {"success": False, "message": "Failed to get index statistics"}
        
        stats = index_result["statistics"]
        files_indexed = stats.get("files_indexed", 0)
        indexing_time = stats.get("indexing_time", 0)
        
        if files_indexed > 0 and indexing_time > 0:
            avg_time_per_file = indexing_time / files_indexed
            if avg_time_per_file > 0.1:  # More than 100ms per file
                return {
                    "success": True,
                    "message": f"Indexing performance could be improved (avg {avg_time_per_file:.3f}s per file)"
                }
            else:
                return {
                    "success": True,
                    "message": "Indexing performance is good"
                }
        else:
            return {
                "success": True,
                "message": "No indexing data available"
            }
    
    def monitor_performance(self, duration: int = 60):
        """Monitor performance over a specified duration."""
        print(f"\n📊 Performance Monitoring ({duration}s)")
        print("=" * 40)
        
        start_time = time.time()
        end_time = start_time + duration
        
        # Get initial stats
        initial_perf = performance_stats()
        initial_cache = cache_stats()
        
        print(f"📈 Initial Performance Stats:")
        if initial_perf["success"]:
            stats = initial_perf["statistics"]
            print(f"   Memory usage: {stats.get('memory_usage', 0) / 1024 / 1024:.2f} MB")
            print(f"   Operations: {sum(stats.get('operation_counts', {}).values())}")
        
        print(f"📈 Initial Cache Stats:")
        if initial_cache["success"]:
            cache_stats_data = initial_cache["cache_stats"]
            for cache_name, cache_data in cache_stats_data.items():
                hit_rate = cache_data.get("hit_rate", 0)
                print(f"   {cache_name}: {hit_rate:.2%} hit rate")
        
        # Monitor for specified duration
        print(f"\n⏱️ Monitoring for {duration} seconds...")
        time.sleep(duration)
        
        # Get final stats
        final_perf = performance_stats()
        final_cache = cache_stats()
        
        print(f"\n📈 Final Performance Stats:")
        if final_perf["success"]:
            stats = final_perf["statistics"]
            print(f"   Memory usage: {stats.get('memory_usage', 0) / 1024 / 1024:.2f} MB")
            print(f"   Operations: {sum(stats.get('operation_counts', {}).values())}")
        
        print(f"📈 Final Cache Stats:")
        if final_cache["success"]:
            cache_stats_data = final_cache["cache_stats"]
            for cache_name, cache_data in cache_stats_data.items():
                hit_rate = cache_data.get("hit_rate", 0)
                print(f"   {cache_name}: {hit_rate:.2%} hit rate")
        
        print(f"\n✅ Performance monitoring completed!")
    
    def generate_performance_report(self):
        """Generate a comprehensive performance report."""
        print("\n📋 Performance Report Generation")
        print("=" * 40)
        
        report = {
            "timestamp": time.time(),
            "project_directory": str(self.project_directory),
            "benchmarks": self.benchmark_results,
            "recommendations": []
        }
        
        # Analyze benchmarks and generate recommendations
        for name, result in self.benchmark_results.items():
            if "error" not in result:
                avg_time = result["average_time"]
                if avg_time > 1.0:  # More than 1 second
                    report["recommendations"].append({
                        "operation": name,
                        "issue": "Slow performance",
                        "recommendation": "Consider optimizing or increasing limits"
                    })
                elif avg_time > 0.5:  # More than 500ms
                    report["recommendations"].append({
                        "operation": name,
                        "issue": "Moderate performance",
                        "recommendation": "Monitor and consider optimization"
                    })
        
        # Get current performance stats
        perf_result = performance_stats()
        if perf_result["success"]:
            report["current_performance"] = perf_result["statistics"]
        
        # Get cache stats
        cache_result = cache_stats()
        if cache_result["success"]:
            report["cache_performance"] = cache_result["cache_stats"]
        
        # Save report
        report_file = self.project_directory / "performance_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"📄 Performance report saved to: {report_file}")
        print(f"📊 Recommendations: {len(report['recommendations'])}")
        
        for rec in report["recommendations"]:
            print(f"   - {rec['operation']}: {rec['recommendation']}")
        
        return report


def main():
    """Main function to run performance optimization examples."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Performance Optimization Examples")
    parser.add_argument(
        "--directory", 
        "-d", 
        default=".", 
        help="Project directory to analyze (default: current directory)"
    )
    parser.add_argument(
        "--action",
        "-a",
        choices=["benchmark", "optimize", "monitor", "report", "all"],
        default="all",
        help="Action to perform (default: all)"
    )
    parser.add_argument(
        "--duration",
        "-t",
        type=int,
        default=60,
        help="Monitoring duration in seconds (default: 60)"
    )
    
    args = parser.parse_args()
    
    # Create optimizer instance
    optimizer = PerformanceOptimizer(args.directory)
    
    print("🚀 Enhanced MCP Server Performance Optimization")
    print("=" * 50)
    print(f"📁 Project directory: {optimizer.project_directory}")
    
    # Run selected action
    if args.action == "all":
        optimizer.benchmark_operations()
        optimizer.optimize_performance()
        optimizer.monitor_performance(args.duration)
        optimizer.generate_performance_report()
    elif args.action == "benchmark":
        optimizer.benchmark_operations()
    elif args.action == "optimize":
        optimizer.optimize_performance()
    elif args.action == "monitor":
        optimizer.monitor_performance(args.duration)
    elif args.action == "report":
        optimizer.generate_performance_report()
    
    print(f"\n🎉 Performance optimization completed!")


if __name__ == "__main__":
    main()
