/**
 * EmailTemplateEngineService
 * 
 * Comprehensive templating engine for email templates with:
 * - Safe variable substitution with XSS protection
 * - Variable validation against whitelisted schemas
 * - Template rendering with nested object access
 * - Preview functionality with sample data generation
 * - HTML sanitization and security measures
 * 
 * Template Variable Syntax: {{variable.path}}
 * Examples: {{org.name}}, {{user.full_name}}, {{course.title}}
 */

import { emailTemplateResolver } from './EmailTemplateResolutionService';
import { storage } from '../storage';
import type { EmailTemplate, OrgEmailTemplate } from '@shared/schema';

// Variable parsing result interface
export interface ParsedVariable {
  token: string;      // Full token: {{org.name}}
  path: string;       // Path: org.name
  segments: string[]; // Segments: ['org', 'name']
  isValid?: boolean;  // Validation result
}

// Template validation result
export interface ValidationResult {
  isValid: boolean;
  invalidVariables: ParsedVariable[];
  validVariables: ParsedVariable[];
  errors: string[];
}

// Template rendering options
export interface RenderingOptions {
  escapeHtml: boolean;        // Default: true for HTML templates
  handleMissingVars: 'error' | 'placeholder' | 'empty'; // Default: 'placeholder'
  placeholderText: string;    // Default: '[VARIABLE_NOT_FOUND]'
}

// Sample data interfaces for different template types
export interface AdminSampleData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  user: {
    name: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
  };
  course: {
    title: string;
    description: string;
    category: string;
    estimated_duration: number;
  };
  attempt: {
    score: number;
    status: string;
    time_spent: number;
  };
  plan: {
    name: string;
    old_price: number;
    new_price: number;
    billing_cadence: string;
  };
  new_admin: {
    name: string;
    email: string;
    full_name: string;
  };
  added_by: {
    name: string;
    full_name: string;
  };
  assigned_by: {
    name: string;
    full_name: string;
  };
  changed_by: {
    name: string;
    full_name: string;
  };
  added_at: string;
  assigned_at: string;
  changed_at: string;
  completed_at: string;
  failed_at: string;
  due_date?: string;
  effective_date?: string;
}

// Variable schema definition interface
export interface VariableSchema {
  [key: string]: string | VariableSchema; // Nested schema support
}

export class EmailTemplateEngineService {
  private readonly VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
  private readonly LOG_PREFIX = '[EmailTemplateEngine]';

  /**
   * Parse all variables from a template content
   * 
   * @param templateContent Template content to parse
   * @returns Array of parsed variables
   */
  parseVariables(templateContent: string): ParsedVariable[] {
    const variables: ParsedVariable[] = [];
    let match;
    
    // Reset regex to ensure we start from the beginning
    this.VARIABLE_REGEX.lastIndex = 0;
    
    while ((match = this.VARIABLE_REGEX.exec(templateContent)) !== null) {
      const token = match[0]; // Full match: {{org.name}}
      const path = match[1].trim(); // Variable path: org.name
      const segments = path.split('.').map((s: string) => s.trim());
      
      variables.push({
        token,
        path,
        segments
      });
    }
    
    // Remove duplicates based on token
    const uniqueVariables = variables.filter((variable, index, self) => 
      index === self.findIndex(v => v.token === variable.token)
    );
    
    console.log(`${this.LOG_PREFIX} Parsed ${uniqueVariables.length} unique variables from template`);
    return uniqueVariables;
  }

  /**
   * Validate template variables against allowed schema
   * 
   * @param templateContent Template content to validate
   * @param allowedVariables Schema of allowed variables
   * @returns Validation result with errors and valid/invalid variables
   */
  validateTemplate(templateContent: string, allowedVariables: VariableSchema): ValidationResult {
    const parsedVariables = this.parseVariables(templateContent);
    const validVariables: ParsedVariable[] = [];
    const invalidVariables: ParsedVariable[] = [];
    const errors: string[] = [];

    for (const variable of parsedVariables) {
      const isValid = this.isVariableAllowed(variable.segments, allowedVariables);
      
      if (isValid) {
        validVariables.push({ ...variable, isValid: true });
      } else {
        invalidVariables.push({ ...variable, isValid: false });
        errors.push(`Variable '${variable.path}' is not allowed in this template`);
      }
    }

    const result: ValidationResult = {
      isValid: invalidVariables.length === 0,
      validVariables,
      invalidVariables,
      errors
    };

    console.log(`${this.LOG_PREFIX} Template validation: ${result.isValid ? 'VALID' : 'INVALID'} (${invalidVariables.length} errors)`);
    return result;
  }

