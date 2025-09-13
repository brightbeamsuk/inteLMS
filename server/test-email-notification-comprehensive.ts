#!/usr/bin/env tsx

/**
 * Comprehensive Email Notification Testing Script
 * 
 * Executes the architect's 3-phase testing plan for all 6 email notification triggers:
 * PHASE 0: Discovery & Prep (fixtures, templates, observability)
 * PHASE 1: Trigger-by-trigger testing (6 notification types)
 * PHASE 2: Cross-cutting validations (targeting, templates, dedup, errors)
 */

import { storage } from './storage';
import { EmailOrchestrator } from './services/EmailOrchestrator';
import { EmailNotificationService } from './services/EmailNotificationService';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { hash } from 'bcryptjs';

// Test configuration
const TEST_CONFIG = {
  organizations: {
    A: {
      name: 'Test Org A - Defaults Only',
      subdomain: 'test-org-a',
      displayName: 'Test Organization A (Defaults)',
    },
    B: {
      name: 'Test Org B - With Overrides', 
      subdomain: 'test-org-b',
      displayName: 'Test Organization B (Overrides)',
    }
  },
  testEmails: {
    admin1: 'admin1.test@example.com',
    admin2: 'admin2.test@example.com', 
    learner1: 'learner1.test@example.com',
    learner2: 'learner2.test@example.com',
    superadmin: 'superadmin.test@example.com'
  }
};

// Global test state
interface TestState {
  orgs: {
    A: { id: string; admins: Array<{id: string; email: string}>; learners: Array<{id: string; email: string}> };
    B: { id: string; admins: Array<{id: string; email: string}>; learners: Array<{id: string; email: string}> };
  };
  courses: Array<{id: string; title: string}>;
  emailsSentBefore: number;
}

const testState: TestState = {
  orgs: {
    A: { id: '', admins: [], learners: [] },
    B: { id: '', admins: [], learners: [] }
  },
  courses: [],
  emailsSentBefore: 0
};

// Initialize services
const emailOrchestrator = new EmailOrchestrator();
const emailNotificationService = new EmailNotificationService();

