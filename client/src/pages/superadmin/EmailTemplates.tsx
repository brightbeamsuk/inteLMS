import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ErrorBoundary from "@/components/ui/error-boundary";
import { DataLoadFailurePanel, FailurePanel } from "@/components/ui/failure-panel";
import { Eye, Send, Edit, RefreshCw, X, ChevronRight } from "lucide-react";

interface EmailTemplate {
  id: string;
  templateKey: string;
  category: 'admin' | 'learner';
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  version: number;
  isActive: boolean;
  hasHtml: boolean;
  hasText: boolean;
  updatedAt: string;
}

interface TemplatesResponse {
  ok: boolean;
  stage?: string;
  error?: {
    short: string;
    detail?: string;
  };
  data?: {
    templates: EmailTemplate[];
    stats: {
      total: number;
      configured: number;
      defaults: number;
    };
  };
}

interface PreviewRequest {
  templateKey: string;
  variables?: Record<string, any>;
}

interface PreviewResponse {
  ok: boolean;
  error?: {
    short: string;
    detail?: string;
  };
  preview?: {
    subject: string;
    html: string;
    text?: string;
  };
}

// Sample data for variable preview
const sampleVariableData: Record<string, any> = {
  user: {
    name: "John Doe",
    email: "john.doe@acmecorp.com",
    full_name: "John Doe"
  },
  org: {
    name: "Acme Corporation",
    display_name: "Acme Corp"
  },
  admin: {
    name: "Admin User",
    full_name: "Admin User"
  },
  course: {
    title: "Safety Training Course"
  },
  attempt: {
    score: "85.5"
  },
  added_by: {
    name: "Manager Smith"
  },
  assigned_by: {
    name: "Manager Smith"
  },
  added_at: new Date().toLocaleDateString(),
  completed_at: new Date().toLocaleDateString(),
  assigned_at: new Date().toLocaleDateString()
};

