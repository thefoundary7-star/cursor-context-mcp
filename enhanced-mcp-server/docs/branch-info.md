# Branch Info Tool

The `get_branch_info` tool provides comprehensive information about Git branches, including local and remote branches, with detailed metadata about each branch.

## Features

- **Branch Listing**: List all local and remote branches
- **Detailed Metadata**: Author, date, SHA, upstream tracking information
- **Current Branch Detection**: Identify the currently checked out branch
- **Filtering Options**: Filter by merged status, remote inclusion, specific branches
- **Structured Output**: Normalized branch data with metadata

## Usage

### Basic Branch Info
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_branch_info",
    "arguments": {
      "repository": "."
    }
  }
}
```

### With Remote Branches
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_branch_info",
    "arguments": {
      "repository": ".",
      "includeRemote": true
    }
  }
}
```

### With Specific Branch
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_branch_info",
    "arguments": {
      "repository": ".",
      "branch": "main",
      "includeRemote": true
    }
  }
}
```

## Parameters

### Required Parameters
None - all parameters are optional

### Optional Parameters
- **`repository`** (string): Path to the Git repository (default: ".")
- **`branch`** (string): Specific branch to get info for
- **`includeRemote`** (boolean): Include remote branches (default: false)
- **`includeMerged`** (boolean): Include merged branches (default: true)

## Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "branches": [
      {
        "name": "main",
        "sha": "a1b2c3d4e5f6789012345678901234567890abcd",
        "author": "John Doe",
        "email": "john@example.com",
        "date": "2024-01-15T10:30:00.000Z",
        "upstream": "origin/main",
        "tracking": "[ahead 2, behind 1]",
        "isCurrent": true,
        "isRemote": false
      },
      {
        "name": "feature/user-auth",
        "sha": "b2c3d4e5f6789012345678901234567890abcdef",
        "author": "Jane Smith",
        "email": "jane@example.com",
        "date": "2024-01-14T14:20:00.000Z",
        "upstream": "origin/feature/user-auth",
        "tracking": "[ahead 5]",
        "isCurrent": false,
        "isRemote": false
      }
    ],
    "total": 2,
    "repository": "/path/to/repository",
    "currentBranch": "main",
    "filters": {
      "branch": null,
      "includeRemote": false,
      "includeMerged": true
    },
    "message": "Retrieved 2 branches from /path/to/repository"
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
  "error": "Git branch command failed",
  "data": {
    "error": "Git branch command failed",
    "message": "Git command failed: fatal: ambiguous argument 'invalid-branch'",
    "repository": "/path/to/repository"
  }
}
```

## Git Command Implementation

The tool uses the following Git command structure:

```bash
git for-each-ref --format="%(refname:short)|%(objectname:short)|%(authorname)|%(authoremail)|%(authordate:iso)|%(upstream:short)|%(upstream:track)" refs/heads [refs/remotes] [--no-merged] [refs/heads/branch]
```

### Command Options
- **`--format`**: Custom format with pipe separators
- **`refs/heads`**: Local branches
- **`refs/remotes`**: Remote branches (when includeRemote=true)
- **`--no-merged`**: Exclude merged branches (when includeMerged=false)
- **`refs/heads/branch`**: Specific branch filter

### Output Format
Each branch line follows the format:
```
{branch_name}|{sha}|{author}|{email}|{date}|{upstream}|{tracking}
```

## Examples

### Get All Local Branches
```json
{
  "name": "get_branch_info",
  "arguments": {
    "repository": "."
  }
}
```

### Get All Branches Including Remote
```json
{
  "name": "get_branch_info",
  "arguments": {
    "repository": ".",
    "includeRemote": true
  }
}
```

### Get Specific Branch
```json
{
  "name": "get_branch_info",
  "arguments": {
    "repository": ".",
    "branch": "main"
  }
}
```

### Get Unmerged Branches
```json
{
  "name": "get_branch_info",
  "arguments": {
    "repository": ".",
    "includeMerged": false
  }
}
```

### Get Remote Branches Only
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

