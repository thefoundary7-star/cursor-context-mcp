# Cursor Context MCP

A Model Context Protocol (MCP) server implementation that provides file system tools for Claude Desktop on Windows. This project includes both a custom TypeScript implementation and an official Python SDK implementation.

## Overview

This MCP server provides file system tools that can be used by Claude Desktop to interact with your local file system. It includes implementations in both TypeScript/Node.js and Python, giving you flexibility in how you want to run the server.

## Features

The server provides three main tools:

1. **list_files(directory)** - List files and directories in a given path
2. **read_file(path)** - Read the contents of a file (up to 1MB)
3. **get_file_info(path)** - Get detailed information about a file or directory

## Project Structure

```
├── src/                    # TypeScript source files
│   ├── index.ts           # Main server implementation
│   ├── tools.ts           # Tool definitions
│   └── types.ts           # Type definitions
├── dist/                  # Compiled JavaScript files
├── official_mcp_server.py # Official Python MCP server
├── test_official_mcp.py   # Python server test script
├── server.py              # Alternative Python server
└── claude_desktop_config.json # Claude Desktop configuration
```

## Installation

### Prerequisites

- Node.js (for TypeScript implementation)
- Python 3.7+ (for Python implementation)
- Claude Desktop

### TypeScript Implementation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

### Python Implementation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Test the server:
```bash
python test_official_mcp.py
```

## Configuration

Update your Claude Desktop configuration file to include the MCP server:

### For TypeScript Implementation
```json
{
  "mcpServers": {
    "cursor-context-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\dist\\index.js"]
    }
  }
}
```

### For Python Implementation
```json
{
  "mcpServers": {
    "official-mcp-server": {
      "command": "python",
      "args": ["C:\\path\\to\\your\\project\\official_mcp_server.py"],
      "env": {
        "PATH": "C:\\Python\\Scripts;%PATH%"
      }
    }
  }
}
```

## Usage

1. Restart Claude Desktop after updating the configuration
2. The server should be available in Claude Desktop
3. Use the tools in Claude Desktop:
   - `list_files(directory=".")` - List current directory contents
   - `read_file(path="filename.txt")` - Read a file
   - `get_file_info(path="filename.txt")` - Get file information

## Development

### TypeScript Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project
- `npm start` - Start the production server

### Python Development

- `python official_mcp_server.py` - Run the official MCP server
- `python test_official_mcp.py` - Test the server functionality

## Benefits

- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Multiple Implementations**: Choose between TypeScript or Python
- **Official SDK Support**: Python implementation uses the official MCP SDK
- **File System Access**: Safe file system operations with size limits
- **Claude Desktop Integration**: Seamless integration with Claude Desktop

## Troubleshooting

If you encounter issues:

1. Ensure Node.js/Python is in your PATH
2. Verify dependencies are installed
3. Check the Claude Desktop configuration file location
4. Restart Claude Desktop after configuration changes
5. Check Claude Desktop logs for any error messages

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!
