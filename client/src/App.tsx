import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { PasswordChangeModal } from "@/components/PasswordChangeModal";

// Layout components
import { SuperAdminLayout } from "@/components/Layout/SuperAdminLayout";
import { AdminLayout } from "@/components/Layout/AdminLayout";
import { UserLayout } from "@/components/Layout/UserLayout";

// Page components
import { Landing } from "@/pages/Landing";
import NotFound from "@/pages/not-found";

// SuperAdmin pages
import { SuperAdminDashboard } from "@/pages/superadmin/Dashboard";
import { SuperAdminOrganisations } from "@/pages/superadmin/Organisations";
import { SuperAdminUsers } from "@/pages/superadmin/Users";
import { SuperAdminCourseBuilder } from "@/pages/superadmin/CourseBuilder";
import { SuperAdminCourses } from "@/pages/superadmin/Courses";
import { SuperAdminEmailTemplates } from "@/pages/superadmin/EmailTemplates";
import { SuperAdminEmailLogs } from "@/pages/superadmin/EmailLogs";
import { SuperAdminSettings } from "@/pages/superadmin/Settings";
import { SuperAdminProfile } from "@/pages/superadmin/Profile";
import { SuperAdminPlans } from "@/pages/superadmin/Plans";
import { SuperAdminSubscriptionManager } from "@/pages/superadmin/SubscriptionManager";
import { SuperAdminSupport } from "@/pages/superadmin/Support";

// Admin pages
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { AdminUsers } from "@/pages/admin/Users";
import { AdminCourses } from "@/pages/admin/Courses";
import { AdminBilling } from "@/pages/admin/Billing";
import { AdminOrganisationSettings } from "@/pages/admin/OrganisationSettings";
import { AdminProfile } from "@/pages/admin/Profile";
import { AdminTrainingMatrix } from "@/pages/admin/TrainingMatrix";
import AdminCertificates from "@/pages/admin/Certificates";
import { AdminEmailTemplates } from "@/pages/admin/EmailTemplates";
import AuditLog from "@/pages/admin/AuditLog";
import { AdminSupport } from "@/pages/admin/Support";

// GDPR pages (feature flag protected)
import { PrivacySettings } from "@/pages/gdpr/PrivacySettings";
import { ConsentPreferences } from "@/pages/gdpr/ConsentPreferences";
import { CookieSettings } from "@/pages/gdpr/CookieSettings";
import { UserRights } from "@/pages/gdpr/UserRights";
import { AdminUserRights } from "@/pages/gdpr/AdminUserRights";
import RegisterOfProcessing from "@/pages/gdpr/RegisterOfProcessing";
import BreachManagement from "@/pages/gdpr/BreachManagement";
import InternationalTransfers from "@/pages/gdpr/InternationalTransfers";
import ComplianceDocuments from "@/pages/gdpr/ComplianceDocuments";

// GDPR components
import { CookieBanner } from "@/components/gdpr/CookieBanner";
import { ConsentManager, useConsent } from "@/components/gdpr/ConsentManager";

