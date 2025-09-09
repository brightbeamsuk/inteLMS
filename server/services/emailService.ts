import { storage } from "../storage";
import type { User, Organisation, Course, Assignment, OrganisationSettings } from "@shared/schema";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EmailService {
  sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean>;
  sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean>;
  sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean>;
  sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean>;
  sendTestEmail(toEmail: string, organisationId: string): Promise<boolean>;
}

export class SmtpEmailService implements EmailService {
  private async getSystemEmailSettings(): Promise<any> {
    try {
      const smtpHost = await storage.getPlatformSetting('system_smtp_host');
      const smtpPort = await storage.getPlatformSetting('system_smtp_port');
      const smtpUsername = await storage.getPlatformSetting('system_smtp_username');
      const smtpPassword = await storage.getPlatformSetting('system_smtp_password');
      const smtpSecure = await storage.getPlatformSetting('system_smtp_secure');
      const fromEmail = await storage.getPlatformSetting('system_from_email');
      const fromName = await storage.getPlatformSetting('system_from_name');

      return {
        smtpHost: smtpHost?.value || null,
        smtpPort: smtpPort?.value ? parseInt(smtpPort.value) : 587,
        smtpUsername: smtpUsername?.value || null,
        smtpPassword: smtpPassword?.value || null,
        smtpSecure: smtpSecure?.value !== 'false',
        fromEmail: fromEmail?.value || null,
        fromName: fromName?.value || 'System',
      };
    } catch (error) {
      console.error('Error getting system email settings:', error);
      return {};
    }
  }
  private async createTransporter(organisationId: string): Promise<Transporter | null> {
    try {
      let settings: any = null;
      let isSystemFallback = false;
      
      // If this is a system test, use system settings directly
      if (organisationId === 'system-test') {
        console.log('Using system settings for system test');
        settings = await this.getSystemEmailSettings();
        isSystemFallback = true;
      } else {
        // First try organization-specific settings
        settings = await storage.getOrganisationSettings(organisationId);
        
        // If organization doesn't have email settings, try system-wide settings
        if (!settings?.smtpHost || !settings?.smtpUsername || !settings?.smtpPassword) {
          console.log('Organization SMTP not configured, checking system settings for:', organisationId);
          
          // Get system email settings from platform settings
          const systemSettings = await this.getSystemEmailSettings();
          if (systemSettings.smtpHost && systemSettings.smtpUsername && systemSettings.smtpPassword) {
            settings = systemSettings;
            isSystemFallback = true;
            console.log('Using system-wide SMTP settings as fallback');
          }
        }
      }
      
      // Final check if we have valid settings
      if (!settings?.smtpHost || !settings?.smtpUsername || !settings?.smtpPassword) {
        console.log('No valid SMTP settings found at organization or system level');
        return null;
      }

      const port = settings.smtpPort || 587;
      const isBrevo = settings.smtpHost?.includes('brevo.com') || settings.smtpHost?.includes('sendinblue.com');
      
      // Create transport configuration optimized for different providers
      const transportConfig: any = {
        host: settings.smtpHost,
        port: port,
        auth: {
          user: settings.smtpUsername,
          pass: settings.smtpPassword,
        },
      };

      if (settings.smtpSecure === false) {
        // Insecure/plain connection - no encryption
        transportConfig.secure = false;
        transportConfig.ignoreTLS = true;
      } else if (isBrevo) {
        // Brevo-specific configuration
        transportConfig.secure = false; // Brevo uses STARTTLS, not SSL
        transportConfig.requireTLS = true;
        transportConfig.tls = {
          rejectUnauthorized: false,
          servername: settings.smtpHost,
        };
      } else {
        // Standard secure connection for other providers
        transportConfig.secure = port === 465; // SSL for port 465, STARTTLS for others
        transportConfig.tls = {
          rejectUnauthorized: false,
          ciphers: 'ALL',
        };
        
        // For port 587, explicitly enable STARTTLS
        if (port === 587) {
          transportConfig.requireTLS = true;
        }
      }

      console.log('Creating SMTP transport with config:', {
        host: transportConfig.host,
        port: transportConfig.port,
        secure: transportConfig.secure,
        ignoreTLS: transportConfig.ignoreTLS,
        requireTLS: transportConfig.requireTLS,
        isBrevo,
      });

      const transporter = nodemailer.createTransport(transportConfig);

      return transporter;
    } catch (error) {
      console.error('Error creating email transporter:', error);
      return null;
    }
  }

