import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CertificateTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  organisationId?: string;
  createdAt: string;
  updatedAt: string;
}

export function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const [templateEditor, setTemplateEditor] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const availablePlaceholders = [
    '{{USERNAME}}',
    '{{USER_EMAIL}}',
    '{{COURSE_NAME}}',
    '{{COURSE_ID}}',
    '{{ORGANISATION_NAME}}',
    '{{ADMIN_NAME}}',
    '{{SCORE_PERCENT}}',
    '{{PASS_FAIL}}',
    '{{DATE_COMPLETED}}',
    '{{CERTIFICATE_ID}}',
    '{{BACKGROUND_IMAGE}}',
    '{{SIGNATURE_IMAGE}}'
  ];

  const [platformSettings, setPlatformSettings] = useState({
    defaultTheme: 'light',
    defaultCertificateExpiry: 'show',
    passwordPolicy: 'Passwords must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.',
    footerLinks: 'Privacy Policy | Terms of Service | Contact Support',
  });

  // Fetch existing templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/certificate-templates'],
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: { name: string; template: string; isDefault?: boolean }) => {
      if (editingTemplateId) {
        const response = await fetch(`/api/certificate-templates/${editingTemplateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        });
        if (!response.ok) throw new Error('Failed to update template');
        return response.json();
      } else {
        const response = await fetch('/api/certificate-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        });
        if (!response.ok) throw new Error('Failed to create template');
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/certificate-templates'] });
      toast({
        title: "Success",
        description: editingTemplateId ? "Template updated successfully" : "Template saved successfully",
      });
      clearEditor();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/certificate-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/certificate-templates'] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  });

  const insertPlaceholder = (placeholder: string) => {
    setTemplateEditor(prev => prev + placeholder);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !templateEditor.trim()) {
      toast({
        title: "Error",
        description: "Please provide both template name and HTML content",
        variant: "destructive",
      });
      return;
    }

    // Include uploaded images in the template
    let finalTemplate = templateEditor;
    if (backgroundImage) {
      finalTemplate = finalTemplate.replace(/{{BACKGROUND_IMAGE}}/g, backgroundImage);
    }
    if (signatureImage) {
      finalTemplate = finalTemplate.replace(/{{SIGNATURE_IMAGE}}/g, signatureImage);
    }

    saveTemplateMutation.mutate({
      name: templateName,
      template: finalTemplate,
      isDefault: false
    });
  };

  const clearEditor = () => {
    setTemplateEditor("");
    setTemplateName("");
    setBackgroundImage(null);
    setSignatureImage(null);
    setEditingTemplateId(null);
    setShowPreview(false);
  };

  const editTemplate = (template: CertificateTemplate) => {
    setTemplateEditor(template.template);
    setTemplateName(template.name);
    setEditingTemplateId(template.id);
    setShowPreview(false);
  };

  const handleFileUpload = (file: File, type: 'background' | 'signature') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (type === 'background') {
        setBackgroundImage(result);
      } else {
        setSignatureImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const previewTemplate = () => {
    const sampleData = {
      '{{USERNAME}}': 'John Smith',
      '{{USER_EMAIL}}': 'john.smith@example.com',
      '{{COURSE_NAME}}': 'Data Protection Essentials',
      '{{COURSE_ID}}': 'COURSE-001',
      '{{ORGANISATION_NAME}}': 'Sample Organisation Ltd',
      '{{ADMIN_NAME}}': 'Sarah Johnson',
      '{{SCORE_PERCENT}}': '92%',
      '{{PASS_FAIL}}': 'PASS',
      '{{DATE_COMPLETED}}': new Date().toLocaleDateString(),
      '{{CERTIFICATE_ID}}': 'CERT-2024-001',
      '{{BACKGROUND_IMAGE}}': backgroundImage ? `<img src="${backgroundImage}" alt="Background" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: -1;" />` : '',
      '{{SIGNATURE_IMAGE}}': signatureImage ? `<img src="${signatureImage}" alt="Signature" style="max-width: 200px; height: auto;" />` : ''
    };

    let preview = templateEditor;
    Object.entries(sampleData).forEach(([placeholder, value]) => {
      preview = preview.replace(new RegExp(placeholder, 'g'), value);
    });

    return preview;
  };

  const tabs = ["Certificate Templates", "Platform Options"];

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Settings</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Settings</h1>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          {/* Tabs */}
          <div className="tabs tabs-bordered mb-6">
            {tabs.map((tab, index) => (
              <a 
                key={index}
                className={`tab ${activeTab === index ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(index)}
                data-testid={`tab-${index}`}
              >
                {tab}
              </a>
            ))}
          </div>

          {/* Certificate Templates Tab */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Template Editor */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Certificate Template Builder</h3>
                  
                  <div className="form-control mb-4">
                    <label className="label">
                      <span className="label-text">Template Name</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Default Platform Template" 
                      className="input input-bordered"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      data-testid="input-template-name"
                    />
                  </div>

                  <div className="form-control mb-4">
                    <label className="label">
                      <span className="label-text">Template HTML</span>
                    </label>
                    <textarea 
                      className="textarea textarea-bordered h-64" 
                      placeholder="Enter your certificate template HTML here..."
                      value={templateEditor}
                      onChange={(e) => setTemplateEditor(e.target.value)}
                      data-testid="textarea-template-editor"
                    ></textarea>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button 
                      className="btn btn-primary"
                      onClick={handleSaveTemplate}
                      disabled={saveTemplateMutation.isPending}
                      data-testid="button-save-template"
                    >
                      {saveTemplateMutation.isPending ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        <i className="fas fa-save"></i>
                      )}
                      {editingTemplateId ? 'Update Template' : 'Save Template'}
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setShowPreview(!showPreview)}
                      data-testid="button-preview-template"
                    >
                      <i className="fas fa-eye"></i> {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    {editingTemplateId && (
                      <button 
                        className="btn btn-outline"
                        onClick={clearEditor}
                        data-testid="button-clear-template"
                      >
                        <i className="fas fa-times"></i> Cancel Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Placeholders Panel */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Available Placeholders</h3>
                  <p className="text-sm text-base-content/60 mb-4">Click to insert into template</p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {availablePlaceholders.map((placeholder) => (
                      <button
                        key={placeholder}
                        className="btn btn-sm btn-outline justify-start"
                        onClick={() => insertPlaceholder(placeholder)}
                        data-testid={`button-placeholder-${placeholder.replace(/[{}]/g, '').toLowerCase()}`}
                      >
                        <code className="text-xs">{placeholder}</code>
                      </button>
                    ))}
                  </div>

                  <div className="divider"></div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Template Options</h4>
                    <div className="text-sm text-gray-600 mb-4">
                      Upload images and use {{BACKGROUND_IMAGE}} and {{SIGNATURE_IMAGE}} placeholders in your template
                    </div>
                    
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Background Image</span>
                      </label>
                      <input 
                        type="file" 
                        className="file-input file-input-bordered" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'background');
                        }}
                        data-testid="input-background-image" 
                      />
                      {backgroundImage && (
                        <div className="mt-2">
                          <div className="text-xs text-green-600 mb-1">✓ Background image uploaded</div>
                          <img src={backgroundImage} alt="Background preview" className="w-32 h-20 object-cover rounded border" />
                          <button 
                            className="btn btn-xs btn-error ml-2"
                            onClick={() => setBackgroundImage(null)}
                            data-testid="button-remove-background"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Signature Image</span>
                      </label>
                      <input 
                        type="file" 
                        className="file-input file-input-bordered" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'signature');
                        }}
                        data-testid="input-signature-image" 
                      />
                      {signatureImage && (
                        <div className="mt-2">
                          <div className="text-xs text-green-600 mb-1">✓ Signature image uploaded</div>
                          <img src={signatureImage} alt="Signature preview" className="w-32 h-20 object-cover rounded border" />
                          <button 
                            className="btn btn-xs btn-error ml-2"
                            onClick={() => setSignatureImage(null)}
                            data-testid="button-remove-signature"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Font Family</span>
                      </label>
                      <select className="select select-bordered" data-testid="select-font-family">
                        <option value="Georgia">Georgia (serif)</option>
                        <option value="Arial">Arial (sans-serif)</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Helvetica">Helvetica</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Preview */}
              {showPreview && (
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body">
                    <h3 className="text-lg font-semibold mb-4">Preview with Sample Data</h3>
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <div 
                        className="certificate-preview border p-4 bg-white rounded-lg min-h-[400px] relative overflow-hidden" 
                        style={{ position: 'relative' }}
                        dangerouslySetInnerHTML={{ __html: previewTemplate() }}
                        data-testid="preview-certificate"
                      ></div>
                      {(backgroundImage || signatureImage) && (
                        <div className="mt-4 text-sm text-gray-600">
                          <p><strong>Note:</strong> This preview shows your uploaded images.</p>
                          {backgroundImage && <p>✓ Background image is applied</p>}
                          {signatureImage && <p>✓ Signature image is applied</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Templates */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4">Existing Templates</h3>
                  {templatesLoading ? (
                    <div className="flex justify-center py-4">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  ) : (templates as CertificateTemplate[]).length === 0 ? (
                    <p className="text-base-content/60 text-center py-4">No templates created yet</p>
                  ) : (
                    <div className="space-y-3">
                      {(templates as CertificateTemplate[]).map((template: CertificateTemplate) => (
                        <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-semibold">{template.name}</h4>
                            <p className="text-sm text-base-content/60">
                              Created: {new Date(template.createdAt).toLocaleDateString()}
                              {template.isDefault && <span className="badge badge-primary badge-sm ml-2">Default</span>}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              className="btn btn-sm btn-outline"
                              onClick={() => editTemplate(template)}
                              data-testid={`button-edit-template-${template.id}`}
                            >
                              <i className="fas fa-edit"></i> Edit
                            </button>
                            <button 
                              className="btn btn-sm btn-error btn-outline"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this template?')) {
                                  deleteTemplateMutation.mutate(template.id);
                                }
                              }}
                              disabled={deleteTemplateMutation.isPending}
                              data-testid={`button-delete-template-${template.id}`}
                            >
                              <i className="fas fa-trash"></i> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Platform Options Tab */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Platform Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Default Theme for New Organisations</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={platformSettings.defaultTheme}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, defaultTheme: e.target.value }))}
                    data-testid="select-default-theme"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="corporate">Corporate</option>
                    <option value="business">Business</option>
                    <option value="emerald">Emerald</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="pastel">Pastel</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Certificate Expiry Display</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={platformSettings.defaultCertificateExpiry}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, defaultCertificateExpiry: e.target.value }))}
                    data-testid="select-cert-expiry-display"
                  >
                    <option value="show">Show expiry date on certificates</option>
                    <option value="hide">Hide expiry date on certificates</option>
                  </select>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Password Policy Text</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered h-24" 
                  value={platformSettings.passwordPolicy}
                  onChange={(e) => setPlatformSettings(prev => ({ ...prev, passwordPolicy: e.target.value }))}
                  data-testid="textarea-password-policy"
                ></textarea>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Footer Links</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Privacy Policy | Terms of Service | Contact Support" 
                  className="input input-bordered"
                  value={platformSettings.footerLinks}
                  onChange={(e) => setPlatformSettings(prev => ({ ...prev, footerLinks: e.target.value }))}
                  data-testid="input-footer-links"
                />
                <label className="label">
                  <span className="label-text-alt">Separate links with | (pipe) characters</span>
                </label>
              </div>

              <div className="flex justify-end">
                <button className="btn btn-primary" data-testid="button-save-platform-settings">
                  <i className="fas fa-save"></i> Save Platform Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
