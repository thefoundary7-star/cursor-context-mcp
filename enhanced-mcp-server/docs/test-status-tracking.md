# Test Status Tracking

The `get_test_status` tool provides real-time monitoring of test execution progress and results.

## Features

- **Real-time Progress**: Track test execution progress (0-100%)
- **Status Monitoring**: Monitor test run status (running, completed, failed, timeout)
- **Result Access**: Access test results when available
- **Error Tracking**: View errors and failure details
- **Concurrent Support**: Track multiple test runs simultaneously
- **Auto-cleanup**: Automatic cleanup of old test runs (1 hour TTL)

## Usage

### Check Test Status
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_test_status",
    "arguments": {
      "runId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Start Test Run (returns runId)
```json
{
  "method": "tools/call",
  "params": {
    "name": "run_tests",
    "arguments": {
      "directory": ".",
      "framework": "jest",
      "testPattern": "user",
      "coverage": false,
      "timeout": 60000
    }
  }
}
```

## Response Format

### Running Test
```json
{
  "success": true,
  "data": {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "framework": "jest",
    "status": "running",
    "progress": 45,
    "startTime": 1703123456789,
    "duration": 2500,
    "message": "Test run running - 45% complete"
  }
}
```

### Completed Test
```json
{
  "success": true,
  "data": {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "framework": "jest",
    "status": "completed",
    "progress": 100,
    "results": {
      "framework": "jest",
      "passed": 15,
      "failed": 2,
      "errors": [
        "Test failed: Expected 5 to equal 3",
        "Test failed: Cannot read property 'name' of undefined"
      ],
      "duration": 1250,
      "output": "...",
      "stderr": "..."
    },
    "startTime": 1703123456789,
    "duration": 1250,
    "message": "Test run completed - 100% complete"
  }
}
```

### Failed Test
```json
{
  "success": true,
  "data": {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "framework": "jest",
    "status": "failed",
    "progress": 100,
    "errors": [
      "Test execution failed: Command not found: jest"
    ],
    "startTime": 1703123456789,
    "duration": 500,
    "message": "Test run failed - 100% complete"
  }
}
```

### Timed Out Test
```json
{
  "success": true,
  "data": {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "framework": "jest",
    "status": "timeout",
    "progress": 100,
    "errors": [
      "Test execution timed out"
    ],
    "startTime": 1703123456789,
    "duration": 60000,
    "message": "Test run timeout - 100% complete"
  }
}
```

## Error Handling

### Unknown runId
```json
{
  "success": false,
  "error": "Unknown runId",
  "data": {
    "error": "Unknown runId",
    "message": "No test run found with runId: invalid-run-id",
    "runId": "invalid-run-id"
  }
}
```

### Missing runId
```json
{
  "success": false,
  "error": "Missing runId parameter",
  "data": {
    "error": "runId is required",
    "message": "Please provide a runId to check test status"
  }
}
```

## Status Values

### Test Run Status
- **`running`**: Test execution is in progress
- **`completed`**: Test execution finished successfully
- **`failed`**: Test execution failed with errors
- **`timeout`**: Test execution exceeded timeout limit

### Progress Values
- **`0-100`**: Progress percentage (0 = started, 100 = finished)
- **Real-time updates**: Progress updates as subprocess streams output
- **Simplified tracking**: Based on elapsed time vs timeout

## Integration with run_tests

When `run_tests` is called, it automatically:

1. **Creates Test Run**: Generates unique `runId` (UUID)
2. **Tracks Progress**: Updates progress as subprocess runs
3. **Monitors Status**: Updates status based on execution result
4. **Stores Results**: Saves results when execution completes
5. **Handles Errors**: Records errors for failed executions

### Example Workflow

```javascript
// 1. Start test run
const runResult = await handleTestTool('run_tests', {
  directory: '.',
  framework: 'jest'
});

const runId = runResult.data.runId;

// 2. Check status periodically
const status = await handleTestTool('get_test_status', {
  runId: runId
});

// 3. Monitor until completion
while (status.data.status === 'running') {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const status = await handleTestTool('get_test_status', {
    runId: runId
  });
}

// 4. Access results
if (status.data.status === 'completed') {
  console.log('Tests passed:', status.data.results.passed);
  console.log('Tests failed:', status.data.results.failed);
}
```

## Concurrent Test Runs

The system supports multiple concurrent test runs:

```javascript
// Start multiple test runs
const run1 = await handleTestTool('run_tests', {
  directory: './frontend',
  framework: 'jest'
});

const run2 = await handleTestTool('run_tests', {
  directory: './backend', 
  framework: 'pytest'
});

// Check status of both runs
const status1 = await handleTestTool('get_test_status', {
  runId: run1.data.runId
});

const status2 = await handleTestTool('get_test_status', {
  runId: run2.data.runId
});
```

## Memory Management

### Automatic Cleanup
- **TTL**: Test runs are automatically cleaned up after 1 hour
- **Memory Efficient**: Only active test runs are kept in memory
- **Cleanup Trigger**: Cleanup runs on every status check

### Manual Cleanup
```javascript
// Cleanup is automatic, but you can trigger it manually
cleanupOldTestRuns();
```

## Best Practices

### 1. Monitor Progress
```javascript
// Check status every 1-2 seconds for long-running tests
const checkStatus = async (runId) => {
  const status = await handleTestTool('get_test_status', { runId });
  
  if (status.data.status === 'running') {
    console.log(`Progress: ${status.data.progress}%`);
    setTimeout(() => checkStatus(runId), 1000);
  } else {
    console.log(`Test ${status.data.status}:`, status.data.results);
  }
};
```

### 2. Handle All Statuses
```javascript
const status = await handleTestTool('get_test_status', { runId });

switch (status.data.status) {
  case 'running':
    console.log('Test is running...');
    break;
  case 'completed':
    console.log('Test completed successfully');
    break;
  case 'failed':
    console.log('Test failed:', status.data.errors);
    break;
  case 'timeout':
    console.log('Test timed out');
    break;
}
```

### 3. Error Handling
```javascript
try {
  const status = await handleTestTool('get_test_status', { runId });
  
  if (!status.success) {
    console.error('Status check failed:', status.error);
    return;
  }
  
  // Process status...
} catch (error) {
  console.error('Unexpected error:', error.message);
}
```

## Limitations

- **In-memory Storage**: Test runs are stored in memory (not persistent)
- **Single Instance**: Test runs are not shared across server instances
- **Simplified Progress**: Progress tracking is time-based, not test-based
- **1 Hour TTL**: Test runs are automatically cleaned up after 1 hour

## Future Enhancements

- **Persistent Storage**: Database storage for test run history
- **Real-time Progress**: Framework-specific progress parsing
- **Test Metrics**: Detailed test execution metrics
- **WebSocket Updates**: Real-time status updates via WebSocket
- **Test Run History**: Historical test run data and trends
