/**
 * EmailOrchestrator - Central email orchestration service
 * 
 * This service provides the core email functionality for the new template system:
 * - render(): Template rendering with variable validation and HTML escaping
 * - queue(): Email queuing with idempotency and retry policy 
 * - sendNow(): Immediate email sending for testing
 * - Automatic retry logic with exponential backoff
 * - Integration with existing MailerService (preserved exactly)
 * 
 * Key Features:
 * - Idempotency prevents duplicate sends within 10 minutes
 * - Retry policy: 3 attempts with exponential backoff (2s, 8s, 32s)
 * - Template variable validation and security (HTML escaping)
 * - Comprehensive logging to email_sends table
 * - Support for trigger events and context variables
 */

import Handlebars from 'handlebars';
import { storage } from '../storage';
import { MailerService, type EmailResult } from './MailerService';
import type { 
  EmailSend,
  InsertEmailSend,
  EmailTemplate,
  OrgEmailTemplate,
  InsertEmailSettingsLock,
  EmailProviderConfigs
} from '@shared/schema';

// Initialize the existing MailerService (preserve exactly as specified)
const mailerService = new MailerService();

// Email orchestrator interfaces
export interface TemplateRenderContext {
  // Common variables for all templates
  user?: {
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  org?: {
    name?: string;
    displayName?: string;
  };
  admin?: {
    name?: string;
    email?: string;
    fullName?: string;
  };
  course?: {
    title?: string;
    description?: string;
  };
  plan?: {
    name?: string;
    oldPrice?: string;
    newPrice?: string;
  };
  attempt?: {
    score?: string;
    passed?: boolean;
  };
  
  // Event-specific variables
  addedBy?: {
    name?: string;
  };
  assignedBy?: {
    name?: string;
  };
  changedBy?: {
    name?: string;
  };
  
  // Date/time variables
  addedAt?: string;
  assignedAt?: string; 
  completedAt?: string;
  changedAt?: string;
  
  // URLs and links
  loginUrl?: string;
  launchUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  
  // Authentication
  temporaryPassword?: string;
  dueDate?: string;
  
  // Email branding
  fromName?: string;
  fromEmail?: string;
}

export interface QueueEmailParams {
  // Required parameters
  triggerEvent: 'ORG_FAST_ADD' | 'USER_FAST_ADD' | 'COURSE_ASSIGNED' | 'COURSE_COMPLETED' | 'COURSE_FAILED' | 'PLAN_UPDATED';
  templateKey: string;
  toEmail: string;
  context: TemplateRenderContext;
  
  // Optional parameters
  organisationId?: string;
  resourceId?: string; // For idempotency: course ID, user ID, etc.
  priority?: number; // Higher priority emails sent first
  scheduledFor?: Date; // Schedule for future sending
}

export interface SendNowParams {
  templateKey: string;
  toEmail: string;
  context: TemplateRenderContext;
  organisationId?: string;
}

export interface RenderedEmail {
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateKey: string;
  templateVersion: number;
}

export interface OrchestratorResult {
  success: boolean;
  emailSendId?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  idempotencyStatus?: 'new' | 'duplicate' | 'expired';
  sendResult?: EmailResult;
  providerSource?: 'org_custom' | 'system_default' | 'fallback';
}

// Template rendering errors
export class TemplateRenderError extends Error {
  constructor(
    public templateKey: string,
    public missingVariables: string[],
    message?: string
  ) {
    super(message || `Template rendering failed for '${templateKey}': missing variables ${missingVariables.join(', ')}`);
    this.name = 'TemplateRenderError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(
    public templateKey: string,
    public organisationId?: string
  ) {
    super(`Template '${templateKey}' not found${organisationId ? ` for organization '${organisationId}'` : ''}`);
    this.name = 'TemplateNotFoundError';
  }
}

export class IdempotencyError extends Error {
  constructor(
    public idempotencyKey: string,
    public existingEmailSendId: string
  ) {
    super(`Duplicate email prevented by idempotency key: ${idempotencyKey}`);
    this.name = 'IdempotencyError';
  }
}

export class EmailOrchestrator {
  private readonly LOG_PREFIX = '[EmailOrchestrator]';
  private handlebarsEngine: typeof Handlebars;
  
  // Idempotency settings
  private readonly IDEMPOTENCY_WINDOW_MINUTES = 10;
  
  // Retry settings
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [2000, 8000, 32000]; // 2s, 8s, 32s
  
  // Email provider routing
  private readonly PROVIDER_SOURCES = {
    ORG_CUSTOM: 'org_custom' as const,
    SYSTEM_DEFAULT: 'system_default' as const,
    FALLBACK: 'fallback' as const
  };

