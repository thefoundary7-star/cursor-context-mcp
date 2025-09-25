# Test File Execution Tool

The `run_test_file` tool executes tests for a specific test file using the detected or specified test framework.

## Features

- **File-specific Execution**: Run tests for a single test file
- **Framework Detection**: Auto-detect framework or specify explicitly
- **Multiple Frameworks**: Support for Jest, Pytest, and Mocha
- **Coverage Support**: Optional test coverage collection
- **Timeout Handling**: Configurable execution timeout
- **Error Handling**: Comprehensive error handling for various scenarios

## Usage

### Basic File Execution
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_test_file",
    "arguments": {
      "filePath": "src/test/user.test.js",
      "framework": "jest"
    }
  }
}
```

### Auto-detect Framework
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_test_file",
    "arguments": {
      "directory": "./tests",
      "filePath": "auth.test.js",
      "framework": "auto"
    }
  }
}
```

### With Coverage
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_test_file",
    "arguments": {
      "filePath": "components/Button.test.tsx",
      "framework": "jest",
      "coverage": true,
      "timeout": 30000
    }
  }
}
```

## Parameters

### Required Parameters
- **`filePath`** (string): Path to the test file to run

### Optional Parameters
- **`directory`** (string): Directory to run tests in (default: ".")
- **`framework`** (string): Test framework to use - "jest", "pytest", "mocha", or "auto" (default: "auto")
- **`timeout`** (number): Test execution timeout in milliseconds (default: 30000, max: 300000)
- **`coverage`** (boolean): Whether to collect test coverage (default: false)

## Supported Frameworks

### Jest (JavaScript/TypeScript)
- **Command**: `npx jest <filePath> --json`
- **Coverage**: `npx jest <filePath> --json --coverage --coverageReporters json`
- **File Patterns**: `.test.js`, `.test.ts`, `.spec.js`, `.spec.ts`

### Pytest (Python)
- **Command**: `python -m pytest <filePath> -q --tb=short`
- **Coverage**: `python -m pytest <filePath> -q --tb=short --cov --cov-report=json`
- **File Patterns**: `test_*.py`, `*_test.py`

### Mocha (JavaScript)
- **Command**: `npx mocha <filePath> --reporter json`
- **File Patterns**: `.test.js`, `.spec.js`

## Response Format

### Successful Execution
```json
{
  "success": true,
  "data": {
    "framework": "jest",
    "filePath": "src/test/user.test.js",
    "passed": 5,
    "failed": 2,
    "errors": [
      "Test failed: Expected 5 to equal 3",
      "Test failed: Cannot read property 'name' of undefined"
    ],
    "duration": 1250,
    "success": false,
    "message": "Test file src/test/user.test.js completed: 5 passed, 2 failed"
  }
}
```

### File Not Found
```json
{
  "success": false,
  "error": "File not found",
  "data": {
    "error": "File not found",
    "message": "Test file not found: non-existent.test.js",
    "filePath": "non-existent.test.js",
    "directory": "."
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
    "filePath": "test.js",
    "directory": "."
  }
}
```

### Execution Timeout
```json
{
  "success": false,
  "error": "Test file execution timeout",
  "data": {
    "error": "Test file execution timed out",
    "message": "Test file test.js exceeded timeout of 30000ms",
    "filePath": "test.js",
    "framework": "jest"
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
    "message": "Framework vitest is not supported for file execution",
    "filePath": "test.js",
    "framework": "vitest"
  }
}
```

## Framework-specific Commands

### Jest Commands
```bash
# Basic execution
npx jest src/test/user.test.js --json

# With coverage
npx jest src/test/user.test.js --json --coverage --coverageReporters json
```

### Pytest Commands
```bash
# Basic execution
python -m pytest tests/test_user.py -q --tb=short

