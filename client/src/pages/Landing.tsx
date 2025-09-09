import { useState } from 'react';
import { SignIn } from "@/components/auth/SignIn";
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';

export function Landing() {
  const [showLoginForm, setShowLoginForm] = useState(false);

  // If user clicked login/signup, show the login form
  if (showLoginForm) {
    return <SignIn />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowLoginForm(true)}
                className="btn btn-outline btn-primary"
                data-testid="button-login"
              >
                Sign In
              </button>
              <button 
                onClick={() => setShowLoginForm(true)}
                className="btn btn-primary"
                data-testid="button-signup"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
                Transform Your
                <span className="text-primary"> Learning </span>
                Experience
              </h1>
              <p className="mt-6 text-xl text-gray-600 leading-8">
                Empower your organization with our comprehensive Learning Management System. 
                Deliver engaging training, track progress, and issue certificates with ease.
              </p>
              <div className="mt-8 sm:flex sm:justify-center lg:justify-start">
                <div className="rounded-md shadow">
                  <button 
                    onClick={() => setShowLoginForm(true)}
                    className="btn btn-primary btn-lg w-full sm:w-auto"
                    data-testid="button-hero-cta"
                  >
                    <i className="fas fa-rocket mr-2"></i>
                    Start Free Trial
                  </button>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <button className="btn btn-outline btn-lg w-full sm:w-auto">
                    <i className="fas fa-play mr-2"></i>
                    Watch Demo
                  </button>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                No credit card required • Setup in minutes • 14-day free trial
              </p>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <div className="relative bg-white rounded-2xl shadow-2xl p-8">
                <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <div className="text-white text-center">
                    <i className="fas fa-graduation-cap text-6xl mb-4"></i>
                    <h3 className="text-xl font-semibold">Interactive Learning</h3>
                    <p className="text-blue-100 mt-2">SCORM-compliant courses</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Comprehensive LMS features designed for modern organizations
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-book-open text-white text-xl"></i>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">SCORM Compliance</h3>
              <p className="mt-4 text-gray-600">
                Full support for SCORM 1.2 and 2004 standards. Upload your existing courses or create new ones.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-certificate text-white text-xl"></i>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Automated Certificates</h3>
              <p className="mt-4 text-gray-600">
                Generate beautiful, branded certificates automatically upon course completion with custom templates.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white text-xl"></i>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Progress Tracking</h3>
              <p className="mt-4 text-gray-600">
                Real-time analytics and reporting to monitor learner progress and course effectiveness.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-white text-xl"></i>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Multi-Tenant</h3>
              <p className="mt-4 text-gray-600">
                Support multiple organizations with isolated data and customizable branding for each.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-mobile-alt text-white text-xl"></i>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Mobile Friendly</h3>
              <p className="mt-4 text-gray-600">
                Responsive design ensures your courses work perfectly on any device, anywhere.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-shield-alt text-white text-xl"></i>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Secure & Compliant</h3>
              <p className="mt-4 text-gray-600">
                Enterprise-grade security with role-based access controls and audit logging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-16">
              Trusted by organizations worldwide
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">10K+</div>
              <div className="text-gray-600 mt-2">Active Learners</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">500+</div>
              <div className="text-gray-600 mt-2">Organizations</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">50K+</div>
              <div className="text-gray-600 mt-2">Courses Completed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">99.9%</div>
              <div className="text-gray-600 mt-2">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              What our customers say
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="flex items-center mb-6">
                <div className="flex text-yellow-400">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
              </div>
              <p className="text-gray-600 italic mb-6">
                "inteLMS transformed our training program. The SCORM compliance and automated certificates 
                saved us countless hours while improving engagement."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                  SJ
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Sarah Johnson</div>
                  <div className="text-gray-600">Training Director, TechCorp</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="flex items-center mb-6">
                <div className="flex text-yellow-400">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
              </div>
              <p className="text-gray-600 italic mb-6">
                "The multi-tenant feature is perfect for our consulting business. Each client gets 
                their own branded portal while we manage everything centrally."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                  MR
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Michael Rodriguez</div>
                  <div className="text-gray-600">CEO, Learning Solutions Inc</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="flex items-center mb-6">
                <div className="flex text-yellow-400">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
              </div>
              <p className="text-gray-600 italic mb-6">
                "Setup was incredibly easy. We had our first course live within hours, 
                not weeks. The analytics help us continuously improve our content."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                  AC
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Anna Chen</div>
                  <div className="text-gray-600">Head of L&D, Global Manufacturing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to transform your training?
          </h2>
          <p className="mt-6 text-xl text-blue-100">
            Join thousands of organizations already using inteLMS to deliver 
            exceptional learning experiences.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setShowLoginForm(true)}
              className="btn btn-white btn-lg"
              data-testid="button-cta-signup"
            >
              <i className="fas fa-rocket mr-2"></i>
              Start Your Free Trial
            </button>
            <button className="btn btn-outline border-white text-white hover:bg-white hover:text-primary btn-lg">
              <i className="fas fa-phone mr-2"></i>
              Contact Sales
            </button>
          </div>
          <p className="mt-4 text-blue-100 text-sm">
            14-day free trial • No setup fees • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-10 w-auto object-contain mb-4 filter invert"
              />
              <p className="text-gray-400 max-w-md">
                The modern Learning Management System that scales with your organization. 
                Deliver training that engages, tracks progress that matters, and certificates that inspire.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">SCORM Support</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 inteLMS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}