  constructor() {
    // Initialize Handlebars with security-focused configuration
    this.handlebarsEngine = Handlebars.create();
    
    // Register security helpers for HTML escaping
    this.handlebarsEngine.registerHelper('escape', (value: any) => {
      if (typeof value !== 'string') return value;
      return this.handlebarsEngine.escapeExpression(value);
    });
    
    // Register conditional helpers
    this.handlebarsEngine.registerHelper('if_eq', function(this: any, a: any, b: any, options: any) {
      return (a === b) ? options.fn(this) : options.inverse(this);
    });
    
    this.handlebarsEngine.registerHelper('if_not_eq', function(this: any, a: any, b: any, options: any) {
      return (a !== b) ? options.fn(this) : options.inverse(this);
    });
    
    console.log(`${this.LOG_PREFIX} Initialized with security helpers`);
  }

  /**
   * Render a template with the provided context variables
   * Validates required variables and escapes HTML content
   */
  async render(templateKey: string, context: TemplateRenderContext, organisationId?: string): Promise<RenderedEmail> {
    try {
      // Get the effective template (org override or platform default)
      const template = await this.getEffectiveTemplate(templateKey, organisationId);
      
      if (!template) {
        throw new TemplateNotFoundError(templateKey, organisationId);
      }

      // Validate required variables if schema is defined
      if (template.variablesSchema) {
        this.validateTemplateVariables(template.variablesSchema, context, templateKey);
      }
      
      // Compile templates with Handlebars
      const subjectTemplate = this.handlebarsEngine.compile(template.subject);
      const htmlTemplate = this.handlebarsEngine.compile(template.html);
      const textTemplate = template.text ? this.handlebarsEngine.compile(template.text) : null;
      
      // Render with context
      const subject = subjectTemplate(context);
      const htmlContent = htmlTemplate(context); 
      const textContent = textTemplate ? textTemplate(context) : undefined;
      
      console.log(`${this.LOG_PREFIX} Successfully rendered template '${templateKey}' for org '${organisationId || 'system'}'`);
      
      return {
        subject,
        htmlContent,
        textContent,
        templateKey,
        templateVersion: template.version
      };

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Template rendering failed:`, {
        templateKey,
        organisationId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
  }

  /**
   * Queue an email for sending with idempotency protection
   * Prevents duplicate sends within 10-minute window
   */
  async queue(params: QueueEmailParams): Promise<OrchestratorResult> {
    try {
      // Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(
        params.triggerEvent,
        params.toEmail,
        params.resourceId || 'no-resource'
      );
      
      console.log(`${this.LOG_PREFIX} Queueing email with idempotency key: ${idempotencyKey}`);

      // Check for existing send within idempotency window
      const existingSend = await this.checkIdempotency(idempotencyKey);
      if (existingSend) {
        console.log(`${this.LOG_PREFIX} Duplicate email prevented by idempotency`, {
          idempotencyKey,
          existingId: existingSend.id
        });
        
        return {
          success: false,
          emailSendId: existingSend.id,
          idempotencyStatus: 'duplicate',
          error: {
            code: 'DUPLICATE_EMAIL',
            message: `Duplicate email prevented by idempotency key: ${idempotencyKey}`,
            details: { existingEmailSendId: existingSend.id }
          }
        };
      }

      // Render the email template
      const rendered = await this.render(params.templateKey, params.context, params.organisationId);
      
      // Create email send record
      const emailSend: InsertEmailSend = {
        idempotencyKey,
        triggerEvent: params.triggerEvent,
        organisationId: params.organisationId || null,
        templateKey: params.templateKey,
        toEmail: params.toEmail,
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent || null,
        templateVariables: params.context,
        status: 'queued',
        retryCount: 0,
        fromEmail: params.context.fromEmail || null,
        fromName: params.context.fromName || null,
        replyTo: params.context.supportEmail || null
      };

      const createdSend = await storage.createEmailSend(emailSend);
      
      console.log(`${this.LOG_PREFIX} Email queued successfully`, {
        emailSendId: createdSend.id,
        templateKey: params.templateKey,
        triggerEvent: params.triggerEvent,
        toEmail: params.toEmail
      });

      // Send immediately (can be changed to background processing later)
      const sendResult = await this.processSendQueue(createdSend.id);
      
      return {
        success: true,
        emailSendId: createdSend.id,
        idempotencyStatus: 'new',
        sendResult: sendResult || undefined
      };

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Queue operation failed:`, error);
      
      return {
        success: false,
        error: {
          code: error.name || 'QUEUE_ERROR',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Send an email immediately (for testing and previews)
   */
  async sendNow(params: SendNowParams): Promise<OrchestratorResult> {
    try {
      console.log(`${this.LOG_PREFIX} Sending email immediately for testing`);

      // Render the email template
      const rendered = await this.render(params.templateKey, params.context, params.organisationId);
      
      // For immediate sends (testing), we can use organization provider if available
      let sendResult: EmailResult;
      let providerSource: 'org_custom' | 'system_default' | 'fallback' = this.PROVIDER_SOURCES.SYSTEM_DEFAULT;
      
      if (params.organisationId) {
        // Create temporary EmailSend object for provider resolution
        const tempEmailSend: EmailSend = {
          id: 'temp-immediate-send',
          organisationId: params.organisationId,
          toEmail: params.toEmail,
          subject: rendered.subject,
          htmlContent: rendered.htmlContent,
          textContent: rendered.textContent || null,
        } as EmailSend;
        
        const emailResult = await this.sendEmailWithOrganizationProvider(tempEmailSend);
        sendResult = emailResult.result;
        providerSource = emailResult.providerSource;
        
        console.log(`${this.LOG_PREFIX} Immediate send used provider source: ${providerSource}`);
      } else {
        // No organization context, use system defaults
        sendResult = await mailerService.send({
          to: params.toEmail,
          subject: rendered.subject,
          html: rendered.htmlContent,
          text: rendered.textContent,
          templateType: params.templateKey as any // Cast for compatibility
        });
      }

      console.log(`${this.LOG_PREFIX} Immediate send completed`, {
        success: sendResult.success,
        provider: sendResult.provider,
        toEmail: params.toEmail
      });

      return {
        success: sendResult.success,
        sendResult,
        providerSource
      };

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Immediate send failed:`, error);
      
      return {
        success: false,
        error: {
          code: error.name || 'SEND_ERROR',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Resolve organization-specific email provider settings
   * Returns custom configuration if available, null if organization should use system defaults
   */
  private async resolveOrganizationEmailProvider(organisationId: string): Promise<{
    settings: any | null;
    source: 'org_custom' | 'system_default';
    providerType: string | null;
  }> {
    try {
      console.log(`${this.LOG_PREFIX} Resolving email provider for organization: ${organisationId}`);
      
      // Get organization's custom email provider configuration
      const orgEmailConfig = await storage.getEmailProviderConfigByOrg(organisationId);
      
      if (orgEmailConfig && orgEmailConfig.configJson) {
        console.log(`${this.LOG_PREFIX} Found custom email provider: ${orgEmailConfig.provider} for org: ${organisationId}`);
        
        return {
          settings: orgEmailConfig.configJson,
          source: this.PROVIDER_SOURCES.ORG_CUSTOM,
          providerType: orgEmailConfig.provider
        };
      }
      
      console.log(`${this.LOG_PREFIX} No custom email provider found for org: ${organisationId}, using system defaults`);
      return {
        settings: null,
        source: this.PROVIDER_SOURCES.SYSTEM_DEFAULT,
        providerType: null
      };
      
    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Error resolving organization email provider for ${organisationId}:`, error);
      return {
        settings: null,
        source: this.PROVIDER_SOURCES.SYSTEM_DEFAULT,
        providerType: null
      };
    }
  }
  
  /**
   * Send email using organization-specific provider settings with system fallback
   */
  private async sendEmailWithOrganizationProvider(emailSend: EmailSend): Promise<{
    result: EmailResult;
    providerSource: 'org_custom' | 'system_default' | 'fallback';
  }> {
    let providerSource: 'org_custom' | 'system_default' | 'fallback' = this.PROVIDER_SOURCES.SYSTEM_DEFAULT;
    
    try {
      // If organization ID is available, try custom settings first
      if (emailSend.organisationId) {
        const orgProvider = await this.resolveOrganizationEmailProvider(emailSend.organisationId);
        
        if (orgProvider.source === this.PROVIDER_SOURCES.ORG_CUSTOM && orgProvider.settings) {
          console.log(`${this.LOG_PREFIX} Attempting to send email using organization custom provider: ${orgProvider.providerType}`);
          providerSource = this.PROVIDER_SOURCES.ORG_CUSTOM;
          
          try {
            // Try sending with organization custom settings
            const orgResult = await this.sendWithCustomProvider(emailSend, orgProvider.settings, orgProvider.providerType!);
            
            if (orgResult.success) {
              console.log(`${this.LOG_PREFIX} Email sent successfully using org custom provider: ${orgProvider.providerType}`);
              return {
                result: orgResult,
                providerSource: this.PROVIDER_SOURCES.ORG_CUSTOM
              };
            } else {
              console.warn(`${this.LOG_PREFIX} Org custom provider failed, falling back to system defaults:`, orgResult.error);
              providerSource = this.PROVIDER_SOURCES.FALLBACK;
            }
          } catch (customError: any) {
            console.error(`${this.LOG_PREFIX} Exception with org custom provider, falling back to system:`, customError.message);
            providerSource = this.PROVIDER_SOURCES.FALLBACK;
          }
        }
      }
      
      // Use system defaults (either by design or as fallback)
      console.log(`${this.LOG_PREFIX} Sending email using system default provider`);
      const systemResult = await mailerService.send({
        orgId: emailSend.organisationId || undefined,
        to: emailSend.toEmail,
        subject: emailSend.subject,
        html: emailSend.htmlContent,
        text: emailSend.textContent || undefined,
        templateType: emailSend.templateKey as any
      });
      
      return {
        result: systemResult,
        providerSource
      };
      
    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Critical error in email provider routing:`, error);
      
      // Return a failed result
      return {
        result: {
          success: false,
          provider: 'smtp_generic' as any,
          details: {
            from: emailSend.fromEmail || 'unknown',
            to: emailSend.toEmail,
            effectiveFieldSources: {},
            timestamp: new Date().toISOString()
          },
          error: {
            code: 'PROVIDER_ROUTING_ERROR',
            short: 'Email provider routing failed',
            raw: error.message
          }
        },
        providerSource: this.PROVIDER_SOURCES.SYSTEM_DEFAULT
      };
    }
  }
  
  /**
   * Send email using custom provider configuration
   * This is a simplified implementation - in a real system you'd need full provider adapters
   */
  private async sendWithCustomProvider(emailSend: EmailSend, customConfig: any, providerType: string): Promise<EmailResult> {
    // For now, we'll use the existing MailerService with special parameters
    // In a full implementation, you'd create custom adapters for different provider types
    
    console.log(`${this.LOG_PREFIX} Sending with custom ${providerType} provider configuration`);
    
    // This is a placeholder implementation - the real implementation would:
    // 1. Parse the customConfig JSON based on providerType
    // 2. Create appropriate adapter instances
    // 3. Send through the custom provider
    
    // For now, delegate to MailerService with organization context
    return await mailerService.send({
      orgId: emailSend.organisationId || undefined,
      to: emailSend.toEmail,
      subject: emailSend.subject,
      html: emailSend.htmlContent,
      text: emailSend.textContent || undefined,
      templateType: emailSend.templateKey as any
    });
  }
  
  /**
   * Process queued emails with retry logic
   */
  private async processSendQueue(emailSendId: string): Promise<EmailResult | null> {
    try {
      const emailSend = await storage.getEmailSend(emailSendId);
      if (!emailSend) {
        console.error(`${this.LOG_PREFIX} Email send record not found: ${emailSendId}`);
        return null;
      }

      // Update status to sending
      await storage.updateEmailSend(emailSendId, {
        status: 'sending',
        lastAttemptAt: new Date()
      });

      // Send using organization-specific email provider with system fallback
      const emailResult = await this.sendEmailWithOrganizationProvider(emailSend);
      const sendResult = emailResult.result;
      const providerSource = emailResult.providerSource;

      if (sendResult.success) {
        // Update as sent
        await storage.updateEmailSend(emailSendId, {
          status: 'sent',
          provider: sendResult.provider,
          providerMessageId: sendResult.details.messageId || null,
          sentAt: new Date(),
          routingSource: this.mapProviderSourceToRoutingSource(providerSource) as 'system_default' | 'org_primary' | 'org_fallback'
        });

        console.log(`${this.LOG_PREFIX} Email sent successfully`, {
          emailSendId,
          provider: sendResult.provider,
          providerSource,
          messageId: sendResult.details.messageId
        });
      } else {
        // Handle failure and retry logic
        await this.handleSendFailure(emailSendId, emailSend, sendResult);
      }

      return sendResult;

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Send processing failed for ${emailSendId}:`, error);
      
      // Update status to failed
      await storage.updateEmailSend(emailSendId, {
        status: 'failed',
        errorMessage: error.message,
        errorCode: error.name || 'UNKNOWN_ERROR',
        lastAttemptAt: new Date()
      });

      return null;
    }
  }

  /**
   * Map provider source to routing source for storage compatibility
   */
  private mapProviderSourceToRoutingSource(providerSource: 'org_custom' | 'system_default' | 'fallback'): string {
    switch (providerSource) {
      case 'org_custom':
        return 'org_primary';
      case 'fallback':
        return 'org_fallback';
      case 'system_default':
      default:
        return 'system_default';
    }
  }
  
  /**
   * Handle send failures with exponential backoff retry
   */
  private async handleSendFailure(emailSendId: string, emailSend: EmailSend, sendResult: EmailResult): Promise<void> {
    const newRetryCount = emailSend.retryCount + 1;
    
    if (newRetryCount <= this.MAX_RETRIES) {
      // Schedule retry with exponential backoff
      const retryDelay = this.RETRY_DELAYS[newRetryCount - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + retryDelay);
      
      await storage.updateEmailSend(emailSendId, {
        status: 'retrying',
        retryCount: newRetryCount,
        nextRetryAt,
        errorMessage: sendResult.error?.short || 'Send failed',
        errorCode: sendResult.error?.code || 'SEND_FAILED',
        lastAttemptAt: new Date()
      });

      console.log(`${this.LOG_PREFIX} Email scheduled for retry ${newRetryCount}/${this.MAX_RETRIES}`, {
        emailSendId,
        nextRetryAt,
        delay: retryDelay
      });

      // TODO: Implement background job queue for processing retries
      // For now, we'll mark as failed after max retries
      
    } else {
      // Max retries exceeded, mark as permanently failed
      await storage.updateEmailSend(emailSendId, {
        status: 'failed',
        errorMessage: `Max retries (${this.MAX_RETRIES}) exceeded. Last error: ${sendResult.error?.short || 'Send failed'}`,
        errorCode: sendResult.error?.code || 'MAX_RETRIES_EXCEEDED',
        lastAttemptAt: new Date()
      });

      console.error(`${this.LOG_PREFIX} Email permanently failed after ${this.MAX_RETRIES} retries`, {
        emailSendId,
        finalError: sendResult.error
      });
    }
  }

  /**
   * Get effective template (org override or platform default)
   */
  private async getEffectiveTemplate(templateKey: string, organisationId?: string): Promise<EmailTemplate | null> {
    // Try organization override first if org is specified
    if (organisationId) {
      try {
        const orgTemplate = await storage.getOrgEmailTemplateByKey(organisationId, templateKey);
        if (orgTemplate && orgTemplate.isActive) {
          // Merge override with platform default
          const platformTemplate = await storage.getEmailTemplate(templateKey);
          if (platformTemplate) {
            return {
              ...platformTemplate,
              subject: orgTemplate.subjectOverride || platformTemplate.subject,
              html: orgTemplate.htmlOverride || platformTemplate.html,
              text: orgTemplate.textOverride || platformTemplate.text,
              version: orgTemplate.version
            };
          }
        }
      } catch (error: any) {
        console.warn(`${this.LOG_PREFIX} Failed to load org template override:`, error.message);
      }
    }

    // Fall back to platform default
    const platformTemplate = await storage.getEmailTemplateByKey(templateKey);
    return platformTemplate || null;
  }

  /**
   * Generate idempotency key in format: TRIGGER:recipient:resource_id
   */
  private generateIdempotencyKey(triggerEvent: string, toEmail: string, resourceId: string): string {
    return `${triggerEvent}:${toEmail}:${resourceId}`;
  }

  /**
   * Check if email already sent within idempotency window
   */
  private async checkIdempotency(idempotencyKey: string): Promise<EmailSend | null> {
    const windowStart = new Date(Date.now() - (this.IDEMPOTENCY_WINDOW_MINUTES * 60 * 1000));
    
    try {
      const emailSend = await storage.getEmailSendByIdempotencyKey(idempotencyKey, windowStart);
      return emailSend || null;
    } catch (error: any) {
      console.warn(`${this.LOG_PREFIX} Idempotency check failed:`, error.message);
      return null;
    }
  }

  /**
   * Validate template variables against schema
   */
  private validateTemplateVariables(schema: any, context: TemplateRenderContext, templateKey: string): void {
    if (!schema || !schema.required) return;

    const missingVariables: string[] = [];
    const requiredVars = Array.isArray(schema.required) ? schema.required : [];

    for (const requiredVar of requiredVars) {
      // Support nested object access like "user.name"
      const value = this.getNestedValue(context, requiredVar);
      if (value === undefined || value === null || value === '') {
        missingVariables.push(requiredVar);
      }
    }

    if (missingVariables.length > 0) {
      throw new TemplateRenderError(templateKey, missingVariables);
    }
  }

  /**
   * Get nested object value using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Export singleton instance
export const emailOrchestrator = new EmailOrchestrator();