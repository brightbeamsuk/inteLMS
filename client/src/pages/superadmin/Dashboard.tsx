import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";

interface TodoItem {
  id: string;
  task: string;
  completed: boolean;
  order: number;
}

interface PlatformStats {
  totalOrganisations: number;
  totalUsers: number;
  totalCourses: number;
  totalCompletions: number;
}

export function SuperAdminDashboard() {
  const [newTodo, setNewTodo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['/api/superadmin/stats'],
  });

  // Fetch todos
  const { data: todos = [], isLoading: todosLoading } = useQuery<TodoItem[]>({
    queryKey: ['/api/todos'],
  });

  // Fetch completion analytics
  const { data: analyticsData = [], isLoading: analyticsLoading } = useQuery<any[]>({
    queryKey: ['/api/superadmin/analytics/completions'],
  });

  // Fetch popular courses analytics
  const { data: popularCoursesData = [], isLoading: popularCoursesLoading } = useQuery<any[]>({
    queryKey: ['/api/superadmin/analytics/popular-courses'],
  });

  // Add todo mutation
  const addTodoMutation = useMutation({
    mutationFn: async (task: string) => {
      return await apiRequest('POST', '/api/todos', { task });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      setNewTodo("");
      toast({
        title: "Success",
        description: "Task added to your to-do list",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      });
    },
  });

  // Update todo mutation
  const updateTodoMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TodoItem> }) => {
      return await apiRequest('PATCH', `/api/todos/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
    },
  });

  // Delete todo mutation
  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/todos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({
        title: "Success",
        description: "Task permanently deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  // Seed demo data mutation
  const seedDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/seed-demo-data', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/superadmin/stats'] });
      toast({
        title: "Success",
        description: "Demo data has been seeded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to seed demo data",
        variant: "destructive",
      });
    },
  });

  const handleAddTodo = () => {
    if (newTodo.trim()) {
      addTodoMutation.mutate(newTodo.trim());
    }
  };

  const handleToggleTodo = (todo: TodoItem) => {
    updateTodoMutation.mutate({
      id: todo.id,
      updates: { completed: !todo.completed }
    });
  };

  const handleDeleteTodo = (id: string) => {
    if (confirm('Are you sure you want to permanently delete this task?')) {
      deleteTodoMutation.mutate(id);
    }
  };

  // Filter todos based on completion status
  const activeTodos = todos.filter(todo => !todo.completed);
  const archivedTodos = todos.filter(todo => todo.completed);
  const displayedTodos = showArchived ? archivedTodos : activeTodos;

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a onClick={() => setLocation('/superadmin')} className="cursor-pointer" data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Dashboard</li>
        </ul>
      </div>

      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Overview</h1>
        <div className="flex gap-2">
          <button 
            className="btn btn-primary"
            onClick={() => setLocation('/superadmin/organisations')}
            data-testid="button-add-organisation"
          >
            <i className="fas fa-plus"></i> Add Organisation
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setLocation('/superadmin/course-builder')}
            data-testid="button-add-course"
          >
            <i className="fas fa-graduation-cap"></i> Add Course
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => seedDataMutation.mutate()}
            disabled={seedDataMutation.isPending}
            data-testid="button-seed-data"
          >
            {seedDataMutation.isPending ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <i className="fas fa-database"></i>
            )}
            Seed Demo Data
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-organisations">
            <i className="fas fa-building text-3xl"></i>
          </div>
          <div className="stat-title">Total Organisations</div>
          <div className="stat-value stat-organisations" data-testid="stat-organisations">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalOrganisations || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Active organisations</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-users">
            <i className="fas fa-users text-3xl"></i>
          </div>
          <div className="stat-title">Total Users</div>
          <div className="stat-value stat-users" data-testid="stat-users">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalUsers || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Platform users</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-courses">
            <i className="fas fa-book text-3xl opacity-100"></i>
          </div>
          <div className="stat-title">Total Courses</div>
          <div className="stat-value stat-courses font-bold opacity-100" data-testid="stat-courses">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalCourses || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Published courses</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure stat-completions">
            <i className="fas fa-certificate text-3xl"></i>
          </div>
          <div className="stat-title">Courses Completed</div>
          <div className="stat-value stat-completions" data-testid="stat-completions">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalCompletions || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Total completions</div>
        </div>
      </div>

      {/* Modern Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Total Users Growth Card */}
        <div className="card bg-white shadow-sm border border-gray-200 rounded-lg">
          <div className="card-body p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
              <button className="text-sm text-gray-500 hover:text-gray-700">View More</button>
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900" data-testid="metric-total-users">
                {statsLoading ? (
                  <span className="loading loading-spinner loading-md"></span>
                ) : (
                  `${stats?.totalUsers?.toLocaleString() || '0'}`
                )}
              </div>
              <p className="text-sm text-green-600 mt-1">
                +12.5% from last month
              </p>
            </div>
            <div className="mt-4">
              <div className="h-16 flex items-end">
                {/* Simple SVG Chart */}
                <svg viewBox="0 0 300 60" className="w-full h-full">
                  <path
                    d="M10,50 C50,45 100,40 150,35 C200,30 250,25 290,20"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    fill="none"
                    className="opacity-80"
                  />
                  {/* Data points */}
                  <circle cx="50" cy="45" r="2" fill="#8b5cf6" />
                  <circle cx="100" cy="40" r="2" fill="#8b5cf6" />
                  <circle cx="150" cy="35" r="2" fill="#8b5cf6" />
                  <circle cx="200" cy="30" r="2" fill="#8b5cf6" />
                  <circle cx="250" cy="25" r="2" fill="#8b5cf6" />
                  <circle cx="290" cy="20" r="2" fill="#8b5cf6" />
                </svg>
              </div>
              {/* Month labels */}
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-2">
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>
          </div>
        </div>

        {/* Course Completions Growth Card */}
        <div className="card bg-white shadow-sm border border-gray-200 rounded-lg">
          <div className="card-body p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-600">Course Completions</h3>
              <button className="text-sm text-gray-500 hover:text-gray-700">View More</button>
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900" data-testid="metric-completions">
                {statsLoading ? (
                  <span className="loading loading-spinner loading-md"></span>
                ) : (
                  `+${stats?.totalCompletions?.toLocaleString() || '0'}`
                )}
              </div>
              <p className="text-sm text-green-600 mt-1">
                +180.1% from last month
              </p>
            </div>
            <div className="mt-4">
              <div className="h-16 flex items-end">
                {/* Simple SVG Area Chart */}
                <svg viewBox="0 0 300 60" className="w-full h-full">
                  <defs>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <path
                    d="M10,60 L10,40 C60,35 120,25 180,30 C240,35 270,20 290,15 L290,60 Z"
                    fill="url(#areaGradient)"
                  />
                  {/* Top line */}
                  <path
                    d="M10,40 C60,35 120,25 180,30 C240,35 270,20 290,15"
                    stroke="#ec4899"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
              {/* Month labels */}
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-2">
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Course Completion Analytics Chart */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-chart-bar text-primary"></i>
              Course Completion Analytics
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
                      label: "Successful",
                      color: "hsl(var(--chart-1))",
                    },
                    failed: {
                      label: "Failed", 
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                >
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="monthName" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="successful" stackId="a" fill="var(--color-successful)" />
                    <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </div>

        {/* Popular Courses This Month */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-star text-primary"></i>
              Popular Courses This Month
            </h3>
            <div className="h-64 bg-base-100 rounded p-4">
              {popularCoursesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : popularCoursesData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="text-4xl mb-2">⭐</div>
                    <p className="text-sm text-base-content/60">No course assignments this month yet</p>
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    totalTaken: {
                      label: "Times Taken",
                      color: "hsl(var(--chart-3))",
                    },
                  }}
                >
                  <BarChart data={popularCoursesData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      dataKey="courseName" 
                      type="category" 
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="totalTaken" fill="var(--color-totalTaken)" />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal To-Do List */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h3 className="card-title">
              <i className="fas fa-tasks text-info"></i>
              Personal To-Do List
            </h3>
            <div className="flex gap-2">
              <button 
                className={`btn btn-sm ${!showArchived ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setShowArchived(false)}
                data-testid="button-active-todos"
              >
                <i className="fas fa-list"></i> Active ({activeTodos.length})
              </button>
              <button 
                className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setShowArchived(true)}
                data-testid="button-archived-todos"
              >
                <i className="fas fa-archive"></i> Archived ({archivedTodos.length})
              </button>
            </div>
          </div>
          {!showArchived && (
            <div className="join mb-4">
              <input 
                className="input input-bordered join-item flex-1" 
                placeholder="Add new task..." 
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                data-testid="input-todo"
              />
              <button 
                className="btn btn-primary join-item"
                onClick={handleAddTodo}
                disabled={addTodoMutation.isPending}
                data-testid="button-add-todo"
              >
                {addTodoMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <i className="fas fa-plus"></i>
                )}
              </button>
            </div>
          )}
          
          <div className="space-y-2" data-testid="todo-list">
            {todosLoading ? (
              <div className="text-center">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : displayedTodos.length === 0 ? (
              <div className="text-center text-base-content/60">
                {showArchived ? 'No archived tasks yet.' : 'No active tasks. Add your first task above.'}
              </div>
            ) : (
              displayedTodos.map((todo) => (
                <div key={todo.id} className="form-control">
                  <div className="flex items-center justify-between">
                    <label className="label cursor-pointer justify-start gap-3 flex-1">
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-primary" 
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo)}
                        data-testid={`checkbox-todo-${todo.id}`}
                      />
                      <span 
                        className={`label-text ${todo.completed ? 'line-through opacity-50' : ''}`}
                        data-testid={`text-todo-${todo.id}`}
                      >
                        {todo.task}
                      </span>
                    </label>
                    {showArchived && (
                      <button
                        className="btn btn-ghost btn-sm text-error hover:bg-error hover:text-error-content"
                        onClick={() => handleDeleteTodo(todo.id)}
                        disabled={deleteTodoMutation.isPending}
                        data-testid={`button-delete-todo-${todo.id}`}
                        title="Permanently delete this task"
                      >
                        {deleteTodoMutation.isPending ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          <i className="fas fa-trash text-sm"></i>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
