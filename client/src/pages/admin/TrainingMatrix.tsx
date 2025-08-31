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
  status: 'red' | 'amber' | 'green' | 'grey' | 'blank';
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
  expiryWindow?: number; // days
  mandatoryOnly: boolean;
}

interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  organisationId: string;
}

export function AdminTrainingMatrix() {
  const [filters, setFilters] = useState<FilterState>({
    departments: [],
    roles: [],
    courses: [],
    statuses: [],
    mandatoryOnly: false,
  });
  const [sortBy, setSortBy] = useState<'overdue' | 'name' | 'expiry'>('overdue');
  const [selectedCell, setSelectedCell] = useState<{
    staffId: string;
    courseId: string;
    cell: MatrixCell;
  } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Fetch training matrix data
  const { data: matrixData, isLoading, error } = useQuery<TrainingMatrixData>({
    queryKey: ['/api/training-matrix'],
    enabled: !!currentUser?.organisationId,
  });

  // Debug logging
  console.log('Training Matrix Query:', { matrixData, isLoading, error, currentUser });

  // Fetch saved views
  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: ['/api/training-matrix/views', currentUser?.organisationId],
    enabled: !!currentUser?.organisationId,
  });

  // Save view mutation
  const saveViewMutation = useMutation({
    mutationFn: async (viewData: { name: string; filters: FilterState }) => {
      return await apiRequest('POST', '/api/training-matrix/views', {
        name: viewData.name,
        filters: viewData.filters,
        organisationId: currentUser?.organisationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-matrix/views'] });
      setShowSaveViewModal(false);
      setNewViewName('');
      toast({
        title: "Success",
        description: "View saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save view",
        variant: "destructive",
      });
    },
  });

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
      case 'grey': return 'fas fa-minus-circle';
      case 'blank': return 'fas fa-minus';
      default: return 'fas fa-question';
    }
  };

  // Filter helpers
  const applyFilters = () => {
    // Filters are applied server-side via query params
    queryClient.invalidateQueries({ queryKey: ['/api/training-matrix'] });
  };

  const clearFilters = () => {
    setFilters({
      departments: [],
      roles: [],
      courses: [],
      statuses: [],
      mandatoryOnly: false,
    });
    setActiveView(null);
  };

  const applyView = (view: SavedView) => {
    setFilters(view.filters);
    setActiveView(view);
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a view name",
        variant: "destructive",
      });
      return;
    }
    saveViewMutation.mutate({ name: newViewName.trim(), filters });
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
            onClick={() => setShowSaveViewModal(true)}
            data-testid="button-save-view"
          >
            <i className="fas fa-save"></i>
            Save View
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

      {/* Legend and Summary */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body p-6">
          <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-6">
            {/* Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-sm font-semibold text-base-content">Legend:</span>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <TrainingMatrixStatusIcon status="green" size="sm" />
                  <span className="text-sm text-base-content">Completed & current</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <TrainingMatrixStatusIcon status="amber" size="sm" />
                  <span className="text-sm text-base-content">Expiring soon</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <TrainingMatrixStatusIcon status="red" size="sm" />
                  <span className="text-sm text-base-content">Overdue/expired</span>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <TrainingMatrixStatusIcon status="grey" size="sm" />
                  <span className="text-sm text-base-content">Not assigned</span>
                </div>
              </div>
            </div>

            {/* Summary Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 min-w-0">
              <div className="bg-base-100 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-xs font-medium text-base-content/70 mb-1">Out of date</div>
                <div className="text-xl font-bold text-error" data-testid="stat-red-count">
                  {matrixData.summary.red}
                </div>
              </div>
              <div className="bg-base-100 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-xs font-medium text-base-content/70 mb-1">Expiring</div>
                <div className="text-xl font-bold text-warning" data-testid="stat-amber-count">
                  {matrixData.summary.amber}
                </div>
              </div>
              <div className="bg-base-100 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-xs font-medium text-base-content/70 mb-1">In date</div>
                <div className="text-xl font-bold text-success" data-testid="stat-green-count">
                  {matrixData.summary.green}
                </div>
              </div>
              <div className="bg-base-100 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-xs font-medium text-base-content/70 mb-1">Not completed</div>
                <div className="text-xl font-bold text-base-content" data-testid="stat-grey-count">
                  {matrixData.summary.grey}
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
                    <th key={course.id} className="text-center min-w-[120px] p-2">
                      <div className="flex flex-col items-center gap-1">
                        <div className="font-medium text-xs leading-tight">{course.title}</div>
                        {course.category && (
                          <div className="text-xs text-base-content/60">{course.category}</div>
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
                        <td key={`${staff.id}-${course.id}`} className="text-center p-3">
                          {cell && (
                            <div className="flex justify-center">
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

      {/* Cell Detail Modal */}
      {showDetailModal && selectedCell && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Training Details</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Staff Member:</label>
                <p>{matrixData.staff.find(s => s.id === selectedCell.staffId)?.firstName} {matrixData.staff.find(s => s.id === selectedCell.staffId)?.lastName}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Course:</label>
                <p>{matrixData.courses.find(c => c.id === selectedCell.courseId)?.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Status:</label>
                <div className="flex items-center gap-2 mt-1">
                  <TrainingMatrixStatusIcon status={selectedCell.cell.status} size="sm" />
                  <span className="capitalize">{selectedCell.cell.label}</span>
                </div>
              </div>
              {selectedCell.cell.completionDate && (
                <div>
                  <label className="text-sm font-medium">Completion Date:</label>
                  <p>{new Date(selectedCell.cell.completionDate).toLocaleDateString()}</p>
                </div>
              )}
              {selectedCell.cell.expiryDate && (
                <div>
                  <label className="text-sm font-medium">Expiry Date:</label>
                  <p>{new Date(selectedCell.cell.expiryDate).toLocaleDateString()}</p>
                </div>
              )}
              {selectedCell.cell.score !== undefined && (
                <div>
                  <label className="text-sm font-medium">Score:</label>
                  <p>{selectedCell.cell.score}%</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Attempts:</label>
                <p>{selectedCell.cell.attemptCount}</p>
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => setShowDetailModal(false)}
                data-testid="button-close-detail"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}