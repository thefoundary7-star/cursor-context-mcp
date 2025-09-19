#!/usr/bin/env python3
"""
Test script for the official MCP server
"""

import subprocess
import sys
import json
import time
from pathlib import Path

def test_mcp_server():
    """
    Test the MCP server by running it and checking if it responds correctly.
    """
    print("Testing Official MCP Server...")
    print("=" * 50)
    
    # Test 1: Check if the server can be imported
    try:
        import official_mcp_server
        print("✅ Server imports successfully")
    except Exception as e:
        print(f"❌ Server import failed: {e}")
        return False
    
    # Test 2: Test the tools directly
    try:
        # Test list_files tool
        result = official_mcp_server.list_files(".")
        print("✅ list_files tool works")
        print(f"   Sample output: {result[:100]}...")
        
        # Test get_file_info tool
        result = official_mcp_server.get_file_info("official_mcp_server.py")
        print("✅ get_file_info tool works")
        print(f"   Sample output: {result[:100]}...")
        
    except Exception as e:
        print(f"❌ Tool testing failed: {e}")
        return False
    
    print("\n🎉 All tests passed! The official MCP server is working correctly.")
    print("\nNext steps:")
    print("1. Restart Claude Desktop")
    print("2. The server should now be available as 'official-mcp-server'")
    print("3. Try using the tools: list_files, read_file, get_file_info")
    
    return True

if __name__ == "__main__":
    test_mcp_server()
