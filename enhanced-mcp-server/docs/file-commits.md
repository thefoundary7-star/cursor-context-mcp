# File Commits Tool

The `find_commits_touching_file` tool tracks the complete commit history for a specific file, including changes across renames, with comprehensive filtering and structured output.

## Features

- **File Tracking**: Track file changes across renames with `--follow`
- **Commit History**: Complete commit history for any tracked file
- **Advanced Filtering**: Filter by author, date range, merge commits
- **Structured Output**: Normalized commit data with metadata
- **Error Handling**: Comprehensive error handling for various scenarios

## Usage

### Basic File Commits
```json
{
  "method": "tools/call",
  "params": {
    "name": "find_commits_touching_file",
    "arguments": {
      "filePath": "src/utils.js"
    }
  }
}
```

### With Filters
```json
{
  "method": "tools/call",
  "params": {
    "name": "find_commits_touching_file",
    "arguments": {
      "filePath": "src/utils.js",
      "limit": 20,
      "author": "developer@example.com",
      "since": "2024-01-01",
      "until": "2024-12-31",
      "includeMerges": false
    }
  }
}
```

## Parameters

### Required Parameters
- **`filePath`** (string): Path to the file to find commits for

### Optional Parameters
- **`repository`** (string): Path to the Git repository (default: ".")
- **`limit`** (number): Maximum number of commits to return (default: 50, max: 1000)
- **`author`** (string): Filter commits by author email or name
- **`since`** (string): Show commits since this date (ISO format)
- **`until`** (string): Show commits until this date (ISO format)
- **`includeMerges`** (boolean): Include merge commits (default: false)

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
        "date": "2024-01-15T10:30:00.000Z",
        "message": "Add new utility function for data validation"
      },
      {
        "sha": "b2c3d4e5f6789012345678901234567890abcdef",
        "author": "Jane Smith",
        "email": "jane@example.com",
        "date": "2024-01-14T14:20:00.000Z",
        "message": "Fix bug in utility function"
      }
    ],
    "total": 2,
    "repository": "/path/to/repository",
    "filePath": "src/utils.js",
    "filters": {
      "author": "developer@example.com",
      "since": "2024-01-01",
      "until": "2024-12-31",
      "includeMerges": false
    },
    "message": "Found 2 commits that modified src/utils.js"
  }
}
```

### Error Responses

#### Missing filePath
```json
{
  "success": false,
  "error": "Missing filePath parameter",
  "data": {
    "error": "filePath is required",
    "message": "Please provide a filePath to find commits for"
  }
}
```

#### File Not Under Version Control
```json
{
  "success": false,
  "error": "File not under version control",
  "data": {
    "error": "File not under version control",
    "message": "File src/utils.js is not tracked by Git",
    "repository": "/path/to/repository",
    "filePath": "src/utils.js"
  }
}
```

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

#### Git Command Failed
```json
{
  "success": false,
  "error": "Git log command failed",
  "data": {
    "error": "Git log command failed",
    "message": "Git command failed: fatal: ambiguous argument 'invalid-branch'",
    "repository": "/path/to/repository",
    "filePath": "src/utils.js"
  }
}
```

## Git Command Implementation

The tool uses the following Git command structure:

```bash
git log --follow --pretty=format:%H|%an|%ae|%ad|%s --date=iso -n{limit} [--author] [--since] [--until] [--no-merges] -- <filePath>
```

### Command Options
- **`--follow`**: Track file changes across renames
- **`--pretty=format`**: Custom format with pipe separators
- **`--date=iso`**: ISO format for dates
- **`-n{limit}`**: Limit number of commits
- **`--author`**: Filter by author
- **`--since`**: Filter by start date
- **`--until`**: Filter by end date
- **`--no-merges`**: Exclude merge commits (when includeMerges=false)
- **`-- <filePath>`**: File path to track

### Output Format
Each commit line follows the format:
```
{sha}|{author}|{email}|{date}|{message}
```

## Examples

### Get Recent File Commits
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "filePath": "src/components/Button.tsx",
    "limit": 10
  }
}
```

