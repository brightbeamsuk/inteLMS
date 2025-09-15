import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { insertPrivacySettingsSchema, type PrivacySettings, type InsertPrivacySettings } from "@shared/schema";
import { z } from "zod";

export function PrivacySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [formData, setFormData] = useState<Partial<PrivacySettings>>({
    dataRetentionPeriod: 2555, // 7 years default
    cookieSettings: {},
    privacyContacts: {},
    internationalTransfers: { enabled: false, countries: [] },
    settings: {}
  });

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-info">
          <span>GDPR Privacy Settings are not available in this configuration.</span>
        </div>
      </div>
    );
  }

  // Fetch existing privacy settings
  const { data: privacySettings, isLoading } = useQuery<PrivacySettings>({
    queryKey: ['/api/gdpr/privacy-settings'],
    enabled: !!user?.organisationId && (user?.role === 'admin' || user?.role === 'superadmin'),
  });

  // Initialize form with existing data
  useEffect(() => {
    if (privacySettings) {
      setFormData(privacySettings);
    }
  }, [privacySettings]);

  // Create or update privacy settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<InsertPrivacySettings>) => {
      if (privacySettings?.id) {
        // Update existing settings
        return await apiRequest('/api/gdpr/privacy-settings', 'PATCH', data);
      } else {
        // Create new settings
        return await apiRequest('/api/gdpr/privacy-settings', 'POST', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/privacy-settings'] });
      toast({
        title: "Privacy settings updated",
        description: "Your privacy settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update privacy settings",
        variant: "destructive",
      });
    },
  });

  // Delete privacy settings mutation
  const deleteSettingsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/gdpr/privacy-settings', 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/privacy-settings'] });
      setFormData({
        dataRetentionPeriod: 2555,
        cookieSettings: {},
        privacyContacts: {},
        internationalTransfers: { enabled: false, countries: [] },
        settings: {}
      });
      toast({
        title: "Privacy settings deleted",
        description: "Your privacy settings have been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete privacy settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate data using Zod schema (partial for updates)
      const schemaToUse = privacySettings?.id 
        ? insertPrivacySettingsSchema.partial().omit({ organisationId: true })
        : insertPrivacySettingsSchema.omit({ organisationId: true });
      const validatedData = schemaToUse.parse(formData);
      updateSettingsMutation.mutate(validatedData);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        toast({
          title: "Validation Error",
          description: "Please check your input data",
          variant: "destructive",
        });
      }
    }
  };

  const updateFormField = (field: keyof PrivacySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent: keyof PrivacySettings, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as Record<string, any>),
        [field]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error">
          <span>Access denied. Only administrators can manage privacy settings.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Settings</h1>
          <p className="text-gray-600">
            Configure your organisation's GDPR privacy settings including data retention, privacy contacts, and international transfers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Data Retention Section */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg">Data Retention</h2>
              <div className="form-control w-full max-w-xs">
                <label className="label">
                  <span className="label-text">Data retention period (days)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  className="input input-bordered w-full max-w-xs"
                  value={formData.dataRetentionPeriod || 2555}
                  onChange={(e) => updateFormField('dataRetentionPeriod', parseInt(e.target.value))}
                  data-testid="input-retention-period"
                />
                <label className="label">
                  <span className="label-text-alt">Default: 2555 days (7 years)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Privacy Contacts Section */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg">Privacy Contacts</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Data Protection Officer Email</span>
                  </label>
                  <input
                    type="email"
                    placeholder="dpo@example.com"
                    className="input input-bordered"
                    value={formData.privacyContacts?.dpoEmail || ''}
                    onChange={(e) => updateNestedField('privacyContacts', 'dpoEmail', e.target.value)}
                    data-testid="input-dpo-email"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Privacy Enquiries Email</span>
                  </label>
                  <input
                    type="email"
                    placeholder="privacy@example.com"
                    className="input input-bordered"
                    value={formData.privacyContacts?.privacyEmail || ''}
                    onChange={(e) => updateNestedField('privacyContacts', 'privacyEmail', e.target.value)}
                    data-testid="input-privacy-email"
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Complaints Procedure</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  placeholder="Describe the process for handling privacy complaints..."
                  value={formData.privacyContacts?.complaintsProcedure || ''}
                  onChange={(e) => updateNestedField('privacyContacts', 'complaintsProcedure', e.target.value)}
                  data-testid="textarea-complaints-procedure"
                />
              </div>
            </div>
          </div>

          {/* International Transfers Section */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg">International Transfers</h2>
              <div className="form-control">
                <label className="cursor-pointer label justify-start">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary mr-3"
                    checked={formData.internationalTransfers?.enabled || false}
                    onChange={(e) => updateNestedField('internationalTransfers', 'enabled', e.target.checked)}
                    data-testid="checkbox-international-transfers"
                  />
                  <span className="label-text">Enable international data transfers</span>
                </label>
              </div>
              
              {formData.internationalTransfers?.enabled && (
                <div className="mt-4 space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Transfer Countries (comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="United States, Canada, Germany"
                      className="input input-bordered"
                      value={formData.internationalTransfers?.countries?.join(', ') || ''}
                      onChange={(e) => updateNestedField('internationalTransfers', 'countries', 
                        e.target.value.split(',').map(c => c.trim()).filter(c => c.length > 0))}
                      data-testid="input-transfer-countries"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Safeguards Description</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      placeholder="Describe the appropriate safeguards in place..."
                      value={formData.internationalTransfers?.safeguards || ''}
                      onChange={(e) => updateNestedField('internationalTransfers', 'safeguards', e.target.value)}
                      data-testid="textarea-transfer-safeguards"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            {privacySettings?.id && (
              <button
                type="button"
                className={`btn btn-error ${deleteSettingsMutation.isPending ? 'loading' : ''}`}
                disabled={deleteSettingsMutation.isPending || updateSettingsMutation.isPending}
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete all privacy settings? This action cannot be undone.')) {
                    deleteSettingsMutation.mutate();
                  }
                }}
                data-testid="button-delete-settings"
              >
                {deleteSettingsMutation.isPending ? 'Deleting...' : 'Delete Settings'}
              </button>
            )}
            <div className="flex-1" />
            <button
              type="submit"
              className={`btn btn-primary ${updateSettingsMutation.isPending ? 'loading' : ''}`}
              disabled={updateSettingsMutation.isPending || deleteSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Privacy Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}