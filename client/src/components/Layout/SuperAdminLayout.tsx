import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = [
    { path: "/superadmin", icon: "fas fa-tachometer-alt", label: "Dashboard" },
    { path: "/superadmin/organisations", icon: "fas fa-building", label: "Organisations" },
    { path: "/superadmin/users", icon: "fas fa-users", label: "Users" },
    { path: "/superadmin/course-builder", icon: "fas fa-hammer", label: "Course Builder" },
    { path: "/superadmin/courses", icon: "fas fa-graduation-cap", label: "Courses" },
    { path: "/superadmin/settings", icon: "fas fa-cog", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-base-100" data-theme="light">
      {/* Header */}
      <div className="navbar bg-base-300 shadow-lg">
        <div className="navbar-start">
          <div className="dropdown">
            <div 
              tabIndex={0} 
              role="button" 
              className="btn btn-ghost btn-circle lg:hidden"
              onClick={() => setDrawerOpen(!drawerOpen)}
              data-testid="button-menu-toggle"
            >
              <i className="fas fa-bars text-xl"></i>
            </div>
          </div>
          <Link href="/superadmin" className="btn btn-ghost text-xl font-bold" data-testid="link-home">
            LMS Platform
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
      <div className="drawer lg:drawer-open">
        <input 
          id="drawer-toggle" 
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
            htmlFor="drawer-toggle" 
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
                        className="object-cover w-full h-full rounded-full"
                      />
                    ) : (
                      <div className="bg-primary text-primary-content rounded-full w-12 h-12 flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {user?.firstName?.[0]}{user?.lastName?.[0] || 'SA'}
                        </span>
                      </div>
                    )}
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
      </div>
    </div>
  );
}
