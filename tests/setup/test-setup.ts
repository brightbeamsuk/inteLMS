/**
 * Comprehensive GDPR Testing Setup and Configuration
 * 
 * This module provides the foundational testing infrastructure for GDPR compliance
 * testing including database isolation, authentication utilities, and test configuration.
 */

import { test, describe, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { URL } from 'node:url';

// Test configuration
export const TEST_CONFIG = {
  host: process.env.TEST_HOST || 'localhost',
  port: parseInt(process.env.TEST_PORT || '5000'),
  timeout: 30000, // 30 seconds timeout for tests
  enableGdpr: true, // Force GDPR enabled for tests
  testDataPrefix: 'TEST_',
  dbIsolation: true,
};

export const BASE_URL = `http://${TEST_CONFIG.host}:${TEST_CONFIG.port}`;

// Test result tracking
export interface TestResult {
  statusCode: number;
  headers: any;
  body: any;
  duration: number;
}

// Enhanced HTTP request utility with comprehensive error handling
export async function makeRequest(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  expectedStatus?: number | number[];
}): Promise<TestResult> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GDPR-Test-Suite/1.0',
        ...options.headers,
      },
      timeout: options.timeout || TEST_CONFIG.timeout,
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        let parsedBody;
        
        try {
          parsedBody = data ? JSON.parse(data) : null;
        } catch (error) {
          parsedBody = data; // Return raw data if not JSON
        }

        const result: TestResult = {
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsedBody,
          duration,
        };

        // Validate expected status if provided
        if (options.expectedStatus) {
          const expectedStatuses = Array.isArray(options.expectedStatus) 
            ? options.expectedStatus 
            : [options.expectedStatus];
          
          if (!expectedStatuses.includes(result.statusCode)) {
            reject(new Error(
              `Unexpected status code ${result.statusCode}, expected ${expectedStatuses.join(' or ')}. ` +
              `Response: ${JSON.stringify(result.body)}`
            ));
            return;
          }
        }

        resolve(result);
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${options.timeout || TEST_CONFIG.timeout}ms`));
    });

    if (options.body) {
      const bodyData = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
      req.write(bodyData);
    }

    req.end();
  });
}

// Enhanced authentication utilities for GDPR testing
export class TestAuthManager {
  private sessions: Map<string, any> = new Map();
  
  // Create test users with different roles for RBAC testing
  async createTestUser(role: 'user' | 'admin' | 'superadmin', orgId?: string) {
    const userData = {
      email: `test_${role}_${Date.now()}@gdprtest.local`,
      firstName: `Test${role.charAt(0).toUpperCase() + role.slice(1)}`,
      lastName: 'User',
      password: 'TestPassword123!',
      role,
      organisationId: orgId || (role === 'superadmin' ? null : 'test_org_1'),
      isActive: true,
      emailVerified: true,
    };

    const response = await makeRequest({
      path: '/api/auth/register',
      method: 'POST',
      body: userData,
      expectedStatus: [201, 409], // Accept conflict if user exists
    });

    return { userData, response };
  }

  // Authenticate and get session cookies
  async authenticate(email: string, password: string): Promise<string> {
    const response = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      body: { email, password },
      expectedStatus: [200, 302],
    });

    // Extract session cookie from Set-Cookie header
    const setCookie = response.headers['set-cookie'];
    if (setCookie && Array.isArray(setCookie)) {
      const sessionCookie = setCookie.find(cookie => cookie.startsWith('session='));
      if (sessionCookie) {
        const cookieValue = sessionCookie.split(';')[0];
        this.sessions.set(email, cookieValue);
        return cookieValue;
      }
    }

    throw new Error('Failed to extract session cookie from login response');
  }

  // Get authenticated headers for requests
  getAuthHeaders(email: string): Record<string, string> {
    const sessionCookie = this.sessions.get(email);
    if (!sessionCookie) {
      throw new Error(`No session found for ${email}. Call authenticate() first.`);
    }

    return {
      'Cookie': sessionCookie,
    };
  }

  // Clean up test sessions
  cleanup() {
    this.sessions.clear();
  }
}

// Test database utilities for GDPR compliance testing
export class TestDatabaseManager {
  private testDataIds: Set<string> = new Set();
  
  // Create isolated test organization
  async createTestOrganization(name?: string) {
    const orgData = {
      name: name || `${TEST_CONFIG.testDataPrefix}Org_${Date.now()}`,
      domain: `gdprtest${Date.now()}.local`,
      isActive: true,
      settings: {
        gdprCompliance: true,
        dataRetentionPeriod: 365,
        cookieConsentRequired: true,
      },
    };

    const response = await makeRequest({
      path: '/api/organizations',
      method: 'POST',
      body: orgData,
      expectedStatus: [201],
    });

    if (response.body?.id) {
      this.testDataIds.add(`org_${response.body.id}`);
    }

    return { orgData, response };
  }

  // Mark data for cleanup
  markForCleanup(type: string, id: string) {
    this.testDataIds.add(`${type}_${id}`);
  }

  // Clean up test data
  async cleanup() {
    console.log(`Cleaning up ${this.testDataIds.size} test data entries...`);
    
    for (const item of this.testDataIds) {
      try {
        const [type, id] = item.split('_', 2);
        
        switch (type) {
          case 'org':
            await makeRequest({
              path: `/api/organizations/${id}`,
              method: 'DELETE',
              expectedStatus: [200, 204, 404], // 404 if already deleted
            });
            break;
          case 'user':
            await makeRequest({
              path: `/api/users/${id}`,
              method: 'DELETE',
              expectedStatus: [200, 204, 404],
            });
            break;
          // Add more cleanup types as needed
        }
      } catch (error) {
        console.warn(`Failed to cleanup ${item}:`, error);
      }
    }

    this.testDataIds.clear();
  }
}

// GDPR test data generators
export class GdprTestDataGenerator {
  
  // Generate test consent record
  generateConsentRecord(overrides: Partial<any> = {}) {
    return {
      consentType: 'cookie_consent',
      lawfulBasis: 'consent' as const,
      purpose: 'Testing GDPR compliance functionality',
      policyVersion: '2.0',
      marketingConsents: {
        email: false,
        sms: false,
        phone: false,
        post: false,
        pushNotifications: false,
      },
      cookieConsents: {
        strictlyNecessary: true,
        functional: false,
        analytics: false,
        advertising: false,
      },
      metadata: {
        source: 'automated_test',
        timestamp: new Date().toISOString(),
        userAgent: 'GDPR-Test-Suite/1.0',
        ipAddress: '127.0.0.1',
      },
      ...overrides,
    };
  }

  // Generate test user rights request
  generateUserRightRequest(type: string, overrides: Partial<any> = {}) {
    return {
      requestType: type,
      reason: `Testing ${type} workflow for GDPR compliance`,
      urgency: 'normal',
      metadata: {
        source: 'automated_test',
        timestamp: new Date().toISOString(),
        userAgent: 'GDPR-Test-Suite/1.0',
        ipAddress: '127.0.0.1',
      },
      ...overrides,
    };
  }

  // Generate test cookie inventory
  generateCookieInventory(overrides: Partial<any> = {}) {
    return {
      name: `test_cookie_${Date.now()}`,
      purpose: 'Testing cookie compliance',
      category: 'strictly_necessary' as const,
      duration: '1 year',
      thirdParty: false,
      domains: ['gdprtest.local'],
      legalBasis: 'legitimate_interests',
      description: 'Test cookie for GDPR compliance validation',
      ...overrides,
    };
  }

  // Generate test data breach record
  generateDataBreach(overrides: Partial<any> = {}) {
    return {
      title: `Test Breach ${Date.now()}`,
      description: 'Simulated data breach for testing purposes',
      severity: 'medium' as const,
      affectedDataTypes: ['identity', 'contact'],
      affectedIndividuals: 1,
      containmentMeasures: 'Automated test containment',
      assessmentNotes: 'Test breach assessment',
      riskLevel: 'low',
      notificationRequired: false,
      ...overrides,
    };
  }
}

// Global test instances
export const testAuth = new TestAuthManager();
export const testDb = new TestDatabaseManager();
export const testDataGenerator = new GdprTestDataGenerator();

// Test environment validation
export async function validateTestEnvironment() {
  console.log('🔍 Validating test environment...');
  
  try {
    // Check server connectivity
    const healthCheck = await makeRequest({
      path: '/api/health',
      method: 'GET',
      expectedStatus: [200, 404], // 404 is acceptable if no health endpoint
      timeout: 5000,
    });
    
    console.log('✅ Server connectivity verified');
    
    // Verify GDPR compliance is enabled for testing
    process.env.GDPR_COMPLIANCE_ENABLED = 'true';
    console.log('✅ GDPR compliance enabled for testing');
    
    // Check database connectivity (implied by successful API calls)
    console.log('✅ Database connectivity implied');
    
    return true;
  } catch (error) {
    console.error('❌ Test environment validation failed:', error);
    throw new Error(`Test environment validation failed: ${error}`);
  }
}

// Global test setup and teardown
export async function globalTestSetup() {
  console.log('🚀 Setting up GDPR test environment...');
  await validateTestEnvironment();
  
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.GDPR_COMPLIANCE_ENABLED = 'true';
  
  console.log('✅ GDPR test environment ready');
}

export async function globalTestTeardown() {
  console.log('🧹 Cleaning up GDPR test environment...');
  
  try {
    await testDb.cleanup();
    testAuth.cleanup();
    console.log('✅ Test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Test cleanup had issues:', error);
  }
}

// Export test utilities
export { test, describe, beforeEach, afterEach, before, after, assert };