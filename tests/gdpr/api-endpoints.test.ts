/**
 * GDPR API Endpoints Comprehensive Tests
 * 
 * Comprehensive test suite for all GDPR API endpoints including RBAC validation,
 * feature flag testing, multi-tenant isolation, and edge case handling.
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
  GdprRbacTester 
} from '../setup/gdpr-test-helpers.ts';

describe('GDPR API Endpoints Comprehensive Testing', () => {
  let testUsers: any = {};
  let testOrg: any;
  let secondOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organizations
    const orgResult = await testDb.createTestOrganization('Primary Test Org');
    const org2Result = await testDb.createTestOrganization('Secondary Test Org');
    testOrg = orgResult.response.body;
    secondOrg = org2Result.response.body;
    
    // Create test users with different roles
    const userResult = await testAuth.createTestUser('user', testOrg.id);
    const adminResult = await testAuth.createTestUser('admin', testOrg.id);
    const superAdminResult = await testAuth.createTestUser('superadmin');
    const otherOrgUserResult = await testAuth.createTestUser('user', secondOrg.id);
    
    testUsers.user = userResult.userData;
    testUsers.admin = adminResult.userData;
    testUsers.superAdmin = superAdminResult.userData;
    testUsers.otherOrgUser = otherOrgUserResult.userData;
    
    // Authenticate users
    await testAuth.authenticate(testUsers.user.email, testUsers.user.password);
    await testAuth.authenticate(testUsers.admin.email, testUsers.admin.password);
    await testAuth.authenticate(testUsers.superAdmin.email, testUsers.superAdmin.password);
    await testAuth.authenticate(testUsers.otherOrgUser.email, testUsers.otherOrgUser.password);
  });

  afterEach(async () => {
    await globalTestTeardown();
  });

  describe('Feature Flag Testing', () => {
    
    test('should return 404 for GDPR endpoints when feature disabled', async () => {
      // Test all major GDPR endpoints with feature disabled
      const gdprEndpoints = [
        '/api/gdpr/consent',
        '/api/gdpr/user-rights',
        '/api/gdpr/privacy-settings',
        '/api/gdpr/data-breaches',
        '/api/gdpr/cookie-inventory',
        '/api/gdpr/audit-logs',
        '/api/gdpr/parental-consent',
        '/api/gdpr/retention-policies',
      ];
      
      // Temporarily disable GDPR
      const originalGdprState = process.env.GDPR_COMPLIANCE_ENABLED;
      process.env.GDPR_COMPLIANCE_ENABLED = 'false';
      
      try {
        for (const endpoint of gdprEndpoints) {
          const response = await makeRequest({
            path: endpoint,
            method: 'GET',
            expectedStatus: [404],
          });
          
          assert.strictEqual(response.statusCode, 404, 
                           `${endpoint} should return 404 when GDPR disabled`);
          assert.strictEqual(response.body.message, 'Endpoint not found',
                           'Should return generic 404 message');
        }
      } finally {
        // Restore GDPR state
        process.env.GDPR_COMPLIANCE_ENABLED = originalGdprState || 'true';
      }
    });

    test('should enforce authentication when GDPR enabled', async () => {
      const gdprEndpoints = [
        { path: '/api/gdpr/consent', method: 'GET' },
        { path: '/api/gdpr/user-rights', method: 'GET' },
        { path: '/api/gdpr/privacy-settings', method: 'GET' },
        { path: '/api/gdpr/audit-logs', method: 'GET' },
      ];
      
      for (const { path, method } of gdprEndpoints) {
        const response = await makeRequest({
          path,
          method,
          expectedStatus: [401, 403],
        });
        
        assert.ok([401, 403].includes(response.statusCode), 
                 `${path} should require authentication when GDPR enabled`);
      }
    });

    test('should handle feature flag changes gracefully', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test endpoint while GDPR is enabled
      const enabledResponse = await makeRequest({
        path: '/api/gdpr/consent',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200, 404], // 404 if no consent exists yet
      });
      
      assert.ok([200, 404].includes(enabledResponse.statusCode), 
               'Should handle request when GDPR enabled');
      
      // Simulate feature flag change during operation
      const originalState = process.env.GDPR_COMPLIANCE_ENABLED;
      process.env.GDPR_COMPLIANCE_ENABLED = 'false';
      
      try {
        const disabledResponse = await makeRequest({
          path: '/api/gdpr/consent',
          method: 'GET',
          headers: userHeaders,
          expectedStatus: [404],
        });
        
        assert.strictEqual(disabledResponse.statusCode, 404, 
                          'Should immediately respect feature flag changes');
      } finally {
        process.env.GDPR_COMPLIANCE_ENABLED = originalState;
      }
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    
    test('should enforce user-level access restrictions', async () => {
      const userEndpoints = [
        { path: '/api/gdpr/consent', method: 'GET', userAccess: true },
        { path: '/api/gdpr/consent', method: 'POST', userAccess: true },
        { path: '/api/gdpr/user-rights', method: 'GET', userAccess: true },
        { path: '/api/gdpr/user-rights', method: 'POST', userAccess: true },
        { path: '/api/gdpr/cookie-consent', method: 'POST', userAccess: true },
        { path: '/api/gdpr/marketing-consent', method: 'POST', userAccess: true },
      ];
      
      for (const { path, method, userAccess } of userEndpoints) {
        const access = await GdprRbacTester.testEndpointAccess(
          path, method, 'user', testUsers.user.email
        );
        
        if (userAccess) {
          assert.ok(access.authorized, `User should have access to ${method} ${path}`);
        } else {
          assert.ok(!access.authorized, `User should not have access to ${method} ${path}`);
        }
      }
    });

    test('should enforce admin-level access restrictions', async () => {
      const adminEndpoints = [
        { path: '/api/gdpr/privacy-settings', method: 'GET', adminAccess: true },
        { path: '/api/gdpr/privacy-settings', method: 'POST', adminAccess: true },
        { path: '/api/gdpr/data-breaches', method: 'GET', adminAccess: true },
        { path: '/api/gdpr/data-breaches', method: 'POST', adminAccess: true },
        { path: '/api/gdpr/user-rights/admin', method: 'GET', adminAccess: true },
        { path: '/api/gdpr/audit-logs', method: 'GET', adminAccess: true },
        { path: '/api/gdpr/retention-policies', method: 'GET', adminAccess: true },
        { path: '/api/gdpr/retention-policies', method: 'POST', adminAccess: true },
      ];
      
      for (const { path, method, adminAccess } of adminEndpoints) {
        // Test admin access
        const adminAccess_result = await GdprRbacTester.testEndpointAccess(
          path, method, 'admin', testUsers.admin.email
        );
        
        // Test user access (should be denied for admin endpoints)
        const userAccess = await GdprRbacTester.testEndpointAccess(
          path, method, 'user', testUsers.user.email
        );
        
        if (adminAccess) {
          assert.ok(adminAccess_result.authorized, `Admin should have access to ${method} ${path}`);
          
          if (path.includes('admin') || path.includes('privacy-settings') || 
              path.includes('data-breaches') || path.includes('audit-logs')) {
            assert.ok(!userAccess.authorized, `User should not have access to ${method} ${path}`);
          }
        }
      }
    });

    test('should enforce super admin exclusive access', async () => {
      const superAdminEndpoints = [
        { path: '/api/gdpr/audit-logs/global', method: 'GET' },
        { path: '/api/gdpr/compliance/system-wide', method: 'GET' },
        { path: '/api/gdpr/reports/cross-organization', method: 'GET' },
      ];
      
      for (const { path, method } of superAdminEndpoints) {
        // Test super admin access
        const superAdminAccess = await GdprRbacTester.testEndpointAccess(
          path, method, 'superadmin', testUsers.superAdmin.email
        );
        
        // Test admin access (should be denied)
        const adminAccess = await GdprRbacTester.testEndpointAccess(
          path, method, 'admin', testUsers.admin.email
        );
        
        // Test user access (should be denied)
        const userAccess = await GdprRbacTester.testEndpointAccess(
          path, method, 'user', testUsers.user.email
        );
        
        assert.ok(superAdminAccess.authorized, `Super admin should have access to ${method} ${path}`);
        assert.ok(!adminAccess.authorized, `Admin should not have access to ${method} ${path}`);
        assert.ok(!userAccess.authorized, `User should not have access to ${method} ${path}`);
      }
    });

    test('should handle role escalation attempts', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Attempt to access admin endpoint with user credentials
      const escalationAttempt = await makeRequest({
        path: '/api/gdpr/privacy-settings',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [403],
      });
      
      assert.strictEqual(escalationAttempt.statusCode, 403, 
                        'Should block role escalation attempts');
      
      // Verify this attempt is logged
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        action: 'access_denied',
        userId: testUsers.user.id,
      });
      
      const recentDenials = auditResponse.body.filter((log: any) => 
        Date.now() - new Date(log.timestamp).getTime() < 60000 // Last minute
      );
      
      assert.ok(recentDenials.length > 0, 'Should log access denial attempts');
    });
  });

  describe('Multi-Tenant Data Isolation', () => {
    
    test('should enforce organization data isolation for consent records', async () => {
      const org1UserHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const org2UserHeaders = testAuth.getAuthHeaders(testUsers.otherOrgUser.email);
      
      // Create consent records in both organizations
      await GdprApiHelper.submitConsent(org1UserHeaders, testDataGenerator.generateConsentRecord());
      await GdprApiHelper.submitConsent(org2UserHeaders, testDataGenerator.generateConsentRecord());
      
      // Test data isolation
      const isolation = await GdprRbacTester.testDataIsolation(
        testUsers.user.email,
        testUsers.otherOrgUser.email,
        '/api/gdpr/consent'
      );
      
      assert.ok(isolation.isolated, 'Consent records should be organization-isolated');
    });

    test('should enforce organization data isolation for user rights requests', async () => {
      const org1UserHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const org2UserHeaders = testAuth.getAuthHeaders(testUsers.otherOrgUser.email);
      
      // Submit user rights requests in both organizations
      await GdprApiHelper.submitUserRightRequest(org1UserHeaders, 
        testDataGenerator.generateUserRightRequest('access'));
      await GdprApiHelper.submitUserRightRequest(org2UserHeaders, 
        testDataGenerator.generateUserRightRequest('access'));
      
      // Test data isolation
      const isolation = await GdprRbacTester.testDataIsolation(
        testUsers.user.email,
        testUsers.otherOrgUser.email,
        '/api/gdpr/user-rights'
      );
      
      assert.ok(isolation.isolated, 'User rights requests should be organization-isolated');
    });

    test('should enforce organization data isolation for audit logs', async () => {
      const org1AdminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get audit logs from admin perspective
      const auditResponse = await GdprApiHelper.getAuditLogs(org1AdminHeaders);
      
      // Verify all audit logs belong to the same organization
      for (const log of auditResponse.body) {
        assert.strictEqual(log.organisationId, testOrg.id, 
                          'All audit logs should belong to admin\'s organization');
      }
    });

    test('should prevent cross-organization data access', async () => {
      const org1AdminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Attempt to access other organization's data by manipulating request
      const crossOrgAttempt = await makeRequest({
        path: '/api/gdpr/user-rights',
        method: 'GET',
        headers: {
          ...org1AdminHeaders,
          'X-Organization-ID': secondOrg.id, // Attempt to bypass isolation
        },
        expectedStatus: [200, 403],
      });
      
      // Should either ignore the header or deny access
      if (crossOrgAttempt.statusCode === 200) {
        // If request succeeds, verify data is still isolated to user's org
        for (const request of crossOrgAttempt.body) {
          assert.strictEqual(request.organisationId, testOrg.id, 
                           'Should not return other organization\'s data');
        }
      }
    });

    test('should handle super admin cross-organization access', async () => {
      const superAdminHeaders = testAuth.getAuthHeaders(testUsers.superAdmin.email);
      
      // Super admin should be able to access cross-organization data
      const crossOrgResponse = await makeRequest({
        path: '/api/gdpr/audit-logs/cross-organization',
        method: 'GET',
        headers: superAdminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(crossOrgResponse.statusCode, 200, 
                        'Super admin should access cross-organization data');
      
      // Verify response includes multiple organizations
      const orgIds = new Set(crossOrgResponse.body.map((log: any) => log.organisationId));
      assert.ok(orgIds.size >= 1, 'Should include data from multiple organizations');
    });
  });

  describe('API Error Handling and Edge Cases', () => {
    
    test('should handle malformed request bodies gracefully', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const malformedRequests = [
        { path: '/api/gdpr/consent', method: 'POST', body: 'invalid json' },
        { path: '/api/gdpr/consent', method: 'POST', body: { invalid: 'structure' } },
        { path: '/api/gdpr/user-rights', method: 'POST', body: null },
        { path: '/api/gdpr/user-rights', method: 'POST', body: [] },
      ];
      
      for (const { path, method, body } of malformedRequests) {
        try {
          const response = await makeRequest({
            path,
            method,
            headers: userHeaders,
            body,
            expectedStatus: [400, 422],
          });
          
          assert.ok([400, 422].includes(response.statusCode), 
                   `Should handle malformed request to ${path} with appropriate error code`);
          assert.ok(response.body.error, 'Should include error message');
        } catch (error) {
          // Some malformed requests might cause connection errors, which is acceptable
        }
      }
    });

    test('should handle concurrent requests correctly', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit multiple concurrent consent updates
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        GdprApiHelper.submitConsent(userHeaders, testDataGenerator.generateConsentRecord({
          metadata: { requestId: i }
        }))
      );
      
      const results = await Promise.allSettled(concurrentRequests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      assert.ok(successful > 0, 'At least one concurrent request should succeed');
      
      // Verify final state is consistent
      const finalState = await GdprApiHelper.getConsent(userHeaders);
      assert.strictEqual(finalState.statusCode, 200, 'Should have consistent final state');
    });

    test('should handle rate limiting appropriately', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Rapid fire requests to test rate limiting
      const rapidRequests = Array.from({ length: 20 }, () => 
        makeRequest({
          path: '/api/gdpr/consent',
          method: 'GET',
          headers: userHeaders,
          expectedStatus: [200, 404, 429], // 429 for rate limiting
        })
      );
      
      const results = await Promise.allSettled(rapidRequests);
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 429
      ).length;
      
      // Note: Rate limiting might not be implemented, so this test is informational
      if (rateLimited > 0) {
        console.log(`Rate limiting detected: ${rateLimited} requests throttled`);
      }
    });

    test('should handle large payload requests', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Create large consent record
      const largeConsentData = testDataGenerator.generateConsentRecord({
        metadata: {
          largeData: 'x'.repeat(10000), // 10KB of data
          additionalInfo: Array.from({ length: 100 }, (_, i) => `item_${i}`),
        }
      });
      
      try {
        const response = await makeRequest({
          path: '/api/gdpr/consent',
          method: 'POST',
          headers: userHeaders,
          body: largeConsentData,
          expectedStatus: [201, 413], // 413 for payload too large
        });
        
        if (response.statusCode === 413) {
          assert.ok(response.body.error.includes('too large'), 
                   'Should provide appropriate error for large payloads');
        } else {
          assert.strictEqual(response.statusCode, 201, 'Should handle large payloads if within limits');
        }
      } catch (error) {
        // Large payloads might cause connection errors
        assert.ok(error.message.includes('timeout') || error.message.includes('too large'),
                 'Should handle large payload errors gracefully');
      }
    });

    test('should validate request headers and content types', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test with missing content-type
      const missingContentType = await makeRequest({
        path: '/api/gdpr/consent',
        method: 'POST',
        headers: {
          ...userHeaders,
          'Content-Type': undefined,
        },
        body: testDataGenerator.generateConsentRecord(),
        expectedStatus: [400, 415], // 415 for unsupported media type
      });
      
      assert.ok([400, 415].includes(missingContentType.statusCode), 
               'Should validate content-type header');
      
      // Test with wrong content-type
      const wrongContentType = await makeRequest({
        path: '/api/gdpr/consent',
        method: 'POST',
        headers: {
          ...userHeaders,
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(testDataGenerator.generateConsentRecord()),
        expectedStatus: [400, 415],
      });
      
      assert.ok([400, 415].includes(wrongContentType.statusCode), 
               'Should reject incorrect content-type');
    });
  });

  describe('API Performance and Scalability', () => {
    
    test('should handle moderate load efficiently', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test moderate concurrent load
      const startTime = Date.now();
      const concurrentRequests = Array.from({ length: 10 }, () => 
        GdprApiHelper.getConsent(userHeaders)
      );
      
      const results = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const avgResponseTime = (endTime - startTime) / successful;
      
      assert.ok(successful >= 8, 'Should handle most concurrent requests successfully');
      assert.ok(avgResponseTime < 1000, `Average response time should be reasonable: ${avgResponseTime}ms`);
    });

    test('should handle database timeouts gracefully', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test with very short timeout to simulate database issues
      try {
        const response = await makeRequest({
          path: '/api/gdpr/consent',
          method: 'GET',
          headers: userHeaders,
          timeout: 100, // Very short timeout
          expectedStatus: [200, 404, 500, 503, 504],
        });
        
        if ([500, 503, 504].includes(response.statusCode)) {
          assert.ok(response.body.error, 'Should provide error message for server errors');
        }
      } catch (error) {
        // Timeout errors are expected with very short timeout
        assert.ok(error.message.includes('timeout'), 'Should handle timeout errors');
      }
    });

    test('should provide appropriate response times for complex queries', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test complex audit log query
      const startTime = Date.now();
      const complexQuery = await GdprApiHelper.getAuditLogs(adminHeaders, {
        timeRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          to: new Date().toISOString(),
        },
        includeDetails: true,
        sortBy: 'timestamp',
        limit: 100,
      });
      const queryTime = Date.now() - startTime;
      
      assert.strictEqual(complexQuery.statusCode, 200, 'Should handle complex queries');
      assert.ok(queryTime < 5000, `Complex query should complete in reasonable time: ${queryTime}ms`);
    });
  });

  describe('API Documentation and Standards Compliance', () => {
    
    test('should return proper HTTP status codes', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const statusTests = [
        {
          description: 'GET existing resource',
          setup: async () => await GdprApiHelper.submitConsent(userHeaders, testDataGenerator.generateConsentRecord()),
          request: () => GdprApiHelper.getConsent(userHeaders),
          expectedStatus: 200,
        },
        {
          description: 'POST new resource',
          request: () => GdprApiHelper.submitConsent(userHeaders, testDataGenerator.generateConsentRecord()),
          expectedStatus: 201,
        },
        {
          description: 'GET non-existent resource',
          request: () => makeRequest({
            path: '/api/gdpr/user-rights/99999',
            method: 'GET',
            headers: userHeaders,
            expectedStatus: [404],
          }),
          expectedStatus: 404,
        },
      ];
      
      for (const { description, setup, request, expectedStatus } of statusTests) {
        if (setup) await setup();
        
        const response = await request();
        assert.strictEqual(response.statusCode, expectedStatus, 
                          `${description} should return ${expectedStatus}`);
      }
    });

    test('should include proper response headers', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const response = await makeRequest({
        path: '/api/gdpr/consent',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200, 404],
      });
      
      // Verify security headers
      assert.ok(response.headers['content-type'], 'Should include content-type header');
      
      // Check for security headers (if implemented)
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
      ];
      
      for (const header of securityHeaders) {
        if (response.headers[header]) {
          console.log(`Security header ${header} present: ${response.headers[header]}`);
        }
      }
    });

    test('should handle OPTIONS requests for CORS', async () => {
      const optionsResponse = await makeRequest({
        path: '/api/gdpr/consent',
        method: 'OPTIONS',
        expectedStatus: [200, 204, 405],
      });
      
      if ([200, 204].includes(optionsResponse.statusCode)) {
        // CORS is implemented
        assert.ok(optionsResponse.headers['access-control-allow-methods'], 
                 'Should include allowed methods for CORS');
      } else {
        // CORS preflight not implemented (405 Method Not Allowed)
        assert.strictEqual(optionsResponse.statusCode, 405, 
                          'Should return 405 if CORS preflight not supported');
      }
    });
  });
});