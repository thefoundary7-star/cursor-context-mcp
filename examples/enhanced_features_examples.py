#!/usr/bin/env python3
"""
Enhanced MCP Server Features - Example Usage Scripts

This file demonstrates how to use the enhanced MCP server features including
code indexing, git integration, security auditing, and performance monitoring.

Author: Cursor Context MCP Team
Version: 2.0.0
License: ISC
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add the parent directory to the path to import MCP server modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from official_mcp_server import (
        search_symbols,
        find_references,
        run_tests,
        get_documentation,
        analyze_dependencies,
        get_recent_changes,
        get_index_statistics,
        start_file_monitoring,
        stop_file_monitoring,
        performance_stats,
        cache_stats,
        clear_caches,
        configure_performance_limits,
        security_audit,
        get_security_summary,
        validate_configuration,
        get_privilege_status,
        set_read_only_mode,
        security_scan_directory,
        get_git_diff,
        get_commit_history,
        get_file_blame,
        get_branch_info,
        find_commits_touching_file,
        get_config_summary,
        list_watched_directories,
        check_path_access
    )
except ImportError as e:
    print(f"Error importing MCP server modules: {e}")
    print("Please ensure the MCP server is properly installed and configured.")
    sys.exit(1)


class MCPEnhancedFeaturesDemo:
    """Demonstration class for enhanced MCP server features."""
    
    def __init__(self, project_directory: str = "."):
        """Initialize the demo with a project directory."""
        self.project_directory = Path(project_directory).resolve()
        self.results = {}
        
    def run_all_examples(self):
        """Run all example demonstrations."""
        print("🚀 Enhanced MCP Server Features Demo")
        print("=" * 50)
        
        examples = [
            ("Code Analysis", self.demo_code_analysis),
            ("Git Integration", self.demo_git_integration),
            ("Security Features", self.demo_security_features),
            ("Performance Monitoring", self.demo_performance_monitoring),
            ("File Monitoring", self.demo_file_monitoring),
            ("Configuration Management", self.demo_configuration_management),
            ("Complete Workflow", self.demo_complete_workflow)
        ]
        
        for name, example_func in examples:
            print(f"\n📋 {name}")
            print("-" * 30)
            try:
                example_func()
                print(f"✅ {name} completed successfully")
            except Exception as e:
                print(f"❌ {name} failed: {e}")
        
        self.print_summary()
    
    def demo_code_analysis(self):
        """Demonstrate code analysis features."""
        print("🔍 Code Analysis Features")
        
        # 1. Search for symbols
        print("\n1. Searching for symbols...")
        result = search_symbols("function", directory=str(self.project_directory))
        if result["success"]:
            print(f"   Found {result['total_found']} symbols")
            for symbol in result["symbols"][:3]:  # Show first 3
                print(f"   - {symbol['name']} ({symbol['type']}) in {symbol['file_path']}")
        else:
            print(f"   Error: {result['error']}")
        
        # 2. Find references
        print("\n2. Finding references...")
        if result["success"] and result["symbols"]:
            symbol_name = result["symbols"][0]["name"]
            ref_result = find_references(symbol_name, directory=str(self.project_directory))
            if ref_result["success"]:
                print(f"   Found {ref_result['total_found']} references to '{symbol_name}'")
            else:
                print(f"   Error: {ref_result['error']}")
        
        # 3. Get documentation
        print("\n3. Extracting documentation...")
        doc_result = get_documentation(directory=str(self.project_directory))
        if doc_result["success"]:
            print(f"   Found {doc_result['total_items']} documentation items")
        else:
            print(f"   Error: {doc_result['error']}")
        
        # 4. Analyze dependencies
        print("\n4. Analyzing dependencies...")
        dep_result = analyze_dependencies(directory=str(self.project_directory))
        if dep_result["success"]:
            print(f"   Found {dep_result['total_dependencies']} dependencies")
            for dep in dep_result["dependencies"][:3]:  # Show first 3
                print(f"   - {dep['name']} {dep['version']}")
        else:
            print(f"   Error: {dep_result['error']}")
        
        self.results["code_analysis"] = {
            "symbols_found": result.get("total_found", 0) if result["success"] else 0,
            "documentation_items": doc_result.get("total_items", 0) if doc_result["success"] else 0,
            "dependencies": dep_result.get("total_dependencies", 0) if dep_result["success"] else 0
        }
    
    def demo_git_integration(self):
        """Demonstrate git integration features."""
        print("🌿 Git Integration Features")
        
        # 1. Get git status
        print("\n1. Getting git status...")
        try:
            from official_mcp_server import _get_git_status_sync
            git_status = _get_git_status_sync(str(self.project_directory))
            if git_status["success"] and git_status["is_git_repo"]:
                print(f"   Current branch: {git_status.get('current_branch', 'unknown')}")
                print(f"   Modified files: {len(git_status.get('modified_files', []))}")
                print(f"   Untracked files: {len(git_status.get('untracked_files', []))}")
            else:
                print("   Not a git repository or error occurred")
        except Exception as e:
            print(f"   Error: {e}")
        
        # 2. Get git diff
        print("\n2. Getting git diff...")
        diff_result = get_git_diff(directory=str(self.project_directory))
        if diff_result["success"]:
            print(f"   Files changed: {diff_result.get('files_changed', 0)}")
        else:
            print(f"   Error: {diff_result['error']}")
        
        # 3. Get commit history
        print("\n3. Getting commit history...")
        history_result = get_commit_history(directory=str(self.project_directory), limit=5)
        if history_result["success"]:
            print(f"   Found {len(history_result['commits'])} recent commits")
            for commit in history_result["commits"][:2]:  # Show first 2
                print(f"   - {commit['hash'][:8]}: {commit['message'][:50]}...")
        else:
            print(f"   Error: {history_result['error']}")
        
        # 4. Get branch info
        print("\n4. Getting branch information...")
        branch_result = get_branch_info(directory=str(self.project_directory))
        if branch_result["success"]:
            print(f"   Current branch: {branch_result.get('current_branch', 'unknown')}")
            print(f"   Local branches: {len(branch_result.get('local_branches', []))}")
        else:
            print(f"   Error: {branch_result['error']}")
        
        self.results["git_integration"] = {
            "is_git_repo": git_status.get("is_git_repo", False) if git_status["success"] else False,
            "commits_found": len(history_result.get("commits", [])) if history_result["success"] else 0
        }
    
    def demo_security_features(self):
        """Demonstrate security features."""
        print("🔒 Security Features")
        
        # 1. Security audit
        print("\n1. Performing security audit...")
        # Find a Python file to audit
        python_files = list(self.project_directory.glob("**/*.py"))
        if python_files:
            test_file = str(python_files[0])
            audit_result = security_audit(test_file)
            if audit_result["success"]:
                print(f"   Issues found: {audit_result.get('total_issues', 0)}")
                for issue in audit_result.get("issues", [])[:2]:  # Show first 2
                    print(f"   - {issue['type']}: {issue['description'][:50]}...")
            else:
                print(f"   Error: {audit_result['error']}")
        else:
            print("   No Python files found for security audit")
        
        # 2. Get security summary
        print("\n2. Getting security summary...")
        summary_result = get_security_summary()
        if summary_result["success"]:
            summary = summary_result["summary"]
            print(f"   Total audits: {summary.get('total_audits', 0)}")
            print(f"   Issues found: {summary.get('issues_found', 0)}")
            print(f"   Read-only mode: {summary.get('read_only_mode', False)}")
        else:
            print(f"   Error: {summary_result['error']}")
        
        # 3. Get privilege status
        print("\n3. Getting privilege status...")
        status_result = get_privilege_status()
        if status_result["success"]:
            status = status_result["status"]
            print(f"   Security level: {status.get('security_level', 'unknown')}")
            print(f"   Audit enabled: {status.get('audit_enabled', False)}")
        else:
            print(f"   Error: {status_result['error']}")
        
        # 4. Security scan directory
        print("\n4. Scanning directory for security issues...")
        scan_result = security_scan_directory(directory=str(self.project_directory), max_files=10)
        if scan_result["success"]:
            print(f"   Files scanned: {scan_result.get('files_scanned', 0)}")
            print(f"   Issues found: {scan_result.get('issues_found', 0)}")
        else:
            print(f"   Error: {scan_result['error']}")
        
        self.results["security"] = {
            "audits_performed": summary.get('total_audits', 0) if summary_result["success"] else 0,
            "issues_found": summary.get('issues_found', 0) if summary_result["success"] else 0
        }
    
    def demo_performance_monitoring(self):
        """Demonstrate performance monitoring features."""
        print("📊 Performance Monitoring Features")
        
        # 1. Get performance stats
        print("\n1. Getting performance statistics...")
        perf_result = performance_stats()
        if perf_result["success"]:
            stats = perf_result["statistics"]
            print(f"   Operations tracked: {len(stats.get('operation_counts', {}))}")
            print(f"   Memory usage: {stats.get('memory_usage', 0) / 1024 / 1024:.2f} MB")
            print(f"   Uptime: {stats.get('uptime', 0)} seconds")
        else:
            print(f"   Error: {perf_result['error']}")
        
        # 2. Get cache stats
        print("\n2. Getting cache statistics...")
        cache_result = cache_stats()
        if cache_result["success"]:
            cache_stats_data = cache_result["cache_stats"]
            for cache_name, cache_data in cache_stats_data.items():
                hit_rate = cache_data.get('hit_rate', 0)
                print(f"   {cache_name}: {hit_rate:.2%} hit rate")
        else:
            print(f"   Error: {cache_result['error']}")
        
        # 3. Get index statistics
        print("\n3. Getting index statistics...")
        index_result = get_index_statistics()
        if index_result["success"]:
            stats = index_result["statistics"]
            print(f"   Files indexed: {stats.get('files_indexed', 0)}")
            print(f"   Symbols found: {stats.get('symbols_found', 0)}")
            print(f"   Indexing time: {stats.get('indexing_time', 0):.2f} seconds")
        else:
            print(f"   Error: {index_result['error']}")
        
        # 4. Configure performance limits
        print("\n4. Configuring performance limits...")
        config_result = configure_performance_limits(
            max_files_per_operation=500,
            max_search_results=50
        )
        if config_result["success"]:
            print("   Performance limits configured successfully")
        else:
            print(f"   Error: {config_result['error']}")
        
        self.results["performance"] = {
            "files_indexed": stats.get('files_indexed', 0) if index_result["success"] else 0,
            "symbols_found": stats.get('symbols_found', 0) if index_result["success"] else 0
        }
    
    def demo_file_monitoring(self):
        """Demonstrate file monitoring features."""
        print("📁 File Monitoring Features")
        
        # 1. Start file monitoring
        print("\n1. Starting file monitoring...")
        start_result = start_file_monitoring()
        if start_result["success"]:
            print("   File monitoring started successfully")
        else:
            print(f"   Error: {start_result['error']}")
        
        # 2. Get recent changes
        print("\n2. Getting recent changes...")
        changes_result = get_recent_changes(hours=24)
        if changes_result["success"]:
            changes = changes_result.get("changes", [])
            print(f"   Recent changes: {len(changes)}")
            for change in changes[:3]:  # Show first 3
                print(f"   - {change['formatted_time']}: {change['file_path']} ({change['change_type']})")
        else:
            print(f"   Error: {changes_result['error']}")
        
        # 3. Stop file monitoring
        print("\n3. Stopping file monitoring...")
        stop_result = stop_file_monitoring()
        if stop_result["success"]:
            print("   File monitoring stopped successfully")
        else:
            print(f"   Error: {stop_result['error']}")
        
        self.results["file_monitoring"] = {
            "recent_changes": len(changes) if changes_result["success"] else 0
        }
    
    def demo_configuration_management(self):
        """Demonstrate configuration management features."""
        print("⚙️ Configuration Management Features")
        
        # 1. Get config summary
        print("\n1. Getting configuration summary...")
        config_result = get_config_summary()
        if config_result["success"]:
            config = config_result["config"]
            print(f"   Configuration enabled: {config.get('enabled', False)}")
            print(f"   Security mode: {config.get('security_mode', 'unknown')}")
            print(f"   Total directories: {config.get('total_directories', 0)}")
        else:
            print(f"   Error: {config_result['error']}")
        
        # 2. List watched directories
        print("\n2. Listing watched directories...")
        dirs_result = list_watched_directories()
        if dirs_result["success"]:
            directories = dirs_result.get("directories", [])
            print(f"   Watched directories: {len(directories)}")
            for directory in directories[:3]:  # Show first 3
                print(f"   - {directory['path']} (enabled: {directory['enabled']})")
        else:
            print(f"   Error: {dirs_result['error']}")
        
        # 3. Check path access
        print("\n3. Checking path access...")
        access_result = check_path_access(str(self.project_directory))
        if access_result["success"]:
            print(f"   Path allowed: {access_result.get('allowed', False)}")
            print(f"   Reason: {access_result.get('reason', 'unknown')}")
        else:
            print(f"   Error: {access_result['error']}")
        
        # 4. Validate configuration
        print("\n4. Validating configuration...")
        validate_result = validate_configuration()
        if validate_result["success"]:
            issues = validate_result.get("issues", [])
            warnings = validate_result.get("warnings", [])
            print(f"   Configuration issues: {len(issues)}")
            print(f"   Configuration warnings: {len(warnings)}")
        else:
            print(f"   Error: {validate_result['error']}")
        
        self.results["configuration"] = {
            "directories_watched": len(directories) if dirs_result["success"] else 0,
            "config_issues": len(issues) if validate_result["success"] else 0
        }
    
    def demo_complete_workflow(self):
        """Demonstrate a complete workflow using multiple features."""
        print("🔄 Complete Workflow Example")
        
        print("\nThis example demonstrates a typical development workflow:")
        print("1. Monitor file changes")
        print("2. Index new/modified files")
        print("3. Search for symbols")
        print("4. Find references")
        print("5. Run security audit")
        print("6. Check git status")
        print("7. Generate performance report")
        
        # Start monitoring
        print("\n📁 Starting file monitoring...")
        start_file_monitoring()
        
        # Get initial state
        print("\n📊 Getting initial statistics...")
        initial_stats = get_index_statistics()
        if initial_stats["success"]:
            print(f"   Initial files indexed: {initial_stats['statistics']['files_indexed']}")
        
        # Search for symbols
        print("\n🔍 Searching for symbols...")
        search_result = search_symbols("class", directory=str(self.project_directory))
        if search_result["success"]:
            print(f"   Found {search_result['total_found']} classes")
        
        # Get recent changes
        print("\n📝 Getting recent changes...")
        changes_result = get_recent_changes(hours=1)
        if changes_result["success"]:
            print(f"   Recent changes: {len(changes_result['changes'])}")
        
        # Security audit
        print("\n🔒 Running security audit...")
        python_files = list(self.project_directory.glob("**/*.py"))
        if python_files:
            audit_result = security_audit(str(python_files[0]))
            if audit_result["success"]:
                print(f"   Security issues found: {audit_result['total_issues']}")
        
        # Performance report
        print("\n📈 Generating performance report...")
        perf_result = performance_stats()
        if perf_result["success"]:
            stats = perf_result["statistics"]
            print(f"   Operations performed: {sum(stats.get('operation_counts', {}).values())}")
            print(f"   Memory usage: {stats.get('memory_usage', 0) / 1024 / 1024:.2f} MB")
        
        # Stop monitoring
        print("\n🛑 Stopping file monitoring...")
        stop_file_monitoring()
        
        print("\n✅ Complete workflow demonstration finished!")
    
    def print_summary(self):
        """Print a summary of all demo results."""
        print("\n" + "=" * 50)
        print("📋 Demo Summary")
        print("=" * 50)
        
        for category, results in self.results.items():
            print(f"\n{category.replace('_', ' ').title()}:")
            for key, value in results.items():
                print(f"  - {key.replace('_', ' ').title()}: {value}")
        
        print(f"\n🎉 Demo completed successfully!")
        print(f"📁 Project directory: {self.project_directory}")
        print(f"⏱️  Total time: {time.time() - getattr(self, 'start_time', time.time()):.2f} seconds")


def main():
    """Main function to run the enhanced features demo."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced MCP Server Features Demo")
    parser.add_argument(
        "--directory", 
        "-d", 
        default=".", 
        help="Project directory to analyze (default: current directory)"
    )
    parser.add_argument(
        "--category",
        "-c",
        choices=[
            "code_analysis", "git_integration", "security", 
            "performance", "file_monitoring", "configuration", "workflow", "all"
        ],
        default="all",
        help="Specific category to demo (default: all)"
    )
    
    args = parser.parse_args()
    
    # Create demo instance
    demo = MCPEnhancedFeaturesDemo(args.directory)
    demo.start_time = time.time()
    
    # Run specific category or all
    if args.category == "all":
        demo.run_all_examples()
    else:
        category_map = {
            "code_analysis": demo.demo_code_analysis,
            "git_integration": demo.demo_git_integration,
            "security": demo.demo_security_features,
            "performance": demo.demo_performance_monitoring,
            "file_monitoring": demo.demo_file_monitoring,
            "configuration": demo.demo_configuration_management,
            "workflow": demo.demo_complete_workflow
        }
        
        if args.category in category_map:
            print(f"🚀 Enhanced MCP Server Features Demo - {args.category.title()}")
            print("=" * 50)
            try:
                category_map[args.category]()
                print(f"\n✅ {args.category.title()} demo completed successfully!")
            except Exception as e:
                print(f"\n❌ {args.category.title()} demo failed: {e}")
        else:
            print(f"❌ Unknown category: {args.category}")


if __name__ == "__main__":
    main()
