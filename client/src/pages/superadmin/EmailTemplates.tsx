import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ErrorBoundary from "@/components/ui/error-boundary";
import { DataLoadFailurePanel, FailurePanel } from "@/components/ui/failure-panel";
import { Eye, Send, Edit, RefreshCw, X, ChevronRight, Save, AlertCircle } from "lucide-react";

interface EmailTemplate {
  key: string;
  name: string;
  category: string;
  subject: string;
  html: string;
  text?: string;
  mjml?: string;
  isActive: boolean;
  version: number;
  variablesSchema?: string;
  createdAt?: string;
  updatedAt?: string;
  htmlSize?: number;
  error?: string;
}

interface TemplatesResponse {
  ok: boolean;
  stage?: string;
  error?: {
    short: string;
    raw?: string;
  };
  data?: EmailTemplate[];
  meta?: {
    totalCount: number;
    activeCount: number;
    categories: string[];
    health: {
      isHealthy: boolean;
      missingKeys: string[];
      missingCount: number;
    };
  };
  hasRepair?: boolean;
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [previewVariables, setPreviewVariables] = useState<string>('{}');
  const [previewData, setPreviewData] = useState<PreviewResponse['preview'] | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<EmailTemplate>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [activeEditTab, setActiveEditTab] = useState<'html' | 'text' | 'mjml'>('html');

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

