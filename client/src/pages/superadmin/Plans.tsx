import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit3, Trash2, Settings, Check, X } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description?: string;
  pricePerUser: number;
  status: 'active' | 'inactive' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  features?: PlanFeature[];
}

interface PlanFeature {
  id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SuperAdminPlans() {
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [showDeletePlanModal, setShowDeletePlanModal] = useState(false);
  const [showCreateFeatureModal, setShowCreateFeatureModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activeTab, setActiveTab] = useState<'plans' | 'features'>('plans');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [planFormData, setPlanFormData] = useState({
    name: "",
    description: "",
    pricePerUser: "",
    status: "active" as const,
    featureIds: [] as string[],
  });

  const [featureFormData, setFeatureFormData] = useState({
    key: "",
    name: "",
    description: "",
    category: "",
    isDefault: false,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['/api/plans'],
    queryFn: async () => {
      const response = await fetch('/api/plans', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch plans: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: planFeatures = [], isLoading: featuresLoading } = useQuery<PlanFeature[]>({
    queryKey: ['/api/plan-features'],
    queryFn: async () => {
      const response = await fetch('/api/plan-features', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch plan features: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (planData: typeof planFormData) => {
      return apiRequest('POST', '/api/plans', planData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan created successfully",
      });
      setShowCreatePlanModal(false);
      setPlanFormData({
        name: "",
        description: "",
        pricePerUser: "",
        status: "active",
        featureIds: [],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plan",
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, ...planData }: typeof planFormData & { id: string }) => {
      return apiRequest('PUT', `/api/plans/${id}`, planData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan updated successfully",
      });
      setShowEditPlanModal(false);
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/plans/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
      setShowDeletePlanModal(false);
      setSelectedPlan(null);
      setDeleteConfirmText("");
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
        variant: "destructive",
      });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: async (featureData: typeof featureFormData) => {
      return apiRequest('POST', '/api/plan-features', featureData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan feature created successfully",
      });
      setShowCreateFeatureModal(false);
      setFeatureFormData({
        key: "",
        name: "",
        description: "",
        category: "",
        isDefault: false,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plan-features'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plan feature",
        variant: "destructive",
      });
    },
  });

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    createPlanMutation.mutate(planFormData);
  };

  const handleEditPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setPlanFormData({
      name: plan.name,
      description: plan.description || "",
      pricePerUser: plan.pricePerUser.toString(),
      status: plan.status,
      featureIds: plan.features?.map(f => f.id) || [],
    });
    setShowEditPlanModal(true);
  };

  const handleUpdatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlan) {
      updatePlanMutation.mutate({ id: selectedPlan.id, ...planFormData });
    }
  };

  const handleDeletePlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowDeletePlanModal(true);
  };

  const confirmDeletePlan = () => {
    if (selectedPlan && deleteConfirmText === selectedPlan.name) {
      deletePlanMutation.mutate(selectedPlan.id);
    }
  };

  const handleCreateFeature = (e: React.FormEvent) => {
    e.preventDefault();
    createFeatureMutation.mutate(featureFormData);
  };

  const handleFeatureToggle = (featureId: string) => {
    setPlanFormData(prev => ({
      ...prev,
      featureIds: prev.featureIds.includes(featureId)
        ? prev.featureIds.filter(id => id !== featureId)
        : [...prev.featureIds, featureId]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="badge badge-success badge-sm">Active</div>;
      case 'inactive':
        return <div className="badge badge-warning badge-sm">Inactive</div>;
      case 'archived':
        return <div className="badge badge-ghost badge-sm">Archived</div>;
      default:
        return <div className="badge badge-ghost badge-sm">{status}</div>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const groupedFeatures = planFeatures.reduce((acc, feature) => {
    const category = feature.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, PlanFeature[]>);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs">
        <ul>
          <li><span>SuperAdmin</span></li>
          <li><span className="font-semibold">Plans</span></li>
        </ul>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Plan Management</h1>
          <p className="text-base-content/60 mt-1">Create and manage payment plans with feature-based access controls</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed w-fit">
        <button 
          className={`tab ${activeTab === 'plans' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('plans')}
          data-testid="tab-plans"
        >
          Plans ({plans.length})
        </button>
        <button 
          className={`tab ${activeTab === 'features' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('features')}
          data-testid="tab-features"
        >
          Features ({planFeatures.length})
        </button>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* Create Plan Button */}
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreatePlanModal(true)}
              data-testid="button-create-plan"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </button>
          </div>

          {/* Plans Table */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {plansLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-base-content/60">No plans found. Create your first plan to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Description</th>
                        <th>Price per User</th>
                        <th>Status</th>
                        <th>Features</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <td>
                            <div className="font-medium">{plan.name}</div>
                          </td>
                          <td>
                            <div className="max-w-xs truncate" title={plan.description}>
                              {plan.description || '-'}
                            </div>
                          </td>
                          <td>
                            <div className="font-mono font-medium text-primary">
                              {formatPrice(plan.pricePerUser)}/month
                            </div>
                          </td>
                          <td>{getStatusBadge(plan.status)}</td>
                          <td>
                            <div className="text-sm">
                              {plan.features ? `${plan.features.length} features` : '0 features'}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm">
                              {new Date(plan.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => handleEditPlan(plan)}
                                title="Edit Plan"
                                data-testid={`button-edit-plan-${plan.id}`}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                className="btn btn-sm btn-ghost text-error hover:bg-error/10"
                                onClick={() => handleDeletePlan(plan)}
                                title="Delete Plan"
                                data-testid={`button-delete-plan-${plan.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="space-y-4">
          {/* Create Feature Button */}
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateFeatureModal(true)}
              data-testid="button-create-feature"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Feature
            </button>
          </div>

          {/* Features Grid */}
          <div className="space-y-6">
            {featuresLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : planFeatures.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-base-content/60">No plan features found. Create your first feature to get started.</p>
              </div>
            ) : (
              Object.entries(groupedFeatures).map(([category, features]) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-lg font-semibold capitalize">{category} Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((feature) => (
                      <div key={feature.id} className="card bg-base-100 shadow-xl" data-testid={`card-feature-${feature.id}`}>
                        <div className="card-body">
                          <div className="flex justify-between items-start">
                            <h4 className="card-title text-base">{feature.name}</h4>
                            {feature.isDefault && (
                              <div className="badge badge-info badge-sm">Default</div>
                            )}
                          </div>
                          <p className="text-sm text-base-content/60">
                            {feature.description || 'No description provided'}
                          </p>
                          <div className="text-xs text-base-content/40 mt-2">
                            Key: <code className="bg-base-200 px-1 py-0.5 rounded">{feature.key}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreatePlanModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Create New Plan</h3>
            
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Plan Name *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    data-testid="input-plan-name"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Price per User (Monthly) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-bordered"
                    value={planFormData.pricePerUser}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, pricePerUser: e.target.value }))}
                    required
                    data-testid="input-plan-price"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this plan"
                  data-testid="input-plan-description"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered"
                  value={planFormData.status}
                  onChange={(e) => setPlanFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  data-testid="select-plan-status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Plan Features */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Plan Features</span>
                </label>
                <div className="bg-base-200 p-4 rounded-lg max-h-64 overflow-y-auto space-y-3">
                  {Object.entries(groupedFeatures).map(([category, features]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-sm capitalize mb-2">{category}</h4>
                      <div className="space-y-2 ml-4">
                        {features.map((feature) => (
                          <label key={feature.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={planFormData.featureIds.includes(feature.id)}
                              onChange={() => handleFeatureToggle(feature.id)}
                              data-testid={`checkbox-feature-${feature.id}`}
                            />
                            <div>
                              <div className="text-sm font-medium">{feature.name}</div>
                              <div className="text-xs text-base-content/60">{feature.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreatePlanModal(false)}
                  data-testid="button-cancel-create-plan"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${createPlanMutation.isPending ? 'loading' : ''}`}
                  disabled={createPlanMutation.isPending}
                  data-testid="button-submit-create-plan"
                >
                  {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreatePlanModal(false)}></div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditPlanModal && selectedPlan && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Edit Plan: {selectedPlan.name}</h3>
            
            <form onSubmit={handleUpdatePlan} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Plan Name *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    data-testid="input-edit-plan-name"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Price per User (Monthly) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-bordered"
                    value={planFormData.pricePerUser}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, pricePerUser: e.target.value }))}
                    required
                    data-testid="input-edit-plan-price"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this plan"
                  data-testid="input-edit-plan-description"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered"
                  value={planFormData.status}
                  onChange={(e) => setPlanFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  data-testid="select-edit-plan-status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Plan Features */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Plan Features</span>
                </label>
                <div className="bg-base-200 p-4 rounded-lg max-h-64 overflow-y-auto space-y-3">
                  {Object.entries(groupedFeatures).map(([category, features]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-sm capitalize mb-2">{category}</h4>
                      <div className="space-y-2 ml-4">
                        {features.map((feature) => (
                          <label key={feature.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={planFormData.featureIds.includes(feature.id)}
                              onChange={() => handleFeatureToggle(feature.id)}
                              data-testid={`checkbox-edit-feature-${feature.id}`}
                            />
                            <div>
                              <div className="text-sm font-medium">{feature.name}</div>
                              <div className="text-xs text-base-content/60">{feature.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowEditPlanModal(false)}
                  data-testid="button-cancel-edit-plan"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${updatePlanMutation.isPending ? 'loading' : ''}`}
                  disabled={updatePlanMutation.isPending}
                  data-testid="button-submit-edit-plan"
                >
                  {updatePlanMutation.isPending ? 'Updating...' : 'Update Plan'}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setShowEditPlanModal(false)}></div>
        </div>
      )}

      {/* Delete Plan Modal */}
      {showDeletePlanModal && selectedPlan && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 text-error">Delete Plan</h3>
            
            <div className="space-y-4">
              <div className="alert alert-warning">
                <div>
                  <h4 className="font-bold">Warning!</h4>
                  <p>This action cannot be undone. This will permanently delete the plan and remove it from any organizations that are currently using it.</p>
                </div>
              </div>

              <div>
                <p className="mb-2">
                  Please type <strong>{selectedPlan.name}</strong> to confirm:
                </p>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={selectedPlan.name}
                  data-testid="input-delete-confirm"
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowDeletePlanModal(false);
                  setDeleteConfirmText("");
                }}
                data-testid="button-cancel-delete-plan"
              >
                Cancel
              </button>
              <button
                className={`btn btn-error ${deletePlanMutation.isPending ? 'loading' : ''}`}
                disabled={deleteConfirmText !== selectedPlan.name || deletePlanMutation.isPending}
                onClick={confirmDeletePlan}
                data-testid="button-confirm-delete-plan"
              >
                {deletePlanMutation.isPending ? 'Deleting...' : 'Delete Plan'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDeletePlanModal(false)}></div>
        </div>
      )}

      {/* Create Feature Modal */}
      {showCreateFeatureModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Create New Plan Feature</h3>
            
            <form onSubmit={handleCreateFeature} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Feature Key *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered font-mono"
                    value={featureFormData.key}
                    onChange={(e) => setFeatureFormData(prev => ({ ...prev, key: e.target.value }))}
                    placeholder="e.g., custom_branding"
                    required
                    data-testid="input-feature-key"
                  />
                  <label className="label">
                    <span className="label-text-alt">Used as unique identifier</span>
                  </label>
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Display Name *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={featureFormData.name}
                    onChange={(e) => setFeatureFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Custom Branding"
                    required
                    data-testid="input-feature-name"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Category</span>
                </label>
                <select
                  className="select select-bordered"
                  value={featureFormData.category}
                  onChange={(e) => setFeatureFormData(prev => ({ ...prev, category: e.target.value }))}
                  data-testid="select-feature-category"
                >
                  <option value="">Select category...</option>
                  <option value="branding">Branding</option>
                  <option value="customization">Customization</option>
                  <option value="functionality">Functionality</option>
                  <option value="support">Support</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={featureFormData.description}
                  onChange={(e) => setFeatureFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this feature enables"
                  data-testid="input-feature-description"
                />
              </div>

              <div className="form-control">
                <label className="cursor-pointer label">
                  <span className="label-text">Include by default in new plans</span>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={featureFormData.isDefault}
                    onChange={(e) => setFeatureFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    data-testid="checkbox-feature-default"
                  />
                </label>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateFeatureModal(false)}
                  data-testid="button-cancel-create-feature"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${createFeatureMutation.isPending ? 'loading' : ''}`}
                  disabled={createFeatureMutation.isPending}
                  data-testid="button-submit-create-feature"
                >
                  {createFeatureMutation.isPending ? 'Creating...' : 'Create Feature'}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreateFeatureModal(false)}></div>
        </div>
      )}
    </div>
  );
}