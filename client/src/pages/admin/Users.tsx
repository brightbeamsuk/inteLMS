import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

export function AdminUsers() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Form states
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    department: "",
    allowCertificateDownload: false,
    status: "active",
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/users', {
        ...data,
        role: 'user',
        organisationId: currentUser?.organisationId,
      });
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

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      return await apiRequest('PATCH', `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('DELETE', `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowDeleteModal(false);
      setSelectedUser(null);
      setDeleteConfirmText("");
      toast({
        title: "Success",
        description: "User removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
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

  const handleToggleUserStatus = (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    updateUserStatusMutation.mutate({ userId: user.id, status: newStatus });
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
    setDeleteConfirmText("");
  };

  const confirmDeleteUser = () => {
    if (!selectedUser) return;
    
    const expectedText = `${selectedUser.firstName} ${selectedUser.lastName}`;
    if (deleteConfirmText.trim() !== expectedText) {
      toast({
        title: "Confirmation Error",
        description: `Please type the user's full name exactly: ${expectedText}`,
        variant: "destructive",
      });
      return;
    }

    deleteUserMutation.mutate(selectedUser.id);
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Users</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Manage Users</h1>
        <div className="flex gap-2">
          <button 
            className="btn btn-outline"
            data-testid="button-bulk-import"
          >
            <i className="fas fa-upload"></i> Import CSV
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            data-testid="button-add-user"
          >
            <i className="fas fa-user-plus"></i> Add User
          </button>
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
                  <th>Job Title</th>
                  <th>Status</th>
                  <th>Certificates</th>
                  <th>Last Active</th>
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
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/60">
                      No users found. Add your first user to get started.
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
                            {user.department && (
                              <div className="text-sm opacity-50" data-testid={`text-user-dept-${user.id}`}>
                                {user.department}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-testid={`text-user-email-${user.id}`}>{user.email}</td>
                      <td data-testid={`text-user-job-${user.id}`}>{user.jobTitle || 'Not specified'}</td>
                      <td>
                        <div className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-error'}`} data-testid={`badge-user-status-${user.id}`}>
                          {user.status}
                        </div>
                      </td>
                      <td>
                        <div className={`badge ${user.allowCertificateDownload ? 'badge-primary' : 'badge-ghost'}`} data-testid={`badge-cert-download-${user.id}`}>
                          {user.allowCertificateDownload ? 'Allowed' : 'Restricted'}
                        </div>
                      </td>
                      <td data-testid={`text-user-last-active-${user.id}`}>
                        {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button 
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                              setActiveTab(0);
                            }}
                            data-testid={`button-view-user-${user.id}`}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className={`btn btn-sm ${user.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={updateUserStatusMutation.isPending}
                            data-testid={`button-toggle-status-user-${user.id}`}
                          >
                            {updateUserStatusMutation.isPending ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              <i className={`fas ${user.status === 'active' ? 'fa-ban' : 'fa-check'}`}></i>
                            )}
                          </button>
                          <button 
                            className="btn btn-sm btn-error"
                            onClick={() => handleDeleteUser(user)}
                            data-testid={`button-remove-user-${user.id}`}
                          >
                            <i className="fas fa-trash"></i>
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
            <h3 className="font-bold text-lg mb-4" data-testid="text-add-user-title">Add New User</h3>
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
                  data-testid="button-cancel-add-user"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createUserMutation.isPending}
                  data-testid="button-submit-add-user"
                >
                  {createUserMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Add User'
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

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-user-details-title">
              {selectedUser.firstName} {selectedUser.lastName}
            </h3>
            
            <div className="tabs tabs-bordered mb-4">
              <a className={`tab ${activeTab === 0 ? 'tab-active' : ''}`} onClick={() => setActiveTab(0)} data-testid="tab-overview">Overview</a>
              <a className={`tab ${activeTab === 1 ? 'tab-active' : ''}`} onClick={() => setActiveTab(1)} data-testid="tab-courses">Courses</a>
              <a className={`tab ${activeTab === 2 ? 'tab-active' : ''}`} onClick={() => setActiveTab(2)} data-testid="tab-certificates">Certificates</a>
              <a className={`tab ${activeTab === 3 ? 'tab-active' : ''}`} onClick={() => setActiveTab(3)} data-testid="tab-history">History</a>
            </div>

            {activeTab === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <div className="text-base-content" data-testid="text-overview-email">{selectedUser.email}</div>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Job Title</span>
                    </label>
                    <div className="text-base-content" data-testid="text-overview-job">{selectedUser.jobTitle || 'Not specified'}</div>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Department</span>
                    </label>
                    <div className="text-base-content" data-testid="text-overview-dept">{selectedUser.department || 'Not specified'}</div>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Certificate Download</span>
                    </label>
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input 
                          type="checkbox" 
                          className="toggle toggle-primary" 
                          checked={selectedUser.allowCertificateDownload}
                          data-testid="toggle-cert-download"
                        />
                        <span className="label-text">Allowed</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="stats shadow">
                  <div className="stat">
                    <div className="stat-title">Assigned Courses</div>
                    <div className="stat-value text-primary" data-testid="stat-assigned-courses">12</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Completed</div>
                    <div className="stat-value text-success" data-testid="stat-completed-courses">8</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Average Score</div>
                    <div className="stat-value text-secondary" data-testid="stat-avg-score">87%</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 1 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Assigned Courses</h4>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>GDPR Compliance Training</td>
                        <td><div className="badge badge-success">Completed</div></td>
                        <td>Jan 15, 2024</td>
                        <td>92%</td>
                        <td>
                          <button className="btn btn-xs btn-ghost" data-testid="button-preview-course">
                            <i className="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Certificates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card bg-base-100 shadow-sm">
                    <div className="card-body">
                      <h5 className="card-title text-sm">GDPR Compliance Training</h5>
                      <div className="text-xs text-base-content/60">
                        <div>Score: 92%</div>
                        <div>Issued: Jan 15, 2024</div>
                      </div>
                      <div className="card-actions justify-end">
                        <button className="btn btn-xs btn-primary" data-testid="button-view-certificate">View</button>
                        <button className="btn btn-xs btn-outline" data-testid="button-download-certificate">Download</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Activity History</h4>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-point bg-success"></div>
                    <div className="timeline-content">
                      <div className="timeline-time text-sm text-base-content/60">Jan 15, 2024</div>
                      <div className="timeline-title">Completed GDPR Training</div>
                      <div className="timeline-description text-sm">Score: 92%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => setShowUserModal(false)}
                data-testid="button-close-user-details"
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowUserModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-delete-user-title">Remove User</h3>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <h4 className="font-bold">Warning!</h4>
                <div className="text-sm">This action cannot be undone. This will permanently remove the user from your organisation.</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-semibold">User to remove:</label>
                <div className="text-lg" data-testid="text-delete-user-name">
                  {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    To confirm removal, please type the user's full name: <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>
                  </span>
                </label>
                <input 
                  type="text"
                  className="input input-bordered"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={`${selectedUser.firstName} ${selectedUser.lastName}`}
                  data-testid="input-delete-confirm-text"
                />
              </div>
            </div>

            <div className="modal-action">
              <button 
                type="button" 
                className="btn" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                  setDeleteConfirmText("");
                }}
                data-testid="button-cancel-remove-user"
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-error"
                onClick={confirmDeleteUser}
                disabled={deleteUserMutation.isPending || deleteConfirmText.trim() !== `${selectedUser.firstName} ${selectedUser.lastName}`}
                data-testid="button-confirm-remove-user"
              >
                {deleteUserMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Remove User'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => {
              setShowDeleteModal(false);
              setSelectedUser(null);
              setDeleteConfirmText("");
            }}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
