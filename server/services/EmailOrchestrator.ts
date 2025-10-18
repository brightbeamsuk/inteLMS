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
import { emailTemplateResolver } from './EmailTemplateResolutionService';
import { isGdprEnabled } from '../config/gdpr';
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
    id?: string; // Added for consent checking
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
  
  // GDPR Breach notification variables (Articles 33 & 34)
  breach?: {
    id?: string;
    title?: string;
    description?: string;
    reference?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    detectedAt?: string;
    notificationDeadline?: string;
    affectedSubjects?: number | string;
    dataCategories?: string[];
    cause?: string;
    impact?: string;
    containmentMeasures?: string;
    preventiveMeasures?: string;
    responsible?: string;
    riskAssessment?: string;
    icoRequired?: boolean;
    subjectNotificationRequired?: boolean;
    daysUntilDeadline?: number;
    hoursUntilDeadline?: number;
    isOverdue?: boolean;
  };
  
  // GDPR Dashboard Compliance Reporting variables
  complianceReport?: {
    reportType?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'audit' | 'ico_submission';
    reportPeriod?: string;
    overallScore?: number;
    previousScore?: number;
    scoreChange?: number;
    complianceStatus?: 'compliant' | 'attention_required' | 'non_compliant';
    criticalIssues?: number;
    warningIssues?: number;
    totalAlerts?: number;
    
    // Consent Management Metrics
    consentMetrics?: {
      totalConsents?: number;
      activeConsents?: number;
      consentRate?: number;
      withdrawalRate?: number;
      marketingConsentRate?: number;
    };
    
    // User Rights Performance
    userRightsMetrics?: {
      totalRequests?: number;
      pendingRequests?: number;
      completedRequests?: number;
      averageResponseTime?: number;
      slaCompliance?: number;
      overdueRequests?: number;
    };
    
    // Data Retention Status
    retentionMetrics?: {
      totalRecords?: number;
      activeRecords?: number;
      scheduledForDeletion?: number;
      deletedThisPeriod?: number;
      retentionCompliance?: number;
    };
    
    // Breach Management Status
    breachMetrics?: {
      totalBreaches?: number;
      activeBreaches?: number;
      resolvedBreaches?: number;
      averageResolutionTime?: number;
      icoNotificationCompliance?: number;
    };
    
    // Export Job Status
    exportStatus?: {
      jobId?: string;
      jobType?: string;
      status?: 'completed' | 'failed' | 'processing';
      downloadUrl?: string;
      expiresAt?: string;
      fileSize?: string;
    };
    
    // Key Performance Indicators
    kpis?: Array<{
      name?: string;
      value?: number | string;
      trend?: 'up' | 'down' | 'stable';
      status?: 'good' | 'warning' | 'critical';
    }>;
    
    // Action Items
    actionItems?: Array<{
      title?: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      dueDate?: string;
      assignedTo?: string;
    }>;
    
    // Regulatory Deadlines
    upcomingDeadlines?: Array<{
      title?: string;
      description?: string;
      dueDate?: string;
      daysUntil?: number;
      urgency?: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
  
  // Event-specific variables
  addedBy?: {
    name?: string;
    fullName?: string;
  };
  assignedBy?: {
    name?: string;
    fullName?: string;
  };
  changedBy?: {
    name?: string;
    fullName?: string;
  };
  
  // Bulk operation context
  bulk?: {
    count?: number;
    isMultiple?: boolean;
    exampleEmail?: string;
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
  
  // PECR Marketing Consent Variables
  marketingConsent?: {
    hasEmailConsent?: boolean;
    consentType?: string;
    consentStatus?: string;
    evidenceType?: string;
    unsubscribeUrl?: string;
    consentGivenAt?: string;
    communicationFrequency?: string;
  };
  temporaryPassword?: string;
  dueDate?: string;
  
  // Email branding
  fromName?: string;
  fromEmail?: string;
}

export interface QueueEmailParams {
  // Required parameters
  triggerEvent: 'ORG_FAST_ADD' | 'USER_FAST_ADD' | 'COURSE_ASSIGNED' | 'COURSE_COMPLETED' | 'COURSE_FAILED' | 'PLAN_UPDATED' | 
    // New Automated Emails
    'WELCOME_EMAIL' | 'PASSWORD_RESET' | 'COURSE_REMINDER' | 'CERTIFICATE_ISSUED' | 'NEW_ADMIN_ADDED' |
    // GDPR Breach Management Events (Articles 33 & 34)
    'BREACH_ICO_NOTIFICATION' | 'BREACH_SUBJECT_NOTIFICATION' | 'BREACH_DEADLINE_ALERT' | 
    'BREACH_URGENT_ALERT' | 'BREACH_OVERDUE_ALERT' | 'BREACH_ESCALATION_ALERT' |
    // GDPR Dashboard Compliance Reporting Events
    'COMPLIANCE_DAILY_DIGEST' | 'COMPLIANCE_WEEKLY_REPORT' | 'COMPLIANCE_MONTHLY_REPORT' |
    'COMPLIANCE_QUARTERLY_REPORT' | 'COMPLIANCE_ANNUAL_REPORT' | 'COMPLIANCE_ALERT_CRITICAL' |
    'COMPLIANCE_ALERT_WARNING' | 'COMPLIANCE_SLA_BREACH' | 'COMPLIANCE_EXPORT_READY' |
    'ICO_SUBMISSION_READY' | 'REGULATORY_DEADLINE_REMINDER' | 'COMPLIANCE_AUDIT_ALERT';
  templateKey?: string; // Optional when using preRenderedContent
  toEmail: string;
  context: TemplateRenderContext;
  
  // Optional parameters
  organisationId?: string;
  resourceId?: string; // For idempotency: course ID, user ID, etc.
  priority?: number; // Higher priority emails sent first
  scheduledFor?: Date; // Schedule for future sending
  
  // Support for hardcoded/pre-rendered templates
  preRenderedContent?: {
    subject: string;
    htmlBody: string;
    textBody: string;
  };
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

    // Register date formatting helper
    this.handlebarsEngine.registerHelper('formatDate', (date: any, format?: string) => {
      try {
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) {
          return '[Invalid Date]';
        }
        
        // Simple date formatting
        if (format === 'short') {
          return dateObj.toLocaleDateString();
        } else if (format === 'long') {
          return dateObj.toLocaleString();
        } else if (format === 'iso') {
          return dateObj.toISOString();
        } else {
          // Default format
          return dateObj.toLocaleDateString();
        }
      } catch (error) {
        return '[Date Error]';
      }
    });

    // Register other common helpers
    this.handlebarsEngine.registerHelper('uppercase', (str: any) => {
      if (typeof str !== 'string') {
        return String(str).toUpperCase();
      }
      return str.toUpperCase();
    });

    this.handlebarsEngine.registerHelper('lowercase', (str: any) => {
      if (typeof str !== 'string') {
        return String(str).toLowerCase();
      }
      return str.toLowerCase();
    });

    this.handlebarsEngine.registerHelper('default', (value: any, defaultValue: any) => {
      return value || defaultValue || '';
    });
    
    console.log(`${this.LOG_PREFIX} Initialized with security helpers`);
  }

  /**
   * PECR Marketing Consent Verification
   * Verifies user consent for marketing communications before sending emails
   */
  private async verifyMarketingConsent(
    userId: string,
    organisationId: string,
    email: string,
    triggerEvent: string,
    templateKey: string
  ): Promise<{
    isAllowed: boolean;
    reason: string;
    consentType?: string;
    requiresConsent: boolean;
  }> {
    try {
      // Skip consent checks if GDPR is disabled
      if (!isGdprEnabled()) {
        console.log(`${this.LOG_PREFIX} GDPR disabled, skipping consent check`);
        return { isAllowed: true, reason: 'GDPR_DISABLED', requiresConsent: false };
      }

      // Determine if this is a marketing email based on trigger event or template
      const isMarketingEmail = this.isMarketingCommunication(triggerEvent, templateKey);
      
      if (!isMarketingEmail) {
        console.log(`${this.LOG_PREFIX} Service email detected, no consent required:`, { triggerEvent, templateKey });
        return { isAllowed: true, reason: 'SERVICE_EMAIL', requiresConsent: false };
      }

      console.log(`${this.LOG_PREFIX} Marketing email detected, checking consent:`, { userId, triggerEvent, templateKey });

      // Check if email is on suppression list first
      const isEmailSuppressed = await storage.isEmailSuppressed(email, organisationId, 'email');
      if (isEmailSuppressed) {
        console.log(`${this.LOG_PREFIX} Email is on suppression list:`, email);
        return { 
          isAllowed: false, 
          reason: 'EMAIL_SUPPRESSED',
          requiresConsent: true
        };
      }

      // Determine required consent type based on trigger/template
      const consentType = this.getRequiredConsentType(triggerEvent, templateKey);
      
      // Verify marketing consent for email communications
      const hasValidConsent = await storage.verifyMarketingConsent(userId, organisationId, consentType);
      
      if (!hasValidConsent) {
        console.log(`${this.LOG_PREFIX} No valid marketing consent found:`, { userId, consentType });
        return { 
          isAllowed: false, 
          reason: 'NO_MARKETING_CONSENT',
          consentType,
          requiresConsent: true
        };
      }

      // Check communication preferences for email channel
      const isEmailAllowed = await storage.checkCommunicationAllowed(userId, organisationId, 'marketing', 'email');
      if (!isEmailAllowed) {
        console.log(`${this.LOG_PREFIX} Email communication not allowed in preferences:`, { userId });
        return { 
          isAllowed: false, 
          reason: 'EMAIL_CHANNEL_DISABLED',
          consentType,
          requiresConsent: true
        };
      }

      console.log(`${this.LOG_PREFIX} Marketing consent verified successfully:`, { userId, consentType });
      return { 
        isAllowed: true, 
        reason: 'CONSENT_VERIFIED',
        consentType,
        requiresConsent: true
      };

    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Error verifying marketing consent:`, error);
      // Fail closed - if we can't verify consent, don't send
      return { 
        isAllowed: false, 
        reason: 'CONSENT_CHECK_ERROR',
        requiresConsent: true
      };
    }
  }

  /**
   * Determines if an email is marketing communication based on trigger event and template
   */
  private isMarketingCommunication(triggerEvent: string, templateKey: string): boolean {
    // Service/transactional emails that don't require marketing consent
    const serviceEvents = [
      'user_registered',
      'user_invited',
      'password_reset',
      'email_verification',
      'login_notification',
      'security_alert',
      'gdpr_breach_notification',
      'gdpr_user_notification',
      'account_activated',
      'account_suspended',
      'course_assigned',
      'certificate_earned',
      'assignment_due',
      'assignment_overdue',
      'org_plan_changed',
      'billing_failed',
      'billing_updated',
      'compliance_reminder',
      // New Automated Email Events
      'WELCOME_EMAIL',
      'PASSWORD_RESET',
      'COURSE_REMINDER',
      'CERTIFICATE_ISSUED',
      'NEW_ADMIN_ADDED',
      'PLAN_UPDATED',
      'COURSE_ASSIGNED',
      'COURSE_COMPLETED',
      'COURSE_FAILED',
      'ORG_FAST_ADD',
      'USER_FAST_ADD',
      // GDPR Dashboard Compliance Service Events
      'COMPLIANCE_DAILY_DIGEST',
      'COMPLIANCE_WEEKLY_REPORT',
      'COMPLIANCE_MONTHLY_REPORT',
      'COMPLIANCE_QUARTERLY_REPORT',
      'COMPLIANCE_ANNUAL_REPORT',
      'COMPLIANCE_ALERT_CRITICAL',
      'COMPLIANCE_ALERT_WARNING',
      'COMPLIANCE_SLA_BREACH',
      'COMPLIANCE_EXPORT_READY',
      'ICO_SUBMISSION_READY',
      'REGULATORY_DEADLINE_REMINDER',
      'COMPLIANCE_AUDIT_ALERT'
    ];

    const serviceTemplates = [
      'user_welcome',
      'password_reset',
      'email_verification',
      'account_notification',
      'course_notification',
      'certificate_notification',
      'billing_notification',
      'security_notification',
      'gdpr_notification',
      'compliance_notification',
      // GDPR Dashboard Compliance Templates
      'compliance_daily_digest',
      'compliance_weekly_report',
      'compliance_monthly_report',
      'compliance_quarterly_report',
      'compliance_annual_report',
      'compliance_alert',
      'compliance_export_notification',
      'ico_submission_notification',
      'regulatory_deadline_alert',
      'compliance_audit_report'
    ];

    // Marketing emails that require explicit consent
    const marketingEvents = [
      'newsletter_send',
      'promotional_email',
      'product_update',
      'feature_announcement',
      'webinar_invitation',
      'survey_request',
      'marketing_campaign',
      'seasonal_promotion',
      'upgrade_recommendation'
    ];

    const marketingTemplates = [
      'newsletter',
      'promotional',
      'marketing_email',
      'product_announcement',
      'feature_update',
      'webinar_invite',
      'survey_email',
      'promotion',
      'upgrade_offer'
    ];

    // Check if it's explicitly a service email
    if (serviceEvents.includes(triggerEvent) || serviceTemplates.includes(templateKey)) {
      return false;
    }

    // Check if it's explicitly a marketing email
    if (marketingEvents.includes(triggerEvent) || marketingTemplates.includes(templateKey)) {
      return true;
    }

    // Default behavior: if unsure, treat as marketing to be safe (PECR compliance)
    // This ensures we always get consent for potentially promotional content
    console.log(`${this.LOG_PREFIX} Unrecognized email type, treating as marketing for safety:`, { triggerEvent, templateKey });
    return true;
  }

  /**
   * Determines the required consent type based on trigger event and template
   */
  private getRequiredConsentType(triggerEvent: string, templateKey: string): string {
    // Map different communication types to consent requirements
    if (triggerEvent.includes('newsletter') || templateKey.includes('newsletter')) {
      return 'email_marketing';
    }
    
    if (triggerEvent.includes('promotion') || templateKey.includes('promotion')) {
      return 'email_marketing';
    }
    
    if (triggerEvent.includes('webinar') || templateKey.includes('webinar')) {
      return 'email_marketing';
    }
    
    if (triggerEvent.includes('survey') || templateKey.includes('survey')) {
      return 'email_marketing';
    }

    // Default to general email marketing consent
    return 'email_marketing';
  }

  /**
   * Enhanced context with marketing consent information
   */
  private async enrichContextWithConsent(
    context: TemplateRenderContext,
    userId: string,
    organisationId: string,
    consentVerification: { isAllowed: boolean; reason: string; consentType?: string; requiresConsent: boolean }
  ): Promise<TemplateRenderContext> {
    const enrichedContext = { ...context };

    if (consentVerification.requiresConsent && consentVerification.consentType) {
      try {
        // Get marketing consent details
        const marketingConsent = await storage.getMarketingConsentByUserAndType(
          userId,
          organisationId,
          consentVerification.consentType
        );

        if (marketingConsent) {
          enrichedContext.marketingConsent = {
            hasEmailConsent: marketingConsent.consentStatus === 'granted',
            consentType: marketingConsent.consentType,
            consentStatus: marketingConsent.consentStatus,
            evidenceType: marketingConsent.evidenceType,
            unsubscribeUrl: `${process.env.APP_URL || 'https://app.intellms.com'}/unsubscribe?token=${userId}&type=${consentVerification.consentType}`,
            consentGivenAt: marketingConsent.consentGivenAt,
            communicationFrequency: marketingConsent.communicationFrequency
          };
        }
      } catch (error) {
        console.warn(`${this.LOG_PREFIX} Could not enrich context with consent information:`, error);
      }
    }

    return enrichedContext;
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

      // Get email provider settings to set proper from fields
      let fromEmail = params.context.fromEmail;
      let fromName = params.context.fromName;
      let replyTo = params.context.supportEmail;

      // If from fields not provided in context, get from system settings
      if (!fromEmail || !fromName) {
        try {
          const systemSettings = await storage.getSystemEmailSettings();
          if (systemSettings) {
            fromEmail = fromEmail || systemSettings.fromEmail;
            fromName = fromName || systemSettings.fromName;
            replyTo = replyTo || systemSettings.replyTo || systemSettings.fromEmail;
          }
        } catch (error) {
          console.warn(`${this.LOG_PREFIX} Failed to get system email settings:`, error);
        }
      }

      // Fallback to hardcoded defaults if still missing
      fromEmail = fromEmail || 'noreply@intellms.app';
      fromName = fromName || 'inteLMS Platform';
      replyTo = replyTo || fromEmail;

      // Render the email template (use preRenderedContent if provided, otherwise render from database template)
      let rendered: { subject: string; htmlContent: string; textContent: string | null };
      
      if (params.preRenderedContent) {
        // Use hardcoded/pre-rendered template
        rendered = {
          subject: params.preRenderedContent.subject,
          htmlContent: params.preRenderedContent.htmlBody,
          textContent: params.preRenderedContent.textBody
        };
        console.log(`${this.LOG_PREFIX} Using pre-rendered template for ${params.triggerEvent}`);
      } else if (params.templateKey) {
        // Use database template (legacy)
        rendered = await this.render(params.templateKey, params.context, params.organisationId);
      } else {
        throw new Error('Either templateKey or preRenderedContent must be provided');
      }
      
      // Create email send record
      const emailSend: InsertEmailSend = {
        idempotencyKey,
        triggerEvent: params.triggerEvent,
        organisationId: params.organisationId || null,
        templateKey: params.templateKey || 'hardcoded',
        toEmail: params.toEmail,
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent || null,
        templateVariables: params.context,
        status: 'pending',
        retryCount: 0,
        fromEmail,
        fromName,
        replyTo
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

      // Update attempt timestamp (status stays pending until sent/failed)
      await storage.updateEmailSend(emailSendId, {
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
   * Get effective template using centralized EmailTemplateResolutionService
   * 
   * This ensures consistency with admin template views and proper caching.
   * Uses the same resolution logic: org override → superadmin default.
   */
  private async getEffectiveTemplate(templateKey: string, organisationId?: string): Promise<EmailTemplate | null> {
    try {
      if (organisationId) {
        // Use centralized template resolution service for org-specific templates
        const resolvedTemplate = await emailTemplateResolver.getEffectiveTemplate(organisationId, templateKey);
        
        // Convert resolved template back to EmailTemplate format
        return {
          id: '', // Not needed for rendering
          key: templateKey,
          name: templateKey,
          subject: resolvedTemplate.subject,
          html: resolvedTemplate.html,
          mjml: '', // Not needed for rendering
          text: resolvedTemplate.text,
          variablesSchema: resolvedTemplate.variablesSchema,
          category: 'admin' as const, // Default category
          version: 1, // Default version
          isActive: true,
          createdAt: null,
          updatedAt: null
        };
      } else {
        // For system-level templates, get default template directly
        const defaultTemplate = await emailTemplateResolver.getDefaultTemplate(templateKey);
        return defaultTemplate;
      }
    } catch (error: any) {
      console.warn(`${this.LOG_PREFIX} Failed to resolve template '${templateKey}' for org '${organisationId}':`, error.message);
      return null;
    }
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