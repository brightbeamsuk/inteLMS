/**
 * Legacy EmailService.ts - MIGRATED TO MAILERSERVICE
 * 
 * This file now serves as a thin wrapper that delegates all email operations
 * to the centralized MailerService to ensure intelligent routing.
 * 
 * All email functionality has been migrated to MailerService.send() which provides:
 * - Intelligent org->system fallback routing
 * - Provider-agnostic email sending (SMTP, SendGrid, Brevo, etc.)
 * - Comprehensive error handling and diagnostics
 * - Consistent EmailResult response format
 */

import { MailerService, type EmailResult } from "./MailerService";
import type { User, Organisation, Course, Assignment } from "@shared/schema";

// Export the centralized mailer service - ALL email operations use this
export const emailService = new MailerService();

/**
 * Legacy interface kept for backward compatibility
 * All methods now delegate to MailerService.send() for intelligent routing
 */
export interface EmailService {
  sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean>;
  sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean>;
  sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean>;
  sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean>;
  sendTestEmail(toEmail: string, organisationId: string): Promise<boolean>;
}

/**
 * Legacy wrapper class - DEPRECATED
 * Use MailerService.send() directly instead of this class
 * This exists only for backward compatibility and delegates to MailerService
 */
export class SmtpEmailService implements EmailService {
  private mailerService = new MailerService();

  async sendAssignmentEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation): Promise<boolean> {
    const result = await this.mailerService.send({
      orgId: organisation.id,
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
      templateType: 'assignment'
    });
    return result.success;
  }

  async sendReminderEmail(user: User, course: Course, assignment: Assignment, organisation: Organisation, daysUntilDue: number): Promise<boolean> {
    const result = await this.mailerService.send({
      orgId: organisation.id,
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
      templateType: 'reminder'
    });
    return result.success;
  }

  async sendCompletionEmail(user: User, course: Course, completion: any, organisation: Organisation): Promise<boolean> {
    const status = completion.passed ? 'Passed' : 'Not Passed';
    const result = await this.mailerService.send({
      orgId: organisation.id,
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
      templateType: 'completion'
    });
    return result.success;
  }

  async sendWelcomeEmail(user: User, organisation: Organisation, password: string): Promise<boolean> {
    const result = await this.mailerService.send({
      orgId: organisation.id,
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
      templateType: 'welcome'
    });
    return result.success;
  }

  async sendTestEmail(toEmail: string, organisationId: string): Promise<boolean> {
    const result = await this.mailerService.send({
      orgId: organisationId,
      to: toEmail,
      subject: 'Test Email - SMTP Configuration',
      html: `
        <h2>Email Test Successful</h2>
        <p>This is a test email to verify your email configuration using intelligent routing.</p>
        <p>Your email settings are working correctly!</p>
        <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        <br>
        <p>Best regards,<br>LMS System</p>
      `,
      templateType: 'test'
    });
    return result.success;
  }
}