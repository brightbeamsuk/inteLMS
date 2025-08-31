import { useState } from 'react';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const demoCredentials = [
    {
      role: 'SuperAdmin',
      email: 'superadmin@demo.app',
      password: 'superadmin123',
      className: 'btn-primary'
    },
    {
      role: 'Admin (Acme Care Ltd)',
      email: 'admin.acme@demo.app',
      password: 'admin123',
      className: 'btn-secondary'
    },
    {
      role: 'Admin (Ocean Nurseries CIC)',
      email: 'admin.ocean@demo.app',
      password: 'admin123',
      className: 'btn-secondary'
    },
    {
      role: 'User (Alice - Acme)',
      email: 'alice@acme.demo',
      password: 'user123',
      className: 'btn-accent'
    },
    {
      role: 'User (Dan - Ocean)',
      email: 'dan@ocean.demo',
      password: 'user123',
      className: 'btn-accent'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Login successful, redirect to appropriate dashboard
        window.location.href = data.redirectUrl || '/dashboard';
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (cred: typeof demoCredentials[0]) => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cred.email, password: cred.password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Login successful, redirect to appropriate dashboard
        window.location.href = data.redirectUrl || '/dashboard';
      } else {
        setError(data.message || 'Demo login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10"></div>
      <div className="absolute inset-0 bg-[linear-gradient(60deg,_transparent_40%,_rgba(255,255,255,0.1)_40%,_rgba(255,255,255,0.1)_60%,_transparent_60%)] bg-[length:100px_100px] animate-pulse"></div>
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-20 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute top-40 right-32 w-16 h-16 bg-secondary/20 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute bottom-32 left-32 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-bounce delay-2000"></div>
      <div className="absolute bottom-20 right-20 w-12 h-12 bg-info/20 rounded-full blur-xl animate-bounce delay-500"></div>
      
      {/* Book/Learning Icons Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 text-4xl">📚</div>
        <div className="absolute top-1/3 right-1/4 text-3xl">🎓</div>
        <div className="absolute bottom-1/3 left-1/3 text-3xl">💡</div>
        <div className="absolute bottom-1/4 right-1/3 text-4xl">🏆</div>
        <div className="absolute top-1/2 left-10 text-2xl">📖</div>
        <div className="absolute top-1/6 right-10 text-2xl">✨</div>
      </div>
      
      {/* Main Login Card */}
      <div className="relative z-10 card w-full max-w-md bg-base-100/95 backdrop-blur-sm shadow-2xl border border-base-content/10">
        <div className="card-body">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full mb-4 shadow-lg">
              <i className="fas fa-graduation-cap text-2xl text-white"></i>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" data-testid="text-app-title">LMS Platform</h1>
            <p className="text-base-content/60 mt-2" data-testid="text-app-subtitle">White-label Learning Management System</p>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-medium">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-envelope text-base-content/40"></i>
                </div>
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="input input-bordered w-full pl-10 focus:border-primary transition-colors" 
                  data-testid="input-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text font-medium">Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-lock text-base-content/40"></i>
                </div>
                <input 
                  type="password" 
                  placeholder="Enter your password" 
                  className="input input-bordered w-full pl-10 focus:border-primary transition-colors" 
                  data-testid="input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-control mb-6">
              <button 
                type="submit" 
                className={`btn btn-primary w-full text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 ${isLoading ? 'loading' : ''}`} 
                data-testid="button-signin"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    Signing In...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-sign-in-alt"></i>
                    Sign In
                  </span>
                )}
              </button>
            </div>
          </form>

          <div className="divider text-base-content/40">OR</div>

          <div className="text-center mb-4">
            <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
              <i className="fas fa-rocket text-primary"></i>
              Demo Logins
            </h3>
            <p className="text-sm text-base-content/60">Click any button to explore different role interfaces</p>
          </div>

          <div className="space-y-3">
            {demoCredentials.map((cred, index) => (
              <button
                key={index}
                className={`btn btn-sm w-full ${cred.className} shadow-md hover:shadow-lg transition-all duration-200 ${isLoading ? 'loading' : ''}`}
                onClick={() => handleDemoLogin(cred)}
                data-testid={`button-demo-${cred.role.toLowerCase().replace(/\s+/g, '-')}`}
                disabled={isLoading}
              >
                <span className="flex items-center justify-center gap-2">
                  <i className={`fas ${
                    cred.role.includes('SuperAdmin') ? 'fa-crown' :
                    cred.role.includes('Admin') ? 'fa-user-shield' : 'fa-user'
                  }`}></i>
                  {cred.role}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-info/10 to-success/10 rounded-xl border border-info/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-info/20 rounded-full flex items-center justify-center">
                <i className="fas fa-info-circle text-info text-sm"></i>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Demo Account Information</p>
                <div className="text-xs text-base-content/70 space-y-1">
                  {demoCredentials.map((cred, index) => (
                    <div key={index} className="flex justify-between items-center py-1 border-b border-base-content/10 last:border-0" data-testid={`text-credentials-${index}`}>
                      <span className="font-medium">{cred.role}:</span>
                      <span className="text-right">
                        {cred.email}<br />
                        <span className="text-base-content/50">{cred.password}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}