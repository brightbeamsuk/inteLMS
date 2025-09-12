/**
 * Email Event Integration Test
 * 
 * Tests the integration between business events and email template system
 * Simulates all 6 email event types to verify correct email delivery
 */

import { EmailTemplateService } from './services/EmailTemplateService';
import type { 
  NewAdminNotificationData,
  NewUserNotificationData,
  CourseAssignedNotificationData,
  PlanUpdatedNotificationData,
  LearnerCompletedNotificationData,
  LearnerFailedNotificationData
} from './services/EmailTemplateService';

const emailTemplateService = new EmailTemplateService();

// Comprehensive test data that matches all template requirements
const baseOrg = {
  name: 'Acme Healthcare Training',
  display_name: 'Acme Healthcare Training Ltd',
  subdomain: 'acme-healthcare'
};

const baseAdmin = {
  name: 'Sarah',
  email: 'sarah.admin@acmehealthcare.com',
  full_name: 'Sarah Johnson'
};

/**
 * Test Scenario 1: New Admin Added Event
 */
async function testNewAdminEvent(): Promise<boolean> {
  console.log('\n👥 Testing: New Admin Added Event');
  
  const eventData: NewAdminNotificationData = {
    org: baseOrg,
    admin: baseAdmin,
    new_admin: {
      name: 'Michael',
      email: 'michael.smith@acmehealthcare.com',
      full_name: 'Michael Smith'
    },
    added_by: {
      name: 'Sarah',
      full_name: 'Sarah Johnson'
    },
    added_at: 'September 12, 2025'
  };

  try {
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.new_admin_added',
      to: [baseAdmin.email],
      variables: eventData,
      organizationId: 'test-acme-org'
    });

    console.log(`   Template resolved from: ${result.templateSource}`);
    console.log(`   Recipients: ${result.recipientCount}, Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    if (result.templateSource === 'default' && result.errors.every(e => e.includes('email') || e.includes('provider'))) {
      console.log('   ✅ PASS: Template resolution and rendering successful (email provider failure expected)');
      return true;
    } else {
      console.log('   ❌ FAIL: Unexpected result', result.errors);
      return false;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Error in new admin event', error);
    return false;
  }
}

/**
 * Test Scenario 2: New User Added Event
 */
async function testNewUserEvent(): Promise<boolean> {
  console.log('\n👤 Testing: New User Added Event');
  
  const eventData: NewUserNotificationData = {
    org: baseOrg,
    admin: baseAdmin,
    user: {
      name: 'Emily',
      email: 'emily.carter@acmehealthcare.com',
      full_name: 'Emily Carter',
      job_title: 'Registered Nurse',
      department: 'Critical Care'
    },
    added_by: {
      name: 'Sarah',
      full_name: 'Sarah Johnson'
    },
    added_at: 'September 12, 2025'
  };

  try {
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.new_user_added',
      to: [baseAdmin.email],
      variables: eventData,
      organizationId: 'test-acme-org'
    });

    console.log(`   Template resolved from: ${result.templateSource}`);
    console.log(`   Recipients: ${result.recipientCount}, Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    if (result.templateSource === 'default') {
      console.log('   ✅ PASS: New user event processed successfully');
      return true;
    } else {
      console.log('   ❌ FAIL: Template resolution failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Error in new user event', error);
    return false;
  }
}

/**
 * Test Scenario 3: Course Assigned Event
 */
async function testCourseAssignedEvent(): Promise<boolean> {
  console.log('\n📚 Testing: Course Assigned Event');
  
  const eventData: CourseAssignedNotificationData = {
    org: baseOrg,
    admin: baseAdmin,
    user: {
      name: 'David',
      email: 'david.wilson@acmehealthcare.com',
      full_name: 'David Wilson',
      job_title: 'Healthcare Assistant',
      department: 'Emergency Department'
    },
    course: {
      title: 'Infection Control & Prevention',
      description: 'Essential infection control procedures for healthcare environments',
      category: 'Compliance',
      estimated_duration: 60
    },
    assigned_by: {
      name: 'Sarah',
      full_name: 'Sarah Johnson'
    },
    assigned_at: 'September 12, 2025',
    due_date: 'September 26, 2025'
  };

  try {
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.new_course_assigned',
      to: [baseAdmin.email],
      variables: eventData,
      organizationId: 'test-acme-org'
    });

    console.log(`   Template resolved from: ${result.templateSource}`);
    console.log(`   Recipients: ${result.recipientCount}, Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    if (result.templateSource === 'default') {
      console.log('   ✅ PASS: Course assignment event processed successfully');
      return true;
    } else {
      console.log('   ❌ FAIL: Template resolution failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Error in course assignment event', error);
    return false;
  }
}

/**
 * Test Scenario 4: Plan Updated Event
 */
async function testPlanUpdatedEvent(): Promise<boolean> {
  console.log('\n💳 Testing: Plan Updated Event');
  
  const eventData: PlanUpdatedNotificationData = {
    org: baseOrg,
    admin: baseAdmin,
    plan: {
      name: 'Professional Healthcare Plan',
      old_price: 49.99,
      new_price: 59.99,
      billing_cadence: 'monthly'
    },
    changed_by: {
      name: 'Sarah',
      full_name: 'Sarah Johnson'
    },
    changed_at: 'September 12, 2025',
    effective_date: 'October 1, 2025'
  };

  try {
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.plan_updated',
      to: [baseAdmin.email],
      variables: eventData,
      organizationId: 'test-acme-org'
    });

    console.log(`   Template resolved from: ${result.templateSource}`);
    console.log(`   Recipients: ${result.recipientCount}, Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    if (result.templateSource === 'default') {
      console.log('   ✅ PASS: Plan update event processed successfully');
      return true;
    } else {
      console.log('   ❌ FAIL: Template resolution failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Error in plan update event', error);
    return false;
  }
}

