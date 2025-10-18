import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Footer } from "./Footer";
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  // Fetch support unread ticket count
  const { data: supportUnreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/support/unread-count'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const menuItems = [
    { path: "/superadmin", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/superadmin/organisations", icon: "fas fa-building", label: "Organisations" },
    { path: "/superadmin/users", icon: "fas fa-users", label: "Users" },
    { path: "/superadmin/plans", icon: "fas fa-credit-card", label: "Plans" },
    { path: "/superadmin/subscriptions", icon: "fas fa-chart-line", label: "Subscriptions" },
    { path: "/superadmin/course-builder", icon: "fas fa-hammer", label: "Course Builder" },
    { path: "/superadmin/courses", icon: "fas fa-graduation-cap", label: "Courses" },
    { path: "/superadmin/gdpr-dashboard", icon: "fas fa-shield-alt", label: "GDPR Dashboard" },
    { path: "/superadmin/compliance-export", icon: "fas fa-download", label: "Compliance Export" },
    { path: "/superadmin/email-logs", icon: "fas fa-mail-bulk", label: "Email Logs" },
    { path: "/superadmin/support", icon: "fas fa-headset", label: "Support" },
    { path: "/superadmin/settings", icon: "fas fa-cog", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-base-100" data-theme="light">
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
          <Link href="/superadmin" className="btn btn-ghost" data-testid="link-home">
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
              <div className="badge badge-primary">SuperAdmin</div>
              <div className="avatar">
                <div className="w-8 h-8 rounded-full">
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile"
                      className="object-cover w-full h-full rounded-full"
                      data-testid="img-user-avatar"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`bg-neutral text-neutral-content rounded-full w-8 h-8 flex items-center justify-center ${user?.profileImageUrl ? 'hidden' : ''}`}>
                    <span className="text-xs">
                      {user?.firstName?.[0]}{user?.lastName?.[0] || 'SA'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <Link href="/superadmin/profile" data-testid="link-profile">
                  <i className="fas fa-user"></i> Profile
                </Link>
              </li>
              <li>
                <Link href="/superadmin/settings" data-testid="link-settings">
                  <i className="fas fa-cog"></i> Settings
                </Link>
              </li>
              <li><a href="/api/logout" data-testid="link-logout"><i className="fas fa-sign-out-alt"></i> Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex">
        {/* Desktop Sidebar - Always visible on lg+ */}
        <aside className={`hidden lg:block min-h-screen bg-base-200 text-base-content transition-all duration-300 ${sidebarMinimized ? 'w-20' : 'w-80'}`}>
          {/* Minimize Toggle Button */}
          <div className="p-4 flex justify-end">
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
            <div className="p-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="avatar">
                  <div className="w-12 h-12 rounded-full">
                    <div className="bg-primary text-primary-content rounded-full w-12 h-12 flex items-center justify-center">
                      <span className="text-lg font-bold">
                        {user?.firstName?.[0]}{user?.lastName?.[0] || 'SA'}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-lg" data-testid="text-user-name">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-sm opacity-60" data-testid="text-user-title">
                    {user?.jobTitle || 'Platform Owner'}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <ul className={`menu space-y-2 ${sidebarMinimized ? 'p-2' : 'p-4'}`}>
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`${location === item.path ? "active" : ""} ${sidebarMinimized ? 'justify-center tooltip tooltip-right' : ''}`}
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  data-tip={sidebarMinimized ? item.label : undefined}
                >
                  <i className={item.icon}></i>
                  {!sidebarMinimized && item.label}
                  {/* Show unread ticket count indicator for Support */}
                  {item.path === '/superadmin/support' && supportUnreadData && supportUnreadData.count > 0 && (
                    <div className={`${sidebarMinimized ? 'absolute -top-1 -right-1' : 'ml-2'} animate-pulse`} data-testid="indicator-support-unread">
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
                      <div className="bg-primary text-primary-content rounded-full w-12 h-12 flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {user?.firstName?.[0]}{user?.lastName?.[0] || 'SA'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-lg" data-testid="text-user-name">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-sm opacity-60" data-testid="text-user-title">
                      {user?.jobTitle || 'Platform Owner'}
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
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
      
      {/* Site-wide Footer with Cookie Settings */}
      <Footer />
    </div>
  );
}
