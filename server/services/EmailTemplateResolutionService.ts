/**
 * EmailTemplateResolutionService
 * 
 * Provides intelligent email template resolution with organization-specific overrides
 * and system defaults, including a 5-minute TTL caching system for performance.
 * 
 * Template Resolution Logic:
 * 1. Check if EmailTemplateOverrides exists for (org_id, template_key) and is_active = true
 * 2. If exists, use override fields, falling back to defaults for null fields
 * 3. If no override exists, use EmailTemplateDefaults entirely
 * 4. Return: {subject, html, text, variables_schema}
 * 
 * Caching Strategy:
 * - 5-minute TTL per (org_id, template_key) combination
 * - Cache invalidation on template updates and provider changes
 * - All reads respect cache, all writes bust cache
 */

import { storage } from "../storage";
import type { 
  EmailTemplateDefaults, 
  EmailTemplateOverrides, 
  InsertEmailTemplateOverrides,
  InsertEmailTemplateDefaults
} from "@shared/schema";

// Cache entry interface
interface CachedTemplate {
  data: ResolvedTemplate;
  timestamp: number;
  ttl: number;
}

// Resolved template interface
export interface ResolvedTemplate {
  subject: string;
  html: string;
  text: string | null;
  variablesSchema: any | null;
  source: 'override' | 'default';
  cacheHit?: boolean;
}

// Cache invalidation options
interface InvalidationOptions {
  orgId?: string;
  templateKey?: string;
  reason?: string;
}

export class EmailTemplateResolutionService {
  private cache = new Map<string, CachedTemplate>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly LOG_PREFIX = '[EmailTemplateResolver]';

