import * as fs from 'fs';
import * as path from 'path';
import { MCPTool } from './types.js';

export class MCPTools {
  // Define available tools
  static getToolDefinitions(): MCPTool[] {
    return [
      {
        name: "listFiles",
        description: "List files in a directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory path to list files from (optional, defaults to current directory)"
            }
          }
        }
      },
      {
        name: "readFile",
        description: "Read contents of a file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to read"
            }
          },
          required: ["filePath"]
        }
      },
      {
        name: "getGitStatus",
        description: "Get current Git repository status",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];
  }

  // Execute tool commands
  static async executeTool(toolName: string, params: any): Promise<any> {
    switch (toolName) {
      case "listFiles":
        return await this.listFiles(params.directory);
      
      case "readFile":
        return await this.readFile(params.filePath);
      
      case "getGitStatus":
        return await this.getGitStatus();
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Tool implementations
  private static async listFiles(directory: string = process.cwd()): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(directory);
      return files.filter(file => !file.startsWith('.'));
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  private static async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = path.resolve(filePath);
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  private static async getGitStatus(): Promise<string> {
    try {
      // For now, return a placeholder - we'll implement Git integration later
      return "Git integration coming soon...";
    } catch (error) {
      throw new Error(`Failed to get Git status: ${error}`);
    }
  }
}
