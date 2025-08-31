import { storage } from "../storage";
import type { User, Course, Completion, Organisation, CertificateTemplate } from "@shared/schema";

export interface CertificateData {
  userName: string;
  userEmail: string;
  courseName: string;
  courseId: string;
  organisationName: string;
  adminName: string;
  scorePercent: string;
  passFailStatus: string;
  dateCompleted: string;
  certificateId: string;
}

export class CertificateService {
  private readonly placeholders = [
    '{{USERNAME}}',
    '{{USER_EMAIL}}',
    '{{COURSE_NAME}}',
    '{{COURSE_ID}}',
    '{{ORGANISATION_NAME}}',
    '{{ADMIN_NAME}}',
    '{{SCORE_PERCENT}}',
    '{{PASS_FAIL}}',
    '{{DATE_COMPLETED}}',
    '{{CERTIFICATE_ID}}'
  ];

  async generateCertificate(
    completion: Completion,
    user: User,
    course: Course,
    organisation: Organisation
  ): Promise<string> {
    try {
      // Get certificate template
      const template = await this.getCertificateTemplate(organisation.id);
      
      // Generate certificate data
      const certificateData = await this.prepareCertificateData(completion, user, course, organisation);
      
      // Generate HTML content based on template format
      let html: string;
      if (template.templateFormat === 'visual' && template.templateData) {
        html = this.generateHTMLFromVisualTemplate(template.templateData, certificateData);
      } else {
        // Legacy HTML template
        html = this.replacePlaceholders(template.template, certificateData);
      }
      
      // In a real implementation, this would:
      // 1. Convert HTML to PDF using a library like puppeteer
      // 2. Upload PDF to object storage
      // 3. Return the URL to the PDF
      
      console.log(`📜 Generated certificate for ${user.email} - Course: ${course.title}`);
      
      // For demo, return a simulated URL
      return `/certificates/${completion.id}.pdf`;
    } catch (error) {
      console.error('Error generating certificate:', error);
      throw new Error('Failed to generate certificate');
    }
  }

