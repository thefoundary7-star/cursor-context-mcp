# File Blame Tool

The `get_file_blame` tool provides line-by-line authorship information for files in Git repositories, showing who wrote each line and when.

## Features

- **Line-by-line Authorship**: Track who wrote each line of code
- **Revision Support**: Get blame information for specific commits/branches
- **Line Range Filtering**: Focus on specific line ranges
- **Structured Output**: Normalized blame data with metadata
- **Error Handling**: Comprehensive error handling for various scenarios

## Usage

### Basic File Blame
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_file_blame",
    "arguments": {
      "filePath": "src/utils.js"
    }
  }
}
```

### With Line Range
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_file_blame",
    "arguments": {
      "filePath": "src/utils.js",
      "lineStart": 10,
      "lineEnd": 20
    }
  }
}
```

### With Specific Revision
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_file_blame",
    "arguments": {
      "filePath": "src/utils.js",
      "revision": "abc123def456",
      "lineStart": 1,
      "lineEnd": 50
    }
  }
}
```

## Parameters

### Required Parameters
- **`filePath`** (string): Path to the file to get blame information for

### Optional Parameters
- **`repository`** (string): Path to the Git repository (default: ".")
- **`revision`** (string): Git revision to get blame for (default: "HEAD")
- **`lineStart`** (number): Start line number for blame (1-based)
- **`lineEnd`** (number): End line number for blame (1-based)

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "lines": [
      {
        "lineNumber": 1,
        "sha": "a1b2c3d4e5f6789012345678901234567890abcd",
        "author": "John Doe",
        "email": "john@example.com",
        "date": "2024-01-15T10:30:00.000Z",
        "content": "import { createSafeResult } from '../types/schemas.js';"
      },
      {
        "lineNumber": 2,
        "sha": "b2c3d4e5f6789012345678901234567890abcdef",
        "author": "Jane Smith",
        "email": "jane@example.com",
        "date": "2024-01-14T14:20:00.000Z",
        "content": "import { spawn } from 'child_process';"
      }
    ],
    "total": 2,
    "repository": "/path/to/repository",
    "filePath": "src/utils.js",
    "revision": "HEAD",
    "lineRange": {
      "start": 1,
      "end": 2
    },
    "message": "Retrieved blame information for 2 lines in src/utils.js"
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
    "message": "Please provide a filePath to get blame information for"
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

#### Invalid Revision
```json
{
  "success": false,
  "error": "Invalid revision",
  "data": {
    "error": "Invalid revision",
    "message": "Revision abc123def456 does not exist in the repository",
    "repository": "/path/to/repository",
    "filePath": "src/utils.js",
    "revision": "abc123def456"
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

## Git Command Implementation

The tool uses the following Git command structure:

```bash
git blame --line-porcelain [revision] [-L start,end] -- <filePath>
```

### Command Options
- **`--line-porcelain`**: Detailed porcelain format output
- **`revision`**: Specific commit, branch, or tag to blame
- **`-L start,end`**: Line range specification
- **`-- <filePath>`**: File path to blame

### Porcelain Output Format
Git blame porcelain output includes:
- **Commit hash**: SHA of the commit that introduced the line
- **Author information**: Name and email of the author
- **Author timestamp**: When the line was authored
- **Committer information**: Name, email, and timestamp of committer
- **Line content**: The actual line of code

## Examples

### Get Full File Blame
```json
{
  "name": "get_file_blame",
  "arguments": {
    "filePath": "src/components/Button.tsx"
  }
}
```

### Get Specific Line Range
```json
{
  "name": "get_file_blame",
  "arguments": {
    "filePath": "src/utils.js",
    "lineStart": 10,
    "lineEnd": 25
  }
}
```

### Get Blame for Specific Commit
```json
{
  "name": "get_file_blame",
  "arguments": {
    "filePath": "package.json",
    "revision": "v1.2.3"
  }
}
```

### Get Blame for Branch
```json
{
  "name": "get_file_blame",
  "arguments": {
    "filePath": "src/index.ts",
    "revision": "feature/user-auth"
  }
}
```

### Get Blame with Line Range and Revision
```json
{
  "name": "get_file_blame",
  "arguments": {
    "filePath": "src/utils.js",
    "revision": "main",
    "lineStart": 1,
    "lineEnd": 50
  }
}
```

## Use Cases

### Code Review
- **Line Attribution**: Identify who wrote specific lines
- **Change History**: Understand when lines were introduced
- **Author Analysis**: Track contributions by developer

### Debugging
- **Bug Tracking**: Find who introduced problematic code
- **Change Investigation**: Understand code evolution
- **Responsibility Assignment**: Identify code owners

### Documentation
- **Code Ownership**: Document who maintains specific code
- **Change Attribution**: Track modifications over time
- **Team Analysis**: Understand team contributions

### Quality Assurance
- **Code Review**: Verify authorship during reviews
- **Change Validation**: Confirm expected authors
- **Audit Trails**: Track code modifications

## Error Handling

### File Validation
- **File Existence**: Validates file exists in repository
- **Git Tracking**: Ensures file is under version control
- **Path Resolution**: Resolves relative paths correctly

### Revision Validation
- **Commit Existence**: Validates revision exists
- **Branch Validation**: Ensures branch is accessible
- **Tag Validation**: Confirms tag references

### Command Execution
- **Timeout Handling**: 30-second timeout for Git commands
- **Error Parsing**: Parses Git error messages for specific errors
- **Process Management**: Proper cleanup of child processes

## Performance Considerations

### Large Files
- **Line Range**: Use line ranges for large files
- **Revision Selection**: Choose specific revisions when possible
- **Caching**: Consider caching for frequently accessed files

### Best Practices
```json
// For large files, use line ranges
{
  "filePath": "large-file.js",
  "lineStart": 1,
  "lineEnd": 100
}

// For specific analysis, use revisions
{
  "filePath": "src/utils.js",
  "revision": "main"
}

// For recent changes, use HEAD
{
  "filePath": "package.json"
}
```

## Integration with Other Tools

### With File Tools
```javascript
// Get file information first
const fileInfo = await handleFileTool('get_file_stats', {
  path: 'src/utils.js'
});

// Then get blame information
const blame = await handleGitTool('get_file_blame', {
  filePath: 'src/utils.js'
});
```

### With Commit History
```javascript
// Get commit history for file
const commits = await handleGitTool('get_commit_history', {
  filePath: 'src/utils.js',
  limit: 10
});

// Get blame for specific lines
const blame = await handleGitTool('get_file_blame', {
  filePath: 'src/utils.js',
  lineStart: 1,
  lineEnd: 50
});
```

## Limitations

- **Git Repository Required**: All operations require a valid Git repository
- **File Tracking**: File must be tracked by Git
- **Command Line Dependency**: Relies on Git command line tools
- **Performance**: Large files may have performance implications

## Future Enhancements

- **Caching**: Cache blame results for frequently accessed files
- **Real-time Updates**: WebSocket support for real-time blame updates
- **Advanced Filtering**: More sophisticated filtering capabilities
- **Visualization**: Integration with visualization tools for blame data
- **Batch Operations**: Support for blaming multiple files simultaneously
