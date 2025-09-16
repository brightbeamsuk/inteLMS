import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { Link } from "wouter";
import { 
  Shield, 
  Users, 
  FileText, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Activity,
  Download,
  Settings,
  TrendingUp,
  Calendar,
  Database,
  Lock,
  Eye,
  Zap,
  Building,
  BarChart3,
  Globe,
  UserCheck,
  Scroll,
  Search,
  Filter,
  PieChart,
  LineChart,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line,
  Legend,
  ComposedChart
} from 'recharts';

// Types for dashboard data
interface DashboardConfig {
  id: string;
  organisationId: string;
  isEnabled: boolean;
  refreshInterval: number;
  widgets: string[];
  alertSettings: {
    enableRealTimeAlerts: boolean;
    emailNotifications: boolean;
    slackIntegration: boolean;
    criticalThreshold: number;
    warningThreshold: number;
  };
  complianceThresholds: {
    consentRate: number;
    userRightsResponseTime: number;
    breachNotificationTime: number;
    retentionCompliance: number;
  };
}

interface ComplianceMetrics {
  consentMetrics: {
    totalConsents: number;
    consentRate: number;
    withdrawalRate: number;
    consentsByType: { [key: string]: number };
    recentActivity: { date: string; grants: number; withdrawals: number; }[];
  };
  userRightsMetrics: {
    totalRequests: number;
    pendingRequests: number;
    overdueRequests: number;
    avgResponseTime: number;
    requestsByType: { [key: string]: number };
    complianceRate: number;
  };
  dataRetentionMetrics: {
    totalPolicies: number;
    recordsProcessed: number;
    recordsPendingDeletion: number;
    retentionCompliance: number;
    upcomingDeletions: number;
  };
  breachMetrics: {
    totalBreaches: number;
    activeBreaches: number;
    overdueNotifications: number;
    avgResponseTime: number;
    breachesBySeverity: { [key: string]: number };
  };
  transferMetrics: {
    totalTransfers: number;
    activeTransfers: number;
    overdueReviews: number;
    transfersByRisk: { [key: string]: number };
    complianceRate: number;
  };
  overallComplianceScore: number;
  complianceStatus: 'compliant' | 'attention_required' | 'non_compliant' | 'unknown';
  criticalAlerts: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    dueDate?: Date;
  }>;
}

// Helper functions for generating sample data
function generateComplianceTrendData() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(month => ({
    date: month,
    overallCompliance: Math.floor(Math.random() * 20) + 75,
    consentCompliance: Math.floor(Math.random() * 25) + 70,
    userRightsCompliance: Math.floor(Math.random() * 30) + 65,
    retentionCompliance: Math.floor(Math.random() * 15) + 80,
  }));
}

function generateConsentData() {
  return [
    { type: 'Marketing', granted: 320, denied: 45, pending: 15 },
    { type: 'Analytics', granted: 280, denied: 25, pending: 8 },
    { type: 'Functional', granted: 410, denied: 15, pending: 5 },
    { type: 'Necessary', granted: 450, denied: 2, pending: 0 },
  ];
}

function generateUserRightsData() {
  return [
    { month: 'Jan', requests: 45, avgResponseTime: 12, slaCompliance: 95 },
    { month: 'Feb', requests: 52, avgResponseTime: 15, slaCompliance: 88 },
    { month: 'Mar', requests: 38, avgResponseTime: 8, slaCompliance: 100 },
    { month: 'Apr', requests: 61, avgResponseTime: 18, slaCompliance: 82 },
    { month: 'May', requests: 43, avgResponseTime: 11, slaCompliance: 97 },
    { month: 'Jun', requests: 29, avgResponseTime: 9, slaCompliance: 100 },
  ];
}

function generateRetentionData() {
  return [
    { name: 'Active Users', value: 45, count: 4500, color: 'hsl(var(--su))' },
    { name: 'Inactive < 1 Year', value: 25, count: 2500, color: 'hsl(var(--wa))' },
    { name: 'Scheduled for Deletion', value: 15, count: 1500, color: 'hsl(var(--er))' },
    { name: 'Legal Hold', value: 10, count: 1000, color: 'hsl(var(--in))' },
    { name: 'Anonymized', value: 5, count: 500, color: 'hsl(var(--ac))' },
  ];
}

