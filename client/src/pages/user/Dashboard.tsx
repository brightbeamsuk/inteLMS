import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
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
  progressPercent?: number;
}

// Course completion results interface
interface CourseResults {
  courseTitle: string;
  score: number;
  passed: boolean;
  completedAt: string;
  timeSpent?: string;
  certificateUrl?: string;
  passmark: number;
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
}

interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseTitle?: string;
  certificateUrl: string;
  issuedAt: string;
  expiryDate?: string;
}

interface UserStats {
  completedCourses: number;
  averageScore: number;
}

// Course Results Modal Component
function CourseResultsModal({ 
  assignment, 
  attemptState, 
  isOpen, 
  onClose 
}: { 
  assignment: Assignment;
  attemptState: AttemptState; 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  if (!isOpen) return null;

  const score = attemptState.score || 0;
  const passed = attemptState.pass || false;
  const passmark = assignment.passmark || 80;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            passed ? 'bg-success text-success-content' : 'bg-error text-error-content'
          }`}>
            <i className={`fas ${passed ? 'fa-trophy' : 'fa-times'} text-xl`}></i>
          </div>
          Course Results
        </h3>
        
        <div className="space-y-6">
          {/* Course Info */}
          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-semibold text-lg mb-2" data-testid="results-course-title">
              {assignment.courseTitle}
            </h4>
            <p className="text-base-content/70">
              {assignment.courseDescription || 'Course completed successfully'}
            </p>
          </div>

          {/* Pass/Fail Status */}
          <div className={`alert ${passed ? 'alert-success' : 'alert-error'}`}>
            <div className="flex items-center gap-3">
              <i className={`fas ${passed ? 'fa-check-circle' : 'fa-times-circle'} text-xl`}></i>
              <div>
                <div className="font-bold text-lg" data-testid="results-status">
                  {passed ? 'Congratulations! You passed!' : 'Course not passed'}
                </div>
                <div className="text-sm opacity-90">
                  {passed 
                    ? `You achieved the required score of ${passmark}% or higher.`
                    : `You need ${passmark}% to pass. You can retake the course to improve your score.`
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Score Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat bg-base-200 rounded-lg">
              <div className="stat-title">Your Score</div>
              <div className={`stat-value text-3xl ${passed ? 'text-success' : 'text-error'}`} data-testid="results-score">
                {score}%
              </div>
              <div className="stat-desc">Final score achieved</div>
            </div>
            
            <div className="stat bg-base-200 rounded-lg">
              <div className="stat-title">Pass Mark</div>
              <div className="stat-value text-3xl text-base-content" data-testid="results-passmark">
                {passmark}%
              </div>
              <div className="stat-desc">Required to pass</div>
            </div>
          </div>

          {/* Completion Details */}
          <div className="bg-base-200 rounded-lg p-4">
            <h5 className="font-semibold mb-3">Completion Details</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium capitalize" data-testid="results-completion-status">
                  {attemptState.status.replace('_', ' ')}
                </span>
              </div>
              {attemptState.lastActivity && (
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="font-medium" data-testid="results-completion-date">
                    {new Date(attemptState.lastActivity).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Attempt ID:</span>
                <span className="font-mono text-xs" data-testid="results-attempt-id">
                  {attemptState.attemptId}
                </span>
              </div>
            </div>
          </div>

          {/* Certificate Section (if available) */}
          {passed && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <i className="fas fa-certificate text-amber-600 text-xl"></i>
                <h5 className="font-semibold text-amber-800 dark:text-amber-200">Certificate Available</h5>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Congratulations! You've earned a certificate for completing this course.
              </p>
              <a 
                href={`/api/certificates/download?courseId=${assignment.courseId}&userId=${assignment.userId}`}
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
            onClick={onClose}
            data-testid="button-close-results"
          >
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}

// Course action button component with real-time state
function CourseActionButton({ assignment, onStartCourse }: { assignment: Assignment, onStartCourse: (assignment: Assignment) => void }) {
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: attemptState, isLoading } = useQuery<AttemptState>({
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
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const handleStartOver = async () => {
    setIsResetting(true);
    setShowStartOverDialog(false);
    
    try {
      // Clear localStorage immediately for instant feedback
      localStorage.removeItem(`scorm_save_${assignment.courseId}`);
      localStorage.removeItem(`scorm_attemptId_${assignment.courseId}`);
      
      // Clear any related data
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes(assignment.courseId)) {
          localStorage.removeItem(key);
        }
      });
      
      // Call backend to reset the active attempt first
      const response = await fetch(`/api/lms/enrolments/${assignment.courseId}/start-over`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset course progress');
      }
      
      const result = await response.json();
      console.log(`✅ Course reset: ${result.message}`);
      
      // Force fresh fetch from backend - no optimistic updates
      await queryClient.invalidateQueries({
        queryKey: ['/api/lms/enrolments', assignment.courseId, 'state']
      });
      
      // Small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force another invalidation to ensure we get fresh data
      await queryClient.invalidateQueries({
        queryKey: ['/api/lms/enrolments', assignment.courseId, 'state']
      });
      
      // Also invalidate training matrix so admin view updates in real-time
      await queryClient.invalidateQueries({
        queryKey: ['/api/training-matrix']
      });
      
    } catch (error) {
      console.error('Error resetting course progress:', error);
      // Refresh on error to get accurate state
      queryClient.invalidateQueries({
        queryKey: ['/api/lms/enrolments', assignment.courseId, 'state']
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <button className="btn btn-sm btn-ghost loading" disabled>
        <span className="loading loading-spinner loading-xs"></span>
        Loading...
      </button>
    );
  }

  const state = attemptState || { status: 'not_started', canResume: false };
  
  const getButtonProps = () => {
    switch (state.status) {
      case 'not_started':
        return {
          className: 'btn btn-sm btn-primary',
          text: 'Start Course',
          icon: 'fas fa-play'
        };
      case 'in_progress':
        return {
          className: state.canResume ? 'btn btn-sm btn-info' : 'btn btn-sm btn-primary',
          text: state.canResume ? 'Resume' : 'Continue',
          icon: state.canResume ? 'fas fa-play-circle' : 'fas fa-play'
        };
      case 'completed':
        return {
          className: 'btn btn-sm btn-success',
          text: 'View Results',
          icon: 'fas fa-chart-bar'
        };
      default:
        return {
          className: 'btn btn-sm btn-primary',
          text: 'Start Course',
          icon: 'fas fa-play'
        };
    }
  };

  const buttonProps = getButtonProps();

  return (
    <>
      <div className="flex gap-2">
        <button 
          className={buttonProps.className}
          onClick={() => {
            if (state.status === 'completed') {
              setShowResults(true);
            } else {
              onStartCourse(assignment);
            }
          }}
          data-testid={`button-start-assignment-${assignment.id}`}
        >
          <i className={buttonProps.icon}></i> 
          {buttonProps.text}
        </button>

        {/* Start Over button - only show for in-progress courses */}
        {state.status === 'in_progress' && (
          <button 
            className="btn btn-sm btn-success"
            onClick={() => setShowStartOverDialog(true)}
            disabled={isResetting}
            data-testid={`button-start-over-${assignment.id}`}
            title="Start course from the beginning"
          >
            {isResetting ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <i className="fas fa-redo-alt"></i>
            )}
          </button>
        )}
      </div>

      {/* Start Over Confirmation Dialog */}
      {showStartOverDialog && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Start Over?</h3>
            <p className="mb-6">
              Are you sure you want to start this course over? This will reset all your progress and you'll begin from the beginning.
            </p>
            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => setShowStartOverDialog(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button 
                className="btn btn-success"
                onClick={handleStartOver}
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Resetting...
                  </>
                ) : (
                  'Yes, Start Over'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowStartOverDialog(false)}></div>
        </div>
      )}

      {/* Course Results Modal */}
      {showResults && attemptState && (
        <CourseResultsModal
          assignment={assignment}
          attemptState={attemptState}
          isOpen={showResults}
          onClose={() => setShowResults(false)}
        />
      )}
    </>
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
            data-testid={`progress-assignment-${assignment.id}`}
          ></progress>
          <div className="text-xs text-center mt-1">{state.progressPercent}%</div>
        </div>
      )}
    </div>
  );
}

export function UserDashboard() {
  const { user } = useAuth();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/user/stats'],
  });

  const { data: certificates = [], isLoading: certificatesLoading } = useQuery<Certificate[]>({
    queryKey: ['/api/user/certificates'],
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
    setShowPlayer(true);
  };

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setSelectedAssignment(null);
  };

  const handleCourseComplete = () => {
    setShowPlayer(false);
    setSelectedAssignment(null);
    // Refresh assignments to show updated status
    // This would be handled by queryClient.invalidateQueries in the real implementation
  };

  const getDueSoonStatus = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return diffDays <= 7 && diffDays > 0;
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li className="font-semibold" data-testid="text-current-page">My Dashboard</li>
        </ul>
      </div>

      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-welcome-message">
            Welcome back, {user?.firstName || 'User'} 👋
          </h1>
          <p className="text-base-content/60" data-testid="text-welcome-subtitle">Continue your learning journey</p>
        </div>
        <div className="stats shadow">
          <div className="stat place-items-center">
            <div className="stat-title">Completed</div>
            <div className="stat-value stat-completions" data-testid="stat-completed-count">
              {statsLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                userStats?.completedCourses || 0
              )}
            </div>
            <div className="stat-desc">courses</div>
          </div>
          <div className="stat place-items-center">
            <div className="stat-title">Avg Score</div>
            <div className="stat-value stat-performance" data-testid="stat-avg-score">
              {statsLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                `${userStats?.averageScore || 0}%`
              )}
            </div>
            <div className="stat-desc">{userStats?.completedCourses > 0 ? 'all completed' : 'no completions yet'}</div>
          </div>
        </div>
      </div>

      {/* Enrolled Courses */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Enrolled Courses</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card bg-base-200 shadow-sm">
                <div className="card-body">
                  <div className="skeleton h-4 w-full mb-2"></div>
                  <div className="skeleton h-3 w-3/4 mb-4"></div>
                  <div className="skeleton h-8 w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-bold mb-2">No courses found</h3>
            <p className="text-base-content/60">You don't have any assigned courses yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.slice(0, 3).map((assignment) => (
              <div 
                key={assignment.id} 
                className={`card bg-base-100 shadow-lg hover:shadow-xl transition-shadow ${getDueSoonStatus(assignment.dueDate) ? 'border-l-4 border-warning' : ''}`}
                data-testid={`card-assignment-${assignment.id}`}
              >
                {/* Course Cover Image */}
                {assignment.coverImageUrl && (
                  <figure className="h-48 overflow-hidden">
                    <img 
                      src={assignment.coverImageUrl} 
                      alt={assignment.courseTitle}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </figure>
                )}
                
                <div className="card-body">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="card-title text-lg" data-testid={`text-assignment-title-${assignment.id}`}>
                      {assignment.courseTitle}
                    </h3>
                    <CourseStatus assignment={assignment} />
                  </div>
                  
                  {/* Course Description */}
                  {assignment.courseDescription && (
                    <p className="text-sm text-base-content/70 mb-3 line-clamp-2">
                      {assignment.courseDescription}
                    </p>
                  )}
                  
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span className="flex items-center gap-1" data-testid={`text-assignment-due-${assignment.id}`}>
                      <i className="fas fa-calendar-alt text-base-content/50"></i>
                      {assignment.dueDate ? `Due: ${new Date(assignment.dueDate).toLocaleDateString()}` : 'No deadline'}
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-assignment-duration-${assignment.id}`}>
                      <i className="fas fa-clock text-base-content/50"></i>
                      {assignment.estimatedDuration} mins
                    </span>
                  </div>
                  
                  <div className="card-actions justify-end">
                    <CourseActionButton 
                      assignment={assignment} 
                      onStartCourse={handleStartCourse} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {assignments.length > 3 && (
          <div className="text-center mt-4">
            <Link href="/user/courses" className="btn btn-ghost" data-testid="link-view-all-courses">
              View All Courses ({assignments.length})
            </Link>
          </div>
        )}
      </div>

      {/* Certificates Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">My Certificates</h2>
        {certificatesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="card bg-base-200 shadow-sm">
                <div className="card-body">
                  <div className="skeleton h-4 w-full mb-2"></div>
                  <div className="skeleton h-3 w-3/4 mb-4"></div>
                  <div className="skeleton h-8 w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-bold mb-2">No certificates yet</h3>
            <p className="text-base-content/60">Complete courses to earn certificates</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((certificate) => (
              <div 
                key={certificate.id} 
                className="card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 shadow-md border-2 border-amber-200 dark:border-amber-700"
                data-testid={`card-certificate-${certificate.id}`}
              >
                <div className="card-body">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                        <i className="fas fa-certificate text-white text-xl"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-amber-900 dark:text-amber-100" data-testid={`text-certificate-title-${certificate.id}`}>
                          {certificate.courseTitle || 'Course Certificate'}
                        </h3>
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          Certificate of Completion
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/60">Issued:</span>
                      <span className="font-medium" data-testid={`text-certificate-date-${certificate.id}`}>
                        {new Date(certificate.issuedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {certificate.expiryDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-base-content/60">Expires:</span>
                        <span className="font-medium" data-testid={`text-certificate-expiry-${certificate.id}`}>
                          {new Date(certificate.expiryDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="card-actions justify-end">
                    <a 
                      href={`/api/certificates/${certificate.id}/download`}
                      download
                      className="btn btn-sm btn-primary"
                      data-testid={`button-download-certificate-${certificate.id}`}
                    >
                      <i className="fas fa-download"></i> Download PDF
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        />
      )}
    </div>
  );
}