  private async getCertificateTemplate(organisationId: string): Promise<CertificateTemplate> {
    // Try to get organisation-specific template first
    const orgTemplates = await storage.getCertificateTemplates();
    const orgTemplate = orgTemplates.find(t => t.organisationId === organisationId);
    
    if (orgTemplate) {
      return orgTemplate;
    }

    // Fall back to default template
    const defaultTemplate = await storage.getDefaultCertificateTemplate();
    
    if (defaultTemplate) {
      return defaultTemplate;
    }

    // Create a basic default template if none exists
    return {
      id: 'default',
      name: 'Default Template',
      template: this.getDefaultTemplate(),
      templateFormat: 'html',
      templateData: null,
      isDefault: true,
      organisationId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async prepareCertificateData(
    completion: Completion,
    user: User,
    course: Course,
    organisation: Organisation
  ): Promise<CertificateData> {
    // Get admin name (first admin user of the organisation)
    const admins = await storage.getUsersWithFilters({
      role: 'admin',
      organisationId: organisation.id
    });
    const adminName = admins.length > 0 ? `${admins[0].firstName} ${admins[0].lastName}` : 'Administrator';

    return {
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email || '',
      courseName: course.title,
      courseId: course.id,
      organisationName: organisation.displayName,
      adminName,
      scorePercent: completion.score ? `${completion.score}%` : 'N/A',
      passFailStatus: completion.status.toUpperCase(),
      dateCompleted: completion.completedAt?.toLocaleDateString() || new Date().toLocaleDateString(),
      certificateId: `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    };
  }

  private replacePlaceholders(template: string, data: CertificateData): string {
    let result = template;
    
    result = result.replace(/{{USERNAME}}/g, data.userName);
    result = result.replace(/{{USER_EMAIL}}/g, data.userEmail);
    result = result.replace(/{{COURSE_NAME}}/g, data.courseName);
    result = result.replace(/{{COURSE_ID}}/g, data.courseId);
    result = result.replace(/{{ORGANISATION_NAME}}/g, data.organisationName);
    result = result.replace(/{{ADMIN_NAME}}/g, data.adminName);
    result = result.replace(/{{SCORE_PERCENT}}/g, data.scorePercent);
    result = result.replace(/{{PASS_FAIL}}/g, data.passFailStatus);
    result = result.replace(/{{DATE_COMPLETED}}/g, data.dateCompleted);
    result = result.replace(/{{CERTIFICATE_ID}}/g, data.certificateId);
    
    return result;
  }

  // Convert visual template to HTML
  private generateHTMLFromVisualTemplate(templateData: any, data: CertificateData): string {
    const elements = templateData.elements || [];
    
    const elementHTML = elements.map((element: any) => {
      // Replace placeholders in element text
      const textWithData = this.replacePlaceholders(element.text, data);
      
      return `
        <div style="
          position: absolute;
          left: ${element.x}px;
          top: ${element.y}px;
          width: ${element.width}px;
          height: ${element.height}px;
          font-size: ${element.fontSize}px;
          font-family: ${element.fontFamily};
          font-weight: ${element.fontWeight};
          color: ${element.color};
          text-align: ${element.textAlign};
          line-height: ${element.lineHeight};
          padding: 4px;
          overflow: hidden;
        ">${textWithData}</div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Certificate</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .certificate-container {
            position: relative;
            width: ${templateData.width}px;
            height: ${templateData.height}px;
            background-color: ${templateData.backgroundColor};
            ${templateData.backgroundImage ? `background-image: url(${templateData.backgroundImage}); background-size: cover; background-position: center;` : ''}
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          ${elementHTML}
        </div>
      </body>
      </html>
    `;
  }

  private getDefaultTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Certificate of Completion</title>
        <style>
          body {
            font-family: 'Georgia', serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .certificate {
            background: white;
            width: 800px;
            padding: 60px;
            text-align: center;
            border: 8px solid #667eea;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .header {
            font-size: 48px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 24px;
            color: #666;
            margin-bottom: 40px;
          }
          .content {
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 40px;
          }
          .name {
            font-size: 36px;
            font-weight: bold;
            color: #333;
            margin: 20px 0;
            text-decoration: underline;
            text-decoration-color: #667eea;
          }
          .course {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin: 20px 0;
          }
          .details {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            font-size: 14px;
            color: #666;
          }
          .seal {
            width: 80px;
            height: 80px;
            border: 3px solid #667eea;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #667eea;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">CERTIFICATE</div>
          <div class="subtitle">OF COMPLETION</div>
          
          <div class="content">
            This is to certify that
          </div>
          
          <div class="name">{{USERNAME}}</div>
          
          <div class="content">
            {{ORGANISATION_NAME}} {{CERTIFICATE_TEXT}}
          </div>
          
          <div class="course">{{COURSE_NAME}}</div>
          
          <div class="content">
            with a score of <strong>{{SCORE_PERCENT}}</strong> ({{PASS_FAIL}})
          </div>
          
          <div class="seal">
            <div>CERTIFIED</div>
          </div>
          
          <div class="details">
            <div>
              <strong>Date:</strong> {{DATE_COMPLETED}}<br>
              <strong>Certificate ID:</strong> {{CERTIFICATE_ID}}
            </div>
            <div>
              <strong>Authorised by:</strong><br>
              {{ADMIN_NAME}}<br>
              {{ORGANISATION_NAME}}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAvailablePlaceholders(): string[] {
    return [...this.placeholders];
  }

  async createTemplate(name: string, template: string, organisationId?: string): Promise<CertificateTemplate> {
    return await storage.createCertificateTemplate({
      name,
      template,
      organisationId: organisationId || null,
      isDefault: false
    });
  }

  async updateTemplate(id: string, template: Partial<{ name: string; template: string }>): Promise<CertificateTemplate> {
    return await storage.updateCertificateTemplate(id, template);
  }
}

export const certificateService = new CertificateService();
