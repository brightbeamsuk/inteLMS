# GDPR Compliance Testing Suite

Comprehensive automated testing framework for GDPR compliance features in the Learning Management System.

## Overview

This testing suite provides complete coverage of all GDPR compliance features including consent management, user rights, data retention, breach management, audit integrity, and integration compliance. The framework ensures ongoing regulatory compliance and system reliability through automated testing.

## Features

- **Comprehensive Coverage**: Tests all GDPR Articles 6-22 implementation
- **Regulatory Compliance**: Validates UK GDPR and PECR compliance
- **Multi-Tenant Testing**: Organization-level data isolation validation
- **Performance Testing**: High-volume operation testing
- **Audit Integrity**: Tamper-proof audit chain validation
- **Integration Testing**: Third-party service compliance validation
- **Accessibility Testing**: WCAG compliance validation
- **CI/CD Ready**: Automated regression testing support

## Test Suites

### Core GDPR Features
- **[Consent Management](./gdpr/consent-management.test.ts)**: Cookie consent, marketing consent, PECR compliance
- **[User Rights](./gdpr/user-rights.test.ts)**: DSAR, rectification, erasure, restriction, portability with SLA tracking
- **[Cookie Consent](./gdpr/cookie-consent.test.ts)**: Granular preferences, browser storage, PECR validation
- **[Data Retention](./gdpr/data-retention.test.ts)**: Automated deletion, secure erase, compliance auditing
- **[Age Verification](./gdpr/age-verification.test.ts)**: Article 8 compliance, parental consent workflows

### Compliance & Security
- **[Breach Management](./gdpr/breach-management.test.ts)**: ICO notification, 72-hour deadlines, data subject notification
- **[Audit Integrity](./gdpr/audit-integrity.test.ts)**: Tamper-proof chains, cryptographic verification, multi-tenant isolation
- **[Integration Compliance](./gdpr/integration-compliance.test.ts)**: Stripe, email providers, analytics, third-party services

### API & Frontend
- **[API Endpoints](./gdpr/api-endpoints.test.ts)**: RBAC validation, feature flags, multi-tenant isolation
- **[Frontend Components](./gdpr/frontend-components.test.ts)**: User interfaces, accessibility, mobile responsiveness

## Quick Start

### Prerequisites

- Node.js 18+ with built-in test runner
- PostgreSQL database access
- GDPR_COMPLIANCE_ENABLED environment variable

### Running Tests

```bash
# Run all GDPR tests
tsx tests/run-all-tests.ts

# Run with reporting
tsx tests/run-all-tests.ts --report --format json

# Run critical tests only
tsx tests/run-all-tests.ts --priority critical

# Run tests in parallel
tsx tests/run-all-tests.ts --parallel

# Run with verbose output
tsx tests/run-all-tests.ts --verbose

# Run specific test suite directly
tsx --test tests/gdpr/consent-management.test.ts

# Run with compliance checking
tsx tests/run-all-tests.ts --report --check-compliance

# Generate HTML report
tsx tests/run-all-tests.ts --report --format html
```

### Command Line Options

```
Usage: tsx tests/run-all-tests.ts [options]

Options:
  -v, --verbose                  Verbose output
  -p, --parallel                 Run tests in parallel
  -c, --coverage                 Generate coverage report
  --category <cat>               Run tests from specific category (core, compliance, lifecycle, incident, protection, security)
  --priority <pri>               Run tests of specific priority (critical, high, medium, low)
  -r, --report                   Generate test reports
  --format <fmt>                 Output format (console, json, html)
  --timeout <ms>                 Test timeout in milliseconds
  --check-compliance             Check compliance threshold after running tests
  --compliance-threshold <num>   Compliance threshold percentage (default: 95)
  -h, --help                     Show this help

Examples:
  tsx tests/run-all-tests.ts                                    # Run all tests
  tsx tests/run-all-tests.ts --category core                    # Run core tests only
  tsx tests/run-all-tests.ts --priority critical                # Run critical tests only
  tsx tests/run-all-tests.ts --parallel --report                # Run in parallel with reports
  tsx tests/run-all-tests.ts --report --check-compliance        # Run with compliance check
```

## Test Categories

### Core GDPR Implementation
- Consent collection and management
- User rights request processing
- Data subject access requests (DSAR)
- Right to rectification, erasure, restriction
- Data portability and objection rights

### Privacy Engineering
- Cookie consent with granular controls
- PECR compliance validation
- Data minimization enforcement
- Privacy by design verification

