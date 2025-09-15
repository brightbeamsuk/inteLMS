/**
 * GDPR Age Verification and Parental Consent Tests
 * 
 * Comprehensive test suite for UK Article 8 compliance, age verification workflows,
 * parental consent management, and child data protection measures.
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

describe('Age Verification and Parental Consent (Article 8)', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Age Verification Test Org');
    testOrg = orgResult.response.body;
    
    // Create test users
    const adminResult = await testAuth.createTestUser('admin', testOrg.id);
    const parentResult = await testAuth.createTestUser('user', testOrg.id); // Parent user
    
    testUsers.admin = adminResult.userData;
    testUsers.parent = parentResult.userData;
    
    // Authenticate users
    await testAuth.authenticate(testUsers.admin.email, testUsers.admin.password);
    await testAuth.authenticate(testUsers.parent.email, testUsers.parent.password);
  });

  afterEach(async () => {
    await globalTestTeardown();
  });

  describe('Age Verification Process', () => {
    
    test('should verify age meets UK threshold (13 years)', async () => {
      const verificationData = {
        dateOfBirth: '2008-05-15', // 16 years old (above threshold)
        verificationMethod: 'date_input',
        guardianEmail: null, // Not required for 13+
        consentSource: 'registration_form',
      };

      const response = await GdprApiHelper.submitAgeVerification({}, verificationData);
      
      assert.strictEqual(response.statusCode, 201, 'Should accept age verification for 13+');
      assert.ok(response.body.ageVerified, 'Should mark age as verified');
      assert.strictEqual(response.body.requiresParentalConsent, false, 
                        'Should not require parental consent for 13+');
      assert.ok(response.body.ageCategory === 'teen' || response.body.ageCategory === 'adult', 
               'Should categorize as teen or adult');
    });

    test('should identify users under 13 requiring parental consent', async () => {
      const childVerificationData = {
        dateOfBirth: '2015-03-20', // 9 years old (under threshold)
        verificationMethod: 'date_input',
        guardianEmail: 'parent@example.com',
        consentSource: 'registration_form',
      };

      const response = await GdprApiHelper.submitAgeVerification({}, childVerificationData);
      
      assert.strictEqual(response.statusCode, 201, 'Should accept age verification for under 13');
      assert.ok(response.body.ageVerified, 'Should mark age as verified');
      assert.strictEqual(response.body.requiresParentalConsent, true, 
                        'Should require parental consent for under 13');
      assert.strictEqual(response.body.ageCategory, 'child', 'Should categorize as child');
      assert.ok(response.body.guardianEmail, 'Should store guardian email');
    });

    test('should handle different age verification methods', async () => {
      const verificationMethods = [
        { method: 'date_input', description: 'User enters date of birth' },
        { method: 'age_declaration', description: 'User declares they are over 13' },
        { method: 'credit_card', description: 'Credit card age verification' },
        { method: 'identity_document', description: 'Official ID verification' },
      ];
      
      for (const { method, description } of verificationMethods) {
        const verificationData = {
          dateOfBirth: '2007-01-01', // 17 years old
          verificationMethod: method,
          metadata: { description },
        };
        
        const response = await GdprApiHelper.submitAgeVerification({}, verificationData);
        assert.strictEqual(response.statusCode, 201, `Should support ${method} verification`);
        assert.strictEqual(response.body.verificationMethod, method, 
                          `Should record ${method} as verification method`);
      }
    });

    test('should validate age verification data integrity', async () => {
      const verificationData = {
        dateOfBirth: '2010-08-10', // 14 years old
        verificationMethod: 'date_input',
        verificationTimestamp: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser 1.0',
      };

      const response = await GdprApiHelper.submitAgeVerification({}, verificationData);
      
      // Validate stored verification data
      assert.ok(response.body.verificationTimestamp, 'Should store verification timestamp');
      assert.ok(response.body.ipAddress, 'Should store IP address for audit');
      assert.ok(response.body.userAgent, 'Should store user agent for audit');
      assert.ok(response.body.verificationHash, 'Should generate verification hash for integrity');
    });

    test('should reject invalid age verification attempts', async () => {
      const invalidVerifications = [
        {
          // Future date of birth
          dateOfBirth: '2030-01-01',
          verificationMethod: 'date_input',
          expectedError: 'future_date'
        },
        {
          // Missing required fields
          verificationMethod: 'date_input',
          expectedError: 'missing_date_of_birth'
        },
        {
          // Invalid date format
          dateOfBirth: 'invalid-date',
          verificationMethod: 'date_input',
          expectedError: 'invalid_date_format'
        }
      ];
      
      for (const invalidData of invalidVerifications) {
        try {
          await GdprApiHelper.submitAgeVerification({}, invalidData);
          assert.fail(`Should reject invalid verification: ${invalidData.expectedError}`);
        } catch (error) {
          // Expected to fail validation
        }
      }
    });
  });

  describe('Parental Consent Management', () => {
    
    test('should initiate parental consent request for children', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      
      // Create child user requiring parental consent
      const childData = {
        firstName: 'Child',
        lastName: 'User',
        dateOfBirth: '2016-06-15', // 8 years old
        parentEmail: testUsers.parent.email,
        schoolId: testOrg.id,
      };

      const consentRequest = await makeRequest({
        path: '/api/gdpr/parental-consent/initiate',
        method: 'POST',
        headers: parentHeaders,
        body: childData,
        expectedStatus: [201],
      });
      
      assert.strictEqual(consentRequest.statusCode, 201, 'Should initiate parental consent request');
      assert.ok(consentRequest.body.consentRequestId, 'Should return consent request ID');
      assert.ok(consentRequest.body.verificationToken, 'Should provide verification token');
      assert.ok(consentRequest.body.expiryDate, 'Should set expiry date for consent request');
    });

    test('should verify parent identity before consent', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      
      // Submit identity verification
      const identityData = {
        verificationMethod: 'email_verification',
        parentEmail: testUsers.parent.email,
        verificationCode: '123456', // Mock verification code
        identityDocuments: [],
      };

      const verificationResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/verify-identity',
        method: 'POST',
        headers: parentHeaders,
        body: identityData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(verificationResponse.statusCode, 200, 'Should verify parent identity');
      assert.ok(verificationResponse.body.identityVerified, 'Should confirm identity verification');
      assert.ok(verificationResponse.body.verificationTimestamp, 'Should record verification time');
    });

    test('should collect informed parental consent', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      
      const parentalConsentData = {
        childUserId: 'child-user-123',
        parentUserId: testUsers.parent.id,
        consentType: 'data_processing',
        informedConsent: true,
        purposes: [
          'Educational content delivery',
          'Progress tracking',
          'Communication with parents',
        ],
        dataCategories: ['identity', 'educational_progress', 'contact'],
        retentionPeriod: 'until_child_turns_18',
        consentEvidence: {
          method: 'explicit_form_submission',
          timestamp: new Date().toISOString(),
          ipAddress: '192.168.1.100',
          documentVersion: 'v2.0',
        },
      };

      const consentResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/submit',
        method: 'POST',
        headers: parentHeaders,
        body: parentalConsentData,
        expectedStatus: [201],
      });
      
      assert.strictEqual(consentResponse.statusCode, 201, 'Should collect parental consent');
      assert.ok(consentResponse.body.consentId, 'Should return consent ID');
      assert.strictEqual(consentResponse.body.status, 'active', 'Should mark consent as active');
      assert.ok(consentResponse.body.legalBasis === 'parental_consent', 
               'Should use parental consent as legal basis');
    });

    test('should track parental consent history and modifications', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get parental consent history
      const historyResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/history',
        method: 'GET',
        headers: parentHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(historyResponse.statusCode, 200, 'Should retrieve consent history');
      
      for (const consent of historyResponse.body) {
        assert.ok(consent.consentId, 'Should have consent ID');
        assert.ok(consent.childUserId, 'Should have child user ID');
        assert.ok(consent.timestamp, 'Should have timestamp');
        assert.ok(consent.version, 'Should have version for tracking changes');
        assert.ok(['active', 'withdrawn', 'expired'].includes(consent.status), 
                 'Should have valid consent status');
      }
    });

    test('should handle parental consent withdrawal', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      
      // Withdraw parental consent
      const withdrawalData = {
        consentId: 'existing-consent-123',
        withdrawalReason: 'Parent decision to remove child from platform',
        effectiveDate: new Date().toISOString(),
        dataHandling: 'delete_immediately', // or 'anonymize', 'retain_legally_required'
      };

      const withdrawalResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/withdraw',
        method: 'POST',
        headers: parentHeaders,
        body: withdrawalData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(withdrawalResponse.statusCode, 200, 'Should process consent withdrawal');
      assert.strictEqual(withdrawalResponse.body.status, 'withdrawn', 
                        'Should update status to withdrawn');
      assert.ok(withdrawalResponse.body.withdrawalTimestamp, 'Should record withdrawal time');
      assert.ok(withdrawalResponse.body.dataHandlingPlan, 'Should provide data handling plan');
    });

    test('should handle consent expiry and renewal', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      
      // Check for expiring consents
      const expiringResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/expiring',
        method: 'GET',
        headers: parentHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(expiringResponse.statusCode, 200, 'Should check expiring consents');
      
      for (const consent of expiringResponse.body) {
        assert.ok(consent.expiryDate, 'Should have expiry date');
        assert.ok(consent.renewalRequired, 'Should indicate renewal requirement');
        assert.ok(consent.notificationSent, 'Should track renewal notifications');
      }
    });
  });

  describe('Child Data Protection Measures', () => {
    
    test('should enforce enhanced data protection for children', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get child protection settings
      const settingsResponse = await makeRequest({
        path: '/api/gdpr/child-protection-settings',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(settingsResponse.statusCode, 200, 'Should retrieve child protection settings');
      
      const settings = settingsResponse.body;
      assert.ok(settings.dataMinimization, 'Should enforce data minimization for children');
      assert.ok(settings.enhancedSecurity, 'Should enforce enhanced security measures');
      assert.ok(settings.restrictedDataSharing, 'Should restrict data sharing for children');
      assert.ok(settings.regularReview, 'Should require regular consent review');
    });

    test('should implement age-appropriate privacy notices', async () => {
      const ageGroups = [
        { ageGroup: 'child', minAge: 0, maxAge: 12 },
        { ageGroup: 'teen', minAge: 13, maxAge: 17 },
        { ageGroup: 'adult', minAge: 18, maxAge: 120 },
      ];
      
      for (const { ageGroup, minAge, maxAge } of ageGroups) {
        const noticeResponse = await makeRequest({
          path: `/api/gdpr/privacy-notice/${ageGroup}`,
          method: 'GET',
          expectedStatus: [200],
        });
        
        assert.strictEqual(noticeResponse.statusCode, 200, 
                          `Should provide ${ageGroup} privacy notice`);
        assert.ok(noticeResponse.body.content, 'Should have privacy notice content');
        assert.ok(noticeResponse.body.language_level, 'Should specify language complexity level');
        assert.strictEqual(noticeResponse.body.targetAgeGroup, ageGroup, 
                          'Should target correct age group');
      }
    });

    test('should restrict marketing and profiling for children', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check marketing restrictions for children
      const restrictionsResponse = await makeRequest({
        path: '/api/gdpr/child-marketing-restrictions',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(restrictionsResponse.statusCode, 200, 'Should check marketing restrictions');
      
      const restrictions = restrictionsResponse.body;
      assert.strictEqual(restrictions.marketingAllowed, false, 
                        'Should prohibit marketing to children');
      assert.strictEqual(restrictions.profilingAllowed, false, 
                        'Should prohibit profiling of children');
      assert.strictEqual(restrictions.behavioralAdvertising, false, 
                        'Should prohibit behavioral advertising to children');
    });

    test('should implement regular consent review for children', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check consent review requirements
      const reviewResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/review-schedule',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(reviewResponse.statusCode, 200, 'Should get review schedule');
      
      const schedule = reviewResponse.body;
      assert.ok(schedule.reviewFrequency, 'Should specify review frequency');
      assert.ok(Array.isArray(schedule.upcomingReviews), 'Should list upcoming reviews');
      assert.ok(schedule.automaticReminders, 'Should have automatic reminder system');
    });
  });

  describe('Age Transition Management', () => {
    
    test('should handle transition when child turns 13', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get children approaching age transition
      const transitionsResponse = await GdprApiHelper.getAgeTransitions(adminHeaders);
      assert.strictEqual(transitionsResponse.statusCode, 200, 'Should get age transitions');
      
      for (const transition of transitionsResponse.body) {
        assert.ok(transition.childUserId, 'Should have child user ID');
        assert.ok(transition.currentAge, 'Should have current age');
        assert.ok(transition.transitionDate, 'Should have transition date');
        assert.ok(transition.newAgeCategory, 'Should have new age category');
        assert.ok(['pending', 'in_progress', 'completed'].includes(transition.status),
                 'Should have valid transition status');
      }
    });

    test('should process age transition from child to teen', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const childUserId = 'child-turning-13';
      
      // Process age transition
      const transitionResponse = await GdprApiHelper.processAgeTransition(adminHeaders, childUserId);
      assert.strictEqual(transitionResponse.statusCode, 200, 'Should process age transition');
      
      const result = transitionResponse.body;
      assert.ok(result.transitionCompleted, 'Should complete transition');
      assert.strictEqual(result.newAgeCategory, 'teen', 'Should update to teen category');
      assert.ok(result.parentalConsentStatus, 'Should update parental consent status');
      assert.ok(result.newConsentRequired, 'Should indicate if new consent required');
    });

    test('should notify parents of age transition', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check transition notifications
      const notificationsResponse = await makeRequest({
        path: '/api/gdpr/age-transitions/notifications',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(notificationsResponse.statusCode, 200, 'Should get transition notifications');
      
      for (const notification of notificationsResponse.body) {
        assert.ok(notification.parentEmail, 'Should have parent email');
        assert.ok(notification.childUserId, 'Should have child user ID');
        assert.ok(notification.transitionDate, 'Should have transition date');
        assert.ok(notification.sentAt, 'Should have notification send time');
        assert.ok(['sent', 'delivered', 'failed'].includes(notification.status),
                 'Should have valid notification status');
      }
    });

    test('should handle data retention changes during age transition', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      const childUserId = 'transitioning-child';
      
      // Check retention policy changes
      const retentionResponse = await makeRequest({
        path: `/api/gdpr/age-transitions/${childUserId}/retention-changes`,
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(retentionResponse.statusCode, 200, 'Should check retention changes');
      
      const changes = retentionResponse.body;
      assert.ok(changes.currentRetentionPolicy, 'Should have current retention policy');
      assert.ok(changes.newRetentionPolicy, 'Should have new retention policy');
      assert.ok(changes.dataCategories, 'Should specify affected data categories');
      assert.ok(changes.effectiveDate, 'Should have effective date for changes');
    });
  });

  describe('Compliance and Audit', () => {
    
    test('should generate age verification compliance reports', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const reportResponse = await makeRequest({
        path: '/api/gdpr/reports/age-verification-compliance',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(reportResponse.statusCode, 200, 'Should generate compliance report');
      
      const report = reportResponse.body;
      assert.ok(typeof report.totalVerifications === 'number', 'Should include total verifications');
      assert.ok(typeof report.childrenCount === 'number', 'Should include children count');
      assert.ok(typeof report.parentalConsentsActive === 'number', 'Should include active consents');
      assert.ok(typeof report.complianceScore === 'number', 'Should include compliance score');
      assert.ok(Array.isArray(report.ageDistribution), 'Should include age distribution');
    });

    test('should audit parental consent integrity', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Get parental consent audit logs
      const auditResponse = await GdprApiHelper.getAuditLogs(adminHeaders, {
        category: 'parental_consent',
        action: 'consent_granted',
      });
      
      assert.strictEqual(auditResponse.statusCode, 200, 'Should retrieve consent audit logs');
      
      for (const log of auditResponse.body) {
        const validation = GdprComplianceValidator.validateAuditLogIntegrity(log);
        assert.ok(validation.valid, `Audit log should be valid: ${validation.errors.join(', ')}`);
        assert.ok(log.details.childUserId, 'Should include child user ID');
        assert.ok(log.details.parentUserId, 'Should include parent user ID');
        assert.ok(log.details.consentEvidence, 'Should include consent evidence');
      }
    });

    test('should validate Article 8 compliance measures', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Check Article 8 compliance
      const complianceResponse = await makeRequest({
        path: '/api/gdpr/compliance/article-8-check',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      assert.strictEqual(complianceResponse.statusCode, 200, 'Should check Article 8 compliance');
      
      const compliance = complianceResponse.body;
      assert.ok(typeof compliance.isCompliant === 'boolean', 'Should indicate compliance status');
      assert.ok(Array.isArray(compliance.requirements), 'Should list compliance requirements');
      assert.ok(Array.isArray(compliance.gaps), 'Should identify compliance gaps');
      assert.ok(compliance.recommendations, 'Should provide recommendations');
      
      // Check specific Article 8 requirements
      const requirements = compliance.requirements;
      const hasAgeVerification = requirements.some((r: any) => r.type === 'age_verification');
      const hasParentalConsent = requirements.some((r: any) => r.type === 'parental_consent');
      const hasDataMinimization = requirements.some((r: any) => r.type === 'data_minimization');
      
      assert.ok(hasAgeVerification, 'Should check age verification requirement');
      assert.ok(hasParentalConsent, 'Should check parental consent requirement');
      assert.ok(hasDataMinimization, 'Should check data minimization for children');
    });
  });

  describe('Integration with User Management', () => {
    
    test('should integrate age verification with user registration', async () => {
      const registrationData = {
        email: 'newchild@example.com',
        firstName: 'New',
        lastName: 'Child',
        dateOfBirth: '2017-04-10', // 7 years old
        parentEmail: 'parent@example.com',
        organisationId: testOrg.id,
      };

      const registrationResponse = await makeRequest({
        path: '/api/auth/register-child',
        method: 'POST',
        body: registrationData,
        expectedStatus: [201, 202], // 202 for pending parental consent
      });
      
      if (registrationResponse.statusCode === 202) {
        assert.ok(registrationResponse.body.parentalConsentRequired, 
                 'Should require parental consent for child registration');
        assert.ok(registrationResponse.body.consentRequestId, 
                 'Should provide consent request ID');
      }
    });

    test('should handle account activation after parental consent', async () => {
      const parentHeaders = testAuth.getAuthHeaders(testUsers.parent.email);
      
      // Simulate completing parental consent process
      const activationData = {
        consentRequestId: 'pending-consent-123',
        childUserId: 'pending-child-456',
        finalConsent: true,
        activateAccount: true,
      };

      const activationResponse = await makeRequest({
        path: '/api/gdpr/parental-consent/activate-account',
        method: 'POST',
        headers: parentHeaders,
        body: activationData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(activationResponse.statusCode, 200, 'Should activate child account');
      assert.ok(activationResponse.body.accountActivated, 'Should confirm account activation');
      assert.ok(activationResponse.body.childUserId, 'Should return child user ID');
    });
  });
});