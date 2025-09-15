/**
 * GDPR Configuration Hooks
 * Frontend interface for UK GDPR compliance features
 */

import { useQuery } from '@tanstack/react-query';
import type { GdprConfig } from '../../../server/config/gdpr';

// API response type for GDPR config
export interface GdprConfigResponse {
  enabled: boolean;
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
    defaultRetentionPeriod: number;
    breachNotificationDeadline: number;
    childAgeThreshold: number;
    cookieConsentExpiry: number;
  };
}

/**
 * Hook to fetch GDPR configuration from the server
 * Used to gate GDPR features on the frontend
 */
export const useGdprConfig = () => {
  return useQuery<GdprConfigResponse>({
    queryKey: ['/api/config/gdpr'],
    retry: false, // Don't retry if endpoint returns 404 when feature is disabled
    staleTime: 5 * 60 * 1000, // 5 minutes - config doesn't change often
  });
};

/**
 * Hook to check if GDPR compliance is enabled
 * Returns false if query fails (e.g., 404 when feature disabled)
 */
export const useIsGdprEnabled = (): boolean => {
  const { data } = useGdprConfig();
  return data?.enabled ?? false;
};

/**
 * Hook to check if a specific GDPR feature is enabled
 */
export const useIsGdprFeatureEnabled = (feature: keyof GdprConfigResponse['features']): boolean => {
  const { data } = useGdprConfig();
  return Boolean(data?.enabled && data?.features?.[feature]);
};

/**
 * Hook to get GDPR settings
 */
export const useGdprSettings = () => {
  const { data } = useGdprConfig();
  return data?.settings;
};