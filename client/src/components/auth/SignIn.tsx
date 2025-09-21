import { useState } from 'react';
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';

type AuthMode = 'login' | 'signup';
type AccountType = 'individual' | 'organisation';

export function SignIn() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Individual signup fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Organisation signup fields
  const [organisationName, setOrganisationName] = useState('');
  const [organisationDisplayName, setOrganisationDisplayName] = useState('');
  const [organisationSubdomain, setOrganisationSubdomain] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');


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


  const handleIndividualSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/register/individual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          firstName, 
          lastName, 
          email, 
          password, 
          confirmPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Registration successful, redirect to user dashboard
        window.location.href = data.redirectUrl || '/user';
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrganisationSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/register/organisation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          organisationName,
          organisationDisplayName,
          organisationSubdomain,
          contactEmail,
          contactPhone,
          address,
          adminFirstName,
          adminLastName,
          adminEmail,
          adminPassword: password,
          confirmPassword
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Registration successful, redirect to admin dashboard
        window.location.href = data.redirectUrl || '/admin';
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setOrganisationName('');
    setOrganisationDisplayName('');
    setOrganisationSubdomain('');
    setContactEmail('');
    setContactPhone('');
    setAddress('');
    setAdminFirstName('');
    setAdminLastName('');
    setAdminEmail('');
    setError('');
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    resetForm();
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
            <div className="mb-8">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-20 w-auto brightness-0 invert"
                data-testid="img-intelms-logo-left"
              />
            </div>
            
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              {authMode === 'login' ? (
                <>
                  Access Your 
                  <span className="block">Learning Dashboard</span>
                </>
              ) : (
                <>
                  Join Our Learning 
                  <span className="block">Community Today</span>
                </>
              )}
            </h2>
            
            <p className="text-white/80 mb-8 text-lg leading-relaxed">
              {authMode === 'login' 
                ? 'Welcome back! Continue your learning journey with our comprehensive LMS platform designed for exceptional educational experiences.'
                : 'Join thousands of learners and organizations using our comprehensive LMS platform to deliver exceptional educational experiences and track progress effectively.'
              }
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
      <div className="w-full lg:w-1/2 flex items-start justify-center p-8 bg-white pt-32">
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

          {/* Auth Mode Toggle */}
          <div className="mb-8">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
              <button
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  authMode === 'login' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => switchMode('login')}
                data-testid="button-login-tab"
              >
                Login
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  authMode === 'signup' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => switchMode('signup')}
                data-testid="button-signup-tab"
              >
                Sign Up
              </button>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </h2>
            <p className="text-gray-600">
              {authMode === 'login' 
                ? 'Enter your credentials to access your learning dashboard'
                : 'Join thousands of users on our learning platform'
              }
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          {authMode === 'login' && (
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
          )}

          {/* Signup Forms */}
          {authMode === 'signup' && (
            <div className="space-y-6">
              {/* Account Type Toggle */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    accountType === 'individual' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setAccountType('individual')}
                  data-testid="button-individual-account"
                >
                  <i className="fas fa-user mr-2"></i>
                  Individual
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    accountType === 'organisation' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setAccountType('organisation')}
                  data-testid="button-organisation-account"
                >
                  <i className="fas fa-building mr-2"></i>
                  Organisation
                </button>
              </div>

              {/* Individual Signup Form */}
              {accountType === 'individual' && (
                <form onSubmit={handleIndividualSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <input 
                        type="text" 
                        placeholder="First name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                        data-testid="input-first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input 
                        type="text" 
                        placeholder="Last name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                        data-testid="input-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

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
                        data-testid="input-signup-email"
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
                        placeholder="Create password (min 6 characters)"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                        data-testid="input-signup-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className="fas fa-lock text-gray-400"></i>
                      </div>
                      <input 
                        type="password" 
                        placeholder="Confirm your password"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                        data-testid="input-confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-[#634396] hover:bg-[#5a3a87] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    data-testid="button-signup-individual"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-plus"></i>
                        Create Individual Account
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Organisation Signup Form */}
              {accountType === 'organisation' && (
                <form onSubmit={handleOrganisationSignup} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">Organisation Account</h3>
                    <p className="text-xs text-blue-700">
                      Create an organisation account with admin access to manage users, courses, and training programs.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organisation Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g., Acme Corporation Ltd"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                      data-testid="input-org-name"
                      value={organisationName}
                      onChange={(e) => setOrganisationName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g., Acme Corp"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                      data-testid="input-org-display-name"
                      value={organisationDisplayName}
                      onChange={(e) => setOrganisationDisplayName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subdomain <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g., acme-corp"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                      data-testid="input-org-subdomain"
                      value={organisationSubdomain}
                      onChange={(e) => setOrganisationSubdomain(e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lowercase letters, numbers, and hyphens only. This will be used for your organisation's URL.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Email
                    </label>
                    <input 
                      type="email" 
                      placeholder="contact@organisation.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                      data-testid="input-org-contact-email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone
                    </label>
                    <input 
                      type="tel" 
                      placeholder="+44 1234 567890"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                      data-testid="input-org-contact-phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <textarea 
                      placeholder="Full organisation address"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                      data-testid="input-org-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">Admin User Details</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Admin First Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="First name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                          data-testid="input-admin-first-name"
                          value={adminFirstName}
                          onChange={(e) => setAdminFirstName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Admin Last Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="Last name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                          data-testid="input-admin-last-name"
                          value={adminLastName}
                          onChange={(e) => setAdminLastName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Email <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <i className="fas fa-envelope text-gray-400"></i>
                        </div>
                        <input 
                          type="email" 
                          placeholder="admin@organisation.com"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                          data-testid="input-admin-email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <i className="fas fa-lock text-gray-400"></i>
                        </div>
                        <input 
                          type="password" 
                          placeholder="Create password (min 6 characters)"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                          data-testid="input-admin-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <i className="fas fa-lock text-gray-400"></i>
                        </div>
                        <input 
                          type="password" 
                          placeholder="Confirm password"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#634396] focus:border-transparent transition-all"
                          data-testid="input-admin-confirm-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-[#634396] hover:bg-[#5a3a87] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    data-testid="button-signup-organisation"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Creating Organisation...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-building"></i>
                        Create Organisation Account
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}


          {/* Signup help text */}
          {authMode === 'signup' && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <i className="fas fa-check text-white text-xs"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800 mb-2">Ready to Get Started?</p>
                  <div className="text-xs text-green-700 space-y-1">
                    <p>• Individual accounts get certificate access and can join organisations</p>
                    <p>• Organisation accounts include admin access to manage users and courses</p>
                    <p>• All accounts are free to create and come with our standard features</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}