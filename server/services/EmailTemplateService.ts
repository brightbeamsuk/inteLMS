/**
 * EmailTemplateService
 * 
 * Comprehensive email delivery service that connects email templates with the existing email system.
 * Provides both generic templated email sending and event-specific convenience methods.
 * 
 * Features:
 * - Template resolution with organization overrides and system defaults
 * - Variable substitution with validation and XSS protection
 * - Intelligent email routing (org → system fallback)
 * - Event-specific email methods for common use cases
 * - Comprehensive error handling and logging
 * - Support for single and bulk email sending
 * 
 * Integration Points:
 * - EmailTemplateResolutionService: Gets effective templates
 * - EmailTemplateEngineService: Renders templates with variables
 * - MailerService: Sends the final emails
 * - Storage: Access to organization and user data
 */

import { emailTemplateResolver } from './EmailTemplateResolutionService';
import { emailTemplateEngine } from './EmailTemplateEngineService';
import { mailerService } from './MailerService';
import { storage } from '../storage';
import type { 
  EmailResult,
  EmailSendParams 
} from './MailerService';

// Main service parameters interface
export interface SendTemplatedEmailParams {
  templateKey: string;
  to: string | string[];
  variables: Record<string, any>;
  organizationId?: string;
  fromOverride?: {
    name?: string;
    email?: string;
  };
}

// Templated email result interface
export interface TemplatedEmailResult {
  success: boolean;
  templateKey: string;
  recipientCount: number;
  processedCount: number;
  failedCount: number;
  results: EmailResult[];
  errors: string[];
  templateSource: 'override' | 'default';
  cacheHit?: boolean;
}

// Event-specific data interfaces
export interface NewAdminNotificationData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  new_admin: {
    name: string;
    email: string;
    full_name: string;
  };
  added_by: {
    name: string;
    full_name: string;
  };
  added_at: string;
}

export interface NewUserNotificationData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  user: {
    name: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
  };
  added_by: {
    name: string;
    full_name: string;
  };
  added_at: string;
}

export interface CourseAssignedNotificationData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  user: {
    name: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
  };
  course: {
    title: string;
    description: string;
    category: string;
    estimated_duration: number;
  };
  assigned_by: {
    name: string;
    full_name: string;
  };
  assigned_at: string;
  due_date?: string;
}

export interface PlanUpdatedNotificationData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  plan: {
    name: string;
    old_price: number;
    new_price: number;
    billing_cadence: string;
  };
  changed_by: {
    name: string;
    full_name: string;
  };
  changed_at: string;
  effective_date?: string;
}

export interface LearnerCompletedNotificationData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  user: {
    name: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
  };
  course: {
    title: string;
    description: string;
    category: string;
    estimated_duration: number;
  };
  attempt: {
    score: number;
    status: string;
    time_spent: number;
  };
  completed_at: string;
}

export interface LearnerFailedNotificationData {
  org: {
    name: string;
    display_name: string;
    subdomain: string;
  };
  admin: {
    name: string;
    email: string;
    full_name: string;
  };
  user: {
    name: string;
    email: string;
    full_name: string;
    job_title: string;
    department: string;
  };
  course: {
    title: string;
    description: string;
    category: string;
    estimated_duration: number;
  };
  attempt: {
    score: number;
    status: string;
    time_spent: number;
  };
  failed_at: string;
}

export class EmailTemplateService {
  private readonly LOG_PREFIX = '[EmailTemplateService]';

  constructor(
    private templateResolver = emailTemplateResolver,
    private templateEngine = emailTemplateEngine,
    private mailer = mailerService
  ) {}

