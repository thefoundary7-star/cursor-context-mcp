# Test Coverage Analysis Tool

The `test_coverage_analysis` tool collects and analyzes test coverage data across multiple test frameworks, providing normalized coverage metrics and detailed file-level statistics.

## Features

- **Multi-framework Support**: Jest, Pytest, and Mocha coverage collection
- **Auto-detection**: Automatically detect test framework
- **Normalized Output**: Consistent coverage metrics across frameworks
- **File-level Details**: Individual file coverage statistics
- **Summary Statistics**: Overall coverage metrics and file counts
- **Error Handling**: Graceful handling of parsing errors and timeouts

## Usage

### Basic Coverage Analysis
```json
{
  "method": "tools/call",
  "params": {
    "name": "test_coverage_analysis",
    "arguments": {
      "directory": ".",
      "framework": "auto"
    }
  }
}
```

### Explicit Framework
```json
{
  "method": "tools/call",
  "params": {
    "name": "test_coverage_analysis",
    "arguments": {
      "directory": "./src",
      "framework": "jest",
      "timeout": 60000
    }
  }
}
```

## Parameters

### Required Parameters
None - all parameters are optional

### Optional Parameters
- **`directory`** (string): Directory to analyze coverage for (default: ".")
- **`framework`** (string): Test framework to use - "jest", "pytest", "mocha", or "auto" (default: "auto")
- **`timeout`** (number): Test execution timeout in milliseconds (default: 60000, max: 300000)

## Supported Frameworks

### Jest (JavaScript/TypeScript)
- **Command**: `npx jest --coverage --coverageReporters=json --coverageDirectory=coverage`
- **Output**: JSON coverage data to stdout
- **Configuration**: Uses Jest's built-in coverage collection

### Pytest (Python)
- **Command**: `python -m pytest --cov=. --cov-report=json --cov-report-file=coverage.json`
- **Output**: JSON coverage data to file
- **Dependencies**: Requires `pytest-cov` package

### Mocha (JavaScript)
- **Command**: `npx nyc --reporter=json mocha`
- **Output**: JSON coverage data to stdout
- **Dependencies**: Requires `nyc` package

## Response Format

### Successful Analysis
```json
{
  "success": true,
  "data": {
    "framework": "jest",
    "coverage": 85.5,
    "files": [
      {
        "file": "src/utils.js",
        "covered": 17,
        "uncovered": 3,
        "coverage": 85.0
      },
      {
        "file": "src/helpers.js",
        "covered": 12,
        "uncovered": 0,
        "coverage": 100.0
      }
    ],
    "totalLines": 32,
    "coveredLines": 29,
    "uncoveredLines": 3,
    "message": "Coverage analysis completed: 85.50% overall coverage",
    "summary": {
      "overallCoverage": 85.5,
      "totalFiles": 2,
      "filesWithFullCoverage": 1,
      "filesWithNoCoverage": 0
    }
  }
}
```

### No Framework Detected
```json
{
  "success": false,
  "error": "No test framework found",
  "data": {
    "error": "No test framework detected",
    "message": "Could not detect test framework. Please specify framework manually.",
    "evidence": ["No package.json found", "No pytest.ini found"],
    "directory": "."
  }
}
```

### Unsupported Framework
```json
{
  "success": false,
  "error": "Unsupported framework",
  "data": {
    "error": "Unsupported framework",
    "message": "Framework vitest is not supported for coverage analysis",
    "directory": ".",
    "framework": "vitest"
  }
}
```

### Coverage Parsing Failed
```json
{
  "success": false,
  "error": "Coverage parsing error",
  "data": {
    "error": "Coverage parsing failed",
    "message": "Failed to parse coverage results: Invalid JSON format",
    "directory": ".",
    "framework": "jest",
    "warning": "Partial results may be available"
  }
}
```

### Analysis Timeout
```json
{
  "success": false,
  "error": "Coverage analysis timeout",
  "data": {
    "error": "Coverage analysis timed out",
    "message": "Coverage analysis exceeded timeout of 60000ms",
    "directory": ".",
    "framework": "jest"
  }
}
```

## Coverage Data Structure

### Overall Metrics
- **`coverage`**: Overall coverage percentage (0-100)
- **`totalLines`**: Total number of executable lines
- **`coveredLines`**: Number of covered lines
- **`uncoveredLines`**: Number of uncovered lines

### File-level Metrics
Each file in the `files` array contains:
- **`file`**: File path relative to project root
- **`covered`**: Number of covered lines in this file
- **`uncovered`**: Number of uncovered lines in this file
- **`coverage`**: Coverage percentage for this file (0-100)

