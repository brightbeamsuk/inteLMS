import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { insertConsentRecordSchema, type ConsentRecord } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { Shield, Eye, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface ConsentFormData {
  marketingConsents: {
    email: boolean;
    sms: boolean;
    phone: boolean;
    post: boolean;
    pushNotifications: boolean;
  };
  cookieConsents: {
    strictlyNecessary: boolean;
    functional: boolean;
    analytics: boolean;
    advertising: boolean;
  };
  serviceConsents: {
    communications: boolean;
    support: boolean;
    training: boolean;
  };
}

const initialConsentData: ConsentFormData = {
  marketingConsents: {
    email: false,
    sms: false,
    phone: false,
    post: false,
    pushNotifications: false,
  },
  cookieConsents: {
    strictlyNecessary: true, // Always required
    functional: false,
    analytics: false,
    advertising: false,
  },
  serviceConsents: {
    communications: false,
    support: false,
    training: false,
  },
};

// Policy version is now fetched dynamically from the server

export function ConsentPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [consentData, setConsentData] = useState<ConsentFormData>(initialConsentData);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ConsentRecord | null>(null);

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-info">
          <span>Consent & Preferences are not available in this configuration.</span>
        </div>
      </div>
    );
  }

  // Fetch current consent status
  const { data: currentConsent, isLoading: consentLoading } = useQuery<ConsentRecord>({
    queryKey: ['/api/gdpr/consent'],
    enabled: !!user?.id,
    retry: false, // Don't retry if no consent exists yet
  });

  // Fetch consent history
  const { data: consentHistory, isLoading: historyLoading } = useQuery<ConsentRecord[]>({
    queryKey: ['/api/gdpr/consent/history'],
    enabled: !!user?.id,
  });

  // Fetch current policy version
  const { data: policyVersionData, isLoading: policyVersionLoading } = useQuery<{ policyVersion: string; lastUpdated: string }>({
    queryKey: ['/api/gdpr/policy-version'],
    retry: false,
  });

  // Initialize form with current consent data
  useEffect(() => {
    if (currentConsent && currentConsent.status !== 'withdrawn') {
      setConsentData({
        marketingConsents: currentConsent.marketingConsents as any || initialConsentData.marketingConsents,
        cookieConsents: currentConsent.cookieConsents as any || initialConsentData.cookieConsents,
        serviceConsents: (currentConsent.metadata as any)?.serviceConsents || initialConsentData.serviceConsents,
      });
    }
  }, [currentConsent]);

  // Grant consent mutation
  const grantConsentMutation = useMutation({
    mutationFn: async (data: ConsentFormData) => {
      const payload = {
        consentType: 'general_platform_consent',
        lawfulBasis: 'consent' as const,
        purpose: 'Marketing communications, analytics, and service functionality as per user preferences',
        policyVersion: policyVersionData?.policyVersion || '2.0', // Fallback to 2.0 if not loaded
        marketingConsents: data.marketingConsents,
        cookieConsents: data.cookieConsents,
        metadata: {
          serviceConsents: data.serviceConsents,
          updatedVia: 'consent_preferences_page',
        },
      };

      return await apiRequest('/api/gdpr/consent', 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/consent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/consent/history'] });
      toast({
        title: "Consent updated",
        description: "Your consent preferences have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update consent preferences",
        variant: "destructive",
      });
    },
  });

  // Withdraw consent mutation
  const withdrawConsentMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return await apiRequest(`/api/gdpr/consent/${consentId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/consent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/consent/history'] });
      setConsentData(initialConsentData);
      toast({
        title: "Consent withdrawn",
        description: "Your consent has been withdrawn successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to withdraw consent",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    grantConsentMutation.mutate(consentData);
  };

  const handleWithdrawConsent = () => {
    if (!currentConsent?.id) return;
    
    if (window.confirm('Are you sure you want to withdraw all consent? This will reset all your preferences.')) {
      withdrawConsentMutation.mutate(currentConsent.id);
    }
  };

  const updateMarketingConsent = (field: keyof ConsentFormData['marketingConsents'], value: boolean) => {
    setConsentData(prev => ({
      ...prev,
      marketingConsents: {
        ...prev.marketingConsents,
        [field]: value
      }
    }));
  };

  const updateCookieConsent = (field: keyof ConsentFormData['cookieConsents'], value: boolean) => {
    setConsentData(prev => ({
      ...prev,
      cookieConsents: {
        ...prev.cookieConsents,
        [field]: value
      }
    }));
  };

  const updateServiceConsent = (field: keyof ConsentFormData['serviceConsents'], value: boolean) => {
    setConsentData(prev => ({
      ...prev,
      serviceConsents: {
        ...prev.serviceConsents,
        [field]: value
      }
    }));
  };

  const getConsentStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return <div className="badge badge-success gap-2"><CheckCircle className="w-3 h-3" />Granted</div>;
      case 'withdrawn':
        return <div className="badge badge-error gap-2"><XCircle className="w-3 h-3" />Withdrawn</div>;
      case 'denied':
        return <div className="badge badge-warning gap-2"><XCircle className="w-3 h-3" />Denied</div>;
      default:
        return <div className="badge badge-ghost gap-2"><AlertCircle className="w-3 h-3" />Unknown</div>;
    }
  };

  if (consentLoading || historyLoading || policyVersionLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Consent & Preferences
          </h1>
          <p className="text-gray-600">
            Manage your consent preferences for marketing communications, cookies, and service functionality. 
            You can update or withdraw your consent at any time.
          </p>
        </div>

        {/* Current Status */}
        {currentConsent && (
          <div className="alert alert-info mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">Current Status:</span>
                {getConsentStatusBadge(currentConsent.status)}
              </div>
              <div className="text-sm">
                Last updated: {format(new Date(currentConsent.timestamp), 'PPP at p')} | 
                Policy version: {currentConsent.policyVersion}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Consent Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Service Communications */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Service Communications
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Essential communications about your account, training, and support.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.serviceConsents.communications}
                          onChange={(e) => updateServiceConsent('communications', e.target.checked)}
                          data-testid="checkbox-service-communications"
                        />
                        <div>
                          <span className="label-text font-medium">Platform communications</span>
                          <div className="label-text-alt">Account updates, system notifications</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.serviceConsents.support}
                          onChange={(e) => updateServiceConsent('support', e.target.checked)}
                          data-testid="checkbox-service-support"
                        />
                        <div>
                          <span className="label-text font-medium">Support communications</span>
                          <div className="label-text-alt">Help requests, technical support</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.serviceConsents.training}
                          onChange={(e) => updateServiceConsent('training', e.target.checked)}
                          data-testid="checkbox-service-training"
                        />
                        <div>
                          <span className="label-text font-medium">Training notifications</span>
                          <div className="label-text-alt">Course assignments, deadlines, completions</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marketing Communications */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title text-lg">Marketing Communications</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose how you'd like to receive marketing updates and promotional content.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.marketingConsents.email}
                          onChange={(e) => updateMarketingConsent('email', e.target.checked)}
                          data-testid="checkbox-marketing-email"
                        />
                        <div>
                          <span className="label-text font-medium">Email marketing</span>
                          <div className="label-text-alt">Newsletters, product updates, promotions</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.marketingConsents.sms}
                          onChange={(e) => updateMarketingConsent('sms', e.target.checked)}
                          data-testid="checkbox-marketing-sms"
                        />
                        <div>
                          <span className="label-text font-medium">SMS marketing</span>
                          <div className="label-text-alt">Text message updates and offers</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.marketingConsents.phone}
                          onChange={(e) => updateMarketingConsent('phone', e.target.checked)}
                          data-testid="checkbox-marketing-phone"
                        />
                        <div>
                          <span className="label-text font-medium">Phone marketing</span>
                          <div className="label-text-alt">Promotional calls and updates</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.marketingConsents.post}
                          onChange={(e) => updateMarketingConsent('post', e.target.checked)}
                          data-testid="checkbox-marketing-post"
                        />
                        <div>
                          <span className="label-text font-medium">Postal marketing</span>
                          <div className="label-text-alt">Brochures and promotional materials by post</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.marketingConsents.pushNotifications}
                          onChange={(e) => updateMarketingConsent('pushNotifications', e.target.checked)}
                          data-testid="checkbox-marketing-push"
                        />
                        <div>
                          <span className="label-text font-medium">Push notifications</span>
                          <div className="label-text-alt">Browser and mobile app notifications</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cookie Preferences */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title text-lg">Cookie Preferences</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Control which cookies we can use to improve your experience.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={true}
                          disabled
                          data-testid="checkbox-cookie-necessary"
                        />
                        <div>
                          <span className="label-text font-medium">Strictly necessary cookies</span>
                          <div className="label-text-alt">Required for basic site functionality (cannot be disabled)</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.cookieConsents.functional}
                          onChange={(e) => updateCookieConsent('functional', e.target.checked)}
                          data-testid="checkbox-cookie-functional"
                        />
                        <div>
                          <span className="label-text font-medium">Functional cookies</span>
                          <div className="label-text-alt">Remember your preferences and settings</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.cookieConsents.analytics}
                          onChange={(e) => updateCookieConsent('analytics', e.target.checked)}
                          data-testid="checkbox-cookie-analytics"
                        />
                        <div>
                          <span className="label-text font-medium">Analytics cookies</span>
                          <div className="label-text-alt">Help us understand how you use our platform</div>
                        </div>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="cursor-pointer label justify-start">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mr-3"
                          checked={consentData.cookieConsents.advertising}
                          onChange={(e) => updateCookieConsent('advertising', e.target.checked)}
                          data-testid="checkbox-cookie-advertising"
                        />
                        <div>
                          <span className="label-text font-medium">Advertising cookies</span>
                          <div className="label-text-alt">Show you relevant advertisements</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                {currentConsent && currentConsent.status !== 'withdrawn' && (
                  <button
                    type="button"
                    className={`btn btn-outline btn-error ${withdrawConsentMutation.isPending ? 'loading' : ''}`}
                    disabled={withdrawConsentMutation.isPending || grantConsentMutation.isPending}
                    onClick={handleWithdrawConsent}
                    data-testid="button-withdraw-consent"
                  >
                    {withdrawConsentMutation.isPending ? 'Withdrawing...' : 'Withdraw All Consent'}
                  </button>
                )}
                
                <div className="flex-1" />
                
                <button
                  type="submit"
                  className={`btn btn-primary ${grantConsentMutation.isPending ? 'loading' : ''}`}
                  disabled={grantConsentMutation.isPending || withdrawConsentMutation.isPending}
                  data-testid="button-save-consent"
                >
                  {grantConsentMutation.isPending ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>

          {/* Consent History Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Consent History
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Complete audit trail of all consent changes.
                </p>
                
                {consentHistory && consentHistory.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {consentHistory.map((record) => (
                      <div
                        key={record.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedHistoryItem?.id === record.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedHistoryItem(
                          selectedHistoryItem?.id === record.id ? null : record
                        )}
                        data-testid={`history-item-${record.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          {getConsentStatusBadge(record.status)}
                          <span className="text-xs text-gray-500">
                            v{record.policyVersion}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {format(new Date(record.timestamp), 'PPP')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(record.timestamp), 'p')}
                        </div>
                        
                        {selectedHistoryItem?.id === record.id && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs space-y-1">
                              <div><strong>Purpose:</strong> {record.purpose}</div>
                              <div><strong>Lawful Basis:</strong> {record.lawfulBasis}</div>
                              <div><strong>IP Address:</strong> {record.ipAddress}</div>
                              {record.withdrawnAt && (
                                <div><strong>Withdrawn:</strong> {format(new Date(record.withdrawnAt), 'PPP at p')}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No consent history available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}