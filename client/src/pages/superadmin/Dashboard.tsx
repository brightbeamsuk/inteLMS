import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['/api/superadmin/stats'],
  });

  // Fetch todos
  const { data: todos = [], isLoading: todosLoading } = useQuery<TodoItem[]>({
    queryKey: ['/api/todos'],
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

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Dashboard</li>
        </ul>
      </div>

      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Overview</h1>
        <div className="flex gap-2">
          <button 
            className="btn btn-primary"
            data-testid="button-add-organisation"
          >
            <i className="fas fa-plus"></i> Add Organisation
          </button>
          <button 
            className="btn btn-secondary"
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
          <div className="stat-figure text-primary">
            <i className="fas fa-building text-3xl"></i>
          </div>
          <div className="stat-title">Total Organisations</div>
          <div className="stat-value text-primary" data-testid="stat-organisations">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalOrganisations || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Active organisations</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-secondary">
            <i className="fas fa-users text-3xl"></i>
          </div>
          <div className="stat-title">Total Users</div>
          <div className="stat-value text-secondary" data-testid="stat-users">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalUsers || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Platform users</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-accent">
            <i className="fas fa-book text-3xl"></i>
          </div>
          <div className="stat-title">Total Courses</div>
          <div className="stat-value text-accent" data-testid="stat-courses">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalCourses || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Published courses</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            <i className="fas fa-certificate text-3xl"></i>
          </div>
          <div className="stat-title">Courses Completed</div>
          <div className="stat-value text-success" data-testid="stat-completions">
            {statsLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : (
              stats?.totalCompletions || 0
            )}
          </div>
          <div className="stat-desc">↗︎ Total completions</div>
        </div>
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* New Sign-ups Chart */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-chart-line text-primary"></i>
              Analytics Overview
            </h3>
            <div className="h-64 flex items-center justify-center bg-base-100 rounded">
              <div className="text-center">
                <div className="text-4xl mb-2">📈</div>
                <p className="text-sm text-base-content/60">Platform growth and usage analytics</p>
                <div className="stats stats-vertical lg:stats-horizontal shadow mt-4">
                  <div className="stat place-items-center">
                    <div className="stat-title">Monthly Growth</div>
                    <div className="stat-value text-sm">↗︎ 12%</div>
                  </div>
                  <div className="stat place-items-center">
                    <div className="stat-title">Completion Rate</div>
                    <div className="stat-value text-sm">84%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Courses */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">
              <i className="fas fa-trophy text-warning"></i>
              Popular Courses
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-base-100 rounded">
                <div>
                  <div className="font-semibold">Safeguarding Children — Level 1</div>
                  <div className="text-sm text-base-content/60">Child Protection</div>
                </div>
                <div className="badge badge-primary">High demand</div>
              </div>
              <div className="flex justify-between items-center p-3 bg-base-100 rounded">
                <div>
                  <div className="font-semibold">Data Protection Essentials</div>
                  <div className="text-sm text-base-content/60">GDPR Compliance</div>
                </div>
                <div className="badge badge-secondary">Popular</div>
              </div>
              <div className="flex justify-between items-center p-3 bg-base-100 rounded">
                <div>
                  <div className="font-semibold">Fire Safety in the Workplace</div>
                  <div className="text-sm text-base-content/60">Health & Safety</div>
                </div>
                <div className="badge badge-accent">Growing</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal To-Do List */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h3 className="card-title">
            <i className="fas fa-tasks text-info"></i>
            Personal To-Do List
          </h3>
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
          
          <div className="space-y-2" data-testid="todo-list">
            {todosLoading ? (
              <div className="text-center">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : todos.length === 0 ? (
              <div className="text-center text-base-content/60">
                No tasks yet. Add your first task above.
              </div>
            ) : (
              todos.map((todo) => (
                <div key={todo.id} className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
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
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
