import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { VisualCertificateEditor } from "@/components/VisualCertificateEditor";
import { generateColorPalette, applyColorPalette } from "@/utils/colorUtils";
import type { UploadResult } from "@uppy/core";

interface OrganisationSettings {
  organisationId: string;
  signatureImageUrl?: string;
  signerName?: string;
  signerTitle?: string;
  certificateText?: string;
  assignmentEmailsEnabled: boolean;
  reminderEmailsEnabled: boolean;
  completionEmailsEnabled: boolean;
  reminderDays: number;
  defaultCertificateDownload: boolean;
}

export function AdminOrganisationSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch current organization data
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  const [brandingData, setBrandingData] = useState({
    logoUrl: "",
    theme: "corporate",
    displayName: "",
    subdomain: "",
    accentColor: "#3b82f6",
    primaryColor: "#3b82f6",
    useCustomColors: false,
  });

  const [contactData, setContactData] = useState({
    email: "",
    phone: "",
    address: "",
  });

  const [certificateData, setCertificateData] = useState({
    signatureImageUrl: "",
    signerName: "",
    signerTitle: "",
    certificateText: "has successfully completed",
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
        theme: organization.theme || "corporate",
        displayName: organization.displayName || "",
        subdomain: organization.subdomain || "",
        accentColor: organization.accentColor || "#3b82f6",
        primaryColor: organization.primaryColor || "#3b82f6",
        useCustomColors: organization.useCustomColors || false,
      });
      setContactData({
        email: organization.contactEmail || "",
        phone: organization.contactPhone || "",
        address: organization.address || "",
      });
    }
  }, [organization]);

  // Apply custom color palette when primary color or useCustomColors changes
  useEffect(() => {
    if (brandingData.useCustomColors && brandingData.primaryColor) {
      const colorPalette = generateColorPalette(brandingData.primaryColor);
      applyColorPalette(colorPalette);
      // Add data attribute to enable custom color overrides
      document.documentElement.setAttribute('data-custom-colors', 'true');
    } else {
      // Remove custom colors to use default theme colors
      const root = document.documentElement;
      const properties = [
        '--color-primary', '--color-primary-hover',
        '--color-secondary', '--color-secondary-hover', 
        '--color-accent', '--color-accent-hover',
        '--color-neutral', '--color-neutral-hover'
      ];
      properties.forEach(prop => root.style.removeProperty(prop));
      // Remove data attribute to disable custom color overrides
      document.documentElement.removeAttribute('data-custom-colors');
    }
  }, [brandingData.primaryColor, brandingData.useCustomColors]);

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

  const handleSignatureUpload = async () => {
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

  const handleSignatureComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadUrl = result.successful[0].uploadURL as string;
      setCertificateData(prev => ({ ...prev, signatureImageUrl: uploadUrl }));
      toast({
        title: "Success",
        description: "Signature uploaded successfully",
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
      theme: brandingData.theme,
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

  const tabs = user?.role === 'superadmin' 
    ? ["Branding", "Contacts", "Certificates", "Visual Designer", "Notifications", "Privacy"]
    : ["Branding", "Contacts", "Certificates", "Notifications", "Privacy"];

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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Organisation Logo</span>
                  </label>
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
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">DaisyUI Theme</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={brandingData.theme}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, theme: e.target.value }))}
                    data-testid="select-theme"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="corporate">Corporate</option>
                    <option value="business">Business</option>
                    <option value="emerald">Emerald</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="pastel">Pastel</option>
                  </select>
                  <label className="label">
                    <span className="label-text-alt">Choose a base DaisyUI theme for your organization</span>
                  </label>
                </div>
              </div>

              {/* Custom Color Section */}
              <div className="divider">Custom Colors</div>
              
              <div className="form-control">
                <label className="cursor-pointer label justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary" 
                    checked={brandingData.useCustomColors}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, useCustomColors: e.target.checked }))}
                    data-testid="checkbox-custom-colors"
                  />
                  <div>
                    <span className="label-text font-semibold">Use Custom Colors</span>
                    <div className="text-sm text-gray-500">Override theme colors with your own brand colors</div>
                  </div>
                </label>
              </div>

              {brandingData.useCustomColors && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-base-100 rounded-lg border">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Primary Color</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        className="w-12 h-10 rounded border border-base-300 cursor-pointer"
                        value={brandingData.primaryColor}
                        onChange={(e) => setBrandingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        data-testid="input-primary-color"
                      />
                      <input 
                        type="text" 
                        className="input input-bordered flex-1" 
                        value={brandingData.primaryColor}
                        onChange={(e) => setBrandingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#3b82f6"
                        data-testid="input-primary-color-text"
                      />
                    </div>
                    <label className="label">
                      <span className="label-text-alt">This will be used for primary buttons and key actions</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Color Preview</span>
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button 
                          className="btn btn-sm"
                          style={{ 
                            backgroundColor: brandingData.primaryColor,
                            borderColor: brandingData.primaryColor,
                            color: 'white'
                          }}
                        >
                          Primary Button
                        </button>
                        <button 
                          className="btn btn-sm btn-outline"
                          style={{ 
                            borderColor: brandingData.primaryColor,
                            color: brandingData.primaryColor
                          }}
                        >
                          Secondary
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        Secondary and accent colors will be automatically generated
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  </label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={brandingData.subdomain}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, subdomain: e.target.value }))}
                    data-testid="input-subdomain"
                  />
                  <label className="label">
                    <span className="label-text-alt">https://{brandingData.subdomain}.lms-platform.com</span>
                  </label>
                </div>
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

          {/* Certificates Tab */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Certificate Settings</h3>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Signature Image</span>
                </label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={2097152} // 2MB
                  onGetUploadParameters={handleSignatureUpload}
                  onComplete={handleSignatureComplete}
                  buttonClassName="btn btn-outline w-full"
                >
                  <i className="fas fa-signature mr-2"></i>
                  {certificateData.signatureImageUrl ? "Change Signature" : "Upload Signature"}
                </ObjectUploader>
                {certificateData.signatureImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={certificateData.signatureImageUrl} alt="Signature preview" className="h-8 object-contain" />
                    <span className="text-sm text-success">Signature uploaded</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Signer Name</span>
                  </label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={certificateData.signerName}
                    onChange={(e) => setCertificateData(prev => ({ ...prev, signerName: e.target.value }))}
                    data-testid="input-signer-name"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Signer Title</span>
                  </label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={certificateData.signerTitle}
                    onChange={(e) => setCertificateData(prev => ({ ...prev, signerTitle: e.target.value }))}
                    data-testid="input-signer-title"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Default Certificate Text</span>
                </label>
                <input 
                  type="text" 
                  className="input input-bordered" 
                  value={certificateData.certificateText}
                  onChange={(e) => setCertificateData(prev => ({ ...prev, certificateText: e.target.value }))}
                  placeholder="has successfully completed"
                  data-testid="input-certificate-text"
                />
                <label className="label">
                  <span className="label-text-alt">This text appears between the user name and course name</span>
                </label>
              </div>
            </div>
          )}

          {/* Visual Designer Tab - SuperAdmin Only */}
          {user?.role === 'superadmin' && activeTab === 3 && (
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
          {activeTab === (user?.role === 'superadmin' ? 4 : 3) && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Email Notifications</h3>
              
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-primary" 
                      checked={notificationData.assignmentEmailsEnabled}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, assignmentEmailsEnabled: e.target.checked }))}
                      data-testid="toggle-assignment-emails"
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
                      className="toggle toggle-primary" 
                      checked={notificationData.reminderEmailsEnabled}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, reminderEmailsEnabled: e.target.checked }))}
                      data-testid="toggle-reminder-emails"
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
                      className="toggle toggle-primary" 
                      checked={notificationData.completionEmailsEnabled}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, completionEmailsEnabled: e.target.checked }))}
                      data-testid="toggle-completion-emails"
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

          {/* Privacy Tab */}
          {activeTab === (user?.role === 'superadmin' ? 5 : 4) && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Privacy Settings</h3>
              
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="toggle toggle-primary" 
                    checked={privacyData.defaultCertificateDownload}
                    onChange={(e) => setPrivacyData(prev => ({ ...prev, defaultCertificateDownload: e.target.checked }))}
                    data-testid="toggle-default-cert-download"
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
