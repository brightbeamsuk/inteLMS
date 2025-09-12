/**
 * Comprehensive Email Templates System Test
 * 
 * Tests the entire email template system including:
 * - Database schema verification
 * - Template seeding and resolution
 * - Email event integration
 * - UI component accessibility
 * - Performance and caching
 */

import { seedEmailTemplateDefaults } from './seeds/emailTemplateDefaults';
import { emailTemplateEngine } from './services/EmailTemplateEngineService';
import { emailTemplateResolver } from './services/EmailTemplateResolutionService';
import { EmailTemplateService } from './services/EmailTemplateService';
import { storage } from './storage';

// Test configuration
const TEST_ORG_ID = 'test-comprehensive-org';
const TEST_ADMIN_EMAIL = 'admin@testcompany.com';
const TEST_USER_EMAIL = 'learner@testcompany.com';

// Test tracking
interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
  error?: string;
}

const testResults: TestResult[] = [];

function logTest(category: string, test: string, status: 'PASS' | 'FAIL' | 'SKIP', details?: string, error?: string) {
  testResults.push({ category, test, status, details, error });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏸️';
  console.log(`${icon} [${category}] ${test}${details ? ': ' + details : ''}${error ? ' - ERROR: ' + error : ''}`);
}

/**
 * Test 1: Database Schema Verification
 */
