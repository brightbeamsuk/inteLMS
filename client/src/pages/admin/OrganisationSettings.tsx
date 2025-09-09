import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { VisualCertificateEditor } from "@/components/VisualCertificateEditor";
import type { UploadResult } from "@uppy/core";

interface OrganisationSettings {
  organisationId: string;
  assignmentEmailsEnabled: boolean;
  reminderEmailsEnabled: boolean;
  completionEmailsEnabled: boolean;
  reminderDays: number;
  defaultCertificateDownload: boolean;
}

interface Organisation {
  id: string;
  name: string;
  planId?: string;
  logoUrl?: string;
  displayName?: string;
  subdomain?: string;
  primaryColor?: string;
  accentColor?: string;
  useCustomColors?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export function AdminOrganisationSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch current organization data
  const { data: organization, isLoading: orgLoading } = useQuery<Organisation>({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  // Fetch plan features to check access
  const { data: planFeatures = [] } = useQuery({
    queryKey: ['/api/plan-features/mappings', organization?.planId],
    enabled: !!organization?.planId,
    queryFn: async () => {
      const response = await fetch(`/api/plan-features/mappings/${organization?.planId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch plan features');
      }
      return response.json();
    },
  });

  const [brandingData, setBrandingData] = useState({
    logoUrl: "",
    displayName: "",
    subdomain: "",
    primaryColor: "#3b82f6",
    accentColor: "#3b82f6",
    useCustomColors: false,
  });

  const [contactData, setContactData] = useState({
    email: "",
    phone: "",
    address: "",
  });


  const [notificationData, setNotificationData] = useState({
    assignmentEmailsEnabled: true,
    reminderEmailsEnabled: true,
    completionEmailsEnabled: true,
    reminderDays: 7,
  });

  const [privacyData, setPrivacyData] = useState({
    defaultCertificateDownload: false,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  
  const [emailSettings, setEmailSettings] = useState({
    provider: 'custom',
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    useSecure: true,
  });

  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const handleEditTemplate = (templateType: string) => {
    const defaultTemplate = getDefaultTemplate(templateType);
    setSelectedTemplate(templateType);
    setTemplateSubject(defaultTemplate.subject);
    setTemplateContent(defaultTemplate.content);
    setShowTemplateEditor(true);
  };

  const handleCloseTemplateEditor = () => {
    setShowTemplateEditor(false);
    setSelectedTemplate(null);
    setTemplateSubject('');
    setTemplateContent('');
  };

  const getTemplateDisplayName = (templateType: string) => {
    const names: Record<string, string> = {
      'welcome_email': 'Welcome Email',
      'course_assignment': 'Course Assignment',
      'course_reminder': 'Course Reminder', 
      'course_completion': 'Course Completion',
      'password_reset': 'Password Reset'
    };
    return names[templateType] || templateType;
  };

  const getDefaultTemplate = (templateType: string) => {
    const templates: Record<string, { subject: string; content: string }> = {
      'welcome_email': {
        subject: 'Welcome to {{organisationDisplayName}} Learning Platform',
        content: `Dear {{firstName}} {{lastName}},

Welcome to {{organisationDisplayName}}! We're excited to have you join our learning platform.

Your account has been successfully created with the following details:
• Email: {{email}}
• Organization: {{organisationDisplayName}}
• Job Title: {{jobTitle}}

You can now log in to access your assigned training courses and track your progress.

If you have any questions or need assistance, please don't hesitate to contact your administrator.

Best regards,
The {{organisationDisplayName}} Team`
      },
      'course_assignment': {
        subject: 'New Course Assigned: {{courseTitle}}',
        content: `Hello {{firstName}},

You have been assigned a new training course: {{courseTitle}}

Course Details:
• Course: {{courseTitle}}
• Due Date: {{dueDate}}
• Estimated Duration: {{estimatedDuration}} minutes
• Organization: {{organisationDisplayName}}

Please log in to your learning platform to begin this course. Make sure to complete it before the due date.

If you have any questions about this course, please contact your administrator.

Best regards,
The {{organisationDisplayName}} Team`
      },
      'course_reminder': {
        subject: 'Reminder: {{courseTitle}} Due Soon',
        content: `Hello {{firstName}},

This is a friendly reminder that your course "{{courseTitle}}" is due soon.

Course Details:
• Course: {{courseTitle}}
• Due Date: {{dueDate}}
• Organization: {{organisationDisplayName}}

Please log in to your learning platform to complete this course before the deadline.

If you have already completed this course, please disregard this message.

Best regards,
The {{organisationDisplayName}} Team`
      },
      'course_completion': {
        subject: 'Course Completed: {{courseTitle}}',
        content: `Dear {{firstName}},

Congratulations! You have successfully completed the course "{{courseTitle}}".

Completion Details:
• Course: {{courseTitle}}
• Completion Date: {{completedAt}}
• Score: {{score}}%
• Status: {{status}}
• Time Spent: {{timeSpent}} minutes
• Organization: {{organisationDisplayName}}

Your certificate is now available for download from your learning platform and will expire on {{certificateExpiryDate}} (if applicable).

Thank you for your dedication to professional development.

Best regards,
The {{organisationDisplayName}} Team`
      },
      'password_reset': {
        subject: 'Password Reset Request - {{organisationDisplayName}}',
        content: `Hello {{firstName}},

We received a request to reset your password for your {{organisationDisplayName}} learning platform account.

Account Details:
• Email: {{email}}
• Job Title: {{jobTitle}}
• Organization: {{organisationDisplayName}}

If you requested this password reset, please follow the instructions provided by your administrator to set a new password.

If you did not request this password reset, please contact your administrator immediately.

Best regards,
The {{organisationDisplayName}} Team`
      }
    };
    
    return templates[templateType] || { subject: '', content: '' };
  };

  // Email provider configurations
  const emailProviders = {
    gmail: {
      name: 'Gmail',
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      useSecure: true,
      instructions: 'Use your Gmail address and App Password (not your regular password)'
    },
    outlook: {
      name: 'Outlook/Hotmail',
      smtpHost: 'smtp-mail.outlook.com',
      smtpPort: '587', 
      useSecure: true,
      instructions: 'Use your Outlook address and App Password'
    },
    brevo: {
      name: 'Brevo (Sendinblue)',
      smtpHost: 'smtp-relay.brevo.com',
      smtpPort: '587',
      useSecure: true,
      instructions: 'Use your Brevo login email and SMTP Key (not login password)'
    },
    sendgrid: {
      name: 'SendGrid',
      smtpHost: 'smtp.sendgrid.net',
      smtpPort: '587',
      useSecure: true,
      instructions: 'Use "apikey" as username and your SendGrid API key as password'
    },
    mailgun: {
      name: 'Mailgun',
      smtpHost: 'smtp.mailgun.org',
      smtpPort: '587',
      useSecure: true,
      instructions: 'Use your Mailgun SMTP credentials from your domain settings'
    },
    amazon_ses: {
      name: 'Amazon SES',
      smtpHost: 'email-smtp.us-east-1.amazonaws.com',
      smtpPort: '587',
      useSecure: true,
      instructions: 'Use your AWS SES SMTP username and password'
    },
    custom: {
      name: 'Custom SMTP Server',
      smtpHost: '',
      smtpPort: '587',
      useSecure: true,
      instructions: 'Enter your custom SMTP server details'
    }
  };

  const handleProviderChange = (provider: string) => {
    const config = emailProviders[provider as keyof typeof emailProviders];
    if (config) {
      setEmailSettings(prev => ({
        ...prev,
        provider,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        useSecure: config.useSecure,
        // Keep existing credentials but clear if switching provider
        smtpUsername: provider === prev.provider ? prev.smtpUsername : '',
        smtpPassword: provider === prev.provider ? prev.smtpPassword : '',
        fromEmail: provider === prev.provider ? prev.fromEmail : '',
        fromName: provider === prev.provider ? prev.fromName : '',
      }));
    }
  };

  // Load organization data when it becomes available
  useEffect(() => {
    if (organization) {
      setBrandingData({
        logoUrl: organization.logoUrl || "",
        displayName: organization.displayName || "",
        subdomain: organization.subdomain || "",
        primaryColor: organization.primaryColor || "#3b82f6",
        accentColor: organization.accentColor || "#3b82f6", 
        useCustomColors: organization.useCustomColors || false,
      });
      setContactData({
        email: organization.contactEmail || "",
        phone: organization.contactPhone || "",
        address: organization.address || "",
      });
    }
  }, [organization]);

  // Check if custom domain feature is enabled
  const customDomainFeature = planFeatures.find((feature: any) => feature.featureId === 'custom_domain');
  const hasCustomDomainAccess = customDomainFeature?.enabled || false;

  // Check if remove branding feature is enabled
  const removeBrandingFeature = planFeatures.find((feature: any) => feature.featureId === 'remove_branding');
  const hasBrandingAccess = removeBrandingFeature?.enabled || false;

  // Check if custom email templates feature is enabled
  const emailTemplatesFeature = planFeatures.find((feature: any) => feature.featureId === 'custom_email_templates');
  const hasEmailTemplatesAccess = emailTemplatesFeature?.enabled || false;

  const handleLogoUpload = async () => {
    try {
      const response = await apiRequest('POST', '/api/objects/upload', {});
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleLogoComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadUrl = result.successful[0].uploadURL as string;
      setBrandingData(prev => ({ ...prev, logoUrl: uploadUrl }));
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    }
  };


  // Save organization data mutation
  const saveOrganizationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/organisations/${user?.organisationId}`, data);
    },
    onSuccess: () => {
      // Invalidate organization queries to refresh data everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      
      // Force a page refresh for color changes to take immediate effect
      if (brandingData.useCustomColors) {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
      
      toast({
        title: "Success",
        description: "Organization settings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const saveSettings = () => {
    if (!user?.organisationId) return;

    const organizationData = {
      logoUrl: brandingData.logoUrl,
      displayName: brandingData.displayName,
      subdomain: brandingData.subdomain,
      accentColor: brandingData.accentColor,
      primaryColor: brandingData.primaryColor,
      useCustomColors: brandingData.useCustomColors,
      contactEmail: contactData.email,
      contactPhone: contactData.phone,
      address: contactData.address,
    };

    saveOrganizationMutation.mutate(organizationData);
  };

  // Fetch organisation settings including email settings
  const { data: orgSettings } = useQuery({
    queryKey: ['/api/organisations', user?.organisationId],
    queryFn: async () => {
      const response = await fetch(`/api/organisations/${user?.organisationId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch organisation settings');
      }
      return response.json();
    },
    enabled: !!user?.organisationId,
  });

  // Load email settings when org settings become available
  useEffect(() => {
    if (orgSettings) {
      // Determine provider based on existing settings
      let detectedProvider = 'custom';
      if (orgSettings.smtpHost) {
        for (const [key, config] of Object.entries(emailProviders)) {
          if (config.smtpHost === orgSettings.smtpHost) {
            detectedProvider = key;
            break;
          }
        }
      }

      setEmailSettings({
        provider: detectedProvider,
        smtpHost: orgSettings.smtpHost || '',
        smtpPort: orgSettings.smtpPort?.toString() || '587',
        smtpUsername: orgSettings.smtpUsername || '',
        smtpPassword: orgSettings.smtpPassword || '',
        fromEmail: orgSettings.fromEmail || '',
        fromName: orgSettings.fromName || '',
        useSecure: orgSettings.smtpSecure !== false,
      });
      setNotificationData({
        assignmentEmailsEnabled: orgSettings.assignmentEmailsEnabled !== false,
        reminderEmailsEnabled: orgSettings.reminderEmailsEnabled !== false,
        completionEmailsEnabled: orgSettings.completionEmailsEnabled !== false,
        reminderDays: orgSettings.reminderDays || 7,
      });
      setPrivacyData({
        defaultCertificateDownload: orgSettings.defaultCertificateDownload || false,
      });
    }
  }, [orgSettings]);

  // Save email settings mutation
  const saveEmailSettingsMutation = useMutation({
    mutationFn: async (emailData: typeof emailSettings) => {
      return await apiRequest('PUT', `/api/organisations/${user?.organisationId}/email-settings`, {
        smtpHost: emailData.smtpHost,
        smtpPort: parseInt(emailData.smtpPort),
        smtpUsername: emailData.smtpUsername,
        smtpPassword: emailData.smtpPassword,
        smtpSecure: emailData.useSecure,
        fromEmail: emailData.fromEmail,
        fromName: emailData.fromName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations', user?.organisationId] });
      toast({
        title: "Success",
        description: "Email settings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save email settings",
        variant: "destructive",
      });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      return await apiRequest('POST', `/api/organisations/${user?.organisationId}/test-email`, {
        testEmail,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test email sent successfully! Check your inbox.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email. Please check your SMTP settings.",
        variant: "destructive",
      });
    },
  });

  // Single Mailer Service - Admin Test with comprehensive logging
  const adminTestEmailMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const response = await apiRequest('POST', '/api/smtp/admin-test', { 
        testEmail, 
        organisationId: user?.organisationId 
      });
      return response.json();
    },
    onSuccess: (data) => {
      const details = data.testDetails || {};
      toast({
        title: data.success ? "SMTP Test Successful" : "SMTP Test Failed",
        description: data.success 
          ? `Email sent via ${data.smtpHost}:${data.smtpPort} (${data.provider || 'Unknown'}) - TLS: ${data.tlsEnabled ? 'Enabled' : 'Disabled'}`
          : data.error || "Failed to send test email",
        variant: data.success ? "default" : "destructive",
      });
      
      // Log comprehensive metadata to console for debugging
      console.log('SMTP Test Result:', {
        timestamp: data.timestamp,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        resolvedIp: data.resolvedIp,
        tlsEnabled: data.tlsEnabled,
        messageId: data.messageId,
        source: data.source,
        provider: data.provider,
        sentBy: details.sentBy,
        userAgent: details.userAgent,
        clientIp: details.clientIp
      });
      
      setShowTestEmailModal(false);
      setTestEmailAddress('');
    },
    onError: (error: any) => {
      toast({
        title: "SMTP Test Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    }
  });

  // SMTP Health Check mutation
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/smtp/health-check', { 
        organisationId: user?.organisationId 
      });
      return response.json();
    },
    onSuccess: (data) => {
      const status = data.success ? 'Healthy' : 'Failed';
      const details = [
        `DNS: ${data.dnsResolution ? '✓' : '✗'}`,
        `TCP: ${data.tcpConnection ? '✓' : '✗'}`,
        `TLS: ${data.startTlsSupport ? '✓' : '✗'}`
      ].join(' | ');
      
      toast({
        title: `SMTP Health Check: ${status}`,
        description: data.success 
          ? `${data.smtpHost}:${data.smtpPort} - ${details} (${data.latencyMs}ms)`
          : `${data.error} - ${details}`,
        variant: data.success ? "default" : "destructive",
      });
      
      // Log detailed health check to console
      console.log('SMTP Health Check:', {
        timestamp: data.timestamp,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        resolvedIp: data.resolvedIp,
        dnsResolution: data.dnsResolution,
        tcpConnection: data.tcpConnection,
        startTlsSupport: data.startTlsSupport,
        latencyMs: data.latencyMs,
        error: data.error
      });
    },
    onError: (error: any) => {
      toast({
        title: "Health Check Error",
        description: error.message || "Failed to perform health check",
        variant: "destructive",
      });
    }
  });

  const saveEmailSettings = () => {
    if (!user?.organisationId) return;
    saveEmailSettingsMutation.mutate(emailSettings);
  };

  const openTestEmailModal = () => {
    if (!user?.organisationId) return;
    
    if (!emailSettings.smtpHost || !emailSettings.smtpUsername || !emailSettings.smtpPassword || !emailSettings.fromEmail) {
      toast({
        title: "Error",
        description: "Please configure all required SMTP settings before testing",
        variant: "destructive",
      });
      return;
    }
    
    // Pre-fill with user's email as default
    setTestEmailAddress(user?.email || '');
    setShowTestEmailModal(true);
  };

  const sendTestEmailToAddress = () => {
    if (!testEmailAddress) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    testEmailMutation.mutate(testEmailAddress);
    setShowTestEmailModal(false);
  };

  const sendAdminTestEmail = () => {
    if (!testEmailAddress) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    adminTestEmailMutation.mutate(testEmailAddress);
  };

  const closeTestEmailModal = () => {
    setShowTestEmailModal(false);
    setTestEmailAddress('');
  };

  // Build tabs array based on role and features
  const buildTabs = () => {
    const baseTabs = ["Branding", "Contacts"];
    
    if (user?.role === 'superadmin') {
      baseTabs.push("Visual Designer");
    }
    
    baseTabs.push("Notifications");
    
    if (hasEmailTemplatesAccess) {
      baseTabs.push("Email Settings");
    }
    
    baseTabs.push("Privacy");
    
    return baseTabs;
  };

  const tabs = buildTabs();

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Organisation Settings</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Organisation Settings</h1>
        <button 
          className={`btn btn-primary ${saveOrganizationMutation.isPending ? 'loading' : ''}`}
          onClick={saveSettings}
          disabled={saveOrganizationMutation.isPending}
          data-testid="button-save-settings"
        >
          {saveOrganizationMutation.isPending ? (
            'Saving...'
          ) : (
            <>
              <i className="fas fa-save"></i> Save All Changes
            </>
          )}
        </button>
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

          {/* Branding Tab */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Branding & Appearance</h3>
              
              <div className="form-control max-w-md">
                <label className="label">
                  <span className="label-text">Organisation Logo</span>
                  {!hasBrandingAccess && (
                    <span className="label-text-alt text-warning">
                      <i className="fas fa-lock mr-1"></i>
                      Premium Feature
                    </span>
                  )}
                </label>
                {hasBrandingAccess ? (
                  <>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB
                      onGetUploadParameters={handleLogoUpload}
                      onComplete={handleLogoComplete}
                      buttonClassName="btn btn-outline w-full"
                    >
                      <i className="fas fa-upload mr-2"></i>
                      {brandingData.logoUrl ? "Change Logo" : "Upload Logo"}
                    </ObjectUploader>
                    {brandingData.logoUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={brandingData.logoUrl} alt="Logo preview" className="w-12 h-12 object-contain" />
                        <span className="text-sm text-success">Logo uploaded</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="btn btn-outline btn-disabled w-full">
                      <i className="fas fa-lock mr-2"></i>
                      Custom Logo Upload (Premium)
                    </div>
                    <div className="alert alert-info mt-2">
                      <i className="fas fa-info-circle"></i>
                      <span>Custom logo branding is available with premium plans. Your organization will use the default inteLMS logo. Contact support to upgrade your plan.</span>
                    </div>
                  </>
                )}
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Display Name</span>
                  </label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={brandingData.displayName}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, displayName: e.target.value }))}
                    data-testid="input-display-name"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Subdomain</span>
                    {!hasCustomDomainAccess && (
                      <span className="label-text-alt text-warning">
                        <i className="fas fa-lock mr-1"></i>
                        Premium Feature
                      </span>
                    )}
                  </label>
                  <input 
                    type="text" 
                    className={`input input-bordered ${!hasCustomDomainAccess ? 'input-disabled' : ''}`}
                    value={brandingData.subdomain}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, subdomain: e.target.value }))}
                    disabled={!hasCustomDomainAccess}
                    data-testid="input-subdomain"
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      {hasCustomDomainAccess ? (
                        `https://${brandingData.subdomain || 'your-subdomain'}.lms-platform.com`
                      ) : (
                        "Upgrade your plan to customize your subdomain"
                      )}
                    </span>
                  </label>
                  {!hasCustomDomainAccess && (
                    <div className="alert alert-info mt-2">
                      <i className="fas fa-info-circle"></i>
                      <span>Custom subdomains are available with premium plans. Contact support to upgrade your plan.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Colors Section - Only show when remove branding feature is enabled */}
              {hasBrandingAccess && (
                <div className="space-y-4">
                  <div className="divider">Custom Colors</div>
                  
                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input 
                        type="checkbox" 
                        className={`toggle ${brandingData.useCustomColors ? 'toggle-success' : ''}`}
                        checked={brandingData.useCustomColors}
                        onChange={(e) => setBrandingData(prev => ({ ...prev, useCustomColors: e.target.checked }))}
                        data-testid="toggle-custom-colors"
                        style={{
                          '--tglbg': brandingData.useCustomColors ? '#4ade80' : '#d1d5db',
                          backgroundColor: brandingData.useCustomColors ? '#4ade80' : '#d1d5db',
                        } as React.CSSProperties}
                      />
                      <span className="label-text font-semibold">Enable Custom Brand Colors</span>
                    </label>
                    <div className="text-sm text-base-content/60 ml-12">
                      Customize your platform's colors to match your brand identity
                    </div>
                  </div>

                  {brandingData.useCustomColors && (
                    <div className="bg-base-200 p-4 rounded-lg space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">Primary Color</span>
                            <span className="label-text-alt">Used for buttons, links, and primary UI elements</span>
                          </label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              className="w-12 h-10 border border-base-300 rounded cursor-pointer"
                              value={brandingData.primaryColor}
                              onChange={(e) => {
                                const newPrimary = e.target.value;
                                // Calculate accent color as primary color with 50% transparency
                                const accentColor = newPrimary + '80'; // Adding 80 for 50% alpha in hex
                                setBrandingData(prev => ({ 
                                  ...prev, 
                                  primaryColor: newPrimary,
                                  accentColor: accentColor
                                }));
                              }}
                              data-testid="input-primary-color"
                            />
                            <input 
                              type="text" 
                              className="input input-bordered flex-1" 
                              value={brandingData.primaryColor}
                              onChange={(e) => {
                                const newPrimary = e.target.value;
                                // Calculate accent color as primary color with 50% transparency
                                const accentColor = newPrimary.length === 7 ? newPrimary + '80' : newPrimary;
                                setBrandingData(prev => ({ 
                                  ...prev, 
                                  primaryColor: newPrimary,
                                  accentColor: accentColor
                                }));
                              }}
                              placeholder="#3b82f6"
                              data-testid="input-primary-color-text"
                            />
                          </div>
                        </div>

                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">Accent Color</span>
                            <span className="label-text-alt">Automatically set to primary color with 50% transparency</span>
                          </label>
                          <div className="flex gap-2 items-center">
                            <div 
                              className="w-12 h-10 border border-base-300 rounded"
                              style={{ backgroundColor: brandingData.accentColor }}
                              data-testid="preview-accent-color"
                            />
                            <input 
                              type="text" 
                              className="input input-bordered flex-1 input-disabled" 
                              value={brandingData.accentColor}
                              disabled
                              placeholder="Auto-generated from primary"
                              data-testid="input-accent-color-text"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="alert alert-info">
                        <i className="fas fa-info-circle"></i>
                        <div>
                          <div className="font-medium">Color Preview</div>
                          <div className="text-sm">Changes will be applied after saving and may require a page refresh to take full effect</div>
                        </div>
                      </div>

                      <div className="flex gap-4 items-center justify-center p-4 bg-base-100 rounded border">
                        <div className="text-center">
                          <button 
                            className="btn btn-sm" 
                            style={{ backgroundColor: brandingData.primaryColor, borderColor: brandingData.primaryColor, color: 'white' }}
                          >
                            Primary Button
                          </button>
                          <div className="text-xs text-base-content/60 mt-1">Normal</div>
                        </div>
                        <div className="text-center">
                          <button 
                            className="btn btn-sm" 
                            style={{ 
                              backgroundColor: `color-mix(in srgb, ${brandingData.primaryColor} 85%, black)`, 
                              borderColor: `color-mix(in srgb, ${brandingData.primaryColor} 85%, black)`, 
                              color: 'white' 
                            }}
                          >
                            Primary Button
                          </button>
                          <div className="text-xs text-base-content/60 mt-1">Hover</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Organisation Email</span>
                  </label>
                  <input 
                    type="email" 
                    className="input input-bordered" 
                    value={contactData.email}
                    onChange={(e) => setContactData(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-org-email"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Phone Number</span>
                  </label>
                  <input 
                    type="tel" 
                    className="input input-bordered" 
                    value={contactData.phone}
                    onChange={(e) => setContactData(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-org-phone"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Address</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered h-24" 
                  value={contactData.address}
                  onChange={(e) => setContactData(prev => ({ ...prev, address: e.target.value }))}
                  data-testid="textarea-org-address"
                ></textarea>
              </div>
            </div>
          )}


          {/* Visual Designer Tab - SuperAdmin Only */}
          {user?.role === 'superadmin' && activeTab === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Visual Certificate Designer</h3>
                <div className="text-sm text-base-content/60">
                  Create custom certificate layouts with drag-and-drop editing
                </div>
              </div>
              
              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <div>
                  <div className="font-bold">Visual Certificate Designer</div>
                  <div className="text-sm">
                    Design your certificates visually by dragging text elements, adjusting fonts, colors, and positioning. 
                    All placeholders are supported and will be automatically replaced with actual data.
                  </div>
                </div>
              </div>

              <VisualCertificateEditor />
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === (user?.role === 'superadmin' ? 3 : 2) && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Email Notifications</h3>
              
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={notificationData.assignmentEmailsEnabled}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, assignmentEmailsEnabled: e.target.checked }))}
                      data-testid="toggle-assignment-emails"
                      style={{
                        '--tglbg': notificationData.assignmentEmailsEnabled ? '#4ade80' : '#d1d5db',
                        backgroundColor: notificationData.assignmentEmailsEnabled ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Assignment Emails</strong>
                      <div className="text-sm text-base-content/60">Send email when courses are assigned to users</div>
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={notificationData.reminderEmailsEnabled}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, reminderEmailsEnabled: e.target.checked }))}
                      data-testid="toggle-reminder-emails"
                      style={{
                        '--tglbg': notificationData.reminderEmailsEnabled ? '#4ade80' : '#d1d5db',
                        backgroundColor: notificationData.reminderEmailsEnabled ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Reminder Emails</strong>
                      <div className="text-sm text-base-content/60">Send reminder emails before due dates</div>
                    </span>
                  </label>
                </div>

                {notificationData.reminderEmailsEnabled && (
                  <div className="form-control ml-12">
                    <label className="label">
                      <span className="label-text">Reminder Days</span>
                    </label>
                    <select 
                      className="select select-bordered w-full max-w-xs"
                      value={notificationData.reminderDays}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, reminderDays: parseInt(e.target.value) }))}
                      data-testid="select-reminder-days"
                    >
                      <option value={1}>1 day before</option>
                      <option value={3}>3 days before</option>
                      <option value={7}>7 days before</option>
                      <option value={14}>14 days before</option>
                    </select>
                  </div>
                )}

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={notificationData.completionEmailsEnabled}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, completionEmailsEnabled: e.target.checked }))}
                      data-testid="toggle-completion-emails"
                      style={{
                        '--tglbg': notificationData.completionEmailsEnabled ? '#4ade80' : '#d1d5db',
                        backgroundColor: notificationData.completionEmailsEnabled ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Completion Emails to Admin</strong>
                      <div className="text-sm text-base-content/60">Notify admins when users complete courses</div>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Email Settings Tab */}
          {hasEmailTemplatesAccess && activeTab === tabs.indexOf("Email Settings") && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Email Settings</h3>
              
              {/* Email API Configuration Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-semibold">Email API Configuration</h4>
                  <div className="flex gap-2">
                    <button 
                      className="btn btn-outline btn-xs"
                      onClick={() => healthCheckMutation.mutate()}
                      disabled={healthCheckMutation.isPending}
                      data-testid="button-health-check"
                      title="Test DNS resolution, TCP connection, and STARTTLS support"
                    >
                      <i className={`fas ${healthCheckMutation.isPending ? 'fa-spinner fa-spin' : 'fa-heartbeat'}`}></i>
                      {healthCheckMutation.isPending ? 'Checking...' : 'Health Check'}
                    </button>
                    <button 
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        setTestEmailAddress(user?.email || '');
                        setShowTestEmailModal(true);
                      }}
                      disabled={!emailSettings.smtpHost || !emailSettings.smtpUsername}
                      data-testid="button-admin-test"
                      title="Send test email with comprehensive logging and metadata"
                    >
                      <i className="fas fa-flask"></i>
                      Admin Test
                    </button>
                    <button 
                      className="btn btn-outline btn-xs"
                      data-testid="button-test-email"
                      onClick={openTestEmailModal}
                      disabled={testEmailMutation.isPending}
                      title="Send simple test email (legacy)"
                    >
                      <i className={`fas ${testEmailMutation.isPending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                      {testEmailMutation.isPending ? 'Sending...' : 'Quick Test'}
                    </button>
                  </div>
                </div>
                
                <div className="alert alert-warning">
                  <i className="fas fa-shield-alt"></i>
                  <div>
                    <div className="font-bold">SMTP-Only Email Delivery</div>
                    <div className="text-sm">
                      This system enforces strict SMTP/API delivery. No sendmail, direct MX, or fallback methods allowed. Configure your SMTP settings to enable system emails (assignments, reminders, completions).
                    </div>
                  </div>
                </div>

                {/* Email Provider Selector */}
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">Email Provider</h5>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Choose your email provider *</span>
                    </label>
                    <select 
                      className="select select-bordered" 
                      value={emailSettings.provider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      data-testid="select-email-provider"
                    >
                      {Object.entries(emailProviders).map(([key, provider]) => (
                        <option key={key} value={key}>{provider.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Provider Instructions */}
                  {emailSettings.provider && (
                    <div className="alert alert-info">
                      <i className="fas fa-info-circle"></i>
                      <div className="text-sm">
                        {emailProviders[emailSettings.provider as keyof typeof emailProviders]?.instructions}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">SMTP Host</span>
                    </label>
                    <input 
                      type="text" 
                      className={`input input-bordered ${emailSettings.provider !== 'custom' ? 'input-disabled' : ''}`}
                      placeholder="smtp.gmail.com"
                      value={emailSettings.smtpHost}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpHost: e.target.value }))}
                      readOnly={emailSettings.provider !== 'custom'}
                      data-testid="input-smtp-host"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">SMTP Port</span>
                    </label>
                    <select 
                      className={`select select-bordered ${emailSettings.provider !== 'custom' ? 'select-disabled' : ''}`}
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpPort: e.target.value }))}
                      disabled={emailSettings.provider !== 'custom'}
                      data-testid="select-smtp-port"
                    >
                      <option value="25">25 (Standard)</option>
                      <option value="587">587 (Submission)</option>
                      <option value="465">465 (SSL)</option>
                      <option value="2525">2525 (Alternative)</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">SMTP Username</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      placeholder="your-email@domain.com"
                      value={emailSettings.smtpUsername}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpUsername: e.target.value }))}
                      data-testid="input-smtp-username"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">SMTP Password</span>
                    </label>
                    <input 
                      type="password" 
                      className="input input-bordered" 
                      placeholder="••••••••"
                      value={emailSettings.smtpPassword}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, smtpPassword: e.target.value }))}
                      data-testid="input-smtp-password"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">From Email</span>
                    </label>
                    <input 
                      type="email" 
                      className="input input-bordered" 
                      placeholder="noreply@yourdomain.com"
                      value={emailSettings.fromEmail}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, fromEmail: e.target.value }))}
                      data-testid="input-from-email"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">From Name</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      placeholder="Your Organization LMS"
                      value={emailSettings.fromName}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, fromName: e.target.value }))}
                      data-testid="input-from-name"
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={emailSettings.useSecure}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, useSecure: e.target.checked }))}
                      data-testid="toggle-use-secure"
                      style={{
                        '--tglbg': emailSettings.useSecure ? (organization?.useCustomColors ? organization?.primaryColor || '#4ade80' : '#4ade80') : '#d1d5db',
                        backgroundColor: emailSettings.useSecure ? (organization?.useCustomColors ? organization?.primaryColor || '#4ade80' : '#4ade80') : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Use Secure Connection (TLS/SSL)</strong>
                      <div className="text-sm text-base-content/60">Enable encryption for email transmission</div>
                    </span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button 
                    className="btn btn-primary"
                    data-testid="button-save-email-settings"
                    onClick={saveEmailSettings}
                    disabled={saveEmailSettingsMutation.isPending}
                    style={{
                      backgroundColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                      borderColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                    } as React.CSSProperties}
                  >
                    <i className={`fas ${saveEmailSettingsMutation.isPending ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                    {saveEmailSettingsMutation.isPending ? 'Saving...' : 'Save Email Settings'}
                  </button>
                </div>
              </div>

              <div className="divider"></div>

              {/* Email Templates Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold">Email Templates</h4>
                
                <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <div>
                  <div className="font-bold">Customize Email Templates</div>
                  <div className="text-sm">
                    Create custom email templates for various system notifications. You can use placeholders like [FirstName], [CourseName], [OrganisationName] to personalize emails.
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="card bg-base-100 border border-base-300">
                  <div className="card-body p-4">
                    <h4 className="card-title text-base">Welcome Email</h4>
                    <p className="text-sm text-base-content/70">Sent when new users are created</p>
                    <div className="card-actions justify-end">
                      <button 
                        className="btn btn-outline btn-sm" 
                        data-testid="button-edit-welcome"
                        onClick={() => handleEditTemplate('welcome_email')}
                      >
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 border border-base-300">
                  <div className="card-body p-4">
                    <h4 className="card-title text-base">Course Assignment</h4>
                    <p className="text-sm text-base-content/70">Sent when courses are assigned to users</p>
                    <div className="card-actions justify-end">
                      <button 
                        className="btn btn-outline btn-sm" 
                        data-testid="button-edit-assignment"
                        onClick={() => handleEditTemplate('course_assignment')}
                      >
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 border border-base-300">
                  <div className="card-body p-4">
                    <h4 className="card-title text-base">Course Reminder</h4>
                    <p className="text-sm text-base-content/70">Reminder emails for upcoming due dates</p>
                    <div className="card-actions justify-end">
                      <button 
                        className="btn btn-outline btn-sm" 
                        data-testid="button-edit-reminder"
                        onClick={() => handleEditTemplate('course_reminder')}
                      >
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 border border-base-300">
                  <div className="card-body p-4">
                    <h4 className="card-title text-base">Course Completion</h4>
                    <p className="text-sm text-base-content/70">Sent when users complete courses</p>
                    <div className="card-actions justify-end">
                      <button 
                        className="btn btn-outline btn-sm" 
                        data-testid="button-edit-completion"
                        onClick={() => handleEditTemplate('course_completion')}
                      >
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 border border-base-300">
                  <div className="card-body p-4">
                    <h4 className="card-title text-base">Password Reset</h4>
                    <p className="text-sm text-base-content/70">Sent when users request password resets</p>
                    <div className="card-actions justify-end">
                      <button 
                        className="btn btn-outline btn-sm" 
                        data-testid="button-edit-password-reset"
                        onClick={() => handleEditTemplate('password_reset')}
                      >
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Template Editor Modal */}
          {showTemplateEditor && selectedTemplate && (
            <div className="modal modal-open">
              <div className="modal-box w-11/12 max-w-4xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">
                    Edit {getTemplateDisplayName(selectedTemplate)}
                  </h3>
                  <button 
                    className="btn btn-sm btn-circle btn-ghost"
                    onClick={handleCloseTemplateEditor}
                    data-testid="button-close-editor"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Subject</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered w-full" 
                      placeholder="Email subject line"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      data-testid="input-email-subject"
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Email Content</span>
                    </label>
                    <textarea 
                      className="textarea textarea-bordered w-full h-64" 
                      placeholder="Email body content"
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                      data-testid="textarea-email-content"
                    ></textarea>
                  </div>

                  <div className="alert alert-info">
                    <i className="fas fa-info-circle"></i>
                    <div>
                      <div className="font-bold">Available Placeholders</div>
                      <div className="text-sm space-y-1">
                        <div><strong>User:</strong> {`{{firstName}}`}, {`{{lastName}}`}, {`{{email}}`}, {`{{jobTitle}}`}, {`{{department}}`}</div>
                        <div><strong>Organization:</strong> {`{{organisationDisplayName}}`}</div>
                        <div><strong>Course:</strong> {`{{courseTitle}}`}, {`{{estimatedDuration}}`}, {`{{passmark}}`}</div>
                        <div><strong>Assignment:</strong> {`{{dueDate}}`}, {`{{assignedAt}}`}</div>
                        <div><strong>Completion:</strong> {`{{score}}`}, {`{{status}}`}, {`{{completedAt}}`}, {`{{timeSpent}}`}</div>
                        <div><strong>Certificate:</strong> {`{{certificateExpiryDate}}`}, {`{{issuedAt}}`}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-action">
                  <button 
                    className="btn btn-ghost" 
                    onClick={handleCloseTemplateEditor}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    data-testid="button-save-template"
                    style={{
                      backgroundColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                      borderColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                    } as React.CSSProperties}
                  >
                    Save Template
                  </button>
                </div>
              </div>
              <div className="modal-backdrop" onClick={handleCloseTemplateEditor}></div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === tabs.indexOf("Privacy") && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Privacy Settings</h3>
              
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="toggle" 
                    checked={privacyData.defaultCertificateDownload}
                    onChange={(e) => setPrivacyData(prev => ({ ...prev, defaultCertificateDownload: e.target.checked }))}
                    data-testid="toggle-default-cert-download"
                    style={{
                      '--tglbg': privacyData.defaultCertificateDownload ? '#4ade80' : '#d1d5db',
                      backgroundColor: privacyData.defaultCertificateDownload ? '#4ade80' : '#d1d5db',
                    } as React.CSSProperties}
                  />
                  <span className="label-text">
                    <strong>Allow Certificate Download by Default</strong>
                    <div className="text-sm text-base-content/60">
                      New users will be able to download their certificates by default. 
                      This can still be customised per user.
                    </div>
                  </span>
                </label>
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <div>
                  <div className="font-bold">Certificate Download Policy</div>
                  <div className="text-sm">
                    When enabled, users can download their certificates from their Settings page. 
                    Admins can still control this permission individually for each user.
                  </div>
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
                    Enter the email address where you want to send the test email to verify your SMTP configuration.
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
                      style={{
                        backgroundColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                        borderColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                      } as React.CSSProperties}
                    >
                      <i className={`fas ${testEmailMutation.isPending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                      {adminTestEmailMutation.isPending ? 'Sending...' : 'Send Admin Test'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
