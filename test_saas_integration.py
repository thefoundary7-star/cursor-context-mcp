#!/usr/bin/env python3
"""
Test script for SaaS integration with Node.js backend.

This script demonstrates how to test the Python MCP server integration
with the Node.js SaaS backend.
"""

import json
import subprocess
import time
import sys
from pathlib import Path

def test_mcp_server_with_saas():
    """Test the MCP server with SaaS integration enabled."""
    
    print("🚀 Testing Python MCP Server ↔ Node.js SaaS Integration")
    print("=" * 60)
    
    # Check if test config exists
    test_config = Path("config/test-saas-config.json")
    if not test_config.exists():
        print("❌ Test configuration not found!")
        print("💡 Make sure config/test-saas-config.json exists")
        return False
    
    print("✅ Test configuration found")
    
    # Check if Node.js backend is running
    print("\n🔍 Checking Node.js backend status...")
    try:
        import requests
        response = requests.get("http://localhost:3000/api/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Node.js backend is running")
            print(f"   📡 Status: {health_data.get('data', {}).get('status', 'unknown')}")
            print(f"   🏷️  Version: {health_data.get('data', {}).get('version', 'unknown')}")
        else:
            print(f"⚠️  Node.js backend responded with status {response.status_code}")
    except ImportError:
        print("⚠️  'requests' module not available - skipping backend check")
        print("💡 Install with: pip install requests")
    except Exception as e:
        print(f"❌ Node.js backend not accessible: {e}")
        print("💡 Make sure the Node.js backend is running on http://localhost:3000")
        print("💡 You can still test the MCP server integration")
    
    # Test MCP server startup
    print("\n🧪 Testing MCP server startup with SaaS integration...")
    
    try:
        # Run MCP server with test config
        cmd = [
            sys.executable, 
            "official_mcp_server.py",
            "--config", str(test_config)
        ]
        
        print(f"📝 Running: {' '.join(cmd)}")
        
        # Start the server process
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Wait a bit for startup
        time.sleep(3)
        
        # Check if process is still running
        if process.poll() is None:
            print("✅ MCP server started successfully")
            
            # Read some output to see startup logs
            try:
                stdout, stderr = process.communicate(timeout=2)
                if stdout:
                    print("📋 Server output:")
                    for line in stdout.split('\n')[:10]:  # First 10 lines
                        if line.strip():
                            print(f"   {line}")
                
                if stderr:
                    print("⚠️  Server errors:")
                    for line in stderr.split('\n')[:5]:  # First 5 error lines
                        if line.strip():
                            print(f"   {line}")
            except subprocess.TimeoutExpired:
                print("⏰ Server is running (timeout reading output)")
            
            # Terminate the process
            process.terminate()
            try:
                process.wait(timeout=5)
                print("✅ MCP server stopped cleanly")
            except subprocess.TimeoutExpired:
                process.kill()
                print("⚠️  MCP server force-killed")
            
        else:
            print("❌ MCP server failed to start")
            stdout, stderr = process.communicate()
            if stderr:
                print("📋 Error output:")
                for line in stderr.split('\n')[:10]:
                    if line.strip():
                        print(f"   {line}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing MCP server: {e}")
        return False
    
    print("\n🎉 SaaS integration test completed!")
    print("\n📋 Next steps:")
    print("1. Start your Node.js backend: npm run dev")
    print("2. Run the MCP server with test config:")
    print(f"   python official_mcp_server.py --config {test_config}")
    print("3. Test the integration using MCP tools:")
    print("   - test_saas_connection")
    print("   - test_license_validation")
    print("   - test_usage_tracking")
    print("   - get_saas_client_stats")
    
    return True

def show_configuration_guide():
    """Show configuration guide for SaaS integration."""
    
    print("\n📖 SaaS Integration Configuration Guide")
    print("=" * 50)
    
    print("\n1. 🔧 Node.js Backend Setup:")
    print("   - Start the backend: npm run dev")
    print("   - Ensure it's running on http://localhost:3000")
    print("   - Check health endpoint: http://localhost:3000/api/health")
    
    print("\n2. 🐍 Python MCP Server Configuration:")
    print("   - Use the test config: config/test-saas-config.json")
    print("   - Key settings:")
    print("     • saas.enabled: true")
    print("     • saas.api_endpoint: http://localhost:3000")
    print("     • saas.enable_analytics: true")
    print("     • saas.enable_license_validation: true")
    print("     • saas.license_validation_optional: true")
    
    print("\n3. 🧪 Testing Tools Available:")
    print("   - test_saas_connection: Test API connectivity")
    print("   - test_license_validation: Test license validation")
    print("   - test_usage_tracking: Test analytics data transmission")
    print("   - get_saas_client_stats: View HTTP client statistics")
    
    print("\n4. 📊 Expected API Endpoints:")
    print("   - GET  /api/health - Health check")
    print("   - POST /api/analytics/track - Usage tracking")
    print("   - POST /api/auth/validate-license - License validation")
    
    print("\n5. 🔍 Debugging:")
    print("   - Check logs in logs/mcp_server_test.log")
    print("   - Enable DEBUG logging level in config")
    print("   - Monitor Node.js backend logs")

if __name__ == "__main__":
    print("🔗 Python MCP Server ↔ Node.js SaaS Integration Test")
    print("=" * 60)
    
    # Show configuration guide
    show_configuration_guide()
    
    # Ask user if they want to run the test
    print("\n" + "=" * 60)
    response = input("🚀 Run the integration test? (y/N): ").strip().lower()
    
    if response in ['y', 'yes']:
        success = test_mcp_server_with_saas()
        if success:
            print("\n✅ Integration test completed successfully!")
        else:
            print("\n❌ Integration test failed. Check the output above.")
    else:
        print("\n👋 Test skipped. Run this script again when ready to test.")
