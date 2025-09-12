/**
 * Email Template Testing Script
 * 
 * Tests the seeded email templates to verify:
 * 1. Templates can be seeded successfully
 * 2. Variable substitution works correctly
 * 3. EmailTemplateService integration functions properly
 */

import { seedEmailTemplateDefaults } from './seeds/emailTemplateDefaults';
import { emailTemplateEngine } from './services/EmailTemplateEngineService';
import { emailTemplateResolver } from './services/EmailTemplateResolutionService';
import { storage } from './storage';

// Test data that matches the EmailTemplateService interfaces
const testData = {
  org: {
    name: 'Acme Healthcare',
    display_name: 'Acme Healthcare Ltd',
    subdomain: 'acme-healthcare'
  },
  admin: {
    name: 'Sarah',
    email: 'sarah.admin@acmehealthcare.com',
    full_name: 'Sarah Johnson'
  },
  user: {
    id: 'user-123-456',
    name: 'John',
    email: 'john.doe@acmehealthcare.com',
    full_name: 'John Doe',
    job_title: 'Care Assistant',
    department: 'Healthcare'
  },
  new_admin: {
    name: 'Alice',
    email: 'alice.smith@acmehealthcare.com',
    full_name: 'Alice Smith'
  },
  course: {
    title: 'Health & Safety in Care Settings',
    description: 'Essential health and safety procedures for healthcare workers',
    category: 'Compliance',
    estimated_duration: 45
  },
  attempt: {
    score: 87.5,
    status: 'passed',
    time_spent: 42
  },
  plan: {
    name: 'Professional Plan',
    old_price: 29.99,
    new_price: 34.99,
    billing_cadence: 'monthly'
  },
  added_by: {
    name: 'Sarah',
    full_name: 'Sarah Johnson'
  },
  assigned_by: {
    name: 'Sarah',
    full_name: 'Sarah Johnson'
  },
  changed_by: {
    name: 'Sarah',
    full_name: 'Sarah Johnson'
  },
  added_at: 'March 15, 2025',
  assigned_at: 'March 15, 2025',
  changed_at: 'March 15, 2025',
  completed_at: 'March 15, 2025',
  failed_at: 'March 15, 2025',
  due_date: 'March 30, 2025',
  effective_date: 'April 1, 2025'
};

// Template keys to test
const templateKeys = [
  'admin.new_admin_added',
  'admin.new_user_added',
  'admin.new_course_assigned',
  'admin.plan_updated',
  'admin.learner_completed_course',
  'admin.learner_failed_course'
];

/**
 * Test template seeding
 */
async function testSeeding(): Promise<boolean> {
  console.log('\n📝 Testing template seeding...');
  
  try {
    const result = await seedEmailTemplateDefaults(true); // Force overwrite
    
    if (result.errors.length > 0) {
      console.error('❌ Seeding errors:', result.errors);
      return false;
    }
    
    console.log(`✅ Seeding successful: ${result.seeded} templates seeded, ${result.skipped} skipped`);
    return true;
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    return false;
  }
}

/**
 * Test template resolution and rendering
 */