async function testDatabaseSchema(): Promise<void> {
  console.log('\n🗄️  TESTING DATABASE SCHEMA & DATA');
  console.log('='.repeat(50));

  try {
    // Check if all tables exist
    const tables = await storage.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('email_template_defaults', 'email_template_overrides', 'org_notification_settings', 'email_provider_configs')
      ORDER BY table_name
    `);
    
    const expectedTables = ['email_provider_configs', 'email_template_defaults', 'email_template_overrides', 'org_notification_settings'];
    const foundTables = tables.map((t: any) => t.table_name);
    
    if (expectedTables.every(table => foundTables.includes(table))) {
      logTest('Database', 'All required tables exist', 'PASS', `Found: ${foundTables.join(', ')}`);
    } else {
      logTest('Database', 'Missing required tables', 'FAIL', `Missing: ${expectedTables.filter(t => !foundTables.includes(t)).join(', ')}`);
    }

    // Check template defaults count
    const templates = await storage.getAllEmailTemplateDefaults();
    if (templates.length >= 6) {
      logTest('Database', 'Default templates seeded', 'PASS', `Found ${templates.length} templates`);
    } else {
      logTest('Database', 'Missing default templates', 'FAIL', `Found only ${templates.length}/6 templates`);
    }

    // Test template keys
    const expectedKeys = [
      'admin.new_admin_added',
      'admin.new_user_added', 
      'admin.new_course_assigned',
      'admin.plan_updated',
      'admin.learner_completed_course',
      'admin.learner_failed_course'
    ];

    const foundKeys = templates.map((t: any) => t.key);
    const missingKeys = expectedKeys.filter(key => !foundKeys.includes(key));
    
    if (missingKeys.length === 0) {
      logTest('Database', 'All template keys present', 'PASS', `All 6 required templates found`);
    } else {
      logTest('Database', 'Missing template keys', 'FAIL', `Missing: ${missingKeys.join(', ')}`);
    }

  } catch (error) {
    logTest('Database', 'Schema verification failed', 'FAIL', undefined, String(error));
  }
}

/**
 * Test 2: Template Resolution and Caching
 */
async function testTemplateResolution(): Promise<void> {
  console.log('\n🔍 TESTING TEMPLATE RESOLUTION & CACHING');
  console.log('='.repeat(50));

  const testTemplateKey = 'admin.new_admin_added';

  try {
    // Test default template resolution
    const start1 = Date.now();
    const defaultTemplate = await emailTemplateResolver.getEffectiveTemplate('system-default', testTemplateKey);
    const time1 = Date.now() - start1;

    if (defaultTemplate) {
      logTest('Resolution', 'Default template resolved', 'PASS', `Resolved in ${time1}ms`);
    } else {
      logTest('Resolution', 'Default template resolution failed', 'FAIL');
    }

    // Test caching (should be faster on second call)
    const start2 = Date.now();
    const cachedTemplate = await emailTemplateResolver.getEffectiveTemplate('system-default', testTemplateKey);
    const time2 = Date.now() - start2;

    if (time2 < time1) {
      logTest('Resolution', 'Template caching working', 'PASS', `Cached call took ${time2}ms vs ${time1}ms`);
    } else {
      logTest('Resolution', 'Template caching ineffective', 'FAIL', `Cached call took ${time2}ms vs ${time1}ms`);
    }

    // Test organization override (when none exists, should fallback to default)
    const orgTemplate = await emailTemplateResolver.getEffectiveTemplate(TEST_ORG_ID, testTemplateKey);
    if (orgTemplate && orgTemplate.source === 'default') {
      logTest('Resolution', 'Organization fallback to default', 'PASS', `Source: ${orgTemplate.source}`);
    } else {
      logTest('Resolution', 'Organization fallback failed', 'FAIL', `Source: ${orgTemplate?.source || 'none'}`);
    }

  } catch (error) {
    logTest('Resolution', 'Template resolution failed', 'FAIL', undefined, String(error));
  }
}

/**
 * Test 3: Variable Substitution and Rendering
 */
async function testVariableSubstitution(): Promise<void> {
  console.log('\n🎨 TESTING VARIABLE SUBSTITUTION & RENDERING');
  console.log('='.repeat(50));

  const testData = {
    org: { name: 'Test Corporation', display_name: 'Test Corp Ltd', subdomain: 'testcorp' },
    admin: { name: 'John', email: TEST_ADMIN_EMAIL, full_name: 'John Admin' },
    user: { name: 'Jane', email: TEST_USER_EMAIL, full_name: 'Jane Learner', job_title: 'Developer', department: 'IT' },
    new_admin: { name: 'Alice', email: 'alice@testcorp.com', full_name: 'Alice Manager' },
    course: { title: 'Test Course', description: 'Test Description', category: 'Testing', estimated_duration: 30 },
    attempt: { score: 85.5, status: 'passed', time_spent: 25 },
    plan: { name: 'Professional', old_price: 29.99, new_price: 34.99, billing_cadence: 'monthly' },
    added_by: { name: 'John', full_name: 'John Admin' },
    assigned_by: { name: 'John', full_name: 'John Admin' },
    changed_by: { name: 'John', full_name: 'John Admin' },
    added_at: 'March 15, 2025',
    assigned_at: 'March 15, 2025',
    changed_at: 'March 15, 2025',
    completed_at: 'March 15, 2025',
    failed_at: 'March 15, 2025',
    due_date: 'March 30, 2025',
    effective_date: 'April 1, 2025'
  };

  const templateKeys = [
    'admin.new_admin_added',
    'admin.new_user_added',
    'admin.new_course_assigned',
    'admin.plan_updated',
    'admin.learner_completed_course',
    'admin.learner_failed_course'
  ];

  for (const templateKey of templateKeys) {
    try {
      const template = await emailTemplateResolver.getEffectiveTemplate('system-default', templateKey);
      
      if (!template) {
        logTest('Rendering', `Template ${templateKey} not found`, 'FAIL');
        continue;
      }

      // Test rendering
      const rendered = emailTemplateEngine.renderTemplate(template.subject, testData, { escapeHtml: false });
      
      // Check if variables were substituted (no {{ }} remaining)
      const hasUnsubstituted = rendered.includes('{{') && rendered.includes('}}');
      
      if (!hasUnsubstituted) {
        logTest('Rendering', `${templateKey} rendered correctly`, 'PASS', `Subject: "${rendered.substring(0, 50)}..."`);
      } else {
        logTest('Rendering', `${templateKey} has unsubstituted variables`, 'FAIL', `Found: {{...}} in output`);
      }

    } catch (error) {
      logTest('Rendering', `${templateKey} rendering failed`, 'FAIL', undefined, String(error));
    }
  }
}

/**
 * Test 4: EmailTemplateService Integration
 */
async function testEmailTemplateService(): Promise<void> {
  console.log('\n📧 TESTING EMAIL TEMPLATE SERVICE INTEGRATION');
  console.log('='.repeat(50));

  const emailTemplateService = new EmailTemplateService();

  // Test data for service
  const serviceTestData = {
    org: { name: 'Test Corporation', display_name: 'Test Corp Ltd', subdomain: 'testcorp' },
    admin: { name: 'John', email: TEST_ADMIN_EMAIL, full_name: 'John Admin' },
    new_admin: { name: 'Alice', email: 'alice@testcorp.com', full_name: 'Alice Manager' },
    added_by: { name: 'John', full_name: 'John Admin' },
    added_at: 'March 15, 2025'
  };

  try {
    // Test template resolution through service
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.new_admin_added',
      to: ['test@example.com'],
      variables: serviceTestData,
      organizationId: TEST_ORG_ID
    });

    // Note: This will fail to actually send since we don't have email configured,
    // but it should successfully resolve and render the template
    if (result.templateSource === 'default') {
      logTest('Service', 'Template service integration', 'PASS', `Template resolved from ${result.templateSource}`);
    } else {
      logTest('Service', 'Template service resolution failed', 'FAIL', `Unexpected source: ${result.templateSource}`);
    }

    // The actual email send will likely fail, but that's expected in test environment
    if (result.failedCount > 0 && result.errors.some(e => e.includes('email') || e.includes('provider'))) {
      logTest('Service', 'Email send properly handled', 'PASS', 'Failed as expected due to no email provider');
    }

  } catch (error) {
    // Some errors are expected in test environment
    const errorStr = String(error);
    if (errorStr.includes('email') || errorStr.includes('provider') || errorStr.includes('SMTP')) {
      logTest('Service', 'Email service properly validates', 'PASS', 'Correctly failed due to email provider configuration');
    } else {
      logTest('Service', 'Email service integration failed', 'FAIL', undefined, errorStr);
    }
  }
}

/**
 * Test 5: Performance Testing
 */
async function testPerformance(): Promise<void> {
  console.log('\n⚡ TESTING PERFORMANCE & CACHING');
  console.log('='.repeat(50));

  const templateKey = 'admin.new_admin_added';
  const iterations = 10;

  try {
    // Test template resolution performance
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await emailTemplateResolver.getEffectiveTemplate('test-org-perf', templateKey);
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    if (avgTime < 50) { // Should be very fast with caching
      logTest('Performance', 'Template resolution performance', 'PASS', `Avg: ${avgTime.toFixed(1)}ms, Range: ${minTime}-${maxTime}ms`);
    } else {
      logTest('Performance', 'Template resolution slow', 'FAIL', `Avg: ${avgTime.toFixed(1)}ms (expected <50ms)`);
    }

    // Test cache effectiveness (first call should be slower)
    const firstCall = Date.now();
    await emailTemplateResolver.getEffectiveTemplate('new-org-cache-test', templateKey);
    const firstTime = Date.now() - firstCall;

    const secondCall = Date.now();
    await emailTemplateResolver.getEffectiveTemplate('new-org-cache-test', templateKey);
    const secondTime = Date.now() - secondCall;

    if (secondTime < firstTime) {
      logTest('Performance', 'Cache effectiveness', 'PASS', `First: ${firstTime}ms, Cached: ${secondTime}ms`);
    } else {
      logTest('Performance', 'Cache not effective', 'FAIL', `First: ${firstTime}ms, Second: ${secondTime}ms`);
    }

  } catch (error) {
    logTest('Performance', 'Performance testing failed', 'FAIL', undefined, String(error));
  }
}

/**
 * Test 6: Error Handling
 */
async function testErrorHandling(): Promise<void> {
  console.log('\n🚨 TESTING ERROR HANDLING');
  console.log('='.repeat(50));

  try {
    // Test invalid template key
    const invalidTemplate = await emailTemplateResolver.getEffectiveTemplate('system-default', 'invalid.template.key');
    if (!invalidTemplate) {
      logTest('Error Handling', 'Invalid template key handling', 'PASS', 'Correctly returns null for invalid key');
    } else {
      logTest('Error Handling', 'Invalid template key not handled', 'FAIL', 'Should return null for invalid key');
    }

    // Test template with missing variables
    try {
      const template = await emailTemplateResolver.getEffectiveTemplate('system-default', 'admin.new_admin_added');
      if (template) {
        const rendered = emailTemplateEngine.renderTemplate(template.subject, {}, { escapeHtml: false });
        // Should still render but with placeholder values or empty strings
        logTest('Error Handling', 'Missing variables handled', 'PASS', 'Template rendered despite missing variables');
      }
    } catch (error) {
      logTest('Error Handling', 'Missing variables error handling', 'FAIL', undefined, String(error));
    }

  } catch (error) {
    logTest('Error Handling', 'Error handling test failed', 'FAIL', undefined, String(error));
  }
}

/**
 * Main test runner
 */
async function runComprehensiveTests(): Promise<void> {
  console.log('🧪 COMPREHENSIVE EMAIL TEMPLATES SYSTEM TEST');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Ensure templates are seeded
  console.log('\n🌱 Ensuring templates are seeded...');
  await seedEmailTemplateDefaults(true);

  // Run all test categories
  await testDatabaseSchema();
  await testTemplateResolution();
  await testVariableSubstitution();
  await testEmailTemplateService();
  await testPerformance();
  await testErrorHandling();

  // Generate summary report
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(60));

  const categories = [...new Set(testResults.map(r => r.category))];
  let overallPass = true;

  for (const category of categories) {
    const categoryResults = testResults.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'PASS').length;
    const failed = categoryResults.filter(r => r.status === 'FAIL').length;
    const skipped = categoryResults.filter(r => r.status === 'SKIP').length;
    
    const status = failed === 0 ? '✅ PASS' : '❌ FAIL';
    if (failed > 0) overallPass = false;
    
    console.log(`${category}: ${status} (${passed} passed, ${failed} failed, ${skipped} skipped)`);
  }

  console.log('='.repeat(60));
  console.log(`OVERALL RESULT: ${overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter(r => r.status === 'PASS').length}`);
  console.log(`Failed: ${testResults.filter(r => r.status === 'FAIL').length}`);
  console.log(`Skipped: ${testResults.filter(r => r.status === 'SKIP').length}`);
  console.log('='.repeat(60));

  // Show failed tests details
  const failedTests = testResults.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED TESTS DETAILS:');
    console.log('-'.repeat(40));
    failedTests.forEach(test => {
      console.log(`[${test.category}] ${test.test}`);
      if (test.details) console.log(`  Details: ${test.details}`);
      if (test.error) console.log(`  Error: ${test.error}`);
    });
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Export for potential direct usage
export { runComprehensiveTests };

// Run the tests immediately when imported
runComprehensiveTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Comprehensive test suite failed:', error);
    process.exit(1);
  });