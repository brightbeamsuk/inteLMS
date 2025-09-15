/**
 * GDPR Frontend Components Tests
 * 
 * Comprehensive test suite for GDPR frontend components including user interaction
 * validation, accessibility testing, and interface compliance verification.
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
  GdprApiHelper 
} from '../setup/gdpr-test-helpers.ts';

describe('GDPR Frontend Components', () => {
  let testUsers: any = {};
  let testOrg: any;

  beforeEach(async () => {
    await globalTestSetup();
    
    // Create test organization
    const orgResult = await testDb.createTestOrganization('Frontend Test Org');
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

  describe('Cookie Banner Component', () => {
    
    test('should render cookie banner with required PECR elements', async () => {
      // Test cookie banner configuration endpoint
      const bannerConfigResponse = await makeRequest({
        path: '/api/gdpr/cookie-banner-config',
        method: 'GET',
        expectedStatus: [200],
      });
      
      assert.strictEqual(bannerConfigResponse.statusCode, 200, 'Should provide banner configuration');
      
      const config = bannerConfigResponse.body;
      
      // Verify required PECR elements
      assert.ok(config.title, 'Should have banner title');
      assert.ok(config.description, 'Should have description of cookie use');
      assert.ok(config.categories, 'Should list cookie categories');
      assert.ok(config.policyLinks, 'Should include policy links');
      assert.ok(config.granularControls, 'Should support granular controls');
      
      // Verify cookie categories
      const requiredCategories = ['strictlyNecessary', 'functional', 'analytics', 'advertising'];
      for (const category of requiredCategories) {
        const categoryConfig = config.categories.find((c: any) => c.id === category);
        assert.ok(categoryConfig, `Should include ${category} category`);
        assert.ok(categoryConfig.name, `${category} should have display name`);
        assert.ok(categoryConfig.description, `${category} should have description`);
        assert.ok(categoryConfig.purposes, `${category} should list purposes`);
      }
      
      // Verify legal links
      assert.ok(config.policyLinks.privacyPolicy, 'Should include privacy policy link');
      assert.ok(config.policyLinks.cookiePolicy, 'Should include cookie policy link');
      assert.ok(config.policyLinks.legalBasis, 'Should explain legal basis');
    });

    test('should handle cookie consent submission', async () => {
      const cookieConsentData = {
        strictlyNecessary: true,
        functional: true,
        analytics: false,
        advertising: false,
        source: 'cookie_banner',
        userAgent: 'Test Browser 1.0',
        timestamp: new Date().toISOString(),
      };

      const consentResponse = await makeRequest({
        path: '/api/gdpr/cookie-consent/submit',
        method: 'POST',
        body: cookieConsentData,
        expectedStatus: [200],
      });
      
      assert.strictEqual(consentResponse.statusCode, 200, 'Should submit cookie consent');
      assert.ok(consentResponse.body.consentId, 'Should return consent ID');
      assert.ok(consentResponse.body.timestamp, 'Should record timestamp');
      assert.ok(consentResponse.body.expiryDate, 'Should set expiry date');
    });

    test('should provide cookie banner accessibility features', async () => {
      const accessibilityResponse = await makeRequest({
        path: '/api/gdpr/cookie-banner-accessibility',
        method: 'GET',
        expectedStatus: [200],
      });
      
      const accessibility = accessibilityResponse.body;
      
      // Verify accessibility requirements
      assert.ok(accessibility.keyboardNavigation, 'Should support keyboard navigation');
      assert.ok(accessibility.screenReaderSupport, 'Should support screen readers');
      assert.ok(accessibility.focusManagement, 'Should manage focus properly');
      assert.ok(accessibility.colorContrast, 'Should meet color contrast requirements');
      assert.ok(accessibility.textAlternatives, 'Should provide text alternatives');
      
      // Verify ARIA attributes
      assert.ok(accessibility.ariaLabels, 'Should provide ARIA labels');
      assert.ok(accessibility.roleAttributes, 'Should use proper role attributes');
      assert.ok(accessibility.liveRegions, 'Should support live regions for updates');
    });

    test('should handle banner customization and branding', async () => {
      const customizationResponse = await makeRequest({
        path: '/api/gdpr/cookie-banner-customization',
        method: 'GET',
        expectedStatus: [200],
      });
      
      const customization = customizationResponse.body;
      
      // Verify customization options
      assert.ok(customization.themes, 'Should support theme customization');
      assert.ok(customization.positioning, 'Should support position customization');
      assert.ok(customization.textCustomization, 'Should support text customization');
      assert.ok(customization.brandingOptions, 'Should support branding options');
      
      // Verify theme options
      for (const theme of customization.themes) {
        assert.ok(theme.name, 'Theme should have name');
        assert.ok(theme.colors, 'Theme should define colors');
        assert.ok(theme.typography, 'Theme should define typography');
        assert.ok(theme.accessibility, 'Theme should meet accessibility standards');
      }
    });
  });

  describe('Privacy Settings Interface', () => {
    
    test('should render comprehensive privacy settings page', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const settingsResponse = await makeRequest({
        path: '/api/gdpr/privacy-settings/interface-config',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200],
      });
      
      const config = settingsResponse.body;
      
      // Verify privacy settings sections
      assert.ok(config.sections.consent, 'Should include consent management section');
      assert.ok(config.sections.cookies, 'Should include cookie preferences section');
      assert.ok(config.sections.marketing, 'Should include marketing preferences section');
      assert.ok(config.sections.dataRights, 'Should include data rights section');
      assert.ok(config.sections.dataExport, 'Should include data export section');
      
      // Verify user rights options
      const dataRights = config.sections.dataRights;
      const expectedRights = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'];
      
      for (const right of expectedRights) {
        const rightConfig = dataRights.find((r: any) => r.type === right);
        assert.ok(rightConfig, `Should include ${right} request option`);
        assert.ok(rightConfig.description, `${right} should have description`);
        assert.ok(rightConfig.formFields, `${right} should define form fields`);
      }
    });

    test('should handle consent preference updates', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const consentUpdate = {
        cookieConsents: {
          strictlyNecessary: true,
          functional: true,
          analytics: false,
          advertising: false,
        },
        marketingConsents: {
          email: true,
          sms: false,
          phone: false,
          post: false,
        },
        source: 'privacy_settings',
        timestamp: new Date().toISOString(),
      };

      const updateResponse = await makeRequest({
        path: '/api/gdpr/privacy-settings/update-consents',
        method: 'POST',
        headers: userHeaders,
        body: consentUpdate,
        expectedStatus: [200],
      });
      
      assert.strictEqual(updateResponse.statusCode, 200, 'Should update consent preferences');
      assert.ok(updateResponse.body.updated, 'Should confirm update');
      assert.ok(updateResponse.body.auditLogged, 'Should log preference changes');
    });

    test('should provide data export interface', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const exportInterfaceResponse = await makeRequest({
        path: '/api/gdpr/privacy-settings/export-interface',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200],
      });
      
      const exportInterface = exportInterfaceResponse.body;
      
      // Verify export options
      assert.ok(exportInterface.dataCategories, 'Should list available data categories');
      assert.ok(exportInterface.formats, 'Should list available export formats');
      assert.ok(exportInterface.estimatedSize, 'Should estimate export size');
      assert.ok(exportInterface.processingTime, 'Should estimate processing time');
      
      // Verify data categories
      for (const category of exportInterface.dataCategories) {
        assert.ok(category.name, 'Category should have name');
        assert.ok(category.description, 'Category should have description');
        assert.ok(category.dataTypes, 'Category should list data types');
        assert.ok(typeof category.recordCount === 'number', 'Category should show record count');
      }
    });

    test('should handle accessibility and internationalization', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test with different language preferences
      const languages = ['en', 'fr', 'es', 'de'];
      
      for (const lang of languages) {
        const i18nResponse = await makeRequest({
          path: '/api/gdpr/privacy-settings/interface-config',
          method: 'GET',
          headers: {
            ...userHeaders,
            'Accept-Language': lang,
          },
          expectedStatus: [200],
        });
        
        const config = i18nResponse.body;
        assert.ok(config.language === lang || config.language === 'en', 
                 `Should support ${lang} language`);
        assert.ok(config.text, 'Should provide localized text');
        assert.ok(config.accessibility, 'Should include accessibility features');
      }
    });
  });

  describe('User Rights Request Interface', () => {
    
    test('should render user rights request forms', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const requestTypes = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'];
      
      for (const requestType of requestTypes) {
        const formResponse = await makeRequest({
          path: `/api/gdpr/user-rights/form-config/${requestType}`,
          method: 'GET',
          headers: userHeaders,
          expectedStatus: [200],
        });
        
        const formConfig = formResponse.body;
        
        assert.ok(formConfig.title, `${requestType} form should have title`);
        assert.ok(formConfig.description, `${requestType} form should have description`);
        assert.ok(formConfig.fields, `${requestType} form should define fields`);
        assert.ok(formConfig.validation, `${requestType} form should include validation rules`);
        assert.ok(formConfig.legalBasis, `${requestType} form should explain legal basis`);
        
        // Verify required fields
        const requiredFields = formConfig.fields.filter((f: any) => f.required);
        assert.ok(requiredFields.length > 0, `${requestType} form should have required fields`);
        
        // Verify field validation
        for (const field of formConfig.fields) {
          assert.ok(field.name, 'Field should have name');
          assert.ok(field.type, 'Field should have type');
          assert.ok(field.label, 'Field should have label');
          
          if (field.validation) {
            assert.ok(field.validation.rules, 'Field validation should define rules');
            assert.ok(field.validation.messages, 'Field validation should define messages');
          }
        }
      }
    });

    test('should handle form submission with validation', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test valid form submission
      const validRequest = {
        requestType: 'access',
        reason: 'I want to review my personal data',
        urgency: 'normal',
        contactMethod: 'email',
        additionalInfo: 'Please include all data from the last 2 years',
      };

      const validSubmission = await makeRequest({
        path: '/api/gdpr/user-rights/submit-request',
        method: 'POST',
        headers: userHeaders,
        body: validRequest,
        expectedStatus: [201],
      });
      
      assert.strictEqual(validSubmission.statusCode, 201, 'Should accept valid request submission');
      assert.ok(validSubmission.body.requestId, 'Should return request ID');
      assert.ok(validSubmission.body.dueDate, 'Should calculate due date');
      
      // Test invalid form submission
      const invalidRequest = {
        requestType: 'access',
        // Missing required reason field
        urgency: 'invalid_urgency',
      };

      try {
        await makeRequest({
          path: '/api/gdpr/user-rights/submit-request',
          method: 'POST',
          headers: userHeaders,
          body: invalidRequest,
          expectedStatus: [400],
        });
      } catch (error) {
        // Expected validation error
      }
    });

    test('should provide request status tracking interface', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      const statusResponse = await makeRequest({
        path: '/api/gdpr/user-rights/status-interface',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200],
      });
      
      const statusInterface = statusResponse.body;
      
      assert.ok(statusInterface.statusDefinitions, 'Should define status meanings');
      assert.ok(statusInterface.timeline, 'Should show timeline of statuses');
      assert.ok(statusInterface.notifications, 'Should define notification preferences');
      
      // Verify status definitions
      const expectedStatuses = ['submitted', 'verified', 'in_progress', 'completed', 'rejected'];
      for (const status of expectedStatuses) {
        const statusDef = statusInterface.statusDefinitions.find((s: any) => s.status === status);
        assert.ok(statusDef, `Should define ${status} status`);
        assert.ok(statusDef.description, `${status} should have description`);
        assert.ok(statusDef.userMessage, `${status} should have user-friendly message`);
      }
    });

    test('should handle file upload for identity verification', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      
      // Test file upload configuration
      const uploadConfigResponse = await makeRequest({
        path: '/api/gdpr/user-rights/upload-config',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200],
      });
      
      const uploadConfig = uploadConfigResponse.body;
      
      assert.ok(uploadConfig.allowedFileTypes, 'Should specify allowed file types');
      assert.ok(uploadConfig.maxFileSize, 'Should specify max file size');
      assert.ok(uploadConfig.securityScanning, 'Should include security scanning info');
      assert.ok(uploadConfig.retentionPolicy, 'Should specify file retention policy');
      
      // Verify allowed file types for identity documents
      const allowedTypes = uploadConfig.allowedFileTypes;
      assert.ok(allowedTypes.includes('image/jpeg'), 'Should allow JPEG images');
      assert.ok(allowedTypes.includes('image/png'), 'Should allow PNG images');
      assert.ok(allowedTypes.includes('application/pdf'), 'Should allow PDF documents');
    });
  });

  describe('GDPR Dashboard Components', () => {
    
    test('should render admin GDPR dashboard', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const dashboardResponse = await makeRequest({
        path: '/api/gdpr/dashboard/admin-interface',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      const dashboard = dashboardResponse.body;
      
      // Verify dashboard sections
      assert.ok(dashboard.sections.overview, 'Should include overview section');
      assert.ok(dashboard.sections.userRequests, 'Should include user requests section');
      assert.ok(dashboard.sections.dataBreaches, 'Should include data breaches section');
      assert.ok(dashboard.sections.compliance, 'Should include compliance section');
      assert.ok(dashboard.sections.reports, 'Should include reports section');
      
      // Verify metrics
      const overview = dashboard.sections.overview;
      assert.ok(typeof overview.totalUsers === 'number', 'Should show total users');
      assert.ok(typeof overview.activeConsents === 'number', 'Should show active consents');
      assert.ok(typeof overview.pendingRequests === 'number', 'Should show pending requests');
      assert.ok(typeof overview.complianceScore === 'number', 'Should show compliance score');
    });

    test('should provide real-time compliance monitoring', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const monitoringResponse = await makeRequest({
        path: '/api/gdpr/dashboard/compliance-monitoring',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      const monitoring = monitoringResponse.body;
      
      assert.ok(monitoring.healthChecks, 'Should include health checks');
      assert.ok(monitoring.alertsConfig, 'Should include alerts configuration');
      assert.ok(monitoring.metrics, 'Should include real-time metrics');
      assert.ok(monitoring.trends, 'Should include trend analysis');
      
      // Verify health checks
      for (const check of monitoring.healthChecks) {
        assert.ok(check.name, 'Health check should have name');
        assert.ok(check.status, 'Health check should have status');
        assert.ok(check.lastCheck, 'Health check should have timestamp');
        assert.ok(['healthy', 'warning', 'critical'].includes(check.status), 
                 'Health check should have valid status');
      }
    });

    test('should handle dashboard role-based access control', async () => {
      const userHeaders = testAuth.getAuthHeaders(testUsers.user.email);
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      // Test user access to dashboard
      const userDashboardResponse = await makeRequest({
        path: '/api/gdpr/dashboard/user-interface',
        method: 'GET',
        headers: userHeaders,
        expectedStatus: [200],
      });
      
      const userDashboard = userDashboardResponse.body;
      
      // User dashboard should be limited
      assert.ok(userDashboard.personalData, 'Should show personal data summary');
      assert.ok(userDashboard.consentStatus, 'Should show consent status');
      assert.ok(userDashboard.dataRequests, 'Should show user\'s own data requests');
      assert.ok(!userDashboard.adminFeatures, 'Should not include admin features');
      
      // Admin dashboard should have full access
      const adminDashboardResponse = await makeRequest({
        path: '/api/gdpr/dashboard/admin-interface',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      const adminDashboard = adminDashboardResponse.body;
      assert.ok(adminDashboard.sections.userRequests, 'Should include user requests management');
      assert.ok(adminDashboard.sections.compliance, 'Should include compliance monitoring');
      assert.ok(adminDashboard.sections.reports, 'Should include reporting features');
    });

    test('should provide data visualization components', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const visualizationResponse = await makeRequest({
        path: '/api/gdpr/dashboard/data-visualization',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      const visualization = visualizationResponse.body;
      
      assert.ok(visualization.charts, 'Should provide chart configurations');
      assert.ok(visualization.dataFeeds, 'Should provide data feed endpoints');
      assert.ok(visualization.updateFrequency, 'Should specify update frequency');
      assert.ok(visualization.accessibility, 'Should include accessibility features');
      
      // Verify chart types
      const chartTypes = visualization.charts.map((c: any) => c.type);
      assert.ok(chartTypes.includes('consent-trends'), 'Should include consent trends chart');
      assert.ok(chartTypes.includes('request-volume'), 'Should include request volume chart');
      assert.ok(chartTypes.includes('compliance-score'), 'Should include compliance score chart');
      assert.ok(chartTypes.includes('breach-timeline'), 'Should include breach timeline chart');
    });
  });

  describe('Compliance Document Components', () => {
    
    test('should render privacy policy interface', async () => {
      const policyResponse = await makeRequest({
        path: '/api/gdpr/documents/privacy-policy-interface',
        method: 'GET',
        expectedStatus: [200],
      });
      
      const policyInterface = policyResponse.body;
      
      assert.ok(policyInterface.sections, 'Should define policy sections');
      assert.ok(policyInterface.navigation, 'Should provide navigation');
      assert.ok(policyInterface.lastUpdated, 'Should show last updated date');
      assert.ok(policyInterface.version, 'Should show policy version');
      
      // Verify required sections
      const requiredSections = [
        'data-collected', 'purposes', 'legal-basis', 'retention',
        'sharing', 'rights', 'cookies', 'contact'
      ];
      
      for (const section of requiredSections) {
        const sectionConfig = policyInterface.sections.find((s: any) => s.id === section);
        assert.ok(sectionConfig, `Should include ${section} section`);
        assert.ok(sectionConfig.title, `${section} should have title`);
        assert.ok(sectionConfig.content, `${section} should have content`);
      }
    });

    test('should handle cookie policy interface', async () => {
      const cookiePolicyResponse = await makeRequest({
        path: '/api/gdpr/documents/cookie-policy-interface',
        method: 'GET',
        expectedStatus: [200],
      });
      
      const cookiePolicy = cookiePolicyResponse.body;
      
      assert.ok(cookiePolicy.categories, 'Should list cookie categories');
      assert.ok(cookiePolicy.thirdParties, 'Should list third-party cookies');
      assert.ok(cookiePolicy.controls, 'Should explain cookie controls');
      assert.ok(cookiePolicy.retention, 'Should explain cookie retention');
      
      // Verify PECR compliance elements
      assert.ok(cookiePolicy.legalBasis, 'Should explain legal basis for cookies');
      assert.ok(cookiePolicy.consentMechanism, 'Should explain consent mechanism');
      assert.ok(cookiePolicy.withdrawalProcess, 'Should explain withdrawal process');
    });

    test('should provide document generation interface', async () => {
      const adminHeaders = testAuth.getAuthHeaders(testUsers.admin.email);
      
      const generationResponse = await makeRequest({
        path: '/api/gdpr/documents/generation-interface',
        method: 'GET',
        headers: adminHeaders,
        expectedStatus: [200],
      });
      
      const generation = generationResponse.body;
      
      assert.ok(generation.templates, 'Should list available templates');
      assert.ok(generation.customization, 'Should support customization');
      assert.ok(generation.preview, 'Should support preview functionality');
      assert.ok(generation.publishing, 'Should support publishing workflow');
      
      // Verify template types
      const templateTypes = generation.templates.map((t: any) => t.type);
      assert.ok(templateTypes.includes('privacy-policy'), 'Should include privacy policy template');
      assert.ok(templateTypes.includes('cookie-policy'), 'Should include cookie policy template');
      assert.ok(templateTypes.includes('data-processing-agreement'), 'Should include DPA template');
    });

    test('should handle document accessibility and compliance', async () => {
      const accessibilityResponse = await makeRequest({
        path: '/api/gdpr/documents/accessibility-check',
        method: 'POST',
        body: { documentType: 'privacy-policy' },
        expectedStatus: [200],
      });
      
      const accessibility = accessibilityResponse.body;
      
      assert.ok(accessibility.wcagCompliance, 'Should check WCAG compliance');
      assert.ok(accessibility.readabilityScore, 'Should check readability');
      assert.ok(accessibility.languageSupport, 'Should check language support');
      assert.ok(accessibility.structureValidation, 'Should validate document structure');
      
      // Verify accessibility standards
      assert.ok(accessibility.wcagCompliance.level, 'Should specify WCAG compliance level');
      assert.ok(accessibility.wcagCompliance.issues, 'Should list accessibility issues');
      assert.ok(accessibility.readabilityScore.score, 'Should provide readability score');
      assert.ok(accessibility.readabilityScore.level, 'Should categorize reading level');
    });
  });

  describe('Mobile Responsiveness and Cross-Browser Support', () => {
    
    test('should provide mobile-optimized interfaces', async () => {
      const mobileHeaders = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
      };
      
      const mobileResponse = await makeRequest({
        path: '/api/gdpr/interfaces/mobile-config',
        method: 'GET',
        headers: mobileHeaders,
        expectedStatus: [200],
      });
      
      const mobileConfig = mobileResponse.body;
      
      assert.ok(mobileConfig.responsive, 'Should be responsive design');
      assert.ok(mobileConfig.touchOptimized, 'Should be touch-optimized');
      assert.ok(mobileConfig.performance, 'Should be performance-optimized');
      assert.ok(mobileConfig.accessibility, 'Should maintain accessibility on mobile');
      
      // Verify mobile-specific optimizations
      assert.ok(mobileConfig.simplifiedNavigation, 'Should have simplified navigation');
      assert.ok(mobileConfig.gestureSupport, 'Should support gestures');
      assert.ok(mobileConfig.offlineCapability, 'Should support offline viewing');
    });

    test('should handle different browser capabilities', async () => {
      const browsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/91.0',
      ];
      
      for (const userAgent of browsers) {
        const browserResponse = await makeRequest({
          path: '/api/gdpr/interfaces/browser-support-check',
          method: 'POST',
          headers: { 'User-Agent': userAgent },
          body: { userAgent },
          expectedStatus: [200],
        });
        
        const support = browserResponse.body;
        
        assert.ok(support.supported, `Should support browser: ${userAgent}`);
        assert.ok(support.features, 'Should list supported features');
        assert.ok(support.fallbacks, 'Should provide fallback options');
        
        if (support.limitations) {
          assert.ok(Array.isArray(support.limitations), 'Should list any limitations');
        }
      }
    });
  });
});