import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organisationId?: string;
  status: string;
  lastActive?: string;
  jobTitle?: string;
  department?: string;
  allowCertificateDownload: boolean;
}

interface Organisation {
  id: string;
  displayName: string;
}

export function SuperAdminUsers() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    role: "",
    organisationId: "",
    status: "",
    search: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "user",
    organisationId: "",
    jobTitle: "",
    department: "",
    allowCertificateDownload: false,
    status: "active",
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users', filters],
  });

  const { data: organisations = [] } = useQuery<Organisation[]>({
    queryKey: ['/api/organisations'],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowCreateModal(false);
      resetForm();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
      organisationId: "",
      jobTitle: "",
      department: "",
      allowCertificateDownload: false,
      status: "active",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(formData);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const [generatedPassword] = useState(generatePassword());

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Users</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Users</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          data-testid="button-create-user"
        >
          <i className="fas fa-user-plus"></i> Create User
        </button>
      </div>

      {/* Filters */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Role</span>
              </label>
              <select 
                className="select select-bordered"
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                data-testid="select-filter-role"
              >
                <option value="">All Roles</option>
                <option value="superadmin">SuperAdmin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Organisation</span>
              </label>
              <select 
                className="select select-bordered"
                value={filters.organisationId}
                onChange={(e) => setFilters(prev => ({ ...prev, organisationId: e.target.value }))}
                data-testid="select-filter-organisation"
              >
                <option value="">All Organisations</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>{org.displayName}</option>
                ))}
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select 
                className="select select-bordered"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                data-testid="select-filter-status"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            
            <div className="form-control md:col-span-2">
              <label className="label">
                <span className="label-text">Search</span>
              </label>
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                className="input input-bordered"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                data-testid="input-search-users"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Organisation</th>
                  <th>Status</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      <span className="loading loading-spinner loading-md"></span>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/60">
                      No users found with current filters.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} data-testid={`row-user-${user.id}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-8">
                              <span className="text-xs">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="font-bold" data-testid={`text-user-name-${user.id}`}>
                              {user.firstName} {user.lastName}
                            </div>
                            {user.jobTitle && (
                              <div className="text-sm opacity-50" data-testid={`text-user-job-${user.id}`}>
                                {user.jobTitle}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-testid={`text-user-email-${user.id}`}>{user.email}</td>
                      <td>
                        <div className={`badge ${
                          user.role === 'superadmin' ? 'badge-primary' :
                          user.role === 'admin' ? 'badge-secondary' : 'badge-accent'
                        }`} data-testid={`badge-user-role-${user.id}`}>
                          {user.role}
                        </div>
                      </td>
                      <td data-testid={`text-user-org-${user.id}`}>
                        {organisations.find(o => o.id === user.organisationId)?.displayName || 'Platform'}
                      </td>
                      <td>
                        <div className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-error'}`} data-testid={`badge-user-status-${user.id}`}>
                          {user.status}
                        </div>
                      </td>
                      <td data-testid={`text-user-last-active-${user.id}`}>
                        {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button 
                            className="btn btn-sm btn-ghost"
                            data-testid={`button-view-user-${user.id}`}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-ghost"
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-error"
                            data-testid={`button-deactivate-user-${user.id}`}
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

      {/* Create User Modal */}
      {showCreateModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-create-user-title">Create New User</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">First Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="John" 
                    className="input input-bordered" 
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required 
                    data-testid="input-user-first-name"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Last Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Doe" 
                    className="input input-bordered" 
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required 
                    data-testid="input-user-last-name"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Email Address *</span>
                </label>
                <input 
                  type="email" 
                  placeholder="john.doe@company.com" 
                  className="input input-bordered" 
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required 
                  data-testid="input-user-email"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Role *</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    data-testid="select-user-role"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Organisation</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={formData.organisationId}
                    onChange={(e) => setFormData(prev => ({ ...prev, organisationId: e.target.value }))}
                    data-testid="select-user-organisation"
                  >
                    <option value="">No Organisation (Platform)</option>
                    {organisations.map((org) => (
                      <option key={org.id} value={org.id}>{org.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Job Title</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Software Developer" 
                    className="input input-bordered" 
                    value={formData.jobTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                    data-testid="input-user-job-title"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Department</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Engineering" 
                    className="input input-bordered" 
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    data-testid="input-user-department"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary" 
                    checked={formData.allowCertificateDownload}
                    onChange={(e) => setFormData(prev => ({ ...prev, allowCertificateDownload: e.target.checked }))}
                    data-testid="checkbox-allow-cert-download"
                  />
                  <span className="label-text">Allow certificate download</span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Initial Password</span>
                </label>
                <div className="join">
                  <input 
                    type="text" 
                    value={generatedPassword} 
                    className="input input-bordered join-item flex-1" 
                    readOnly 
                    data-testid="input-generated-password"
                  />
                  <button 
                    type="button" 
                    className="btn join-item"
                    onClick={() => navigator.clipboard.writeText(generatedPassword)}
                    data-testid="button-copy-password"
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <div className="modal-action">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-create-user"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createUserMutation.isPending}
                  data-testid="button-submit-create-user"
                >
                  {createUserMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Create User'
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
    </div>
  );
}
