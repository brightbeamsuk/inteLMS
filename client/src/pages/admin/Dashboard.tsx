import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface OrganisationStats {
  activeUsers: number;
  coursesAssigned: number;
  coursesCompleted: number;
  complianceRate: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery<OrganisationStats>({
    queryKey: ['/api/admin/stats'],
  });

  // Fetch organization details for the logged-in admin
  const { data: organisation, isLoading: orgLoading } = useQuery({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Dashboard</li>
        </ul>
      </div>

      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="avatar">
            <div className="w-12 h-12 rounded">
              {organisation?.logoUrl ? (
                <img 
                  src={organisation.logoUrl} 
                  alt={`${organisation.name} logo`} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`bg-primary text-primary-content flex items-center justify-center ${organisation?.logoUrl ? 'hidden' : ''}`}>
                <i className="fas fa-building text-xl"></i>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-organisation-name">
              {orgLoading ? (
                <span className="loading loading-spinner loading-md"></span>
              ) : (
                organisation?.displayName || 'Organisation Dashboard'
              )}
            </h1>
            <p className="text-base-content/60" data-testid="text-dashboard-subtitle">
              {orgLoading ? 'Loading...' : 'Admin Dashboard'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users">
            <button className="btn btn-primary" data-testid="button-add-user">
              <i className="fas fa-user-plus"></i> Add User
            </button>
          </Link>
          <Link href="/admin/courses">
            <button className="btn btn-secondary" data-testid="button-assign-courses">
              <i className="fas fa-tasks"></i> Assign Courses
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            <i className="fas fa-users text-2xl"></i>
          </div>
          <div className="stat-title">Active Users</div>
          <div className="stat-value text-primary" data-testid="stat-active-users">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.activeUsers || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Organisation members</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-secondary">
            <i className="fas fa-book-open text-2xl"></i>
          </div>
          <div className="stat-title">Courses Assigned</div>
          <div className="stat-value text-secondary" data-testid="stat-courses-assigned">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.coursesAssigned || 0
            )}
          </div>
          <div className="stat-desc">Across all users</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            <i className="fas fa-check-circle text-2xl"></i>
          </div>
          <div className="stat-title">Completed (30d)</div>
          <div className="stat-value text-success" data-testid="stat-courses-completed">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.coursesCompleted || 0
            )}
          </div>
          <div className="stat-desc">This month</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-warning">
            <i className="fas fa-percentage text-2xl"></i>
          </div>
          <div className="stat-title">Compliance Rate</div>
          <div className="stat-value text-warning" data-testid="stat-compliance-rate">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              `${stats?.complianceRate || 0}%`
            )}
          </div>
          <div className="stat-desc">Overall completion</div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Expiring Training */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-exclamation-triangle text-warning"></i>
              Expiring Training
            </h3>
            <div className="space-y-3">
              <div className="alert alert-warning">
                <i className="fas fa-clock"></i>
                <div>
                  <div className="font-bold" data-testid="text-due-7-days">5 users</div>
                  <div className="text-xs">Due within 7 days</div>
                </div>
                <button className="btn btn-sm btn-outline" data-testid="button-view-due-7">View</button>
              </div>
              <div className="alert alert-info">
                <i className="fas fa-calendar"></i>
                <div>
                  <div className="font-bold" data-testid="text-due-30-days">12 users</div>
                  <div className="text-xs">Due within 30 days</div>
                </div>
                <button className="btn btn-sm btn-outline" data-testid="button-view-due-30">View</button>
              </div>
              <div className="alert alert-ghost">
                <i className="fas fa-calendar-alt"></i>
                <div>
                  <div className="font-bold" data-testid="text-due-90-days">23 users</div>
                  <div className="text-xs">Due within 90 days</div>
                </div>
                <button className="btn btn-sm btn-outline" data-testid="button-view-due-90">View</button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Completions */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-trophy text-success"></i>
              Recent Completions
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-base-100 rounded">
                <div className="flex items-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-8">
                      <span className="text-xs">JD</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold" data-testid="text-completion-user-1">John Doe</div>
                    <div className="text-sm text-base-content/60" data-testid="text-completion-course-1">GDPR Training</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="badge badge-success" data-testid="badge-completion-score-1">92%</div>
                  <div className="text-xs text-base-content/60" data-testid="text-completion-time-1">2 hours ago</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-base-100 rounded">
                <div className="flex items-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-8">
                      <span className="text-xs">SM</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold" data-testid="text-completion-user-2">Sarah Miller</div>
                    <div className="text-sm text-base-content/60" data-testid="text-completion-course-2">Fire Safety</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="badge badge-success" data-testid="badge-completion-score-2">87%</div>
                  <div className="text-xs text-base-content/60" data-testid="text-completion-time-2">5 hours ago</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-base-100 rounded">
                <div className="flex items-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-secondary text-secondary-content rounded-full w-8">
                      <span className="text-xs">RJ</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold" data-testid="text-completion-user-3">Robert Johnson</div>
                    <div className="text-sm text-base-content/60" data-testid="text-completion-course-3">Cybersecurity</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="badge badge-success" data-testid="badge-completion-score-3">95%</div>
                  <div className="text-xs text-base-content/60" data-testid="text-completion-time-3">1 day ago</div>
                </div>
              </div>
            </div>
            
            <div className="card-actions justify-end mt-4">
              <button className="btn btn-sm btn-outline" data-testid="button-view-all-completions">
                View All Completions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Trend Chart */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h3 className="card-title">
            <i className="fas fa-chart-line text-primary"></i>
            Compliance Trend (Last 6 Months)
          </h3>
          <div className="h-64 flex items-center justify-center bg-base-100 rounded">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <p className="text-sm text-base-content/60">Compliance trend chart would display here</p>
              <div className="stats stats-horizontal shadow mt-4">
                <div className="stat place-items-center">
                  <div className="stat-title">Avg Compliance</div>
                  <div className="stat-value text-sm" data-testid="stat-avg-compliance">84%</div>
                </div>
                <div className="stat place-items-center">
                  <div className="stat-title">Trend</div>
                  <div className="stat-value text-sm text-success" data-testid="stat-compliance-trend">↗ +5%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