## Use Cases

### Branch Management
- **Branch Overview**: Get comprehensive branch information
- **Current Branch**: Identify the currently checked out branch
- **Remote Tracking**: Understand upstream relationships
- **Branch Status**: Check ahead/behind status

### Development Workflow
- **Feature Branches**: Track feature branch development
- **Release Management**: Manage release branches
- **Code Review**: Identify branches for review
- **Cleanup**: Find branches ready for deletion

### Repository Analysis
- **Branch Patterns**: Analyze branch naming and structure
- **Author Activity**: Track branch creation by author
- **Branch Age**: Understand branch lifecycle
- **Merge Status**: Identify merged vs unmerged branches

## Error Handling

### Repository Validation
- **Git Directory Check**: Validates `.git` directory exists
- **Path Resolution**: Resolves relative paths to absolute paths
- **Permission Check**: Handles file system permission errors

### Branch Validation
- **Branch Existence**: Validates branch exists when specified
- **Remote Access**: Handles remote branch access issues
- **Reference Resolution**: Manages Git reference resolution

### Command Execution
- **Timeout Handling**: 30-second timeout for Git commands
- **Error Parsing**: Parses Git error messages for specific errors
- **Process Management**: Proper cleanup of child processes

## Performance Considerations

### Large Repositories
- **Remote Branches**: Include remote branches only when needed
- **Branch Filtering**: Use specific branch filters to reduce output
- **Merged Filtering**: Use merged filters to focus on relevant branches

### Best Practices
```json
// For basic branch overview
{
  "repository": ".",
  "includeRemote": false
}

// For comprehensive analysis
{
  "repository": ".",
  "includeRemote": true,
  "includeMerged": true
}

// For specific branch analysis
{
  "repository": ".",
  "branch": "main"
}
```

## Integration with Other Tools

### With Commit History
```javascript
// Get branch info first
const branchInfo = await handleGitTool('get_branch_info', {
  repository: '.',
  includeRemote: true
});

// Then get commit history for specific branch
const commits = await handleGitTool('get_commit_history', {
  repository: '.',
  branch: 'main',
  limit: 10
});
```

### With File Blame
```javascript
// Get branch info
const branchInfo = await handleGitTool('get_branch_info', {
  repository: '.'
});

// Get blame for file in current branch
const blame = await handleGitTool('get_file_blame', {
  filePath: 'src/utils.js',
  revision: branchInfo.data.currentBranch
});
```

## Branch Information Structure

### Local Branches
- **`name`**: Branch name (e.g., "main", "feature/user-auth")
- **`sha`**: Latest commit SHA
- **`author`**: Author of the latest commit
- **`email`**: Author email
- **`date`**: Date of the latest commit
- **`upstream`**: Upstream branch (e.g., "origin/main")
- **`tracking`**: Tracking status (e.g., "[ahead 2, behind 1]")
- **`isCurrent`**: Whether this is the current branch
- **`isRemote`**: Whether this is a remote branch (false for local)

### Remote Branches
- **`name`**: Branch name (e.g., "origin/main", "origin/feature/user-auth")
- **`sha`**: Latest commit SHA
- **`author`**: Author of the latest commit
- **`email`**: Author email
- **`date`**: Date of the latest commit
- **`upstream`**: Usually undefined for remote branches
- **`tracking`**: Usually undefined for remote branches
- **`isCurrent`**: Usually false for remote branches
- **`isRemote`**: Always true for remote branches

## Limitations

- **Git Repository Required**: All operations require a valid Git repository
- **Command Line Dependency**: Relies on Git command line tools being available
- **Performance**: Large repositories with many branches may have performance implications
- **Platform Support**: Git command availability varies by platform

## Future Enhancements

- **Branch Visualization**: Integration with visualization tools for branch relationships
- **Real-time Updates**: WebSocket support for real-time branch monitoring
- **Advanced Filtering**: More sophisticated filtering and search capabilities
- **Branch Analytics**: Detailed analytics and metrics for branch usage
- **Automation**: Support for automated branch management workflows