function SuperAdminEmailTemplatesContent() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [previewVariables, setPreviewVariables] = useState<string>('{}');
  const [previewData, setPreviewData] = useState<PreviewResponse['preview'] | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Main templates query using resilient endpoint
  const templatesQuery = useQuery<TemplatesResponse>({
    queryKey: ['/api/superadmin/email/templates'],
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Repair/seed templates mutation
  const repairMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/superadmin/email/templates/repair');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/superadmin/email/templates'] });
      toast({
        title: "Success",
        description: "Templates repaired and defaults seeded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair templates",
        variant: "destructive",
      });
    }
  });

  // Preview template mutation
  const previewMutation = useMutation({
    mutationFn: async (request: PreviewRequest) => {
      const response = await apiRequest('POST', '/api/superadmin/email/templates/preview', request);
      return response.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      if (data.ok && data.preview) {
        setPreviewData(data.preview);
        setShowPreviewModal(true);
      } else {
        toast({
          title: "Preview Failed",
          description: data.error?.short || "Failed to generate preview",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Preview Error",
        description: error.message || "Failed to generate preview",
        variant: "destructive",
      });
    }
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async ({ templateKey, testEmail }: { templateKey: string; testEmail: string }) => {
      const response = await apiRequest('POST', '/api/email-templates/send-test', {
        key: templateKey,
        to: [testEmail],
        orgId: null
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Success" : "Test Failed",
        description: data.success 
          ? "Test email sent successfully! Check your inbox." 
          : data.error || "Failed to send test email",
        variant: data.success ? "default" : "destructive",
      });
      setShowTestModal(false);
      setTestEmailAddress('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    }
  });

  // Handle template row click
  const handleTemplateClick = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    setShowDetailDrawer(true);
  };

  // Handle preview with variables
  const handlePreview = (templateKey: string) => {
    let variables = {};
    try {
      if (previewVariables.trim()) {
        variables = JSON.parse(previewVariables);
      } else {
        variables = sampleVariableData;
      }
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Preview variables must be valid JSON",
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate({
      templateKey,
      variables
    });
  };

  // Handle test email
  const handleTest = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    setShowTestModal(true);
  };

  // Render main content based on query state
  const renderContent = () => {
    if (templatesQuery.isLoading) {
      return (
        <div className="flex items-center justify-center h-64" data-testid="loading-templates">
          <div className="flex flex-col items-center space-y-4">
            <div className="loading loading-spinner loading-lg"></div>
            <p className="text-base-content/70">Loading email templates...</p>
          </div>
        </div>
      );
    }

    if (templatesQuery.error) {
      return (
        <DataLoadFailurePanel
          title="Network connection failed"
          stage="Fetching templates"
          error={{
            short: "Could not connect to the server",
            detail: (templatesQuery.error as Error).message
          }}
          onRetry={() => templatesQuery.refetch()}
          retryLoading={templatesQuery.isFetching}
          className="max-w-2xl mx-auto"
        />
      );
    }

    const response = templatesQuery.data;
    if (!response?.ok) {
      return (
        <DataLoadFailurePanel
          title="Templates failed to load"
          stage={response?.stage || "Database query"}
          error={response?.error}
          onRetry={() => templatesQuery.refetch()}
          onRepair={() => repairMutation.mutate()}
          retryLoading={templatesQuery.isFetching}
          repairLoading={repairMutation.isPending}
          className="max-w-2xl mx-auto"
        />
      );
    }

    const { templates, stats } = response.data!;

    if (templates.length === 0) {
      return (
        <div className="text-center py-12" data-testid="empty-state">
          <div className="bg-base-200 rounded-lg p-8 max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-base-content/70 mb-4">
              No email templates are configured. Click "Repair/Seed Defaults" to create the default templates.
            </p>
            <button
              className={`btn btn-primary ${repairMutation.isPending ? 'loading' : ''}`}
              onClick={() => repairMutation.mutate()}
              disabled={repairMutation.isPending}
              data-testid="button-seed-defaults"
            >
              {!repairMutation.isPending && "Repair/Seed Defaults"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat bg-base-100 rounded-lg">
            <div className="stat-title">Total Templates</div>
            <div className="stat-value text-primary">{stats.total}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg">
            <div className="stat-title">Configured</div>
            <div className="stat-value text-success">{stats.configured}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg">
            <div className="stat-title">Using Defaults</div>
            <div className="stat-value text-warning">{stats.defaults}</div>
          </div>
        </div>

        {/* Templates Table */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title">Email Templates</h2>
              <button
                className={`btn btn-outline btn-sm ${templatesQuery.isFetching ? 'loading' : ''}`}
                onClick={() => templatesQuery.refetch()}
                disabled={templatesQuery.isFetching}
                data-testid="button-refresh"
              >
                {!templatesQuery.isFetching && <RefreshCw className="w-4 h-4 mr-1" />}
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-hover w-full" data-testid="templates-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Content</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr 
                      key={template.id}
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleTemplateClick(template.templateKey)}
                      data-testid={`template-row-${template.templateKey}`}
                    >
                      <td>
                        <div className="font-mono text-xs text-base-content/60">
                          {template.templateKey}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-base-content/60">{template.description}</div>
                      </td>
                      <td>
                        <div className="badge badge-ghost badge-sm">v{template.version}</div>
                      </td>
                      <td>
                        <div className={`badge badge-sm ${template.isActive ? 'badge-success' : 'badge-error'}`}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                      <td>
                        <div className="flex space-x-1">
                          {template.hasHtml && (
                            <div className="badge badge-primary badge-xs">HTML</div>
                          )}
                          {template.hasText && (
                            <div className="badge badge-secondary badge-xs">TEXT</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-base-content/60">
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(template.templateKey);
                            }}
                            data-testid={`button-preview-${template.templateKey}`}
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTest(template.templateKey);
                            }}
                            data-testid={`button-test-${template.templateKey}`}
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  };

  const selectedTemplateData = templatesQuery.data?.ok 
    ? templatesQuery.data.data?.templates.find(t => t.templateKey === selectedTemplate)
    : null;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-email-templates">
          Email Templates
        </h1>
        <p className="text-base-content/70" data-testid="text-description">
          Manage and configure email templates for the platform. These serve as defaults that organizations can override.
        </p>
      </div>

      {/* Main Content */}
      {renderContent()}

      {/* Template Detail Drawer */}
      {showDetailDrawer && selectedTemplateData && (
        <div className="drawer drawer-end">
          <input 
            type="checkbox" 
            className="drawer-toggle" 
            checked={showDetailDrawer}
            onChange={() => setShowDetailDrawer(!showDetailDrawer)}
          />
          <div className="drawer-side z-50">
            <label className="drawer-overlay" onClick={() => setShowDetailDrawer(false)}></label>
            <div className="min-h-full w-96 bg-base-100 p-6" data-testid="template-detail-drawer">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold">{selectedTemplateData.name}</h3>
                  <p className="text-sm text-base-content/60">{selectedTemplateData.templateKey}</p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDetailDrawer(false)}
                  data-testid="button-close-drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Template Info */}
              <div className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Subject</span>
                  </label>
                  <div className="text-sm bg-base-200 p-3 rounded">
                    {selectedTemplateData.subject || 'No subject configured'}
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">Variables</span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplateData.variables.map((variable, index) => (
                      <div key={index} className="badge badge-ghost badge-sm">
                        {variable}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">Preview Variables (JSON)</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full h-32 font-mono text-xs"
                    placeholder="Enter JSON for preview variables..."
                    value={previewVariables}
                    onChange={(e) => setPreviewVariables(e.target.value)}
                    data-testid="textarea-preview-variables"
                  />
                  <div className="text-xs text-base-content/60 mt-1">
                    Leave empty to use sample data
                  </div>
                </div>

                <button
                  className={`btn btn-primary w-full ${previewMutation.isPending ? 'loading' : ''}`}
                  onClick={() => handlePreview(selectedTemplateData.templateKey)}
                  disabled={previewMutation.isPending}
                  data-testid="button-generate-preview"
                >
                  {!previewMutation.isPending && <Eye className="w-4 h-4 mr-2" />}
                  Generate Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="modal modal-open" data-testid="modal-preview">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">Template Preview</h3>
            
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text font-medium">Subject</span>
                </label>
                <div className="bg-base-200 p-3 rounded">
                  {previewData.subject}
                </div>
              </div>

              <div className="tabs tabs-bordered">
                <input type="radio" name="preview_tabs" className="tab" aria-label="HTML" defaultChecked />
                <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewData.html }}
                  />
                </div>

                {previewData.text && (
                  <>
                    <input type="radio" name="preview_tabs" className="tab" aria-label="Text" />
                    <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                      <pre className="whitespace-pre-wrap text-sm">
                        {previewData.text}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => setShowPreviewModal(false)}
                data-testid="button-close-preview"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && selectedTemplate && (
        <div className="modal modal-open" data-testid="modal-test-email">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Send Test Email</h3>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email Address</span>
              </label>
              <input
                type="email"
                className="input input-bordered"
                placeholder="test@example.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                data-testid="input-test-email"
              />
            </div>

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => setShowTestModal(false)}
                data-testid="button-cancel-test"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-primary ${testEmailMutation.isPending ? 'loading' : ''}`}
                onClick={() => testEmailMutation.mutate({ templateKey: selectedTemplate, testEmail: testEmailAddress })}
                disabled={!testEmailAddress.trim() || testEmailMutation.isPending}
                data-testid="button-send-test"
              >
                {!testEmailMutation.isPending && <Send className="w-4 h-4 mr-2" />}
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main component wrapped with ErrorBoundary
export function SuperAdminEmailTemplates() {
  return (
    <ErrorBoundary
      fallback={
        <div className="container mx-auto p-6">
          <FailurePanel
            title="Email Templates page crashed"
            stage="Page Render"
            error={{
              short: "The page encountered an error and could not render",
              detail: "This typically happens due to corrupt component state or invalid data"
            }}
            actions={{
              primary: {
                label: "Reload Page",
                action: () => window.location.reload(),
                variant: 'primary'
              }
            }}
            className="max-w-2xl mx-auto"
          />
        </div>
      }
    >
      <SuperAdminEmailTemplatesContent />
    </ErrorBoundary>
  );
}