  private async getFromAddress(organisationId: string): Promise<{ email: string; name: string }> {
    const settings = await storage.getOrganisationSettings(organisationId);
    return {
      email: settings?.fromEmail || 'noreply@lms.com',
      name: settings?.fromName || 'LMS System',
    };
  }

  async sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean> {
    try {
      const transporter = await this.createTransporter(organisation.id);
      if (!transporter) {
        console.log(`📧 Assignment Email (console) sent to ${user.email}: SMTP not configured`);
        return false;
      }

      const from = await this.getFromAddress(organisation.id);
      const mailOptions = {
        from: `"${from.name}" <${from.email}>`,
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
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Assignment Email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending assignment email:', error);
      return false;
    }
  }

  async sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean> {
    try {
      const transporter = await this.createTransporter(organisation.id);
      if (!transporter) {
        console.log(`📧 Reminder Email (console) sent to ${user.email}: SMTP not configured`);
        return false;
      }

      const from = await this.getFromAddress(organisation.id);
      const mailOptions = {
        from: `"${from.name}" <${from.email}>`,
        to: user.email || '',
        subject: `Course Due Reminder - ${course.title}`,
        html: `
          <h2>Course Due Reminder</h2>
          <p>Hello ${user.firstName || user.email},</p>
          <p>This is a reminder that your course <strong>${course.title}</strong> is due in ${daysUntilDue} day(s).</p>
          <p><strong>Due Date:</strong> ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}</p>
          <p>Please log in to your learning management system to complete the course.</p>
          <br>
          <p>Best regards,<br>${organisation.displayName}</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Reminder Email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending reminder email:', error);
      return false;
    }
  }

  async sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean> {
    try {
      const transporter = await this.createTransporter(organisation.id);
      if (!transporter) {
        console.log(`📧 Completion Email (console) sent to ${user.email}: SMTP not configured`);
        return false;
      }

      const from = await this.getFromAddress(organisation.id);
      const status = completion.passed ? 'Passed' : 'Not Passed';
      const mailOptions = {
        from: `"${from.name}" <${from.email}>`,
        to: user.email || '',
        subject: `Course Completed - ${course.title}`,
        html: `
          <h2>Course Completion</h2>
          <p>Hello ${user.firstName || user.email},</p>
          <p>Congratulations! You have completed the course: <strong>${course.title}</strong></p>
          <p><strong>Final Score:</strong> ${completion.score || 0}%</p>
          <p><strong>Status:</strong> ${status}</p>
          ${completion.passed ? '<p>🎉 You have successfully passed this course!</p>' : '<p>Please review the course material and try again if needed.</p>'}
          <br>
          <p>Best regards,<br>${organisation.displayName}</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Completion Email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending completion email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean> {
    try {
      const transporter = await this.createTransporter(organisation.id);
      if (!transporter) {
        console.log(`📧 Welcome Email (console) sent to ${user.email}: SMTP not configured`);
        return false;
      }

      const from = await this.getFromAddress(organisation.id);
      const mailOptions = {
        from: `"${from.name}" <${from.email}>`,
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
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Welcome Email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  async sendTestEmail(toEmail: string, organisationId: string): Promise<boolean> {
    try {
      const transporter = await this.createTransporter(organisationId);
      if (!transporter) {
        throw new Error('SMTP settings not configured or invalid');
      }

      const from = await this.getFromAddress(organisationId);
      const mailOptions = {
        from: `"${from.name}" <${from.email}>`,
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
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Test Email sent to ${toEmail}`);
      return true;
    } catch (error) {
      console.error('Error sending test email:', error);
      throw error;
    }
  }
}

export const emailService = new SmtpEmailService();