### Filter by Author
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "filePath": "src/utils.js",
    "author": "john@example.com",
    "limit": 20
  }
}
```

### Date Range Filter
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "filePath": "package.json",
    "since": "2024-01-01",
    "until": "2024-03-31",
    "limit": 15
  }
}
```

### Exclude Merge Commits
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "filePath": "src/index.ts",
    "includeMerges": false,
    "limit": 25
  }
}
```

### All Filters Combined
```json
{
  "name": "find_commits_touching_file",
  "arguments": {
    "filePath": "src/utils.js",
    "limit": 10,
    "author": "developer@example.com",
    "since": "2024-01-01",
    "until": "2024-12-31",
    "includeMerges": false
  }
}
```

## Use Cases

### File Evolution Analysis
- **Change History**: Understand how a file has evolved over time
- **Author Attribution**: Track who made changes to specific files
- **Bug Tracking**: Find commits that introduced issues in specific files
- **Feature Development**: Track feature implementation in specific files

### Code Review
- **Change Context**: Understand the context of file modifications
- **Author Review**: Review changes by specific authors
- **Time-based Analysis**: Analyze changes within specific time periods
- **Merge Analysis**: Understand merge impact on files

### Development Workflow
- **File Ownership**: Identify who maintains specific files
- **Change Patterns**: Understand how files change over time
- **Impact Analysis**: Assess the impact of changes on specific files
- **Documentation**: Generate file change documentation

## Error Handling

### File Validation
- **File Existence**: Validates file exists in repository
- **Git Tracking**: Ensures file is under version control
- **Path Resolution**: Resolves file paths correctly

### Repository Validation
- **Git Directory Check**: Validates `.git` directory exists
- **Path Resolution**: Resolves relative paths to absolute paths
- **Permission Check**: Handles file system permission errors

### Command Execution
- **Timeout Handling**: 30-second timeout for Git commands
- **Error Parsing**: Parses Git error messages for specific errors
- **Process Management**: Proper cleanup of child processes

## Performance Considerations

### Large Files
- **Limit Parameter**: Use appropriate limits to avoid performance issues
- **Date Filtering**: Use date ranges to limit commit scope
- **Author Filtering**: Filter by author to reduce output

### Best Practices
```json
// For recent changes, use date filtering
{
  "filePath": "src/utils.js",
  "since": "2024-01-01",
  "limit": 20
}

// For specific analysis, use author filtering
{
  "filePath": "src/utils.js",
  "author": "developer@example.com",
  "limit": 10
}

// For comprehensive analysis, use higher limits
{
  "filePath": "package.json",
  "limit": 100
}
```

## Integration with Other Tools

### With File Blame
```javascript
// Get file blame first
const blame = await handleGitTool('get_file_blame', {
  filePath: 'src/utils.js'
});

// Then get commit history for that file
const commits = await handleGitTool('find_commits_touching_file', {
  filePath: 'src/utils.js',
  limit: 10
});
```

### With Commit History
```javascript
// Get general commit history
const history = await handleGitTool('get_commit_history', {
  repository: '.',
  limit: 20
});

// Then get file-specific commits
const fileCommits = await handleGitTool('find_commits_touching_file', {
  filePath: 'src/utils.js',
  limit: 10
});
```

## File Tracking Features

### Rename Tracking
- **`--follow` Flag**: Tracks file changes across renames
- **Complete History**: Shows complete file history even after renames
- **Path Changes**: Handles file path changes and moves

### Commit Filtering
- **Author Filtering**: Filter commits by specific authors
- **Date Range**: Filter commits within specific date ranges
- **Merge Filtering**: Include or exclude merge commits
- **Limit Control**: Control the number of commits returned

## Limitations

- **Git Repository Required**: All operations require a valid Git repository
- **File Tracking**: File must be tracked by Git
- **Command Line Dependency**: Relies on Git command line tools
- **Performance**: Large files with extensive history may have performance implications

## Future Enhancements

- **File Rename Detection**: Better detection and handling of file renames
- **Change Statistics**: Detailed statistics about file changes
- **Visualization**: Integration with visualization tools for file history
- **Batch Operations**: Support for tracking multiple files simultaneously
- **Real-time Updates**: WebSocket support for real-time file change monitoring
