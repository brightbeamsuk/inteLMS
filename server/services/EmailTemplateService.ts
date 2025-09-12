/**
 * Core EmailTemplateService
 * 
 * Central service for email template operations following the specification.
 * Handles template resolution, variable validation, and Handlebars compilation.
 * 
 * Key Methods:
 * - getTemplate(orgId, key): Load platform default + org override, return ResolvedTemplate
 * - render(key, orgId, variables): Validate variables and compile with Handlebars  
 * - list(orgId): List all templates with availability info
 * 
 * Features:
 * - Platform template defaults with organization overrides
 * - Variable validation against JSON schema
 * - Handlebars compilation with security-focused helpers
 * - Comprehensive error handling with descriptive messages
 * - Type-safe interfaces for all operations
 */

import Handlebars from 'handlebars';
import mjml from 'mjml';
import { storage } from '../storage';
import type { 
  EmailTemplate, 
  OrgEmailTemplate, 
  InsertEmailTemplate,
  InsertOrgEmailTemplate 
} from '@shared/schema';

// Import seed service for self-healing functionality
// Lazy import to avoid circular dependencies
const getEmailTemplateSeedService = async () => {
  const { emailTemplateSeedService } = await import('../seeds/emailTemplateSeedService');
  return emailTemplateSeedService;
};

// Core interfaces following the specification

export interface ResolvedTemplate {
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  mjml?: string; // MJML source when available
  source: 'org' | 'platform';
  version: {
    org: number | null;
    platform: number;
  };
  variablesSchema?: any;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string | null;
}

export interface TemplateListItem {
  key: string;
  name: string;
  category: string;
  hasOverride: boolean;
  platformVersion: number;
  orgVersion: number | null;
  isActive: boolean;
  lastUpdated: Date | null;
}

export interface TemplateList {
  templates: TemplateListItem[];
  totalCount: number;
  overrideCount: number;
}

// MJML compilation interfaces
export interface MjmlCompilationResult {
  html: string;
  errors: Array<{
    line?: number;
    column?: number;
    message: string;
    tagName?: string;
    formattedMessage?: string;
  }>;
}

export interface TemplateInput {
  key: string;
  name: string;
  subject: string;
  mjml: string; // MJML source
  text?: string;
  category: 'admin' | 'learner';
  variablesSchema?: any;
}

export interface TemplateUpdateInput {
  name?: string;
  subject?: string;
  mjml?: string; // MJML source
  text?: string;
  category?: 'admin' | 'learner';
  variablesSchema?: any;
  isActive?: boolean;
}

export interface OrgTemplateOverrideInput {
  templateKey: string;
  orgId: string;
  subjectOverride?: string;
  mjmlOverride?: string; // MJML source override
  textOverride?: string;
  isActive?: boolean;
}

// Error classes for specific error handling

export class TemplateNotFoundError extends Error {
  constructor(
    public readonly templateKey: string,
    public readonly orgId: string,
    message?: string
  ) {
    super(message || `Template '${templateKey}' not found for organization '${orgId}'`);
    this.name = 'TemplateNotFoundError';
  }
}

export class VariableValidationError extends Error {
  constructor(
    public readonly missingVariables: string[],
    public readonly invalidVariables: string[],
    message?: string
  ) {
    super(message || `Template variable validation failed`);
    this.name = 'VariableValidationError';
  }
}

export class TemplateCompilationError extends Error {
  constructor(
    public readonly templateKey: string,
    public readonly compilationErrors: string[],
    message?: string
  ) {
    super(message || `Template compilation failed for '${templateKey}'`);
    this.name = 'TemplateCompilationError';
  }
}

export class MjmlCompilationError extends Error {
  constructor(
    public readonly templateKey: string,
    public readonly mjmlErrors: Array<{
      line?: number;
      column?: number;
      message: string;
      tagName?: string;
      formattedMessage?: string;
    }>,
    message?: string
  ) {
    super(message || `MJML compilation failed for '${templateKey}'`);
    this.name = 'MjmlCompilationError';
  }
}

export class EmailTemplateService {
  private readonly LOG_PREFIX = '[EmailTemplateService]';
  private handlebarsEngine: typeof Handlebars;

  constructor() {
    this.handlebarsEngine = Handlebars.create();
    this.registerHandlebarsHelpers();
  }

  // =============================================================================
  // MJML COMPILATION METHODS
  // =============================================================================

