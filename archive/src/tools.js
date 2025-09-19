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
exports.MCPTools = void 0;
var fs = require("fs");
var path = require("path");
var MCPTools = /** @class */ (function () {
    function MCPTools() {
    }
    // Define available tools
    MCPTools.getToolDefinitions = function () {
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
    };
    // Execute tool commands
    MCPTools.executeTool = function (toolName, params) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = toolName;
                        switch (_a) {
                            case "listFiles": return [3 /*break*/, 1];
                            case "readFile": return [3 /*break*/, 3];
                            case "getGitStatus": return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 7];
                    case 1: return [4 /*yield*/, this.listFiles(params.directory)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3: return [4 /*yield*/, this.readFile(params.filePath)];
                    case 4: return [2 /*return*/, _b.sent()];
                    case 5: return [4 /*yield*/, this.getGitStatus()];
                    case 6: return [2 /*return*/, _b.sent()];
                    case 7: throw new Error("Unknown tool: ".concat(toolName));
                }
            });
        });
    };
    // Tool implementations
    MCPTools.listFiles = function () {
        return __awaiter(this, arguments, void 0, function (directory) {
            var files, error_1;
            if (directory === void 0) { directory = process.cwd(); }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs.promises.readdir(directory)];
                    case 1:
                        files = _a.sent();
                        return [2 /*return*/, files.filter(function (file) { return !file.startsWith('.'); })];
                    case 2:
                        error_1 = _a.sent();
                        throw new Error("Failed to list files: ".concat(error_1));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MCPTools.readFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var fullPath, content, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        fullPath = path.resolve(filePath);
                        return [4 /*yield*/, fs.promises.readFile(fullPath, 'utf-8')];
                    case 1:
                        content = _a.sent();
                        return [2 /*return*/, content];
                    case 2:
                        error_2 = _a.sent();
                        throw new Error("Failed to read file: ".concat(error_2));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MCPTools.getGitStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    // For now, return a placeholder - we'll implement Git integration later
                    return [2 /*return*/, "Git integration coming soon..."];
                }
                catch (error) {
                    throw new Error("Failed to get Git status: ".concat(error));
                }
                return [2 /*return*/];
            });
        });
    };
    return MCPTools;
}());
exports.MCPTools = MCPTools;