  /**
   * Main method for sending templated emails
   * 
   * @param params Email parameters with template resolution
   * @returns Comprehensive result with success/failure details
   */
  async sendTemplatedEmail(params: SendTemplatedEmailParams): Promise<TemplatedEmailResult> {
    const { templateKey, to, variables, organizationId, fromOverride } = params;
    
    // Normalize recipients to array
    const recipients = Array.isArray(to) ? to : [to];
    console.log(`${this.LOG_PREFIX} Sending templated email "${templateKey}" to ${recipients.length} recipient(s)`);

    const result: TemplatedEmailResult = {
      success: false,
      templateKey,
      recipientCount: recipients.length,
      processedCount: 0,
      failedCount: 0,
      results: [],
      errors: [],
      templateSource: 'default',
      cacheHit: false
    };

    try {
      // Step 1: Resolve the effective template
      console.log(`${this.LOG_PREFIX} Resolving template "${templateKey}" for org: ${organizationId || 'system-default'}`);
      const resolvedTemplate = await this.templateResolver.getEffectiveTemplate(
        organizationId || 'system-default',
        templateKey
      );

      result.templateSource = resolvedTemplate.source;
      result.cacheHit = resolvedTemplate.cacheHit || false;

      console.log(`${this.LOG_PREFIX} Template resolved from ${resolvedTemplate.source} (cache: ${result.cacheHit})`);

      // Step 2: Validate variables against template schema
      if (resolvedTemplate.variablesSchema) {
        const validationResult = this.templateEngine.validateTemplate(
          resolvedTemplate.subject + ' ' + resolvedTemplate.html + ' ' + (resolvedTemplate.text || ''),
          resolvedTemplate.variablesSchema
        );

        if (!validationResult.isValid) {
          const errorMsg = `Template validation failed: ${validationResult.errors.join(', ')}`;
          console.error(`${this.LOG_PREFIX} ${errorMsg}`);
          result.errors.push(errorMsg);
          return result;
        }
      }

      // Step 3: Render the template with variables
      console.log(`${this.LOG_PREFIX} Rendering template with provided variables`);
      const renderedTemplate = await this.templateEngine.renderForSending(resolvedTemplate, variables);

      // Step 4: Send emails to each recipient
      console.log(`${this.LOG_PREFIX} Sending rendered emails to ${recipients.length} recipient(s)`);
      
      for (const recipient of recipients) {
        try {
          const emailParams: EmailSendParams = {
            orgId: organizationId,
            to: recipient,
            subject: renderedTemplate.subject,
            html: renderedTemplate.html,
            text: renderedTemplate.text || undefined,
            templateType: templateKey
          };

          // Apply from override if provided
          if (fromOverride?.name || fromOverride?.email) {
            // Note: MailerService doesn't directly support from override
            // This would require extending MailerService or using a different approach
            console.log(`${this.LOG_PREFIX} From override requested but not supported by current MailerService`);
          }

          const emailResult = await this.mailer.send(emailParams);
          result.results.push(emailResult);

          if (emailResult.success) {
            result.processedCount++;
            console.log(`${this.LOG_PREFIX} Email sent successfully to ${recipient}`);
          } else {
            result.failedCount++;
            const errorMsg = `Failed to send to ${recipient}: ${emailResult.error?.short || 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(`${this.LOG_PREFIX} ${errorMsg}`);
          }

        } catch (error) {
          result.failedCount++;
          const errorMsg = `Exception sending to ${recipient}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(`${this.LOG_PREFIX} ${errorMsg}`, error);
        }
      }

      // Determine overall success
      result.success = result.processedCount > 0 && result.failedCount === 0;

      console.log(`${this.LOG_PREFIX} Template email batch complete: ${result.processedCount}/${result.recipientCount} sent successfully`);
      return result;

    } catch (error) {
      const errorMsg = `Failed to send templated email: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`${this.LOG_PREFIX} ${errorMsg}`, error);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Send notification to admin when a new admin is added to the organization
   */
  async sendNewAdminNotification(
    adminEmail: string,
    newAdminData: NewAdminNotificationData,
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending new admin notification to ${adminEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'admin.new_admin_added',
      to: adminEmail,
      variables: newAdminData,
      organizationId: orgId
    });
  }

  /**
   * Send notification to admin when a new user is added to the organization
   */
  async sendNewUserNotification(
    adminEmail: string,
    newUserData: NewUserNotificationData,
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending new user notification to ${adminEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'admin.new_user_added',
      to: adminEmail,
      variables: newUserData,
      organizationId: orgId
    });
  }

  /**
   * Send notification to admin when a course is assigned to a user
   */
  async sendCourseAssignedNotification(
    adminEmail: string,
    assignmentData: CourseAssignedNotificationData,
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending course assigned notification to ${adminEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'admin.new_course_assigned',
      to: adminEmail,
      variables: assignmentData,
      organizationId: orgId
    });
  }

  /**
   * Send notification to admin when the organization's plan is updated
   */
  async sendPlanUpdatedNotification(
    adminEmail: string,
    planData: PlanUpdatedNotificationData,
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending plan updated notification to ${adminEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'admin.plan_updated',
      to: adminEmail,
      variables: planData,
      organizationId: orgId
    });
  }

  /**
   * Send notification to admin when a learner completes a course
   */
  async sendLearnerCompletedNotification(
    adminEmail: string,
    completionData: LearnerCompletedNotificationData,
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending learner completed notification to ${adminEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'admin.learner_completed_course',
      to: adminEmail,
      variables: completionData,
      organizationId: orgId
    });
  }

  /**
   * Send notification to admin when a learner fails a course
   */
  async sendLearnerFailedNotification(
    adminEmail: string,
    failureData: LearnerFailedNotificationData,
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending learner failed notification to ${adminEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'admin.learner_failed_course',
      to: adminEmail,
      variables: failureData,
      organizationId: orgId
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(
    userEmail: string,
    userData: {
      org: { name: string; display_name: string; subdomain: string };
      user: { name: string; email: string; full_name: string };
      admin: { name: string; email: string; full_name: string };
    },
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending welcome email to ${userEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'learner.welcome_account_created',
      to: userEmail,
      variables: userData,
      organizationId: orgId
    });
  }

  /**
   * Send course assignment notification to learner
   */
  async sendCourseAssignmentEmail(
    userEmail: string,
    assignmentData: {
      org: { name: string; display_name: string; subdomain: string };
      user: { name: string; email: string; full_name: string };
      course: { title: string; description: string; estimated_duration: number };
      assigned_by: { name: string; full_name: string };
      assigned_at: string;
      due_date?: string;
    },
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending course assignment email to ${userEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'learner.course_assigned',
      to: userEmail,
      variables: assignmentData,
      organizationId: orgId
    });
  }

  /**
   * Send course completion certificate email to learner
   */
  async sendCertificateEmail(
    userEmail: string,
    certificateData: {
      org: { name: string; display_name: string; subdomain: string };
      user: { name: string; email: string; full_name: string };
      course: { title: string; description: string };
      attempt: { score: number; completed_at: string };
      certificate_url?: string;
    },
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending certificate email to ${userEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'learner.course_completion_certificate',
      to: userEmail,
      variables: certificateData,
      organizationId: orgId
    });
  }

  /**
   * Send course reminder email to learner
   */
  async sendCourseReminderEmail(
    userEmail: string,
    reminderData: {
      org: { name: string; display_name: string; subdomain: string };
      user: { name: string; email: string; full_name: string };
      course: { title: string; description: string; estimated_duration: number };
      due_date?: string;
      days_remaining?: number;
    },
    orgId: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending course reminder email to ${userEmail} for org ${orgId}`);

    return await this.sendTemplatedEmail({
      templateKey: 'learner.course_reminder',
      to: userEmail,
      variables: reminderData,
      organizationId: orgId
    });
  }

  /**
   * Send test email for diagnostics
   */
  async sendTestEmail(
    recipientEmail: string,
    testData: {
      org?: { name: string; display_name: string };
      test_message?: string;
      sent_at: string;
      provider_info?: string;
    },
    orgId?: string
  ): Promise<TemplatedEmailResult> {
    console.log(`${this.LOG_PREFIX} Sending test email to ${recipientEmail} for org ${orgId || 'system'}`);

    return await this.sendTemplatedEmail({
      templateKey: 'system.smtp_test',
      to: recipientEmail,
      variables: {
        ...testData,
        org: testData.org || { name: 'System', display_name: 'System Default' }
      },
      organizationId: orgId
    });
  }

  /**
   * Get template preview with sample data
   */
  async getTemplatePreview(
    templateKey: string,
    orgId?: string
  ): Promise<{
    subject: string;
    html: string;
    text: string | null;
    source: 'override' | 'default';
    sampleVariables: Record<string, any>;
  } | null> {
    try {
      console.log(`${this.LOG_PREFIX} Getting template preview for "${templateKey}"`);

      // Get effective template
      const resolvedTemplate = await this.templateResolver.getEffectiveTemplate(
        orgId || 'system-default',
        templateKey
      );

      // Generate sample data for the template
      const sampleVariables = this.templateEngine.generateSampleData(templateKey);

      // Render with sample data
      const renderedTemplate = await this.templateEngine.renderForSending(
        resolvedTemplate,
        sampleVariables
      );

      return {
        subject: renderedTemplate.subject,
        html: renderedTemplate.html,
        text: renderedTemplate.text,
        source: resolvedTemplate.source,
        sampleVariables
      };

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error getting template preview:`, error);
      return null;
    }
  }

  /**
   * Validate template variables for a specific template
   */
  async validateTemplateVariables(
    templateKey: string,
    variables: Record<string, any>,
    orgId?: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    missingVariables: string[];
  }> {
    try {
      console.log(`${this.LOG_PREFIX} Validating variables for template "${templateKey}"`);

      // Get effective template
      const resolvedTemplate = await this.templateResolver.getEffectiveTemplate(
        orgId || 'system-default',
        templateKey
      );

      // Validate variables if schema exists
      if (resolvedTemplate.variablesSchema) {
        const validationResult = this.templateEngine.validateTemplate(
          resolvedTemplate.subject + ' ' + resolvedTemplate.html + ' ' + (resolvedTemplate.text || ''),
          resolvedTemplate.variablesSchema
        );

        // Check for missing variables by attempting render
        try {
          await this.templateEngine.renderForSending(resolvedTemplate, variables);
        } catch (renderError) {
          return {
            isValid: false,
            errors: [renderError instanceof Error ? renderError.message : 'Render validation failed'],
            missingVariables: []
          };
        }

        return {
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          missingVariables: validationResult.invalidVariables.map(v => v.path)
        };
      }

      return {
        isValid: true,
        errors: [],
        missingVariables: []
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        missingVariables: []
      };
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(orgId?: string): Promise<{
    templateResolution: boolean;
    templateEngine: boolean;
    mailer: boolean;
    overall: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let templateResolution = false;
    let templateEngine = false;
    let mailer = false;

    try {
      // Test template resolution
      await this.templateResolver.getEffectiveTemplate(orgId || 'system-default', 'system.smtp_test');
      templateResolution = true;
    } catch (error) {
      errors.push(`Template resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test template engine
      this.templateEngine.generateSampleData('system.smtp_test');
      templateEngine = true;
    } catch (error) {
      errors.push(`Template engine failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test mailer health
      const mailerHealth = await this.mailer.healthCheck(orgId);
      mailer = mailerHealth.success;
      if (!mailer && mailerHealth.error) {
        errors.push(`Mailer health check failed: ${mailerHealth.error.short}`);
      }
    } catch (error) {
      errors.push(`Mailer health check exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const overall = templateResolution && templateEngine && mailer;

    return {
      templateResolution,
      templateEngine,
      mailer,
      overall,
      errors
    };
  }
}

// Export singleton instance following existing pattern
export const emailTemplateService = new EmailTemplateService();