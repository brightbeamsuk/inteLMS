import { storage } from "../storage";
import type { 
  User, 
  Organisation, 
  Course, 
  Assignment, 
  OrganisationSettings,
  SystemSmtpSettings,
  InsertEmailLog
} from "@shared/schema";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { createConnection } from "net";
import { promisify } from "util";
import { lookup } from "dns";

const dnsLookup = promisify(lookup);

export interface EmailMetadata {
  organisationId?: string;
  templateType?: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
}

export interface SmtpTestResult {
  success: boolean;
  timestamp: string;
  organisationId?: string;
  smtpHost?: string;
  smtpPort?: number;
  resolvedIp?: string;
  tlsEnabled: boolean;
  messageId?: string;
  smtpResponse?: string;
  error?: string;
  source: 'organisation' | 'system' | 'none';
  provider?: string;
}

export interface HealthCheckResult {
  success: boolean;
  timestamp: string;
  smtpHost?: string;
  smtpPort?: number;
  resolvedIp?: string;
  dnsResolution: boolean;
  tcpConnection: boolean;
  startTlsSupport: boolean;
  error?: string;
  latencyMs?: number;
}

/**
 * Single Mailer Service - The only email service used throughout the application.
 * 
 * Requirements:
 * - Read SMTP settings from org settings or superadmin defaults
 * - Always connect with SMTP AUTH + TLS (no sendmail/direct MX)
 * - Comprehensive logging for every send
 * - Health checks with DNS resolution, TCP connection, and STARTTLS
 * - Clear error messages when SMTP not configured
 */
export class SingleMailerService {
  
  /**
   * Send email with comprehensive logging and SMTP-only enforcement
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    organisationId?: string;
    templateType?: string;
    metadata?: EmailMetadata;
  }): Promise<SmtpTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      // Get effective SMTP settings with priority system
      const smtpConfig = await this.getEffectiveSmtpSettings(options.organisationId);
      
      if (!smtpConfig.settings) {
        const error = `SMTP not configured. No valid SMTP settings found for ${options.organisationId ? 'organisation' : 'system'} level.`;
        
        // Log failed attempt
        await this.logEmailAttempt({
          organisationId: options.organisationId,
          templateType: options.templateType || 'unknown',
          toEmail: options.to,
          subject: options.subject,
          smtpHost: null,
          smtpPort: null,
          resolvedIp: null,
          tlsUsed: false,
          success: false,
          messageId: null,
          smtpResponse: null,
          error: error,
          metadata: options.metadata
        });
        
        return {
          success: false,
          timestamp,
          error,
          organisationId: options.organisationId,
          tlsEnabled: false,
          source: smtpConfig.source
        };
      }

      // Resolve DNS to get actual IP
      const resolvedIp = await this.resolveSmtpHost(smtpConfig.settings.smtpHost);
      
      // Create SMTP transporter with forced TLS
      const transporter = await this.createSecureTransporter(smtpConfig.settings);
      
      // Send email
      const result = await transporter.sendMail({
        from: `"${smtpConfig.settings.fromName || 'LMS Platform'}" <${smtpConfig.settings.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      
      const endTime = Date.now();
      
      // Log successful send
      await this.logEmailAttempt({
        organisationId: options.organisationId,
        templateType: options.templateType || 'unknown',
        toEmail: options.to,
        subject: options.subject,
        smtpHost: smtpConfig.settings.smtpHost,
        smtpPort: smtpConfig.settings.smtpPort || 587,
        resolvedIp,
        tlsUsed: true, // Always true in our implementation
        success: true,
        messageId: result.messageId,
        smtpResponse: result.response,
        error: null,
        metadata: options.metadata,
        latencyMs: endTime - startTime
      });
      
      return {
        success: true,
        timestamp,
        organisationId: options.organisationId,
        smtpHost: smtpConfig.settings.smtpHost,
        smtpPort: smtpConfig.settings.smtpPort || 587,
        resolvedIp,
        tlsEnabled: true,
        messageId: result.messageId,
        smtpResponse: result.response,
        source: smtpConfig.source,
        provider: smtpConfig.provider
      };
      
    } catch (error: unknown) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown SMTP error';
      
      // Log failed send
      await this.logEmailAttempt({
        organisationId: options.organisationId,
        templateType: options.templateType || 'unknown',
        toEmail: options.to,
        subject: options.subject,
        smtpHost: null,
        smtpPort: null,
        resolvedIp: null,
        tlsUsed: false,
        success: false,
        messageId: null,
        smtpResponse: null,
        error: errorMessage,
        metadata: options.metadata,
        latencyMs: endTime - startTime
      });
      
      return {
        success: false,
        timestamp,
        error: errorMessage,
        organisationId: options.organisationId,
        tlsEnabled: false,
        source: 'none'
      };
    }
  }

  /**
   * Send test email with detailed metadata for admin testing
   */
  async sendTestEmail(
    toEmail: string, 
    organisationId?: string, 
    metadata?: EmailMetadata
  ): Promise<SmtpTestResult> {
    const testSubject = `SMTP Test Email - ${new Date().toLocaleString()}`;
    const testHtml = `
      <h2>SMTP Configuration Test</h2>
      <p>This is a test email sent from the LMS platform to verify SMTP configuration.</p>
      <hr>
      <p><strong>Test Details:</strong></p>
      <ul>
        <li>Timestamp: ${new Date().toISOString()}</li>
        <li>Organisation ID: ${organisationId || 'System Level'}</li>
        <li>Test Type: Admin SMTP Test</li>
      </ul>
      <p>If you received this email, your SMTP configuration is working correctly.</p>
    `;
    
    return await this.sendEmail({
      to: toEmail,
      subject: testSubject,
      html: testHtml,
      organisationId,
      templateType: 'smtp_test',
      metadata
    });
  }

