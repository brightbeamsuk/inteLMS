/**
 * Central MailerService - The ONLY email service allowed to send emails
 * 
 * Provider-agnostic email system supporting:
 * - SMTP Generic (Microsoft 365, Gmail, Amazon SES SMTP, etc.)
 * - API providers (SendGrid, Brevo, Mailgun, Postmark, Mailjet, SparkPost)
 * - Platform defaults + org overrides with proper inheritance
 * - Comprehensive diagnostics and error handling
 * - NO silent fallbacks
 */

import { storage } from '../storage';
import type { 
  SystemEmailSettings, 
  OrganisationSettings,
  InsertEmailLog,
  EmailLog
} from '@shared/schema';

// SMTP Adapter
import { SMTPAdapter } from './adapters/SMTPAdapter';

// API Adapters
import { SendGridAdapter } from './adapters/SendGridAdapter';
import { BrevoAdapter } from './adapters/BrevoAdapter';
import { MailgunAdapter } from './adapters/MailgunAdapter';
import { PostmarkAdapter } from './adapters/PostmarkAdapter';
import { MailjetAdapter } from './adapters/MailjetAdapter';
import { SparkPostAdapter } from './adapters/SparkPostAdapter';

export type EmailProvider = 
  | 'smtp_generic'
  | 'sendgrid_api' 
  | 'brevo_api'
  | 'mailgun_api'
  | 'postmark_api'
  | 'mailjet_api'
  | 'sparkpost_api'
  | 'ses_api';

export interface EffectiveEmailSettings {
  // Provider identification
  provider: EmailProvider;
  
  // Common fields (all providers)
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  
  // SMTP fields (smtp_generic only)
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  
  // API fields (API providers)
  apiKey?: string;
  apiSecret?: string; // Mailjet
  apiBaseUrl?: string;
  
  // Provider-specific fields
  apiDomain?: string; // Mailgun
  apiRegion?: string; // SES
}

export interface FieldSourceMap {
  [fieldName: string]: 'org' | 'platform' | 'none';
}

export interface ResolvedSettings {
  settings: EffectiveEmailSettings | null;
  sourceMap: FieldSourceMap;
  source: 'org' | 'platform' | 'none';
}

export interface EmailSendParams {
  orgId?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateType?: string;
}

export interface EmailResult {
  success: boolean;
  provider: EmailProvider;
  endpoint?: string;
  httpStatus?: number;
  smtpStatus?: string;
  details: {
    host?: string;
    port?: number;
    tls?: boolean;
    from: string;
    to: string;
    messageId?: string;
    keyPreview?: string;
    keyLength?: number;
    effectiveFieldSources: FieldSourceMap;
    timestamp: string;
  };
  error?: {
    code?: string;
    short?: string;
    raw?: string;
  };
}

export class MailerService {
  private adapters: Map<EmailProvider, any> = new Map();

  constructor() {
    // Initialize all adapters
    this.adapters.set('smtp_generic', new SMTPAdapter());
    this.adapters.set('sendgrid_api', new SendGridAdapter());
    this.adapters.set('brevo_api', new BrevoAdapter());
    this.adapters.set('mailgun_api', new MailgunAdapter());
    this.adapters.set('postmark_api', new PostmarkAdapter());
    this.adapters.set('mailjet_api', new MailjetAdapter());
    this.adapters.set('sparkpost_api', new SparkPostAdapter());
  }

