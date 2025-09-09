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

  // Build tabs array based on role and features
  const buildTabs = () => {
    const baseTabs = ["Branding", "Contacts"];
    
    if (user?.role === 'superadmin') {
      baseTabs.push("Visual Designer");
    }
    
    baseTabs.push("Notifications");
    
    if (hasEmailTemplatesAccess) {
      baseTabs.push("Email Templates");
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

          {/* Email Templates Tab */}
          {hasEmailTemplatesAccess && activeTab === tabs.indexOf("Email Templates") && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Email Templates</h3>
                <button 
                  className="btn btn-primary"
                  data-testid="button-add-template"
                  style={{
                    '--primary-color': organization?.primaryColor || '#3b82f6',
                    backgroundColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                    borderColor: organization?.useCustomColors ? organization?.primaryColor || '#3b82f6' : '#3b82f6',
                  } as React.CSSProperties}
                >
                  <i className="fas fa-plus"></i>
                  New Template
                </button>
              </div>
              
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
                      <button className="btn btn-outline btn-sm" data-testid="button-edit-welcome">
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
                      <button className="btn btn-outline btn-sm" data-testid="button-edit-assignment">
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
                      <button className="btn btn-outline btn-sm" data-testid="button-edit-reminder">
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
                      <button className="btn btn-outline btn-sm" data-testid="button-edit-completion">
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
                      <button className="btn btn-outline btn-sm" data-testid="button-edit-password-reset">
                        <i className="fas fa-edit"></i>
                        Edit
                      </button>
                    </div>
                  </div>
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
    </div>
  );
}
