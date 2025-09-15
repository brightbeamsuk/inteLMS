/**
 * Breach Notification Service
 * Integrates GDPR breach notification templates with EmailOrchestrator
 * Articles 33 & 34 Compliance - ICO and Individual Notifications
 */

import { EmailOrchestrator, type TemplateRenderContext } from './EmailOrchestrator';
import { storage } from '../storage';
import { generateICONotificationEmail, generateIndividualNotificationEmail, generateBreachReference } from '../templates/breach-notifications';
import type { DataBreach, Organisation } from '@shared/schema';

export class BreachNotificationService {
  private readonly LOG_PREFIX = '[BreachNotificationService]';
  private emailOrchestrator: EmailOrchestrator;

  constructor() {
    this.emailOrchestrator = new EmailOrchestrator();
    console.log(`${this.LOG_PREFIX} Initialized breach notification service`);
  }

  /**
   * Register all breach notification templates with EmailOrchestrator
   * Called during application startup to ensure templates are available
   */
  async registerBreachTemplates(): Promise<void> {
    try {
      console.log(`${this.LOG_PREFIX} Registering breach notification templates...`);

      // Register ICO notification template (Article 33)
      await this.registerICONotificationTemplate();
      
      // Register individual notification template (Article 34)
      await this.registerIndividualNotificationTemplate();

      console.log(`${this.LOG_PREFIX} Successfully registered all breach notification templates`);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to register breach templates:`, error);
      throw error;
    }
  }

  /**
   * Register ICO notification template for Article 33 compliance
   */
  private async registerICONotificationTemplate(): Promise<void> {
    const templateData = {
      templateKey: 'ico_breach_notification',
      name: 'ICO Breach Notification',
      description: 'GDPR Article 33 - Notification to Supervisory Authority (ICO)',
      subject: 'URGENT: Data Breach Notification - {{breach.title}} (Ref: {{breach.reference}})',
      htmlTemplate: this.getICOHtmlTemplate(),
      textTemplate: this.getICOTextTemplate(),
      category: 'regulatory_compliance',
      triggerEvents: ['BREACH_ICO_NOTIFICATION'],
      requiredVariables: [
        'org.name',
        'org.displayName', 
        'breach.title',
        'breach.description',
        'breach.severity',
        'breach.detectedAt',
        'breach.affectedSubjects',
        'breach.dataCategories',
        'breach.cause',
        'breach.impact',
        'breach.containmentMeasures',
        'breach.preventiveMeasures',
        'breach.responsible'
      ],
      gdprCompliance: {
        article: 'Article_33',
        purpose: 'supervisory_authority_notification',
        legalBasis: 'legal_obligation',
        retentionPeriod: 2555, // 7 years in days for regulatory compliance
        dataController: true
      }
    };

    // Store template in platform defaults
    await this.storeTemplate(templateData);
    console.log(`${this.LOG_PREFIX} Registered ICO notification template: ${templateData.templateKey}`);
  }

  /**
   * Register individual notification template for Article 34 compliance
   */
  private async registerIndividualNotificationTemplate(): Promise<void> {
    const templateData = {
      templateKey: 'individual_breach_notification',
      name: 'Individual Breach Notification',
      description: 'GDPR Article 34 - Communication to Data Subject',
      subject: 'Important: Data Security Incident Affecting Your Personal Information',
      htmlTemplate: this.getIndividualHtmlTemplate(),
      textTemplate: this.getIndividualTextTemplate(),
      category: 'data_subject_notification',
      triggerEvents: ['BREACH_SUBJECT_NOTIFICATION'],
      requiredVariables: [
        'org.name',
        'breach.title',
        'breach.description',
        'breach.severity',
        'breach.detectedAt',
        'breach.dataCategories',
        'breach.containmentMeasures',
        'breach.preventiveMeasures'
      ],
      gdprCompliance: {
        article: 'Article_34',
        purpose: 'data_subject_notification',
        legalBasis: 'legal_obligation',
        retentionPeriod: 2555, // 7 years in days
        dataController: true,
        highRiskOnly: true
      }
    };

    await this.storeTemplate(templateData);
    console.log(`${this.LOG_PREFIX} Registered individual notification template: ${templateData.templateKey}`);
  }

  /**
   * Store template in the email template system
   */
  private async storeTemplate(templateData: any): Promise<void> {
    try {
      console.log(`${this.LOG_PREFIX} Storing template with key: ${templateData.templateKey}`);
      
      // Generate basic MJML wrapper for HTML content
      const mjmlTemplate = this.generateMJMLFromHTML(templateData.htmlTemplate, templateData.templateKey);
      
      // Map template data to match the database schema
      const emailTemplateData = {
        key: templateData.templateKey, // This is the critical field that must not be null
        name: templateData.name,
        subject: templateData.subject,
        html: templateData.htmlTemplate, // Map htmlTemplate -> html
        mjml: mjmlTemplate, // Required field - generated MJML
        text: templateData.textTemplate, // Map textTemplate -> text (optional)
        variablesSchema: {
          // Convert requiredVariables array to schema format
          required: templateData.requiredVariables || [],
          properties: this.generateVariableSchema(templateData.requiredVariables || [])
        },
        category: templateData.category, // Must match emailTemplateCategoryEnum
        version: 1, // Default version
      };

      console.log(`${this.LOG_PREFIX} Creating email template with data:`, {
        key: emailTemplateData.key,
        name: emailTemplateData.name,
        category: emailTemplateData.category,
        hasHtml: !!emailTemplateData.html,
        hasMjml: !!emailTemplateData.mjml,
        hasText: !!emailTemplateData.text
      });

      // Store in platform email templates with correct schema mapping
      await storage.createEmailTemplate(emailTemplateData);
      
      console.log(`${this.LOG_PREFIX} Successfully stored template: ${templateData.templateKey}`);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error storing template ${templateData.templateKey}:`, error);
      // Template might already exist, which is fine for system templates
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
        console.log(`${this.LOG_PREFIX} Template ${templateData.templateKey} already exists, skipping`);
        return;
      }
      throw error;
    }
  }

  /**
   * Generate basic MJML template from HTML content
   */
  private generateMJMLFromHTML(htmlTemplate: string, templateKey: string): string {
    // Extract body content from HTML template
    const bodyMatch = htmlTemplate.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlTemplate;

    // Generate MJML wrapper with responsive design
    return `<mjml>
  <mj-head>
    <mj-title>${templateKey.replace(/_/g, ' ').toUpperCase()}</mj-title>
    <mj-font name="Arial" href="https://fonts.googleapis.com/css?family=Arial" />
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#333333" line-height="1.6" />
      <mj-section padding="0" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text>
          ${bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim()}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
  }

  /**
   * Generate JSON schema properties for template variables
   */
  private generateVariableSchema(requiredVariables: string[]): Record<string, any> {
    const properties: Record<string, any> = {};
    
    for (const variable of requiredVariables) {
      // Parse nested object properties (e.g., 'org.name' -> { org: { properties: { name: {...} } } })
      const parts = variable.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        if (!properties[parent]) {
          properties[parent] = {
            type: 'object',
            properties: {}
          };
        }
        properties[parent].properties[child] = {
          type: 'string',
          description: `${parent} ${child}`
        };
      } else {
        properties[variable] = {
          type: 'string',
          description: variable.replace(/([A-Z])/g, ' $1').toLowerCase()
        };
      }
    }
    
    return properties;
  }

  /**
   * Send ICO notification for a data breach
   * Article 33 - 72-hour notification requirement
   */
  async sendICONotification(
    breachId: string, 
    organisationId: string,
    triggeredBy: { id: string; name: string; email: string }
  ): Promise<any> {
    try {
      console.log(`${this.LOG_PREFIX} Sending ICO notification for breach: ${breachId}`);

      // Get breach and organization details
      const breach = await storage.getDataBreach(breachId);
      if (!breach) {
        throw new Error(`Breach not found: ${breachId}`);
      }

      const organisation = await storage.getOrganisation(organisationId);
      if (!organisation) {
        throw new Error(`Organisation not found: ${organisationId}`);
      }

      // Generate breach reference
      const breachReference = generateBreachReference(breach, organisation.name);

      // Build context for template
      const context: TemplateRenderContext = {
        org: {
          name: organisation.name,
          displayName: organisation.displayName || organisation.name
        },
        admin: {
          name: triggeredBy.name,
          email: triggeredBy.email,
          fullName: triggeredBy.name
        },
        breach: {
          id: breach.id,
          title: breach.title,
          description: breach.description,
          severity: breach.severity,
          detectedAt: breach.detectedAt.toISOString(),
          affectedSubjects: breach.affectedSubjects,
          dataCategories: breach.dataCategories,
          cause: breach.cause,
          impact: breach.impact,
          containmentMeasures: breach.containmentMeasures,
          preventiveMeasures: breach.preventiveMeasures,
          notificationDeadline: breach.notificationDeadline.toISOString(),
          responsible: breach.responsible,
          reference: breachReference
        }
      };

      // Queue ICO notification with highest priority
      const result = await this.emailOrchestrator.queue({
        triggerEvent: 'BREACH_ICO_NOTIFICATION',
        templateKey: 'ico_breach_notification',
        toEmail: process.env.ICO_NOTIFICATION_EMAIL || 'ico-notifications@ico.org.uk',
        organisationId: organisationId,
        resourceId: breachId,
        priority: 1, // Highest priority for regulatory notifications
        context
      });

      console.log(`${this.LOG_PREFIX} ICO notification queued for breach: ${breachId}`);
      return result;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send ICO notification:`, error);
      throw error;
    }
  }

  /**
   * Send individual notifications to affected data subjects
   * Article 34 - High-risk breach notifications
   */
  async sendIndividualNotifications(
    breachId: string,
    organisationId: string,
    recipientEmails: string[],
    triggeredBy: { id: string; name: string; email: string },
    customMessage?: string
  ): Promise<any[]> {
    try {
      console.log(`${this.LOG_PREFIX} Sending individual notifications for breach: ${breachId} to ${recipientEmails.length} recipients`);

      // Get breach and organization details
      const breach = await storage.getDataBreach(breachId);
      if (!breach) {
        throw new Error(`Breach not found: ${breachId}`);
      }

      const organisation = await storage.getOrganisation(organisationId);
      if (!organisation) {
        throw new Error(`Organisation not found: ${organisationId}`);
      }

      // Check if high-risk breach requiring individual notification
      if (!['high', 'critical'].includes(breach.severity)) {
        throw new Error('Individual notification only required for high/critical risk breaches');
      }

      const results = [];

      // Send notification to each recipient
      for (const email of recipientEmails) {
        try {
          const context: TemplateRenderContext = {
            org: {
              name: organisation.name,
              displayName: organisation.displayName || organisation.name
            },
            admin: {
              name: triggeredBy.name,
              email: triggeredBy.email,
              fullName: triggeredBy.name
            },
            user: {
              email: email
            },
            breach: {
              title: breach.title,
              description: breach.description,
              severity: breach.severity,
              detectedAt: breach.detectedAt.toISOString(),
              dataCategories: breach.dataCategories,
              containmentMeasures: breach.containmentMeasures,
              preventiveMeasures: breach.preventiveMeasures
            },
            customMessage: customMessage
          };

          const result = await this.emailOrchestrator.queue({
            triggerEvent: 'BREACH_SUBJECT_NOTIFICATION',
            templateKey: 'individual_breach_notification',
            toEmail: email,
            organisationId: organisationId,
            resourceId: `${breachId}-${email}`,
            priority: 2, // High priority for subject notifications
            context
          });

          results.push({ email, result, success: true });
          console.log(`${this.LOG_PREFIX} Individual notification queued for: ${email}`);

        } catch (error) {
          console.error(`${this.LOG_PREFIX} Failed to queue notification for ${email}:`, error);
          results.push({ email, error: error.message, success: false });
        }
      }

      console.log(`${this.LOG_PREFIX} Individual notifications processed: ${results.filter(r => r.success).length}/${recipientEmails.length} successful`);
      return results;

    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to send individual notifications:`, error);
      throw error;
    }
  }

  /**
   * ICO HTML template using Handlebars syntax compatible with EmailOrchestrator
   */
  private getICOHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ICO Data Breach Notification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #d32f2f; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .urgent { background: #ffebee; border: 2px solid #d32f2f; padding: 15px; border-radius: 5px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .details-table th, .details-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    .details-table th { background-color: #f5f5f5; font-weight: bold; }
    .footer { background: #f5f5f5; padding: 20px; margin-top: 30px; font-size: 12px; }
    .compliance-note { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 URGENT: Data Breach Notification</h1>
    <p>Notification to Information Commissioner's Office (ICO)</p>
    <p>UK GDPR Article 33 Compliance</p>
  </div>
  
  <div class="content">
    <div class="urgent">
      <h2>⚠️ IMMEDIATE ATTENTION REQUIRED</h2>
      <p><strong>This is a mandatory notification under UK GDPR Article 33</strong></p>
      <p>Breach detected: {{formatDate breach.detectedAt 'long'}}</p>
      <p>Notification deadline: {{formatDate breach.notificationDeadline 'long'}}</p>
      <p>Breach reference: <strong>{{breach.reference}}</strong></p>
    </div>

    <div class="section">
      <h2>1. Data Controller Information</h2>
      <table class="details-table">
        <tr><th>Organisation Name</th><td>{{org.name}}</td></tr>
        <tr><th>Contact Email</th><td>{{admin.email}}</td></tr>
        <tr><th>Responsible Person</th><td>{{breach.responsible}}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>2. Breach Details</h2>
      <table class="details-table">
        <tr><th>Breach Title</th><td>{{breach.title}}</td></tr>
        <tr><th>Description</th><td>{{breach.description}}</td></tr>
        <tr><th>Date & Time Detected</th><td>{{formatDate breach.detectedAt 'long'}}</td></tr>
        <tr><th>Risk Level</th><td><strong>{{uppercase breach.severity}}</strong></td></tr>
        <tr><th>Affected Data Subjects</th><td><strong>{{breach.affectedSubjects}}</strong> individuals</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>3. Nature of the Breach</h2>
      <table class="details-table">
        <tr><th>Root Cause</th><td>{{breach.cause}}</td></tr>
        <tr><th>Impact Assessment</th><td>{{breach.impact}}</td></tr>
        <tr><th>Data Categories Affected</th><td>
          {{#each breach.dataCategories}}
            <li>{{this}}</li>
          {{/each}}
        </td></tr>
      </table>
    </div>

    <div class="section">
      <h2>4. Response Actions Taken</h2>
      <table class="details-table">
        <tr><th>Immediate Containment</th><td>{{breach.containmentMeasures}}</td></tr>
        <tr><th>Preventive Measures</th><td>{{breach.preventiveMeasures}}</td></tr>
      </table>
    </div>

    <div class="compliance-note">
      <h3>📋 Required ICO Actions</h3>
      <p>This notification is submitted in compliance with UK GDPR Article 33. We are available for any additional information required by the ICO.</p>
    </div>
  </div>
  
  <div class="footer">
    <p><strong>This notification is sent in compliance with UK GDPR Article 33</strong></p>
    <p>Generated: {{formatDate 'now' 'long'}}</p>
    <p>Reference: {{breach.reference}}</p>
    <p>Organisation: {{org.name}}</p>
  </div>
</body>
</html>`;
  }

  /**
   * ICO text template for plain text notifications
   */
  private getICOTextTemplate(): string {
    return `
URGENT: Data Breach Notification to ICO
UK GDPR Article 33 Compliance

Reference: {{breach.reference}}
Date: {{formatDate 'now'}}

ORGANISATION DETAILS:
- Name: {{org.name}}
- Contact: {{admin.email}}

BREACH DETAILS:
- Title: {{breach.title}}
- Detected: {{formatDate breach.detectedAt}}
- Severity: {{uppercase breach.severity}}
- Affected Subjects: {{breach.affectedSubjects}}
- Notification Deadline: {{formatDate breach.notificationDeadline}}

DESCRIPTION:
{{breach.description}}

CAUSE:
{{breach.cause}}

IMPACT ASSESSMENT:
{{breach.impact}}

RESPONSE ACTIONS:
Containment: {{breach.containmentMeasures}}
Prevention: {{breach.preventiveMeasures}}
Responsible: {{breach.responsible}}

This notification is submitted under UK GDPR Article 33. Please confirm receipt.

{{org.name}}
{{admin.email}}`;
  }

  /**
   * Individual notification HTML template
   */
  private getIndividualHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Data Security Incident Notification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .important { background: #fff3e0; border: 2px solid #ff9800; padding: 15px; border-radius: 5px; }
    .actions { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .contact-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .footer { background: #f5f5f5; padding: 15px; margin-top: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔒 Important Security Notice</h1>
    <p>{{org.displayName}}</p>
  </div>
  
  <div class="content">
    {{#if user.firstName}}
    <p>Dear {{user.firstName}},</p>
    {{else}}
    <p>Dear Valued Customer,</p>
    {{/if}}
    
    <div class="important">
      <h2>⚠️ What Happened</h2>
      <p>We are writing to inform you about a data security incident that may have affected some of your personal information.</p>
    </div>

    <div class="section">
      <h2>📋 Incident Details</h2>
      <p><strong>What happened:</strong> {{breach.description}}</p>
      <p><strong>When we discovered it:</strong> {{formatDate breach.detectedAt}}</p>
      <p><strong>What information was involved:</strong></p>
      <ul>
        {{#each breach.dataCategories}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>

    <div class="section">
      <h2>🛡️ What We're Doing</h2>
      <p><strong>Containment measures:</strong> {{breach.containmentMeasures}}</p>
      <p><strong>Preventive measures:</strong> {{breach.preventiveMeasures}}</p>
      <p>We have also notified the Information Commissioner's Office (ICO) as required by law.</p>
    </div>

    {{#if customMessage}}
    <div class="actions">
      <h2>📝 Additional Information</h2>
      <p>{{customMessage}}</p>
    </div>
    {{/if}}

    <div class="actions">
      <h2>🔧 What You Should Do</h2>
      <ul>
        <li><strong>Monitor your accounts:</strong> Check for unusual activity</li>
        <li><strong>Change passwords:</strong> If you think your credentials may be affected</li>
        <li><strong>Stay alert:</strong> Be cautious of unexpected communications</li>
        <li><strong>Contact us:</strong> If you have any concerns or questions</li>
      </ul>
    </div>

    <div class="contact-box">
      <h2>📞 Contact Us</h2>
      <p>If you have questions about this incident:</p>
      <p><strong>Email:</strong> {{admin.email}}</p>
      <p><strong>Organisation:</strong> {{org.name}}</p>
    </div>

    <div class="section">
      <h2>🏛️ Your Rights</h2>
      <p>You have rights under UK data protection law, including the right to complain to the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk">ico.org.uk</a></p>
    </div>

    <p>We sincerely apologize for this incident and any inconvenience it may cause.</p>
    <p>Sincerely,<br>{{org.name}}<br>Data Protection Team</p>
  </div>
  
  <div class="footer">
    <p><strong>This notification is sent in compliance with UK GDPR Article 34</strong></p>
    <p>Date: {{formatDate 'now'}}</p>
  </div>
</body>
</html>`;
  }

  /**
   * Individual notification text template
   */
  private getIndividualTextTemplate(): string {
    return `
IMPORTANT: Data Security Incident Notification

{{#if user.firstName}}
Dear {{user.firstName}},
{{else}}
Dear Valued Customer,
{{/if}}

We are writing to inform you about a data security incident that may have affected some of your personal information.

WHAT HAPPENED:
{{breach.description}}

WHEN WE DISCOVERED IT:
{{formatDate breach.detectedAt}}

INFORMATION INVOLVED:
{{#each breach.dataCategories}}
- {{this}}
{{/each}}

WHAT WE'RE DOING:
- Containment: {{breach.containmentMeasures}}
- Prevention: {{breach.preventiveMeasures}}
- We have notified the ICO as required by law

{{#if customMessage}}
ADDITIONAL INFORMATION:
{{customMessage}}
{{/if}}

WHAT YOU SHOULD DO:
1. Monitor your accounts for unusual activity
2. Change passwords if affected
3. Stay alert for suspicious communications
4. Contact us with any concerns

CONTACT US:
Email: {{admin.email}}
Organisation: {{org.name}}

YOUR RIGHTS:
You can complain to the ICO (ico.org.uk) and may be entitled to compensation.

We sincerely apologize for this incident.

{{org.name}}
Data Protection Team

---
This notification is sent under UK GDPR Article 34
Date: {{formatDate 'now'}}`;
  }
}

// Export singleton instance
export const breachNotificationService = new BreachNotificationService();