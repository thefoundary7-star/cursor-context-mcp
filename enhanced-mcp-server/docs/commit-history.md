# Commit History Tool

The `get_commit_history` tool retrieves and analyzes commit history from Git repositories with comprehensive filtering and structured output.

## Features

- **Commit Retrieval**: Get commit history for any branch or repository
- **Advanced Filtering**: Filter by author, date range, file, and branch
- **Structured Output**: Normalized commit data with metadata
- **Error Handling**: Comprehensive error handling for various scenarios
- **Performance**: Efficient Git command execution with timeout handling

## Usage

### Basic Commit History
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_commit_history",
    "arguments": {
      "repository": ".",
      "limit": 10
    }
  }
}
```

### With Filters
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_commit_history",
    "arguments": {
      "repository": ".",
      "branch": "main",
      "limit": 20,
      "author": "developer@example.com",
      "since": "2024-01-01",
      "until": "2024-12-31",
      "filePath": "src/utils.js"
    }
  }
}
```

## Parameters

### Required Parameters
None - all parameters are optional

### Optional Parameters
- **`repository`** (string): Path to the Git repository (default: ".")
- **`branch`** (string): Branch to get commit history for (default: "HEAD")
- **`limit`** (number): Maximum number of commits to return (default: 50, max: 1000)
- **`author`** (string): Filter commits by author email or name
- **`since`** (string): Show commits since this date (ISO format)
- **`until`** (string): Show commits until this date (ISO format)
- **`filePath`** (string): Filter commits that modified this file

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "commits": [
      {
        "sha": "a1b2c3d4e5f6789012345678901234567890abcd",
        "author": "John Doe",
        "email": "john@example.com",
        "date": "2024-01-15T10:30:00+00:00",
        "message": "Add new feature for user authentication"
      },
      {
        "sha": "b2c3d4e5f6789012345678901234567890abcdef",
        "author": "Jane Smith",
        "email": "jane@example.com",
        "date": "2024-01-14T14:20:00+00:00",
        "message": "Fix bug in login validation"
      }
    ],
    "total": 2,
    "repository": "/path/to/repository",
    "branch": "main",
    "filters": {
      "author": "developer@example.com",
      "since": "2024-01-01",
      "until": "2024-12-31",
      "filePath": "src/utils.js"
    },
    "message": "Retrieved 2 commits from main"
  }
}
```

### Error Responses

#### Not a Git Repository
```json
{
  "success": false,
  "error": "Not a git repository",
  "data": {
    "error": "Not a git repository",
    "message": "Directory /path/to/directory is not a Git repository",
    "repository": "/path/to/directory"
  }
}
```

#### Branch Not Found
```json
{
  "success": false,
  "error": "Branch not found",
  "data": {
    "error": "Branch not found",
    "message": "Branch feature-branch does not exist in the repository",
    "repository": "/path/to/repository",
    "branch": "feature-branch"
  }
}
```

#### Git Command Failed
```json
{
  "success": false,
  "error": "Git command failed",
  "data": {
    "error": "Git command failed",
    "message": "Git command failed: fatal: ambiguous argument 'invalid-branch'",
    "repository": "/path/to/repository",
    "branch": "invalid-branch"
  }
}
```

## Git Command Implementation

The tool uses the following Git command structure:

```bash
git log --pretty=format:%H|%an|%ae|%ad|%s --date=iso -n{limit} [filters] [branch] [-- filePath]
```

### Command Options
- **`--pretty=format:%H|%an|%ae|%ad|%s`**: Custom format with pipe separators
- **`--date=iso`**: ISO format for dates
- **`-n{limit}`**: Limit number of commits
- **`--author`**: Filter by author
- **`--since`**: Filter by start date
- **`--until`**: Filter by end date
- **`-- filePath`**: Filter by file path

### Output Format
Each commit line follows the format:
```
{sha}|{author}|{email}|{date}|{message}
```

## Examples

### Get Recent Commits
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "limit": 10
  }
}
```

### Filter by Author
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "author": "john@example.com",
    "limit": 20
  }
}
```

### Date Range Filter
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "since": "2024-01-01",
    "until": "2024-03-31",
    "limit": 50
  }
}
```

### File-specific Commits
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "filePath": "src/components/Button.tsx",
    "limit": 15
  }
}
```

### Branch-specific History
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "branch": "feature/user-auth",
    "limit": 25
  }
}
```

### Combined Filters
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "branch": "main",
    "author": "developer@example.com",
    "since": "2024-01-01",
    "filePath": "package.json",
    "limit": 10
  }
}
```

## Error Handling

### Repository Validation
- **Git Directory Check**: Validates `.git` directory exists
- **Path Resolution**: Resolves relative paths to absolute paths
- **Permission Check**: Handles file system permission errors

### Command Execution
- **Timeout Handling**: 30-second timeout for Git commands
- **Error Parsing**: Parses Git error messages for specific error types
- **Process Management**: Proper cleanup of child processes

### Common Error Scenarios
- **Not a Git Repository**: Directory doesn't contain `.git` folder
- **Branch Not Found**: Specified branch doesn't exist
- **Invalid Date Format**: Malformed date strings
- **Permission Denied**: Insufficient file system permissions
- **Command Timeout**: Git command exceeds timeout limit

## Performance Considerations

### Large Repositories
- **Limit Parameter**: Use appropriate limits to avoid performance issues
- **Date Filtering**: Use date ranges to limit commit scope
- **File Filtering**: Filter by specific files to reduce output

### Best Practices
```json
// For large repositories, use smaller limits
{
  "limit": 20,
  "since": "2024-01-01"
}

// For specific analysis, filter by file
{
  "filePath": "src/utils.js",
  "limit": 10
}

// For recent changes, use date filtering
{
  "since": "2024-01-01",
  "limit": 50
}
```

## Integration with Other Tools

### With File Tools
```javascript
// Get file information first
const fileInfo = await handleFileTool('get_file_stats', {
  path: 'src/utils.js'
});

// Then get commit history for that file
const commits = await handleGitTool('get_commit_history', {
  filePath: 'src/utils.js',
  limit: 10
});
```

### With Code Tools
```javascript
// Search for symbols
const symbols = await handleCodeTool('search_symbols', {
  query: 'function',
  directory: 'src'
});

// Get commit history for the directory
const commits = await handleGitTool('get_commit_history', {
  repository: 'src',
  limit: 20
});
```

## Use Cases

### Development Workflow
- **Code Review**: Analyze recent commits before review
- **Bug Tracking**: Find commits that introduced issues
- **Feature Development**: Track feature implementation progress
- **Release Management**: Analyze commits for releases

### Analysis and Reporting
- **Commit Patterns**: Analyze commit frequency and patterns
- **Author Activity**: Track developer contributions
- **File Evolution**: Understand how files change over time
- **Project History**: Generate project timeline reports

## Limitations

- **Git Repository Required**: All operations require a valid Git repository
- **Command Line Dependency**: Relies on Git command line tools being available
- **Performance**: Large repositories may have performance implications
- **Platform Support**: Git command availability varies by platform

## Future Enhancements

- **GraphQL Integration**: Add GraphQL support for complex queries
- **Real-time Updates**: WebSocket support for real-time commit monitoring
- **Advanced Filtering**: More sophisticated filtering and search capabilities
- **Visualization**: Integration with visualization tools for commit history
- **Automation**: Support for Git hooks and automated workflows
