# License Bypass for Testing

This document explains how to run the Enhanced MCP Server without license checks for testing purposes.

## Quick Start

### Option 1: Using npm script (Recommended)
```bash
npm run start:no-license
```

### Option 2: Using environment variable
```bash
# Windows PowerShell
$env:DISABLE_LICENSE="true"; npm run build && node dist/index.js

# Windows Command Prompt
set DISABLE_LICENSE=true && npm run build && node dist/index.js

# Linux/macOS
DISABLE_LICENSE=true npm run build && node dist/index.js
```

### Option 3: Using provided scripts
```bash
# Windows
run-no-license.bat

# Linux/macOS
./run-no-license.sh
```

## What This Does

When `DISABLE_LICENSE=true` is set, the server will:

1. **Bypass all license checks** - All Pro features become available
2. **Log bypass messages** - You'll see `[DISABLE_LICENSE]` messages in the console
3. **Allow all tools** - All 36 MCP tools will work without restrictions
4. **Maintain functionality** - All features work exactly as they would with a valid Pro license

## Available Tools (All Unlocked)

### File Operations (6 tools)
- `list_files` - List files and directories with enhanced filtering
- `read_file` - Read file contents with encoding detection
- `write_file` - Write content to files with atomic operations
- `search_files` - Search for files using advanced patterns
- `get_file_diff` - Compare two files and return unified diff
- `get_file_stats` - Get comprehensive file operation statistics

### Code Analysis & Navigation (6 tools)
- `search_symbols` - Search for code symbols with fuzzy matching
- `find_references` - Find all references to a specific symbol
- `index_directory` - Index directory for symbol search
- `get_index_stats` - Get statistics about the current code index
- `clear_index` - Clear the code index
- `get_symbol_info` - Get detailed information about a specific symbol

### Test Automation (5 tools)
- `run_tests` - Run tests using auto-detected frameworks
- `detect_test_framework` - Detect test framework used in project
- `get_test_status` - Get status of running tests
- `run_test_file` - Run tests in a specific test file
- `test_coverage_analysis` - Analyze test coverage and generate reports

### Git Integration (4 tools)
- `get_commit_history` - Get commit history for repository
- `get_file_blame` - Get blame information for specific file
- `get_branch_info` - Get information about branches
- `find_commits_touching_file` - Find commits that modified a file

### Security & Dependencies (5 tools)
- `security_audit` - Perform comprehensive security audit
- `analyze_dependencies` - Analyze project dependencies
- `check_vulnerabilities` - Check for security vulnerabilities
- `dependency_tree_analysis` - Analyze dependency tree structure
- `license_compliance_check` - Check license compliance

### Documentation (3 tools)
- `get_documentation` - Extract and analyze documentation
- `documentation_coverage` - Analyze documentation coverage
- `generate_docs` - Generate documentation from codebase

### Development & Quality (5 tools)
- `project_health_check` - Aggregate health report from multiple sources
- `code_quality_metrics` - Analyze code complexity and maintainability
- `refactoring_suggestions` - Provide automated refactor suggestions
- `project_trend_tracking` - Track and analyze project metrics trends
- `ide_feedback_stream` - Stream analysis results as IDE-friendly issues

### Server Management (2 tools)
- `get_server_config` - Get current server configuration
- `update_config` - Update server configuration

## Technical Details

The license bypass works by:

1. **Environment Variable Check**: The server checks for `DISABLE_LICENSE=true`
2. **License Manager Bypass**: In `src/licensing/license-manager.ts`, the `checkFeatureAccess()` method returns `{ allowed: true }` when the environment variable is set
3. **No Code Changes Required**: The existing codebase already has this functionality built-in
4. **Centralized Control**: All license checks go through the license manager, so bypassing it disables all restrictions

## Re-enabling License Checks

To re-enable license checks, simply:

1. **Remove the environment variable**:
   ```bash
   # Don't set DISABLE_LICENSE, or set it to false
   npm run start
   ```

2. **Or use the regular start command**:
   ```bash
   npm run start
   ```

## Important Notes

- ⚠️ **This is for testing purposes only**
- 🔒 **Do not use in production** without proper licensing
- 📝 **All Pro features are unlocked** when license checks are disabled
- 🚀 **Performance is not affected** by the bypass
- 🔄 **Easy to toggle** on/off as needed

## Troubleshooting

If you encounter issues:

1. **Build first**: Always run `npm run build` before starting
2. **Check environment**: Ensure `DISABLE_LICENSE=true` is set
3. **Check logs**: Look for `[DISABLE_LICENSE]` messages in console output
4. **Verify tools**: All 36 tools should be available without license errors

## Support

For issues with the license bypass or testing, check the console output for `[DISABLE_LICENSE]` messages that confirm the bypass is active.
