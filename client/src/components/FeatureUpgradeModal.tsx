import { useState } from "react";

interface FeatureUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  featureDescription: string;
  featureIcon?: string;
}

export function FeatureUpgradeModal({ 
  isOpen, 
  onClose, 
  featureName, 
  featureDescription,
  featureIcon = "fas fa-star"
}: FeatureUpgradeModalProps) {
  if (!isOpen) return null;

  const handleUpgrade = () => {
    // Navigate to billing page for plan upgrade
    window.location.href = '/admin/billing';
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="text-center">
          {/* Feature Icon */}
          <div className="mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <i className={`${featureIcon} text-3xl text-primary`}></i>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-bold text-xl mb-2" data-testid="modal-title">
            {featureName} Not Available
          </h3>

          {/* Description */}
          <p className="text-base-content/70 mb-6" data-testid="modal-description">
            {featureDescription}
          </p>

          {/* Features included message */}
          <div className="bg-base-200 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2 text-warning mb-2">
              <i className="fas fa-lock"></i>
              <span className="font-semibold">Premium Feature</span>
            </div>
            <p className="text-sm text-base-content/70">
              This feature is available in our premium plans. Upgrade now to unlock advanced functionality and boost your team's productivity.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            <button 
              className="btn btn-outline" 
              onClick={onClose}
              data-testid="button-close-modal"
            >
              Maybe Later
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleUpgrade}
              data-testid="button-upgrade-plan"
            >
              <i className="fas fa-arrow-up mr-2"></i>
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* Close button */}
        <button 
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
          onClick={onClose}
          data-testid="button-close-x"
        >
          ✕
        </button>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}