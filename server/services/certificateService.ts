import { storage } from "../storage";
import { ObjectStorageService } from "../objectStorage";
import { ObjectPermission, ObjectAclPolicy } from "../objectAcl";
import puppeteer from "puppeteer";
import { randomUUID } from "crypto";
import { PDFDocument, rgb } from "pdf-lib";
import fs from "fs/promises";
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
      
      let pdfBuffer: Buffer;
      
      if (template.templateFormat === 'pdf' && template.pdfTemplateUrl) {
        // Use PDF template with placeholder replacement
        pdfBuffer = await this.generatePdfFromTemplate(template.pdfTemplateUrl, certificateData);
      } else {
        // Generate HTML content based on template format
        let html: string;
        if (template.templateFormat === 'visual' && template.templateData) {
          html = this.generateHTMLFromVisualTemplate(template.templateData, certificateData);
        } else {
          // Legacy HTML template
          html = this.replacePlaceholders(template.template || this.getDefaultTemplate(), certificateData);
        }
        
        // Generate PDF from HTML
        pdfBuffer = await this.htmlToPdf(html);
      }
      
      // Upload to object storage
      const certificateUrl = await this.uploadCertificateToStorage(pdfBuffer, certificateData.certificateId, user.id, user.organisationId!);
      
      console.log(`📜 Generated certificate for ${user.email} - Course: ${course.title} - URL: ${certificateUrl}`);
      
      return certificateUrl;
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

  // Generate PDF from PDF template with placeholder replacement
  private async generatePdfFromTemplate(templateUrl: string, data: CertificateData): Promise<Buffer> {
    try {
      // Download the PDF template
      const templateBuffer = await this.downloadPdfTemplate(templateUrl);
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(templateBuffer);
      
      // Get all pages
      const pages = pdfDoc.getPages();
      
      // Map user placeholders to our certificate data
      const placeholderMap: Record<string, string> = {
        '{{learner_name}}': data.userName,
        '{{course_name}}': data.courseName,
        '{{completion_date}}': data.dateCompleted,
        // Also support the original system placeholders for backward compatibility
        '{{USERNAME}}': data.userName,
        '{{USER_EMAIL}}': data.userEmail,
        '{{COURSE_NAME}}': data.courseName,
        '{{COURSE_ID}}': data.courseId,
        '{{ORGANISATION_NAME}}': data.organisationName,
        '{{ADMIN_NAME}}': data.adminName,
        '{{SCORE_PERCENT}}': data.scorePercent,
        '{{PASS_FAIL}}': data.passFailStatus,
        '{{DATE_COMPLETED}}': data.dateCompleted,
        '{{CERTIFICATE_ID}}': data.certificateId
      };

      // Check if the PDF has form fields we can fill (best approach)
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      if (fields.length > 0) {
        // The PDF has form fields - fill them with our data
        console.log(`📝 Found ${fields.length} form fields in PDF template`);
        
        fields.forEach(field => {
          const fieldName = field.getName();
          console.log(`🔍 Processing form field: ${fieldName}`);
          
          let value = '';
          
          // Map form field names to our certificate data
          // Support both direct field names and placeholder format
          if (fieldName === 'learner_name' || fieldName === 'userName' || fieldName === 'user_name') {
            value = data.userName;
          }
          else if (fieldName === 'course_name' || fieldName === 'courseName') {
            value = data.courseName;
          }
          else if (fieldName === 'completion_date' || fieldName === 'completionDate' || fieldName === 'date_completed') {
            value = data.dateCompleted;
          }
          else if (fieldName === 'organisation_name' || fieldName === 'organizationName') {
            value = data.organisationName;
          }
          else if (fieldName === 'score_percent' || fieldName === 'scorePercent') {
            value = data.scorePercent;
          }
          else if (fieldName === 'certificate_id' || fieldName === 'certificateId') {
            value = data.certificateId;
          }
          else if (fieldName === 'admin_name' || fieldName === 'adminName') {
            value = data.adminName;
          }
          else if (fieldName === 'pass_fail' || fieldName === 'passFailStatus') {
            value = data.passFailStatus;
          }
          else if (fieldName === 'user_email' || fieldName === 'userEmail') {
            value = data.userEmail;
          }
          else if (fieldName === 'course_id' || fieldName === 'courseId') {
            value = data.courseId;
          }
          
          if (value) {
            try {
              // Try to fill as text field first
              const textField = form.getTextField(fieldName);
              textField.setText(value);
              console.log(`✅ Filled text field '${fieldName}' with: ${value}`);
            } catch (textError) {
              try {
                // If not a text field, try other field types
                console.log(`⚠️  Field '${fieldName}' is not a text field, trying other types...`);
              } catch (error) {
                console.log(`❌ Could not fill field '${fieldName}':`, error.message);
              }
            }
          } else {
            console.log(`❌ No matching data found for form field: ${fieldName}`);
          }
        });
        
        // Flatten the form to make fields non-editable and preserve formatting
        form.flatten();
        console.log('✅ Form fields filled and flattened successfully');
        
      } else {
        console.log('📄 No form fields found in PDF template');
        console.log('💡 For best results, create fillable form fields in your PDF template with names like:');
        console.log('   - learner_name, course_name, completion_date, organisation_name, etc.');
        
        // Fallback: Use text overlay approach with better positioning
        // This is less ideal but works when PDF doesn't have form fields
        const pages = pdfDoc.getPages();
        
        for (const page of pages) {
          const { width, height } = page.getSize();
          const fontSize = 16;
          
          console.log('⚠️  Using text overlay fallback - positioning may not match your template design');
          
          // Add text overlays - users should ideally create form fields for proper alignment
          if (data.userName) {
            page.drawText(data.userName, {
              x: 100, // Adjust based on your template
              y: height - 200, 
              size: fontSize,
              color: rgb(0, 0, 0),
            });
          }
          
          if (data.courseName) {
            page.drawText(data.courseName, {
              x: 100,
              y: height - 250,
              size: fontSize - 2,
              color: rgb(0, 0, 0),
            });
          }
          
          if (data.dateCompleted) {
            page.drawText(data.dateCompleted, {
              x: 100,
              y: height - 300,
              size: fontSize - 4,
              color: rgb(0, 0, 0),
            });
          }
        }
      }
      
      // Serialize the PDF
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
      
    } catch (error) {
      console.error('Error processing PDF template:', error);
      throw new Error('Failed to process PDF template');
    }
  }

  private async downloadPdfTemplate(templateUrl: string): Promise<Buffer> {
    try {
      // If it's an object storage path (starts with /objects/), use ObjectStorageService
      if (templateUrl.startsWith('/objects/')) {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(templateUrl);
        const stream = objectFile.createReadStream();
        
        // Convert stream to buffer
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      }
      
      // If it's a local file path, read from filesystem
      if (templateUrl.startsWith('/') || templateUrl.startsWith('./')) {
        return await fs.readFile(templateUrl);
      }
      
      // If it's a URL, fetch it
      const response = await fetch(templateUrl);
      if (!response.ok) {
        throw new Error(`Failed to download PDF template: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error downloading PDF template:', error);
      throw new Error('Failed to download PDF template');
    }
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

  private async htmlToPdf(html: string): Promise<Buffer> {
    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-extensions'
        ]
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      return Buffer.from(pdf);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF from HTML');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async uploadCertificateToStorage(pdfBuffer: Buffer, certificateId: string, userId: string, organisationId: string): Promise<string> {
    try {
      const objectStorageService = new ObjectStorageService();
      
      // Generate unique filename
      const filename = `${certificateId}-${Date.now()}.pdf`;
      
      // Get private object directory for certificates
      const privateDir = objectStorageService.getPrivateObjectDir();
      const certificatePath = `${privateDir}/certificates/${filename}`;
      
      // Parse the path to get bucket and object names
      const pathParts = certificatePath.split('/');
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join('/');
      
      // Upload to object storage using signed URL approach
      const signedUrl = await this.getSignedUploadUrl(bucketName, objectName);
      
      // Upload the PDF buffer
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: pdfBuffer,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': pdfBuffer.length.toString()
        }
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      // Set ACL policy for the certificate file - simplified approach
      const aclPolicy: ObjectAclPolicy = {
        owner: userId, // The certificate owner (user)
        visibility: "private" // Private file, access controlled via API authorization
      };
      
      // Apply the ACL policy to the uploaded file
      await objectStorageService.trySetObjectEntityAclPolicy(`/objects/certificates/${filename}`, aclPolicy);
      
      // Return the public URL for the certificate
      return `/objects/certificates/${filename}`;
      
    } catch (error) {
      console.error('Error uploading certificate to storage:', error);
      throw new Error('Failed to upload certificate to storage');
    }
  }

  private async getSignedUploadUrl(bucketName: string, objectName: string): Promise<string> {
    const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
    
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: 'PUT',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    };
    
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.status}`);
    }
    
    const { signed_url } = await response.json();
    return signed_url;
  }
}

export const certificateService = new CertificateService();
