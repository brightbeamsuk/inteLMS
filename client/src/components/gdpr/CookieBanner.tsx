import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { X, Settings, Shield, Info } from "lucide-react";

interface CookieConsents {
  strictlyNecessary: boolean;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

interface CookieBannerProps {
  onConsentGiven?: (consents: CookieConsents) => void;
  className?: string;
}

/**
 * PECR-compliant Cookie Banner Component
 * 
 * Features:
 * - Blocks non-essential cookies until explicit consent
 * - Granular controls for cookie categories
 * - UK PECR compliant copy and behavior
 * - Integration with existing consent system
 * - DaisyUI styling with accessibility features
 */
export function CookieBanner({ onConsentGiven, className = "" }: CookieBannerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [cookieConsents, setCookieConsents] = useState<CookieConsents>({
    strictlyNecessary: true, // Always required
    functional: false,
    analytics: false,
    advertising: false,
  });

  // Check if banner should be shown
  useEffect(() => {
    if (!isGdprEnabled) {
      setIsVisible(false);
      return;
    }

    // Check local storage for existing consent (works for all visitors)
    const storedConsent = localStorage.getItem('cookie-consent');
    const storedConsentDate = localStorage.getItem('cookie-consent-date');
    
    if (storedConsent && storedConsentDate) {
      // Check if consent is less than 12 months old (PECR requirement)
      const consentDate = new Date(storedConsentDate);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
      
      if (consentDate > twelveMonthsAgo) {
        // Valid consent exists, don't show banner
        setIsVisible(false);
        // Apply existing consent to any loaded ConsentManager
        try {
          const consent = JSON.parse(storedConsent);
          onConsentGiven?.(consent);
        } catch (error) {
          console.warn('Failed to parse stored consent:', error);
        }
        return;
      }
    }

    // No valid consent found, show banner for all visitors (PECR requirement)
    setIsVisible(true);
  }, [isGdprEnabled, onConsentGiven]);

  // Store consent locally and optionally sync to server if authenticated
  const [isStoring, setIsStoring] = useState(false);
  
  const storeConsent = async (consents: CookieConsents) => {
    setIsStoring(true);
    try {
      // Always store in localStorage for PECR compliance (all visitors)
      localStorage.setItem('cookie-consent', JSON.stringify(consents));
      localStorage.setItem('cookie-consent-date', new Date().toISOString());
      
      // If user is authenticated, also store on server
      if (user?.id) {
        const payload = {
          consentType: 'cookie_consent',
          lawfulBasis: 'consent' as const,
          purpose: 'Cookie functionality as per user preferences - PECR compliance',
          policyVersion: await fetchPolicyVersion(),
          marketingConsents: {
            email: false,
            sms: false,
            phone: false,
            post: false,
            pushNotifications: false,
          },
          cookieConsents: consents,
          metadata: {
            source: 'cookie_banner',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          },
        };

        await apiRequest('POST', '/api/gdpr/consent', payload);
        queryClient.invalidateQueries({ queryKey: ['/api/gdpr/consent'] });
      }
      
      toast({
        title: "Cookie preferences saved",
        description: user?.id 
          ? "Your cookie preferences have been saved successfully." 
          : "Your cookie preferences are saved locally and will sync when you log in.",
      });

      setIsVisible(false);
      onConsentGiven?.(consents);
    } catch (error: any) {
      // Still hide banner if localStorage worked (PECR compliance priority)
      setIsVisible(false);
      onConsentGiven?.(consents);
      
      toast({
        title: "Preferences saved locally",
        description: user?.id 
          ? "Failed to sync to server, but preferences are saved locally." 
          : "Your preferences are saved locally and will sync when you log in.",
        variant: "default",
      });
      console.warn('Failed to store consent on server:', error);
    } finally {
      setIsStoring(false);
    }
  };
  
  // Fetch current policy version from server
  const fetchPolicyVersion = async (): Promise<string> => {
    try {
      const response = await fetch('/api/gdpr/policy-version');
      if (response.ok) {
        const data = await response.json();
        return data.version || '2.0';
      }
    } catch (error) {
      console.warn('Failed to fetch policy version, using default:', error);
    }
    return '2.0';
  };

  const handleAcceptAll = () => {
    const allConsents: CookieConsents = {
      strictlyNecessary: true,
      functional: true,
      analytics: true,
      advertising: true,
    };
    storeConsent(allConsents);
  };

  const handleRejectAll = () => {
    const essentialOnly: CookieConsents = {
      strictlyNecessary: true,
      functional: false,
      analytics: false,
      advertising: false,
    };
    storeConsent(essentialOnly);
  };

  const handleSaveCustom = () => {
    storeConsent(cookieConsents);
  };

  const updateCookieConsent = (category: keyof CookieConsents, value: boolean) => {
    if (category === 'strictlyNecessary') return; // Cannot disable necessary cookies
    
    setCookieConsents(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const getCookieDescription = (category: keyof CookieConsents) => {
    switch (category) {
      case 'strictlyNecessary':
        return 'Essential for basic website functionality and security. Cannot be disabled.';
      case 'functional':
        return 'Remember your preferences and settings to improve your experience.';
      case 'analytics':
        return 'Help us understand how you use our website to improve performance.';
      case 'advertising':
        return 'Show you relevant advertisements and measure their effectiveness.';
      default:
        return '';
    }
  };

  const getCookieExamples = (category: keyof CookieConsents) => {
    switch (category) {
      case 'strictlyNecessary':
        return 'Session cookies, authentication, security';
      case 'functional':
        return 'Language preferences, theme settings, form data';
      case 'analytics':
        return 'Google Analytics, usage statistics, performance metrics';
      case 'advertising':
        return 'Advertisement tracking, remarketing, conversion tracking';
      default:
        return '';
    }
  };

  // Don't render if GDPR is disabled or shouldn't be visible
  if (!isGdprEnabled || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Overlay for focus trap when customization is open */}
      {showCustomization && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowCustomization(false)}
          data-testid="cookie-banner-overlay"
        />
      )}

      {/* Main Cookie Banner */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 ${className}`}
        role="dialog"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-description"
        data-testid="cookie-banner"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            {/* Banner Content */}
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="cookie-banner-title" className="text-lg font-semibold text-gray-900 mb-2">
                    Cookie Consent
                  </h2>
                  <p id="cookie-banner-description" className="text-sm text-gray-600 mb-3">
                    We use cookies to ensure our website functions properly and to improve your experience. 
                    You can choose which types of cookies to allow. Strictly necessary cookies cannot be disabled 
                    as they are essential for the website to function.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Info className="w-3 h-3" aria-hidden="true" />
                    <span>Required by UK PECR regulations. Your choice will be remembered for 12 months.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowCustomization(true)}
                data-testid="button-customize-cookies"
                aria-describedby="cookie-banner-description"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
                Customise
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleRejectAll}
                disabled={isStoring}
                data-testid="button-reject-cookies"
                aria-describedby="cookie-banner-description"
              >
                Reject All
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAcceptAll}
                disabled={isStoring}
                data-testid="button-accept-cookies"
                aria-describedby="cookie-banner-description"
              >
                {isStoring ? 'Saving...' : 'Accept All'}
              </button>
            </div>
          </div>
        </div>

        {/* Customization Panel */}
        {showCustomization && (
          <div 
            className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 shadow-lg z-50 max-h-96 overflow-y-auto"
            data-testid="cookie-customization-panel"
            role="region"
            aria-labelledby="customization-panel-title"
            aria-live="polite"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 id="customization-panel-title" className="text-lg font-semibold text-gray-900">Cookie Preferences</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle"
                  onClick={() => setShowCustomization(false)}
                  aria-label="Close customization panel"
                  data-testid="button-close-customization"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-6">
                {(Object.keys(cookieConsents) as Array<keyof CookieConsents>).map((category) => (
                  <div key={category} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 capitalize mb-1">
                          {category === 'strictlyNecessary' ? 'Strictly Necessary' : category} Cookies
                        </h4>
                        <p id={`cookie-desc-${category}`} className="text-sm text-gray-600 mb-2">
                          {getCookieDescription(category)}
                        </p>
                        <p className="text-xs text-gray-500">
                          <strong>Examples:</strong> {getCookieExamples(category)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={cookieConsents[category]}
                          disabled={category === 'strictlyNecessary'}
                          onChange={(e) => updateCookieConsent(category, e.target.checked)}
                          data-testid={`toggle-${category}-cookies`}
                          id={`cookie-toggle-${category}`}
                          aria-describedby={`cookie-desc-${category}`}
                          {...(category === 'strictlyNecessary' ? { 'aria-label': 'Strictly necessary cookies - always enabled for essential website functionality' } : {})}
                        />
                        <label htmlFor={`cookie-toggle-${category}`} className="sr-only">
                          {category === 'strictlyNecessary' ? 'Strictly Necessary' : category} cookies
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCustomization(false)}
                  data-testid="button-cancel-customization"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveCustom}
                  disabled={isStoring}
                  data-testid="button-save-custom-cookies"
                >
                  {isStoring ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}