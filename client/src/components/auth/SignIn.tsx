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
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold" data-testid="text-app-title">LMS Platform</h1>
            <p className="text-base-content/60" data-testid="text-app-subtitle">White-label Learning Management System</p>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="input input-bordered w-full" 
                data-testid="input-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-control mb-6">
              <button 
                type="submit" 
                className={`btn btn-primary w-full ${isLoading ? 'loading' : ''}`} 
                data-testid="button-signin"
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="divider">OR</div>

          <div className="text-center mb-4">
            <h3 className="font-semibold">Demo Logins</h3>
            <p className="text-sm text-base-content/60">Click any button to login and experience different role interfaces</p>
          </div>

          <div className="space-y-2">
            {demoCredentials.map((cred, index) => (
              <button
                key={index}
                className={`btn btn-sm w-full ${cred.className} ${isLoading ? 'loading' : ''}`}
                onClick={() => handleDemoLogin(cred)}
                data-testid={`button-demo-${cred.role.toLowerCase().replace(/\s+/g, '-')}`}
                disabled={isLoading}
              >
                {cred.role}
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-success/20 rounded-lg">
            <p className="text-xs text-center">
              <strong>Demo Credentials:</strong> Use the credentials below or click the demo buttons above.
            </p>
          </div>

          <div className="text-center mt-4">
            <div className="text-xs text-base-content/60">
              <h4 className="font-semibold mb-2">Available Demo Accounts</h4>
              {demoCredentials.map((cred, index) => (
                <div key={index} className="mb-1" data-testid={`text-credentials-${index}`}>
                  <strong>{cred.role}:</strong><br />
                  {cred.email} / {cred.password}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}