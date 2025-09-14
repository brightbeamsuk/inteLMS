#!/usr/bin/env node

// Simple test to verify the deleteOrganisation method works correctly
import { DatabaseStorage } from './server/storage.js';

async function testDeleteOrganisation() {
  const storage = new DatabaseStorage();
  
  const orgId = '307e4f35-1c21-4b80-8208-eeba270e0ec7';
  
  try {
    console.log('Testing deleteOrganisation method...');
    console.log('Organization ID:', orgId);
    
    // Get organization before deletion
    const orgBefore = await storage.getOrganisation(orgId);
    console.log('Organization before deletion:', orgBefore?.name);
    
    // Attempt to delete the organization
    await storage.deleteOrganisation(orgId);
    
    // Check if organization still exists
    const orgAfter = await storage.getOrganisation(orgId);
    
    if (!orgAfter) {
      console.log('✅ Organization successfully deleted');
      
      // Check if users are also deleted
      const users = await storage.getUsersByOrganisation(orgId);
      console.log(`✅ Users deleted: ${users.length === 0 ? 'Yes' : 'No'} (${users.length} remaining)`);
      
    } else {
      console.log('❌ Organization deletion failed');
    }
    
  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDeleteOrganisation().catch(console.error);