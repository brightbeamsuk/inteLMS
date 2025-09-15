import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { insertCookieInventorySchema, type CookieInventory, type InsertCookieInventory } from "@shared/schema";
import { z } from "zod";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Settings, 
  Search,
  ChevronDown,
  ChevronUp,
  Globe,
  Clock,
  Tag,
  Info
} from "lucide-react";

const cookieCategories = [
  { value: 'strictly_necessary', label: 'Strictly Necessary', color: 'badge-error' },
  { value: 'functional', label: 'Functional', color: 'badge-info' },
  { value: 'analytics', label: 'Analytics', color: 'badge-warning' },
  { value: 'advertising', label: 'Advertising', color: 'badge-success' },
] as const;

interface CookieFormData {
  name: string;
  purpose: string;
  category: 'strictly_necessary' | 'functional' | 'analytics' | 'advertising';
  duration: string;
  provider: string;
  domain: string;
  essential: boolean;
  description: string;
}

const initialFormData: CookieFormData = {
  name: '',
  purpose: '',
  category: 'functional',
  duration: '',
  provider: '',
  domain: '',
  essential: false,
  description: '',
};

export function CookieSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [formData, setFormData] = useState<CookieFormData>(initialFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Organization selector for superadmins
  const [selectedOrganisationId, setSelectedOrganisationId] = useState<string>('');

  // Initialize selected organization for superadmins
  useEffect(() => {
    if (user?.role === 'superadmin') {
      // For superadmins, start with their own org if they have one, otherwise empty
      setSelectedOrganisationId(user?.organisationId || '');
    } else if (user?.role === 'admin') {
      // For admins, always use their organization
      setSelectedOrganisationId(user?.organisationId || '');
    }
  }, [user]);

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-info">
          <span>Cookie Settings are not available in this configuration.</span>
        </div>
      </div>
    );
  }

  // Access control check
  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error">
          <span>Access denied. Only administrators can manage cookie settings.</span>
        </div>
      </div>
    );
  }

  // Fetch organizations for superadmin selector
  const { data: organizations } = useQuery({
    queryKey: ['/api/organisations'],
    queryFn: async () => {
      const response = await fetch('/api/organisations', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      return response.json();
    },
    enabled: user?.role === 'superadmin',
  });

  // Fetch cookie inventory
  const { data: cookies, isLoading } = useQuery<CookieInventory[]>({
    queryKey: ['/api/gdpr/cookies', selectedOrganisationId, categoryFilter !== 'all' ? categoryFilter : null],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Handle organisation scoping
      if (user?.role === 'superadmin') {
        if (selectedOrganisationId) {
          params.append('organisationId', selectedOrganisationId);
        }
        // If no organisation selected, we'll get system-wide cookies (if API supports it)
      } else if (user?.role === 'admin' && user?.organisationId) {
        params.append('organisationId', user.organisationId);
      }
      
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      const queryString = params.toString();
      const url = `/api/gdpr/cookies${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch cookies');
      }
      
      return response.json() as Promise<CookieInventory[]>;
    },
    enabled: !!user?.id && (user?.role !== 'superadmin' || selectedOrganisationId !== ''),
  });

  // Create cookie mutation
  const createCookieMutation = useMutation({
    mutationFn: async (data: CookieFormData) => {
      let organisationId: string;
      
      if (user?.role === 'superadmin') {
        if (!selectedOrganisationId) {
          throw new Error('Please select an organisation first');
        }
        organisationId = selectedOrganisationId;
      } else {
        organisationId = user?.organisationId || '';
      }
      
      const payload: InsertCookieInventory = {
        ...data,
        organisationId,
      };

      return await apiRequest('/api/gdpr/cookies', 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/cookies'] });
      setFormData(initialFormData);
      setShowForm(false);
      toast({
        title: "Cookie added",
        description: "Cookie has been added to your inventory successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create cookie entry",
        variant: "destructive",
      });
    },
  });

  // Update cookie mutation
  const updateCookieMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CookieFormData> }) => {
      return await apiRequest(`/api/gdpr/cookies/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/cookies'] });
      setFormData(initialFormData);
      setEditingId(null);
      setShowForm(false);
      toast({
        title: "Cookie updated",
        description: "Cookie has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update cookie",
        variant: "destructive",
      });
    },
  });

  // Delete cookie mutation
  const deleteCookieMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/gdpr/cookies/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/cookies'] });
      toast({
        title: "Cookie deleted",
        description: "Cookie has been removed from your inventory.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete cookie",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate data using Zod schema (omit organisationId as it's set server-side)
      const validatedData = insertCookieInventorySchema.omit({ 
        organisationId: true
      }).parse(formData);

      if (editingId) {
        updateCookieMutation.mutate({ id: editingId, data: formData });
      } else {
        createCookieMutation.mutate(formData);
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        toast({
          title: "Validation Error",
          description: "Please check your input data",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = (cookie: CookieInventory) => {
    setFormData({
      name: cookie.name,
      purpose: cookie.purpose,
      category: cookie.category,
      duration: cookie.duration,
      provider: cookie.provider,
      domain: cookie.domain,
      essential: cookie.essential,
      description: cookie.description,
    });
    setEditingId(cookie.id);
    setShowForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the cookie "${name}"? This action cannot be undone.`)) {
      deleteCookieMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setShowForm(false);
  };

  const updateFormField = (field: keyof CookieFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getCategoryBadge = (category: string) => {
    const categoryInfo = cookieCategories.find(c => c.value === category);
    return categoryInfo ? (
      <div className={`badge ${categoryInfo.color} gap-2`}>
        {categoryInfo.label}
      </div>
    ) : (
      <div className="badge badge-ghost">{category}</div>
    );
  };

  // Filter cookies based on search and category
  const filteredCookies = cookies?.filter(cookie => {
    const matchesSearch = searchTerm === '' || 
      cookie.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cookie.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cookie.provider.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || cookie.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Cookie Settings
          </h1>
          <p className="text-gray-600">
            Manage your organisation's cookie inventory for PECR compliance. 
            Document all cookies used on your website with their purpose, duration, and category.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="form-control flex-1">
            <div className="input-group">
              <span>
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search cookies..."
                className="input input-bordered flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-cookies"
              />
            </div>
          </div>

          {/* Organization Selector for Superadmins */}
          {user?.role === 'superadmin' && (
            <div className="form-control w-full lg:w-64">
              <select
                className="select select-bordered"
                value={selectedOrganisationId}
                onChange={(e) => setSelectedOrganisationId(e.target.value)}
                data-testid="select-organisation"
              >
                <option value="">Select Organisation...</option>
                {organizations?.map((org: any) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Category Filter */}
          <div className="form-control w-full lg:w-64">
            <select
              className="select select-bordered"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              data-testid="select-category-filter"
            >
              <option value="all">All Categories</option>
              {cookieCategories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Add Cookie Button */}
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
            data-testid="button-add-cookie"
          >
            <Plus className="w-4 h-4" />
            Add Cookie
          </button>
        </div>

        {/* Cookie Form Modal/Collapse */}
        {showForm && (
          <div className="card bg-base-100 shadow-sm border mb-6" data-testid="cookie-form">
            <div className="card-body">
              <h2 className="card-title text-lg">
                {editingId ? 'Edit Cookie' : 'Add New Cookie'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Cookie Name *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      required
                      data-testid="input-cookie-name"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Category *</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={formData.category}
                      onChange={(e) => updateFormField('category', e.target.value)}
                      required
                      data-testid="select-cookie-category"
                    >
                      {cookieCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Provider *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData.provider}
                      onChange={(e) => updateFormField('provider', e.target.value)}
                      required
                      placeholder="e.g., Google, Internal, Facebook"
                      data-testid="input-cookie-provider"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Duration *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData.duration}
                      onChange={(e) => updateFormField('duration', e.target.value)}
                      required
                      placeholder="e.g., Session, 30 days, 2 years"
                      data-testid="input-cookie-duration"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Domain *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData.domain}
                      onChange={(e) => updateFormField('domain', e.target.value)}
                      required
                      placeholder="e.g., .example.com, google.com"
                      data-testid="input-cookie-domain"
                    />
                  </div>

                  <div className="form-control">
                    <label className="cursor-pointer label justify-start">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary mr-3"
                        checked={formData.essential}
                        onChange={(e) => updateFormField('essential', e.target.checked)}
                        data-testid="checkbox-cookie-essential"
                      />
                      <span className="label-text">Essential Cookie</span>
                    </label>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Purpose *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.purpose}
                    onChange={(e) => updateFormField('purpose', e.target.value)}
                    required
                    placeholder="Brief purpose description"
                    data-testid="input-cookie-purpose"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Description *</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-24"
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    required
                    placeholder="Detailed description of what this cookie does and why it's needed"
                    data-testid="textarea-cookie-description"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleCancel}
                    data-testid="button-cancel-cookie"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn btn-primary ${(createCookieMutation.isPending || updateCookieMutation.isPending) ? 'loading' : ''}`}
                    disabled={createCookieMutation.isPending || updateCookieMutation.isPending}
                    data-testid="button-save-cookie"
                  >
                    {editingId ? 'Update Cookie' : 'Add Cookie'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cookie Inventory Table */}
        <div className="overflow-x-auto">
          {filteredCookies.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No cookies found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || categoryFilter !== 'all' 
                  ? 'No cookies match your current filters.' 
                  : 'Start building your cookie inventory by adding your first cookie.'}
              </p>
              {!searchTerm && categoryFilter === 'all' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowForm(true)}
                  data-testid="button-add-first-cookie"
                >
                  <Plus className="w-4 h-4" />
                  Add First Cookie
                </button>
              )}
            </div>
          ) : (
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Cookie Name</th>
                  <th>Category</th>
                  <th>Provider</th>
                  <th>Duration</th>
                  <th>Essential</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCookies.map((cookie) => (
                  <>
                    <tr key={cookie.id} className="hover">
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleRowExpansion(cookie.id)}
                            data-testid={`button-expand-${cookie.id}`}
                          >
                            {expandedRows.has(cookie.id) ? 
                              <ChevronUp className="w-3 h-3" /> : 
                              <ChevronDown className="w-3 h-3" />
                            }
                          </button>
                          <div>
                            <div className="font-medium">{cookie.name}</div>
                            <div className="text-sm text-gray-500">{cookie.domain}</div>
                          </div>
                        </div>
                      </td>
                      <td>{getCategoryBadge(cookie.category)}</td>
                      <td>{cookie.provider}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {cookie.duration}
                        </div>
                      </td>
                      <td>
                        {cookie.essential ? (
                          <div className="badge badge-error">Essential</div>
                        ) : (
                          <div className="badge badge-ghost">Optional</div>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleEdit(cookie)}
                            data-testid={`button-edit-${cookie.id}`}
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleDelete(cookie.id, cookie.name)}
                            data-testid={`button-delete-${cookie.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(cookie.id) && (
                      <tr>
                        <td colSpan={6} className="bg-base-200">
                          <div className="p-4 space-y-2">
                            <div>
                              <strong>Purpose:</strong> {cookie.purpose}
                            </div>
                            <div>
                              <strong>Description:</strong> {cookie.description}
                            </div>
                            <div className="text-xs text-gray-500">
                              Created: {new Date(cookie.createdAt!).toLocaleDateString()} | 
                              Updated: {new Date(cookie.updatedAt!).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary Stats */}
        {cookies && cookies.length > 0 && (
          <div className="stats shadow mt-6">
            <div className="stat">
              <div className="stat-title">Total Cookies</div>
              <div className="stat-value text-primary">{cookies.length}</div>
            </div>
            {cookieCategories.map(category => {
              const count = cookies.filter(c => c.category === category.value).length;
              return (
                <div key={category.value} className="stat">
                  <div className="stat-title">{category.label}</div>
                  <div className="stat-value text-sm">{count}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}