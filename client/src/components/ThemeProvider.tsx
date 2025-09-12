import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface ThemeContextType {
  accentColor: string;
  setDynamicTheme: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

// Convert hex color to HSL values for CSS custom properties
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove the hash if it exists
  hex = hex.replace('#', '');

  // Parse the hex values
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user, isAuthenticated } = useAuth();
  
  // Fetch organization data if user is authenticated and has an organisationId
  const { data: organization } = useQuery<{ accentColor?: string; planId?: string }>({
    queryKey: [`/api/organisations/${user?.organisationId}`],
    enabled: !!user?.organisationId && isAuthenticated,
  });

  // Fetch plan features to check branding access
  const { data: planFeatures = [], isLoading: planFeaturesLoading } = useQuery({
    queryKey: ['/api/plan-features/mappings', organization?.planId],
    enabled: !!organization?.planId,
    queryFn: async () => {
      const response = await fetch(`/api/plan-features/mappings/${organization!.planId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch plan features');
      }
      return response.json();
    },
  });

  // Helper function to check feature access
  const hasFeatureAccess = (featureId: string) => {
    // If plan features are still loading, return false to prevent applying custom colors prematurely
    if (planFeaturesLoading) return false;
    
    const feature = planFeatures.find((f: any) => f.featureId === featureId);
    return feature?.enabled || false;
  };

  // Check if branding feature is enabled
  const hasBrandingAccess = hasFeatureAccess('remove_branding');

  const setDynamicTheme = (color: string) => {
    const { h, s, l } = hexToHsl(color);
    
    // Set CSS custom properties for the accent color
    document.documentElement.style.setProperty('--primary-h', h.toString());
    document.documentElement.style.setProperty('--primary-s', s.toString() + '%');
    document.documentElement.style.setProperty('--primary-l', l.toString() + '%');
    
    // Set additional variations
    document.documentElement.style.setProperty('--primary-focus-h', h.toString());
    document.documentElement.style.setProperty('--primary-focus-s', s.toString() + '%');
    document.documentElement.style.setProperty('--primary-focus-l', Math.max(l - 10, 0).toString() + '%');
    
    document.documentElement.style.setProperty('--primary-content-h', h.toString());
    document.documentElement.style.setProperty('--primary-content-s', s.toString() + '%');
    document.documentElement.style.setProperty('--primary-content-l', l > 50 ? '20%' : '90%');
  };

  useEffect(() => {
    // Only apply custom colors if organization has branding access
    if (organization?.accentColor && hasBrandingAccess) {
      setDynamicTheme(organization.accentColor);
    } else {
      // Reset to default primary color if no organization, no accent color, or no branding access
      setDynamicTheme('#3b82f6');
    }
  }, [organization?.accentColor, hasBrandingAccess]);

  const contextValue: ThemeContextType = {
    accentColor: (organization?.accentColor && hasBrandingAccess) ? organization.accentColor : '#3b82f6',
    setDynamicTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}