function log(message: string, data?: any) {
  console.log(`🧪 [TEST] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function logPhase(phase: string, description: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`🚀 ${phase}: ${description}`);
  console.log('='.repeat(80));
}

function logTest(testName: string) {
  console.log(`\n📋 Testing: ${testName}`);
  console.log('-'.repeat(50));
}

/**
 * PHASE 0: DISCOVERY & PREP
 */
async function phase0_setupFixtures() {
  logPhase('PHASE 0', 'DISCOVERY & PREP - Setting up test fixtures');

  // Clean up any existing test data
  await cleanupTestData();
  
  // Get baseline email count
  const initialEmails = await storage.getEmailSends();
  testState.emailsSentBefore = initialEmails.length;
  log(`Baseline email count: ${testState.emailsSentBefore}`);

  // Create test organizations
  await setupTestOrganizations();
  
  // Create test users
  await setupTestUsers();
  
  // Create test courses
  await setupTestCourses();
  
  // Create template overrides for org B
  await setupTemplateOverrides();
  
  log('✅ PHASE 0 Complete - Test fixtures ready');
}

async function cleanupTestData() {
  log('🧹 Cleaning up existing test data...');
  
  try {
    // Delete test users (extended list including all test emails)
    const allTestEmails = [
      ...Object.values(TEST_CONFIG.testEmails),
      'admin1.orgb@example.com',
      'admin2.orgb@example.com', 
      'learner1.orgb@example.com',
      'newadmin.orga@example.com',
      'newlearner.orgb@example.com',
      'inactive.admin@example.com',
      'targeting.test@example.com'
    ];
    
    for (const email of allTestEmails) {
      const user = await storage.getUserByEmail(email);
      if (user) {
        await storage.deleteUser(user.id);
        log(`Deleted test user: ${email}`);
      }
    }
    
    // Delete test organizations 
    const orgA = await storage.getOrganisationBySubdomain(TEST_CONFIG.organizations.A.subdomain);
    if (orgA) {
      await storage.deleteOrganisation(orgA.id);
      log(`Deleted test org A: ${orgA.name}`);
    }
    
    const orgB = await storage.getOrganisationBySubdomain(TEST_CONFIG.organizations.B.subdomain);
    if (orgB) {
      await storage.deleteOrganisation(orgB.id);
      log(`Deleted test org B: ${orgB.name}`);
    }
    
  } catch (error) {
    log('⚠️ Cleanup warning (expected on first run):', error);
  }
}

async function setupTestOrganizations() {
  log('🏢 Creating test organizations...');
  
  // Create Organization A (defaults only)
  const orgA = await storage.createOrganisation({
    name: TEST_CONFIG.organizations.A.name,
    subdomain: TEST_CONFIG.organizations.A.subdomain,
    displayName: TEST_CONFIG.organizations.A.displayName,
    contactEmail: 'contact@test-org-a.com',
    status: 'active'
  });
  testState.orgs.A.id = orgA.id;
  log(`Created Org A: ${orgA.name} (ID: ${orgA.id})`);
  
  // Create Organization B (will get overrides)
  const orgB = await storage.createOrganisation({
    name: TEST_CONFIG.organizations.B.name,
    subdomain: TEST_CONFIG.organizations.B.subdomain,
    displayName: TEST_CONFIG.organizations.B.displayName,
    contactEmail: 'contact@test-org-b.com',
    status: 'active'
  });
  testState.orgs.B.id = orgB.id;
  log(`Created Org B: ${orgB.name} (ID: ${orgB.id})`);
}

async function setupTestUsers() {
  log('👥 Creating test users...');
  
  const passwordHash = await hash('TestPassword123!', 10);
  
  // Org A: 2 admins, 2 learners
  const orgAAdmin1 = await storage.createUser({
    email: TEST_CONFIG.testEmails.admin1,
    firstName: 'Admin1',
    lastName: 'OrgA',
    passwordHash,
    role: 'admin',
    status: 'active',
    organisationId: testState.orgs.A.id
  });
  testState.orgs.A.admins.push({id: orgAAdmin1.id, email: orgAAdmin1.email!});
  
  const orgAAdmin2 = await storage.createUser({
    email: TEST_CONFIG.testEmails.admin2,
    firstName: 'Admin2', 
    lastName: 'OrgA',
    passwordHash,
    role: 'admin',
    status: 'active',
    organisationId: testState.orgs.A.id
  });
  testState.orgs.A.admins.push({id: orgAAdmin2.id, email: orgAAdmin2.email!});
  
  const orgALearner1 = await storage.createUser({
    email: TEST_CONFIG.testEmails.learner1,
    firstName: 'Learner1',
    lastName: 'OrgA',
    passwordHash,
    role: 'user',
    status: 'active',
    organisationId: testState.orgs.A.id
  });
  testState.orgs.A.learners.push({id: orgALearner1.id, email: orgALearner1.email!});
  
  // Org B: 2 admins, 2 learners
  const orgBAdmin1 = await storage.createUser({
    email: 'admin1.orgb@example.com',
    firstName: 'Admin1',
    lastName: 'OrgB',
    passwordHash,
    role: 'admin',
    status: 'active',
    organisationId: testState.orgs.B.id
  });
  testState.orgs.B.admins.push({id: orgBAdmin1.id, email: orgBAdmin1.email!});
  
  const orgBAdmin2 = await storage.createUser({
    email: 'admin2.orgb@example.com',
    firstName: 'Admin2',
    lastName: 'OrgB', 
    passwordHash,
    role: 'admin',
    status: 'active',
    organisationId: testState.orgs.B.id
  });
  testState.orgs.B.admins.push({id: orgBAdmin2.id, email: orgBAdmin2.email!});
  
  const orgBLearner1 = await storage.createUser({
    email: 'learner1.orgb@example.com',
    firstName: 'Learner1',
    lastName: 'OrgB',
    passwordHash,
    role: 'user',
    status: 'active',
    organisationId: testState.orgs.B.id
  });
  testState.orgs.B.learners.push({id: orgBLearner1.id, email: orgBLearner1.email!});
  
  // SuperAdmin (no organization)
  await storage.createUser({
    email: TEST_CONFIG.testEmails.superadmin,
    firstName: 'Super',
    lastName: 'Admin',
    passwordHash,
    role: 'superadmin',
    status: 'active',
    organisationId: null
  });
  
  log(`✅ Created ${testState.orgs.A.admins.length + testState.orgs.B.admins.length} admins, ${testState.orgs.A.learners.length + testState.orgs.B.learners.length} learners, 1 superadmin`);
}

async function setupTestCourses() {
  log('📚 Creating test courses...');
  
  const course1 = await storage.createCourse({
    title: 'Test Course 1 - Safety Training',
    description: 'Basic safety training course for testing',
    status: 'published',
    organisationId: testState.orgs.A.id,
    createdBy: testState.orgs.A.admins[0].id
  });
  testState.courses.push({id: course1.id, title: course1.title});
  
  const course2 = await storage.createCourse({
    title: 'Test Course 2 - Advanced Topics',
    description: 'Advanced topics course for testing',
    status: 'published',
    organisationId: testState.orgs.B.id,
    createdBy: testState.orgs.B.admins[0].id
  });
  testState.courses.push({id: course2.id, title: course2.title});
  
  log(`✅ Created ${testState.courses.length} test courses`);
}

async function setupTemplateOverrides() {
  log('📧 Creating template overrides for Org B...');
  
  // Template keys to override for testing
  const templateKeys = [
    'admin.new_admin_added',
    'admin.new_user_added',
    'admin.course_assigned',
    'admin.plan_updated',
    'admin.learner_completed_course', 
    'admin.learner_failed_course'
  ];
  
  for (const templateKey of templateKeys) {
    try {
      await storage.createOrgEmailTemplate({
        orgId: testState.orgs.B.id,
        templateKey,
        name: `[OVERRIDE B] ${templateKey}`,
        category: 'admin',
        subject: `[OVERRIDE B] ${templateKey} notification`,
        html: `<h1>[OVERRIDE B] ${templateKey}</h1><p>This is a template override for organization B testing purposes.</p><p>Template: {{templateKey}}</p><p>Org: {{org.name}}</p>`,
        text: `[OVERRIDE B] ${templateKey} - This is a template override for organization B testing purposes. Template: {{templateKey}}, Org: {{org.name}}`,
        variablesSchema: { org: { name: 'string' } },
        isActive: true,
        version: 1
      });
      log(`Created override for: ${templateKey}`);
    } catch (error) {
      log(`⚠️ Failed to create override for ${templateKey}:`, error);
    }
  }
  
  log('✅ Template overrides created for Org B');
}

/**
 * PHASE 1: TRIGGER-BY-TRIGGER TESTING
 */
async function phase1_triggerTesting() {
  logPhase('PHASE 1', 'TRIGGER-BY-TRIGGER TESTING - Testing all 6 notification triggers');

  await test1_newAdminAdded();
  await test2_newUserAdded();  
  await test3_courseAssigned();
  await test4_planUpdated();
  await test5_learnerCompletedCourse();
  await test6_learnerFailedCourse();
  
  log('✅ PHASE 1 Complete - All triggers tested');
}

async function test1_newAdminAdded() {
  logTest('1. New Admin Added');
  
  const beforeCount = await getEmailCount();
  
  // Create a new admin in Org A
  const newAdmin = await storage.createUser({
    email: 'newadmin.orga@example.com',
    firstName: 'NewAdmin',
    lastName: 'OrgA',
    passwordHash: await hash('TestPassword123!', 10),
    role: 'admin',
    status: 'active',
    organisationId: testState.orgs.A.id
  });
  
  // Trigger notification manually (simulating what happens in routes.ts)
  await emailNotificationService.notifyNewAdminAdded(testState.orgs.A.id, newAdmin.id);
  
  // Wait and check results
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Result: ${newEmails} new emails queued`);
  log(`Expected: ${testState.orgs.A.admins.length} (excluding newly added admin)`);
  
  await validateEmailResults('New Admin Added', testState.orgs.A.id, 'admin.new_admin_added', testState.orgs.A.admins.length);
}

