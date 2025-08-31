import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CertificateTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  organisationId?: string;
}

export function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const [templateEditor, setTemplateEditor] = useState("");
  const [templateName, setTemplateName] = useState("");
  const { toast } = useToast();

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
    '{{CERTIFICATE_ID}}'
  ];

  const [platformSettings, setPlatformSettings] = useState({
    defaultTheme: 'light',
    defaultCertificateExpiry: 'show',
    passwordPolicy: 'Passwords must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.',
    footerLinks: 'Privacy Policy | Terms of Service | Contact Support',
  });

  const insertPlaceholder = (placeholder: string) => {
    setTemplateEditor(prev => prev + placeholder);
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
      '{{CERTIFICATE_ID}}': 'CERT-2024-001'
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
                      data-testid="button-save-template"
                    >
                      <i className="fas fa-save"></i> Save Template
                    </button>
                    <button 
                      className="btn btn-secondary"
                      data-testid="button-preview-template"
                    >
                      <i className="fas fa-eye"></i> Preview
                    </button>
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
                    
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Background Image</span>
                      </label>
                      <input type="file" className="file-input file-input-bordered" accept="image/*" data-testid="input-background-image" />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Signature Image</span>
                      </label>
                      <input type="file" className="file-input file-input-bordered" accept="image/*" data-testid="input-signature-image" />
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
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4">Preview with Sample Data</h3>
                  <div 
                    className="certificate-preview border p-4 bg-white rounded-lg" 
                    dangerouslySetInnerHTML={{ __html: previewTemplate() }}
                    data-testid="preview-certificate"
                  ></div>
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