  /**
   * Compile MJML source to HTML
   * 
   * @param mjmlSource MJML source code
   * @param templateKey Template key for error context
   * @returns MjmlCompilationResult with HTML and error/warning details
   * @throws MjmlCompilationError if compilation fails
   */
  async compileMjml(mjmlSource: string, templateKey: string = 'unknown'): Promise<MjmlCompilationResult> {
    console.log(`${this.LOG_PREFIX} Compiling MJML for template '${templateKey}'`);

    try {
      const result = mjml(mjmlSource, {
        validationLevel: 'strict',
        minify: false, // Keep readable for debugging
        beautify: true
      });

      const compilationResult: MjmlCompilationResult = {
        html: result.html,
        errors: result.errors.map((error: any) => ({
          line: error.line,
          column: error.column,
          message: error.message,
          tagName: error.tagName,
          formattedMessage: error.formattedMessage
        }))
      };

      // If there are errors, throw compilation error
      if (compilationResult.errors.length > 0) {
        console.error(`${this.LOG_PREFIX} MJML compilation failed for '${templateKey}':`, compilationResult.errors);
        throw new MjmlCompilationError(templateKey, compilationResult.errors);
      }

      console.log(`${this.LOG_PREFIX} MJML compiled successfully for '${templateKey}'`);
      return compilationResult;

    } catch (error) {
      if (error instanceof MjmlCompilationError) {
        throw error;
      }

      console.error(`${this.LOG_PREFIX} Unexpected error compiling MJML for '${templateKey}':`, error);
      throw new MjmlCompilationError(
        templateKey,
        [{
          message: `Unexpected compilation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          formattedMessage: `Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      );
    }
  }

  /**
   * Validate MJML syntax without full compilation
   * 
   * @param mjmlSource MJML source code
   * @param templateKey Template key for error context
   * @returns Validation result with errors
   */
  async validateMjml(mjmlSource: string, templateKey: string = 'unknown'): Promise<{
    isValid: boolean;
    errors: Array<{ line?: number; column?: number; message: string; }>;
  }> {
    console.log(`${this.LOG_PREFIX} Validating MJML for template '${templateKey}'`);

    try {
      const result = await this.compileMjml(mjmlSource, templateKey);
      
      return {
        isValid: true,
        errors: []
      };

    } catch (error) {
      if (error instanceof MjmlCompilationError) {
        return {
          isValid: false,
          errors: error.mjmlErrors
        };
      }

      return {
        isValid: false,
        errors: [{
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  // =============================================================================
  // TEMPLATE CREATION AND UPDATE METHODS  
  // =============================================================================

  /**
   * Create new platform email template with MJML compilation
   * 
   * @param templateInput Template data with MJML source
   * @returns Created EmailTemplate with compiled HTML
   * @throws MjmlCompilationError if MJML compilation fails
   */
  async createTemplate(templateInput: TemplateInput): Promise<EmailTemplate> {
    console.log(`${this.LOG_PREFIX} Creating new template '${templateInput.key}'`);

    try {
      // Validate and compile MJML
      const mjmlResult = await this.compileMjml(templateInput.mjml, templateInput.key);

      // Create template with compiled HTML
      const insertData: InsertEmailTemplate = {
        key: templateInput.key,
        name: templateInput.name,
        subject: templateInput.subject,
        html: mjmlResult.html,
        mjml: templateInput.mjml,
        text: templateInput.text || null,
        category: templateInput.category,
        variablesSchema: templateInput.variablesSchema || null,
        isActive: true
      };

      const template = await storage.createEmailTemplate(insertData);
      
      console.log(`${this.LOG_PREFIX} Template '${templateInput.key}' created successfully (version ${template.version})`);
      return template;

    } catch (error) {
      if (error instanceof MjmlCompilationError) {
        throw error;
      }
      
      console.error(`${this.LOG_PREFIX} Error creating template '${templateInput.key}':`, error);
      throw new Error(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing platform email template with MJML compilation
   * 
   * @param templateKey Template key to update
   * @param updateInput Template update data
   * @returns Updated EmailTemplate with compiled HTML
   * @throws TemplateNotFoundError if template doesn't exist
   * @throws MjmlCompilationError if MJML compilation fails
   */
  async updateTemplate(templateKey: string, updateInput: TemplateUpdateInput): Promise<EmailTemplate> {
    console.log(`${this.LOG_PREFIX} Updating template '${templateKey}'`);

    try {
      // Check if template exists
      const existingTemplate = await storage.getEmailTemplateByKey(templateKey);
      if (!existingTemplate) {
        throw new TemplateNotFoundError(templateKey, 'platform', `Template '${templateKey}' not found`);
      }

      // Prepare update data
      const updateData: Partial<InsertEmailTemplate> = {};
      
      if (updateInput.name !== undefined) updateData.name = updateInput.name;
      if (updateInput.subject !== undefined) updateData.subject = updateInput.subject;
      if (updateInput.text !== undefined) updateData.text = updateInput.text;
      if (updateInput.category !== undefined) updateData.category = updateInput.category;
      if (updateInput.variablesSchema !== undefined) updateData.variablesSchema = updateInput.variablesSchema;
      if (updateInput.isActive !== undefined) updateData.isActive = updateInput.isActive;

      // Handle MJML compilation if MJML is being updated
      if (updateInput.mjml !== undefined) {
        const mjmlResult = await this.compileMjml(updateInput.mjml, templateKey);
        updateData.mjml = updateInput.mjml;
        updateData.html = mjmlResult.html;
      }

      const updatedTemplate = await storage.updateEmailTemplate(templateKey, updateData);
      
      console.log(`${this.LOG_PREFIX} Template '${templateKey}' updated successfully (version ${updatedTemplate.version})`);
      return updatedTemplate;

    } catch (error) {
      if (error instanceof TemplateNotFoundError || error instanceof MjmlCompilationError) {
        throw error;
      }
      
      console.error(`${this.LOG_PREFIX} Error updating template '${templateKey}':`, error);
      throw new Error(`Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update organization template override with MJML compilation
   * 
   * @param overrideInput Organization override data
   * @returns Created or updated OrgEmailTemplate
   * @throws TemplateNotFoundError if platform template doesn't exist
   * @throws MjmlCompilationError if MJML compilation fails
   */
  async createOrUpdateOrgOverride(overrideInput: OrgTemplateOverrideInput): Promise<OrgEmailTemplate> {
    console.log(`${this.LOG_PREFIX} Creating/updating org override for template '${overrideInput.templateKey}' (org: ${overrideInput.orgId})`);

    try {
      // Verify platform template exists
      const platformTemplate = await storage.getEmailTemplateByKey(overrideInput.templateKey);
      if (!platformTemplate) {
        throw new TemplateNotFoundError(
          overrideInput.templateKey, 
          overrideInput.orgId, 
          `Platform template '${overrideInput.templateKey}' not found`
        );
      }

      // Check if override already exists
      const existingOverride = await storage.getOrgEmailTemplateByKey(overrideInput.orgId, overrideInput.templateKey);

      // Prepare override data
      const overrideData: Partial<InsertOrgEmailTemplate> = {
        orgId: overrideInput.orgId,
        templateKey: overrideInput.templateKey,
        subjectOverride: overrideInput.subjectOverride || null,
        textOverride: overrideInput.textOverride || null,
        isActive: overrideInput.isActive !== undefined ? overrideInput.isActive : true
      };

      // Handle MJML compilation if provided
      if (overrideInput.mjmlOverride !== undefined) {
        const mjmlResult = await this.compileMjml(overrideInput.mjmlOverride, overrideInput.templateKey);
        overrideData.mjmlOverride = overrideInput.mjmlOverride;
        overrideData.htmlOverride = mjmlResult.html;
      }

      let orgTemplate: OrgEmailTemplate;

      if (existingOverride) {
        // Update existing override
        orgTemplate = await storage.updateOrgEmailTemplate(existingOverride.id, overrideData);
        console.log(`${this.LOG_PREFIX} Org override updated for template '${overrideInput.templateKey}' (org: ${overrideInput.orgId}, version ${orgTemplate.version})`);
      } else {
        // Create new override
        orgTemplate = await storage.createOrgEmailTemplate(overrideData as InsertOrgEmailTemplate);
        console.log(`${this.LOG_PREFIX} Org override created for template '${overrideInput.templateKey}' (org: ${overrideInput.orgId}, version ${orgTemplate.version})`);
      }

      return orgTemplate;

    } catch (error) {
      if (error instanceof TemplateNotFoundError || error instanceof MjmlCompilationError) {
        throw error;
      }
      
      console.error(`${this.LOG_PREFIX} Error creating/updating org override for '${overrideInput.templateKey}':`, error);
      throw new Error(`Failed to create/update org override: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get resolved template with platform default + org override
   * 
   * @param orgId Organization ID
   * @param key Template key identifier
   * @returns ResolvedTemplate with effective content and source info
   * @throws TemplateNotFoundError if template doesn't exist
   */
  async getTemplate(orgId: string, key: string): Promise<ResolvedTemplate> {
    console.log(`${this.LOG_PREFIX} Getting template '${key}' for org '${orgId}'`);

    try {
      // Use storage's comprehensive template resolution
      const effectiveTemplate = await storage.getEffectiveEmailTemplate(orgId, key);
      
      if (!effectiveTemplate) {
        console.warn(`${this.LOG_PREFIX} Template '${key}' not found for org '${orgId}' - attempting self-healing`);
        
        // Self-healing: Auto-seed missing templates
        try {
          const seedService = await getEmailTemplateSeedService();
          const isSeeded = await seedService.autoSeedMissingTemplates();
          
          if (isSeeded) {
            console.log(`${this.LOG_PREFIX} Self-healing successful - retrying template resolution for '${key}'`);
            
            // Retry template resolution after seeding
            const retryTemplate = await storage.getEffectiveEmailTemplate(orgId, key);
            
            if (retryTemplate) {
              console.log(`${this.LOG_PREFIX} Template '${key}' successfully resolved after self-healing`);
              const { template, override } = retryTemplate;
              
              // Continue with normal resolution logic
              const hasOverride = override && override.isActive;
              const source: 'org' | 'platform' = hasOverride ? 'org' : 'platform';
              
              return {
                key: template.key,
                name: template.name,
                subject: retryTemplate.effectiveSubject,
                html: retryTemplate.effectiveHtml,
                text: retryTemplate.effectiveText,
                mjml: retryTemplate.effectiveMjml,
                source,
                version: {
                  org: hasOverride ? override.version : null,
                  platform: template.version
                },
                variablesSchema: template.variablesSchema
              };
            }
          }
          
          console.error(`${this.LOG_PREFIX} Self-healing failed or template '${key}' still not found after seeding`);
        } catch (seedError) {
          console.error(`${this.LOG_PREFIX} Self-healing failed for template '${key}':`, seedError);
        }
        
        // If self-healing failed, throw original error
        throw new TemplateNotFoundError(
          key, 
          orgId,
          `Template '${key}' not found. Platform default may be missing. Self-healing attempted but failed. Please contact support or manually seed templates via SuperAdmin panel.`
        );
      }

      const { template, override } = effectiveTemplate;

      // Determine source and build version info
      const hasOverride = override && override.isActive;
      const source: 'org' | 'platform' = hasOverride ? 'org' : 'platform';
      
      const resolvedTemplate: ResolvedTemplate = {
        key: template.key,
        name: template.name,
        subject: effectiveTemplate.effectiveSubject,
        html: effectiveTemplate.effectiveHtml,
        text: effectiveTemplate.effectiveText,
        mjml: effectiveTemplate.effectiveMjml, // Include MJML source
        source,
        version: {
          org: hasOverride ? override.version : null,
          platform: template.version
        },
        variablesSchema: template.variablesSchema
      };

      console.log(`${this.LOG_PREFIX} Template '${key}' resolved from ${source} (platform v${template.version}${hasOverride ? `, org v${override.version}` : ''})`);
      return resolvedTemplate;

    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }
      
      console.error(`${this.LOG_PREFIX} Error getting template '${key}' for org '${orgId}':`, error);
      throw new Error(`Failed to retrieve template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render template with variables using Handlebars compilation
   * 
   * @param key Template key identifier  
   * @param orgId Organization ID
   * @param variables Template variables for compilation
   * @returns RenderedTemplate with compiled subject, html, and text
   * @throws VariableValidationError if required variables are missing
   * @throws TemplateCompilationError if Handlebars compilation fails
   */
  async render(key: string, orgId: string, variables: Record<string, any>): Promise<RenderedTemplate> {
    console.log(`${this.LOG_PREFIX} Rendering template '${key}' for org '${orgId}' with ${Object.keys(variables).length} variable groups`);

    try {
      // Get resolved template
      const template = await this.getTemplate(orgId, key);

      // Validate variables against schema if available
      if (template.variablesSchema) {
        this.validateVariables(variables, template.variablesSchema, key);
      }

      // Compile templates with Handlebars
      const compilationErrors: string[] = [];
      let compiledSubject: string;
      let compiledHtml: string;
      let compiledText: string | null = null;

      try {
        const subjectTemplate = this.handlebarsEngine.compile(template.subject);
        compiledSubject = subjectTemplate(variables);
      } catch (error) {
        const errorMsg = `Subject compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        compilationErrors.push(errorMsg);
        compiledSubject = template.subject; // Fallback to uncompiled
      }

      try {
        const htmlTemplate = this.handlebarsEngine.compile(template.html);
        compiledHtml = htmlTemplate(variables);
      } catch (error) {
        const errorMsg = `HTML compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        compilationErrors.push(errorMsg);
        compiledHtml = template.html; // Fallback to uncompiled
      }

      if (template.text) {
        try {
          const textTemplate = this.handlebarsEngine.compile(template.text);
          compiledText = textTemplate(variables);
        } catch (error) {
          const errorMsg = `Text compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          compilationErrors.push(errorMsg);
          compiledText = template.text; // Fallback to uncompiled
        }
      }

      // If there were compilation errors, throw them
      if (compilationErrors.length > 0) {
        console.error(`${this.LOG_PREFIX} Template compilation errors for '${key}':`, compilationErrors);
        throw new TemplateCompilationError(key, compilationErrors);
      }

      const renderedTemplate: RenderedTemplate = {
        subject: compiledSubject,
        html: compiledHtml,
        text: compiledText
      };

      console.log(`${this.LOG_PREFIX} Template '${key}' rendered successfully`);
      return renderedTemplate;

    } catch (error) {
      if (error instanceof TemplateNotFoundError || 
          error instanceof VariableValidationError || 
          error instanceof TemplateCompilationError) {
        throw error;
      }
      
      console.error(`${this.LOG_PREFIX} Error rendering template '${key}' for org '${orgId}':`, error);
      throw new Error(`Failed to render template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all available templates with organization override information
   * 
   * @param orgId Organization ID
   * @returns TemplateList with availability info for each template
   */
  async list(orgId: string): Promise<TemplateList> {
    console.log(`${this.LOG_PREFIX} Listing templates for org '${orgId}'`);

    try {
      // Get all platform templates
      const platformTemplates = await storage.getAllEmailTemplates();
      
      // Get organization overrides  
      const orgOverrides = await storage.getOrgEmailTemplatesByOrg(orgId);
      
      // Create lookup map for overrides
      const overrideMap = new Map<string, OrgEmailTemplate>();
      for (const override of orgOverrides) {
        overrideMap.set(override.templateKey, override);
      }

      // Build template list items
      const templates: TemplateListItem[] = platformTemplates.map(template => {
        const override = overrideMap.get(template.key);
        const hasOverride = override && override.isActive;
        
        return {
          key: template.key,
          name: template.name,
          category: template.category,
          hasOverride: !!hasOverride,
          platformVersion: template.version,
          orgVersion: hasOverride ? override.version : null,
          isActive: template.isActive,
          lastUpdated: hasOverride ? override.updatedAt : template.updatedAt
        };
      });

      // Sort by category then name
      templates.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });

      const templateList: TemplateList = {
        templates,
        totalCount: templates.length,
        overrideCount: templates.filter(t => t.hasOverride).length
      };

      console.log(`${this.LOG_PREFIX} Listed ${templateList.totalCount} templates (${templateList.overrideCount} with overrides) for org '${orgId}'`);
      return templateList;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error listing templates for org '${orgId}':`, error);
      throw new Error(`Failed to list templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate variables against JSON schema
   * 
   * @param variables Provided variables
   * @param schema Variables schema from template
   * @param templateKey Template key for error context
   * @throws VariableValidationError if validation fails
   */
  private validateVariables(variables: Record<string, any>, schema: any, templateKey: string): void {
    if (!schema || typeof schema !== 'object') {
      return; // No schema to validate against
    }

    const missingVariables: string[] = [];
    const invalidVariables: string[] = [];

    // Handle JSON Schema format validation
    this.validateJsonSchema('', variables, schema, missingVariables, invalidVariables);

    if (missingVariables.length > 0 || invalidVariables.length > 0) {
      console.error(`${this.LOG_PREFIX} Variable validation failed for template '${templateKey}':`, {
        missing: missingVariables,
        invalid: invalidVariables
      });
      
      throw new VariableValidationError(
        missingVariables,
        invalidVariables,
        `Template '${templateKey}' validation failed. Missing: [${missingVariables.join(', ')}], Invalid: [${invalidVariables.join(', ')}]`
      );
    }
  }

  /**
   * Validate data against JSON Schema format
   * 
   * @param path Current path in schema traversal
   * @param data Current data object
   * @param schema Current schema object (JSON Schema format)
   * @param missing Array to collect missing variables
   * @param invalid Array to collect invalid variables
   */
  private validateJsonSchema(
    path: string, 
    data: any, 
    schema: any, 
    missing: string[], 
    invalid: string[]
  ): void {
    if (!schema || typeof schema !== 'object') {
      return;
    }

    // Handle JSON Schema format with type, required, properties
    if (schema.type === 'object' && schema.properties) {
      // Check required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          const fieldPath = path ? `${path}.${requiredField}` : requiredField;
          if (data === null || data === undefined || !(requiredField in data)) {
            missing.push(fieldPath);
          }
        }
      }

      // Validate properties
      if (data && typeof data === 'object') {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const propPath = path ? `${path}.${propName}` : propName;
          const propValue = data[propName];
          
          if (propValue !== undefined && propValue !== null) {
            this.validateJsonSchema(propPath, propValue, propSchema, missing, invalid);
          }
        }
      }
    } else if (schema.type) {
      // Validate primitive types
      this.validatePrimitiveType(path, data, schema, invalid);
    }
  }

  /**
   * Validate primitive types against JSON Schema
   */
  private validatePrimitiveType(
    path: string,
    data: any,
    schema: any,
    invalid: string[]
  ): void {
    if (data === null || data === undefined) {
      return; // Null/undefined handled in required field validation
    }

    const expectedType = schema.type;
    const actualType = typeof data;

    switch (expectedType) {
      case 'string':
        if (actualType !== 'string') {
          invalid.push(`${path} (expected string, got ${actualType})`);
        }
        break;
      case 'number':
        if (actualType !== 'number') {
          invalid.push(`${path} (expected number, got ${actualType})`);
        }
        break;
      case 'boolean':
        if (actualType !== 'boolean') {
          invalid.push(`${path} (expected boolean, got ${actualType})`);
        }
        break;
      case 'array':
        if (!Array.isArray(data)) {
          invalid.push(`${path} (expected array, got ${actualType})`);
        }
        break;
      case 'object':
        if (actualType !== 'object' || Array.isArray(data)) {
          invalid.push(`${path} (expected object, got ${actualType})`);
        }
        break;
    }
  }

  /**
   * Register Handlebars helpers for template compilation
   */
  private registerHandlebarsHelpers(): void {
    // Date formatting helper
    this.handlebarsEngine.registerHelper('formatDate', (date: any, format?: string) => {
      try {
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) {
          return '[Invalid Date]';
        }
        
        switch (format) {
          case 'short':
            return dateObj.toLocaleDateString();
          case 'long':
            return dateObj.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          case 'time':
            return dateObj.toLocaleTimeString();
          default:
            return dateObj.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
        }
      } catch (error) {
        return '[Date Error]';
      }
    });

    // Uppercase helper
    this.handlebarsEngine.registerHelper('uppercase', (str: any) => {
      if (typeof str !== 'string') {
        return String(str).toUpperCase();
      }
      return str.toUpperCase();
    });

    // Lowercase helper
    this.handlebarsEngine.registerHelper('lowercase', (str: any) => {
      if (typeof str !== 'string') {
        return String(str).toLowerCase();
      }
      return str.toLowerCase();
    });

    // Link helper with XSS protection
    this.handlebarsEngine.registerHelper('link', (url: any, text?: any) => {
      const safeUrl = this.escapeHtml(String(url));
      const safeText = this.escapeHtml(String(text || url));
      return new this.handlebarsEngine.SafeString(`<a href="${safeUrl}">${safeText}</a>`);
    });

    // Conditional helper
    this.handlebarsEngine.registerHelper('if_eq', function(this: any, a: any, b: any, options: any) {
      if (a === b) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    });

    // Default value helper
    this.handlebarsEngine.registerHelper('default', (value: any, defaultValue: any) => {
      return value || defaultValue || '';
    });

    console.log(`${this.LOG_PREFIX} Handlebars helpers registered`);
  }

  /**
   * Escape HTML to prevent XSS attacks
   * 
   * @param unsafe Unsafe string content
   * @returns HTML-escaped string
   */
  private escapeHtml(unsafe: string): string {
    const entityMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    return String(unsafe).replace(/[&<>"'`=\/]/g, (s: string) => entityMap[s]);
  }

  // =============================================================================
  // CONVENIENCE METHODS FOR BACKWARD COMPATIBILITY
  // =============================================================================

  /**
   * Send notification when a new admin is added to the organization
   */
  async sendNewAdminNotification(
    adminEmail: string,
    newAdminData: Record<string, any>,
    orgId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rendered = await this.render('admin.new_admin_added', orgId, newAdminData);
      console.log(`${this.LOG_PREFIX} Would send new admin notification to ${adminEmail} for org ${orgId}`);
      return { success: true };
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send new admin notification:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send notification when a new user is added to the organization
   */
  async sendNewUserNotification(
    adminEmail: string,
    newUserData: Record<string, any>,
    orgId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rendered = await this.render('admin.new_user_added', orgId, newUserData);
      console.log(`${this.LOG_PREFIX} Would send new user notification to ${adminEmail} for org ${orgId}`);
      return { success: true };
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send new user notification:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send notification when a course is assigned to a user
   */
  async sendCourseAssignedNotification(
    adminEmail: string,
    assignmentData: Record<string, any>,
    orgId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rendered = await this.render('admin.new_course_assigned', orgId, assignmentData);
      console.log(`${this.LOG_PREFIX} Would send course assigned notification to ${adminEmail} for org ${orgId}`);
      return { success: true };
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send course assigned notification:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send notification when the organization's plan is updated
   */
  async sendPlanUpdatedNotification(
    adminEmail: string,
    planData: Record<string, any>,
    orgId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rendered = await this.render('admin.plan_updated', orgId, planData);
      console.log(`${this.LOG_PREFIX} Would send plan updated notification to ${adminEmail} for org ${orgId}`);
      return { success: true };
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send plan updated notification:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send notification when a learner completes a course
   */
  async sendLearnerCompletedNotification(
    adminEmail: string,
    completionData: Record<string, any>,
    orgId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rendered = await this.render('admin.learner_completed_course', orgId, completionData);
      console.log(`${this.LOG_PREFIX} Would send learner completed notification to ${adminEmail} for org ${orgId}`);
      return { success: true };
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send learner completed notification:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send notification when a learner fails a course
   */
  async sendLearnerFailedNotification(
    adminEmail: string,
    failureData: Record<string, any>,
    orgId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rendered = await this.render('admin.learner_failed_course', orgId, failureData);
      console.log(`${this.LOG_PREFIX} Would send learner failed notification to ${adminEmail} for org ${orgId}`);
      return { success: true };
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send learner failed notification:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // HEALTH CHECK AND DIAGNOSTICS
  // =============================================================================

  /**
   * Get service health status
   * 
   * @returns Health check result
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      storage: boolean;
      handlebars: boolean;
      templates: boolean;
      mjml: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const checks = {
      storage: false,
      handlebars: false,
      templates: false,
      mjml: false
    };

    try {
      // Test storage connectivity
      await storage.getAllEmailTemplates();
      checks.storage = true;
    } catch (error) {
      errors.push(`Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test Handlebars compilation
      const testTemplate = this.handlebarsEngine.compile('Hello {{name}}!');
      const result = testTemplate({ name: 'Test' });
      if (result === 'Hello Test!') {
        checks.handlebars = true;
      } else {
        errors.push('Handlebars compilation test failed');
      }
    } catch (error) {
      errors.push(`Handlebars check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test template resolution
      const templates = await storage.getAllEmailTemplates();
      checks.templates = templates.length > 0;
      if (!checks.templates) {
        errors.push('No email templates found in system');
      }
    } catch (error) {
      errors.push(`Template check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test MJML compilation
      const testMjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>
                  Hello {{name}}! This is a test template.
                </mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `;
      
      const result = await this.compileMjml(testMjml, 'health-check-test');
      if (result.html && result.html.includes('Hello {{name}}')) {
        checks.mjml = true;
      } else {
        errors.push('MJML compilation test failed - unexpected output');
      }
    } catch (error) {
      errors.push(`MJML check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      errors
    };
  }
}

// Export singleton instance
export const emailTemplateService = new EmailTemplateService();