import { useState } from 'react';
import { SignIn } from "@/components/auth/SignIn";
import { useToast } from "@/hooks/use-toast";
import inteLMSLogo from '@assets/inteLMS_1757337182057.png';
import childcareImage1 from '@assets/stock_images/childcare_workers_wi_2c1ac461.jpg';
import childcareImage2 from '@assets/stock_images/childcare_workers_wi_dee97f5d.jpg';
import elderlyImage1 from '@assets/stock_images/elderly_care_nurse_w_677752cb.jpg';
import elderlyImage2 from '@assets/stock_images/elderly_care_nurse_w_d02fbe22.jpg';

export function Landing() {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    organisation: '',
    phone: '',
    message: '',
  });
  const { toast } = useToast();

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "Thank you for your interest. We'll be in touch soon.",
    });
    setContactForm({
      name: '',
      email: '',
      organisation: '',
      phone: '',
      message: '',
    });
  };

  if (showLoginForm) {
    return <SignIn />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-16 w-auto object-contain"
              />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#training" className="text-gray-700 hover:text-primary transition-colors font-medium">Training</a>
              <a href="#features" className="text-gray-700 hover:text-primary transition-colors font-medium">Features</a>
              <a href="#testimonials" className="text-gray-700 hover:text-primary transition-colors font-medium">Testimonials</a>
              <a href="#contact" className="text-gray-700 hover:text-primary transition-colors font-medium">Contact</a>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowLoginForm(true)}
                className="btn btn-ghost"
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
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full mb-6">
                <span className="text-primary font-semibold text-sm">
                  🎓 Trusted Training Provider
                </span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Expert Training for
                <span className="text-primary block mt-2"> Childcare & Social Care </span>
              </h1>
              <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-2xl">
                Empower your team with comprehensive, compliant training designed specifically for 
                childcare professionals and adult social care workers. Track progress, ensure compliance, 
                and deliver certificates seamlessly.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button 
                  onClick={() => setShowLoginForm(true)}
                  className="btn btn-primary btn-lg"
                  data-testid="button-hero-cta"
                >
                  <i className="fas fa-rocket mr-2"></i>
                  Start Your Free Trial
                </button>
                <a 
                  href="#contact"
                  className="btn btn-outline btn-lg"
                >
                  <i className="fas fa-comment-dots mr-2"></i>
                  Talk to Us
                </a>
              </div>
              <p className="mt-6 text-sm text-gray-500 flex items-center justify-center lg:justify-start gap-4 flex-wrap">
                <span className="flex items-center"><i className="fas fa-check-circle text-green-500 mr-2"></i>No credit card required</span>
                <span className="flex items-center"><i className="fas fa-check-circle text-green-500 mr-2"></i>Setup in minutes</span>
                <span className="flex items-center"><i className="fas fa-check-circle text-green-500 mr-2"></i>14-day free trial</span>
              </p>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <img 
                    src={childcareImage1} 
                    alt="Childcare training" 
                    className="rounded-2xl shadow-2xl object-cover w-full h-64"
                  />
                  <img 
                    src={elderlyImage1} 
                    alt="Elderly care training" 
                    className="rounded-2xl shadow-2xl object-cover w-full h-48"
                  />
                </div>
                <div className="space-y-4 pt-8">
                  <img 
                    src={childcareImage2} 
                    alt="Childcare education" 
                    className="rounded-2xl shadow-2xl object-cover w-full h-48"
                  />
                  <img 
                    src={elderlyImage2} 
                    alt="Social care training" 
                    className="rounded-2xl shadow-2xl object-cover w-full h-64"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Training Areas Section */}
      <section id="training" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
              Specialized Training Solutions
            </h2>
            <p className="text-xl text-gray-600">
              Comprehensive training programs designed for the care sector
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Childcare Training */}
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-shadow">
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-pink-500 text-white p-4 rounded-2xl">
                  <i className="fas fa-child text-3xl"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Childcare Training</h3>
                  <p className="text-gray-600">Expert training for nurseries, childminders, and early years professionals</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-pink-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Safeguarding & Child Protection</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-pink-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Early Years Foundation Stage (EYFS)</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-pink-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Health & Safety in Childcare Settings</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-pink-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Food Hygiene & Nutrition</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-pink-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">First Aid & Emergency Response</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-pink-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Special Educational Needs (SEN)</span>
                </li>
              </ul>
              <a href="#contact" className="btn btn-primary w-full">
                Learn More About Childcare Training
              </a>
            </div>

            {/* Adult Social Care Training */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-shadow">
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-blue-500 text-white p-4 rounded-2xl">
                  <i className="fas fa-hands-helping text-3xl"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Adult Social Care Training</h3>
                  <p className="text-gray-600">Comprehensive training for care homes, domiciliary care, and support workers</p>
                </div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-blue-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Safeguarding Vulnerable Adults</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-blue-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Dementia Care & Awareness</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-blue-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Moving & Handling</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-blue-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Medication Management</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-blue-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Infection Control & Prevention</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-blue-500 mt-1 mr-3"></i>
                  <span className="text-gray-700">Care Quality Commission (CQC) Compliance</span>
                </li>
              </ul>
              <a href="#contact" className="btn btn-primary w-full">
                Learn More About Social Care Training
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
              Everything You Need in One Platform
            </h2>
            <p className="text-xl text-gray-600">
              Powerful features designed to make compliance training simple and effective
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <i className="fas fa-certificate text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Automated Certificates</h3>
              <p className="text-gray-600">
                Generate professional, branded certificates instantly upon course completion. Track expiry dates and renewal requirements automatically.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <i className="fas fa-chart-line text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Compliance Tracking</h3>
              <p className="text-gray-600">
                Real-time dashboards show exactly who needs training, what's expired, and who's compliant. Never miss a CQC or Ofsted inspection requirement.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-green-500 to-teal-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <i className="fas fa-mobile-alt text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Mobile Friendly</h3>
              <p className="text-gray-600">
                Your team can complete training on any device, anywhere. Perfect for busy care professionals working shifts.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-orange-500 to-red-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <i className="fas fa-bell text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Smart Reminders</h3>
              <p className="text-gray-600">
                Automatic email notifications for expiring certificates, overdue training, and upcoming renewals keep everyone on track.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <i className="fas fa-folder-open text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Training Matrix</h3>
              <p className="text-gray-600">
                Visual training matrix shows your entire team's training status at a glance. Export reports for audits with one click.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <i className="fas fa-shield-alt text-white text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & GDPR Compliant</h3>
              <p className="text-gray-600">
                Enterprise-grade security keeps your data safe. Fully GDPR compliant with built-in data protection features.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2">5,000+</div>
              <div className="text-blue-100">Care Professionals Trained</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2">200+</div>
              <div className="text-blue-100">Care Providers</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2">25,000+</div>
              <div className="text-blue-100">Certificates Issued</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2">100%</div>
              <div className="text-blue-100">Compliance Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Trusted by Care Professionals Across the UK
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="bg-gray-50 p-8 rounded-2xl border-2 border-gray-100">
              <div className="flex text-yellow-400 mb-6">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p className="text-gray-700 italic mb-6 text-lg">
                "inteLMS has transformed how we manage training across our 5 nurseries. The automated certificates and compliance tracking saved us from failing our Ofsted inspection!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                  EH
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Emma Harper</div>
                  <div className="text-gray-600">Nursery Manager, Little Stars Group</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl border-2 border-gray-100">
              <div className="flex text-yellow-400 mb-6">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p className="text-gray-700 italic mb-6 text-lg">
                "Our CQC inspection was stress-free thanks to inteLMS. All our staff training records were up-to-date and easily accessible. The inspectors were impressed!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  JP
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">James Patterson</div>
                  <div className="text-gray-600">Director, Sunrise Care Homes</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl border-2 border-gray-100">
              <div className="flex text-yellow-400 mb-6">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p className="text-gray-700 italic mb-6 text-lg">
                "The training matrix feature is brilliant. I can see exactly who needs what training and when. It's made my life as a training coordinator so much easier!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                  SK
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">Sarah Kaur</div>
                  <div className="text-gray-600">Training Coordinator, ComCare Services</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact" className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-gray-600">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Your Name *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="John Smith" 
                    className="input input-bordered w-full"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                    data-testid="input-contact-name"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Email Address *</span>
                  </label>
                  <input 
                    type="email" 
                    placeholder="john@example.com" 
                    className="input input-bordered w-full"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                    data-testid="input-contact-email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Organisation Name</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Your Care Home or Nursery" 
                    className="input input-bordered w-full"
                    value={contactForm.organisation}
                    onChange={(e) => setContactForm({ ...contactForm, organisation: e.target.value })}
                    data-testid="input-contact-organisation"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Phone Number</span>
                  </label>
                  <input 
                    type="tel" 
                    placeholder="07123 456789" 
                    className="input input-bordered w-full"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Message *</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered h-32"
                  placeholder="Tell us about your training needs..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                  data-testid="textarea-contact-message"
                ></textarea>
              </div>

              <div className="form-control">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-lg w-full"
                  data-testid="button-contact-submit"
                >
                  <i className="fas fa-paper-plane mr-2"></i>
                  Send Message
                </button>
              </div>

              <p className="text-center text-sm text-gray-500">
                Or call us on <a href="tel:08001234567" className="text-primary font-semibold">0800 123 4567</a>
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold sm:text-4xl mb-6">
            Ready to Simplify Your Compliance Training?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join hundreds of childcare and social care providers who trust inteLMS for their training needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setShowLoginForm(true)}
              className="btn btn-primary btn-lg"
              data-testid="button-footer-cta"
            >
              <i className="fas fa-rocket mr-2"></i>
              Start Your 14-Day Free Trial
            </button>
            <a 
              href="#contact"
              className="btn btn-outline border-white text-white hover:bg-white hover:text-gray-900 btn-lg"
            >
              <i className="fas fa-comment-dots mr-2"></i>
              Schedule a Demo
            </a>
          </div>
          <p className="mt-6 text-gray-400 text-sm">
            No credit card required • Cancel anytime • Full support included
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <img 
                src={inteLMSLogo} 
                alt="inteLMS" 
                className="h-12 w-auto object-contain mb-4 filter brightness-0 invert"
              />
              <p className="text-gray-400 max-w-md mb-4">
                The leading training platform for childcare and adult social care professionals. 
                Ensuring compliance, one course at a time.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-facebook-f text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-twitter text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fab fa-linkedin-in text-xl"></i>
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Training</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#training" className="hover:text-white transition-colors">Childcare Training</a></li>
                <li><a href="#training" className="hover:text-white transition-colors">Social Care Training</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Platform Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#contact" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 inteLMS. All rights reserved. Empowering care professionals through quality training.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
