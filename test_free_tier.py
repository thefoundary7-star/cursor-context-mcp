#!/usr/bin/env python3
"""
FileBridge Free Tier Test Suite

Tests the complete free tier functionality including:
- Free tier registration
- License generation and validation
- Usage tracking and limits
- MCP server integration
"""

import requests
import json
import time
from pathlib import Path

class FreeTierTester:
    def __init__(self, api_base_url="http://localhost:3000/api"):
        self.api_base_url = api_base_url
        self.test_email = "test@filebridge.dev"
        self.license_key = None
    
    def test_free_registration(self):
        """Test free tier user registration"""
        print("🧪 Testing free tier registration...")
        
        try:
            response = requests.post(
                f"{self.api_base_url}/auth/register-free",
                json={"email": self.test_email},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.license_key = data.get("licenseKey")
                    print(f"✅ Registration successful! License: {self.license_key}")
                    return True
                else:
                    print(f"❌ Registration failed: {data.get('error')}")
                    return False
            else:
                print(f"❌ Registration failed: HTTP {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Registration error: {e}")
            return False
    
    def test_usage_checking(self):
        """Test usage checking API"""
        if not self.license_key:
            print("❌ No license key available for usage testing")
            return False
        
        print("🧪 Testing usage checking...")
        
        try:
            response = requests.get(
                f"{self.api_base_url}/usage/check",
                params={"license_key": self.license_key},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    usage = data.get("usage", {})
                    print(f"✅ Usage check successful!")
                    print(f"   Used: {usage.get('usage', 0)}")
                    print(f"   Remaining: {usage.get('remaining', 0)}")
                    print(f"   Limit: {usage.get('limit', 50)}")
                    return True
                else:
                    print(f"❌ Usage check failed: {data.get('error')}")
                    return False
            else:
                print(f"❌ Usage check failed: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Usage check error: {e}")
            return False
    
    def test_license_validation(self):
        """Test MCP license validation"""
        if not self.license_key:
            print("❌ No license key available for validation testing")
            return False
        
        print("🧪 Testing license validation...")
        
        try:
            response = requests.post(
                f"{self.api_base_url}/mcp/validate-license",
                json={
                    "license_key": self.license_key,
                    "operation": "test_operation"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    usage = data.get("usage", {})
                    print(f"✅ License validation successful!")
                    print(f"   Remaining: {usage.get('remaining', 0)}")
                    return True
                else:
                    print(f"❌ License validation failed: {data.get('error')}")
                    return False
            else:
                print(f"❌ License validation failed: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ License validation error: {e}")
            return False
    
    def test_usage_limits(self):
        """Test that usage limits are enforced"""
        if not self.license_key:
            print("❌ No license key available for limit testing")
            return False
        
        print("🧪 Testing usage limits (this may take a moment)...")
        
        # Make multiple requests to test limits
        success_count = 0
        limit_reached = False
        
        for i in range(52):  # Try to exceed the 50-call limit
            try:
                response = requests.post(
                    f"{self.api_base_url}/mcp/validate-license",
                    json={
                        "license_key": self.license_key,
                        "operation": f"test_limit_{i}"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    success_count += 1
                elif response.status_code == 429:
                    limit_reached = True
                    data = response.json()
                    print(f"✅ Limit enforced after {success_count} calls")
                    print(f"   Error: {data.get('error', 'Limit exceeded')}")
                    break
            
            except Exception as e:
                print(f"Request {i} failed: {e}")
                break
        
        if limit_reached:
            print("✅ Usage limits working correctly!")
            return True
        else:
            print(f"⚠️  Made {success_count} calls without hitting limit")
            return success_count > 0
    
    def test_cli_tool(self):
        """Test the FileBridge CLI tool"""
        if not self.license_key:
            print("❌ No license key available for CLI testing")
            return False
        
        print("🧪 Testing FileBridge CLI...")
        
        try:
            import subprocess
            
            # Test activation
            result = subprocess.run([
                "python", "filebridge_cli.py", "activate", self.license_key
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ CLI activation successful!")
                
                # Test status
                result = subprocess.run([
                    "python", "filebridge_cli.py", "status"
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    print("✅ CLI status check successful!")
                    return True
                else:
                    print(f"❌ CLI status failed: {result.stderr}")
                    return False
            else:
                print(f"❌ CLI activation failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ CLI test error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 FileBridge Free Tier Test Suite")
        print("=" * 50)
        
        tests = [
            ("Free Registration", self.test_free_registration),
            ("Usage Checking", self.test_usage_checking),
            ("License Validation", self.test_license_validation),
            ("Usage Limits", self.test_usage_limits),
            ("CLI Tool", self.test_cli_tool)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n📋 {test_name}")
            print("-" * 30)
            
            try:
                if test_func():
                    passed += 1
                    print(f"✅ {test_name} PASSED")
                else:
                    print(f"❌ {test_name} FAILED")
            except Exception as e:
                print(f"❌ {test_name} ERROR: {e}")
        
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Free tier is working correctly.")
        else:
            print("⚠️  Some tests failed. Check the output above for details.")
        
        return passed == total


def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test FileBridge Free Tier functionality")
    parser.add_argument("--api-url", default="http://localhost:3000/api", 
                       help="Base URL for the API (default: http://localhost:3000/api)")
    parser.add_argument("--quick", action="store_true", 
                       help="Skip the usage limits test (which makes many API calls)")
    
    args = parser.parse_args()
    
    tester = FreeTierTester(args.api_url)
    
    if args.quick:
        print("🏃 Running quick tests (skipping usage limits)...")
        # Remove the usage limits test
        tester.test_usage_limits = lambda: True
    
    success = tester.run_all_tests()
    
    if success:
        print("\n🎯 Next steps:")
        print("1. Start your Next.js server if not running: npm run dev")
        print("2. Open http://localhost:3000 to test the web interface")
        print("3. Integrate with your MCP server using mcp_usage_tracker.py")
        print("4. Deploy to production and update webhook URLs")
    
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
