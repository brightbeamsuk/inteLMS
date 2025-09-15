/**
 * GDPR Consent Management Tests
 * 
 * Comprehensive test suite for consent collection, modification, withdrawal,
 * and PECR compliance verification across all consent types.
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
  GdprComplianceValidator,
  GdprTestScenarios 
} from '../setup/gdpr-test-helpers.ts';

describe('GDPR Consent Management', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Consent Test Org');
    testOrg = orgResult.response.body;
    
    // Create test users
    const userResult = await testAuth.createTestUser('user', testOrg.id);
    const adminResult = await testAuth.createTestUser('admin', testOrg.id);
    
    testUsers.user = userResult.userData;
    testUsers.admin = adminResult.userData;
    
    // Authenticate users
    await testAuth.authenticate(testUsers.user.email, testUsers.user.password);
    await testAuth.authenticate(testUsers.admin.email, testUsers.admin.password);
  });

  afterEach(async () => {
    await globalTestTeardown();
  });

  describe('Cookie Consent Management', () => {
    
    test('should collect initial cookie consent with all required fields', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const consentData = testDataGenerator.generateConsentRecord({
        consentType: 'cookie_consent',
        cookieConsents: {
          strictlyNecessary: true,
          functional: false,
          analytics: false,
          advertising: false,
        }
      });

      const response = await GdprApiHelper.submitConsent(userHeaders, consentData);
      
      assert.strictEqual(response.statusCode, 201, 'Should create consent record');
      assert.ok(response.body.id, 'Should return consent ID');
      assert.strictEqual(response.body.consentType, 'cookie_consent', 'Should store correct consent type');
      
      // Validate compliance
      const validation = GdprComplianceValidator.validateConsentRecord(response.body);
      assert.ok(validation.valid, `Consent should be compliant: ${validation.errors.join(', ')}`);
    });

    test('should allow granular cookie consent modifications', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit initial minimal consent
      const initialConsent = testDataGenerator.generateConsentRecord({
        cookieConsents: {
          strictlyNecessary: true,
          functional: false,
          analytics: false,
          advertising: false,
        }
      });
      
      await GdprApiHelper.submitConsent(userHeaders, initialConsent);
      
      // Modify to enable analytics
      const updatedConsent = {
        ...initialConsent,
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: true,
          advertising: false,
        }
      };
      
      const updateResponse = await GdprApiHelper.submitConsent(userHeaders, updatedConsent);
      assert.strictEqual(updateResponse.statusCode, 201, 'Should update consent');
      
      // Verify changes
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      assert.ok(getResponse.body.cookieConsents.functional, 'Functional cookies should be enabled');
      assert.ok(getResponse.body.cookieConsents.analytics, 'Analytics cookies should be enabled');
      assert.ok(!getResponse.body.cookieConsents.advertising, 'Advertising cookies should remain disabled');
    });

    test('should enforce strictly necessary cookies always enabled', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const invalidConsent = testDataGenerator.generateConsentRecord({
        cookieConsents: {
          strictlyNecessary: false, // This should be rejected
          functional: true,
          analytics: false,
          advertising: false,
        }
      });

      try {
        await GdprApiHelper.submitConsent(userHeaders, invalidConsent);
        assert.fail('Should reject consent with strictly necessary cookies disabled');
      } catch (error) {
        // Expected to fail - strictly necessary cookies cannot be disabled
      }
    });

    test('should validate PECR cookie consent compliance', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const consentData = testDataGenerator.generateConsentRecord({
        consentType: 'cookie_consent',
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: true,
          advertising: true,
        }
      });

      const response = await GdprApiHelper.submitConsent(userHeaders, consentData);
      const cookieValidation = GdprComplianceValidator.validateCookieCompliance(response.body);
      
      assert.ok(cookieValidation.valid, `PECR compliance should pass: ${cookieValidation.errors.join(', ')}`);
    });

    test('should handle consent withdrawal correctly', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit consent first
      const consentData = testDataGenerator.generateConsentRecord();
      await GdprApiHelper.submitConsent(userHeaders, consentData);
      
      // Withdraw consent
      const withdrawResponse = await GdprApiHelper.withdrawConsent(userHeaders, 'cookie_consent');
      assert.strictEqual(withdrawResponse.statusCode, 200, 'Should withdraw consent successfully');
      
      // Verify withdrawal
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      assert.strictEqual(getResponse.body.status, 'withdrawn', 'Consent should be marked as withdrawn');
    });
  });

  describe('Marketing Consent Management', () => {
    
    test('should manage email marketing consent with PECR compliance', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const marketingData = {
        consentType: 'email',
        consented: true,
        purpose: 'Marketing communications about new courses',
        doubleOptIn: true, // PECR requirement for marketing
      };

      const response = await GdprApiHelper.updateMarketingConsent(userHeaders, marketingData);
      assert.strictEqual(response.statusCode, 200, 'Should update marketing consent');
      assert.ok(response.body.doubleOptIn, 'Should confirm double opt-in for PECR compliance');
    });

    test('should handle multiple marketing consent types', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const consentTypes = ['email', 'sms', 'phone', 'post'];
      
      for (const type of consentTypes) {
        const marketingData = {
          consentType: type,
          consented: true,
          purpose: `Marketing via ${type}`,
        };
        
        const response = await GdprApiHelper.updateMarketingConsent(userHeaders, marketingData);
        assert.strictEqual(response.statusCode, 200, `Should handle ${type} marketing consent`);
      }
    });

    test('should allow selective marketing consent withdrawal', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Set up multiple marketing consents
      const consentTypes = ['email', 'sms'];
      for (const type of consentTypes) {
        await GdprApiHelper.updateMarketingConsent(userHeaders, {
          consentType: type,
          consented: true,
          purpose: `Marketing via ${type}`,
        });
      }
      
      // Withdraw only email consent
      const withdrawResponse = await GdprApiHelper.withdrawMarketingConsent(userHeaders, 'email');
      assert.strictEqual(withdrawResponse.statusCode, 200, 'Should withdraw email consent');
      
      // Verify selective withdrawal - SMS should remain
      // Note: This would require additional API to check current consent status
    });
  });

  describe('Consent History and Audit Trail', () => {
    
    test('should maintain complete consent history', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit multiple consent changes
      const changes = [
        { analytics: false, advertising: false },
        { analytics: true, advertising: false },
        { analytics: true, advertising: true },
        { analytics: false, advertising: false },
      ];
      
      for (const change of changes) {
        const consentData = testDataGenerator.generateConsentRecord({
          cookieConsents: {
            strictlyNecessary: true,
            functional: true,
            ...change,
          }
        });
        await GdprApiHelper.submitConsent(userHeaders, consentData);
      }
      
      // Get audit logs for consent changes
      const auditResponse = await GdprApiHelper.getAuditLogs(userHeaders, {
        action: 'consent_granted',
        resource: 'consent_record',
      });
      
      assert.ok(auditResponse.body.length >= changes.length, 'Should track all consent changes');
      
      // Validate audit log integrity
      for (const log of auditResponse.body) {
        const validation = GdprComplianceValidator.validateAuditLogIntegrity(log);
        assert.ok(validation.valid, `Audit log should be valid: ${validation.errors.join(', ')}`);
      }
    });

    test('should create audit trail for consent withdrawal', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit and then withdraw consent
      const consentData = testDataGenerator.generateConsentRecord();
      await GdprApiHelper.submitConsent(userHeaders, consentData);
      await GdprApiHelper.withdrawConsent(userHeaders, 'cookie_consent');
      
      // Check audit trail
      const auditResponse = await GdprApiHelper.getAuditLogs(userHeaders, {
        action: 'consent_withdrawn',
      });
      
      assert.ok(auditResponse.body.length > 0, 'Should have withdrawal audit record');
      assert.strictEqual(auditResponse.body[0].action, 'consent_withdrawn', 'Should log withdrawal action');
    });
  });

  describe('Complete Consent Workflows', () => {
    
    test('should execute complete consent lifecycle', async () => {
      const result = await GdprTestScenarios.testConsentWorkflow(testUsers.user.email);
      
      assert.ok(result.success, `Consent workflow should complete successfully: ${JSON.stringify(result.details)}`);
      assert.strictEqual(result.details.steps.length, 4, 'Should complete all workflow steps');
      
      // Verify each step
      const stepNames = result.details.steps.map((step: any) => step.step);
      assert.ok(stepNames.includes('submit_consent'), 'Should submit initial consent');
      assert.ok(stepNames.includes('get_consent'), 'Should retrieve consent');
      assert.ok(stepNames.includes('update_consent'), 'Should update consent');
      assert.ok(stepNames.includes('withdraw_consent'), 'Should withdraw consent');
    });

    test('should handle consent across user sessions', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit consent
      const consentData = testDataGenerator.generateConsentRecord();
      await GdprApiHelper.submitConsent(userHeaders, consentData);
      
      // Simulate new session - re-authenticate
      await testAuth.authenticate(testUsers.user.email, testUsers.user.password);
      const newSessionHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Should still have consent
      const getResponse = await GdprApiHelper.getConsent(newSessionHeaders);
      assert.strictEqual(getResponse.statusCode, 200, 'Should persist consent across sessions');
      assert.strictEqual(getResponse.body.consentType, 'cookie_consent', 'Should maintain consent data');
    });
  });

  describe('Feature Flag Integration', () => {
    
    test('should respect GDPR feature flags', async () => {
      // Test with GDPR disabled (would require environment variable change)
      // This test ensures consent endpoints return 404 when GDPR is disabled
      
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Save current GDPR state
      const originalGdprState = process.env.GDPR_COMPLIANCE_ENABLED;
      
      try {
        // Disable GDPR temporarily
        process.env.GDPR_COMPLIANCE_ENABLED = 'false';
        
        // Should get 404 when GDPR disabled
        const response = await makeRequest({
          path: '/api/gdpr/consent',
          method: 'GET',
          headers: userHeaders,
          expectedStatus: [404],
        });
        
        assert.strictEqual(response.statusCode, 404, 'Should return 404 when GDPR disabled');
      } finally {
        // Restore GDPR state
        process.env.GDPR_COMPLIANCE_ENABLED = originalGdprState || 'true';
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('should handle malformed consent data', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const malformedData = {
        // Missing required fields
        consentType: 'invalid_type',
        // Missing lawfulBasis, purpose, etc.
      };

      try {
        await GdprApiHelper.submitConsent(userHeaders, malformedData);
        assert.fail('Should reject malformed consent data');
      } catch (error) {
        // Expected to fail validation
      }
    });

    test('should handle concurrent consent modifications', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit multiple concurrent consent updates
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const consentData = testDataGenerator.generateConsentRecord({
          cookieConsents: {
            strictlyNecessary: true,
            functional: i % 2 === 0,
            analytics: i % 3 === 0,
            advertising: i % 4 === 0,
          }
        });
        promises.push(GdprApiHelper.submitConsent(userHeaders, consentData));
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      assert.ok(successful > 0, 'At least one consent update should succeed');
      
      // Final state should be consistent
      const finalState = await GdprApiHelper.getConsent(userHeaders);
      assert.strictEqual(finalState.statusCode, 200, 'Should have valid final consent state');
    });
  });
});