// User pages
import { UserDashboard } from "@/pages/user/Dashboard";
import { UserCourses } from "@/pages/user/Courses";
import { UserSettings } from "@/pages/user/Settings";
import { UserProfile } from "@/pages/user/Profile";
import { UserSupport } from "@/pages/user/Support";

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    if (!isLoading && isAuthenticated && requiredRole && user?.role !== requiredRole) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      // Redirect to appropriate dashboard based on user role
      const redirectPath = user?.role === 'admin' ? '/admin' : user?.role === 'user' ? '/user' : '/superadmin';
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 500);
    }

    // Check if password change is required
    if (!isLoading && isAuthenticated && user?.requiresPasswordChange) {
      setShowPasswordChangeModal(true);
    }
  }, [isAuthenticated, isLoading, user, requiredRole, toast]);

  const handlePasswordChangeSuccess = (updatedUser: any) => {
    // Update the user data in the query cache
    queryClient.setQueryData(["/api/auth/user"], updatedUser);
    setShowPasswordChangeModal(false);
    
    toast({
      title: "Welcome!",
      description: "Your password has been changed successfully. You can now access the application.",
      variant: "default",
    });
    
    // Redirect to appropriate dashboard based on user role
    const redirectPath = updatedUser.role === 'admin' ? '/admin' : updatedUser.role === 'user' ? '/user' : '/superadmin';
    setTimeout(() => {
      window.location.href = redirectPath;
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Show password change modal if required - blocks all access
  if (user?.requiresPasswordChange || showPasswordChangeModal) {
    return (
      <>
        <PasswordChangeModal
          isOpen={true}
          onSuccess={handlePasswordChangeSuccess}
          userEmail={user?.email || ""}
        />
        {/* Block all other content */}
        <div className="min-h-screen bg-base-100" />
      </>
    );
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <Switch>
      {/* SuperAdmin routes */}
      <Route path="/superadmin">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminDashboard />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/organisations">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminOrganisations />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/users">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminUsers />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/course-builder">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminCourseBuilder />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/courses">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminCourses />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/email-templates">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminEmailTemplates />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/email-logs">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminEmailLogs />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/settings">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminSettings />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/profile">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminProfile />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/plans">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminPlans />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/subscriptions">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminSubscriptionManager />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/support">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <SuperAdminSupport />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/consent-preferences">
        <ProtectedRoute requiredRole="superadmin">
          <SuperAdminLayout>
            <ConsentPreferences />
          </SuperAdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/users">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/courses">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminCourses />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/training-matrix">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminTrainingMatrix />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/certificates">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminCertificates />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/billing">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminBilling />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/email-templates">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminEmailTemplates />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/audit-log">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AuditLog />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/settings">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminOrganisationSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/profile">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminProfile />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/support">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminSupport />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/consent-preferences">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <ConsentPreferences />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      
      {/* GDPR Privacy Settings (feature flag protected) */}
      <Route path="/admin/privacy-settings">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <PrivacySettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR Cookie Settings (feature flag protected) */}
      <Route path="/admin/cookie-settings">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <CookieSettings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR User Rights Management (feature flag protected) */}
      <Route path="/admin/user-rights">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminUserRights />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR Register of Processing Activities (Article 30 compliance) */}
      <Route path="/admin/processing-activities">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <RegisterOfProcessing />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR Breach Management (Articles 33 & 34 compliance) */}
      <Route path="/admin/breach-management">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <BreachManagement />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR International Transfers (Chapter V Articles 44-49 compliance) */}
      <Route path="/admin/international-transfers">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <InternationalTransfers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR Compliance Documents (Legal document generation and management) */}
      <Route path="/admin/compliance-documents">
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <ComplianceDocuments />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* User routes */}
      <Route path="/user">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <UserDashboard />
          </UserLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/user/courses">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <UserCourses />
          </UserLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/user/settings">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <UserSettings />
          </UserLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/user/profile">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <UserProfile />
          </UserLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/user/support">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <UserSupport />
          </UserLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/user/consent-preferences">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <ConsentPreferences />
          </UserLayout>
        </ProtectedRoute>
      </Route>

      {/* GDPR User Rights (feature flag protected) */}
      <Route path="/user/rights">
        <ProtectedRoute requiredRole="user">
          <UserLayout>
            <UserRights />
          </UserLayout>
        </ProtectedRoute>
      </Route>

      {/* Default route - redirect based on role */}
      <Route path="/">
        <ProtectedRoute>
          {user?.role === 'superadmin' && (
            <SuperAdminLayout>
              <SuperAdminDashboard />
            </SuperAdminLayout>
          )}
          {user?.role === 'admin' && (
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          )}
          {user?.role === 'user' && (
            <UserLayout>
              <UserDashboard />
            </UserLayout>
          )}
        </ProtectedRoute>
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// Component that uses ConsentManager context
function AppContent() {
  const { updateConsents } = useConsent();

  const handleConsentUpdate = (consents: any) => {
    updateConsents(consents);
  };

  return (
    <div data-theme="light">
      <Toaster />
      <Router />
      <CookieBanner onConsentGiven={handleConsentUpdate} />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConsentManager>
          <AppContent />
        </ConsentManager>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
