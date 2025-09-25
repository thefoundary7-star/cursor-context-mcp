# Git Integration Tools

The Git Integration tools provide comprehensive Git repository analysis and management capabilities through the MCP server.

## Overview

These tools enable you to:
- Analyze commit history and patterns
- Track file authorship and changes
- Manage branch information
- Find commits that modified specific files
- Integrate Git operations into your development workflow

## Available Tools

### 1. get_commit_history
Retrieve commit history for a repository or specific branch.

**Parameters:**
- `repository` (string): Path to the Git repository (default: ".")
- `branch` (string): Branch to get commit history for (default: "HEAD")
- `limit` (number): Maximum number of commits to return (default: 50, max: 1000)
- `author` (string): Filter commits by author email or name
- `since` (string): Show commits since this date (ISO format)
- `until` (string): Show commits until this date (ISO format)

**Example:**
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "branch": "main",
    "limit": 20,
    "author": "developer@example.com",
    "since": "2024-01-01"
  }
}
```

### 2. get_file_blame
Get blame information for a specific file showing line-by-line authorship.

**Parameters:**
- `repository` (string): Path to the Git repository (default: ".")
- `filePath` (string): Path to the file to get blame for (required)
- `revision` (string): Git revision to get blame for (default: "HEAD")
- `lineStart` (number): Start line number for blame (1-based)
- `lineEnd` (number): End line number for blame (1-based)

**Example:**
```json
{
  "name": "get_file_blame",
  "arguments": {
    "repository": ".",
    "filePath": "src/utils.js",
    "revision": "HEAD",
    "lineStart": 1,
    "lineEnd": 50
  }
}
```

### 3. get_branch_info
Get information about branches in the repository.

**Parameters:**
- `repository` (string): Path to the Git repository (default: ".")
- `branch` (string): Specific branch to get info for
- `includeRemote` (boolean): Include remote branches (default: true)
- `includeMerged` (boolean): Include merged branches (default: false)

**Example:**
```json
{
  "name": "get_branch_info",
  "arguments": {
    "repository": ".",
    "includeRemote": true,
    "includeMerged": false
  }
}
```

### 4. find_commits_touching_file
Find commits that modified a specific file.

**Parameters:**
- `repository` (string): Path to the Git repository (default: ".")
- `filePath` (string): Path to the file to find commits for (required)
- `limit` (number): Maximum number of commits to return (default: 50, max: 1000)
- `author` (string): Filter commits by author email or name
- `since` (string): Show commits since this date (ISO format)
- `until` (string): Show commits until this date (ISO format)
- `includeMerges` (boolean): Include merge commits (default: true)

**Example:**
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "repository": ".",
    "filePath": "src/components/Button.tsx",
    "limit": 10,
    "author": "developer@example.com"
  }
}
```

## Implementation Status

All Git tools are currently in **placeholder status** with the following planned implementations:

### get_commit_history
- **TODO**: Use `git log` command with various options
- **TODO**: Parse commit hash, author, date, message
- **TODO**: Support filtering by author, date range, branch
- **TODO**: Return structured commit data with metadata

### get_file_blame
- **TODO**: Use `git blame` command to get line-by-line authorship
- **TODO**: Parse blame output to extract author, date, commit for each line
- **TODO**: Support line range filtering and revision specification
- **TODO**: Return structured blame data with line details

### get_branch_info
- **TODO**: Use `git branch` commands to list local and remote branches
- **TODO**: Parse branch information including last commit, author, date
- **TODO**: Support filtering by merged status and remote tracking
- **TODO**: Return structured branch data with metadata

### find_commits_touching_file
- **TODO**: Use `git log --follow` to track file changes across renames
- **TODO**: Parse commit information for file modifications
- **TODO**: Support filtering by author, date range, merge commits
- **TODO**: Return structured commit data for file changes

## Current Response Format

All tools currently return placeholder responses:

```json
{
  "success": true,
  "data": {
    "status": "not yet implemented",
    "tool": "get_commit_history",
    "message": "Commit history retrieval will provide detailed commit information",
    "args": {
      "repository": ".",
      "branch": "HEAD",
      "limit": 10
    }
  }
}
```

## Future Implementation Plans

### Phase 1: Core Git Operations
- Implement basic `git log` parsing for commit history
- Add `git blame` functionality for file authorship
- Create branch listing and information retrieval

### Phase 2: Advanced Features
- Add filtering and search capabilities
- Implement date range and author filtering
- Add support for complex Git operations

### Phase 3: Integration Features
- Add caching for frequently accessed data
- Implement real-time repository monitoring
- Add support for Git hooks and automation

## Usage Examples

### Get Recent Commits
```json
{
  "name": "get_commit_history",
  "arguments": {
    "repository": ".",
    "limit": 10,
    "since": "2024-01-01"
  }
}
```

### Find File Authors
```json
{
  "name": "get_file_blame",
  "arguments": {
    "filePath": "src/utils.js",
    "lineStart": 1,
    "lineEnd": 100
  }
}
```

### List All Branches
```json
{
  "name": "get_branch_info",
  "arguments": {
    "includeRemote": true,
    "includeMerged": false
  }
}
```

### Track File Changes
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "filePath": "package.json",
    "limit": 20
  }
}
```

## Integration with Other Tools

### With File Tools
```javascript
// Get file information
const fileInfo = await handleFileTool('get_file_stats', {
  path: 'src/utils.js'
});

// Get file blame information
const blameInfo = await handleGitTool('get_file_blame', {
  filePath: 'src/utils.js'
});
```

### With Code Tools
```javascript
// Search for symbols
const symbols = await handleCodeTool('search_symbols', {
  query: 'function',
  directory: 'src'
});

// Find commits that touched those files
const commits = await handleGitTool('find_commits_touching_file', {
  filePath: 'src/utils.js'
});
```

## Error Handling

The Git tools will handle various error scenarios:

- **Repository Not Found**: Returns error if Git repository is not found
- **Invalid Parameters**: Validates input parameters and returns appropriate errors
- **Git Command Failures**: Handles Git command execution errors gracefully
- **Permission Issues**: Handles file system permission errors

## Best Practices

### 1. Repository Paths
```javascript
// Use absolute paths for better reliability
{
  "repository": "/path/to/your/repo"
}

// Or use relative paths from current directory
{
  "repository": "."
}
```

### 2. Parameter Validation
```javascript
// Always provide required parameters
{
  "filePath": "src/utils.js"  // Required for file-based operations
}

// Use appropriate limits to avoid performance issues
{
  "limit": 50  // Reasonable limit for most operations
}
```

### 3. Date Filtering
```javascript
// Use ISO date format for date filtering
{
  "since": "2024-01-01T00:00:00Z",
  "until": "2024-12-31T23:59:59Z"
}
```

## Limitations

- **Git Repository Required**: All operations require a valid Git repository
- **Command Line Dependency**: Relies on Git command line tools being available
- **Performance**: Large repositories may have performance implications
- **Platform Support**: Git command availability varies by platform

## Future Enhancements

- **GraphQL Integration**: Add GraphQL support for complex queries
- **Real-time Updates**: WebSocket support for real-time repository changes
- **Advanced Filtering**: More sophisticated filtering and search capabilities
- **Visualization**: Integration with visualization tools for Git history
- **Automation**: Support for Git hooks and automated workflows
