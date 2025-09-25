# Framework Detection Tool

The `detect_test_framework` tool automatically detects the test framework used in a project by analyzing configuration files, dependencies, and scripts.

## Supported Frameworks

### Python Frameworks
- **Pytest**: Detects `pytest.ini`, `conftest.py`, and `pyproject.toml` with pytest configuration

### Node.js Frameworks  
- **Jest**: Detects `package.json` with `jest`, `@jest/core`, or `jest-cli` dependencies
- **Mocha**: Detects `package.json` with `mocha` dependency

## Detection Logic

### High Confidence Detection
- **Pytest**: `pytest.ini` or `conftest.py` files present
- **Jest**: Direct dependency in `package.json` (`jest`, `@jest/core`, `jest-cli`)
- **Mocha**: Direct dependency in `package.json` (`mocha`)

### Medium Confidence Detection
- **All Frameworks**: Found in npm scripts (`scripts.test`, `scripts.test:unit`, etc.)
- **Pytest**: Found in `pyproject.toml` with `[tool.pytest]` section

### Low Confidence Detection
- **All Frameworks**: Test directories found (`test`, `tests`, `__tests__`, `spec`, `specs`)
- **All Frameworks**: Test file patterns detected (`.test.js`, `.test.ts`, `.spec.js`, `.spec.ts`, `test_*.py`)

## Usage

### Basic Detection
```json
{
  "method": "tools/call",
  "params": {
    "name": "detect_test_framework",
    "arguments": {
      "directory": "."
    }
  }
}
```

### Specific Directory
```json
{
  "method": "tools/call", 
  "params": {
    "name": "detect_test_framework",
    "arguments": {
      "directory": "./src"
    }
  }
}
```

## Response Format

### Successful Detection
```json
{
  "success": true,
  "data": {
    "framework": "jest",
    "confidence": "high",
    "evidence": [
      "Found jest in package.json dependencies"
    ],
    "message": "Detected jest test framework with high confidence"
  }
}
```

### Unknown Framework
```json
{
  "success": false,
  "data": {
    "framework": "unknown",
    "confidence": "low", 
    "evidence": [
      "Found test directory: test",
      "Looking for test files with pattern: .test.js"
    ],
    "message": "No test framework detected"
  }
}
```

### Detection Error
```json
{
  "success": false,
  "error": "Detection error",
  "data": {
    "framework": "unknown",
    "confidence": "low",
    "evidence": [
      "Detection error: ENOENT: no such file or directory"
    ],
    "error": "Framework detection failed",
    "message": "ENOENT: no such file or directory"
  }
}
```

## Evidence Collection

The tool collects evidence during detection:

### Configuration Files
- `pytest.ini` - Pytest configuration file
- `conftest.py` - Pytest conftest file
- `pyproject.toml` - Python project configuration with pytest settings
- `package.json` - Node.js project configuration

### Dependencies
- `jest` - Jest testing framework
- `@jest/core` - Jest core package
- `jest-cli` - Jest command line interface
- `mocha` - Mocha testing framework

### Scripts
- `scripts.test` - Test script in package.json
- `scripts.test:unit` - Unit test script
- `scripts.test:integration` - Integration test script

### Test Directories
- `test/` - Common test directory
- `tests/` - Plural test directory
- `__tests__/` - Jest convention test directory
- `spec/` - Specification test directory
- `specs/` - Plural specification directory

### Test File Patterns
- `.test.js` - JavaScript test files
- `.test.ts` - TypeScript test files
- `.spec.js` - JavaScript spec files
- `.spec.ts` - TypeScript spec files
- `test_*.py` - Python test files

## Confidence Levels

### High Confidence
- Direct framework dependency found
- Framework configuration file present
- Strong evidence of framework usage

### Medium Confidence  
- Framework found in npm scripts
- Framework configuration in pyproject.toml
- Indirect evidence of framework usage

### Low Confidence
- Test directories found
- Test file patterns detected
- Weak evidence of testing setup

## Error Handling

### No Evidence Found
- Returns `framework: "unknown"`
- Returns `confidence: "low"`
- Provides evidence of what was checked

### File System Errors
- Handles missing directories gracefully
- Continues detection with available evidence
- Reports errors in evidence array

### JSON Parse Errors
- Ignores malformed package.json files
- Continues with other detection methods
- Reports parse errors in evidence

## Integration with run_tests

The `detect_test_framework` tool is used by `run_tests` when `framework: "auto"` is specified:

```json
{
  "name": "run_tests",
  "arguments": {
    "directory": ".",
    "framework": "auto"
  }
}
```

If no framework is detected, `run_tests` will return an error with the detection evidence.

## Examples

### Jest Project
```json
{
  "framework": "jest",
  "confidence": "high",
  "evidence": [
    "Found jest in package.json dependencies"
  ]
}
```

### Pytest Project
```json
{
  "framework": "pytest", 
  "confidence": "high",
  "evidence": [
    "Found pytest.ini"
  ]
}
```

### Mocha Project
```json
{
  "framework": "mocha",
  "confidence": "medium", 
  "evidence": [
    "Found mocha in script: test"
  ]
}
```

### Unknown Project
```json
{
  "framework": "unknown",
  "confidence": "low",
  "evidence": [
    "Found test directory: test",
    "Looking for test files with pattern: .test.js"
  ]
}
```
