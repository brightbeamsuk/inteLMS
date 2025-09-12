import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  isOverridden: boolean;
  hasDefault: boolean;
}

interface EditTemplateData {
  subject: string;
  htmlContent: string;
  textContent: string;
}

// Template definitions with metadata - ALL templates are admin notifications
const templateDefinitions = {
  admin: [
    {
      key: 'admin.new_admin_added',
      name: 'New Admin Added',
      description: 'Sent when a new admin is added to your organisation',
      variables: ['{{new_admin.name}}', '{{new_admin.email}}', '{{org.name}}', '{{added_by.name}}', '{{added_at}}']
    },
    {
      key: 'admin.new_user_added',
      name: 'New User Added',
      description: 'Sent when a new learner is added to your organisation',
      variables: ['{{user.name}}', '{{user.email}}', '{{user.full_name}}', '{{org.name}}', '{{added_by.name}}', '{{added_at}}']
    },
    {
      key: 'admin.new_course_assigned',
      name: 'Course Assigned',
      description: 'Sent when a course is assigned to users in your organisation',
      variables: ['{{course.title}}', '{{user.name}}', '{{org.name}}', '{{assigned_by.name}}', '{{assigned_at}}']
    },
    {
      key: 'admin.plan_updated',
      name: 'Plan Updated',
      description: 'Sent when your billing plan is changed',
      variables: ['{{plan.name}}', '{{plan.old_price}}', '{{plan.new_price}}', '{{org.name}}', '{{changed_by.name}}', '{{changed_at}}']
    },
    {
      key: 'admin.learner_completed_course',
      name: 'Learner Course Completion',
      description: 'Sent when a learner completes a course in your organisation',
      variables: ['{{user.name}}', '{{user.full_name}}', '{{course.title}}', '{{attempt.score}}', '{{org.name}}', '{{completed_at}}']
    },
    {
      key: 'admin.learner_failed_course',
      name: 'Learner Course Failed',
      description: 'Sent when a learner fails a course in your organisation',
      variables: ['{{user.name}}', '{{user.full_name}}', '{{course.title}}', '{{attempt.score}}', '{{org.name}}', '{{failed_at}}']
    }
  ]
};

// Sample data for previews - matching backend variable structure
const sampleData = {
  'admin.new_admin_added': {
    '{{new_admin.name}}': 'Alice Johnson',
    '{{new_admin.email}}': 'alice.johnson@acmecorp.com',
    '{{org.name}}': 'Acme Corporation',
    '{{added_by.name}}': 'John Smith',
    '{{added_at}}': 'September 12, 2025'
  },
  'admin.new_user_added': {
    '{{user.name}}': 'Sarah Johnson',
    '{{user.email}}': 'sarah.johnson@acmecorp.com',
    '{{user.full_name}}': 'Sarah Johnson',
    '{{org.name}}': 'Acme Corporation',
    '{{added_by.name}}': 'John Smith',
    '{{added_at}}': 'September 12, 2025'
  },
  'admin.new_course_assigned': {
    '{{course.title}}': 'Health & Safety Training',
    '{{user.name}}': 'Jane Doe',
    '{{org.name}}': 'Acme Corporation',
    '{{assigned_by.name}}': 'John Smith',
    '{{assigned_at}}': 'September 12, 2025'
  },
  'admin.plan_updated': {
    '{{plan.name}}': 'Professional Plan',
    '{{plan.old_price}}': '29.99',
    '{{plan.new_price}}': '34.99',
    '{{org.name}}': 'Acme Corporation',
    '{{changed_by.name}}': 'John Smith',
    '{{changed_at}}': 'September 12, 2025'
  },
  'admin.learner_completed_course': {
    '{{user.name}}': 'Michael Davis',
    '{{user.full_name}}': 'Michael Davis',
    '{{course.title}}': 'Data Protection Training',
    '{{attempt.score}}': '87.5',
    '{{org.name}}': 'Acme Corporation',
    '{{completed_at}}': 'September 12, 2025'
  },
  'admin.learner_failed_course': {
    '{{user.name}}': 'Lisa Anderson',
    '{{user.full_name}}': 'Lisa Anderson',
    '{{course.title}}': 'Financial Compliance',
    '{{attempt.score}}': '42.0',
    '{{org.name}}': 'Acme Corporation',
    '{{failed_at}}': 'September 12, 2025'
  }
};

