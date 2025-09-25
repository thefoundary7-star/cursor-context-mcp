# Enhanced MCP Server

Professional-grade filesystem server with 26+ advanced features, extending @modelcontextprotocol/server-filesystem.

## Features

### 🔐 Enhanced File Operations
- **Secure File Access**: Path validation, access controls, and size limits
- **Atomic Operations**: Safe file writes with backup support
- **Smart Caching**: Intelligent caching with TTL and LRU eviction
- **File Monitoring**: Real-time file change detection and indexing

### 🔍 Code Navigation System
- **Symbol Search**: Find functions, classes, variables with fuzzy matching
- **Reference Tracking**: Cross-file reference detection and navigation
- **Multi-Language Support**: TypeScript, JavaScript, Python, Go
- **Incremental Indexing**: Efficient code indexing with change detection

### 🧪 Test Integration
- **Framework Support**: Jest, Mocha, Vitest, pytest auto-detection
- **Test Execution**: Run tests with coverage and timeout control
- **Result Parsing**: Structured test results with error details
- **Progress Monitoring**: Real-time test execution status

### 📚 Documentation Analysis
- **Multi-Format Support**: README, JSDoc, Python docstrings, TypeScript
- **Coverage Metrics**: Documentation completeness analysis
- **Quality Recommendations**: Automated documentation improvements
- **Comment Extraction**: Parse inline comments and documentation

### 📦 Dependency Analysis
- **Package Manager Support**: npm, pip, go.mod, Cargo.toml
- **Security Scanning**: Vulnerability detection and reporting
- **License Compatibility**: License conflict detection
- **Update Suggestions**: Outdated dependency notifications

### 🔄 Advanced Git Integration
- **Enhanced Diff**: Context-aware diffs with advanced formatting
- **Commit Analysis**: Detailed commit history with file tracking
- **Blame Information**: Line-by-line authorship tracking
- **Branch Management**: Multi-branch status and tracking

### ⚡ Performance & Security
- **Performance Monitoring**: Operation timing and resource usage
- **Security Auditing**: Code security scanning and analysis
- **Rate Limiting**: Request throttling and resource management
- **Error Handling**: Comprehensive error tracking and reporting

## Installation

### NPM Package (Recommended)

```bash
# Install globally for CLI usage
npm install -g @filebridge/enhanced-mcp-server

# Or use with npx
npx @filebridge/enhanced-mcp-server --help
```

### From Source

```bash
# Clone and build
git clone https://github.com/filebridge/enhanced-mcp-server.git
cd enhanced-mcp-server
npm install
npm run build

# Run
npm start
```

## Usage

### Basic Usage

```bash
# Start server with default settings
enhanced-mcp-server

# Specify allowed directories
enhanced-mcp-server --directories "/path/to/project,/another/path"

# Enable read-only mode
enhanced-mcp-server --read-only

# Set log level
enhanced-mcp-server --log-level debug
```

### Configuration File

Create a configuration file to customize behavior:

```json
{
  "allowedDirectories": ["/path/to/project"],
  "maxFileSize": 10485760,
  "enableFileWatching": true,
  "enablePerformanceMonitoring": true,
  "logLevel": "info",
  "rateLimits": {
    "maxRequestsPerMinute": 60,
    "slowOperationThreshold": 5.0
  },
  "indexingOptions": {
    "autoIndex": true,
    "excludePatterns": ["node_modules/**", ".git/**"],
    "includePatterns": ["**/*.ts", "**/*.js", "**/*.py"]
  }
}
```

```bash
enhanced-mcp-server --config config.json
```

### Claude Desktop Integration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "enhanced-filesystem": {
      "command": "npx",
      "args": ["@filebridge/enhanced-mcp-server"],
      "env": {
        "MCP_ALLOWED_DIRECTORIES": "/path/to/your/projects"
      }
    }
  }
}
```

## Tools Reference

### File Operations

#### `list_files`
List files and directories with filtering and metadata.

```json
{
  "directory": ".",
  "pattern": "*.ts",
  "recursive": true,
  "includeHidden": false
}
```

#### `read_file`
Read file contents with encoding detection and size limits.

```json
{
  "filePath": "src/index.ts",
  "maxLines": 100,
  "encoding": "utf-8"
}
```

#### `write_file`
Write content with atomic operations and backup support.

```json
{
  "filePath": "output.txt",
  "content": "Hello, World!",
  "backup": true,
  "createDirectories": true
}
```

### Code Navigation

#### `search_symbols`
Search for code symbols with fuzzy matching.

```json
{
  "query": "getUserData",
  "directory": "src",
  "symbolType": "function",
  "fuzzy": true,
  "fileExtensions": ["ts", "js"]
}
```

#### `find_references`
Find all references to a symbol.

```json
{
  "symbolName": "UserService",
  "directory": "src",
  "includeDefinition": true,
  "contextLines": 2
}
```

#### `index_directory`
Index a directory for symbol search.

```json
{
  "directory": "src",
  "recursive": true,
  "fileExtensions": ["ts", "js", "py"],
  "force": false
}
```

### Test Integration

#### `run_tests`
Run tests with framework auto-detection.

```json
{
  "directory": ".",
  "framework": "auto",
  "coverage": true,
  "timeout": 30000
}
```

#### `detect_test_framework`
Detect the test framework used in a project.

```json
{
  "directory": "."
}
```

### Server Management

#### `get_performance_stats`
Get comprehensive performance statistics.

#### `clear_caches`
Clear all caches to free memory.

```json
{
  "confirm": true
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowedDirectories` | string[] | `[cwd]` | Directories the server can access |
| `maxFileSize` | number | `10MB` | Maximum file size for operations |
| `maxCacheSize` | number | `100MB` | Maximum cache memory usage |
| `enableFileWatching` | boolean | `false` | Enable real-time file monitoring |
| `enablePerformanceMonitoring` | boolean | `true` | Enable performance tracking |
| `readOnlyMode` | boolean | `false` | Disable write operations |
| `logLevel` | string | `info` | Logging level (debug/info/warn/error) |

## Development

### Building

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm run clean    # Clean build artifacts
```

### Testing

```bash
npm test         # Run test suite
npm run test:watch  # Watch mode
npm run test:coverage  # With coverage
```

### Linting

```bash
npm run lint     # Check code style
npm run lint:fix # Fix auto-fixable issues
npm run format   # Format with Prettier
```

## Performance

The Enhanced MCP Server is optimized for performance:

- **Intelligent Caching**: Multi-level caching with TTL and LRU eviction
- **Lazy Loading**: Features are loaded on-demand
- **Efficient Indexing**: Incremental symbol indexing with change detection
- **Resource Management**: Memory and CPU usage monitoring
- **Rate Limiting**: Built-in request throttling

## Security

Security is a top priority:

- **Path Validation**: Prevents directory traversal attacks
- **Access Controls**: Strict directory access enforcement
- **Input Sanitization**: All inputs are validated with Zod schemas
- **Read-Only Mode**: Optional write operation disable
- **Security Auditing**: Built-in code security scanning

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📚 [Documentation](https://docs.filebridge.dev)
- 🐛 [Issue Tracker](https://github.com/filebridge/enhanced-mcp-server/issues)
- 💬 [Discussions](https://github.com/filebridge/enhanced-mcp-server/discussions)
- 📧 [Contact](mailto:support@filebridge.dev)

---

**Enhanced MCP Server** - Supercharging your development workflow with intelligent file operations and code navigation.