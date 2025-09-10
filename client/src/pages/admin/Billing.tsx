import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Plan {
  id: string;
  name: string;
  description?: string;
  billingModel: 'metered_per_active_user' | 'per_seat' | 'flat_subscription';
  cadence: 'monthly' | 'annual';
  currency: string;
  unitAmount: number;
  minSeats?: number;
  status: 'active' | 'inactive' | 'archived';
  features?: PlanFeature[];
  stripeProductId?: string;
  stripePriceId?: string;
}

interface PlanFeature {
  id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  isDefault: boolean;
}

interface Organisation {
  id: string;
  name: string;
  displayName: string;
  planId?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: string;
  activeUserCount?: number;
  lastBillingSync?: string;
}

interface OrganisationStats {
  activeUsers: number;
  adminUsers: number;
  coursesAssigned: number;
  completedCourses: number;
  totalUsers: number;
  averageScore: number;
}

export function AdminBilling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Local state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [showDecreaseWarning, setShowDecreaseWarning] = useState(false);

  // Verify Stripe payment and handle success/cancel from checkout
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');
    
    if (success === 'true' && sessionId) {
      // Verify the payment with Stripe before updating UI
      setIsVerifyingPayment(true);
      
      fetch(`/api/subscriptions/verify/${sessionId}`, {
        credentials: 'include'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          toast({
            title: "Payment Successful!",
            description: "Your subscription has been updated successfully.",
          });
          
          // Refresh the organisation data to show updated billing
          queryClient.invalidateQueries({ queryKey: ['/api/organisations', user?.organisationId] });
        } else {
          toast({
            title: "Payment Verification Failed",
            description: data.message || "Unable to verify your payment. Please contact support if this persists.",
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error('Payment verification error:', error);
        toast({
          title: "Payment Verification Error",
          description: "Unable to verify your payment status. Please contact support.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsVerifyingPayment(false);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    } else if (canceled === 'true') {
      toast({
        title: "Payment Canceled",
        description: "Your subscription update was canceled. No changes were made.",
        variant: "destructive",
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, queryClient, user?.organisationId]);

  const { data: organisation, isLoading: orgLoading } = useQuery<Organisation>({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
    queryFn: async () => {
      const response = await fetch(`/api/organisations/${user?.organisationId}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch organisation: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: organisationStats, isLoading: statsLoading } = useQuery<OrganisationStats>({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch organisation stats: ${response.statusText}`);
      }
      return response.json();
    },
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

  const { data: allPlanFeatures = [], isLoading: featuresLoading } = useQuery<PlanFeature[]>({
    queryKey: ['/api/plan-features'],
    queryFn: async () => {
      const response = await fetch('/api/plan-features', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch plan features: ${response.statusText}`);
      }
      return response.json();
    },
  });

  // Find the current plan based on organization's planId
  const currentPlan = plans.find(plan => plan.id === organisation?.planId);
  const currentPlanName = currentPlan?.name || "No Plan";

  // Helper function to format price
  const formatPrice = (unitAmount: number, currency: string) => {
    const amount = unitAmount / 100; // Convert from minor units
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    return `${symbol}${amount.toFixed(2)}`;
  };

  // Helper function to get billing model display text
  const getBillingModelText = (billingModel: string) => {
    switch (billingModel) {
      case 'metered_per_active_user': return 'Per Active User';
      case 'per_seat': return 'Per Seat';
      case 'flat_subscription': return 'Flat Rate';
      default: return billingModel;
    }
  };

  // Calculate current subscription cost (what they're actually paying now)
  const getCurrentSubscriptionCost = () => {
    if (!currentPlan || !organisation) return 0;
    
    const currentUserCount = getCurrentUserCount();
    
    switch (currentPlan.billingModel) {
      case 'metered_per_active_user':
      case 'per_seat':
        return currentUserCount * (currentPlan.unitAmount / 100);
      case 'flat_subscription':
        return currentPlan.unitAmount / 100;
      default:
        return currentPlan.unitAmount / 100;
    }
  };

  // Calculate updated subscription cost (based on selected user count)
  const getUpdatedSubscriptionCost = () => {
    if (!currentPlan) return 0;
    
    switch (currentPlan.billingModel) {
      case 'metered_per_active_user':
      case 'per_seat':
        return userCount * (currentPlan.unitAmount / 100);
      case 'flat_subscription':
        return currentPlan.unitAmount / 100;
      default:
        return currentPlan.unitAmount / 100;
    }
  };

  // Handle user count change
  const handleUserCountChange = (newCount: number) => {
    const currentCount = getCurrentUserCount();
    
    if (newCount < currentCount) {
      setShowDecreaseWarning(true);
      return;
    }
    
    setUserCount(newCount);
  };

  // Get current user count based on billing model
  const getCurrentUserCount = () => {
    if (!currentPlan || !organisation) return 0;
    
    switch (currentPlan.billingModel) {
      case 'metered_per_active_user':
        return organisation.activeUserCount || 0;
      case 'per_seat':
        return organisation.activeUserCount || 0;
      case 'flat_subscription':
        return organisationStats?.totalUsers || 0; // Show total for flat rate
      default:
        return 0;
    }
  };

  // Initialize user count when plan data loads
  useState(() => {
    if (organisation && currentPlan) {
      const currentCount = getCurrentUserCount();
      setUserCount(currentCount);
    }
  });

  // Mutation to change plan - redirects to Stripe checkout instead of immediate update
  const changePlanMutation = useMutation({
    mutationFn: async ({ planId, userCount: newUserCount }: { planId: string; userCount?: number }) => {
      // Instead of updating immediately, create Stripe checkout for plan change
      const response = await fetch(`/api/subscriptions/change-plan-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          userCount: newUserCount,
          organisationId: user?.organisationId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create checkout session');
      }
      
      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        const stripeWindow = window.open(data.checkoutUrl, '_blank');
        
        if (!stripeWindow || stripeWindow.closed || typeof stripeWindow.closed === 'undefined') {
          window.location.href = data.checkoutUrl;
        } else {
          stripeWindow.focus();
        }
      } else {
        throw new Error('No checkout URL returned');
      }
      
      return data;
    },
    onSuccess: () => {
      setShowPlanChangeModal(false);
      setSelectedPlan(null);
      
      toast({
        title: "Redirecting to Checkout",
        description: "Complete payment to activate your new plan",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  // Mutation to update subscription (for existing plan user count changes)
  const updateSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!currentPlan?.stripePriceId) {
        throw new Error('No Stripe integration available for this plan');
      }

      const response = await fetch(`/api/subscriptions/update-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          planId: currentPlan.id,
          userCount,
          organisationId: user?.organisationId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create checkout session');
      }
      
      const data = await response.json();
      
      console.log('Received response from /api/subscriptions/update-checkout:', data);
      
      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        console.log('Redirecting to checkout URL:', data.checkoutUrl);
        
        // Try window.open first (more reliable for external URLs)
        const stripeWindow = window.open(data.checkoutUrl, '_blank');
        
        // Check if popup was blocked
        if (!stripeWindow || stripeWindow.closed || typeof stripeWindow.closed === 'undefined') {
          console.warn('Popup blocked, trying window.location.href');
          window.location.href = data.checkoutUrl;
        } else {
          console.log('Opened Stripe checkout in new window');
          // Focus the new window
          stripeWindow.focus();
        }
      } else {
        console.error('No checkout URL in response:', data);
        throw new Error('No checkout URL returned');
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  // Handle plan selection and user count setup
  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    
    // Set initial user count based on plan requirements
    const minCount = plan.minSeats || 1;
    const currentCount = Math.max(getCurrentUserCount(), minCount);
    setUserCount(currentCount);
    
    setShowPlanChangeModal(true);
  };

  // Handle plan change confirmation
  const handleConfirmPlanChange = () => {
    if (!selectedPlan) return;
    
    changePlanMutation.mutate({
      planId: selectedPlan.id,
      userCount: selectedPlan.billingModel !== 'flat_subscription' ? userCount : undefined
    });
  };

  // Show loading overlay during payment verification
  if (isVerifyingPayment) {
    return (
      <div className="container mx-auto p-6">
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="payment-verification-loading">
          <div className="bg-base-100 p-8 rounded-lg shadow-lg text-center">
            <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Verifying Payment</h3>
            <p className="text-base-content/60">Please wait while we confirm your payment with Stripe...</p>
          </div>
        </div>
        
        {/* Show the page content behind the overlay */}
        <div className="opacity-30">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          </div>
          <div className="text-base-content/60">Verifying payment...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Billing & Subscription</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Billing & Subscription</h1>
        <div className="flex gap-2">
          <button className="btn btn-outline" data-testid="button-contact-sales">
            <i className="fas fa-phone"></i> Contact Sales
          </button>
          {currentPlan && organisation?.stripeSubscriptionId && (
            <button 
              className={`btn btn-primary ${updateSubscriptionMutation.isPending ? 'loading' : ''}`}
              onClick={() => updateSubscriptionMutation.mutate()}
              disabled={updateSubscriptionMutation.isPending}
              data-testid="button-update-subscription"
            >
              <i className="fas fa-credit-card"></i> 
              {updateSubscriptionMutation.isPending ? 'Processing...' : 'Update Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Current Subscription */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          {orgLoading ? (
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="skeleton h-8 w-48 mb-2"></div>
                <div className="skeleton h-4 w-64 mb-4"></div>
                <div className="skeleton h-10 w-32"></div>
              </div>
              <div className="text-right">
                <div className="skeleton h-6 w-16 mb-2"></div>
                <div className="skeleton h-4 w-32 mb-1"></div>
                <div className="skeleton h-4 w-24"></div>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-2" data-testid="text-plan-name">
                  {currentPlan?.name || "No Plan Assigned"}
                </h2>
                <p className="text-base-content/60 mb-2" data-testid="text-plan-description">
                  {currentPlan?.description || "No plan description available"}
                </p>
                {currentPlan && (
                  <div className="mb-4">
                    <div className="badge badge-info mr-2" data-testid="badge-billing-model">
                      {getBillingModelText(currentPlan.billingModel)}
                    </div>
                    <div className="badge badge-secondary" data-testid="badge-cadence">
                      {currentPlan.cadence}
                    </div>
                  </div>
                )}
                <div className="text-3xl font-bold text-primary" data-testid="text-plan-price">
                  {currentPlan ? (
                    <>
                      {formatPrice(currentPlan.unitAmount, currentPlan.currency)}
                      <span className="text-base font-normal">
                        {currentPlan.billingModel === 'flat_subscription' 
                          ? `/${currentPlan.cadence}` 
                          : `/user/${currentPlan.cadence === 'annual' ? 'year' : 'month'}`
                        }
                      </span>
                    </>
                  ) : (
                    <span className="text-lg">Contact support for pricing</span>
                  )}
                </div>
                {currentPlan && organisation && (
                  <div className="mt-2 space-y-1">
                    <div className="text-lg font-semibold text-secondary">
                      Current Cost: {formatPrice(getCurrentSubscriptionCost() * 100, currentPlan.currency)}/{currentPlan.cadence === 'annual' ? 'year' : 'month'}
                    </div>
                    {userCount > getCurrentUserCount() && currentPlan.billingModel !== 'flat_subscription' && (
                      <div className="text-lg font-semibold text-primary">
                        Updated Cost: {formatPrice(getUpdatedSubscriptionCost() * 100, currentPlan.currency)}/{currentPlan.cadence === 'annual' ? 'year' : 'month'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`badge mb-2 ${organisation?.billingStatus === 'active' ? 'badge-success' : 'badge-warning'}`} data-testid="badge-billing-status">
                  {organisation?.billingStatus || organisation?.status || 'Unknown'}
                </div>
                <div className="text-sm text-base-content/60">
                  <div data-testid="text-organisation-name">{organisation?.displayName}</div>
                  <div data-testid="text-user-count">
                    {getCurrentUserCount()} {currentPlan?.billingModel === 'metered_per_active_user' ? 'active' : ''} users
                  </div>
                  {organisation?.stripeSubscriptionId && (
                    <div className="text-xs mt-1" data-testid="text-stripe-status">
                      Stripe Active
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Management (only show if on a plan) */}
      {currentPlan && (
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body">
            <h3 className="text-xl font-bold mb-4">User Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">
                  <span className="label-text font-medium">
                    {currentPlan.billingModel === 'metered_per_active_user' ? 'Active Users' : 
                     currentPlan.billingModel === 'per_seat' ? 'Licensed Seats' : 
                     'Total Users'}
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input input-bordered flex-1"
                    value={userCount}
                    onChange={(e) => handleUserCountChange(parseInt(e.target.value) || 0)}
                    onWheel={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      // Prevent arrow keys from changing value
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                      }
                    }}
                    min={currentPlan.minSeats || 1}
                    step={1}
                    disabled={currentPlan.billingModel === 'flat_subscription'}
                    data-testid="input-user-count"
                  />
                  {userCount > getCurrentUserCount() && currentPlan.billingModel !== 'flat_subscription' && (
                    <button
                      className={`btn btn-primary ${updateSubscriptionMutation.isPending ? 'loading' : ''}`}
                      onClick={() => updateSubscriptionMutation.mutate()}
                      disabled={updateSubscriptionMutation.isPending}
                      data-testid="button-update-user-count"
                    >
                      Update
                    </button>
                  )}
                </div>
                <div className="label">
                  <span className="label-text-alt">
                    {currentPlan.billingModel === 'flat_subscription' 
                      ? 'Unlimited users included'
                      : `Minimum: ${currentPlan.minSeats || 1} users`
                    }
                  </span>
                </div>
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text font-medium">Usage Overview</span>
                </label>
                <div className="stats stats-vertical lg:stats-horizontal">
                  <div className="stat">
                    <div className="stat-title">Active</div>
                    <div className="stat-value text-sm">{organisationStats?.activeUsers || 0}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Total</div>
                    <div className="stat-value text-sm">{organisationStats?.totalUsers || 0}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Admins</div>
                    <div className="stat-value text-sm">{organisationStats?.adminUsers || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="stat bg-base-200 rounded-lg shadow-sm">
              <div className="stat-figure">
                <div className="skeleton w-8 h-8 rounded-full"></div>
              </div>
              <div className="skeleton h-4 w-16 mb-2"></div>
              <div className="skeleton h-8 w-12 mb-2"></div>
              <div className="skeleton h-3 w-20"></div>
            </div>
          ))
        ) : (
          <>
            <div className="stat bg-base-200 rounded-lg shadow-sm">
              <div className="stat-figure text-primary">
                <i className="fas fa-users text-2xl"></i>
              </div>
              <div className="stat-title">Active Users</div>
              <div className="stat-value text-primary" data-testid="stat-users-count">
                {organisationStats?.activeUsers || 0}
              </div>
              <div className="stat-desc" data-testid="stat-users-total">
                of {organisationStats?.totalUsers || 0} total users
              </div>
              {currentPlan?.billingModel === 'metered_per_active_user' && (
                <div className="mt-2">
                  <div className="text-xs text-base-content/60">
                    Billing basis: Active users only
                  </div>
                </div>
              )}
            </div>
            
            <div className="stat bg-base-200 rounded-lg shadow-sm">
              <div className="stat-figure text-secondary">
                <i className="fas fa-graduation-cap text-2xl"></i>
              </div>
              <div className="stat-title">Course Assignments</div>
              <div className="stat-value text-secondary" data-testid="stat-assignments-count">
                {organisationStats?.coursesAssigned || 0}
              </div>
              <div className="stat-desc" data-testid="stat-assignments-period">
                Total assigned
              </div>
            </div>
            
            <div className="stat bg-base-200 rounded-lg shadow-sm">
              <div className="stat-figure text-accent">
                <i className="fas fa-trophy text-2xl"></i>
              </div>
              <div className="stat-title">Completed Courses</div>
              <div className="stat-value text-accent" data-testid="stat-completed-count">
                {organisationStats?.completedCourses || 0}
              </div>
              <div className="stat-desc" data-testid="stat-average-score">
                Avg score: {organisationStats?.averageScore ? `${organisationStats.averageScore.toFixed(1)}%` : 'N/A'}
              </div>
              {organisationStats?.coursesAssigned ? (
                <div className="mt-2">
                  <progress 
                    className="progress progress-accent w-full" 
                    value={organisationStats.completedCourses || 0} 
                    max={organisationStats.coursesAssigned}
                  ></progress>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Available Plans */}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">Available Plans</h3>
        
        {(plansLoading || featuresLoading) ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <div className="skeleton h-6 w-32 mb-2"></div>
                  <div className="skeleton h-8 w-24 mb-4"></div>
                  <div className="space-y-2 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="skeleton h-4 w-full"></div>
                    ))}
                  </div>
                  <div className="skeleton h-8 w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans
              .filter(plan => plan.status === 'active')
              .map((plan) => {
                const isCurrentPlan = plan.id === organisation?.planId;
                const planFeatureIds = plan.features?.map(f => f.id) || [];
                
                return (
                  <div 
                    key={plan.id} 
                    className={`card bg-base-100 shadow-sm ${isCurrentPlan ? 'border-2 border-primary' : ''}`}
                    data-testid={`plan-card-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="card-body">
                      {isCurrentPlan && (
                        <div className="badge badge-primary mb-2" data-testid="badge-current-plan">
                          Current Plan
                        </div>
                      )}
                      <h4 className="card-title" data-testid={`text-plan-name-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        {plan.name}
                      </h4>
                      
                      <div className="mb-2">
                        <div className="badge badge-info mr-2">
                          {getBillingModelText(plan.billingModel)}
                        </div>
                        <div className="badge badge-secondary">
                          {plan.cadence}
                        </div>
                      </div>
                      
                      <div className="text-2xl font-bold text-primary mb-2" data-testid={`text-plan-price-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        {formatPrice(plan.unitAmount, plan.currency)}
                        <span className="text-base font-normal">
                          {plan.billingModel === 'flat_subscription' 
                            ? `/${plan.cadence}` 
                            : `/user/${plan.cadence === 'annual' ? 'year' : 'month'}`
                          }
                        </span>
                      </div>
                      
                      {plan.description && (
                        <p className="text-sm text-base-content/60 mb-4" data-testid={`text-plan-description-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                          {plan.description}
                        </p>
                      )}
                      
                      {/* All features with checkmarks only for included ones */}
                      <div className="text-sm space-y-2 mb-4" data-testid={`features-list-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        {allPlanFeatures
                          .sort((a, b) => {
                            const aIncluded = planFeatureIds.includes(a.id);
                            const bIncluded = planFeatureIds.includes(b.id);
                            // Sort included features to the top
                            if (aIncluded && !bIncluded) return -1;
                            if (!aIncluded && bIncluded) return 1;
                            return 0;
                          })
                          .map((feature) => {
                          const isIncluded = planFeatureIds.includes(feature.id);
                          return (
                            <div 
                              key={feature.id} 
                              className={`flex items-center gap-2 ${isIncluded ? 'text-base-content' : 'text-base-content/40'}`}
                              data-testid={`feature-${feature.key}-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {isIncluded ? (
                                <i className="fas fa-check text-success" data-testid={`check-${feature.key}-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}></i>
                              ) : (
                                <i className="fas fa-times text-base-content/40" data-testid={`cross-${feature.key}-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}></i>
                              )}
                              <span className={isIncluded ? '' : 'line-through'}>
                                {feature.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="card-actions">
                        {isCurrentPlan ? (
                          <button 
                            className="btn btn-disabled btn-sm w-full" 
                            data-testid={`button-current-plan-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            Current Plan
                          </button>
                        ) : (
                          <button 
                            className="btn btn-primary btn-sm w-full"
                            onClick={() => handleSelectPlan(plan)}
                            data-testid={`button-upgrade-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            Select Plan
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Plan Change Modal */}
      {showPlanChangeModal && selectedPlan && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Change to {selectedPlan.name}</h3>
            
            <div className="space-y-4">
              <div className="bg-base-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Plan Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Billing Model:</span>
                    <div>{getBillingModelText(selectedPlan.billingModel)}</div>
                  </div>
                  <div>
                    <span className="font-medium">Price:</span>
                    <div>{formatPrice(selectedPlan.unitAmount, selectedPlan.currency)}/{selectedPlan.billingModel === 'flat_subscription' ? selectedPlan.cadence : `user/${selectedPlan.cadence === 'annual' ? 'year' : 'month'}`}</div>
                  </div>
                </div>
              </div>

              {selectedPlan.billingModel !== 'flat_subscription' && (
                <div className="bg-base-200 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">User Count</h4>
                  <div className="flex items-center gap-4">
                    <label className="label">
                      <span className="label-text">Number of {selectedPlan.billingModel === 'metered_per_active_user' ? 'active users' : 'seats'}:</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered w-24"
                      value={userCount}
                      onChange={(e) => setUserCount(parseInt(e.target.value) || 0)}
                      onWheel={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        // Prevent arrow keys from changing value
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                        }
                      }}
                      min={selectedPlan.minSeats || 1}
                      step={1}
                      data-testid="input-modal-user-count"
                    />
                  </div>
                  <div className="text-sm text-base-content/60 mt-2">
                    Monthly cost: {formatPrice((selectedPlan.unitAmount * userCount), selectedPlan.currency)}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowPlanChangeModal(false);
                  setSelectedPlan(null);
                }}
                data-testid="button-cancel-plan-change"
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-primary ${changePlanMutation.isPending ? 'loading' : ''}`}
                onClick={handleConfirmPlanChange}
                disabled={changePlanMutation.isPending}
                data-testid="button-confirm-plan-change"
              >
                {changePlanMutation.isPending ? 'Changing...' : 'Confirm Change'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => {
            setShowPlanChangeModal(false);
            setSelectedPlan(null);
          }}></div>
        </div>
      )}

      {/* Decrease Warning Modal */}
      {showDecreaseWarning && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 text-warning">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              Cannot Decrease Users
            </h3>
            <p className="mb-4">
              You are not able to decrease the users within your account. Please contact support for assistance with reducing your subscription.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={() => setShowDecreaseWarning(false)}
                data-testid="button-close-decrease-warning"
              >
                Understood
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowDecreaseWarning(false);
                  // You could add contact support functionality here
                }}
                data-testid="button-contact-support"
              >
                Contact Support
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDecreaseWarning(false)}></div>
        </div>
      )}
    </div>
  );
}