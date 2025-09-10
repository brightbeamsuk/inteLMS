import { Link } from "wouter";

interface LicenseLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentActiveUsers: number;
  maxActiveUsers: number;
  organisationName: string;
  hasActiveSubscription: boolean;
  additionalUsersNeeded?: number;
}

export function LicenseLimitModal({
  isOpen,
  onClose,
  currentActiveUsers,
  maxActiveUsers,
  organisationName,
  hasActiveSubscription,
  additionalUsersNeeded = 1
}: LicenseLimitModalProps) {
  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-warning text-warning-content rounded-full flex items-center justify-center">
            <i className="fas fa-exclamation-triangle text-xl"></i>
          </div>
          <div>
            <h3 className="font-bold text-lg" data-testid="text-license-limit-title">
              License Limit Reached
            </h3>
            <p className="text-sm text-base-content/60">{organisationName}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="alert alert-warning">
            <i className="fas fa-users"></i>
            <div>
              <div className="font-semibold">Current Usage</div>
              <div className="text-sm">
                {currentActiveUsers} of {maxActiveUsers} active user licenses in use
              </div>
            </div>
          </div>

          <div className="bg-base-100 p-4 rounded-lg">
            <p className="text-sm text-base-content/80 mb-3">
              You're trying to activate {additionalUsersNeeded} additional user{additionalUsersNeeded > 1 ? 's' : ''}, 
              but your current plan only allows {maxActiveUsers} active users.
            </p>
            
            {hasActiveSubscription ? (
              <p className="text-sm text-base-content/80">
                To add more users, you'll need to upgrade your subscription to include additional user licenses.
              </p>
            ) : (
              <p className="text-sm text-base-content/80">
                To add more users, you'll need to purchase a subscription plan that supports more active users.
              </p>
            )}
          </div>

          <div className="stats shadow">
            <div className="stat place-items-center">
              <div className="stat-title">Need</div>
              <div className="stat-value text-warning text-lg">
                +{additionalUsersNeeded}
              </div>
              <div className="stat-desc">more licenses</div>
            </div>
            <div className="stat place-items-center">
              <div className="stat-title">Current Plan</div>
              <div className="stat-value text-primary text-lg">
                {maxActiveUsers}
              </div>
              <div className="stat-desc">user limit</div>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button 
            className="btn btn-ghost"
            onClick={onClose}
            data-testid="button-cancel-license-limit"
          >
            Cancel
          </button>
          <Link href="/admin/billing">
            <button 
              className="btn btn-primary"
              onClick={onClose}
              data-testid="button-upgrade-billing"
            >
              <i className="fas fa-credit-card"></i>
              {hasActiveSubscription ? 'Upgrade Plan' : 'View Billing'}
            </button>
          </Link>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}