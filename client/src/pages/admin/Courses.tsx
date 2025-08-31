import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Course {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  passmark: number;
  category: string;
  tags: string;
  coverImageUrl?: string;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function AdminCourses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [notifyUsers, setNotifyUsers] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const assignCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const assignments = selectedUsers.map(userId => ({
        courseId: selectedCourse?.id,
        userId,
        organisationId: currentUser?.organisationId,
        dueDate: dueDate ? new Date(dueDate) : null,
        notificationsEnabled: notifyUsers,
        assignedBy: currentUser?.id,
      }));

      // Create multiple assignments
      return Promise.all(
        assignments.map(assignment => 
          apiRequest('POST', '/api/assignments', assignment)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-matrix'] });
      setShowAssignModal(false);
      setSelectedUsers([]);
      setDueDate("");
      toast({
        title: "Success",
        description: `Course assigned to ${selectedUsers.length} user(s)`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to assign course",
        variant: "destructive",
      });
    },
  });

  // Filter courses based on search and category (exclude archived courses)
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || course.category === selectedCategory;
    const isNotArchived = course.status !== 'archived';
    return matchesSearch && matchesCategory && isNotArchived;
  });

  // Get unique categories
  const categories = Array.from(new Set(courses.map(course => course.category).filter(Boolean)));

  const handleAssignCourse = () => {
    if (!selectedCourse || selectedUsers.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select users to assign the course to",
        variant: "destructive",
      });
      return;
    }
    assignCourseMutation.mutate({});
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Courses</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Course Library</h1>
      </div>

      {/* Filters */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="form-control flex-1">
              <input 
                type="text" 
                placeholder="Search courses by title or description..." 
                className="input input-bordered"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-courses"
              />
            </div>
            <div className="form-control">
              <select 
                className="select select-bordered"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                data-testid="select-filter-category"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coursesLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-3 w-3/4 mb-4"></div>
                <div className="skeleton h-12 w-full"></div>
              </div>
            </div>
          ))
        ) : filteredCourses.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-bold mb-2">No courses found</h3>
            <p className="text-base-content/60 mb-4">
              {searchTerm || selectedCategory ? 
                "No courses match your current filters" : 
                "No courses are available in the library yet"
              }
            </p>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <div key={course.id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-course-${course.id}`}>
              <figure className="px-4 pt-4">
                <div className="w-full h-32 bg-base-300 rounded-lg flex items-center justify-center">
                  {course.coverImageUrl ? (
                    <img src={course.coverImageUrl} alt={course.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <i className="fas fa-graduation-cap text-4xl text-base-content/40"></i>
                  )}
                </div>
              </figure>
              <div className="card-body">
                <h3 className="card-title text-lg" data-testid={`text-course-title-${course.id}`}>{course.title}</h3>
                <p className="text-sm text-base-content/60 line-clamp-2" data-testid={`text-course-description-${course.id}`}>
                  {course.description}
                </p>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm">
                    <div data-testid={`text-course-duration-${course.id}`}>⏱️ {course.estimatedDuration} mins</div>
                    <div data-testid={`text-course-passmark-${course.id}`}>📊 {course.passmark}% pass</div>
                  </div>
                  <div className="flex flex-col items-end">
                    {course.category && (
                      <div className="badge badge-outline" data-testid={`badge-course-category-${course.id}`}>
                        {course.category}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions justify-end mt-4">
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setSelectedCourse(course);
                      setShowAssignModal(true);
                    }}
                    data-testid={`button-assign-course-${course.id}`}
                  >
                    <i className="fas fa-user-plus"></i> Assign
                  </button>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setSelectedCourse(course);
                      setShowTrackingModal(true);
                    }}
                    data-testid={`button-track-course-${course.id}`}
                  >
                    <i className="fas fa-chart-bar"></i> Track
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Assign Course Modal */}
      {showAssignModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-assign-modal-title">
              Assign Course: {selectedCourse.title}
            </h3>
            
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Select Users</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded p-2">
                  {users.map((user) => (
                    <label key={user.id} className="label cursor-pointer justify-start gap-3">
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-primary" 
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(prev => [...prev, user.id]);
                          } else {
                            setSelectedUsers(prev => prev.filter(id => id !== user.id));
                          }
                        }}
                        data-testid={`checkbox-user-${user.id}`}
                      />
                      <span className="label-text">{user.firstName} {user.lastName} ({user.email})</span>
                    </label>
                  ))}
                </div>
                <div className="text-sm text-base-content/60 mt-2" data-testid="text-selected-count">
                  {selectedUsers.length} user(s) selected
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Due Date (Optional)</span>
                </label>
                <input 
                  type="date" 
                  className="input input-bordered"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  data-testid="input-due-date"
                />
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary" 
                    checked={notifyUsers}
                    onChange={(e) => setNotifyUsers(e.target.checked)}
                    data-testid="checkbox-notify-users"
                  />
                  <span className="label-text">Send notification emails to users</span>
                </label>
              </div>

              <div className="card bg-base-100">
                <div className="card-body">
                  <h4 className="card-title text-base">Assignment Summary</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Course:</strong> <span data-testid="text-summary-course">{selectedCourse.title}</span></div>
                    <div><strong>Duration:</strong> <span data-testid="text-summary-duration">{selectedCourse.estimatedDuration} minutes</span></div>
                    <div><strong>Pass Mark:</strong> <span data-testid="text-summary-passmark">{selectedCourse.passmark}%</span></div>
                    <div><strong>Users:</strong> <span data-testid="text-summary-users">{selectedUsers.length} selected</span></div>
                    <div><strong>Due Date:</strong> <span data-testid="text-summary-due">{dueDate || 'No deadline'}</span></div>
                    <div><strong>Notifications:</strong> <span data-testid="text-summary-notify">{notifyUsers ? 'Enabled' : 'Disabled'}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUsers([]);
                  setDueDate("");
                }}
                data-testid="button-cancel-assign"
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleAssignCourse}
                disabled={assignCourseMutation.isPending || selectedUsers.length === 0}
                data-testid="button-confirm-assign"
              >
                {assignCourseMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Assign Course'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowAssignModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Course Tracking Modal */}
      {showTrackingModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-tracking-modal-title">
              Track Progress: {selectedCourse.title}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">Assigned</div>
                <div className="stat-value text-primary" data-testid="stat-assigned">15</div>
              </div>
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">In Progress</div>
                <div className="stat-value text-warning" data-testid="stat-in-progress">7</div>
              </div>
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">Passed</div>
                <div className="stat-value text-success" data-testid="stat-passed">6</div>
              </div>
              <div className="stat bg-base-100 rounded-lg">
                <div className="stat-title">Failed</div>
                <div className="stat-value text-error" data-testid="stat-failed">2</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Score</th>
                    <th>Due Date</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder">
                          <div className="bg-neutral text-neutral-content rounded-full w-8">
                            <span className="text-xs">JD</span>
                          </div>
                        </div>
                        <div>John Doe</div>
                      </div>
                    </td>
                    <td><div className="badge badge-success">Passed</div></td>
                    <td>
                      <div className="w-24">
                        <progress className="progress progress-success" value="100" max="100"></progress>
                        <div className="text-xs">100%</div>
                      </div>
                    </td>
                    <td>92%</td>
                    <td>Feb 15, 2024</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder">
                          <div className="bg-neutral text-neutral-content rounded-full w-8">
                            <span className="text-xs">SM</span>
                          </div>
                        </div>
                        <div>Sarah Miller</div>
                      </div>
                    </td>
                    <td><div className="badge badge-warning">In Progress</div></td>
                    <td>
                      <div className="w-24">
                        <progress className="progress progress-warning" value="65" max="100"></progress>
                        <div className="text-xs">65%</div>
                      </div>
                    </td>
                    <td>-</td>
                    <td>Feb 20, 2024</td>
                    <td>1</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-outline"
                data-testid="button-export-tracking"
              >
                <i className="fas fa-download"></i> Export CSV
              </button>
              <button 
                className="btn"
                onClick={() => setShowTrackingModal(false)}
                data-testid="button-close-tracking"
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowTrackingModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
