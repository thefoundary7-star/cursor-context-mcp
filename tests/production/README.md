# FileBridge Production Validation Test Suite

This comprehensive test suite validates your FileBridge production deployment across all critical components including payment flows, email delivery, database performance, webhook reliability, and user registration/license activation.

## 🎯 Test Coverage

### 1. End-to-End Payment Flow Testing
- **Free Tier Registration**: Complete user registration and license creation
- **Pro/Enterprise Subscriptions**: Dodo webhook processing and license delivery
- **License Generation**: Automated license key creation and email delivery
- **Webhook Processing**: Signature validation and idempotency handling
- **Database Integration**: User, subscription, and license record creation

### 2. Email System Validation
- **Template Rendering**: Cross-client compatibility testing
- **SMTP Delivery**: Multiple provider testing (SendGrid, SES, Mailgun)
- **Content Accuracy**: Tier-specific email content validation
- **Failure Handling**: Retry mechanisms and error recovery
- **Analytics Tracking**: Open, click, and bounce tracking

### 3. Database Performance Testing
- **Load Testing**: Concurrent operations under high load
- **Migration Testing**: SQLite to PostgreSQL migration validation
- **Connection Pooling**: High-concurrency connection management
- **Query Optimization**: Performance profiling and optimization
- **Backup/Restore**: Data integrity and recovery procedures

### 4. Webhook Reliability Testing
- **Signature Validation**: Security and authenticity verification
- **Idempotency**: Duplicate event handling
- **Retry Mechanisms**: Exponential backoff and failure recovery
- **High-Volume Processing**: Concurrent webhook handling
- **Monitoring**: Delivery tracking and alerting

### 5. User Registration and License Activation
- **Account Creation**: Multi-tier user registration
- **License-User Relationships**: Database relationship management
- **CLI Activation**: Command-line license activation
- **Web Interface**: Browser-based activation
- **Usage Tracking**: Free tier limit enforcement

## 🚀 Quick Start

### Prerequisites

```bash
# Install Python dependencies
pip install pytest pytest-asyncio aiohttp aiofiles psutil

# Install Artillery for load testing
npm install -g artillery

# Install Node.js dependencies (if not already installed)
npm install
```

### Running Tests

#### Run All Tests
```bash
python tests/production/test_runner.py
```

#### Run Specific Test Categories
```bash
# End-to-end payment flow tests
python tests/production/test_runner.py --categories e2e

# Email validation tests
python tests/production/test_runner.py --categories email

# Database performance tests
python tests/production/test_runner.py --categories database

# Webhook reliability tests
python tests/production/test_runner.py --categories webhook

# User registration tests
python tests/production/test_runner.py --categories user

# Load tests only
python tests/production/test_runner.py --categories load
```

#### Run Against Different Environments
```bash
# Test against staging
python tests/production/test_runner.py --environment staging

# Test against production
python tests/production/test_runner.py --environment production
```

### Load Testing

#### Run Load Tests
```bash
# Run all load tests
python tests/production/run_load_tests.py

# Run specific load test
python tests/production/run_load_tests.py --test webhooks
python tests/production/run_load_tests.py --test database
python tests/production/run_load_tests.py --test general
```

#### Artillery Configuration
The load tests use Artillery configurations:
- `artillery_config.yml`: General application load testing
- `artillery_webhook_load.yml`: Webhook-specific load testing
- `artillery_database_load.yml`: Database operation load testing

## 📊 Test Structure

```
tests/production/
├── __init__.py
├── fixtures.py                    # Test fixtures and mock data
├── test_e2e_payment_flow.py      # End-to-end payment flow tests
├── test_email_validation.py      # Email system validation tests
├── test_database_performance.py  # Database performance tests
├── test_webhook_reliability.py   # Webhook reliability tests
├── test_user_license_activation.py # User registration tests
├── artillery_config.yml          # General load test config
├── artillery_webhook_load.yml    # Webhook load test config
├── artillery_database_load.yml   # Database load test config
├── run_load_tests.py            # Load test runner
├── test_runner.py               # Main test runner
└── README.md                    # This file
```

