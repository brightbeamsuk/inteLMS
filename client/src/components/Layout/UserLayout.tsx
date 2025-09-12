import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';

interface UserLayoutProps {
  children: React.ReactNode;
}

interface Organization {
  id: string;
  planId: string;
  logoUrl?: string;
  displayName: string;
}

export function UserLayout({ children }: UserLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch organization data for the current user
  const { data: organization, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });

  // Fetch plan features to check access
  const { data: planFeatures = [], isLoading: planFeaturesLoading } = useQuery({
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

  // Helper function to check feature access
  const hasFeatureAccess = (featureId: string) => {
    // If plan features are still loading, assume access is available to prevent UI flash
    if (planFeaturesLoading) return true;
    
    const feature = planFeatures.find((f: any) => f.featureId === featureId);
    return feature?.enabled || false;
  };

  // Check if branding feature is enabled
  const hasBrandingAccess = hasFeatureAccess('remove_branding');
  
  // Check if custom branding colors feature is enabled
  const hasCustomBrandingAccess = hasFeatureAccess('custom_branding_colors');

  // Apply custom colors only if organization has the feature enabled AND plan includes it
  const customStyles = organization?.useCustomColors && hasCustomBrandingAccess ? {
    '--primary-color': organization.primaryColor || '#3b82f6',
    '--accent-color': organization.accentColor || '#3b82f6',
  } : {};

  // Fetch support unread ticket count
  const { data: supportUnreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/support/unread-count'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const menuItems = [
    { path: "/user", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/user/courses", icon: "fas fa-graduation-cap", label: "My Courses" },
    { path: "/user/support", icon: "fas fa-headset", label: "Support" },
    { path: "/user/settings", icon: "fas fa-cog", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-base-100" data-theme="light" style={customStyles}>
      {/* Header */}
      <div className="navbar bg-base-300 shadow-lg">
        <div className="navbar-start">
          <button 
            className="btn btn-ghost btn-circle lg:hidden"
            onClick={() => setDrawerOpen(!drawerOpen)}
            data-testid="button-menu-toggle"
          >
            <i className="fas fa-bars text-xl"></i>
          </button>
          <Link href="/user" className="btn btn-ghost" data-testid="link-home">
            {!orgLoading && organization && hasBrandingAccess && organization?.logoUrl ? (
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
              <div className="badge badge-accent">User</div>
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
                    <span className="text-xs">
                      {user?.firstName?.[0]}{user?.lastName?.[0] || 'U'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              <li><Link href="/user/profile" data-testid="link-profile"><i className="fas fa-user"></i> Profile</Link></li>
              <li><Link href="/user/settings" data-testid="link-settings"><i className="fas fa-cog"></i> Settings</Link></li>
              <li><a href="/api/logout" data-testid="link-logout"><i className="fas fa-sign-out-alt"></i> Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="drawer lg:drawer-open">
        <input 
          id="user-drawer-toggle" 
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
            htmlFor="user-drawer-toggle" 
            aria-label="close sidebar" 
            className="drawer-overlay"
            onClick={() => setDrawerOpen(false)}
          ></label>
          
          <aside className="min-h-full w-80 bg-base-200 text-base-content">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="avatar">
                  <div className="w-12 h-12 rounded-full">
                    {user?.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`bg-neutral text-neutral-content rounded-full w-12 h-12 flex items-center justify-center ${user?.profileImageUrl ? 'hidden' : ''}`}>
                      <span className="text-lg">{user?.firstName?.charAt(0) || 'U'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-lg" data-testid="text-user-name">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-sm opacity-60" data-testid="text-user-title">
                    {user?.jobTitle || 'Learner'}
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
                    data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-').replace('my-', '')}`}
                  >
                    <i className={item.icon}></i>
                    {item.label}
                    {/* Show unread ticket count indicator for Support */}
                    {item.path === '/user/support' && supportUnreadData && supportUnreadData.count > 0 && (
                      <div className="ml-2 animate-pulse" data-testid="indicator-support-unread">
                        <div className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full">
                          {supportUnreadData.count}
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
  );
}
