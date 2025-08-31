import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

interface Organisation {
  id: string;
  name: string;
  displayName: string;
  subdomain: string;
  logoUrl?: string;
  theme: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function SuperAdminOrganisations() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    subdomain: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    theme: "light",
    logoUrl: "",
    // Admin user fields
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
    adminJobTitle: "",
    adminDepartment: "",
  });

  const { data: organisations = [], isLoading } = useQuery<Organisation[]>({
    queryKey: ['/api/organisations'],
  });

  const createOrganisationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/organisations', data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      setShowCreateModal(false);
      resetForm();
      
      const { organisation, adminUser } = data;
      toast({
        title: "Success! 🎉",
        description: `Organisation "${organisation.displayName}" created with admin user ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to create organisation";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      displayName: "",
      subdomain: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      theme: "light",
      logoUrl: "",
      adminEmail: "",
      adminFirstName: "",
      adminLastName: "",
      adminJobTitle: "",
      adminDepartment: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.subdomain || !formData.adminEmail || !formData.adminFirstName || !formData.adminLastName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields including admin user details",
        variant: "destructive",
      });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.adminEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address for the admin user",
        variant: "destructive",
      });
      return;
    }
    
    createOrganisationMutation.mutate(formData);
  };

  const handleLogoUpload = async () => {
    try {
      const response = await apiRequest('POST', '/api/objects/upload', {});
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleLogoComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadUrl = result.successful[0].uploadURL as string;
      setFormData(prev => ({ ...prev, logoUrl: uploadUrl }));
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    }
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Organisations</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Organisations</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          data-testid="button-create-organisation"
        >
          <i className="fas fa-plus"></i> Create Organisation
        </button>
      </div>

      {/* Organisations Table */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Name</th>
                  <th>Subdomain</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      <span className="loading loading-spinner loading-md"></span>
                    </td>
                  </tr>
                ) : organisations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/60">
                      No organisations found. Create your first organisation to get started.
                    </td>
                  </tr>
                ) : (
                  organisations.map((org) => (
                    <tr key={org.id} data-testid={`row-organisation-${org.id}`}>
                      <td>
                        <div className="avatar">
                          <div className="w-12 h-12 rounded">
                            {org.logoUrl ? (
                              <img src={org.logoUrl} alt={`${org.name} logo`} />
                            ) : (
                              <div className="bg-primary text-primary-content flex items-center justify-center">
                                <i className="fas fa-building"></i>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-bold" data-testid={`text-org-name-${org.id}`}>{org.displayName}</div>
                          <div className="text-sm opacity-50" data-testid={`text-org-internal-${org.id}`}>{org.name}</div>
                        </div>
                      </td>
                      <td>
                        <div className="badge badge-ghost" data-testid={`text-org-subdomain-${org.id}`}>
                          {org.subdomain}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div data-testid={`text-org-email-${org.id}`}>{org.contactEmail || 'Not set'}</div>
                          <div className="text-base-content/60" data-testid={`text-org-phone-${org.id}`}>{org.contactPhone || 'No phone'}</div>
                        </div>
                      </td>
                      <td>
                        <div className={`badge ${org.status === 'active' ? 'badge-success' : 'badge-error'}`} data-testid={`badge-org-status-${org.id}`}>
                          {org.status}
                        </div>
                      </td>
                      <td data-testid={`text-org-created-${org.id}`}>
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button 
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              setSelectedOrg(org);
                              setShowDetailsModal(true);
                            }}
                            data-testid={`button-view-org-${org.id}`}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-ghost"
                            data-testid={`button-edit-org-${org.id}`}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-error"
                            data-testid={`button-deactivate-org-${org.id}`}
                          >
                            <i className="fas fa-ban"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Organisation Modal */}
      {showCreateModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-modal-title">Create New Organisation</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Organisation Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter organisation name" 
                    className="input input-bordered" 
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value, displayName: e.target.value }))}
                    required 
                    data-testid="input-org-name"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Subdomain/Slug *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. techcorp" 
                    className="input input-bordered" 
                    value={formData.subdomain}
                    onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value }))}
                    required 
                    data-testid="input-org-subdomain"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Contact Email</span>
                  </label>
                  <input 
                    type="email" 
                    placeholder="contact@organisation.com" 
                    className="input input-bordered" 
                    value={formData.contactEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    data-testid="input-org-email"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Contact Phone</span>
                  </label>
                  <input 
                    type="tel" 
                    placeholder="+1 (555) 123-4567" 
                    className="input input-bordered" 
                    value={formData.contactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    data-testid="input-org-phone"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Logo Upload</span>
                </label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880} // 5MB
                  onGetUploadParameters={handleLogoUpload}
                  onComplete={handleLogoComplete}
                  buttonClassName="btn btn-outline w-full"
                >
                  <i className="fas fa-upload mr-2"></i>
                  {formData.logoUrl ? "Change Logo" : "Upload Logo"}
                </ObjectUploader>
                {formData.logoUrl && (
                  <div className="mt-2 text-sm text-success">
                    <i className="fas fa-check"></i> Logo uploaded
                  </div>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Choose Theme</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={formData.theme}
                  onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                  data-testid="select-org-theme"
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
                  <span className="label-text">Address (Optional)</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered" 
                  placeholder="Organisation address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  data-testid="input-org-address"
                ></textarea>
              </div>

              {/* Admin User Section */}
              <div className="divider">
                <span className="text-lg font-semibold">👤 Organisation Admin User</span>
              </div>
              
              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <span>An admin user will be created for this organisation. They will receive an invitation email to set up their account.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Admin Email Address *</span>
                  </label>
                  <input 
                    type="email" 
                    placeholder="admin@organisation.com" 
                    className="input input-bordered" 
                    value={formData.adminEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
                    required 
                    data-testid="input-admin-email"
                  />
                  <label className="label">
                    <span className="label-text-alt">This will be used to invite the admin user</span>
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Job Title</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Learning Manager" 
                    className="input input-bordered" 
                    value={formData.adminJobTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, adminJobTitle: e.target.value }))}
                    data-testid="input-admin-job-title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">First Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter first name" 
                    className="input input-bordered" 
                    value={formData.adminFirstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, adminFirstName: e.target.value }))}
                    required 
                    data-testid="input-admin-first-name"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Last Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter last name" 
                    className="input input-bordered" 
                    value={formData.adminLastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, adminLastName: e.target.value }))}
                    required 
                    data-testid="input-admin-last-name"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Department</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Human Resources, Training" 
                  className="input input-bordered" 
                  value={formData.adminDepartment}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminDepartment: e.target.value }))}
                  data-testid="input-admin-department"
                />
              </div>

              <div className="modal-action">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createOrganisationMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createOrganisationMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Create Organisation'
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowCreateModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Organisation Details Modal */}
      {showDetailsModal && selectedOrg && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-details-modal-title">
              {selectedOrg.displayName} - Overview
            </h3>
            
            <div className="tabs tabs-bordered mb-4">
              <a className="tab tab-active">Overview</a>
              <a className="tab">Admins</a>
              <a className="tab">Users</a>
              <a className="tab">Courses</a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-figure text-primary">
                  <i className="fas fa-user-tie text-2xl"></i>
                </div>
                <div className="stat-title">Admins</div>
                <div className="stat-value text-primary" data-testid="stat-org-admins">2</div>
              </div>
              
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-figure text-secondary">
                  <i className="fas fa-users text-2xl"></i>
                </div>
                <div className="stat-title">Users</div>
                <div className="stat-value text-secondary" data-testid="stat-org-users">47</div>
              </div>
              
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-figure text-accent">
                  <i className="fas fa-graduation-cap text-2xl"></i>
                </div>
                <div className="stat-title">Courses Assigned</div>
                <div className="stat-value text-accent" data-testid="stat-org-courses">156</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button className="btn btn-sm btn-outline" data-testid="button-manage-admins">
                <i className="fas fa-user-tie"></i> Manage Admins
              </button>
              <button className="btn btn-sm btn-outline" data-testid="button-manage-users">
                <i className="fas fa-users"></i> Manage Users
              </button>
              <button className="btn btn-sm btn-outline" data-testid="button-assign-courses">
                <i className="fas fa-graduation-cap"></i> Assign Courses
              </button>
              <button className="btn btn-sm btn-secondary" data-testid="button-open-as-admin">
                <i className="fas fa-eye"></i> Open as Admin
              </button>
            </div>

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => setShowDetailsModal(false)}
                data-testid="button-close-details"
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowDetailsModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
