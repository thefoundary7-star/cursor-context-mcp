# CI/CD Integration Guide for FileBridge Production Validation Tests

This guide provides comprehensive instructions for integrating the FileBridge production validation test suite into your CI/CD pipeline.

## 🚀 Quick Start

### GitHub Actions

Create `.github/workflows/production-validation.yml`:

```yaml
name: Production Validation Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.9'

jobs:
  production-validation:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: filebridge_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Cache Python dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-

      - name: Cache Node.js dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r tests/production/requirements.txt

      - name: Install Node.js dependencies
        run: |
          npm install -g artillery

      - name: Set up test environment
        run: |
          python tests/production/setup_test_environment.py

      - name: Run production validation tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/filebridge_test
          DODO_WEBHOOK_SECRET: ${{ secrets.DODO_WEBHOOK_SECRET }}
          DODO_PRO_PRODUCT_ID: ${{ secrets.DODO_PRO_PRODUCT_ID }}
          DODO_ENTERPRISE_PRODUCT_ID: ${{ secrets.DODO_ENTERPRISE_PRODUCT_ID }}
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
          SUPPORT_EMAIL: ${{ secrets.SUPPORT_EMAIL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: |
          python tests/production/test_runner.py --environment staging

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test_results/

      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: test_results/production_validation/*.md

      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const path = require('path');
            
            // Find the latest test report
            const reportsDir = 'test_results/production_validation';
            const files = fs.readdirSync(reportsDir);
            const reportFile = files.find(file => file.startsWith('production_validation_report_'));
            
            if (reportFile) {
              const reportPath = path.join(reportsDir, reportFile);
              const reportContent = fs.readFileSync(reportPath, 'utf8');
              
              // Extract summary from report
              const summaryMatch = reportContent.match(/## Summary\n\n(.*?)\n\n##/s);
              const summary = summaryMatch ? summaryMatch[1] : 'Test report generated';
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `## 🧪 Production Validation Test Results\n\n${summary}\n\n[View full report](${reportPath})`
              });
            }
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - setup
  - test
  - report

variables:
  POSTGRES_DB: filebridge_test
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_HOST_AUTH_METHOD: trust

services:
  - postgres:15

before_script:
  - apt-get update -qq && apt-get install -y -qq git curl libssl-dev libreadline-dev zlib1g-dev
  - curl -fsSL https://github.com/rbenv/rbenv-installer/raw/HEAD/bin/rbenv-installer | bash
  - export PATH="$HOME/.rbenv/bin:$PATH"
  - eval "$(rbenv init -)"
  - rbenv install 3.9.0
  - rbenv global 3.9.0
  - gem install bundler
  - bundle install

setup:
  stage: setup
  script:
    - python -m pip install --upgrade pip
    - pip install -r tests/production/requirements.txt
    - npm install -g artillery
    - python tests/production/setup_test_environment.py
  artifacts:
    paths:
      - .venv/
    expire_in: 1 hour

