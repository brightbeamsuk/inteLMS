export function AdminBilling() {
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

      {/* Plan Upgrade Options */}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">Upgrade Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h4 className="card-title">Enterprise</h4>
              <div className="text-2xl font-bold text-primary mb-2">£199/month</div>
              <ul className="text-sm space-y-2 mb-4">
                <li>✓ Up to 500 users</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Custom branding</li>
                <li>✓ API access</li>
                <li>✓ Priority support</li>
              </ul>
              <div className="card-actions">
                <button className="btn btn-primary btn-sm w-full" data-testid="button-upgrade-enterprise">
                  Upgrade
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h4 className="card-title">Custom</h4>
              <div className="text-2xl font-bold text-secondary mb-2">Contact us</div>
              <ul className="text-sm space-y-2 mb-4">
                <li>✓ Unlimited users</li>
                <li>✓ Custom integrations</li>
                <li>✓ Dedicated support</li>
                <li>✓ SLA guarantee</li>
                <li>✓ On-premise option</li>
              </ul>
              <div className="card-actions">
                <button className="btn btn-secondary btn-sm w-full" data-testid="button-contact-custom">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm border-2 border-primary">
            <div className="card-body">
              <div className="badge badge-primary mb-2">Current Plan</div>
              <h4 className="card-title">Professional</h4>
              <div className="text-2xl font-bold text-primary mb-2">£89/month</div>
              <ul className="text-sm space-y-2 mb-4">
                <li>✓ Up to 100 users</li>
                <li>✓ Unlimited courses</li>
                <li>✓ SCORM support</li>
                <li>✓ Certificates</li>
                <li>✓ Email support</li>
              </ul>
              <div className="card-actions">
                <button className="btn btn-disabled btn-sm w-full" data-testid="button-current-plan">
                  Current Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
