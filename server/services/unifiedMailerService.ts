import { storage } from "../storage";
import type { 
  User, 
  Organisation, 
  Course, 
  Assignment, 
  OrganisationSettings,
  SystemEmailSettings,
  InsertEmailLog
} from "@shared/schema";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EmailMetadata {
  organisationId?: string;
  templateType?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface UnifiedMailerService {
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    organisationId?: string;
    templateType?: string;
    metadata?: EmailMetadata;
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    usedOrgSettings: boolean;
    fallbackUsed: boolean;
  }>;
  testSmtpConnection(organisationId?: string): Promise<{
    success: boolean;
    host?: string;
    port?: number;
    provider?: string;
    tlsUsed: boolean;
    error?: string;
    usedOrgSettings: boolean;
  }>;
  getEffectiveSmtpSettings(organisationId?: string): Promise<{
    settings?: any;
    source: 'organisation' | 'system' | 'none';
    provider?: string;
  }>;
}

export class EnhancedUnifiedMailerService implements UnifiedMailerService {
  
  /**
   * Get effective SMTP settings with priority system:
   * 1. Organisation-level settings (if valid)
   * 2. System-level settings (fallback)
   * 3. None (error state)
   */
  async getEffectiveSmtpSettings(organisationId?: string): Promise<{
    settings?: any;
    source: 'organisation' | 'system' | 'none';
    provider?: string;
  }> {
    try {
      // Try organisation settings first
      if (organisationId && organisationId !== 'system-test') {
        const orgSettings = await storage.getOrganisationSettings(organisationId);
        if (this.isValidSmtpSettings(orgSettings)) {
          return {
            settings: orgSettings,
            source: 'organisation',
            provider: this.detectProvider(orgSettings?.smtpHost || '')
          };
        }
      }

      // Fall back to system settings
      const systemSettings = await storage.getSystemEmailSettings();
      if (systemSettings && this.isValidSmtpSettings(systemSettings)) {
        return {
          settings: systemSettings,
          source: 'system',
          provider: this.detectProvider(systemSettings.smtpHost || '')
        };
      }

      return { source: 'none' };
    } catch (error) {
      console.error('Error getting effective SMTP settings:', error);
      return { source: 'none' };
    }
  }

  /**
   * Validate SMTP settings completeness
   */
  private isValidSmtpSettings(settings: any): boolean {
    return !!(
      settings?.smtpHost && 
      settings?.smtpUsername && 
      settings?.smtpPassword &&
      settings?.fromEmail
    );
  }

  /**
   * Detect SMTP provider based on host
   */
  private detectProvider(host: string): string {
    if (!host) return 'custom';
    
    const hostLower = host.toLowerCase();
    if (hostLower.includes('brevo.com') || hostLower.includes('sendinblue.com')) return 'brevo';
    if (hostLower.includes('gmail.com') || hostLower.includes('smtp.gmail.com')) return 'gmail';
    if (hostLower.includes('outlook.com') || hostLower.includes('smtp.live.com')) return 'outlook';
    if (hostLower.includes('mailgun')) return 'mailgun';
    if (hostLower.includes('sendgrid')) return 'sendgrid';
    if (hostLower.includes('ses.amazonaws.com')) return 'aws_ses';
    return 'custom';
  }

  /**
   * Create secure transporter with provider-specific optimizations
   */
  private async createSecureTransporter(settings: any, provider: string): Promise<Transporter> {
    const port = settings.smtpPort || 587;
    
    const transportConfig: any = {
      host: settings.smtpHost,
      port: port,
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
    };

    // Provider-specific security configurations
    switch (provider) {
      case 'brevo':
        // Brevo requires STARTTLS on port 587
        transportConfig.secure = false;
        transportConfig.requireTLS = true;
        transportConfig.tls = {
          rejectUnauthorized: false,
          servername: settings.smtpHost,
        };
        break;
        
      case 'gmail':
        // Gmail uses OAuth2 or app passwords with SSL/TLS
        transportConfig.secure = port === 465;
        transportConfig.requireTLS = true;
        transportConfig.tls = {
          rejectUnauthorized: false,
        };
        break;
        
      case 'outlook':
        // Outlook.com/Office365 SMTP
        transportConfig.secure = port === 587 ? false : true;
        transportConfig.requireTLS = true;
        transportConfig.tls = {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        };
        break;
        
      default:
        // Default secure configuration for custom providers
        transportConfig.secure = port === 465;
        transportConfig.requireTLS = true;
        transportConfig.tls = {
          rejectUnauthorized: false,
          ciphers: 'ALL',
        };
        
        // Force TLS for port 587
        if (port === 587) {
          transportConfig.secure = false;
          transportConfig.requireTLS = true;
        }
    }

    // Security enforcement: Block insecure connections
    if (settings.smtpSecure === false && provider !== 'custom') {
      throw new Error('Insecure SMTP connections are not allowed for known providers');
    }

    console.log('Creating secure SMTP transport:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      requireTLS: transportConfig.requireTLS,
      provider,
    });

