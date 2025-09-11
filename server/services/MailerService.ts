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
  | 'sparkpost_api';

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
   * Resolve pure organization-only email settings (no fallbacks)
   * Used for trying org settings first in intelligent routing
   */
  async resolveOrgOnlySettings(orgId: string): Promise<ResolvedSettings> {
    const sourceMap: FieldSourceMap = {};
    
    try {
      // Get only org settings
      const orgSettings = await storage.getOrganisationSettings(orgId);
      
      if (!orgSettings) {
        return {
          settings: null,
          sourceMap: {},
          source: 'none'
        };
      }

      // Build settings purely from org config
      const effective: Partial<EffectiveEmailSettings> = {};

      // Helper function to set only non-empty values
      const setIfNotEmpty = (field: keyof EffectiveEmailSettings, orgValue: any) => {
        if (orgValue && orgValue.toString().trim() !== '' && orgValue !== '••••••••') {
          effective[field] = orgValue as any;
          sourceMap[field] = 'org';
        }
      };

      setIfNotEmpty('provider', orgSettings.emailProvider);
      setIfNotEmpty('fromName', orgSettings.fromName);
      setIfNotEmpty('fromEmail', orgSettings.fromEmail);
      setIfNotEmpty('replyTo', orgSettings.replyTo);
      setIfNotEmpty('smtpHost', orgSettings.smtpHost);
      setIfNotEmpty('smtpPort', orgSettings.smtpPort);
      setIfNotEmpty('smtpUsername', orgSettings.smtpUsername);
      setIfNotEmpty('smtpPassword', orgSettings.smtpPassword);
      setIfNotEmpty('smtpSecure', orgSettings.smtpSecure);
      setIfNotEmpty('apiKey', orgSettings.apiKey);
      setIfNotEmpty('apiSecret', orgSettings.apiSecret);
      setIfNotEmpty('apiBaseUrl', orgSettings.apiBaseUrl);
      setIfNotEmpty('apiDomain', orgSettings.apiDomain);
      setIfNotEmpty('apiRegion', orgSettings.apiRegion);

      // Check if we have enough fields for a complete config
      if (!effective.provider || !effective.fromEmail || !effective.fromName) {
        return {
          settings: null,
          sourceMap,
          source: 'none'
        };
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
        source: 'org'
      };

    } catch (error) {
      console.error('Error resolving org-only settings:', error);
      return {
        settings: null,
        sourceMap: {},
        source: 'none'
      };
    }
  }

  /**
   * Resolve pure system/platform-only email settings (no org overrides)
   * Used as fallback when org settings fail
   */
  async resolveSystemOnlySettings(): Promise<ResolvedSettings> {
    const sourceMap: FieldSourceMap = {};
    
    try {
      // Get platform defaults only
      const platformSettings = await storage.getSystemEmailSettings();
      
      if (!platformSettings) {
        return {
          settings: null,
          sourceMap: {},
          source: 'none'
        };
      }

      // Build settings purely from platform config
      const effective: EffectiveEmailSettings = {
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

      // Mark all fields as coming from platform
      Object.keys(effective).forEach(key => {
        sourceMap[key] = 'platform';
      });

      // Validate required fields for the chosen provider
      const validationResult = this.validateProviderFields(effective);
      if (!validationResult.isValid) {
        return {
          settings: null,
          sourceMap,
          source: 'none'
        };
      }

      return {
        settings: effective,
        sourceMap,
        source: 'platform'
      };

    } catch (error) {
      console.error('Error resolving system-only settings:', error);
      return {
        settings: null,
        sourceMap: {},
        source: 'none'
      };
    }
  }

  /**
   * Resolve effective email settings with org→platform inheritance
   * CRITICAL: Empty org fields do NOT override valid platform fields
   * LEGACY METHOD: Use sendWithFallback() for intelligent routing instead
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
        
    }

    return {
      isValid: missing.length === 0,
      missing
    };
  }

  /**
   * Send email - The ONLY method allowed to send emails in the entire application
   * NOW WITH INTELLIGENT ROUTING: Uses org->system fallback logic automatically
   */
  async send(params: EmailSendParams): Promise<EmailResult> {
    // Use the intelligent routing system for all email sending
    console.log('📧 MailerService.send() called - routing to intelligent fallback system');
    return await this.sendWithFallback(params);
  }

  /**
   * Health check for email configuration using intelligent routing
   * Tests connectivity for the organization's email setup with system fallback
   */
  async healthCheck(orgId?: string): Promise<EmailResult> {
    console.log('🏥 MailerService.healthCheck() called for orgId:', orgId);
    
    try {
      let resolved: ResolvedSettings;
      let routingSource: 'org_primary' | 'system_default' = 'system_default';

      // Try org settings first if orgId provided
      if (orgId) {
        console.log('🔍 Checking org-specific email health...');
        resolved = await this.resolveOrgOnlySettings(orgId);
        routingSource = 'org_primary';
        
        if (!resolved.settings) {
          console.log('🔍 Org settings not available, checking system defaults...');
          resolved = await this.resolveSystemOnlySettings();
          routingSource = 'system_default';
        }
      } else {
        console.log('🔍 Checking system default email health...');
        resolved = await this.resolveSystemOnlySettings();
      }

      if (!resolved.settings) {
        return {
          success: false,
          provider: 'smtp_generic',
          details: {
            from: 'not configured',
            to: 'health-check',
            effectiveFieldSources: {},
            timestamp: new Date().toISOString()
          },
          error: {
            code: 'NOT_CONFIGURED',
            short: 'Email settings not configured',
            raw: 'No valid email configuration found for health check'
          }
        };
      }

      // Get appropriate adapter
      const adapter = this.adapters.get(resolved.settings.provider);
      if (!adapter) {
        return {
          success: false,
          provider: resolved.settings.provider,
          details: {
            from: resolved.settings.fromEmail,
            to: 'health-check',
            effectiveFieldSources: resolved.sourceMap,
            timestamp: new Date().toISOString()
          },
          error: {
            code: 'ADAPTER_NOT_FOUND',
            short: `Adapter not found for provider: ${resolved.settings.provider}`,
            raw: `No adapter configured for ${resolved.settings.provider}`
          }
        };
      }

      // Run health check via adapter
      console.log(`🔍 Running ${resolved.settings.provider} health check via ${routingSource}...`);
      const healthResult = await adapter.healthCheck(resolved.settings);
      
      console.log(`🏥 Health check result: ${healthResult.success ? '✅ PASS' : '❌ FAIL'} for ${resolved.settings.provider}`);
      
      return {
        success: healthResult.success,
        provider: resolved.settings.provider,
        endpoint: healthResult.endpoint,
        httpStatus: healthResult.httpStatus,
        details: {
          from: resolved.settings.fromEmail,
          to: 'health-check',
          keyPreview: this.maskApiKey(resolved.settings.apiKey),
          keyLength: resolved.settings.apiKey?.length || 0,
          effectiveFieldSources: resolved.sourceMap,
          timestamp: new Date().toISOString()
        },
        error: healthResult.error
      };

    } catch (error: any) {
      console.error('🏥 Health check error:', error.message);
      return {
        success: false,
        provider: 'smtp_generic',
        details: {
          from: 'error',
          to: 'health-check',
          effectiveFieldSources: {},
          timestamp: new Date().toISOString()
        },
        error: {
          code: 'HEALTH_CHECK_ERROR',
          short: 'Health check failed',
          raw: error.message || 'Unknown health check error'
        }
      };
    }
  }

  /**
   * INTELLIGENT EMAIL ROUTING SYSTEM
   * Send email with org->system fallback logic
   * 
   * Primary Route: Try org settings first (if available and valid)
   * Fallback Route: If org fails during sending, automatically use system settings
   * 
   * @param params Email parameters
   * @returns EmailResult with routing source tracked
   */
  async sendWithFallback(params: EmailSendParams): Promise<EmailResult> {
    const timestamp = new Date().toISOString();
    let routingSource: 'org_primary' | 'org_fallback' | 'system_default' = 'system_default';
    
    try {
      // If no orgId provided, go directly to system settings
      if (!params.orgId) {
        console.log('🔄 Email Routing: No orgId provided, using system_default');
        return await this.attemptSendWithSettings('system_default', params, timestamp);
      }

      // Step 1: Try organization settings first
      console.log('🔄 Email Routing: Attempting org_primary route');
      const orgSettings = await this.resolveOrgOnlySettings(params.orgId);
      
      if (orgSettings.settings) {
        // Org settings are available and valid, try sending
        const orgResult = await this.attemptSendWithSettings('org_primary', params, timestamp, orgSettings);
        
        if (orgResult.success) {
          console.log('✅ Email Routing: org_primary route succeeded');
          return orgResult;
        } else {
          // Org settings failed during sending - check if we should fallback
          if (this.shouldFallbackToSystem(orgResult)) {
            console.log('⚠️ Email Routing: org_primary failed, attempting org_fallback route');
            
            // Step 2: Fallback to system settings
            const systemResult = await this.attemptSendWithSettings('org_fallback', params, timestamp);
            
            if (systemResult.success) {
              console.log('✅ Email Routing: org_fallback route succeeded');
              return systemResult;
            } else {
              console.log('❌ Email Routing: Both org_primary and org_fallback failed');
              return systemResult; // Return the system failure
            }
          } else {
            console.log('❌ Email Routing: org_primary failed with non-fallback error');
            return orgResult; // Return org failure (permanent error)
          }
        }
      } else {
        console.log('🔄 Email Routing: Org settings invalid/incomplete, using system_default');
        // Org settings are not available or invalid, use system default
        return await this.attemptSendWithSettings('system_default', params, timestamp);
      }
      
    } catch (error: any) {
      const errorMessage = error.message || 'Unexpected error in routing';
      console.error('❌ Email Routing: Unexpected error:', errorMessage);
      
      // Log unexpected routing error
      await this.logDeliveryWithRouting({
        organisationId: params.orgId,
        provider: 'smtp_generic',
        fromEmail: 'unknown',
        toEmail: params.to,
        subject: params.subject,
        status: 'failed',
        errorShort: 'Routing system error',
        errorRaw: errorMessage.substring(0, 200),
        effectiveFieldSources: {},
        routingSource: 'system_default',
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
          code: 'ROUTING_ERROR',
          short: 'Email routing system error',
          raw: errorMessage
        }
      };
    }
  }

  /**
   * Attempt to send email using specific routing settings
   */
  private async attemptSendWithSettings(
    routingSource: 'org_primary' | 'org_fallback' | 'system_default',
    params: EmailSendParams,
    timestamp: string,
    orgSettings?: ResolvedSettings
  ): Promise<EmailResult> {
    let resolved: ResolvedSettings;
    
    // Get the appropriate settings based on routing source
    if (routingSource === 'org_primary' && orgSettings) {
      resolved = orgSettings;
    } else if (routingSource === 'org_fallback' || routingSource === 'system_default') {
      resolved = await this.resolveSystemOnlySettings();
    } else {
      // Fallback case - should not happen
      resolved = await this.resolveSystemOnlySettings();
    }

    if (!resolved.settings) {
      const error = `${routingSource}: Email settings not configured`;
      
      await this.logDeliveryWithRouting({
        organisationId: params.orgId,
        provider: 'smtp_generic',
        fromEmail: 'unknown',
        toEmail: params.to,
        subject: params.subject,
        status: 'failed',
        errorShort: error,
        effectiveFieldSources: {},
        routingSource,
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

    // Get appropriate adapter
    const adapter = this.adapters.get(resolved.settings.provider);
    if (!adapter) {
      const error = `${routingSource}: Adapter not found for ${resolved.settings.provider}`;
      
      await this.logDeliveryWithRouting({
        organisationId: params.orgId,
        provider: resolved.settings.provider,
        fromEmail: resolved.settings.fromEmail,
        toEmail: params.to,
        subject: params.subject,
        status: 'failed',
        errorShort: error,
        effectiveFieldSources: resolved.sourceMap,
        routingSource,
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

    // Run health check
    const healthResult = await adapter.healthCheck(resolved.settings);
    if (!healthResult.success) {
      await this.logDeliveryWithRouting({
        organisationId: params.orgId,
        provider: resolved.settings.provider,
        fromEmail: resolved.settings.fromEmail,
        toEmail: params.to,
        subject: params.subject,
        httpStatus: healthResult.httpStatus,
        endpoint: healthResult.endpoint,
        status: 'failed',
        errorShort: `${routingSource}: ${healthResult.error?.short || 'Health check failed'}`,
        errorRaw: healthResult.error?.raw?.substring(0, 200),
        keyPreview: this.maskApiKey(resolved.settings.apiKey),
        keyLength: resolved.settings.apiKey?.length || 0,
        effectiveFieldSources: resolved.sourceMap,
        routingSource,
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

    // Send email via adapter
    const sendResult = await adapter.send({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      fromEmail: resolved.settings.fromEmail,
      fromName: resolved.settings.fromName,
      replyTo: resolved.settings.replyTo
    }, resolved.settings);

    // Log delivery result with routing info
    await this.logDeliveryWithRouting({
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
      errorShort: sendResult.error?.short ? `${routingSource}: ${sendResult.error.short}` : undefined,
      errorRaw: sendResult.error?.raw?.substring(0, 200),
      keyPreview: this.maskApiKey(resolved.settings.apiKey),
      keyLength: resolved.settings.apiKey?.length || 0,
      effectiveFieldSources: resolved.sourceMap,
      routingSource,
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
  }

  /**
   * Determine if we should fallback to system settings based on org failure
   */
  private shouldFallbackToSystem(orgResult: EmailResult): boolean {
    // Don't fallback for validation/configuration errors (permanent failures)
    const permanentErrorCodes = [
      'NOT_CONFIGURED',
      'VALIDATION_FAILED', 
      'ADAPTER_NOT_FOUND'
    ];
    
    if (orgResult.error?.code && permanentErrorCodes.includes(orgResult.error.code)) {
      return false;
    }

    // Fallback for temporary/network errors (401, 403, 5xx, timeouts, network failures)
    if (orgResult.httpStatus) {
      // Auth errors - might be bad org API key, try system
      if (orgResult.httpStatus === 401 || orgResult.httpStatus === 403) {
        return true;
      }
      
      // Server errors - temporary issues, try system
      if (orgResult.httpStatus >= 500) {
        return true;
      }
      
      // Rate limiting - try system (might have different limits)
      if (orgResult.httpStatus === 429) {
        return true;
      }
    }

    // Network/timeout errors (no HTTP status)
    if (orgResult.error?.short) {
      const errorLower = orgResult.error.short.toLowerCase();
      if (errorLower.includes('timeout') || 
          errorLower.includes('network') || 
          errorLower.includes('connection') ||
          errorLower.includes('unreachable')) {
        return true;
      }
    }

    return false; // Don't fallback for other errors
  }

  /**
   * Create masked preview of API key for diagnostics (never log full keys)
   */
  private maskApiKey(apiKey?: string): string {
    if (!apiKey || apiKey.length < 8) return '';
    return `${apiKey.substring(0, 4)}…${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Log email delivery attempt with routing source tracking
   */
  private async logDeliveryWithRouting(logData: {
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
    routingSource: 'org_primary' | 'org_fallback' | 'system_default';
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
        usedOrgSettings: logData.routingSource === 'org_primary',
        fallbackUsed: logData.routingSource === 'org_fallback'
      };

      await storage.createEmailLog(emailLog);
      
      // Log routing info to console for debugging
      console.log(`📧 Email Log: ${logData.status.toUpperCase()} via ${logData.routingSource} | ${logData.provider} | ${logData.toEmail} | ${logData.subject}`);
      
    } catch (error) {
      console.error('Failed to log email delivery with routing:', error);
      // Don't throw - logging failure shouldn't break email sending
    }
  }

  /**
   * Log email delivery attempt to database (legacy method)
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