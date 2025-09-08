import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TrainingMatrixStatusIcon } from "@/components/TrainingMatrixStatusIcon";

interface TrainingMatrixData {
  staff: StaffMember[];
  courses: CourseInfo[];
  matrix: MatrixCell[][];
  summary: {
    red: number;
    amber: number;
    green: number;
    grey: number;
    blue: number;
    failed: number;
  };
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  jobTitle?: string;
  role: string;
}

interface CourseInfo {
  id: string;
  title: string;
  category?: string;
  certificateExpiryPeriod?: number; // months
  status: string;
}

interface MatrixCell {
  status: 'red' | 'amber' | 'green' | 'blue' | 'grey' | 'blank' | 'failed';
  label: string;
  date?: string;
  score?: number;
  completionDate?: string;
  expiryDate?: string;
  attemptCount: number;
  assignmentId?: string;
  completionId?: string;
}

interface FilterState {
  departments: string[];
  roles: string[];
  courses: string[];
  statuses: string[];
  staff: string[];
  expiryWindow?: number; // days
  mandatoryOnly: boolean;
}


export function AdminTrainingMatrix() {
  const [filters, setFilters] = useState<FilterState>({
    departments: [],
    roles: [],
    courses: [],
    statuses: [],
    staff: [],
    mandatoryOnly: false,
  });
  const [sortBy, setSortBy] = useState<'overdue' | 'name' | 'expiry'>('overdue');
  const [selectedCell, setSelectedCell] = useState<{
    staffId: string;
    courseId: string;
    cell: MatrixCell;
  } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Fetch training matrix data
  const { data: matrixData, isLoading, error } = useQuery<TrainingMatrixData>({
    queryKey: ['/api/training-matrix', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.departments.length > 0) params.append('departments', filters.departments.join(','));
      if (filters.roles.length > 0) params.append('roles', filters.roles.join(','));
      if (filters.courses.length > 0) params.append('courses', filters.courses.join(','));
      if (filters.statuses.length > 0) params.append('statuses', filters.statuses.join(','));
      if (filters.staff.length > 0) params.append('staff', filters.staff.join(','));
      if (filters.mandatoryOnly) params.append('mandatoryOnly', 'true');
      
      const url = `/api/training-matrix${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch training matrix');
      return response.json();
    },
    enabled: !!currentUser?.organisationId,
    staleTime: 0,
    gcTime: 0,
  });

  // Debug logging
  console.log('Training Matrix Query:', { matrixData, isLoading, error, currentUser });

  // Load filters from URL parameters or localStorage on mount
  useEffect(() => {
    if (currentUser?.organisationId) {
      // First, check URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const urlFilters: Partial<FilterState> = {};
      let hasUrlFilters = false;
      
      if (urlParams.has('departments')) {
        urlFilters.departments = urlParams.get('departments')?.split(',') || [];
        hasUrlFilters = true;
      }
      if (urlParams.has('roles')) {
        urlFilters.roles = urlParams.get('roles')?.split(',') || [];
        hasUrlFilters = true;
      }
      if (urlParams.has('courses')) {
        urlFilters.courses = urlParams.get('courses')?.split(',') || [];
        hasUrlFilters = true;
      }
      if (urlParams.has('statuses')) {
        urlFilters.statuses = urlParams.get('statuses')?.split(',') || [];
        hasUrlFilters = true;
      }
      if (urlParams.has('staff')) {
        urlFilters.staff = urlParams.get('staff')?.split(',') || [];
        hasUrlFilters = true;
      }
      if (urlParams.has('mandatoryOnly')) {
        urlFilters.mandatoryOnly = urlParams.get('mandatoryOnly') === 'true';
        hasUrlFilters = true;
      }
      
      if (hasUrlFilters) {
        // Apply URL filters
        setFilters(prev => ({ ...prev, ...urlFilters }));
        return;
      }
      
      // If no URL filters, load saved filters from localStorage
      const savedFiltersKey = `training-matrix-filters-${currentUser.organisationId}`;
      const savedFilters = localStorage.getItem(savedFiltersKey);
      if (savedFilters) {
        try {
          const parsedFilters = JSON.parse(savedFilters);
          setFilters(parsedFilters);
        } catch (error) {
          console.error('Failed to load saved filters:', error);
        }
      }
    }
  }, [currentUser?.organisationId]);

  // Save current view
  const saveCurrentView = () => {
    if (currentUser?.organisationId) {
      const savedFiltersKey = `training-matrix-filters-${currentUser.organisationId}`;
      localStorage.setItem(savedFiltersKey, JSON.stringify(filters));
      toast({
        title: "Success",
        description: "Current view saved",
      });
    }
  };

  // Send reminders mutation
  const sendRemindersMutation = useMutation({
    mutationFn: async (data: { staffIds: string[]; courseIds: string[] }) => {
      return await apiRequest('POST', '/api/training-matrix/reminders', {
        ...data,
        organisationId: currentUser?.organisationId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Reminders sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reminders",
        variant: "destructive",
      });
    },
  });

  // Status color mapping
  const getStatusClasses = (status: MatrixCell['status']) => {
    switch (status) {
      case 'red': return 'bg-error text-error-content';
      case 'amber': return 'bg-warning text-warning-content';
      case 'green': return 'bg-success text-success-content';
      case 'blue': return 'bg-info text-info-content';
      case 'grey': return 'bg-base-300 text-base-content';
      case 'blank': return 'bg-base-100 text-base-content opacity-50';
      default: return 'bg-base-100 text-base-content';
    }
  };

  const getStatusIcon = (status: MatrixCell['status']) => {
    switch (status) {
      case 'red': return 'fas fa-exclamation-triangle';
      case 'amber': return 'fas fa-clock';
      case 'green': return 'fas fa-check-circle';
      case 'blue': return 'fas fa-spinner fa-spin';
      case 'grey': return 'fas fa-minus-circle';
      case 'blank': return 'fas fa-minus';
      default: return 'fas fa-question';
    }
  };

  // Filter helpers - no longer needed as filters are applied automatically via query

  const clearFilters = () => {
    // Force complete cache refresh first
    queryClient.removeQueries({ queryKey: ['/api/training-matrix'] });
    
    setFilters({
      departments: [],
      roles: [],
      courses: [],
      statuses: [],
      staff: [],
      mandatoryOnly: false,
    });
    
    // Clear saved filters 
    if (currentUser?.organisationId) {
      const savedFiltersKey = `training-matrix-filters-${currentUser.organisationId}`;
      localStorage.removeItem(savedFiltersKey);
    }
  };

  const exportData = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/training-matrix/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          filters,
          sortBy,
          organisationId: currentUser?.organisationId,
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `training-matrix-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Matrix exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!matrixData) {
    return <div className="alert alert-error">Failed to load training matrix data</div>;
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Training Matrix</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Matrix</h1>
          <p className="text-base-content/70 mt-1">Track completion status across all staff and courses</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            className="btn btn-outline btn-sm"
            onClick={saveCurrentView}
            data-testid="button-save-view"
          >
            <i className="fas fa-save"></i>
            Save Current View
          </button>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-outline btn-sm" data-testid="button-export">
              <i className="fas fa-download"></i>
              Export
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <a onClick={() => exportData('csv')} data-testid="button-export-csv">
                  <i className="fas fa-file-csv"></i>
                  Export as CSV
                </a>
              </li>
              <li>
                <a onClick={() => exportData('pdf')} data-testid="button-export-pdf">
                  <i className="fas fa-file-pdf"></i>
                  Export as PDF
                </a>
              </li>
            </ul>
          </div>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => sendRemindersMutation.mutate({ 
              staffIds: matrixData.staff.map(s => s.id),
              courseIds: matrixData.courses.map(c => c.id)
            })}
            disabled={sendRemindersMutation.isPending}
            data-testid="button-send-reminders"
          >
            {sendRemindersMutation.isPending ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <i className="fas fa-bell"></i>
            )}
            Send Reminders
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <i className="fas fa-filter text-base-content/60"></i>
              <span className="font-medium">Filters:</span>
            </div>
            
            <div className="flex flex-wrap gap-3 flex-1">
              {/* Department Filter */}
              <div className="form-control min-w-[150px]">
                <select 
                  className="select select-bordered select-sm"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFilters(prev => ({
                        ...prev,
                        departments: prev.departments.includes(e.target.value) 
                          ? prev.departments 
                          : [...prev.departments, e.target.value]
                      }));
                      e.target.value = "";
                    }
                  }}
                  data-testid="select-department-filter"
                >
                  <option value="">Add Department</option>
                  {Array.from(new Set(
                    matrixData.staff.map(s => s.department).filter(Boolean)
                  )).map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div className="form-control min-w-[120px]">
                <select 
                  className="select select-bordered select-sm"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFilters(prev => ({
                        ...prev,
                        roles: prev.roles.includes(e.target.value) 
                          ? prev.roles 
                          : [...prev.roles, e.target.value]
                      }));
                      e.target.value = "";
                    }
                  }}
                  data-testid="select-role-filter"
                >
                  <option value="">Add Role</option>
                  {Array.from(new Set(
                    matrixData.staff.map(s => s.role).filter(Boolean)
                  )).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {/* Course Filter */}
              <div className="form-control min-w-[150px]">
                <select 
                  className="select select-bordered select-sm"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFilters(prev => ({
                        ...prev,
                        courses: prev.courses.includes(e.target.value) 
                          ? prev.courses 
                          : [...prev.courses, e.target.value]
                      }));
                      e.target.value = "";
                    }
                  }}
                  data-testid="select-course-filter"
                >
                  <option value="">Add Course</option>
                  {matrixData.courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="form-control min-w-[140px]">
                <select 
                  className="select select-bordered select-sm"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setFilters(prev => ({
                        ...prev,
                        statuses: prev.statuses.includes(e.target.value) 
                          ? prev.statuses 
                          : [...prev.statuses, e.target.value]
                      }));
                      e.target.value = "";
                    }
                  }}
                  data-testid="select-status-filter"
                >
                  <option value="">Add Status</option>
                  <option value="green">Completed & current</option>
                  <option value="amber">Expiring soon</option>
                  <option value="red">Overdue/expired</option>
                  <option value="grey">Not completed</option>
                </select>
              </div>

              {/* Staff Filter */}
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-outline btn-sm" data-testid="button-staff-filter">
                  <i className="fas fa-users"></i>
                  Staff ({filters.staff.length})
                  <i className="fas fa-chevron-down ml-1"></i>
                </div>
                <div tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64 max-h-60 overflow-y-auto">
                  <div className="form-control p-2">
                    <label className="label cursor-pointer justify-start gap-2">
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-sm"
                        checked={filters.staff.length === matrixData.staff.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              staff: matrixData.staff.map(s => s.id)
                            }));
                          } else {
                            setFilters(prev => ({ ...prev, staff: [] }));
                          }
                        }}
                      />
                      <span className="label-text font-medium">Select All</span>
                    </label>
                  </div>
                  <div className="divider my-1"></div>
                  {matrixData.staff.map((staffMember) => (
                    <div key={staffMember.id} className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          className="checkbox checkbox-sm"
                          checked={filters.staff.includes(staffMember.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                staff: [...prev.staff, staffMember.id]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                staff: prev.staff.filter(id => id !== staffMember.id)
                              }));
                            }
                          }}
                          data-testid={`checkbox-staff-${staffMember.id}`}
                        />
                        <span className="label-text">
                          {staffMember.firstName} {staffMember.lastName}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Clear Filters Button - Only show when filters are active */}
            {(filters.departments.length > 0 || filters.roles.length > 0 || 
              filters.courses.length > 0 || filters.statuses.length > 0 || filters.staff.length > 0) && (
              <button 
                className="btn btn-outline btn-sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                <i className="fas fa-times"></i>
                Clear All Filters
              </button>
            )}
          </div>

          {/* Active Filter Tags */}
          {(filters.departments.length > 0 || filters.roles.length > 0 || 
            filters.courses.length > 0 || filters.statuses.length > 0 || filters.staff.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-base-300">
              {filters.departments.map((dept) => (
                <div key={`dept-${dept}`} className="badge badge-primary gap-2">
                  <span>Dept: {dept}</span>
                  <button
                    className="btn btn-xs btn-circle btn-ghost"
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      departments: prev.departments.filter(d => d !== dept)
                    }))}
                  >
                    ×
                  </button>
                </div>
              ))}
              {filters.roles.map((role) => (
                <div key={`role-${role}`} className="badge badge-secondary gap-2">
                  <span>Role: {role}</span>
                  <button
                    className="btn btn-xs btn-circle btn-ghost"
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      roles: prev.roles.filter(r => r !== role)
                    }))}
                  >
                    ×
                  </button>
                </div>
              ))}
              {filters.courses.map((courseId) => {
                const course = matrixData.courses.find(c => c.id === courseId);
                return (
                  <div key={`course-${courseId}`} className="badge badge-accent gap-2">
                    <span>Course: {course?.title || courseId}</span>
                    <button
                      className="btn btn-xs btn-circle btn-ghost"
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        courses: prev.courses.filter(c => c !== courseId)
                      }))}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {filters.statuses.map((status) => {
                const statusLabels = {
                  green: 'Completed & current',
                  amber: 'Expiring soon', 
                  red: 'Overdue/expired',
                  grey: 'Not completed'
                };
                return (
                  <div key={`status-${status}`} className="badge badge-neutral gap-2">
                    <span>Status: {statusLabels[status as keyof typeof statusLabels]}</span>
                    <button
                      className="btn btn-xs btn-circle btn-ghost"
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        statuses: prev.statuses.filter(s => s !== status)
                      }))}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {filters.staff.map((staffId) => {
                const staffMember = matrixData.staff.find(s => s.id === staffId);
                return (
                  <div key={`staff-${staffId}`} className="badge badge-info gap-2">
                    <span>Staff: {staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : staffId}</span>
                    <button
                      className="btn btn-xs btn-circle btn-ghost"
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        staff: prev.staff.filter(s => s !== staffId)
                      }))}
                      data-testid={`button-remove-staff-${staffId}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* Legend and Summary */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body p-6">
          <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-6">
            {/* Legend with Numbers Below */}
            <div className="w-full">
              <div className="text-sm font-semibold text-base-content mb-4">Legend:</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-base-100 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <TrainingMatrixStatusIcon status="green" size="sm" />
                    <span className="text-sm text-base-content">Completed & current</span>
                  </div>
                  <div className="text-2xl font-bold text-success" data-testid="stat-green-count">
                    {matrixData.summary.green}
                  </div>
                </div>
                <div className="bg-base-100 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <TrainingMatrixStatusIcon status="amber" size="sm" />
                    <span className="text-sm text-base-content">Expiring soon</span>
                  </div>
                  <div className="text-2xl font-bold text-warning" data-testid="stat-amber-count">
                    {matrixData.summary.amber}
                  </div>
                </div>
                <div className="bg-base-100 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <TrainingMatrixStatusIcon status="red" size="sm" />
                    <span className="text-sm text-base-content">Overdue/expired</span>
                  </div>
                  <div className="text-2xl font-bold text-error" data-testid="stat-red-count">
                    {matrixData.summary.red}
                  </div>
                </div>
                <div className="bg-base-100 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <TrainingMatrixStatusIcon status="blue" size="sm" />
                    <span className="text-sm text-base-content">In progress</span>
                  </div>
                  <div className="text-2xl font-bold text-info" data-testid="stat-blue-count">
                    {matrixData.summary.blue || 0}
                  </div>
                </div>
                <div className="bg-base-100 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <TrainingMatrixStatusIcon status="grey" size="sm" />
                    <span className="text-sm text-base-content">Not completed</span>
                  </div>
                  <div className="text-2xl font-bold text-base-content" data-testid="stat-grey-count">
                    {matrixData.summary.grey}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Training Matrix Table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="bg-base-200">
                  <th className="sticky left-0 bg-base-200 z-10 min-w-[200px]">
                    <div className="font-semibold">Staff Member</div>
                  </th>
                  {matrixData.courses.map((course) => (
                    <th key={course.id} className="text-center min-w-[140px] p-2">
                      <div className="flex flex-col items-center gap-1">
                        <div className="font-medium text-xs leading-tight text-center break-words">{course.title}</div>
                        {course.category && (
                          <div className="text-xs text-base-content/60 text-center">{course.category}</div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.staff.map((staff, staffIndex) => (
                  <tr key={staff.id} className="hover:bg-base-50">
                    <td className="sticky left-0 bg-base-100 z-10 font-medium">
                      <div className="flex flex-col">
                        <div className="font-medium">
                          {staff.firstName} {staff.lastName}
                        </div>
                        <div className="text-xs text-base-content/60">
                          {staff.jobTitle && staff.department 
                            ? `${staff.jobTitle} • ${staff.department}`
                            : staff.jobTitle || staff.department || staff.email}
                        </div>
                      </div>
                    </td>
                    {matrixData.courses.map((course, courseIndex) => {
                      const cell = matrixData.matrix[staffIndex]?.[courseIndex];
                      return (
                        <td key={`${staff.id}-${course.id}`} className="text-center p-2 min-w-[140px]">
                          {cell && (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <TrainingMatrixStatusIcon
                                status={cell.status}
                                onClick={() => {
                                  if (cell.status !== 'blank') {
                                    setSelectedCell({
                                      staffId: staff.id,
                                      courseId: course.id,
                                      cell: cell
                                    });
                                    setShowDetailModal(true);
                                  }
                                }}
                              />
                              {cell.status !== 'blank' && cell.status !== 'grey' && (
                                <div className="text-xs text-center break-words max-w-[130px] leading-tight">
                                  {cell.label}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Enhanced Course Results Modal */}
      {showDetailModal && selectedCell && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            {(() => {
              const staff = matrixData.staff.find(s => s.id === selectedCell.staffId);
              const course = matrixData.courses.find(c => c.id === selectedCell.courseId);
              const cell = selectedCell.cell;
              const score = cell.score || 0;
              const passed = cell.status === 'green';
              const passmark = 80; // Default passmark, could be retrieved from course data
              
              return (
                <>
                  <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      passed ? 'bg-success text-success-content' : 'bg-error text-error-content'
                    }`}>
                      <i className={`fas ${passed ? 'fa-trophy' : 'fa-times'} text-xl`}></i>
                    </div>
                    Course Results - {staff?.firstName} {staff?.lastName}
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Course Info */}
                    <div className="bg-base-200 rounded-lg p-4">
                      <h4 className="font-semibold text-lg mb-2" data-testid="results-course-title">
                        {course?.title}
                      </h4>
                      <div className="text-base-content/70 text-sm">
                        <div className="mb-1"><strong>Staff Member:</strong> {staff?.firstName} {staff?.lastName}</div>
                        {staff?.jobTitle && <div className="mb-1"><strong>Job Title:</strong> {staff.jobTitle}</div>}
                        {staff?.department && <div className="mb-1"><strong>Department:</strong> {staff.department}</div>}
                        <div><strong>Email:</strong> {staff?.email}</div>
                      </div>
                    </div>

                    {/* Pass/Fail Status - Only show for completed courses */}
                    {cell.status === 'green' || cell.status === 'red' && (
                      <div className={`alert ${passed ? 'alert-success' : 'alert-error'}`}>
                        <div className="flex items-center gap-3">
                          <i className={`fas ${passed ? 'fa-check-circle' : 'fa-times-circle'} text-xl`}></i>
                          <div>
                            <div className="font-bold text-lg" data-testid="results-status">
                              {passed ? 'Course Completed Successfully!' : 'Course Requirements Not Met'}
                            </div>
                            <div className="text-sm opacity-90">
                              {passed 
                                ? `Achieved the required score of ${passmark}% or higher.`
                                : `Score of ${passmark}% required to pass.`
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Information */}
                    {(cell.status === 'amber' || cell.status === 'blue' || cell.status === 'grey') && (
                      <div className={`alert ${
                        cell.status === 'amber' ? 'alert-warning' : 
                        cell.status === 'blue' ? 'alert-info' : 'alert-warning'
                      }`}>
                        <div className="flex items-center gap-3">
                          <TrainingMatrixStatusIcon status={cell.status} size="sm" />
                          <div>
                            <div className="font-bold text-lg">
                              {cell.status === 'amber' ? 'Training Expiring Soon' :
                               cell.status === 'blue' ? 'Training In Progress' :
                               'Training Not Started'}
                            </div>
                            <div className="text-sm opacity-90">{cell.label}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Score Details - Only show if there's a score */}
                    {cell.score !== undefined && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="stat bg-base-200 rounded-lg">
                          <div className="stat-title">Score Achieved</div>
                          <div className={`stat-value text-3xl ${passed ? 'text-success' : 'text-error'}`} data-testid="results-score">
                            {score}%
                          </div>
                          <div className="stat-desc">Final score</div>
                        </div>
                        
                        <div className="stat bg-base-200 rounded-lg">
                          <div className="stat-title">Pass Mark</div>
                          <div className="stat-value text-3xl text-base-content" data-testid="results-passmark">
                            {passmark}%
                          </div>
                          <div className="stat-desc">Required to pass</div>
                        </div>
                      </div>
                    )}

                    {/* Completion Details */}
                    <div className="bg-base-200 rounded-lg p-4">
                      <h5 className="font-semibold mb-3">Training Details</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <div className="flex items-center gap-2">
                            <TrainingMatrixStatusIcon status={cell.status} size="sm" />
                            <span className="font-medium capitalize" data-testid="results-completion-status">
                              {cell.label}
                            </span>
                          </div>
                        </div>
                        {cell.completionDate && (
                          <div className="flex justify-between">
                            <span>Completed:</span>
                            <span className="font-medium" data-testid="results-completion-date">
                              {new Date(cell.completionDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {cell.expiryDate && (
                          <div className="flex justify-between">
                            <span>Expires:</span>
                            <span className="font-medium" data-testid="results-expiry-date">
                              {new Date(cell.expiryDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Total Attempts:</span>
                          <span className="font-medium" data-testid="results-attempt-count">
                            {cell.attemptCount}
                          </span>
                        </div>
                        {cell.assignmentId && (
                          <div className="flex justify-between">
                            <span>Assignment ID:</span>
                            <span className="font-mono text-xs" data-testid="results-assignment-id">
                              {cell.assignmentId}
                            </span>
                          </div>
                        )}
                        {cell.completionId && (
                          <div className="flex justify-between">
                            <span>Completion ID:</span>
                            <span className="font-mono text-xs" data-testid="results-completion-id">
                              {cell.completionId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Certificate Section - Only show for completed courses */}
                    {passed && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <i className="fas fa-certificate text-amber-600 text-xl"></i>
                          <h5 className="font-semibold text-amber-800 dark:text-amber-200">Certificate Available</h5>
                        </div>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                          This staff member has earned a certificate for completing this course.
                        </p>
                        <a 
                          href={`/api/certificates/download?courseId=${course?.id}&userId=${staff?.id}`}
                          className="btn btn-warning btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="button-download-certificate"
                        >
                          <i className="fas fa-download"></i> Download Certificate
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="modal-action mt-8">
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowDetailModal(false)}
                      data-testid="button-close-results"
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}></div>
        </div>
      )}

    </div>
  );
}