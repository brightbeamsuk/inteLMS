import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { VisualCertificateEditor } from "@/components/VisualCertificateEditor";
import { FeatureUpgradeModal } from "@/components/FeatureUpgradeModal";
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

  // Fetch admin users
  const { data: adminUsers = [], isLoading: adminUsersLoading, refetch: refetchAdminUsers } = useQuery<any[]>({
    queryKey: ['/api/admin/admin-users', user?.organisationId],
    enabled: !!user?.organisationId && (user?.role === 'admin' || user?.role === 'superadmin'),
  });

  // Fetch regular users (for promoting to admin)
  const { data: regularUsers = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: !!user?.organisationId && (user?.role === 'admin' || user?.role === 'superadmin'),
    select: (data: any[]) => data.filter(u => u.role === 'user' && u.organisationId === user?.organisationId),
  });

  // Calculate admin limits based on plan features
  const hasUnlimitedAdmins = planFeatures.some((feature: any) => 
    feature.feature?.key === 'unlimited_admin_accounts' && feature.enabled
  );
  
  const currentAdminCount = Array.isArray(adminUsers) ? adminUsers.length : 0;
  const maxAdmins = hasUnlimitedAdmins ? Infinity : 1;
  const canAddMoreAdmins = hasUnlimitedAdmins || currentAdminCount < maxAdmins;

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
    provider: 'sendgrid_api' as 'smtp_generic' | 'sendgrid_api' | 'brevo_api' | 'mailgun_api' | 'postmark_api' | 'mailjet_api' | 'sparkpost_api',
    fromEmail: '',
    fromName: '',
    replyTo: '',
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
  });

  // Custom email provider toggle state
  const [useCustomEmailProvider, setUseCustomEmailProvider] = useState(false);

  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestResultModal, setShowTestResultModal] = useState(false);

  // Admin Management states
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [selectedUserToPromote, setSelectedUserToPromote] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  // Provider configurations - supports both SMTP and API providers
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
      instructions: 'Configure any SMTP server. Use app-specific passwords for Gmail/Outlook.',
      requiredFields: ['fromEmail', 'fromName', 'smtpHost', 'smtpUsername', 'smtpPassword'],
      website: undefined
    },
    sendgrid_api: {
      name: 'SendGrid API',
      type: 'api',
      instructions: 'Get your API key from SendGrid Dashboard → Settings → API Keys. Requires verified sender.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://sendgrid.com'
    },
    brevo_api: {
      name: 'Brevo API',
      type: 'api',
      instructions: 'Get your API key from Brevo Dashboard → SMTP & API → API Keys. Note: IP restrictions may apply.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://brevo.com'
    },
    mailgun_api: {
      name: 'Mailgun API',
      type: 'api',
      instructions: 'Get your API key and domain from Mailgun Dashboard → Settings → API Keys. Domain must be verified.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey', 'apiDomain'],
      website: 'https://mailgun.com'
    },
    postmark_api: {
      name: 'Postmark API',
      type: 'api',
      instructions: 'Get your Server API Token from Postmark Dashboard → Servers → API Tokens. Requires confirmed sender signature.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://postmarkapp.com'
    },
    mailjet_api: {
      name: 'Mailjet API',
      type: 'api',
      instructions: 'Get your API Key and Secret Key from Mailjet Dashboard → Account Settings → REST API.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey', 'apiSecret'],
      website: 'https://mailjet.com'
    },
    sparkpost_api: {
      name: 'SparkPost API',
      type: 'api',
      instructions: 'Get your API key from SparkPost Dashboard → Account → API Keys. Requires transmissions permission.',
      requiredFields: ['fromEmail', 'fromName', 'apiKey'],
      website: 'https://sparkpost.com'
    }
  };

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
      }));
    }
  };

  const handleSMTPPresetChange = (preset: string) => {
    const config = emailProviders.smtp_generic;
    if (config && config.presets && preset in config.presets) {
      const presetConfig = config.presets[preset as keyof typeof config.presets];
      setEmailSettings(prev => ({
        ...prev,
        smtpHost: presetConfig.smtpHost,
        smtpPort: presetConfig.smtpPort,
        smtpSecure: presetConfig.smtpSecure,
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

  // Check if custom email provider feature is enabled
  const customEmailProviderFeature = planFeatures.find((feature: any) => feature.featureId === 'custom_email_provider');
  const hasCustomEmailProviderAccess = customEmailProviderFeature?.enabled || false;

  // Check if custom branding colors feature is enabled
  const customBrandingFeature = planFeatures.find((feature: any) => feature.featureId === 'custom_branding_colors');
  const hasCustomBrandingAccess = customBrandingFeature?.enabled || false;

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
      setEmailSettings({
        provider: (orgSettings as any).emailProvider || 'sendgrid_api',
        fromEmail: orgSettings.fromEmail || '',
        fromName: orgSettings.fromName || '',
        replyTo: (orgSettings as any).replyTo || '',
        // SMTP fields
        smtpHost: orgSettings.smtpHost || '',
        smtpPort: orgSettings.smtpPort?.toString() || '587',
        smtpUsername: orgSettings.smtpUsername || '',
        smtpPassword: (orgSettings as any).apiKey || orgSettings.smtpPassword ? '••••••••' : '', // Show masked if exists
        smtpSecure: orgSettings.smtpSecure !== false,
        // API fields - show masked values if they exist
        apiKey: (orgSettings as any).apiKey ? '••••••••••••••••' : '',
        apiSecret: (orgSettings as any).apiSecret ? '••••••••••••••••' : '',
        apiBaseUrl: (orgSettings as any).apiBaseUrl || '',
        apiDomain: (orgSettings as any).apiDomain || '',
        apiRegion: (orgSettings as any).apiRegion || '',
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
      // Build settings object based on provider type
      const settings: any = {
        emailProvider: emailData.provider,
        fromEmail: emailData.fromEmail,
        fromName: emailData.fromName,
        replyTo: emailData.replyTo,
      };

      // Add provider-specific fields
      if (emailData.provider === 'smtp_generic') {
        settings.smtpHost = emailData.smtpHost;
        settings.smtpPort = parseInt(emailData.smtpPort);
        settings.smtpUsername = emailData.smtpUsername;
        // Only send password if it's not a masked value
        if (emailData.smtpPassword && !emailData.smtpPassword.startsWith('••')) {
          settings.smtpPassword = emailData.smtpPassword;
        }
        settings.smtpSecure = emailData.smtpSecure;
      } else {
        // API providers - only send keys if they're not masked values
        if (emailData.apiKey && !emailData.apiKey.startsWith('••')) {
          settings.apiKey = emailData.apiKey;
        }
        
        if (emailData.provider === 'mailjet_api') {
          if (emailData.apiSecret && !emailData.apiSecret.startsWith('••')) {
            settings.apiSecret = emailData.apiSecret;
          }
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

      return await apiRequest('PUT', `/api/organisations/${user?.organisationId}/email-settings`, settings);
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

  // Test email mutation - Uses new provider-agnostic endpoint
  const testEmailMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const response = await apiRequest('POST', '/api/admin/email/test', {
        testEmail,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Store the structured result and show the detailed modal
      setTestResult(data);
      setShowTestResultModal(true);
      setShowTestEmailModal(false);
    },
    onError: (error: any) => {
      // Fallback for network errors
      setTestResult({
        success: false,
        provider: 'unknown',
        step: 'error',
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network error occurred',
          details: error.message
        },
        diagnostics: {
          context: 'Organization level',
          timestamp: new Date().toISOString()
        }
      });
      setShowTestResultModal(true);
      setShowTestEmailModal(false);
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

  // Promote user to admin mutation
  const promoteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', `/api/admin/promote-user/${userId}`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "User promoted to admin successfully",
        variant: "default",
      });
      refetchAdminUsers();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowAddAdminModal(false);
      setSelectedUserToPromote('');
    },
    onError: (error: any) => {
      // Check for feature lock errors (admin limit reached)
      if (error.status === 403 && (error.featureKey === 'unlimited_admin_accounts' || error.code === 'FEATURE_LOCKED')) {
        setShowUpgradeModal(true);
        setShowAddAdminModal(false);
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to promote user to admin",
        variant: "destructive",
      });
    },
  });

  // Demote admin user mutation
  const demoteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', `/api/admin/demote-user/${userId}`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Admin privileges removed successfully",
        variant: "default",
      });
      refetchAdminUsers();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove admin privileges",
        variant: "destructive",
      });
    },
  });

  const saveEmailSettings = () => {
    if (!user?.organisationId) return;
    saveEmailSettingsMutation.mutate(emailSettings);
  };

  const openTestEmailModal = () => {
    if (!user?.organisationId) return;
    
    if (!emailSettings.fromEmail) {
      toast({
        title: "Error",
        description: "Please configure email settings and from email before testing",
        variant: "destructive",
      });
      return;
    }
    
    // Check provider-specific requirements
    const config = emailProviders[emailSettings.provider];
    const missingFields = [];
    
    if (config.requiredFields.includes('apiKey') && !emailSettings.apiKey) {
      missingFields.push('API Key');
    }
    if (config.requiredFields.includes('apiSecret') && !emailSettings.apiSecret) {
      missingFields.push('API Secret');
    }
    if (config.requiredFields.includes('apiDomain') && !emailSettings.apiDomain) {
      missingFields.push('API Domain');
    }
    if (config.requiredFields.includes('smtpHost') && !emailSettings.smtpHost) {
      missingFields.push('SMTP Host');
    }
    if (config.requiredFields.includes('smtpUsername') && !emailSettings.smtpUsername) {
      missingFields.push('SMTP Username');
    }
    if (config.requiredFields.includes('smtpPassword') && !emailSettings.smtpPassword) {
      missingFields.push('SMTP Password');
    }
    
    if (missingFields.length > 0) {
      toast({
        title: "Error",
        description: `Please configure the following fields: ${missingFields.join(', ')}`,
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


  const closeTestEmailModal = () => {
    setShowTestEmailModal(false);
    setTestEmailAddress('');
  };

  const closeTestResultModal = () => {
    setShowTestResultModal(false);
    setTestResult(null);
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
    
    // Add Admin Management tab for admins and superadmins
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      baseTabs.push("Admin Management");
    }
    
    baseTabs.push("Privacy");
    
    return baseTabs;
  };

  const tabs = buildTabs();

  return (
    <>
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

          {/* Tab Content */}
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

              {/* Custom Colors Section - Only show when custom branding colors feature is enabled */}
              <div className="space-y-4">
                <div className="divider">Custom Colors</div>
                
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className={`toggle ${brandingData.useCustomColors && hasCustomBrandingAccess ? 'toggle-success' : ''} ${!hasCustomBrandingAccess ? 'toggle-disabled' : ''}`}
                      checked={brandingData.useCustomColors && hasCustomBrandingAccess}
                      onChange={(e) => setBrandingData(prev => ({ ...prev, useCustomColors: e.target.checked }))}
                      disabled={!hasCustomBrandingAccess}
                      data-testid="toggle-custom-colors"
                      style={{
                        '--tglbg': brandingData.useCustomColors && hasCustomBrandingAccess ? '#4ade80' : '#d1d5db',
                        backgroundColor: brandingData.useCustomColors && hasCustomBrandingAccess ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text font-semibold">Enable Custom Brand Colors</span>
                  </label>
                  <div className="text-sm text-base-content/60 ml-12">
                    {hasCustomBrandingAccess ? 
                      "Customize your platform's colors to match your brand identity" :
                      "Upgrade your plan to customize your brand colors"
                    }
                  </div>
                </div>
                
                {!hasCustomBrandingAccess && (
                  <div className="alert alert-info">
                    <i className="fas fa-palette"></i>
                    <span>Custom branding colors are available with premium plans. Contact support to upgrade your plan.</span>
                  </div>
                )}

                  {brandingData.useCustomColors && hasCustomBrandingAccess && (
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

                    </div>
                  )}
                </div>

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
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Email Settings</h3>
                <div className="flex gap-2">
                  <button 
                    className={`btn btn-outline btn-sm ${testEmailMutation.isPending ? 'loading' : ''}`}
                    data-testid="button-test-email"
                    onClick={openTestEmailModal}
                    disabled={testEmailMutation.isPending || !emailSettings.fromEmail}
                    title="Send test email using current provider"
                  >
                    <i className={`fas ${testEmailMutation.isPending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                    {testEmailMutation.isPending ? 'Sending...' : 'Test Email'}
                  </button>
                  <button 
                    className={`btn btn-primary btn-sm ${saveEmailSettingsMutation.isPending ? 'loading' : ''}`}
                    onClick={saveEmailSettings}
                    disabled={saveEmailSettingsMutation.isPending}
                    data-testid="button-save-email-settings"
                  >
                    <i className="fas fa-save"></i>
                    {saveEmailSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
              
              {/* Custom Email Provider Toggle */}
              <div className="space-y-4">
                {hasCustomEmailProviderAccess ? (
                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input 
                        type="checkbox" 
                        className="toggle" 
                        checked={useCustomEmailProvider}
                        onChange={(e) => setUseCustomEmailProvider(e.target.checked)}
                        data-testid="toggle-custom-email-provider"
                        style={{
                          '--tglbg': useCustomEmailProvider ? '#4ade80' : '#d1d5db',
                          backgroundColor: useCustomEmailProvider ? '#4ade80' : '#d1d5db',
                        } as React.CSSProperties}
                      />
                      <span className="label-text">
                        <strong>Use Custom Email Provider</strong>
                        <div className="text-sm text-base-content/60">
                          Configure your own email provider instead of using system defaults
                        </div>
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle"></i>
                    <div>
                      <div className="font-bold">System Default Email Provider</div>
                      <div className="text-sm">
                        Your plan uses system default email settings. Contact support to upgrade for custom email provider access.
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Status Indication */}
                <div className="alert alert-sm">
                  <i className={`fas ${useCustomEmailProvider && hasCustomEmailProviderAccess ? 'fa-cogs' : 'fa-shield-alt'}`}></i>
                  <div className="text-sm">
                    <strong>Current Status:</strong> {
                      hasCustomEmailProviderAccess && useCustomEmailProvider 
                        ? 'Using Custom Email Provider Configuration' 
                        : 'Using System Default Email Provider'
                    }
                  </div>
                </div>
              </div>

              {/* Custom Email Provider Configuration - only show when enabled */}
              {hasCustomEmailProviderAccess && useCustomEmailProvider && (
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
                          href={emailProviders[emailSettings.provider].website!} 
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
                    placeholder="noreply@yourdomain.com"
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
                    placeholder="Your Organization LMS"
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

                  {emailSettings.provider === 'sparkpost_api' && (
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

          {/* Admin Management Tab */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && activeTab === tabs.indexOf("Admin Management") && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Administrator Management</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="text-sm text-base-content/70" data-testid="text-admin-count">
                      Admin Accounts: <span className="font-semibold">{currentAdminCount}</span> / {hasUnlimitedAdmins ? '∞' : maxAdmins}
                    </div>
                    {hasUnlimitedAdmins ? (
                      <div className="badge badge-success badge-sm" data-testid="badge-unlimited-admins">
                        <i className="fas fa-infinity mr-1"></i>
                        Unlimited Admin Accounts
                      </div>
                    ) : (
                      <div className="badge badge-warning badge-sm" data-testid="badge-limited-admins">
                        <i className="fas fa-lock mr-1"></i>
                        Limited Admin Accounts
                      </div>
                    )}
                  </div>
                </div>
                {canAddMoreAdmins ? (
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowAddAdminModal(true)}
                    data-testid="button-add-admin"
                  >
                    <i className="fas fa-user-plus mr-2"></i>
                    Add Administrator
                  </button>
                ) : (
                  <div className="tooltip tooltip-left" data-tip="Upgrade your plan to add more administrators">
                    <button 
                      className="btn btn-outline"
                      onClick={() => setShowUpgradeModal(true)}
                      data-testid="button-add-admin-locked"
                    >
                      <i className="fas fa-lock mr-2"></i>
                      Add Administrator (Premium)
                    </button>
                  </div>
                )}
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <div>
                  <div className="font-bold">Administrator Access</div>
                  <div className="text-sm">
                    Administrators can manage users, courses, and organization settings. 
                    They have full access to the admin panel for this organization.
                    {!hasUnlimitedAdmins && (
                      <div className="mt-2 p-2 bg-warning/10 rounded border border-warning/20">
                        <i className="fas fa-exclamation-triangle text-warning mr-1"></i>
                        <span className="text-warning font-medium">Your plan allows up to {maxAdmins} administrator account{maxAdmins === 1 ? '' : 's'}. </span>
                        <span className="text-sm">Upgrade to add unlimited administrators.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Admin Users */}
              <div className="card bg-base-100 border">
                <div className="card-body">
                  <h4 className="card-title">Current Administrators</h4>
                  
                  {adminUsersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  ) : adminUsers.length === 0 ? (
                    <div className="text-center py-8 text-base-content/60">
                      <i className="fas fa-users-cog text-4xl mb-4"></i>
                      <p>No administrators found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Last Active</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers.map((adminUser: any) => (
                            <tr key={adminUser.id} data-testid={`admin-user-${adminUser.id}`}>
                              <td>
                                <div className="flex items-center space-x-3">
                                  <div className="avatar">
                                    <div className="mask mask-squircle w-12 h-12">
                                      {adminUser.profileImageUrl ? (
                                        <img src={adminUser.profileImageUrl} alt="Avatar" />
                                      ) : (
                                        <div className="bg-primary text-primary-content flex items-center justify-center text-lg font-bold">
                                          {adminUser.firstName?.charAt(0)}{adminUser.lastName?.charAt(0)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-bold">{adminUser.firstName} {adminUser.lastName}</div>
                                    <div className="text-sm opacity-50">{adminUser.jobTitle}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="text-sm">{adminUser.email}</span>
                                {adminUser.id === user?.id && (
                                  <div className="badge badge-sm badge-primary ml-2">You</div>
                                )}
                              </td>
                              <td>
                                <div className="badge badge-outline">
                                  {adminUser.role === 'superadmin' ? 'Super Admin' : 'Administrator'}
                                </div>
                              </td>
                              <td>
                                <span className="text-sm">
                                  {adminUser.lastActive 
                                    ? new Date(adminUser.lastActive).toLocaleDateString() 
                                    : 'Never'
                                  }
                                </span>
                              </td>
                              <td>
                                {adminUser.id !== user?.id && adminUser.role !== 'superadmin' && (
                                  <button 
                                    className="btn btn-sm btn-error btn-outline"
                                    onClick={() => demoteUserMutation.mutate(adminUser.id)}
                                    disabled={demoteUserMutation.isPending}
                                    data-testid={`button-demote-${adminUser.id}`}
                                  >
                                    {demoteUserMutation.isPending ? (
                                      <span className="loading loading-spinner loading-sm"></span>
                                    ) : (
                                      <>
                                        <i className="fas fa-user-minus mr-1"></i>
                                        Remove Admin
                                      </>
                                    )}
                                  </button>
                                )}
                                {adminUser.id === user?.id && (
                                  <span className="text-sm text-base-content/60">Current User</span>
                                )}
                                {adminUser.role === 'superadmin' && adminUser.id !== user?.id && (
                                  <span className="text-sm text-base-content/60">Super Admin</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
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
        </div>
      </div>

      {/* Modals */}
      {/* Add Administrator Modal */}
      {showAddAdminModal && (
            <div className="modal modal-open">
              <div className="modal-box max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Add Administrator</h3>
                  <button 
                    className="btn btn-sm btn-circle btn-ghost"
                    onClick={() => {
                      setShowAddAdminModal(false);
                      setSelectedUserToPromote('');
                    }}
                    data-testid="button-close-add-admin"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-base-content/70">
                    Select a user from your organization to promote to administrator role. 
                    Administrators will have full access to manage users, courses, and organization settings.
                  </p>

                  {regularUsers.length === 0 ? (
                    <div className="alert alert-warning">
                      <i className="fas fa-exclamation-triangle"></i>
                      <div>
                        <div className="font-bold">No users available</div>
                        <div className="text-sm">
                          All eligible users in your organization are already administrators or there are no users to promote.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Select User to Promote</span>
                        </label>
                        <select 
                          className="select select-bordered w-full"
                          value={selectedUserToPromote}
                          onChange={(e) => setSelectedUserToPromote(e.target.value)}
                          data-testid="select-user-to-promote"
                        >
                          <option value="">Choose a user...</option>
                          {regularUsers.map((user: any) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName} ({user.email})
                              {user.jobTitle ? ` - ${user.jobTitle}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedUserToPromote && (
                        <div className="alert alert-info">
                          <i className="fas fa-info-circle"></i>
                          <div>
                            <div className="font-bold">Promote to Administrator</div>
                            <div className="text-sm">
                              This user will gain full administrative access including user management, 
                              course management, and organization settings. This action can be reversed later.
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="modal-action">
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => {
                      setShowAddAdminModal(false);
                      setSelectedUserToPromote('');
                    }}
                    data-testid="button-cancel-add-admin"
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      if (selectedUserToPromote) {
                        promoteUserMutation.mutate(selectedUserToPromote);
                      }
                    }}
                    disabled={!selectedUserToPromote || promoteUserMutation.isPending}
                    data-testid="button-confirm-promote"
                  >
                    {promoteUserMutation.isPending ? (
                      <>
                        <span className="loading loading-spinner loading-sm mr-2"></span>
                        Promoting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-shield mr-2"></i>
                        Promote to Admin
                      </>
                    )}
                  </button>
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
                      {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Test Result Modal - Provider-Agnostic Diagnostics */}
      {showTestResultModal && testResult && (
            <div className="modal modal-open">
              <div className="modal-box w-11/12 max-w-3xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">
                    {testResult.success ? '✅ Email Test Successful' : '❌ Email Test Failed'}
                  </h3>
                  <button 
                    className="btn btn-sm btn-circle btn-ghost"
                    onClick={closeTestResultModal}
                    data-testid="button-close-test-result"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Summary */}
                  <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
                    <div>
                      <div className="font-bold">
                        {testResult.success ? 'Email delivered successfully!' : `Failed at: ${testResult.step || 'unknown'}`}
                      </div>
                      <div className="text-sm">
                        {testResult.success ? 
                          `Test email sent via ${testResult.provider}` : 
                          testResult.error?.message || 'Unknown error occurred'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Configuration Info */}
                  {testResult.diagnostics && (
                    <div className="bg-base-200 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Configuration Details</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium">Provider:</span>
                          <span className="ml-2 badge badge-outline">{testResult.provider}</span>
                        </div>
                        <div>
                          <span className="font-medium">Context:</span>
                          <span className="ml-2">{testResult.diagnostics.context}</span>
                        </div>
                        {testResult.diagnostics.platformProvider && (
                          <div>
                            <span className="font-medium">Platform Default:</span>
                            <span className="ml-2">{testResult.diagnostics.platformProvider}</span>
                          </div>
                        )}
                        {testResult.diagnostics.settings && (
                          <>
                            <div>
                              <span className="font-medium">From:</span>
                              <span className="ml-2">{testResult.diagnostics.settings.fromEmail}</span>
                            </div>
                            <div>
                              <span className="font-medium">From Name:</span>
                              <span className="ml-2">{testResult.diagnostics.settings.fromName}</span>
                            </div>
                            {testResult.diagnostics.settings.replyTo && (
                              <div>
                                <span className="font-medium">Reply To:</span>
                                <span className="ml-2">{testResult.diagnostics.settings.replyTo}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Health Check Results */}
                  {testResult.healthCheck && (
                    <div className="bg-base-200 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Health Check</h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-sm ${testResult.healthCheck.connection ? 'badge-success' : 'badge-error'}`}>
                            {testResult.healthCheck.connection ? '✓' : '✗'}
                          </span>
                          <span>Connection to {testResult.provider}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-sm ${testResult.healthCheck.authentication ? 'badge-success' : 'badge-error'}`}>
                            {testResult.healthCheck.authentication ? '✓' : '✗'}
                          </span>
                          <span>Authentication</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-sm ${testResult.healthCheck.configuration ? 'badge-success' : 'badge-error'}`}>
                            {testResult.healthCheck.configuration ? '✓' : '✗'}
                          </span>
                          <span>Configuration validity</span>
                        </div>
                        {testResult.healthCheck.quota !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className={`badge badge-sm ${testResult.healthCheck.quota ? 'badge-success' : 'badge-warning'}`}>
                              {testResult.healthCheck.quota ? '✓' : '!'}
                            </span>
                            <span>Quota check</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Delivery Details */}
                  {testResult.delivery && (
                    <div className="bg-base-200 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Delivery Details</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {testResult.delivery.messageId && (
                          <div>
                            <span className="font-medium">Message ID:</span>
                            <span className="ml-2 font-mono text-xs">{testResult.delivery.messageId}</span>
                          </div>
                        )}
                        {testResult.delivery.status && (
                          <div>
                            <span className="font-medium">Status:</span>
                            <span className={`ml-2 badge ${testResult.delivery.status === 'sent' ? 'badge-success' : 'badge-error'}`}>
                              {testResult.delivery.status}
                            </span>
                          </div>
                        )}
                        {testResult.delivery.to && (
                          <div>
                            <span className="font-medium">Recipient:</span>
                            <span className="ml-2">{testResult.delivery.to}</span>
                          </div>
                        )}
                        {testResult.delivery.subject && (
                          <div>
                            <span className="font-medium">Subject:</span>
                            <span className="ml-2">{testResult.delivery.subject}</span>
                          </div>
                        )}
                        {testResult.delivery.latencyMs && (
                          <div>
                            <span className="font-medium">Response Time:</span>
                            <span className="ml-2">{testResult.delivery.latencyMs}ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Details */}
                  {!testResult.success && testResult.error && (
                    <div className="bg-error/10 p-4 rounded-lg border border-error/20">
                      <h4 className="font-semibold text-error mb-2">
                        {testResult.error.code}: {testResult.error.message}
                      </h4>
                      {testResult.error.details && (
                        <p className="text-sm text-error/80 font-mono bg-error/5 p-2 rounded">
                          {testResult.error.details}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Success Guidance */}
                  {testResult.success && (
                    <div className="bg-success/10 p-4 rounded-lg border border-success/20">
                      <h4 className="font-semibold text-success mb-2">🎉 Success!</h4>
                      <p className="text-sm text-success/80">
                        Your {testResult.provider} configuration is working correctly. System emails will be delivered reliably.
                      </p>
                      {testResult.delivery?.additionalInfo && (
                        <p className="text-xs text-success/70 mt-2">
                          {testResult.delivery.additionalInfo}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Raw Response (for debugging) */}
                  {testResult.rawResponse && (
                    <details className="bg-base-100 p-4 rounded-lg border">
                      <summary className="font-semibold cursor-pointer">Raw API Response (Debug)</summary>
                      <pre className="text-xs mt-2 overflow-auto max-h-32 font-mono bg-base-200 p-2 rounded">
                        {JSON.stringify(testResult.rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="flex justify-end mt-6">
                  <button 
                    className="btn btn-primary"
                    onClick={closeTestResultModal}
                    data-testid="button-close-test-result-final"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Upgrade Modal for Admin Limits */}
      <FeatureUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            featureName="Unlimited Admin Accounts"
            featureDescription="Your current plan allows 1 administrator account. Upgrade to add unlimited administrator accounts and empower your team with full administrative access."
            featureIcon="fas fa-users-crown"
          />
    </>
  );
}
