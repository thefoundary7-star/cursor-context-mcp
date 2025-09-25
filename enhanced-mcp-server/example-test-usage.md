# Test Tools Usage Examples

This document demonstrates how to use the implemented `run_tests` tool.

## Framework Detection

The tool automatically detects test frameworks by checking for:

### Jest Detection
- `package.json` with `jest` dependency
- `package.json` with `@jest/core` or `jest-cli` dependency
- Scripts containing `jest` command

### Pytest Detection
- `pytest.ini` file
- `conftest.py` file
- `pyproject.toml` with `[tool.pytest]` section

### Mocha Detection
- `package.json` with `mocha` dependency
- Scripts containing `mocha` command

## Usage Examples

### 1. Auto-detect and run tests
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_tests",
    "arguments": {
      "directory": ".",
      "framework": "auto",
      "coverage": false,
      "timeout": 60000
    }
  }
}
```

### 2. Run Jest tests with pattern
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_tests",
    "arguments": {
      "directory": "./src",
      "framework": "jest",
      "testPattern": "user",
      "coverage": true,
      "timeout": 30000
    }
  }
}
```

### 3. Run pytest tests
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_tests",
    "arguments": {
      "directory": ".",
      "framework": "pytest",
      "testPattern": "test_auth",
      "coverage": false,
      "timeout": 60000
    }
  }
}
```

### 4. Run Mocha tests
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_tests",
    "arguments": {
      "directory": ".",
      "framework": "mocha",
      "testPattern": "integration",
      "coverage": false,
      "timeout": 60000
    }
  }
}
```

## Response Format

The tool returns a normalized result object:

```json
{
  "success": true,
  "data": {
    "framework": "jest",
    "passed": 15,
    "failed": 2,
    "errors": [
      "Test failed: Expected 5 to equal 3",
      "Test failed: Cannot read property 'name' of undefined"
    ],
    "duration": 1250,
    "success": false,
    "message": "Tests completed: 15 passed, 2 failed"
  }
}
```

## Error Handling

### Framework Not Detected
```json
{
  "success": false,
  "error": "No test framework found",
  "data": {
    "error": "No test framework detected",
    "message": "Could not detect test framework. Please specify framework manually or ensure project has test configuration.",
    "evidence": ["No package.json found", "No pytest.ini found"]
  }
}
```

### Test Execution Timeout
```json
{
  "success": false,
  "error": "Test execution timeout",
  "data": {
    "error": "Test execution timed out",
    "message": "Tests exceeded timeout of 60000ms",
    "framework": "jest"
  }
}
```

### Command Execution Failed
```json
{
  "success": false,
  "error": "Test execution failed",
  "data": {
    "error": "Test execution failed",
    "message": "Command failed: npm test",
    "framework": "jest"
  }
}
```

## Supported Frameworks

- **Jest**: JavaScript/TypeScript testing framework
- **Pytest**: Python testing framework  
- **Mocha**: JavaScript testing framework

## Features

- ✅ Automatic framework detection
- ✅ Subprocess execution with timeout
- ✅ JSON result parsing
- ✅ Error handling and reporting
- ✅ Test pattern filtering
- ✅ Coverage collection support (TODO: parsing)
- ✅ Normalized output format
- ✅ Safe sandboxing

## TODO: Future Enhancements

- Coverage report parsing and analysis
- Test result caching
- Parallel test execution
- Custom test reporters
- Test result history tracking
