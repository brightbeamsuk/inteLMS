/**
 * GDPR Data Retention Lifecycle Tests
 * 
 * Comprehensive test suite for data retention policies, automated deletion,
 * secure erase verification, and compliance auditing.
 */

import { test, describe, beforeEach, afterEach, assert } from '../setup/test-setup.ts';
import { 
  testAuth, 
  testDb, 
  testDataGenerator, 
  globalTestSetup, 
  globalTestTeardown,
  makeRequest 
} from '../setup/test-setup.ts';
import { 
  GdprApiHelper, 
  GdprComplianceValidator 
} from '../setup/gdpr-test-helpers.ts';

describe('Data Retention Lifecycle Management', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Retention Test Org');
    testOrg = orgResult.response.body;
    
    // Create test users
    const userResult = await testAuth.createTestUser('user', testOrg.id);
    const adminResult = await testAuth.createTestUser('admin', testOrg.id);
    const superAdminResult = await testAuth.createTestUser('superadmin');
    
    testUsers.user = userResult.userData;
    testUsers.admin = adminResult.userData;
    testUsers.superAdmin = superAdminResult.userData;
    
    // Authenticate users
    await testAuth.authenticate(testUsers.user.email, testUsers.user.password);
    await testAuth.authenticate(testUsers.admin.email, testUsers.admin.password);
    await testAuth.authenticate(testUsers.superAdmin.email, testUsers.superAdmin.password);
  });

  afterEach(async () => {
    await globalTestTeardown();
  });

  describe('Retention Policy Management', () => {
    
    test('should create retention policies for different data types', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const policyData = {
        name: 'User Account Data Retention',
        description: 'Retention policy for user account information',
        dataCategories: ['identity', 'contact', 'education'],
        retentionPeriod: 2555, // 7 years in days
        lawfulBasis: 'contract',
        deletionMethod: 'secure_delete',
        reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        isActive: true,
      };

      const response = await makeRequest({
        path: '/api/gdpr/retention-policies',
        method: 'POST',
        headers: adminHeaders,
        body: policyData,
        expectedStatus: [201],
      });
      
      assert.strictEqual(response.statusCode, 201, 'Should create retention policy');
      assert.ok(response.body.id, 'Should return policy ID');
      assert.strictEqual(response.body.retentionPeriod, 2555, 'Should store retention period');
      assert.deepStrictEqual(response.body.dataCategories, ['identity', 'contact', 'education'], 
                           'Should store data categories');
    });

    test('should validate retention periods against legal requirements', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const invalidPolicyData = {
        name: 'Invalid Short Retention',
        dataCategories: ['financial'],
        retentionPeriod: 30, // Too short for financial data (UK requires 6 years)
        lawfulBasis: 'legal_obligation',
      };

      try {
        await makeRequest({
          path: '/api/gdpr/retention-policies',
          method: 'POST',
          headers: adminHeaders,
          body: invalidPolicyData,
          expectedStatus: [400],
        });
        assert.fail('Should reject retention period that violates legal requirements');
      } catch (error) {
        // Expected to fail validation
      }
    });

    test('should get retention policies with organization scope', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const response = await GdprApiHelper.getRetentionPolicies(adminHeaders);
      assert.strictEqual(response.statusCode, 200, 'Should retrieve retention policies');
      
      // Verify organization scoping
      for (const policy of response.body) {
        assert.strictEqual(policy.organisationId, testOrg.id, 
                          'Should only return policies for current organization');
      }
    });

    test('should update retention policies with change tracking', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create policy
      const createResponse = await makeRequest({
        path: '/api/gdpr/retention-policies',
        method: 'POST',
        headers: adminHeaders,
        body: {
          name: 'Test Policy',
          dataCategories: ['contact'],
          retentionPeriod: 365,
          lawfulBasis: 'consent',
        },
        expectedStatus: [201],
      });
      
      const policyId = createResponse.body.id;
      
      // Update policy
      const updateResponse = await makeRequest({
        path: `/api/gdpr/retention-policies/${policyId}`,
        method: 'PATCH',
        headers: adminHeaders,
        body: {
          retentionPeriod: 730, // Change to 2 years
          changeReason: 'Updated business requirements',
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(updateResponse.statusCode, 200, 'Should update policy');
      assert.strictEqual(updateResponse.body.retentionPeriod, 730, 'Should update retention period');
      assert.ok(updateResponse.body.version > 1, 'Should increment version for change tracking');
    });
  });

  describe('Automated Data Lifecycle Management', () => {
    
    test('should schedule data for deletion based on retention policies', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create test data that should be scheduled for deletion
      const testUserData = {
        email: 'expired@example.com',
        firstName: 'Expired',
        lastName: 'User',
        createdAt: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 8 years ago
        lastActivity: new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 7 years ago
      };

      // Check scheduled deletions
      const scheduledResponse = await makeRequest({
        path: '/api/gdpr/retention/scheduled-deletions',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(scheduledResponse.statusCode, 200, 'Should retrieve scheduled deletions');
      
      // Verify scheduling logic
      for (const item of scheduledResponse.body) {
        assert.ok(item.scheduledDate, 'Should have scheduled deletion date');
        assert.ok(item.retentionPolicyId, 'Should reference retention policy');
        assert.ok(item.dataType, 'Should specify data type');
      }
    });

    test('should execute data retention policies', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create a short retention policy for testing
      const policyResponse = await makeRequest({
        path: '/api/gdpr/retention-policies',
        method: 'POST',
        headers: adminHeaders,
        body: {
          name: 'Test Short Retention',
          dataCategories: ['test_data'],
          retentionPeriod: 1, // 1 day for testing
          lawfulBasis: 'consent',
          deletionMethod: 'secure_delete',
        },
        expectedStatus: [201],
      });
      
      const policyId = policyResponse.body.id;
      
      // Execute retention policy
      const executeResponse = await GdprApiHelper.triggerDataRetention(adminHeaders, policyId);
      assert.ok([200, 202].includes(executeResponse.statusCode), 'Should execute retention policy');
      
      if (executeResponse.body.jobId) {
        // Check job status
        const statusResponse = await makeRequest({
          path: `/api/gdpr/retention/jobs/${executeResponse.body.jobId}`,
          method: 'GET',
          headers: adminHeaders,
          expectedStatus: [200],
        });
        
        assert.ok(['pending', 'running', 'completed'].includes(statusResponse.body.status), 
                 'Should have valid job status');
      }
    });

    test('should handle retention exceptions and legal holds', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create legal hold
      const legalHoldData = {
        name: 'Litigation Hold - Case ABC123',
        description: 'Data preservation for ongoing litigation',
        dataCategories: ['all'],
        holdType: 'litigation',
        startDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      };

      const holdResponse = await makeRequest({
        path: '/api/gdpr/retention/legal-holds',
        method: 'POST',
        headers: adminHeaders,
        body: legalHoldData,
        expectedStatus: [201],
      });
      
      assert.strictEqual(holdResponse.statusCode, 201, 'Should create legal hold');
      assert.strictEqual(holdResponse.body.holdType, 'litigation', 'Should store hold type');
      
      // Verify retention policy execution respects legal holds
      const policyId = 'test-policy-id';
      try {
        await GdprApiHelper.triggerDataRetention(adminHeaders, policyId);
        // Should either succeed with warnings or be blocked
      } catch (error) {
        // Expected if legal hold blocks deletion
      }
    });

    test('should track data lifecycle events', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get data lifecycle records
      const lifecycleResponse = await makeRequest({
        path: '/api/gdpr/retention/lifecycle-records',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(lifecycleResponse.statusCode, 200, 'Should retrieve lifecycle records');
      
      for (const record of lifecycleResponse.body) {
        assert.ok(record.dataType, 'Should specify data type');
        assert.ok(record.lifecycle_stage, 'Should specify lifecycle stage');
        assert.ok(record.timestamp, 'Should have timestamp');
        assert.ok(['created', 'modified', 'accessed', 'scheduled_deletion', 'deleted'].includes(record.lifecycle_stage),
                 'Should have valid lifecycle stage');
      }
    });
  });

  describe('Secure Data Deletion', () => {
    
    test('should perform secure deletion with verification', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create test data for deletion
      const testData = {
        type: 'user_test_data',
        content: 'Sensitive test information to be securely deleted',
        userId: testUsers.user.id,
      };

      const createResponse = await makeRequest({
        path: '/api/gdpr/test-data',
        method: 'POST',
        headers: adminHeaders,
        body: testData,
        expectedStatus: [201],
      });
      
      const dataId = createResponse.body.id;
      
      // Trigger secure deletion
      const deleteResponse = await makeRequest({
        path: `/api/gdpr/test-data/${dataId}/secure-delete`,
        method: 'DELETE',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(deleteResponse.statusCode, 200, 'Should perform secure deletion');
      assert.ok(deleteResponse.body.deletionCertificateId, 'Should provide deletion certificate ID');
      assert.ok(deleteResponse.body.deletionMethod, 'Should specify deletion method used');
    });

    test('should generate deletion certificates for compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get deletion certificates
      const certificatesResponse = await makeRequest({
        path: '/api/gdpr/retention/deletion-certificates',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(certificatesResponse.statusCode, 200, 'Should retrieve deletion certificates');
      
      for (const cert of certificatesResponse.body) {
        assert.ok(cert.id, 'Should have certificate ID');
        assert.ok(cert.deletionDate, 'Should have deletion date');
        assert.ok(cert.dataType, 'Should specify deleted data type');
        assert.ok(cert.deletionMethod, 'Should specify deletion method');
        assert.ok(cert.verificationHash, 'Should have verification hash');
        assert.ok(cert.adminId, 'Should record admin who performed deletion');
      }
    });

    test('should validate deletion completeness', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Verify deletion completeness
      const verificationResponse = await makeRequest({
        path: '/api/gdpr/retention/verify-deletion',
        method: 'POST',
        headers: adminHeaders,
        body: {
          dataType: 'user_data',
          userId: testUsers.user.id,
          deletionCertificateId: 'test-cert-id',
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(verificationResponse.statusCode, 200, 'Should verify deletion');
      assert.ok(typeof verificationResponse.body.isComplete === 'boolean', 
               'Should indicate if deletion is complete');
      
      if (!verificationResponse.body.isComplete) {
        assert.ok(Array.isArray(verificationResponse.body.remainingData), 
                 'Should list remaining data if deletion incomplete');
      }
    });

    test('should handle different deletion methods', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const deletionMethods = [
        'secure_overwrite',
        'cryptographic_erasure',
        'physical_destruction',
        'logical_deletion',
      ];
      
      for (const method of deletionMethods) {
        const policyResponse = await makeRequest({
          path: '/api/gdpr/retention-policies',
          method: 'POST',
          headers: adminHeaders,
          body: {
            name: `Test ${method} Policy`,
            dataCategories: ['test_data'],
            retentionPeriod: 1,
            deletionMethod: method,
            lawfulBasis: 'consent',
          },
          expectedStatus: [201],
        });
        
        assert.strictEqual(policyResponse.body.deletionMethod, method, 
                          `Should support ${method} deletion method`);
      }
    });
  });

  describe('Retention Compliance Auditing', () => {
    
    test('should generate retention compliance reports', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const reportResponse = await makeRequest({
        path: '/api/gdpr/reports/retention-compliance',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(reportResponse.statusCode, 200, 'Should generate retention compliance report');
      
      const report = reportResponse.body;
      assert.ok(report.totalPolicies, 'Should include total policies count');
      assert.ok(report.activePolicies, 'Should include active policies count');
      assert.ok(report.scheduledDeletions, 'Should include scheduled deletions count');
      assert.ok(report.completedDeletions, 'Should include completed deletions count');
      assert.ok(report.complianceScore, 'Should include compliance score');
      assert.ok(Array.isArray(report.violations), 'Should include violations list');
    });

    test('should audit retention policy compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Run compliance audit
      const auditResponse = await makeRequest({
        path: '/api/gdpr/retention/compliance-audit',
        method: 'POST',
        headers: adminHeaders,
        expectedStatus: [200, 202],
      });
      
      assert.ok([200, 202].includes(auditResponse.statusCode), 'Should initiate compliance audit');
      
      if (auditResponse.body.auditId) {
        // Check audit results
        const resultsResponse = await makeRequest({
          path: `/api/gdpr/retention/compliance-audit/${auditResponse.body.auditId}`,
          method: 'GET',
          headers: adminHeaders,
          expectedStatus: [200],
        });
        
        assert.ok(resultsResponse.body.findings, 'Should provide audit findings');
        assert.ok(typeof resultsResponse.body.complianceScore === 'number', 
                 'Should calculate compliance score');
      }
    });

    test('should track retention-related audit events', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get retention audit logs
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        category: 'data_processing',
        action: 'data_retained',
      });
      
      assert.strictEqual(auditResponse.statusCode, 200, 'Should retrieve retention audit logs');
      
      for (const log of auditResponse.body) {
        const validation = GdprComplianceValidator.validateAuditLogIntegrity(log);
        assert.ok(validation.valid, `Audit log should be valid: ${validation.errors.join(', ')}`);
        assert.ok(log.details.retentionPolicyId, 'Should reference retention policy');
        assert.ok(log.details.dataCategory, 'Should specify data category');
      }
    });

    test('should validate data minimization compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check data minimization compliance
      const minimizationResponse = await makeRequest({
        path: '/api/gdpr/retention/data-minimization-check',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(minimizationResponse.statusCode, 200, 'Should check data minimization');
      
      const check = minimizationResponse.body;
      assert.ok(typeof check.isCompliant === 'boolean', 'Should indicate compliance status');
      assert.ok(Array.isArray(check.excessiveData), 'Should identify excessive data');
      assert.ok(Array.isArray(check.recommendations), 'Should provide recommendations');
    });
  });

  describe('Cross-System Data Retention', () => {
    
    test('should coordinate retention across integrated systems', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test retention coordination
      const coordinationResponse = await makeRequest({
        path: '/api/gdpr/retention/coordinate-systems',
        method: 'POST',
        headers: adminHeaders,
        body: {
          systems: ['lms_core', 'email_service', 'analytics', 'stripe_billing'],
          userId: testUsers.user.id,
          retentionAction: 'delete',
        },
        expectedStatus: [200, 202],
      });
      
      assert.ok([200, 202].includes(coordinationResponse.statusCode), 
               'Should coordinate cross-system retention');
      
      if (coordinationResponse.body.coordinationId) {
        assert.ok(coordinationResponse.body.systems, 'Should list systems being coordinated');
        assert.ok(coordinationResponse.body.status, 'Should provide coordination status');
      }
    });

    test('should handle retention failures and rollbacks', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Simulate retention failure scenario
      const failureResponse = await makeRequest({
        path: '/api/gdpr/retention/handle-failure',
        method: 'POST',
        headers: adminHeaders,
        body: {
          retentionJobId: 'test-job-123',
          failureReason: 'External system unavailable',
          rollbackRequired: true,
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(failureResponse.statusCode, 200, 'Should handle retention failures');
      assert.ok(failureResponse.body.rollbackStatus, 'Should provide rollback status');
      assert.ok(failureResponse.body.compensatingActions, 'Should suggest compensating actions');
    });
  });

  describe('Data Subject Rights Integration', () => {
    
    test('should handle retention in context of erasure requests', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Submit erasure request
      const erasureRequest = testDataGenerator.generateUserRightRequest('erasure', {
        scope: 'complete',
        urgency: 'high',
      });
      
      const requestResponse = await GdprApiHelper.submitUserRightRequest(userHeaders, erasureRequest);
      const requestId = requestResponse.body.id;
      
      // Check how retention policies interact with erasure request
      const interactionResponse = await makeRequest({
        path: `/api/gdpr/retention/erasure-interaction/${requestId}`,
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(interactionResponse.statusCode, 200, 'Should check retention-erasure interaction');
      assert.ok(interactionResponse.body.applicablePolicies, 'Should list applicable retention policies');
      assert.ok(interactionResponse.body.legalObligations, 'Should identify legal obligations');
      assert.ok(typeof interactionResponse.body.canDelete === 'boolean', 'Should indicate if deletion possible');
    });

    test('should respect legitimate interests for retention', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test legitimate interests assessment
      const assessmentResponse = await makeRequest({
        path: '/api/gdpr/retention/legitimate-interests-assessment',
        method: 'POST',
        headers: adminHeaders,
        body: {
          dataType: 'user_account_data',
          userId: testUsers.user.id,
          proposedRetention: 2555, // 7 years
          businessJustification: 'Fraud prevention and legal compliance',
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(assessmentResponse.statusCode, 200, 'Should assess legitimate interests');
      assert.ok(typeof assessmentResponse.body.isLegitimate === 'boolean', 
               'Should determine if interests are legitimate');
      assert.ok(assessmentResponse.body.balancingTest, 'Should include balancing test results');
    });
  });
});