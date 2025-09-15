import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { Link } from "wouter";
import { 
  Download, 
  FileText, 
  Database, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Trash2,
  Eye,
  Settings,
  Calendar,
  Filter,
  RefreshCw,
  FileDown,
  Shield,
  Archive,
  Building
} from "lucide-react";

// Types for export functionality
interface ExportJob {
  id: string;
  organisationId: string;
  exportType: 'full_compliance' | 'ico_report' | 'audit_trail' | 'consent_records' | 'user_rights' | 'breach_reports' | 'retention_logs';
  format: 'pdf' | 'csv' | 'json' | 'xml';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  includeData: string[];
  parameters: {
    dateRange: { start: Date; end: Date };
    includePersonalData: boolean;
    compressionLevel: 'none' | 'standard' | 'maximum';
  };
  estimatedSize: number;
  actualSize: number;
  downloadUrl?: string;
  expiresAt: string;
  errors?: string[];
}

interface ComplianceReport {
  id: string;
  organisationId: string;
  reportType: 'monthly' | 'quarterly' | 'annual' | 'incident' | 'audit' | 'ico_submission';
  title: string;
  description: string;
  status: 'generating' | 'completed' | 'failed';
  format: 'pdf' | 'docx';
  generatedBy: string;
  generatedAt: string;
  reportData: any;
  metadata: {
    dateRange: { start: Date; end: Date };
    includeCharts: boolean;
    includeAuditTrail: boolean;
  };
  filePath?: string;
  fileSize?: number;
}

