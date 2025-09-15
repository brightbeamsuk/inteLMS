import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface CookieConsents {
  strictlyNecessary: boolean;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

interface ConsentManagerContextType {
  consents: CookieConsents;
  hasConsent: (category: keyof CookieConsents) => boolean;
  updateConsents: (newConsents: CookieConsents) => void;
  isLoaded: boolean;
}

const defaultConsents: CookieConsents = {
  strictlyNecessary: true, // Always allowed
  functional: false,
  analytics: false,
  advertising: false,
};

const ConsentManagerContext = createContext<ConsentManagerContextType>({
  consents: defaultConsents,
  hasConsent: () => false,
  updateConsents: () => {},
  isLoaded: false,
});

interface ConsentManagerProps {
  children: ReactNode;
}

/**
 * PECR-compliant ConsentManager
 * 
 * Features:
 * - Blocks non-essential cookies/scripts until explicit consent
 * - Provides consent gates for conditional script loading
 * - Integrates with CookieBanner for consent updates
 * - Persists consent decisions in localStorage
 * - Automatically blocks/allows scripts based on consent status
 */
export function ConsentManager({ children }: ConsentManagerProps) {
  const [consents, setConsents] = useState<CookieConsents>(defaultConsents);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    try {
      const storedConsent = localStorage.getItem('cookie-consent');
      const storedConsentDate = localStorage.getItem('cookie-consent-date');
      
      if (storedConsent && storedConsentDate) {
        // Check if consent is still valid (12 months)
        const consentDate = new Date(storedConsentDate);
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
        
        if (consentDate > twelveMonthsAgo) {
          const consent = JSON.parse(storedConsent);
          setConsents(consent);
        } else {
          // Consent expired, clear it
          localStorage.removeItem('cookie-consent');
          localStorage.removeItem('cookie-consent-date');
        }
      }
    } catch (error) {
      console.warn('Failed to load stored consent:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Block/allow scripts based on consent
  useEffect(() => {
    if (!isLoaded) return;

    // Block or allow analytics scripts
    if (consents.analytics) {
      enableAnalytics();
    } else {
      blockAnalytics();
    }

    // Block or allow advertising scripts
    if (consents.advertising) {
      enableAdvertising();
    } else {
      blockAdvertising();
    }

    // Functional cookies don't typically need script blocking,
    // but we can add custom logic here if needed
    if (consents.functional) {
      enableFunctional();
    } else {
      blockFunctional();
    }

  }, [consents, isLoaded]);

  const hasConsent = (category: keyof CookieConsents): boolean => {
    return consents[category];
  };

  const updateConsents = (newConsents: CookieConsents) => {
    setConsents(newConsents);
    // Store in localStorage
    try {
      localStorage.setItem('cookie-consent', JSON.stringify(newConsents));
      localStorage.setItem('cookie-consent-date', new Date().toISOString());
    } catch (error) {
      console.warn('Failed to store consent:', error);
    }
  };

  const contextValue: ConsentManagerContextType = {
    consents,
    hasConsent,
    updateConsents,
    isLoaded,
  };

  return (
    <ConsentManagerContext.Provider value={contextValue}>
      {children}
    </ConsentManagerContext.Provider>
  );
}

// Analytics script management
function enableAnalytics() {
  // Google Analytics example
  if (typeof window !== 'undefined') {
    // Enable GA if script is available
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
    
    // Load GA script if not already loaded
    if (!document.querySelector('script[src*="googletagmanager.com"]')) {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${import.meta.env.VITE_GA_MEASUREMENT_ID || 'GA_MEASUREMENT_ID'}`;
      script.async = true;
      document.head.appendChild(script);

      // Initialize GA
      const initScript = document.createElement('script');
      initScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${import.meta.env.VITE_GA_MEASUREMENT_ID || 'GA_MEASUREMENT_ID'}');
      `;
      document.head.appendChild(initScript);
    }
  }
}

function blockAnalytics() {
  if (typeof window !== 'undefined') {
    // Disable GA if available
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }
    
    // Clear GA cookies
    document.cookie.split(";").forEach(function(c) {
      if (c.indexOf("_ga") === 0 || c.indexOf("_gid") === 0 || c.indexOf("_gat") === 0) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });
  }
}

// Advertising script management  
function enableAdvertising() {
  if (typeof window !== 'undefined') {
    // Enable advertising consent for various platforms
    if (window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    }
    
    // Add your advertising script loading logic here
    // Example: Google Ads, Facebook Pixel, etc.
  }
}

function blockAdvertising() {
  if (typeof window !== 'undefined') {
    // Disable advertising consent
    if (window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied', 
        ad_personalization: 'denied'
      });
    }
    
    // Clear advertising cookies
    document.cookie.split(";").forEach(function(c) {
      if (c.indexOf("_fbp") === 0 || c.indexOf("_fbc") === 0) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });
  }
}

// Functional cookies management
function enableFunctional() {
  // Most functional cookies are allowed by default
  // Add custom logic here if you have specific functional cookies to enable
}

function blockFunctional() {
  // Block non-essential functional cookies
  // This could include preference cookies, non-essential session data, etc.
}

// Hook to use the ConsentManager context
export function useConsent() {
  const context = useContext(ConsentManagerContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentManager');
  }
  return context;
}

// Hook to conditionally render components based on consent
export function useConsentGate(category: keyof CookieConsents) {
  const { hasConsent, isLoaded } = useConsent();
  
  return {
    canRender: hasConsent(category),
    isLoaded, // Use this to show loading states
  };
}

// Utility component to conditionally render based on consent
interface ConsentGateProps {
  category: keyof CookieConsents;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ConsentGate({ category, children, fallback = null }: ConsentGateProps) {
  const { canRender } = useConsentGate(category);
  
  return canRender ? <>{children}</> : <>{fallback}</>;
}

// Global window type extensions for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}