async function testTemplateRendering(): Promise<boolean> {
  console.log('\n🎨 Testing template resolution and rendering...');
  
  let allTestsPassed = true;
  
  for (const templateKey of templateKeys) {
    try {
      console.log(`\n🔍 Testing template: ${templateKey}`);
      
      // Test 1: Get default template
      const defaultTemplate = await emailTemplateResolver.getDefaultTemplate(templateKey);
      if (!defaultTemplate) {
        console.error(`❌ Default template not found: ${templateKey}`);
        allTestsPassed = false;
        continue;
      }
      
      console.log(`  ✅ Default template found`);
      
      // Test 2: Get effective template (should be default since no override)
      const effectiveTemplate = await emailTemplateResolver.getEffectiveTemplate('test-org', templateKey);
      if (!effectiveTemplate) {
        console.error(`❌ Effective template resolution failed: ${templateKey}`);
        allTestsPassed = false;
        continue;
      }
      
      console.log(`  ✅ Effective template resolved (source: ${effectiveTemplate.source})`);
      
      // Test 3: Validate template variables
      if (defaultTemplate.variablesSchema) {
        const validation = emailTemplateEngine.validateTemplate(
          defaultTemplate.subjectDefault + ' ' + defaultTemplate.htmlDefault,
          defaultTemplate.variablesSchema
        );
        
        if (!validation.isValid) {
          console.error(`❌ Template validation failed: ${templateKey}`, validation.errors);
          allTestsPassed = false;
          continue;
        }
        
        console.log(`  ✅ Template validation passed (${validation.validVariables.length} variables)`);
      }
      
      // Test 4: Render template with test data
      const renderedSubject = emailTemplateEngine.renderTemplate(
        defaultTemplate.subjectDefault,
        testData,
        { escapeHtml: false }
      );
      
      const renderedHtml = emailTemplateEngine.renderTemplate(
        defaultTemplate.htmlDefault,
        testData,
        { escapeHtml: true }
      );
      
      // Check that variables were substituted (no {{}} left)
      const hasUnsubstitutedVars = renderedSubject.includes('{{') || renderedHtml.includes('{{');
      if (hasUnsubstitutedVars) {
        console.error(`❌ Template rendering incomplete: ${templateKey} - unsubstituted variables found`);
        allTestsPassed = false;
        continue;
      }
      
      console.log(`  ✅ Template rendering successful`);
      console.log(`    Subject: ${renderedSubject.substring(0, 80)}${renderedSubject.length > 80 ? '...' : ''}`);
      
    } catch (error) {
      console.error(`❌ Template test failed: ${templateKey}`, error);
      allTestsPassed = false;
    }
  }
  
  return allTestsPassed;
}

/**
 * Test preview functionality
 */
async function testPreviewGeneration(): Promise<boolean> {
  console.log('\n👀 Testing template preview generation...');
  
  try {
    // Test preview for one template
    const testTemplateKey = 'admin.new_admin_added';
    const preview = await emailTemplateEngine.previewTemplate(
      'test-org',
      testTemplateKey,
      testData
    );
    
    if (!preview.defaultPreview) {
      console.error('❌ Preview generation failed');
      return false;
    }
    
    console.log('✅ Preview generation successful');
    console.log(`  Subject: ${preview.defaultPreview.subject}`);
    console.log(`  HTML length: ${preview.defaultPreview.html.length} characters`);
    console.log(`  Variables valid: ${preview.validation.defaultValid.isValid}`);
    
    return true;
  } catch (error) {
    console.error('❌ Preview test failed:', error);
    return false;
  }
}

/**
 * Test storage integration
 */
async function testStorageIntegration(): Promise<boolean> {
  console.log('\n💾 Testing storage integration...');
  
  try {
    // Test getting all default templates
    const allTemplates = await storage.getAllEmailTemplateDefaults();
    
    if (allTemplates.length < templateKeys.length) {
      console.error(`❌ Expected ${templateKeys.length} templates, found ${allTemplates.length}`);
      return false;
    }
    
    console.log(`✅ Storage integration successful: ${allTemplates.length} templates found`);
    
    // Test getting specific template
    const specificTemplate = await storage.getEmailTemplateDefault('admin.new_admin_added');
    if (!specificTemplate) {
      console.error('❌ Failed to get specific template');
      return false;
    }
    
    console.log('✅ Specific template retrieval successful');
    
    return true;
  } catch (error) {
    console.error('❌ Storage integration test failed:', error);
    return false;
  }
}

/**
 * Run comprehensive test suite
 */
async function runTests(): Promise<void> {
  console.log('🧪 Starting Email Template Test Suite...');
  console.log('='.repeat(50));
  
  const results = {
    seeding: false,
    rendering: false,
    preview: false,
    storage: false
  };
  
  // Run all tests
  results.seeding = await testSeeding();
  results.rendering = await testTemplateRendering();
  results.preview = await testPreviewGeneration();
  results.storage = await testStorageIntegration();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY:');
  console.log('='.repeat(50));
  
  const testResults = [
    ['Template Seeding', results.seeding],
    ['Template Rendering', results.rendering],
    ['Preview Generation', results.preview],
    ['Storage Integration', results.storage]
  ];
  
  let allPassed = true;
  testResults.forEach(([testName, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${testName}: ${status}`);
    if (!passed) allPassed = false;
  });
  
  console.log('='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Email templates are ready for production.');
  } else {
    console.log('💥 SOME TESTS FAILED! Please review the errors above.');
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export { runTests, testSeeding, testTemplateRendering };