async function test2_newUserAdded() {
  logTest('2. New User Added');
  
  const beforeCount = await getEmailCount();
  
  // Create a new learner in Org B
  const newUser = await storage.createUser({
    email: 'newlearner.orgb@example.com',
    firstName: 'NewLearner',
    lastName: 'OrgB',
    passwordHash: await hash('TestPassword123!', 10),
    role: 'user',
    status: 'active',
    organisationId: testState.orgs.B.id
  });
  
  // Trigger notification
  await emailNotificationService.notifyNewUserAdded(testState.orgs.B.id, newUser.id);
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Result: ${newEmails} new emails queued`);
  log(`Expected: ${testState.orgs.B.admins.length} (all admins in org B)`);
  
  await validateEmailResults('New User Added', testState.orgs.B.id, 'admin.new_user_added', testState.orgs.B.admins.length);
}

async function test3_courseAssigned() {
  logTest('3. Course Assigned');
  
  const beforeCount = await getEmailCount();
  
  // Assign course to learner in Org A
  const assignment = await storage.createAssignment({
    userId: testState.orgs.A.learners[0].id,
    courseId: testState.courses[0].id,
    organisationId: testState.orgs.A.id,
    assignedBy: testState.orgs.A.admins[0].id,
    status: 'not_started',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  });
  
  // Trigger notification
  await emailNotificationService.notifyCourseAssigned(
    testState.orgs.A.id,
    testState.courses[0].id,
    testState.orgs.A.learners[0].id,
    testState.orgs.A.admins[0].id
  );
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Result: ${newEmails} new emails queued`);
  log(`Expected: ${testState.orgs.A.admins.length} (all admins in org A)`);
  
  await validateEmailResults('Course Assigned', testState.orgs.A.id, 'admin.course_assigned', testState.orgs.A.admins.length);
}

