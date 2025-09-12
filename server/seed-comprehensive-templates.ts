#!/usr/bin/env ts-node

/**
 * Seed Comprehensive Email Templates
 * 
 * This script populates the database with all 11 comprehensive email templates
 * from the EmailTemplateSeedService, which includes MJML content, variable schemas,
 * and professional content for the SuperAdmin to view and edit.
 */

import { emailTemplateSeedService } from './seeds/emailTemplateSeedService';

async function seedComprehensiveTemplates() {
  console.log('🌱 Starting comprehensive email template seeding...');
  console.log('='.repeat(60));
  
  try {
    // Use the comprehensive seed service to populate all 11 templates
    const result = await emailTemplateSeedService.seedDefaultsIfMissing();
    
    console.log('\n📊 SEEDING RESULTS:');
    console.log('='.repeat(40));
    console.log(`✅ Templates inserted: ${result.inserted.length}`);
    console.log(`⏸️  Templates skipped: ${result.skipped.length}`);
    console.log(`📦 Total templates now: ${result.nowCount}`);
    
    if (result.inserted.length > 0) {
      console.log('\n🆕 NEWLY INSERTED TEMPLATES:');
      result.inserted.forEach(key => {
        console.log(`  • ${key}`);
      });
    }
    
    if (result.skipped.length > 0) {
      console.log('\n⏸️  SKIPPED TEMPLATES (already exist):');
      result.skipped.forEach(key => {
        console.log(`  • ${key}`);
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }
    
    console.log('\n='.repeat(60));
    
    if (result.ok) {
      console.log('🎉 SUCCESS: All comprehensive email templates are now available!');
      console.log('   SuperAdmin can now view and edit all 11 templates with:');
      console.log('   • Professional MJML content');
      console.log('   • Comprehensive variable schemas'); 
      console.log('   • Rich HTML and text versions');
      console.log('   • UK spelling and professional tone');
      
      // Validate the seeded templates
      console.log('\n🔍 Validating seeded templates...');
      const validation = await emailTemplateSeedService.validateSeededTemplates();
      
      if (validation.valid) {
        console.log(`✅ Validation passed: ${validation.templateCount} templates are valid`);
      } else {
        console.log(`❌ Validation failed with ${validation.validationErrors.length} errors:`);
        validation.validationErrors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }
      
    } else {
      console.log('❌ FAILURE: Some templates failed to seed. Check errors above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 CRITICAL ERROR during seeding:', error);
    process.exit(1);
  }
}

// Run the seeding process
if (import.meta.url === `file://${process.argv[1]}`) {
  seedComprehensiveTemplates()
    .then(() => {
      console.log('\n✨ Seeding complete! Templates are ready for SuperAdmin access.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export { seedComprehensiveTemplates };