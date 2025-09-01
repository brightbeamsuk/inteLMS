import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";

interface OrganisationStats {
  activeUsers: number;
  coursesAssigned: number;
  coursesCompleted: number;
  complianceRate: number;
}

interface Organisation {
  id: string;
  name: string;
  displayName: string;
  logoUrl?: string;
  subdomain: string;
  status: string;
}

interface RecentCompletion {
  id: string;
  userId: string;
  userName: string;
  courseTitle: string;
  score: number;
  completedAt: string;
}

interface ExpiringTraining {
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  dueDate: string;
  daysUntilDue: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery<OrganisationStats>({
    queryKey: ['/api/admin/stats'],
  });

  // Fetch organization details for the logged-in admin
  const { data: organisation, isLoading: orgLoading } = useQuery<Organisation>({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  // Fetch analytics data
  const { data: analyticsData = [], isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/completions', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  // Fetch recent completions
  const { data: recentCompletions = [], isLoading: completionsLoading } = useQuery<RecentCompletion[]>({
    queryKey: ['/api/admin/recent-completions', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  // Fetch expiring training
  const { data: expiringTraining = [], isLoading: expiringLoading } = useQuery<ExpiringTraining[]>({
    queryKey: ['/api/admin/expiring-training', user?.organisationId],
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
          <div className="stat-figure stat-users">
            <i className="fas fa-users text-2xl"></i>
          </div>
          <div className="stat-title">Active Users</div>
          <div className="stat-value stat-users" data-testid="stat-active-users">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.activeUsers || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Organisation members</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-courses">
            <i className="fas fa-book-open text-2xl"></i>
          </div>
          <div className="stat-title">Courses Assigned</div>
          <div className="stat-value stat-courses" data-testid="stat-courses-assigned">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.coursesAssigned || 0
            )}
          </div>
          <div className="stat-desc">Across all users</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-completions">
            <i className="fas fa-check-circle text-2xl"></i>
          </div>
          <div className="stat-title">Completed (30d)</div>
          <div className="stat-value stat-completions" data-testid="stat-courses-completed">
            {isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.coursesCompleted || 0
            )}
          </div>
          <div className="stat-desc">This month</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-performance">
            <i className="fas fa-percentage text-2xl"></i>
          </div>
          <div className="stat-title">Compliance Rate</div>
          <div className="stat-value stat-performance" data-testid="stat-compliance-rate">
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Course Completion Trend Chart */}
        <div className="card bg-base-200 shadow-sm xl:col-span-2">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-chart-line text-primary"></i>
              Course Completion Trends
            </h3>
            <div className="h-80 bg-base-100 rounded p-4">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : analyticsData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="text-4xl mb-2">📈</div>
                    <p className="text-sm text-base-content/60">No completion data available yet</p>
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    successful: {
                      label: "Successful Completions",
                      color: "hsl(142, 76%, 36%)",
                    },
                    failed: {
                      label: "Failed Attempts", 
                      color: "hsl(0, 84%, 60%)",
                    },
                    total: {
                      label: "Total Attempts",
                      color: "hsl(217, 91%, 60%)",
                    },
                  }}
                >
                  <AreaChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="monthName" 
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} />
                    <ChartTooltip 
                      content={<ChartTooltipContent />} 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--base-100))',
                        border: '1px solid hsl(var(--base-300))',
                        borderRadius: '8px'
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="successful" 
                      stackId="1" 
                      stroke="var(--color-successful)" 
                      fill="var(--color-successful)" 
                      fillOpacity={0.7}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="failed" 
                      stackId="1" 
                      stroke="var(--color-failed)" 
                      fill="var(--color-failed)" 
                      fillOpacity={0.7}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </div>

        {/* Completion Rate Donut Chart */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-chart-pie text-secondary"></i>
              Overall Success Rate
            </h3>
            <div className="h-80 bg-base-100 rounded p-4">
              {analyticsLoading || !stats ? (
                <div className="flex items-center justify-center h-full">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <ChartContainer
                    config={{
                      successful: {
                        label: "Successful",
                        color: "hsl(142, 76%, 36%)",
                      },
                      pending: {
                        label: "In Progress", 
                        color: "hsl(45, 93%, 47%)",
                      },
                    }}
                    className="h-48 w-full"
                  >
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Completed', value: stats.coursesCompleted, fill: 'hsl(142, 76%, 36%)' },
                          { name: 'In Progress', value: Math.max(0, stats.coursesAssigned - stats.coursesCompleted), fill: 'hsl(45, 93%, 47%)' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                      </Pie>
                      <ChartTooltip 
                        content={<ChartTooltipContent />} 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--base-100))',
                          border: '1px solid hsl(var(--base-300))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ChartContainer>
                  <div className="text-center mt-4">
                    <div className="text-2xl font-bold text-success">
                      {stats.complianceRate}%
                    </div>
                    <div className="text-sm text-base-content/60">
                      Completion Rate
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Performance Bar Chart */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-chart-bar text-accent"></i>
              Monthly Performance
            </h3>
            <div className="h-64 bg-base-100 rounded p-4">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : analyticsData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-sm text-base-content/60">No completion data available yet</p>
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    successful: {
                      label: "Pass",
                      color: "hsl(142, 76%, 36%)",
                    },
                    failed: {
                      label: "Fail", 
                      color: "hsl(0, 84%, 60%)",
                    },
                  }}
                >
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="monthName" 
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} />
                    <ChartTooltip 
                      content={<ChartTooltipContent />} 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--base-100))',
                        border: '1px solid hsl(var(--base-300))',
                        borderRadius: '8px'
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar 
                      dataKey="successful" 
                      fill="var(--color-successful)" 
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="failed" 
                      fill="var(--color-failed)" 
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              )}
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
            <div className="space-y-3" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {completionsLoading ? (
                <div className="text-center py-8">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : recentCompletions.length === 0 ? (
                <div className="text-center py-8 text-base-content/60">
                  <i className="fas fa-trophy text-4xl mb-4 opacity-50"></i>
                  <p>No recent completions yet.</p>
                  <p className="text-sm">Completions will appear here when users finish courses.</p>
                </div>
              ) : (
                recentCompletions.map((completion, index) => (
                  <div key={completion.id} className="flex justify-between items-center p-3 bg-base-100 rounded">
                    <div className="flex items-center gap-3">
                      <div className="avatar placeholder">
                        <div className={`bg-${['neutral', 'primary', 'secondary', 'accent', 'info'][index % 5]} text-${['neutral', 'primary', 'secondary', 'accent', 'info'][index % 5]}-content rounded-full w-8`}>
                          <span className="text-xs">
                            {completion.userName.split(' ').map(n => n.charAt(0)).join('').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold" data-testid={`text-completion-user-${index + 1}`}>
                          {completion.userName}
                        </div>
                        <div className="text-sm text-base-content/60" data-testid={`text-completion-course-${index + 1}`}>
                          {completion.courseTitle}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="badge badge-success" data-testid={`badge-completion-score-${index + 1}`}>
                        {Math.round(completion.score)}%
                      </div>
                      <div className="text-xs text-base-content/60" data-testid={`text-completion-time-${index + 1}`}>
                        {new Date(completion.completedAt).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
          </div>
        </div>
      </div>

      {/* Expiring Training Alerts */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h3 className="card-title">
            <i className="fas fa-exclamation-triangle text-warning"></i>
            Expiring Training Alerts
          </h3>
          <div className="space-y-3">
            {expiringLoading ? (
              <div className="text-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              <>
                <div className="alert alert-warning">
                  <i className="fas fa-clock"></i>
                  <div>
                    <div className="font-bold" data-testid="text-due-7-days">
                      {expiringTraining.filter(t => t.daysUntilDue <= 7).length} users
                    </div>
                    <div className="text-xs">Due within 7 days</div>
                  </div>
                  <Link href="/admin/training-matrix?statuses=red,amber">
                    <button className="btn btn-sm btn-outline" data-testid="button-view-due-7">View</button>
                  </Link>
                </div>
                <div className="alert alert-info">
                  <i className="fas fa-calendar"></i>
                  <div>
                    <div className="font-bold" data-testid="text-due-30-days">
                      {expiringTraining.filter(t => t.daysUntilDue <= 30).length} users
                    </div>
                    <div className="text-xs">Due within 30 days</div>
                  </div>
                  <Link href="/admin/training-matrix?statuses=red,amber">
                    <button className="btn btn-sm btn-outline" data-testid="button-view-due-30">View</button>
                  </Link>
                </div>
                <div className="alert alert-ghost">
                  <i className="fas fa-calendar-alt"></i>
                  <div>
                    <div className="font-bold" data-testid="text-due-90-days">
                      {expiringTraining.filter(t => t.daysUntilDue <= 90).length} users
                    </div>
                    <div className="text-xs">Due within 90 days</div>
                  </div>
                  <Link href="/admin/training-matrix?statuses=red,amber">
                    <button className="btn btn-sm btn-outline" data-testid="button-view-due-90">View</button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