  /**
   * Resolve effective email settings with org→platform inheritance
   * CRITICAL: Empty org fields do NOT override valid platform fields
   */
  async resolveEffectiveSettings(orgId?: string): Promise<ResolvedSettings> {
    const sourceMap: FieldSourceMap = {};
    
    try {
      // Get platform defaults first
      const platformSettings = await storage.getSystemEmailSettings();
      
      // Get org settings if orgId provided
      let orgSettings: OrganisationSettings | undefined;
      if (orgId) {
        orgSettings = await storage.getOrganisationSettings(orgId);
      }

      // If no platform settings, fail immediately (no silent fallbacks)
      if (!platformSettings) {
        return {
          settings: null,
          sourceMap: {},
          source: 'none'
        };
      }

      // Start with platform settings as base
      const effective: Partial<EffectiveEmailSettings> = {
        provider: platformSettings.emailProvider,
        fromName: platformSettings.fromName,
        fromEmail: platformSettings.fromEmail,
        replyTo: platformSettings.replyTo || undefined,
        smtpHost: platformSettings.smtpHost || undefined,
        smtpPort: platformSettings.smtpPort || undefined,
        smtpUsername: platformSettings.smtpUsername || undefined,
        smtpPassword: platformSettings.smtpPassword || undefined,
        smtpSecure: platformSettings.smtpSecure || undefined,
        apiKey: platformSettings.apiKey || undefined,
        apiSecret: platformSettings.apiSecret || undefined,
        apiBaseUrl: platformSettings.apiBaseUrl || undefined,
        apiDomain: platformSettings.apiDomain || undefined,
        apiRegion: platformSettings.apiRegion || undefined,
      };

      // Mark all fields as coming from platform initially
      Object.keys(effective).forEach(key => {
        sourceMap[key] = 'platform';
      });

      // Override with org settings ONLY if they are non-empty
      if (orgSettings) {
        // Helper function to override only non-empty values
        const safeOverride = (field: keyof EffectiveEmailSettings, orgValue: any) => {
          if (orgValue && orgValue.toString().trim() !== '' && orgValue !== '••••••••') {
            effective[field] = orgValue as any;
            sourceMap[field] = 'org';
          }
        };

        safeOverride('provider', orgSettings.emailProvider);
        safeOverride('fromName', orgSettings.fromName);
        safeOverride('fromEmail', orgSettings.fromEmail);
        safeOverride('replyTo', orgSettings.replyTo);
        safeOverride('smtpHost', orgSettings.smtpHost);
        safeOverride('smtpPort', orgSettings.smtpPort);
        safeOverride('smtpUsername', orgSettings.smtpUsername);
        safeOverride('smtpPassword', orgSettings.smtpPassword);
        safeOverride('smtpSecure', orgSettings.smtpSecure);
        safeOverride('apiKey', orgSettings.apiKey);
        safeOverride('apiSecret', orgSettings.apiSecret);
        safeOverride('apiBaseUrl', orgSettings.apiBaseUrl);
        safeOverride('apiDomain', orgSettings.apiDomain);
        safeOverride('apiRegion', orgSettings.apiRegion);
      }

      // Validate required fields for the chosen provider
      const validationResult = this.validateProviderFields(effective as EffectiveEmailSettings);
      if (!validationResult.isValid) {
        return {
          settings: null,
          sourceMap,
          source: 'none'
        };
      }

      return {
        settings: effective as EffectiveEmailSettings,
        sourceMap,
        source: orgSettings && Object.values(sourceMap).includes('org') ? 'org' : 'platform'
      };

    } catch (error) {
      console.error('Error resolving email settings:', error);
      return {
        settings: null,
        sourceMap: {},
        source: 'none'
      };
    }
  }

  /**
   * Validate that required fields are present for the chosen provider
   */
  private validateProviderFields(settings: EffectiveEmailSettings): { isValid: boolean; missing: string[] } {
    const missing: string[] = [];

    // Common required fields for all providers
    if (!settings.fromEmail) missing.push('fromEmail');
    if (!settings.fromName) missing.push('fromName');
    if (!settings.provider) missing.push('provider');

    // Provider-specific required fields
    switch (settings.provider) {
      case 'smtp_generic':
        if (!settings.smtpHost) missing.push('smtpHost');
        if (!settings.smtpUsername) missing.push('smtpUsername');
        if (!settings.smtpPassword) missing.push('smtpPassword');
        break;
        
      case 'sendgrid_api':
      case 'brevo_api':
      case 'postmark_api':
      case 'sparkpost_api':
        if (!settings.apiKey) missing.push('apiKey');
        break;
        
      case 'mailgun_api':
        if (!settings.apiKey) missing.push('apiKey');
        if (!settings.apiDomain) missing.push('apiDomain (e.g., mg.yourdomain.com)');
        break;
        
      case 'mailjet_api':
        if (!settings.apiKey) missing.push('apiKey');
        if (!settings.apiSecret) missing.push('apiSecret');
        break;
        
      case 'ses_api':
        if (!settings.apiKey) missing.push('apiKey (AWS Access Key ID)');
        if (!settings.apiSecret) missing.push('apiSecret (AWS Secret Access Key)');
        if (!settings.apiRegion) missing.push('apiRegion (e.g., us-east-1)');
        break;
    }

    return {
      isValid: missing.length === 0,
      missing
    };
  }

