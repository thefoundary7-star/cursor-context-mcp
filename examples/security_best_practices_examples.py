#!/usr/bin/env python3
"""
Security Best Practices Examples for Enhanced MCP Server

This file demonstrates security best practices and secure usage patterns
for the enhanced MCP server features.

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
        security_audit,
        get_security_summary,
        validate_configuration,
        get_privilege_status,
        set_read_only_mode,
        security_scan_directory,
        check_path_access,
        get_config_summary,
        list_watched_directories
    )
except ImportError as e:
    print(f"Error importing MCP server modules: {e}")
    sys.exit(1)


class SecurityBestPractices:
    """Security best practices demonstration for MCP server."""
    
    def __init__(self, project_directory: str = "."):
        """Initialize the security best practices demo."""
        self.project_directory = Path(project_directory).resolve()
        self.security_results = {}
        
    def demonstrate_security_features(self):
        """Demonstrate all security features and best practices."""
        print("🔒 Security Best Practices Demo")
        print("=" * 40)
        
        security_demos = [
            ("Configuration Security", self._demo_configuration_security),
            ("Path Access Control", self._demo_path_access_control),
            ("Security Auditing", self._demo_security_auditing),
            ("Privilege Management", self._demo_privilege_management),
            ("Directory Scanning", self._demo_directory_scanning),
            ("Security Monitoring", self._demo_security_monitoring)
        ]
        
        for name, demo_func in security_demos:
            print(f"\n🛡️ {name}")
            print("-" * 30)
            try:
                result = demo_func()
                self.security_results[name] = result
                print(f"   ✅ {name} completed successfully")
            except Exception as e:
                print(f"   ❌ {name} failed: {e}")
                self.security_results[name] = {"error": str(e)}
        
        self._print_security_summary()
    
    def _demo_configuration_security(self) -> Dict[str, Any]:
        """Demonstrate configuration security best practices."""
        print("1. Validating configuration security...")
        
        # Validate configuration
        validate_result = validate_configuration()
        if validate_result["success"]:
            issues = validate_result.get("issues", [])
            warnings = validate_result.get("warnings", [])
            recommendations = validate_result.get("recommendations", [])
            
            print(f"   Configuration issues: {len(issues)}")
            print(f"   Configuration warnings: {len(warnings)}")
            print(f"   Security recommendations: {len(recommendations)}")
            
            if issues:
                print("   ⚠️ Configuration issues found:")
                for issue in issues[:3]:  # Show first 3
                    print(f"     - {issue}")
            
            if recommendations:
                print("   💡 Security recommendations:")
                for rec in recommendations[:3]:  # Show first 3
                    print(f"     - {rec}")
        else:
            print(f"   ❌ Configuration validation failed: {validate_result['error']}")
        
        # Get configuration summary
        print("\n2. Getting configuration summary...")
        config_result = get_config_summary()
        if config_result["success"]:
            config = config_result["config"]
            print(f"   Security mode: {config.get('security_mode', 'unknown')}")
            print(f"   Total directories: {config.get('total_directories', 0)}")
            print(f"   Configuration enabled: {config.get('enabled', False)}")
        else:
            print(f"   ❌ Failed to get configuration: {config_result['error']}")
        
        return {
            "config_validated": validate_result["success"],
            "issues_found": len(validate_result.get("issues", [])) if validate_result["success"] else 0,
            "recommendations": len(validate_result.get("recommendations", [])) if validate_result["success"] else 0
        }
    
    def _demo_path_access_control(self) -> Dict[str, Any]:
        """Demonstrate path access control security."""
        print("1. Testing path access control...")
        
        # Test various paths
        test_paths = [
            str(self.project_directory),
            str(self.project_directory / "README.md"),
            "/etc/passwd",  # Should be blocked
            "/sys/kernel",  # Should be blocked
            "C:\\Windows\\System32",  # Should be blocked on Windows
        ]
        
        access_results = []
        for path in test_paths:
            result = check_path_access(path)
            if result["success"]:
                allowed = result.get("allowed", False)
                reason = result.get("reason", "unknown")
                print(f"   {path}: {'✅ Allowed' if allowed else '❌ Blocked'} - {reason}")
                access_results.append({"path": path, "allowed": allowed, "reason": reason})
            else:
                print(f"   {path}: ❌ Error - {result['error']}")
                access_results.append({"path": path, "allowed": False, "error": result["error"]})
        
        # List watched directories
        print("\n2. Listing watched directories...")
        dirs_result = list_watched_directories()
        if dirs_result["success"]:
            directories = dirs_result.get("directories", [])
            print(f"   Watched directories: {len(directories)}")
            for directory in directories[:3]:  # Show first 3
                print(f"     - {directory['path']} (enabled: {directory['enabled']})")
        else:
            print(f"   ❌ Failed to list directories: {dirs_result['error']}")
        
        return {
            "paths_tested": len(test_paths),
            "access_results": access_results,
            "watched_directories": len(dirs_result.get("directories", [])) if dirs_result["success"] else 0
        }
    
    def _demo_security_auditing(self) -> Dict[str, Any]:
        """Demonstrate security auditing features."""
        print("1. Performing security audit...")
        
        # Find Python files to audit
        python_files = list(self.project_directory.glob("**/*.py"))
        audit_results = []
        
        if python_files:
            # Audit first few files
            for file_path in python_files[:3]:  # Audit first 3 files
                print(f"   Auditing: {file_path.name}")
                result = security_audit(str(file_path))
                if result["success"]:
                    issues = result.get("issues", [])
                    print(f"     Issues found: {len(issues)}")
                    for issue in issues[:2]:  # Show first 2 issues
                        print(f"       - {issue['type']}: {issue['description'][:50]}...")
                    audit_results.append({
                        "file": str(file_path),
                        "issues": len(issues),
                        "success": True
                    })
                else:
                    print(f"     ❌ Audit failed: {result['error']}")
                    audit_results.append({
                        "file": str(file_path),
                        "issues": 0,
                        "success": False,
                        "error": result["error"]
                    })
        else:
            print("   No Python files found for security audit")
        
        # Get security summary
        print("\n2. Getting security summary...")
        summary_result = get_security_summary()
        if summary_result["success"]:
            summary = summary_result["summary"]
            print(f"   Total audits: {summary.get('total_audits', 0)}")
            print(f"   Issues found: {summary.get('issues_found', 0)}")
            print(f"   High severity: {summary.get('high_severity', 0)}")
            print(f"   Medium severity: {summary.get('medium_severity', 0)}")
            print(f"   Low severity: {summary.get('low_severity', 0)}")
        else:
            print(f"   ❌ Failed to get security summary: {summary_result['error']}")
        
        return {
            "files_audited": len(audit_results),
            "total_issues": sum(r.get("issues", 0) for r in audit_results),
            "audit_summary": summary if summary_result["success"] else None
        }
    
    def _demo_privilege_management(self) -> Dict[str, Any]:
        """Demonstrate privilege management features."""
        print("1. Getting privilege status...")
        
        # Get current privilege status
        status_result = get_privilege_status()
        if status_result["success"]:
            status = status_result["status"]
            print(f"   Read-only mode: {status.get('read_only_mode', False)}")
            print(f"   Security level: {status.get('security_level', 'unknown')}")
            print(f"   Audit enabled: {status.get('audit_enabled', False)}")
            print(f"   Restricted paths: {len(status.get('restricted_paths', []))}")
        else:
            print(f"   ❌ Failed to get privilege status: {status_result['error']}")
        
        # Test read-only mode
        print("\n2. Testing read-only mode...")
        try:
            # Enable read-only mode
            enable_result = set_read_only_mode(True)
            if enable_result["success"]:
                print("   ✅ Read-only mode enabled")
                
                # Try to get status again
                status_result2 = get_privilege_status()
                if status_result2["success"]:
                    read_only = status_result2["status"].get("read_only_mode", False)
                    print(f"   Read-only mode status: {read_only}")
                
                # Disable read-only mode
                disable_result = set_read_only_mode(False)
                if disable_result["success"]:
                    print("   ✅ Read-only mode disabled")
                else:
                    print(f"   ❌ Failed to disable read-only mode: {disable_result['error']}")
            else:
                print(f"   ❌ Failed to enable read-only mode: {enable_result['error']}")
        except Exception as e:
            print(f"   ❌ Read-only mode test failed: {e}")
        
        return {
            "privilege_status_retrieved": status_result["success"],
            "read_only_mode_tested": True
        }
    
    def _demo_directory_scanning(self) -> Dict[str, Any]:
        """Demonstrate directory security scanning."""
        print("1. Performing directory security scan...")
        
        scan_result = security_scan_directory(
            directory=str(self.project_directory),
            max_files=20  # Limit for demo
        )
        
        if scan_result["success"]:
            files_scanned = scan_result.get("files_scanned", 0)
            issues_found = scan_result.get("issues_found", 0)
            issues = scan_result.get("issues", [])
            
            print(f"   Files scanned: {files_scanned}")
            print(f"   Issues found: {issues_found}")
            
            if issues:
                print("   Security issues found:")
                for issue in issues[:3]:  # Show first 3
                    print(f"     - {issue['file']}: {issue['type']} (line {issue.get('line', 'unknown')})")
            else:
                print("   ✅ No security issues found")
        else:
            print(f"   ❌ Directory scan failed: {scan_result['error']}")
        
        return {
            "files_scanned": scan_result.get("files_scanned", 0) if scan_result["success"] else 0,
            "issues_found": scan_result.get("issues_found", 0) if scan_result["success"] else 0,
            "scan_successful": scan_result["success"]
        }
    
    def _demo_security_monitoring(self) -> Dict[str, Any]:
        """Demonstrate security monitoring and alerting."""
        print("1. Setting up security monitoring...")
        
        # Get initial security state
        initial_summary = get_security_summary()
        initial_status = get_privilege_status()
        
        if initial_summary["success"]:
            summary = initial_summary["summary"]
            print(f"   Initial security state:")
            print(f"     Total audits: {summary.get('total_audits', 0)}")
            print(f"     Issues found: {summary.get('issues_found', 0)}")
            print(f"     Read-only mode: {summary.get('read_only_mode', False)}")
        
        if initial_status["success"]:
            status = initial_status["status"]
            print(f"   Security configuration:")
            print(f"     Security level: {status.get('security_level', 'unknown')}")
            print(f"     Audit enabled: {status.get('audit_enabled', False)}")
        
        # Simulate security monitoring
        print("\n2. Simulating security monitoring...")
        time.sleep(1)  # Simulate monitoring period
        
        # Check for changes
        final_summary = get_security_summary()
        if final_summary["success"]:
            final_summary_data = final_summary["summary"]
            print(f"   Current security state:")
            print(f"     Total audits: {final_summary_data.get('total_audits', 0)}")
            print(f"     Issues found: {final_summary_data.get('issues_found', 0)}")
        
        return {
            "monitoring_setup": True,
            "initial_audits": summary.get('total_audits', 0) if initial_summary["success"] else 0,
            "final_audits": final_summary_data.get('total_audits', 0) if final_summary["success"] else 0
        }
    
    def _print_security_summary(self):
        """Print security demonstration summary."""
        print("\n" + "=" * 40)
        print("🔒 Security Summary")
        print("=" * 40)
        
        for category, result in self.security_results.items():
            if "error" in result:
                print(f"\n❌ {category}: {result['error']}")
            else:
                print(f"\n✅ {category}:")
                for key, value in result.items():
                    if key != "error":
                        print(f"   - {key.replace('_', ' ').title()}: {value}")
    
    def generate_security_report(self):
        """Generate a comprehensive security report."""
        print("\n📋 Security Report Generation")
        print("=" * 40)
        
        report = {
            "timestamp": time.time(),
            "project_directory": str(self.project_directory),
            "security_analysis": self.security_results,
            "recommendations": []
        }
        
        # Generate security recommendations
        for category, result in self.security_results.items():
            if "error" not in result:
                if category == "Configuration Security":
                    if result.get("issues_found", 0) > 0:
                        report["recommendations"].append({
                            "category": "Configuration",
                            "issue": "Configuration issues found",
                            "recommendation": "Review and fix configuration issues"
                        })
                
                elif category == "Security Auditing":
                    if result.get("total_issues", 0) > 0:
                        report["recommendations"].append({
                            "category": "Code Security",
                            "issue": "Security issues found in code",
                            "recommendation": "Address security vulnerabilities"
                        })
                
                elif category == "Directory Scanning":
                    if result.get("issues_found", 0) > 0:
                        report["recommendations"].append({
                            "category": "File Security",
                            "issue": "Security issues in files",
                            "recommendation": "Review and fix file security issues"
                        })
        
        # Add general security recommendations
        report["recommendations"].extend([
            {
                "category": "General",
                "issue": "Regular security audits",
                "recommendation": "Schedule regular security audits"
            },
            {
                "category": "General",
                "issue": "Read-only mode",
                "recommendation": "Consider enabling read-only mode in production"
            },
            {
                "category": "General",
                "issue": "Access control",
                "recommendation": "Review and restrict directory access"
            }
        ])
        
        # Save report
        report_file = self.project_directory / "security_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"📄 Security report saved to: {report_file}")
        print(f"🛡️ Security recommendations: {len(report['recommendations'])}")
        
        for rec in report["recommendations"]:
            print(f"   - {rec['category']}: {rec['recommendation']}")
        
        return report


def main():
    """Main function to run security best practices examples."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Security Best Practices Examples")
    parser.add_argument(
        "--directory", 
        "-d", 
        default=".", 
        help="Project directory to analyze (default: current directory)"
    )
    parser.add_argument(
        "--action",
        "-a",
        choices=["demo", "report", "audit", "all"],
        default="all",
        help="Action to perform (default: all)"
    )
    
    args = parser.parse_args()
    
    # Create security demo instance
    security_demo = SecurityBestPractices(args.directory)
    
    print("🔒 Enhanced MCP Server Security Best Practices")
    print("=" * 50)
    print(f"📁 Project directory: {security_demo.project_directory}")
    
    # Run selected action
    if args.action == "all":
        security_demo.demonstrate_security_features()
        security_demo.generate_security_report()
    elif args.action == "demo":
        security_demo.demonstrate_security_features()
    elif args.action == "report":
        security_demo.generate_security_report()
    elif args.action == "audit":
        security_demo._demo_security_auditing()
    
    print(f"\n🎉 Security best practices demonstration completed!")


if __name__ == "__main__":
    main()
