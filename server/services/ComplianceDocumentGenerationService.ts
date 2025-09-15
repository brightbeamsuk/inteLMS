/**
 * Compliance Document Generation Service
 * Auto-generates legal documents for GDPR regulatory compliance
 * UK GDPR and Data Protection Act 2018 compliance
 */

import type { Organisation, PrivacySettings, ProcessingActivity, ComplianceDocument, ComplianceDocumentTemplate } from "@shared/schema";
import { storage } from "../storage";
import { gdprConfig, isGdprFeatureEnabled } from "../config/gdpr";

export interface DocumentGenerationContext {
  organisation: Organisation;
  privacySettings?: PrivacySettings;
  processingActivities: ProcessingActivity[];
  dpoContact?: {
    name?: string;
    email?: string;
  };
  privacyContact?: string;
  companyAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface GeneratedDocumentContent {
  title: string;
  content: string;
  htmlContent: string;
  plainTextContent: string;
  wordCount: number;
  readingTime: number;
  regulatoryRequirements: string[];
  applicableLaws: string[];
}

export class ComplianceDocumentGenerationService {
  
  /**
   * Generate a compliance document based on type and organization context
   */
  async generateDocument(
    documentType: string,
    organisationId: string,
    templateId?: string
  ): Promise<GeneratedDocumentContent> {
    
    // Check GDPR feature flag
    if (!isGdprFeatureEnabled('userRights')) {
      throw new Error('GDPR compliance features are not enabled');
    }

    // Gather organization context
    const context = await this.gatherOrganizationContext(organisationId);
    
    // Get template
    const template = templateId 
      ? await this.getTemplate(templateId)
      : await this.getDefaultTemplate(documentType);
    
    if (!template) {
      throw new Error(`No template found for document type: ${documentType}`);
    }

    // Generate document content
    const generatedContent = await this.processTemplate(template, context);
    
    return generatedContent;
  }

  /**
   * Gather comprehensive organization context for document generation
   */
  private async gatherOrganizationContext(organisationId: string): Promise<DocumentGenerationContext> {
    const [organisation, privacySettings, processingActivities] = await Promise.all([
      storage.getOrganisation(organisationId),
      storage.getPrivacySettings(organisationId),
      storage.getProcessingActivitiesByOrganisation(organisationId)
    ]);

    if (!organisation) {
      throw new Error(`Organization not found: ${organisationId}`);
    }

    return {
      organisation,
      privacySettings: privacySettings || undefined,
      processingActivities: processingActivities || [],
      dpoContact: {
        name: privacySettings?.privacyContacts?.dpoEmail?.split('@')[0], // Extract name from email
        email: privacySettings?.privacyContacts?.dpoEmail
      },
      privacyContact: privacySettings?.privacyContacts?.privacyEmail || organisation.contactEmail,
      companyAddress: organisation.address || undefined,
      contactEmail: organisation.contactEmail || undefined,
      contactPhone: organisation.contactPhone || undefined
    };
  }

  /**
   * Get template by ID
   */
  private async getTemplate(templateId: string): Promise<ComplianceDocumentTemplate | null> {
    return await storage.getComplianceDocumentTemplate(templateId);
  }

  /**
   * Get default template for document type
   */
  private async getDefaultTemplate(documentType: string): Promise<ComplianceDocumentTemplate | null> {
    return await storage.getDefaultComplianceDocumentTemplate(documentType);
  }

  /**
   * Process template with organization context to generate document content
   */
  private async processTemplate(
    template: ComplianceDocumentTemplate,
    context: DocumentGenerationContext
  ): Promise<GeneratedDocumentContent> {
    
    // Replace template variables
    let content = template.content;
    let htmlContent = template.htmlContent || '';
    
    // Apply organization-specific variables
    const variables = this.buildVariableMap(context);
    
    // Replace all variables in content
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
      htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
    }

    // Generate conditional sections
    content = this.processConditionalSections(content, context);
    htmlContent = this.processConditionalSections(htmlContent, context);

    // Generate plain text version
    const plainTextContent = this.htmlToPlainText(htmlContent || content);