export function AdminEmailTemplates() {
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [testTemplate, setTestTemplate] = useState<string | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [editData, setEditData] = useState<EditTemplateData>({
    subject: '',
    htmlContent: '',
    textContent: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch organization overrides
  const { data: overridesResponse, isLoading, error } = useQuery({
    queryKey: ['/api/email-templates/overrides', user?.organisationId],
    enabled: !!user?.organisationId,
    retry: false,
  });
  
  const orgOverrides: EmailTemplate[] = overridesResponse?.data || [];

  // Get template data by key - checks for org override first, then default
  const getTemplate = async (templateKey: string): Promise<EmailTemplate | null> => {
    // Check if we have an override
    const override = orgOverrides.find((t: EmailTemplate) => t.templateKey === templateKey);
    if (override) {
      return override;
    }

    // Fetch system default
    try {
      const response = await apiRequest('GET', `/api/email-templates/defaults/${templateKey}`);
      const defaultTemplate = await response.json();
      return {
        ...defaultTemplate,
        isOverridden: false,
        hasDefault: true
      };
    } catch (error) {
      // No default exists
      return {
        id: '',
        templateKey,
        category: 'admin',
        name: templateDefinitions.admin.find(t => t.key === templateKey)?.name || templateKey,
        description: templateDefinitions.admin.find(t => t.key === templateKey)?.description || '',
        subject: '',
        htmlContent: '',
        textContent: '',
        variables: templateDefinitions.admin.find(t => t.key === templateKey)?.variables || [],
        isOverridden: false,
        hasDefault: false
      };
    }
  };

  // Create/Update template override mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async ({ templateKey, data }: { templateKey: string; data: EditTemplateData }) => {
      const response = await apiRequest('PUT', `/api/email-templates/overrides/${user?.organisationId}/${templateKey}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates/overrides', user?.organisationId] });
      toast({
        title: "Success",
        description: "Email template override saved successfully",
      });
      setShowEditModal(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template override",
        variant: "destructive",
      });
    }
  });

  // Delete template override mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateKey: string) => {
      const response = await apiRequest('DELETE', `/api/email-templates/overrides/${user?.organisationId}/${templateKey}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates/overrides', user?.organisationId] });
      toast({
        title: "Success",
        description: "Template override deleted. Now using system default.",
      });
      setShowDeleteModal(false);
      setDeleteTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template override",
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
        orgId: user?.organisationId
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

  // Handle create/edit template
  const handleEditTemplate = async (templateKey: string) => {
    const template = await getTemplate(templateKey);
    if (template) {
      setEditData({
        subject: template.subject || '',
        htmlContent: template.htmlContent || '',
        textContent: template.textContent || ''
      });
    } else {
      // New template - set defaults
      setEditData({
        subject: '',
        htmlContent: '',
        textContent: ''
      });
    }
    setEditingTemplate(templateKey);
    setShowEditModal(true);
  };

  // Handle preview
  const handlePreview = async (templateKey: string) => {
    setPreviewTemplate(templateKey);
    setShowPreviewModal(true);
  };

  // Handle test email
  const handleTest = (templateKey: string) => {
    setTestTemplate(templateKey);
    setShowTestModal(true);
  };

  // Handle delete override
  const handleDeleteOverride = (templateKey: string) => {
    setDeleteTemplate(templateKey);
    setShowDeleteModal(true);
  };

  // Replace variables in content with sample data
  const replaceVariables = (content: string, templateKey: string): string => {
    const samples = sampleData[templateKey as keyof typeof sampleData];
    if (!samples) return content;

    let result = content;
    Object.entries(samples).forEach(([variable, value]) => {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return result;
  };

  // Get template definition
  const getTemplateDefinition = (templateKey: string) => {
    return templateDefinitions.admin.find(t => t.key === templateKey);
  };

  // Check if template has override
  const hasOverride = (templateKey: string): boolean => {
    return orgOverrides.some(t => t.templateKey === templateKey);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg" data-testid="loading-templates"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error" data-testid="error-templates">
          <i className="fas fa-exclamation-triangle"></i>
          <span>Failed to load email templates</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Email Templates</li>
        </ul>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-email-templates">Email Templates</h1>
        <p className="text-base-content/70" data-testid="text-description">
          Customize email templates for your organization. Create overrides of system defaults or use the platform defaults.
        </p>
      </div>

      {/* Header with info about template overrides */}
      <div className="alert alert-info mb-6" data-testid="info-template-overrides">
        <i className="fas fa-info-circle"></i>
        <div>
          <div className="font-semibold">Organization Email Templates</div>
          <div className="text-sm">Customize these admin notification templates for your organization. Templates without overrides will use the system defaults.</div>
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {templateDefinitions.admin.map((templateDef) => {
          const isOverridden = hasOverride(templateDef.key);

          return (
            <div key={templateDef.key} className="card bg-base-100 border border-base-300 shadow-sm" data-testid={`card-template-${templateDef.key}`}>
              <div className="card-body">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="card-title text-lg" data-testid={`title-${templateDef.key}`}>
                      {templateDef.name}
                    </h3>
                    <p className="text-sm text-base-content/70 mt-1" data-testid={`description-${templateDef.key}`}>
                      {templateDef.description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {/* Override status */}
                    <div className={`badge badge-sm ${isOverridden ? 'badge-success' : 'badge-outline'}`} data-testid={`status-${templateDef.key}`}>
                      {isOverridden ? 'Custom Override' : 'System Default'}
                    </div>
                  </div>
                </div>

                {/* Template key */}
                <div className="text-xs font-mono text-base-content/50 mb-3" data-testid={`key-${templateDef.key}`}>
                  {templateDef.key}
                </div>

                {/* Variables */}
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Available Variables:</div>
                  <div className="flex flex-wrap gap-1">
                    {templateDef.variables.slice(0, 3).map((variable, index) => (
                      <div key={index} className="badge badge-ghost badge-sm" data-testid={`variable-${templateDef.key}-${index}`}>
                        {variable}
                      </div>
                    ))}
                    {templateDef.variables.length > 3 && (
                      <div className="badge badge-ghost badge-sm" data-testid={`variable-more-${templateDef.key}`}>
                        +{templateDef.variables.length - 3} more
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="card-actions justify-end flex-wrap gap-2">
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={() => handlePreview(templateDef.key)}
                    data-testid={`button-preview-${templateDef.key}`}
                  >
                    <i className="fas fa-eye"></i>
                    Preview
                  </button>
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleTest(templateDef.key)}
                    data-testid={`button-test-${templateDef.key}`}
                  >
                    <i className="fas fa-paper-plane"></i>
                    Test
                  </button>
                  {isOverridden ? (
                    <>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => handleEditTemplate(templateDef.key)}
                        data-testid={`button-edit-${templateDef.key}`}
                      >
                        <i className="fas fa-edit"></i>
                        Edit Override
                      </button>
                      <button 
                        className="btn btn-sm btn-error btn-outline"
                        onClick={() => handleDeleteOverride(templateDef.key)}
                        data-testid={`button-delete-${templateDef.key}`}
                      >
                        <i className="fas fa-trash"></i>
                        Delete Override
                      </button>
                    </>
                  ) : (
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEditTemplate(templateDef.key)}
                      data-testid={`button-create-${templateDef.key}`}
                    >
                      <i className="fas fa-plus"></i>
                      Create Override
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <div className="modal modal-open" data-testid="modal-edit-template">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="heading-edit-modal">
              {hasOverride(editingTemplate) ? 'Edit' : 'Create'} Override: {getTemplateDefinition(editingTemplate)?.name}
            </h3>

            {/* Available Variables */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Available Variables:</div>
              <div className="flex flex-wrap gap-2">
                {getTemplateDefinition(editingTemplate)?.variables.map((variable, index) => (
                  <div 
                    key={index} 
                    className="badge badge-ghost cursor-pointer hover:badge-primary"
                    onClick={() => {
                      // Insert variable at cursor position in active textarea
                      const activeElement = document.activeElement as HTMLTextAreaElement;
                      if (activeElement && (activeElement.name === 'subject' || activeElement.name === 'htmlContent' || activeElement.name === 'textContent')) {
                        const start = activeElement.selectionStart;
                        const end = activeElement.selectionEnd;
                        const value = activeElement.value;
                        const newValue = value.substring(0, start) + variable + value.substring(end);
                        
                        if (activeElement.name === 'subject') {
                          setEditData(prev => ({ ...prev, subject: newValue }));
                        } else if (activeElement.name === 'htmlContent') {
                          setEditData(prev => ({ ...prev, htmlContent: newValue }));
                        } else if (activeElement.name === 'textContent') {
                          setEditData(prev => ({ ...prev, textContent: newValue }));
                        }
                      }
                    }}
                    data-testid={`variable-insert-${index}`}
                  >
                    {variable}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Subject */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Subject *</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  className="input input-bordered w-full"
                  placeholder="Email subject line..."
                  value={editData.subject}
                  onChange={(e) => setEditData(prev => ({ ...prev, subject: e.target.value }))}
                  data-testid="input-subject"
                />
              </div>

              {/* HTML Content */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">HTML Content *</span>
                </label>
                <textarea
                  name="htmlContent"
                  className="textarea textarea-bordered h-48 font-mono text-sm"
                  placeholder="HTML email content..."
                  value={editData.htmlContent}
                  onChange={(e) => setEditData(prev => ({ ...prev, htmlContent: e.target.value }))}
                  data-testid="textarea-html-content"
                />
              </div>

              {/* Text Content */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Text Content (Fallback)</span>
                </label>
                <textarea
                  name="textContent"
                  className="textarea textarea-bordered h-32"
                  placeholder="Plain text email content (optional)..."
                  value={editData.textContent}
                  onChange={(e) => setEditData(prev => ({ ...prev, textContent: e.target.value }))}
                  data-testid="textarea-text-content"
                />
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTemplate(null);
                }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-primary ${saveTemplateMutation.isPending ? 'loading' : ''}`}
                onClick={() => {
                  if (editingTemplate && editData.subject && editData.htmlContent) {
                    saveTemplateMutation.mutate({ 
                      templateKey: editingTemplate, 
                      data: editData 
                    });
                  } else {
                    toast({
                      title: "Validation Error",
                      description: "Please fill in the subject and HTML content",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={!editData.subject || !editData.htmlContent || saveTemplateMutation.isPending}
                data-testid="button-save-template"
              >
                {saveTemplateMutation.isPending ? 'Saving...' : hasOverride(editingTemplate || '') ? 'Update Override' : 'Create Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewTemplate && (
        <div className="modal modal-open" data-testid="modal-preview-template">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="heading-preview-modal">
              Preview: {getTemplateDefinition(previewTemplate)?.name}
            </h3>
            
            <div className="space-y-4">
              {(() => {
                const isOverridden = hasOverride(previewTemplate);
                const override = orgOverrides.find(t => t.templateKey === previewTemplate);
                const subject = override?.subject || 'Loading...';
                const htmlContent = override?.htmlContent || 'Loading template content...';
                
                return (
                  <>
                    {/* Override status */}
                    <div className="alert alert-info">
                      <i className="fas fa-info-circle"></i>
                      <span>
                        {isOverridden ? 'Showing your organization override' : 'Showing system default (no override)'}
                      </span>
                    </div>

                    {/* Subject Preview */}
                    <div>
                      <div className="text-sm font-medium mb-2">Subject:</div>
                      <div className="bg-base-200 p-3 rounded border" data-testid="preview-subject">
                        {replaceVariables(subject, previewTemplate)}
                      </div>
                    </div>

                    {/* HTML Preview */}
                    <div>
                      <div className="text-sm font-medium mb-2">HTML Content:</div>
                      <div className="bg-white border rounded p-4 h-96 overflow-auto" data-testid="preview-html">
                        <iframe
                          srcDoc={replaceVariables(htmlContent, previewTemplate)}
                          className="w-full h-full border-0"
                          title="Email Preview"
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewTemplate(null);
                }}
                data-testid="button-close-preview"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && testTemplate && (
        <div className="modal modal-open" data-testid="modal-test-email">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="heading-test-modal">
              Send Test Email: {getTemplateDefinition(testTemplate)?.name}
            </h3>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Email Address</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="Enter email address..."
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                data-testid="input-test-email"
              />
            </div>

            <div className="alert alert-info" data-testid="alert-test-info">
              <i className="fas fa-info-circle"></i>
              <span>
                This will send a test email using your organization's {hasOverride(testTemplate) ? 'custom override' : 'system default'} template.
              </span>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => {
                  setShowTestModal(false);
                  setTestTemplate(null);
                  setTestEmailAddress('');
                }}
                data-testid="button-cancel-test"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-primary ${testEmailMutation.isPending ? 'loading' : ''}`}
                onClick={() => {
                  if (testTemplate && testEmailAddress) {
                    testEmailMutation.mutate({ 
                      templateKey: testTemplate, 
                      testEmail: testEmailAddress 
                    });
                  }
                }}
                disabled={!testEmailAddress || testEmailMutation.isPending}
                data-testid="button-send-test"
              >
                {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Override Confirmation Modal */}
      {showDeleteModal && deleteTemplate && (
        <div className="modal modal-open" data-testid="modal-delete-override">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="heading-delete-modal">
              Delete Template Override
            </h3>
            
            <p className="mb-4">
              Are you sure you want to delete your custom override for "{getTemplateDefinition(deleteTemplate)?.name}"?
            </p>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <span>
                This will permanently delete your custom template and revert to using the system default.
              </span>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTemplate(null);
                }}
                data-testid="button-cancel-delete"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-error ${deleteTemplateMutation.isPending ? 'loading' : ''}`}
                onClick={() => {
                  if (deleteTemplate) {
                    deleteTemplateMutation.mutate(deleteTemplate);
                  }
                }}
                disabled={deleteTemplateMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteTemplateMutation.isPending ? 'Deleting...' : 'Delete Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}