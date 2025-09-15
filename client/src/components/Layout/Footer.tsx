import { Link } from "wouter";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { Settings } from "lucide-react";

interface FooterProps {
  className?: string;
}

/**
 * Site-wide Footer Component with PECR-required cookie settings link
 * 
 * Features:
 * - Always visible cookie settings link for PECR compliance
 * - Responsive design that works across all layout types
 * - Feature flag gated to only show when GDPR is enabled
 */
export function Footer({ className = "" }: FooterProps) {
  const isGdprEnabled = useIsGdprEnabled();

  const showCookieSettings = () => {
    // Create a modal or direct to cookie settings
    // For now, scroll to show the cookie banner again by clearing consent temporarily
    localStorage.removeItem('cookie-consent');
    localStorage.removeItem('cookie-consent-date');
    // Refresh page to show banner again
    window.location.reload();
  };

  return (
    <footer className={`bg-base-200 border-t border-base-300 mt-auto ${className}`}>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Left side - Copyright */}
          <div className="text-sm text-base-content/70">
            © {new Date().getFullYear()} inteLMS. All rights reserved.
          </div>

          {/* Right side - Links */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            
            {/* Privacy-related links */}
            <Link 
              href="/privacy-policy" 
              className="text-base-content/70 hover:text-base-content transition-colors"
              data-testid="link-privacy-policy"
            >
              Privacy Policy
            </Link>
            
            <Link 
              href="/terms-of-service" 
              className="text-base-content/70 hover:text-base-content transition-colors"
              data-testid="link-terms-of-service"
            >
              Terms of Service
            </Link>

            {/* PECR-required Cookie Settings link */}
            {isGdprEnabled && (
              <button
                type="button"
                onClick={showCookieSettings}
                className="flex items-center gap-1 text-base-content/70 hover:text-base-content transition-colors cursor-pointer"
                data-testid="button-cookie-settings"
              >
                <Settings className="w-3 h-3" />
                Cookie Settings
              </button>
            )}
          </div>
        </div>

        {/* Bottom text for small screens */}
        <div className="mt-4 pt-4 border-t border-base-300 text-center text-xs text-base-content/50">
          {isGdprEnabled && (
            <p>
              This website uses cookies. You can{" "}
              <button
                type="button"
                onClick={showCookieSettings}
                className="underline hover:no-underline text-base-content/70"
                data-testid="button-cookie-settings-inline"
              >
                manage your cookie preferences
              </button>{" "}
              at any time.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}