  /**
   * Main template resolution method
   * 
   * @param orgId Organization ID
   * @param templateKey Template key identifier
   * @returns Resolved template with fallback logic applied
   */
  async getEffectiveTemplate(orgId: string, templateKey: string): Promise<ResolvedTemplate> {
    const cacheKey = this.generateCacheKey(orgId, templateKey);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`${this.LOG_PREFIX} Cache hit for ${cacheKey}`);
      return { ...cached, cacheHit: true };
    }

    console.log(`${this.LOG_PREFIX} Cache miss for ${cacheKey}, resolving template`);

    try {
      // Step 1: Get default template (required)
      const defaultTemplate = await storage.getEmailTemplateDefault(templateKey);
      if (!defaultTemplate) {
        throw new Error(`Default template not found for key: ${templateKey}`);
      }

      // Step 2: Check for active override
      const override = await storage.getEmailTemplateOverride(orgId, templateKey);
      
      let resolvedTemplate: ResolvedTemplate;

      if (override && override.isActive) {
        // Use override with fallback to defaults
        resolvedTemplate = {
          subject: override.subjectOverride ?? defaultTemplate.subjectDefault,
          html: override.htmlOverride ?? defaultTemplate.htmlDefault,
          text: override.textOverride ?? defaultTemplate.textDefault,
          variablesSchema: defaultTemplate.variablesSchema, // Always use default schema
          source: 'override'
        };
        console.log(`${this.LOG_PREFIX} Using override template for ${orgId}:${templateKey}`);
      } else {
        // Use default template entirely
        resolvedTemplate = {
          subject: defaultTemplate.subjectDefault,
          html: defaultTemplate.htmlDefault,
          text: defaultTemplate.textDefault,
          variablesSchema: defaultTemplate.variablesSchema,
          source: 'default'
        };
        console.log(`${this.LOG_PREFIX} Using default template for ${orgId}:${templateKey}`);
      }

      // Cache the resolved template
      this.setInCache(cacheKey, resolvedTemplate);

      return resolvedTemplate;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error resolving template ${orgId}:${templateKey}:`, error);
      throw new Error(`Failed to resolve email template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default template only (no override resolution)
   * 
   * @param templateKey Template key identifier
   * @returns Default template or null if not found
   */
  async getDefaultTemplate(templateKey: string): Promise<EmailTemplateDefaults | null> {
    try {
      const template = await storage.getEmailTemplateDefault(templateKey);
      return template || null;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error getting default template ${templateKey}:`, error);
      throw new Error(`Failed to get default template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get override template only (no fallback resolution)
   * 
   * @param orgId Organization ID
   * @param templateKey Template key identifier
   * @returns Override template or null if not found/inactive
   */
  async getOverride(orgId: string, templateKey: string): Promise<EmailTemplateOverrides | null> {
    try {
      const override = await storage.getEmailTemplateOverride(orgId, templateKey);
      // Return null if no override exists or if it's inactive
      return (override && override.isActive) ? override : null;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error getting override template ${orgId}:${templateKey}:`, error);
      throw new Error(`Failed to get override template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update default template with automatic cache invalidation
   * 
   * @param templateKey Template key identifier
   * @param updateData Partial template data to update
   * @returns Updated default template
   */
  async updateDefaultTemplate(
    templateKey: string, 
    updateData: Partial<InsertEmailTemplateDefaults>
  ): Promise<EmailTemplateDefaults> {
    try {
      // Update the default template in storage
      const result = await storage.updateEmailTemplateDefault(templateKey, updateData);
      console.log(`${this.LOG_PREFIX} Updated default template for ${templateKey}`);

      // Invalidate cache for this template key across all organizations
      this.invalidateCache({ templateKey, reason: 'default_template_update' });

      return result;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error updating default template ${templateKey}:`, error);
      throw new Error(`Failed to update default template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update an organization template override
   * 
   * @param orgId Organization ID
   * @param templateKey Template key identifier
   * @param overrideData Override template data
   * @returns Created/updated override
   */
  async setOverride(
    orgId: string, 
    templateKey: string, 
    overrideData: Partial<InsertEmailTemplateOverrides>
  ): Promise<EmailTemplateOverrides> {
    try {
      // Use atomic upsert operation to handle unique constraint properly
      const result = await storage.upsertEmailTemplateOverride(orgId, templateKey, overrideData);
      console.log(`${this.LOG_PREFIX} Upserted override for ${orgId}:${templateKey}`);

      // Invalidate cache for this specific template
      this.invalidateCache({ orgId, templateKey, reason: 'override_update' });

      return result;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error setting override ${orgId}:${templateKey}:`, error);
      throw new Error(`Failed to set override template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disable an organization template override
   * 
   * @param orgId Organization ID
   * @param templateKey Template key identifier
   */
  async disableOverride(orgId: string, templateKey: string): Promise<void> {
    try {
      await storage.disableEmailTemplateOverride(orgId, templateKey);
      console.log(`${this.LOG_PREFIX} Disabled override for ${orgId}:${templateKey}`);

      // Invalidate cache for this specific template
      this.invalidateCache({ orgId, templateKey, reason: 'override_disable' });

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error disabling override ${orgId}:${templateKey}:`, error);
      throw new Error(`Failed to disable override template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cache invalidation with flexible targeting
   * 
   * @param options Invalidation options
   */
  invalidateCache(options: InvalidationOptions = {}): void {
    const { orgId, templateKey, reason = 'manual' } = options;
    
    let invalidatedCount = 0;

    if (orgId && templateKey) {
      // Invalidate specific template
      const cacheKey = this.generateCacheKey(orgId, templateKey);
      if (this.cache.delete(cacheKey)) {
        invalidatedCount++;
      }
      console.log(`${this.LOG_PREFIX} Invalidated cache for ${cacheKey} (reason: ${reason})`);
    } else if (orgId) {
      // Invalidate all templates for an organization
      const orgPrefix = `${orgId}:`;
      const keys = Array.from(this.cache.keys());
      for (const key of keys) {
        if (key.startsWith(orgPrefix)) {
          this.cache.delete(key);
          invalidatedCount++;
        }
      }
      console.log(`${this.LOG_PREFIX} Invalidated ${invalidatedCount} cached templates for org ${orgId} (reason: ${reason})`);
    } else if (templateKey) {
      // Invalidate specific template key across all orgs
      const keySuffix = `:${templateKey}`;
      const keys = Array.from(this.cache.keys());
      for (const key of keys) {
        if (key.endsWith(keySuffix)) {
          this.cache.delete(key);
          invalidatedCount++;
        }
      }
      console.log(`${this.LOG_PREFIX} Invalidated ${invalidatedCount} cached templates for key ${templateKey} (reason: ${reason})`);
    } else {
      // Clear entire cache
      invalidatedCount = this.cache.size;
      this.cache.clear();
      console.log(`${this.LOG_PREFIX} Cleared entire cache (${invalidatedCount} entries, reason: ${reason})`);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Manual cache cleanup to remove expired entries
   */
  cleanupExpiredCache(): number {
    const now = Date.now();
    let cleanedCount = 0;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`${this.LOG_PREFIX} Cleaned up ${cleanedCount} expired cache entries`);
    }

    return cleanedCount;
  }

  // Private helper methods

  private generateCacheKey(orgId: string, templateKey: string): string {
    return `${orgId}:${templateKey}`;
  }

  private getFromCache(cacheKey: string): ResolvedTemplate | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  private setInCache(cacheKey: string, template: ResolvedTemplate): void {
    this.cache.set(cacheKey, {
      data: template,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }
}

// Export singleton instance
export const emailTemplateResolver = new EmailTemplateResolutionService();