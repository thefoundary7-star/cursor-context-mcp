# MCP Server Platform Testing Guide

This document provides comprehensive information about the testing system for the MCP Server Platform, including unit tests, integration tests, security audits, and code quality checks.

## Overview

The MCP Server Platform includes a comprehensive testing suite designed to ensure reliability, security, and maintainability. The testing system consists of:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test component interactions and workflows
- **Security Tests**: Audit security features and vulnerability protection
- **Code Quality Checks**: Ensure code standards and best practices

## Test Structure

```
tests/
├── __init__.py                 # Test package initialization
├── conftest.py                 # Pytest configuration and fixtures
├── test_mcp_server.py          # Unit tests for MCP server
└── test_config_integration.py  # Integration tests

test_directory_access.py        # Security audit script
run_tests.py                    # Test runner script
pytest.ini                      # Pytest configuration
requirements-test.txt           # Testing dependencies
```

## Quick Start

### 1. Install Testing Dependencies

```bash
pip install -r requirements-test.txt
```

### 2. Run All Tests

```bash
python run_tests.py --full
```

### 3. Run Specific Test Types

```bash
# Unit tests only
python run_tests.py --unit

# Integration tests only
python run_tests.py --integration

# Security tests only
python run_tests.py --security

# Code quality checks
python run_tests.py --quality
```

## Test Types

### Unit Tests (`tests/test_mcp_server.py`)

Unit tests focus on testing individual functions and components in isolation.

**Coverage:**
- `_list_files_sync()` function
- `_read_file_sync()` function
- `_get_git_status_sync()` function
- `register_tools()` function
- Error handling and edge cases
- Security features
- Configuration integration

**Key Test Classes:**
- `TestListFilesSync`: File listing functionality
- `TestReadFileSync`: File reading functionality
- `TestGetGitStatusSync`: Git status functionality
- `TestRegisterTools`: Tool registration
- `TestErrorHandling`: Error handling
- `TestSecurityFeatures`: Security features
- `TestConfigurationIntegration`: Config integration

**Example:**
```python
def test_list_files_success(self, test_project_dir, config_manager):
    """Test successful file listing."""
    config_manager.add_directory(test_project_dir)
    
    with patch('official_mcp_server.config_manager', config_manager):
        result = _list_files_sync(test_project_dir)
    
    assert result["success"] is True
    assert "files" in result
    assert "directories" in result
```

### Integration Tests (`tests/test_config_integration.py`)

Integration tests verify that different components work together correctly.

**Coverage:**
- Configuration file management
- CLI command integration
- Server-configuration integration
- End-to-end workflows
- Performance testing
- Error recovery

**Key Test Classes:**
- `TestConfigIntegration`: Configuration management
- `TestCLIIntegration`: CLI command testing
- `TestServerIntegration`: Server functionality
- `TestEndToEndIntegration`: Complete workflows
- `TestPerformanceIntegration`: Performance testing

**Example:**
```python
def test_complete_workflow(self, test_project_dir, test_docs_dir, temp_dir):
    """Test complete workflow from setup to file access."""
    config_path = os.path.join(temp_dir, "e2e_config.json")
    config_manager = MCPConfigManager(config_path)
    
    # Add directories and test operations
    config_manager.add_directory(test_project_dir)
    
    with patch('official_mcp_server.config_manager', config_manager):
        result = _list_files_sync(test_project_dir)
        assert result["success"] is True
```

### Security Tests (`test_directory_access.py`)

Security tests audit the system for vulnerabilities and ensure security features work correctly.

**Coverage:**
- Path traversal protection
- System directory protection
- File size limits
- Exclusion patterns
- Configuration security
- Audit logging
- Permission handling
- Concurrent access

**Key Test Methods:**
- `test_path_traversal_protection()`: Test against directory traversal attacks
- `test_system_directory_protection()`: Test system directory access blocking
- `test_file_size_limits()`: Test file size enforcement
- `test_exclusion_patterns()`: Test file exclusion functionality
- `test_configuration_security()`: Test config validation
- `test_audit_logging()`: Test audit trail functionality

**Example:**
```python
def test_path_traversal_protection(self, config_manager):
    """Test protection against path traversal attacks."""
    traversal_attempts = [
        "../sensitive_dir/secrets.txt",
        "../../sensitive_dir/secrets.txt",
        "%2e%2e%2fsensitive_dir%2fsecrets.txt",
    ]
    
    for attempt in traversal_attempts:
        result = _read_file_sync(test_path)
        assert result["success"] is False
```

## Test Fixtures

The testing system includes comprehensive fixtures in `conftest.py`:

### Directory Fixtures
- `temp_dir`: Temporary directory for testing
- `test_project_dir`: Project directory with sample files
- `test_docs_dir`: Documents directory
- `git_repo`: Git repository for testing

### Configuration Fixtures
- `config_manager`: MCP configuration manager
- `test_config_path`: Test configuration file path
- `sample_config`: Sample configuration data

### Mock Fixtures
- `mock_mcp_server`: Mock MCP server
- `mock_config_manager`: Mock configuration manager

## Running Tests

### Using the Test Runner

The `run_tests.py` script provides a comprehensive test runner:

```bash
# Run all tests with verbose output
python run_tests.py --full --verbose

# Run specific test types
python run_tests.py --unit --integration

# Generate detailed report
python run_tests.py --full --report test_report.txt
```

### Using Pytest Directly

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_mcp_server.py

# Run with coverage
pytest --cov=official_mcp_server --cov=mcp_config_manager

# Run specific test class
pytest tests/test_mcp_server.py::TestListFilesSync

# Run specific test method
pytest tests/test_mcp_server.py::TestListFilesSync::test_list_files_success
```

### Using Security Audit Script

```bash
# Run security audit
python test_directory_access.py

# Run with custom config
python test_directory_access.py --config /path/to/config.json

# Save results to file
python test_directory_access.py --output security_report.json

# Verbose output
python test_directory_access.py --verbose
```

## Test Configuration

### Pytest Configuration (`pytest.ini`)

```ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    --cov=.
    --cov-report=html:htmlcov
    --cov-report=term-missing
    --cov-report=xml
    --cov-fail-under=80
markers =
    unit: Unit tests
    integration: Integration tests
    security: Security tests
    slow: Slow running tests
    mcp_server: MCP server specific tests
    config: Configuration tests
    cli: CLI command tests
```

### Test Markers

Tests are automatically marked based on their location and name:

- `@pytest.mark.unit`: Unit tests
- `@pytest.mark.integration`: Integration tests
- `@pytest.mark.security`: Security tests
- `@pytest.mark.slow`: Slow running tests
- `@pytest.mark.mcp_server`: MCP server specific tests
- `@pytest.mark.config`: Configuration tests

## Coverage Reporting

The testing system generates comprehensive coverage reports:

### HTML Reports
- `htmlcov/unit/`: Unit test coverage
- `htmlcov/integration/`: Integration test coverage
- `htmlcov/all/`: Combined coverage

### XML Reports
- `coverage_unit.xml`: Unit test coverage data
- `coverage_integration.xml`: Integration test coverage data
- `coverage_all.xml`: Combined coverage data

### Terminal Reports
Coverage information is displayed in the terminal with missing lines highlighted.

## Code Quality Checks

The testing system includes comprehensive code quality checks:

### Linting (Flake8)
```bash
flake8 official_mcp_server.py mcp_config_manager.py tests/
```

### Formatting (Black)
```bash
black --check official_mcp_server.py mcp_config_manager.py tests/
```

### Import Sorting (isort)
```bash
isort --check-only official_mcp_server.py mcp_config_manager.py tests/
```

### Type Checking (MyPy)
```bash
mypy official_mcp_server.py mcp_config_manager.py
```

### Security Linting (Bandit)
```bash
bandit -r official_mcp_server.py mcp_config_manager.py
```

### Dependency Security (Safety)
```bash
safety check
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, 3.10, 3.11, 3.12]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-test.txt
    
    - name: Run tests
      run: python run_tests.py --full
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

1. **Import Errors**
   ```
   Error importing MCPConfigManager: No module named 'mcp_config_manager'
   ```
   **Solution**: Ensure you're running tests from the project root directory.

2. **Permission Errors**
   ```
   PermissionError: [Errno 13] Permission denied
   ```
   **Solution**: Check file permissions and ensure the test user has appropriate access.

3. **Timeout Errors**
   ```
   subprocess.TimeoutExpired: Command timed out
   ```
   **Solution**: Increase timeout values or optimize slow tests.

4. **Coverage Issues**
   ```
   Coverage too low: 75% < 80%
   ```
   **Solution**: Add more tests or adjust coverage thresholds.

### Debug Mode

Run tests with debug information:

```bash
pytest --verbose --tb=long --capture=no
```

### Test Isolation

Ensure tests don't interfere with each other:

```bash
pytest --forked  # Run each test in a separate process
```

## Best Practices

### Writing Tests

1. **Use Descriptive Names**: Test names should clearly describe what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Test Edge Cases**: Include tests for error conditions and boundary values
4. **Mock External Dependencies**: Use mocks for file system, network, and other external dependencies
5. **Keep Tests Independent**: Tests should not depend on each other

### Test Organization

1. **Group Related Tests**: Use test classes to group related functionality
2. **Use Fixtures**: Leverage pytest fixtures for common setup
3. **Mark Tests Appropriately**: Use markers to categorize tests
4. **Document Test Purpose**: Include docstrings explaining test objectives

### Performance

1. **Use Appropriate Timeouts**: Set reasonable timeouts for long-running tests
2. **Clean Up Resources**: Ensure proper cleanup in teardown methods
3. **Parallel Execution**: Use pytest-xdist for parallel test execution
4. **Skip Slow Tests**: Mark slow tests appropriately

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Add appropriate test markers
3. Include comprehensive docstrings
4. Ensure tests are isolated and repeatable
5. Update this documentation if adding new test types

## Support

For issues with the testing system:

1. Check the troubleshooting section above
2. Review test logs and error messages
3. Ensure all dependencies are installed
4. Verify test environment setup
5. Check file permissions and paths

The testing system is designed to be comprehensive, reliable, and easy to use. Regular testing ensures the MCP Server Platform maintains high quality and security standards.