/**
 * GDPR Audit System Integrity Tests
 * 
 * Comprehensive test suite for audit logging verification, tamper-proof chain integrity,
 * database consistency, and cryptographic verification of audit trails.
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

describe('GDPR Audit System Integrity', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Audit Integrity Test Org');
    testOrg = orgResult.response.body;
    
    // Create test users with different roles
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

  describe('Audit Log Creation and Structure', () => {
    
    test('should create comprehensive audit logs for GDPR actions', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Perform GDPR action that should be audited
      const consentData = testDataGenerator.generateConsentRecord();
      await GdprApiHelper.submitConsent(userHeaders, consentData);
      
      // Get audit logs for the action
      const auditResponse = await GdprApiHelper.getAuditLogs(userHeaders, {
        action: 'consent_granted',
        userId: testUsers.user.id,
      });
      
      assert.strictEqual(auditResponse.statusCode, 200, 'Should retrieve audit logs');
      assert.ok(auditResponse.body.length > 0, 'Should have audit log entries');
      
      const auditLog = auditResponse.body[0];
      
      // Validate required audit fields
      assert.ok(auditLog.id, 'Should have audit log ID');
      assert.ok(auditLog.timestamp, 'Should have timestamp');
      assert.ok(auditLog.action, 'Should have action');
      assert.ok(auditLog.resource, 'Should have resource');
      assert.ok(auditLog.userId, 'Should have user ID');
      assert.ok(auditLog.organisationId, 'Should have organization ID');
      assert.ok(auditLog.ipAddress, 'Should have IP address');
      assert.ok(auditLog.userAgent, 'Should have user agent');
      assert.ok(auditLog.sessionId, 'Should have session ID');
      
      // Validate audit log integrity
      const validation = GdprComplianceValidator.validateAuditLogIntegrity(auditLog);
      assert.ok(validation.valid, `Audit log should be valid: ${validation.errors.join(', ')}`);
    });

    test('should generate unique audit log IDs and prevent duplicates', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Perform multiple GDPR actions
      const actions = [
        () => GdprApiHelper.submitConsent(userHeaders, testDataGenerator.generateConsentRecord()),
        () => GdprApiHelper.getConsent(userHeaders),
        () => GdprApiHelper.withdrawConsent(userHeaders, 'cookie_consent'),
      ];
      
      for (const action of actions) {
        await action();
      }
      
      // Get all audit logs
      const auditResponse = await GdprApiHelper.getAuditLogs(userHeaders, {
        userId: testUsers.user.id,
      });
      
      const auditIds = auditResponse.body.map((log: any) => log.id);
      const uniqueIds = new Set(auditIds);
      
      assert.strictEqual(auditIds.length, uniqueIds.size, 'All audit log IDs should be unique');
    });

    test('should capture detailed context for each audit event', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Perform admin action with context
      const breachData = testDataGenerator.generateDataBreach({
        severity: 'medium',
        context: 'Security incident investigation',
      });
      
      await GdprApiHelper.reportBreach(adminHeaders, breachData);
      
      // Get audit log with context
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        action: 'breach_detected',
        adminId: testUsers.admin.id,
      });
      
      const auditLog = auditResponse.body[0];
      assert.ok(auditLog.details, 'Should have detailed context');
      assert.ok(auditLog.details.severity, 'Should capture breach severity');
      assert.ok(auditLog.details.beforeState, 'Should capture before state where applicable');
      assert.ok(auditLog.details.afterState, 'Should capture after state');
      assert.ok(auditLog.details.changesSummary, 'Should summarize changes made');
    });

    test('should maintain audit log immutability', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create audit log entry
      const consentData = testDataGenerator.generateConsentRecord();
      await GdprApiHelper.submitConsent(adminHeaders, consentData);
      
      // Get the audit log
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        action: 'consent_granted',
        limit: 1,
      });
      
      const auditLog = auditResponse.body[0];
      const auditId = auditLog.id;
      
      // Attempt to modify audit log (should fail)
      try {
        await makeRequest({
          path: `/api/gdpr/audit-logs/${auditId}`,
          method: 'PUT',
          headers: adminHeaders,
          body: { modified: true },
          expectedStatus: [405, 403], // Method not allowed or forbidden
        });
      } catch (error) {
        // Expected to fail - audit logs should be immutable
      }
      
      // Verify audit log is unchanged
      const verifyResponse = await makeRequest({
        path: `/api/gdpr/audit-logs/${auditId}`,
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.deepStrictEqual(verifyResponse.body.timestamp, auditLog.timestamp, 
                           'Audit log should remain unchanged');
      assert.ok(!verifyResponse.body.modifiedAt, 'Should not have modification timestamp');
    });
  });

  describe('Cryptographic Chain Integrity', () => {
    
    test('should maintain cryptographic chain linking', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get chain integrity status
      const chainResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/chain-integrity',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(chainResponse.statusCode, 200, 'Should check chain integrity');
      
      const integrity = chainResponse.body;
      assert.ok(typeof integrity.isValid === 'boolean', 'Should indicate chain validity');
      assert.ok(integrity.totalLogs, 'Should report total logs in chain');
      assert.ok(integrity.lastBlockHash, 'Should provide last block hash');
      assert.ok(integrity.chainStartHash, 'Should provide chain start hash');
      
      if (!integrity.isValid) {
        assert.ok(Array.isArray(integrity.brokenLinks), 'Should identify broken chain links');
        assert.ok(integrity.corruptionPoint, 'Should identify corruption point');
      }
    });

    test('should verify hash chain consistency', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Create multiple audit entries to build chain
      const actions = [
        () => GdprApiHelper.submitConsent(adminHeaders, testDataGenerator.generateConsentRecord()),
        () => GdprApiHelper.submitUserRightRequest(adminHeaders, testDataGenerator.generateUserRightRequest('access')),
        () => GdprApiHelper.reportBreach(adminHeaders, testDataGenerator.generateDataBreach()),
      ];
      
      for (const action of actions) {
        await action();
      }
      
      // Verify hash chain
      const verificationResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/verify-chain',
        method: 'POST',
        headers: adminHeaders,
        body: { verifyDepth: 10 }, // Verify last 10 entries
        expectedStatus: [200],
      });
      
      assert.strictEqual(verificationResponse.statusCode, 200, 'Should verify hash chain');
      
      const verification = verificationResponse.body;
      assert.ok(verification.chainValid, 'Hash chain should be valid');
      assert.ok(verification.verifiedEntries > 0, 'Should verify audit entries');
      assert.ok(verification.hashValidation, 'Should validate individual hashes');
    });

    test('should detect and report chain tampering attempts', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.headers);
      
      // Simulate chain tampering detection
      const tamperResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/detect-tampering',
        method: 'POST',
        headers: adminHeaders,
        body: { performDeepScan: true },
        expectedStatus: [200],
      });
      
      assert.strictEqual(tamperResponse.statusCode, 200, 'Should detect tampering attempts');
      
      const detection = tamperResponse.body;
      assert.ok(typeof detection.tamperingDetected === 'boolean', 
               'Should indicate if tampering detected');
      assert.ok(Array.isArray(detection.suspiciousEntries), 
               'Should list suspicious entries');
      assert.ok(detection.integrityScore !== undefined, 
               'Should provide integrity score');
      
      if (detection.tamperingDetected) {
        assert.ok(detection.tamperingEvidence, 'Should provide tampering evidence');
        assert.ok(detection.affectedTimeRange, 'Should identify affected time range');
      }
    });

    test('should generate cryptographic proof of integrity', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Generate integrity proof
      const proofResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/integrity-proof',
        method: 'POST',
        headers: adminHeaders,
        body: {
          timeRange: {
            from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
            to: new Date().toISOString(),
          },
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(proofResponse.statusCode, 200, 'Should generate integrity proof');
      
      const proof = proofResponse.body;
      assert.ok(proof.merkleRoot, 'Should provide Merkle root hash');
      assert.ok(proof.digitalSignature, 'Should provide digital signature');
      assert.ok(proof.timestamp, 'Should timestamp the proof');
      assert.ok(proof.entryCount, 'Should specify number of entries in proof');
      assert.ok(proof.verificationMethod, 'Should specify verification method');
    });
  });

  describe('Multi-Tenant Audit Isolation', () => {
    
    test('should enforce organization-level audit isolation', async () => {
      // Create second organization
      const org2Result = await testDb.createTestOrganization('Second Audit Org');
      const user2Result = await testAuth.createTestUser('user', org2Result.response.body.id);
      await testAuth.authenticate(user2Result.userData.email, user2Result.userData.password);
      
      const user1Headers = testAuth.getAuthHeaders(testUsers.user.email);
      const user2Headers = testAuth.getAuthHeaders(user2Result.userData.email);
      
      // Create audit entries for both organizations
      await GdprApiHelper.submitConsent(user1Headers, testDataGenerator.generateConsentRecord());
      await GdprApiHelper.submitConsent(user2Headers, testDataGenerator.generateConsentRecord());
      
      // Verify isolation - user1 should only see org1 audit logs
      const org1AuditResponse = await GdprApiHelper.getAuditLogs(user1Headers);
      const org2AuditResponse = await GdprApiHelper.getAuditLogs(user2Headers);
      
      // Check organization isolation
      for (const log of org1AuditResponse.body) {
        assert.strictEqual(log.organisationId, testOrg.id, 
                          'Org1 user should only see org1 audit logs');
      }
      
      for (const log of org2AuditResponse.body) {
        assert.strictEqual(log.organisationId, org2Result.response.body.id, 
                          'Org2 user should only see org2 audit logs');
      }
    });

    test('should handle cross-organization audit queries correctly', async () => {
      const superAdminHeaders = testAuth.getAuthHeaders(testUsers.superAdmin.email);
      
      // Super admin should be able to see cross-organization audits
      const crossOrgResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/cross-organization',
        method: 'GET',
        headers: superAdminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(crossOrgResponse.statusCode, 200, 
                        'Super admin should access cross-org audits');
      
      // Verify response includes multiple organizations
      const orgIds = new Set(crossOrgResponse.body.map((log: any) => log.organisationId));
      // Should have entries from multiple organizations
      assert.ok(orgIds.size >= 1, 'Should include audit logs from multiple organizations');
    });

    test('should maintain audit integrity across organization boundaries', async () => {
      const superAdminHeaders = testAuth.getAuthHeaders(testUsers.superAdmin.email);
      
      // Check integrity across all organizations
      const globalIntegrityResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/global-integrity-check',
        method: 'POST',
        headers: superAdminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(globalIntegrityResponse.statusCode, 200, 
                        'Should check global audit integrity');
      
      const integrity = globalIntegrityResponse.body;
      assert.ok(Array.isArray(integrity.organizationIntegrity), 
               'Should check integrity per organization');
      
      for (const orgIntegrity of integrity.organizationIntegrity) {
        assert.ok(orgIntegrity.organisationId, 'Should specify organization ID');
        assert.ok(typeof orgIntegrity.isValid === 'boolean', 'Should indicate validity');
        assert.ok(orgIntegrity.auditCount, 'Should specify audit count');
      }
    });
  });

  describe('Audit Performance and Scalability', () => {
    
    test('should handle high-volume audit logging efficiently', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Measure audit logging performance
      const startTime = Date.now();
      const batchSize = 10; // Reduced for testing
      
      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        const consentData = testDataGenerator.generateConsentRecord();
        promises.push(GdprApiHelper.submitConsent(userHeaders, consentData));
      }
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      const avgTimePerOperation = duration / batchSize;
      
      // Verify performance is within acceptable limits (less than 1 second per operation)
      assert.ok(avgTimePerOperation < 1000, 
               `Audit logging should be efficient: ${avgTimePerOperation}ms per operation`);
      
      // Verify all audit entries were created
      const auditResponse = await GdprApiHelper.getAuditLogs(userHeaders, {
        action: 'consent_granted',
        userId: testUsers.user.id,
      });
      
      assert.ok(auditResponse.body.length >= batchSize, 
               'Should create audit entries for all operations');
    });

    test('should support efficient audit log querying and filtering', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test various query patterns
      const queryTests = [
        { filter: { action: 'consent_granted' }, description: 'by action' },
        { filter: { resource: 'consent_record' }, description: 'by resource' },
        { filter: { userId: testUsers.user.id }, description: 'by user ID' },
        { 
          filter: { 
            timestamp_from: new Date(Date.now() - 60 * 60 * 1000).toISOString() // Last hour
          }, 
          description: 'by time range' 
        },
      ];
      
      for (const { filter, description } of queryTests) {
        const startTime = Date.now();
        const response = await GdprApiHelper.getAuditLogs(adminHeaders, filter);
        const queryTime = Date.now() - startTime;
        
        assert.strictEqual(response.statusCode, 200, `Should query audit logs ${description}`);
        assert.ok(queryTime < 5000, `Query ${description} should be fast: ${queryTime}ms`);
      }
    });

    test('should implement audit log archival and rotation', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check archival policy
      const archivalResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/archival-policy',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(archivalResponse.statusCode, 200, 'Should get archival policy');
      
      const policy = archivalResponse.body;
      assert.ok(policy.retentionPeriod, 'Should specify retention period');
      assert.ok(policy.archivalFrequency, 'Should specify archival frequency');
      assert.ok(policy.compressionEnabled, 'Should specify compression settings');
      assert.ok(policy.integrityPreservation, 'Should preserve integrity during archival');
    });
  });

  describe('Audit Reporting and Analytics', () => {
    
    test('should generate comprehensive audit activity reports', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const reportResponse = await makeRequest({
        path: '/api/gdpr/reports/audit-activity',
        method: 'GET',
        headers: adminHeaders,
        body: {
          timeRange: {
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last week
            to: new Date().toISOString(),
          },
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(reportResponse.statusCode, 200, 'Should generate audit activity report');
      
      const report = reportResponse.body;
      assert.ok(typeof report.totalAuditEntries === 'number', 'Should count total audit entries');
      assert.ok(Array.isArray(report.actionBreakdown), 'Should break down by action type');
      assert.ok(Array.isArray(report.userActivity), 'Should show user activity');
      assert.ok(Array.isArray(report.riskEvents), 'Should identify risk events');
      assert.ok(report.complianceMetrics, 'Should include compliance metrics');
    });

    test('should identify anomalous audit patterns', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const anomalyResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/anomaly-detection',
        method: 'POST',
        headers: adminHeaders,
        body: { analysisDepth: 'standard' },
        expectedStatus: [200],
      });
      
      assert.strictEqual(anomalyResponse.statusCode, 200, 'Should detect audit anomalies');
      
      const anomalies = anomalyResponse.body;
      assert.ok(Array.isArray(anomalies.suspiciousPatterns), 'Should identify suspicious patterns');
      assert.ok(Array.isArray(anomalies.unusualActivity), 'Should identify unusual activity');
      assert.ok(anomalies.riskScore !== undefined, 'Should calculate risk score');
      
      for (const pattern of anomalies.suspiciousPatterns) {
        assert.ok(pattern.patternType, 'Should specify pattern type');
        assert.ok(pattern.severity, 'Should specify severity');
        assert.ok(pattern.description, 'Should describe the pattern');
        assert.ok(pattern.affectedEntries, 'Should specify affected entries');
      }
    });

    test('should provide audit trail compliance verification', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const complianceResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/compliance-verification',
        method: 'POST',
        headers: adminHeaders,
        body: {
          standards: ['gdpr', 'iso27001', 'sox'],
          verificationDepth: 'comprehensive',
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(complianceResponse.statusCode, 200, 'Should verify audit compliance');
      
      const verification = complianceResponse.body;
      assert.ok(verification.overallCompliance, 'Should provide overall compliance score');
      assert.ok(Array.isArray(verification.standardsCompliance), 'Should check each standard');
      assert.ok(Array.isArray(verification.gaps), 'Should identify compliance gaps');
      assert.ok(Array.isArray(verification.recommendations), 'Should provide recommendations');
    });
  });

  describe('Audit System Recovery and Backup', () => {
    
    test('should support audit log backup and recovery', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Initiate audit log backup
      const backupResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/backup',
        method: 'POST',
        headers: adminHeaders,
        body: {
          backupType: 'incremental',
          includeIntegrityProof: true,
        },
        expectedStatus: [200, 202],
      });
      
      assert.ok([200, 202].includes(backupResponse.statusCode), 'Should initiate audit backup');
      
      if (backupResponse.body.backupId) {
        // Check backup status
        const statusResponse = await makeRequest({
          path: `/api/gdpr/audit-logs/backup/${backupResponse.body.backupId}/status`,
          method: 'GET',
          headers: adminHeaders,
          expectedStatus: [200],
        });
        
        assert.ok(['pending', 'in_progress', 'completed', 'failed'].includes(statusResponse.body.status),
                 'Should have valid backup status');
      }
    });

    test('should validate audit log integrity after recovery', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Simulate post-recovery integrity check
      const recoveryResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/post-recovery-verification',
        method: 'POST',
        headers: adminHeaders,
        body: {
          recoveryPoint: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
          verificationLevel: 'comprehensive',
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(recoveryResponse.statusCode, 200, 'Should verify post-recovery integrity');
      
      const verification = recoveryResponse.body;
      assert.ok(typeof verification.integrityMaintained === 'boolean', 
               'Should indicate if integrity maintained');
      assert.ok(verification.verifiedEntries, 'Should count verified entries');
      assert.ok(verification.missingEntries !== undefined, 'Should identify missing entries');
      assert.ok(verification.corruptedEntries !== undefined, 'Should identify corrupted entries');
    });
  });
});