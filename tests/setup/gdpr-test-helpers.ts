/**
 * GDPR-Specific Test Helpers and Utilities
 * 
 * This module provides specialized testing utilities for GDPR compliance testing
 * including consent workflow helpers, user rights testing, and compliance validation.
 */

import { makeRequest, testAuth, testDb, testDataGenerator, TestResult } from './test-setup.ts';
import { assert } from 'node:test';

// GDPR API endpoint helpers
export class GdprApiHelper {
  
  // Consent Management API helpers
  static async submitConsent(authHeaders: Record<string, string>, consentData: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/consent',
      method: 'POST',
      headers: authHeaders,
      body: consentData,
      expectedStatus: [201],
    });
  }

  static async getConsent(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/consent',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  static async withdrawConsent(authHeaders: Record<string, string>, consentType: string): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/consent/withdraw',
      method: 'POST',
      headers: authHeaders,
      body: { consentType },
      expectedStatus: [200],
    });
  }

  // User Rights API helpers
  static async submitUserRightRequest(authHeaders: Record<string, string>, requestData: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/user-rights',
      method: 'POST',
      headers: authHeaders,
      body: requestData,
      expectedStatus: [201],
    });
  }

  static async getUserRightRequests(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/user-rights',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  static async processUserRightRequest(authHeaders: Record<string, string>, requestId: string, action: string): Promise<TestResult> {
    return makeRequest({
      path: `/api/gdpr/user-rights/${requestId}/process`,
      method: 'POST',
      headers: authHeaders,
      body: { action },
      expectedStatus: [200],
    });
  }

  // Cookie Management API helpers
  static async getCookieInventory(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/cookie-inventory',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  static async updateCookieConsent(authHeaders: Record<string, string>, cookieConsents: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/cookie-consent',
      method: 'POST',
      headers: authHeaders,
      body: { cookieConsents },
      expectedStatus: [200],
    });
  }

  // Marketing Consent API helpers
  static async updateMarketingConsent(authHeaders: Record<string, string>, consentData: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/marketing-consent',
      method: 'POST',
      headers: authHeaders,
      body: consentData,
      expectedStatus: [200],
    });
  }

  static async withdrawMarketingConsent(authHeaders: Record<string, string>, consentType: string): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/marketing-consent/withdraw',
      method: 'POST',
      headers: authHeaders,
      body: { consentType },
      expectedStatus: [200],
    });
  }

  // Privacy Settings API helpers
  static async getPrivacySettings(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/privacy-settings',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  static async updatePrivacySettings(authHeaders: Record<string, string>, settings: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/privacy-settings',
      method: 'POST',
      headers: authHeaders,
      body: settings,
      expectedStatus: [200],
    });
  }

  // Data Retention API helpers
  static async getRetentionPolicies(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/retention-policies',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  static async triggerDataRetention(authHeaders: Record<string, string>, policyId: string): Promise<TestResult> {
    return makeRequest({
      path: `/api/gdpr/retention-policies/${policyId}/execute`,
      method: 'POST',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  // Breach Management API helpers
  static async reportBreach(authHeaders: Record<string, string>, breachData: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/data-breaches',
      method: 'POST',
      headers: authHeaders,
      body: breachData,
      expectedStatus: [201],
    });
  }

  static async getBreaches(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/data-breaches',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  static async updateBreachStatus(authHeaders: Record<string, string>, breachId: string, status: string): Promise<TestResult> {
    return makeRequest({
      path: `/api/gdpr/data-breaches/${breachId}`,
      method: 'PATCH',
      headers: authHeaders,
      body: { status },
      expectedStatus: [200],
    });
  }

  // Age Verification API helpers
  static async submitAgeVerification(authHeaders: Record<string, string>, verificationData: any): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/age-verification',
      method: 'POST',
      headers: authHeaders,
      body: verificationData,
      expectedStatus: [201],
    });
  }

  static async getParentalConsentRequests(authHeaders: Record<string, string>): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/parental-consent',
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  // Audit Log API helpers
  static async getAuditLogs(authHeaders: Record<string, string>, filters?: any): Promise<TestResult> {
    const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return makeRequest({
      path: `/api/gdpr/audit-logs${queryString}`,
      method: 'GET',
      headers: authHeaders,
      expectedStatus: [200],
    });
  }

  // Compliance Export API helpers
  static async exportUserData(authHeaders: Record<string, string>, userId?: string): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/export/user-data',
      method: 'POST',
      headers: authHeaders,
      body: userId ? { userId } : {},
      expectedStatus: [200, 202], // 202 for async processing
    });
  }

  static async exportComplianceReport(authHeaders: Record<string, string>, reportType: string): Promise<TestResult> {
    return makeRequest({
      path: '/api/gdpr/export/compliance-report',
      method: 'POST',
      headers: authHeaders,
      body: { reportType },
      expectedStatus: [200, 202],
    });
  }
}

// Compliance validation helpers
export class GdprComplianceValidator {
  