  /**
   * Send email - The ONLY method allowed to send emails in the entire application
   */
  async send(params: EmailSendParams): Promise<EmailResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // 1. Resolve effective settings
      const resolved = await this.resolveEffectiveSettings(params.orgId);
      
      if (!resolved.settings) {
        const error = 'Email not configured. Configure email settings at organization or platform level.';
        
        // Log failed attempt
        await this.logDelivery({
          organisationId: params.orgId,
          provider: 'smtp_generic',
          fromEmail: 'unknown',
          toEmail: params.to,
          subject: params.subject,
          status: 'failed',
          errorShort: error,
          effectiveFieldSources: {},
          timestamp
        });
        
        return {
          success: false,
          provider: 'smtp_generic',
          details: {
            from: 'unknown',
            to: params.to,
            effectiveFieldSources: {},
            timestamp
          },
          error: {
            code: 'NOT_CONFIGURED',
            short: error,
            raw: error
          }
        };
      }

      // 2. Validate required fields for provider
      const validation = this.validateProviderFields(resolved.settings);
      if (!validation.isValid) {
        const error = `Missing required fields: ${validation.missing.join(', ')}`;
        
        await this.logDelivery({
          organisationId: params.orgId,
          provider: resolved.settings.provider,
          fromEmail: resolved.settings.fromEmail,
          toEmail: params.to,
          subject: params.subject,
          status: 'failed',
          errorShort: error,
          effectiveFieldSources: resolved.sourceMap,
          timestamp
        });
        
        return {
          success: false,
          provider: resolved.settings.provider,
          details: {
            from: resolved.settings.fromEmail,
            to: params.to,
            effectiveFieldSources: resolved.sourceMap,
            timestamp
          },
          error: {
            code: 'VALIDATION_FAILED',
            short: error,
            raw: `Missing required fields for ${resolved.settings.provider}: ${validation.missing.join(', ')}`
          }
        };
      }

      // 3. Get appropriate adapter
      const adapter = this.adapters.get(resolved.settings.provider);
      if (!adapter) {
        const error = `Adapter not found for provider: ${resolved.settings.provider}`;
        
        await this.logDelivery({
          organisationId: params.orgId,
          provider: resolved.settings.provider,
          fromEmail: resolved.settings.fromEmail,
          toEmail: params.to,
          subject: params.subject,
          status: 'failed',
          errorShort: error,
          effectiveFieldSources: resolved.sourceMap,
          timestamp
        });
        
        return {
          success: false,
          provider: resolved.settings.provider,
          details: {
            from: resolved.settings.fromEmail,
            to: params.to,
            effectiveFieldSources: resolved.sourceMap,
            timestamp
          },
          error: {
            code: 'ADAPTER_NOT_FOUND',
            short: error,
            raw: error
          }
        };
      }

      // 4. Run health check first
      const healthResult = await adapter.healthCheck(resolved.settings);
      if (!healthResult.success) {
        await this.logDelivery({
          organisationId: params.orgId,
          provider: resolved.settings.provider,
          fromEmail: resolved.settings.fromEmail,
          toEmail: params.to,
          subject: params.subject,
          httpStatus: healthResult.httpStatus,
          endpoint: healthResult.endpoint,
          status: 'failed',
          errorShort: healthResult.error?.short || 'Health check failed',
          errorRaw: healthResult.error?.raw?.substring(0, 200),
          keyPreview: this.maskApiKey(resolved.settings.apiKey),
          keyLength: resolved.settings.apiKey?.length || 0,
          effectiveFieldSources: resolved.sourceMap,
          timestamp
        });
        
        return {
          success: false,
          provider: resolved.settings.provider,
          endpoint: healthResult.endpoint,
          httpStatus: healthResult.httpStatus,
          details: {
            from: resolved.settings.fromEmail,
            to: params.to,
            keyPreview: this.maskApiKey(resolved.settings.apiKey),
            keyLength: resolved.settings.apiKey?.length || 0,
            effectiveFieldSources: resolved.sourceMap,
            timestamp
          },
          error: healthResult.error
        };
      }

      // 5. Send email via adapter
      const sendResult = await adapter.send({
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        fromEmail: resolved.settings.fromEmail,
        fromName: resolved.settings.fromName,
        replyTo: resolved.settings.replyTo
      }, resolved.settings);