  // Edit template mutation
  const editTemplateMutation = useMutation({
    mutationFn: async ({ templateKey, updateData }: { templateKey: string; updateData: Partial<EmailTemplate> }) => {
      const response = await apiRequest('PUT', `/api/superadmin/email/templates/${templateKey}`, updateData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: "Success",
          description: "Template updated successfully",
        });
        setShowEditModal(false);
        setEditFormData({});
        setEditErrors({});
        queryClient.invalidateQueries({ queryKey: ['/api/superadmin/email/templates'] });
      } else {
        toast({
          title: "Update Failed",
          description: data.error?.short || "Failed to update template",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
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

  // Handle edit template
  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template.key);
    setEditFormData({
      name: template.name,
      subject: template.subject,
      html: template.html,
      mjml: template.mjml,
      text: template.text || '',
      variablesSchema: template.variablesSchema,
      category: template.category,
      isActive: template.isActive
    });
    setEditErrors({});
    setActiveEditTab('html'); // Reset to HTML tab when opening edit modal
    setShowEditModal(true);
  };

  // Validate edit form
  const validateEditForm = (data: Partial<EmailTemplate>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!data.name?.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!data.subject?.trim()) {
      errors.subject = 'Subject is required';
    }
    
    if (!data.html?.trim() && !data.mjml?.trim()) {
      errors.html = 'Either HTML content or MJML source is required';
    }
    
    if (!data.category) {
      errors.category = 'Category is required';
    }
    
    // Validate variables schema if provided
    if (data.variablesSchema && typeof data.variablesSchema === 'string') {
      try {
        JSON.parse(data.variablesSchema);
      } catch (e) {
        errors.variablesSchema = 'Variables schema must be valid JSON';
      }
    }
    
    return errors;
  };

  // Handle edit form input changes
  const handleEditInputChange = (field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (editErrors[field]) {
      setEditErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle save edit
  const handleSaveEdit = () => {
    const errors = validateEditForm(editFormData);
    
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fix the validation errors before saving",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedTemplate) {
      toast({
        title: "Error",
        description: "No template selected for editing",
        variant: "destructive",
      });
      return;
    }
    
    // Parse variables schema if it's a string
    const processedData = { ...editFormData };
    if (typeof processedData.variablesSchema === 'string') {
      try {
        processedData.variablesSchema = JSON.parse(processedData.variablesSchema);
      } catch (e) {
        processedData.variablesSchema = undefined;
      }
    }
    
    editTemplateMutation.mutate({
      templateKey: selectedTemplate,
      updateData: processedData
    });
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

    const templates = response.data || [];
    const stats = response.meta || { totalCount: 0, activeCount: 0, categories: [] };

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
            <div className="stat-value text-primary">{stats.totalCount}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg">
            <div className="stat-title">Active</div>
            <div className="stat-value text-success">{stats.activeCount}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg">
            <div className="stat-title">Categories</div>
            <div className="stat-value text-warning">{stats.categories?.length || 0}</div>
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
                      key={template.key}
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleTemplateClick(template.key)}
                      data-testid={`template-row-${template.key}`}
                    >
                      <td>
                        <div className="font-mono text-xs text-base-content/60">
                          {template.key}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-base-content/60">{template.category || 'No category'}</div>
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
                          {template.html && (
                            <div className="badge badge-primary badge-xs">HTML</div>
                          )}
                          {template.text && (
                            <div className="badge badge-secondary badge-xs">TEXT</div>
                          )}
                          {template.mjml && (
                            <div className="badge badge-accent badge-xs">MJML</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-base-content/60">
                          {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : 'Unknown'}
                        </div>
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(template);
                            }}
                            data-testid={`button-edit-${template.key}`}
                            title="Edit template"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(template.key);
                            }}
                            data-testid={`button-preview-${template.key}`}
                            title="Preview template"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTest(template.key);
                            }}
                            data-testid={`button-test-${template.key}`}
                            title="Send test email"
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

  const selectedTemplateData = templatesQuery.data?.ok && templatesQuery.data?.data
    ? templatesQuery.data.data.find(t => t.key === selectedTemplate)
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
                  <p className="text-sm text-base-content/60">{selectedTemplateData.key}</p>
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
                    {(() => {
                      try {
                        const vars = selectedTemplateData.variablesSchema ? JSON.parse(selectedTemplateData.variablesSchema) : [];
                        return Array.isArray(vars) ? vars.map((variable, index) => (
                          <div key={index} className="badge badge-ghost badge-sm">
                            {variable}
                          </div>
                        )) : (
                          <div className="text-sm text-base-content/60">No variables defined</div>
                        );
                      } catch (e) {
                        return <div className="text-sm text-base-content/60">Invalid variables schema</div>;
                      }
                    })()}
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
                  onClick={() => handlePreview(selectedTemplateData.key)}
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

      {/* Edit Template Modal */}
      {showEditModal && selectedTemplate && (
        <div className="modal modal-open" data-testid="modal-edit-template">
          <div className="modal-box max-w-6xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Edit Email Template</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEditModal(false)}
                data-testid="button-close-edit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Template Name *</span>
                  </label>
                  <input
                    type="text"
                    className={`input input-bordered ${editErrors.name ? 'input-error' : ''}`}
                    placeholder="Enter template name"
                    value={editFormData.name || ''}
                    onChange={(e) => handleEditInputChange('name', e.target.value)}
                    data-testid="input-edit-name"
                  />
                  {editErrors.name && (
                    <label className="label">
                      <span className="label-text-alt text-error">{editErrors.name}</span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Subject Line *</span>
                  </label>
                  <input
                    type="text"
                    className={`input input-bordered ${editErrors.subject ? 'input-error' : ''}`}
                    placeholder="Enter email subject (can include {{variables}})"
                    value={editFormData.subject || ''}
                    onChange={(e) => handleEditInputChange('subject', e.target.value)}
                    data-testid="input-edit-subject"
                  />
                  {editErrors.subject && (
                    <label className="label">
                      <span className="label-text-alt text-error">{editErrors.subject}</span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Category *</span>
                  </label>
                  <select
                    className={`select select-bordered ${editErrors.category ? 'select-error' : ''}`}
                    value={editFormData.category || ''}
                    onChange={(e) => handleEditInputChange('category', e.target.value)}
                    data-testid="select-edit-category"
                  >
                    <option value="">Select category</option>
                    <option value="admin">Admin</option>
                    <option value="learner">Learner</option>
                  </select>
                  {editErrors.category && (
                    <label className="label">
                      <span className="label-text-alt text-error">{editErrors.category}</span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Status</span>
                  </label>
                  <label className="label cursor-pointer justify-start">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary mr-3"
                      checked={editFormData.isActive || false}
                      onChange={(e) => handleEditInputChange('isActive', e.target.checked)}
                      data-testid="checkbox-edit-active"
                    />
                    <span className="label-text">Template is active</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Variables Schema (JSON)</span>
                  </label>
                  <textarea
                    className={`textarea textarea-bordered h-24 font-mono text-xs ${editErrors.variablesSchema ? 'textarea-error' : ''}`}
                    placeholder={`["user.name", "user.email", "org.name", "course.title"]`}
                    value={typeof editFormData.variablesSchema === 'string' 
                      ? editFormData.variablesSchema 
                      : JSON.stringify(editFormData.variablesSchema || [], null, 2)}
                    onChange={(e) => handleEditInputChange('variablesSchema', e.target.value)}
                    data-testid="textarea-edit-variables"
                  />
                  {editErrors.variablesSchema && (
                    <label className="label">
                      <span className="label-text-alt text-error">{editErrors.variablesSchema}</span>
                    </label>
                  )}
                  <div className="label">
                    <span className="label-text-alt">Array of available variable names for this template</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Content */}
              <div className="space-y-4">
                <div className="tabs tabs-bordered">
                  <a 
                    className={`tab ${activeEditTab === 'html' ? 'tab-active' : ''}`} 
                    data-testid="tab-html"
                    onClick={() => setActiveEditTab('html')}
                  >
                    HTML Content
                  </a>
                  <a 
                    className={`tab ${activeEditTab === 'text' ? 'tab-active' : ''}`} 
                    data-testid="tab-text"
                    onClick={() => setActiveEditTab('text')}
                  >
                    Text Content
                  </a>
                  <a 
                    className={`tab ${activeEditTab === 'mjml' ? 'tab-active' : ''}`} 
                    data-testid="tab-mjml"
                    onClick={() => setActiveEditTab('mjml')}
                  >
                    MJML Source
                  </a>
                </div>

                {/* HTML Content Tab */}
                {activeEditTab === 'html' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">HTML Content *</span>
                    </label>
                    <textarea
                      className={`textarea textarea-bordered h-64 font-mono text-xs ${editErrors.html ? 'textarea-error' : ''}`}
                      placeholder="Enter HTML content (can include {{variables}})"
                      value={editFormData.html || ''}
                      onChange={(e) => handleEditInputChange('html', e.target.value)}
                      data-testid="textarea-edit-html"
                    />
                    {editErrors.html && (
                      <label className="label">
                        <span className="label-text-alt text-error">{editErrors.html}</span>
                      </label>
                    )}
                    <div className="label">
                      <span className="label-text-alt">Rich HTML email content with variable support</span>
                    </div>
                  </div>
                )}

                {/* Text Content Tab */}
                {activeEditTab === 'text' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Plain Text Content</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-64 font-mono text-xs"
                      placeholder="Enter plain text version (optional, but recommended)"
                      value={editFormData.text || ''}
                      onChange={(e) => handleEditInputChange('text', e.target.value)}
                      data-testid="textarea-edit-text"
                    />
                    <div className="label">
                      <span className="label-text-alt">Fallback for email clients that don't support HTML</span>
                    </div>
                  </div>
                )}

                {/* MJML Content Tab */}
                {activeEditTab === 'mjml' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">MJML Source</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-64 font-mono text-xs"
                      placeholder="Enter MJML source (advanced feature)"
                      value={editFormData.mjml || ''}
                      onChange={(e) => handleEditInputChange('mjml', e.target.value)}
                      data-testid="textarea-edit-mjml"
                    />
                    <div className="label">
                      <span className="label-text-alt">MJML will be compiled to HTML automatically</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Summary */}
            {Object.keys(editErrors).length > 0 && (
              <div className="alert alert-error mt-4" data-testid="edit-error-summary">
                <AlertCircle className="w-4 h-4" />
                <div>
                  <div className="font-medium">Please fix the following errors:</div>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {Object.entries(editErrors).map(([field, error]) => (
                      <li key={field}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="modal-action mt-6">
              <button
                className="btn"
                onClick={() => setShowEditModal(false)}
                disabled={editTemplateMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </button>
              <button
                className={`btn btn-primary ${editTemplateMutation.isPending ? 'loading' : ''}`}
                onClick={handleSaveEdit}
                disabled={editTemplateMutation.isPending}
                data-testid="button-save-edit"
              >
                {!editTemplateMutation.isPending && <Save className="w-4 h-4 mr-2" />}
                Save Changes
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