## 🔧 Configuration

### Environment Variables

Set these environment variables for testing:

```bash
# Database
export DATABASE_URL="postgresql://user:pass@localhost/filebridge"

# Dodo Payments
export DODO_WEBHOOK_SECRET="your_webhook_secret"
export DODO_PRO_PRODUCT_ID="prod_pro_monthly"
export DODO_ENTERPRISE_PRODUCT_ID="prod_enterprise_monthly"

# Email
export SENDGRID_API_KEY="your_sendgrid_key"
export SUPPORT_EMAIL="support@filebridge.com"

# JWT
export JWT_SECRET="your_jwt_secret"
```

### Test Data

The test suite includes comprehensive test data:
- Sample users for all tiers (FREE, PRO, ENTERPRISE)
- Sample subscriptions and licenses
- Dodo webhook event samples
- Email template test data
- Performance test data sets

## 📈 Performance Thresholds

### Load Test Thresholds
- **Response Time P95**: < 2000ms
- **Response Time P99**: < 5000ms
- **Success Rate**: > 95%
- **4xx Error Rate**: < 5%
- **5xx Error Rate**: < 1%

### Database Performance
- **User Creation**: > 20 users/second
- **License Creation**: > 20 licenses/second
- **Webhook Processing**: > 20 webhooks/second
- **Query Performance**: < 1000ms for complex queries

## 📋 Test Reports

### Generated Reports
- **Production Validation Report**: Comprehensive test results
- **Load Test Report**: Performance metrics and analysis
- **JSON Results**: Machine-readable test results

### Report Location
```
test_results/
├── production_validation/
│   ├── production_validation_report_YYYYMMDD_HHMMSS.md
│   ├── production_validation_results_YYYYMMDD_HHMMSS.json
│   └── [category]_test_YYYYMMDD_HHMMSS.json
└── load_tests/
    ├── load_test_report_YYYYMMDD_HHMMSS.md
    ├── load_test_results_YYYYMMDD_HHMMSS.json
    └── [test_name]_YYYYMMDD_HHMMSS.json
```

## 🐛 Troubleshooting

### Common Issues

#### Artillery Not Found
```bash
npm install -g artillery
```

#### Missing Python Dependencies
```bash
pip install pytest pytest-asyncio aiohttp aiofiles psutil
```

#### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure database is running and accessible
- Check firewall and network connectivity

#### Webhook Signature Validation Failures
- Verify DODO_WEBHOOK_SECRET is correct
- Check webhook endpoint configuration
- Ensure proper signature generation

### Debug Mode

Run tests with verbose output:
```bash
python tests/production/test_runner.py --categories e2e -v
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Production Validation Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          npm install -g artillery
      - name: Run production validation tests
        run: python tests/production/test_runner.py
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DODO_WEBHOOK_SECRET: ${{ secrets.DODO_WEBHOOK_SECRET }}
```

### Jenkins Pipeline Example
```groovy
pipeline {
    agent any
    stages {
        stage('Install Dependencies') {
            steps {
                sh 'pip install -r requirements.txt'
                sh 'npm install -g artillery'
            }
        }
        stage('Run Production Tests') {
            steps {
                sh 'python tests/production/test_runner.py'
            }
        }
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
```

## 📚 Additional Resources

- [Artillery Documentation](https://artillery.io/docs/)
- [Pytest Documentation](https://docs.pytest.org/)
- [FileBridge API Documentation](./API_DOCUMENTATION.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)

## 🤝 Contributing

When adding new tests:
1. Follow the existing test structure
2. Add comprehensive test data in `fixtures.py`
3. Include performance thresholds
4. Update this README with new test categories
5. Ensure tests can run in CI/CD environments

## 📞 Support

For issues with the test suite:
1. Check the troubleshooting section
2. Review test output and logs
3. Verify environment configuration
4. Check database and service connectivity

---

**Note**: This test suite is designed for production validation. Always run tests against staging environments first before testing production systems.
