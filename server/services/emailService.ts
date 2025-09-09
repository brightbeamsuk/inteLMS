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
  private async createTransporter(organisationId: string): Promise<Transporter | null> {
    try {
      const settings = await storage.getOrganisationSettings(organisationId);
      if (!settings?.smtpHost || !settings?.smtpUsername || !settings?.smtpPassword) {
        console.log('SMTP settings not configured for organisation:', organisationId);
        return null;
      }

      const port = settings.smtpPort || 587;
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: port,
        secure: port === 465, // true for 465 (SSL), false for other ports (587/25)
        requireTLS: port === 587, // STARTTLS for port 587
        auth: {
          user: settings.smtpUsername,
          pass: settings.smtpPassword,
        },
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates for testing
        },
      });

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
