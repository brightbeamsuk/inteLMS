import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch organization data for the current admin user
  const { data: organization } = useQuery({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  // Fetch overdue assignments count
  const { data: overdueData } = useQuery({
    queryKey: ['/api/admin/overdue-count', user?.organisationId],
    enabled: !!user?.organisationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch plan features to check access
  const { data: planFeatures = [] } = useQuery({
    queryKey: ['/api/plan-features/mappings', organization?.planId],
    enabled: !!organization?.planId,
    queryFn: async () => {
      const response = await fetch(`/api/plan-features/mappings/${organization.planId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch plan features');
      }
      return response.json();
    },
  });


  // Check if audit log feature is enabled
  const auditLogFeature = planFeatures.find((feature: any) => feature.featureId === 'audit_log');
  const hasAuditLogAccess = auditLogFeature?.enabled || false;

  const menuItems = [
    { path: "/admin", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/admin/users", icon: "fas fa-users", label: "Users" },
    { path: "/admin/courses", icon: "fas fa-graduation-cap", label: "Courses" },
    { path: "/admin/training-matrix", icon: "fas fa-table", label: "Training Matrix" },
    { path: "/admin/certificates", icon: "fas fa-certificate", label: "Certificates" },
    { path: "/admin/billing", icon: "fas fa-credit-card", label: "Billing" },
    ...(hasAuditLogAccess ? [{ path: "/admin/audit-log", icon: "fas fa-history", label: "Audit Log" }] : []),
    { path: "/admin/settings", icon: "fas fa-cog", label: "Organisation Settings" },
  ];

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-base-100" data-theme="light">
        {/* Header */}
        <div className="navbar bg-base-300 shadow-lg">
          <div className="navbar-start">
            <div className="dropdown">
              <label 
                htmlFor="admin-drawer-toggle"
                tabIndex={0} 
                role="button" 
                className="btn btn-ghost btn-circle lg:hidden cursor-pointer"
                data-testid="button-menu-toggle"
              >
                <i className="fas fa-bars text-xl"></i>
              </label>
            </div>
            <Link href="/admin" className="btn btn-ghost" data-testid="link-home">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-16 w-auto object-contain"
              />
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
            
            <aside className="min-h-full w-80 bg-base-200 text-base-content">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="avatar">
                    {organization?.logoUrl ? (
                      <div className="w-12 rounded-full">
                        <img 
                          src={organization.logoUrl} 
                          alt={`${organization.displayName} logo`}
                          className="w-12 h-12 rounded-full object-contain bg-base-100"
                          data-testid="img-organization-logo"
                        />
                      </div>
                    ) : (
                      <div className="w-12 rounded-full bg-primary text-primary-content flex items-center justify-center">
                        <i className="fas fa-building text-xl"></i>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-lg" data-testid="text-user-name">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-sm opacity-60" data-testid="text-user-organisation">
                      {organization?.displayName || 'Loading...'}
                    </div>
                  </div>
                </div>
              </div>
              
              <ul className="menu p-4 space-y-2">
                {menuItems.map((item) => (
                  <li key={item.path}>
                    <Link 
                      href={item.path}
                      className={location === item.path ? "active" : ""}
                      onClick={() => setDrawerOpen(false)}
                      data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <i className={item.icon}></i>
                      {item.label}
                      {/* Show overdue count indicator for Training Matrix */}
                      {item.path === '/admin/training-matrix' && overdueData?.overdueCount > 0 && (
                        <div className="ml-2 animate-pulse" data-testid="indicator-overdue">
                          <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full">
                            {overdueData.overdueCount}
                          </div>
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}