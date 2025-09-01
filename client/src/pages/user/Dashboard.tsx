import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { CoursePlayer } from "@/components/scorm/CoursePlayer";

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

export function UserDashboard() {
  const { user } = useAuth();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/user/stats'],
  });

  const { data: certificates = [], isLoading: certificatesLoading } = useQuery<Certificate[]>({
    queryKey: ['/api/user/certificates'],
  });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started':
        return <div className="badge badge-ghost">Not Started</div>;
      case 'in_progress':
        return <div className="badge badge-info">In Progress</div>;
      case 'completed':
        return <div className="badge badge-success">Completed</div>;
      case 'overdue':
        return <div className="badge badge-error">Overdue</div>;
      default:
        return <div className="badge badge-ghost">{status}</div>;
    }
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
                    {getStatusBadge(assignment.status)}
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
                  
                  {assignment.progress !== undefined && (
                    <div className="mb-3">
                      <progress 
                        className={`progress w-full ${
                          assignment.status === 'completed' ? 'progress-success' :
                          assignment.status === 'in_progress' ? 'progress-info' :
                          'progress-warning'
                        }`}
                        value={assignment.progress} 
                        max="100"
                        data-testid={`progress-assignment-${assignment.id}`}
                      ></progress>
                      <div className="text-xs text-center mt-1">{assignment.progress}%</div>
                    </div>
                  )}
                  
                  <div className="card-actions justify-end">
                    {assignment.status === 'not_started' || assignment.status === 'in_progress' ? (
                      <button 
                        className={`btn btn-sm ${
                          assignment.status === 'not_started' ? 'btn-primary' : 'btn-info'
                        }`}
                        onClick={() => handleStartCourse(assignment)}
                        data-testid={`button-start-assignment-${assignment.id}`}
                      >
                        <i className="fas fa-play"></i> 
                        {assignment.status === 'not_started' ? 'Start Course' : 'Resume'}
                      </button>
                    ) : (
                      <button 
                        className={`btn btn-sm ${
                          assignment.status === 'completed' ? 'btn-success' : 'btn-error'
                        }`}
                        onClick={() => handleStartCourse(assignment)}
                        data-testid={`button-start-assignment-${assignment.id}`}
                      >
                        <i className={assignment.status === 'completed' ? 'fas fa-eye' : 'fas fa-play'}></i> 
                        {assignment.status === 'completed' ? 'Review' : 'Continue'}
                      </button>
                    )}
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
          courseTitle={selectedAssignment.courseTitle}
          onComplete={handleCourseComplete}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
}