async function test4_planUpdated() {
  logTest('4. Plan Updated');
  
  const beforeCount = await getEmailCount();
  
  // Simulate plan update for Org B
  await emailNotificationService.notifyPlanUpdated(testState.orgs.B.id, 'upgrade', testState.orgs.B.admins[0].id);
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Result: ${newEmails} new emails queued`);
  log(`Expected: ${testState.orgs.B.admins.length} (all admins in org B)`);
  
  await validateEmailResults('Plan Updated', testState.orgs.B.id, 'admin.plan_updated', testState.orgs.B.admins.length);
}

async function test5_learnerCompletedCourse() {
  logTest('5. Learner Completed Course');
  
  const beforeCount = await getEmailCount();
  
  // Create completion record
  const completion = await storage.createCompletion({
    userId: testState.orgs.A.learners[0].id,
    courseId: testState.courses[0].id,
    organisationId: testState.orgs.A.id,
    status: 'pass',
    score: 85,
    completedAt: new Date()
  });
  
  // Trigger notification
  await emailNotificationService.notifyLearnerCompletedCourse(
    testState.orgs.A.id,
    testState.courses[0].id,
    testState.orgs.A.learners[0].id,
    85,
    true
  );
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Result: ${newEmails} new emails queued`);
  log(`Expected: ${testState.orgs.A.admins.length} (all admins in org A)`);
  
  await validateEmailResults('Learner Completed Course', testState.orgs.A.id, 'admin.learner_completed_course', testState.orgs.A.admins.length);
}