### Data Lifecycle Management
- Retention policy enforcement
- Automated data deletion
- Secure erasure verification
- Legal hold management

### Incident Response
- Data breach detection and reporting
- ICO notification workflows
- 72-hour deadline compliance
- Data subject notification

### Child Protection (Article 8)
- Age verification workflows
- Parental consent collection
- Enhanced protection measures
- Age transition handling

### Audit & Compliance
- Tamper-proof audit logging
- Cryptographic chain integrity
- Multi-tenant data isolation
- Compliance reporting

### Integration Security
- Third-party service compliance
- Data sharing agreement validation
- Cross-border transfer controls
- Vendor accountability

## Test Configuration

### Environment Variables

```bash
# Required
GDPR_COMPLIANCE_ENABLED=true
NODE_ENV=test
DATABASE_URL=postgresql://...

# Optional
TEST_HOST=localhost
TEST_PORT=5000
GDPR_POLICY_VERSION=2.0
```

### Test Data Isolation

All tests use isolated test data with automatic cleanup:

- **Organizations**: Separate test organizations per suite
- **Users**: Role-based test users (user, admin, superadmin)
- **Data**: Isolated test data with cleanup tracking
- **Sessions**: Separate authentication sessions

### Mock Data Generation

The framework includes comprehensive mock data generators:

```typescript
// Generate test consent record
const consentData = testDataGenerator.generateConsentRecord({
  consentType: 'cookie_consent',
  cookieConsents: {
    strictlyNecessary: true,
    functional: true,
    analytics: false,
    advertising: false,
  }
});

// Generate user rights request
const rightsRequest = testDataGenerator.generateUserRightRequest('access', {
  reason: 'Testing data access workflow',
  urgency: 'normal',
});

// Generate data breach
const breach = testDataGenerator.generateDataBreach({
  severity: 'high',
  affectedDataTypes: ['identity', 'contact'],
  affectedIndividuals: 150,
});
```

## Test Utilities

### Authentication Helper

```typescript
// Create and authenticate test users
const userResult = await testAuth.createTestUser('user', orgId);
await testAuth.authenticate(userResult.userData.email, 'password');
const headers = testAuth.getAuthHeaders(userResult.userData.email);
```

### API Helper

```typescript
// Submit GDPR consent
await GdprApiHelper.submitConsent(headers, consentData);

// Submit user rights request  
await GdprApiHelper.submitUserRightRequest(headers, requestData);

// Get audit logs
await GdprApiHelper.getAuditLogs(headers, filters);
```

### RBAC Testing

```typescript
// Test endpoint access by role
const access = await GdprRbacTester.testEndpointAccess(
  '/api/gdpr/privacy-settings', 'GET', 'admin', adminEmail
);

// Test data isolation between organizations
const isolation = await GdprRbacTester.testDataIsolation(
  user1Email, user2Email, '/api/gdpr/user-rights'
);
```

### Compliance Validation

```typescript
// Validate consent record compliance
const validation = GdprComplianceValidator.validateConsentRecord(consent);
assert.ok(validation.valid, `Errors: ${validation.errors.join(', ')}`);

// Validate user rights request compliance
const requestValidation = GdprComplianceValidator.validateUserRightRequest(request);

// Validate data breach compliance (72-hour deadline)
const breachValidation = GdprComplianceValidator.validateDataBreach(breach);
```

## Compliance Coverage

### GDPR Articles Tested

| Article | Feature | Test Coverage |
|---------|---------|---------------|
| Article 6 | Lawful Basis | ✅ Legal basis validation |
| Article 7 | Consent | ✅ Consent collection, withdrawal, granular controls |
| Article 8 | Child Consent | ✅ Age verification, parental consent |
| Article 12 | Transparent Information | ✅ Privacy notices, clear communication |
| Article 13-14 | Information Provision | ✅ Data collection notifications |
| Article 15 | Right of Access | ✅ DSAR processing, data export |
| Article 16 | Right to Rectification | ✅ Data correction workflows |
| Article 17 | Right to Erasure | ✅ Deletion requests, exceptions |
| Article 18 | Right to Restriction | ✅ Processing restrictions |
| Article 20 | Right to Data Portability | ✅ Data export in portable formats |
| Article 21 | Right to Object | ✅ Objection processing |
| Article 25 | Data Protection by Design | ✅ Privacy engineering validation |
| Article 30 | Records of Processing | ✅ RoPA management |
| Article 32 | Security of Processing | ✅ Security controls testing |
| Article 33-34 | Breach Notification | ✅ ICO and data subject notification |
| Article 35 | Data Protection Impact Assessment | ✅ DPIA workflow testing |

