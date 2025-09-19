#!/usr/bin/env python3

import json
import os
import sys
import subprocess
from typing import Dict, Any, List, Optional

class MCPServer:
    def __init__(self):
        self.version = "1.0.0"
        self.server_name = "cursor-context-mcp-python"
        
        # Set the project directory based on the server script location
        # This ensures consistent behavior regardless of where the server is launched from
        self.project_dir = os.path.dirname(os.path.abspath(__file__))
        self.log(f"{self.server_name} v{self.version} starting...")
        self.log(f"Project directory: {self.project_dir}")

    def log(self, message: str):
        """Log to stderr to avoid interfering with MCP protocol on stdout"""
        print(f"[{self.server_name}] {message}", file=sys.stderr)

    def resolve_path(self, path: str) -> str:
        """Resolve a path relative to the project directory"""
        if os.path.isabs(path):
            # If it's already an absolute path, use it as-is
            return path
        else:
            # If it's a relative path, resolve it against the project directory
            return os.path.join(self.project_dir, path)

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Define available MCP tools"""
        return [
            {
                "name": "listFiles",
                "description": "List files in a directory",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {
                            "type": "string",
                            "description": "Directory path to list files from (optional, defaults to project directory)"
                        }
                    }
                }
            },
            {
                "name": "readFile",
                "description": "Read contents of a file",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filePath": {
                            "type": "string",
                            "description": "Path to the file to read (relative to project directory or absolute path)"
                        }
                    },
                    "required": ["filePath"]
                }
            },
            {
                "name": "getGitStatus",
                "description": "Get current Git repository status",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

    def list_files(self, directory: Optional[str] = None) -> List[str]:
        """List files in directory, excluding hidden files"""
        try:
            if directory:
                target_dir = self.resolve_path(directory)
            else:
                target_dir = self.project_dir
            files = os.listdir(target_dir)
            # Filter out hidden files (starting with .)
            return [f for f in files if not f.startswith('.')]
        except Exception as e:
            raise Exception(f"Failed to list files: {str(e)}")

    def read_file(self, file_path: str) -> str:
        """Read file contents"""
        if not file_path:
            raise Exception("filePath parameter is required")
        
        try:
            full_path = self.resolve_path(file_path)
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            resolved_path = self.resolve_path(file_path)
            raise Exception(f"File not found: {file_path} (resolved to: {resolved_path})")
        except PermissionError:
            raise Exception(f"Permission denied reading file: {file_path}")
        except UnicodeDecodeError as e:
            raise Exception(f"Failed to decode file as UTF-8: {file_path} - {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to read file '{file_path}': {str(e)}")

    def get_git_status(self) -> str:
        """Get git status using subprocess"""
        try:
            result = subprocess.run(
                ['git', 'status', '--porcelain'],
                capture_output=True,
                text=True,
                cwd=self.project_dir
            )

            if result.returncode != 0:
                return f"Git error: {result.stderr.strip()}"

            if not result.stdout.strip():
                return "Working tree clean"

            return result.stdout.strip()
        except FileNotFoundError:
            return "Git not found on system"
        except Exception as e:
            return f"Git status error: {str(e)}"

    def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a tool with given parameters"""
        if tool_name == "listFiles":
            return self.list_files(params.get('directory'))
        elif tool_name == "readFile":
            return self.read_file(params.get('filePath'))
        elif tool_name == "getGitStatus":
            return self.get_git_status()
        else:
            raise Exception(f"Unknown tool: {tool_name}")

    def handle_initialize(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle MCP initialize request"""
        capabilities = {
            "tools": {
                "listChanged": False
            }
        }

        return {
            "jsonrpc": "2.0",
            "id": request["id"],
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": capabilities,
                "serverInfo": {
                    "name": self.server_name,
                    "version": self.version
                }
            }
        }

    def handle_tools_list(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tools/list request"""
        tools = self.get_tool_definitions()

        return {
            "jsonrpc": "2.0",
            "id": request["id"],
            "result": {
                "tools": tools
            }
        }

    def handle_tool_call(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tools/call request"""
        try:
            params = request.get("params", {})
            tool_name = params.get("name")
            tool_args = params.get("arguments", {})

            result = self.execute_tool(tool_name, tool_args)

            return {
                "jsonrpc": "2.0",
                "id": request["id"],
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": result if isinstance(result, str) else json.dumps(result, indent=2)
                        }
                    ]
                }
            }
        except Exception as e:
            return self.create_error_response(request["id"], -32603, f"Tool execution failed: {str(e)}")

    def create_error_response(self, request_id: Any, code: int, message: str) -> Dict[str, Any]:
        """Create error response"""
        return {
            "jsonrpc": "2.0",
            "id": request_id or 0,
            "error": {
                "code": code,
                "message": message
            }
        }

    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming MCP request"""
        method = request.get("method")

        if method == "initialize":
            return self.handle_initialize(request)
        elif method == "tools/list":
            return self.handle_tools_list(request)
        elif method == "tools/call":
            return self.handle_tool_call(request)
        else:
            return self.create_error_response(
                request.get("id"),
                -32601,
                f"Unknown method: {method}"
            )

    def send_response(self, response: Dict[str, Any]):
        """Send response to stdout"""
        print(json.dumps(response), flush=True)

    def handle_message(self, message: str):
        """Handle incoming message"""
        if not message.strip():
            return

        try:
            request = json.loads(message)
            self.log(f"Received request: {request.get('method', 'unknown')}")

            response = self.process_request(request)
            self.send_response(response)
        except json.JSONDecodeError as e:
            self.log(f"JSON decode error: {e}")
            self.send_response(self.create_error_response(None, -32700, "Parse error"))
        except Exception as e:
            self.log(f"Error processing request: {e}")
            self.send_response(self.create_error_response(None, -32603, "Internal error"))

    def run(self):
        """Main server loop"""
        self.log(f"{self.server_name} v{self.version} is ready for MCP connections!")
        self.log(f"Process ID: {os.getpid()}")

        try:
            # Read from stdin line by line
            for line in sys.stdin:
                self.handle_message(line.strip())
        except KeyboardInterrupt:
            self.log("Server interrupted")
        except Exception as e:
            self.log(f"Server error: {e}")

if __name__ == "__main__":
    server = MCPServer()
    server.run()