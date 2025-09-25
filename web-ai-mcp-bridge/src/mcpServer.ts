import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fetch from 'node-fetch';

// VS Code extension connection settings
const VSCODE_API_BASE = 'http://localhost:3001';

// Tool argument schemas
const ReadFileArgsSchema = z.object({
  path: z.string().describe('File path relative to workspace root'),
});

const WriteFileArgsSchema = z.object({
  path: z.string().describe('File path relative to workspace root'),
  content: z.string().describe('Content to write to the file'),
});

const ListFilesArgsSchema = z.object({
  directory: z.string().optional().describe('Directory path (optional, defaults to workspace root)'),
});

const RunTerminalArgsSchema = z.object({
  command: z.string().describe('Terminal command to execute'),
});

class WebAIMCPBridge {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'web-ai-mcp-bridge',
        version: '1.0.0',
        description: 'MCP bridge connecting web AI services to VS Code development tools'
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_file',
            description: 'Read the contents of a file from the VS Code workspace',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'File path relative to workspace root',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write content to a file in the VS Code workspace',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'File path relative to workspace root',
                },
                content: {
                  type: 'string',
                  description: 'Content to write to the file',
                },
              },
              required: ['path', 'content'],
            },
          },
          {
            name: 'list_files',
            description: 'List files in a directory within the VS Code workspace',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path (optional, defaults to workspace root)',
                },
              },
            },
          },
          {
            name: 'get_workspace_context',
            description: 'Get comprehensive workspace context including all open files',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'run_terminal',
            description: 'Execute a terminal command in the VS Code workspace',
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'Terminal command to execute',
                },
              },
              required: ['command'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_file':
            return await this.handleReadFile(ReadFileArgsSchema.parse(args));
          
          case 'write_file':
            return await this.handleWriteFile(WriteFileArgsSchema.parse(args));
          
          case 'list_files':
            return await this.handleListFiles(ListFilesArgsSchema.parse(args));
          
          case 'get_workspace_context':
            return await this.handleGetWorkspaceContext();
          
          case 'run_terminal':
            return await this.handleRunTerminal(RunTerminalArgsSchema.parse(args));
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleReadFile(args: z.infer<typeof ReadFileArgsSchema>) {
    try {
      // Call VS Code extension's new read_file tool endpoint
      const response = await fetch(`${VSCODE_API_BASE}/tools/read_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: args.path }),
      });

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error reading file');
      }

      return {
        content: [
          {
            type: 'text',
            text: `File: ${args.path}\n\n${result.content}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading file ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleWriteFile(args: z.infer<typeof WriteFileArgsSchema>) {
    try {
      // Call VS Code extension's write_file tool endpoint
      const response = await fetch(`${VSCODE_API_BASE}/tools/write_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: args.path, content: args.content }),
      });

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error writing file');
      }

      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote ${args.content.length} characters to ${args.path}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error writing file ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListFiles(args: z.infer<typeof ListFilesArgsSchema>) {
    try {
      // Call VS Code extension's list_files tool endpoint
      const response = await fetch(`${VSCODE_API_BASE}/tools/list_files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory: args.directory }),
      });

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error listing files');
      }

      const fileList = result.files.map((file: any) => `${file.type === 'directory' ? '[DIR]' : '[FILE]'} ${file.name}`).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Files in ${args.directory || 'workspace root'}:\n\n${fileList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing files: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetWorkspaceContext() {
    try {
      // Call your existing context endpoint
      const response = await fetch(`${VSCODE_API_BASE}/context`);

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error getting workspace context');
      }

      const context = result.data;
      const summary = `
Workspace Context:
- Root: ${context.workspaceRoot}
- Active File: ${context.activeFile.path} (${context.activeFile.language})
- Open Files: ${context.openFiles.length} files

Active File Content:
${context.activeFile.content}

Other Open Files:
${context.openFiles.map((file: any) => `- ${file.path} (${file.language})`).join('\n')}
      `;

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting workspace context: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleRunTerminal(args: z.infer<typeof RunTerminalArgsSchema>) {
    try {
      // Call VS Code extension's run_terminal tool endpoint
      const response = await fetch(`${VSCODE_API_BASE}/tools/run_terminal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: args.command }),
      });

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error running terminal command');
      }

      return {
        content: [
          {
            type: 'text',
            text: `Command: ${args.command}\n\nOutput:\n${result.output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error running terminal command: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Web AI MCP Bridge server running on stdio');
  }
}

// Start the server
const bridge = new WebAIMCPBridge();
bridge.run().catch(console.error);