### UK Regulations Tested

- **UK GDPR**: All applicable articles and requirements
- **PECR (Privacy and Electronic Communications Regulations)**: Cookie consent, marketing communications
- **Data Protection Act 2018**: UK-specific requirements
- **ICO Guidance**: Regulatory guidance compliance

### Industry Standards

- **ISO 27001**: Information security management
- **SOC 2**: Security and availability controls  
- **WCAG 2.1**: Web accessibility guidelines

## Reports and Analytics

### Test Execution Reports

Tests generate comprehensive reports in multiple formats:

- **Console Output**: Real-time test results
- **JSON Reports**: Machine-readable test data
- **HTML Reports**: Visual compliance dashboards
- **Compliance Scores**: Weighted scoring based on criticality

### Compliance Metrics

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "duration": 45000,
  "summary": {
    "total": 156,
    "passed": 154,
    "failed": 2,
    "skipped": 0
  },
  "compliance": {
    "gdprEnabled": true,
    "criticalTestsPassed": 45,
    "overallCompliance": 98.7
  }
}
```

### Performance Metrics

- **Response Time**: API endpoint performance
- **Throughput**: Concurrent request handling
- **Resource Usage**: Memory and CPU utilization
- **Database Performance**: Query execution times

## Continuous Integration

### GitHub Actions Example

```yaml
name: GDPR Compliance Tests

on: [push, pull_request]

jobs:
  gdpr-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run GDPR Tests
        env:
          GDPR_COMPLIANCE_ENABLED: true
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        run: npm run test:gdpr:parallel -- --report --format json
        
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: gdpr-test-reports
          path: test-reports/
```

## Best Practices

### Test Organization

1. **Isolated Tests**: Each test is independent and can run in any order
2. **Deterministic**: Tests produce consistent results across environments  
3. **Fast Execution**: Optimized for quick feedback loops
4. **Clear Assertions**: Descriptive test names and error messages

### Data Management

1. **Test Data Isolation**: Separate data per test suite
2. **Automatic Cleanup**: Comprehensive teardown procedures
3. **Realistic Data**: Production-like test scenarios
4. **Privacy Protection**: No real personal data in tests

### Compliance Validation

1. **Regulatory Requirements**: Direct mapping to GDPR articles
2. **Deadline Tracking**: SLA and regulatory deadline verification
3. **Evidence Collection**: Audit trail validation
4. **Risk Assessment**: Compliance gap identification

## Troubleshooting

### Common Issues

**Test Timeouts**
```bash
# Increase timeout for complex operations
npm run test:gdpr -- --timeout 60000
```

**Database Connection Issues**
```bash
# Verify database environment variables
echo $DATABASE_URL
echo $GDPR_COMPLIANCE_ENABLED
```

**Feature Flag Issues**
```bash
# Ensure GDPR is enabled for testing
export GDPR_COMPLIANCE_ENABLED=true
```

### Debug Mode

```bash
# Run with verbose logging
npm run test:gdpr -- --verbose

# Run specific test with debugging
tsx --test --test-reporter=verbose tests/gdpr/consent-management.test.ts
```

### Test Data Cleanup

```bash
# Manual cleanup if tests fail to clean up
npm run test:cleanup

# Reset test database
npm run db:reset:test
```

## Contributing

### Adding New Tests

1. Create test file in appropriate category directory
2. Follow existing naming conventions
3. Use provided test utilities and helpers
4. Include compliance validation
5. Add appropriate documentation

### Test Development Guidelines

```typescript
// Use descriptive test names
test('should enforce 72-hour ICO notification deadline for high-severity breaches', async () => {
  // Test implementation
});

// Include compliance validation
const validation = GdprComplianceValidator.validateDataBreach(breach);
assert.ok(validation.valid, `Compliance errors: ${validation.errors.join(', ')}`);

// Clean up test data
testDb.markForCleanup('breach', breachId);
```

### Code Coverage

Target coverage metrics:
- **Overall Coverage**: >90%
- **Critical Paths**: 100%
- **GDPR Features**: 100%
- **API Endpoints**: >95%

## License

This testing framework is part of the Learning Management System and follows the same licensing terms.

## Support

For issues with the testing framework:

1. Check this documentation
2. Review test logs and error messages
3. Verify environment configuration
4. Consult the main project documentation
5. Report issues with detailed reproduction steps

---

**Note**: This testing framework is designed for development and staging environments. Always ensure test data is properly isolated and cleaned up. Never run tests against production systems containing real user data.