import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CoursePlayer } from "@/components/scorm/CoursePlayer";

// SCORM 2004 (3rd Ed.) attempt state interface
interface AttemptState {
  status: 'not_started' | 'in_progress' | 'completed';
  hasOpenAttempt: boolean;
  attemptId?: string;
  lastActivity?: string;
  score?: number;
  pass?: boolean;
  canResume: boolean;
}

// Course action button component with real-time state
function CourseActionButton({ assignment, onStartCourse, onStartOver }: { assignment: Assignment, onStartCourse: (assignment: Assignment) => void, onStartOver: (assignment: Assignment) => void }) {
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: attemptState, isLoading } = useQuery<AttemptState>({
    queryKey: ['/api/lms/enrolments', assignment.courseId, 'state'],
    queryFn: async () => {
      const response = await fetch(`/api/lms/enrolments/${assignment.courseId}/state`, {
        credentials: 'include',
        cache: 'no-store' // Ensure no stale cache
      });
      if (!response.ok) {
        throw new Error('Failed to fetch attempt state');
      }
      return response.json();
    },
    staleTime: 0, // Always revalidate to get latest state
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const handleStartOver = async () => {
    try {
      const response = await fetch(`/api/lms/enrolments/${assignment.courseId}/start-over`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to start over');
      }
      
      // Refresh the attempt state
      queryClient.invalidateQueries({
        queryKey: ['/api/lms/enrolments', assignment.courseId, 'state']
      });
      
      setShowStartOverDialog(false);
      // Start the course with fresh attempt
      onStartOver(assignment);
    } catch (error) {
      console.error('Error starting over:', error);
      // You could add a toast notification here
    }
  };

  if (isLoading) {
    return (
      <button className="btn btn-ghost loading" disabled>
        <span className="loading loading-spinner"></span>
        Loading...
      </button>
    );
  }

  const state = attemptState || { status: 'not_started', canResume: false };
  
  // Determine button appearance and text based on SCORM 2004 (3rd Ed.) state
  const getButtonProps = () => {
    switch (state.status) {
      case 'not_started':
        return {
          className: 'btn btn-primary',
          text: 'Start',
          icon: 'fas fa-play'
        };
      case 'in_progress':
        return {
          className: state.canResume ? 'btn btn-info' : 'btn btn-primary',
          text: state.canResume ? 'Resume' : 'Start',
          icon: state.canResume ? 'fas fa-play-circle' : 'fas fa-play'
        };
      case 'completed':
        return {
          className: 'btn btn-success',
          text: 'Review',
          icon: 'fas fa-eye'
        };
      default:
        return {
          className: 'btn btn-primary',
          text: 'Start',
          icon: 'fas fa-play'
        };
    }
  };

  const buttonProps = getButtonProps();

  return (
    <div className="flex gap-2">
      <button 
        className={buttonProps.className}
        onClick={() => onStartCourse(assignment)}
        data-testid={`button-start-course-${assignment.id}`}
      >
        <i className={buttonProps.icon}></i>
        {buttonProps.text}
      </button>
      
      {/* Start Over button - only show for in-progress courses */}
      {state.status === 'in_progress' && (
        <button 
          className="btn btn-success"
          onClick={() => setShowStartOverDialog(true)}
          data-testid={`button-start-over-${assignment.id}`}
          title="Start course from the beginning"
        >
          <i className="fas fa-redo-alt"></i>
        </button>
      )}

      {/* Start Over Confirmation Dialog */}
      {showStartOverDialog && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Start Over?</h3>
            <p className="py-4">
              Are you sure you want to start this course from the beginning? 
              This will create a fresh attempt and you'll lose your current progress.
            </p>
            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => setShowStartOverDialog(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-success"
                onClick={handleStartOver}
              >
                Yes, Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Course status component with real-time state
function CourseStatus({ assignment }: { assignment: Assignment }) {
  const { data: attemptState } = useQuery<AttemptState>({
    queryKey: ['/api/lms/enrolments', assignment.courseId, 'state'],
    queryFn: async () => {
      const response = await fetch(`/api/lms/enrolments/${assignment.courseId}/state`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch attempt state');
      }
      return response.json();
    },
    staleTime: 0,
  });

  const state = attemptState || { status: 'not_started' };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started':
        return <div className="badge badge-ghost badge-sm whitespace-nowrap">Not Started</div>;
      case 'in_progress':
        return <div className="badge badge-info badge-sm whitespace-nowrap">In Progress</div>;
      case 'completed':
        return <div className="badge badge-success badge-sm whitespace-nowrap">Completed</div>;
      case 'overdue':
        return <div className="badge badge-error badge-sm whitespace-nowrap">Overdue</div>;
      default:
        return <div className="badge badge-ghost badge-sm whitespace-nowrap">{status}</div>;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {getStatusBadge(state.status)}
      {state.progressPercent !== undefined && state.status !== 'completed' && (
        <div>
          <progress 
            className={`progress progress-sm w-full ${
              state.status === 'in_progress' ? 'progress-info' : 'progress-warning'
            }`}
            value={state.progressPercent} 
            max="100"
            data-testid={`progress-course-${assignment.id}`}
          ></progress>
          <div className="text-xs text-center mt-1">{state.progressPercent}%</div>
        </div>
      )}
    </div>
  );
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
  // Course details from join
  courseTitle: string;
  courseDescription?: string;
  coverImageUrl?: string;
  estimatedDuration: number;
  passmark: number;
  progress?: number; // This would come from completions if we add it later
  score?: number;
  attemptNumber?: number;
}

export function UserCourses() {
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [startFresh, setStartFresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  // Listen for ATTEMPT_UPDATED messages from CoursePlayer
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e?.data?.type === 'ATTEMPT_UPDATED') {
        // Refresh course card state queries
        const courseId = e.data.courseId;
        queryClient.invalidateQueries({
          queryKey: ['/api/lms/enrolments', courseId, 'state']
        });
        // Also refresh assignments in case status changed
        queryClient.invalidateQueries({
          queryKey: ['/api/assignments']
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [queryClient]);

  const handleStartCourse = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setStartFresh(false); // Normal start/resume
    setShowPlayer(true);
  };

  const handleStartOver = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setStartFresh(true); // Fresh start
    setShowPlayer(true);
  };

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setSelectedAssignment(null);
    setStartFresh(false); // Reset flag
  };

  const handleCourseComplete = () => {
    setShowPlayer(false);
    setSelectedAssignment(null);
    // Refresh assignments to show updated status
  };

  // Filter assignments based on search and status
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.courseTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.courseDescription?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || assignment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li className="font-semibold" data-testid="text-current-page">My Courses</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">My Courses</h1>
      </div>

      {/* Filters */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="form-control flex-1">
              <input 
                type="text" 
                placeholder="Search courses..." 
                className="input input-bordered"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-courses"
              />
            </div>
            <div className="form-control">
              <select 
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="select-filter-status"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Courses List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <div className="skeleton h-6 w-3/4 mb-2"></div>
                <div className="skeleton h-4 w-full mb-4"></div>
                <div className="skeleton h-10 w-24"></div>
              </div>
            </div>
          ))
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-bold mb-2">No courses found</h3>
            <p className="text-base-content/60">
              {searchTerm || statusFilter ? 
                "No courses match your current filters" : 
                "You don't have any assigned courses yet"
              }
            </p>
          </div>
        ) : (
          filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow" data-testid={`card-course-${assignment.id}`}>
              <div className="card-body">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  {/* Cover Image */}
                  {assignment.coverImageUrl && (
                    <div className="w-24 h-24 lg:w-20 lg:h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <img 
                        src={assignment.coverImageUrl} 
                        alt={assignment.courseTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="card-title text-xl" data-testid={`text-course-title-${assignment.id}`}>
                        {assignment.courseTitle}
                      </h3>
                      <CourseStatus assignment={assignment} />
                    </div>
                    
                    {assignment.courseDescription && (
                      <p className="text-base-content/60 mb-3" data-testid={`text-course-description-${assignment.id}`}>
                        {assignment.courseDescription}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div data-testid={`text-course-duration-${assignment.id}`}>
                        <i className="fas fa-clock mr-1"></i>
                        {assignment.estimatedDuration} minutes
                      </div>
                      <div data-testid={`text-course-passmark-${assignment.id}`}>
                        <i className="fas fa-target mr-1"></i>
                        {assignment.passmark}% pass mark
                      </div>
                      {assignment.dueDate && (
                        <div data-testid={`text-course-due-${assignment.id}`}>
                          <i className="fas fa-calendar mr-1"></i>
                          Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </div>
                      )}
                      {assignment.completedAt && assignment.score !== undefined && (
                        <div data-testid={`text-course-score-${assignment.id}`}>
                          <i className="fas fa-star mr-1"></i>
                          Score: {assignment.score}%
                        </div>
                      )}
                    </div>
                    
                    {assignment.progress !== undefined && assignment.status !== 'completed' && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span data-testid={`text-course-progress-${assignment.id}`}>{assignment.progress}%</span>
                        </div>
                        <progress 
                          className={`progress w-full ${
                            assignment.status === 'in_progress' ? 'progress-info' : 'progress-warning'
                          }`}
                          value={assignment.progress} 
                          max="100"
                          data-testid={`progress-course-${assignment.id}`}
                        ></progress>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <CourseActionButton 
                      assignment={assignment} 
                      onStartCourse={handleStartCourse} 
                      onStartOver={handleStartOver}
                    />
                    
                    {assignment.status === 'completed' && assignment.attemptNumber && (
                      <div className="text-xs text-base-content/60" data-testid={`text-course-attempts-${assignment.id}`}>
                        Attempt {assignment.attemptNumber}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Course Player Modal */}
      {showPlayer && selectedAssignment && (
        <CoursePlayer
          assignmentId={selectedAssignment.id}
          courseId={selectedAssignment.courseId}
          courseTitle={selectedAssignment.courseTitle}
          onComplete={handleCourseComplete}
          onClose={handleClosePlayer}
          startFresh={startFresh}
        />
      )}
    </div>
  );
}