    // Calculate metadata
    const wordCount = this.calculateWordCount(content);
    const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute

    return {
      title: this.generateDocumentTitle(template.documentType, context),
      content,
      htmlContent,
      plainTextContent,
      wordCount,
      readingTime,
      regulatoryRequirements: template.regulatoryCompliance || [],
      applicableLaws: ['UK GDPR', 'Data Protection Act 2018', 'Privacy and Electronic Communications Regulations 2003']
    };
  }

  /**
   * Build comprehensive variable map for template processing
   */
  private buildVariableMap(context: DocumentGenerationContext): Record<string, string> {
    const { organisation, privacySettings, processingActivities } = context;
    
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return {
      // Organization details
      'COMPANY_NAME': organisation.displayName || organisation.name,
      'COMPANY_LEGAL_NAME': organisation.name,
      'COMPANY_ADDRESS': context.companyAddress || 'Address not provided',
      'CONTACT_EMAIL': context.contactEmail || 'contact@example.com',
      'CONTACT_PHONE': context.contactPhone || 'Phone not provided',
      'WEBSITE_URL': `https://${organisation.subdomain}.yourdomain.com`,
      
      // Privacy contacts
      'DPO_NAME': context.dpoContact?.name || 'Data Protection Officer',
      'DPO_EMAIL': context.dpoContact?.email || context.privacyContact || context.contactEmail || 'privacy@example.com',
      'PRIVACY_EMAIL': context.privacyContact || context.contactEmail || 'privacy@example.com',
      
      // Dates and versions
      'CURRENT_DATE': currentDate,
      'POLICY_VERSION': gdprConfig.settings.policyVersion,
      'EFFECTIVE_DATE': currentDate,
      'LAST_UPDATED': currentDate,
      
      // Data retention
      'DATA_RETENTION_PERIOD': this.formatRetentionPeriod(privacySettings?.dataRetentionPeriod || 2555),
      'RETENTION_PERIOD_YEARS': Math.floor((privacySettings?.dataRetentionPeriod || 2555) / 365).toString(),
      
      // Processing activities summary
      'PROCESSING_PURPOSES': this.generateProcessingPurposesList(processingActivities),
      'DATA_CATEGORIES': this.generateDataCategoriesList(processingActivities),
      'LAWFUL_BASIS_LIST': this.generateLawfulBasisList(processingActivities),
      
      // International transfers
      'INTERNATIONAL_TRANSFERS': this.generateInternationalTransfersSection(context),
      'TRANSFER_COUNTRIES': this.getTransferCountries(context),
      'TRANSFER_SAFEGUARDS': this.getTransferSafeguards(context),
      
      // User rights
      'USER_RIGHTS_LIST': this.generateUserRightsList(),
      'COMPLAINT_PROCEDURE': privacySettings?.privacyContacts?.complaintsProcedure || 'Contact our privacy team for complaint procedures.',
      
      // Cookie information
      'COOKIE_POLICY_LINK': `/privacy/cookies`,
      'COOKIE_CATEGORIES': this.generateCookieCategoriesList(privacySettings),
      
      // Legal basis
      'PRIMARY_LEGAL_BASIS': this.getPrimaryLegalBasis(processingActivities),
      'LEGITIMATE_INTERESTS': this.getLegitimateInterests(processingActivities)
    };
  }

  /**
   * Process conditional sections in template content
   */
  private processConditionalSections(content: string, context: DocumentGenerationContext): string {
    const { privacySettings, processingActivities } = context;
    
    // Process {{#if CONDITION}} ... {{/if}} blocks
    const ifBlockRegex = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs;
    
    content = content.replace(ifBlockRegex, (match, condition, blockContent) => {
      let shouldInclude = false;
      
      switch (condition) {
        case 'HAS_INTERNATIONAL_TRANSFERS':
          shouldInclude = privacySettings?.internationalTransfers?.enabled || false;
          break;
        case 'HAS_PROCESSING_ACTIVITIES':
          shouldInclude = processingActivities.length > 0;
          break;
        case 'HAS_DPO':
          shouldInclude = !!privacySettings?.privacyContacts?.dpoEmail;
          break;
        case 'HAS_COOKIES':
          shouldInclude = !!privacySettings?.cookieSettings && Object.keys(privacySettings.cookieSettings).length > 0;
          break;
        case 'HAS_SPECIAL_CATEGORIES':
          shouldInclude = processingActivities.some(activity => 
            activity.dataCategories.some(cat => ['health_data', 'biometric_data', 'genetic_data'].includes(cat))
          );
          break;
        default:
          shouldInclude = false;
      }
      
      return shouldInclude ? blockContent : '';
    });

    return content;
  }

