#!/usr/bin/env node

import { MCPRequest, MCPResponse, MCPError, MCPServerCapabilities } from './types.js';
import { MCPTools } from './tools.js';

class MCPServer {
  private version = "1.0.0";
  private serverName = "cursor-context-mcp";

  constructor() {
    console.log(`${this.serverName} v${this.version} starting...`);
    this.setupStdioHandler();
  }

  private setupStdioHandler() {
    // Handle stdin for MCP protocol
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      this.handleMessage(data.toString().trim());
    });

    // Keep process alive
    process.stdin.resume();
  }

  private async handleMessage(message: string) {
    if (!message) return;

    try {
      const request: MCPRequest = JSON.parse(message);
      console.error(`Received request: ${request.method}`); // Log to stderr so it doesn't interfere with MCP protocol
      
      const response = await this.processRequest(request);
      this.sendResponse(response);
    } catch (error) {
      console.error(`Error parsing message: ${error}`);
      this.sendError(null, -32700, "Parse error");
    }
  }

  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);
        
        case "notifications/initialized":
          // Handle the initialized notification (no response needed)
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {}
          };
        
        case "tools/list":
          return this.handleToolsList(request);
        
        case "tools/call":
          return await this.handleToolCall(request);
        
        case "prompts/list":
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              prompts: []
            }
          };
        
        case "resources/list":
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              resources: []
            }
          };
        
        default:
          throw new Error(`Unknown method: ${request.method}`);
      }
    } catch (error) {
      return this.createErrorResponse(request.id, -32601, `Method not found: ${error}`);
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    const capabilities: MCPServerCapabilities = {
      tools: {
        listChanged: false
      },
      resources: {
        subscribe: false,
        listChanged: false
      }
    };

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities,
        serverInfo: {
          name: this.serverName,
          version: this.version
        }
      }
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools = MCPTools.getToolDefinitions();
    
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools
      }
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    try {
      const { name, arguments: args } = request.params;
      const result = await MCPTools.executeTool(name, args || {});
      
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "text",
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Tool execution failed: ${error}`);
    }
  }

  private createErrorResponse(id: string | number | null, code: number, message: string): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: id || 0,
      error: {
        code,
        message
      }
    };
  }

  private sendResponse(response: MCPResponse) {
    console.log(JSON.stringify(response));
  }

  private sendError(id: string | number | null, code: number, message: string) {
    this.sendResponse(this.createErrorResponse(id, code, message));
  }

  start() {
    console.error(`${this.serverName} v${this.version} is ready for MCP connections!`);
    console.error(`Process ID: ${process.pid}`);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.error('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }
}

// Start the server
const server = new MCPServer();
server.start();