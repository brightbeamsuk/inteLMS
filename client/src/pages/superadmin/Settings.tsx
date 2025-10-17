import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ImageUpload } from "@/components/ImageUpload";
import { VisualCertificateEditor, type CertificateTemplate as VisualCertificateTemplate } from "@/components/VisualCertificateEditor";

// Email provider configurations
const emailProviders = {
  sendgrid_api: {
    name: 'SendGrid (API)',
    type: 'api',
    instructions: 'Get your API key from SendGrid account settings.',
    website: 'https://sendgrid.com/docs/for-developers/sending-email/api-getting-started/',
  },
  brevo_api: {
    name: 'Brevo (API)',
    type: 'api',
    instructions: 'Create an API key in your Brevo account settings.',
    website: 'https://developers.brevo.com/docs/getting-started',
  },
  mailgun_api: {
    name: 'Mailgun (API)',
    type: 'api',
    instructions: 'Get your API key and domain from the Mailgun dashboard.',
    website: 'https://documentation.mailgun.com/en/latest/quickstart.html',
  },
  postmark_api: {
    name: 'Postmark (API)',
    type: 'api',
    instructions: 'Create a server API token in your Postmark account.',
    website: 'https://postmarkapp.com/developer/api/overview',
  },
  mailjet_api: {
    name: 'Mailjet (API)',
    type: 'api',
    instructions: 'Get your API key and secret from the Mailjet account settings.',
    website: 'https://dev.mailjet.com/email/guides/getting-started/',
  },
  sparkpost_api: {
    name: 'SparkPost (API)',
    type: 'api',
    instructions: 'Create an API key in the SparkPost account settings.',
    website: 'https://developers.sparkpost.com/api/',
  },
  smtp_generic: {
    name: 'Generic SMTP',
    type: 'smtp',
    instructions: 'Use any SMTP server with username and password authentication.',
    website: null,
    presets: {
      'Gmail': { host: 'smtp.gmail.com', port: 587, secure: false },
      'Outlook': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
      'Yahoo': { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
      'iCloud': { host: 'smtp.mail.me.com', port: 587, secure: false },
    }
  }
};

interface CertificateTemplate {
  id: string;
  name: string;
  template?: string;
  templateFormat?: 'html' | 'visual';
  templateData?: any;
  isDefault: boolean;
  organisationId?: string;
  createdAt: string;
  updatedAt: string;
}

export function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const [templateEditor, setTemplateEditor] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [useVisualEditor, setUseVisualEditor] = useState(true);
  const [currentVisualTemplate, setCurrentVisualTemplate] = useState<VisualCertificateTemplate | null>(null);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [currentPdfTemplate, setCurrentPdfTemplate] = useState<CertificateTemplate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const availablePlaceholders = [
    '{{USERNAME}}',
    '{{USER_EMAIL}}',
    '{{COURSE_NAME}}',
    '{{COURSE_ID}}',
    '{{ORGANISATION_NAME}}',
    '{{ADMIN_NAME}}',
    '{{SCORE_PERCENT}}',
    '{{PASS_FAIL}}',
    '{{DATE_COMPLETED}}',
    '{{CERTIFICATE_ID}}',
    '{{BACKGROUND_IMAGE}}',
    '{{SIGNATURE_IMAGE}}'
  ];

  const [platformSettings, setPlatformSettings] = useState({
    defaultTheme: 'light',
    defaultCertificateExpiry: 'show',
    passwordPolicy: 'Passwords must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.',
    footerLinks: 'Privacy Policy | Terms of Service | Contact Support',
  });

  // Provider-agnostic email settings state
  const [emailSettings, setEmailSettings] = useState({
    provider: 'sendgrid_api' as 'smtp_generic' | 'sendgrid_api' | 'brevo_api' | 'mailgun_api' | 'postmark_api' | 'mailjet_api' | 'sparkpost_api',
    fromEmail: '',
    fromName: '',
    replyTo: '',
    description: '',
    // SMTP fields
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    smtpSecure: true,
    // API fields
    apiKey: '',
    apiSecret: '', // Mailjet
    apiBaseUrl: '',
    apiDomain: '', // Mailgun
    apiRegion: '', // SES
    hasPassword: false,
  });

  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestResultModal, setShowTestResultModal] = useState(false);

  // Provider configurations - supports both SMTP and API providers (same as org settings)
  const emailProviders = {
    smtp_generic: {
      name: 'Generic SMTP',
      type: 'smtp',
      presets: {
        'Microsoft 365': { smtpHost: 'smtp.office365.com', smtpPort: '587', smtpSecure: true },
        'Gmail': { smtpHost: 'smtp.gmail.com', smtpPort: '587', smtpSecure: true },
        'Amazon SES SMTP': { smtpHost: 'email-smtp.us-east-1.amazonaws.com', smtpPort: '587', smtpSecure: true },
        'SMTP2GO': { smtpHost: 'mail.smtp2go.com', smtpPort: '2525', smtpSecure: true },
        'Postmark SMTP': { smtpHost: 'smtp.postmarkapp.com', smtpPort: '587', smtpSecure: true },
        'Custom': { smtpHost: '', smtpPort: '587', smtpSecure: true }
      },
      instructions: 'Configure any SMTP server as platform default. Organizations can override this.',
      requiredFields: ['fromEmail', 'fromName', 'smtpHost', 'smtpUsername', 'smtpPassword'],
      website: undefined
    },
    sendgrid_api: {
      name: 'SendGrid API',
      type: 'api',
      instructions: 'Set SendGrid as platform default. Organizations inherit this unless they configure their own.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://sendgrid.com'
    },
    brevo_api: {
      name: 'Brevo API',
      type: 'api',
      instructions: 'Set Brevo as platform default. Note: IP restrictions may apply.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://brevo.com'
    },
    mailgun_api: {
      name: 'Mailgun API',
      type: 'api',
      instructions: 'Set Mailgun as platform default. Domain must be verified.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey', 'apiDomain'],
      website: 'https://mailgun.com'
    },
    postmark_api: {
      name: 'Postmark API',
      type: 'api',
      instructions: 'Set Postmark as platform default. Requires confirmed sender signature.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://postmarkapp.com'
    },
    mailjet_api: {
      name: 'Mailjet API',
      type: 'api',
      instructions: 'Set Mailjet as platform default. Organizations can override with their own keys.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey', 'apiSecret'],
      website: 'https://mailjet.com'
    },
    sparkpost_api: {
      name: 'SparkPost API',
      type: 'api',
      instructions: 'Set SparkPost as platform default. Requires transmissions permission.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://sparkpost.com'
    }
  };

  // Load system email settings
  const { data: systemEmailData, isLoading: emailLoading } = useQuery({
    queryKey: ['/api/system/email-settings'],
    retry: false,
  });

  useEffect(() => {
    if (systemEmailData) {
      const data = systemEmailData as any; // Type assertion to access properties
      setEmailSettings({
        provider: data.provider || 'brevo_api',
        fromEmail: data.fromEmail || '',
        fromName: data.fromName || '',
        replyTo: data.replyTo || '',
        description: data.description || '',
        // SMTP fields
        smtpHost: data.smtpHost || '',
        smtpPort: data.smtpPort?.toString() || '587',
        smtpUsername: data.smtpUsername || '',
        smtpPassword: '', // Never populate password for security
        smtpSecure: data.smtpSecure !== false,
        // API fields - show masked indicators when credentials exist
        apiKey: data.apiKey || '',
        apiSecret: data.apiSecret || '',
        apiBaseUrl: data.apiBaseUrl || '',
        apiDomain: data.apiDomain || '',
        apiRegion: data.apiRegion || '',
        hasPassword: data.hasPassword || false,
      });
    }
  }, [systemEmailData]);

  const handleProviderChange = (provider: string) => {
    const config = emailProviders[provider as keyof typeof emailProviders];
    if (config) {
      setEmailSettings(prev => ({
        ...prev,
        provider: provider as any,
        // Clear provider-specific fields when switching
        smtpHost: '',
        smtpPort: '587',
        smtpUsername: '',
        smtpPassword: '',
        smtpSecure: true,
        apiKey: '',
        apiSecret: '',
        apiBaseUrl: '',
        apiDomain: '',
        apiRegion: '',
        // Keep common fields when switching provider
        fromEmail: prev.fromEmail,
        fromName: prev.fromName,
        replyTo: prev.replyTo,
        description: prev.description,
      }));
    }
  };

  const handleSMTPPresetChange = (preset: string) => {
    const config = emailProviders.smtp_generic;
    if (config && config.presets && config.presets[preset as keyof typeof config.presets]) {
      const presetConfig = config.presets[preset as keyof typeof config.presets];
      setEmailSettings(prev => ({
        ...prev,
        smtpHost: presetConfig.smtpHost,
        smtpPort: presetConfig.smtpPort,
        smtpSecure: presetConfig.smtpSecure,
      }));
    }
  };

  // Fetch existing templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/certificate-templates'],
  });

  // Find current PDF template
  useEffect(() => {
    if (templates && templates.length > 0) {
      const pdfTemplate = (templates as CertificateTemplate[]).find(
        t => t.templateFormat === 'pdf' && t.isDefault
      );
      setCurrentPdfTemplate(pdfTemplate || null);
    }
  }, [templates]);

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      if (editingTemplateId) {
        const response = await apiRequest('PUT', `/api/certificate-templates/${editingTemplateId}`, templateData);
        return response.json();
      } else {
        const response = await apiRequest('POST', '/api/certificate-templates', templateData);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/certificate-templates'] });
      toast({
        title: "Success",
        description: editingTemplateId ? "Template updated successfully" : "Template saved successfully",
      });
      clearEditor();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  });

  const handleVisualTemplateSave = (template: VisualCertificateTemplate) => {
    const templateData = {
      name: template.name,
      templateFormat: 'visual',
      templateData: template,
      isDefault: false
    };
    saveTemplateMutation.mutate(templateData);
  };

  // PDF template upload mutation
  const uploadPdfTemplateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('pdfTemplate', file);
      formData.append('name', 'System PDF Template');
      formData.append('templateFormat', 'pdf');
      formData.append('isDefault', 'true');

      // If there's an existing PDF template, update it; otherwise create new
      const url = currentPdfTemplate 
        ? `/api/certificate-templates/${currentPdfTemplate.id}/pdf`
        : '/api/certificate-templates/pdf';
      
      const response = await fetch(url, {
        method: currentPdfTemplate ? 'PUT' : 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload PDF template');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PDF template uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/certificate-templates'] });
      setSelectedPdfFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload PDF template",
        variant: "destructive",
      });
    },
  });

  // Handle file selection
  const handlePdfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedPdfFile(file);
    } else if (file) {
      toast({
        title: "Error",
        description: "Please select a valid PDF file",
        variant: "destructive",
      });
      event.target.value = ''; // Reset file input
    }
  };

  // Handle PDF upload
  const handlePdfUpload = () => {
    if (!selectedPdfFile) {
      toast({
        title: "Error",
        description: "Please select a PDF file first",
        variant: "destructive",
      });
      return;
    }
    uploadPdfTemplateMutation.mutate(selectedPdfFile);
  };

  // System email settings mutations
  const saveEmailSettingsMutation = useMutation({
    mutationFn: async (emailData: typeof emailSettings) => {
      // Build settings object based on provider type
      const settings: any = {
        emailProvider: emailData.provider,
        fromEmail: emailData.fromEmail,
        fromName: emailData.fromName,
        replyTo: emailData.replyTo,
        description: emailData.description,
      };

      // Add provider-specific fields
      if (emailData.provider === 'smtp_generic') {
        settings.smtpHost = emailData.smtpHost;
        settings.smtpPort = parseInt(emailData.smtpPort);
        settings.smtpUsername = emailData.smtpUsername;
        settings.smtpPassword = emailData.smtpPassword;
        settings.smtpSecure = emailData.smtpSecure;
      } else {
        // API providers
        settings.apiKey = emailData.apiKey;
        
        if (emailData.provider === 'mailjet_api') {
          settings.apiSecret = emailData.apiSecret;
        }
        if (emailData.provider === 'mailgun_api') {
          settings.apiDomain = emailData.apiDomain;
        }
        if (emailData.apiBaseUrl) {
          settings.apiBaseUrl = emailData.apiBaseUrl;
        }
        if (emailData.apiRegion) {
          settings.apiRegion = emailData.apiRegion;
        }
      }

      const method = systemEmailData ? 'PUT' : 'POST';
      const response = await apiRequest(method, '/api/system/email-settings', settings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/email-settings'] });
      toast({
        title: "Success",
        description: "System email settings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SMTP settings",
        variant: "destructive",
      });
    }
  });

  const testEmailMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const response = await apiRequest('POST', '/api/system/smtp-test', { testEmail });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Success" : "Test Failed",
        description: data.success 
          ? "Test email sent successfully! Check your inbox." 
          : data.details?.error || "Failed to send test email",
        variant: data.success ? "default" : "destructive",
      });
      setShowTestEmailModal(false);
      setTestEmailAddress('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/system/smtp-test', { connectionOnly: true });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection Success" : "Connection Failed",
        description: data.success 
          ? `Connected to ${data.details?.host}:${data.details?.port} (${data.details?.provider})` 
          : data.details?.error || "Failed to connect to SMTP server",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to test SMTP connection",
        variant: "destructive",
      });
    }
  });

  // Email helper functions

  const handleSaveEmailSettings = () => {
    // Common required fields for all providers
    if (!emailSettings.fromEmail || !emailSettings.fromName) {
      toast({
        title: "Error",
        description: "Please fill in From Email and From Name fields",
        variant: "destructive",
      });
      return;
    }

    // Provider-specific validation
    if (emailSettings.provider === 'smtp_generic') {
      // SMTP validation
      if (!emailSettings.smtpHost || !emailSettings.smtpUsername) {
        toast({
          title: "Error",
          description: "Please fill in SMTP Host and Username for SMTP configuration",
          variant: "destructive",
        });
        return;
      }

      // Only require password if one isn't already set
      if (!emailSettings.smtpPassword && !emailSettings.smtpPassword?.startsWith('••')) {
        toast({
          title: "Error",
          description: "SMTP password is required",
          variant: "destructive",
        });
        return;
      }
    } else {
      // API provider validation
      if (!emailSettings.apiKey) {
        toast({
          title: "Error",
          description: "Please provide an API key for the selected email provider",
          variant: "destructive",
        });
        return;
      }

      // Mailjet requires both API key and secret
      if (emailSettings.provider === 'mailjet_api' && !emailSettings.apiSecret) {
        toast({
          title: "Error",
          description: "Mailjet requires both API key and API secret",
          variant: "destructive",
        });
        return;
      }

      // Mailgun requires domain
      if (emailSettings.provider === 'mailgun_api' && !emailSettings.apiDomain) {
        toast({
          title: "Error",
          description: "Mailgun requires an API domain (e.g., mg.yourdomain.com)",
          variant: "destructive",
        });
        return;
      }

    }

    // Clean up empty fields that shouldn't be sent
    let settingsToSave: any;
    if (emailSettings.provider !== 'smtp_generic') {
      // Remove SMTP fields for API providers
      const { smtpHost, smtpPort, smtpUsername, smtpPassword, smtpSecure, ...apiSettings } = emailSettings;
      settingsToSave = apiSettings;
    } else {
      // Remove API fields for SMTP
      const { apiKey, apiSecret, apiBaseUrl, apiDomain, apiRegion, ...smtpSettings } = emailSettings;
      settingsToSave = smtpSettings;
      
      // Handle masked password for SMTP
      if (!settingsToSave.smtpPassword || settingsToSave.smtpPassword?.startsWith('••')) {
        const { smtpPassword, ...restSettings } = settingsToSave;
        settingsToSave = restSettings;
      }
    }

    saveEmailSettingsMutation.mutate(settingsToSave);
  };

  const openTestEmailModal = () => {
    setTestEmailAddress('');
    setShowTestEmailModal(true);
  };

  const closeTestEmailModal = () => {
    setShowTestEmailModal(false);
    setTestEmailAddress('');
  };

  const sendTestEmailToAddress = () => {
    if (!testEmailAddress) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    testEmailMutation.mutate(testEmailAddress);
  };

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/certificate-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/certificate-templates'] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  });

  const insertPlaceholder = (placeholder: string) => {
    setTemplateEditor(prev => prev + placeholder);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !templateEditor.trim()) {
      toast({
        title: "Error",
        description: "Please provide both template name and HTML content",
        variant: "destructive",
      });
      return;
    }

    // Include uploaded images in the template
    let finalTemplate = templateEditor;
    if (backgroundImage) {
      finalTemplate = finalTemplate.replace(/{{BACKGROUND_IMAGE}}/g, backgroundImage);
    }
    if (signatureImage) {
      finalTemplate = finalTemplate.replace(/{{SIGNATURE_IMAGE}}/g, signatureImage);
    }

    saveTemplateMutation.mutate({
      name: templateName,
      template: finalTemplate,
      isDefault: false
    });
  };

  const clearEditor = () => {
    setTemplateEditor("");
    setTemplateName("");
    setBackgroundImage(null);
    setSignatureImage(null);
    setEditingTemplateId(null);
    setShowPreview(false);
  };

  const editTemplate = (template: CertificateTemplate) => {
    if (template.templateFormat === 'visual' && template.templateData) {
      setCurrentVisualTemplate(template.templateData);
      setUseVisualEditor(true);
    } else {
      setTemplateEditor(template.template || '');
      setTemplateName(template.name);
      setUseVisualEditor(false);
    }
    setEditingTemplateId(template.id);
    setShowPreview(false);
  };


  const previewTemplate = () => {
    const sampleData = {
      '{{USERNAME}}': 'John Smith',
      '{{USER_EMAIL}}': 'john.smith@example.com',
      '{{COURSE_NAME}}': 'Data Protection Essentials',
      '{{COURSE_ID}}': 'COURSE-001',
      '{{ORGANISATION_NAME}}': 'Sample Organisation Ltd',
      '{{ADMIN_NAME}}': 'Sarah Johnson',
      '{{SCORE_PERCENT}}': '92%',
      '{{PASS_FAIL}}': 'PASS',
      '{{DATE_COMPLETED}}': new Date().toLocaleDateString(),
      '{{CERTIFICATE_ID}}': 'CERT-2024-001',
      '{{BACKGROUND_IMAGE}}': backgroundImage ? `<img src="${backgroundImage}" alt="Certificate Background" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1;" />` : '',
      '{{SIGNATURE_IMAGE}}': signatureImage ? `<img src="${signatureImage}" alt="Signature" style="max-width: 200px; height: auto;" />` : ''
    };

    let preview = templateEditor;
    Object.entries(sampleData).forEach(([placeholder, value]) => {
      preview = preview.replace(new RegExp(placeholder, 'g'), value);
    });

    return preview;
  };

  const tabs = ["Certificate Settings", "Platform Options", "Email Settings", "Data Management"];

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a onClick={() => setLocation('/superadmin')} className="cursor-pointer" data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Settings</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Settings</h1>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          {/* Tabs */}
          <div className="tabs tabs-bordered mb-6">
            {tabs.map((tab, index) => (
              <a 
                key={index}
                className={`tab ${activeTab === index ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(index)}
                data-testid={`tab-${index}`}
              >
                {tab}
              </a>
            ))}
          </div>

          {/* Certificate Settings Tab */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Certificate Template</h3>
                <p className="text-base-content/70 mb-6">
                  Upload a PDF template that will be used for all certificates generated on the system. 
                  The PDF should contain placeholders that will be replaced with actual data when certificates are generated.
                </p>
              </div>

              {/* PDF Template Upload */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h4 className="font-semibold mb-4">PDF Template Upload</h4>
                  
                  <div className="form-control mb-6">
                    <label className="label">
                      <span className="label-text">Certificate PDF Template</span>
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf"
                      className="file-input file-input-bordered w-full"
                      onChange={handlePdfFileChange}
                      data-testid="input-pdf-template"
                    />
                    <div className="label">
                      <span className="label-text-alt">Upload a PDF file that contains your certificate template</span>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <button 
                      className="btn btn-primary" 
                      onClick={handlePdfUpload}
                      disabled={!selectedPdfFile || uploadPdfTemplateMutation.isPending}
                      data-testid="button-save-pdf-template"
                    >
                      {uploadPdfTemplateMutation.isPending ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        <i className="fas fa-upload"></i>
                      )}
                      {currentPdfTemplate ? 'Update PDF Template' : 'Upload PDF Template'}
                    </button>
                    {selectedPdfFile && (
                      <div className="text-sm text-base-content/70">
                        Selected: {selectedPdfFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Available Placeholders */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h4 className="font-semibold mb-4">Available Placeholders</h4>
                  <p className="text-sm text-base-content/60 mb-4">
                    Include these placeholders in your PDF template. They will be replaced with actual data when certificates are generated.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card bg-base-200">
                      <div className="card-body p-4">
                        <h5 className="font-medium mb-2">Learner Information</h5>
                        <div className="space-y-1">
                          <code className="block text-sm bg-base-300 px-2 py-1 rounded">{'{{learner_name}}'}</code>
                          <p className="text-xs text-base-content/60">Full name of the learner</p>
                        </div>
                      </div>
                    </div>

                    <div className="card bg-base-200">
                      <div className="card-body p-4">
                        <h5 className="font-medium mb-2">Course Information</h5>
                        <div className="space-y-1">
                          <code className="block text-sm bg-base-300 px-2 py-1 rounded">{'{{course_name}}'}</code>
                          <p className="text-xs text-base-content/60">Name of the completed course</p>
                        </div>
                      </div>
                    </div>

                    <div className="card bg-base-200">
                      <div className="card-body p-4">
                        <h5 className="font-medium mb-2">Completion Information</h5>
                        <div className="space-y-1">
                          <code className="block text-sm bg-base-300 px-2 py-1 rounded">{'{{completion_date}}'}</code>
                          <p className="text-xs text-base-content/60">Date when the course was completed</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-info/10 rounded-lg">
                    <h6 className="font-medium text-info mb-2">How to use placeholders:</h6>
                    <ol className="list-decimal list-inside text-sm space-y-1 text-base-content/70">
                      <li>Add text boxes or editable fields to your PDF template</li>
                      <li>Insert the placeholder text exactly as shown above (including the curly braces)</li>
                      <li>When certificates are generated, these placeholders will be replaced with real data</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Current Template Status */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h4 className="font-semibold mb-4">Current Template Status</h4>
                  {templatesLoading ? (
                    <div className="flex justify-center py-4">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  ) : currentPdfTemplate ? (
                    <div className="flex items-center gap-4">
                      <div className="avatar placeholder">
                        <div className="bg-success text-success-content rounded-full w-12">
                          <i className="fas fa-file-pdf text-xl"></i>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{currentPdfTemplate.name}</p>
                        <p className="text-sm text-base-content/60">
                          Uploaded: {new Date(currentPdfTemplate.createdAt).toLocaleDateString()}
                          {currentPdfTemplate.updatedAt !== currentPdfTemplate.createdAt && 
                            ` • Updated: ${new Date(currentPdfTemplate.updatedAt).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                      <div className="badge badge-success">Active</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="avatar placeholder">
                        <div className="bg-neutral text-neutral-content rounded-full w-12">
                          <i className="fas fa-file-pdf text-xl"></i>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">No PDF template uploaded</p>
                        <p className="text-sm text-base-content/60">Upload a PDF template to enable certificate generation</p>
                      </div>
                      <div className="badge badge-warning">Not Set</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Platform Options Tab */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Platform Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Default Theme for New Organisations</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={platformSettings.defaultTheme}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, defaultTheme: e.target.value }))}
                    data-testid="select-default-theme"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="corporate">Corporate</option>
                    <option value="business">Business</option>
                    <option value="emerald">Emerald</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="pastel">Pastel</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Certificate Expiry Display</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={platformSettings.defaultCertificateExpiry}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, defaultCertificateExpiry: e.target.value }))}
                    data-testid="select-cert-expiry-display"
                  >
                    <option value="show">Show expiry date on certificates</option>
                    <option value="hide">Hide expiry date on certificates</option>
                  </select>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Password Policy Text</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered h-24" 
                  value={platformSettings.passwordPolicy}
                  onChange={(e) => setPlatformSettings(prev => ({ ...prev, passwordPolicy: e.target.value }))}
                  data-testid="textarea-password-policy"
                ></textarea>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Footer Links</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Privacy Policy | Terms of Service | Contact Support" 
                  className="input input-bordered"
                  value={platformSettings.footerLinks}
                  onChange={(e) => setPlatformSettings(prev => ({ ...prev, footerLinks: e.target.value }))}
                  data-testid="input-footer-links"
                />
                <label className="label">
                  <span className="label-text-alt">Separate links with | (pipe) characters</span>
                </label>
              </div>

              <div className="flex justify-end">
                <button className="btn btn-primary" data-testid="button-save-platform-settings">
                  <i className="fas fa-save"></i> Save Platform Settings
                </button>
              </div>
            </div>
          )}

          {/* Email Settings Tab */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Platform Email Settings</h3>
                <div className="flex gap-2">
                  <button 
                    className={`btn btn-outline btn-sm ${testEmailMutation.isPending ? 'loading' : ''}`}
                    data-testid="button-test-email"
                    onClick={openTestEmailModal}
                    disabled={testEmailMutation.isPending || !emailSettings.fromEmail}
                    title="Send test email using platform settings"
                  >
                    <i className={`fas ${testEmailMutation.isPending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                    {testEmailMutation.isPending ? 'Sending...' : 'Test Email'}
                  </button>
                  <button 
                    className={`btn btn-primary btn-sm ${saveEmailSettingsMutation.isPending ? 'loading' : ''}`}
                    onClick={handleSaveEmailSettings}
                    disabled={saveEmailSettingsMutation.isPending}
                    data-testid="button-save-email-settings"
                  >
                    <i className="fas fa-save"></i>
                    {saveEmailSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <div>
                  <div className="font-bold">Platform Email Defaults</div>
                  <div className="text-sm">
                    These settings serve as defaults when organizations don't configure their own email settings. Organizations can override these with their own provider configuration.
                  </div>
                </div>
              </div>

              {emailLoading ? (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Provider Selection */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">Email Provider</span>
                    </label>
                    <select 
                      className="select select-bordered"
                      value={emailSettings.provider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      data-testid="select-email-provider"
                    >
                      {Object.entries(emailProviders).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.name} {config.type === 'api' ? '(API)' : '(SMTP)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Provider Information */}
                  <div className="alert alert-info">
                    <i className={`fas ${emailProviders[emailSettings.provider].type === 'api' ? 'fa-key' : 'fa-server'}`}></i>
                    <div>
                      <div className="font-bold">{emailProviders[emailSettings.provider].name}</div>
                      <div className="text-sm">
                        {emailProviders[emailSettings.provider].instructions}
                        {emailProviders[emailSettings.provider].website && (
                          <span>
                            {' '}
                            <a 
                              href={emailProviders[emailSettings.provider].website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="link text-info"
                            >
                              Visit website →
                            </a>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Common Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">From Email *</span>
                      </label>
                      <input 
                        type="email" 
                        className="input input-bordered" 
                        placeholder="platform@yourdomain.com"
                        value={emailSettings.fromEmail}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, fromEmail: e.target.value }))}
                        data-testid="input-from-email"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">From Name *</span>
                      </label>
                      <input 
                        type="text" 
                        className="input input-bordered" 
                        placeholder="LMS Platform"
                        value={emailSettings.fromName}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, fromName: e.target.value }))}
                        data-testid="input-from-name"
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Reply To Email</span>
                    </label>
                    <input 
                      type="email" 
                      className="input input-bordered" 
                      placeholder="Optional reply-to address"
                      value={emailSettings.replyTo}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, replyTo: e.target.value }))}
                      data-testid="input-reply-to"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Description</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      placeholder="Platform email configuration"
                      value={emailSettings.description}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, description: e.target.value }))}
                      data-testid="input-description"
                    />
                  </div>

                  {/* SMTP Provider Fields */}
                  {emailSettings.provider === 'smtp_generic' && (
                    <div className="space-y-4">
                      <div className="divider">SMTP Configuration</div>
                      
                      {/* SMTP Preset Selection */}
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">SMTP Preset</span>
                        </label>
                        <select 
                          className="select select-bordered"
                          onChange={(e) => handleSMTPPresetChange(e.target.value)}
                          data-testid="select-smtp-preset"
                        >
                          <option value="">Select a preset or configure manually</option>
                          {Object.keys(emailProviders.smtp_generic.presets).map(preset => (
                            <option key={preset} value={preset}>{preset}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">SMTP Host *</span>
                          </label>
                          <input 
                            type="text" 
                            className="input input-bordered" 
                            placeholder="smtp.example.com"
                            value={emailSettings.smtpHost}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpHost: e.target.value }))}
                            data-testid="input-smtp-host"
                          />
                        </div>

                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">SMTP Port *</span>
                          </label>
                          <input 
                            type="number" 
                            className="input input-bordered" 
                            placeholder="587"
                            value={emailSettings.smtpPort}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpPort: e.target.value }))}
                            data-testid="input-smtp-port"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">SMTP Username *</span>
                          </label>
                          <input 
                            type="text" 
                            className="input input-bordered" 
                            placeholder="username@example.com"
                            value={emailSettings.smtpUsername}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpUsername: e.target.value }))}
                            data-testid="input-smtp-username"
                          />
                        </div>

                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">SMTP Password *</span>
                          </label>
                          <input 
                            type="password" 
                            className="input input-bordered" 
                            placeholder={emailSettings.smtpPassword && emailSettings.smtpPassword.startsWith('••') ? "Password configured" : "Enter password"}
                            value={emailSettings.smtpPassword}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpPassword: e.target.value }))}
                            data-testid="input-smtp-password"
                          />
                          {emailSettings.smtpPassword && emailSettings.smtpPassword.startsWith('••') && (
                            <div className="label">
                              <span className="label-text-alt text-success">✓ Password is configured. Leave blank to keep existing password.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-3">
                          <input 
                            type="checkbox" 
                            className="checkbox" 
                            checked={emailSettings.smtpSecure}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpSecure: e.target.checked }))}
                            data-testid="checkbox-smtp-secure"
                          />
                          <span className="label-text">Use TLS/STARTTLS encryption (recommended)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* API Provider Fields */}
                  {emailSettings.provider !== 'smtp_generic' && (
                    <div className="space-y-4">
                      <div className="divider">API Configuration</div>
                      
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold">API Key *</span>
                        </label>
                        <input 
                          type="password" 
                          className="input input-bordered" 
                          placeholder={emailSettings.apiKey && emailSettings.apiKey.startsWith('••') ? "API key configured" : "Enter your API key"}
                          value={emailSettings.apiKey}
                          onChange={(e) => setEmailSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                          data-testid="input-api-key"
                        />
                        {emailSettings.apiKey && emailSettings.apiKey.startsWith('••') && (
                          <div className="label">
                            <span className="label-text-alt text-success">✓ API key is configured. Leave blank to keep existing key.</span>
                          </div>
                        )}
                      </div>

                      {emailSettings.provider === 'mailjet_api' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">API Secret *</span>
                          </label>
                          <input 
                            type="password" 
                            className="input input-bordered" 
                            placeholder={emailSettings.apiSecret && emailSettings.apiSecret.startsWith('••') ? "API secret configured" : "Enter your API secret"}
                            value={emailSettings.apiSecret}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, apiSecret: e.target.value }))}
                            data-testid="input-api-secret"
                          />
                          {emailSettings.apiSecret && emailSettings.apiSecret.startsWith('••') && (
                            <div className="label">
                              <span className="label-text-alt text-success">✓ API secret is configured. Leave blank to keep existing secret.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {emailSettings.provider === 'mailgun_api' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">API Domain *</span>
                          </label>
                          <input 
                            type="text" 
                            className="input input-bordered" 
                            placeholder="mg.yourdomain.com"
                            value={emailSettings.apiDomain}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, apiDomain: e.target.value }))}
                            data-testid="input-api-domain"
                          />
                          <div className="label">
                            <span className="label-text-alt">Use your verified Mailgun domain</span>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* Help Section */}
                  <div className="alert alert-warning">
                    <i className="fas fa-exclamation-triangle"></i>
                    <div>
                      <div className="font-bold">Important Notes</div>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        <li>These settings are used when organizations don't have their own email configuration</li>
                        <li>For Gmail, use App Passwords instead of your regular password</li>
                        <li>Test the configuration before saving to ensure emails work properly</li>
                        <li>Organizations with custom email settings will use their own configuration</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Email Modal */}
              {showTestEmailModal && (
                <div className="modal modal-open">
                  <div className="modal-box">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">Send Test Email</h3>
                      <button 
                        className="btn btn-sm btn-circle btn-ghost"
                        onClick={closeTestEmailModal}
                        data-testid="button-close-test-email-modal"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Enter the email address where you want to send the test email to verify your system SMTP configuration.
                      </p>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Email Address *</span>
                        </label>
                        <input 
                          type="email" 
                          className="input input-bordered" 
                          placeholder="test@example.com"
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                          data-testid="input-test-email-address"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button 
                          className="btn btn-outline"
                          onClick={closeTestEmailModal}
                          data-testid="button-cancel-test-email"
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn btn-primary"
                          onClick={sendTestEmailToAddress}
                          disabled={testEmailMutation.isPending || !testEmailAddress}
                          data-testid="button-send-test-email"
                        >
                          <i className={`fas ${testEmailMutation.isPending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                          {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Management Tab */}
          {activeTab === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Database Management</h3>
                <p className="text-sm text-base-content/60">
                  Manage platform data and perform cleanup operations.
                </p>
              </div>

              <div className="divider"></div>

              {/* Delete Test Data Section */}
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle"></i>
                <div className="flex-1">
                  <h3 className="font-bold">Delete All Test Data</h3>
                  <div className="text-sm mt-2">
                    <p className="mb-2">This action will permanently delete:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>All organizations and their settings</li>
                      <li>All users except the SuperAdmin account</li>
                      <li>All courses and course assignments</li>
                      <li>All completions and certificates</li>
                      <li>All SCORM attempts and progress</li>
                    </ul>
                    <p className="mt-3 font-semibold">Your SuperAdmin account will be preserved.</p>
                    <p className="mt-2 text-xs opacity-70">
                      This operation cannot be undone. Make sure you want to proceed before clicking the button below.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  className="btn btn-error"
                  onClick={() => {
                    const modal = document.getElementById('delete-test-data-modal') as HTMLDialogElement;
                    modal?.showModal();
                  }}
                  data-testid="button-delete-test-data"
                >
                  <i className="fas fa-trash"></i>
                  Delete All Test Data
                </button>
              </div>

              {/* Confirmation Modal */}
              <dialog id="delete-test-data-modal" className="modal">
                <div className="modal-box">
                  <h3 className="font-bold text-lg text-error">
                    <i className="fas fa-exclamation-triangle mr-2"></i>
                    Confirm Data Deletion
                  </h3>
                  <p className="py-4">
                    Are you absolutely sure you want to delete all test data? 
                    This action cannot be undone and will remove all organizations, users (except SuperAdmin), 
                    courses, and related data from the database.
                  </p>
                  <div className="modal-action">
                    <form method="dialog">
                      <button className="btn btn-ghost mr-2" data-testid="button-cancel-deletion">
                        Cancel
                      </button>
                      <button
                        className="btn btn-error"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const response = await apiRequest('POST', '/api/superadmin/delete-test-data');
                            const data = await response.json();
                            
                            if (data.success) {
                              toast({
                                title: "Success",
                                description: `Test data deleted successfully. Removed: ${data.deleted.users || 0} users, ${data.deleted.organisations || 0} orgs, ${data.deleted.courses || 0} courses`,
                              });
                              
                              // Close modal
                              const modal = document.getElementById('delete-test-data-modal') as HTMLDialogElement;
                              modal?.close();
                              
                              // Refresh page data
                              queryClient.invalidateQueries();
                            } else {
                              throw new Error(data.message || 'Failed to delete test data');
                            }
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to delete test data",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid="button-confirm-deletion"
                      >
                        <i className="fas fa-trash"></i>
                        Yes, Delete Everything
                      </button>
                    </form>
                  </div>
                </div>
              </dialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
