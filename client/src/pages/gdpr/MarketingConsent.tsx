import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ChevronLeft, Users, Mail, MessageSquare, Phone, FileText, AlertTriangle, CheckCircle, XCircle, Calendar, TrendingUp, Download, Plus, Eye, Trash2, Edit, Bell } from 'lucide-react';

interface MarketingConsent {
  id: string;
  userId: string;
  organisationId: string;
  consentType: string;
  consentStatus: 'granted' | 'withdrawn';
  lawfulBasis: string;
  consentSource: string;
  evidenceType?: string;
  consentEvidence?: any;
  consentGivenAt: string;
  consentWithdrawnAt?: string;
  expiryDate?: string;
  communicationFrequency?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

interface MarketingCampaign {
  id: string;
  organisationId: string;
  name: string;
  campaignType: string;
  status: string;
  requiredConsentTypes: string[];
  scheduledAt?: string;
  sentCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  unsubscribedCount?: number;
  bounceCount?: number;
  content?: any;
  targetAudience?: any;
  complianceChecked: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CommunicationPreferences {
  id: string;
  userId: string;
  organisationId: string;
  communicationType: string;
  channel: string;
  isEnabled: boolean;
  frequency?: string;
  globalOptOut: boolean;
  lastModified: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsentHistory {
  id: string;
  userId: string;
  organisationId: string;
  marketingConsentId?: string;
  consentType: string;
  action: string;
  previousStatus?: string;
  newStatus: string;
  source: string;
  evidenceType?: string;
  evidenceData?: any;
  changeReason?: string;
  effectiveDate: string;
  recordedAt: string;
}

interface ComplianceReport {
  reportPeriod: { startDate: Date; endDate: Date };
  consentActivity: {
    totalGrants: number;
    totalWithdrawals: number;
    totalModifications: number;
    consentsByType: Record<string, number>;
    dailyActivity: { date: string; grants: number; withdrawals: number; }[];
  };
  activeConsents: {
    total: number;
    byType: Record<string, number>;
  };
  suppressionList: {
    total: number;
    byChannel: Record<string, number>;
  };
  pecrCompliance: {
    optInRate: number;
    withdrawalRate: number;
    evidenceCollection: number;
  };
}

interface CampaignFormData {
  name: string;
  campaignType: 'email' | 'sms' | 'phone' | 'post' | 'push';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  requiredConsentTypes: string[];
  scheduledAt?: string;
  content: {
    subject?: string;
    message: string;
    template?: string;
  };
  targetAudience: {
    segments: string[];
    filters: Record<string, any>;
  };
}

export default function MarketingConsent() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'consents' | 'compliance' | 'history'>('overview');
  const [campaignFormData, setCampaignFormData] = useState<CampaignFormData>({
    name: '',
    campaignType: 'email',
    status: 'draft',
    requiredConsentTypes: [],
    content: { message: '' },
    targetAudience: { segments: [], filters: {} }
  });
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [complianceDateRange, setComplianceDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Fetch marketing consents for organization
  const { data: marketingConsents, isLoading: consentsLoading } = useQuery<MarketingConsent[]>({
    queryKey: ['/api/gdpr/marketing-consent/admin'],
    retry: false
  });

  // Fetch marketing campaigns
  const { data: marketingCampaigns, isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ['/api/gdpr/marketing-campaigns'],
    retry: false
  });

  // Fetch consent history
  const { data: consentHistory, isLoading: historyLoading } = useQuery<ConsentHistory[]>({
    queryKey: ['/api/gdpr/consent-history'],
    retry: false
  });

  // Fetch compliance report
  const { data: complianceReport, isLoading: complianceLoading } = useQuery<ComplianceReport>({
    queryKey: ['/api/gdpr/marketing-consent/compliance', `startDate=${complianceDateRange.startDate}&endDate=${complianceDateRange.endDate}`],
    retry: false
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: (campaignData: CampaignFormData) => 
      apiRequest('POST', '/api/gdpr/marketing-campaigns', campaignData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/marketing-campaigns'] });
      setShowCampaignForm(false);
      setCampaignFormData({
        name: '',
        campaignType: 'email',
        status: 'draft',
        requiredConsentTypes: [],
        content: { message: '' },
        targetAudience: { segments: [], filters: {} }
      });
    }
  });

  // Update campaign form data
  const updateCampaignField = (field: keyof CampaignFormData, value: any) => {
    setCampaignFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedCampaignField = (parent: keyof CampaignFormData, field: string, value: any) => {
    setCampaignFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as Record<string, any>),
        [field]: value
      }
    }));
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (campaignFormData.name && campaignFormData.content.message) {
      createCampaignMutation.mutate(campaignFormData);
    }
  };

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
      case 'post': return <FileText className="w-4 h-4" />;
      case 'push': return <Bell className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'granted': return 'text-success';
      case 'withdrawn': return 'text-error';
      case 'active': return 'text-success';
      case 'completed': return 'text-info';
      case 'cancelled': return 'text-error';
      case 'draft': return 'text-base-content';
      case 'scheduled': return 'text-warning';
      case 'paused': return 'text-warning';
      default: return 'text-base-content';
    }
  };

  // Calculate consent stats
  const consentStats = marketingConsents ? {
    total: marketingConsents.length,
    granted: marketingConsents.filter(c => c.consentStatus === 'granted').length,
    withdrawn: marketingConsents.filter(c => c.consentStatus === 'withdrawn').length,
    byType: marketingConsents.reduce((acc, consent) => {
      acc[consent.consentType] = (acc[consent.consentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  } : { total: 0, granted: 0, withdrawn: 0, byType: {} };

  const campaignStats = marketingCampaigns ? {
    total: marketingCampaigns.length,
    active: marketingCampaigns.filter(c => c.status === 'active').length,
    scheduled: marketingCampaigns.filter(c => c.status === 'scheduled').length,
    completed: marketingCampaigns.filter(c => c.status === 'completed').length
  } : { total: 0, active: 0, scheduled: 0, completed: 0 };

  return (
    <div className="min-h-screen bg-base-200 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setLocation('/gdpr')}
              className="btn btn-ghost btn-sm"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to GDPR Dashboard
            </button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-base-content">PECR Marketing Consent Management</h1>
              <p className="text-base-content/70 mt-2">
                Manage marketing communications consent and ensure PECR compliance
              </p>
            </div>
            
            <button
              onClick={() => setShowCampaignForm(true)}
              className="btn btn-primary"
              data-testid="button-create-campaign"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-primary">
              <Users className="w-8 h-8" />
            </div>
            <div className="stat-title">Active Consents</div>
            <div className="stat-value text-primary">{consentStats.granted}</div>
            <div className="stat-desc">
              {consentStats.total > 0 ? `${Math.round((consentStats.granted / consentStats.total) * 100)}% of total` : 'No data'}
            </div>
          </div>
          
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-warning">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="stat-title">Withdrawn</div>
            <div className="stat-value text-warning">{consentStats.withdrawn}</div>
            <div className="stat-desc">Marketing opt-outs</div>
          </div>
          
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-success">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="stat-title">Campaigns</div>
            <div className="stat-value text-success">{campaignStats.active}</div>
            <div className="stat-desc">{campaignStats.total} total campaigns</div>
          </div>
          
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-figure text-info">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="stat-title">Compliance</div>
            <div className="stat-value text-info">
              {complianceReport ? `${Math.round(complianceReport.pecrCompliance.optInRate)}%` : '...'}
            </div>
            <div className="stat-desc">Opt-in rate</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tabs tabs-boxed bg-base-100 mb-6">
          <button
            className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('overview')}
            data-testid="tab-overview"
          >
            Overview
          </button>
          <button
            className={`tab ${activeTab === 'campaigns' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
            data-testid="tab-campaigns"
          >
            Campaigns
          </button>
          <button
            className={`tab ${activeTab === 'consents' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('consents')}
            data-testid="tab-consents"
          >
            Consents
          </button>
          <button
            className={`tab ${activeTab === 'compliance' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('compliance')}
            data-testid="tab-compliance"
          >
            Compliance
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('history')}
            data-testid="tab-history"
          >
            History
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consent Types Breakdown */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title">Consent Types</h2>
                <div className="space-y-3">
                  {Object.entries(consentStats.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center p-2 rounded bg-base-200">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(type.replace('_marketing', ''))}
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                      </div>
                      <span className="badge badge-primary">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title">Recent Activity</h2>
                <div className="space-y-2">
                  {consentHistory?.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex justify-between items-center p-2 rounded bg-base-200">
                      <div>
                        <div className="font-medium">{activity.action.replace('_', ' ')}</div>
                        <div className="text-sm text-base-content/70">
                          {activity.consentType} - {new Date(activity.recordedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`badge ${getStatusColor(activity.newStatus)}`}>
                        {activity.newStatus}
                      </span>
                    </div>
                  )) || (
                    <div className="text-center text-base-content/50 py-4">
                      No recent activity
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {/* Campaigns List */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="card-title">Marketing Campaigns</h2>
                  <div className="flex gap-2">
                    <select className="select select-bordered select-sm" data-testid="select-campaign-status">
                      <option value="">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {campaignsLoading ? (
                  <div className="loading loading-spinner mx-auto"></div>
                ) : marketingCampaigns && marketingCampaigns.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr>
                          <th>Campaign</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Recipients</th>
                          <th>Performance</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketingCampaigns.map((campaign) => (
                          <tr key={campaign.id}>
                            <td>
                              <div className="font-medium">{campaign.name}</div>
                              <div className="text-sm text-base-content/70">
                                {campaign.scheduledAt 
                                  ? `Scheduled: ${new Date(campaign.scheduledAt).toLocaleDateString()}`
                                  : `Created: ${new Date(campaign.createdAt).toLocaleDateString()}`
                                }
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                {getChannelIcon(campaign.campaignType)}
                                <span className="capitalize">{campaign.campaignType}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${getStatusColor(campaign.status)}`}>
                                {campaign.status}
                              </span>
                            </td>
                            <td>{campaign.sentCount || 0}</td>
                            <td>
                              {campaign.sentCount && campaign.sentCount > 0 ? (
                                <div className="text-sm">
                                  <div>Opens: {campaign.openedCount || 0} ({Math.round(((campaign.openedCount || 0) / campaign.sentCount) * 100)}%)</div>
                                  <div>Clicks: {campaign.clickedCount || 0} ({Math.round(((campaign.clickedCount || 0) / campaign.sentCount) * 100)}%)</div>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button 
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => setSelectedCampaign(campaign)}
                                  data-testid={`button-view-campaign-${campaign.id}`}
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button 
                                  className="btn btn-ghost btn-xs"
                                  data-testid={`button-edit-campaign-${campaign.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button 
                                  className="btn btn-ghost btn-xs text-error"
                                  data-testid={`button-delete-campaign-${campaign.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-base-content/50 py-8">
                    No campaigns found. Create your first campaign to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'consents' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Marketing Consents</h2>
              
              {consentsLoading ? (
                <div className="loading loading-spinner mx-auto"></div>
              ) : marketingConsents && marketingConsents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Consent Type</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>Date</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketingConsents.map((consent) => (
                        <tr key={consent.id}>
                          <td>{consent.userId}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              {getChannelIcon(consent.consentType.replace('_marketing', ''))}
                              <span className="capitalize">{consent.consentType.replace('_', ' ')}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${getStatusColor(consent.consentStatus)}`}>
                              {consent.consentStatus}
                            </span>
                          </td>
                          <td className="capitalize">{consent.consentSource.replace('_', ' ')}</td>
                          <td>
                            {consent.consentStatus === 'withdrawn' && consent.consentWithdrawnAt
                              ? new Date(consent.consentWithdrawnAt).toLocaleDateString()
                              : new Date(consent.consentGivenAt).toLocaleDateString()
                            }
                          </td>
                          <td>
                            {consent.evidenceType && (
                              <span className="badge badge-outline">
                                {consent.evidenceType.replace('_', ' ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-base-content/50 py-8">
                  No marketing consents found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            {/* Date Range Selector */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title">PECR Compliance Report</h2>
                <div className="flex gap-4 items-end">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Start Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={complianceDateRange.startDate}
                      onChange={(e) => setComplianceDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      data-testid="input-compliance-start-date"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">End Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={complianceDateRange.endDate}
                      onChange={(e) => setComplianceDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      data-testid="input-compliance-end-date"
                    />
                  </div>
                  <button className="btn btn-primary" data-testid="button-refresh-compliance">
                    <Download className="w-4 h-4" />
                    Refresh Report
                  </button>
                </div>
              </div>
            </div>

            {/* Compliance Metrics */}
            {complianceReport && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-base-100 shadow">
                  <div className="card-body">
                    <h3 className="card-title text-lg">Consent Activity</h3>
                    <div className="stats stats-vertical">
                      <div className="stat">
                        <div className="stat-title">Total Grants</div>
                        <div className="stat-value text-success">{complianceReport.consentActivity.totalGrants}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Total Withdrawals</div>
                        <div className="stat-value text-warning">{complianceReport.consentActivity.totalWithdrawals}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Modifications</div>
                        <div className="stat-value text-info">{complianceReport.consentActivity.totalModifications}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 shadow">
                  <div className="card-body">
                    <h3 className="card-title text-lg">PECR Compliance</h3>
                    <div className="stats stats-vertical">
                      <div className="stat">
                        <div className="stat-title">Opt-in Rate</div>
                        <div className="stat-value text-success">{Math.round(complianceReport.pecrCompliance.optInRate)}%</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Withdrawal Rate</div>
                        <div className="stat-value text-warning">{Math.round(complianceReport.pecrCompliance.withdrawalRate)}%</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Evidence Collection</div>
                        <div className="stat-value text-info">{Math.round(complianceReport.pecrCompliance.evidenceCollection)}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 shadow">
                  <div className="card-body">
                    <h3 className="card-title text-lg">Suppression List</h3>
                    <div className="stats stats-vertical">
                      <div className="stat">
                        <div className="stat-title">Total Suppressed</div>
                        <div className="stat-value text-error">{complianceReport.suppressionList.total}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Email Suppressions</div>
                        <div className="stat-value text-warning">{complianceReport.suppressionList.byChannel.email || 0}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">SMS Suppressions</div>
                        <div className="stat-value text-warning">{complianceReport.suppressionList.byChannel.sms || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Consent History & Audit Trail</h2>
              
              {historyLoading ? (
                <div className="loading loading-spinner mx-auto"></div>
              ) : consentHistory && consentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Consent Type</th>
                        <th>Status Change</th>
                        <th>Source</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consentHistory.map((entry) => (
                        <tr key={entry.id}>
                          <td>{new Date(entry.recordedAt).toLocaleString()}</td>
                          <td>{entry.userId}</td>
                          <td className="capitalize">{entry.action.replace('_', ' ')}</td>
                          <td className="capitalize">{entry.consentType.replace('_', ' ')}</td>
                          <td>
                            {entry.previousStatus && (
                              <span className={`badge badge-outline ${getStatusColor(entry.previousStatus)} mr-1`}>
                                {entry.previousStatus}
                              </span>
                            )}
                            →
                            <span className={`badge ${getStatusColor(entry.newStatus)} ml-1`}>
                              {entry.newStatus}
                            </span>
                          </td>
                          <td className="capitalize">{entry.source.replace('_', ' ')}</td>
                          <td>
                            {entry.evidenceType && (
                              <span className="badge badge-outline">
                                {entry.evidenceType.replace('_', ' ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-base-content/50 py-8">
                  No consent history found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCampaignForm && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Create Marketing Campaign</h3>
            
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Campaign Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={campaignFormData.name}
                  onChange={(e) => updateCampaignField('name', e.target.value)}
                  required
                  data-testid="input-campaign-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Campaign Type</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={campaignFormData.campaignType}
                    onChange={(e) => updateCampaignField('campaignType', e.target.value)}
                    data-testid="select-campaign-type"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="phone">Phone</option>
                    <option value="post">Post</option>
                    <option value="push">Push Notification</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Status</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={campaignFormData.status}
                    onChange={(e) => updateCampaignField('status', e.target.value)}
                    data-testid="select-campaign-status"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Required Consent Types</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['email_marketing', 'sms_marketing', 'phone_marketing', 'post_marketing', 'push_marketing'].map(type => (
                    <label key={type} className="cursor-pointer label justify-start">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary mr-2"
                        checked={campaignFormData.requiredConsentTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateCampaignField('requiredConsentTypes', [...campaignFormData.requiredConsentTypes, type]);
                          } else {
                            updateCampaignField('requiredConsentTypes', campaignFormData.requiredConsentTypes.filter(t => t !== type));
                          }
                        }}
                        data-testid={`checkbox-consent-${type}`}
                      />
                      <span className="label-text capitalize">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {campaignFormData.campaignType === 'email' && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Email Subject</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={campaignFormData.content.subject || ''}
                    onChange={(e) => updateNestedCampaignField('content', 'subject', e.target.value)}
                    data-testid="input-email-subject"
                  />
                </div>
              )}

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Message Content</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-32"
                  value={campaignFormData.content.message}
                  onChange={(e) => updateNestedCampaignField('content', 'message', e.target.value)}
                  required
                  data-testid="textarea-campaign-message"
                />
              </div>

              {campaignFormData.status === 'scheduled' && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Scheduled Date & Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="input input-bordered"
                    value={campaignFormData.scheduledAt || ''}
                    onChange={(e) => updateCampaignField('scheduledAt', e.target.value)}
                    data-testid="input-scheduled-date"
                  />
                </div>
              )}

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCampaignForm(false)}
                  data-testid="button-cancel-campaign"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createCampaignMutation.isPending}
                  data-testid="button-save-campaign"
                >
                  {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">Campaign Details: {selectedCampaign.name}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Campaign Type</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {getChannelIcon(selectedCampaign.campaignType)}
                    <span className="capitalize">{selectedCampaign.campaignType}</span>
                  </div>
                </div>
                
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Status</span>
                  </label>
                  <span className={`badge ${getStatusColor(selectedCampaign.status)}`}>
                    {selectedCampaign.status}
                  </span>
                </div>
                
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Required Consent Types</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaign.requiredConsentTypes.map(type => (
                      <span key={type} className="badge badge-outline capitalize">
                        {type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Compliance Checked</span>
                  </label>
                  <span className={`badge ${selectedCampaign.complianceChecked ? 'badge-success' : 'badge-warning'}`}>
                    {selectedCampaign.complianceChecked ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Performance</span>
                  </label>
                  <div className="stats stats-vertical bg-base-200">
                    <div className="stat">
                      <div className="stat-title">Sent</div>
                      <div className="stat-value text-sm">{selectedCampaign.sentCount || 0}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Delivered</div>
                      <div className="stat-value text-sm">{selectedCampaign.deliveredCount || 0}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Opened</div>
                      <div className="stat-value text-sm">{selectedCampaign.openedCount || 0}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Clicked</div>
                      <div className="stat-value text-sm">{selectedCampaign.clickedCount || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {selectedCampaign.content && (
              <div className="mt-6">
                <label className="label">
                  <span className="label-text font-medium">Content</span>
                </label>
                <div className="bg-base-200 p-4 rounded">
                  {selectedCampaign.content.subject && (
                    <div className="mb-2">
                      <strong>Subject:</strong> {selectedCampaign.content.subject}
                    </div>
                  )}
                  <div>
                    <strong>Message:</strong>
                    <div className="mt-2 whitespace-pre-wrap">{selectedCampaign.content.message}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedCampaign(null)}
                data-testid="button-close-campaign-details"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}