  /**
   * Comprehensive health check: DNS resolution, TCP connection, STARTTLS
   */
  async healthCheck(organisationId?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      // Get effective SMTP settings
      const smtpConfig = await this.getEffectiveSmtpSettings(organisationId);
      
      if (!smtpConfig.settings) {
        return {
          success: false,
          timestamp,
          error: 'SMTP not configured. No valid SMTP settings found.',
          dnsResolution: false,
          tcpConnection: false,
          startTlsSupport: false
        };
      }

      const host = smtpConfig.settings.smtpHost;
      const port = smtpConfig.settings.smtpPort || 587;
      
      // Step 1: DNS Resolution
      let resolvedIp: string;
      try {
        const result = await dnsLookup(host);
        resolvedIp = Array.isArray(result) ? result[0].address : result.address;
      } catch (error) {
        return {
          success: false,
          timestamp,
          smtpHost: host,
          smtpPort: port,
          error: `DNS resolution failed: ${error.message}`,
          dnsResolution: false,
          tcpConnection: false,
          startTlsSupport: false,
          latencyMs: Date.now() - startTime
        };
      }
      
      // Step 2: TCP Connection
      const tcpResult = await this.testTcpConnection(host, port);
      if (!tcpResult.success) {
        return {
          success: false,
          timestamp,
          smtpHost: host,
          smtpPort: port,
          resolvedIp,
          error: `TCP connection failed: ${tcpResult.error}`,
          dnsResolution: true,
          tcpConnection: false,
          startTlsSupport: false,
          latencyMs: Date.now() - startTime
        };
      }
      
      // Step 3: STARTTLS Support Check
      const tlsResult = await this.testStartTls(host, port);
      
      const endTime = Date.now();
      
      return {
        success: tcpResult.success && tlsResult.success,
        timestamp,
        smtpHost: host,
        smtpPort: port,
        resolvedIp,
        dnsResolution: true,
        tcpConnection: tcpResult.success,
        startTlsSupport: tlsResult.success,
        error: tlsResult.success ? undefined : tlsResult.error,
        latencyMs: endTime - startTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        timestamp,
        error: `Health check failed: ${error.message}`,
        dnsResolution: false,
        tcpConnection: false,
        startTlsSupport: false,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get effective SMTP settings with priority: org → system → none
   */
  private async getEffectiveSmtpSettings(organisationId?: string): Promise<{
    settings?: any;
    source: 'organisation' | 'system' | 'none';
    provider?: string;
  }> {
    try {
      // Try organisation settings first
      if (organisationId && organisationId !== 'system-test') {
        const orgSettings = await storage.getOrganisationSettings(organisationId);
        if (orgSettings && this.isValidSmtpSettings(orgSettings)) {
          return {
            settings: orgSettings,
            source: 'organisation',
            provider: this.detectProvider(orgSettings.smtpHost!)
          };
        }
      }
      
      // Fallback to system settings
      const systemSettings = await storage.getSystemSmtpSettings();
      if (systemSettings && this.isValidSmtpSettings(systemSettings)) {
        return {
          settings: systemSettings,
          source: 'system',
          provider: this.detectProvider(systemSettings.smtpHost)
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
    return settings && 
           settings.smtpHost && 
           settings.smtpUsername && 
           settings.smtpPassword &&
           settings.fromEmail;
  }

  /**
   * Detect email provider from SMTP host
   */
  private detectProvider(smtpHost: string): string {
    const host = smtpHost.toLowerCase();
    if (host.includes('gmail.com')) return 'Gmail';
    if (host.includes('outlook.com') || host.includes('hotmail.com')) return 'Outlook';
    if (host.includes('brevo.com') || host.includes('sendinblue.com')) return 'Brevo';
    if (host.includes('sendgrid.net')) return 'SendGrid';
    if (host.includes('mailgun.org')) return 'Mailgun';
    if (host.includes('amazon') || host.includes('ses')) return 'Amazon SES';
    return 'Custom SMTP';
  }

  /**
   * Resolve SMTP host to IP address
   */
  private async resolveSmtpHost(host: string): Promise<string> {
    try {
      const result = await dnsLookup(host);
      return Array.isArray(result) ? result[0].address : result.address;
    } catch (error) {
      console.error(`DNS resolution failed for ${host}:`, error);
      return 'unresolved';
    }
  }

  /**
   * Create secure SMTP transporter with enforced TLS
   */
  private async createSecureTransporter(settings: any): Promise<Transporter> {
    const port = settings.smtpPort || 587;
    const isBrevo = settings.smtpHost?.includes('brevo.com') || settings.smtpHost?.includes('sendinblue.com');
    
    // Enforce TLS for all connections
    const transportConfig = {
      host: settings.smtpHost,
      port: port,
      secure: port === 465, // true for 465, false for other ports
      requireTLS: true, // Force TLS
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
      // Provider-specific optimizations
      ...(isBrevo && {
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      })
    };

    console.log('Creating SMTP transport with enforced TLS:', {
      host: settings.smtpHost,
      port: port,
      secure: port === 465,
      requireTLS: true,
      provider: this.detectProvider(settings.smtpHost)
    });

    return nodemailer.createTransport(transportConfig);
  }

  /**
   * Test TCP connection to SMTP server
   */
  private async testTcpConnection(host: string, port: number): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = createConnection({ host, port, timeout: 5000 });
      
      socket.on('connect', () => {
        socket.destroy();
        resolve({ success: true });
      });
      
      socket.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      });
    });
  }

