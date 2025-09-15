import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { 
  Settings, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Clock,
  Users,
  Lock,
  AlertCircle,
  ExternalLink
} from "lucide-react";

interface IntegrationGdprSettings {
  id: string;
  organisationId: string;
  integrationType: string;
  integrationName: string;
  isEnabled: boolean;
  dataMinimizationEnabled: boolean;
  consentRequired: boolean;
  dataRetentionDays: number;
  anonymizationEnabled: boolean;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  complianceStatus: 'compliant' | 'requires_review' | 'non_compliant';
  privacyPolicyUrl?: string;
  dataProcessingAgreementUrl?: string;
  supportedUserRights: string[];
  lawfulBasisForProcessing: string;
  specialCategoryData: boolean;
  crossBorderDataTransfers: boolean;
  transferSafeguards: string;
  automatedDecisionMaking: boolean;
  dataBreachNotificationRequired: boolean;
  lastAssessment?: Date;
  assessmentNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IntegrationComplianceReport {
  overallCompliance: 'compliant' | 'attention_required' | 'non_compliant';
  integrationReports: Record<string, any>;
  summary: {
    totalIntegrations: number;
    compliantIntegrations: number;
    attentionRequiredIntegrations: number;
    nonCompliantIntegrations: number;
  };
  recommendations: string[];
  lastUpdated: string;
}

export function IntegrationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationGdprSettings | null>(null);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [selectedOrganisationId, setSelectedOrganisationId] = useState<string>('');

