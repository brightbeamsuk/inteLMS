export function SignIn() {
  const demoCredentials = [
    {
      role: 'SuperAdmin',
      email: 'superadmin@demo.app',
      password: 'Passw0rd!',
      className: 'btn-primary'
    },
    {
      role: 'Admin (Acme Care Ltd)',
      email: 'admin.acme@demo.app',
      password: 'Passw0rd!',
      className: 'btn-secondary'
    },
    {
      role: 'Admin (Ocean Nurseries CIC)',
      email: 'admin.ocean@demo.app',
      password: 'Passw0rd!',
      className: 'btn-secondary'
    },
    {
      role: 'User (Alice - Acme)',
      email: 'alice@acme.demo',
      password: 'Learner1!',
      className: 'btn-accent'
    },
    {
      role: 'User (Dan - Ocean)',
      email: 'dan@ocean.demo',
      password: 'Learner1!',
      className: 'btn-accent'
    }
  ];

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold" data-testid="text-app-title">LMS Platform</h1>
            <p className="text-base-content/60" data-testid="text-app-subtitle">White-label Learning Management System</p>
          </div>

          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="input input-bordered w-full" 
              data-testid="input-email"
            />
          </div>

          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input 
              type="password" 
              placeholder="Enter your password" 
              className="input input-bordered w-full" 
              data-testid="input-password"
            />
          </div>

          <div className="form-control mb-6">
            <button className="btn btn-primary w-full" data-testid="button-signin">
              Sign In
            </button>
          </div>

          <div className="divider">OR</div>

          <div className="text-center mb-4">
            <h3 className="font-semibold">Demo Logins</h3>
            <p className="text-sm text-base-content/60">Click any button to login and experience different role interfaces</p>
          </div>

          <div className="space-y-2">
            {demoCredentials.map((cred, index) => (
              <button
                key={index}
                className={`btn btn-sm w-full ${cred.className}`}
                onClick={async () => {
                  // First ensure user is logged in
                  const response = await fetch('/api/auth/user');
                  if (response.status === 401) {
                    // User not logged in, redirect to login first
                    window.location.href = '/api/login';
                    return;
                  }
                  
                  // User is logged in, now switch to demo mode
                  const demoRole = cred.role === 'SuperAdmin' ? 'superadmin' 
                    : cred.role === 'Admin (Acme Care)' ? 'admin-acme'
                    : cred.role === 'Admin (Ocean Nurseries)' ? 'admin-ocean'
                    : cred.role === 'User (Alice)' ? 'user-alice'
                    : 'user-dan';
                  
                  const demoResponse = await fetch(`/api/demo-login/${demoRole}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  if (demoResponse.ok) {
                    // Refresh the page to update the user context
                    window.location.reload();
                  } else {
                    console.error('Failed to switch to demo mode');
                  }
                }}
                data-testid={`button-demo-${cred.role.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {cred.role}
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-success/20 rounded-lg">
            <p className="text-xs text-center">
              <strong>New!</strong> Demo logins now work with any Replit account! Click any button above to experience different user roles without changing your email.
            </p>
          </div>

          <div className="text-center mt-6">
            <div className="text-xs text-base-content/60">
              <h4 className="font-semibold mb-2">Demo Credentials</h4>
              {demoCredentials.map((cred, index) => (
                <div key={index} className="mb-1" data-testid={`text-credentials-${index}`}>
                  <strong>{cred.role}:</strong><br />
                  {cred.email} / {cred.password}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-4">
            <a href="#" className="link link-primary text-sm" data-testid="link-forgot-password">
              Forgot Password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
