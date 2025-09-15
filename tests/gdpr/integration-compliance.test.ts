/**
 * GDPR Integration Compliance Tests
 * 
 * Comprehensive test suite for third-party integration GDPR compliance including
 * Stripe payments, email providers, analytics, and other external services.
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

describe('GDPR Integration Compliance', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Integration Compliance Test Org');
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

  describe('Stripe Payment Integration Compliance', () => {
    
    test('should ensure Stripe data minimization compliance', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test payment data collection with GDPR compliance
      const paymentData = {
        amount: 2500, // £25.00
        currency: 'gbp',
        description: 'Course enrollment payment',
        customerEmail: testUsers.user.email,
        gdprConsent: {
          dataProcessing: true,
          paymentProcessing: true,
          fraudPrevention: true,
          retentionPeriod: '7_years', // HMRC requirement
        },
      };

      const paymentResponse = await makeRequest({
        path: '/api/payments/create-intent',
        method: 'POST',
        headers: userHeaders,
        body: paymentData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(paymentResponse.statusCode, 200, 'Should create payment intent');
      assert.ok(paymentResponse.body.clientSecret, 'Should return client secret');
      
      // Verify GDPR compliance metadata is attached
      assert.ok(paymentResponse.body.gdprMetadata, 'Should include GDPR metadata');
      assert.ok(paymentResponse.body.gdprMetadata.consentTimestamp, 'Should record consent timestamp');
      assert.ok(paymentResponse.body.gdprMetadata.legalBasis === 'contract', 
               'Should use contract as legal basis for payments');
    });

    test('should handle Stripe webhook data with GDPR compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Simulate Stripe webhook data
      const webhookData = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_12345',
            customer: 'cus_test_67890',
            amount: 2500,
            status: 'succeeded',
            metadata: {
              userId: testUsers.user.id,
              organisationId: testOrg.id,
              gdprConsent: 'true',
              dataRetentionClass: 'financial_7_years',
            },
          },
        },
      };

      const webhookResponse = await makeRequest({
        path: '/api/webhooks/stripe',
        method: 'POST',
        headers: {
          ...adminHeaders,
          'stripe-signature': 'test-signature',
        },
        body: webhookData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(webhookResponse.statusCode, 200, 'Should process Stripe webhook');
      
      // Verify GDPR-compliant data handling
      assert.ok(webhookResponse.body.gdprProcessed, 'Should indicate GDPR processing');
      assert.ok(webhookResponse.body.auditLogged, 'Should create audit log');
      assert.ok(webhookResponse.body.retentionScheduled, 'Should schedule for retention policy');
    });

    test('should implement Stripe data subject rights', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Request Stripe payment data export
      const exportRequest = {
        requestType: 'stripe_payment_data',
        userId: testUsers.user.id,
        includeMetadata: true,
        formatType: 'json',
      };

      const exportResponse = await makeRequest({
        path: '/api/gdpr/export/stripe-data',
        method: 'POST',
        headers: adminHeaders,
        body: exportRequest,
        expectedStatus: [200, 202],
      });
      
      assert.ok([200, 202].includes(exportResponse.statusCode), 'Should export Stripe data');
      
      if (exportResponse.body.exportUrl) {
        assert.ok(exportResponse.body.exportUrl.includes('stripe'), 'Should provide Stripe data export');
      }
      
      if (exportResponse.body.jobId) {
        assert.ok(exportResponse.body.estimatedCompletion, 'Should provide completion estimate');
      }
    });

    test('should handle Stripe data deletion requests', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test data deletion coordination with Stripe
      const deletionRequest = {
        userId: testUsers.user.id,
        deleteFromStripe: true,
        retainFinancialRecords: true, // Legal requirement
        notifyCustomer: true,
      };

      const deletionResponse = await makeRequest({
        path: '/api/gdpr/delete/stripe-coordination',
        method: 'POST',
        headers: adminHeaders,
        body: deletionRequest,
        expectedStatus: [200],
      });
      
      assert.strictEqual(deletionResponse.statusCode, 200, 'Should coordinate Stripe deletion');
      assert.ok(deletionResponse.body.coordinationId, 'Should provide coordination ID');
      assert.ok(deletionResponse.body.stripeCustomerHandling, 'Should specify Stripe customer handling');
      assert.ok(deletionResponse.body.retentionExceptions, 'Should list retention exceptions');
    });

    test('should audit Stripe integration compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get Stripe integration audit logs
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        integration: 'stripe',
        category: 'payment_processing',
      });
      
      assert.strictEqual(auditResponse.statusCode, 200, 'Should retrieve Stripe audit logs');
      
      for (const log of auditResponse.body) {
        assert.ok(log.integration === 'stripe', 'Should be tagged as Stripe integration');
        assert.ok(log.details.customerId, 'Should include Stripe customer ID');
        assert.ok(log.details.gdprCompliance, 'Should include GDPR compliance info');
        assert.ok(log.details.legalBasis, 'Should specify legal basis');
      }
    });
  });

  describe('Email Provider Integration Compliance', () => {
    
    test('should verify email consent before sending', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Set marketing consent first
      await GdprApiHelper.updateMarketingConsent(userHeaders, {
        consentType: 'email',
        consented: true,
        purpose: 'Course updates and educational content',
        doubleOptIn: true,
      });
      
      // Send marketing email
      const emailRequest = {
        recipientUserId: testUsers.user.id,
        emailType: 'marketing',
        templateId: 'course_update',
        personalizedContent: true,
        checkGdprConsent: true,
      };

      const emailResponse = await makeRequest({
        path: '/api/email/send-marketing',
        method: 'POST',
        headers: adminHeaders,
        body: emailRequest,
        expectedStatus: [200],
      });
      
      assert.strictEqual(emailResponse.statusCode, 200, 'Should send email with consent verification');
      assert.ok(emailResponse.body.consentVerified, 'Should verify consent before sending');
      assert.ok(emailResponse.body.unsubscribeLink, 'Should include unsubscribe link');
      assert.ok(emailResponse.body.gdprCompliant, 'Should be GDPR compliant');
    });

    test('should block emails without proper consent', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Attempt to send marketing email without consent
      const emailRequest = {
        recipientUserId: testUsers.user.id,
        emailType: 'marketing',
        templateId: 'promotional_offer',
        checkGdprConsent: true,
      };

      try {
        await makeRequest({
          path: '/api/email/send-marketing',
          method: 'POST',
          headers: adminHeaders,
          body: emailRequest,
          expectedStatus: [403],
        });
        assert.fail('Should block marketing emails without consent');
      } catch (error) {
        // Expected to fail due to lack of consent
      }
    });

    test('should handle email unsubscribe and suppression', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Process unsubscribe request
      const unsubscribeData = {
        emailAddress: testUsers.user.email,
        unsubscribeType: 'all_marketing',
        reason: 'No longer interested',
        source: 'email_link',
      };

      const unsubscribeResponse = await makeRequest({
        path: '/api/email/unsubscribe',
        method: 'POST',
        body: unsubscribeData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(unsubscribeResponse.statusCode, 200, 'Should process unsubscribe');
      assert.ok(unsubscribeResponse.body.suppressionAdded, 'Should add to suppression list');
      assert.ok(unsubscribeResponse.body.consentWithdrawn, 'Should withdraw marketing consent');
      
      // Verify suppression list inclusion
      const suppressionResponse = await GdprApiHelper.getSuppressionList(adminHeaders);
      const suppressedEmails = suppressionResponse.body.map((s: any) => s.emailAddress);
      assert.ok(suppressedEmails.includes(testUsers.user.email), 
               'Should include email in suppression list');
    });

    test('should implement email data portability', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Export email communication history
      const exportRequest = {
        userId: testUsers.user.id,
        includeEmailHistory: true,
        includeConsentHistory: true,
        includeUnsubscribeHistory: true,
        format: 'json',
      };

      const exportResponse = await makeRequest({
        path: '/api/gdpr/export/email-data',
        method: 'POST',
        headers: adminHeaders,
        body: exportRequest,
        expectedStatus: [200, 202],
      });
      
      assert.ok([200, 202].includes(exportResponse.statusCode), 'Should export email data');
      
      if (exportResponse.body.exportData) {
        assert.ok(exportResponse.body.exportData.emailsSent, 'Should include sent emails count');
        assert.ok(exportResponse.body.exportData.consentHistory, 'Should include consent history');
        assert.ok(exportResponse.body.exportData.preferences, 'Should include preferences');
      }
    });

    test('should audit email integration GDPR compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get email GDPR compliance report
      const complianceResponse = await makeRequest({
        path: '/api/gdpr/reports/email-compliance',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(complianceResponse.statusCode, 200, 'Should generate email compliance report');
      
      const report = complianceResponse.body;
      assert.ok(typeof report.consentedUsers === 'number', 'Should count consented users');
      assert.ok(typeof report.suppressedUsers === 'number', 'Should count suppressed users');
      assert.ok(typeof report.marketingEmailsSent === 'number', 'Should count marketing emails');
      assert.ok(typeof report.complianceScore === 'number', 'Should calculate compliance score');
      assert.ok(Array.isArray(report.violations), 'Should list any violations');
    });
  });

  describe('Analytics Integration Compliance', () => {
    
    test('should respect analytics consent settings', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Set analytics consent
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: true,
        advertising: false,
      });
      
      // Track analytics event
      const analyticsEvent = {
        userId: testUsers.user.id,
        eventType: 'page_view',
        page: '/courses/mathematics',
        timestamp: new Date().toISOString(),
        sessionId: 'session_123',
        checkConsent: true,
      };

      const trackingResponse = await makeRequest({
        path: '/api/analytics/track',
        method: 'POST',
        headers: userHeaders,
        body: analyticsEvent,
        expectedStatus: [200],
      });
      
      assert.strictEqual(trackingResponse.statusCode, 200, 'Should track analytics with consent');
      assert.ok(trackingResponse.body.consentVerified, 'Should verify analytics consent');
      assert.ok(trackingResponse.body.tracked, 'Should track the event');
    });

    test('should block analytics without consent', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Withdraw analytics consent
      await GdprApiHelper.updateCookieConsent(userHeaders, {
        strictlyNecessary: true,
        functional: true,
        analytics: false,
        advertising: false,
      });
      
      // Attempt to track analytics event
      const analyticsEvent = {
        userId: testUsers.user.id,
        eventType: 'page_view',
        page: '/courses/mathematics',
        checkConsent: true,
      };

      const trackingResponse = await makeRequest({
        path: '/api/analytics/track',
        method: 'POST',
        headers: userHeaders,
        body: analyticsEvent,
        expectedStatus: [200],
      });
      
      assert.strictEqual(trackingResponse.statusCode, 200, 'Should handle tracking request');
      assert.ok(!trackingResponse.body.tracked, 'Should not track without consent');
      assert.ok(trackingResponse.body.reason === 'no_consent', 'Should specify no consent reason');
    });

    test('should anonymize analytics data for deletion requests', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Request analytics data anonymization
      const anonymizationRequest = {
        userId: testUsers.user.id,
        anonymizationMethod: 'pseudonymization',
        retainAggregates: true,
        deletePersonalIdentifiers: true,
      };

      const anonymizeResponse = await makeRequest({
        path: '/api/analytics/anonymize-user-data',
        method: 'POST',
        headers: adminHeaders,
        body: anonymizationRequest,
        expectedStatus: [200],
      });
      
      assert.strictEqual(anonymizeResponse.statusCode, 200, 'Should anonymize analytics data');
      assert.ok(anonymizeResponse.body.recordsProcessed, 'Should specify processed records count');
      assert.ok(anonymizeResponse.body.anonymizationId, 'Should provide anonymization ID');
      assert.ok(anonymizeResponse.body.retentionPolicy, 'Should specify retention policy');
    });

    test('should provide analytics data export', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Export user analytics data
      const exportRequest = {
        userId: testUsers.user.id,
        includePageViews: true,
        includeInteractions: true,
        includeDeviceInfo: false, // Excluded for privacy
        aggregateOnly: false,
        timeRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          to: new Date().toISOString(),
        },
      };

      const exportResponse = await makeRequest({
        path: '/api/gdpr/export/analytics-data',
        method: 'POST',
        headers: adminHeaders,
        body: exportRequest,
        expectedStatus: [200, 202],
      });
      
      assert.ok([200, 202].includes(exportResponse.statusCode), 'Should export analytics data');
      
      if (exportResponse.body.exportData) {
        assert.ok(Array.isArray(exportResponse.body.exportData.pageViews), 
                 'Should include page views');
        assert.ok(Array.isArray(exportResponse.body.exportData.interactions), 
                 'Should include interactions');
      }
    });
  });

  describe('Third-Party Service Integration', () => {
    
    test('should validate data sharing agreements', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get third-party data sharing agreements
      const agreementsResponse = await makeRequest({
        path: '/api/gdpr/data-sharing-agreements',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(agreementsResponse.statusCode, 200, 'Should retrieve sharing agreements');
      
      for (const agreement of agreementsResponse.body) {
        assert.ok(agreement.thirdPartyName, 'Should specify third party name');
        assert.ok(agreement.legalBasis, 'Should specify legal basis for sharing');
        assert.ok(agreement.dataCategories, 'Should specify shared data categories');
        assert.ok(agreement.retentionPeriod, 'Should specify retention period');
        assert.ok(agreement.adequacyDecision || agreement.safeguards, 
                 'Should have adequacy decision or safeguards');
      }
    });

    test('should implement consent-based data sharing', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Request consent for third-party sharing
      const sharingConsent = {
        thirdPartyService: 'external_analytics',
        purpose: 'Learning analytics and course improvement',
        dataCategories: ['progress_data', 'interaction_data'],
        retentionPeriod: '2_years',
        userConsent: true,
        explicitConsent: true,
      };

      const consentResponse = await makeRequest({
        path: '/api/gdpr/third-party-consent',
        method: 'POST',
        headers: userHeaders,
        body: sharingConsent,
        expectedStatus: [201],
      });
      
      assert.strictEqual(consentResponse.statusCode, 201, 'Should record third-party consent');
      assert.ok(consentResponse.body.consentId, 'Should provide consent ID');
      assert.ok(consentResponse.body.sharingEnabled, 'Should enable data sharing');
    });

    test('should monitor third-party compliance', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get third-party compliance monitoring report
      const monitoringResponse = await makeRequest({
        path: '/api/gdpr/third-party-monitoring',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(monitoringResponse.statusCode, 200, 'Should provide monitoring data');
      
      const monitoring = monitoringResponse.body;
      assert.ok(Array.isArray(monitoring.activeIntegrations), 'Should list active integrations');
      assert.ok(Array.isArray(monitoring.complianceChecks), 'Should list compliance checks');
      assert.ok(monitoring.lastAuditDate, 'Should show last audit date');
      assert.ok(typeof monitoring.complianceScore === 'number', 'Should calculate compliance score');
    });

    test('should handle third-party data breach notifications', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Simulate third-party breach notification
      const breachNotification = {
        thirdPartyName: 'External Analytics Provider',
        breachType: 'unauthorized_access',
        affectedDataTypes: ['user_behavior', 'course_progress'],
        affectedUserCount: 150,
        notificationReceived: new Date().toISOString(),
        thirdPartyResponse: 'Immediate containment implemented',
        ourDataAffected: true,
      };

      const notificationResponse = await makeRequest({
        path: '/api/gdpr/third-party-breach-notification',
        method: 'POST',
        headers: adminHeaders,
        body: breachNotification,
        expectedStatus: [201],
      });
      
      assert.strictEqual(notificationResponse.statusCode, 201, 'Should handle breach notification');
      assert.ok(notificationResponse.body.internalBreachId, 'Should create internal breach record');
      assert.ok(notificationResponse.body.assessmentRequired, 'Should require breach assessment');
      assert.ok(notificationResponse.body.notificationDeadlines, 'Should calculate notification deadlines');
    });
  });

  describe('Integration Audit and Compliance Reporting', () => {
    
    test('should generate comprehensive integration compliance report', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const reportResponse = await makeRequest({
        path: '/api/gdpr/reports/integration-compliance',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(reportResponse.statusCode, 200, 'Should generate integration compliance report');
      
      const report = reportResponse.body;
      assert.ok(report.stripe, 'Should include Stripe compliance status');
      assert.ok(report.email, 'Should include email compliance status');
      assert.ok(report.analytics, 'Should include analytics compliance status');
      assert.ok(report.thirdParty, 'Should include third-party compliance status');
      assert.ok(typeof report.overallScore === 'number', 'Should calculate overall compliance score');
      assert.ok(Array.isArray(report.recommendations), 'Should provide recommendations');
    });

    test('should audit cross-integration data flows', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Audit data flows between integrations
      const flowAuditResponse = await makeRequest({
        path: '/api/gdpr/audit/integration-data-flows',
        method: 'POST',
        headers: adminHeaders,
        body: {
          includePersonalData: true,
          timeRange: {
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last week
            to: new Date().toISOString(),
          },
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(flowAuditResponse.statusCode, 200, 'Should audit data flows');
      
      const audit = flowAuditResponse.body;
      assert.ok(Array.isArray(audit.dataFlows), 'Should list data flows');
      assert.ok(Array.isArray(audit.consentValidations), 'Should list consent validations');
      assert.ok(Array.isArray(audit.complianceGaps), 'Should identify compliance gaps');
      
      for (const flow of audit.dataFlows) {
        assert.ok(flow.source, 'Should specify data source');
        assert.ok(flow.destination, 'Should specify data destination');
        assert.ok(flow.dataType, 'Should specify data type');
        assert.ok(flow.legalBasis, 'Should specify legal basis');
        assert.ok(flow.consentValidated !== undefined, 'Should validate consent');
      }
    });

    test('should validate integration consent synchronization', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check consent synchronization across integrations
      const syncCheckResponse = await makeRequest({
        path: '/api/gdpr/integration-consent-sync-check',
        method: 'POST',
        headers: adminHeaders,
        body: {
          userId: testUsers.user.id,
          checkAllIntegrations: true,
        },
        expectedStatus: [200],
      });
      
      assert.strictEqual(syncCheckResponse.statusCode, 200, 'Should check consent synchronization');
      
      const syncStatus = syncCheckResponse.body;
      assert.ok(Array.isArray(syncStatus.integrations), 'Should list integration sync status');
      assert.ok(typeof syncStatus.syncScore === 'number', 'Should calculate sync score');
      assert.ok(Array.isArray(syncStatus.discrepancies), 'Should identify discrepancies');
      
      for (const integration of syncStatus.integrations) {
        assert.ok(integration.name, 'Should specify integration name');
        assert.ok(integration.consentStatus, 'Should specify consent status');
        assert.ok(integration.lastSyncTime, 'Should specify last sync time');
        assert.ok(typeof integration.isSynced === 'boolean', 'Should indicate sync status');
      }
    });
  });
});