  /**
   * Check if a variable path is allowed in the schema
   * 
   * @param segments Variable path segments
   * @param schema Allowed variables schema
   * @returns True if variable is allowed
   */
  private isVariableAllowed(segments: string[], schema: VariableSchema): boolean {
    let current = schema;
    
    for (const segment of segments) {
      if (current[segment] === undefined) {
        return false;
      }
      
      // If it's a string, this should be the last segment
      if (typeof current[segment] === 'string') {
        return segments.indexOf(segment) === segments.length - 1;
      }
      
      // If it's an object, continue traversing
      current = current[segment] as VariableSchema;
    }
    
    return true;
  }

  /**
   * Render template with provided variables
   * 
   * @param templateContent Template content to render
   * @param variables Data object with variable values
   * @param options Rendering options
   * @returns Rendered template content
   */
  renderTemplate(
    templateContent: string, 
    variables: Record<string, any>, 
    options: Partial<RenderingOptions> = {}
  ): string {
    const opts: RenderingOptions = {
      escapeHtml: true,
      handleMissingVars: 'placeholder',
      placeholderText: '[VARIABLE_NOT_FOUND]',
      ...options
    };

    console.log(`${this.LOG_PREFIX} Rendering template with ${Object.keys(variables).length} variable groups`);

    return templateContent.replace(this.VARIABLE_REGEX, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getVariableValue(trimmedPath, variables);

      if (value === undefined || value === null) {
        switch (opts.handleMissingVars) {
          case 'error':
            throw new Error(`Variable '${trimmedPath}' not found in provided data`);
          case 'empty':
            return '';
          case 'placeholder':
          default:
            return opts.placeholderText;
        }
      }

      // Convert value to string
      let stringValue = String(value);

      // Apply HTML escaping if enabled
      if (opts.escapeHtml) {
        stringValue = this.escapeHtml(stringValue);
      }

      return stringValue;
    });
  }

  /**
   * Get variable value from nested object using dot notation
   * 
   * @param path Dot-separated path (e.g., "org.name")
   * @param variables Variables object
   * @returns Variable value or undefined
   */
  private getVariableValue(path: string, variables: Record<string, any>): any {
    const segments = path.split('.');
    let current = variables;

    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Escape HTML entities to prevent XSS attacks
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

  /**
   * Generate sample data for template previews
   * 
   * @param templateType Template type identifier
   * @returns Sample data object
   */
  generateSampleData(templateType: string): AdminSampleData {
    const baseData: AdminSampleData = {
      org: {
        name: 'Acme Corporation',
        display_name: 'ACME Corp',
        subdomain: 'acme-corp'
      },
      admin: {
        name: 'John Smith',
        email: 'john.smith@acmecorp.com',
        full_name: 'John Smith'
      },
      user: {
        name: 'Jane Doe',
        email: 'jane.doe@acmecorp.com',
        full_name: 'Jane Doe',
        job_title: 'Care Assistant',
        department: 'Healthcare'
      },
      course: {
        title: 'Health & Safety Training',
        description: 'Essential health and safety procedures for care workers',
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
      new_admin: {
        name: 'Alice Johnson',
        email: 'alice.johnson@acmecorp.com',
        full_name: 'Alice Johnson'
      },
      added_by: {
        name: 'John Smith',
        full_name: 'John Smith'
      },
      assigned_by: {
        name: 'John Smith',
        full_name: 'John Smith'
      },
      changed_by: {
        name: 'John Smith',
        full_name: 'John Smith'
      },
      added_at: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      assigned_at: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      changed_at: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      completed_at: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      failed_at: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };

    // Customize data based on template type
    switch (templateType) {
      case 'admin.new_admin_added':
        return {
          ...baseData,
          new_admin: {
            name: 'Alice Johnson',
            email: 'alice.johnson@acmecorp.com',
            full_name: 'Alice Johnson'
          }
        };

      case 'admin.new_user_added':
        return {
          ...baseData,
          user: {
            name: 'Jane Doe',
            email: 'jane.doe@acmecorp.com',
            full_name: 'Jane Doe',
            job_title: 'Care Assistant',
            department: 'Healthcare'
          },
          added_by: {
            name: 'John Smith',
            full_name: 'John Smith'
          },
          added_at: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        };

      case 'admin.new_course_assigned':
      case 'course_assigned': // Handle both variants for backward compatibility
        return {
          ...baseData,
          user: {
            name: 'Jane Doe',
            email: 'jane.doe@acmecorp.com',
            full_name: 'Jane Doe',
            job_title: 'Care Assistant',
            department: 'Healthcare'
          },
          course: {
            title: 'Health & Safety Training',
            description: 'Essential health and safety procedures for care workers',
            category: 'Compliance',
            estimated_duration: 45
          },
          assigned_by: {
            name: 'John Smith',
            full_name: 'John Smith'
          },
          assigned_at: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        };

      case 'admin.learner_completed_course':
        return {
          ...baseData,
          user: {
            name: 'Jane Doe',
            email: 'jane.doe@acmecorp.com',
            full_name: 'Jane Doe',
            job_title: 'Care Assistant',
            department: 'Healthcare'
          },
          course: {
            title: 'Health & Safety Training',
            description: 'Essential health and safety procedures for care workers',
            category: 'Compliance',
            estimated_duration: 45
          },
          attempt: {
            score: 87.5,
            status: 'passed',
            time_spent: 42
          },
          completed_at: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        };

      case 'admin.learner_failed_course':
        return {
          ...baseData,
          user: {
            name: 'Jane Doe',
            email: 'jane.doe@acmecorp.com',
            full_name: 'Jane Doe',
            job_title: 'Care Assistant',
            department: 'Healthcare'
          },
          course: {
            title: 'Health & Safety Training',
            description: 'Essential health and safety procedures for care workers',
            category: 'Compliance',
            estimated_duration: 45
          },
          attempt: {
            score: 42.0,
            status: 'failed',
            time_spent: 38
          },
          failed_at: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        };

      case 'admin.plan_updated':
        return {
          ...baseData,
          plan: {
            name: 'Enterprise Plan',
            old_price: 49.99,
            new_price: 59.99,
            billing_cadence: 'annual'
          },
          changed_by: {
            name: 'John Smith',
            full_name: 'John Smith'
          },
          changed_at: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          effective_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        };

      default:
        // For unknown template types, return comprehensive sample data
        // This ensures test emails always have data to work with
        return {
          ...baseData,
          // Add comprehensive default data for common template patterns
          user: {
            name: 'Jane Doe',
            email: 'jane.doe@acmecorp.com',
            full_name: 'Jane Doe',
            job_title: 'Care Assistant',
            department: 'Healthcare'
          },
          course: {
            title: 'Health & Safety Training',
            description: 'Essential health and safety procedures for care workers',
            category: 'Compliance',
            estimated_duration: 45
          },
          new_admin: {
            name: 'Alice Johnson',
            email: 'alice.johnson@acmecorp.com',
            full_name: 'Alice Johnson'
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
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          effective_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        };
    }
  }

  /**
   * Preview template with sample data
   * 
   * @param orgId Organization ID
   * @param templateKey Template key
   * @param customSampleData Optional custom sample data
   * @returns Preview result with rendered content
   */
  async previewTemplate(
    orgId: string, 
    templateKey: string, 
    customSampleData?: Partial<AdminSampleData>
  ): Promise<{
    defaultPreview: {
      subject: string;
      html: string;
      text: string | null;
    };
    overridePreview: {
      subject: string;
      html: string;
      text: string | null;
    } | null;
    sampleData: AdminSampleData;
    validation: {
      defaultValid: ValidationResult;
      overrideValid: ValidationResult | null;
    };
  }> {
    console.log(`${this.LOG_PREFIX} Generating preview for ${orgId}:${templateKey}`);

    try {
      // Get resolved template (includes override logic)
      const resolvedTemplate = await emailTemplateResolver.getEffectiveTemplate(orgId, templateKey);
      
      // Get default template for comparison
      const defaultTemplate = await emailTemplateResolver.getDefaultTemplate(templateKey);
      if (!defaultTemplate) {
        throw new Error(`Default template not found for key: ${templateKey}`);
      }

      // Get override template if exists
      const overrideTemplate = await emailTemplateResolver.getOverride(orgId, templateKey);

      // Generate sample data
      const sampleData: AdminSampleData = {
        ...this.generateSampleData(templateKey),
        ...customSampleData
      };

      // Parse allowed variables from schema
      const allowedVariables = this.parseVariableSchema(defaultTemplate.variablesSchema);

      // Validate default template
      const defaultValidation = this.validateAllTemplateFields(defaultTemplate, allowedVariables);

      // Validate override template if exists
      let overrideValidation: ValidationResult | null = null;
      if (overrideTemplate) {
        overrideValidation = this.validateAllTemplateFields(overrideTemplate, allowedVariables);
      }

      // Render default template preview
      const defaultPreview = {
        subject: this.renderTemplate(defaultTemplate.subject, sampleData, { escapeHtml: false }),
        html: this.renderTemplate(defaultTemplate.html, sampleData, { escapeHtml: true }),
        text: defaultTemplate.text ? 
          this.renderTemplate(defaultTemplate.text, sampleData, { escapeHtml: false }) : 
          null
      };

      // Render override preview if exists
      let overridePreview = null;
      if (overrideTemplate && overrideTemplate.isActive) {
        overridePreview = {
          subject: this.renderTemplate(
            overrideTemplate.subjectOverride ?? defaultTemplate.subject, 
            sampleData, 
            { escapeHtml: false }
          ),
          html: this.renderTemplate(
            overrideTemplate.htmlOverride ?? defaultTemplate.html, 
            sampleData, 
            { escapeHtml: true }
          ),
          text: (overrideTemplate.textOverride ?? defaultTemplate.text) ? 
            this.renderTemplate(
              (overrideTemplate.textOverride ?? defaultTemplate.text) as string, 
              sampleData, 
              { escapeHtml: false }
            ) : null
        };
      }

      return {
        defaultPreview,
        overridePreview,
        sampleData,
        validation: {
          defaultValid: defaultValidation,
          overrideValid: overrideValidation
        }
      };

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error generating preview for ${orgId}:${templateKey}:`, error);
      throw new Error(`Failed to generate template preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate all fields of a template (subject, html, text)
   * 
   * @param template Template object
   * @param allowedVariables Allowed variables schema
   * @returns Combined validation result
   */
  private validateAllTemplateFields(
    template: EmailTemplate | OrgEmailTemplate, 
    allowedVariables: VariableSchema
  ): ValidationResult {
    const results: ValidationResult[] = [];

    // Check if this is a platform template (EmailTemplate) or org override (OrgEmailTemplate)
    if ('subject' in template) {
      // This is a platform EmailTemplate
      results.push(this.validateTemplate(template.subject, allowedVariables));
      results.push(this.validateTemplate(template.html, allowedVariables));
      if (template.text) {
        results.push(this.validateTemplate(template.text, allowedVariables));
      }
    } else {
      // This is an OrgEmailTemplate with overrides
      if (template.subjectOverride) {
        results.push(this.validateTemplate(template.subjectOverride, allowedVariables));
      }
      if (template.htmlOverride) {
        results.push(this.validateTemplate(template.htmlOverride, allowedVariables));
      }
      if (template.textOverride) {
        results.push(this.validateTemplate(template.textOverride, allowedVariables));
      }
    }

    // Combine results
    const combinedResult: ValidationResult = {
      isValid: results.every(r => r.isValid),
      validVariables: results.flatMap(r => r.validVariables),
      invalidVariables: results.flatMap(r => r.invalidVariables),
      errors: results.flatMap(r => r.errors)
    };

    // Remove duplicate variables
    combinedResult.validVariables = combinedResult.validVariables.filter(
      (v, i, self) => i === self.findIndex(x => x.token === v.token)
    );
    combinedResult.invalidVariables = combinedResult.invalidVariables.filter(
      (v, i, self) => i === self.findIndex(x => x.token === v.token)
    );

    return combinedResult;
  }

  /**
   * Parse variable schema from JSON into structured format
   * 
   * @param schemaJson JSON schema from database
   * @returns Parsed variable schema
   */
  private parseVariableSchema(schemaJson: any): VariableSchema {
    if (!schemaJson || typeof schemaJson !== 'object') {
      console.warn(`${this.LOG_PREFIX} Invalid or missing variable schema, using empty schema`);
      return {};
    }

    return schemaJson as VariableSchema;
  }

  /**
   * Get recommended variables schema for a template type
   * 
   * @param templateType Template type identifier
   * @returns Variable schema object
   */
  getRecommendedVariablesSchema(templateType: string): VariableSchema {
    const baseSchema: VariableSchema = {
      org: {
        name: 'string',
        display_name: 'string',
        subdomain: 'string'
      }
    };

    switch (templateType) {
      case 'admin.new_admin_added':
        return {
          ...baseSchema,
          new_admin: {
            name: 'string',
            email: 'string',
            full_name: 'string'
          },
          added_by: {
            name: 'string',
            full_name: 'string'
          },
          added_at: 'string'
        };

      case 'admin.new_user_added':
        return {
          ...baseSchema,
          user: {
            name: 'string',
            email: 'string',
            full_name: 'string',
            job_title: 'string',
            department: 'string'
          },
          added_by: {
            name: 'string',
            full_name: 'string'
          },
          added_at: 'string'
        };

      case 'admin.new_course_assigned':
        return {
          ...baseSchema,
          user: {
            name: 'string',
            email: 'string',
            full_name: 'string'
          },
          course: {
            title: 'string',
            description: 'string',
            category: 'string',
            estimated_duration: 'number'
          },
          assigned_by: {
            name: 'string',
            full_name: 'string'
          },
          assigned_at: 'string'
        };

      case 'admin.plan_updated':
        return {
          ...baseSchema,
          plan: {
            name: 'string',
            old_price: 'number',
            new_price: 'number',
            billing_cadence: 'string'
          },
          changed_by: {
            name: 'string',
            full_name: 'string'
          },
          changed_at: 'string'
        };

      case 'admin.learner_completed_course':
        return {
          ...baseSchema,
          user: {
            name: 'string',
            email: 'string',
            full_name: 'string'
          },
          course: {
            title: 'string',
            description: 'string'
          },
          attempt: {
            score: 'number',
            status: 'string',
            time_spent: 'number'
          },
          completed_at: 'string'
        };

      case 'admin.learner_failed_course':
        return {
          ...baseSchema,
          user: {
            name: 'string',
            email: 'string',
            full_name: 'string'
          },
          course: {
            title: 'string',
            description: 'string'
          },
          attempt: {
            score: 'number',
            status: 'string',
            time_spent: 'number'
          },
          failed_at: 'string'
        };

      default:
        return baseSchema;
    }
  }

  /**
   * Render template with real data for email sending
   * 
   * @param template Template content (subject, html, text)
   * @param variables Real variable data
   * @returns Rendered template ready for sending
   */
  async renderForSending(
    template: { subject: string; html: string; text: string | null },
    variables: Record<string, any>
  ): Promise<{ subject: string; html: string; text: string | null }> {
    console.log(`${this.LOG_PREFIX} Rendering template for email sending`);

    try {
      const rendered = {
        subject: this.renderTemplate(template.subject, variables, { escapeHtml: false }),
        html: this.renderTemplate(template.html, variables, { escapeHtml: true }),
        text: template.text ? 
          this.renderTemplate(template.text, variables, { escapeHtml: false }) : 
          null
      };

      console.log(`${this.LOG_PREFIX} Successfully rendered template for sending`);
      return rendered;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error rendering template for sending:`, error);
      throw new Error(`Failed to render template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const emailTemplateEngine = new EmailTemplateEngineService();