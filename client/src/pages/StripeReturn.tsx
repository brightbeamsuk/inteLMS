import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

function StripeReturn() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');
    const cancelled = urlParams.get('cancelled');
    const setup = urlParams.get('setup');
    
    // Store the return information in localStorage so it persists through login
    const returnInfo = {
      sessionId,
      success: success === 'true',
      cancelled: cancelled === 'true',
      setup,
      timestamp: Date.now()
    };
    
    if (sessionId || success || cancelled) {
      localStorage.setItem('stripe-return', JSON.stringify(returnInfo));
    }
    
    if (isLoading) {
      return; // Wait for auth check
    }
    
    if (!isAuthenticated) {
      // Redirect to login, which will bring them back after authentication
      window.location.href = "/api/login";
      return;
    }
    
    // User is authenticated, redirect to billing page with the return parameters
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (success) params.append('success', success);
    if (cancelled) params.append('cancelled', cancelled);
    if (setup) params.append('setup', setup);
    
    const redirectUrl = `/admin/billing${params.toString() ? '?' + params.toString() : ''}`;
    window.location.href = redirectUrl;
    
  }, [isAuthenticated, isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4 text-lg">Processing your payment...</p>
        <p className="text-sm text-base-content/60">Please wait while we complete your subscription setup.</p>
      </div>
    </div>
  );
}

export default StripeReturn;