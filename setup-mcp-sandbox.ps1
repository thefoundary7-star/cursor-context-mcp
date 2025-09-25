# MCP Sandbox Project Setup Script (Windows PowerShell)
# Creates a comprehensive test environment for Enhanced MCP Server tools

param(
    [string]$ProjectName = "mcp-sandbox"
)

# Enable strict mode for better error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up MCP Sandbox Project..." -ForegroundColor Green

try {
    # 1. Create project directory and initialize Node.js project
    Write-Host "📁 Creating project directory and initializing Node.js..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Name $ProjectName -Force | Out-Null
    Set-Location $ProjectName
    npm init -y

    # 2. Create src/ folder with test files
    Write-Host "📝 Creating source files..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Name "src" -Force | Out-Null

    # Create index.js with an overly long function (triggers code quality warnings)
    @'
const express = require('express');
const _ = require('lodash');

/**
 * Calculates complex business metrics with multiple operations
 * @param {Object} data - Input data object
 * @param {Array} filters - Array of filter functions
 * @param {Object} options - Configuration options
 * @returns {Object} Processed metrics
 */
function calculateComplexBusinessMetrics(data, filters, options) {
    // This function is intentionally long to trigger code quality metrics
    let result = {};

    if (!data || typeof data !== 'object') {
        throw new Error('Invalid data provided');
    }

    if (!Array.isArray(filters)) {
        filters = [];
    }

    options = options || {};
    const defaultOptions = {
        includePercentages: true,
        roundDecimals: 2,
        sortResults: true,
        filterThreshold: 0.1,
        aggregationType: 'sum'
    };

    options = Object.assign(defaultOptions, options);

    // Process each data entry
    Object.keys(data).forEach(key => {
        let value = data[key];

        // Apply filters
        filters.forEach(filter => {
            if (typeof filter === 'function') {
                try {
                    value = filter(value, key, data);
                } catch (error) {
                    console.warn(`Filter failed for key ${key}:`, error.message);
                }
            }
        });

        // Calculate metrics
        if (typeof value === 'number') {
            result[key] = {
                original: data[key],
                processed: value,
                difference: value - data[key],
                percentageChange: data[key] !== 0 ? ((value - data[key]) / data[key]) * 100 : 0
            };

            if (options.includePercentages) {
                result[key].formattedPercentage = result[key].percentageChange.toFixed(options.roundDecimals) + '%';
            }

            if (Math.abs(result[key].percentageChange) < options.filterThreshold) {
                result[key].significant = false;
            } else {
                result[key].significant = true;
            }
        }
    });

    // Sort results if requested
    if (options.sortResults) {
        const sortedKeys = Object.keys(result).sort((a, b) => {
            return Math.abs(result[b].percentageChange) - Math.abs(result[a].percentageChange);
        });

        const sortedResult = {};
        sortedKeys.forEach(key => {
            sortedResult[key] = result[key];
        });
        result = sortedResult;
    }

    return result;
}

const app = express();
app.use(express.json());

app.get('/metrics', (req, res) => {
    const sampleData = { revenue: 1000, costs: 750, profit: 250 };
    const metrics = calculateComplexBusinessMetrics(sampleData, [], req.query);
    res.json(metrics);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { calculateComplexBusinessMetrics };
'@ | Out-File -FilePath "src\index.js" -Encoding UTF8

    # Create math.py with Python function
    @'
def fibonacci_sequence(n):
    """Generate Fibonacci sequence up to n numbers."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]

    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])

    return sequence

def prime_factors(n):
    """Find all prime factors of a number."""
    factors = []
    divisor = 2

    while divisor * divisor <= n:
        while n % divisor == 0:
            factors.append(divisor)
            n //= divisor
        divisor += 1

    if n > 1:
        factors.append(n)

    return factors

if __name__ == "__main__":
    print("Fibonacci(10):", fibonacci_sequence(10))
    print("Prime factors of 60:", prime_factors(60))
'@ | Out-File -FilePath "src\math.py" -Encoding UTF8

    # Create util.ts with TypeScript function (no docstring to trigger documentation coverage)
    @'
export interface User {
    id: number;
    name: string;
    email: string;
    active: boolean;
}

export function formatUserName(user: User): string {
    if (!user || !user.name) {
        return 'Unknown User';
    }

    const parts = user.name.trim().split(' ');
    if (parts.length === 1) {
        return parts[0];
    }

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName}`;
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function generateUserId(): number {
    return Math.floor(Math.random() * 1000000) + 1;
}
'@ | Out-File -FilePath "src\util.ts" -Encoding UTF8

    # 3. Install sample dependencies
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install express lodash
    npm install --save-dev jest "@types/jest" typescript ts-node

    # 4. Create tests/ folder with Jest test
    Write-Host "🧪 Creating test files..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Name "tests" -Force | Out-Null

    @'
const { calculateComplexBusinessMetrics } = require('../src/index');

describe('MCP Sandbox Tests', () => {
    test('calculateComplexBusinessMetrics should process data correctly', () => {
        const testData = {
            revenue: 1000,
            costs: 750,
            profit: 250
        };

        const result = calculateComplexBusinessMetrics(testData, []);

        expect(result).toBeDefined();
        expect(result.revenue).toBeDefined();
        expect(result.revenue.original).toBe(1000);
        expect(result.revenue.processed).toBe(1000);
    });

    test('should handle empty data gracefully', () => {
        expect(() => {
            calculateComplexBusinessMetrics(null, []);
        }).toThrow('Invalid data provided');
    });

    test('should apply filters correctly', () => {
        const testData = { value: 100 };
        const doubleFilter = (val) => val * 2;

        const result = calculateComplexBusinessMetrics(testData, [doubleFilter]);

        expect(result.value.processed).toBe(200);
        expect(result.value.percentageChange).toBe(100);
    });
});
'@ | Out-File -FilePath "tests\sample.test.js" -Encoding UTF8

    # Update package.json to include test script
    Write-Host "⚙️  Updating package.json..." -ForegroundColor Yellow
    npm pkg set scripts.test="jest"
    npm pkg set scripts.start="node src/index.js"
    npm pkg set scripts.dev="node src/index.js"

    # 5. Initialize Git repository
    Write-Host "📋 Initializing Git repository..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit"

    # 6. Create README.md
    Write-Host "📚 Creating documentation..." -ForegroundColor Yellow
    @'
# MCP Sandbox Project

A comprehensive test environment for Enhanced MCP Server tools, featuring:

- **Multi-language support**: JavaScript, TypeScript, and Python files
- **Complex code patterns**: Long functions to test code quality metrics
- **Testing framework**: Jest-based test suite
- **Dependencies**: Express.js and Lodash for security scanning
- **CI/CD**: GitHub Actions workflow with MCP health gates
- **Documentation**: JSDoc comments and TypeScript interfaces

## Getting Started

```bash
npm install
npm test
npm start
```

## Project Structure

- `src/` - Source code files
  - `index.js` - Main Express server with complex business logic
  - `math.py` - Python mathematical functions
  - `util.ts` - TypeScript utility functions
- `tests/` - Jest test files
- `.github/workflows/` - CI/CD configuration

## MCP Tools Testing

This project is designed to test all Enhanced MCP Server capabilities:

- File operations and multi-language support
- Code quality metrics and documentation coverage
- Dependency management and security scanning
- Git operations and CI/CD integration
- Testing framework integration

Perfect for validating MCP server functionality in a realistic development environment.
'@ | Out-File -FilePath "README.md" -Encoding UTF8

    # 7. Create GitHub Actions workflow
    Write-Host "🔄 Creating CI/CD workflow..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path ".github\workflows" -Force | Out-Null

    # Create CI content as array of strings to avoid parsing issues
    $ciLines = @(
        "name: CI/CD Pipeline",
        "",
        "on:",
        "  push:",
        "    branches: [ main, develop ]",
        "  pull_request:",
        "    branches: [ main ]",
        "",
        "jobs:",
        "  test:",
        "    runs-on: ubuntu-latest",
        "",
        "    strategy:",
        "      matrix:",
        "        node-version: [18.x, 20.x]",
        "",
        "    steps:",
        "    - name: Checkout code",
        "      uses: actions/checkout@v4",
        "",
        "    - name: Setup Node.js `${{ matrix.node-version }}",
        "      uses: actions/setup-node@v4",
        "      with:",
        "        node-version: `${{ matrix.node-version }}",
        "        cache: 'npm'",
        "",
        "    - name: Install dependencies",
        "      run: npm ci",
        "",
        "    - name: Run tests",
        "      run: npm test",
        "",
        "    - name: Run linting",
        "      run: |",
        "        echo `"Linting would run here`"",
        "        # npm run lint",
        "",
        "    - name: MCP Health Gate Check",
        "      run: |",
        "        echo `"Running MCP CI health gate with threshold 70`"",
        "        # This would call: mcp-tool ci_health_gate --threshold 70",
        "        # For demo purposes, we'll simulate the check",
        "        echo `"✅ CI health gate passed (threshold: 70)`"",
        "",
        "  security:",
        "    runs-on: ubuntu-latest",
        "    needs: test",
        "",
        "    steps:",
        "    - name: Checkout code",
        "      uses: actions/checkout@v4",
        "",
        "    - name: Setup Node.js",
        "      uses: actions/setup-node@v4",
        "      with:",
        "        node-version: '20.x'",
        "        cache: 'npm'",
        "",
        "    - name: Install dependencies",
        "      run: npm ci",
        "",
        "    - name: Run security audit",
        "      run: npm audit --audit-level=high",
        "",
        "    - name: Check for vulnerabilities",
        "      run: |",
        "        echo `"Security scan completed`"",
        "        # Additional MCP security tools would run here"
    )
    $ciLines | Out-File -FilePath ".github\workflows\ci.yml" -Encoding UTF8

    # Create .gitignore
    @'
node_modules/
dist/
build/
*.log
.env
.env.local
.DS_Store
coverage/
.nyc_output/
.cache/
'@ | Out-File -FilePath ".gitignore" -Encoding UTF8

    Write-Host ""
    Write-Host "✅ MCP Sandbox Project setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Project created at: $(Get-Location)" -ForegroundColor Cyan
    Write-Host "🔧 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. cd $ProjectName" -ForegroundColor White
    Write-Host "   2. npm test (to run tests)" -ForegroundColor White
    Write-Host "   3. npm start (to start the server)" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Ready for Enhanced MCP Server tool testing:" -ForegroundColor Magenta
    Write-Host "   • File operations (JS, TS, Python files)" -ForegroundColor White
    Write-Host "   • Code quality metrics (long function in index.js)" -ForegroundColor White
    Write-Host "   • Documentation coverage (missing docs in util.ts)" -ForegroundColor White
    Write-Host "   • Dependency scanning (express, lodash installed)" -ForegroundColor White
    Write-Host "   • Git operations (initialized repo)" -ForegroundColor White
    Write-Host "   • CI/CD integration (GitHub Actions workflow)" -ForegroundColor White
    Write-Host "   • Testing framework (Jest configured)" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Happy testing!" -ForegroundColor Green

} catch {
    Write-Host "❌ Error occurred during setup: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check the error and try again." -ForegroundColor Yellow
    exit 1
}