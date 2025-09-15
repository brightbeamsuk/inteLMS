/**
 * GDPR Breach Notification Email Templates
 * Articles 33 & 34 Compliance - ICO and Individual Notifications
 */

import { type DataBreach } from '@shared/schema';

export interface BreachNotificationContext {
  breach: DataBreach;
  organisation: {
    name: string;
    contactEmail: string;
    contactPhone?: string;
    dpoName?: string;
    dpoEmail?: string;
  };
  recipient: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  notificationDate: Date;
  references: {
    breachReference: string;
    legalBasis: string[];
    complianceUrl?: string;
  };
}

/**
 * ICO Breach Notification Template (Article 33)
 * For notifications to supervisory authority within 72 hours
 */
export const generateICONotificationEmail = (context: BreachNotificationContext): {
  subject: string;
  htmlContent: string;
  textContent: string;
} => {
  const { breach, organisation, notificationDate, references } = context;
  
  const subject = `URGENT: Data Breach Notification - ${breach.title} (Ref: ${references.breachReference})`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ICO Data Breach Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #d32f2f; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .section { margin-bottom: 20px; }
        .urgent { background: #ffebee; border: 2px solid #d32f2f; padding: 15px; border-radius: 5px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .details-table th, .details-table td { 
          border: 1px solid #ddd; 
          padding: 12px; 
          text-align: left; 
        }
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
          <p>Breach detected: ${new Date(breach.detectedAt).toLocaleString('en-GB')}</p>
          <p>Notification deadline: ${new Date(breach.notificationDeadline).toLocaleString('en-GB')}</p>
          <p>Breach reference: <strong>${references.breachReference}</strong></p>
        </div>

        <div class="section">
          <h2>1. Data Controller Information</h2>
          <table class="details-table">
            <tr>
              <th>Organisation Name</th>
              <td>${organisation.name}</td>
            </tr>
            <tr>
              <th>Contact Email</th>
              <td>${organisation.contactEmail}</td>
            </tr>
            ${organisation.contactPhone ? `
            <tr>
              <th>Contact Phone</th>
              <td>${organisation.contactPhone}</td>
            </tr>
            ` : ''}
            ${organisation.dpoName ? `
            <tr>
              <th>Data Protection Officer</th>
              <td>${organisation.dpoName} (${organisation.dpoEmail})</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div class="section">
          <h2>2. Breach Details</h2>
          <table class="details-table">
            <tr>
              <th>Breach Title</th>
              <td>${breach.title}</td>
            </tr>
            <tr>
              <th>Description</th>
              <td>${breach.description}</td>
            </tr>
            <tr>
              <th>Breach Type/Category</th>
              <td>
                ${Array.isArray(breach.dataCategories) ? breach.dataCategories.join(', ') : breach.dataCategories || 'Not specified'}
              </td>
            </tr>
            <tr>
              <th>Date & Time Detected</th>
              <td>${new Date(breach.detectedAt).toLocaleString('en-GB')}</td>
            </tr>
            <tr>
              <th>Risk Level</th>
              <td>
                <span style="background: ${getSeverityColor(breach.severity)}; padding: 3px 8px; border-radius: 3px; color: white; font-weight: bold;">
                  ${breach.severity.toUpperCase()}
                </span>
              </td>
            </tr>
            <tr>
              <th>Affected Data Subjects</th>
              <td><strong>${breach.affectedSubjects.toLocaleString()}</strong> individuals</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>3. Nature of the Breach</h2>
          <table class="details-table">
            <tr>
              <th>Root Cause</th>
              <td>${breach.cause}</td>
            </tr>
            <tr>
              <th>Impact Assessment</th>
              <td>${breach.impact}</td>
            </tr>
            <tr>
              <th>Data Categories Affected</th>
              <td>
                <ul>
                  ${Array.isArray(breach.dataCategories) 
                    ? breach.dataCategories.map(cat => `<li>${cat}</li>`).join('')
                    : `<li>${breach.dataCategories || 'Not specified'}</li>`
                  }
                </ul>
              </td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>4. Response Actions Taken</h2>
          <table class="details-table">
            <tr>
              <th>Immediate Containment</th>
              <td>${breach.containmentMeasures}</td>
            </tr>
            <tr>
              <th>Preventive Measures</th>
              <td>${breach.preventiveMeasures}</td>
            </tr>
            <tr>
              <th>Responsible Person</th>
              <td>${breach.responsible}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>5. Individual Notification Status</h2>
          <div class="compliance-note">
            <p><strong>Article 34 Assessment:</strong></p>
            <p>Individual notification required: <strong>${isHighRiskBreach(breach.severity) ? 'YES' : 'NO'}</strong></p>
            ${isHighRiskBreach(breach.severity) ? `
              <p>Reason: High risk breach likely to result in significant adverse effects on affected individuals.</p>
              <p>Notification method: Direct communication to affected data subjects</p>
              <p>Notification timeline: Without undue delay</p>
            ` : `
              <p>Reason: Risk assessment indicates unlikely to result in significant adverse effects.</p>
            `}
          </div>
        </div>

        <div class="section">
          <h2>6. Legal Compliance</h2>
          <ul>
            <li><strong>UK GDPR Article 33</strong> - Notification of personal data breach to supervisory authority</li>
            <li><strong>UK GDPR Article 34</strong> - Communication of personal data breach to data subject</li>
            <li><strong>Data Protection Act 2018</strong> - UK implementation</li>
            <li><strong>ICO Guidance</strong> - Personal data breaches</li>
          </ul>
        </div>

        <div class="compliance-note">
          <h3>📋 Required ICO Actions</h3>
          <p>This notification is submitted in compliance with UK GDPR Article 33. We are available for any additional information or clarification required by the ICO.</p>
          <p><strong>Next steps:</strong></p>
          <ul>
            <li>Monitor breach resolution progress</li>
            <li>Provide updates if circumstances change</li>
            <li>Respond to any ICO inquiries promptly</li>
            <li>Document lessons learned and process improvements</li>
          </ul>
        </div>
      </div>
      
      <div class="footer">
        <p><strong>This notification is sent in compliance with UK GDPR Article 33</strong></p>
        <p>Generated: ${notificationDate.toLocaleString('en-GB')}</p>
        <p>Reference: ${references.breachReference}</p>
        <p>Organisation: ${organisation.name}</p>
        <p><em>This email contains confidential information intended solely for the ICO.</em></p>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
URGENT: Data Breach Notification to ICO
UK GDPR Article 33 Compliance

Reference: ${references.breachReference}
Date: ${notificationDate.toLocaleDateString('en-GB')}

ORGANISATION DETAILS:
- Name: ${organisation.name}
- Contact: ${organisation.contactEmail}
${organisation.dpoName ? `- DPO: ${organisation.dpoName} (${organisation.dpoEmail})` : ''}

BREACH DETAILS:
- Title: ${breach.title}
- Detected: ${new Date(breach.detectedAt).toLocaleString('en-GB')}
- Severity: ${breach.severity.toUpperCase()}
- Affected Subjects: ${breach.affectedSubjects.toLocaleString()}
- Notification Deadline: ${new Date(breach.notificationDeadline).toLocaleString('en-GB')}

DESCRIPTION:
${breach.description}

CAUSE:
${breach.cause}

IMPACT ASSESSMENT:
${breach.impact}

RESPONSE ACTIONS:
Containment: ${breach.containmentMeasures}
Prevention: ${breach.preventiveMeasures}
Responsible: ${breach.responsible}

INDIVIDUAL NOTIFICATION:
Required: ${isHighRiskBreach(breach.severity) ? 'YES' : 'NO'}

This notification is submitted under UK GDPR Article 33. Please confirm receipt.

${organisation.name}
${organisation.contactEmail}
  `;

  return {
    subject,
    htmlContent,
    textContent
  };
};

/**
 * Individual Breach Notification Template (Article 34)
 * For high-risk breaches affecting data subjects
 */
export const generateIndividualNotificationEmail = (context: BreachNotificationContext): {
  subject: string;
  htmlContent: string;
  textContent: string;
} => {
  const { breach, organisation, recipient, notificationDate, references } = context;
  
  const subject = `Important: Data Security Incident Affecting Your Personal Information`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Data Security Incident Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .section { margin-bottom: 20px; }
        .important { background: #fff3e0; border: 2px solid #ff9800; padding: 15px; border-radius: 5px; }
        .actions { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .contact-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
        ul { padding-left: 20px; }
        .footer { background: #f5f5f5; padding: 15px; margin-top: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔒 Important Security Notice</h1>
        <p>${organisation.name}</p>
      </div>
      
      <div class="content">
        ${recipient.firstName ? `<p>Dear ${recipient.firstName},</p>` : '<p>Dear Valued Customer,</p>'}
        
        <div class="important">
          <h2>⚠️ What Happened</h2>
          <p>We are writing to inform you about a data security incident that may have affected some of your personal information. We take the protection of your data very seriously and want to make you aware of what happened and what we are doing about it.</p>
        </div>

        <div class="section">
          <h2>📋 Incident Details</h2>
          <p><strong>What happened:</strong> ${breach.description}</p>
          <p><strong>When we discovered it:</strong> ${new Date(breach.detectedAt).toLocaleDateString('en-GB')}</p>
          <p><strong>What information was involved:</strong></p>
          <ul>
            ${Array.isArray(breach.dataCategories) 
              ? breach.dataCategories.map(cat => `<li>${cat}</li>`).join('')
              : `<li>${breach.dataCategories || 'Personal information'}</li>`
            }
          </ul>
        </div>

        <div class="section">
          <h2>🛡️ What We're Doing</h2>
          <p>We have taken immediate action to address this incident:</p>
          <p><strong>Containment measures:</strong> ${breach.containmentMeasures}</p>
          <p><strong>Preventive measures:</strong> ${breach.preventiveMeasures}</p>
          <p>We have also notified the Information Commissioner's Office (ICO) as required by law.</p>
        </div>

        <div class="actions">
          <h2>🔧 What You Should Do</h2>
          <p>While we have taken steps to secure your information, we recommend you take the following precautions:</p>
          <ul>
            <li><strong>Monitor your accounts:</strong> Check your financial accounts and credit reports for any unusual activity</li>
            <li><strong>Change passwords:</strong> If you think your login credentials may have been affected, change your passwords</li>
            <li><strong>Stay alert:</strong> Be cautious of unexpected emails, calls, or messages asking for personal information</li>
            <li><strong>Consider fraud alerts:</strong> You may want to place fraud alerts on your credit files</li>
            <li><strong>Contact us:</strong> If you have any concerns or questions, please don't hesitate to reach out</li>
          </ul>
        </div>

        <div class="section">
          <h2>🔍 Risk Assessment</h2>
          <p>Based on our investigation, we believe the risk to you is <strong>${getRiskDescription(breach.severity)}</strong>. ${getRiskExplanation(breach.severity)}</p>
        </div>

        <div class="contact-box">
          <h2>📞 Contact Us</h2>
          <p>If you have questions about this incident or need assistance, please contact us:</p>
          <ul>
            <li><strong>Email:</strong> ${organisation.contactEmail}</li>
            ${organisation.contactPhone ? `<li><strong>Phone:</strong> ${organisation.contactPhone}</li>` : ''}
            ${organisation.dpoEmail ? `<li><strong>Data Protection Officer:</strong> ${organisation.dpoEmail}</li>` : ''}
          </ul>
          <p><strong>Reference number:</strong> ${references.breachReference}</p>
        </div>

        <div class="section">
          <h2>🏛️ Your Rights</h2>
          <p>You have rights under UK data protection law, including:</p>
          <ul>
            <li>The right to complain to the Information Commissioner's Office (ICO)</li>
            <li>The right to compensation if you have suffered damages</li>
            <li>The right to access information about how your data is processed</li>
          </ul>
          <p>For more information about your rights, visit <a href="https://ico.org.uk">ico.org.uk</a></p>
        </div>

        <p>We sincerely apologize for this incident and any inconvenience it may cause. Protecting your personal information is a responsibility we take very seriously, and we are committed to doing better.</p>
        
        <p>Thank you for your patience as we work through this matter.</p>
        
        <p>Sincerely,<br>
        ${organisation.name}<br>
        Data Protection Team</p>
      </div>
      
      <div class="footer">
        <p><strong>This notification is sent in compliance with UK GDPR Article 34</strong></p>
        <p>Date: ${notificationDate.toLocaleDateString('en-GB')}</p>
        <p>Reference: ${references.breachReference}</p>
        <p><em>Please keep this notification for your records</em></p>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
IMPORTANT: Data Security Incident Notification

${recipient.firstName ? `Dear ${recipient.firstName},` : 'Dear Valued Customer,'}

We are writing to inform you about a data security incident that may have affected some of your personal information.

WHAT HAPPENED:
${breach.description}

WHEN WE DISCOVERED IT:
${new Date(breach.detectedAt).toLocaleDateString('en-GB')}

INFORMATION INVOLVED:
${Array.isArray(breach.dataCategories) 
  ? breach.dataCategories.join('\n- ')
  : breach.dataCategories || 'Personal information'
}

WHAT WE'RE DOING:
- Containment: ${breach.containmentMeasures}
- Prevention: ${breach.preventiveMeasures}
- We have notified the ICO as required by law

WHAT YOU SHOULD DO:
1. Monitor your accounts for unusual activity
2. Change passwords if affected
3. Stay alert for suspicious communications
4. Consider fraud alerts on credit files
5. Contact us with any concerns

RISK ASSESSMENT:
The risk to you is ${getRiskDescription(breach.severity)}. ${getRiskExplanation(breach.severity)}

CONTACT US:
Email: ${organisation.contactEmail}
${organisation.contactPhone ? `Phone: ${organisation.contactPhone}` : ''}
Reference: ${references.breachReference}

YOUR RIGHTS:
You can complain to the ICO (ico.org.uk) and may be entitled to compensation.

We sincerely apologize for this incident. Protecting your information is our priority.

${organisation.name}
Data Protection Team

---
This notification is sent under UK GDPR Article 34
Date: ${notificationDate.toLocaleDateString('en-GB')}
  `;

  return {
    subject,
    htmlContent,
    textContent
  };
};

// Helper functions
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'low': return '#2196f3';
    case 'medium': return '#ff9800';
    case 'high': return '#ff5722';
    case 'critical': return '#d32f2f';
    default: return '#666';
  }
}

function isHighRiskBreach(severity: string): boolean {
  return ['high', 'critical'].includes(severity);
}

function getRiskDescription(severity: string): string {
  switch (severity) {
    case 'low': return 'low';
    case 'medium': return 'moderate';
    case 'high': return 'high';
    case 'critical': return 'very high';
    default: return 'to be assessed';
  }
}

function getRiskExplanation(severity: string): string {
  switch (severity) {
    case 'low': 
      return 'While this incident occurred, our assessment indicates minimal likelihood of adverse effects.';
    case 'medium': 
      return 'We are taking precautionary measures and recommend following the suggested actions.';
    case 'high': 
      return 'We strongly recommend taking the suggested precautionary measures immediately.';
    case 'critical': 
      return 'This is a high-risk incident. Please take all recommended actions immediately and contact us if you notice any suspicious activity.';
    default: 
      return 'We are continuing to assess the risk and will provide updates as needed.';
  }
}

/**
 * Generate breach notification reference
 */
export function generateBreachReference(breach: DataBreach, organisation: string): string {
  const date = new Date(breach.detectedAt).toISOString().slice(0, 10).replace(/-/g, '');
  const orgCode = organisation.substring(0, 3).toUpperCase();
  const breachCode = breach.id.substring(0, 8).toUpperCase();
  return `BR-${orgCode}-${date}-${breachCode}`;
}