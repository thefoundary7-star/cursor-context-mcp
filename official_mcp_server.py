#!/usr/bin/env python3
"""
Official MCP Server using the FastMCP framework
Following the official MCP documentation patterns
"""

import os
from pathlib import Path
from typing import List

from mcp.server.fastmcp import FastMCP

# Initialize the MCP server
mcp = FastMCP("Official MCP Server")


@mcp.tool()
def list_files(directory: str = ".") -> str:
    """
    List files and directories in a given path.
    
    Args:
        directory: The directory path to list files from. Defaults to current directory.
    
    Returns:
        A formatted string listing the contents of the directory.
    """
    try:
        path_obj = Path(directory).resolve()
        
        if not path_obj.exists():
            return f"Error: Path '{directory}' does not exist"
        
        if not path_obj.is_dir():
            return f"Error: Path '{directory}' is not a directory"
        
        files = []
        directories = []
        
        for item in path_obj.iterdir():
            if item.is_file():
                files.append(item.name)
            elif item.is_dir():
                directories.append(item.name)
        
        # Sort the results
        files.sort()
        directories.sort()
        
        result = f"Contents of '{directory}':\n\n"
        
        if directories:
            result += "Directories:\n"
            for directory in directories:
                result += f"  📁 {directory}\n"
            result += "\n"
        
        if files:
            result += "Files:\n"
            for file in files:
                result += f"  📄 {file}\n"
        
        if not directories and not files:
            result += "Directory is empty.\n"
        
        return result
        
    except Exception as e:
        return f"Error listing files: {str(e)}"


@mcp.tool()
def read_file(path: str) -> str:
    """
    Read the contents of a file.
    
    Args:
        path: The path to the file to read.
    
    Returns:
        The contents of the file as a string.
    """
    try:
        path_obj = Path(path).resolve()
        
        if not path_obj.exists():
            return f"Error: File '{path}' does not exist"
        
        if not path_obj.is_file():
            return f"Error: Path '{path}' is not a file"
        
        # Check file size to avoid reading huge files
        file_size = path_obj.stat().st_size
        if file_size > 1024 * 1024:  # 1MB limit
            return f"Error: File '{path}' is too large ({file_size} bytes). Maximum size is 1MB."
        
        content = path_obj.read_text(encoding='utf-8')
        
        result = f"Contents of '{path}':\n"
        result += "=" * 50 + "\n"
        result += content
        
        return result
        
    except UnicodeDecodeError:
        return f"Error: File '{path}' contains binary data and cannot be displayed as text"
    except Exception as e:
        return f"Error reading file: {str(e)}"


@mcp.tool()
def get_file_info(path: str) -> str:
    """
    Get information about a file or directory.
    
    Args:
        path: The path to the file or directory.
    
    Returns:
        A formatted string with information about the file or directory.
    """
    try:
        path_obj = Path(path).resolve()
        
        if not path_obj.exists():
            return f"Error: Path '{path}' does not exist"
        
        stat = path_obj.stat()
        
        result = f"Information for '{path}':\n"
        result += "=" * 40 + "\n"
        result += f"Type: {'Directory' if path_obj.is_dir() else 'File'}\n"
        result += f"Size: {stat.st_size} bytes\n"
        result += f"Modified: {stat.st_mtime}\n"
        result += f"Created: {stat.st_ctime}\n"
        result += f"Absolute path: {path_obj}\n"
        
        if path_obj.is_file():
            result += f"Extension: {path_obj.suffix}\n"
            result += f"Name: {path_obj.name}\n"
            result += f"Stem: {path_obj.stem}\n"
        
        return result
        
    except Exception as e:
        return f"Error getting file info: {str(e)}"


if __name__ == "__main__":
    mcp.run()
