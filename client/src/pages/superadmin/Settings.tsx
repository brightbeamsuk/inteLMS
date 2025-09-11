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
      requiredFields: ['fromEmail', 'fromName', 'smtpHost', 'smtpUsername', 'smtpPassword']
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
      setEmailSettings({
        provider: (systemEmailData as any).provider || 'brevo_api',
        fromEmail: systemEmailData.fromEmail || '',
        fromName: systemEmailData.fromName || '',
        replyTo: (systemEmailData as any).replyTo || '',
        description: systemEmailData.description || '',
        // SMTP fields
        smtpHost: systemEmailData.smtpHost || '',
        smtpPort: systemEmailData.smtpPort?.toString() || '587',
        smtpUsername: systemEmailData.smtpUsername || '',
        smtpPassword: '', // Never populate password for security
        smtpSecure: systemEmailData.smtpSecure !== false,
        // API fields - show masked indicators when credentials exist
        apiKey: systemEmailData.apiKey || '',
        apiSecret: systemEmailData.apiSecret || '',
        apiBaseUrl: (systemEmailData as any).apiBaseUrl || '',
        apiDomain: (systemEmailData as any).apiDomain || '',
        apiRegion: (systemEmailData as any).apiRegion || '',
        hasPassword: systemEmailData.hasPassword || false,
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
    if (config && config.presets[preset]) {
      const presetConfig = config.presets[preset];
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

      // SES requires region
      if (emailSettings.provider === 'ses_api' && !emailSettings.apiRegion) {
        toast({
          title: "Error",
          description: "Amazon SES requires an AWS region selection",
          variant: "destructive",
        });
        return;
      }
    }

    // Prepare settings for saving
    const settingsToSave = { ...emailSettings };
    
    // Clean up empty fields that shouldn't be sent
    if (emailSettings.provider !== 'smtp_generic') {
      // Remove SMTP fields for API providers
      delete settingsToSave.smtpHost;
      delete settingsToSave.smtpPort;
      delete settingsToSave.smtpUsername;
      delete settingsToSave.smtpPassword;
      delete settingsToSave.smtpSecure;
    } else {
      // Remove API fields for SMTP
      delete settingsToSave.apiKey;
      delete settingsToSave.apiSecret;
      delete settingsToSave.apiBaseUrl;
      delete settingsToSave.apiDomain;
      delete settingsToSave.apiRegion;
      
      // Handle masked password for SMTP
      if (!settingsToSave.smtpPassword && settingsToSave.smtpPassword?.startsWith('••')) {
        delete settingsToSave.smtpPassword;
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

  const tabs = ["Certificate Templates", "Platform Options", "Email Settings"];

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

          {/* Certificate Templates Tab */}
          {activeTab === 0 && (
            <div className="space-y-6">
              {/* Editor Mode Toggle */}
              <div className="flex gap-2 mb-6">
                <button 
                  className={`btn btn-sm ${useVisualEditor ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setUseVisualEditor(true)}
                  data-testid="button-visual-editor"
                >
                  <i className="fas fa-palette"></i> Visual Editor
                </button>
                <button 
                  className={`btn btn-sm ${!useVisualEditor ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setUseVisualEditor(false)}
                  data-testid="button-html-editor"
                >
                  <i className="fas fa-code"></i> HTML Editor
                </button>
              </div>

              {useVisualEditor ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Visual Certificate Template Builder</h3>
                  <VisualCertificateEditor 
                    onSave={handleVisualTemplateSave}
                    initialTemplate={currentVisualTemplate || undefined}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Template Editor */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">HTML Certificate Template Builder</h3>
                    
                    <div className="form-control mb-4">
                      <label className="label">
                        <span className="label-text">Template Name</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Default Platform Template" 
                        className="input input-bordered"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        data-testid="input-template-name"
                      />
                    </div>

                    <div className="form-control mb-4">
                      <label className="label">
                        <span className="label-text">Template HTML</span>
                      </label>
                      <textarea 
                        className="textarea textarea-bordered h-64" 
                        placeholder="Enter your certificate template HTML here..."
                        value={templateEditor}
                        onChange={(e) => setTemplateEditor(e.target.value)}
                        data-testid="textarea-template-editor"
                      ></textarea>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <button 
                        className="btn btn-primary"
                        onClick={handleSaveTemplate}
                        disabled={saveTemplateMutation.isPending}
                        data-testid="button-save-template"
                      >
                        {saveTemplateMutation.isPending ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          <i className="fas fa-save"></i>
                        )}
                        {editingTemplateId ? 'Update Template' : 'Save Template'}
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setShowPreview(!showPreview)}
                        data-testid="button-preview-template"
                      >
                        <i className="fas fa-eye"></i> {showPreview ? 'Hide Preview' : 'Show Preview'}
                      </button>
                      {editingTemplateId && (
                        <button 
                          className="btn btn-outline"
                          onClick={clearEditor}
                          data-testid="button-clear-template"
                        >
                          <i className="fas fa-times"></i> Cancel Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Placeholders Panel */}
                  <div>
                  <h3 className="text-lg font-semibold mb-4">Available Placeholders</h3>
                  <p className="text-sm text-base-content/60 mb-4">Click to insert into template</p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {availablePlaceholders.map((placeholder) => (
                      <button
                        key={placeholder}
                        className="btn btn-sm btn-outline justify-start"
                        onClick={() => insertPlaceholder(placeholder)}
                        data-testid={`button-placeholder-${placeholder.replace(/[{}]/g, '').toLowerCase()}`}
                      >
                        <code className="text-xs">{placeholder}</code>
                      </button>
                    ))}
                  </div>

                  <div className="divider"></div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Template Options</h4>
                    <div className="text-sm text-gray-600 mb-4">
                      Upload images and use {`{{BACKGROUND_IMAGE}}`} and {`{{SIGNATURE_IMAGE}}`} placeholders in your template
                    </div>
                    
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Background Image</span>
                      </label>
                      <ImageUpload
                        imageType="certificate-bg"
                        currentImageUrl={backgroundImage || undefined}
                        onImageUploaded={(publicPath) => setBackgroundImage(publicPath)}
                        buttonClassName="btn btn-outline w-full"
                        previewClassName="w-32 h-20 object-cover rounded border"
                      >
                        <button 
                          className="btn btn-xs btn-error ml-2"
                          onClick={() => setBackgroundImage(null)}
                          data-testid="button-remove-background"
                        >
                          Remove
                        </button>
                      </ImageUpload>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Signature Image</span>
                      </label>
                      <ImageUpload
                        imageType="certificate-signature"
                        currentImageUrl={signatureImage || undefined}
                        onImageUploaded={(publicPath) => setSignatureImage(publicPath)}
                        buttonClassName="btn btn-outline w-full"
                        previewClassName="w-32 h-20 object-cover rounded border"
                      >
                        <button 
                          className="btn btn-xs btn-error ml-2"
                          onClick={() => setSignatureImage(null)}
                          data-testid="button-remove-signature"
                        >
                          Remove
                        </button>
                      </ImageUpload>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Font Family</span>
                      </label>
                      <select className="select select-bordered" data-testid="select-font-family">
                        <option value="Georgia">Georgia (serif)</option>
                        <option value="Arial">Arial (sans-serif)</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Helvetica">Helvetica</option>
                      </select>
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* Template Preview */}
              {showPreview && (
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body">
                    <h3 className="text-lg font-semibold mb-4">Preview with Sample Data</h3>
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <div 
                        className="certificate-preview border bg-white rounded-lg min-h-[400px] relative overflow-hidden" 
                        style={{ 
                          position: 'relative',
                          padding: '1rem',
                          ...(backgroundImage && {
                            backgroundImage: `url('${backgroundImage}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          })
                        }}
                        dangerouslySetInnerHTML={{ __html: previewTemplate() }}
                        data-testid="preview-certificate"
                      ></div>
                      {(backgroundImage || signatureImage) && (
                        <div className="mt-4 text-sm text-gray-600">
                          <p><strong>Note:</strong> This preview shows your uploaded images.</p>
                          {backgroundImage && <p>✓ Background image is applied</p>}
                          {signatureImage && <p>✓ Signature image is applied</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Templates */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4">Existing Templates</h3>
                  {templatesLoading ? (
                    <div className="flex justify-center py-4">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  ) : (templates as CertificateTemplate[]).length === 0 ? (
                    <p className="text-base-content/60 text-center py-4">No templates created yet</p>
                  ) : (
                    <div className="space-y-3">
                      {(templates as CertificateTemplate[]).map((template: CertificateTemplate) => (
                        <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-semibold">{template.name}</h4>
                            <p className="text-sm text-base-content/60">
                              Created: {new Date(template.createdAt).toLocaleDateString()}
                              {template.isDefault && <span className="badge badge-primary badge-sm ml-2">Default</span>}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              className="btn btn-sm btn-outline"
                              onClick={() => editTemplate(template)}
                              data-testid={`button-edit-template-${template.id}`}
                            >
                              <i className="fas fa-edit"></i> Edit
                            </button>
                            <button 
                              className="btn btn-sm btn-error btn-outline"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this template?')) {
                                  deleteTemplateMutation.mutate(template.id);
                                }
                              }}
                              disabled={deleteTemplateMutation.isPending}
                              data-testid={`button-delete-template-${template.id}`}
                            >
                              <i className="fas fa-trash"></i> Delete
                            </button>
                          </div>
                        </div>
                      ))}
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

                      {emailSettings.provider === 'ses_api' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold">AWS Region *</span>
                          </label>
                          <select 
                            className="select select-bordered"
                            value={emailSettings.apiRegion}
                            onChange={(e) => setEmailSettings(prev => ({ ...prev, apiRegion: e.target.value }))}
                            data-testid="select-aws-region"
                          >
                            <option value="">Select AWS region</option>
                            <option value="us-east-1">US East (N. Virginia)</option>
                            <option value="us-west-2">US West (Oregon)</option>
                            <option value="eu-west-1">Europe (Ireland)</option>
                            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                          </select>
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
        </div>
      </div>
    </div>
  );
}
