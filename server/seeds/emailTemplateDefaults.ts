/**
 * Email Template Defaults Seeder (DEPRECATED)
 * 
 * This file is deprecated and now uses the modern EmailTemplateSeedService internally.
 * The old emailTemplateDefaults table has been replaced by the new emailTemplates schema.
 * 
 * This stub maintains backward compatibility for existing test files.
 */

import { EmailTemplateSeedService } from './emailTemplateSeedService';

/**
 * DEPRECATED: Seeds email templates using the modern EmailTemplateSeedService
 * 
 * This maintains backward compatibility while using the new MJML-based templates.
 * 
 * @param force - Force overwrite existing templates  
 * @returns Object with seeded template count and any errors
 */
export async function seedEmailTemplateDefaults(force: boolean = false): Promise<{
  seeded: number;
  skipped: number;
  errors: string[];
}> {
  console.log('⚠️  DEPRECATED: seedEmailTemplateDefaults() is deprecated.');
  console.log('🔄 Redirecting to modern EmailTemplateSeedService...');
  
  try {
    const seedService = new EmailTemplateSeedService();
    const result = await seedService.seedPlatformTemplates({ overwriteExisting: force });
    
    return {
      seeded: result.seeded,
      skipped: result.skipped, 
      errors: result.errors
    };
  } catch (error) {
    console.error('❌ Failed to seed templates:', error);
    return {
      seeded: 0,
      skipped: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * DEPRECATED: Utility function to seed templates from command line or API
 */
export async function runEmailTemplateSeeder(force: boolean = false): Promise<void> {
  console.log('⚠️  DEPRECATED: runEmailTemplateSeeder() is deprecated.');
  console.log('🔄 Use EmailTemplateSeedService directly instead.');
  
  try {
    const result = await seedEmailTemplateDefaults(force);
    
    if (result.errors.length > 0) {
      console.error('❌ Seeding completed with errors:', result.errors);
      process.exit(1);
    } else {
      console.log('✅ Email template seeding completed successfully');
      console.log(`📊 Summary: ${result.seeded} seeded, ${result.skipped} skipped`);
    }
  } catch (error) {
    console.error('❌ Critical error during template seeding:', error);
    process.exit(1);
  }
}

// Export the modern service for convenience
export { EmailTemplateSeedService } from './emailTemplateSeedService';