  // Validate consent record compliance
  static validateConsentRecord(consentRecord: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!consentRecord.consentType) errors.push('Missing consentType');
    if (!consentRecord.lawfulBasis) errors.push('Missing lawfulBasis');
    if (!consentRecord.purpose) errors.push('Missing purpose');
    if (!consentRecord.policyVersion) errors.push('Missing policyVersion');
    if (!consentRecord.timestamp) errors.push('Missing timestamp');
    
    // Validate consent types
    const validConsentTypes = ['cookie_consent', 'marketing_consent', 'data_processing', 'third_party_sharing'];
    if (consentRecord.consentType && !validConsentTypes.includes(consentRecord.consentType)) {
      errors.push(`Invalid consentType: ${consentRecord.consentType}`);
    }
    
    // Validate lawful basis
    const validLawfulBases = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'];
    if (consentRecord.lawfulBasis && !validLawfulBases.includes(consentRecord.lawfulBasis)) {
      errors.push(`Invalid lawfulBasis: ${consentRecord.lawfulBasis}`);
    }
    
    // Validate timestamp format
    if (consentRecord.timestamp && isNaN(Date.parse(consentRecord.timestamp))) {
      errors.push('Invalid timestamp format');
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Validate user rights request compliance
  static validateUserRightRequest(request: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!request.requestType) errors.push('Missing requestType');
    if (!request.reason) errors.push('Missing reason');
    if (!request.timestamp) errors.push('Missing timestamp');
    
    // Validate request types
    const validRequestTypes = ['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability'];
    if (request.requestType && !validRequestTypes.includes(request.requestType)) {
      errors.push(`Invalid requestType: ${request.requestType}`);
    }
    
    // Validate SLA tracking
    if (request.requestedAt) {
      const requestDate = new Date(request.requestedAt);
      const dueDate = new Date(requestDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days SLA
      
      const now = new Date();
      if (now > dueDate && request.status !== 'completed') {
        errors.push('Request is overdue (30-day SLA violated)');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Validate data breach compliance
  static validateDataBreach(breach: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!breach.title) errors.push('Missing title');
    if (!breach.description) errors.push('Missing description');
    if (!breach.severity) errors.push('Missing severity');
    if (!breach.affectedDataTypes) errors.push('Missing affectedDataTypes');
    if (!breach.discoveredAt) errors.push('Missing discoveredAt');
    
    // Validate 72-hour ICO notification requirement
    if (breach.discoveredAt && breach.severity !== 'low') {
      const discoveryTime = new Date(breach.discoveredAt);
      const deadline = new Date(discoveryTime);
      deadline.setHours(deadline.getHours() + 72);
      
      const now = new Date();
      if (now > deadline && !breach.icoNotifiedAt) {
        errors.push('ICO notification deadline (72 hours) violated');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Validate audit log integrity
  static validateAuditLogIntegrity(auditLog: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!auditLog.action) errors.push('Missing action');
    if (!auditLog.resource) errors.push('Missing resource');
    if (!auditLog.timestamp) errors.push('Missing timestamp');
    if (!auditLog.userId && !auditLog.adminId) errors.push('Missing userId or adminId');
    if (!auditLog.ipAddress) errors.push('Missing ipAddress');
    if (!auditLog.userAgent) errors.push('Missing userAgent');
    
    // Validate immutability requirements
    if (auditLog.modifiedAt || auditLog.deletedAt) {
      errors.push('Audit log appears to have been modified (immutability violation)');
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Validate PECR cookie compliance
  static validateCookieCompliance(cookieData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check granular consent
    if (!cookieData.cookieConsents) {
      errors.push('Missing cookieConsents');
    } else {
      const required = ['strictlyNecessary', 'functional', 'analytics', 'advertising'];
      for (const category of required) {
        if (!(category in cookieData.cookieConsents)) {
          errors.push(`Missing cookie consent for ${category}`);
        }
      }
      
      // Strictly necessary should always be true
      if (cookieData.cookieConsents.strictlyNecessary !== true) {
        errors.push('Strictly necessary cookies must be accepted');
      }
    }
    
    // Check consent expiry (12 months for PECR)
    if (cookieData.consentDate) {
      const consentDate = new Date(cookieData.consentDate);
      const expiryDate = new Date(consentDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      const now = new Date();
      if (now > expiryDate) {
        errors.push('Cookie consent has expired (PECR 12-month limit)');
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

// Test scenario builders
export class GdprTestScenarios {
  
  // Complete consent workflow scenario
  static async testConsentWorkflow(userEmail: string): Promise<{ success: boolean; details: any }> {
    const authHeaders = testAuth.getAuthHeaders(userEmail);
    const details: any = { steps: [] };
    
    try {
      // Step 1: Submit initial consent
      const consentData = testDataGenerator.generateConsentRecord();
      const submitResponse = await GdprApiHelper.submitConsent(authHeaders, consentData);
      details.steps.push({ step: 'submit_consent', success: true, response: submitResponse.body });
      
      // Step 2: Retrieve consent
      const getResponse = await GdprApiHelper.getConsent(authHeaders);
      details.steps.push({ step: 'get_consent', success: true, response: getResponse.body });
      
      // Step 3: Modify consent
      const updatedConsent = { ...consentData, cookieConsents: { ...consentData.cookieConsents, analytics: true } };
      const updateResponse = await GdprApiHelper.submitConsent(authHeaders, updatedConsent);
      details.steps.push({ step: 'update_consent', success: true, response: updateResponse.body });
      
      // Step 4: Withdraw consent
      const withdrawResponse = await GdprApiHelper.withdrawConsent(authHeaders, 'cookie_consent');
      details.steps.push({ step: 'withdraw_consent', success: true, response: withdrawResponse.body });
      
      return { success: true, details };
    } catch (error) {
      details.error = error;
      return { success: false, details };
    }
  }

  // Complete user rights request scenario
  static async testUserRightsWorkflow(userEmail: string, adminEmail: string): Promise<{ success: boolean; details: any }> {
    const userHeaders = testAuth.getAuthHeaders(userEmail);
    const adminHeaders = testAuth.getAuthHeaders(adminEmail);
    const details: any = { steps: [] };
    
    try {
      // Step 1: User submits access request
      const requestData = testDataGenerator.generateUserRightRequest('access');
      const submitResponse = await GdprApiHelper.submitUserRightRequest(userHeaders, requestData);
      details.steps.push({ step: 'submit_request', success: true, response: submitResponse.body });
      
      const requestId = submitResponse.body?.id;
      if (!requestId) throw new Error('No request ID returned');
      
      // Step 2: Admin processes request
      const processResponse = await GdprApiHelper.processUserRightRequest(adminHeaders, requestId, 'approve');
      details.steps.push({ step: 'process_request', success: true, response: processResponse.body });
      
      // Step 3: Export user data
      const exportResponse = await GdprApiHelper.exportUserData(adminHeaders);
      details.steps.push({ step: 'export_data', success: true, response: exportResponse.body });
      
      return { success: true, details };
    } catch (error) {
      details.error = error;
      return { success: false, details };
    }
  }

  // Data breach notification scenario
  static async testBreachWorkflow(adminEmail: string): Promise<{ success: boolean; details: any }> {
    const authHeaders = testAuth.getAuthHeaders(adminEmail);
    const details: any = { steps: [] };
    
    try {
      // Step 1: Report breach
      const breachData = testDataGenerator.generateDataBreach({ severity: 'high' });
      const reportResponse = await GdprApiHelper.reportBreach(authHeaders, breachData);
      details.steps.push({ step: 'report_breach', success: true, response: reportResponse.body });
      
      const breachId = reportResponse.body?.id;
      if (!breachId) throw new Error('No breach ID returned');
      
      // Step 2: Update breach status to contained
      const containResponse = await GdprApiHelper.updateBreachStatus(authHeaders, breachId, 'assessed');
      details.steps.push({ step: 'assess_breach', success: true, response: containResponse.body });
      
      // Step 3: Mark as ICO notified
      const notifyResponse = await GdprApiHelper.updateBreachStatus(authHeaders, breachId, 'notified_ico');
      details.steps.push({ step: 'notify_ico', success: true, response: notifyResponse.body });
      
      return { success: true, details };
    } catch (error) {
      details.error = error;
      return { success: false, details };
    }
  }
}

// RBAC testing helpers
export class GdprRbacTester {
  
  // Test role-based access to GDPR endpoints
  static async testEndpointAccess(endpoint: string, method: string, userRole: string, userEmail: string): Promise<{ authorized: boolean; statusCode: number }> {
    const authHeaders = testAuth.getAuthHeaders(userEmail);
    
    try {
      const response = await makeRequest({
        path: endpoint,
        method,
        headers: authHeaders,
        expectedStatus: [200, 201, 400, 401, 403, 404], // Accept various status codes
      });
      
      const authorized = ![401, 403].includes(response.statusCode);
      return { authorized, statusCode: response.statusCode };
    } catch (error) {
      return { authorized: false, statusCode: 500 };
    }
  }

  // Test organization data isolation
  static async testDataIsolation(userEmail1: string, userEmail2: string, dataEndpoint: string): Promise<{ isolated: boolean; details: any }> {
    const headers1 = testAuth.getAuthHeaders(userEmail1);
    const headers2 = testAuth.getAuthHeaders(userEmail2);
    
    try {
      // Get data as user 1
      const response1 = await makeRequest({
        path: dataEndpoint,
        headers: headers1,
        expectedStatus: [200, 404],
      });
      
      // Get data as user 2
      const response2 = await makeRequest({
        path: dataEndpoint,
        headers: headers2,
        expectedStatus: [200, 404],
      });
      
      // Data should be different or one should be forbidden
      const isolated = JSON.stringify(response1.body) !== JSON.stringify(response2.body) ||
                      [401, 403].includes(response1.statusCode) ||
                      [401, 403].includes(response2.statusCode);
      
      return {
        isolated,
        details: {
          user1Response: response1.statusCode,
          user2Response: response2.statusCode,
          user1DataCount: response1.body?.length || 0,
          user2DataCount: response2.body?.length || 0,
        }
      };
    } catch (error) {
      return { isolated: false, details: { error: error.message } };
    }
  }
}

// Classes already exported above with 'export class' syntax