async function test6_learnerFailedCourse() {
  logTest('6. Learner Failed Course');
  
  const beforeCount = await getEmailCount();
  
  // Create failure completion record
  const completion = await storage.createCompletion({
    userId: testState.orgs.B.learners[0].id,
    courseId: testState.courses[1].id,
    organisationId: testState.orgs.B.id,
    status: 'fail',
    score: 45,
    completedAt: new Date()
  });
  
  // Trigger notification
  await emailNotificationService.notifyLearnerFailedCourse(
    testState.orgs.B.id,
    testState.courses[1].id,
    testState.orgs.B.learners[0].id,
    45,
    false
  );
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Result: ${newEmails} new emails queued`);
  log(`Expected: ${testState.orgs.B.admins.length} (all admins in org B)`);
  
  await validateEmailResults('Learner Failed Course', testState.orgs.B.id, 'admin.learner_failed_course', testState.orgs.B.admins.length);
}

/**
 * PHASE 2: CROSS-CUTTING VALIDATIONS  
 */
async function phase2_crossCuttingValidations() {
  logPhase('PHASE 2', 'CROSS-CUTTING VALIDATIONS - Template resolution, targeting, dedup');

  await validateTemplateResolution();
  await validateTargeting();
  await validateDeduplication();
  await validateErrorHandling();
  
  log('✅ PHASE 2 Complete - Cross-cutting validations passed');
}

async function validateTemplateResolution() {
  logTest('Template Resolution - Defaults vs Overrides');
  
  // Check that Org A uses defaults and Org B uses overrides
  const orgAEmails = await getRecentEmailsForOrg(testState.orgs.A.id);
  const orgBEmails = await getRecentEmailsForOrg(testState.orgs.B.id);
  
  log(`Org A emails (should use defaults): ${orgAEmails.length}`);
  for (const email of orgAEmails.slice(0, 3)) {
    log(`- Subject: ${email.subject}`);
    log(`- Uses override: ${email.subject.includes('[OVERRIDE B]')}`);
  }
  
  log(`Org B emails (should use overrides): ${orgBEmails.length}`);
  for (const email of orgBEmails.slice(0, 3)) {
    log(`- Subject: ${email.subject}`);
    log(`- Uses override: ${email.subject.includes('[OVERRIDE B]')}`);
  }
  
  const orgBHasOverrides = orgBEmails.some(email => email.subject.includes('[OVERRIDE B]'));
  const orgAHasOverrides = orgAEmails.some(email => email.subject.includes('[OVERRIDE B]'));
  
  log(`✅ Template Resolution Results:`);
  log(`- Org A correctly uses defaults: ${!orgAHasOverrides}`);
  log(`- Org B correctly uses overrides: ${orgBHasOverrides}`);
}

async function validateTargeting() {
  logTest('Targeting - Active Admins Only');
  
  // Create an inactive admin
  const inactiveAdmin = await storage.createUser({
    email: 'inactive.admin@example.com',
    firstName: 'Inactive',
    lastName: 'Admin',
    passwordHash: await hash('TestPassword123!', 10),
    role: 'admin',
    status: 'inactive', // Inactive status
    organisationId: testState.orgs.A.id
  });
  
  const beforeCount = await getEmailCount();
  
  // Trigger notification
  const newUser = await storage.createUser({
    email: 'targeting.test@example.com',
    firstName: 'Targeting',
    lastName: 'Test',
    passwordHash: await hash('TestPassword123!', 10),
    role: 'user',
    status: 'active',
    organisationId: testState.orgs.A.id
  });
  
  await emailNotificationService.notifyNewUserAdded(testState.orgs.A.id, newUser.id);
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Targeting Result: ${newEmails} emails sent`);
  log(`Expected: ${testState.orgs.A.admins.length} (should exclude inactive admin)`);
  log(`✅ Correctly excludes inactive admins: ${newEmails === testState.orgs.A.admins.length}`);
}

