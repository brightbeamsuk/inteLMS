import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { LicenseLimitModal } from "@/components/LicenseLimitModal";

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
  profileImageUrl?: string;
}

interface LicenseInfo {
  currentActiveUsers: number;
  maxActiveUsers: number;
  availableLicenses: number;
  isAtLimit: boolean;
  hasActiveSubscription: boolean;
  organisationName: string;
}

interface Assignment {
  id: string;
  courseId: string;
  userId: string;
  organisationId: string;
  status: string;
  dueDate?: string;
  assignedBy: string;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  notificationsEnabled: boolean;
  courseTitle?: string;
  courseDescription?: string;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  estimatedDuration: number;
  passmark: number;
  status: string;
  organisationId: string;
}

export function AdminUsers() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [showAssignCoursesModal, setShowAssignCoursesModal] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkActionValue, setBulkActionValue] = useState("");
  const [showLicenseLimitModal, setShowLicenseLimitModal] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState(false);
  const [duplicateCourses, setDuplicateCourses] = useState<Course[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // License info query
  const { data: licenseData } = useQuery<LicenseInfo>({
    queryKey: ['/api/admin/license-check'],
    enabled: !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

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

  // Edit form states
  const [editFormData, setEditFormData] = useState({
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

  // Fetch user assignments for the selected user
  const { data: userAssignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments/user', selectedUser?.id],
    enabled: !!selectedUser?.id && showUserModal,
  });

  // Fetch available courses
  const { data: availableCourses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
    enabled: showAssignCoursesModal,
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/license-check'] });
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      return await apiRequest('PUT', `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user",
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/license-check'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/license-check'] });
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

  const importUsersMutation = useMutation({
    mutationFn: async (users: any[]) => {
      return await apiRequest('POST', '/api/users/bulk-import', {
        users: users.map(user => ({
          ...user,
          role: 'user',
          organisationId: currentUser?.organisationId,
        }))
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/license-check'] });
      setShowImportModal(false);
      setCsvFile(null);
      setCsvPreview([]);
      toast({
        title: "Success",
        description: `Successfully imported ${data.created} users`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import users",
        variant: "destructive",
      });
    },
  });

  // Assign courses mutation  
  const assignCoursesMutation = useMutation({
    mutationFn: async (data: { userId: string; courseIds: string[] }) => {
      const assignments = [];
      const duplicates = [];
      const errors = [];
      
      for (const courseId of data.courseIds) {
        try {
          const assignment = await apiRequest('POST', '/api/assignments', {
            courseId,
            userId: data.userId,
            organisationId: currentUser?.organisationId,
            assignedBy: currentUser?.id,
            status: 'not_started',
            dueDate: null,
            notificationsEnabled: true
          });
          assignments.push(assignment);
        } catch (error: any) {
          if (error.error === 'DUPLICATE_ASSIGNMENT') {
            duplicates.push({
              courseId,
              message: error.message
            });
          } else {
            errors.push({
              courseId,
              message: error.message || 'Failed to assign course'
            });
          }
        }
      }
      
      return { assignments, duplicates, errors };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments/user', selectedUser?.id] });
      setShowAssignCoursesModal(false);
      setSelectedCourseIds([]);
      
      const { assignments, duplicates, errors } = result;
      
      // Show success message for successful assignments
      if (assignments.length > 0) {
        toast({
          title: "Success",
          description: `Successfully assigned ${assignments.length} course(s)`,
        });
      }
      
      // Show warning for duplicates
      if (duplicates.length > 0) {
        toast({
          title: "Duplicate Assignments Detected",
          description: `${duplicates.length} course(s) were already assigned to this user`,
          variant: "destructive",
        });
      }
      
      // Show error for other failures
      if (errors.length > 0) {
        toast({
          title: "Assignment Errors",
          description: `Failed to assign ${errors.length} course(s)`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign courses",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateUsersMutation = useMutation({
    mutationFn: async ({ userIds, action, value }: { userIds: string[]; action: string; value: any }) => {
      return await apiRequest('PATCH', '/api/users/bulk', {
        userIds,
        action,
        value
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/license-check'] });
      setShowBulkActionsModal(false);
      setSelectedUserIds([]);
      setBulkAction("");
      setBulkActionValue("");
      toast({
        title: "Success",
        description: "Users updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update users",
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

  const resetEditForm = () => {
    setEditFormData({
      email: "",
      firstName: "",
      lastName: "",
      jobTitle: "",
      department: "",
      allowCertificateDownload: false,
      status: "active",
    });
  };

  // Check for duplicate course assignments
  const checkForDuplicates = () => {
    if (!selectedUser || selectedCourseIds.length === 0) return;

    // Find courses that are already assigned to the user
    const alreadyAssignedCourseIds = userAssignments.map(assignment => assignment.courseId);
    const duplicatesCourseIds = selectedCourseIds.filter(courseId => 
      alreadyAssignedCourseIds.includes(courseId)
    );

    if (duplicatesCourseIds.length > 0) {
      // Get course details for the duplicates
      const duplicateCoursesData = availableCourses.filter(course => 
        duplicatesCourseIds.includes(course.id)
      );
      setDuplicateCourses(duplicateCoursesData);
      setShowDuplicateWarningModal(true);
      
      // Also assign the non-duplicate courses if any
      const nonDuplicateCourseIds = selectedCourseIds.filter(courseId => 
        !alreadyAssignedCourseIds.includes(courseId)
      );
      
      if (nonDuplicateCourseIds.length > 0) {
        assignCoursesMutation.mutate({
          userId: selectedUser.id,
          courseIds: nonDuplicateCourseIds
        });
      }
    } else {
      // No duplicates, proceed with assignment
      assignCoursesMutation.mutate({
        userId: selectedUser.id,
        courseIds: selectedCourseIds
      });
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle || "",
      department: user.department || "",
      allowCertificateDownload: user.allowCertificateDownload,
      status: user.status,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUserMutation.mutate({
        userId: selectedUser.id,
        data: editFormData
      });
      setShowEditModal(false);
      resetEditForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check license availability if creating an active user
    if (formData.status === 'active') {
      const hasAvailableLicense = await checkLicenseAvailability(1);
      if (!hasAvailableLicense) {
        setPendingAction(() => () => createUserMutation.mutate(formData));
        return;
      }
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

  // License check function
  const checkLicenseAvailability = async (additionalUsersNeeded: number = 1): Promise<boolean> => {
    try {
      const response = await apiRequest('GET', '/api/admin/license-check');
      const licenseData: LicenseInfo = await response.json();
      
      if (licenseData.availableLicenses < additionalUsersNeeded) {
        setLicenseInfo(licenseData);
        setShowLicenseLimitModal(true);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking license availability:', error);
      toast({
        title: "Error",
        description: "Failed to check license availability",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    
    // Check license availability if activating a user
    if (newStatus === 'active') {
      const hasAvailableLicense = await checkLicenseAvailability(1);
      if (!hasAvailableLicense) {
        setPendingAction(() => () => updateUserStatusMutation.mutate({ userId: user.id, status: newStatus }));
        return;
      }
    }

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

  const handleCsvFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);
    
    // Parse CSV for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const expectedHeaders = ['firstName', 'lastName', 'email', 'jobTitle', 'department', 'allowCertificateDownload'];
      const hasValidHeaders = expectedHeaders.every(header => headers.includes(header));
      
      if (!hasValidHeaders) {
        toast({
          title: "Invalid CSV Format",
          description: "CSV must have columns: firstName, lastName, email, jobTitle, department, allowCertificateDownload",
          variant: "destructive",
        });
        setCsvFile(null);
        return;
      }
      
      const preview = lines.slice(1, 6) // Show first 5 rows
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });
      
      setCsvPreview(preview);
    };
    
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvFile) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const users = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            let value = values[index] || '';
            if (header === 'allowCertificateDownload') {
              obj[header] = value.toLowerCase() === 'true';
            } else {
              obj[header] = value;
            }
          });
          return obj;
        })
        .filter(user => user.email && user.firstName && user.lastName);
      
      if (users.length === 0) {
        toast({
          title: "No Valid Users",
          description: "No valid users found in CSV file",
          variant: "destructive",
        });
        return;
      }

      // Count how many active users will be imported (default to active)
      const activeUsersToImport = users.filter(user => !user.status || user.status === 'active').length;
      
      if (activeUsersToImport > 0) {
        const hasAvailableLicense = await checkLicenseAvailability(activeUsersToImport);
        if (!hasAvailableLicense) {
          setPendingAction(() => () => importUsersMutation.mutate(users));
          return;
        }
      }
      
      importUsersMutation.mutate(users);
    };
    
    reader.readAsText(csvFile);
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
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Manage Users</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="text-page-description">
            Manage regular user accounts in your organization
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            className="btn btn-outline"
            onClick={() => setShowImportModal(true)}
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

      {/* License Usage Display */}
      {licenseData && (
        <div className="bg-base-200 shadow-sm rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <i className="fas fa-users text-primary text-xl"></i>
                <div>
                  <h3 className="font-semibold text-base" data-testid="text-license-title">
                    Active License Usage
                  </h3>
                  <p className="text-sm text-base-content/70" data-testid="text-license-organization">
                    {licenseData.organisationName}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-current-active">
                  {licenseData.currentActiveUsers}
                </div>
                <div className="text-xs text-base-content/60">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="text-max-users">
                  {licenseData.maxActiveUsers}
                </div>
                <div className="text-xs text-base-content/60">Total Licenses</div>
              </div>
              <div className="text-center">
                <div 
                  className={`text-2xl font-bold ${
                    licenseData.availableLicenses <= 0 
                      ? 'text-error' 
                      : licenseData.availableLicenses <= 2 
                        ? 'text-warning' 
                        : 'text-success'
                  }`}
                  data-testid="text-available-licenses"
                >
                  {licenseData.availableLicenses}
                </div>
                <div className="text-xs text-base-content/60">Available</div>
              </div>
              {!licenseData.hasActiveSubscription && (
                <div className="badge badge-warning">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Free Tier
                </div>
              )}
              {licenseData.isAtLimit && (
                <div className="badge badge-error">
                  <i className="fas fa-ban mr-1"></i>
                  At Limit
                </div>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-base-300 rounded-full h-2 mt-3">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                licenseData.currentActiveUsers >= licenseData.maxActiveUsers 
                  ? 'bg-error' 
                  : licenseData.currentActiveUsers / licenseData.maxActiveUsers > 0.8 
                    ? 'bg-warning' 
                    : 'bg-success'
              }`}
              style={{ 
                width: `${Math.min(100, (licenseData.currentActiveUsers / licenseData.maxActiveUsers) * 100)}%` 
              }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-base-content/60 mt-1">
            <span>0</span>
            <span>{licenseData.maxActiveUsers} max licenses</span>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedUserIds.length > 0 && (
        <div className="bg-base-300 p-4 rounded-lg mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold" data-testid="text-selected-count">
              {selectedUserIds.length} user(s) selected
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedUserIds([])}
              data-testid="button-clear-selection"
            >
              Clear Selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={async () => {
                // Check if we're potentially activating users
                const inactiveSelectedUsers = users.filter(u => 
                  selectedUserIds.includes(u.id) && u.status !== 'active'
                ).length;

                if (inactiveSelectedUsers > 0) {
                  const hasAvailableLicense = await checkLicenseAvailability(inactiveSelectedUsers);
                  if (!hasAvailableLicense) {
                    setPendingAction(() => () => {
                      setBulkAction("status");
                      setShowBulkActionsModal(true);
                    });
                    return;
                  }
                }

                setBulkAction("status");
                setShowBulkActionsModal(true);
              }}
              data-testid="button-bulk-change-status"
            >
              <i className="fas fa-user-check"></i> Change Status
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setBulkAction("certificates");
                setShowBulkActionsModal(true);
              }}
              data-testid="button-bulk-certificates"
            >
              <i className="fas fa-certificate"></i> Allow Certificates
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setBulkAction("archive");
                setShowBulkActionsModal(true);
              }}
              data-testid="button-bulk-archive"
            >
              <i className="fas fa-archive"></i> Archive
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>
                    <label>
                      <input 
                        type="checkbox" 
                        className="checkbox"
                        checked={users.length > 0 && selectedUserIds.length === users.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds(users.map(user => user.id));
                          } else {
                            setSelectedUserIds([]);
                          }
                        }}
                        data-testid="checkbox-select-all-users"
                      />
                    </label>
                  </th>
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
                    <td colSpan={8} className="text-center">
                      <span className="loading loading-spinner loading-md"></span>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-base-content/60">
                      No users found. Add your first user to get started.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} data-testid={`row-user-${user.id}`}>
                      <td>
                        <label>
                          <input 
                            type="checkbox" 
                            className="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, user.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                              }
                            }}
                            data-testid={`checkbox-user-${user.id}`}
                          />
                        </label>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-8 h-8 rounded-full">
                              {user.profileImageUrl ? (
                                <img 
                                  src={user.profileImageUrl} 
                                  alt="Profile" 
                                  className="w-full h-full object-cover rounded-full"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`bg-neutral text-neutral-content rounded-full w-8 h-8 flex items-center justify-center ${user.profileImageUrl ? 'hidden' : ''}`}>
                                <span className="text-xs">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </span>
                              </div>
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
                    className={`checkbox ${formData.allowCertificateDownload ? 'checkbox-success [--chkbg:#22c55e] checked:bg-green-500' : '[--chkbg:#9ca3af] bg-gray-400 border-gray-400'}`}
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

      {/* CSV Import Modal */}
      {showImportModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-import-title">Import Users from CSV</h3>
            
            <div className="space-y-6">
              {/* File Upload */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Select CSV File</span>
                </label>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCsvFileSelect}
                  className="file-input file-input-bordered w-full" 
                  data-testid="input-csv-file"
                />
                <div className="label">
                  <span className="label-text-alt">
                    CSV must contain columns: firstName, lastName, email, jobTitle, department, allowCertificateDownload
                  </span>
                </div>
              </div>

              {/* Format Example */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h4 className="card-title text-sm">CSV Format Example:</h4>
                  <div className="mockup-code text-xs">
                    <pre data-prefix="1"><code>firstName,lastName,email,jobTitle,department,allowCertificateDownload</code></pre>
                    <pre data-prefix="2"><code>John,Doe,john@company.com,Developer,IT,true</code></pre>
                    <pre data-prefix="3"><code>Jane,Smith,jane@company.com,Manager,HR,false</code></pre>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body">
                    <h4 className="card-title text-sm">Preview (first 5 rows):</h4>
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Email</th>
                            <th>Job Title</th>
                            <th>Department</th>
                            <th>Certificates</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((user, index) => (
                            <tr key={index}>
                              <td>{user.firstName}</td>
                              <td>{user.lastName}</td>
                              <td>{user.email}</td>
                              <td>{user.jobTitle || 'N/A'}</td>
                              <td>{user.department || 'N/A'}</td>
                              <td>
                                <div className={`badge ${user.allowCertificateDownload === 'true' ? 'badge-success' : 'badge-ghost'} badge-sm`}>
                                  {user.allowCertificateDownload === 'true' ? 'Allowed' : 'Restricted'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button 
                type="button" 
                className="btn" 
                onClick={() => {
                  setShowImportModal(false);
                  setCsvFile(null);
                  setCsvPreview([]);
                }}
                data-testid="button-cancel-import"
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleImportCsv}
                disabled={!csvFile || importUsersMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importUsersMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <i className="fas fa-upload"></i>
                    Import Users
                  </>
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowImportModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xl" data-testid="text-user-details-title">
                  {selectedUser.firstName} {selectedUser.lastName}
                </h3>
                <div className="flex items-center gap-2">
                  <div className={`badge ${selectedUser.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                    {selectedUser.status === 'active' ? 'Active' : 'Inactive'}
                  </div>
                  <div className="badge badge-primary">
                    {selectedUser.role?.charAt(0).toUpperCase() + selectedUser.role?.slice(1)}
                  </div>
                </div>
              </div>
              <div className="text-sm text-base-content/70 space-y-1">
                <div data-testid="text-user-email">{selectedUser.email}</div>
                <div className="flex items-center gap-4">
                  {selectedUser.jobTitle && (
                    <span><i className="fas fa-briefcase w-4"></i> {selectedUser.jobTitle}</span>
                  )}
                  {selectedUser.department && (
                    <span><i className="fas fa-building w-4"></i> {selectedUser.department}</span>
                  )}
                  {selectedUser.lastActive && (
                    <span><i className="fas fa-clock w-4"></i> Last active: {new Date(selectedUser.lastActive).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            
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
                          className="toggle"
                          checked={selectedUser.allowCertificateDownload}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            updateUserMutation.mutate({
                              userId: selectedUser.id,
                              data: { allowCertificateDownload: newValue }
                            });
                            // Optimistically update the local state
                            setSelectedUser(prev => prev ? { ...prev, allowCertificateDownload: newValue } : null);
                          }}
                          disabled={updateUserMutation.isPending}
                          data-testid="toggle-cert-download"
                          style={{
                            '--tglbg': selectedUser.allowCertificateDownload ? '#4ade80' : '#d1d5db',
                            backgroundColor: selectedUser.allowCertificateDownload ? '#4ade80' : '#d1d5db',
                          } as React.CSSProperties}
                        />
                        <span className="label-text">Allowed</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="stats shadow">
                  <div className="stat">
                    <div className="stat-title">Status</div>
                    <div className="stat-value text-base-content" data-testid="stat-user-status">
                      {selectedUser.status === 'active' ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Role</div>
                    <div className="stat-value text-base-content" data-testid="stat-user-role">
                      {selectedUser.role?.charAt(0).toUpperCase() + selectedUser.role?.slice(1)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Last Active</div>
                    <div className="stat-value text-base-content" data-testid="stat-last-active">
                      {selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Course Assignments</h4>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => setShowAssignCoursesModal(true)}
                    data-testid="button-assign-courses"
                  >
                    <i className="fas fa-plus"></i>
                    Assign Courses
                  </button>
                </div>
                
                {assignmentsLoading ? (
                  <div className="text-center py-8">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                ) : userAssignments.length === 0 ? (
                  <div className="text-center py-8 text-base-content/60">
                    <i className="fas fa-graduation-cap text-4xl mb-4 opacity-50"></i>
                    <p>No course assignments found for this user.</p>
                    <p className="text-sm">Click "Assign Courses" to add course assignments.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr>
                          <th>Course</th>
                          <th>Status</th>
                          <th>Due Date</th>
                          <th>Assigned Date</th>
                          <th>Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userAssignments.map((assignment: any) => (
                          <tr key={assignment.id}>
                            <td>
                              <div className="font-semibold" data-testid={`text-assignment-course-${assignment.id}`}>
                                {assignment.courseTitle || assignment.courseId}
                              </div>
                            </td>
                            <td>
                              <div className={`badge ${
                                assignment.status === 'completed' ? 'badge-success' : 
                                assignment.status === 'in_progress' ? 'badge-warning' : 
                                'badge-ghost'
                              }`} data-testid={`badge-assignment-status-${assignment.id}`}>
                                {assignment.status.replace('_', ' ').toLowerCase()}
                              </div>
                            </td>
                            <td data-testid={`text-assignment-due-${assignment.id}`}>
                              {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-GB') : 'No due date'}
                            </td>
                            <td data-testid={`text-assignment-assigned-${assignment.id}`}>
                              {new Date(assignment.assignedAt).toLocaleDateString('en-GB')}
                            </td>
                            <td>
                              <div className="text-sm text-base-content/70" data-testid={`text-assignment-progress-${assignment.id}`}>
                                {assignment.status === 'completed' ? 'Complete' : 
                                 assignment.status === 'in_progress' ? 'In Progress' : 
                                 'Not Started'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Certificates</h4>
                <div className="text-center py-8 text-base-content/60">
                  <i className="fas fa-certificate text-4xl mb-4 opacity-50"></i>
                  <p>No certificates earned yet.</p>
                  <p className="text-sm">Certificates will appear here when the user completes courses.</p>
                  <div className="mt-4">
                    <div className={`badge ${selectedUser.allowCertificateDownload ? 'badge-success' : 'badge-warning'}`}>
                      Certificate downloads {selectedUser.allowCertificateDownload ? 'enabled' : 'disabled'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-4">
                <h4 className="font-semibold">User Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card bg-base-100 shadow-sm">
                    <div className="card-body">
                      <h5 className="card-title text-sm">Account Details</h5>
                      <div className="space-y-2 text-sm">
                        <div><strong>User ID:</strong> {selectedUser.id}</div>
                        <div><strong>Email:</strong> {selectedUser.email}</div>
                        <div><strong>Status:</strong> 
                          <div className={`badge badge-sm ml-2 ${selectedUser.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                            {selectedUser.status}
                          </div>
                        </div>
                        <div><strong>Role:</strong> 
                          <div className="badge badge-sm badge-primary ml-2">
                            {selectedUser.role}
                          </div>
                        </div>
                        <div><strong>Organization ID:</strong> {selectedUser.organisationId || 'Not assigned'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card bg-base-100 shadow-sm">
                    <div className="card-body">
                      <h5 className="card-title text-sm">Profile Information</h5>
                      <div className="space-y-2 text-sm">
                        <div><strong>Job Title:</strong> {selectedUser.jobTitle || 'Not specified'}</div>
                        <div><strong>Department:</strong> {selectedUser.department || 'Not specified'}</div>
                        <div><strong>Certificate Downloads:</strong> 
                          <div className={`badge badge-sm ml-2 ${selectedUser.allowCertificateDownload ? 'badge-success' : 'badge-warning'}`}>
                            {selectedUser.allowCertificateDownload ? 'Enabled' : 'Disabled'}
                          </div>
                        </div>
                        <div><strong>Last Active:</strong> {selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleDateString() : 'Never'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowUserModal(false);
                  if (selectedUser) openEditModal(selectedUser);
                }}
                data-testid="button-edit-user"
              >
                <i className="fas fa-edit"></i>
                Edit User
              </button>
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

      {/* Assign Courses Modal */}
      {showAssignCoursesModal && selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-assign-courses-title">
              Assign Courses to {selectedUser.firstName} {selectedUser.lastName}
            </h3>
            
            {coursesLoading ? (
              <div className="text-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-base-content/70 mb-4">
                  Select the courses you want to assign to this user:
                </p>
                
                {availableCourses.length === 0 ? (
                  <div className="text-center py-8 text-base-content/60">
                    <i className="fas fa-book text-4xl mb-4 opacity-50"></i>
                    <p>No courses available for assignment.</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {availableCourses.map((course: any) => (
                      <div key={course.id} className="form-control">
                        <label className="cursor-pointer label justify-start space-x-3">
                          <input 
                            type="checkbox" 
                            className="checkbox checkbox-primary" 
                            checked={selectedCourseIds.includes(course.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCourseIds([...selectedCourseIds, course.id]);
                              } else {
                                setSelectedCourseIds(selectedCourseIds.filter(id => id !== course.id));
                              }
                            }}
                            data-testid={`checkbox-course-${course.id}`}
                          />
                          <div className="flex-1">
                            <span className="label-text font-medium" data-testid={`text-course-title-${course.id}`}>
                              {course.title}
                            </span>
                            {course.description && (
                              <p className="text-sm text-base-content/70 mt-1">
                                {course.description}
                              </p>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowAssignCoursesModal(false);
                  setSelectedCourseIds([]);
                }}
                data-testid="button-assign-cancel"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-primary ${assignCoursesMutation.isPending ? 'loading' : ''}`}
                onClick={() => {
                  if (selectedCourseIds.length > 0 && selectedUser) {
                    checkForDuplicates();
                  }
                }}
                disabled={selectedCourseIds.length === 0 || assignCoursesMutation.isPending}
                data-testid="button-assign-confirm"
              >
                {assignCoursesMutation.isPending ? 'Assigning...' : `Assign ${selectedCourseIds.length} Course(s)`}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Duplicate Assignment Warning Modal */}
      {showDuplicateWarningModal && selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4 text-warning" data-testid="text-duplicate-warning-title">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              Duplicate Course Assignment
            </h3>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-info-circle"></i>
              <div>
                <h4 className="font-bold">Courses Already Assigned</h4>
                <div className="text-sm">
                  The following course(s) are already assigned to {selectedUser.firstName} {selectedUser.lastName} and cannot be assigned again.
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <p className="font-medium">Duplicate courses:</p>
              <ul className="list-disc list-inside space-y-1 pl-4">
                {duplicateCourses.map((course) => (
                  <li key={course.id} className="text-sm" data-testid={`duplicate-course-${course.id}`}>
                    {course.title}
                  </li>
                ))}
              </ul>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowDuplicateWarningModal(false);
                  setDuplicateCourses([]);
                }}
                data-testid="button-duplicate-warning-ok"
              >
                OK
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => {
            setShowDuplicateWarningModal(false);
            setDuplicateCourses([]);
          }}></div>
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

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-edit-user-title">Edit User</h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">First Name <span className="text-error">*</span></span>
                  </label>
                  <input 
                    type="text"
                    className="input input-bordered"
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                    required
                    data-testid="input-edit-first-name"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Last Name <span className="text-error">*</span></span>
                  </label>
                  <input 
                    type="text"
                    className="input input-bordered"
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                    required
                    data-testid="input-edit-last-name"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Email <span className="text-error">*</span></span>
                </label>
                <input 
                  type="email"
                  className="input input-bordered"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  required
                  data-testid="input-edit-email"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Job Title</span>
                  </label>
                  <input 
                    type="text"
                    className="input input-bordered"
                    value={editFormData.jobTitle}
                    onChange={(e) => setEditFormData({...editFormData, jobTitle: e.target.value})}
                    data-testid="input-edit-job-title"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Department</span>
                  </label>
                  <input 
                    type="text"
                    className="input input-bordered"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({...editFormData, department: e.target.value})}
                    data-testid="input-edit-department"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  data-testid="select-edit-status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="toggle"
                    checked={editFormData.allowCertificateDownload}
                    onChange={(e) => setEditFormData({...editFormData, allowCertificateDownload: e.target.checked})}
                    data-testid="toggle-edit-cert-download"
                    style={{
                      '--tglbg': editFormData.allowCertificateDownload ? '#4ade80' : '#d1d5db',
                      backgroundColor: editFormData.allowCertificateDownload ? '#4ade80' : '#d1d5db',
                    } as React.CSSProperties}
                  />
                  <span className="label-text">Allow Certificate Downloads</span>
                </label>
              </div>

              <div className="modal-action">
                <button 
                  type="button" 
                  className="btn"
                  onClick={() => {
                    setShowEditModal(false);
                    resetEditForm();
                  }}
                  data-testid="button-cancel-edit-user"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={updateUserMutation.isPending || !editFormData.email || !editFormData.firstName || !editFormData.lastName}
                  data-testid="button-save-edit-user"
                >
                  {updateUserMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => {
              setShowEditModal(false);
              resetEditForm();
            }}>close</button>
          </form>
        </dialog>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActionsModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-bulk-action-title">
              Bulk Action: {selectedUserIds.length} user(s) selected
            </h3>
            
            {bulkAction === "status" && (
              <div className="space-y-4">
                <p>Change status for selected users:</p>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">New Status</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={bulkActionValue}
                    onChange={(e) => setBulkActionValue(e.target.value)}
                    data-testid="select-bulk-status"
                  >
                    <option value="">Select status...</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            )}
            
            {bulkAction === "certificates" && (
              <div className="space-y-4">
                <p>Allow certificate downloads for selected users:</p>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Certificate Download Permission</span>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={bulkActionValue}
                    onChange={(e) => setBulkActionValue(e.target.value)}
                    data-testid="select-bulk-certificates"
                  >
                    <option value="">Select permission...</option>
                    <option value="true">Allow Downloads</option>
                    <option value="false">Deny Downloads</option>
                  </select>
                </div>
              </div>
            )}
            
            {bulkAction === "archive" && (
              <div className="space-y-4">
                <div className="alert alert-warning">
                  <i className="fas fa-exclamation-triangle"></i>
                  <div>
                    <h4 className="font-bold">Archive Users</h4>
                    <div className="text-sm">This will set all selected users to inactive status.</div>
                  </div>
                </div>
                <p>Are you sure you want to archive {selectedUserIds.length} user(s)?</p>
              </div>
            )}

            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowBulkActionsModal(false);
                  setBulkAction("");
                  setBulkActionValue("");
                }}
                data-testid="button-bulk-cancel"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-primary ${bulkUpdateUsersMutation.isPending ? 'loading' : ''}`}
                onClick={() => {
                  if (bulkAction === "archive") {
                    bulkUpdateUsersMutation.mutate({
                      userIds: selectedUserIds,
                      action: "status",
                      value: "inactive"
                    });
                  } else if (bulkActionValue) {
                    bulkUpdateUsersMutation.mutate({
                      userIds: selectedUserIds,
                      action: bulkAction,
                      value: bulkAction === "certificates" ? bulkActionValue === "true" : bulkActionValue
                    });
                  }
                }}
                disabled={bulkUpdateUsersMutation.isPending || (!bulkActionValue && bulkAction !== "archive")}
                data-testid="button-bulk-confirm"
              >
                {bulkUpdateUsersMutation.isPending ? 'Processing...' : 'Apply Changes'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => {
              setShowBulkActionsModal(false);
              setBulkAction("");
              setBulkActionValue("");
            }}>close</button>
          </form>
        </dialog>
      )}

      {/* License Limit Modal */}
      {licenseInfo && (
        <LicenseLimitModal
          isOpen={showLicenseLimitModal}
          onClose={() => {
            setShowLicenseLimitModal(false);
            setLicenseInfo(null);
            setPendingAction(() => {});
          }}
          currentActiveUsers={licenseInfo.currentActiveUsers}
          maxActiveUsers={licenseInfo.maxActiveUsers}
          organisationName={licenseInfo.organisationName}
          hasActiveSubscription={licenseInfo.hasActiveSubscription}
          additionalUsersNeeded={Math.max(1, licenseInfo.currentActiveUsers - licenseInfo.maxActiveUsers + 1)}
        />
      )}
    </div>
  );
}
