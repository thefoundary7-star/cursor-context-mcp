#!/usr/bin/env python3
"""
Usage Tracker Integration for MCP Server

This module provides usage tracking integration for the FileBridge MCP server
to enforce free tier daily limits and track usage for all plans.
"""

import os
import json
import requests
from typing import Dict, Any, Optional
from pathlib import Path

class MCPUsageTracker:
    """Handles usage tracking for MCP operations"""
    
    def __init__(self, api_base_url: str = None):
        self.api_base_url = api_base_url or os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000/api')
        self.license_key = self._get_license_key()
    
    def _get_license_key(self) -> Optional[str]:
        """Get license key from config or environment"""
        # Check environment variable first
        license_key = os.getenv('FILEBRIDGE_LICENSE_KEY')
        if license_key:
            return license_key
        
        # Check config file
        try:
            config_path = Path.home() / '.filebridge' / 'config.json'
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    return config.get('license_key')
        except Exception as e:
            print(f"Warning: Could not read config file: {e}")
        
        return None
    
    def check_usage_limit(self, operation: str) -> Dict[str, Any]:
        """Check if operation is allowed based on usage limits"""
        if not self.license_key:
            return {
                "allowed": False,
                "error": "No license key found. Please activate your FileBridge license."
            }
        
        try:
            response = requests.post(
                f"{self.api_base_url}/mcp/validate-license",
                json={
                    "license_key": self.license_key,
                    "operation": operation
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "allowed": True,
                    "usage": data.get('usage', {}),
                    "message": data.get('message', 'Usage recorded')
                }
            elif response.status_code == 429:
                # Usage limit exceeded
                data = response.json()
                return {
                    "allowed": False,
                    "error": data.get('error', 'Usage limit exceeded'),
                    "usage": data.get('usage', {}),
                    "upgrade_needed": True
                }
            else:
                return {
                    "allowed": False,
                    "error": f"License validation failed: {response.text}"
                }
                
        except requests.exceptions.RequestException as e:
            # Network error - allow operation in offline mode but log it
            print(f"Warning: Could not validate license (offline mode): {e}")
            return {
                "allowed": True,
                "offline_mode": True,
                "warning": "Operating in offline mode - usage not tracked"
            }
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current usage statistics"""
        if not self.license_key:
            return {"error": "No license key found"}
        
        try:
            response = requests.get(
                f"{self.api_base_url}/usage/check",
                params={"license_key": self.license_key},
                timeout=5
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Could not fetch usage stats: {response.text}"}
                
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}"}


def with_usage_tracking(operation_name: str):
    """Decorator to add usage tracking to MCP operations"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            tracker = MCPUsageTracker()
            
            # Check usage limits before executing operation
            usage_result = tracker.check_usage_limit(operation_name)
            
            if not usage_result.get("allowed", False):
                error_msg = usage_result.get("error", "Operation not allowed")
                
                if usage_result.get("upgrade_needed"):
                    # Format a nice upgrade message for free tier users
                    usage = usage_result.get("usage", {})
                    reset_time = usage.get("resetTime", "")
                    
                    upgrade_msg = f"""
{error_msg}

Your FileBridge Free plan allows 50 MCP calls per day.
Upgrade to FileBridge Pro for unlimited calls and advanced features.

Visit: https://filebridge.dev/pricing
or run: filebridge upgrade

Usage resets at: {reset_time}
                    """.strip()
                    
                    raise Exception(upgrade_msg)
                else:
                    raise Exception(error_msg)
            
            # Execute the original operation
            result = func(*args, **kwargs)
            
            # Add usage info to response if available
            if "usage" in usage_result:
                if isinstance(result, dict):
                    result["_usage"] = usage_result["usage"]
            
            return result
        
        return wrapper
    return decorator


# Example usage in MCP server functions:
# @with_usage_tracking("listFiles")
# async def list_files(directory: str) -> dict:
#     # Your existing list_files implementation
#     pass

def check_license_activation():
    """Check if FileBridge license is properly activated"""
    tracker = MCPUsageTracker()
    
    if not tracker.license_key:
        print("=" * 60)
        print("🚀 FILEBRIDGE ACTIVATION REQUIRED")
        print("=" * 60)
        print()
        print("To use FileBridge MCP Server, you need to activate your license:")
        print()
        print("1. Get your free license at: https://filebridge.dev/free")
        print("2. Activate with: filebridge activate YOUR_LICENSE_KEY")
        print("3. Or set environment variable: FILEBRIDGE_LICENSE_KEY=YOUR_KEY")
        print()
        print("Free tier includes 50 MCP calls per day!")
        print("=" * 60)
        return False
    
    # Test the license
    usage_stats = tracker.get_usage_stats()
    if "error" in usage_stats:
        print(f"License validation error: {usage_stats['error']}")
        return False
    
    usage = usage_stats.get("usage", {})
    if usage != "unlimited":
        remaining = usage.get("remaining", 0)
        limit = usage.get("limit", 50)
        print(f"✅ FileBridge Free: {remaining}/{limit} calls remaining today")
    else:
        print("✅ FileBridge Pro: Unlimited usage")
    
    return True

if __name__ == "__main__":
    # Test the license activation
    check_license_activation()