  // Initialize selected organization for superadmins
  useEffect(() => {
    if (user?.role === 'superadmin') {
      setSelectedOrganisationId(user?.organisationId || '');
    } else if (user?.role === 'admin') {
      setSelectedOrganisationId(user?.organisationId || '');
    }
  }, [user]);

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-info">
          <span>Integration GDPR Settings are not available in this configuration.</span>
        </div>
      </div>
    );
  }

  // Access control check
  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error">
          <span>Access denied. Only administrators can manage integration GDPR settings.</span>
        </div>
      </div>
    );
  }

  // Fetch organizations for superadmin selector
  const { data: organizations } = useQuery({
    queryKey: ['/api/organisations'],
    queryFn: async () => {
      const response = await fetch('/api/organisations', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      return response.json();
    },
    enabled: user?.role === 'superadmin',
  });

  // Fetch integration settings
  const { data: integrationSettings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<IntegrationGdprSettings[]>({
    queryKey: ['/api/gdpr/integration-settings', selectedOrganisationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (user?.role === 'superadmin' && selectedOrganisationId) {
        params.append('organisationId', selectedOrganisationId);
      } else if (user?.role === 'admin' && user?.organisationId) {
        params.append('organisationId', user.organisationId);
      }
      
      const queryString = params.toString();
      const url = `/api/gdpr/integration-settings${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch integration settings');
      }
      
      return response.json();
    },
    enabled: !!user?.id && (user?.role !== 'superadmin' || selectedOrganisationId !== ''),
  });

  // Fetch compliance report
  const { data: complianceReport, isLoading: reportLoading } = useQuery<IntegrationComplianceReport>({
    queryKey: ['/api/gdpr/integration-compliance-report', selectedOrganisationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (user?.role === 'superadmin' && selectedOrganisationId) {
        params.append('organisationId', selectedOrganisationId);
      } else if (user?.role === 'admin' && user?.organisationId) {
        params.append('organisationId', user.organisationId);
      }
      
      const queryString = params.toString();
      const url = `/api/gdpr/integration-compliance-report${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch compliance report');
      }
      
      return response.json();
    },
    enabled: !!user?.id && (user?.role !== 'superadmin' || selectedOrganisationId !== ''),
  });

  // Update integration settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IntegrationGdprSettings> }) => {
      return await apiRequest(`/api/gdpr/integration-settings/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/integration-compliance-report'] });
      toast({
        title: "Settings updated",
        description: "Integration GDPR settings have been updated successfully.",
      });
      setSelectedIntegration(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update integration settings",
        variant: "destructive",
      });
    },
  });

  // Initialize integration compliance mutation
  const initializeComplianceMutation = useMutation({
    mutationFn: async (integrationTypes: string[]) => {
      let organisationId: string;
      
      if (user?.role === 'superadmin') {
        if (!selectedOrganisationId) {
          throw new Error('Please select an organisation first');
        }
        organisationId = selectedOrganisationId;
      } else {
        organisationId = user?.organisationId || '';
      }
      
      return await apiRequest('/api/gdpr/initialize-integration-compliance', 'POST', {
        organisationId,
        integrationTypes,
        configuredBy: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/integration-compliance-report'] });
      toast({
        title: "Compliance initialized",
        description: "Integration GDPR compliance has been initialized successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize integration compliance",
        variant: "destructive",
      });
    },
  });

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'text-success';
      case 'requires_review':
        return 'text-warning';
      case 'non_compliant':
        return 'text-error';
      default:
        return 'text-gray-500';
    }
  };

  const getComplianceStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'requires_review':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'non_compliant':
        return <XCircle className="w-5 h-5 text-error" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getIntegrationTypeDisplayName = (type: string) => {
    const displayNames: Record<string, string> = {
      'stripe': 'Stripe Payment Processing',
      'sendgrid_api': 'SendGrid Email API',
      'brevo_api': 'Brevo Email API',
      'mailgun_api': 'Mailgun Email API',
      'postmark_api': 'Postmark Email API',
      'mailjet_api': 'Mailjet Email API',
      'sparkpost_api': 'SparkPost Email API',
      'smtp_generic': 'SMTP Email Service',
      'google_analytics': 'Google Analytics',
      'matomo': 'Matomo Analytics',
      'plausible': 'Plausible Analytics',
      'mixpanel': 'Mixpanel Analytics',
      'amplitude': 'Amplitude Analytics'
    };
    return displayNames[type] || type;
  };

  const getLawfulBasisDisplayName = (basis: string) => {
    const displayNames: Record<string, string> = {
      'consent': 'Consent',
      'contract': 'Contract Performance',
      'legal_obligation': 'Legal Obligation',
      'vital_interests': 'Vital Interests',
      'public_task': 'Public Task',
      'legitimate_interests': 'Legitimate Interests'
    };
    return displayNames[basis] || basis;
  };

  const toggleDetails = (integrationId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }));
  };

  const handleUpdateSettings = (integration: IntegrationGdprSettings, updates: Partial<IntegrationGdprSettings>) => {
    updateSettingsMutation.mutate({ id: integration.id, data: updates });
  };

  const handleInitializeCompliance = () => {
    // Initialize compliance for common integrations
    const commonIntegrations = ['stripe', 'sendgrid_api', 'google_analytics'];
    initializeComplianceMutation.mutate(commonIntegrations);
  };

  if (settingsLoading || reportLoading) {
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
            <Settings className="w-6 h-6" />
            Integration GDPR Settings
          </h1>
          <p className="text-gray-600">
            Manage GDPR compliance settings for third-party integrations. 
            Ensure all external services respect user privacy preferences and data protection requirements.
          </p>
        </div>

        {/* Organization Selector for Superadmins */}
        {user?.role === 'superadmin' && (
          <div className="mb-6">
            <div className="form-control w-full max-w-md">
              <label className="label">
                <span className="label-text">Select Organisation</span>
              </label>
              <select
                className="select select-bordered"
                value={selectedOrganisationId}
                onChange={(e) => setSelectedOrganisationId(e.target.value)}
                data-testid="select-organisation"
              >
                <option value="">Select Organisation...</option>
                {organizations?.map((org: any) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Compliance Overview */}
        {complianceReport && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Compliance Overview
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="stat bg-base-100 border rounded-lg">
                <div className="stat-title">Total Integrations</div>
                <div className="stat-value text-primary">{complianceReport.summary.totalIntegrations}</div>
              </div>
              <div className="stat bg-base-100 border rounded-lg">
                <div className="stat-title">Compliant</div>
                <div className="stat-value text-success">{complianceReport.summary.compliantIntegrations}</div>
              </div>
              <div className="stat bg-base-100 border rounded-lg">
                <div className="stat-title">Needs Attention</div>
                <div className="stat-value text-warning">{complianceReport.summary.attentionRequiredIntegrations}</div>
              </div>
              <div className="stat bg-base-100 border rounded-lg">
                <div className="stat-title">Non-Compliant</div>
                <div className="stat-value text-error">{complianceReport.summary.nonCompliantIntegrations}</div>
              </div>
            </div>

            {complianceReport.recommendations.length > 0 && (
              <div className="alert alert-warning">
                <AlertTriangle className="w-4 h-4" />
                <div>
                  <h4 className="font-semibold">Recommendations:</h4>
                  <ul className="mt-2 space-y-1">
                    {complianceReport.recommendations.slice(0, 3).map((rec, index) => (
                      <li key={index} className="text-sm">• {rec}</li>
                    ))}
                    {complianceReport.recommendations.length > 3 && (
                      <li className="text-sm text-gray-500">... and {complianceReport.recommendations.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            onClick={handleInitializeCompliance}
            disabled={initializeComplianceMutation.isPending}
            data-testid="button-initialize-compliance"
          >
            {initializeComplianceMutation.isPending ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Initialize GDPR Compliance
              </>
            )}
          </button>
          
          <button
            className="btn btn-outline"
            onClick={() => {
              refetchSettings();
              queryClient.invalidateQueries({ queryKey: ['/api/gdpr/integration-compliance-report'] });
            }}
            data-testid="button-refresh-settings"
          >
            Refresh Settings
          </button>
        </div>

        {/* Integration Settings List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Settings</h2>
          
          {!integrationSettings || integrationSettings.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Integration Settings Found</h3>
              <p className="text-gray-600 mb-4">
                Initialize GDPR compliance to configure your integrations with privacy-by-design settings.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleInitializeCompliance}
                disabled={initializeComplianceMutation.isPending}
                data-testid="button-initialize-first-compliance"
              >
                <Shield className="w-4 h-4" />
                Initialize GDPR Compliance
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {integrationSettings.map((integration) => (
                <div key={integration.id} className="card bg-base-100 border shadow-sm">
                  <div className="card-body">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{integration.integrationName}</h3>
                          {getComplianceStatusIcon(integration.complianceStatus)}
                          <div className="badge badge-outline">
                            {getIntegrationTypeDisplayName(integration.integrationType)}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {integration.consentRequired ? 'Consent Required' : 'No Consent Required'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {integration.dataRetentionDays} days retention
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {getLawfulBasisDisplayName(integration.lawfulBasisForProcessing)}
                          </div>
                          {integration.crossBorderDataTransfers && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              International transfers
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <div className="form-control">
                            <label className="cursor-pointer label justify-start gap-2">
                              <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-primary"
                                checked={integration.isEnabled}
                                onChange={(e) => handleUpdateSettings(integration, { isEnabled: e.target.checked })}
                                data-testid={`toggle-enabled-${integration.id}`}
                              />
                              <span className="label-text text-sm">Enabled</span>
                            </label>
                          </div>

                          <div className="form-control">
                            <label className="cursor-pointer label justify-start gap-2">
                              <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-success"
                                checked={integration.dataMinimizationEnabled}
                                onChange={(e) => handleUpdateSettings(integration, { dataMinimizationEnabled: e.target.checked })}
                                data-testid={`toggle-data-minimization-${integration.id}`}
                              />
                              <span className="label-text text-sm">Data Minimization</span>
                            </label>
                          </div>

                          <div className="form-control">
                            <label className="cursor-pointer label justify-start gap-2">
                              <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-warning"
                                checked={integration.auditLoggingEnabled}
                                onChange={(e) => handleUpdateSettings(integration, { auditLoggingEnabled: e.target.checked })}
                                data-testid={`toggle-audit-logging-${integration.id}`}
                              />
                              <span className="label-text text-sm">Audit Logging</span>
                            </label>
                          </div>
                        </div>

                        {integration.assessmentNotes && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>Assessment Notes:</strong> {integration.assessmentNotes}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {integration.privacyPolicyUrl && (
                          <a
                            href={integration.privacyPolicyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline"
                            data-testid={`link-privacy-policy-${integration.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Privacy Policy
                          </a>
                        )}

                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => toggleDetails(integration.id)}
                          data-testid={`button-toggle-details-${integration.id}`}
                        >
                          {showDetails[integration.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {showDetails[integration.id] ? 'Hide Details' : 'Show Details'}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Settings */}
                    {showDetails[integration.id] && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Data Processing Details */}
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Data Processing</h4>
                            <div className="space-y-3">
                              <div className="form-control">
                                <label className="label">
                                  <span className="label-text">Data Retention (days)</span>
                                </label>
                                <input
                                  type="number"
                                  className="input input-bordered input-sm"
                                  value={integration.dataRetentionDays}
                                  onChange={(e) => handleUpdateSettings(integration, { dataRetentionDays: parseInt(e.target.value) })}
                                  data-testid={`input-retention-days-${integration.id}`}
                                />
                              </div>

                              <div className="form-control">
                                <label className="cursor-pointer label justify-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={integration.anonymizationEnabled}
                                    onChange={(e) => handleUpdateSettings(integration, { anonymizationEnabled: e.target.checked })}
                                    data-testid={`checkbox-anonymization-${integration.id}`}
                                  />
                                  <span className="label-text">Anonymization Enabled</span>
                                </label>
                              </div>

                              <div className="form-control">
                                <label className="cursor-pointer label justify-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={integration.encryptionEnabled}
                                    onChange={(e) => handleUpdateSettings(integration, { encryptionEnabled: e.target.checked })}
                                    data-testid={`checkbox-encryption-${integration.id}`}
                                  />
                                  <span className="label-text">Encryption Enabled</span>
                                </label>
                              </div>

                              <div className="form-control">
                                <label className="cursor-pointer label justify-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={integration.specialCategoryData}
                                    onChange={(e) => handleUpdateSettings(integration, { specialCategoryData: e.target.checked })}
                                    data-testid={`checkbox-special-category-${integration.id}`}
                                  />
                                  <span className="label-text">Special Category Data</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Compliance Details */}
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Compliance</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="label">
                                  <span className="label-text">Supported User Rights</span>
                                </label>
                                <div className="flex flex-wrap gap-1">
                                  {integration.supportedUserRights.map((right, index) => (
                                    <div key={index} className="badge badge-outline badge-sm">
                                      {right.replace('_', ' ')}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="form-control">
                                <label className="cursor-pointer label justify-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={integration.automatedDecisionMaking}
                                    onChange={(e) => handleUpdateSettings(integration, { automatedDecisionMaking: e.target.checked })}
                                    data-testid={`checkbox-automated-decision-${integration.id}`}
                                  />
                                  <span className="label-text">Automated Decision Making</span>
                                </label>
                              </div>

                              <div className="form-control">
                                <label className="cursor-pointer label justify-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={integration.dataBreachNotificationRequired}
                                    onChange={(e) => handleUpdateSettings(integration, { dataBreachNotificationRequired: e.target.checked })}
                                    data-testid={`checkbox-breach-notification-${integration.id}`}
                                  />
                                  <span className="label-text">Breach Notification Required</span>
                                </label>
                              </div>

                              {integration.lastAssessment && (
                                <div>
                                  <label className="label">
                                    <span className="label-text">Last Assessment</span>
                                  </label>
                                  <div className="text-sm text-gray-600">
                                    {new Date(integration.lastAssessment).toLocaleDateString()}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* External Links */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {integration.dataProcessingAgreementUrl && (
                            <a
                              href={integration.dataProcessingAgreementUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline"
                              data-testid={`link-dpa-${integration.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              Data Processing Agreement
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}