  /**
   * Generate document title based on type and context
   */
  private generateDocumentTitle(documentType: string, context: DocumentGenerationContext): string {
    const companyName = context.organisation.displayName || context.organisation.name;
    
    switch (documentType) {
      case 'privacy_policy':
        return `Privacy Policy - ${companyName}`;
      case 'cookie_policy':
        return `Cookie Policy - ${companyName}`;
      case 'data_protection_agreement':
        return `Data Protection Agreement - ${companyName}`;
      case 'terms_of_service':
        return `Terms of Service - ${companyName}`;
      case 'children_privacy_notice':
        return `Children\'s Privacy Notice - ${companyName}`;
      case 'user_rights_information':
        return `Your Privacy Rights - ${companyName}`;
      default:
        return `Compliance Document - ${companyName}`;
    }
  }

  /**
   * Format retention period in human-readable format
   */
  private formatRetentionPeriod(days: number): string {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      if (remainingDays === 0) {
        return `${years} year${years > 1 ? 's' : ''}`;
      }
      return `${years} year${years > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  /**
   * Generate processing purposes list from activities
   */
  private generateProcessingPurposesList(activities: ProcessingActivity[]): string {
    if (activities.length === 0) {
      return 'Learning management and training delivery';
    }
    
    const purposes = activities.map(activity => activity.purpose);
    const uniquePurposes = [...new Set(purposes)];
    
    if (uniquePurposes.length <= 3) {
      return uniquePurposes.join(', ');
    }
    
    return uniquePurposes.slice(0, 3).join(', ') + `, and ${uniquePurposes.length - 3} other purposes`;
  }

  /**
   * Generate data categories list from activities
   */
  private generateDataCategoriesList(activities: ProcessingActivity[]): string {
    if (activities.length === 0) {
      return 'Contact information, learning progress, and training records';
    }
    
    const allCategories = activities.flatMap(activity => activity.dataCategories);
    const uniqueCategories = [...new Set(allCategories)];
    
    // Map technical names to user-friendly names
    const categoryMap: Record<string, string> = {
      'identity': 'Personal identification',
      'contact': 'Contact information',
      'financial': 'Financial information',
      'education': 'Learning and training data',
      'technical': 'Technical data',
      'usage': 'Usage analytics'
    };
    
    const friendlyCategories = uniqueCategories.map(cat => categoryMap[cat] || cat);
    
    if (friendlyCategories.length <= 4) {
      return friendlyCategories.join(', ');
    }
    
    return friendlyCategories.slice(0, 4).join(', ') + `, and ${friendlyCategories.length - 4} other categories`;
  }

  /**
   * Generate lawful basis list from activities
   */
  private generateLawfulBasisList(activities: ProcessingActivity[]): string {
    if (activities.length === 0) {
      return 'Legitimate interests for training delivery';
    }
    
    const allBases = activities.map(activity => activity.lawfulBasis);
    const uniqueBases = [...new Set(allBases)];
    
    // Map to user-friendly names
    const basisMap: Record<string, string> = {
      'consent': 'Your consent',
      'contract': 'Contract performance',
      'legal_obligation': 'Legal obligation',
      'vital_interests': 'Vital interests',
      'public_task': 'Public task',
      'legitimate_interests': 'Legitimate interests'
    };
    
    const friendlyBases = uniqueBases.map(basis => basisMap[basis] || basis);
    return friendlyBases.join(', ');
  }

  /**
   * Generate international transfers section
   */
  private generateInternationalTransfersSection(context: DocumentGenerationContext): string {
    const { privacySettings } = context;
    
    if (!privacySettings?.internationalTransfers?.enabled) {
      return 'We do not transfer your personal data outside the UK.';
    }
    
    const countries = privacySettings.internationalTransfers.countries || [];
    const safeguards = privacySettings.internationalTransfers.safeguards || '';
    
    let section = `We may transfer your personal data to the following countries: ${countries.join(', ')}.`;
    
    if (safeguards) {
      section += ` We ensure appropriate safeguards are in place: ${safeguards}`;
    }
    
    return section;
  }

  /**
   * Get transfer countries
   */
  private getTransferCountries(context: DocumentGenerationContext): string {
    const countries = context.privacySettings?.internationalTransfers?.countries || [];
    return countries.length > 0 ? countries.join(', ') : 'None';
  }

  /**
   * Get transfer safeguards
   */
  private getTransferSafeguards(context: DocumentGenerationContext): string {
    return context.privacySettings?.internationalTransfers?.safeguards || 'Not applicable';
  }

  /**
   * Generate user rights list
   */
  private generateUserRightsList(): string {
    return `
• Right to be informed about how we use your data
• Right to access your personal data
• Right to rectification of inaccurate data
• Right to erasure ('right to be forgotten')
• Right to restrict processing
• Right to data portability
• Right to object to processing
• Rights in relation to automated decision making and profiling
    `.trim();
  }

  /**
   * Generate cookie categories list
   */
  private generateCookieCategoriesList(privacySettings?: PrivacySettings): string {
    if (!privacySettings?.cookieSettings) {
      return 'Essential cookies for website functionality';
    }
    
    const settings = privacySettings.cookieSettings;
    const categories = [];
    
    if (settings.strictlyNecessary) categories.push('Strictly necessary');
    if (settings.functional) categories.push('Functional');
    if (settings.analytics) categories.push('Analytics');
    if (settings.advertising) categories.push('Advertising');
    
    return categories.length > 0 ? categories.join(', ') : 'Essential cookies only';
  }

  /**
   * Get primary legal basis
   */
  private getPrimaryLegalBasis(activities: ProcessingActivity[]): string {
    if (activities.length === 0) {
      return 'Legitimate interests';
    }
    
    // Count frequency of each basis
    const basisCounts = activities.reduce((acc, activity) => {
      acc[activity.lawfulBasis] = (acc[activity.lawfulBasis] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Find most common basis
    const mostCommon = Object.entries(basisCounts).sort(([,a], [,b]) => b - a)[0];
    
    const basisMap: Record<string, string> = {
      'consent': 'your consent',
      'contract': 'contract performance',
      'legal_obligation': 'legal obligation',
      'vital_interests': 'vital interests',
      'public_task': 'public task',
      'legitimate_interests': 'our legitimate interests'
    };
    
    return basisMap[mostCommon[0]] || mostCommon[0];
  }

  /**
   * Get legitimate interests description
   */
  private getLegitimateInterests(activities: ProcessingActivity[]): string {
    const legitimateInterestActivities = activities.filter(a => a.lawfulBasis === 'legitimate_interests');
    
    if (legitimateInterestActivities.length === 0) {
      return 'Providing learning management services and improving our platform';
    }
    
    const purposes = legitimateInterestActivities.map(a => a.purpose);
    return [...new Set(purposes)].join(', ');
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToPlainText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(text: string): number {
    const plainText = this.htmlToPlainText(text);
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Create default templates for organizations that don't have custom templates
   */
  async createDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      this.createPrivacyPolicyTemplate(),
      this.createCookiePolicyTemplate(),
      this.createDataProtectionAgreementTemplate(),
      this.createUserRightsInformationTemplate()
    ];

    for (const template of defaultTemplates) {
      await storage.createComplianceDocumentTemplate(template);
    }
  }

  /**
   * Create default Privacy Policy template
   */
  private createPrivacyPolicyTemplate() {
    return {
      name: 'Standard Privacy Policy',
      description: 'UK GDPR compliant privacy policy template',
      documentType: 'privacy_policy' as const,
      templateKey: 'privacy_policy_standard',
      content: this.getPrivacyPolicyTemplate(),
      htmlContent: this.getPrivacyPolicyTemplateHTML(),
      variables: this.getPrivacyPolicyVariables(),
      requiredData: ['organisation', 'privacy_settings', 'processing_activities'],
      regulatoryCompliance: ['UK GDPR Article 13', 'UK GDPR Article 14', 'Data Protection Act 2018'],
      applicableJurisdictions: ['UK'],
      isDefault: true,
      isActive: true,
      allowCustomization: true,
      createdBy: 'system'
    };
  }

  /**
   * Create default Cookie Policy template
   */
  private createCookiePolicyTemplate() {
    return {
      name: 'Standard Cookie Policy',
      description: 'PECR compliant cookie policy template',
      documentType: 'cookie_policy' as const,
      templateKey: 'cookie_policy_standard',
      content: this.getCookiePolicyTemplate(),
      htmlContent: this.getCookiePolicyTemplateHTML(),
      variables: this.getCookiePolicyVariables(),
      requiredData: ['organisation', 'privacy_settings', 'cookie_inventory'],
      regulatoryCompliance: ['PECR Regulation 6', 'UK GDPR'],
      applicableJurisdictions: ['UK'],
      isDefault: true,
      isActive: true,
      allowCustomization: true,
      createdBy: 'system'
    };
  }

  /**
   * Create default Data Protection Agreement template
   */
  private createDataProtectionAgreementTemplate() {
    return {
      name: 'Standard Data Protection Agreement',
      description: 'UK GDPR Article 28 compliant DPA template',
      documentType: 'data_protection_agreement' as const,
      templateKey: 'dpa_standard',
      content: this.getDataProtectionAgreementTemplate(),
      htmlContent: this.getDataProtectionAgreementTemplateHTML(),
      variables: this.getDataProtectionAgreementVariables(),
      requiredData: ['organisation', 'processing_activities'],
      regulatoryCompliance: ['UK GDPR Article 28', 'Data Protection Act 2018'],
      applicableJurisdictions: ['UK'],
      isDefault: true,
      isActive: true,
      allowCustomization: true,
      createdBy: 'system'
    };
  }

  /**
   * Create default User Rights Information template
   */
  private createUserRightsInformationTemplate() {
    return {
      name: 'Standard User Rights Information',
      description: 'UK GDPR compliant user rights information',
      documentType: 'user_rights_information' as const,
      templateKey: 'user_rights_standard',
      content: this.getUserRightsInformationTemplate(),
      htmlContent: this.getUserRightsInformationTemplateHTML(),
      variables: this.getUserRightsInformationVariables(),
      requiredData: ['organisation', 'privacy_settings'],
      regulatoryCompliance: ['UK GDPR Chapter III', 'Data Protection Act 2018'],
      applicableJurisdictions: ['UK'],
      isDefault: true,
      isActive: true,
      allowCustomization: true,
      createdBy: 'system'
    };
  }

  // Template content methods (privacy policy, cookie policy, etc.)
  // These methods return the actual legal template content
  // Implementation continues in next part due to length...

  private getPrivacyPolicyTemplate(): string {
    return `# Privacy Policy

**Effective Date:** {{EFFECTIVE_DATE}}
**Last Updated:** {{LAST_UPDATED}}
**Version:** {{POLICY_VERSION}}

## 1. Who We Are

{{COMPANY_NAME}} (we, us, our) is committed to protecting your privacy and personal data. This privacy policy explains how we collect, use, and protect your information when you use our learning management services.

**Contact Details:**
- Company: {{COMPANY_LEGAL_NAME}}
- Address: {{COMPANY_ADDRESS}}
- Email: {{CONTACT_EMAIL}}
- Phone: {{CONTACT_PHONE}}

{{#if HAS_DPO}}
**Data Protection Officer:**
- Name: {{DPO_NAME}}
- Email: {{DPO_EMAIL}}
{{/if}}

**Privacy Enquiries:** {{PRIVACY_EMAIL}}

## 2. Information We Collect

We collect and process the following categories of personal data:

{{DATA_CATEGORIES}}

{{#if HAS_PROCESSING_ACTIVITIES}}
**Processing Purposes:**
{{PROCESSING_PURPOSES}}
{{/if}}

## 3. Legal Basis for Processing

We process your personal data based on the following lawful bases under UK GDPR:

{{LAWFUL_BASIS_LIST}}

{{#if HAS_SPECIAL_CATEGORIES}}
For special categories of data, we rely on explicit consent or other appropriate conditions under UK GDPR Article 9.
{{/if}}

## 4. How We Use Your Information

We use your personal data for:
- Providing learning management services
- Managing your account and enrolment
- Tracking learning progress and issuing certificates
- Communicating about courses and updates
- Improving our services
- Complying with legal obligations

## 5. Data Retention

We retain your personal data for {{DATA_RETENTION_PERIOD}} ({{RETENTION_PERIOD_YEARS}} years) or as required by law. This allows us to provide ongoing learning services and maintain accurate records.

## 6. Your Rights

Under UK GDPR, you have the following rights:

{{USER_RIGHTS_LIST}}

To exercise your rights, contact us at {{PRIVACY_EMAIL}}.

**Complaints:** {{COMPLAINT_PROCEDURE}}

You can also complain to the Information Commissioner's Office (ICO) at ico.org.uk.

## 7. Data Sharing

We do not sell your personal data. We may share your information with:
- Third-party service providers (under strict contractual terms)
- Legal authorities when required by law
- Other parties with your explicit consent

{{#if HAS_INTERNATIONAL_TRANSFERS}}
## 8. International Transfers

{{INTERNATIONAL_TRANSFERS}}

**Countries:** {{TRANSFER_COUNTRIES}}
**Safeguards:** {{TRANSFER_SAFEGUARDS}}
{{/if}}

## 9. Data Security

We implement appropriate technical and organisational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.

## 10. Cookies

{{#if HAS_COOKIES}}
We use cookies to improve your experience. For detailed information, see our Cookie Policy: {{COOKIE_POLICY_LINK}}

**Cookie Categories:** {{COOKIE_CATEGORIES}}
{{else}}
We use essential cookies only for website functionality.
{{/if}}

## 11. Updates to This Policy

We may update this privacy policy from time to time. We will notify you of significant changes by email or through our platform.

## 12. Contact Us

For questions about this privacy policy or our data practices:

**Privacy Team:** {{PRIVACY_EMAIL}}
**General Contact:** {{CONTACT_EMAIL}}
**Address:** {{COMPANY_ADDRESS}}

This policy complies with UK GDPR and the Data Protection Act 2018.`;
  }

  private getPrivacyPolicyTemplateHTML(): string {
    return this.convertMarkdownToHTML(this.getPrivacyPolicyTemplate());
  }

  private getCookiePolicyTemplate(): string {
    return `# Cookie Policy

**Effective Date:** {{EFFECTIVE_DATE}}
**Last Updated:** {{LAST_UPDATED}}

## What Are Cookies

Cookies are small text files stored on your device when you visit our website. They help us provide a better user experience and understand how our site is used.

## How We Use Cookies

**{{COMPANY_NAME}}** uses cookies for:
- Essential website functionality
- Remembering your preferences
- Analytics and performance monitoring
- Improving user experience

## Types of Cookies We Use

{{COOKIE_CATEGORIES}}

## Managing Cookies

You can control cookies through your browser settings. However, disabling essential cookies may affect website functionality.

**Browser Controls:**
- Chrome: Settings > Privacy and security > Cookies
- Firefox: Settings > Privacy & Security
- Safari: Preferences > Privacy
- Edge: Settings > Cookies and site permissions

## Your Consent

{{#if HAS_COOKIES}}
We obtain your consent before placing non-essential cookies. You can withdraw consent at any time through our cookie preference center.
{{else}}
We only use essential cookies that do not require consent.
{{/if}}

## Third-Party Cookies

Some third-party services may set their own cookies. We ensure all third parties comply with applicable data protection laws.

## Contact Us

For questions about our cookie policy:

**Email:** {{PRIVACY_EMAIL}}
**Company:** {{COMPANY_NAME}}

This policy complies with PECR and UK GDPR requirements.`;
  }

  private getCookiePolicyTemplateHTML(): string {
    return this.convertMarkdownToHTML(this.getCookiePolicyTemplate());
  }

  private getDataProtectionAgreementTemplate(): string {
    return `# Data Protection Agreement

**Controller:** {{COMPANY_LEGAL_NAME}}
**Processor:** [To be completed]
**Effective Date:** {{EFFECTIVE_DATE}}

## 1. Definitions

This Agreement uses definitions from UK GDPR and supplements the main service agreement between the parties.

## 2. Processing Details

**Categories of Personal Data:** {{DATA_CATEGORIES}}
**Processing Purposes:** {{PROCESSING_PURPOSES}}
**Data Retention Period:** {{DATA_RETENTION_PERIOD}}

## 3. Processor Obligations

The Processor shall:
- Process personal data only on documented instructions from the Controller
- Implement appropriate technical and organisational measures
- Ensure confidentiality of processing personnel
- Assist with data subject rights requests
- Notify the Controller of personal data breaches without undue delay
- Delete or return personal data upon termination

## 4. Sub-processing

{{#if HAS_INTERNATIONAL_TRANSFERS}}
**International Transfers:** Processing may involve transfers to {{TRANSFER_COUNTRIES}} with appropriate safeguards.
{{/if}}

## 5. Technical and Organisational Measures

Both parties commit to implementing appropriate security measures including:
- Pseudonymisation and encryption
- Confidentiality, integrity, availability and resilience
- Regular testing and evaluation
- Incident response procedures

## 6. Data Subject Rights

The Processor shall assist the Controller in responding to data subject requests within 72 hours of notification.

## 7. Data Protection Impact Assessment

Where required, the Processor shall provide information necessary for any DPIA conducted by the Controller.

## 8. Liability and Indemnification

Each party shall be liable for damages in accordance with UK GDPR provisions.

## 9. Term and Termination

This Agreement remains in effect while personal data is processed under the main agreement.

**Controller Contact:**
{{COMPANY_NAME}}
{{PRIVACY_EMAIL}}

This agreement complies with UK GDPR Article 28 requirements.`;
  }

  private getDataProtectionAgreementTemplateHTML(): string {
    return this.convertMarkdownToHTML(this.getDataProtectionAgreementTemplate());
  }

  private getUserRightsInformationTemplate(): string {
    return `# Your Privacy Rights

**{{COMPANY_NAME}}** respects your privacy rights under UK GDPR. This guide explains your rights and how to exercise them.

## Your Rights

{{USER_RIGHTS_LIST}}

## How to Exercise Your Rights

**Contact:** {{PRIVACY_EMAIL}}
**Response Time:** We will respond within one month (can be extended to three months for complex requests)

## Right to Access (Subject Access Request)

You can request:
- Confirmation that we process your data
- Copy of your personal data
- Information about processing purposes and retention

## Right to Rectification

You can ask us to correct inaccurate or incomplete personal data.

## Right to Erasure ('Right to be Forgotten')

You can request deletion when:
- Data is no longer necessary for original purpose
- You withdraw consent (where consent is the legal basis)
- Data has been unlawfully processed
- Erasure is required for legal compliance

**Note:** We may refuse if we have overriding legitimate grounds or legal obligations.

## Right to Restrict Processing

You can request restriction when:
- You contest the accuracy of data
- Processing is unlawful but you don't want erasure
- We no longer need the data but you need it for legal claims
- You object to processing pending verification of legitimate grounds

## Right to Data Portability

For data processed based on consent or contract, you can:
- Receive your data in a structured, machine-readable format
- Transmit data directly to another controller (where technically feasible)

## Right to Object

You can object to processing based on:
- Legitimate interests (including profiling)
- Direct marketing (including profiling)
- Scientific/historical research or statistics

## Automated Decision Making

{{#if HAS_AUTOMATED_DECISIONS}}
We use automated decision making for: [To be specified]
You have the right to human intervention and to contest such decisions.
{{else}}
We do not use automated decision making or profiling that significantly affects you.
{{/if}}

## Making a Complaint

If you're not satisfied with our response:

1. **Contact our Privacy Team:** {{PRIVACY_EMAIL}}
2. **Complaint Procedure:** {{COMPLAINT_PROCEDURE}}
3. **Information Commissioner's Office:** ico.org.uk

## Identity Verification

We may request identification to verify your identity before processing requests.

**Contact Us:**
{{COMPANY_NAME}}
{{PRIVACY_EMAIL}}
{{CONTACT_PHONE}}

Your rights are protected under UK GDPR and the Data Protection Act 2018.`;
  }

  private getUserRightsInformationTemplateHTML(): string {
    return this.convertMarkdownToHTML(this.getUserRightsInformationTemplate());
  }

  // Variable definitions for templates
  private getPrivacyPolicyVariables(): any[] {
    return [
      { name: 'COMPANY_NAME', description: 'Company display name', required: true },
      { name: 'COMPANY_LEGAL_NAME', description: 'Legal company name', required: true },
      { name: 'COMPANY_ADDRESS', description: 'Company address', required: true },
      { name: 'CONTACT_EMAIL', description: 'General contact email', required: true },
      { name: 'PRIVACY_EMAIL', description: 'Privacy contact email', required: true },
      { name: 'DPO_NAME', description: 'Data Protection Officer name', required: false },
      { name: 'DPO_EMAIL', description: 'Data Protection Officer email', required: false },
      { name: 'DATA_CATEGORIES', description: 'Categories of personal data processed', required: true },
      { name: 'PROCESSING_PURPOSES', description: 'Purposes of data processing', required: true },
      { name: 'LAWFUL_BASIS_LIST', description: 'Legal bases for processing', required: true },
      { name: 'DATA_RETENTION_PERIOD', description: 'Data retention period', required: true },
      { name: 'USER_RIGHTS_LIST', description: 'List of user rights under GDPR', required: true }
    ];
  }

  private getCookiePolicyVariables(): any[] {
    return [
      { name: 'COMPANY_NAME', description: 'Company display name', required: true },
      { name: 'PRIVACY_EMAIL', description: 'Privacy contact email', required: true },
      { name: 'COOKIE_CATEGORIES', description: 'Types of cookies used', required: true },
      { name: 'EFFECTIVE_DATE', description: 'Policy effective date', required: true }
    ];
  }

  private getDataProtectionAgreementVariables(): any[] {
    return [
      { name: 'COMPANY_LEGAL_NAME', description: 'Legal company name', required: true },
      { name: 'PRIVACY_EMAIL', description: 'Privacy contact email', required: true },
      { name: 'DATA_CATEGORIES', description: 'Categories of personal data', required: true },
      { name: 'PROCESSING_PURPOSES', description: 'Purposes of processing', required: true },
      { name: 'DATA_RETENTION_PERIOD', description: 'Data retention period', required: true }
    ];
  }

  private getUserRightsInformationVariables(): any[] {
    return [
      { name: 'COMPANY_NAME', description: 'Company display name', required: true },
      { name: 'PRIVACY_EMAIL', description: 'Privacy contact email', required: true },
      { name: 'USER_RIGHTS_LIST', description: 'List of GDPR rights', required: true },
      { name: 'COMPLAINT_PROCEDURE', description: 'How to make complaints', required: true }
    ];
  }

  /**
   * Convert Markdown to basic HTML
   */
  private convertMarkdownToHTML(markdown: string): string {
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/^\*(.*)\*/gim, '<em>$1</em>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      .replace(/\n/g, '<br>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/<\/ul><br><ul>/g, '');
  }
}

// Export singleton instance
export const complianceDocumentGenerationService = new ComplianceDocumentGenerationService();