import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Building2, 
  Users, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  TestTube,
  Eye,
  Link
} from "lucide-react";

interface Organisation {
  id: string;
  name: string;
  subdomain: string;
  planId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionItemId?: string;
  billingStatus?: string;
  activeUserCount?: number;
  lastBillingSync?: string;
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  billingModel: 'metered_per_active_user' | 'per_seat' | 'flat_subscription';
  cadence: 'monthly' | 'annual';
  currency: string;
  unitAmount: number;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
}

export function SuperAdminSubscriptionManager() {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [showInvoicePreviewModal, setShowInvoicePreviewModal] = useState(false);
  const [selectedOrganisation, setSelectedOrganisation] = useState<Organisation | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [invoicePreviewData, setInvoicePreviewData] = useState<any>(null);
  const [subscribeFormData, setSubscribeFormData] = useState({
    planId: "",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all organizations
  const { data: organisations = [], isLoading: orgsLoading } = useQuery<Organisation[]>({
    queryKey: ['/api/organisations'],
    queryFn: async () => {
      const response = await fetch('/api/organisations', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch organisations: ${response.statusText}`);
      }
      return response.json();
    },
  });

  // Fetch all plans
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

  // Subscribe organization to plan
  const subscribeOrgMutation = useMutation({
    mutationFn: async ({ orgId, ...data }: { orgId: string } & typeof subscribeFormData) => {
      const response = await apiRequest('POST', `/api/organisations/${orgId}/subscribe`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organisation subscribed to plan successfully",
      });
      setShowSubscribeModal(false);
      setSelectedOrganisation(null);
      setSubscribeFormData({ planId: "", stripeCustomerId: "", stripeSubscriptionId: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to subscribe organisation",
        variant: "destructive",
      });
    },
  });

  // Sync organization usage
  const syncUsageMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await apiRequest('POST', `/api/organisations/${orgId}/sync-usage`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Usage synced: ${data.usage?.activeUserCount || 0} active users`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organisations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync usage",
        variant: "destructive",
      });
    },
  });

  // Test Stripe connection
  const testStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe/connection-test');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Success" : "Connection Failed",
        description: data.success 
          ? `Stripe connected successfully. Account: ${data.details?.accountId || 'Unknown'}` 
          : `Connection failed: ${data.details?.error || 'Unknown error'}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to test Stripe connection",
        variant: "destructive",
      });
    },
  });

  // Test plan validation
  const testPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', `/api/plans/${planId}/stripe-test`);
      return response.json();
    },
    onSuccess: (data: any) => {
      const isValid = data.status === 'match';
      toast({
        title: isValid ? "Plan Valid" : "Plan Issues Found",
        description: isValid 
          ? `Plan ${data.planName || 'Unknown'} is properly synced with Stripe`
          : `Issues found: ${data.mismatches?.join(', ') || 'Unknown issues'}`,
        variant: isValid ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to validate plan",
        variant: "destructive",
      });
    },
  });

  // Create test checkout session
  const testCheckoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', `/api/plans/${planId}/checkout-test`);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        toast({
          title: "Test Checkout Created",
          description: "Opening Stripe checkout in new tab",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create test checkout",
        variant: "destructive",
      });
    },
  });

  const handleSubscribeOrg = (org: Organisation) => {
    setSelectedOrganisation(org);
    setSubscribeFormData({
      planId: org.planId || "",
      stripeCustomerId: org.stripeCustomerId || "",
      stripeSubscriptionId: org.stripeSubscriptionId || "",
    });
    setShowSubscribeModal(true);
  };

  const handleSubmitSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrganisation) {
      subscribeOrgMutation.mutate({
        orgId: selectedOrganisation.id,
        ...subscribeFormData,
      });
    }
  };

  const handleTestPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowTestModal(true);
  };

  // Fetch subscription diagnostics
  const diagnosticsMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await fetch(`/api/subscription-diagnostics/${orgId}`, { 
        credentials: 'include' 
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch diagnostics: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setDiagnosticsData(data);
      setShowDiagnosticsModal(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch subscription diagnostics",
        variant: "destructive",
      });
    },
  });

  // Fetch invoice preview
  const invoicePreviewMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await apiRequest('POST', `/api/subscription-preview/${orgId}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      setInvoicePreviewData(data);
      setShowInvoicePreviewModal(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch invoice preview",
        variant: "destructive",
      });
    },
  });

  const getBillingStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <div className="badge badge-success badge-sm">Active</div>;
      case 'trialing':
        return <div className="badge badge-info badge-sm">Trialing</div>;
      case 'past_due':
        return <div className="badge badge-warning badge-sm">Past Due</div>;
      case 'canceled':
        return <div className="badge badge-error badge-sm">Canceled</div>;
      case 'unpaid':
        return <div className="badge badge-error badge-sm">Unpaid</div>;
      default:
        return <div className="badge badge-ghost badge-sm">No Subscription</div>;
    }
  };

  const formatPrice = (unitAmount: number, currency: string) => {
    const amount = unitAmount / 100;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getPlanById = (planId?: string) => {
    return plans.find(p => p.id === planId);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs">
        <ul>
          <li><span>SuperAdmin</span></li>
          <li><span className="font-semibold">Subscription Manager</span></li>
        </ul>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Subscription Manager</h1>
          <p className="text-base-content/60 mt-1">Manage organization subscriptions, usage tracking, and Stripe integration</p>
        </div>
        
        {/* Test Buttons */}
        <div className="flex gap-2">
          <button
            className={`btn btn-outline btn-sm ${testStripeMutation.isPending ? 'loading' : ''}`}
            onClick={() => testStripeMutation.mutate()}
            disabled={testStripeMutation.isPending}
            data-testid="button-test-stripe"
          >
            <Zap className="w-4 h-4 mr-2" />
            Test Stripe
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat bg-base-100 shadow-xl">
          <div className="stat-figure text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="stat-title">Total Organizations</div>
          <div className="stat-value text-primary">{organisations.length}</div>
        </div>
        
        <div className="stat bg-base-100 shadow-xl">
          <div className="stat-figure text-success">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div className="stat-title">Active Subscriptions</div>
          <div className="stat-value text-success">
            {organisations.filter(org => org.billingStatus === 'active').length}
          </div>
        </div>
        
        <div className="stat bg-base-100 shadow-xl">
          <div className="stat-figure text-warning">
            <Clock className="w-8 h-8" />
          </div>
          <div className="stat-title">Trial Subscriptions</div>
          <div className="stat-value text-warning">
            {organisations.filter(org => org.billingStatus === 'trialing').length}
          </div>
        </div>
        
        <div className="stat bg-base-100 shadow-xl">
          <div className="stat-figure text-error">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="stat-title">Issues</div>
          <div className="stat-value text-error">
            {organisations.filter(org => ['past_due', 'unpaid', 'canceled'].includes(org.billingStatus || '')).length}
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Organization Subscriptions</h2>
          
          {orgsLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : organisations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base-content/60">No organizations found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Plan</th>
                    <th>Billing Status</th>
                    <th>Active Users</th>
                    <th>Last Sync</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organisations.map((org) => {
                    const plan = getPlanById(org.planId);
                    return (
                      <tr key={org.id} data-testid={`row-org-${org.id}`}>
                        <td>
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-base-content/60">{org.subdomain}.replit.app</div>
                          </div>
                        </td>
                        <td>
                          {plan ? (
                            <div>
                              <div className="font-medium">{plan.name}</div>
                              <div className="text-sm text-base-content/60">
                                {formatPrice(plan.unitAmount, plan.currency)}/{plan.cadence === 'annual' ? 'year' : 'month'}
                              </div>
                              <div className="text-xs text-base-content/40 capitalize">
                                {plan.billingModel?.replace(/_/g, ' ') || 'No billing model'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-base-content/60">No plan assigned</div>
                          )}
                        </td>
                        <td>{getBillingStatusBadge(org.billingStatus)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-base-content/60" />
                            <span>{org.activeUserCount || 0}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm">
                            {org.lastBillingSync 
                              ? new Date(org.lastBillingSync).toLocaleDateString()
                              : '-'
                            }
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleSubscribeOrg(org)}
                              title="Manage Subscription"
                              data-testid={`button-manage-${org.id}`}
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                            <button
                              className={`btn btn-sm btn-ghost ${syncUsageMutation.isPending ? 'loading' : ''}`}
                              onClick={() => syncUsageMutation.mutate(org.id)}
                              title="Sync Usage"
                              disabled={syncUsageMutation.isPending}
                              data-testid={`button-sync-${org.id}`}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {org.stripeCustomerId && (
                              <>
                                <button
                                  className={`btn btn-sm btn-ghost ${diagnosticsMutation.isPending ? 'loading' : ''}`}
                                  onClick={() => diagnosticsMutation.mutate(org.id)}
                                  title="View Diagnostics"
                                  disabled={diagnosticsMutation.isPending}
                                  data-testid={`button-diagnostics-${org.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  className={`btn btn-sm btn-ghost ${invoicePreviewMutation.isPending ? 'loading' : ''}`}
                                  onClick={() => invoicePreviewMutation.mutate(org.id)}
                                  title="Invoice Preview"
                                  disabled={invoicePreviewMutation.isPending}
                                  data-testid={`button-invoice-${org.id}`}
                                >
                                  <TestTube className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Plans Testing Section */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Plan Testing & Diagnostics</h2>
          <p className="text-sm text-base-content/60 mb-4">Plans sorted by cost (lowest to highest)</p>
          
          {plansLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base-content/60">No plans found. Create plans first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...plans].sort((a, b) => a.unitAmount - b.unitAmount).map((plan) => (
                <div key={plan.id} className="card bg-base-200 shadow-lg" data-testid={`card-plan-${plan.id}`}>
                  <div className="card-body">
                    <h3 className="card-title text-base">{plan.name}</h3>
                    <p className="text-sm text-base-content/60">
                      {formatPrice(plan.unitAmount, plan.currency)}/{plan.cadence === 'annual' ? 'year' : 'month'}
                    </p>
                    <div className="text-xs text-base-content/40 capitalize mb-2">
                      {plan.billingModel?.replace(/_/g, ' ') || 'No billing model'}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      {plan.stripeProductId ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-error" />
                      )}
                      <span>Stripe Product: {plan.stripeProductId ? 'Synced' : 'Not Synced'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      {plan.stripePriceId ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-error" />
                      )}
                      <span>Stripe Price: {plan.stripePriceId ? 'Synced' : 'Not Synced'}</span>
                    </div>

                    <div className="card-actions justify-end mt-4">
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={() => handleTestPlan(plan)}
                        data-testid={`button-test-plan-${plan.id}`}
                      >
                        <TestTube className="w-3 h-3 mr-1" />
                        Test
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subscribe Organization Modal */}
      {showSubscribeModal && selectedOrganisation && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              Manage Subscription: {selectedOrganisation.name}
            </h3>
            
            <form onSubmit={handleSubmitSubscription} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Plan</span>
                </label>
                <select
                  className="select select-bordered"
                  value={subscribeFormData.planId}
                  onChange={(e) => setSubscribeFormData(prev => ({ ...prev, planId: e.target.value }))}
                  required
                  data-testid="select-plan"
                >
                  <option value="">Select a plan</option>
                  {[...plans].filter(p => p.isActive).sort((a, b) => a.unitAmount - b.unitAmount).map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatPrice(plan.unitAmount, plan.currency)}/{plan.cadence === 'annual' ? 'year' : 'month'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Stripe Customer ID</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={subscribeFormData.stripeCustomerId}
                  onChange={(e) => setSubscribeFormData(prev => ({ ...prev, stripeCustomerId: e.target.value }))}
                  placeholder="cus_..."
                  data-testid="input-stripe-customer-id"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Stripe Subscription ID</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={subscribeFormData.stripeSubscriptionId}
                  onChange={(e) => setSubscribeFormData(prev => ({ ...prev, stripeSubscriptionId: e.target.value }))}
                  placeholder="sub_..."
                  data-testid="input-stripe-subscription-id"
                />
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowSubscribeModal(false)}
                  data-testid="button-cancel-subscribe"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${subscribeOrgMutation.isPending ? 'loading' : ''}`}
                  disabled={subscribeOrgMutation.isPending}
                  data-testid="button-submit-subscribe"
                >
                  {subscribeOrgMutation.isPending ? 'Updating...' : 'Update Subscription'}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setShowSubscribeModal(false)}></div>
        </div>
      )}

      {/* Plan Testing Modal */}
      {showTestModal && selectedPlan && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              Test Plan: {selectedPlan.name}
            </h3>
            
            <div className="space-y-4">
              <div className="alert alert-info">
                <div>
                  <h4 className="font-bold">Plan Testing</h4>
                  <p>Use these tools to validate and test your plan configuration.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  className={`btn btn-outline ${testPlanMutation.isPending ? 'loading' : ''}`}
                  onClick={() => testPlanMutation.mutate(selectedPlan.id)}
                  disabled={testPlanMutation.isPending}
                  data-testid="button-validate-plan"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Validate Stripe Configuration
                </button>

                <button
                  className={`btn btn-outline ${testCheckoutMutation.isPending ? 'loading' : ''}`}
                  onClick={() => testCheckoutMutation.mutate(selectedPlan.id)}
                  disabled={testCheckoutMutation.isPending || !selectedPlan.stripePriceId}
                  data-testid="button-test-checkout"
                >
                  <Link className="w-4 h-4 mr-2" />
                  Create Test Checkout Session
                </button>
              </div>

              {!selectedPlan.stripePriceId && (
                <div className="alert alert-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Plan must be synced to Stripe before testing checkout.</span>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowTestModal(false)}
                data-testid="button-close-test-modal"
              >
                Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowTestModal(false)}></div>
        </div>
      )}

      {/* Subscription Diagnostics Modal */}
      {showDiagnosticsModal && diagnosticsData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              Subscription Diagnostics: {diagnosticsData.organisation?.name}
            </h3>
            
            <div className="space-y-6">
              {/* Database Info */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <h4 className="card-title text-base">Database Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Plan ID:</strong> {diagnosticsData.organisation?.planId || 'Not set'}
                    </div>
                    <div>
                      <strong>Active Users:</strong> {diagnosticsData.organisation?.activeUserCount || 0}
                    </div>
                    <div>
                      <strong>Billing Status:</strong> {diagnosticsData.organisation?.billingStatus || 'Not set'}
                    </div>
                    <div>
                      <strong>Last Sync:</strong> {diagnosticsData.organisation?.lastBillingSync ? 
                        new Date(diagnosticsData.organisation.lastBillingSync).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stripe IDs */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <h4 className="card-title text-base">Stripe IDs</h4>
                  <div className="space-y-2 text-sm font-mono">
                    <div>
                      <strong>Customer ID:</strong> {diagnosticsData.organisation?.stripeCustomerId || 'Not set'}
                    </div>
                    <div>
                      <strong>Subscription ID:</strong> {diagnosticsData.organisation?.stripeSubscriptionId || 'Not set'}
                    </div>
                    <div>
                      <strong>Subscription Item ID:</strong> {diagnosticsData.organisation?.stripeSubscriptionItemId || 'Not set'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stripe Data */}
              {diagnosticsData.stripeData && !diagnosticsData.stripeData.error && (
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h4 className="card-title text-base">Live Stripe Data</h4>
                    <div className="space-y-4">
                      {/* Customer */}
                      <div>
                        <h5 className="font-semibold">Customer</h5>
                        <div className="text-sm space-y-1">
                          <div><strong>ID:</strong> {diagnosticsData.stripeData.customer?.id}</div>
                          <div><strong>Email:</strong> {diagnosticsData.stripeData.customer?.email}</div>
                          <div><strong>Name:</strong> {diagnosticsData.stripeData.customer?.name}</div>
                        </div>
                      </div>

                      {/* Subscription */}
                      <div>
                        <h5 className="font-semibold">Subscription</h5>
                        <div className="text-sm space-y-1">
                          <div><strong>ID:</strong> {diagnosticsData.stripeData.subscription?.id}</div>
                          <div><strong>Status:</strong> {diagnosticsData.stripeData.subscription?.status}</div>
                          <div><strong>Current Period:</strong> {
                            diagnosticsData.stripeData.subscription?.current_period_start ? 
                            `${new Date(diagnosticsData.stripeData.subscription.current_period_start * 1000).toLocaleDateString()} - ${new Date(diagnosticsData.stripeData.subscription.current_period_end * 1000).toLocaleDateString()}` : 'Not set'
                          }</div>
                        </div>
                      </div>

                      {/* Subscription Items */}
                      <div>
                        <h5 className="font-semibold">Subscription Items</h5>
                        {diagnosticsData.stripeData.items?.map((item: any, index: number) => (
                          <div key={item.id} className="bg-base-100 p-3 rounded text-sm space-y-1">
                            <div><strong>Item ID:</strong> {item.id}</div>
                            <div><strong>Price ID:</strong> {item.price_id}</div>
                            <div><strong>Quantity:</strong> {item.quantity}</div>
                            <div><strong>Unit Amount:</strong> {item.unit_amount / 100} {item.currency?.toUpperCase()}</div>
                            <div><strong>Billing:</strong> {item.usage_type} / {item.interval}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDiagnosticsModal(false)}
                data-testid="button-close-diagnostics"
              >
                Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDiagnosticsModal(false)}></div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreviewModal && invoicePreviewData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              Upcoming Invoice Preview
            </h3>
            
            {invoicePreviewData.success ? (
              <div className="space-y-4">
                <div className="alert alert-info">
                  <div>
                    <h4 className="font-bold">Dry Run Preview</h4>
                    <p>This shows what the upcoming invoice will look like based on current subscription.</p>
                  </div>
                </div>

                <div className="card bg-base-200">
                  <div className="card-body">
                    <h4 className="card-title text-base">Invoice Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Amount Due:</strong> {(invoicePreviewData.invoice?.amount_due || 0) / 100} {invoicePreviewData.invoice?.currency?.toUpperCase()}
                      </div>
                      <div>
                        <strong>Currency:</strong> {invoicePreviewData.invoice?.currency?.toUpperCase()}
                      </div>
                      <div>
                        <strong>Period:</strong> {
                          invoicePreviewData.invoice?.period_start ? 
                          `${new Date(invoicePreviewData.invoice.period_start * 1000).toLocaleDateString()} - ${new Date(invoicePreviewData.invoice.period_end * 1000).toLocaleDateString()}` : 'Not set'
                        }
                      </div>
                      <div>
                        <strong>Status:</strong> {invoicePreviewData.invoice?.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-200">
                  <div className="card-body">
                    <h4 className="card-title text-base">Line Items</h4>
                    <div className="space-y-2">
                      {invoicePreviewData.invoice?.line_items?.map((item: any, index: number) => (
                        <div key={item.id || index} className="bg-base-100 p-3 rounded text-sm">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div><strong>Description:</strong> {item.description}</div>
                              <div><strong>Quantity:</strong> {item.quantity}</div>
                              <div><strong>Price ID:</strong> {item.price_id}</div>
                              <div><strong>Period:</strong> {
                                item.period?.start ? 
                                `${new Date(item.period.start * 1000).toLocaleDateString()} - ${new Date(item.period.end * 1000).toLocaleDateString()}` : 'Not set'
                              }</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {(item.amount || 0) / 100} {item.currency?.toUpperCase()}
                              </div>
                              <div className="text-xs text-base-content/60">
                                {(item.unit_amount || 0) / 100} × {item.quantity}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert alert-error">
                <div>
                  <h4 className="font-bold">Error</h4>
                  <p>{invoicePreviewData.message || 'Failed to retrieve invoice preview'}</p>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowInvoicePreviewModal(false)}
                data-testid="button-close-invoice-preview"
              >
                Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowInvoicePreviewModal(false)}></div>
        </div>
      )}
    </div>
  );
}