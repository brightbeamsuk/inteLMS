import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Eye, Filter, Search, RefreshCw, Calendar, Mail, CheckCircle, XCircle, Clock, AlertCircle, Zap, Database } from "lucide-react";

interface EmailSendRecord {
  id: string;
  triggerEvent: 'ORG_FAST_ADD' | 'USER_FAST_ADD' | 'COURSE_ASSIGNED' | 'COURSE_COMPLETED' | 'COURSE_FAILED' | 'PLAN_UPDATED';
  templateKey: string;
  organisationId?: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateVariables?: Record<string, any>;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'retrying';
  provider?: string;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
  retryCount: number;
  nextRetryAt?: string;
  lastAttemptAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  fromEmail?: string;
  fromName?: string;
  routingSource?: 'org_primary' | 'org_fallback' | 'system_default' | 'mixed_config';
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
}

interface EmailLogsResponse {
  ok: boolean;
  data?: EmailSendRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

interface EmailLogDetailResponse {
  ok: boolean;
  data?: EmailSendRecord;
  error?: string;
}

export function SuperAdminEmailLogs() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    templateKey: '',
    recipient: '',
    triggerEvent: '',
    page: 1,
    limit: 50
  });
  const [showFilters, setShowFilters] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Main email logs query
  const { data: emailLogsResponse, isLoading, error } = useQuery<EmailLogsResponse>({
    queryKey: ['/api/superadmin/email-logs', filters],
    queryFn: async ({ queryKey }) => {
      const [, filterParams] = queryKey;
      const queryParams = new URLSearchParams();
      Object.entries(filterParams as typeof filters).forEach(([key, value]) => {
        if (value) queryParams.set(key, String(value));
      });
      return await apiRequest('GET', `/api/superadmin/email-logs?${queryParams}`);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Email detail query
  const { data: emailDetail } = useQuery<EmailLogDetailResponse>({
    queryKey: ['/api/superadmin/email-logs', selectedEmailId],
    queryFn: async () => await apiRequest('GET', `/api/superadmin/email-logs/${selectedEmailId}`),
    enabled: !!selectedEmailId,
  });

  const emailLogs = emailLogsResponse?.data || [];
  const pagination = emailLogsResponse?.pagination;

  // Handle filter updates
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: '',
      templateKey: '',
      recipient: '',
      triggerEvent: '',
      page: 1,
      limit: 50
    });
  };

  const handleViewDetails = (emailId: string) => {
    setSelectedEmailId(emailId);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedEmailId(null);
  };

  // Format status with appropriate styling
  const getStatusBadge = (status: string, retryCount: number = 0) => {
    const statusConfig = {
      queued: { class: 'badge-info', icon: Clock, text: 'Queued' },
      sending: { class: 'badge-warning', icon: Zap, text: 'Sending' },
      sent: { class: 'badge-success', icon: CheckCircle, text: 'Sent' },
      failed: { class: 'badge-error', icon: XCircle, text: retryCount > 0 ? 'Failed (Retry)' : 'Failed' },
      retrying: { class: 'badge-warning', icon: RefreshCw, text: `Retrying (${retryCount})` },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.queued;
    const Icon = config.icon;
    
    return (
      <span className={`badge ${config.class} gap-1`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </span>
    );
  };

  // Format trigger event for display
  const formatTriggerEvent = (trigger: string) => {
    const eventLabels = {
      'ORG_FAST_ADD': 'Org Created',
      'USER_FAST_ADD': 'User Added', 
      'COURSE_ASSIGNED': 'Course Assigned',
      'COURSE_COMPLETED': 'Course Completed',
      'COURSE_FAILED': 'Course Failed',
      'PLAN_UPDATED': 'Plan Updated'
    };
    return eventLabels[trigger as keyof typeof eventLabels] || trigger;
  };

  // Format dates
  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(dateStr));
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a href="/superadmin" className="cursor-pointer" data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Email Logs</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Email Logs</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Monitor all email send activity across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            className={`btn btn-outline ${showFilters ? 'btn-active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/superadmin/email-logs'] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card bg-base-200 mb-6" data-testid="panel-filters">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Start Date</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">End Date</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  data-testid="select-status"
                >
                  <option value="">All Status</option>
                  <option value="queued">Queued</option>
                  <option value="sending">Sending</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="retrying">Retrying</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Trigger Event</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filters.triggerEvent}
                  onChange={(e) => handleFilterChange('triggerEvent', e.target.value)}
                  data-testid="select-trigger-event"
                >
                  <option value="">All Events</option>
                  <option value="ORG_FAST_ADD">Org Created</option>
                  <option value="USER_FAST_ADD">User Added</option>
                  <option value="COURSE_ASSIGNED">Course Assigned</option>
                  <option value="COURSE_COMPLETED">Course Completed</option>
                  <option value="COURSE_FAILED">Course Failed</option>
                  <option value="PLAN_UPDATED">Plan Updated</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Template Key</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., new_org_welcome"
                  className="input input-bordered"
                  value={filters.templateKey}
                  onChange={(e) => handleFilterChange('templateKey', e.target.value)}
                  data-testid="input-template-key"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Recipient Email</span>
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  className="input input-bordered"
                  value={filters.recipient}
                  onChange={(e) => handleFilterChange('recipient', e.target.value)}
                  data-testid="input-recipient"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Per Page</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                  data-testid="select-limit"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
              <div className="form-control justify-end">
                <button 
                  className="btn btn-outline"
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {pagination && (
        <div className="stats shadow mb-6" data-testid="stats-summary">
          <div className="stat">
            <div className="stat-figure text-primary">
              <Database className="w-8 h-8" />
            </div>
            <div className="stat-title">Total Records</div>
            <div className="stat-value text-primary" data-testid="text-total-records">{pagination.total}</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-2">Loading email logs...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to load email logs: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      )}

      {/* Email Logs Table */}
      {!isLoading && !error && emailLogs.length > 0 && (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table table-zebra" data-testid="table-email-logs">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Recipient</th>
                    <th>Template</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Trigger</th>
                    <th>Provider</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((email) => (
                    <tr key={email.id} data-testid={`row-email-${email.id}`}>
                      <td>
                        <div className="text-sm" data-testid={`text-timestamp-${email.id}`}>
                          {formatDateTime(email.createdAt)}
                        </div>
                        {email.sentAt && (
                          <div className="text-xs text-success">
                            Sent: {formatDateTime(email.sentAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span data-testid={`text-recipient-${email.id}`}>{email.toEmail}</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-sm" data-testid={`text-template-${email.id}`}>
                          {email.templateKey}
                        </span>
                      </td>
                      <td>
                        <div className="max-w-xs truncate" title={email.subject} data-testid={`text-subject-${email.id}`}>
                          {email.subject}
                        </div>
                      </td>
                      <td data-testid={`status-${email.id}`}>
                        {getStatusBadge(email.status, email.retryCount)}
                        {email.errorMessage && (
                          <div className="text-xs text-error mt-1 truncate max-w-32" title={email.errorMessage}>
                            {email.errorMessage}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-outline" data-testid={`text-trigger-${email.id}`}>
                          {formatTriggerEvent(email.triggerEvent)}
                        </span>
                      </td>
                      <td data-testid={`text-provider-${email.id}`}>
                        {email.provider ? (
                          <span className="badge badge-ghost">{email.provider}</span>
                        ) : (
                          <span className="text-base-content/50">-</span>
                        )}
                        {email.routingSource && (
                          <div className="text-xs text-base-content/70 mt-1">
                            {email.routingSource.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleViewDetails(email.id)}
                          data-testid={`button-view-details-${email.id}`}
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && emailLogs.length === 0 && (
        <div className="text-center py-12">
          <Mail className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Email Logs Found</h3>
          <p className="text-base-content/70 mb-4">
            No email send records match your current filters.
          </p>
          {Object.values(filters).some(v => v !== '' && v !== 1 && v !== 50) && (
            <button 
              className="btn btn-outline"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="join">
            <button
              className={`join-item btn ${filters.page === 1 ? 'btn-disabled' : ''}`}
              onClick={() => handleFilterChange('page', String(filters.page - 1))}
              disabled={filters.page === 1}
              data-testid="button-prev-page"
            >
              Previous
            </button>
            
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  className={`join-item btn ${filters.page === page ? 'btn-active' : ''}`}
                  onClick={() => handleFilterChange('page', String(page))}
                  data-testid={`button-page-${page}`}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              className={`join-item btn ${filters.page === pagination.totalPages ? 'btn-disabled' : ''}`}
              onClick={() => handleFilterChange('page', String(filters.page + 1))}
              disabled={filters.page === pagination.totalPages}
              data-testid="button-next-page"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Email Detail Modal */}
      {showDetailModal && emailDetail?.data && (
        <div className="modal modal-open" data-testid="modal-email-detail">
          <div className="modal-box max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg" data-testid="text-modal-title">Email Details</h3>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={closeDetailModal}
                data-testid="button-close-modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Email Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>ID:</strong> 
                  <span className="font-mono text-sm ml-2" data-testid="text-detail-id">
                    {emailDetail.data.id}
                  </span>
                </div>
                <div>
                  <strong>Status:</strong> 
                  <span className="ml-2" data-testid="text-detail-status">
                    {getStatusBadge(emailDetail.data.status, emailDetail.data.retryCount)}
                  </span>
                </div>
                <div>
                  <strong>Recipient:</strong> 
                  <span className="ml-2" data-testid="text-detail-recipient">
                    {emailDetail.data.toEmail}
                  </span>
                </div>
                <div>
                  <strong>Template:</strong> 
                  <span className="font-mono text-sm ml-2" data-testid="text-detail-template">
                    {emailDetail.data.templateKey}
                  </span>
                </div>
                <div>
                  <strong>Created:</strong> 
                  <span className="ml-2" data-testid="text-detail-created">
                    {formatDateTime(emailDetail.data.createdAt)}
                  </span>
                </div>
                <div>
                  <strong>Trigger:</strong> 
                  <span className="ml-2" data-testid="text-detail-trigger">
                    {formatTriggerEvent(emailDetail.data.triggerEvent)}
                  </span>
                </div>
                {emailDetail.data.sentAt && (
                  <div>
                    <strong>Sent At:</strong> 
                    <span className="ml-2" data-testid="text-detail-sent">
                      {formatDateTime(emailDetail.data.sentAt)}
                    </span>
                  </div>
                )}
                {emailDetail.data.providerMessageId && (
                  <div>
                    <strong>Provider ID:</strong> 
                    <span className="font-mono text-sm ml-2" data-testid="text-detail-provider-id">
                      {emailDetail.data.providerMessageId}
                    </span>
                  </div>
                )}
              </div>

              {/* Error Details */}
              {emailDetail.data.errorMessage && (
                <div className="alert alert-error">
                  <AlertCircle className="w-4 h-4" />
                  <div>
                    <div className="font-bold">Error {emailDetail.data.errorCode && `(${emailDetail.data.errorCode})`}</div>
                    <div data-testid="text-detail-error">{emailDetail.data.errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <strong>Subject:</strong>
                <div className="mt-2 p-3 bg-base-200 rounded" data-testid="text-detail-subject">
                  {emailDetail.data.subject}
                </div>
              </div>

              {/* Email Content Tabs */}
              <div className="tabs tabs-boxed">
                <input type="radio" name="content-tabs" className="tab" defaultChecked data-testid="tab-html" />
                <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                  <h4 className="font-bold mb-2">HTML Content</h4>
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: emailDetail.data.htmlContent }}
                    data-testid="content-html"
                  />
                </div>

                {emailDetail.data.textContent && (
                  <>
                    <input type="radio" name="content-tabs" className="tab" data-testid="tab-text" />
                    <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                      <h4 className="font-bold mb-2">Plain Text Content</h4>
                      <pre 
                        className="whitespace-pre-wrap text-sm bg-base-200 p-4 rounded"
                        data-testid="content-text"
                      >
                        {emailDetail.data.textContent}
                      </pre>
                    </div>
                  </>
                )}

                {emailDetail.data.templateVariables && (
                  <>
                    <input type="radio" name="content-tabs" className="tab" data-testid="tab-variables" />
                    <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                      <h4 className="font-bold mb-2">Template Variables</h4>
                      <pre 
                        className="text-sm bg-base-200 p-4 rounded overflow-auto"
                        data-testid="content-variables"
                      >
                        {JSON.stringify(emailDetail.data.templateVariables, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-primary"
                onClick={closeDetailModal}
                data-testid="button-close-detail"
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