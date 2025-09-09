import { useQuery } from "@tanstack/react-query";

interface Plan {
  id: string;
  name: string;
  description?: string;
  pricePerUser: number;
  status: 'active' | 'inactive' | 'archived';
  features?: PlanFeature[];
}

interface PlanFeature {
  id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  isDefault: boolean;
}

export function AdminBilling() {
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

  // Mock current plan - in real implementation this would come from organization data
  const currentPlanName = "Professional";

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-admin">Admin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Billing</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Billing & Subscription</h1>
        <div className="flex gap-2">
          <button className="btn btn-outline" data-testid="button-contact-sales">
            <i className="fas fa-phone"></i> Contact Sales
          </button>
          <button className="btn btn-primary" data-testid="button-update-payment">
            <i className="fas fa-credit-card"></i> Update Payment
          </button>
        </div>
      </div>

      {/* Current Plan */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="text-plan-name">Professional Plan</h2>
              <p className="text-base-content/60 mb-4" data-testid="text-plan-description">
                Full LMS features with up to 100 users and unlimited courses
              </p>
              <div className="text-3xl font-bold text-primary" data-testid="text-plan-price">
                £89<span className="text-base font-normal">/month</span>
              </div>
            </div>
            <div className="text-right">
              <div className="badge badge-success mb-2" data-testid="badge-plan-status">Active</div>
              <div className="text-sm text-base-content/60">
                <div data-testid="text-renewal-date">Next billing: March 15, 2024</div>
                <div data-testid="text-billing-cycle">Monthly billing</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            <i className="fas fa-users text-2xl"></i>
          </div>
          <div className="stat-title">Users</div>
          <div className="stat-value text-primary" data-testid="stat-users-count">47</div>
          <div className="stat-desc" data-testid="stat-users-limit">of 100 limit</div>
          <div className="mt-2">
            <progress className="progress progress-primary w-full" value="47" max="100"></progress>
          </div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-secondary">
            <i className="fas fa-graduation-cap text-2xl"></i>
          </div>
          <div className="stat-title">Course Assignments</div>
          <div className="stat-value text-secondary" data-testid="stat-assignments-count">342</div>
          <div className="stat-desc" data-testid="stat-assignments-period">This month</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg shadow-sm">
          <div className="stat-figure text-accent">
            <i className="fas fa-cloud text-2xl"></i>
          </div>
          <div className="stat-title">Storage Used</div>
          <div className="stat-value text-accent" data-testid="stat-storage-used">2.3 GB</div>
          <div className="stat-desc" data-testid="stat-storage-limit">of 10 GB limit</div>
          <div className="mt-2">
            <progress className="progress progress-accent w-full" value="23" max="100"></progress>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          <h3 className="text-xl font-bold mb-4">Payment Method</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-primary text-primary-content rounded flex items-center justify-center">
                <i className="fas fa-credit-card"></i>
              </div>
              <div>
                <div className="font-semibold" data-testid="text-card-info">Visa ending in 4242</div>
                <div className="text-sm text-base-content/60" data-testid="text-card-expiry">Expires 12/2025</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" data-testid="button-change-payment">
              <i className="fas fa-edit"></i> Change
            </button>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Invoice History</h3>
            <button className="btn btn-outline btn-sm" data-testid="button-download-all">
              <i className="fas fa-download"></i> Download All
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr data-testid="row-invoice-1">
                  <td data-testid="text-invoice-number-1">#INV-2024-002</td>
                  <td data-testid="text-invoice-date-1">Feb 15, 2024</td>
                  <td data-testid="text-invoice-amount-1">£89.00</td>
                  <td>
                    <div className="badge badge-success" data-testid="badge-invoice-status-1">Paid</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-sm btn-ghost" data-testid="button-view-invoice-1">
                        <i className="fas fa-eye"></i>
                      </button>
                      <button className="btn btn-sm btn-ghost" data-testid="button-download-invoice-1">
                        <i className="fas fa-download"></i>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr data-testid="row-invoice-2">
                  <td data-testid="text-invoice-number-2">#INV-2024-001</td>
                  <td data-testid="text-invoice-date-2">Jan 15, 2024</td>
                  <td data-testid="text-invoice-amount-2">£89.00</td>
                  <td>
                    <div className="badge badge-success" data-testid="badge-invoice-status-2">Paid</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-sm btn-ghost" data-testid="button-view-invoice-2">
                        <i className="fas fa-eye"></i>
                      </button>
                      <button className="btn btn-sm btn-ghost" data-testid="button-download-invoice-2">
                        <i className="fas fa-download"></i>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr data-testid="row-invoice-3">
                  <td data-testid="text-invoice-number-3">#INV-2023-012</td>
                  <td data-testid="text-invoice-date-3">Dec 15, 2023</td>
                  <td data-testid="text-invoice-amount-3">£89.00</td>
                  <td>
                    <div className="badge badge-success" data-testid="badge-invoice-status-3">Paid</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-sm btn-ghost" data-testid="button-view-invoice-3">
                        <i className="fas fa-eye"></i>
                      </button>
                      <button className="btn btn-sm btn-ghost" data-testid="button-download-invoice-3">
                        <i className="fas fa-download"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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
                const isCurrentPlan = plan.name === currentPlanName;
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
                      <div className="text-2xl font-bold text-primary mb-2" data-testid={`text-plan-price-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        £{plan.pricePerUser}<span className="text-base font-normal">/user/month</span>
                      </div>
                      {plan.description && (
                        <p className="text-sm text-base-content/60 mb-4" data-testid={`text-plan-description-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                          {plan.description}
                        </p>
                      )}
                      
                      {/* All features with checkmarks only for included ones */}
                      <div className="text-sm space-y-2 mb-4" data-testid={`features-list-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        {allPlanFeatures.map((feature) => {
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
                            data-testid={`button-upgrade-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            Upgrade to {plan.name}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        
        {/* Feature Legend */}
        <div className="mt-6 p-4 bg-base-200 rounded-lg">
          <h4 className="font-semibold mb-2" data-testid="text-feature-legend">Feature Legend:</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <i className="fas fa-check text-success"></i>
              <span>Included in plan</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-times text-base-content/40"></i>
              <span className="text-base-content/60">Not included in plan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
