import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ImageUpload } from "@/components/ImageUpload";
import type { UploadResult } from "@uppy/core";

interface Organisation {
  id: string;
  name: string;
  displayName: string;
  subdomain: string;
  logoUrl?: string;
  theme: string;
  accentColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface OrganisationStats {
  adminUsers: number;
  activeUsers: number;
  coursesAssigned: number;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  jobTitle?: string;
  department?: string;
  lastLoginAt?: string;
  activeAssignments?: number;
  completedAssignments?: number;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  estimatedDuration?: string;
  courseType?: string;
}

export function SuperAdminOrganisations() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [showManageAdminsModal, setShowManageAdminsModal] = useState(false);
  const [showManageUsersModal, setShowManageUsersModal] = useState(false);
  const [showAssignCoursesModal, setShowAssignCoursesModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Organisation>>({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [archiveConfirmText, setArchiveConfirmText] = useState("");
  const [permanentDeleteConfirmText, setPermanentDeleteConfirmText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    subdomain: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    theme: "light",
    accentColor: "#3b82f6",
    logoUrl: "",
    // Admin user fields
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
    adminJobTitle: "",
    adminDepartment: "",
    // Course category access
    selectedCategoryIds: [] as string[],
  });

  const { data: organisations = [], isLoading } = useQuery<Organisation[]>({
    queryKey: ['/api/organisations'],
  });

  // Fetch course folders/categories for selection
  interface CourseFolder {
    id: string;
    name: string;
    description?: string;
    color?: string;
  }

  const { data: courseFolders = [], isLoading: foldersLoading } = useQuery<CourseFolder[]>({
    queryKey: ['/api/course-folders'],
  });

  // Filter organizations based on status
  const activeOrganisations = organisations.filter(org => org.status === 'active');
  const archivedOrganisations = organisations.filter(org => org.status === 'archived');
  const displayedOrganisations = showArchived ? archivedOrganisations : activeOrganisations;

  // Get organisation stats when details modal is open
  const { data: orgStats, isLoading: statsLoading } = useQuery<OrganisationStats>({
    queryKey: ['/api/organisations', selectedOrg?.id, 'stats'],
    enabled: !!selectedOrg && showDetailsModal,
  });

  const createOrganisationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/organisations', data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      // Also invalidate the specific organization query used by ThemeProvider
      queryClient.invalidateQueries({ queryKey: [`/api/organisations/${data.organisation.id}`] });
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

  const updateOrganisationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PUT', `/api/organisations/${id}`, data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      // Also invalidate the specific organization query used by ThemeProvider
      queryClient.invalidateQueries({ queryKey: [`/api/organisations/${data.id}`] });
      setShowEditModal(false);
      setSelectedOrg(null);
      toast({
        title: "Success!",
        description: `Organisation "${data.displayName}" updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update organisation",
        variant: "destructive",
      });
    },
  });

  const deleteOrganisationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/organisations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      setShowDeleteModal(false);
      setSelectedOrg(null);
      setDeleteConfirmText("");
      toast({
        title: "Success!",
        description: "Organisation deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete organisation",
        variant: "destructive",
      });
    },
  });

  const archiveOrganisationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('PUT', `/api/organisations/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      setShowArchiveModal(false);
      setSelectedOrg(null);
      setArchiveConfirmText("");
      toast({
        title: "Success!",
        description: "Organisation archived successfully. Users will no longer be able to access the platform.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive organisation",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteOrganisationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/organisations/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      setShowPermanentDeleteModal(false);
      setSelectedOrg(null);
      setPermanentDeleteConfirmText("");
      toast({
        title: "Success!",
        description: "Organisation permanently deleted. All data has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to permanently delete organisation",
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
      accentColor: "#3b82f6",
      logoUrl: "",
      adminEmail: "",
      adminFirstName: "",
      adminLastName: "",
      adminJobTitle: "",
      adminDepartment: "",
      selectedCategoryIds: [],
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    
    updateOrganisationMutation.mutate({
      id: selectedOrg.id,
      data: editFormData,
    });
  };

  const handleDelete = () => {
    if (!selectedOrg || deleteConfirmText !== selectedOrg.displayName) return;
    deleteOrganisationMutation.mutate(selectedOrg.id);
  };

  const handleArchive = () => {
    if (!selectedOrg || archiveConfirmText !== 'DELETE') return;
    archiveOrganisationMutation.mutate(selectedOrg.id);
  };

  const handlePermanentDelete = () => {
    if (!selectedOrg || permanentDeleteConfirmText !== 'DELETE') return;
    permanentDeleteOrganisationMutation.mutate(selectedOrg.id);
  };

  const handleOpenAsAdmin = async (orgId: string) => {
    try {
      const response = await apiRequest('POST', `/api/organisations/${orgId}/impersonate-admin`);
      const { adminLoginUrl } = await response.json();
      
      // Open in new tab
      window.open(adminLoginUrl, '_blank');
      
      toast({
        title: "Success!",
        description: "Opened admin dashboard in new tab",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open admin dashboard",
        variant: "destructive",
      });
    }
  };


  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a onClick={() => setLocation('/superadmin')} className="cursor-pointer" data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Organisations</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Organisations</h1>
          <div className="flex gap-2">
            <button 
              className={`btn btn-sm ${!showArchived ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowArchived(false)}
              data-testid="button-active-orgs"
            >
              <i className="fas fa-building"></i> Active ({activeOrganisations.length})
            </button>
            <button 
              className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowArchived(true)}
              data-testid="button-archived-orgs"
            >
              <i className="fas fa-archive"></i> Archived ({archivedOrganisations.length})
            </button>
          </div>
        </div>
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
                ) : displayedOrganisations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/60">
                      {showArchived ? 'No archived organisations found.' : 'No organisations found. Create your first organisation to get started.'}
                    </td>
                  </tr>
                ) : (
                  displayedOrganisations.map((org) => (
                    <tr key={org.id} data-testid={`row-organisation-${org.id}`}>
                      <td>
                        <div className="avatar">
                          <div className="w-12 h-12 rounded">
                            {org.logoUrl ? (
                              <img 
                                src={org.logoUrl} 
                                alt={`${org.name} logo`} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Show fallback on error
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`bg-primary text-primary-content flex items-center justify-center ${org.logoUrl ? 'hidden' : ''}`}>
                              <i className="fas fa-building"></i>
                            </div>
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
                        <div className={`badge ${
                          org.status === 'active' ? 'badge-success' : 
                          org.status === 'archived' ? 'badge-warning' : 'badge-error'
                        }`} data-testid={`badge-org-status-${org.id}`}>
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
                          {org.status === 'active' && (
                            <>
                              <button 
                                className="btn btn-sm btn-ghost"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setEditFormData({
                                    name: org.name,
                                    displayName: org.displayName,
                                    contactEmail: org.contactEmail,
                                    contactPhone: org.contactPhone,
                                    address: org.address,
                                    theme: org.theme,
                                    accentColor: org.accentColor || "#3b82f6",
                                    logoUrl: org.logoUrl
                                  });
                                  setShowEditModal(true);
                                }}
                                data-testid={`button-edit-org-${org.id}`}
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button 
                                className="btn btn-sm btn-warning"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setShowArchiveModal(true);
                                }}
                                data-testid={`button-archive-org-${org.id}`}
                                title="Archive organisation"
                              >
                                <i className="fas fa-archive"></i>
                              </button>
                            </>
                          )}
                          {org.status === 'archived' && (
                            <button 
                              className="btn btn-sm btn-error"
                              onClick={() => {
                                setSelectedOrg(org);
                                setShowPermanentDeleteModal(true);
                              }}
                              data-testid={`button-permanent-delete-org-${org.id}`}
                              title="Permanently delete organisation"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
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
                <ImageUpload
                  imageType="logo"
                  currentImageUrl={formData.logoUrl}
                  onImageUploaded={(publicPath) => setFormData(prev => ({ ...prev, logoUrl: publicPath }))}
                  buttonClassName="btn btn-outline w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <span className="label-text">Accent Color</span>
                  </label>
                  <div className="flex gap-2 items-end">
                    <input 
                      type="color" 
                      className="w-16 h-12 border border-base-300 rounded cursor-pointer"
                      value={formData.accentColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                      data-testid="input-org-accent-color"
                    />
                    <input 
                      type="text" 
                      placeholder="#3b82f6" 
                      className="input input-bordered flex-1" 
                      value={formData.accentColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                      data-testid="input-org-accent-color-text"
                    />
                  </div>
                  <label className="label">
                    <span className="label-text-alt">This color will be used as the primary accent color for the organization's dashboard</span>
                  </label>
                </div>
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

              {/* Course Categories Section */}
              <div className="divider">
                <span className="text-lg font-semibold">📚 Course Category Access</span>
              </div>
              
              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <span>Select which course categories this organisation should have access to. Only courses in selected categories will be visible to their admins and users.</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Available Course Categories</span>
                </label>
                {foldersLoading ? (
                  <div className="flex justify-center py-4">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-base-300 rounded p-3">
                    {courseFolders.length === 0 ? (
                      <div className="text-center text-base-content/70 col-span-full py-4">
                        <i className="fas fa-folder-open text-2xl mb-2"></i>
                        <p>No course categories available</p>
                        <p className="text-sm">Create course categories first to grant access</p>
                      </div>
                    ) : (
                      courseFolders.map((folder) => (
                        <label key={folder.id} className="flex items-center gap-2 cursor-pointer hover:bg-base-200 p-2 rounded">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary"
                            checked={formData.selectedCategoryIds.includes(folder.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  selectedCategoryIds: [...prev.selectedCategoryIds, folder.id]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  selectedCategoryIds: prev.selectedCategoryIds.filter(id => id !== folder.id)
                                }));
                              }
                            }}
                            data-testid={`checkbox-category-${folder.id}`}
                          />
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: folder.color || '#3b82f6' }}
                            ></div>
                            <span className="text-sm font-medium">{folder.name}</span>
                            {folder.description && (
                              <span className="text-xs text-base-content/60">- {folder.description}</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <label className="label">
                  <span className="label-text-alt">
                    Selected: {formData.selectedCategoryIds.length} of {courseFolders.length} categories
                  </span>
                </label>
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
                <div className="stat-value text-primary" data-testid="stat-org-admins">
                  {statsLoading ? <span className="loading loading-spinner loading-sm"></span> : (orgStats?.adminUsers || 0)}
                </div>
              </div>
              
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-figure text-secondary">
                  <i className="fas fa-users text-2xl"></i>
                </div>
                <div className="stat-title">Active Users</div>
                <div className="stat-value text-secondary" data-testid="stat-org-users">
                  {statsLoading ? <span className="loading loading-spinner loading-sm"></span> : (orgStats?.activeUsers || 0)}
                </div>
              </div>
              
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-figure text-accent">
                  <i className="fas fa-graduation-cap text-2xl"></i>
                </div>
                <div className="stat-title">Courses Assigned</div>
                <div className="stat-value text-accent" data-testid="stat-org-courses">
                  {statsLoading ? <span className="loading loading-spinner loading-sm"></span> : (orgStats?.coursesAssigned || 0)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button 
                className="btn btn-sm btn-outline" 
                onClick={() => setShowManageAdminsModal(true)}
                data-testid="button-manage-admins"
              >
                <i className="fas fa-user-tie"></i> Manage Admins
              </button>
              <button 
                className="btn btn-sm btn-outline" 
                onClick={() => setShowManageUsersModal(true)}
                data-testid="button-manage-users"
              >
                <i className="fas fa-users"></i> Manage Users
              </button>
              <button 
                className="btn btn-sm btn-outline" 
                onClick={() => setShowAssignCoursesModal(true)}
                data-testid="button-assign-courses"
              >
                <i className="fas fa-graduation-cap"></i> Assign Courses
              </button>
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={() => handleOpenAsAdmin(selectedOrg.id)}
                data-testid="button-open-as-admin"
              >
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

      {/* Edit Organisation Modal */}
      {showEditModal && selectedOrg && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-edit-modal-title">
              Edit Organisation: {selectedOrg.displayName}
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Organisation Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter organisation name" 
                    className="input input-bordered" 
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value, displayName: e.target.value }))}
                    required 
                    data-testid="input-edit-org-name"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Display Name</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Display name" 
                    className="input input-bordered" 
                    value={editFormData.displayName || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    data-testid="input-edit-org-display-name"
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
                    value={editFormData.contactEmail || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    data-testid="input-edit-org-email"
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
                    value={editFormData.contactPhone || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    data-testid="input-edit-org-phone"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Logo Upload</span>
                </label>
                <ImageUpload
                  imageType="logo"
                  currentImageUrl={editFormData.logoUrl}
                  onImageUploaded={(publicPath) => setEditFormData(prev => ({ ...prev, logoUrl: publicPath }))}
                  buttonClassName="btn btn-outline w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Choose Theme</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={editFormData.theme || 'light'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, theme: e.target.value }))}
                    data-testid="select-edit-org-theme"
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
                    <span className="label-text">Accent Color</span>
                  </label>
                  <div className="flex gap-2 items-end">
                    <input 
                      type="color" 
                      className="w-16 h-12 border border-base-300 rounded cursor-pointer"
                      value={editFormData.accentColor || "#3b82f6"}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                      data-testid="input-edit-org-accent-color"
                    />
                    <input 
                      type="text" 
                      placeholder="#3b82f6" 
                      className="input input-bordered flex-1" 
                      value={editFormData.accentColor || "#3b82f6"}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                      data-testid="input-edit-org-accent-color-text"
                    />
                  </div>
                  <label className="label">
                    <span className="label-text-alt">This color will be used as the primary accent color for the organization's dashboard</span>
                  </label>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Address (Optional)</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered" 
                  placeholder="Organisation address"
                  value={editFormData.address || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                  data-testid="input-edit-org-address"
                ></textarea>
              </div>

              <div className="modal-action">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedOrg(null);
                    setEditFormData({});
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={updateOrganisationMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateOrganisationMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Update Organisation'
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowEditModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedOrg && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-delete-modal-title">
              Confirm Delete Organisation
            </h3>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <h4 className="font-bold">Warning: This action cannot be undone!</h4>
                <p className="text-sm">This will permanently delete the organisation and all associated data including users, courses, and assignments.</p>
              </div>
            </div>
            
            <p className="mb-4">
              Are you sure you want to delete <strong>"{selectedOrg.displayName}"</strong>?
            </p>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Type the organisation name to confirm:</span>
              </label>
              <input 
                type="text" 
                placeholder={selectedOrg.displayName}
                className="input input-bordered" 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                data-testid="input-confirm-delete"
              />
            </div>

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedOrg(null);
                  setDeleteConfirmText("");
                }}
                data-testid="button-cancel-delete"
              >
                Cancel
              </button>
              <button 
                className="btn btn-error"
                onClick={handleDelete}
                disabled={deleteOrganisationMutation.isPending || deleteConfirmText !== selectedOrg.displayName}
                data-testid="button-confirm-delete"
              >
                {deleteOrganisationMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Delete Organisation'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowDeleteModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Manage Admins Modal */}
      {showManageAdminsModal && selectedOrg && (
        <ManageAdminsModal 
          organisation={selectedOrg}
          onClose={() => setShowManageAdminsModal(false)}
        />
      )}

      {/* Manage Users Modal */}
      {showManageUsersModal && selectedOrg && (
        <ManageUsersModal 
          organisation={selectedOrg}
          onClose={() => setShowManageUsersModal(false)}
        />
      )}

      {/* Assign Courses Modal */}
      {showAssignCoursesModal && selectedOrg && (
        <AssignCoursesModal 
          organisation={selectedOrg}
          onClose={() => setShowAssignCoursesModal(false)}
        />
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && selectedOrg && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-archive-modal-title">
              Archive Organisation
            </h3>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <h4 className="font-bold">This will archive the organisation!</h4>
                <p className="text-sm">Users will no longer be able to access the platform. The organisation can be permanently deleted later if needed.</p>
              </div>
            </div>
            
            <p className="mb-4">
              Are you sure you want to archive <strong>"{selectedOrg.displayName}"</strong>?
            </p>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Type <strong>DELETE</strong> to confirm:</span>
              </label>
              <input 
                type="text" 
                placeholder="DELETE"
                className="input input-bordered" 
                value={archiveConfirmText}
                onChange={(e) => setArchiveConfirmText(e.target.value)}
                data-testid="input-confirm-archive"
              />
            </div>

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => {
                  setShowArchiveModal(false);
                  setSelectedOrg(null);
                  setArchiveConfirmText("");
                }}
                data-testid="button-cancel-archive"
              >
                Cancel
              </button>
              <button 
                className="btn btn-warning"
                onClick={handleArchive}
                disabled={archiveOrganisationMutation.isPending || archiveConfirmText !== 'DELETE'}
                data-testid="button-confirm-archive"
              >
                {archiveOrganisationMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Archive Organisation'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowArchiveModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showPermanentDeleteModal && selectedOrg && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-permanent-delete-modal-title">
              Permanently Delete Organisation
            </h3>
            
            <div className="alert alert-error mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <h4 className="font-bold">DANGER: This action cannot be undone!</h4>
                <p className="text-sm">This will permanently delete the organisation and all associated data including users, courses, assignments, and certificates. This action is IRREVERSIBLE.</p>
              </div>
            </div>
            
            <p className="mb-4">
              Are you absolutely sure you want to permanently delete <strong>"{selectedOrg.displayName}"</strong>?
            </p>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Type <strong>DELETE</strong> to confirm permanent deletion:</span>
              </label>
              <input 
                type="text" 
                placeholder="DELETE"
                className="input input-bordered" 
                value={permanentDeleteConfirmText}
                onChange={(e) => setPermanentDeleteConfirmText(e.target.value)}
                data-testid="input-confirm-permanent-delete"
              />
            </div>

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => {
                  setShowPermanentDeleteModal(false);
                  setSelectedOrg(null);
                  setPermanentDeleteConfirmText("");
                }}
                data-testid="button-cancel-permanent-delete"
              >
                Cancel
              </button>
              <button 
                className="btn btn-error"
                onClick={handlePermanentDelete}
                disabled={permanentDeleteOrganisationMutation.isPending || permanentDeleteConfirmText !== 'DELETE'}
                data-testid="button-confirm-permanent-delete"
              >
                {permanentDeleteOrganisationMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Permanently Delete'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowPermanentDeleteModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

// Manage Admins Modal Component
function ManageAdminsModal({ organisation, onClose }: { organisation: Organisation; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<any>(null);
  
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/organisations', organisation.id, 'users'],
  });

  const adminUsers = users.filter((user) => user.role === 'admin');

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', `/api/users/${userId}/reset-password`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset email sent to admin",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  // Delete Admin Mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('DELETE', `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Admin deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organisations', organisation.id, 'users'] });
      setConfirmDeleteUser(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete admin",
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = (user: any) => {
    resetPasswordMutation.mutate(user.id);
  };

  const handleDeleteAdmin = (user: any) => {
    setConfirmDeleteUser(user);
  };

  const confirmDelete = () => {
    if (confirmDeleteUser) {
      deleteAdminMutation.mutate(confirmDeleteUser.id);
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-lg mb-4" data-testid="text-manage-admins-title">
          Manage Admins - {organisation.displayName}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    <span className="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
              ) : adminUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-base-content/60">
                    No admin users found
                  </td>
                </tr>
              ) : (
                adminUsers.map((user) => (
                  <tr key={user.id} data-testid={`row-admin-${user.id}`}>
                    <td>
                      <div className="font-bold">{user.firstName} {user.lastName}</div>
                      <div className="text-sm opacity-50">{user.jobTitle || 'No job title'}</div>
                    </td>
                    <td data-testid={`text-admin-email-${user.id}`}>{user.email}</td>
                    <td>
                      <div className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                        {user.status}
                      </div>
                    </td>
                    <td data-testid={`text-admin-last-login-${user.id}`}>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div className="dropdown dropdown-end">
                        <button 
                          className="btn btn-sm btn-ghost"
                          tabIndex={0}
                          data-testid={`button-admin-actions-${user.id}`}
                        >
                          <i className="fas fa-ellipsis-v"></i>
                        </button>
                        <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
                          <li>
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="text-warning"
                              data-testid={`button-reset-password-${user.id}`}
                            >
                              <i className="fas fa-key"></i>
                              Reset Password
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={() => handleDeleteAdmin(user)}
                              className="text-error"
                              data-testid={`button-delete-admin-${user.id}`}
                            >
                              <i className="fas fa-trash"></i>
                              Delete Admin
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-action">
          <button 
            className="btn"
            onClick={onClose}
            data-testid="button-close-manage-admins"
          >
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>

      {/* Delete Confirmation Modal */}
      {confirmDeleteUser && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Confirm Delete Admin</h3>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <h4 className="font-bold">Warning: This action cannot be undone!</h4>
                <p className="text-sm">This will permanently remove the admin user from the system.</p>
              </div>
            </div>
            
            <p className="mb-4">
              Are you sure you want to delete <strong>"{confirmDeleteUser.firstName} {confirmDeleteUser.lastName}"</strong> ({confirmDeleteUser.email})?
            </p>

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => setConfirmDeleteUser(null)}
                data-testid="button-cancel-delete-admin"
              >
                Cancel
              </button>
              <button 
                className="btn btn-error"
                onClick={confirmDelete}
                disabled={deleteAdminMutation.isPending}
                data-testid="button-confirm-delete-admin"
              >
                {deleteAdminMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Delete Admin'
                )}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </dialog>
  );
}

// Manage Users Modal Component
function ManageUsersModal({ organisation, onClose }: { organisation: Organisation; onClose: () => void }) {
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/organisations', organisation.id, 'users'],
  });

  const regularUsers = users.filter((user) => user.role === 'user');

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-lg mb-4" data-testid="text-manage-users-title">
          Manage Users - {organisation.displayName}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Status</th>
                <th>Assignments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    <span className="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
              ) : regularUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-base-content/60">
                    No users found
                  </td>
                </tr>
              ) : (
                regularUsers.map((user) => (
                  <tr key={user.id} data-testid={`row-user-${user.id}`}>
                    <td>
                      <div className="font-bold">{user.firstName} {user.lastName}</div>
                      <div className="text-sm opacity-50">{user.jobTitle || 'No job title'}</div>
                    </td>
                    <td data-testid={`text-user-email-${user.id}`}>{user.email}</td>
                    <td data-testid={`text-user-department-${user.id}`}>{user.department || 'N/A'}</td>
                    <td>
                      <div className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                        {user.status}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div>Active: {user.activeAssignments || 0}</div>
                        <div>Completed: {user.completedAssignments || 0}</div>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" data-testid={`button-view-user-${user.id}`}>
                        <i className="fas fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-action">
          <button 
            className="btn"
            onClick={onClose}
            data-testid="button-close-manage-users"
          >
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

// Assign Courses Modal Component
function AssignCoursesModal({ organisation, onClose }: { organisation: Organisation; onClose: () => void }) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses/all'],
  });

  const assignCoursesMutation = useMutation({
    mutationFn: async (courseIds: string[]) => {
      const response = await apiRequest('POST', `/api/organisations/${organisation.id}/assign-courses`, { courseIds });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.message,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign courses",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCourses([]);
      setSelectAll(false);
    } else {
      setSelectedCourses(courses.map((course) => course.id));
      setSelectAll(true);
    }
  };

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourses(prev => {
      const updated = prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId];
      
      setSelectAll(updated.length === courses.length);
      return updated;
    });
  };

  const handleSubmit = () => {
    if (selectedCourses.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one course to assign",
        variant: "destructive",
      });
      return;
    }

    assignCoursesMutation.mutate(selectedCourses);
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-lg mb-4" data-testid="text-assign-courses-title">
          Assign Courses - {organisation.displayName}
        </h3>
        
        <div className="mb-4">
          <button 
            className="btn btn-sm btn-outline"
            onClick={handleSelectAll}
            data-testid="button-select-all-courses"
          >
            <i className="fas fa-check-square"></i>
            {selectAll ? 'Unselect All' : 'Select All'}
          </button>
          <span className="ml-2 text-sm text-base-content/60">
            {selectedCourses.length} of {courses.length} courses selected
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              No courses available
            </div>
          ) : (
            <div className="space-y-2">
              {courses.map((course) => (
                <div key={course.id} className="form-control">
                  <label className="label cursor-pointer justify-start gap-4" data-testid={`label-course-${course.id}`}>
                    <input 
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() => handleCourseToggle(course.id)}
                      data-testid={`checkbox-course-${course.id}`}
                    />
                    <div className="flex-1">
                      <div className="font-bold">{course.title}</div>
                      <div className="text-sm opacity-70">{course.description}</div>
                      <div className="text-xs opacity-50 mt-1">
                        Duration: {course.estimatedDuration || 'N/A'} | 
                        Type: {course.courseType || 'SCORM'}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-action">
          <button 
            className="btn"
            onClick={onClose}
            data-testid="button-cancel-assign-courses"
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={assignCoursesMutation.isPending || selectedCourses.length === 0}
            data-testid="button-confirm-assign-courses"
          >
            {assignCoursesMutation.isPending ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              `Assign ${selectedCourses.length} Course${selectedCourses.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
