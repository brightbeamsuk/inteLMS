/**
 * Automated Email Service
 * 
 * Handles automated email notifications using hardcoded templates.
 * Routes all emails through EmailOrchestrator to maintain idempotency and prevent duplicates.
 */

import { EmailOrchestrator } from './EmailOrchestrator';
import { AutomatedEmailTemplates, type CourseAssignedData, type CourseCompletedData, type DueDatePassedData } from './AutomatedEmailTemplates';

const LOG_PREFIX = '[AutomatedEmail]';
const emailOrchestrator = new EmailOrchestrator();

export class AutomatedEmailService {

  /**
   * Send course assigned notification to user
   */
  async sendCourseAssigned(data: CourseAssignedData & { userEmail: string; organisationId?: string; courseId: string; assignmentId: string }): Promise<void> {
    console.log(`${LOG_PREFIX} Queueing course assigned email to ${data.userEmail}`);
    
    const template = AutomatedEmailTemplates.courseAssigned(data);
    
    await emailOrchestrator.queue({
      triggerEvent: 'COURSE_ASSIGNED',
      toEmail: data.userEmail,
      context: {},
      organisationId: data.organisationId,
      resourceId: `course-assign:${data.userEmail}:${data.courseId}:${data.assignmentId}`,
      preRenderedContent: {
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text
      },
      priority: 2
    });
  }

  /**
   * Send course completed notification to user
   */
  async sendUserCourseCompleted(data: CourseCompletedData & { organisationId?: string; courseId: string; completionId: string }): Promise<void> {
    console.log(`${LOG_PREFIX} Queueing course ${data.status.toLowerCase()} email to ${data.userEmail}`);
    
    const template = AutomatedEmailTemplates.userCourseCompleted(data);
    const triggerEvent = data.status === 'PASS' ? 'COURSE_COMPLETED' : 'COURSE_FAILED';
    
    await emailOrchestrator.queue({
      triggerEvent,
      toEmail: data.userEmail,
      context: {},
      organisationId: data.organisationId,
      resourceId: `course-complete:${data.userEmail}:${data.courseId}:${data.completionId}`,
      preRenderedContent: {
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text
      },
      priority: 1
    });
  }

  /**
   * Send due date passed notification to user
   */
  async sendDueDatePassed(data: DueDatePassedData & { userEmail: string; organisationId?: string; courseId: string; assignmentId: string }): Promise<void> {
    console.log(`${LOG_PREFIX} Queueing due date passed email to ${data.userEmail}`);
    
    const template = AutomatedEmailTemplates.dueDatePassed(data);
    
    await emailOrchestrator.queue({
      triggerEvent: 'COURSE_ASSIGNED', // Reuse COURSE_ASSIGNED trigger for due date notifications
      toEmail: data.userEmail,
      context: {},
      organisationId: data.organisationId,
      resourceId: `due-date-passed:${data.userEmail}:${data.courseId}:${data.assignmentId}`,
      preRenderedContent: {
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text
      },
      priority: 1
    });
  }

  /**
   * Send course completion notification to admin (candidate completed/failed)
   */
  async sendAdminCandidateCompleted(data: CourseCompletedData & { adminEmail: string; organisationId?: string; courseId: string; completionId: string }): Promise<void> {
    console.log(`${LOG_PREFIX} Queueing candidate completion notification to admin ${data.adminEmail}`);
    
    const template = AutomatedEmailTemplates.adminCandidateCompleted(data);
    const triggerEvent = data.status === 'PASS' ? 'COURSE_COMPLETED' : 'COURSE_FAILED';
    
    await emailOrchestrator.queue({
      triggerEvent,
      toEmail: data.adminEmail,
      context: {},
      organisationId: data.organisationId,
      resourceId: `admin-notify:${data.adminEmail}:${data.userEmail}:${data.courseId}:${data.completionId}`,
      preRenderedContent: {
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text
      },
      priority: 2
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
    userId: string;
  }): Promise<void> {
    console.log(`${LOG_PREFIX} Queueing new user notification to admin ${data.adminEmail}`);
    
    const template = AutomatedEmailTemplates.adminNewUserAdded(data);
    
    await emailOrchestrator.queue({
      triggerEvent: 'USER_FAST_ADD',
      toEmail: data.adminEmail,
      context: {},
      organisationId: data.organisationId,
      resourceId: `new-user:${data.adminEmail}:${data.userEmail}:${data.userId}`,
      preRenderedContent: {
        subject: template.subject,
        htmlBody: template.html,
        textBody: template.text
      },
      priority: 2
    });
  }
}

// Export singleton instance
export const automatedEmailService = new AutomatedEmailService();