### Summary Statistics
- **`overallCoverage`**: Overall coverage percentage
- **`totalFiles`**: Total number of files analyzed
- **`filesWithFullCoverage`**: Number of files with 100% coverage
- **`filesWithNoCoverage`**: Number of files with 0% coverage

## Framework-specific Commands

### Jest Coverage
```bash
# Basic coverage collection
npx jest --coverage --coverageReporters=json --coverageDirectory=coverage

# With custom configuration
npx jest --coverage --coverageReporters=json --coverageDirectory=coverage --collectCoverageFrom="src/**/*.js"
```

### Pytest Coverage
```bash
# Basic coverage collection
python -m pytest --cov=. --cov-report=json --cov-report-file=coverage.json

# With specific source directory
python -m pytest --cov=src --cov-report=json --cov-report-file=coverage.json
```

### Mocha Coverage
```bash
# Basic coverage collection
npx nyc --reporter=json mocha

# With specific source files
npx nyc --reporter=json --include="src/**/*.js" mocha
```

## Examples

### Jest Project
```javascript
// package.json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/**/*.test.js"
    ]
  }
}
```

**Analysis:**
```json
{
  "name": "test_coverage_analysis",
  "arguments": {
    "directory": ".",
    "framework": "jest"
  }
}
```

### Pytest Project
```python
# pytest.ini
[tool:pytest]
testpaths = tests
addopts = --cov=src --cov-report=json
```

**Analysis:**
```json
{
  "name": "test_coverage_analysis",
  "arguments": {
    "directory": ".",
    "framework": "pytest"
  }
}
```

### Mocha Project
```json
// package.json
{
  "scripts": {
    "test": "mocha",
    "test:coverage": "nyc mocha"
  },
  "devDependencies": {
    "mocha": "^10.0.0",
    "nyc": "^15.0.0"
  }
}
```

**Analysis:**
```json
{
  "name": "test_coverage_analysis",
  "arguments": {
    "directory": ".",
    "framework": "mocha"
  }
}
```

## Error Handling

### Framework Detection Errors
- **No Framework Found**: Returns error with evidence of what was checked
- **Unsupported Framework**: Returns error for frameworks not supported
- **Auto-detection Failure**: Falls back to explicit framework specification

### Execution Errors
- **Timeout**: Kills process and returns timeout error
- **Command Failure**: Captures and returns command execution errors
- **Missing Dependencies**: Returns error for missing coverage tools

### Parsing Errors
- **Invalid JSON**: Returns error with parsing details
- **Missing Coverage Data**: Returns partial results with warning
- **Framework Mismatch**: Handles unexpected output formats

## Best Practices

### 1. Framework Configuration
```javascript
// Jest - Configure coverage collection
{
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{js,ts}",
      "!src/**/*.test.{js,ts}",
      "!src/**/*.spec.{js,ts}"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### 2. Pytest Configuration
```ini
# pytest.ini
[tool:pytest]
testpaths = tests
addopts = --cov=src --cov-report=json --cov-report=html
```

### 3. Mocha Configuration
```json
// package.json
{
  "nyc": {
    "include": ["src/**/*.js"],
    "exclude": ["src/**/*.test.js"],
    "reporter": ["json", "html"]
  }
}
```

### 4. Coverage Thresholds
```javascript
// Check coverage against thresholds
const result = await handleTestTool('test_coverage_analysis', {
  directory: '.',
  framework: 'jest'
});

if (result.data.coverage < 80) {
  console.warn(`Coverage ${result.data.coverage}% is below 80% threshold`);
}
```

## Integration with Other Tools

### With run_tests
```javascript
// Run tests first
const testResult = await handleTestTool('run_tests', {
  directory: '.',
  framework: 'jest'
});

// Then analyze coverage
const coverageResult = await handleTestTool('test_coverage_analysis', {
  directory: '.',
  framework: 'jest'
});
```

### With run_test_file
```javascript
// Run specific test file
const fileResult = await handleTestTool('run_test_file', {
  filePath: 'src/utils.test.js',
  framework: 'jest'
});

// Analyze coverage for the same file
const coverageResult = await handleTestTool('test_coverage_analysis', {
  directory: '.',
  framework: 'jest'
});
```

## Limitations

- **Framework Dependencies**: Requires framework-specific coverage tools
- **Single Framework**: Only analyzes one framework at a time
- **File-based Output**: Pytest requires file-based coverage output
- **Timeout Handling**: Long-running tests may timeout

## Future Enhancements

- **Multi-framework Analysis**: Analyze coverage across multiple frameworks
- **Coverage Comparison**: Compare coverage between different runs
- **Coverage Trends**: Track coverage changes over time
- **Coverage Visualization**: Generate coverage reports and charts
- **Coverage Thresholds**: Enforce coverage thresholds and alerts