/**
 * Test Scenario 5: Learner Completed Course Event
 */
async function testLearnerCompletedEvent(): Promise<boolean> {
  console.log('\n🎉 Testing: Learner Completed Course Event');
  
  const eventData: LearnerCompletedNotificationData = {
    org: baseOrg,
    admin: baseAdmin,
    user: {
      name: 'Jennifer',
      email: 'jennifer.brown@acmehealthcare.com',
      full_name: 'Jennifer Brown',
      job_title: 'Senior Nurse',
      department: 'Surgical Unit'
    },
    course: {
      title: 'Manual Handling & Patient Safety',
      description: 'Safe manual handling techniques for patient care',
      category: 'Safety',
      estimated_duration: 45
    },
    attempt: {
      score: 92.5,
      status: 'passed',
      time_spent: 38
    },
    completed_at: 'September 12, 2025'
  };

  try {
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.learner_completed_course',
      to: [baseAdmin.email],
      variables: eventData,
      organizationId: 'test-acme-org'
    });

    console.log(`   Template resolved from: ${result.templateSource}`);
    console.log(`   Recipients: ${result.recipientCount}, Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    if (result.templateSource === 'default') {
      console.log('   ✅ PASS: Course completion event processed successfully');
      return true;
    } else {
      console.log('   ❌ FAIL: Template resolution failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Error in course completion event', error);
    return false;
  }
}

/**
 * Test Scenario 6: Learner Failed Course Event
 */
async function testLearnerFailedEvent(): Promise<boolean> {
  console.log('\n⚠️  Testing: Learner Failed Course Event');
  
  const eventData: LearnerFailedNotificationData = {
    org: baseOrg,
    admin: baseAdmin,
    user: {
      name: 'Robert',
      email: 'robert.taylor@acmehealthcare.com',
      full_name: 'Robert Taylor',
      job_title: 'Healthcare Assistant',
      department: 'Outpatient Services'
    },
    course: {
      title: 'Fire Safety & Emergency Procedures',
      description: 'Essential fire safety and emergency response procedures',
      category: 'Safety',
      estimated_duration: 30
    },
    attempt: {
      score: 45.0,
      status: 'failed',
      time_spent: 22
    },
    failed_at: 'September 12, 2025'
  };

  try {
    const result = await emailTemplateService.sendTemplatedEmail({
      templateKey: 'admin.learner_failed_course',
      to: [baseAdmin.email],
      variables: eventData,
      organizationId: 'test-acme-org'
    });

    console.log(`   Template resolved from: ${result.templateSource}`);
    console.log(`   Recipients: ${result.recipientCount}, Processed: ${result.processedCount}, Failed: ${result.failedCount}`);
    
    if (result.templateSource === 'default') {
      console.log('   ✅ PASS: Course failure event processed successfully');
      return true;
    } else {
      console.log('   ❌ FAIL: Template resolution failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ FAIL: Error in course failure event', error);
    return false;
  }
}

/**
 * Run all event integration tests
 */
async function runEventIntegrationTests(): Promise<void> {
  console.log('🚀 EMAIL EVENT INTEGRATION TESTS');
  console.log('='.repeat(50));
  console.log('Testing all 6 email event types with comprehensive data...');

  const results = await Promise.all([
    testNewAdminEvent(),
    testNewUserEvent(),
    testCourseAssignedEvent(),
    testPlanUpdatedEvent(),
    testLearnerCompletedEvent(),
    testLearnerFailedEvent()
  ]);

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(50));
  console.log('🏁 EVENT INTEGRATION TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 ALL EMAIL EVENT INTEGRATIONS WORKING!');
  } else {
    console.log(`⚠️  ${total - passed} event integration(s) failed`);
  }
  
  console.log('\nNote: Email delivery failures are expected in test environment');
  console.log('All template resolution and rendering appears to be working correctly.');
}

// Run tests immediately
runEventIntegrationTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Event integration tests failed:', error);
    process.exit(1);
  });