export function ComplianceExport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  const [activeTab, setActiveTab] = useState<'exports' | 'reports' | 'scheduled'>('exports');
  const [selectedOrgId, setSelectedOrgId] = useState<string>(user?.organisationId || '');
  const [exportTypeFilter, setExportTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-info">
          <span>GDPR Export functionality is not available in this configuration.</span>
        </div>
      </div>
    );
  }

  // Role-based access control
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-warning">
          <AlertTriangle className="w-4 h-4" />
          <span>Access denied - admin privileges required to access export functionality.</span>
        </div>
      </div>
    );
  }

  // Fetch organizations for SuperAdmin
  const { data: organizations } = useQuery<Array<{id: string; name: string}>>({
    queryKey: ['/api/superadmin/organisations'],
    enabled: user?.role === 'superadmin',
  });

  // Update selected org when user changes
  useEffect(() => {
    if (user?.organisationId && !selectedOrgId) {
      setSelectedOrgId(user.organisationId);
    }
  }, [user?.organisationId, selectedOrgId]);

  // Fetch export jobs
  const { data: exportJobs, isLoading: exportJobsLoading, refetch: refetchExportJobs } = useQuery<ExportJob[]>({
    queryKey: ['/api/gdpr/dashboard/export-jobs', selectedOrgId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.role === 'superadmin' && selectedOrgId) {
        params.set('organisationId', selectedOrgId);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const queryString = params.toString();
      return await apiRequest(`/api/gdpr/dashboard/export-jobs${queryString ? '?' + queryString : ''}`, 'GET');
    },
    enabled: !!selectedOrgId,
    refetchInterval: 10000, // Refresh every 10 seconds for status updates
  });

  // Fetch compliance reports
  const { data: complianceReports, isLoading: reportsLoading } = useQuery<ComplianceReport[]>({
    queryKey: ['/api/gdpr/dashboard/reports', selectedOrgId],
    queryFn: async () => {
      const params = user?.role === 'superadmin' && selectedOrgId ? `?organisationId=${selectedOrgId}` : '';
      return await apiRequest(`/api/gdpr/dashboard/reports${params}`, 'GET');
    },
    enabled: !!selectedOrgId,
  });

  // Create export job mutation
  const createExportJobMutation = useMutation({
    mutationFn: async (exportData: any) => {
      return await apiRequest('/api/gdpr/dashboard/export-jobs', 'POST', exportData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/dashboard/export-jobs'] });
      toast({
        title: "Export Job Created",
        description: "Your export request has been queued for processing.",
      });
      // Close any open modals
      const modal = document.getElementById('export-modal') as HTMLDialogElement;
      if (modal) modal.close();
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to create export job",
        variant: "destructive",
      });
    },
  });

  // Create compliance report mutation
  const createReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      return await apiRequest('/api/gdpr/dashboard/reports', 'POST', reportData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/dashboard/reports'] });
      toast({
        title: "Report Generation Started",
        description: "Your compliance report is being generated.",
      });
      // Close any open modals
      const modal = document.getElementById('report-modal') as HTMLDialogElement;
      if (modal) modal.close();
    },
    onError: (error: any) => {
      toast({
        title: "Report Failed",
        description: error.message || "Failed to create compliance report",
        variant: "destructive",
      });
    },
  });

  // Get export type display name
  const getExportTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      'full_compliance': 'Full Compliance Export',
      'ico_report': 'ICO Regulatory Report',
      'audit_trail': 'Audit Trail Export',
      'consent_records': 'Consent Records',
      'user_rights': 'User Rights Requests',
      'breach_reports': 'Data Breach Reports',
      'retention_logs': 'Data Retention Logs'
    };
    return typeNames[type] || type;
  };

  // Get status styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'processing':
        return 'badge-warning';
      case 'pending':
        return 'badge-info';
      case 'failed':
        return 'badge-error';
      case 'expired':
        return 'badge-ghost';
      default:
        return 'badge-ghost';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="compliance-export">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content" data-testid="page-title">
            Compliance Export Center
          </h1>
          <p className="text-base-content/70 mt-2">
            Generate ICO-ready reports and export compliance data for regulatory submissions
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
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => {
              refetchExportJobs();
              toast({ title: "Refreshed", description: "Export status updated" });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={() => (document.getElementById('export-modal') as HTMLDialogElement)?.showModal()}
            data-testid="button-new-export"
          >
            <Download className="w-4 h-4" />
            New Export
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={() => (document.getElementById('report-modal') as HTMLDialogElement)?.showModal()}
            data-testid="button-new-report"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs tabs-boxed">
        <button 
          className={`tab ${activeTab === 'exports' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('exports')}
          data-testid="tab-exports"
        >
          <Database className="w-4 h-4 mr-2" />
          Data Exports
        </button>
        <button 
          className={`tab ${activeTab === 'reports' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('reports')}
          data-testid="tab-reports"
        >
          <FileText className="w-4 h-4 mr-2" />
          Compliance Reports
        </button>
        <button 
          className={`tab ${activeTab === 'scheduled' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
          data-testid="tab-scheduled"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Scheduled Exports
        </button>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Export Type</span>
              </label>
              <select 
                className="select select-bordered select-sm"
                value={exportTypeFilter}
                onChange={(e) => setExportTypeFilter(e.target.value)}
                data-testid="filter-export-type"
              >
                <option value="all">All Types</option>
                <option value="full_compliance">Full Compliance</option>
                <option value="ico_report">ICO Report</option>
                <option value="audit_trail">Audit Trail</option>
                <option value="consent_records">Consent Records</option>
                <option value="user_rights">User Rights</option>
                <option value="breach_reports">Breach Reports</option>
                <option value="retention_logs">Retention Logs</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select 
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="filter-status"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          {/* Export Jobs List */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title">Export Jobs</h2>
              
              {exportJobsLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : exportJobs && exportJobs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Format</th>
                        <th>Status</th>
                        <th>Requested</th>
                        <th>Size</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportJobs
                        .filter(job => exportTypeFilter === 'all' || job.exportType === exportTypeFilter)
                        .map((job, index) => (
                        <tr key={job.id} data-testid={`export-job-${index}`}>
                          <td>
                            <div className="font-medium">{getExportTypeName(job.exportType)}</div>
                            <div className="text-sm text-base-content/70">
                              Priority: {job.priority.toUpperCase()}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-outline">
                              {job.format.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusStyle(job.status)} badge-sm`}>
                              {job.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div>{new Date(job.requestedAt).toLocaleDateString()}</div>
                            <div className="text-sm text-base-content/70">
                              {new Date(job.requestedAt).toLocaleTimeString()}
                            </div>
                          </td>
                          <td>
                            {job.actualSize > 0 ? formatFileSize(job.actualSize) : 
                             job.estimatedSize > 0 ? `~${formatFileSize(job.estimatedSize)}` : 'N/A'}
                          </td>
                          <td>
                            <div className="text-sm">
                              {new Date(job.expiresAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {job.status === 'completed' && job.downloadUrl && (
                                <a 
                                  href={job.downloadUrl} 
                                  download
                                  className="btn btn-success btn-xs"
                                  data-testid={`download-job-${index}`}
                                >
                                  <FileDown className="w-3 h-3" />
                                  Download
                                </a>
                              )}
                              <button 
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                  // View job details logic
                                  toast({ title: "Job Details", description: `Viewing details for ${job.id}` });
                                }}
                                data-testid={`view-job-${index}`}
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              {job.status === 'failed' && (
                                <button 
                                  className="btn btn-ghost btn-xs text-error"
                                  onClick={() => {
                                    // Retry job logic
                                    toast({ title: "Retry Job", description: `Retrying export job ${job.id}` });
                                  }}
                                  data-testid={`retry-job-${index}`}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-base-content/50">
                  <Archive className="w-12 h-12 mx-auto mb-3" />
                  <p>No export jobs found.</p>
                  <p className="text-sm">Create a new export to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Compliance Reports List */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title">Compliance Reports</h2>
              
              {reportsLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : complianceReports && complianceReports.length > 0 ? (
                <div className="grid gap-4">
                  {complianceReports.map((report, index) => (
                    <div key={report.id} className="card bg-base-200" data-testid={`report-${index}`}>
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Shield className="w-8 h-8 text-primary" />
                            <div>
                              <h3 className="font-bold">{report.title}</h3>
                              <p className="text-sm text-base-content/70">{report.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="badge badge-outline badge-sm">
                                  {report.reportType.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className={`badge ${getStatusStyle(report.status)} badge-sm`}>
                                  {report.status.toUpperCase()}
                                </span>
                                {report.format && (
                                  <span className="badge badge-ghost badge-sm">
                                    {report.format.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm text-base-content/70">
                              Generated: {new Date(report.generatedAt).toLocaleDateString()}
                            </div>
                            {report.fileSize && (
                              <div className="text-sm text-base-content/70">
                                Size: {formatFileSize(report.fileSize)}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2">
                              {report.status === 'completed' && report.filePath && (
                                <button className="btn btn-primary btn-xs">
                                  <FileDown className="w-3 h-3" />
                                  Download
                                </button>
                              )}
                              <button className="btn btn-ghost btn-xs">
                                <Eye className="w-3 h-3" />
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-base-content/50">
                  <FileText className="w-12 h-12 mx-auto mb-3" />
                  <p>No compliance reports found.</p>
                  <p className="text-sm">Generate a report to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="space-y-6">
          {/* Scheduled Exports Placeholder */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title">Scheduled Exports</h2>
              <div className="text-center py-8 text-base-content/50">
                <Calendar className="w-12 h-12 mx-auto mb-3" />
                <p>Scheduled export functionality coming soon.</p>
                <p className="text-sm">This will allow automated compliance reporting.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal 
        onSubmit={(data) => createExportJobMutation.mutate(data)}
        isLoading={createExportJobMutation.isPending}
      />

      {/* Report Modal */}
      <ReportModal 
        onSubmit={(data) => createReportMutation.mutate(data)}
        isLoading={createReportMutation.isPending}
      />
    </div>
  );
}

// Export Creation Modal Component
function ExportModal({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [exportType, setExportType] = useState('full_compliance');
  const [format, setFormat] = useState('pdf');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [includeData, setIncludeData] = useState(['consent', 'user-rights', 'audit-logs']);
  const [includePersonalData, setIncludePersonalData] = useState(false);
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDate = dateRange.start ? new Date(dateRange.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.end ? new Date(dateRange.end) : new Date();
    
    onSubmit({
      exportType,
      format,
      priority,
      includeData,
      dateRange: { start: startDate, end: endDate },
      includePersonalData,
      compressionLevel: 'standard'
    });
  };

  return (
    <dialog id="export-modal" className="modal">
      <div className="modal-box w-11/12 max-w-2xl">
        <h3 className="font-bold text-lg">Create New Export</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Export Type</span>
              </label>
              <select 
                className="select select-bordered"
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                data-testid="select-export-type"
              >
                <option value="full_compliance">Full Compliance Export</option>
                <option value="ico_report">ICO Regulatory Report</option>
                <option value="audit_trail">Audit Trail Export</option>
                <option value="consent_records">Consent Records</option>
                <option value="user_rights">User Rights Requests</option>
                <option value="breach_reports">Data Breach Reports</option>
                <option value="retention_logs">Data Retention Logs</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Format</span>
              </label>
              <select 
                className="select select-bordered"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                data-testid="select-format"
              >
                <option value="pdf">PDF Report</option>
                <option value="csv">CSV Data</option>
                <option value="json">JSON Data</option>
                <option value="xml">XML Data</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Start Date</span>
              </label>
              <input 
                type="date"
                className="input input-bordered"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                data-testid="input-start-date"
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">End Date</span>
              </label>
              <input 
                type="date"
                className="input input-bordered"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                data-testid="input-end-date"
              />
            </div>
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">Priority</span>
            </label>
            <select 
              className="select select-bordered"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              data-testid="select-priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Include Personal Data</span>
              <input 
                type="checkbox"
                className="checkbox"
                checked={includePersonalData}
                onChange={(e) => setIncludePersonalData(e.target.checked)}
                data-testid="checkbox-include-personal-data"
              />
            </label>
            <div className="label">
              <span className="label-text-alt text-warning">
                ⚠️ Including personal data requires additional security measures
              </span>
            </div>
          </div>
          
          <div className="modal-action">
            <button type="button" className="btn" onClick={() => (document.getElementById('export-modal') as HTMLDialogElement)?.close()}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
              data-testid="button-create-export"
            >
              {isLoading && <span className="loading loading-spinner loading-sm"></span>}
              Create Export
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

// Report Generation Modal Component
function ReportModal({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [reportType, setReportType] = useState('monthly');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(false);
  const [includeModules, setIncludeModules] = useState(['consent', 'user-rights', 'breaches', 'retention']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      reportType,
      title: title || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Compliance Report`,
      description: description || `Generated ${reportType} compliance report`,
      format,
      includeModules,
      includeCharts,
      includeAuditTrail,
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      }
    });
  };

  return (
    <dialog id="report-modal" className="modal">
      <div className="modal-box w-11/12 max-w-2xl">
        <h3 className="font-bold text-lg">Generate Compliance Report</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Report Type</span>
              </label>
              <select 
                className="select select-bordered"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                data-testid="select-report-type"
              >
                <option value="monthly">Monthly Report</option>
                <option value="quarterly">Quarterly Report</option>
                <option value="annual">Annual Report</option>
                <option value="incident">Incident Report</option>
                <option value="audit">Audit Report</option>
                <option value="ico_submission">ICO Submission</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Format</span>
              </label>
              <select 
                className="select select-bordered"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                data-testid="select-report-format"
              >
                <option value="pdf">PDF Document</option>
                <option value="docx">Word Document</option>
              </select>
            </div>
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">Report Title</span>
            </label>
            <input 
              type="text"
              className="input input-bordered"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated if left blank"
              data-testid="input-report-title"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea 
              className="textarea textarea-bordered"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional report description"
              data-testid="textarea-report-description"
            />
          </div>
          
          <div className="space-y-2">
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Include Charts and Visualizations</span>
                <input 
                  type="checkbox"
                  className="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  data-testid="checkbox-include-charts"
                />
              </label>
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Include Audit Trail</span>
                <input 
                  type="checkbox"
                  className="checkbox"
                  checked={includeAuditTrail}
                  onChange={(e) => setIncludeAuditTrail(e.target.checked)}
                  data-testid="checkbox-include-audit-trail"
                />
              </label>
            </div>
          </div>
          
          <div className="modal-action">
            <button type="button" className="btn" onClick={() => (document.getElementById('report-modal') as HTMLDialogElement)?.close()}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-secondary"
              disabled={isLoading}
              data-testid="button-generate-report"
            >
              {isLoading && <span className="loading loading-spinner loading-sm"></span>}
              Generate Report
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}