production-validation:
  stage: test
  dependencies:
    - setup
  script:
    - python tests/production/test_runner.py --environment staging
  variables:
    DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/filebridge_test"
    DODO_WEBHOOK_SECRET: $DODO_WEBHOOK_SECRET
    DODO_PRO_PRODUCT_ID: $DODO_PRO_PRODUCT_ID
    DODO_ENTERPRISE_PRODUCT_ID: $DODO_ENTERPRISE_PRODUCT_ID
    SENDGRID_API_KEY: $SENDGRID_API_KEY
    SUPPORT_EMAIL: $SUPPORT_EMAIL
    JWT_SECRET: $JWT_SECRET
  artifacts:
    when: always
    paths:
      - test_results/
    reports:
      junit: test_results/production_validation/*.xml
    expire_in: 1 week

generate-report:
  stage: report
  dependencies:
    - production-validation
  script:
    - echo "Test report generated in previous stage"
  artifacts:
    paths:
      - test_results/production_validation/*.md
    expire_in: 1 month
```

### Jenkins Pipeline

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any
    
    environment {
        DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/filebridge_test'
        DODO_WEBHOOK_SECRET = credentials('dodo-webhook-secret')
        DODO_PRO_PRODUCT_ID = credentials('dodo-pro-product-id')
        DODO_ENTERPRISE_PRODUCT_ID = credentials('dodo-enterprise-product-id')
        SENDGRID_API_KEY = credentials('sendgrid-api-key')
        SUPPORT_EMAIL = 'support@filebridge.com'
        JWT_SECRET = credentials('jwt-secret')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Setup') {
            steps {
                sh '''
                    python -m pip install --upgrade pip
                    pip install -r tests/production/requirements.txt
                    npm install -g artillery
                    python tests/production/setup_test_environment.py
                '''
            }
        }
        
        stage('Database Setup') {
            steps {
                sh '''
                    docker run -d --name postgres-test \
                        -e POSTGRES_PASSWORD=postgres \
                        -e POSTGRES_DB=filebridge_test \
                        -p 5432:5432 \
                        postgres:15
                    
                    # Wait for database to be ready
                    sleep 10
                '''
            }
        }
        
        stage('Production Validation Tests') {
            steps {
                sh 'python tests/production/test_runner.py --environment staging'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'test_results/production_validation',
                        reportFiles: 'production_validation_report_*.md',
                        reportName: 'Production Validation Report'
                    ])
                }
            }
        }
        
        stage('Load Tests') {
            steps {
                sh 'python tests/production/run_load_tests.py --environment staging'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'test_results/load_tests',
                        reportFiles: 'load_test_report_*.md',
                        reportName: 'Load Test Report'
                    ])
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'test_results/**/*', fingerprint: true
            cleanWs()
        }
        success {
            emailext (
                subject: "✅ Production Validation Tests Passed - ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "All production validation tests passed successfully.",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
        failure {
            emailext (
                subject: "❌ Production Validation Tests Failed - ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "Some production validation tests failed. Please check the build logs and reports.",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

## 🔧 Configuration

### Environment Variables

Set these secrets in your CI/CD platform:

#### GitHub Actions Secrets
- `DODO_WEBHOOK_SECRET`
- `DODO_PRO_PRODUCT_ID`
- `DODO_ENTERPRISE_PRODUCT_ID`
- `SENDGRID_API_KEY`
- `SUPPORT_EMAIL`
- `JWT_SECRET`

#### GitLab CI Variables
- `DODO_WEBHOOK_SECRET`
- `DODO_PRO_PRODUCT_ID`
- `DODO_ENTERPRISE_PRODUCT_ID`
- `SENDGRID_API_KEY`
- `SUPPORT_EMAIL`
- `JWT_SECRET`

#### Jenkins Credentials
- `dodo-webhook-secret`
- `dodo-pro-product-id`
- `dodo-enterprise-product-id`
- `sendgrid-api-key`
- `jwt-secret`

### Database Configuration

For CI/CD environments, use a test database:

```bash
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filebridge_test

# MySQL
DATABASE_URL=mysql://root:password@localhost:3306/filebridge_test

# SQLite (for simple testing)
DATABASE_URL=sqlite:///test.db
```

## 📊 Test Execution Strategies

### 1. Full Test Suite (Recommended for Production)

```bash
# Run all tests
python tests/production/test_runner.py

# Run with specific environment
python tests/production/test_runner.py --environment production
```

### 2. Selective Testing (For Development)

```bash
# Run only critical tests
python tests/production/test_runner.py --categories e2e,webhook

# Run performance tests
python tests/production/test_runner.py --categories load,database
```

### 3. Staged Testing

```yaml
# Stage 1: Quick validation
- name: Quick validation
  run: python tests/production/test_runner.py --categories unit

# Stage 2: Integration tests
- name: Integration tests
  run: python tests/production/test_runner.py --categories e2e,email

# Stage 3: Performance tests
- name: Performance tests
  run: python tests/production/test_runner.py --categories load,database
```

## 🚨 Failure Handling

### Test Failure Notifications

#### Slack Integration
```yaml
- name: Notify Slack on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    channel: '#alerts'
    text: 'Production validation tests failed for ${{ github.ref }}'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### Email Notifications
```yaml
- name: Send failure email
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 587
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: 'Production Validation Tests Failed'
    body: 'Tests failed for commit ${{ github.sha }}'
    to: 'devops@filebridge.com'
```

### Retry Logic

```yaml
- name: Run tests with retry
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 30
    max_attempts: 3
    command: python tests/production/test_runner.py
```

## 📈 Performance Monitoring

### Load Test Integration

```yaml
- name: Run load tests
  run: |
    python tests/production/run_load_tests.py --test webhooks
    python tests/production/run_load_tests.py --test database
```

### Performance Thresholds

```yaml
- name: Check performance thresholds
  run: |
    python -c "
    import json
    with open('test_results/load_tests/load_test_results_*.json') as f:
        results = json.load(f)
    
    for test in results:
        if test['analysis']['passed']:
            print(f'✅ {test[\"test_name\"]} passed')
        else:
            print(f'❌ {test[\"test_name\"]} failed')
            exit(1)
    "
```

## 🔄 Scheduled Testing

### Daily Production Validation

```yaml
name: Daily Production Validation
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  daily-validation:
    runs-on: ubuntu-latest
    steps:
      - name: Run comprehensive tests
        run: |
          python tests/production/test_runner.py --environment production
          python tests/production/run_load_tests.py --environment production
```

### Weekly Performance Review

```yaml
name: Weekly Performance Review
on:
  schedule:
    - cron: '0 3 * * 1'  # 3 AM every Monday

jobs:
  performance-review:
    runs-on: ubuntu-latest
    steps:
      - name: Run performance tests
        run: |
          python tests/production/run_load_tests.py --test all
          python tests/production/test_runner.py --categories database,load
```

## 📋 Best Practices

### 1. Test Isolation
- Use separate test databases
- Clean up test data after each run
- Use unique test identifiers

### 2. Resource Management
- Set appropriate timeouts
- Use resource limits for load tests
- Monitor CI/CD resource usage

### 3. Security
- Never commit secrets to code
- Use encrypted environment variables
- Rotate test credentials regularly

### 4. Monitoring
- Set up alerts for test failures
- Monitor test execution times
- Track test coverage trends

### 5. Documentation
- Keep test documentation updated
- Document test environment setup
- Maintain troubleshooting guides

## 🛠️ Troubleshooting

### Common Issues

#### Database Connection Failures
```bash
# Check database connectivity
pg_isready -h localhost -p 5432

# Verify database exists
psql -h localhost -U postgres -l
```

#### Missing Dependencies
```bash
# Reinstall dependencies
pip install -r tests/production/requirements.txt
npm install -g artillery
```

#### Environment Variable Issues
```bash
# Check environment variables
python -c "import os; print(os.environ.get('DATABASE_URL'))"
```

#### Test Timeout Issues
```yaml
# Increase timeout
- name: Run tests with extended timeout
  run: |
    timeout 1800 python tests/production/test_runner.py
```

### Debug Mode

```bash
# Run tests with verbose output
python tests/production/test_runner.py --categories e2e -v

# Run specific test with debug
python -m pytest tests/production/test_e2e_payment_flow.py -v -s
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitLab CI Documentation](https://docs.gitlab.com/ee/ci/)
- [Jenkins Pipeline Documentation](https://www.jenkins.io/doc/book/pipeline/)
- [Artillery Load Testing Guide](https://artillery.io/docs/)
- [Pytest Documentation](https://docs.pytest.org/)

---

**Note**: Always test your CI/CD pipeline in a staging environment before deploying to production. Monitor the pipeline performance and adjust resource allocation as needed.