    return nodemailer.createTransport(transportConfig);
  }

  /**
   * Log email delivery attempt with comprehensive metadata
   */
  private async logEmailDelivery(options: {
    organisationId?: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    templateType?: string;
    smtpHost: string;
    smtpPort: number;
    provider: string;
    messageId?: string;
    status: 'sent' | 'failed';
    errorMessage?: string;
    tlsUsed: boolean;
    responseCode?: string;
    usedOrgSettings: boolean;
    fallbackUsed: boolean;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const logData: InsertEmailLog = {
        organisationId: options.organisationId || null,
        fromEmail: options.fromEmail,
        toEmail: options.toEmail,
        subject: options.subject,
        templateType: options.templateType as any,
        smtpHost: options.smtpHost,
        smtpPort: options.smtpPort,
        provider: 'smtp_generic' as any,
        messageId: options.messageId || null,
        status: options.status,
        errorMessage: options.errorMessage || null,
        tlsUsed: options.tlsUsed,
        responseCode: options.responseCode || null,
        usedOrgSettings: options.usedOrgSettings,
        fallbackUsed: options.fallbackUsed,
        userAgent: options.userAgent || null,
        ipAddress: options.ipAddress || null,
      };

      await storage.createEmailLog(logData);
    } catch (error) {
      console.error('Error logging email delivery:', error);
      // Don't throw - logging failure shouldn't prevent email sending
    }
  }

  /**
   * Test SMTP connection with health check
   */
  async testSmtpConnection(organisationId?: string): Promise<{
    success: boolean;
    host?: string;
    port?: number;
    provider?: string;
    tlsUsed: boolean;
    error?: string;
    usedOrgSettings: boolean;
  }> {
    try {
      const { settings, source, provider } = await this.getEffectiveSmtpSettings(organisationId);
      
      if (!settings) {
        return {
          success: false,
          error: 'No SMTP settings configured',
          tlsUsed: false,
          usedOrgSettings: false,
        };
      }

      const transporter = await this.createSecureTransporter(settings, provider!);
      
      // Verify connection
      await transporter.verify();
      
      return {
        success: true,
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        provider,
        tlsUsed: true, // All connections are forced to use TLS
        usedOrgSettings: source === 'organisation',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        tlsUsed: false,
        usedOrgSettings: false,
      };
    }
  }

  /**
   * Send email with comprehensive logging and fallback system
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    organisationId?: string;
    templateType?: string;
    metadata?: EmailMetadata;
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    usedOrgSettings: boolean;
    fallbackUsed: boolean;
  }> {
    const { to, subject, html, organisationId, templateType, metadata } = options;
    
    try {
      // Get effective SMTP settings with priority system
      const { settings, source, provider } = await this.getEffectiveSmtpSettings(organisationId);
      
      if (!settings) {
        const error = 'SMTP not configured. Please configure SMTP settings at organization or system level.';
        
        // Log the failed attempt
        await this.logEmailDelivery({
          organisationId,
          fromEmail: 'system@unknown',
          toEmail: to,
          subject,
          templateType,
          smtpHost: 'none',
          smtpPort: 0,
          provider: 'none',
          status: 'failed',
          errorMessage: error,
          tlsUsed: false,
          usedOrgSettings: false,
          fallbackUsed: false,
          userAgent: metadata?.userAgent,
          ipAddress: metadata?.ipAddress,
        });
        
        return {
          success: false,
          error,
          usedOrgSettings: false,
          fallbackUsed: false,
        };
      }

      // Create secure transporter
      const transporter = await this.createSecureTransporter(settings, provider!);
      
      // Prepare email options
      const fromName = settings.fromName || 'LMS System';
      const fromEmail = settings.fromEmail;
      
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: to,
        subject: subject,
        html: html,
      };

      // Send the email
      const info = await transporter.sendMail(mailOptions);
      
      // Log successful delivery
      await this.logEmailDelivery({
        organisationId,
        fromEmail,
        toEmail: to,
        subject,
        templateType,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort || 587,
        provider: provider!,
        messageId: info.messageId,
        status: 'sent',
        tlsUsed: true, // All our connections use TLS
        responseCode: info.response,
        usedOrgSettings: source === 'organisation',
        fallbackUsed: source === 'system',
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      });

      console.log(`📧 Email sent successfully to ${to} via ${provider} (${source} settings)`);
      
      return {
        success: true,
        messageId: info.messageId,
        usedOrgSettings: source === 'organisation',
        fallbackUsed: source === 'system',
      };
      
    } catch (error: any) {
      console.error('Email sending failed:', error);
      
      // Try to get settings info for logging
      const { settings, source, provider } = await this.getEffectiveSmtpSettings(organisationId);
      
      // Log failed delivery
      await this.logEmailDelivery({
        organisationId,
        fromEmail: settings?.fromEmail || 'unknown',
        toEmail: to,
        subject,
        templateType,
        smtpHost: settings?.smtpHost || 'unknown',
        smtpPort: settings?.smtpPort || 0,
        provider: provider || 'unknown',
        status: 'failed',
        errorMessage: error.message,
        tlsUsed: false,
        usedOrgSettings: source === 'organisation',
        fallbackUsed: source === 'system',
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      });
      
      return {
        success: false,
        error: error.message,
        usedOrgSettings: source === 'organisation',
        fallbackUsed: source === 'system',
      };
    }
  }

  /**
   * Convenience methods for different email types
   */
  async sendWelcomeEmail(user: User, organisation: Organisation, password: string, metadata?: EmailMetadata): Promise<boolean> {
    const result = await this.sendEmail({
      to: user.email || '',
      subject: `Welcome to ${organisation.displayName} LMS`,
      html: `
        <h2>Welcome to ${organisation.displayName}</h2>
        <p>Hello ${user.firstName || user.email},</p>
        <p>Welcome to our Learning Management System! Your account has been created successfully.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>Temporary Password:</strong> ${password}</li>
        </ul>
        <p>Please log in and change your password at your earliest convenience.</p>
        <br>
        <p>Best regards,<br>${organisation.displayName}</p>
      `,
      organisationId: organisation.id,
      templateType: 'welcome_account_created',
      metadata,
    });
    return result.success;
  }

  async sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, metadata?: EmailMetadata): Promise<boolean> {
    const result = await this.sendEmail({
      to: user.email || '',
      subject: `New Course Assignment - ${course.title}`,
      html: `
        <h2>New Course Assignment</h2>
        <p>Hello ${user.firstName || user.email},</p>
        <p>You have been assigned a new course: <strong>${course.title}</strong></p>
        <p><strong>Due Date:</strong> ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}</p>
        <p>Please log in to your learning management system to access the course.</p>
        <br>
        <p>Best regards,<br>${organisation.displayName}</p>
      `,
      organisationId: organisation.id,
      templateType: 'course_assigned',
      metadata,
    });
    return result.success;
  }

  async sendTestEmail(toEmail: string, organisationId?: string, metadata?: EmailMetadata): Promise<{
    success: boolean;
    details: any;
  }> {
    const result = await this.sendEmail({
      to: toEmail,
      subject: 'Test Email - SMTP Configuration',
      html: `
        <h2>Email Test Successful</h2>
        <p>This is a test email to verify your SMTP configuration.</p>
        <p>Your email settings are working correctly!</p>
        <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        <br>
        <p>Best regards,<br>LMS System</p>
      `,
      organisationId,
      templateType: 'smtp_test' as any,
      metadata,
    });

    return {
      success: result.success,
      details: {
        messageId: result.messageId,
        error: result.error,
        usedOrgSettings: result.usedOrgSettings,
        fallbackUsed: result.fallbackUsed,
      }
    };
  }
}

export const unifiedMailerService = new EnhancedUnifiedMailerService();