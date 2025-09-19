# Official MCP Server Implementation

This directory contains an official MCP (Model Context Protocol) server implementation using the official Python SDK and FastMCP framework, following the official MCP documentation patterns.

## Overview

The official MCP server provides file system tools that can be used by Claude Desktop on Windows. This implementation uses the official MCP Python SDK to ensure better compatibility and reliability.

## Files

- `official_mcp_server.py` - The main MCP server implementation using FastMCP
- `test_official_mcp.py` - Test script to verify the server works correctly
- `claude_desktop_config.json` - Updated Claude Desktop configuration
- `README_OFFICIAL_MCP.md` - This documentation file

## Features

The server provides three main tools:

1. **list_files(directory)** - List files and directories in a given path
2. **read_file(path)** - Read the contents of a file (up to 1MB)
3. **get_file_info(path)** - Get detailed information about a file or directory

## Installation

The required dependencies are already installed:
- `mcp` - Official MCP Python SDK
- `httpx` - HTTP client library

## Configuration

The Claude Desktop configuration has been updated to use the official MCP server:

```json
{
  "mcpServers": {
    "official-mcp-server": {
      "command": "python",
      "args": [
        "C:\\Users\\manay\\Desktop\\cursor-context-mcp\\official_mcp_server.py"
      ],
      "env": {
        "PATH": "C:\\Users\\manay\\AppData\\Local\\Programs\\Python\\Python313;C:\\Users\\manay\\AppData\\Local\\Programs\\Python\\Python313\\Scripts;%PATH%"
      }
    }
  }
}
```

## Testing

Run the test script to verify everything works:

```bash
python test_official_mcp.py
```

## Usage

1. Restart Claude Desktop
2. The server should be available as "official-mcp-server"
3. Use the tools in Claude Desktop:
   - `list_files(directory=".")` - List current directory contents
   - `read_file(path="filename.txt")` - Read a file
   - `get_file_info(path="filename.txt")` - Get file information

## Benefits of Official SDK

- **Better Compatibility**: Uses the official MCP Python SDK
- **Simplified Implementation**: FastMCP framework reduces boilerplate code
- **Official Support**: Follows official documentation patterns
- **Windows Compatibility**: Should resolve Windows detection issues
- **Maintainability**: Easier to maintain and update

## Troubleshooting

If you encounter issues:

1. Ensure Python is in your PATH
2. Verify the MCP dependencies are installed: `pip list | grep mcp`
3. Check the Claude Desktop configuration file location
4. Restart Claude Desktop after configuration changes
5. Check Claude Desktop logs for any error messages

## Next Steps

This official implementation should provide better reliability and compatibility with Claude Desktop on Windows. The FastMCP framework simplifies the server implementation while maintaining full MCP protocol compliance.