      // 6. Log delivery result
      await this.logDelivery({
        organisationId: params.orgId,
        provider: resolved.settings.provider,
        fromEmail: resolved.settings.fromEmail,
        toEmail: params.to,
        subject: params.subject,
        templateType: params.templateType as any,
        httpStatus: sendResult.httpStatus,
        smtpStatus: sendResult.smtpStatus,
        endpoint: sendResult.endpoint,
        messageId: sendResult.messageId,
        status: sendResult.success ? 'sent' : 'failed',
        errorShort: sendResult.error?.short,
        errorRaw: sendResult.error?.raw?.substring(0, 200),
        keyPreview: this.maskApiKey(resolved.settings.apiKey),
        keyLength: resolved.settings.apiKey?.length || 0,
        effectiveFieldSources: resolved.sourceMap,
        timestamp
      });

      return {
        success: sendResult.success,
        provider: resolved.settings.provider,
        endpoint: sendResult.endpoint,
        httpStatus: sendResult.httpStatus,
        smtpStatus: sendResult.smtpStatus,
        details: {
          host: sendResult.host,
          port: sendResult.port,
          tls: sendResult.tls,
          from: resolved.settings.fromEmail,
          to: params.to,
          messageId: sendResult.messageId,
          keyPreview: this.maskApiKey(resolved.settings.apiKey),
          keyLength: resolved.settings.apiKey?.length || 0,
          effectiveFieldSources: resolved.sourceMap,
          timestamp
        },
        error: sendResult.error
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      
      // Log unexpected error
      await this.logDelivery({
        organisationId: params.orgId,
        provider: 'smtp_generic',
        fromEmail: 'unknown',
        toEmail: params.to,
        subject: params.subject,
        status: 'failed',
        errorShort: 'Unexpected error',
        errorRaw: errorMessage.substring(0, 200),
        effectiveFieldSources: {},
        timestamp
      });
      
      return {
        success: false,
        provider: 'smtp_generic',
        details: {
          from: 'unknown',
          to: params.to,
          effectiveFieldSources: {},
          timestamp
        },
        error: {
          code: 'UNEXPECTED_ERROR',
          short: 'Unexpected error occurred',
          raw: errorMessage
        }
      };
    }
  }

  /**
   * Create masked preview of API key for diagnostics (never log full keys)
   */
  private maskApiKey(apiKey?: string): string {
    if (!apiKey || apiKey.length < 8) return '';
    return `${apiKey.substring(0, 4)}…${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Log email delivery attempt to database
   */
  private async logDelivery(logData: {
    organisationId?: string;
    provider: EmailProvider;
    fromEmail: string;
    toEmail: string;
    subject: string;
    templateType?: any;
    httpStatus?: number;
    smtpStatus?: string;
    endpoint?: string;
    messageId?: string;
    status: 'sent' | 'failed';
    errorShort?: string;
    errorRaw?: string;
    keyPreview?: string;
    keyLength?: number;
    effectiveFieldSources: FieldSourceMap;
    timestamp: string;
  }): Promise<void> {
    try {
      const emailLog: InsertEmailLog = {
        organisationId: logData.organisationId || null,
        provider: logData.provider,
        fromEmail: logData.fromEmail,
        toEmail: logData.toEmail,
        subject: logData.subject,
        templateType: logData.templateType,
        httpStatus: logData.httpStatus || null,
        smtpStatus: logData.smtpStatus || null,
        endpoint: logData.endpoint || null,
        messageId: logData.messageId || null,
        status: logData.status,
        errorShort: logData.errorShort || null,
        errorRaw: logData.errorRaw || null,
        keyPreview: logData.keyPreview || null,
        keyLength: logData.keyLength || null,
        effectiveFieldSources: logData.effectiveFieldSources,
        // Legacy compatibility fields
        smtpHost: logData.endpoint || 'unknown',
        smtpPort: logData.httpStatus ? 443 : 587,
        tlsUsed: true,
        usedOrgSettings: Object.values(logData.effectiveFieldSources).includes('org'),
        fallbackUsed: false
      };

      await storage.createEmailLog(emailLog);
    } catch (error) {
      console.error('Failed to log email delivery:', error);
      // Don't throw - logging failure shouldn't break email sending
    }
  }
}

// Export singleton instance
export const mailerService = new MailerService();