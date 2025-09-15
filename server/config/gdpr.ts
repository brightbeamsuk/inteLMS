/**
 * GDPR Feature Flag and Configuration
 * Controls UK GDPR and Data Protection Act 2018 compliance features
 */

export interface GdprConfig {
  enabled: boolean;
  environment: 'development' | 'production';
  features: {
    consentManagement: boolean;
    cookieManagement: boolean;
    userRights: boolean;
    dataRetention: boolean;
    breachManagement: boolean;
    ropaManagement: boolean;
    internationalTransfers: boolean;
    ageVerification: boolean;
  };
  settings: {
    defaultRetentionPeriod: number; // days
    breachNotificationDeadline: number; // hours (72 for ICO)
    childAgeThreshold: number; // 13 for UK
    cookieConsentExpiry: number; // days
    policyVersion: string; // Current privacy policy version
  };
}

// Feature flag - defaults to false for safe deployment
export const GDPR_COMPLIANCE_ENABLED = process.env.GDPR_COMPLIANCE_ENABLED === 'true';

// Default GDPR configuration
export const gdprConfig: GdprConfig = {
  enabled: GDPR_COMPLIANCE_ENABLED,
  environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
  features: {
    consentManagement: GDPR_COMPLIANCE_ENABLED,
    cookieManagement: GDPR_COMPLIANCE_ENABLED,
    userRights: GDPR_COMPLIANCE_ENABLED,
    dataRetention: GDPR_COMPLIANCE_ENABLED,
    breachManagement: GDPR_COMPLIANCE_ENABLED,
    ropaManagement: GDPR_COMPLIANCE_ENABLED,
    internationalTransfers: GDPR_COMPLIANCE_ENABLED,
    ageVerification: GDPR_COMPLIANCE_ENABLED,
  },
  settings: {
    defaultRetentionPeriod: 365 * 7, // 7 years default
    breachNotificationDeadline: 72, // ICO requirement
    childAgeThreshold: 13, // UK threshold
    cookieConsentExpiry: 365, // 1 year
    policyVersion: process.env.GDPR_POLICY_VERSION || '2.0', // Current privacy policy version
  },
};

// Helper function to check if GDPR features are enabled
export const isGdprEnabled = (): boolean => {
  return gdprConfig.enabled;
};

// Helper function to check specific GDPR features
export const isGdprFeatureEnabled = (feature: keyof GdprConfig['features']): boolean => {
  return gdprConfig.enabled && gdprConfig.features[feature];
};

// Helper function to get current policy version
export const getCurrentPolicyVersion = (): string => {
  return gdprConfig.settings.policyVersion;
};