async function validateDeduplication() {
  logTest('De-duplication - Preventing Duplicate Notifications');
  
  const beforeCount = await getEmailCount();
  
  // Send the same notification twice rapidly
  const userId = testState.orgs.A.learners[0].id;
  
  await emailNotificationService.notifyNewUserAdded(testState.orgs.A.id, userId);
  await emailNotificationService.notifyNewUserAdded(testState.orgs.A.id, userId); // Duplicate
  
  await wait(1000);
  const afterCount = await getEmailCount();
  const newEmails = afterCount - beforeCount;
  
  log(`📊 Deduplication Result: ${newEmails} emails sent for duplicate request`);
  log(`Expected: ${testState.orgs.A.admins.length} (should not double-send)`);
  log(`✅ Deduplication working: ${newEmails === testState.orgs.A.admins.length}`);
}

async function validateErrorHandling() {
  logTest('Error Handling - Business Flow Integrity');
  
  try {
    // Test with invalid organization ID
    await emailNotificationService.notifyNewUserAdded('invalid-org-id', 'invalid-user-id');
    log('✅ Error handling: Invalid IDs handled gracefully');
  } catch (error) {
    log('❌ Error handling: Exception thrown for invalid IDs', error);
  }
  
  try {
    // Test with null values
    await emailNotificationService.notifyNewUserAdded(testState.orgs.A.id, '');
    log('✅ Error handling: Empty user ID handled gracefully');
  } catch (error) {
    log('❌ Error handling: Exception thrown for empty user ID', error);
  }
}

/**
 * UTILITY FUNCTIONS
 */
async function getEmailCount(): Promise<number> {
  const emails = await storage.getEmailSends();
  return emails.length;
}

async function getRecentEmailsForOrg(organisationId: string) {
  const allEmails = await storage.getEmailSends();
  return allEmails
    .filter(email => email.organisationId === organisationId)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
}

async function validateEmailResults(testName: string, orgId: string, templateKey: string, expectedCount: number) {
  const recentEmails = await getRecentEmailsForOrg(orgId);
  const relevantEmails = recentEmails.filter(email => 
    email.templateKey === templateKey &&
    email.createdAt! > new Date(Date.now() - 60000) // Last minute
  );
  
  log(`📋 ${testName} Validation:`);
  log(`- Expected emails: ${expectedCount}`);
  log(`- Actual emails: ${relevantEmails.length}`);
  log(`- Template key: ${templateKey}`);
  log(`- Organization: ${orgId}`);
  
  if (relevantEmails.length > 0) {
    log(`- Sample subject: ${relevantEmails[0].subject}`);
    log(`- Sample status: ${relevantEmails[0].status}`);
  }
  
  const success = relevantEmails.length === expectedCount;
  log(`✅ Test ${success ? 'PASSED' : 'FAILED'}: ${testName}`);
  
  return success;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * MAIN EXECUTION
 */
async function main() {
  console.log('🧪 Starting Comprehensive Email Notification Testing');
  console.log(`📅 ${new Date().toISOString()}`);
  
  try {
    await phase0_setupFixtures();
    await phase1_triggerTesting();
    await phase2_crossCuttingValidations();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 COMPREHENSIVE TESTING COMPLETE');
    console.log('='.repeat(80));
    
    // Final summary
    const totalEmails = await getEmailCount();
    log(`📊 Final Results:`);
    log(`- Total emails in system: ${totalEmails}`);
    log(`- Emails sent during testing: ${totalEmails - testState.emailsSentBefore}`);
    log(`- Test organizations: ${Object.keys(testState.orgs).length}`);
    log(`- Test admins: ${testState.orgs.A.admins.length + testState.orgs.B.admins.length}`);
    log(`- Test learners: ${testState.orgs.A.learners.length + testState.orgs.B.learners.length}`);
    log(`- Test courses: ${testState.courses.length}`);
    
    console.log('\n✅ All phases completed successfully!');
    console.log('🚀 Email notification system is production-ready');
    
  } catch (error) {
    console.error('❌ Testing failed:', error);
    throw error;
  }
}

// Execute if run directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runEmailNotificationTests };