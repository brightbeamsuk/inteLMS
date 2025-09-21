import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FeatureUpgradeModal } from "@/components/FeatureUpgradeModal";
import { Footer } from "./Footer";
import { useIsGdprEnabled, useIsGdprFeatureEnabled } from "@/hooks/useGdpr";
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  path: string;
  icon: string;
  label: string;
  requiresFeature?: string;
  gdprFeature?: string;
}

interface GdprMenuItem extends MenuItem {
  gdprFeature: string;
}

interface Organization {
  id: string;
  planId: string;
  logoUrl?: string;
  displayName: string;
  useCustomColors?: boolean;
  primaryColor?: string;
  accentColor?: string;
}

interface OverdueData {
  overdueCount: number;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [gdprMenuExpanded, setGdprMenuExpanded] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    featureName: string;
    featureDescription: string;
    featureIcon: string;
  }>({
    isOpen: false,
    featureName: '',
    featureDescription: '',
    featureIcon: ''
  });

  const isGdprEnabled = useIsGdprEnabled();
  const ropaEnabled = useIsGdprFeatureEnabled('ropaManagement');
  const userRightsEnabled = useIsGdprFeatureEnabled('userRights');
  const cookiesEnabled = useIsGdprFeatureEnabled('cookieManagement');

  // Fetch organization data for the current admin user
  const { data: organization, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });

  // Fetch overdue assignments count
  const { data: overdueData } = useQuery<OverdueData>({
    queryKey: ['/api/admin/overdue-count', user?.organisationId],
    enabled: !!user?.organisationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch support unread ticket count
  const { data: supportUnreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/support/unread-count'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch plan features to check access
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
    // If plan features are still loading, assume access is available to prevent lock icon flash
    if (planFeaturesLoading) return true;
    
    const feature = planFeatures.find((f: any) => f.featureId === featureId);
    return feature?.enabled || false;
  };

  // Check if branding feature is enabled
  const hasBrandingAccess = hasFeatureAccess('remove_branding');

  // Check if custom branding colors feature is enabled
  const hasCustomBrandingAccess = hasFeatureAccess('custom_branding_colors');

  // Apply custom colors only if organization has the feature enabled AND plan includes it
  const customStyles: React.CSSProperties = organization?.useCustomColors && hasCustomBrandingAccess ? {
    '--primary-color': organization.primaryColor || '#3b82f6',
    '--accent-color': organization.accentColor || '#3b82f6',
  } as React.CSSProperties : {};

  // Feature definitions for premium features
  const featureDefinitions = {
    training_matrix: {
      name: "Training Matrix",
      description: "Advanced training matrix functionality for managing user training requirements and tracking compliance across your organization.",
      icon: "fas fa-table"
    },
    audit_log: {
      name: "Audit Log",
      description: "Track all user activities with detailed timestamps and comprehensive platform monitoring for security and compliance.",
      icon: "fas fa-history"
    },
    custom_reports: {
      name: "Custom Reports",
      description: "Generate detailed reports and analytics with custom filters, data visualization, and export capabilities.",
      icon: "fas fa-chart-bar"
    },
    live_chat_support: {
      name: "Live Chat Support",
      description: "Get instant help with a dedicated live chat support widget for immediate assistance and technical support.",
      icon: "fas fa-comments"
    }
  };

  // Handle feature access with upgrade modal
  const handleFeatureClick = (featureId: string, defaultPath: string) => {
    if (hasFeatureAccess(featureId)) {
      window.location.href = defaultPath;
      return;
    }
    
    const feature = featureDefinitions[featureId as keyof typeof featureDefinitions];
    if (feature) {
      setUpgradeModal({
        isOpen: true,
        featureName: feature.name,
        featureDescription: feature.description,
        featureIcon: feature.icon
      });
    }
  };

  const menuItems: MenuItem[] = [
    { path: "/admin", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/admin/users", icon: "fas fa-users", label: "Users" },
    { path: "/admin/courses", icon: "fas fa-graduation-cap", label: "Courses" },
    { 
      path: "/admin/training-matrix", 
      icon: "fas fa-table", 
      label: "Training Matrix",
      requiresFeature: "training_matrix"
    },
    { path: "/admin/certificates", icon: "fas fa-certificate", label: "Certificates" },
    { path: "/admin/email-templates", icon: "fas fa-envelope", label: "Email Templates" },
    { path: "/admin/support", icon: "fas fa-headset", label: "Support" },
    { path: "/admin/billing", icon: "fas fa-credit-card", label: "Billing" },
    { 
      path: "/admin/audit-log", 
      icon: "fas fa-history", 
      label: "Audit Log",
      requiresFeature: "audit_log"
    },
    { path: "/admin/settings", icon: "fas fa-cog", label: "Organisation Settings" },
  ];

  const gdprMenuItems: GdprMenuItem[] = [
    { 
      path: "/admin/gdpr-dashboard", 
      icon: "fas fa-tachometer-alt", 
      label: "Compliance Dashboard",
      gdprFeature: "general"
    },
    { 
      path: "/admin/compliance-export", 
      icon: "fas fa-download", 
      label: "Compliance Export",
      gdprFeature: "general"
    },
    { 
      path: "/admin/processing-activities", 
      icon: "fas fa-file-alt", 
      label: "Register of Processing Activities",
      gdprFeature: "ropaManagement"
    },
    { 
      path: "/admin/user-rights", 
      icon: "fas fa-user-shield", 
      label: "User Rights Management",
      gdprFeature: "userRights"
    },
    { 
      path: "/admin/privacy-settings", 
      icon: "fas fa-shield-alt", 
      label: "Privacy Settings",
      gdprFeature: "dataRetention"
    },
    { 
      path: "/admin/cookie-settings", 
      icon: "fas fa-cookie-bite", 
      label: "Cookie Management",
      gdprFeature: "cookieManagement"
    }
  ];

  // Filter GDPR menu items based on enabled features
  const availableGdprItems = gdprMenuItems.filter(item => {
    switch (item.gdprFeature) {
      case 'general':
        return true; // Dashboard and export available when GDPR enabled
      case 'ropaManagement':
        return ropaEnabled;
      case 'userRights':
        return userRightsEnabled;
      case 'cookieManagement':
        return cookiesEnabled;
      case 'dataRetention':
        return true; // Privacy settings generally available when GDPR enabled
      default:
        return false;
    }
  });

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-base-100" data-theme="light" style={customStyles}>
        {/* Header */}
        <div className="navbar bg-base-300 shadow-lg">
          <div className="navbar-start">
            <button 
              className="btn btn-ghost btn-circle lg:hidden z-50 relative"
              onClick={() => setDrawerOpen(!drawerOpen)}
              data-testid="button-menu-toggle"
              style={{ touchAction: 'manipulation' }}
            >
              <i className="fas fa-bars text-xl"></i>
            </button>
            <Link href="/admin" className="btn btn-ghost" data-testid="link-home">
              {!orgLoading && organization && hasBrandingAccess && organization.logoUrl ? (
                <img 
                  src={organization.logoUrl} 
                  alt={organization.displayName || "Logo"} 
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to default logo if custom logo fails to load
                    e.currentTarget.src = inteLMSLogo;
                    e.currentTarget.alt = "inteLMS";
                  }}
                />
              ) : (
                <img 
                  src={inteLMSLogo} 
                  alt="inteLMS" 
                  className="h-16 w-auto object-contain"
                />
              )}
            </Link>
          </div>
          
          <div className="navbar-end">
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost" data-testid="button-user-menu">
                <div className="badge badge-secondary">Admin</div>
                <div className="avatar">
                  <div className="w-8 h-8 rounded-full">
                    {user?.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt="Profile"
                        className="w-full h-full object-cover rounded-full"
                        data-testid="img-user-avatar"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`bg-neutral text-neutral-content rounded-full w-8 h-8 flex items-center justify-center ${user?.profileImageUrl ? 'hidden' : ''}`}>
                      <span className="text-xs font-semibold">
                        {user?.firstName?.[0] || ''}{user?.lastName?.[0] || ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
                <li>
                  <Link href="/admin/profile" data-testid="link-profile">
                    <i className="fas fa-user"></i> Profile
                  </Link>
                </li>
                <li>
                  <Link href="/admin/settings" data-testid="link-settings">
                    <i className="fas fa-cog"></i> Settings
                  </Link>
                </li>
                <li><a href="/api/logout" data-testid="link-logout"><i className="fas fa-sign-out-alt"></i> Logout</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="drawer lg:drawer-open">
          <input 
            id="admin-drawer-toggle" 
            type="checkbox" 
            className="drawer-toggle" 
            checked={drawerOpen}
            onChange={(e) => setDrawerOpen(e.target.checked)}
          />
          
          <div className="drawer-content flex flex-col">
            {/* Main Content */}
            <main className="flex-1 p-6">
              {children}
            </main>
          </div>

          {/* Sidebar */}
          <div className="drawer-side">
            <label 
              htmlFor="admin-drawer-toggle" 
              aria-label="close sidebar" 
              className="drawer-overlay"
              onClick={() => setDrawerOpen(false)}
            ></label>
            
            <aside className={`min-h-full bg-base-200 text-base-content transition-all duration-300 ${sidebarMinimized ? 'w-20' : 'w-80'}`}>
              {/* Minimize Toggle Button */}
              <div className="p-4 flex justify-end lg:block hidden">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSidebarMinimized(!sidebarMinimized)}
                  data-testid="button-minimize-sidebar"
                  title={sidebarMinimized ? "Expand Menu" : "Minimize Menu"}
                >
                  <i className={`fas ${sidebarMinimized ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
                </button>
              </div>
              
              {!sidebarMinimized && (
                <div className="p-4 lg:pt-0">
                  <div className="mb-6">
                    <div className="font-bold text-lg" data-testid="text-user-name">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-sm opacity-60" data-testid="text-user-organisation">
                      {organization?.displayName || 'Loading...'}
                    </div>
                  </div>
                </div>
              )}
              
              <ul className={`menu space-y-2 ${sidebarMinimized ? 'p-2' : 'p-4'} lg:pt-0`}>
                {menuItems.map((item) => {
                  const hasAccess = !item.requiresFeature || hasFeatureAccess(item.requiresFeature);
                  
                  return (
                    <li key={item.path}>
                      {item.requiresFeature && !hasAccess ? (
                        <button
                          className={`w-full text-left ${location === item.path ? "active" : ""} relative ${sidebarMinimized ? 'justify-center tooltip tooltip-right' : ''}`}
                          onClick={() => {
                            setDrawerOpen(false);
                            handleFeatureClick(item.requiresFeature!, item.path);
                          }}
                          data-testid={`button-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          data-tip={sidebarMinimized ? item.label : undefined}
                        >
                          <i className={item.icon}></i>
                          {!sidebarMinimized && item.label}
                          {!sidebarMinimized && (
                            <div className="ml-auto">
                              <i className="fas fa-lock text-warning text-sm"></i>
                            </div>
                          )}
                        </button>
                      ) : (
                        <Link 
                          href={item.path}
                          className={`${location === item.path ? "active" : ""} ${sidebarMinimized ? 'justify-center tooltip tooltip-right' : ''}`}
                          onClick={() => setDrawerOpen(false)}
                          data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          data-tip={sidebarMinimized ? item.label : undefined}
                        >
                          <i className={item.icon}></i>
                          {!sidebarMinimized && item.label}
                          {/* Show overdue count indicator for Training Matrix */}
                          {item.path === '/admin/training-matrix' && overdueData && overdueData.overdueCount > 0 && (
                            <div className={`${sidebarMinimized ? 'absolute -top-1 -right-1' : 'ml-2'} animate-pulse`} data-testid="indicator-overdue">
                              <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full">
                                {overdueData.overdueCount}
                              </div>
                            </div>
                          )}
                          {/* Show unread ticket count indicator for Support */}
                          {item.path === '/admin/support' && supportUnreadData && supportUnreadData.count > 0 && (
                            <div className={`${sidebarMinimized ? 'absolute -top-1 -right-1' : 'ml-2'} animate-pulse`} data-testid="indicator-support-unread">
                              <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full">
                                {supportUnreadData.count}
                              </div>
                            </div>
                          )}
                        </Link>
                      )}
                    </li>
                  );
                })}
                
                {/* GDPR Compliance Menu Section */}
                {isGdprEnabled && availableGdprItems.length > 0 && (
                  <>
                    <li className="menu-title">
                      <button
                        className={`w-full text-left font-semibold text-sm opacity-70 uppercase tracking-wide ${sidebarMinimized ? 'justify-center tooltip tooltip-right' : ''}`}
                        onClick={() => !sidebarMinimized && setGdprMenuExpanded(!gdprMenuExpanded)}
                        data-testid="button-gdpr-section"
                        data-tip={sidebarMinimized ? "GDPR Compliance" : undefined}
                      >
                        <i className="fas fa-shield-alt mr-2"></i>
                        {!sidebarMinimized && (
                          <>
                            GDPR Compliance
                            <i className={`fas fa-chevron-${gdprMenuExpanded ? 'down' : 'right'} ml-auto text-xs`}></i>
                          </>
                        )}
                      </button>
                    </li>
                    
                    {(sidebarMinimized || gdprMenuExpanded) && availableGdprItems.map((item) => (
                      <li key={item.path} className={sidebarMinimized ? '' : 'ml-4'}>
                        <Link 
                          href={item.path}
                          className={`${location === item.path ? "active" : ""} ${sidebarMinimized ? 'justify-center tooltip tooltip-right' : ''}`}
                          onClick={() => setDrawerOpen(false)}
                          data-testid={`link-gdpr-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          data-tip={sidebarMinimized ? item.label : undefined}
                        >
                          <i className={item.icon}></i>
                          {!sidebarMinimized && item.label}
                          {/* Special badge for RoPA as it's critical for Article 30 */}
                          {item.path === '/admin/processing-activities' && !sidebarMinimized && (
                            <div className="ml-2">
                              <div className="badge badge-primary badge-xs">Article 30</div>
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </aside>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setDrawerOpen(false)}>
            <aside 
              className="w-80 min-h-screen bg-base-200 text-base-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="avatar">
                    <div className="w-12 h-12 rounded-full">
                      {user?.profileImageUrl ? (
                        <img 
                          src={user.profileImageUrl} 
                          alt="Profile"
                          className="object-cover w-full h-full rounded-full"
                          data-testid="img-mobile-user-avatar"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`bg-neutral text-neutral-content rounded-full w-12 h-12 flex items-center justify-center ${user?.profileImageUrl ? 'hidden' : ''}`}>
                        <span className="text-lg font-bold">
                          {user?.firstName?.[0]}{user?.lastName?.[0] || 'A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-lg" data-testid="text-mobile-user-name">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-sm opacity-60" data-testid="text-mobile-user-title">
                      {user?.jobTitle || 'Administrator'}
                    </div>
                  </div>
                </div>
              </div>
              
              <ul className="menu p-4 space-y-2">
                {menuItems.map((item) => {
                  const hasAccess = !item.requiresFeature || hasFeatureAccess(item.requiresFeature);
                  
                  return (
                    <li key={item.path}>
                      {item.requiresFeature && !hasAccess ? (
                        <button
                          className={`w-full text-left ${location === item.path ? "active" : ""} relative`}
                          onClick={() => {
                            setDrawerOpen(false);
                            handleFeatureClick(item.requiresFeature!, item.path);
                          }}
                          data-testid={`button-mobile-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <i className={item.icon}></i>
                          {item.label}
                          <div className="ml-auto">
                            <i className="fas fa-lock text-warning text-sm"></i>
                          </div>
                        </button>
                      ) : (
                        <Link 
                          href={item.path}
                          className={location === item.path ? "active" : ""}
                          onClick={() => setDrawerOpen(false)}
                          data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <i className={item.icon}></i>
                          {item.label}
                          {/* Show overdue count indicator for Training Matrix */}
                          {item.path === '/admin/training-matrix' && overdueData && overdueData.overdueCount > 0 && (
                            <div className="ml-2 animate-pulse" data-testid="indicator-mobile-overdue">
                              <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full">
                                {overdueData.overdueCount}
                              </div>
                            </div>
                          )}
                          {/* Show unread ticket count indicator for Support */}
                          {item.path === '/admin/support' && supportUnreadData && supportUnreadData.count > 0 && (
                            <div className="ml-2 animate-pulse" data-testid="indicator-mobile-support-unread">
                              <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full">
                                {supportUnreadData.count}
                              </div>
                            </div>
                          )}
                        </Link>
                      )}
                    </li>
                  );
                })}
                
                {/* GDPR Compliance Menu Section for Mobile */}
                {isGdprEnabled && availableGdprItems.length > 0 && (
                  <>
                    <li className="menu-title">
                      <span className="font-semibold text-sm opacity-70 uppercase tracking-wide">
                        <i className="fas fa-shield-alt mr-2"></i>
                        GDPR Compliance
                      </span>
                    </li>
                    
                    {availableGdprItems.map((item) => (
                      <li key={item.path} className="ml-4">
                        <Link 
                          href={item.path}
                          className={location === item.path ? "active" : ""}
                          onClick={() => setDrawerOpen(false)}
                          data-testid={`link-mobile-gdpr-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <i className={item.icon}></i>
                          {item.label}
                          {/* Special badge for RoPA as it's critical for Article 30 */}
                          {item.path === '/admin/processing-activities' && (
                            <div className="ml-2">
                              <div className="badge badge-primary badge-xs">Article 30</div>
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </aside>
          </div>
        )}

        {/* Feature Upgrade Modal */}
        <FeatureUpgradeModal
          isOpen={upgradeModal.isOpen}
          onClose={() => setUpgradeModal(prev => ({ ...prev, isOpen: false }))}
          featureName={upgradeModal.featureName}
          featureDescription={upgradeModal.featureDescription}
          featureIcon={upgradeModal.featureIcon}
        />
        
        {/* Site-wide Footer with Cookie Settings */}
        <Footer />
      </div>
    </ThemeProvider>
  );
}