function generateBreachData() {
  return [
    { month: 'Jan', incidents: 2, resolved: 2, notified: 1 },
    { month: 'Feb', incidents: 0, resolved: 0, notified: 0 },
    { month: 'Mar', incidents: 1, resolved: 1, notified: 1 },
    { month: 'Apr', incidents: 3, resolved: 2, notified: 2 },
    { month: 'May', incidents: 1, resolved: 1, notified: 0 },
    { month: 'Jun', incidents: 0, resolved: 0, notified: 0 },
  ];
}

export function GdprDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  const [selectedDateRange, setSelectedDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(user?.organisationId || '');
  const [activeView, setActiveView] = useState<'overview' | 'analytics' | 'reports' | 'settings'>('overview');

  // Fetch organizations for SuperAdmin
  const { data: organizations } = useQuery<Array<{id: string; name: string}>>({
    queryKey: ['/api/superadmin/organisations'],
    enabled: user?.role === 'superadmin',
  });

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-info">
          <span>GDPR Dashboard is not available in this configuration.</span>
        </div>
      </div>
    );
  }

  // Update selected org when user changes
  useEffect(() => {
    if (user?.organisationId && !selectedOrgId) {
      setSelectedOrgId(user.organisationId);
    }
  }, [user?.organisationId, selectedOrgId]);

  // Personal Data Dashboard for regular users
  if (user?.role === 'user') {
    return <PersonalDataDashboard />;
  }

  // Role-based access control for admin functions
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-warning">
          <AlertTriangle className="w-4 h-4" />
          <span>Access denied - admin privileges required to view GDPR Dashboard.</span>
        </div>
      </div>
    );
  }

  // Fetch dashboard configuration with organization scoping
  const { data: dashboardConfig, isLoading: configLoading } = useQuery<DashboardConfig>({
    queryKey: ['/api/gdpr/dashboard', selectedOrgId],
    queryFn: async () => {
      const params = user?.role === 'superadmin' && selectedOrgId ? `?organisationId=${selectedOrgId}` : '';
      return await apiRequest(`/api/gdpr/dashboard${params}`, 'GET');
    },
    enabled: !!selectedOrgId,
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch compliance metrics with organization scoping
  const { data: complianceMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<ComplianceMetrics>({
    queryKey: ['/api/gdpr/dashboard/metrics', selectedOrgId, selectedDateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.role === 'superadmin' && selectedOrgId) {
        params.set('organisationId', selectedOrgId);
      }
      if (selectedDateRange !== '30d') {
        const now = new Date();
        const days = selectedDateRange === '7d' ? 7 : selectedDateRange === '90d' ? 90 : 30;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        params.set('startDate', startDate.toISOString());
        params.set('endDate', now.toISOString());
      }
      const queryString = params.toString();
      return await apiRequest(`/api/gdpr/dashboard/metrics${queryString ? '?' + queryString : ''}`, 'GET');
    },
    enabled: !!selectedOrgId,
    refetchInterval: autoRefresh ? 60000 : false,
  });

  // Force refresh metrics
  const refreshMetrics = () => {
    refetchMetrics();
    toast({
      title: "Dashboard Refreshed",
      description: "Compliance metrics have been updated with the latest data.",
    });
  };

  // Get compliance status styling
  const getComplianceStatusStyle = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'badge-success';
      case 'attention_required':
        return 'badge-warning';
      case 'non_compliant':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  };

  // Get compliance score color
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  };

  // Get alert severity styling
  const getAlertSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'alert-error';
      case 'high':
        return 'alert-warning';
      case 'medium':
        return 'alert-info';
      default:
        return 'alert-success';
    }
  };

  if (configLoading || metricsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="gdpr-dashboard">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content" data-testid="page-title">
            GDPR Compliance Dashboard
          </h1>
          <p className="text-base-content/70 mt-2">
            {user.role === 'superadmin' 
              ? 'Cross-organization compliance monitoring and regulatory oversight' 
              : 'Real-time compliance monitoring and regulatory reporting for your organization'
            }
          </p>
          
          {/* SuperAdmin Organization Selector */}
          {user.role === 'superadmin' && organizations && organizations.length > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <Building className="w-4 h-4 text-base-content/70" />
              <select 
                className="select select-bordered select-sm"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                data-testid="select-organization"
              >
                <option value="">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <span className="text-sm text-base-content/50">
                Viewing: {organizations.find(o => o.id === selectedOrgId)?.name || 'All Organizations'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text mr-3">Auto-refresh</span>
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                data-testid="toggle-auto-refresh"
              />
            </label>
          </div>
          
          {/* Manual refresh */}
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={refreshMetrics}
            data-testid="button-refresh"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
          
          {/* Settings */}
          <Link href="/admin/gdpr-dashboard/settings">
            <button className="btn btn-outline btn-sm" data-testid="button-settings">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </Link>
        </div>
      </div>

      {/* Overall Compliance Score */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="avatar">
                <div className="w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Overall Compliance Score</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-4xl font-bold ${getScoreColor(complianceMetrics?.overallComplianceScore || 0)}`} data-testid="text-compliance-score">
                    {complianceMetrics?.overallComplianceScore || 0}%
                  </span>
                  <span className={`badge ${getComplianceStatusStyle(complianceMetrics?.complianceStatus || 'unknown')}`} data-testid="badge-compliance-status">
                    {complianceMetrics?.complianceStatus?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Quick Export Actions */}
            <div className="flex gap-2">
              <Link href="/admin/compliance-export">
                <button className="btn btn-primary btn-sm" data-testid="button-create-report">
                  <FileText className="w-4 h-4" />
                  Create Report
                </button>
              </Link>
              <Link href="/admin/compliance-export">
                <button className="btn btn-outline btn-sm" data-testid="button-export-data">
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {complianceMetrics?.criticalAlerts && complianceMetrics.criticalAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            Critical Alerts ({complianceMetrics.criticalAlerts.length})
          </h3>
          <div className="grid gap-3">
            {complianceMetrics.criticalAlerts.map((alert, index) => (
              <div key={index} className={`alert ${getAlertSeverityStyle(alert.severity)}`} data-testid={`alert-critical-${index}`}>
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <div className="font-semibold">{alert.message}</div>
                  {alert.dueDate && (
                    <div className="text-sm opacity-75">
                      Due: {new Date(alert.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Compliance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Consent Management */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Consent Management</h3>
                  <p className="text-sm text-base-content/70">Active Consents</p>
                </div>
              </div>
              <Link href="/admin/gdpr/consent" className="btn btn-ghost btn-xs">
                <Eye className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold" data-testid="text-consent-total">
                  {complianceMetrics?.consentMetrics?.totalConsents || 0}
                </span>
                <span className={`badge ${complianceMetrics?.consentMetrics?.consentRate >= 80 ? 'badge-success' : 'badge-warning'}`} data-testid="badge-consent-rate">
                  {complianceMetrics?.consentMetrics?.consentRate?.toFixed(1) || 0}% rate
                </span>
              </div>
              
              <div className="text-sm text-base-content/70">
                Withdrawal rate: {complianceMetrics?.consentMetrics?.withdrawalRate?.toFixed(1) || 0}%
              </div>
              
              <div className="w-full bg-base-200 rounded-full h-2">
                <div 
                  className="bg-success h-2 rounded-full transition-all duration-300"
                  style={{ width: `${complianceMetrics?.consentMetrics?.consentRate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* User Rights Requests */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-12 rounded-lg bg-info/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-info" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">User Rights</h3>
                  <p className="text-sm text-base-content/70">DSAR Processing</p>
                </div>
              </div>
              <Link href="/admin/gdpr/user-rights" className="btn btn-ghost btn-xs">
                <Eye className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold" data-testid="text-user-rights-total">
                  {complianceMetrics?.userRightsMetrics?.totalRequests || 0}
                </span>
                {complianceMetrics?.userRightsMetrics?.overdueRequests > 0 && (
                  <span className="badge badge-error" data-testid="badge-overdue-requests">
                    {complianceMetrics.userRightsMetrics.overdueRequests} overdue
                  </span>
                )}
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Pending: {complianceMetrics?.userRightsMetrics?.pendingRequests || 0}</span>
                <span className={complianceMetrics?.userRightsMetrics?.complianceRate >= 95 ? 'text-success' : 'text-warning'}>
                  {complianceMetrics?.userRightsMetrics?.complianceRate?.toFixed(1) || 0}% compliant
                </span>
              </div>
              
              <div className="text-sm text-base-content/70">
                Avg response: {complianceMetrics?.userRightsMetrics?.avgResponseTime?.toFixed(1) || 0} days
              </div>
            </div>
          </div>
        </div>

        {/* Data Breach Management */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-12 rounded-lg bg-error/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-error" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Data Breaches</h3>
                  <p className="text-sm text-base-content/70">ICO Notifications</p>
                </div>
              </div>
              <Link href="/admin/gdpr/breaches" className="btn btn-ghost btn-xs">
                <Eye className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold" data-testid="text-breaches-total">
                  {complianceMetrics?.breachMetrics?.totalBreaches || 0}
                </span>
                {complianceMetrics?.breachMetrics?.activeBreaches > 0 && (
                  <span className="badge badge-error" data-testid="badge-active-breaches">
                    {complianceMetrics.breachMetrics.activeBreaches} active
                  </span>
                )}
              </div>
              
              <div className="text-sm text-base-content/70">
                Avg notification: {complianceMetrics?.breachMetrics?.avgResponseTime?.toFixed(1) || 0}h
              </div>
              
              {complianceMetrics?.breachMetrics?.overdueNotifications > 0 && (
                <div className="alert alert-error alert-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{complianceMetrics.breachMetrics.overdueNotifications} overdue notifications</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Retention */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Database className="w-6 h-6 text-warning" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Data Retention</h3>
                  <p className="text-sm text-base-content/70">Lifecycle Management</p>
                </div>
              </div>
              <Link href="/admin/gdpr/data-retention" className="btn btn-ghost btn-xs">
                <Eye className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold" data-testid="text-retention-policies">
                  {complianceMetrics?.dataRetentionMetrics?.totalPolicies || 0}
                </span>
                <span className={`badge ${complianceMetrics?.dataRetentionMetrics?.retentionCompliance >= 95 ? 'badge-success' : 'badge-warning'}`} data-testid="badge-retention-compliance">
                  {complianceMetrics?.dataRetentionMetrics?.retentionCompliance?.toFixed(1) || 0}%
                </span>
              </div>
              
              <div className="text-sm text-base-content/70">
                Processed: {complianceMetrics?.dataRetentionMetrics?.recordsProcessed || 0} records
              </div>
              
              {complianceMetrics?.dataRetentionMetrics?.upcomingDeletions > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-warning" />
                  <span>{complianceMetrics.dataRetentionMetrics.upcomingDeletions} deletions due</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Tiles */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Link href="/admin/gdpr/user-rights/new">
            <button className="btn btn-outline w-full" data-testid="button-process-dsar">
              <Users className="w-4 h-4" />
              Process DSAR
            </button>
          </Link>
          
          <Link href="/admin/gdpr/breaches/new">
            <button className="btn btn-outline w-full" data-testid="button-report-breach">
              <AlertTriangle className="w-4 h-4" />
              Report Breach
            </button>
          </Link>
          
          <Link href="/admin/gdpr/consent">
            <button className="btn btn-outline w-full" data-testid="button-manage-consents">
              <CheckCircle className="w-4 h-4" />
              Manage Consents
            </button>
          </Link>
          
          <Link href="/admin/gdpr/data-retention">
            <button className="btn btn-outline w-full" data-testid="button-review-retention">
              <Database className="w-4 h-4" />
              Review Retention
            </button>
          </Link>
          
          <Link href="/admin/gdpr/compliance-documents">
            <button className="btn btn-outline w-full" data-testid="button-update-policies">
              <FileText className="w-4 h-4" />
              Update Policies
            </button>
          </Link>
          
          <Link href="/admin/gdpr/privacy-settings">
            <button className="btn btn-outline w-full" data-testid="button-privacy-settings">
              <Lock className="w-4 h-4" />
              Privacy Settings
            </button>
          </Link>
        </div>
      </div>

      {/* Recent Activity & Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="card-title">Recent Activity</h3>
            <div className="space-y-3">
              {complianceMetrics?.consentMetrics?.recentActivity?.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-base-200 rounded-lg" data-testid={`activity-item-${index}`}>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <div>
                      <div className="font-medium">Consent Activity</div>
                      <div className="text-sm text-base-content/70">{activity.date}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-success">+{activity.grants} granted</div>
                    <div className="text-error">-{activity.withdrawals} withdrawn</div>
                  </div>
                </div>
              ))}
              
              {(!complianceMetrics?.consentMetrics?.recentActivity || complianceMetrics.consentMetrics.recentActivity.length === 0) && (
                <div className="text-center text-base-content/50 py-8">
                  No recent activity to display
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="card-title">Upcoming Tasks</h3>
            <div className="space-y-3">
              {complianceMetrics?.userRightsMetrics?.pendingRequests > 0 && (
                <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-warning" />
                    <div>
                      <div className="font-medium">Process User Rights Requests</div>
                      <div className="text-sm text-base-content/70">
                        {complianceMetrics.userRightsMetrics.pendingRequests} pending requests
                      </div>
                    </div>
                  </div>
                  <Link href="/admin/gdpr/user-rights">
                    <button className="btn btn-warning btn-xs">Review</button>
                  </Link>
                </div>
              )}
              
              {complianceMetrics?.dataRetentionMetrics?.upcomingDeletions > 0 && (
                <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-info" />
                    <div>
                      <div className="font-medium">Scheduled Data Deletions</div>
                      <div className="text-sm text-base-content/70">
                        {complianceMetrics.dataRetentionMetrics.upcomingDeletions} records to delete
                      </div>
                    </div>
                  </div>
                  <Link href="/admin/gdpr/data-retention">
                    <button className="btn btn-info btn-xs">Review</button>
                  </Link>
                </div>
              )}
              
              {complianceMetrics?.breachMetrics?.activeBreaches > 0 && (
                <div className="flex items-center justify-between p-3 bg-error/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-error" />
                    <div>
                      <div className="font-medium">Active Breach Management</div>
                      <div className="text-sm text-base-content/70">
                        {complianceMetrics.breachMetrics.activeBreaches} breaches require action
                      </div>
                    </div>
                  </div>
                  <Link href="/admin/gdpr/breaches">
                    <button className="btn btn-error btn-xs">Manage</button>
                  </Link>
                </div>
              )}
              
              {(!complianceMetrics?.criticalAlerts || complianceMetrics.criticalAlerts.length === 0) && 
               (!complianceMetrics?.userRightsMetrics?.pendingRequests) &&
               (!complianceMetrics?.dataRetentionMetrics?.upcomingDeletions) &&
               (!complianceMetrics?.breachMetrics?.activeBreaches) && (
                <div className="text-center text-base-content/50 py-8">
                  <CheckCircle className="w-12 h-12 mx-auto text-success mb-3" />
                  All tasks completed - excellent compliance status!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compliance Metrics Visualization */}
        {complianceMetrics && (
          <>
            {/* Compliance Trends Overview */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title">Compliance Trends</h2>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-sm text-success">Overall improving</span>
                  </div>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={generateComplianceTrendData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--b1))', 
                          border: '1px solid hsl(var(--bc) / 0.2)',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="overallCompliance" stackId="1" stroke="hsl(var(--p))" fill="hsl(var(--p) / 0.3)" name="Overall Compliance" />
                      <Area type="monotone" dataKey="consentCompliance" stackId="2" stroke="hsl(var(--s))" fill="hsl(var(--s) / 0.3)" name="Consent Management" />
                      <Area type="monotone" dataKey="userRightsCompliance" stackId="3" stroke="hsl(var(--a))" fill="hsl(var(--a) / 0.3)" name="User Rights" />
                      <Area type="monotone" dataKey="retentionCompliance" stackId="4" stroke="hsl(var(--in))" fill="hsl(var(--in) / 0.3)" name="Data Retention" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Consent Analytics */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Consent Performance</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={generateConsentData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--b1))', 
                            border: '1px solid hsl(var(--bc) / 0.2)',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="granted" fill="hsl(var(--su))" name="Granted" />
                        <Bar dataKey="denied" fill="hsl(var(--er))" name="Denied" />
                        <Bar dataKey="pending" fill="hsl(var(--wa))" name="Pending" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* User Rights Response Times */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">User Rights SLA Performance</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={generateUserRightsData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--b1))', 
                            border: '1px solid hsl(var(--bc) / 0.2)',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="requests" fill="hsl(var(--p))" name="Total Requests" />
                        <Line yAxisId="right" type="monotone" dataKey="avgResponseTime" stroke="hsl(var(--er))" strokeWidth={2} name="Avg Response Days" />
                        <Line yAxisId="right" type="monotone" dataKey="slaCompliance" stroke="hsl(var(--su))" strokeWidth={2} name="SLA Compliance %" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-sm text-base-content/70 mt-2">
                    * SLA target: 30 days for data subject access requests
                  </div>
                </div>
              </div>

              {/* Data Retention Distribution */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Data Retention Status</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={generateRetentionData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {generateRetentionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--b1))', 
                            border: '1px solid hsl(var(--bc) / 0.2)',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    {generateRetentionData().map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.value}%</span>
                          <span className="text-base-content/50">({item.count} records)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Breach Activity Timeline */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Data Breach Activity</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={generateBreachData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--b1))', 
                            border: '1px solid hsl(var(--bc) / 0.2)',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="incidents" stroke="hsl(var(--er))" strokeWidth={2} name="New Incidents" />
                        <Line type="monotone" dataKey="resolved" stroke="hsl(var(--su))" strokeWidth={2} name="Resolved" />
                        <Line type="monotone" dataKey="notified" stroke="hsl(var(--wa))" strokeWidth={2} name="ICO Notified" />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-sm text-base-content/70 mt-2">
                    * ICO notification required within 72 hours for high-risk breaches
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {complianceMetrics.consentMetrics?.totalConsents || 0}
                      </div>
                      <div className="text-sm text-base-content/70">Total Consents</div>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUp className="w-3 h-3 text-success" />
                        <span className="text-xs text-success">+12% vs last month</span>
                      </div>
                    </div>
                    <Users className="w-8 h-8 text-primary/50" />
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-secondary">
                        {Math.round((complianceMetrics.userRights?.completedRequests / complianceMetrics.userRights?.totalRequests * 100) || 0)}%
                      </div>
                      <div className="text-sm text-base-content/70">SLA Compliance</div>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUp className="w-3 h-3 text-success" />
                        <span className="text-xs text-success">+5% vs last month</span>
                      </div>
                    </div>
                    <Shield className="w-8 h-8 text-secondary/50" />
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-accent">
                        {complianceMetrics.dataRetention?.recordsProcessed || 0}
                      </div>
                      <div className="text-sm text-base-content/70">Records Processed</div>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowDown className="w-3 h-3 text-info" />
                        <span className="text-xs text-info">-3% vs last month</span>
                      </div>
                    </div>
                    <Database className="w-8 h-8 text-accent/50" />
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-info/10 to-info/5 border border-info/20">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-info">
                        {complianceMetrics.breaches?.activeBreaches || 0}
                      </div>
                      <div className="text-sm text-base-content/70">Active Breaches</div>
                      <div className="flex items-center gap-1 mt-1">
                        {complianceMetrics.breaches?.activeBreaches === 0 ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-success" />
                            <span className="text-xs text-success">All resolved</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-warning" />
                            <span className="text-xs text-warning">Requires attention</span>
                          </>
                        )}
                      </div>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-info/50" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Personal Data Dashboard Component for Regular Users
function PersonalDataDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user's personal data status
  const { data: personalDataStatus } = useQuery({
    queryKey: ['/api/gdpr/dashboard/metrics'],
    enabled: !!user?.id,
  });

  // Fetch user's consent history
  const { data: consentHistory } = useQuery({
    queryKey: ['/api/gdpr/consent/history'],
    enabled: !!user?.id,
  });

  // Fetch user's rights requests
  const { data: userRightsRequests } = useQuery({
    queryKey: ['/api/gdpr/user-rights', 'my-requests'],
    enabled: !!user?.id,
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="personal-data-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">My Data & Privacy</h1>
          <p className="text-base-content/70 mt-2">
            Manage your personal data, privacy preferences, and exercise your rights under GDPR
          </p>
        </div>
        <div className="avatar">
          <div className="w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCheck className="w-8 h-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Personal Data Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-success" />
              <div>
                <h3 className="font-bold text-lg">Data Protection</h3>
                <p className="text-success">Active & Secure</p>
              </div>
            </div>
            <div className="divider"></div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Profile Data:</span>
                <span className="text-success">Protected</span>
              </div>
              <div className="flex justify-between">
                <span>Learning Data:</span>
                <span className="text-success">Encrypted</span>
              </div>
              <div className="flex justify-between">
                <span>Usage Analytics:</span>
                <span className="text-info">Anonymized</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-bold text-lg">Consent Status</h3>
                <p className="text-primary">Up to Date</p>
              </div>
            </div>
            <div className="divider"></div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Platform Usage:</span>
                <span className="badge badge-success badge-sm">Granted</span>
              </div>
              <div className="flex justify-between">
                <span>Analytics:</span>
                <span className="badge badge-success badge-sm">Granted</span>
              </div>
              <div className="flex justify-between">
                <span>Marketing:</span>
                <span className="badge badge-ghost badge-sm">Not Set</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-warning" />
              <div>
                <h3 className="font-bold text-lg">Data Retention</h3>
                <p className="text-warning">Managed</p>
              </div>
            </div>
            <div className="divider"></div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Account Created:</span>
                <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span>Data Retention:</span>
                <span className="text-info">7 years</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Your Rights */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title">Your Data Rights Under GDPR</h2>
          <p className="text-base-content/70 mb-4">
            As a data subject, you have several rights regarding your personal data. Click on any right to exercise it.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/user/gdpr/data-access">
              <div className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors" data-testid="card-data-access">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <Eye className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Right of Access</h3>
                      <p className="text-sm text-base-content/70">View your personal data</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/user/gdpr/data-portability">
              <div className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors" data-testid="card-data-portability">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <Download className="w-6 h-6 text-info" />
                    <div>
                      <h3 className="font-semibold">Data Portability</h3>
                      <p className="text-sm text-base-content/70">Export your data</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/user/gdpr/data-correction">
              <div className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors" data-testid="card-data-correction">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-warning" />
                    <div>
                      <h3 className="font-semibold">Right of Rectification</h3>
                      <p className="text-sm text-base-content/70">Correct your data</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/user/gdpr/data-erasure">
              <div className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors" data-testid="card-data-erasure">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-error" />
                    <div>
                      <h3 className="font-semibold">Right of Erasure</h3>
                      <p className="text-sm text-base-content/70">Delete your data</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/user/gdpr/data-restriction">
              <div className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors" data-testid="card-data-restriction">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <Lock className="w-6 h-6 text-secondary" />
                    <div>
                      <h3 className="font-semibold">Restrict Processing</h3>
                      <p className="text-sm text-base-content/70">Limit data use</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/user/gdpr/object-processing">
              <div className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors" data-testid="card-object-processing">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="font-semibold">Right to Object</h3>
                      <p className="text-sm text-base-content/70">Object to processing</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* My Requests */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">My Data Rights Requests</h2>
            <Link href="/user/gdpr/new-request">
              <button className="btn btn-primary btn-sm" data-testid="button-new-request">
                <FileText className="w-4 h-4" />
                New Request
              </button>
            </Link>
          </div>
          
          {userRightsRequests && userRightsRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userRightsRequests.slice(0, 5).map((request: any, index: number) => (
                    <tr key={request.id} data-testid={`request-row-${index}`}>
                      <td>
                        <div className="font-medium">{request.type.replace('_', ' ').toUpperCase()}</div>
                        <div className="text-sm text-base-content/70">{request.description}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          request.status === 'completed' ? 'badge-success' :
                          request.status === 'in_progress' ? 'badge-warning' :
                          request.status === 'pending' ? 'badge-info' :
                          'badge-error'
                        } badge-sm`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{new Date(request.requestedAt).toLocaleDateString()}</td>
                      <td>
                        {request.dueDate ? new Date(request.dueDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <Link href={`/user/gdpr/requests/${request.id}`}>
                          <button className="btn btn-ghost btn-xs">View</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/50">
              <Scroll className="w-12 h-12 mx-auto mb-3" />
              <p>No data rights requests yet.</p>
              <p className="text-sm">Click "New Request" above to exercise your rights.</p>
            </div>
          )}
        </div>
      </div>

      {/* Privacy Preferences */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title">Privacy Preferences</h2>
          <p className="text-base-content/70 mb-4">
            Manage your consent and privacy preferences for different types of data processing.
          </p>
          
          <div className="space-y-4">
            <Link href="/user/gdpr/consent-preferences">
              <button className="btn btn-outline w-full justify-start" data-testid="button-consent-preferences">
                <CheckCircle className="w-4 h-4" />
                Manage Consent Preferences
              </button>
            </Link>
            
            <Link href="/user/gdpr/cookie-settings">
              <button className="btn btn-outline w-full justify-start" data-testid="button-cookie-settings">
                <Globe className="w-4 h-4" />
                Cookie Settings
              </button>
            </Link>
            
            <Link href="/user/gdpr/marketing-preferences">
              <button className="btn btn-outline w-full justify-start" data-testid="button-marketing-preferences">
                <Users className="w-4 h-4" />
                Marketing Preferences
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GdprDashboard;