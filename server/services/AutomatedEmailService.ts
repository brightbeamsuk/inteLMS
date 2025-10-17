/**
 * Automated Email Service
 * 
 * Handles automated email notifications using hardcoded templates.
 * Uses organization's email provider settings (or system defaults) to send emails.
 */

import { MailerService, type EmailResult } from './MailerService';
import { AutomatedEmailTemplates, type CourseAssignedData, type CourseCompletedData, type DueDatePassedData } from './AutomatedEmailTemplates';

const LOG_PREFIX = '[AutomatedEmail]';
const mailerService = new MailerService();

export class AutomatedEmailService {

  /**
   * Send email using organization-specific provider or system defaults
   * The MailerService automatically handles fallback from org -> system
   */
  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    organisationId?: string;
  }): Promise<EmailResult> {
    try {
      // MailerService automatically uses org settings if orgId is provided, falls back to system defaults
      const result = await mailerService.send({
        orgId: params.organisationId,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text
      });
      
      console.log(`${LOG_PREFIX} Email sent:`, result.success ? 'Success' : 'Failed');
      return result;
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Email send failed:`, error);
      return {
        success: false,
        provider: 'smtp_generic' as const,
        details: {
          from: '',
          to: params.to,
          messageId: '',
          effectiveFieldSources: {} as any,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Send course assigned notification to user
   */
  async sendCourseAssigned(data: CourseAssignedData & { userEmail: string; organisationId?: string }): Promise<EmailResult> {
    console.log(`${LOG_PREFIX} Sending course assigned email to ${data.userEmail}`);
    
    const template = AutomatedEmailTemplates.courseAssigned(data);
    
    return this.sendEmail({
      to: data.userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      organisationId: data.organisationId
    });
  }

  /**
   * Send course completed notification to user
   */
  async sendUserCourseCompleted(data: CourseCompletedData & { organisationId?: string }): Promise<EmailResult> {
    console.log(`${LOG_PREFIX} Sending course completed email to ${data.userEmail}`);
    
    const template = AutomatedEmailTemplates.userCourseCompleted(data);
    
    return this.sendEmail({
      to: data.userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      organisationId: data.organisationId
    });
  }

  /**
   * Send due date passed notification to user
   */
  async sendDueDatePassed(data: DueDatePassedData & { userEmail: string; organisationId?: string }): Promise<EmailResult> {
    console.log(`${LOG_PREFIX} Sending due date passed email to ${data.userEmail}`);
    
    const template = AutomatedEmailTemplates.dueDatePassed(data);
    
    return this.sendEmail({
      to: data.userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      organisationId: data.organisationId
    });
  }

  /**
   * Send course completion notification to admin (candidate completed/failed)
   */
  async sendAdminCandidateCompleted(data: CourseCompletedData & { adminEmail: string; organisationId?: string }): Promise<EmailResult> {
    console.log(`${LOG_PREFIX} Sending candidate completion notification to admin ${data.adminEmail}`);
    
    const template = AutomatedEmailTemplates.adminCandidateCompleted(data);
    
    return this.sendEmail({
      to: data.adminEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      organisationId: data.organisationId
    });
  }

  /**
   * Send new user added notification to admin
   */
  async sendAdminNewUserAdded(data: {
    adminEmail: string;
    adminName?: string;
    userName: string;
    userEmail: string;
    orgName: string;
    organisationId?: string;
  }): Promise<EmailResult> {
    console.log(`${LOG_PREFIX} Sending new user notification to admin ${data.adminEmail}`);
    
    const template = AutomatedEmailTemplates.adminNewUserAdded(data);
    
    return this.sendEmail({
      to: data.adminEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      organisationId: data.organisationId
    });
  }
}

// Export singleton instance
export const automatedEmailService = new AutomatedEmailService();