# With coverage
python -m pytest tests/test_user.py -q --tb=short --cov --cov-report=json
```

### Mocha Commands
```bash
# Basic execution
npx mocha src/test/user.test.js --reporter json
```

## Error Handling

### File Validation
- **File Exists**: Validates that the test file exists before execution
- **Path Resolution**: Resolves file path relative to the specified directory
- **Error Response**: Returns structured error if file not found

### Framework Detection
- **Auto-detection**: Uses existing framework detection logic
- **Fallback**: Returns error if no framework detected and auto is specified
- **Explicit Framework**: Uses specified framework if provided

### Execution Errors
- **Timeout Handling**: Kills process and returns timeout error
- **Command Errors**: Captures and returns command execution errors
- **Parse Errors**: Handles JSON parsing errors gracefully

## Examples

### Jest Test File
```javascript
// user.test.js
describe('User Service', () => {
  test('should create user', () => {
    expect(createUser({ name: 'John' })).toBeDefined();
  });
  
  test('should validate email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });
});
```

**Execution:**
```json
{
  "name": "run_test_file",
  "arguments": {
    "filePath": "user.test.js",
    "framework": "jest",
    "coverage": true
  }
}
```

### Pytest Test File
```python
# test_user.py
def test_create_user():
    user = create_user(name="John")
    assert user is not None

def test_validate_email():
    assert validate_email("test@example.com") == True
```

**Execution:**
```json
{
  "name": "run_test_file",
  "arguments": {
    "filePath": "test_user.py",
    "framework": "pytest",
    "coverage": false
  }
}
```

### Mocha Test File
```javascript
// user.test.js
describe('User Service', function() {
  it('should create user', function() {
    assert(createUser({ name: 'John' }));
  });
  
  it('should validate email', function() {
    assert(validateEmail('test@example.com'));
  });
});
```

**Execution:**
```json
{
  "name": "run_test_file",
  "arguments": {
    "filePath": "user.test.js",
    "framework": "mocha"
  }
}
```

## Best Practices

### 1. File Path Resolution
```javascript
// Use relative paths from the project root
{
  "filePath": "src/components/Button.test.tsx",
  "directory": "."
}

// Or specify the test directory
{
  "filePath": "Button.test.tsx",
  "directory": "src/components"
}
```

### 2. Framework Selection
```javascript
// Use auto-detection when possible
{
  "filePath": "test.js",
  "framework": "auto"
}

// Specify framework for mixed projects
{
  "filePath": "test.py",
  "framework": "pytest"
}
```

### 3. Timeout Configuration
```javascript
// Short timeout for quick tests
{
  "filePath": "unit.test.js",
  "timeout": 5000
}

// Longer timeout for integration tests
{
  "filePath": "integration.test.js",
  "timeout": 60000
}
```

### 4. Coverage Collection
```javascript
// Enable coverage for important test files
{
  "filePath": "critical.test.js",
  "framework": "jest",
  "coverage": true
}
```

## Integration with Other Tools

### With run_tests
```javascript
// Run specific file first
const fileResult = await handleTestTool('run_test_file', {
  filePath: 'failing.test.js',
  framework: 'jest'
});

// Then run all tests
const allResult = await handleTestTool('run_tests', {
  directory: '.',
  framework: 'jest'
});
```

### With get_test_status
```javascript
// Start test run
const runResult = await handleTestTool('run_tests', {
  directory: '.',
  framework: 'jest'
});

// Run specific file
const fileResult = await handleTestTool('run_test_file', {
  filePath: 'specific.test.js',
  framework: 'jest'
});

// Check status of both
const status = await handleTestTool('get_test_status', {
  runId: runResult.data.runId
});
```

## Limitations

- **Single File**: Only executes one test file at a time
- **Framework Support**: Limited to Jest, Pytest, and Mocha
- **Coverage Parsing**: Coverage data collection but not parsing (TODO)
- **File Dependencies**: Does not handle test file dependencies

## Future Enhancements

- **Multiple Files**: Support for running multiple test files
- **Test Filtering**: Filter specific tests within a file
- **Dependency Resolution**: Handle test file dependencies
- **Coverage Parsing**: Parse and return coverage data
- **Test Discovery**: Auto-discover test files in directory
