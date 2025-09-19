#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var tools_1 = require("./tools");
var MCPServer = /** @class */ (function () {
    function MCPServer() {
        this.version = "1.0.0";
        this.serverName = "cursor-context-mcp";
        console.log("".concat(this.serverName, " v").concat(this.version, " starting..."));
        this.setupStdioHandler();
    }
    MCPServer.prototype.setupStdioHandler = function () {
        var _this = this;
        // Handle stdin for MCP protocol
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', function (data) {
            _this.handleMessage(data.toString().trim());
        });
        // Keep process alive
        process.stdin.resume();
    };
    MCPServer.prototype.handleMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var request, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!message)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        request = JSON.parse(message);
                        console.error("Received request: ".concat(request.method)); // Log to stderr so it doesn't interfere with MCP protocol
                        return [4 /*yield*/, this.processRequest(request)];
                    case 2:
                        response = _a.sent();
                        this.sendResponse(response);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error("Error parsing message: ".concat(error_1));
                        this.sendError(null, -32700, "Parse error");
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPServer.prototype.processRequest = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        _a = request.method;
                        switch (_a) {
                            case "initialize": return [3 /*break*/, 1];
                            case "tools/list": return [3 /*break*/, 2];
                            case "tools/call": return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 5];
                    case 1: return [2 /*return*/, this.handleInitialize(request)];
                    case 2: return [2 /*return*/, this.handleToolsList(request)];
                    case 3: return [4 /*yield*/, this.handleToolCall(request)];
                    case 4: return [2 /*return*/, _b.sent()];
                    case 5: throw new Error("Unknown method: ".concat(request.method));
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_2 = _b.sent();
                        return [2 /*return*/, this.createErrorResponse(request.id, -32601, "Method not found: ".concat(error_2))];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    MCPServer.prototype.handleInitialize = function (request) {
        var capabilities = {
            tools: {
                listChanged: false
            }
        };
        return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
                protocolVersion: "2024-11-05",
                capabilities: capabilities,
                serverInfo: {
                    name: this.serverName,
                    version: this.version
                }
            }
        };
    };
    MCPServer.prototype.handleToolsList = function (request) {
        var tools = tools_1.MCPTools.getToolDefinitions();
        return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
                tools: tools
            }
        };
    };
    MCPServer.prototype.handleToolCall = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, name_1, args, result, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = request.params, name_1 = _a.name, args = _a.arguments;
                        return [4 /*yield*/, tools_1.MCPTools.executeTool(name_1, args || {})];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, {
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
                            }];
                    case 2:
                        error_3 = _b.sent();
                        return [2 /*return*/, this.createErrorResponse(request.id, -32603, "Tool execution failed: ".concat(error_3))];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MCPServer.prototype.createErrorResponse = function (id, code, message) {
        return {
            jsonrpc: "2.0",
            id: id || 0,
            error: {
                code: code,
                message: message
            }
        };
    };
    MCPServer.prototype.sendResponse = function (response) {
        console.log(JSON.stringify(response));
    };
    MCPServer.prototype.sendError = function (id, code, message) {
        this.sendResponse(this.createErrorResponse(id, code, message));
    };
    MCPServer.prototype.start = function () {
        console.error("".concat(this.serverName, " v").concat(this.version, " is ready for MCP connections!"));
        console.error("Process ID: ".concat(process.pid));
    };
    return MCPServer;
}());
// Start the server
var server = new MCPServer();
server.start();