  /**
   * Test STARTTLS support
   */
  private async testStartTls(host: string, port: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a test transporter to check STARTTLS
      const testTransporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        requireTLS: true,
        auth: {
          user: 'test@example.com', // Dummy credentials for connection test
          pass: 'dummy'
        }
      });
      
      // Try to verify connection (this will test STARTTLS)
      await testTransporter.verify();
      return { success: true };
    } catch (error: any) {
      // If it's an auth error, STARTTLS is working
      if (error.message.includes('authentication') || error.message.includes('credentials')) {
        return { success: true };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Log email attempt to database
   */
  private async logEmailAttempt(logData: {
    organisationId?: string;
    templateType: string;
    toEmail: string;
    subject: string;
    smtpHost: string | null;
    smtpPort: number | null;
    resolvedIp: string | null;
    tlsUsed: boolean;
    success: boolean;
    messageId: string | null;
    smtpResponse: string | null;
    error: string | null;
    metadata?: EmailMetadata;
    latencyMs?: number;
  }): Promise<void> {
    try {
      const emailLog: InsertEmailLog = {
        organisationId: logData.organisationId,
        fromEmail: 'system@lms.com',
        toEmail: logData.toEmail,
        subject: logData.subject,
        templateType: logData.templateType as any,
        smtpHost: logData.smtpHost || 'unknown',
        smtpPort: logData.smtpPort || 587,
        smtpProvider: logData.smtpHost ? this.detectProvider(logData.smtpHost) : 'unknown',
        messageId: logData.messageId,
        status: logData.success ? 'sent' : 'failed',
        errorMessage: logData.error,
        tlsUsed: logData.tlsUsed,
        responseCode: logData.smtpResponse,
        userAgent: logData.metadata?.userAgent,
        ipAddress: logData.metadata?.ipAddress,
        usedOrgSettings: logData.organisationId ? true : false,
        fallbackUsed: false
      };
      
      await storage.createEmailLog(emailLog);
    } catch (error) {
      console.error('Failed to log email attempt:', error);
      // Don't throw error - logging failure shouldn't break email sending
    }
  }

  // Convenience methods for common email types
  async sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean> {
    if (!user.email) return false;
    const result = await this.sendEmail({
      to: user.email,
      subject: `New Course Assignment: ${course.title}`,
      html: this.generateAssignmentEmailHtml(user, course, assignment, organisation),
      organisationId: organisation.id,
      templateType: 'assignment_notification',
      metadata: { userId: user.id }
    });
    return result.success;
  }

  async sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean> {
    if (!user.email) return false;
    const result = await this.sendEmail({
      to: user.email,
      subject: `Welcome to ${organisation.name}`,
      html: this.generateWelcomeEmailHtml(user, organisation, password),
      organisationId: organisation.id,
      templateType: 'welcome_email',
      metadata: { userId: user.id }
    });
    return result.success;
  }

  async sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean> {
    if (!user.email) return false;
    const result = await this.sendEmail({
      to: user.email,
      subject: `Reminder: ${course.title} - Due in ${daysUntilDue} days`,
      html: this.generateReminderEmailHtml(user, course, assignment, organisation, daysUntilDue),
      organisationId: organisation.id,
      templateType: 'reminder_email',
      metadata: { userId: user.id }
    });
    return result.success;
  }

  async sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean> {
    if (!user.email) return false;
    const result = await this.sendEmail({
      to: user.email,
      subject: `Course Completed: ${course.title}`,
      html: this.generateCompletionEmailHtml(user, course, completion, organisation),
      organisationId: organisation.id,
      templateType: 'completion_email',
      metadata: { userId: user.id }
    });
    return result.success;
  }

  // HTML template generators (keeping existing logic)
  private generateAssignmentEmailHtml(user: User, course: Course, assignment: Assignment, organisation: Organisation): string {
    return `
      <h2>New Course Assignment</h2>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>You have been assigned a new course: <strong>${course.title}</strong></p>
      <p>Due Date: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date set'}</p>
      <p>Please log in to your learning platform to begin the course.</p>
      <hr>
      <p>Best regards,<br>${organisation.name}</p>
    `;
  }

  private generateWelcomeEmailHtml(user: User, organisation: Organisation, password: string): string {
    return `
      <h2>Welcome to ${organisation.name}</h2>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>Your account has been created. Here are your login credentials:</p>
      <p><strong>Email:</strong> ${user.email}<br>
      <strong>Temporary Password:</strong> ${password}</p>
      <p>Please log in and change your password immediately.</p>
      <hr>
      <p>Best regards,<br>${organisation.name}</p>
    `;
  }

  private generateReminderEmailHtml(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): string {
    return `
      <h2>Course Reminder</h2>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>This is a reminder that your course <strong>${course.title}</strong> is due in ${daysUntilDue} days.</p>
      <p>Due Date: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date set'}</p>
      <p>Please complete your course before the due date.</p>
      <hr>
      <p>Best regards,<br>${organisation.name}</p>
    `;
  }

  private generateCompletionEmailHtml(user: User, course: Course, completion: any, organisation: Organisation): string {
    const status = completion.status === 'completed' ? 'completed successfully' : 'attempted';
    return `
      <h2>Course ${completion.status === 'completed' ? 'Completed' : 'Attempted'}</h2>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>You have ${status} the course: <strong>${course.title}</strong></p>
      ${completion.score ? `<p>Your score: ${completion.score}%</p>` : ''}
      <p>Thank you for your participation in the learning program.</p>
      <hr>
      <p>Best regards,<br>${organisation.name}</p>
    `;
  }
}

// Export singleton instance
export const singleMailerService = new SingleMailerService();