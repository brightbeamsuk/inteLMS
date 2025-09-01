import { useState } from 'react';
import inteLMSLogo from '@assets/inteLMS_1756700260326.png';

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
    <div className="min-h-screen flex">
      {/* Left Side - Brand/Marketing Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Purple Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#634396] via-[#7c4fb3] to-[#ec84b5]"></div>
        
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-32 left-16 w-24 h-24 bg-white/10 rounded-full blur-lg"></div>
        <div className="absolute top-1/2 left-10 w-16 h-16 bg-white/10 rounded-full blur-md"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-8">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-12 w-auto brightness-0 invert"
                data-testid="img-intelms-logo-left"
              />
              <h1 className="text-2xl font-bold">inteLMS</h1>
            </div>
            
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              Access Or Create Your 
              <span className="block">Learning Account</span>
            </h2>
            
            <p className="text-white/80 mb-8 text-lg leading-relaxed">
              Join thousands of learners and organizations using our comprehensive LMS platform 
              to deliver exceptional educational experiences and track progress effectively.
            </p>
            
            <div className="space-y-4 text-white/70">
              <div className="flex items-center gap-3">
                <i className="fas fa-check-circle text-white"></i>
                <span>SCORM-compliant course delivery</span>
              </div>
              <div className="flex items-center gap-3">
                <i className="fas fa-check-circle text-white"></i>
                <span>Real-time progress tracking and analytics</span>
              </div>
              <div className="flex items-center gap-3">
                <i className="fas fa-check-circle text-white"></i>
                <span>Multi-tenant organization management</span>
              </div>
              <div className="flex items-center gap-3">
                <i className="fas fa-check-circle text-white"></i>
                <span>Automated certificate generation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <img 
              src={inteLMSLogo} 
              alt="inteLMS" 
              className="h-16 w-auto mx-auto mb-4"
              data-testid="img-intelms-logo-mobile"
            />
            <h1 className="text-2xl font-bold text-gray-800">inteLMS</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Login</h2>
            <p className="text-gray-600">Enter your credentials to access your learning dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-envelope text-gray-400"></i>
                </div>
                <input 
                  type="email" 
                  placeholder="Enter your email address"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                  data-testid="input-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-lock text-gray-400"></i>
                </div>
                <input 
                  type="password" 
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                  data-testid="input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input 
                  id="remember-me" 
                  type="checkbox" 
                  className="h-4 w-4 text-[#634396] focus:ring-[#634396] border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember Me
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#634396] hover:bg-[#5a3a87] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              data-testid="button-signin"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Logging In...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  Log In To My Account
                </>
              )}
            </button>
          </form>

          {/* Demo Section */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or explore with demo accounts</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {demoCredentials.map((cred, index) => (
                <button
                  key={index}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:border-[#634396] hover:bg-gray-50 transition-all duration-200 text-left flex items-center justify-between"
                  onClick={() => handleDemoLogin(cred)}
                  data-testid={`button-demo-${cred.role.toLowerCase().replace(/\s+/g, '-')}`}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-3">
                    <i className={`fas ${
                      cred.role.includes('SuperAdmin') ? 'fa-crown text-yellow-500' :
                      cred.role.includes('Admin') ? 'fa-user-shield text-blue-500' : 'fa-user text-green-500'
                    }`}></i>
                    <span className="font-medium text-gray-700">{cred.role}</span>
                  </div>
                  <i className="fas fa-arrow-right text-gray-400"></i>
                </button>
              ))}
            </div>

            {/* Demo Info */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <i className="fas fa-info text-white text-xs"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-2">Demo Credentials</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    {demoCredentials.slice(0, 3).map((cred, index) => (
                      <div key={index} className="flex justify-between" data-testid={`text-credentials-${index}`}>
                        <span className="font-medium">{cred.email}</span>
                        <span>{cred.password}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}