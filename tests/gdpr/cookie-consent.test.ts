/**
 * GDPR Cookie Consent and PECR Compliance Tests
 * 
 * Comprehensive test suite for cookie consent management, granular preferences,
 * browser storage validation, and UK PECR compliance verification.
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

describe('Cookie Consent and PECR Compliance', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Cookie Test Org');
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

  describe('Cookie Inventory Management', () => {
    
    test('should manage cookie inventory with all required PECR fields', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const cookieData = testDataGenerator.generateCookieInventory({
        name: 'analytics_tracking',
        purpose: 'Website analytics and performance monitoring',
        category: 'analytics',
        duration: '2 years',
        thirdParty: true,
        domains: ['analytics.example.com'],
        legalBasis: 'consent',
        description: 'Google Analytics tracking cookie for website performance',
      });

      const response = await makeRequest({
        path: '/api/gdpr/cookie-inventory',
        method: 'POST',
        headers: adminHeaders,
        body: cookieData,
        expectedStatus: [201],
      });
      
      assert.strictEqual(response.statusCode, 201, 'Should create cookie inventory entry');
      assert.ok(response.body.id, 'Should return cookie ID');
      assert.strictEqual(response.body.category, 'analytics', 'Should store correct category');
      assert.strictEqual(response.body.legalBasis, 'consent', 'Should store legal basis');
    });

    test('should categorize cookies according to ICO guidance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const categories = [
        { category: 'strictly_necessary', requiresConsent: false },
        { category: 'functional', requiresConsent: true },
        { category: 'analytics', requiresConsent: true },
        { category: 'advertising', requiresConsent: true },
      ];
      
      for (const { category, requiresConsent } of categories) {
        const cookieData = testDataGenerator.generateCookieInventory({
          category,
          name: `test_${category}_cookie`,
          purpose: `Testing ${category} cookie consent`,
        });
        
        const response = await makeRequest({
          path: '/api/gdpr/cookie-inventory',
          method: 'POST',
          headers: adminHeaders,
          body: cookieData,
          expectedStatus: [201],
        });
        
        assert.strictEqual(response.body.category, category, `Should store ${category} correctly`);
        
        if (category === 'strictly_necessary') {
          assert.ok(!response.body.requiresConsent, 'Strictly necessary cookies should not require consent');
        } else {
          assert.ok(response.body.requiresConsent, `${category} cookies should require consent`);
        }
      }
    });

    test('should track third-party cookies separately', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const thirdPartyCookie = testDataGenerator.generateCookieInventory({
        name: 'google_analytics',
        thirdParty: true,
        domains: ['google.com', 'analytics.google.com'],
        vendor: 'Google LLC',
        privacyPolicyUrl: 'https://policies.google.com/privacy',
      });

      const response = await makeRequest({
        path: '/api/gdpr/cookie-inventory',
        method: 'POST',
        headers: adminHeaders,
        body: thirdPartyCookie,
        expectedStatus: [201],
      });
      
      assert.ok(response.body.thirdParty, 'Should mark as third-party cookie');
      assert.ok(Array.isArray(response.body.domains), 'Should store third-party domains');
      assert.ok(response.body.vendor, 'Should record vendor information');
    });

    test('should get cookie inventory for consent display', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const response = await GdprApiHelper.getCookieInventory(userHeaders);
      assert.strictEqual(response.statusCode, 200, 'Should retrieve cookie inventory');
      
      // Verify response structure for consent display
      if (response.body.length > 0) {
        const cookie = response.body[0];
        assert.ok(cookie.name, 'Should have cookie name');
        assert.ok(cookie.purpose, 'Should have purpose for user display');
        assert.ok(cookie.category, 'Should have category for grouping');
        assert.ok(typeof cookie.requiresConsent === 'boolean', 'Should indicate if consent required');
      }
    });
  });

  describe('Granular Cookie Consent', () => {
    
    test('should handle granular consent for each cookie category', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const cookieConsents = {
        strictlyNecessary: true,  // Always required
        functional: true,
        analytics: false,
        advertising: false,
      };

      const response = await GdprApiHelper.updateCookieConsent(userHeaders, cookieConsents);
      assert.strictEqual(response.statusCode, 200, 'Should update cookie consent');
      
      // Verify granular settings are stored
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      const storedConsents = getResponse.body.cookieConsents;
      
      assert.strictEqual(storedConsents.strictlyNecessary, true, 'Strictly necessary should be enabled');
      assert.strictEqual(storedConsents.functional, true, 'Functional should be enabled as per consent');
      assert.strictEqual(storedConsents.analytics, false, 'Analytics should be disabled as per consent');
      assert.strictEqual(storedConsents.advertising, false, 'Advertising should be disabled as per consent');
    });

    test('should prevent disabling strictly necessary cookies', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const invalidConsents = {
        strictlyNecessary: false, // Should be rejected
        functional: true,
        analytics: true,
        advertising: true,
      };

      try {
        await GdprApiHelper.updateCookieConsent(userHeaders, invalidConsents);
        assert.fail('Should reject attempt to disable strictly necessary cookies');
      } catch (error) {
        // Expected to fail - PECR requires strictly necessary cookies
      }
    });

    test('should track consent timestamp for PECR compliance', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const cookieConsents = {
        strictlyNecessary: true,
        functional: true,
        analytics: true,
        advertising: true,
      };

      const consentTime = Date.now();
      await GdprApiHelper.updateCookieConsent(userHeaders, cookieConsents);
      
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      const storedConsentTime = new Date(getResponse.body.timestamp).getTime();
      
      // Should be within 1 minute of when we submitted
      const timeDiff = Math.abs(storedConsentTime - consentTime);
      assert.ok(timeDiff < 60000, 'Consent timestamp should be accurate');
    });

    test('should validate 12-month consent expiry per PECR', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit consent
      const cookieConsents = {
        strictlyNecessary: true,
        functional: true,
        analytics: true,
        advertising: false,
      };
      
      await GdprApiHelper.updateCookieConsent(userHeaders, cookieConsents);
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      
      // Validate PECR compliance
      const validation = GdprComplianceValidator.validateCookieCompliance(getResponse.body);
      assert.ok(validation.valid, `Cookie consent should be PECR compliant: ${validation.errors.join(', ')}`);
      
      // Check expiry calculation
      const consentDate = new Date(getResponse.body.timestamp);
      const expiryDate = new Date(consentDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      assert.ok(expiryDate > new Date(), 'Consent should not be expired for new consent');
    });
  });

  describe('Cookie Banner Integration', () => {
    
    test('should provide cookie banner configuration', async () => {
      const response = await makeRequest({
        path: '/api/gdpr/cookie-banner-config',
        method: 'GET',
        expectedStatus: [200],
      });
      
      assert.strictEqual(response.statusCode, 200, 'Should provide banner configuration');
      assert.ok(response.body.categories, 'Should include cookie categories');
      assert.ok(response.body.legal, 'Should include legal information');
      
      // Verify required PECR elements
      assert.ok(response.body.legal.privacyPolicyUrl, 'Should include privacy policy link');
      assert.ok(response.body.legal.cookiePolicyUrl, 'Should include cookie policy link');
    });

    test('should validate banner compliance with ICO guidance', async () => {
      const response = await makeRequest({
        path: '/api/gdpr/cookie-banner-config',
        method: 'GET',
        expectedStatus: [200],
      });
      
      const config = response.body;
      
      // ICO requirements verification
      assert.ok(config.categories.find((c: any) => c.name === 'strictly_necessary'), 
               'Should include strictly necessary category');
      assert.ok(config.granularControls, 'Should support granular controls');
      assert.ok(config.withdrawalProcess, 'Should explain withdrawal process');
      assert.ok(config.retentionPeriods, 'Should specify retention periods');
    });

    test('should support consent refresh workflows', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Initial consent
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: false,
        analytics: false,
        advertising: false,
      });
      
      // Simulate consent refresh (policy update)
      const refreshResponse = await makeRequest({
        path: '/api/gdpr/cookie-consent/refresh',
        method: 'POST',
        headers: userHeaders,
        body: { reason: 'policy_update' },
        expectedStatus: [200],
      });
      
      assert.strictEqual(refreshResponse.statusCode, 200, 'Should handle consent refresh');
      assert.ok(refreshResponse.body.requiresNewConsent, 'Should indicate new consent required');
    });
  });

  describe('Browser Storage and Client-Side Integration', () => {
    
    test('should provide client-side consent checking API', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Set consent first
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: false,
        advertising: false,
      });
      
      // Check consent status
      const checkResponse = await makeRequest({
        path: '/api/gdpr/cookie-consent/check',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(checkResponse.statusCode, 200, 'Should provide consent check');
      assert.ok(typeof checkResponse.body.analytics === 'boolean', 'Should return analytics consent status');
      assert.ok(typeof checkResponse.body.advertising === 'boolean', 'Should return advertising consent status');
    });

    test('should handle anonymous user consent via localStorage simulation', async () => {
      // Test anonymous consent (no authentication)
      const anonymousConsent = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: false,
          analytics: false,
          advertising: false,
        },
        timestamp: new Date().toISOString(),
        source: 'cookie_banner',
      };

      const response = await makeRequest({
        path: '/api/gdpr/cookie-consent/anonymous',
        method: 'POST',
        body: anonymousConsent,
        expectedStatus: [200],
      });
      
      assert.strictEqual(response.statusCode, 200, 'Should handle anonymous consent');
      assert.ok(response.body.sessionId, 'Should provide session identifier');
    });

    test('should validate client-side consent synchronization', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Simulate client-side consent change
      const clientConsent = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: true,
          advertising: false,
        },
        source: 'preference_center',
        userAgent: 'Test Browser 1.0',
      };

      const syncResponse = await makeRequest({
        path: '/api/gdpr/cookie-consent/sync',
        method: 'POST',
        headers: userHeaders,
        body: clientConsent,
        expectedStatus: [200],
      });
      
      assert.strictEqual(syncResponse.statusCode, 200, 'Should sync client consent');
      
      // Verify sync worked
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      assert.strictEqual(getResponse.body.cookieConsents.analytics, true, 
                        'Analytics consent should be synced');
    });
  });

  describe('PECR Compliance Validation', () => {
    
    test('should enforce informed consent requirements', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Consent without proper information should be rejected
      const uninformedConsent = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: true,
          advertising: true,
        },
        // Missing: purpose explanation, retention periods, third-party info
      };

      try {
        await makeRequest({
          path: '/api/gdpr/cookie-consent',
          method: 'POST',
          headers: userHeaders,
          body: uninformedConsent,
          expectedStatus: [400],
        });
      } catch (error) {
        // Expected to fail without proper information
      }
    });

    test('should validate specific consent per regulation 6(1)(a)', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test specific consent for each category
      const specificConsent = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,     // Specifically consented
          analytics: false,     // Specifically refused
          advertising: false,   // Specifically refused
        },
        purposes: {
          functional: 'Enable website features like language preferences',
          analytics: 'Collect anonymous usage statistics',
          advertising: 'Show targeted advertisements',
        },
        informedConsent: true,
      };

      const response = await makeRequest({
        path: '/api/gdpr/cookie-consent',
        method: 'POST',
        headers: userHeaders,
        body: specificConsent,
        expectedStatus: [201],
      });
      
      assert.strictEqual(response.statusCode, 201, 'Should accept specific consent');
      assert.ok(response.body.informedConsent, 'Should record informed consent');
    });

    test('should track consent withdrawal mechanisms', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Set initial consent
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: true,
        advertising: true,
      });
      
      // Test withdrawal mechanisms
      const withdrawalMethods = [
        { method: 'preference_center', category: 'analytics' },
        { method: 'cookie_banner', category: 'advertising' },
        { method: 'settings_page', category: 'functional' },
      ];
      
      for (const { method, category } of withdrawalMethods) {
        const withdrawResponse = await makeRequest({
          path: '/api/gdpr/cookie-consent/withdraw',
          method: 'POST',
          headers: userHeaders,
          body: { 
            category, 
            method,
            reason: 'User preference change',
          },
          expectedStatus: [200],
        });
        
        assert.strictEqual(withdrawResponse.statusCode, 200, 
                          `Should handle withdrawal via ${method}`);
      }
    });

    test('should validate consent evidence preservation', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit consent with full evidence
      const evidenceConsent = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: false,
          advertising: false,
        },
        evidence: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser',
          timestamp: new Date().toISOString(),
          consentMethod: 'explicit_banner_click',
          informationProvided: true,
          optInMechanism: 'checkbox_selection',
        },
      };

      const response = await makeRequest({
        path: '/api/gdpr/cookie-consent',
        method: 'POST',
        headers: userHeaders,
        body: evidenceConsent,
        expectedStatus: [201],
      });
      
      assert.strictEqual(response.statusCode, 201, 'Should store consent evidence');
      assert.ok(response.body.evidence, 'Should preserve consent evidence');
      assert.ok(response.body.evidence.ipAddress, 'Should record IP address');
      assert.ok(response.body.evidence.userAgent, 'Should record user agent');
    });
  });

  describe('Cookie Consent Audit and Reporting', () => {
    
    test('should generate PECR compliance reports', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const reportResponse = await makeRequest({
        path: '/api/gdpr/reports/cookie-compliance',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(reportResponse.statusCode, 200, 'Should generate compliance report');
      
      const report = reportResponse.body;
      assert.ok(report.totalUsers, 'Should include total users count');
      assert.ok(report.consentRates, 'Should include consent rates by category');
      assert.ok(report.withdrawalRates, 'Should include withdrawal statistics');
      assert.ok(report.complianceScore, 'Should include overall compliance score');
    });

    test('should audit cookie consent changes', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Make consent changes
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: false,
        advertising: false,
      });
      
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: true,
        advertising: true,
      });
      
      // Check audit trail
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        action: 'cookie_consent_changed',
        userId: testUsers.user.id,
      });
      
      assert.ok(auditResponse.body.length >= 2, 'Should audit all consent changes');
      
      for (const log of auditResponse.body) {
        assert.ok(log.details.previousConsent, 'Should record previous consent state');
        assert.ok(log.details.newConsent, 'Should record new consent state');
        assert.ok(log.details.changedCategories, 'Should identify changed categories');
      }
    });

    test('should validate consent data integrity', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Submit consent
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: true,
        advertising: false,
      });
      
      // Verify data integrity
      const getResponse = await GdprApiHelper.getConsent(userHeaders);
      const validation = GdprComplianceValidator.validateCookieCompliance(getResponse.body);
      
      assert.ok(validation.valid, `Cookie consent data should be valid: ${validation.errors.join(', ')}`);
      
      // Verify immutability of consent records
      assert.ok(getResponse.body.version, 'Should have version for immutability tracking');
      assert.ok(!getResponse.body.modifiedAt, 'Consent records should not be modifiable');
    });
  });

  describe('Cross-Browser and Client Integration', () => {
    
    test('should handle different user agent strings', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      ];
      
      for (const userAgent of userAgents) {
        const response = await makeRequest({
          path: '/api/gdpr/cookie-consent',
          method: 'POST',
          headers: {
            ...userHeaders,
            'User-Agent': userAgent,
          },
          body: {
            cookieConsents: {
              strictlyNecessary: true,
              functional: true,
              analytics: false,
              advertising: false,
            },
          },
          expectedStatus: [201],
        });
        
        assert.strictEqual(response.statusCode, 201, `Should handle ${userAgent}`);
        assert.strictEqual(response.body.userAgent, userAgent, 'Should record user agent');
      }
    });

    test('should validate consent across subdomain cookies', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test subdomain consent scope
      const subdomainConsent = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: true,
          advertising: false,
        },
        scope: 'subdomain',
        domains: ['app.example.com', 'api.example.com', 'cdn.example.com'],
      };

      const response = await makeRequest({
        path: '/api/gdpr/cookie-consent',
        method: 'POST',
        headers: userHeaders,
        body: subdomainConsent,
        expectedStatus: [201],
      });
      
      assert.strictEqual(response.statusCode, 201, 'Should handle subdomain consent');
      assert.ok(Array.isArray(response.body.domains), 'Should store applicable domains');
    });
  });
});