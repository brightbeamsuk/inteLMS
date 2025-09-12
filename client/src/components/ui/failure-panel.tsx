import { AlertCircle, RefreshCcw, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export interface FailurePanelProps {
  title: string;
  stage?: string;
  error?: {
    short: string;
    detail?: string;
  };
  actions?: {
    primary?: {
      label: string;
      action: () => void;
      loading?: boolean;
      variant?: 'primary' | 'secondary' | 'warning' | 'error';
    };
    secondary?: {
      label: string;
      action: () => void;
      loading?: boolean;
    };
    tertiary?: {
      label: string;
      action: () => void;
      loading?: boolean;
    };
  };
  className?: string;
}

export function FailurePanel({
  title,
  stage,
  error,
  actions,
  className = ""
}: FailurePanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`card bg-base-100 border-2 border-warning shadow-lg ${className}`} data-testid="failure-panel">
      <div className="card-body">
        {/* Header with Icon */}
        <div className="flex items-start space-x-3 mb-4">
          <div className="bg-warning/10 rounded-full p-2 mt-1">
            <AlertCircle className="h-6 w-6 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-warning mb-1" data-testid="failure-title">
              {title}
            </h3>
            {stage && (
              <p className="text-sm text-base-content/60" data-testid="failure-stage">
                Stage: {stage}
              </p>
            )}
          </div>
        </div>

        {/* Error Information */}
        {error && (
          <div className="mb-6">
            <div className="alert alert-warning" data-testid="error-message">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error.short}</span>
            </div>

            {/* Expandable Details */}
            {error.detail && (
              <div className="mt-3">
                <button
                  className="btn btn-ghost btn-sm w-full justify-between"
                  onClick={() => setShowDetails(!showDetails)}
                  data-testid="toggle-details"
                >
                  <span className="text-xs">Technical Details</span>
                  {showDetails ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {showDetails && (
                  <div className="bg-base-200 rounded-lg p-3 mt-2" data-testid="error-details">
                    <pre className="text-xs text-base-content/70 whitespace-pre-wrap font-mono">
                      {error.detail}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {actions && (
          <div className="card-actions justify-end">
            {actions.tertiary && (
              <button
                className={`btn btn-ghost btn-sm ${actions.tertiary.loading ? 'loading' : ''}`}
                onClick={actions.tertiary.action}
                disabled={actions.tertiary.loading}
                data-testid="action-tertiary"
              >
                {!actions.tertiary.loading && <RefreshCcw className="w-4 h-4 mr-1" />}
                {actions.tertiary.label}
              </button>
            )}

            {actions.secondary && (
              <button
                className={`btn btn-outline btn-sm ${actions.secondary.loading ? 'loading' : ''}`}
                onClick={actions.secondary.action}
                disabled={actions.secondary.loading}
                data-testid="action-secondary"
              >
                {!actions.secondary.loading && <RefreshCcw className="w-4 h-4 mr-1" />}
                {actions.secondary.label}
              </button>
            )}

            {actions.primary && (
              <button
                className={`btn btn-sm ${getButtonVariantClass(actions.primary.variant)} ${
                  actions.primary.loading ? 'loading' : ''
                }`}
                onClick={actions.primary.action}
                disabled={actions.primary.loading}
                data-testid="action-primary"
              >
                {!actions.primary.loading && <Wrench className="w-4 h-4 mr-1" />}
                {actions.primary.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getButtonVariantClass(variant: string = 'primary'): string {
  switch (variant) {
    case 'secondary':
      return 'btn-secondary';
    case 'warning':
      return 'btn-warning';
    case 'error':
      return 'btn-error';
    case 'primary':
    default:
      return 'btn-primary';
  }
}

// Specialized panels for common use cases
export function DataLoadFailurePanel({
  title = "Data failed to load",
  stage,
  error,
  onRetry,
  onRepair,
  retryLoading = false,
  repairLoading = false,
  className
}: {
  title?: string;
  stage?: string;
  error?: { short: string; detail?: string };
  onRetry?: () => void;
  onRepair?: () => void;
  retryLoading?: boolean;
  repairLoading?: boolean;
  className?: string;
}) {
  return (
    <FailurePanel
      title={title}
      stage={stage}
      error={error}
      actions={{
        primary: onRepair ? {
          label: "Repair/Seed Defaults",
          action: onRepair,
          loading: repairLoading,
          variant: 'warning'
        } : undefined,
        secondary: onRetry ? {
          label: "Retry",
          action: onRetry,
          loading: retryLoading
        } : undefined
      }}
      className={className}
    />
  );
}

export function NetworkFailurePanel({
  title = "Connection failed",
  error,
  onRetry,
  retryLoading = false,
  className
}: {
  title?: string;
  error?: { short: string; detail?: string };
  onRetry?: () => void;
  retryLoading?: boolean;
  className?: string;
}) {
  return (
    <FailurePanel
      title={title}
      stage="Network Request"
      error={error}
      actions={{
        primary: onRetry ? {
          label: "Retry Connection",
          action: onRetry,
          loading: retryLoading
        } : undefined
      }}
      className={className}
    />
  );
}

export default FailurePanel;