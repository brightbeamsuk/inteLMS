import { storage } from '../storage.js';
import { gdprCompliantStripeService } from './GdprCompliantStripeService.js';
import { gdprCompliantEmailService } from './GdprCompliantEmailService.js';
import { gdprCompliantAnalyticsService } from './GdprCompliantAnalyticsService.js';
import type { 
  User,
  Organisation,
  IntegrationGdprSettings,
  InsertIntegrationAuditLogs
} from '../../shared/schema.js';
import { nanoid } from 'nanoid';

/**
 * Central GDPR Integration Manager
 * 
 * Coordinates all GDPR-compliant integration services and provides:
 * - Unified integration lifecycle management with GDPR compliance
 * - Cross-integration compliance reporting and monitoring
 * - Centralized consent management for all integrations
 * - Integration-specific privacy controls and data subject rights
 * - Comprehensive audit trails across all third-party services
 * - Privacy-by-design integration configuration
 */
export class IntegrationGdprManager {
  private static instance: IntegrationGdprManager;
  
  // Supported integration types and their GDPR-compliant services
  private integrationServices = {
    // Payment integrations
    'stripe': gdprCompliantStripeService,
    
    // Email provider integrations
    'sendgrid_api': gdprCompliantEmailService,
    'brevo_api': gdprCompliantEmailService,
    'mailgun_api': gdprCompliantEmailService,
    'postmark_api': gdprCompliantEmailService,
    'mailjet_api': gdprCompliantEmailService,
    'sparkpost_api': gdprCompliantEmailService,
    'smtp_generic': gdprCompliantEmailService,
    
    // Analytics integrations
    'google_analytics': gdprCompliantAnalyticsService,
    'matomo': gdprCompliantAnalyticsService,
    'plausible': gdprCompliantAnalyticsService,
    'mixpanel': gdprCompliantAnalyticsService,
    'amplitude': gdprCompliantAnalyticsService,
    'internal_analytics': gdprCompliantAnalyticsService
  };
  
  constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): IntegrationGdprManager {
    if (!IntegrationGdprManager.instance) {
      IntegrationGdprManager.instance = new IntegrationGdprManager();
    }
    return IntegrationGdprManager.instance;
  }

  /**
   * Initialize GDPR compliance for all integrations in an organization
   */
  async initializeOrganizationIntegrationCompliance(
    organisationId: string,
    enabledIntegrations: string[],
    configuredBy: string
  ): Promise<{
    success: boolean;
    initializedIntegrations: string[];
    failedIntegrations: Array<{ integration: string; error: string }>;
    complianceReport: any;
  }> {
    const correlationId = `org-integration-init-${organisationId}-${nanoid(8)}`;
    const initializedIntegrations: string[] = [];
    const failedIntegrations: Array<{ integration: string; error: string }> = [];

    try {
      console.log(`🔧 Initializing GDPR compliance for ${enabledIntegrations.length} integrations in org ${organisationId} [${correlationId}]`);

      // Initialize each integration's GDPR settings
      for (const integrationType of enabledIntegrations) {
        try {
          await this.initializeIntegrationGdprCompliance(
            organisationId,
            integrationType,
            configuredBy
          );
          initializedIntegrations.push(integrationType);
          
        } catch (error) {
          console.error(`❌ Failed to initialize ${integrationType} GDPR compliance:`, error);
          failedIntegrations.push({
            integration: integrationType,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Generate initial compliance report
      const complianceReport = await this.generateOrganizationComplianceReport(organisationId);

      // Log the initialization
      await this.auditLog(organisationId, 'organization_integration_compliance_initialized', 'compliance', {
        configuredBy,
        totalIntegrations: enabledIntegrations.length,
        initializedIntegrations: initializedIntegrations.length,
        failedIntegrations: failedIntegrations.length,
        correlationId
      });

      console.log(`✅ Organization integration compliance initialized [${correlationId}]:`, {
        total: enabledIntegrations.length,
        successful: initializedIntegrations.length,
        failed: failedIntegrations.length
      });

      return {
        success: failedIntegrations.length === 0,
        initializedIntegrations,
        failedIntegrations,
        complianceReport
      };

    } catch (error) {
      console.error(`❌ Failed to initialize organization integration compliance [${correlationId}]:`, error);
      
      await this.auditLog(organisationId, 'organization_integration_compliance_init_failed', 'compliance_alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw error;
    }
  }

  /**
   * Initialize GDPR compliance for a specific integration
   */
  async initializeIntegrationGdprCompliance(
    organisationId: string,
    integrationType: string,
    configuredBy: string
  ): Promise<void> {
    const correlationId = `integration-init-${integrationType}-${organisationId}-${nanoid(8)}`;

    try {
      // Route to appropriate service based on integration type
      if (integrationType === 'stripe') {
        await gdprCompliantStripeService.initializeStripeGdprSettings(organisationId, configuredBy);
      } 
      else if (this.isEmailProvider(integrationType)) {
        await gdprCompliantEmailService.initializeEmailGdprSettings(organisationId, integrationType, configuredBy);
      }
      else if (this.isAnalyticsProvider(integrationType)) {
        await gdprCompliantAnalyticsService.initializeAnalyticsGdprSettings(organisationId, integrationType, configuredBy);
      }
      else {
        // Generic integration initialization
        await this.initializeGenericIntegrationGdprSettings(organisationId, integrationType, configuredBy);
      }

      await this.auditLog(organisationId, 'integration_gdpr_compliance_initialized', 'compliance', {
        integrationType,
        configuredBy,
        correlationId
      });

    } catch (error) {
      console.error(`❌ Failed to initialize GDPR compliance for ${integrationType} [${correlationId}]:`, error);
      
      await this.auditLog(organisationId, 'integration_gdpr_compliance_init_failed', 'compliance_alert', {
        integrationType,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw error;
    }
  }

  /**
   * Initialize GDPR settings for generic/unsupported integrations
   */
  private async initializeGenericIntegrationGdprSettings(
    organisationId: string,
    integrationType: string,
    configuredBy: string
  ): Promise<void> {
    // Check if settings already exist
    const existing = await storage.getIntegrationGdprSettingsByType(organisationId, integrationType);
    if (existing) {
      console.log(`Generic GDPR settings already exist for ${integrationType} in org ${organisationId}`);
      return;
    }

    // Create basic GDPR settings for unknown integration types
    const genericSettings = {
      organisationId,
      integrationType: integrationType as any, // Cast to satisfy enum constraint
      integrationName: this.getDisplayName(integrationType),
      isEnabled: false, // Disabled by default for unknown integrations
      complianceStatus: 'needs_review' as const,
      // Required properties
      processingPurposes: ['service_improvement' as any],
      lawfulBasis: 'consent' as const,
      dataCategories: ['technical' as any],
      createdBy: configuredBy,
      // Optional properties with defaults
      dataMinimizationEnabled: true,
      encryptionRequired: true,
      retentionPeriod: '1_year' as any,
      complianceNotes: `Generic GDPR compliance settings for ${integrationType}. Manual review required for proper configuration.`
    };

    await storage.createIntegrationGdprSettings(genericSettings);
  }

  /**
   * Verify user consent across all integrations
   */
  async verifyUserConsentAcrossIntegrations(
    userId: string,
    organisationId: string,
    requiredIntegrations: string[]
  ): Promise<{
    canProceed: boolean;
    consentStatus: Record<string, {
      hasConsent: boolean;
      consentStatus: string;
      reason: string;
    }>;
    missingConsents: string[];
  }> {
    const correlationId = `cross-integration-consent-${userId}-${nanoid(8)}`;
    const consentStatus: Record<string, any> = {};
    const missingConsents: string[] = [];

    try {
      for (const integrationType of requiredIntegrations) {
        try {
          let result: any;

          // Route to appropriate service for consent verification
          if (integrationType === 'stripe_payments') {
            result = await gdprCompliantStripeService.verifyStripePaymentConsent(userId, organisationId);
            consentStatus[integrationType] = {
              hasConsent: result.canProcess,
              consentStatus: result.consentStatus,
              reason: result.reason
            };
          }
          else if (this.isEmailProvider(integrationType)) {
            result = await gdprCompliantEmailService.verifyEmailMarketingConsent(userId, organisationId, 'marketing');
            consentStatus[integrationType] = {
              hasConsent: result.canSend,
              consentStatus: result.consentStatus,
              reason: result.reason
            };
          }
          else if (this.isAnalyticsProvider(integrationType)) {
            result = await gdprCompliantAnalyticsService.verifyAnalyticsConsent(userId, organisationId, integrationType);
            consentStatus[integrationType] = {
              hasConsent: result.canTrack,
              consentStatus: result.consentStatus,
              reason: result.reason
            };
          }
          else {
            // Generic consent check
            const genericResult = await storage.checkIntegrationDataProcessingConsent(userId, integrationType, 'data_processing');
            consentStatus[integrationType] = {
              hasConsent: genericResult.canProcess,
              consentStatus: genericResult.consentStatus,
              reason: genericResult.reason
            };
          }

          if (!consentStatus[integrationType].hasConsent) {
            missingConsents.push(integrationType);
          }

        } catch (error) {
          console.error(`Error verifying consent for ${integrationType}:`, error);
          consentStatus[integrationType] = {
            hasConsent: false,
            consentStatus: 'error',
            reason: 'Consent verification failed'
          };
          missingConsents.push(integrationType);
        }
      }

      const canProceed = missingConsents.length === 0;

      await this.auditLog(organisationId, 'cross_integration_consent_verification', 'consent_check', {
        userId,
        requiredIntegrations,
        canProceed,
        missingConsents: missingConsents.length,
        correlationId
      });

      return {
        canProceed,
        consentStatus,
        missingConsents
      };

    } catch (error) {
      console.error(`❌ Failed to verify cross-integration consent [${correlationId}]:`, error);
      
      await this.auditLog(organisationId, 'cross_integration_consent_verification_failed', 'compliance_alert', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw error;
    }
  }

  /**
   * Handle user data subject rights request across all integrations
   */
  async handleCrossIntegrationUserRightsRequest(
    userId: string,
    organisationId: string,
    requestType: 'access' | 'rectification' | 'erasure' | 'restrict_processing',
    requestedBy: string,
    specificIntegrations?: string[]
  ): Promise<{
    success: boolean;
    results: Record<string, any>;
    summary: {
      successful: number;
      failed: number;
      totalIntegrations: number;
    };
  }> {
    const correlationId = `cross-integration-rights-${requestType}-${userId}-${nanoid(8)}`;
    const results: Record<string, any> = {};
    let successful = 0;
    let failed = 0;

    try {
      // Get enabled integrations for the organization
      const orgSettings = await storage.getOrganisationIntegrationConsents(organisationId);
      const enabledIntegrations = specificIntegrations || orgSettings
        .map((s: any) => s.integrationType!)
        .filter((type: any) => type); // Remove any null/undefined values

      console.log(`🔍 Processing ${requestType} request across ${enabledIntegrations.length} integrations [${correlationId}]`);

      for (const integrationType of enabledIntegrations) {
        try {
          let result: any;

          // Route to appropriate service for user rights handling
          if (integrationType === 'stripe_payments') {
            result = await gdprCompliantStripeService.handleUserRightsRequest(
              userId, organisationId, requestType, requestedBy
            );
          }
          else if (this.isEmailProvider(integrationType)) {
            result = await gdprCompliantEmailService.handleEmailUserRightsRequest(
              userId, organisationId, requestType, requestedBy
            );
          }
          else if (this.isAnalyticsProvider(integrationType)) {
            result = await gdprCompliantAnalyticsService.handleAnalyticsUserRightsRequest(
              userId, organisationId, requestType, requestedBy
            );
          }
          else {
            // Generic rights handling
            result = await this.handleGenericUserRightsRequest(
              userId, organisationId, integrationType, requestType, requestedBy
            );
          }

          results[integrationType] = result;
          
          if (result.success) {
            successful++;
          } else {
            failed++;
          }

        } catch (error) {
          console.error(`Error handling ${requestType} request for ${integrationType}:`, error);
          results[integrationType] = {
            success: false,
            message: `Failed to process ${requestType} request: ${error instanceof Error ? error.message : 'Unknown error'}`,
            limitations: ['Request processing failed due to technical error']
          };
          failed++;
        }
      }

      const overallSuccess = failed === 0;

      await this.auditLog(organisationId, `cross_integration_rights_${requestType}`, 'user_rights', {
        userId,
        requestedBy,
        totalIntegrations: enabledIntegrations.length,
        successful,
        failed,
        overallSuccess,
        correlationId
      });

      console.log(`✅ Cross-integration ${requestType} request completed [${correlationId}]:`, {
        total: enabledIntegrations.length,
        successful,
        failed
      });

      return {
        success: overallSuccess,
        results,
        summary: {
          successful,
          failed,
          totalIntegrations: enabledIntegrations.length
        }
      };

    } catch (error) {
      console.error(`❌ Failed to handle cross-integration ${requestType} request [${correlationId}]:`, error);
      
      await this.auditLog(organisationId, `cross_integration_rights_${requestType}_failed`, 'compliance_alert', {
        userId,
        requestedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw error;
    }
  }

  /**
   * Handle generic user rights request for unsupported integrations
   */
  private async handleGenericUserRightsRequest(
    userId: string,
    organisationId: string,
    integrationType: string,
    requestType: string,
    requestedBy: string
  ): Promise<any> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Basic handling for generic integrations
    switch (requestType) {
      case 'access':
        return {
          success: true,
          message: `Data access request logged for ${integrationType}. Manual review required.`,
          data: {
            integrationType,
            userId,
            requestDate: new Date().toISOString()
          },
          limitations: ['Manual review required for generic integration data access']
        };

      case 'erasure':
        return {
          success: true,
          message: `Data erasure request logged for ${integrationType}. Manual processing required.`,
          limitations: ['Manual processing required for generic integration data erasure']
        };

      case 'rectification':
        return {
          success: true,
          message: `Data rectification request logged for ${integrationType}. Manual processing required.`,
          limitations: ['Manual processing required for generic integration data rectification']
        };

      case 'restrict_processing':
        return {
          success: true,
          message: `Processing restriction request logged for ${integrationType}. Manual processing required.`,
          limitations: ['Manual processing required for generic integration processing restriction']
        };

      case 'portability':
        return {
          success: true,
          message: `Data portability request logged for ${integrationType}. Manual processing required.`,
          limitations: ['Manual processing required for generic integration data portability']
        };

      default:
        return {
          success: false,
          message: `Unsupported request type: ${requestType}`,
          limitations: ['Request type not supported for generic integrations']
        };
    }
  }

  /**
   * Generate comprehensive compliance report across all integrations
   */
  async generateOrganizationComplianceReport(organisationId: string): Promise<{
    overallCompliance: 'compliant' | 'attention_required' | 'non_compliant';
    integrationReports: Record<string, any>;
    summary: {
      totalIntegrations: number;
      compliantIntegrations: number;
      attentionRequiredIntegrations: number;
      nonCompliantIntegrations: number;
    };
    recommendations: string[];
    lastUpdated: string;
  }> {
    const correlationId = `org-compliance-report-${organisationId}-${nanoid(8)}`;

    try {
      const integrationReports: Record<string, any> = {};
      let compliantIntegrations = 0;
      let attentionRequiredIntegrations = 0;
      let nonCompliantIntegrations = 0;
      const allRecommendations: string[] = [];

      // Get enabled integrations
      const orgSettings = await storage.getOrganisationIntegrationConsents(organisationId);
      const enabledIntegrations = orgSettings
        // Note: isEnabled property not available in consent records
        .map(s => s.integrationType!)
        .filter(type => type);

      // Generate reports for each integration type
      for (const integrationType of enabledIntegrations) {
        try {
          let report: any;

          if (integrationType === 'stripe_payments') {
            report = await gdprCompliantStripeService.generateStripeGdprComplianceReport(organisationId);
          }
          else if (this.isEmailProvider(integrationType)) {
            report = await this.generateEmailProviderComplianceReport(organisationId, integrationType);
          }
          else if (this.isAnalyticsProvider(integrationType)) {
            report = await gdprCompliantAnalyticsService.generateAnalyticsGdprComplianceReport(organisationId);
          }
          else {
            report = await this.generateGenericIntegrationComplianceReport(organisationId, integrationType);
          }

          integrationReports[integrationType] = report;

          // Count compliance levels
          switch (report.overallCompliance) {
            case 'compliant':
              compliantIntegrations++;
              break;
            case 'attention_required':
              attentionRequiredIntegrations++;
              break;
            case 'non_compliant':
              nonCompliantIntegrations++;
              break;
          }

          // Collect recommendations
          if (report.recommendations && Array.isArray(report.recommendations)) {
            allRecommendations.push(...report.recommendations.map((r: string) => `${integrationType}: ${r}`));
          }

        } catch (error) {
          console.error(`Error generating compliance report for ${integrationType}:`, error);
          integrationReports[integrationType] = {
            overallCompliance: 'non_compliant',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          nonCompliantIntegrations++;
          allRecommendations.push(`${integrationType}: Fix technical issues preventing compliance assessment`);
        }
      }

      // Determine overall compliance
      let overallCompliance: 'compliant' | 'attention_required' | 'non_compliant';
      if (nonCompliantIntegrations > 0) {
        overallCompliance = 'non_compliant';
      } else if (attentionRequiredIntegrations > 0) {
        overallCompliance = 'attention_required';
      } else {
        overallCompliance = 'compliant';
      }

      // Add organization-level recommendations
      if (enabledIntegrations.length === 0) {
        allRecommendations.unshift('No integrations enabled. Consider enabling necessary integrations with GDPR compliance.');
      }

      if (compliantIntegrations > 0 && attentionRequiredIntegrations > 0) {
        allRecommendations.unshift(`${attentionRequiredIntegrations} integrations require attention. Review and address identified issues.`);
      }

      await this.auditLog(organisationId, 'organization_compliance_report_generated', 'compliance', {
        totalIntegrations: enabledIntegrations.length,
        compliantIntegrations,
        attentionRequiredIntegrations,
        nonCompliantIntegrations,
        overallCompliance,
        correlationId
      });

      return {
        overallCompliance,
        integrationReports,
        summary: {
          totalIntegrations: enabledIntegrations.length,
          compliantIntegrations,
          attentionRequiredIntegrations,
          nonCompliantIntegrations
        },
        recommendations: Array.from(new Set(allRecommendations)), // Remove duplicates
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed to generate organization compliance report [${correlationId}]:`, error);
      
      await this.auditLog(organisationId, 'organization_compliance_report_failed', 'compliance_alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });

      throw error;
    }
  }

  /**
   * Generate compliance report for email provider
   */
  private async generateEmailProviderComplianceReport(organisationId: string, integrationType: string): Promise<any> {
    // This would typically call a specific email provider compliance report method
    // For now, return a basic report structure
    const settings = await storage.getIntegrationGdprSettingsByType(organisationId, integrationType);
    
    if (!settings) {
      return {
        overallCompliance: 'non_compliant',
        recommendations: ['Initialize GDPR settings for email provider']
      };
    }

    return {
      overallCompliance: settings.complianceStatus === 'compliant' ? 'compliant' : 'attention_required',
      settingsStatus: {
        configured: true,
        dataMinimization: settings.dataMinimizationEnabled,
        consentRequired: settings.consentRequired,
        // auditLogging: Property not available in current schema
      },
      recommendations: settings.complianceStatus === 'compliant' ? [] : ['Review email provider GDPR settings']
    };
  }

  /**
   * Generate compliance report for generic integration
   */
  private async generateGenericIntegrationComplianceReport(organisationId: string, integrationType: string): Promise<any> {
    const settings = await storage.getIntegrationGdprSettingsByType(organisationId, integrationType);
    
    if (!settings) {
      return {
        overallCompliance: 'non_compliant',
        recommendations: [`Initialize GDPR settings for ${integrationType}`]
      };
    }

    const recommendations: string[] = [];
    
    if (settings.complianceStatus === 'needs_review') {
      recommendations.push('Manual GDPR compliance review required');
    }
    
    // Note: auditLoggingEnabled property not available in current schema
    // if (!settings.auditLoggingEnabled) {
    //   recommendations.push('Enable audit logging');
    // }

    return {
      overallCompliance: recommendations.length === 0 ? 'compliant' : 'attention_required',
      settingsStatus: {
        configured: true,
        requiresReview: settings.complianceStatus === 'needs_review',
        dataMinimization: settings.dataMinimizationEnabled,
        consentRequired: settings.consentRequired,
        // auditLogging: Property not available in current schema
      },
      recommendations
    };
  }

  /**
   * Helper methods for integration type classification
   */
  private isEmailProvider(integrationType: string): boolean {
    return ['sendgrid_api', 'brevo_api', 'mailgun_api', 'postmark_api', 'mailjet_api', 'sparkpost_api', 'smtp_generic'].includes(integrationType);
  }

  private isAnalyticsProvider(integrationType: string): boolean {
    return ['google_analytics', 'matomo', 'plausible', 'mixpanel', 'amplitude', 'internal_analytics'].includes(integrationType);
  }

  private getDisplayName(integrationType: string): string {
    const displayNames: Record<string, string> = {
      // Payment
      'stripe': 'Stripe Payment Processing',
      
      // Email providers
      'sendgrid_api': 'SendGrid Email API',
      'brevo_api': 'Brevo Email API',
      'mailgun_api': 'Mailgun Email API',
      'postmark_api': 'Postmark Email API',
      'mailjet_api': 'Mailjet Email API',
      'sparkpost_api': 'SparkPost Email API',
      'smtp_generic': 'SMTP Email Service',
      
      // Analytics providers
      'google_analytics': 'Google Analytics',
      'matomo': 'Matomo Analytics',
      'plausible': 'Plausible Analytics',
      'mixpanel': 'Mixpanel Analytics',
      'amplitude': 'Amplitude Analytics',
      'internal_analytics': 'Internal Analytics'
    };
    
    return displayNames[integrationType] || `${integrationType} Integration`;
  }

  /**
   * Enhanced audit logging for integration GDPR management
   */
  private async auditLog(
    organisationId: string,
    eventType: string,
    eventCategory: 'data_processing' | 'consent_management' | 'user_rights' | 'compliance_alert' | 'consent_check' | 'compliance',
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      const auditData: InsertIntegrationAuditLogs = {
        organisationId,
        integrationType: 'custom_api' as any, // Use valid enum value
        eventType,
        eventCategory,
        userId,
        // timestamp: Property not supported in current schema
        eventDescription: this.generateEventDescription(eventType, data),
        eventData: data,
        correlationId: data.correlationId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      };

      await storage.createIntegrationAuditLog(auditData);
    } catch (error) {
      console.error(`Failed to create audit log for ${eventType}:`, error);
      // Don't throw - audit failure shouldn't break main functionality
    }
  }

  /**
   * Generate human-readable event descriptions for audit logs
   */
  private generateEventDescription(eventType: string, data: Record<string, any>): string {
    switch (eventType) {
      case 'organization_integration_compliance_initialized':
        return `GDPR compliance initialized for ${data.totalIntegrations} integrations by ${data.configuredBy}`;
      case 'integration_gdpr_compliance_initialized':
        return `GDPR compliance initialized for ${data.integrationType} by ${data.configuredBy}`;
      case 'cross_integration_consent_verification':
        return `Cross-integration consent verified for ${data.requiredIntegrations?.length || 0} integrations (missing: ${data.missingConsents})`;
      case 'cross_integration_rights_access':
      case 'cross_integration_rights_erasure':
      case 'cross_integration_rights_rectification':
      case 'cross_integration_rights_restrict_processing':
      case 'cross_integration_rights_portability':
        return `Cross-integration user rights request processed (${data.successful}/${data.totalIntegrations} successful)`;
      case 'organization_compliance_report_generated':
        return `Organization compliance report generated (${data.compliantIntegrations}/${data.totalIntegrations} compliant)`;
      default:
        return `Integration manager event: ${eventType}`;
    }
  }

  /**
   * Get supported integration types
   */
  getSupportedIntegrationTypes(): string[] {
    return Object.keys(this.integrationServices);
  }

  /**
   * Check if integration type is supported
   */
  isIntegrationTypeSupported(integrationType: string): boolean {
    return this.integrationServices.hasOwnProperty(integrationType) || integrationType === 'generic';
  }
}

export const integrationGdprManager = IntegrationGdprManager.getInstance();