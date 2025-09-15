import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { existsSync, readdirSync } from "fs";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { MailerService } from "./services/MailerService";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Initialize the central mailer service with intelligent routing
const mailerService = new MailerService();
import { scormService } from "./services/scormService";
import { certificateService } from "./services/certificateService";
import { ScormPreviewService } from "./services/scormPreviewService";
import { insertUserSchema, insertOrganisationSchema, insertCourseSchema, insertAssignmentSchema, insertEmailTemplateSchema, insertOrgEmailTemplateSchema, insertEmailProviderConfigsSchema, emailTemplateTypeEnum } from "@shared/schema";
import { scormRoutes } from "./scorm/routes";
import { ScormApiDispatcher } from "./scorm/api-dispatch";
import { stripeWebhookService } from "./services/StripeWebhookService";
import { emailTemplateEngine } from "./services/EmailTemplateEngineService";
import { emailTemplateResolver } from "./services/EmailTemplateResolutionService";
import { EmailTemplateService } from "./services/EmailTemplateService";
import { emailTemplateSeedService } from "./seeds/emailTemplateSeedService";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { emailService } from "./services/emailService";
import { EmailOrchestrator } from "./services/EmailOrchestrator";
import { emailNotificationService } from "./services/EmailNotificationService";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { gdprConfig, isGdprEnabled, isGdprFeatureEnabled } from "./config/gdpr";

// Initialize EmailTemplateService for event notifications
const emailTemplateService = new EmailTemplateService();

// Initialize EmailOrchestrator for the new email system
const emailOrchestrator = new EmailOrchestrator();

// Feature flag for EMAIL_TEMPLATES_V2 system
const EMAIL_TEMPLATES_V2_ENABLED = process.env.EMAIL_TEMPLATES_V2 === 'true';

// Safe organization lookup wrapper - handles spelling & structure differences
async function getOrgById(storage: any, id: string) {
  // Try different method names in order
  const methods = [
    'getOrganisation',      // Current spelling
    'getOrganisationById',  // Expected spelling
    'getOrganizationById',  // American spelling
    'getOrganization'       // American spelling
  ];
  
  for (const method of methods) {
    if (typeof storage[method] === 'function') {
      try {
        return await storage[method](id);
      } catch (error) {
        console.warn(`Method ${method} failed:`, error);
        continue;
      }
    }
  }
  
  // Try nested access patterns
  if (storage.organisations?.getById) {
    return await storage.organisations.getById(id);
  }
  if (storage.organizations?.getById) {
    return await storage.organizations.getById(id);
  }
  
  throw new Error('No getOrgById implementation found in storage');
}

// RBAC Security Helper - Checks if current user can modify target user
async function canUserModifyTarget(currentUser: any, targetUser: any): Promise<{ canModify: boolean; error?: string }> {
  // Superadmin can modify anyone except other superadmins
  if (currentUser.role === 'superadmin') {
    // Superadmin cannot modify other superadmins (prevents privilege escalation)
    if (targetUser.role === 'superadmin' && targetUser.id !== currentUser.id) {
      return { canModify: false, error: 'Cannot modify other SuperAdmin accounts' };
    }
    return { canModify: true };
  }
  
  // Admin can only modify regular users in their organization
  if (currentUser.role === 'admin') {
    // Cannot modify users outside their organization
    if (targetUser.organisationId !== currentUser.organisationId) {
      return { canModify: false, error: 'Access denied - cannot modify users outside your organization' };
    }
    
    // Cannot modify admin or superadmin users (privilege escalation protection)
    if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
      return { canModify: false, error: 'Access denied - cannot modify administrator accounts' };
    }
    
    // Cannot modify themselves through regular user endpoints (use profile endpoints)
    if (targetUser.id === currentUser.id) {
      return { canModify: false, error: 'Cannot modify your own account through user management' };
    }
    
    // Can only modify regular users
    if (targetUser.role === 'user') {
      return { canModify: true };
    }
    
    return { canModify: false, error: 'Access denied - invalid target user role' };
  }
  
  // Regular users cannot modify anyone
  return { canModify: false, error: 'Access denied - insufficient privileges' };
}

// Effective email settings resolver
async function getEffectiveEmailSettings(storage: any, orgId: string | null | undefined) {
  try {
    // Handle SuperAdmin users (no organization) with system-level email settings
    if (!orgId) {
      console.log('📧 Using system-level email settings for SuperAdmin user');
      
      // First try to get database-stored system email settings
      const dbSystemSettings = await storage.getSystemEmailSettings();
      
      let systemSettings;
      
      if (dbSystemSettings) {
        console.log('📧 Found database-stored system email settings');
        
        // Use database settings and map them to the expected format
        systemSettings = {
          provider: dbSystemSettings.emailProvider,
          fromName: dbSystemSettings.fromName,
          fromEmail: dbSystemSettings.fromEmail,
          replyTo: dbSystemSettings.replyTo,
          brevo: {
            apiKey: dbSystemSettings.apiKey || ''
          },
          smtp: {
            host: dbSystemSettings.smtpHost || '',
            port: dbSystemSettings.smtpPort || 587,
            user: dbSystemSettings.smtpUsername || '',
            pass: dbSystemSettings.smtpPassword || '',
            secure: dbSystemSettings.smtpSecure !== false
          }
        };
      } else {
        console.log('📧 No database settings found, falling back to environment variables');
        
        // Fallback to environment variables if no database settings exist
        systemSettings = {
          provider: process.env.SYSTEM_EMAIL_PROVIDER || 'brevo_api',
          fromName: process.env.SYSTEM_FROM_NAME || 'inteLMS Platform',
          fromEmail: process.env.SYSTEM_FROM_EMAIL || 'noreply@intellms.app',
          brevo: {
            apiKey: process.env.BREVO_API_KEY || ''
          },
          smtp: {
            host: process.env.SYSTEM_SMTP_HOST || '',
            port: parseInt(process.env.SYSTEM_SMTP_PORT || '587'),
            user: process.env.SYSTEM_SMTP_USER || '',
            pass: process.env.SYSTEM_SMTP_PASS || '',
            secure: process.env.SYSTEM_SMTP_SECURE !== 'false'
          }
        };
      }

      // Validate system settings
      const validationErrors = [];
      
      if (!systemSettings.fromEmail) {
        validationErrors.push('System FROM email missing - configure in SuperAdmin Email Settings');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(systemSettings.fromEmail)) {
        validationErrors.push('System FROM email invalid format');
      }
      
      if (systemSettings.provider === 'brevo_api') {
        if (!systemSettings.brevo.apiKey) {
          validationErrors.push('Brevo API key missing - configure in SuperAdmin Email Settings');
        }
      } else if (systemSettings.provider === 'smtp_generic') {
        if (!systemSettings.smtp.host) validationErrors.push('SMTP host missing - configure in SuperAdmin Email Settings');
        if (!systemSettings.smtp.user) validationErrors.push('SMTP username missing - configure in SuperAdmin Email Settings');
        if (!systemSettings.smtp.pass) validationErrors.push('SMTP password missing - configure in SuperAdmin Email Settings');
      }
      
      return {
        valid: validationErrors.length === 0,
        errors: validationErrors,
        settings: systemSettings
      };
    }

    // Standard organization-based email settings
    const org = await getOrgById(storage, orgId);
    if (!org) {
      return {
        valid: false,
        errors: ['Organisation not found']
      };
    }

    const orgSettings = await storage.getOrganisationSettings(orgId);
    
    // Determine provider - prefer Brevo API if configured
    const useBrevoApi = (org.useBrevoApi || orgSettings?.useBrevoApi) && 
                       (org.brevoApiKey || orgSettings?.brevoApiKey);
    
    const provider = useBrevoApi ? 'brevo_api' : 'smtp';
    
    const settings = {
      provider,
      fromName: org.fromName || orgSettings?.fromName || '',
      fromEmail: org.fromEmail || orgSettings?.fromEmail || '',
      brevo: {
        apiKey: org.brevoApiKey || orgSettings?.brevoApiKey || ''
      },
      smtp: {
        host: org.smtpHost || orgSettings?.smtpHost || '',
        port: org.smtpPort || orgSettings?.smtpPort || 587,
        user: org.smtpUsername || orgSettings?.smtpUsername || '',
        pass: org.smtpPassword || orgSettings?.smtpPassword || '',
        secure: org.smtpSecure !== false && orgSettings?.smtpSecure !== false
      }
    };

    // Validate settings
    const validationErrors = [];
    
    if (!settings.fromEmail) {
      validationErrors.push('FROM email missing');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.fromEmail)) {
      validationErrors.push('FROM email invalid format');
    }
    
    if (provider === 'brevo_api') {
      if (!settings.brevo.apiKey) {
        validationErrors.push('Brevo API key missing');
      }
    } else if (provider === 'smtp') {
      if (!settings.smtp.host) validationErrors.push('SMTP host missing');
      if (!settings.smtp.user) validationErrors.push('SMTP username missing');
      if (!settings.smtp.pass) validationErrors.push('SMTP password missing');
    }
    
    return {
      valid: validationErrors.length === 0,
      errors: validationErrors,
      settings
    };
  } catch (error) {
    return {
      valid: false,
      errors: [(error as Error).message || 'Failed to retrieve email settings']
    };
  }
}

// Email notification helper functions
async function getOrganizationAdminEmails(orgId: string): Promise<string[]> {
  try {
    const allUsers = await storage.getUsersByOrganisation(orgId);
    const adminUsers = allUsers.filter(user => 
      user.role === 'admin' && 
      user.status === 'active' && 
      user.email
    );
    return adminUsers.map(user => user.email!).filter(Boolean);
  } catch (error) {
    console.error('Failed to get organization admin emails:', error);
    return [];
  }
}

// Format user data for email templates
function formatUserDataForEmail(user: any, organization: any) {
  return {
    name: user.name || user.email?.split('@')[0] || 'Unknown',
    email: user.email || '',
    full_name: user.fullName || user.name || user.email?.split('@')[0] || 'Unknown',
    job_title: user.jobTitle || '',
    department: user.department || ''
  };
}

// Format course data for email templates
function formatCourseDataForEmail(course: any) {
  return {
    title: course.title || 'Unknown Course',
    description: course.description || '',
    category: course.category || 'General',
    estimated_duration: course.estimatedDuration || 0
  };
}

// Format organization data for email templates
function formatOrgDataForEmail(organization: any) {
  return {
    name: organization.name || 'Unknown Organization',
    display_name: organization.displayName || organization.name || 'Unknown Organization',
    subdomain: organization.subdomain || ''
  };
}

// Helper functions for multi-recipient email notifications
async function sendMultiRecipientNotification<T>(
  operation: string,
  recipients: string[],
  notificationFn: (email: string) => Promise<T>
): Promise<void> {
  if (recipients.length === 0) {
    console.log(`📧 ${operation} - No recipients to notify`);
    return;
  }

  console.log(`📧 ${operation} - Sending to ${recipients.length} recipient(s)`);
  
  for (const email of recipients) {
    await sendEmailNotificationSafely(
      `${operation} (${email})`,
      () => notificationFn(email)
    );
  }
}

// Build complete variable data for email templates
function buildNewUserNotificationData(
  organization: any,
  currentUser: any,
  newUser: any,
  addedBy: any
) {
  return {
    org: formatOrgDataForEmail(organization),
    admin: formatUserDataForEmail(currentUser, organization),
    user: formatUserDataForEmail(newUser, organization),
    added_by: {
      name: addedBy.name || addedBy.email?.split('@')[0] || 'Unknown',
      full_name: addedBy.fullName || addedBy.name || addedBy.email?.split('@')[0] || 'Unknown'
    },
    added_at: new Date().toISOString()
  };
}

function buildNewAdminNotificationData(
  organization: any,
  currentUser: any,
  newAdmin: any,
  addedBy: any
) {
  return {
    org: formatOrgDataForEmail(organization),
    admin: formatUserDataForEmail(currentUser, organization),
    new_admin: formatUserDataForEmail(newAdmin, organization),
    added_by: {
      name: addedBy.name || addedBy.email?.split('@')[0] || 'Unknown',
      full_name: addedBy.fullName || addedBy.name || addedBy.email?.split('@')[0] || 'Unknown'
    },
    added_at: new Date().toISOString()
  };
}

function buildCourseAssignedNotificationData(
  organization: any,
  currentUser: any,
  assignedUser: any,
  course: any,
  assignedBy: any,
  dueDate?: string
) {
  return {
    org: formatOrgDataForEmail(organization),
    admin: formatUserDataForEmail(currentUser, organization),
    user: formatUserDataForEmail(assignedUser, organization),
    course: formatCourseDataForEmail(course),
    assigned_by: {
      name: assignedBy.name || assignedBy.email?.split('@')[0] || 'Unknown',
      full_name: assignedBy.fullName || assignedBy.name || assignedBy.email?.split('@')[0] || 'Unknown'
    },
    assigned_at: new Date().toISOString(),
    due_date: dueDate
  };
}

function buildPlanUpdatedNotificationData(
  organization: any,
  currentUser: any,
  planData: any,
  changedBy: any
) {
  return {
    org: formatOrgDataForEmail(organization),
    admin: formatUserDataForEmail(currentUser, organization),
    plan: {
      name: planData.name || 'Unknown Plan',
      old_price: planData.oldPrice || 0,
      new_price: planData.newPrice || 0,
      billing_cadence: planData.billingCadence || 'monthly'
    },
    changed_by: {
      name: changedBy.name || changedBy.email?.split('@')[0] || 'Unknown',
      full_name: changedBy.fullName || changedBy.name || changedBy.email?.split('@')[0] || 'Unknown'
    },
    changed_at: new Date().toISOString(),
    effective_date: planData.effectiveDate
  };
}

function buildLearnerCompletedNotificationData(
  organization: any,
  currentUser: any,
  learner: any,
  course: any,
  attempt: any
) {
  return {
    org: formatOrgDataForEmail(organization),
    admin: formatUserDataForEmail(currentUser, organization),
    user: formatUserDataForEmail(learner, organization),
    course: formatCourseDataForEmail(course),
    attempt: {
      score: attempt.score || 0,
      status: attempt.status || 'completed',
      time_spent: attempt.timeSpent || 0
    },
    completed_at: new Date().toISOString()
  };
}

function buildLearnerFailedNotificationData(
  organization: any,
  currentUser: any,
  learner: any,
  course: any,
  attempt: any
) {
  return {
    org: formatOrgDataForEmail(organization),
    admin: formatUserDataForEmail(currentUser, organization),
    user: formatUserDataForEmail(learner, organization),
    course: formatCourseDataForEmail(course),
    attempt: {
      score: attempt.score || 0,
      status: attempt.status || 'failed',
      time_spent: attempt.timeSpent || 0
    },
    failed_at: new Date().toISOString()
  };
}

// Safely send email notifications without breaking core functionality
async function sendEmailNotificationSafely(
  operation: string,
  emailFunction: () => Promise<any>
): Promise<void> {
  try {
    const result = await emailFunction();
    if (result.success) {
      console.log(`✅ ${operation} email notification sent successfully`);
    } else {
      console.warn(`⚠️ ${operation} email notification failed:`, result.errors);
    }
  } catch (error) {
    console.error(`❌ ${operation} email notification error:`, error);
    // Don't throw - email failures shouldn't break core functionality
  }
}

// Extend Express session to include user property
declare module 'express-session' {
  interface SessionData {
    user?: any;
  }
}

// Configure multer for file uploads
const fileStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadDir = path.join(process.cwd(), 'uploads', 'images', String(year), month);
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, JPEG, WebP, and HEIC files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware for simple authentication
  const MemStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'demo-secret-key',
    store: new MemStore({ checkPeriod: 86400000 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Simple auth middleware with improved debugging
  function requireAuth(req: any, res: any, next: any) {
    if (!req.session?.user) {
      console.log(`🔒 Auth failed for ${req.method} ${req.path} - No session user found`);
      return res.status(401).json({ 
        message: "Unauthorized",
        error: "Authentication required. Please log in to continue.",
        redirectTo: "/api/login"
      });
    }
    
    // Log successful auth for debugging
    console.log(`✅ Auth success for ${req.method} ${req.path} - User: ${req.session.user.id || req.session.user.claims?.sub}`);
    next();
  }

  // Helper function to check license availability
  async function checkLicenseCapacity(userId: string, additionalActiveUsers: number = 1): Promise<{ canProceed: boolean; error?: string }> {
    try {
      const user = await storage.getUser(userId);
      
      // SuperAdmins can create users without organization restriction
      if (user?.role === 'superadmin') {
        return { canProceed: true };
      }
      
      if (!user?.organisationId) {
        return { canProceed: false, error: 'User not associated with an organization' };
      }

      // Get organization and subscription info
      const organisation = await storage.getOrganisation(user.organisationId);
      if (!organisation) {
        return { canProceed: false, error: 'Organization not found' };
      }

      // Count active users in the organization, EXCLUDING admin users from license count
      const allUsers = await storage.getUsersByOrganisation(user.organisationId);
      const activeNonAdminUsers = allUsers.filter(u => u.status === 'active' && u.role !== 'admin' && u.role !== 'superadmin');
      const currentActiveCount = activeNonAdminUsers.length;

      // Default limits (for organizations without subscription)
      let maxActiveUsers = organisation.activeUserCount || 0; // Use purchased licenses from database

      // If organization has a Stripe subscription, check the limits
      if (organisation.stripeSubscriptionId) {
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2025-08-27.basil',
          });

          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(organisation.stripeSubscriptionId, {
            expand: ['items.data.price.product']
          });

          if (subscription.status === 'active' || subscription.status === 'trialing') {
            // Check if it's a per-seat subscription
            const subscriptionItem = subscription.items.data[0];
            if (subscriptionItem?.price?.product && typeof subscriptionItem.price.product === 'object' && !subscriptionItem.price.product.deleted) {
              const productMetadata = subscriptionItem.price.product.metadata;
              
              // Look for seat limits in product metadata or subscription quantity
              if (productMetadata?.seat_limit) {
                maxActiveUsers = parseInt(productMetadata.seat_limit, 10);
              } else if (subscriptionItem.quantity) {
                maxActiveUsers = subscriptionItem.quantity;
              } else {
                // For unlimited plans or flat subscriptions
                maxActiveUsers = 1000; // High limit for unlimited plans
              }
            }
          }
        } catch (stripeError) {
          console.error('Error fetching Stripe subscription in license check:', stripeError);
          // Continue with default limits if Stripe fails
        }
      }

      const availableLicenses = maxActiveUsers - currentActiveCount;
      const canProceed = availableLicenses >= additionalActiveUsers;

      if (!canProceed) {
        return { 
          canProceed: false, 
          error: `License limit exceeded. You have ${currentActiveCount} active non-admin users out of ${maxActiveUsers} licenses. Need ${additionalActiveUsers} more licenses. (Admin users don't count toward license limits)` 
        };
      }

      return { canProceed: true };
    } catch (error) {
      console.error('Error checking license capacity:', error);
      return { canProceed: false, error: 'Failed to check license capacity' };
    }
  }

  // Helper function to get user ID from session claims
  function getUserIdFromSession(req: any): string | null {
    // For Replit Auth (production)
    if (req.session?.user?.claims?.sub) {
      return req.session.user.claims.sub;
    }
    // For demo login (development)
    if (req.session?.user?.id) {
      return req.session.user.id;
    }
    return null;
  }

  // Helper function to get current user
  async function getCurrentUser(req: any) {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      return null;
    }
    
    // Fetch the actual user data from the database
    try {
      const dbUser = await storage.getUser(userId);
      return dbUser;
    } catch (error) {
      console.error('Error fetching user from database:', error);
      return null;
    }
  }

  // Helper function to check if an organisation has a specific feature enabled
  async function hasFeatureAccess(organisationId: string, featureKey: string): Promise<boolean> {
    try {
      const organisation = await storage.getOrganisation(organisationId);
      if (!organisation?.planId) {
        return false;
      }

      const planFeatures = await storage.getPlanFeatureMappings(organisation.planId);
      
      // Get all features to map IDs to keys
      const allFeatures = await storage.getAllPlanFeatures();
      const featureMap = new Map(allFeatures.map(f => [f.id, f.key]));
      
      // Check if the feature is enabled
      const mapping = planFeatures.find(mapping => 
        featureMap.get(mapping.featureId) === featureKey && mapping.enabled
      );
      
      return !!mapping;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  // Initialize SCORM preview service
  const scormPreviewService = new ScormPreviewService();

  // Stripe Webhook Handler (for processing successful payments)
  // Verify Stripe payment/subscription status
  app.get('/api/subscriptions/verify/:sessionId', async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const { sessionId } = req.params;
      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();
      
      // Retrieve the checkout session from Stripe
      const session = await stripeService.getCheckoutSession(sessionId, {
        expand: ['subscription', 'customer']
      });
      
      if (session.payment_status === 'paid' && session.subscription) {
        // Payment successful - update our database
        const metadata = session.metadata;
        if (metadata?.org_id) {
          // Extract IDs from Stripe objects (they may be expanded objects or just strings)
          const subscriptionId = typeof session.subscription === 'string' 
            ? session.subscription 
            : session.subscription?.id;
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer?.id;
            
          // Get current organization data to capture previous plan
          const orgBeforeUpdate = await storage.getOrganisation(metadata.org_id);
          const previousPlanId = orgBeforeUpdate?.planId;
          
          await storage.updateOrganisationBilling(metadata.org_id, {
            planId: metadata.plan_id, // Fix: Include plan ID update
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            billingStatus: 'active',
            activeUserCount: parseInt(metadata.userCount || '1'),
            lastBillingSync: new Date(),
          });
          
          // Send plan updated notification to organization admins (checkout success)
          if (metadata.plan_id && metadata.plan_id !== previousPlanId) {
            try {
              const userId = req.session?.user?.id; // May be null if user logged out
              await emailNotificationService.notifyPlanUpdated(
                metadata.org_id,
                previousPlanId ?? undefined,
                metadata.plan_id,
                userId ?? undefined // Pass undefined if no session user (system update)
              );
            } catch (error) {
              console.error('[Checkout Success] Failed to send plan update notification:', error);
              // Don't break the checkout flow for notification failures
            }
          }
          
          // Get updated organisation data
          const updatedOrg = await storage.getOrganisation(metadata.org_id);
          
          res.json({
            success: true,
            message: 'Subscription updated successfully',
            organisation: updatedOrg,
            session: {
              id: session.id,
              payment_status: session.payment_status,
              subscription_id: session.subscription
            }
          });
        } else {
          res.status(400).json({ success: false, message: 'Missing organization metadata' });
        }
      } else {
        res.json({
          success: false,
          message: 'Payment not completed or subscription not created',
          session: {
            id: session.id,
            payment_status: session.payment_status,
            subscription_id: session.subscription
          }
        });
      }
    } catch (error: any) {
      console.error('Error verifying Stripe session:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to verify payment status',
        error: error.message 
      });
    }
  });


  // Auth routes
  app.post('/api/login', async (req: any, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if it's a demo user
      const demoUsers = {
        'superadmin@demo.app': { 
          password: 'superadmin123',
          user: await storage.getUser('demo-superadmin')
        },
        'admin.acme@demo.app': { 
          password: 'admin123',
          user: await storage.getUser('demo-admin-acme')
        },
        'admin.ocean@demo.app': { 
          password: 'admin123', 
          user: await storage.getUser('demo-admin-ocean')
        },
        'alice@acme.demo': { 
          password: 'user123',
          user: await storage.getUser('demo-user-alice')
        },
        'dan@ocean.demo': { 
          password: 'user123',
          user: await storage.getUser('demo-user-dan')
        }
      };

      const demoAccount = demoUsers[email as keyof typeof demoUsers];
      
      if (demoAccount && password === demoAccount.password && demoAccount.user) {
        req.session.user = demoAccount.user;
        return res.json({ 
          message: "Login successful",
          user: demoAccount.user,
          requiresPasswordChange: demoAccount.user.requiresPasswordChange || false,
          redirectUrl: demoAccount.user.role === 'superadmin' ? '/superadmin' 
            : demoAccount.user.role === 'admin' ? '/admin'
            : '/user'
        });
      }

      // Check for regular users in the database
      console.log(`🔐 Attempting to authenticate regular user: ${email}`);
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log(`❌ User not found: ${email}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      if (!user.passwordHash) {
        console.log(`❌ User ${email} has no password set`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Compare the provided password with the stored hash
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      
      if (!passwordMatch) {
        console.log(`❌ Password mismatch for user: ${email}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check if user account is active
      if (user.status !== 'active') {
        console.log(`❌ User account not active: ${email} (status: ${user.status})`);
        return res.status(401).json({ message: "Account is not active" });
      }
      
      // Authentication successful - create session
      console.log(`✅ Authentication successful for user: ${email} (role: ${user.role})`);
      req.session.user = user;
      
      return res.json({ 
        message: "Login successful",
        user: user,
        requiresPasswordChange: user.requiresPasswordChange || false,
        redirectUrl: user.role === 'superadmin' ? '/superadmin' 
          : user.role === 'admin' ? '/admin'
          : '/user'
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Change password endpoint for users with temporary passwords
  app.post('/api/auth/change-password', async (req: any, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      
      // Check if user is logged in
      if (!req.session?.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      // Validate inputs
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New passwords do not match' });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }
      
      // Get current user from database
      const user = await storage.getUser(req.session.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify current password
      if (!user.passwordHash) {
        return res.status(400).json({ message: 'User has no password set' });
      }
      
      const currentPasswordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentPasswordMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Don't allow setting the same password
      const samePassword = await bcrypt.compare(newPassword, user.passwordHash);
      if (samePassword) {
        return res.status(400).json({ message: 'New password must be different from current password' });
      }
      
      // Hash the new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Update user password and clear requiresPasswordChange flag directly in database
      await db.update(users)
        .set({ 
          passwordHash: newPasswordHash,
          requiresPasswordChange: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
      
      // Update session with new user data
      const updatedUser = await storage.getUser(user.id);
      req.session.user = updatedUser;
      
      console.log(`✅ Password changed successfully for user: ${user.email}`);
      
      return res.json({ 
        message: 'Password changed successfully',
        user: updatedUser
      });
      
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  // Handle logout as both GET and POST
  const handleLogout = (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: "Logout failed" });
      }
      
      // For GET requests (direct navigation), redirect to home
      if (req.method === 'GET') {
        res.redirect('/');
      } else {
        // For POST requests (API calls), return JSON
        res.json({ message: "Logged out successfully" });
      }
    });
  };

  app.get('/api/logout', handleLogout);
  app.post('/api/logout', handleLogout);

  // Registration endpoints
  app.post('/api/register/individual', async (req: any, res) => {
    try {
      const { firstName, lastName, email, password, confirmPassword } = req.body;
      
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }

      // Create individual user account (not tied to organisation)
      const userData = {
        email,
        firstName,
        lastName,
        role: 'user' as const,
        status: 'active' as const,
        organisationId: null, // Individual user - not tied to organisation
        allowCertificateDownload: true, // Default access to certificates
      };

      const newUser = await storage.createUser(userData);
      
      // Send welcome email using EmailOrchestrator if EMAIL_TEMPLATES_V2 is enabled
      if (EMAIL_TEMPLATES_V2_ENABLED) {
        try {
          const context = {
            user: {
              name: `${newUser.firstName} ${newUser.lastName}`,
              email: newUser.email || undefined,
              firstName: newUser.firstName || undefined,
              lastName: newUser.lastName || undefined,
              fullName: `${newUser.firstName} ${newUser.lastName}`
            },
            addedBy: {
              name: 'Self Registration'
            },
            addedAt: new Date().toISOString(),
            loginUrl: `${process.env.REPLIT_URL || 'http://localhost:5000'}/api/login`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@intellms.app'
          };

          await emailOrchestrator.queue({
            triggerEvent: 'USER_FAST_ADD',
            templateKey: 'new_user_welcome',
            toEmail: newUser.email!,
            context,
            organisationId: undefined, // Individual users don't have an org
            resourceId: newUser.id,
            priority: 1
          });
          
          console.log(`✅ USER_FAST_ADD email queued for ${newUser.email} (Individual registration)`);
        } catch (emailError) {
          console.warn('⚠️ Failed to queue USER_FAST_ADD email:', emailError);
          // Don't fail registration if email fails
        }
      }
      
      // Log the user in automatically
      req.session.user = newUser;

      return res.status(201).json({ 
        message: "Individual account created successfully",
        user: newUser,
        redirectUrl: '/user'
      });
    } catch (error) {
      console.error("Individual registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post('/api/register/organisation', async (req: any, res) => {
    try {
      const { 
        organisationName, 
        organisationDisplayName,
        organisationSubdomain,
        contactEmail,
        contactPhone,
        address,
        adminFirstName,
        adminLastName,
        adminEmail,
        adminPassword,
        confirmPassword
      } = req.body;
      
      if (!organisationName || !organisationDisplayName || !organisationSubdomain || 
          !adminFirstName || !adminLastName || !adminEmail || !adminPassword || !confirmPassword) {
        return res.status(400).json({ message: "All required fields must be filled" });
      }

      if (adminPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      if (adminPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Validate subdomain format (alphanumeric, hyphens, lowercase)
      const subdomainRegex = /^[a-z0-9-]+$/;
      if (!subdomainRegex.test(organisationSubdomain)) {
        return res.status(400).json({ message: "Subdomain can only contain lowercase letters, numbers, and hyphens" });
      }

      // Check if admin email already exists
      const existingUser = await storage.getUserByEmail(adminEmail);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }

      // Check if organisation subdomain already exists
      try {
        const existingOrg = await storage.getOrganisationBySubdomain(organisationSubdomain);
        if (existingOrg) {
          return res.status(409).json({ message: "Subdomain is already taken" });
        }
      } catch (error) {
        // Organisation doesn't exist, which is what we want
      }

      // Create organisation first
      const organisationData = {
        name: organisationName,
        displayName: organisationDisplayName,
        subdomain: organisationSubdomain,
        contactEmail,
        contactPhone,
        address,
        status: 'active' as const,
      };

      const newOrganisation = await storage.createOrganisation(organisationData);
      
      // Create admin user for the organisation
      const adminUserData = {
        email: adminEmail,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'admin' as const,
        status: 'active' as const,
        organisationId: newOrganisation.id,
        allowCertificateDownload: true,
      };

      const newAdmin = await storage.createUser(adminUserData);
      
      // Send welcome email using EmailOrchestrator if EMAIL_TEMPLATES_V2 is enabled
      if (EMAIL_TEMPLATES_V2_ENABLED) {
        try {
          const context = {
            user: {
              name: `${newAdmin.firstName} ${newAdmin.lastName}`,
              email: newAdmin.email || undefined,
              firstName: newAdmin.firstName || undefined,
              lastName: newAdmin.lastName || undefined,
              fullName: `${newAdmin.firstName} ${newAdmin.lastName}`
            },
            org: {
              name: newOrganisation.name,
              displayName: newOrganisation.displayName || newOrganisation.name
            },
            addedBy: {
              name: 'System Registration'
            },
            addedAt: new Date().toISOString(),
            loginUrl: `${process.env.REPLIT_URL || 'http://localhost:5000'}/api/login`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@intellms.app'
          };

          await emailOrchestrator.queue({
            triggerEvent: 'ORG_FAST_ADD',
            templateKey: 'new_org_welcome',
            toEmail: newAdmin.email!,
            context,
            organisationId: newOrganisation.id,
            resourceId: newOrganisation.id,
            priority: 1
          });
          
          console.log(`✅ ORG_FAST_ADD email queued for ${newAdmin.email}`);
        } catch (emailError) {
          console.warn('⚠️ Failed to queue ORG_FAST_ADD email:', emailError);
          // Don't fail registration if email fails
        }
      }
      
      // Log the admin in automatically
      req.session.user = newAdmin;

      return res.status(201).json({ 
        message: "Organisation and admin account created successfully",
        user: newAdmin,
        organisation: newOrganisation,
        redirectUrl: '/admin'
      });
    } catch (error) {
      console.error("Organisation registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // GDPR Configuration Endpoint (feature flag protected)
  app.get('/api/config/gdpr', requireAuth, async (req: any, res) => {
    // Route guard: if GDPR is disabled, return 404 to hide the endpoint completely
    if (!isGdprEnabled()) {
      return res.status(404).json({ message: "Endpoint not found" });
    }
    
    try {
      // Return the GDPR configuration for frontend use
      res.json({
        enabled: gdprConfig.enabled,
        environment: gdprConfig.environment,
        features: gdprConfig.features,
        settings: gdprConfig.settings,
      });
    } catch (error) {
      console.error("Error fetching GDPR config:", error);
      res.status(500).json({ message: "Failed to fetch GDPR configuration" });
    }
  });

  // Update user profile
  app.put('/api/auth/profile', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      const userId = currentUser.id;
      const { firstName, lastName, email, jobTitle, department, phone, bio, profileImageUrl } = req.body;

      console.log('Profile update request body:', req.body);
      console.log('Extracted fields:', {
        firstName,
        lastName,
        email,
        jobTitle,
        department,
        phone,
        bio,
        profileImageUrl
      });

      // Prepare update data, filtering out undefined/null values
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
      if (department !== undefined) updateData.department = department;
      if (phone !== undefined) updateData.phone = phone;
      if (bio !== undefined) updateData.bio = bio;
      
      // Handle profile image URL with ACL policy
      if (profileImageUrl !== undefined) {
        if (profileImageUrl) {
          const { ObjectStorageService } = await import('./objectStorage');
          const objectStorageService = new ObjectStorageService();
          try {
            updateData.profileImageUrl = await objectStorageService.trySetObjectEntityAclPolicy(
              profileImageUrl,
              {
                owner: userId,
                visibility: "public", // Profile images should be publicly accessible
              }
            );
          } catch (error) {
            console.error('Error setting profile image ACL policy:', error);
            // Fallback to just normalizing the path
            updateData.profileImageUrl = objectStorageService.normalizeObjectEntityPath(profileImageUrl);
          }
        } else {
          updateData.profileImageUrl = profileImageUrl;
        }
      }

      console.log('Update data:', updateData);

      // Update user profile using storage interface
      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      console.error("Error details:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // User statistics endpoint
  app.get('/api/user/stats', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role === 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const assignments = await storage.getAssignmentsByUser(user.id);
      const completedCourses = assignments.filter(c => c.status === 'completed');
      const completedCount = completedCourses.length;
      
      // Get completions for completed assignments to calculate average score
      const completions = await storage.getCompletionsByUser(user.id);
      const scoresWithValues = completions.filter(c => c.score !== null && c.score !== undefined);
      const averageScore = scoresWithValues.length > 0 
        ? Math.round(scoresWithValues.reduce((sum, c) => sum + (Number(c.score) || 0), 0) / scoresWithValues.length)
        : 0;

      res.json({
        completedCourses: completedCount,
        averageScore: averageScore
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ message: 'Failed to fetch user statistics' });
    }
  });

  // User analytics endpoint - completion trends over time
  app.get('/api/user/analytics/completions', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role === 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get user's completions over the last 12 months
      const completions = await storage.getCompletionsByUser(user.id);
      
      // Group completions by month
      const monthlyData: Record<string, { monthName: string; successful: number; failed: number; total: number }> = {};
      const currentDate = new Date();
      
      // Initialize last 12 months with zero values
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        monthlyData[monthKey] = {
          monthName,
          successful: 0,
          failed: 0,
          total: 0
        };
      }
      
      // Populate with actual completion data
      completions.forEach(completion => {
        if (completion.completedAt) {
          const completionDate = new Date(completion.completedAt);
          const monthKey = `${completionDate.getFullYear()}-${String(completionDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].total++;
            if (completion.status === 'pass') {
              monthlyData[monthKey].successful++;
            } else {
              monthlyData[monthKey].failed++;
            }
          }
        }
      });

      const analyticsData = Object.values(monthlyData);
      res.json(analyticsData);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({ message: 'Failed to fetch user analytics' });
    }
  });

  // User progress overview endpoint
  app.get('/api/user/progress', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role === 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const assignments = await storage.getAssignmentsByUser(user.id);
      const completions = await storage.getCompletionsByUser(user.id);
      
      // Calculate various progress metrics
      const totalAssigned = assignments.length;
      const completed = assignments.filter(a => a.status === 'completed').length;
      const inProgress = assignments.filter(a => a.status === 'in_progress').length;
      const notStarted = assignments.filter(a => a.status === 'not_started').length;
      
      // Calculate average scores and pass rate
      const passedCompletions = completions.filter(c => c.status === 'pass');
      const failedCompletions = completions.filter(c => c.status === 'fail');
      const passRate = completions.length > 0 ? Math.round((passedCompletions.length / completions.length) * 100) : 0;
      
      // Get scores for chart data
      const scoresWithValues = completions.filter(c => c.score !== null && c.score !== undefined);
      const averageScore = scoresWithValues.length > 0 
        ? Math.round(scoresWithValues.reduce((sum, c) => sum + (Number(c.score) || 0), 0) / scoresWithValues.length)
        : 0;

      res.json({
        totalAssigned,
        completed,
        inProgress,
        notStarted,
        passRate,
        averageScore,
        totalCompletions: completions.length,
        passedCompletions: passedCompletions.length,
        failedCompletions: failedCompletions.length
      });
    } catch (error) {
      console.error('Error fetching user progress:', error);
      res.status(500).json({ message: 'Failed to fetch user progress' });
    }
  });

  // Check license availability for user activation/creation
  app.get('/api/admin/license-check', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get organization and subscription info
      if (!user.organisationId) {
        return res.status(400).json({ message: 'User not associated with an organization' });
      }

      const organisation = await storage.getOrganisation(user.organisationId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      // Count active users in the organization, EXCLUDING admin users from license count
      const allUsers = await storage.getUsersByOrganisation(user.organisationId);
      const activeUsers = allUsers.filter(u => u.status === 'active');
      const nonAdminUsers = allUsers.filter(u => u.role !== 'admin' && u.role !== 'superadmin');
      const activeNonAdminUsers = activeUsers.filter(u => u.role !== 'admin' && u.role !== 'superadmin');
      const currentActiveCount = activeNonAdminUsers.length;

      // Default limits (for organizations without subscription)
      let maxActiveUsers = organisation.activeUserCount || 0; // Use purchased licenses from database
      let hasActiveSubscription = false;

      // If organization has a Stripe subscription, check the limits
      if (organisation.stripeSubscriptionId) {
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2025-08-27.basil',
          });

          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(organisation.stripeSubscriptionId, {
            expand: ['items.data.price.product']
          });

          if (subscription.status === 'active' || subscription.status === 'trialing') {
            hasActiveSubscription = true;
            
            // Check if it's a per-seat subscription
            const subscriptionItem = subscription.items.data[0];
            if (subscriptionItem?.price?.product && typeof subscriptionItem.price.product === 'object' && !subscriptionItem.price.product.deleted) {
              const productMetadata = subscriptionItem.price.product.metadata;
              
              // Look for seat limits in product metadata or subscription quantity
              if (productMetadata?.seat_limit) {
                maxActiveUsers = parseInt(productMetadata.seat_limit, 10);
              } else if (subscriptionItem.quantity) {
                maxActiveUsers = subscriptionItem.quantity;
              } else {
                // For unlimited plans or flat subscriptions
                maxActiveUsers = 1000; // High limit for unlimited plans
              }
            }
          }
        } catch (stripeError) {
          console.error('Error fetching Stripe subscription:', stripeError);
          // Continue with default limits if Stripe fails
        }
      }

      const availableLicenses = maxActiveUsers - currentActiveCount;
      const isAtLimit = availableLicenses <= 0;

      res.json({
        currentActiveUsers: currentActiveCount, // Non-admin users only
        maxActiveUsers, // Purchased licenses
        availableLicenses: Math.max(0, availableLicenses),
        isAtLimit,
        hasActiveSubscription,
        organisationName: organisation.displayName || organisation.name,
        // Additional info for clarity
        totalActiveUsers: activeUsers.length,
        totalNonAdminUsers: nonAdminUsers.length, // Total non-admin users (active and inactive)
        adminUsers: activeUsers.filter(u => u.role === 'admin' || u.role === 'superadmin').length
      });
    } catch (error) {
      console.error('Error checking license availability:', error);
      res.status(500).json({ message: 'Failed to check license availability' });
    }
  });

  // User certificates endpoint
  app.get('/api/user/certificates', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role === 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const certificates = await storage.getCertificatesByUser(user.id);
      res.json(certificates);
    } catch (error) {
      console.error('Error fetching user certificates:', error);
      res.status(500).json({ message: 'Failed to fetch certificates' });
    }
  });

  // Certificate download endpoint
  app.get('/api/certificates/:certificateId/download', requireAuth, async (req: any, res) => {
    try {
      const { certificateId } = req.params;
      const userId = req.session.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get certificate and verify access permissions
      const certificate = await storage.getCertificate(certificateId);
      if (!certificate) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      // Get current user to check permissions
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Allow access if:
      // 1. User is superadmin
      // 2. User is admin and certificate is from their organization  
      // 3. User owns the certificate AND has certificate download permission enabled
      const hasAccess = (user.role === 'superadmin') ||
                       (user.role === 'admin' && user.organisationId === certificate.organisationId) ||
                       (certificate.userId === userId && user.allowCertificateDownload === true);
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get certificate URL and redirect to object storage
      if (certificate.certificateUrl) {
        // If it's already a full URL, redirect directly
        if (certificate.certificateUrl.startsWith('http')) {
          return res.redirect(certificate.certificateUrl);
        }
        
        // If it's a relative path, serve through object storage
        if (certificate.certificateUrl.startsWith('/objects/')) {
          return res.redirect(certificate.certificateUrl);
        }
        
        // If it's our demo certificate, serve the HTML directly
        if (certificate.certificateUrl === '/api/demo/certificate-html') {
          const certificateHTML = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Certificate of Completion</title>
              <style>
                body { 
                  font-family: Georgia, serif; 
                  text-align: center; 
                  padding: 50px; 
                  background: #f8f9fa; 
                  margin: 0;
                }
                .certificate { 
                  background: white; 
                  border: 5px solid #007bff; 
                  padding: 40px; 
                  margin: 20px auto; 
                  max-width: 600px; 
                  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                  border-radius: 10px;
                }
                h1 { color: #007bff; font-size: 2.5em; margin-bottom: 10px; }
                h2 { color: #333; margin-bottom: 30px; }
                .recipient { font-size: 1.8em; color: #007bff; text-decoration: underline; margin: 20px 0; }
                .course { font-size: 1.4em; font-weight: bold; margin: 20px 0; }
                .details { margin-top: 30px; font-size: 0.9em; color: #666; }
                .seal { 
                  width: 80px; 
                  height: 80px; 
                  border: 3px solid #007bff; 
                  border-radius: 50%; 
                  display: inline-flex; 
                  align-items: center; 
                  justify-content: center; 
                  font-weight: bold; 
                  color: #007bff; 
                  margin: 20px 0; 
                }
              </style>
            </head>
            <body>
              <div class="certificate">
                <h1>CERTIFICATE</h1>
                <h2>OF COMPLETION</h2>
                <p>This is to certify that</p>
                <div class="recipient">Alice Williams</div>
                <p>has successfully completed</p>
                <div class="course">Safeguarding Children (SCORM)</div>
                <p>with a score of <strong>100%</strong> (PASSED)</p>
                <div class="seal">CERTIFIED</div>
                <div class="details">
                  <p><strong>Date Completed:</strong> September 8, 2025</p>
                  <p><strong>Organisation:</strong> Acme Care Services</p>
                  <p><strong>Certificate ID:</strong> CERT-ALICE-2025-001</p>
                </div>
              </div>
            </body>
            </html>
          `;
          
          res.setHeader('Content-Type', 'text/html');
          return res.send(certificateHTML);
        }
      }
      
      return res.status(404).json({ message: 'Certificate file not found' });
      
    } catch (error) {
      console.error('Error downloading certificate:', error);
      res.status(500).json({ message: 'Failed to download certificate' });
    }
  });

  // Object storage routes
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    const userId = getUserIdFromSession(req);
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId || undefined,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // New file upload endpoint with multipart/form-data
  app.post("/api/images/upload", requireAuth, upload.single('image'), async (req, res) => {
    try {
      console.log('Upload attempt:', req.file ? 'File received' : 'No file');
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Basic permission check - only authenticated users can upload
      const userId = getUserIdFromSession(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Basic image info without dimensions for now
      let width = 0;
      let height = 0;

      // Generate the public URL path
      const relativePath = path.relative(path.join(process.cwd(), 'uploads'), req.file.path);
      const imageUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
      
      console.log('Saved image:', req.file.path, '-> URL:', imageUrl);

      res.json({
        imageUrl,
        width,
        height,
        contentType: req.file.mimetype
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // Demo data seeding route
  app.post('/api/seed-demo-data', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only SuperAdmin can seed demo data' });
      }

      await seedDemoData();
      res.json({ message: 'Demo data seeded successfully' });
    } catch (error) {
      console.error('Error seeding demo data:', error);
      res.status(500).json({ message: 'Failed to seed demo data' });
    }
  });

  // Public endpoint for initial demo setup (can be removed after setup)
  app.post('/api/force-seed-demo', async (req: any, res) => {
    try {
      await seedDemoData();
      res.json({ message: 'Demo data force-seeded successfully' });
    } catch (error) {
      console.error('Error force-seeding demo data:', error);
      res.status(500).json({ message: 'Failed to force-seed demo data' });
    }
  });


  // SuperAdmin routes
  app.get('/api/superadmin/stats', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Course completion analytics
  app.get('/api/superadmin/analytics/completions', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const completionAnalytics = await storage.getCompletionAnalytics();
      res.json(completionAnalytics);
    } catch (error) {
      console.error('Error fetching completion analytics:', error);
      res.status(500).json({ message: 'Failed to fetch completion analytics' });
    }
  });

  // Popular courses analytics for current month
  app.get('/api/superadmin/analytics/popular-courses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const popularCourses = await storage.getPopularCoursesThisMonth();
      res.json(popularCourses);
    } catch (error) {
      console.error('Error fetching popular courses:', error);
      res.status(500).json({ message: 'Failed to fetch popular courses' });
    }
  });

  // SuperAdmin Email Logs API Endpoints - UNIFIED VIEW OF ALL PLATFORM EMAILS
  // Get email logs with filtering (shows ALL emails: EmailOrchestrator + MailerService)
  app.get('/api/superadmin/email-logs', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      // Extract query parameters
      const {
        fromDate: startDate,
        endDate,
        status,
        templateKey,
        recipient,
        triggerEvent,
        page = '1',
        limit = '50'
      } = req.query;

      // Parse pagination parameters
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 200); // Cap at 200
      const offset = (pageNum - 1) * limitNum;

      // Get BOTH EmailOrchestrator sends AND MailerService logs for comprehensive view
      const allEmails: any[] = [];
      
      // 1. Get emails from EmailOrchestrator (emailSends table) - NEW SYSTEM
      try {
        const orchestratorFilters: any = { limit: 1000 }; // Get many for unified sorting
        if (startDate) orchestratorFilters.fromDate = new Date(startDate as string);
        if (endDate) orchestratorFilters.toDate = new Date(endDate as string);
        if (status) orchestratorFilters.status = status;
        if (templateKey) orchestratorFilters.templateKey = templateKey;
        if (recipient) orchestratorFilters.toEmail = recipient;
        if (triggerEvent) orchestratorFilters.triggerEvent = triggerEvent;
        
        const emailSends = await storage.getEmailSends(orchestratorFilters);
        
        // Transform EmailOrchestrator format to unified format
        emailSends.forEach((send: any) => {
          allEmails.push({
            id: send.id,
            timestamp: send.createdAt || send.sentAt,
            toEmail: send.toEmail,
            fromEmail: send.fromEmail || 'system',
            subject: send.subject,
            status: send.status,
            templateKey: send.templateKey,
            triggerEvent: send.triggerEvent,
            provider: send.provider,
            messageId: send.providerMessageId,
            errorMessage: send.errorMessage,
            source: 'EmailOrchestrator (V2)',
            retryCount: send.retryCount || 0,
            organisationId: send.organisationId,
            htmlContent: send.htmlContent,
            textContent: send.textContent
          });
        });
      } catch (error: any) {
        console.log('EmailOrchestrator emails not available:', error.message);
      }
      
      // 2. Get emails from MailerService (emailLogs table) - LEGACY SYSTEM
      try {
        const mailerEmails = await storage.getEmailLogs({
          limit: 1000,
          fromDate: startDate ? new Date(startDate as string) : undefined,
          toDate: endDate ? new Date(endDate as string) : undefined,
          status: status as 'sent' | 'failed'
        });
        
        // Filter by recipient if specified (client-side filtering since interface doesn't support toEmail)
        const filteredMailerEmails = recipient 
          ? mailerEmails.filter((email: any) => email.toEmail === recipient)
          : mailerEmails;
        
        // Transform MailerService format to unified format
        filteredMailerEmails.forEach((log: any) => {
          allEmails.push({
            id: log.id,
            timestamp: log.timestamp,
            toEmail: log.toEmail,
            fromEmail: log.fromEmail,
            subject: log.subject,
            status: log.status,
            templateKey: log.templateType || 'legacy',
            triggerEvent: 'LEGACY_MAILER',
            provider: log.provider,
            messageId: log.messageId,
            errorMessage: log.errorShort || log.errorRaw,
            source: 'MailerService (Legacy)',
            retryCount: 0,
            organisationId: log.organisationId,
            htmlContent: null,
            textContent: null
          });
        });
      } catch (error: any) {
        console.log('MailerService emails not available:', error.message);
      }
      
      // 3. Sort all emails by timestamp (newest first)
      allEmails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // 4. Apply pagination to combined results
      const total = allEmails.length;
      const paginatedEmails = allEmails.slice(offset, offset + limitNum);
      const totalPages = Math.ceil(total / limitNum);

      res.json({
        ok: true,
        data: paginatedEmails,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages
        }
      });

    } catch (error) {
      console.error('Error fetching unified email logs:', error);
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to fetch email logs' 
      });
    }
  });

  // Get specific email log details
  app.get('/api/superadmin/email-logs/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      const { id } = req.params;

      // Get email send record
      const emailSend = await storage.getEmailSend(id);
      
      if (!emailSend) {
        return res.status(404).json({ 
          ok: false, 
          error: 'Email log record not found' 
        });
      }

      res.json({
        ok: true,
        data: emailSend
      });

    } catch (error) {
      console.error('Error fetching email log details:', error);
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to fetch email log details' 
      });
    }
  });

  // Certificate Template routes
  app.get('/api/certificate-templates', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const templates = await storage.getCertificateTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching certificate templates:', error);
      res.status(500).json({ message: 'Failed to fetch certificate templates' });
    }
  });

  app.post('/api/certificate-templates', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { name, template, templateFormat, templateData, isDefault } = req.body;
      
      if (!name || (!template && !templateData)) {
        return res.status(400).json({ message: 'Name and template/templateData are required' });
      }

      const newTemplate = await storage.createCertificateTemplate({
        name,
        template: template || null,
        templateFormat: templateFormat || 'html',
        templateData: templateData || null,
        isDefault: isDefault || false,
        organisationId: null
      });
      
      res.status(201).json(newTemplate);
    } catch (error) {
      console.error('Error creating certificate template:', error);
      res.status(500).json({ message: 'Failed to create certificate template' });
    }
  });

  app.put('/api/certificate-templates/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const { name, template, templateFormat, templateData, isDefault } = req.body;
      
      const updatedTemplate = await storage.updateCertificateTemplate(id, {
        name,
        template,
        templateFormat,
        templateData,
        isDefault
      });
      
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating certificate template:', error);
      res.status(500).json({ message: 'Failed to update certificate template' });
    }
  });

  app.delete('/api/certificate-templates/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      await storage.deleteCertificateTemplate(id);
      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting certificate template:', error);
      res.status(500).json({ message: 'Failed to delete certificate template' });
    }
  });

  // Stripe Plans Testing and Diagnostics API (SuperAdmin only)
  
  // Plan Price Test - validates Stripe Product and Price alignment
  app.post('/api/plans/:id/stripe-test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { id } = req.params;
      const plan = await storage.getPlan(id);
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();
      
      const validation = await stripeService.validatePlanStripeConfig(plan);
      
      res.json(validation);
    } catch (error) {
      console.error('Error testing plan Stripe config:', error);
      res.status(500).json({ 
        message: 'Failed to test plan Stripe configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Stripe Connection Test - validates API key and connectivity
  app.post('/api/stripe/connection-test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();
      
      const connectionTest = await stripeService.testConnection();
      
      res.json(connectionTest);
    } catch (error) {
      console.error('Error testing Stripe connection:', error);
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        details: {
          apiKeyValid: false,
          error: error instanceof Error ? error.message : 'Failed to initialize Stripe service'
        }
      });
    }
  });

  // Plan Checkout Test - creates test checkout session
  app.post('/api/plans/:id/checkout-test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { id } = req.params;
      const { organisationId = 'test-org-' + Date.now() } = req.body;
      
      const plan = await storage.getPlan(id);
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (!plan.stripePriceId) {
        return res.status(422).json({ 
          message: 'Plan must have a Stripe Price ID to create checkout session',
          suggestion: 'Sync the plan to Stripe first'
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();
      
      const checkout = await stripeService.createTestCheckoutSession(plan, organisationId);
      
      res.json({
        success: true,
        checkoutUrl: checkout.url,
        sessionId: checkout.sessionId,
        planId: plan.id,
        planName: plan.name,
        testOrganisationId: organisationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating test checkout session:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to create test checkout session',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Plan Change API - direct subscription update for plan changes
  app.post('/api/subscriptions/change-plan', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can change plans' });
      }

      const { planId, userCount, organisationId } = req.body;
      
      console.log('Plan change checkout request:', {
        userId: user.id,
        userRole: user.role,
        userOrgId: user.organisationId,
        requestOrgId: organisationId,
        planId,
        userCount
      });

      // Security check: admins can only modify their own organization
      if (user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Cannot modify other organizations' });
      }

      const organisation = await storage.getOrganisation(organisationId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (!plan.stripePriceId) {
        return res.status(400).json({ message: 'Plan does not have Stripe integration configured' });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      // Check if organization has active subscription
      const billingValidation = await stripeService.validateOrganizationBillingState(organisation);
      
      let subscriptionResult;
      
      if (!billingValidation.hasActiveSubscription) {
        // Create new subscription via Stripe Checkout
        const checkoutSession = await stripeService.createCheckoutSession(
          plan,
          organisation,
          userCount || 1
        );
        
        // Return checkout URL for frontend to redirect
        return res.json({
          success: true,
          checkout: true,
          checkoutUrl: checkoutSession.url,
          sessionId: checkoutSession.sessionId,
          message: 'Redirecting to Stripe Checkout to create subscription',
          timestamp: new Date().toISOString()
        });
      } else {
        // Update existing subscription
        subscriptionResult = await stripeService.updateExistingSubscription(
          plan,
          organisation,
          userCount || 1
        );
      }

      // Update organization billing to reflect the changes
      const previousPlanId = organisation.planId; // Capture before update
      await storage.updateOrganisationBilling(organisationId, {
        planId: plan.id,
        activeUserCount: userCount || 1,
        billingStatus: 'active',
        lastBillingSync: new Date()
      });

      // Send plan updated notification to organization admins (change plan API)
      if (plan.id !== previousPlanId) {
        try {
          await emailNotificationService.notifyPlanUpdated(
            organisationId,
            previousPlanId ?? undefined,
            plan.id,
            user.id
          );
        } catch (error) {
          console.error('[Change Plan API] Failed to send plan update notification:', error);
          // Don't break the plan update flow for notification failures
        }
      }

      res.json({
        success: true,
        message: 'Subscription updated successfully',
        subscriptionId: subscriptionResult.subscription.id,
        planId,
        planName: plan.name,
        userCount: userCount || 1,
        organisationId,
        prorationAmount: subscriptionResult.prorationAmount,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      res.status(500).json({ 
        message: 'Failed to update subscription plan', 
        error: error.message 
      });
    }
  });

  // Subscription Update - direct subscription update for seat changes
  app.post('/api/subscriptions/update', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied - admin only' });
      }

      const { planId, userCount, organisationId } = req.body;
      
      // Debug logging
      console.log('Subscription update request:', {
        userId: user.id,
        userRole: user.role,
        userOrgId: user.organisationId,
        requestOrgId: organisationId,
        planId,
        userCount
      });
      
      if (!planId) {
        return res.status(400).json({ message: 'Plan ID is required' });
      }

      // Use user's organisation ID if not provided in request
      const targetOrgId = organisationId || user.organisationId;
      
      // Verify user can only update their own organization (for admins)
      if (user.role === 'admin' && user.organisationId !== targetOrgId) {
        console.log('Organisation ID mismatch:', { userOrgId: user.organisationId, requestOrgId: targetOrgId });
        return res.status(403).json({ message: 'Access denied - can only update own organization' });
      }

      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (!plan.stripePriceId) {
        return res.status(422).json({ 
          message: 'Plan must have a Stripe Price ID to create checkout session',
          suggestion: 'Contact support to enable Stripe integration for this plan'
        });
      }

      const organisation = await storage.getOrganisation(targetOrgId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();
      
      // Check if organization has active subscription
      const billingValidation = await stripeService.validateOrganizationBillingState(organisation);
      
      let subscriptionResult;
      
      if (!billingValidation.hasActiveSubscription) {
        // Create new subscription via Stripe Checkout
        const checkoutSession = await stripeService.createCheckoutSession(
          plan,
          organisation,
          userCount || 1
        );
        
        // Return checkout URL for frontend to redirect
        return res.json({
          success: true,
          checkout: true,
          checkoutUrl: checkoutSession.url,
          sessionId: checkoutSession.sessionId,
          message: 'Redirecting to Stripe Checkout to create subscription',
          timestamp: new Date().toISOString()
        });
      } else {
        // Update existing subscription
        subscriptionResult = await stripeService.updateExistingSubscription(
          plan, 
          organisation, 
          userCount || 1
        );
      }
      
      // Update organization billing to reflect the changes
      const previousPlan = await storage.getPlan(organisation.planId || '');
      await storage.updateOrganisationBilling(organisation.id, {
        planId: plan.id,
        activeUserCount: userCount || 1,
        billingStatus: 'active',
        lastBillingSync: new Date()
      });
      
      // Send plan updated notification to organization admins using EmailNotificationService
      try {
        await emailNotificationService.notifyPlanUpdated(
          organisation.id,
          previousPlan?.id,
          plan.id,
          user.id
        );
      } catch (error) {
        console.error('[Plan Update] Failed to send admin notification:', error);
        // Don't break the plan update flow for notification failures
      }
      
      res.json({
        success: true,
        message: 'Subscription updated successfully',
        subscriptionId: subscriptionResult.subscription.id,
        planId: plan.id,
        planName: plan.name,
        userCount: userCount || 1,
        organisationId: organisation.id,
        prorationAmount: subscriptionResult.prorationAmount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update subscription',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Sync Plan to Stripe - manual sync endpoint
  app.post('/api/plans/:id/stripe-sync', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { id } = req.params;
      const plan = await storage.getPlan(id);
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (!plan.unitAmount || !plan.billingModel) {
        return res.status(422).json({ 
          message: 'Plan must have unit amount and billing model configured to sync with Stripe' 
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();
      
      const { productId, priceId } = await stripeService.syncPlanToStripe(plan);
      
      // Update plan with Stripe IDs
      const updatedPlan = await storage.updatePlan(id, {
        stripeProductId: productId,
        stripePriceId: priceId
      });
      
      res.json({
        success: true,
        plan: updatedPlan,
        stripe: {
          productId,
          priceId
        },
        message: 'Plan successfully synced to Stripe',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error syncing plan to Stripe:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to sync plan to Stripe',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Internal Billing Management API Endpoints
  // POST /billing/org/:orgId/seats → body: { quantity }
  app.post('/api/billing/org/:orgId/seats', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin only' });
      }

      const { orgId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: 'Valid quantity is required' });
      }

      // Load organisation
      const organisation = await storage.getOrganisation(orgId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      if (!organisation.stripeSubscriptionItemId) {
        return res.status(422).json({ 
          message: 'Subscription not initialised for this organisation',
          suggestion: 'Complete initial subscription setup first'
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      // Generate idempotency key
      const idempotencyKey = `billing:${orgId}:seats:${Date.now()}`;

      // Update subscription item quantity
      const subscriptionItem = await stripeService.updateSubscriptionItemQuantity(
        organisation.stripeSubscriptionItemId,
        quantity,
        orgId,
        idempotencyKey
      );

      // Update our database
      await storage.updateOrganisation(orgId, { activeUserCount: quantity });

      res.json({
        success: true,
        quantity,
        subscriptionItemId: subscriptionItem.id,
        message: `Successfully updated seats to ${quantity}`
      });

    } catch (error: any) {
      console.error('Error updating seats:', error);
      res.status(500).json({ 
        message: 'Failed to update seats', 
        error: error.message 
      });
    }
  });

  // POST /billing/org/:orgId/usage → body: { activeUsers, at? }
  app.post('/api/billing/org/:orgId/usage', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin only' });
      }

      const { orgId } = req.params;
      const { activeUsers, at } = req.body;

      if (!activeUsers || activeUsers < 0) {
        return res.status(400).json({ message: 'Valid activeUsers count is required' });
      }

      // Load organisation
      const organisation = await storage.getOrganisation(orgId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      if (!organisation.stripeSubscriptionItemId) {
        return res.status(422).json({ 
          message: 'Subscription not initialised for this organisation',
          suggestion: 'Complete initial subscription setup first'
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      // Generate idempotency key
      const timestamp = at ? new Date(at).getTime() / 1000 : Date.now() / 1000;
      const idempotencyKey = `billing:${orgId}:usage:${Math.floor(timestamp)}`;

      // Create usage record
      const usageRecord = await stripeService.createUsageRecord(
        organisation.stripeSubscriptionItemId,
        activeUsers,
        orgId,
        Math.floor(timestamp),
        idempotencyKey
      );

      // Update our database
      await storage.updateOrganisation(orgId, { 
        activeUserCount: activeUsers,
        lastBillingSync: new Date()
      });

      res.json({
        success: true,
        activeUsers,
        timestamp: Math.floor(timestamp),
        usageRecordId: usageRecord.id,
        message: `Successfully recorded usage: ${activeUsers} active users`
      });

    } catch (error: any) {
      console.error('Error recording usage:', error);
      res.status(500).json({ 
        message: 'Failed to record usage', 
        error: error.message 
      });
    }
  });

  // POST /billing/org/:orgId/plan → body: { planId }
  app.post('/api/billing/org/:orgId/plan', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin only' });
      }

      const { orgId } = req.params;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ message: 'Plan ID is required' });
      }

      // Load organisation and new plan
      const [organisation, newPlan] = await Promise.all([
        storage.getOrganisation(orgId),
        storage.getPlan(planId)
      ]);

      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      if (!newPlan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (!organisation.stripeSubscriptionItemId) {
        return res.status(422).json({ 
          message: 'Subscription not initialised for this organisation',
          suggestion: 'Complete initial subscription setup first'
        });
      }

      if (!newPlan.stripePriceId) {
        return res.status(422).json({ 
          message: 'Plan does not have Stripe integration configured',
          suggestion: 'Contact support to enable Stripe for this plan'
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      // Generate idempotency key
      const idempotencyKey = `billing:${orgId}:plan:${Date.now()}`;

      // Update subscription item price
      const subscriptionItem = await stripeService.updateSubscriptionItemPrice(
        organisation.stripeSubscriptionItemId,
        newPlan.stripePriceId,
        orgId,
        planId,
        idempotencyKey
      );

      // Get previous plan ID for notification context
      const previousPlanId = organisation.planId;

      // Update our database
      await storage.updateOrganisation(orgId, { planId });

      // Send plan updated notification to organization admins (Admin billing change)
      if (planId !== previousPlanId) {
        try {
          await emailNotificationService.notifyPlanUpdated(
            orgId,
            previousPlanId ?? undefined,
            planId,
            user.id
          );
        } catch (error) {
          console.error('[Admin Billing Change] Failed to send plan update notification:', error);
          // Don't break the plan update flow for notification failures
        }
      }

      res.json({
        success: true,
        planId,
        planName: newPlan.name,
        subscriptionItemId: subscriptionItem.id,
        message: `Successfully changed plan to ${newPlan.name}`
      });

    } catch (error: any) {
      console.error('Error changing plan:', error);
      res.status(500).json({ 
        message: 'Failed to change plan', 
        error: error.message 
      });
    }
  });

  // POST /api/billing/preview-change → body: { planId, userCount }
  app.post('/api/billing/preview-change', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin only' });
      }

      const { planId, userCount } = req.body;

      if (!planId) {
        return res.status(400).json({ message: 'Plan ID is required' });
      }

      if (!userCount || userCount < 1) {
        return res.status(400).json({ message: 'Valid user count is required' });
      }

      // Load organisation and new plan
      if (!user.organisationId) {
        return res.status(400).json({ message: 'User is not associated with an organisation' });
      }
      
      const [organisation, newPlan] = await Promise.all([
        storage.getOrganisation(user.organisationId),
        storage.getPlan(planId)
      ]);

      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      if (!newPlan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (!newPlan.stripePriceId) {
        return res.status(422).json({ 
          message: 'Plan does not have Stripe integration configured',
          suggestion: 'Contact support to enable Stripe for this plan'
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      // Get proration preview
      const preview = await stripeService.previewSubscriptionChange(
        newPlan,
        organisation,
        userCount
      );

      res.json({
        success: true,
        preview,
        message: 'Preview generated successfully'
      });

    } catch (error: any) {
      console.error('Error generating billing preview:', error);
      res.status(500).json({ 
        message: 'Failed to generate preview', 
        error: error.message 
      });
    }
  });

  // GET /api/billing/verify-checkout - Verify checkout sessions and update organization billing
  app.get('/api/billing/verify-checkout', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied - admin only' 
        });
      }

      const { csid } = req.query;
      if (!csid || typeof csid !== 'string') {
        return res.status(400).json({ 
          success: false,
          message: 'Missing or invalid checkout session ID (csid)' 
        });
      }

      // Get user's organization
      if (!user.organisationId) {
        return res.status(400).json({ 
          success: false,
          message: 'User is not associated with an organisation' 
        });
      }

      const organisation = await storage.getOrganisation(user.organisationId);
      if (!organisation) {
        return res.status(404).json({ 
          success: false,
          message: 'Organisation not found' 
        });
      }

      // Initialize Stripe service
      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      // Retrieve checkout session from Stripe
      let checkoutSession;
      try {
        checkoutSession = await stripeService.getCheckoutSession(csid, {
          expand: ['subscription', 'invoice']
        });
      } catch (error: any) {
        console.error('Error retrieving checkout session:', error);
        return res.status(404).json({ 
          success: false,
          message: 'Checkout session not found or expired' 
        });
      }

      // Verify session belongs to this organization
      const orgIdFromMetadata = checkoutSession.metadata?.org_id;
      if (orgIdFromMetadata !== organisation.id) {
        console.warn(`Security: Checkout session org mismatch. Session: ${orgIdFromMetadata}, User org: ${organisation.id}`);
        return res.status(403).json({ 
          success: false,
          message: 'Access denied - checkout session does not belong to your organization' 
        });
      }

      const sessionStatus = checkoutSession.status;
      const paymentStatus = checkoutSession.payment_status;
      
      // Handle different session modes and statuses
      if (checkoutSession.mode === 'payment') {
        // One-time payment mode (not typically used for subscriptions)
        if (sessionStatus === 'complete' && paymentStatus === 'paid') {
          return res.json({
            success: true,
            status: 'completed',
            message: 'Payment completed successfully',
            session: {
              id: checkoutSession.id,
              status: sessionStatus,
              payment_status: paymentStatus
            }
          });
        }
        
        return res.json({
          success: false,
          status: sessionStatus === 'open' ? 'pending' : 'failed',
          message: sessionStatus === 'open' ? 'Payment pending' : 'Payment failed',
          session: {
            id: checkoutSession.id,
            status: sessionStatus,
            payment_status: paymentStatus
          }
        });
      }

      // Handle subscription mode (new subscriptions)
      if (checkoutSession.mode === 'subscription') {
        if (sessionStatus !== 'complete') {
          return res.json({
            success: false,
            status: sessionStatus === 'open' ? 'pending' : 'failed',
            message: sessionStatus === 'open' ? 'Subscription setup pending' : 'Subscription setup failed',
            session: {
              id: checkoutSession.id,
              status: sessionStatus,
              payment_status: paymentStatus
            }
          });
        }

        // Subscription created successfully
        const subscription = checkoutSession.subscription;
        if (!subscription || typeof subscription === 'string') {
          return res.status(500).json({ 
            success: false,
            message: 'Subscription data not properly loaded from checkout session' 
          });
        }

        // Extract metadata for database update
        const metadata = checkoutSession.metadata || {};
        const planId = metadata.plan_id;
        const intendedSeats = metadata.intended_seats ? parseInt(metadata.intended_seats) : 1;

        if (!planId) {
          console.error('Missing plan_id in checkout session metadata');
          return res.status(500).json({ 
            success: false,
            message: 'Invalid checkout session - missing plan information' 
          });
        }

        // Extract subscription item ID and period end for comprehensive update
        const subscriptionItem = subscription.items?.data?.[0];
        const subscriptionItemId = subscriptionItem?.id || undefined;
        const currentPeriodEnd = (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : undefined;

        // Update organization billing information with all fields
        try {
          await storage.updateOrganisationBilling(organisation.id, {
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripeSubscriptionItemId: subscriptionItemId,
            planId: planId,
            billingStatus: subscription.status as any,
            activeUserCount: intendedSeats,
            currentPeriodEnd: currentPeriodEnd,
            lastBillingSync: new Date(),
          });

          console.log(`✅ Organization ${organisation.id} billing updated: subscription ${subscription.id}, plan ${planId}, seats ${intendedSeats}`);
        } catch (dbError: any) {
          console.error('Database update error:', dbError);
          return res.status(500).json({ 
            success: false,
            message: 'Failed to update organization billing information' 
          });
        }

        return res.json({
          success: true,
          status: 'completed',
          message: 'Subscription created and organization updated successfully',
          subscription: {
            id: subscription.id,
            status: subscription.status,
            plan_id: planId,
            licensed_seats: intendedSeats,
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString()
          }
        });
      }

      // Handle setup mode (existing subscription updates)
      if (checkoutSession.mode === 'setup') {
        if (sessionStatus !== 'complete') {
          return res.json({
            success: false,
            status: sessionStatus === 'open' ? 'pending' : 'failed',
            message: sessionStatus === 'open' ? 'Payment method setup pending' : 'Payment method setup failed',
            session: {
              id: checkoutSession.id,
              status: sessionStatus,
              payment_status: paymentStatus
            }
          });
        }

        // Setup completed - now apply subscription changes based on metadata
        const metadata = checkoutSession.metadata || {};
        const newPriceId = metadata.new_price_id;
        const newQuantity = metadata.new_quantity ? parseInt(metadata.new_quantity) : undefined;
        const targetSubscriptionId = metadata.target_subscription_id;
        const planId = metadata.plan_id;

        if (!targetSubscriptionId || !newPriceId || !planId) {
          console.error('Missing required metadata for setup mode update:', { targetSubscriptionId, newPriceId, planId });
          return res.status(500).json({ 
            success: false,
            message: 'Invalid setup session - missing subscription update information' 
          });
        }

        try {
          // Update the subscription with new price/quantity
          const stripe = stripeService['stripe'];
          const subscription = await stripe.subscriptions.retrieve(targetSubscriptionId);
          
          if (subscription.items.data.length === 0) {
            throw new Error('Subscription has no items to update');
          }

          const subscriptionItemId = subscription.items.data[0].id;

          const updateData: any = {
            items: [{
              id: subscriptionItemId,
              price: newPriceId,
            }],
            proration_behavior: 'always_invoice',
          };

          // Add quantity for non-metered plans
          if (newQuantity !== undefined && metadata.billing_model !== 'metered_per_active_user') {
            updateData.items[0].quantity = newQuantity;
          }

          const updatedSubscription = await stripe.subscriptions.update(
            targetSubscriptionId,
            updateData
          );

          // Update organization billing information
          await storage.updateOrganisationBilling(organisation.id, {
            planId: planId,
            billingStatus: updatedSubscription.status as any,
            activeUserCount: newQuantity || subscription.items.data[0].quantity || 1,
            lastBillingSync: new Date(),
          });

          console.log(`✅ Organization ${organisation.id} subscription updated: ${targetSubscriptionId} to plan ${planId}`);

          return res.json({
            success: true,
            status: 'completed',
            message: 'Subscription updated successfully',
            subscription: {
              id: updatedSubscription.id,
              status: updatedSubscription.status,
              plan_id: planId,
              licensed_seats: newQuantity || subscription.items.data[0].quantity || 1,
              current_period_end: (updatedSubscription as any).current_period_end ? new Date((updatedSubscription as any).current_period_end * 1000).toISOString() : null
            }
          });

        } catch (updateError: any) {
          console.error('Subscription update error:', updateError);
          return res.status(500).json({ 
            success: false,
            message: 'Failed to update subscription: ' + updateError.message 
          });
        }
      }

      // Unknown mode
      return res.status(400).json({ 
        success: false,
        message: `Unsupported checkout session mode: ${checkoutSession.mode}` 
      });

    } catch (error: any) {
      console.error('Error verifying checkout session:', error);
      res.status(500).json({ 
        success: false,
        message: 'Internal server error while verifying checkout', 
        error: error.message 
      });
    }
  });

  // Comprehensive Stripe Webhook Handler with signature verification
  app.post('/api/webhooks/stripe', async (req: any, res) => {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      console.error('Missing Stripe signature header');
      return res.status(400).json({ 
        error: 'Missing Stripe signature header',
        received: true,
        processed: false
      });
    }

    try {
      // Construct and verify the webhook event
      const event = stripeWebhookService.constructEvent(req.body, signature);
      
      // Process the webhook event
      const result = await stripeWebhookService.processWebhookEvent(event);
      
      if (result.success) {
        return res.status(200).json({
          received: true,
          processed: true,
          eventType: event.type,
          eventId: event.id,
          message: result.message
        });
      } else {
        return res.status(500).json({
          received: true,
          processed: false,
          eventType: event.type,
          eventId: event.id,
          error: result.message
        });
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
      
      // Return 400 for signature verification failures, 500 for processing errors
      const statusCode = error instanceof Error && error.message.includes('signature verification') ? 400 : 500;
      
      return res.status(statusCode).json({
        received: true,
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Subscription Diagnostics API for SuperAdmin
  // GET /api/subscription-diagnostics/:orgId - detailed subscription info with Stripe IDs
  app.get('/api/subscription-diagnostics/:orgId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { orgId } = req.params;

      // Load organisation with plan details
      const organisation = await storage.getOrganisationWithPlan(orgId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      let stripeData = null;
      if (organisation.stripeCustomerId && organisation.stripeSubscriptionId) {
        const { getStripeService } = await import('./services/StripeService.js');
        const stripeService = getStripeService();

        try {
          // Fetch subscription details from Stripe
          const subscription = await stripeService['stripe'].subscriptions.retrieve(
            organisation.stripeSubscriptionId,
            { expand: ['items', 'customer'] }
          );

          const customer = typeof subscription.customer === 'string' ? null : subscription.customer;
          stripeData = {
            customer: customer && 'email' in customer ? {
              id: customer.id,
              email: customer.email,
              name: customer.name,
            } : null,
            subscription: {
              id: subscription.id,
              status: subscription.status,
              current_period_start: (subscription as any).current_period_start,
              current_period_end: (subscription as any).current_period_end,
              cancel_at_period_end: subscription.cancel_at_period_end,
            },
            items: subscription.items.data.map(item => ({
              id: item.id,
              price_id: item.price.id,
              product_id: item.price.product,
              quantity: item.quantity,
              unit_amount: item.price.unit_amount,
              currency: item.price.currency,
              interval: item.price.recurring?.interval,
              usage_type: item.price.recurring?.usage_type,
            }))
          };
        } catch (error) {
          console.error('Error fetching Stripe data:', error);
          stripeData = { error: 'Failed to fetch Stripe data' };
        }
      }

      res.json({
        organisation: {
          id: organisation.id,
          name: organisation.name,
          planId: organisation.planId,
          stripeCustomerId: organisation.stripeCustomerId,
          stripeSubscriptionId: organisation.stripeSubscriptionId,
          stripeSubscriptionItemId: organisation.stripeSubscriptionItemId,
          billingStatus: organisation.billingStatus,
          activeUserCount: organisation.activeUserCount,
          lastBillingSync: organisation.lastBillingSync,
        },
        plan: organisation.plan,
        stripeData
      });

    } catch (error: any) {
      console.error('Error fetching subscription diagnostics:', error);
      res.status(500).json({ 
        message: 'Failed to fetch subscription diagnostics', 
        error: error.message 
      });
    }
  });

  // POST /api/subscription-preview/:orgId - get upcoming invoice preview
  app.post('/api/subscription-preview/:orgId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { orgId } = req.params;

      const organisation = await storage.getOrganisation(orgId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      if (!organisation.stripeCustomerId || !organisation.stripeSubscriptionId) {
        return res.status(422).json({ 
          message: 'Organisation does not have Stripe customer or subscription',
          suggestion: 'Complete subscription setup first'
        });
      }

      const { getStripeService } = await import('./services/StripeService.js');
      const stripeService = getStripeService();

      try {
        // Get upcoming invoice preview
        const upcomingInvoice = await (stripeService['stripe'].invoices as any).retrieveUpcoming({
          customer: organisation.stripeCustomerId,
          subscription: organisation.stripeSubscriptionId,
        });

        const invoiceData = {
          id: upcomingInvoice.id,
          amount_due: upcomingInvoice.amount_due,
          amount_paid: upcomingInvoice.amount_paid,
          amount_remaining: upcomingInvoice.amount_remaining,
          currency: upcomingInvoice.currency,
          period_start: upcomingInvoice.period_start,
          period_end: upcomingInvoice.period_end,
          status: upcomingInvoice.status,
          line_items: upcomingInvoice.lines.data.map((line: any) => ({
            id: line.id,
            description: line.description,
            amount: line.amount,
            currency: line.currency,
            quantity: line.quantity,
            unit_amount: line.unit_amount,
            price_id: line.price?.id,
            product: line.price?.product,
            period: {
              start: line.period.start,
              end: line.period.end
            },
            metadata: line.metadata
          }))
        };

        res.json({
          success: true,
          invoice: invoiceData,
          message: 'Upcoming invoice preview retrieved successfully'
        });

      } catch (error: any) {
        console.error('Error retrieving upcoming invoice:', error);
        res.status(500).json({ 
          success: false,
          message: 'Failed to retrieve upcoming invoice', 
          error: error.message 
        });
      }

    } catch (error: any) {
      console.error('Error in subscription preview:', error);
      res.status(500).json({ 
        message: 'Failed to generate subscription preview', 
        error: error.message 
      });
    }
  });

  // Organization Billing API (SuperAdmin only, Admin can read own organization)
  
  // Get organization billing status with plan details
  app.get('/api/organisations/:id/billing', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const { id } = req.params;
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // SuperAdmin can view any organization, Admin can only view their own
      if (user.role !== 'superadmin' && user.organisationId !== id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const orgWithPlan = await storage.getOrganisationWithPlan(id);
      
      if (!orgWithPlan) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      res.json({
        organisationId: orgWithPlan.id,
        organisationName: orgWithPlan.name,
        plan: orgWithPlan.plan,
        billing: {
          stripeCustomerId: orgWithPlan.stripeCustomerId,
          stripeSubscriptionId: orgWithPlan.stripeSubscriptionId,
          billingStatus: orgWithPlan.billingStatus,
          activeUserCount: orgWithPlan.activeUserCount,
          lastBillingSync: orgWithPlan.lastBillingSync,
        },
      });
    } catch (error) {
      console.error('Error fetching organization billing:', error);
      res.status(500).json({ message: 'Failed to fetch organization billing' });
    }
  });

  // Subscribe organization to a plan
  app.post('/api/organisations/:id/subscribe', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const { id } = req.params;
      const { planId, stripeCustomerId, stripeSubscriptionId } = req.body;
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      if (!planId) {
        return res.status(400).json({ message: 'Plan ID is required' });
      }

      // Validate the plan exists
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      // Validate the organization exists
      const organisation = await storage.getOrganisation(id);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      // Get previous plan for comparison
      const previousPlan = organisation.planId ? await storage.getPlan(organisation.planId) : null;
      
      // Update organization billing
      const updatedOrg = await storage.updateOrganisationBilling(id, {
        planId,
        stripeCustomerId,
        stripeSubscriptionId,
        billingStatus: 'active',
        lastBillingSync: new Date(),
      });
      
      // Send plan updated notification to organization admins using EmailNotificationService
      if (planId && planId !== organisation.planId) {
        try {
          await emailNotificationService.notifyPlanUpdated(
            id,
            previousPlan?.id,
            planId,
            user.id
          );
        } catch (error) {
          console.error('[SuperAdmin Plan Update] Failed to send admin notification:', error);
          // Don't break the plan update flow for notification failures
        }
      }

      // Sync usage count
      const usageSync = await storage.syncOrganisationUsage(id);

      res.json({
        success: true,
        organisation: updatedOrg,
        usage: usageSync,
        message: 'Organisation successfully subscribed to plan',
      });
    } catch (error) {
      console.error('Error subscribing organization to plan:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to subscribe organization to plan',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update organization subscription
  app.patch('/api/organisations/:id/subscription', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const { id } = req.params;
      const { 
        planId, 
        stripeCustomerId, 
        stripeSubscriptionId, 
        billingStatus 
      } = req.body;
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      // Validate the organization exists
      const organisation = await storage.getOrganisation(id);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      // If changing plan, validate the new plan exists
      if (planId) {
        const plan = await storage.getPlan(planId);
        if (!plan) {
          return res.status(404).json({ message: 'Plan not found' });
        }
      }

      // Update organization billing
      const updateData: any = {};
      if (planId !== undefined) updateData.planId = planId;
      if (stripeCustomerId !== undefined) updateData.stripeCustomerId = stripeCustomerId;
      if (stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = stripeSubscriptionId;
      if (billingStatus !== undefined) updateData.billingStatus = billingStatus;
      updateData.lastBillingSync = new Date();

      const updatedOrg = await storage.updateOrganisationBilling(id, updateData);

      res.json({
        success: true,
        organisation: updatedOrg,
        message: 'Organisation subscription updated successfully',
      });
    } catch (error) {
      console.error('Error updating organization subscription:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to update organization subscription',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync organization usage (for metered billing)
  app.post('/api/organisations/:id/sync-usage', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const { id } = req.params;
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      // Validate the organization exists
      const orgWithPlan = await storage.getOrganisationWithPlan(id);
      if (!orgWithPlan) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      // Sync usage count
      const usageSync = await storage.syncOrganisationUsage(id);

      // If organization has metered billing and Stripe subscription, update usage records
      let stripeUsageUpdate = null;
      if (orgWithPlan.plan?.billingModel === 'metered_per_active_user' && 
          orgWithPlan.stripeSubscriptionId && 
          orgWithPlan.plan.stripePriceId) {
        try {
          const { getStripeService } = await import('./services/StripeService.js');
          const stripeService = getStripeService();
          
          // Note: Usage reporting would be implemented here
          // For now, we'll skip the Stripe usage record creation
          console.log('Usage sync completed locally. Stripe usage reporting not yet implemented.');
          
          stripeUsageUpdate = {
            stripeUsageRecordId: 'not_implemented',
            quantity: usageSync.activeUserCount,
            timestamp: new Date(),
          };
        } catch (stripeError) {
          console.error('Error updating Stripe usage:', stripeError);
          // Continue without Stripe update - local sync was successful
        }
      }

      res.json({
        success: true,
        organisationId: id,
        usage: usageSync,
        stripeUsage: stripeUsageUpdate,
        billingModel: orgWithPlan.plan?.billingModel,
        message: 'Usage synchronized successfully',
      });
    } catch (error) {
      console.error('Error syncing organization usage:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to sync organization usage',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Plan Management API (SuperAdmin only for write operations, Admin can read)
  // Get all plans
  app.get('/api/plans', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const planList = await storage.getAllPlans();
      
      // Fetch features for each plan
      const plansWithFeatures = await Promise.all(
        planList.map(async (plan) => {
          const planWithFeatures = await storage.getPlanWithFeatures(plan.id);
          return planWithFeatures || { ...plan, features: [] };
        })
      );
      
      res.json(plansWithFeatures);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({ message: 'Failed to fetch plans' });
    }
  });

  // Get a single plan with features
  app.get('/api/plans/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const plan = await storage.getPlanWithFeatures(id);
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      res.json(plan);
    } catch (error) {
      console.error('Error fetching plan:', error);
      res.status(500).json({ message: 'Failed to fetch plan' });
    }
  });

  // Create a new plan with billing model
  app.post('/api/plans', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const {
        name,
        description,
        billingModel,
        cadence = 'monthly',
        currency = 'GBP',
        unitAmount,
        taxBehavior = 'exclusive',
        trialDays,
        minSeats,
        priceChangePolicy = 'prorate_immediately',
        featureIds,
        // Legacy support
        pricePerUser
      } = req.body;
      
      // Validation
      if (!name) {
        return res.status(400).json({ message: 'Plan name is required' });
      }
      
      if (!billingModel || !['metered_per_active_user', 'per_seat', 'flat_subscription'].includes(billingModel)) {
        return res.status(400).json({ message: 'Valid billing model is required (metered_per_active_user, per_seat, flat_subscription)' });
      }
      
      if (!unitAmount || unitAmount <= 0) {
        return res.status(400).json({ message: 'Unit amount must be greater than 0 (in minor units, e.g., 2000 = £20.00)' });
      }

      // Convert price from major units to minor units if pricePerUser is provided for backward compatibility
      let finalUnitAmount = unitAmount;
      if (pricePerUser && !unitAmount) {
        finalUnitAmount = Math.round(parseFloat(pricePerUser) * 100); // Convert £20.00 to 2000 pence
      }

      const newPlan = await storage.createPlan({
        name,
        description: description || null,
        billingModel,
        cadence,
        currency,
        unitAmount: finalUnitAmount,
        taxBehavior,
        trialDays,
        minSeats,
        isActive: true,
        priceChangePolicy,
        // Legacy field for backward compatibility
        pricePerUser: pricePerUser ? String(parseFloat(pricePerUser)) : null,
        status: 'active',
        createdBy: user.id
      });

      // Sync to Stripe if we have valid billing settings
      try {
        if (finalUnitAmount && billingModel) {
          const { getStripeService } = await import('./services/StripeService.js');
          const stripeService = getStripeService();
          
          const { productId, priceId } = await stripeService.syncPlanToStripe({
            ...newPlan,
            unitAmount: finalUnitAmount,
            billingModel,
            cadence,
            currency,
            taxBehavior,
            trialDays,
            minSeats,
            priceChangePolicy
          });
          
          // Update plan with Stripe IDs
          const updatedPlanWithStripe = await storage.updatePlan(newPlan.id, {
            stripeProductId: productId,
            stripePriceId: priceId
          });
          
          res.status(201).json(updatedPlanWithStripe);
          return;
        }
      } catch (stripeError) {
        console.error('Error syncing plan to Stripe:', stripeError);
        // Continue without Stripe sync if it fails - plan was already created
      }

      // Set plan features if provided
      if (featureIds && featureIds.length > 0) {
        await storage.setPlanFeatures(newPlan.id, featureIds);
      }
      
      res.status(201).json(newPlan);
    } catch (error) {
      console.error('Error creating plan:', error);
      res.status(500).json({ message: 'Failed to create plan' });
    }
  });

  // Update a plan
  app.put('/api/plans/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const {
        name,
        description,
        billingModel,
        cadence,
        currency,
        unitAmount,
        taxBehavior,
        trialDays,
        minSeats,
        isActive,
        priceChangePolicy,
        status,
        featureIds,
        // Legacy support
        pricePerUser
      } = req.body;
      
      // Get the existing plan to check for billing changes
      const existingPlan = await storage.getPlan(id);
      if (!existingPlan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      // Validation for billing model if provided
      if (billingModel && !['metered_per_active_user', 'per_seat', 'flat_subscription'].includes(billingModel)) {
        return res.status(400).json({ message: 'Valid billing model is required (metered_per_active_user, per_seat, flat_subscription)' });
      }
      
      if (unitAmount !== undefined && unitAmount <= 0) {
        return res.status(400).json({ message: 'Unit amount must be greater than 0 (in minor units)' });
      }

      // Convert price from major units to minor units if pricePerUser is provided for backward compatibility
      let finalUnitAmount = unitAmount;
      if (pricePerUser && !unitAmount) {
        finalUnitAmount = Math.round(parseFloat(pricePerUser) * 100);
      }

      // Check if billing settings changed (will require new Stripe Price)
      const billingSettingsChanged = 
        (unitAmount !== undefined && unitAmount !== existingPlan.unitAmount) ||
        (currency && currency !== existingPlan.currency) ||
        (cadence && cadence !== existingPlan.cadence) ||
        (billingModel && billingModel !== existingPlan.billingModel);

      const updatedPlan = await storage.updatePlan(id, {
        name,
        description,
        billingModel,
        cadence,
        currency,
        unitAmount: finalUnitAmount,
        taxBehavior,
        trialDays,
        minSeats,
        isActive,
        priceChangePolicy,
        // Legacy field
        pricePerUser: pricePerUser ? String(parseFloat(pricePerUser)) : undefined,
        status
      });

      // If billing settings changed, create new Stripe Price
      if (billingSettingsChanged && finalUnitAmount && billingModel) {
        try {
          const { getStripeService } = await import('./services/StripeService.js');
          const stripeService = getStripeService();
          
          const { productId, priceId } = await stripeService.syncPlanToStripe({
            ...updatedPlan,
            unitAmount: finalUnitAmount,
            billingModel,
            cadence: cadence || existingPlan.cadence,
            currency: currency || existingPlan.currency,
            taxBehavior: taxBehavior || existingPlan.taxBehavior,
            trialDays: trialDays !== undefined ? trialDays : existingPlan.trialDays,
            minSeats: minSeats !== undefined ? minSeats : existingPlan.minSeats,
            priceChangePolicy: priceChangePolicy || existingPlan.priceChangePolicy
          });
          
          // Update plan with new Stripe Price ID (Product ID should remain the same)
          const finalUpdatedPlan = await storage.updatePlan(id, {
            stripeProductId: productId,
            stripePriceId: priceId
          });
          Object.assign(updatedPlan, finalUpdatedPlan);
          
          // TODO: Handle existing subscriptions based on priceChangePolicy
          // This will be implemented when we add subscription management
          console.log(`Plan ${id} price updated. New Stripe Price ID: ${priceId}. Price change policy: ${updatedPlan.priceChangePolicy}`);
          
        } catch (stripeError) {
          console.error('Error updating Stripe price for plan:', stripeError);
          // Continue without Stripe sync if it fails - plan was already updated
        }
      }

      // Update plan features if provided
      if (featureIds !== undefined) {
        await storage.setPlanFeatures(id, featureIds);
      }
      
      res.json(updatedPlan);
    } catch (error) {
      console.error('Error updating plan:', error);
      res.status(500).json({ message: 'Failed to update plan' });
    }
  });

  // Delete a plan
  app.delete('/api/plans/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      await storage.deletePlan(id);
      res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
      console.error('Error deleting plan:', error);
      res.status(500).json({ message: 'Failed to delete plan' });
    }
  });

  // Get all plan features
  app.get('/api/plan-features', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const features = await storage.getAllPlanFeatures();
      res.json(features);
    } catch (error) {
      console.error('Error fetching plan features:', error);
      res.status(500).json({ message: 'Failed to fetch plan features' });
    }
  });

  // Get plan feature mappings for a specific plan
  app.get('/api/plan-features/mappings/:planId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { planId } = req.params;
      
      // Get plan feature mappings with feature details
      const mappings = await storage.getPlanFeatureMappings(planId);
      
      // Enrich with feature details
      const enrichedMappings = await Promise.all(mappings.map(async (mapping) => {
        const feature = await storage.getPlanFeature(mapping.featureId);
        return {
          ...mapping,
          featureId: feature?.key || mapping.featureId,
          featureName: feature?.name,
          featureDescription: feature?.description,
        };
      }));

      res.json(enrichedMappings);
    } catch (error) {
      console.error('Error fetching plan feature mappings:', error);
      res.status(500).json({ message: 'Failed to fetch plan feature mappings' });
    }
  });

  // Create a new plan feature
  app.post('/api/plan-features', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { key, name, description, category, isDefault } = req.body;
      
      if (!key || !name) {
        return res.status(400).json({ message: 'Key and name are required' });
      }

      const newFeature = await storage.createPlanFeature({
        key,
        name,
        description: description || null,
        category: category || null,
        isDefault: isDefault || false
      });
      
      res.status(201).json(newFeature);
    } catch (error) {
      console.error('Error creating plan feature:', error);
      res.status(500).json({ message: 'Failed to create plan feature' });
    }
  });

  // Certificates API
  app.get('/api/certificates/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const { organisationId } = req.params;
      
      if (!user || (user.role !== 'superadmin' && user.organisationId !== organisationId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get certificates for the organization with user and course details
      const certificates = await storage.getCertificatesByOrganisation(organisationId);
      
      // Enrich certificates with user and course data
      const enrichedCertificates = await Promise.all(
        certificates.map(async (cert) => {
          const [userDetails, course] = await Promise.all([
            storage.getUser(cert.userId),
            storage.getCourse(cert.courseId)
          ]);
          
          return {
            ...cert,
            user: userDetails ? {
              firstName: userDetails.firstName,
              lastName: userDetails.lastName,
              email: userDetails.email
            } : null,
            course: course ? {
              title: course.title
            } : null
          };
        })
      );
      
      res.json(enrichedCertificates);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      res.status(500).json({ message: 'Failed to fetch certificates' });
    }
  });

  // SCORM Preview route
  app.get('/api/scorm/preview', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { packageUrl, retry } = req.query;
      
      if (!packageUrl) {
        return res.status(400).json({ message: 'Package URL is required' });
      }

      // Import ScormService dynamically to avoid circular dependency
      const { ScormService } = await import('./services/scormService');
      const scormService = new ScormService();
      
      // If this is a retry, clear the cache first
      if (retry === 'true') {
        console.log('🔄 Retrying SCORM preview, clearing cache first');
        scormService.clearPackageCache(packageUrl as string);
      }
      
      const playerHtml = await scormService.getPlayerHtml(packageUrl as string, user.id, 'preview');
      
      res.setHeader('Content-Type', 'text/html');
      res.send(playerHtml);
    } catch (error) {
      console.error('Error generating SCORM preview:', error);
      
      // Provide a more informative error page
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SCORM Preview Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f8f9fa; }
            .error-container { background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; }
            .error-title { color: #dc3545; margin-bottom: 20px; }
            .retry-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 10px 5px; }
            .retry-btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1 class="error-title">❌ SCORM Preview Error</h1>
            <p>There was an error loading the SCORM package preview.</p>
            <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
            <p>This might be due to a corrupted package or network issues.</p>
            <button class="retry-btn" onclick="window.location.href = window.location.href + '&retry=true'">🔄 Retry</button>
            <button class="retry-btn" onclick="window.close()">❌ Close</button>
          </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(errorHtml);
    }
  });

  // NEW SCORM Preview System Routes
  
  // Process SCORM upload with new preview system
  app.post('/api/scorm/process-upload', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { packageUrl } = req.body;
      
      if (!packageUrl) {
        return res.status(400).json({ message: 'Package URL is required' });
      }

      console.log(`📦 Processing SCORM upload for user ${user.id}: ${packageUrl}`);
      
      // Process the upload using enhanced SCORM service
      const { EnhancedScormService } = await import('./services/enhancedScormService');
      const enhancedScormService = new EnhancedScormService();
      
      // Generate a unique course ID for this upload
      const courseId = Buffer.from(`${Date.now()}_${Math.random()}`).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
      
      try {
        const packageInfo = await enhancedScormService.processScormPackage(packageUrl, courseId);
        
        // Create validation object based on processing results
        const validation = {
          status: packageInfo.launchUrl ? 'valid' : 'error',
          manifestFound: true, // If we got here, manifest was found
          launchFileFound: Boolean(packageInfo.launchFile),
          launchFileCanOpen: Boolean(packageInfo.launchUrl),
          errors: packageInfo.diagnostics?.errors || [],
          warnings: packageInfo.diagnostics?.warnings || []
        };

        const response = {
          success: true,
          packageInfo: {
            packageId: courseId,
            title: packageInfo.title,
            description: packageInfo.description,
            version: packageInfo.version,
            launchFile: packageInfo.launchFile,
            launchUrl: packageInfo.launchUrl,
            organizations: packageInfo.organizations,
            defaultOrganization: packageInfo.defaultOrganization,
            scormRoot: packageInfo.scormRoot,
            diagnostics: packageInfo.diagnostics,
            validation: validation
          },
          message: `Package processed successfully with ID: ${courseId}`
        };

        console.log('📤 Upload processing response:', {
          title: response.packageInfo.title,
          launchUrl: response.packageInfo.launchUrl,
          organizationsCount: response.packageInfo.organizations.length,
          itemsTotal: response.packageInfo.organizations.reduce((total, org) => total + org.items.length, 0)
        });
        
        res.json(response);
      } catch (scormError: any) {
        // Provide detailed error diagnostics
        const errorResponse: any = {
          success: false,
          message: scormError.message,
          code: scormError.code || 'SCORM_PROCESSING_ERROR'
        };

        if (scormError.details) {
          errorResponse.details = scormError.details;
        }

        // Add specific error guidance
        if (scormError.code === 'LAUNCH_FILE_NOT_FOUND') {
          errorResponse.message = `Launch file not found: ${scormError.details?.attemptedLaunchFile}. Check imsmanifest.xml 'adlcp:href' and extracted folder structure.`;
          errorResponse.userMessage = "The SCORM package's launch file couldn't be found. This usually means the package structure is incorrect.";
        } else if (scormError.message.includes('imsmanifest.xml')) {
          errorResponse.message = `Invalid SCORM package: ${scormError.message}. Ensure the zip contains a valid imsmanifest.xml file.`;
          errorResponse.userMessage = "This doesn't appear to be a valid SCORM package. Make sure you uploaded the correct zip file.";
        } else if (scormError.message.includes('Invalid zip')) {
          errorResponse.message = `Cannot read zip file: ${scormError.message}. Upload a valid SCORM zip package.`;
          errorResponse.userMessage = "The uploaded file appears to be corrupted or isn't a valid zip file.";
        }

        console.error('SCORM processing failed:', errorResponse);
        return res.status(400).json(errorResponse);
      }
      
    } catch (error) {
      console.error('Error processing SCORM upload:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to process SCORM package',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get package validation info
  app.get('/api/scorm/package-info/:packageId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { packageId } = req.params;
      const packageInfo = await scormPreviewService.getPackageInfo(packageId);
      
      if (!packageInfo) {
        return res.status(404).json({ message: 'Package not found' });
      }
      
      res.json(packageInfo);
      
    } catch (error) {
      console.error('Error getting package info:', error);
      res.status(500).json({ message: 'Failed to get package info' });
    }
  });

  // Enhanced SCORM service file serving - NO AUTH REQUIRED for SCORM runtime
  app.get('/scos/:packageId/*', async (req: any, res) => {
    try {
      const { packageId } = req.params;
      const filePath = req.params[0] || 'index.html';
      
      console.log(`📁 Serving enhanced SCORM file: ${packageId}/${filePath}`);
      
      // Import enhanced SCORM service
      const { EnhancedScormService } = await import('./services/enhancedScormService');
      const enhancedScormService = new EnhancedScormService();
      
      // Get the file from the enhanced service
      const fileResult = await enhancedScormService.servePackageFile(packageId, filePath);
      
      if (!fileResult) {
        console.log(`❌ Enhanced SCORM file not found: ${packageId}/${filePath}`);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><title>File Not Found</title></head>
          <body>
            <h1>404 - File Not Found</h1>
            <p>File <code>${filePath}</code> not found in SCORM package <code>${packageId}</code></p>
          </body>
          </html>
        `);
      }
      
      res.setHeader('Content-Type', fileResult.contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(fileResult.content);
      
    } catch (error) {
      console.error('Error serving enhanced SCORM file:', error);
      res.status(500).send('Error loading file');
    }
  });

  // SCORM Preview file serving - NO AUTH REQUIRED for iframe loading
  app.get('/scorm-preview/:packageId/test', async (req: any, res) => {
    try {
      const { packageId } = req.params;
      
      console.log(`🧪 Serving test page for package: ${packageId}`);
      
      const testHtml = scormPreviewService.createTestPage(packageId);
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(testHtml);
      
    } catch (error) {
      console.error('Error serving test page:', error);
      res.status(500).send('Error loading test page');
    }
  });

  // SCORM Preview file serving - NO AUTH REQUIRED for iframe loading
  app.get('/scorm-preview/:packageId/*', async (req: any, res) => {
    try {
      const { packageId } = req.params;
      const filePath = req.params[0] || 'index.html';
      
      console.log(`📁 Serving SCORM preview file: ${packageId}/${filePath}`);
      
      const fileResult = await scormPreviewService.servePackageFile(packageId, filePath);
      
      if (!fileResult) {
        console.log(`❌ File not found: ${packageId}/${filePath}`);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><title>File Not Found</title></head>
          <body>
            <h1>404 - File Not Found</h1>
            <p>File <code>${filePath}</code> not found in package <code>${packageId}</code></p>
          </body>
          </html>
        `);
      }
      
      res.setHeader('Content-Type', fileResult.contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(fileResult.content);
      
    } catch (error) {
      console.error('Error serving SCORM preview file:', error);
      res.status(500).send('Error loading file');
    }
  });

  // SCORM Content serving route - MUST be before wildcard route
  app.get('/api/scorm/content', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { packageUrl, file } = req.query;
      
      if (!packageUrl || !file) {
        return res.status(400).json({ message: 'Package URL and file are required' });
      }

      // Import ScormService dynamically
      const { ScormService } = await import('./services/scormService');
      const scormService = new ScormService();
      
      let extracted, extractedPath;
      
      try {
        extracted = await scormService.extractPackage(packageUrl as string);
        extractedPath = await scormService.getExtractedPackagePath(packageUrl as string);
      } catch (extractionError) {
        console.error('SCORM extraction failed:', extractionError);
        // Clear corrupted cache and try once more
        scormService.clearPackageCache(packageUrl as string);
        
        try {
          extracted = await scormService.extractPackage(packageUrl as string);
          extractedPath = await scormService.getExtractedPackagePath(packageUrl as string);
        } catch (retryError) {
          console.error('SCORM extraction retry failed:', retryError);
          return res.status(500).json({ 
            message: 'Failed to extract SCORM package', 
            error: retryError instanceof Error ? retryError.message : String(retryError)
          });
        }
      }
      
      if (!extractedPath) {
        return res.status(404).json({ message: 'Package not found' });
      }

      let requestedFile = file as string;
      
      // Handle relative paths that are relative to the launch file
      if (requestedFile.startsWith('./')) {
        const launchFileDir = path.dirname(extracted.launchFile);
        // If launch file is in a subdirectory (like res/index.html), resolve relative paths from that directory
        if (launchFileDir !== '.') {
          requestedFile = path.join(launchFileDir, requestedFile.substring(2));
        } else {
          requestedFile = requestedFile.substring(2);
        }
      }

      const filePath = path.join(extractedPath, requestedFile);
      
      console.log(`🔍 SCORM Content Debug:
        - Package URL: ${packageUrl}
        - Original requested file: ${file}
        - Resolved file path: ${requestedFile}
        - Launch file: ${extracted.launchFile}
        - Extracted path: ${extractedPath}
        - Full file path: ${filePath}
        - File exists: ${existsSync(filePath)}`);
      
      // Check if file exists
      if (!existsSync(filePath)) {
        // List directory contents for debugging
        try {
          const dirContents = readdirSync(extractedPath);
          console.log(`📁 Directory contents: ${dirContents.join(', ')}`);
          if (dirContents.includes('res')) {
            const resContents = readdirSync(path.join(extractedPath, 'res'));
            console.log(`📁 res/ directory contents: ${resContents.join(', ')}`);
          }
        } catch (err) {
          console.log(`❌ Error reading directory: ${err}`);
        }
        return res.status(404).json({ message: 'File not found' });
      }

      // Serve the file with appropriate content type
      const ext = path.extname(file as string).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.html':
          contentType = 'text/html';
          break;
        case '.css':
          contentType = 'text/css';
          break;
        case '.js':
          contentType = 'application/javascript';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
        case '.woff':
        case '.woff2':
          contentType = 'font/woff2';
          break;
        case '.ttf':
          contentType = 'font/ttf';
          break;
      }

      res.setHeader('Content-Type', contentType);
      
      // For HTML files, we need to rewrite relative paths to include packageUrl
      if (ext === '.html') {
        const content = await fs.readFile(filePath, 'utf-8');
        const encodedPackageUrl = encodeURIComponent(packageUrl as string);
        
        // Helper function to resolve relative paths based on the current file's directory
        const resolveRelativePath = (relativePath: string) => {
          if (relativePath.startsWith('./')) {
            const currentFileDir = path.dirname(requestedFile);
            if (currentFileDir !== '.') {
              return path.join(currentFileDir, relativePath.substring(2));
            } else {
              return relativePath.substring(2);
            }
          }
          return relativePath;
        };
        
        const rewrittenContent = content
          .replace(/src\s*=\s*["'](?!https?:\/\/)(?!\/api\/scorm\/)([^"']+)["']/gi, 
            (match: string, src: string) => {
              const resolvedPath = resolveRelativePath(src);
              return `src="/api/scorm/content?packageUrl=${encodedPackageUrl}&file=${resolvedPath}"`;
            })
          .replace(/href\s*=\s*["'](?!https?:\/\/)(?!\/api\/scorm\/)([^"']+)["']/gi, 
            (match: string, href: string) => {
              const resolvedPath = resolveRelativePath(href);
              return `href="/api/scorm/content?packageUrl=${encodedPackageUrl}&file=${resolvedPath}"`;
            })
          .replace(/url\s*\(\s*["']?(?!https?:\/\/)(?!\/api\/scorm\/)([^"')]+)["']?\s*\)/gi, 
            (match: string, url: string) => {
              const resolvedPath = resolveRelativePath(url);
              return `url("/api/scorm/content?packageUrl=${encodedPackageUrl}&file=${resolvedPath}")`;
            });
        res.send(rewrittenContent);
      } else {
        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error serving SCORM content:', error);
      res.status(500).json({ message: 'Failed to serve content' });
    }
  });

  // SCORM Debugging Log Endpoint - Captures raw SCORM API calls
  app.post('/api/scorm/log', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const logEntry = req.body;
      
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Enhanced logging with user context
      const enrichedLog = {
        ...logEntry,
        userId: user.id,
        userEmail: user.email,
        timestamp: logEntry.timestamp || Date.now(),
        sessionId: req.session.id
      };
      
      // Log to console with detailed formatting for debugging
      if (logEntry.function === 'SetValue' || logEntry.function === 'LMSSetValue') {
        console.log(`🔧 SCORM ${logEntry.scormVersion} SetValue: ${logEntry.arguments[0]} = "${logEntry.arguments[1]}" (${user.email})`);
      } else if (logEntry.function === 'GetValue' || logEntry.function === 'LMSGetValue') {
        console.log(`📖 SCORM ${logEntry.scormVersion} GetValue: ${logEntry.arguments[0]} => "${logEntry.result}" (${user.email})`);
      } else {
        console.log(`📡 SCORM ${logEntry.scormVersion} ${logEntry.function}(${logEntry.arguments?.join(', ')}) => ${logEntry.result} (${user.email})`);
      }
      
      // TODO: Optionally persist to database for detailed analysis
      // await storage.createScormLog(enrichedLog);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error logging SCORM call:', error);
      res.status(500).json({ message: 'Failed to log SCORM call' });
    }
  });

  // SCORM launch endpoint - provides launch URL for iframe (MUST BE BEFORE WILDCARD)
  app.get('/api/scorm/:assignmentId/launch', requireAuth, async (req: any, res) => {
    try {
      const { assignmentId } = req.params;
      const userId = getUserIdFromSession(req);
      
      if (!userId) {
        console.log(`❌ SCORM launch failed: User not authenticated for assignment ${assignmentId}`);
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || assignment.userId !== userId) {
        console.log(`❌ SCORM launch failed: Assignment ${assignmentId} not found or access denied for user ${userId}`);
        return res.status(403).json({ message: 'Assignment not found or access denied' });
      }

      const course = await storage.getCourse(assignment.courseId);
      if (!course || !course.scormPackageUrl) {
        console.log(`❌ SCORM launch failed: Course ${assignment.courseId} or SCORM package not found`);
        return res.status(404).json({ message: 'Course or SCORM package not found' });
      }

      console.log(`🚀 SCORM launch for assignment ${assignmentId}, course: ${course.title}`);
      
      try {
        let launchUrl: string;
        let organizations: any[] = [];
        let scormVersion = '1.2';
        let diagnostics: any = {};

        // G. Check for admin launch URL override first
        if (course.launchUrlOverride) {
          console.log(`🔧 Using admin launch URL override: ${course.launchUrlOverride}`);
          launchUrl = course.launchUrlOverride;
          
          // Use stored SCORM data if available
          if (course.scormOrganizations) {
            organizations = course.scormOrganizations as any[];
          }
          if (course.scormVersion) {
            scormVersion = course.scormVersion;
          }
        } else {
          // Use enhanced SCORM service to process and verify the package
          console.log('🔄 Loading EnhancedScormService...');
          try {
            const { EnhancedScormService } = await import('./services/enhancedScormService');
            const enhancedScormService = new EnhancedScormService();
            
            console.log('✅ EnhancedScormService loaded, processing package...');
            
            // Use course ID as the extraction directory
            const packageInfo = await enhancedScormService.processScormPackage(course.scormPackageUrl, assignment.courseId);
            
            console.log('📊 Enhanced processing complete:', {
              title: packageInfo.title,
              launchUrl: packageInfo.launchUrl,
              version: packageInfo.version,
              orgs: packageInfo.organizations?.length || 0
            });
            
            launchUrl = packageInfo.launchUrl;
            organizations = packageInfo.organizations || [];
            scormVersion = packageInfo.version || '1.2';
            diagnostics = packageInfo.diagnostics || {};
            
            // Store enhanced SCORM data in database for future use
            try {
              await storage.updateCourse(course.id, {
                scormVersion: packageInfo.version,
                scormOrganizations: packageInfo.organizations,
                defaultOrganization: packageInfo.defaultOrganization
              });
              console.log('✅ Course updated with enhanced SCORM data');
            } catch (updateError) {
              console.warn('⚠️ Failed to update course with enhanced data:', updateError);
            }
          } catch (enhancedError) {
            console.error('❌ Enhanced service failed, falling back to basic processing:', enhancedError);
            
            // Fallback to basic SCORM processing
            const { ImprovedScormService } = await import('./services/improvedScormService');
            const improvedScormService = new ImprovedScormService();
            const packageInfo = await improvedScormService.processScormPackage(course.scormPackageUrl, assignment.courseId);
            
            launchUrl = packageInfo.launchUrl || '';
            scormVersion = packageInfo.version || '1.2';
            diagnostics = packageInfo.diagnostics || {};
          }
        }
        
        console.log(`✅ SCORM package ready. Launch URL: ${launchUrl}`);
        
        // Return comprehensive launch data
        const response = {
          launchUrl, // Primary launch URL (from override or processing)
          courseTitle: course.title,
          scormVersion,
          organizations, // For multi-SCO support
          defaultOrganization: course.defaultOrganization || (organizations.length > 0 ? organizations[0].id : ''),
          diagnostics,
          hasOverride: !!course.launchUrlOverride,
          success: true
        };
        
        // Debug the response structure
        console.log('📤 Sending response keys:', Object.keys(response));
        console.log('📤 Response details:', {
          launchUrl: response.launchUrl,
          courseTitle: response.courseTitle,
          scormVersion: response.scormVersion,
          organizationsCount: response.organizations.length,
          hasOverride: response.hasOverride
        });
        
        // Ensure all fields are properly set
        const finalResponse = {
          launchUrl: launchUrl || '',
          courseTitle: course.title || 'Unknown Course',
          scormVersion: scormVersion || '1.2',
          organizations: organizations || [],
          defaultOrganization: course.defaultOrganization || (organizations.length > 0 ? organizations[0].id : ''),
          diagnostics: diagnostics || {},
          hasOverride: !!course.launchUrlOverride,
          success: true
        };
        
        // Make sure we have valid data
        if (!finalResponse.launchUrl) {
          console.error('❌ Critical: launchUrl is empty in response');
        }
        if (!finalResponse.courseTitle) {
          console.error('❌ Critical: courseTitle is empty in response');
        }
        if (!finalResponse.scormVersion) {
          console.error('❌ Critical: scormVersion is empty in response');
        }
        
        console.log('🚀 Final response being sent:', JSON.stringify(finalResponse, null, 2));
        
        res.json(finalResponse);
      } catch (scormError: any) {
        console.error(`❌ SCORM processing failed for assignment:`, scormError);
        
        // Provide specific error messages based on the error type
        let errorMessage = 'Failed to launch course';
        let errorCode = 'SCORM_ERROR';
        
        if (scormError.code === 'LAUNCH_FILE_NOT_FOUND') {
          errorMessage = `Launch file not found: ${scormError.details?.attemptedLaunchFile || 'unknown'}. The SCORM package structure appears to be incorrect.`;
          errorCode = 'LAUNCH_FILE_NOT_FOUND';
        } else if (scormError.message.includes('imsmanifest.xml')) {
          errorMessage = 'Invalid SCORM package: imsmanifest.xml is missing or corrupted.';
          errorCode = 'INVALID_MANIFEST';
        } else if (scormError.message.includes('Invalid zip')) {
          errorMessage = 'SCORM package file is corrupted or not a valid zip file.';
          errorCode = 'INVALID_ZIP';
        }
        
        return res.status(400).json({ 
          message: errorMessage,
          code: errorCode,
          details: scormError.details
        });
      }
    } catch (error) {
      console.error(`❌ Unexpected error in SCORM launch:`, error);
      res.status(500).json({ message: 'Failed to launch course', code: 'SERVER_ERROR' });
    }
  });

  // SCORM Diagnostic route - comprehensive SCORM package analysis
  app.get('/admin/scorm/:courseId/diagnose', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { courseId } = req.params;
      const course = await storage.getCourse(courseId);
      
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      if (!course.scormPackageUrl) {
        return res.json({
          ok: false,
          reason: 'No SCORM package URL configured for this course',
          scormRoot: '',
          manifestFound: false,
          courseId
        });
      }

      // Start comprehensive diagnosis
      const { performScormDiagnosis } = await import('./scormDiagnosis');
      const diagnosis = await performScormDiagnosis(courseId, course.scormPackageUrl);
      res.json(diagnosis);

    } catch (error: any) {
      console.error('Error in SCORM diagnosis:', error);
      res.json({
        ok: false,
        reason: `Diagnosis failed: ${error.message}`,
        scormRoot: '',
        manifestFound: false,
        error: (error as any)?.message
      });
    }
  });

  // ===============================
  // SUPPORT TICKET SYSTEM ROUTES
  // ===============================

  // Get support tickets (role-specific filtering)
  app.get('/api/support/tickets', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { status, priority, category, search, limit, offset } = req.query;
      const filters: any = {};

      // Apply filters based on query params
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (category) filters.category = category;
      if (search) filters.search = search as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      // Role-based access control
      if (user.role === 'superadmin') {
        // SuperAdmins see all tickets
      } else if (user.role === 'admin') {
        // Admins only see their organization's tickets
        filters.organisationId = user.organisationId;
      } else {
        // Users only see tickets they created
        filters.createdBy = user.id;
      }

      const tickets = await storage.getSupportTickets(filters);
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  // Get single support ticket with responses
  app.get('/api/support/tickets/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;
      const ticket = await storage.getSupportTicket(id);

      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      // Role-based access control
      if (user.role === 'superadmin') {
        // SuperAdmins can access any ticket
      } else if (user.role === 'admin') {
        // Admins can only access their organization's tickets
        if (ticket.organisationId !== user.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // Users can only access tickets they created
        if (ticket.createdBy !== user.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Get responses for the ticket
      const responses = await storage.getSupportTicketResponses(id);

      // Get ticket creator details for SuperAdmin view
      let ticketCreator = null;
      let ticketOrganisation = null;
      
      if (user.role === 'superadmin') {
        // Fetch creator details
        ticketCreator = await storage.getUser(ticket.createdBy);
        
        // Fetch organisation details if ticket has one
        if (ticket.organisationId) {
          ticketOrganisation = await storage.getOrganisation(ticket.organisationId);
        }
      }

      res.json({ 
        ...ticket, 
        responses,
        createdByUser: ticketCreator ? {
          id: ticketCreator.id,
          firstName: ticketCreator.firstName,
          lastName: ticketCreator.lastName,
          email: ticketCreator.email,
          role: ticketCreator.role
        } : null,
        organisation: ticketOrganisation ? {
          id: ticketOrganisation.id,
          name: ticketOrganisation.name,
          displayName: ticketOrganisation.displayName
        } : null
      });
    } catch (error) {
      console.error('Error fetching support ticket:', error);
      res.status(500).json({ message: 'Failed to fetch support ticket' });
    }
  });

  // Create new support ticket
  app.post('/api/support/tickets', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { title, description, priority, category } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: 'Title and description are required' });
      }

      // Generate unique ticket number
      const ticketCount = await storage.getSupportTickets({ limit: 1 });
      const totalTickets = await storage.getSupportTickets({});
      const ticketNumber = `TKT-${String(totalTickets.length + 1).padStart(6, '0')}`;

      const ticketData = {
        ticketNumber,
        title,
        description,
        priority: priority || 'medium',
        category: category || 'general',
        createdBy: user.id,
        organisationId: user.role === 'superadmin' ? null : user.organisationId,
      };

      const ticket = await storage.createSupportTicket(ticketData);
      res.status(201).json(ticket);
    } catch (error) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({ message: 'Failed to create support ticket' });
    }
  });

  // Update support ticket (status, priority, assignment)
  app.put('/api/support/tickets/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;
      const { status, priority, assignedTo, isRead } = req.body;

      const ticket = await storage.getSupportTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      // Role-based access control
      if (user.role === 'superadmin') {
        // SuperAdmins can update any ticket
      } else if (user.role === 'admin') {
        // Admins can only update their organization's tickets
        if (ticket.organisationId !== user.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // Users can only update their own tickets (limited fields)
        if (ticket.createdBy !== user.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      if (isRead !== undefined) updateData.isRead = isRead;

      // Only SuperAdmins can assign tickets
      if (user.role === 'superadmin' && assignedTo !== undefined) {
        updateData.assignedTo = assignedTo;
      }

      // Set resolvedAt when status is changed to resolved
      if (status === 'resolved' && ticket.status !== 'resolved') {
        updateData.resolvedAt = new Date();
      }

      const updatedTicket = await storage.updateSupportTicket(id, updateData);
      res.json(updatedTicket);
    } catch (error) {
      console.error('Error updating support ticket:', error);
      res.status(500).json({ message: 'Failed to update support ticket' });
    }
  });

  // Add response to support ticket
  app.post('/api/support/tickets/:id/responses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;
      const { message, isInternal } = req.body;

      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      const ticket = await storage.getSupportTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      // Role-based access control
      if (user.role === 'superadmin') {
        // SuperAdmins can respond to any ticket
      } else if (user.role === 'admin') {
        // Admins can only respond to their organization's tickets
        if (ticket.organisationId !== user.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // Users can only respond to tickets they created
        if (ticket.createdBy !== user.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const responseData = {
        ticketId: id,
        userId: user.id,
        createdBy: user.id,
        message,
        isInternal: user.role === 'superadmin' ? (isInternal || false) : false,
      };

      const response = await storage.createSupportTicketResponse(responseData);

      // Update ticket status to 'in_progress' if it was 'open'
      if (ticket.status === 'open') {
        await storage.updateSupportTicket(id, { status: 'in_progress' });
      }

      // If a SuperAdmin/Admin responds to a ticket, mark it as unread for the ticket creator to trigger notifications
      if (user.role === 'superadmin' || (user.role === 'admin' && ticket.createdBy !== user.id)) {
        await storage.updateSupportTicket(id, { isRead: false });
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating support ticket response:', error);
      res.status(500).json({ message: 'Failed to create response' });
    }
  });

  // Get unread ticket count (for notifications)
  app.get('/api/support/unread-count', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const filters: any = {};

      // Role-based filtering
      if (user.role === 'superadmin') {
        // SuperAdmins see count of all unread tickets assigned to them or unassigned
        filters.assignedTo = user.id;
      } else if (user.role === 'admin') {
        // Admins see count of unread tickets in their organization
        filters.organisationId = user.organisationId;
      } else {
        // Users see count of unread responses to their tickets
        filters.createdBy = user.id;
      }

      const count = await storage.getUnreadTicketCount(filters);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread ticket count:', error);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  // Delete support ticket (SuperAdmin only)
  app.delete('/api/support/tickets/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      const { id } = req.params;
      await storage.deleteSupportTicket(id);
      res.json({ message: 'Ticket deleted successfully' });
    } catch (error) {
      console.error('Error deleting support ticket:', error);
      res.status(500).json({ message: 'Failed to delete support ticket' });
    }
  });

  // ===============================
  // END SUPPORT TICKET ROUTES
  // ===============================

  // SCORM Asset serving route - handles direct asset requests
  app.get('/api/scorm/*', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Extract the asset path from the URL
      const assetPath = req.params[0]; // This captures everything after /api/scorm/
      
      // Get packageUrl from query params or session
      const { packageUrl } = req.query;
      
      if (!packageUrl) {
        return res.status(400).json({ message: 'Package URL is required' });
      }

      // Import ScormService dynamically
      const { ScormService } = await import('./services/scormService');
      const scormService = new ScormService();
      
      await scormService.extractPackage(packageUrl as string);
      const extractedPath = await scormService.getExtractedPackagePath(packageUrl as string);
      
      if (!extractedPath) {
        return res.status(404).json({ message: 'Package not found' });
      }

      const filePath = path.join(extractedPath, assetPath);
      
      // Check if file exists
      if (!existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Serve the file with appropriate content type
      const ext = path.extname(assetPath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.html':
          contentType = 'text/html';
          break;
        case '.css':
          contentType = 'text/css';
          break;
        case '.js':
          contentType = 'application/javascript';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
        case '.woff':
        case '.woff2':
          contentType = 'font/woff2';
          break;
        case '.ttf':
          contentType = 'font/ttf';
          break;
      }

      res.setHeader('Content-Type', contentType);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving SCORM asset:', error);
      res.status(500).json({ message: 'Failed to serve asset' });
    }
  });

  // Organisations routes
  app.get('/api/organisations', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisations = await storage.getAllOrganisations();
      res.json(organisations);
    } catch (error) {
      console.error('Error fetching organisations:', error);
      res.status(500).json({ message: 'Failed to fetch organisations' });
    }
  });

  app.get('/api/organisations/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      
      // Admins can only see their own organization, SuperAdmins can see any
      if (user.role === 'admin' && user.organisationId !== id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisation = await storage.getOrganisation(id);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      // Also get organization settings (includes email settings)
      const settings = await storage.getOrganisationSettings(id);
      
      // Merge settings into the organization response
      const response = {
        ...organisation,
        ...settings
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching organisation:', error);
      res.status(500).json({ message: 'Failed to fetch organisation' });
    }
  });

  // Get organisation statistics (for SuperAdmins)
  app.get('/api/organisations/:id/stats', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const stats = await storage.getOrganisationStats(id);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching organisation stats:', error);
      res.status(500).json({ message: 'Failed to fetch organisation stats' });
    }
  });

  // Admin dashboard statistics (for admins to get their own organization's stats)
  app.get('/api/admin/stats', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!user.organisationId) {
        return res.status(400).json({ message: 'User is not associated with an organisation' });
      }

      const stats = await storage.getOrganisationStats(user.organisationId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
  });

  // Impersonate admin for organisation
  app.post('/api/organisations/:id/impersonate-admin', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id: orgId } = req.params;
      
      // Find an admin for this organisation
      const adminUsers = await storage.getUsersWithFilters({
        organisationId: orgId,
        role: 'admin',
        status: 'active'
      });
      
      if (adminUsers.length === 0) {
        return res.status(404).json({ message: 'No admin users found for this organisation' });
      }

      // Use the first admin found
      const adminUser = adminUsers[0];
      
      // Create a temporary login token
      const impersonationToken = `temp_${Date.now()}_${adminUser.id}`;
      
      // Store the token temporarily (in a real app, use Redis or database)
      (global as any).impersonationTokens = (global as any).impersonationTokens || new Map();
      (global as any).impersonationTokens.set(impersonationToken, {
        userId: adminUser.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
      });
      
      // Clean up expired tokens
      for (const [token, data] of (global as any).impersonationTokens.entries()) {
        if (data.expiresAt < Date.now()) {
          (global as any).impersonationTokens.delete(token);
        }
      }
      
      const adminLoginUrl = `${req.protocol}://${req.get('host')}/api/impersonate-login?token=${impersonationToken}`;
      
      res.json({ 
        adminLoginUrl,
        adminUser: {
          name: `${adminUser.firstName} ${adminUser.lastName}`,
          email: adminUser.email
        }
      });
    } catch (error) {
      console.error('Error creating admin impersonation:', error);
      res.status(500).json({ message: 'Failed to create admin impersonation' });
    }
  });

  // Impersonation login endpoint
  app.get('/api/impersonate-login', async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || !(global as any).impersonationTokens?.has(token)) {
        return res.status(404).send('Invalid or expired impersonation token');
      }
      
      const tokenData = (global as any).impersonationTokens.get(token);
      if (tokenData.expiresAt < Date.now()) {
        (global as any).impersonationTokens.delete(token);
        return res.status(404).send('Expired impersonation token');
      }
      
      // Get the admin user
      const adminUser = await storage.getUser(tokenData.userId);
      if (!adminUser) {
        return res.status(404).send('Admin user not found');
      }
      
      // Log them in by setting session
      req.session.user = {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        organisationId: adminUser.organisationId
      };
      
      // Clean up the token
      (global as any).impersonationTokens.delete(token);
      
      // Redirect to admin dashboard
      res.redirect('/');
    } catch (error) {
      console.error('Error during impersonation login:', error);
      res.status(500).send('Impersonation login failed');
    }
  });

  // Get organisation users (for Manage Users functionality)
  app.get('/api/organisations/:id/users', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id: orgId } = req.params;
      const users = await storage.getUsersByOrganisation(orgId);
      res.json(users);
    } catch (error) {
      console.error('Error fetching organisation users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Get all courses (for course assignment)
  app.get('/api/courses/all', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const courses = await storage.getAllCourses();
      res.json(courses);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ message: 'Failed to fetch courses' });
    }
  });

  // Assign courses to organisation
  app.post('/api/organisations/:id/assign-courses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id: orgId } = req.params;
      const { courseIds } = req.body;

      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({ message: 'Course IDs array is required' });
      }

      // Get all users from the organisation
      const orgUsers = await storage.getUsersByOrganisation(orgId);
      const activeUsers = orgUsers.filter(u => u.status === 'active' && u.role === 'user');

      // Create assignments for each user and course combination
      const assignments = [];
      for (const courseId of courseIds) {
        const course = await storage.getCourse(courseId); // Get course details for email context
        
        for (const orgUser of activeUsers) {
          const assignmentData = {
            courseId,
            userId: orgUser.id,
            organisationId: orgId,
            assignedBy: user.id,
            status: 'not_started' as const,
            notificationsEnabled: true
          };
          const assignment = await storage.createAssignment(assignmentData);
          assignments.push(assignment);
          
          // Send course assignment email using EmailNotificationService if EMAIL_TEMPLATES_V2 is enabled
          if (EMAIL_TEMPLATES_V2_ENABLED && course) {
            try {
              await emailNotificationService.notifyCourseAssigned(
                orgId,
                courseId,
                orgUser.id,
                user.id
              );
              
              console.log(`✅ COURSE_ASSIGNED notification queued for organization admins (User: ${orgUser.email}, Course: ${course.title})`);
            } catch (emailError) {
              console.warn('⚠️ Failed to queue COURSE_ASSIGNED notification:', emailError);
              // Don't fail assignment if email fails
            }
          }
        }
      }

      // LEGACY: Send bulk course assignment notification to organization admins
      // TODO: Remove this when EMAIL_TEMPLATES_V2 is fully deployed
      if (!EMAIL_TEMPLATES_V2_ENABLED && assignments.length > 0 && orgId) {
        const organization = await storage.getOrganisation(orgId);
        if (organization) {
          const adminEmails = await getOrganizationAdminEmails(organization.id);
          
          if (adminEmails.length > 0 && courseIds.length > 0) {
            // Get first course details for notification (as representative example)
            const firstCourse = await storage.getCourse(courseIds[0]);
            if (firstCourse) {
              await sendMultiRecipientNotification(
                'Bulk Course Assignment',
                adminEmails,
                (adminEmail) => emailTemplateService.sendCourseAssignedNotification(
                  adminEmail,
                  buildCourseAssignedNotificationData(organization, { name: adminEmail.split('@')[0], email: adminEmail }, activeUsers[0], firstCourse, user),
                  organization.id
                )
              );
            }
          }
        }
      }
      
      res.json({ 
        message: `Successfully assigned ${courseIds.length} course(s) to ${activeUsers.length} user(s)`,
        assignmentsCreated: assignments.length 
      });
    } catch (error) {
      console.error('Error assigning courses:', error);
      res.status(500).json({ message: 'Failed to assign courses' });
    }
  });

  app.post('/api/organisations', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Extract admin user data and selectedCategoryIds from request body
      const { adminEmail, adminFirstName, adminLastName, adminJobTitle, adminDepartment, selectedCategoryIds, ...orgData } = req.body;
      
      // Validate required admin fields
      if (!adminEmail || !adminFirstName || !adminLastName) {
        return res.status(400).json({ message: 'Admin user details are required' });
      }

      // Validate selectedCategoryIds if provided
      if (selectedCategoryIds && !Array.isArray(selectedCategoryIds)) {
        return res.status(400).json({ message: 'selectedCategoryIds must be an array' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail)) {
        return res.status(400).json({ message: 'Invalid admin email format' });
      }

      // Check if admin email already exists
      const existingUser = await storage.getUserByEmail(adminEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'Admin email address is already in use' });
      }

      const validatedOrgData = insertOrganisationSchema.parse(orgData);
      const organisation = await storage.createOrganisation(validatedOrgData);
      
      // Generate a temporary password for the admin user
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
      let tempPassword = '';
      for (let i = 0; i < 8; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      console.log(`Generated temporary password for admin ${adminEmail}: ${tempPassword}`);

      // Hash the temporary password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

      // Create admin user for the organisation
      const adminUserData = {
        email: adminEmail,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'admin' as const,
        status: 'active' as const,
        organisationId: organisation.id,
        jobTitle: adminJobTitle || null,
        department: adminDepartment || null,
        allowCertificateDownload: true,
        passwordHash: passwordHash,
        requiresPasswordChange: true, // Force password change on first login
      };

      const adminUser = await storage.createUser(adminUserData);
      
      // Create default organisation settings
      await storage.createOrganisationSettings({
        organisationId: organisation.id,
        signerName: adminFirstName + ' ' + adminLastName,
        signerTitle: adminJobTitle || 'Learning Manager',
      });

      // Grant access to selected course categories
      let grantedCategoriesCount = 0;
      if (selectedCategoryIds && Array.isArray(selectedCategoryIds) && selectedCategoryIds.length > 0) {
        for (const folderId of selectedCategoryIds) {
          try {
            // Validate that the folder exists before granting access
            const folder = await storage.getCourseFolder(folderId);
            if (folder) {
              await storage.grantOrganisationFolderAccess({
                organisationId: organisation.id,
                folderId: folderId,
                grantedBy: user.id,
              });
              grantedCategoriesCount++;
              console.log(`✅ Granted course category access: ${folder.name} (${folderId}) to organisation ${organisation.displayName}`);
            } else {
              console.warn(`⚠️ Folder ${folderId} not found, skipping access grant`);
            }
          } catch (error) {
            console.error(`❌ Failed to grant access to folder ${folderId}:`, error);
          }
        }
        console.log(`📚 Organisation ${organisation.displayName} granted access to ${grantedCategoriesCount} course categories`);
      } else {
        console.log(`📚 Organisation ${organisation.displayName} created with no specific course category access (will see no courses)`);
      }

      // Send welcome email using EmailOrchestrator if EMAIL_TEMPLATES_V2 is enabled
      if (EMAIL_TEMPLATES_V2_ENABLED) {
        try {
          const context = {
            user: {
              name: `${adminUser.firstName} ${adminUser.lastName}`,
              email: adminUser.email || undefined,
              firstName: adminUser.firstName || undefined,
              lastName: adminUser.lastName || undefined,
              fullName: `${adminUser.firstName} ${adminUser.lastName}`
            },
            org: {
              name: organisation.name,
              displayName: organisation.displayName || organisation.name
            },
            addedBy: {
              name: `${user.firstName || 'SuperAdmin'} ${user.lastName || ''}`
            },
            addedAt: new Date().toISOString(),
            loginUrl: `${process.env.REPLIT_URL || 'http://localhost:5000'}/api/login`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@intellms.app'
          };

          // Include the temporary password in the context
          (context as any).temporaryPassword = tempPassword;

          await emailOrchestrator.queue({
            triggerEvent: 'ORG_FAST_ADD',
            templateKey: 'new_user_welcome',
            toEmail: adminUser.email!,
            context,
            organisationId: organisation.id,
            resourceId: organisation.id,
            priority: 1
          });
          
          console.log(`✅ ORG_FAST_ADD email queued for ${adminUser.email} (SuperAdmin created with password)`);
        } catch (emailError) {
          console.warn('⚠️ Failed to queue ORG_FAST_ADD email:', emailError);
          // Don't fail organization creation if email fails
        }
      }

      res.status(201).json({
        organisation,
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: adminUser.role,
        },
        courseCategoryAccess: {
          totalSelected: selectedCategoryIds ? selectedCategoryIds.length : 0,
          granted: grantedCategoriesCount
        }
      });
    } catch (error) {
      console.error('Error creating organisation:', error);
      res.status(500).json({ message: 'Failed to create organisation' });
    }
  });

  app.put('/api/organisations/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      
      // SuperAdmins can update any organization, Admins can only update their own
      if (user.role !== 'superadmin' && (user.role !== 'admin' || user.organisationId !== id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      let updateData = { ...req.body };

      // Check if subdomain is being updated and validate custom domain feature access
      if (updateData.subdomain !== undefined && user.role === 'admin') {
        const hasCustomDomainAccess = await hasFeatureAccess(id, 'custom_domain');
        if (!hasCustomDomainAccess) {
          return res.status(403).json({ message: 'Custom domain feature not available for your plan' });
        }
      }

      // Check if logo is being updated and validate remove branding feature access
      if (updateData.logoUrl !== undefined && user.role === 'admin') {
        const hasRemoveBrandingAccess = await hasFeatureAccess(id, 'remove_branding');
        if (!hasRemoveBrandingAccess) {
          return res.status(403).json({ message: 'Custom branding feature not available for your plan' });
        }
      }

      // Normalize logo URL and set as public object if provided
      if (updateData.logoUrl) {
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();
        try {
          updateData.logoUrl = await objectStorageService.trySetObjectEntityAclPolicy(
            updateData.logoUrl,
            {
              owner: user.id,
              visibility: "public", // Organization logos should be publicly accessible
            }
          );
        } catch (error) {
          console.error('Error setting logo ACL policy:', error);
          // Fallback to just normalizing the path
          updateData.logoUrl = objectStorageService.normalizeObjectEntityPath(updateData.logoUrl);
        }
      }

      const updatedOrganisation = await storage.updateOrganisation(id, updateData);
      res.json(updatedOrganisation);
    } catch (error) {
      console.error('Error updating organisation:', error);
      res.status(500).json({ message: 'Failed to update organisation' });
    }
  });

  // Update organisation subscription
  app.put('/api/organisations/:id/subscription', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { id } = req.params;
      const { planType, planId, customPlan } = req.body;
      
      // Validate input
      if (!planType || (planType !== 'existing' && planType !== 'custom')) {
        return res.status(400).json({ message: 'Invalid plan type' });
      }

      let finalPlanId = planId;

      // If custom plan, create it first
      if (planType === 'custom') {
        if (!customPlan || !customPlan.name || !customPlan.pricePerUser || typeof customPlan.pricePerUser !== 'number') {
          return res.status(400).json({ message: 'Custom plan requires name and pricePerUser' });
        }

        // Create the custom plan
        const planData = {
          name: customPlan.name,
          description: customPlan.description || '',
          billingModel: 'per_seat' as const,
          unitAmount: Math.round(customPlan.pricePerUser * 100), // Convert to cents
          currency: 'USD',
          cadence: 'monthly' as const,
          status: 'active' as const,
          createdBy: user.id,
        };

        const newPlan = await storage.createPlan(planData);
        finalPlanId = newPlan.id;

        // If features are specified, create plan feature mappings
        if (customPlan.featureIds && Array.isArray(customPlan.featureIds)) {
          for (const featureId of customPlan.featureIds) {
            try {
              await storage.createPlanFeatureMapping({
                planId: newPlan.id,
                featureId: featureId,
                enabled: true,
              });
            } catch (error) {
              console.error(`Error mapping feature ${featureId} to plan ${newPlan.id}:`, error);
            }
          }
        }
      } else if (planType === 'existing') {
        if (!planId) {
          return res.status(400).json({ message: 'Plan ID required for existing plan type' });
        }
        
        // Verify the plan exists
        const existingPlan = await storage.getPlan(planId);
        if (!existingPlan) {
          return res.status(404).json({ message: 'Plan not found' });
        }
      }

      // Get current organization data to capture previous plan before update
      const orgBeforeUpdate = await storage.getOrganisation(id);
      const previousPlanId = orgBeforeUpdate?.planId;

      // Update the organisation with the new plan
      const updatedOrganisation = await storage.updateOrganisation(id, { planId: finalPlanId });
      
      // Send plan updated notification to organization admins (SuperAdmin manual update)
      if (finalPlanId !== previousPlanId) {
        try {
          await emailNotificationService.notifyPlanUpdated(
            id,
            previousPlanId ?? undefined,
            finalPlanId,
            user.id
          );
        } catch (error) {
          console.error('[SuperAdmin Manual Update] Failed to send plan update notification:', error);
          // Don't break the plan update flow for notification failures
        }
      }
      
      res.json({
        message: 'Subscription updated successfully',
        organisation: updatedOrganisation,
        planId: finalPlanId,
      });
    } catch (error) {
      console.error('Error updating organisation subscription:', error);
      res.status(500).json({ message: 'Failed to update subscription' });
    }
  });

  // Archive organisation
  app.put('/api/organisations/:id/archive', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const archivedOrganisation = await storage.updateOrganisation(id, { status: 'archived' });
      res.json(archivedOrganisation);
    } catch (error) {
      console.error('Error archiving organisation:', error);
      res.status(500).json({ message: 'Failed to archive organisation' });
    }
  });

  // Permanently delete organisation
  app.delete('/api/organisations/:id/permanent', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      await storage.deleteOrganisation(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error permanently deleting organisation:', error);
      res.status(500).json({ message: 'Failed to permanently delete organisation' });
    }
  });

  app.delete('/api/organisations/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      await storage.deleteOrganisation(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting organisation:', error);
      res.status(500).json({ message: 'Failed to delete organisation' });
    }
  });

  // Email Templates routes
  // Get email templates for an organisation
  app.get('/api/organisations/:id/email-templates', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id: orgId } = req.params;
      
      // Admins can only access their own organization's templates, SuperAdmins can access any
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(orgId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      const templates = await storage.getOrgEmailTemplatesByOrg(orgId);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      res.status(500).json({ message: 'Failed to fetch email templates' });
    }
  });

  // Get a specific email template
  app.get('/api/email-templates/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const template = await storage.getOrgEmailTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: 'Email template not found' });
      }

      // Admins can only access their own organization's templates
      if (user.role === 'admin' && user.organisationId !== template.orgId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(template.orgId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      res.json(template);
    } catch (error) {
      console.error('Error fetching email template:', error);
      res.status(500).json({ message: 'Failed to fetch email template' });
    }
  });

  // Create a new email template
  app.post('/api/organisations/:id/email-templates', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id: orgId } = req.params;
      
      // Admins can only create templates for their own organization
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(orgId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      // Validate the request body
      const templateData = insertOrgEmailTemplateSchema.parse({
        ...req.body,
        orgId: orgId,
      });

      const template = await storage.createOrgEmailTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid template data', errors: error.errors });
      }
      console.error('Error creating email template:', error);
      res.status(500).json({ message: 'Failed to create email template' });
    }
  });

  // Update an email template
  app.put('/api/email-templates/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const existingTemplate = await storage.getOrgEmailTemplate(id);
      
      if (!existingTemplate) {
        return res.status(404).json({ message: 'Email template not found' });
      }

      // Admins can only update their own organization's templates
      if (user.role === 'admin' && user.organisationId !== existingTemplate.orgId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(existingTemplate.orgId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      // Validate the request body
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const updatedTemplate = await storage.updateOrgEmailTemplate(id, updateData);
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating email template:', error);
      res.status(500).json({ message: 'Failed to update email template' });
    }
  });

  // Delete an email template
  app.delete('/api/email-templates/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const existingTemplate = await storage.getOrgEmailTemplate(id);
      
      if (!existingTemplate) {
        return res.status(404).json({ message: 'Email template not found' });
      }

      // Admins can only delete their own organization's templates
      if (user.role === 'admin' && user.organisationId !== existingTemplate.orgId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(existingTemplate.orgId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      await storage.deleteOrgEmailTemplate(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting email template:', error);
      res.status(500).json({ message: 'Failed to delete email template' });
    }
  });

  // Email Template Engine API Routes
  // Preview template with sample data
  app.post('/api/template-engine/preview/:orgId/:templateKey', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { orgId, templateKey } = req.params;
      const { customSampleData } = req.body;

      // Check access permissions
      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }
      
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied - can only preview templates for your organization' });
      }

      const preview = await emailTemplateEngine.previewTemplate(orgId, templateKey, customSampleData);
      
      res.json({
        success: true,
        data: preview,
        message: 'Template preview generated successfully'
      });

    } catch (error: any) {
      console.error('Error generating template preview:', error);
      res.status(500).json({ 
        message: 'Failed to generate template preview',
        error: error.message 
      });
    }
  });

  // Validate template content
  app.post('/api/template-engine/validate', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const { templateContent, allowedVariables } = req.body;

      if (!templateContent || !allowedVariables) {
        return res.status(400).json({ 
          message: 'templateContent and allowedVariables are required' 
        });
      }

      const validation = emailTemplateEngine.validateTemplate(templateContent, allowedVariables);
      
      res.json({
        success: true,
        data: validation,
        message: validation.isValid ? 'Template is valid' : 'Template has validation errors'
      });

    } catch (error: any) {
      console.error('Error validating template:', error);
      res.status(500).json({ 
        message: 'Failed to validate template',
        error: error.message 
      });
    }
  });

  // Test template rendering with custom data
  app.post('/api/template-engine/test-render', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const { templateContent, variables, options } = req.body;

      if (!templateContent || !variables) {
        return res.status(400).json({ 
          message: 'templateContent and variables are required' 
        });
      }

      const rendered = emailTemplateEngine.renderTemplate(templateContent, variables, options);
      
      res.json({
        success: true,
        data: {
          rendered,
          originalTemplate: templateContent,
          variables: variables
        },
        message: 'Template rendered successfully'
      });

    } catch (error: any) {
      console.error('Error rendering template:', error);
      res.status(500).json({ 
        message: 'Failed to render template',
        error: error.message 
      });
    }
  });

  // Get recommended variable schema for template type
  app.get('/api/template-engine/schema/:templateType', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const { templateType } = req.params;
      
      const schema = emailTemplateEngine.getRecommendedVariablesSchema(templateType);
      const sampleData = emailTemplateEngine.generateSampleData(templateType);
      
      res.json({
        success: true,
        data: {
          templateType,
          variablesSchema: schema,
          sampleData
        },
        message: 'Variable schema retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error retrieving variable schema:', error);
      res.status(500).json({ 
        message: 'Failed to retrieve variable schema',
        error: error.message 
      });
    }
  });

  // Parse variables from template content
  app.post('/api/template-engine/parse-variables', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const { templateContent } = req.body;

      if (!templateContent) {
        return res.status(400).json({ 
          message: 'templateContent is required' 
        });
      }

      const variables = emailTemplateEngine.parseVariables(templateContent);
      
      res.json({
        success: true,
        data: {
          variables,
          count: variables.length,
          uniqueVariables: Array.from(new Set(variables.map(v => v.path)))
        },
        message: 'Variables parsed successfully'
      });

    } catch (error: any) {
      console.error('Error parsing variables:', error);
      res.status(500).json({ 
        message: 'Failed to parse variables',
        error: error.message 
      });
    }
  });

  // Get template engine statistics and health check
  app.get('/api/template-engine/health', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      // Test basic functionality
      const testContent = 'Hello {{user.name}}, welcome to {{org.name}}!';
      const testVariables = { user: { name: 'John' }, org: { name: 'Acme Corp' } };
      const testSchema = { user: { name: 'string' }, org: { name: 'string' } };

      const parsed = emailTemplateEngine.parseVariables(testContent);
      const validation = emailTemplateEngine.validateTemplate(testContent, testSchema);
      const rendered = emailTemplateEngine.renderTemplate(testContent, testVariables);

      res.json({
        success: true,
        data: {
          status: 'healthy',
          features: {
            variableParsing: parsed.length > 0,
            templateValidation: validation.isValid,
            templateRendering: rendered.includes('Hello John')
          },
          test: {
            parsed,
            validation,
            rendered
          }
        },
        message: 'Template engine is healthy and operational'
      });

    } catch (error: any) {
      console.error('Template engine health check failed:', error);
      res.status(500).json({ 
        message: 'Template engine health check failed',
        error: error.message,
        status: 'unhealthy'
      });
    }
  });

  // =============================================================================
  // COMPREHENSIVE EMAIL TEMPLATE API ROUTES
  // =============================================================================
  
  // 1. DEFAULT TEMPLATE MANAGEMENT (SuperAdmin only)
  
  // Get default template
  app.get('/api/email-templates/defaults/:key', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      const { key } = req.params;
      
      const defaultTemplate = await emailTemplateResolver.getDefaultTemplate(key);
      
      if (!defaultTemplate) {
        return res.status(404).json({ message: 'Default template not found' });
      }

      res.json({
        success: true,
        data: defaultTemplate,
        message: 'Default template retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error fetching default template:', error);
      res.status(500).json({ 
        message: 'Failed to fetch default template',
        error: error.message 
      });
    }
  });

  // Update default template
  app.put('/api/email-templates/defaults/:key', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      const { key } = req.params;
      const updateData = req.body;

      // Validate required fields
      if (!updateData.subjectDefault && !updateData.htmlDefault && !updateData.textDefault) {
        return res.status(400).json({ 
          message: 'At least one of subjectDefault, htmlDefault, or textDefault must be provided' 
        });
      }

      // Add audit fields
      const updatedTemplate = await emailTemplateResolver.updateDefaultTemplate(key, {
        ...updateData,
        updatedBy: user.id,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        data: updatedTemplate,
        message: 'Default template updated successfully'
      });

    } catch (error: any) {
      console.error('Error updating default template:', error);
      res.status(500).json({ 
        message: 'Failed to update default template',
        error: error.message 
      });
    }
  });

  // 2. ORGANIZATION TEMPLATE OVERRIDES
  
  // Get organization override
  app.get('/api/email-templates/overrides/:orgId/:key', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { orgId, key } = req.params;

      // Authorization: Admin can only access their own org, SuperAdmin can access any
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied - can only access your own organization' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const override = await emailTemplateResolver.getOverride(orgId, key);
      
      if (!override) {
        return res.status(404).json({ message: 'Template override not found' });
      }

      res.json({
        success: true,
        data: override,
        message: 'Template override retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error fetching template override:', error);
      res.status(500).json({ 
        message: 'Failed to fetch template override',
        error: error.message 
      });
    }
  });

  // Create/update organization override
  app.put('/api/email-templates/overrides/:orgId/:key', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { orgId, key } = req.params;
      const overrideData = req.body;

      // Authorization: Admin can only modify their own org, SuperAdmin can modify any
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied - can only modify your own organization' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(orgId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      // Validate at least one override field is provided
      if (!overrideData.subjectOverride && !overrideData.htmlOverride && !overrideData.textOverride) {
        return res.status(400).json({ 
          message: 'At least one of subjectOverride, htmlOverride, or textOverride must be provided' 
        });
      }

      // Add audit fields and ensure active
      const override = await emailTemplateResolver.setOverride(orgId, key, {
        ...overrideData,
        isActive: true,
        updatedBy: user.id,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        data: override,
        message: 'Template override saved successfully'
      });

    } catch (error: any) {
      console.error('Error saving template override:', error);
      res.status(500).json({ 
        message: 'Failed to save template override',
        error: error.message 
      });
    }
  });

  // Disable organization override
  app.delete('/api/email-templates/overrides/:orgId/:key', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { orgId, key } = req.params;

      // Authorization: Admin can only modify their own org, SuperAdmin can modify any
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied - can only modify your own organization' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      await emailTemplateResolver.disableOverride(orgId, key);

      res.json({
        success: true,
        message: 'Template override disabled successfully'
      });

    } catch (error: any) {
      console.error('Error disabling template override:', error);
      res.status(500).json({ 
        message: 'Failed to disable template override',
        error: error.message 
      });
    }
  });

  // 3. TEMPLATE USAGE & ANALYTICS (SuperAdmin only)
  
  // Get template usage analytics
  app.get('/api/email-templates/overrides/usage/:key', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      const { key } = req.params;

      // Get all organizations that have active overrides for this template
      const allOrgs = await storage.getAllOrganisations();
      const usageData = [];

      for (const org of allOrgs) {
        const override = await emailTemplateResolver.getOverride(org.id, key);
        if (override) {
          usageData.push({
            orgId: org.id,
            orgName: org.name,
            overrideId: override.id,
            isActive: override.isActive,
            hasSubjectOverride: !!override.subjectOverride,
            hasHtmlOverride: !!override.htmlOverride,
            hasTextOverride: !!override.textOverride,
            updatedAt: override.updatedAt
          });
        }
      }

      res.json({
        success: true,
        data: {
          templateKey: key,
          totalOrganizations: allOrgs.length,
          organizationsWithOverrides: usageData.length,
          activeOverrides: usageData.filter(u => u.isActive).length,
          usage: usageData
        },
        message: 'Template usage analytics retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error fetching template usage:', error);
      res.status(500).json({ 
        message: 'Failed to fetch template usage analytics',
        error: error.message 
      });
    }
  });

  // 4. TEMPLATE OPERATIONS
  
  // Preview template with sample data
  app.post('/api/email-templates/preview', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const { orgId, key, sampleData } = req.body;

      if (!key) {
        return res.status(400).json({ message: 'Template key is required' });
      }

      // Authorization check if orgId is provided
      if (orgId && user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied - can only preview templates for your organization' });
      }

      // Get effective template (with fallback to defaults)
      const effectiveOrgId = orgId || user.organisationId;
      const resolvedTemplate = await emailTemplateResolver.getEffectiveTemplate(effectiveOrgId, key);

      // Generate sample data if not provided
      const templateData = sampleData || emailTemplateEngine.generateSampleData(key);

      // Render the template
      const renderedSubject = emailTemplateEngine.renderTemplate(resolvedTemplate.subject, templateData);
      const renderedHtml = emailTemplateEngine.renderTemplate(resolvedTemplate.html, templateData);
      const renderedText = resolvedTemplate.text ? 
        emailTemplateEngine.renderTemplate(resolvedTemplate.text, templateData) : null;

      res.json({
        success: true,
        data: {
          templateKey: key,
          orgId: effectiveOrgId,
          source: resolvedTemplate.source,
          rendered: {
            subject: renderedSubject,
            html: renderedHtml,
            text: renderedText
          },
          sampleData: templateData,
          raw: {
            subject: resolvedTemplate.subject,
            html: resolvedTemplate.html,
            text: resolvedTemplate.text
          }
        },
        message: 'Template preview generated successfully'
      });

    } catch (error: any) {
      console.error('Error generating template preview:', error);
      res.status(500).json({ 
        message: 'Failed to generate template preview',
        error: error.message 
      });
    }
  });

  // Rate limiting for send-test endpoint
  const sendTestEmailLimiter = new Map<string, { count: number; resetTime: number }>();
  const SEND_TEST_RATE_LIMIT = 5; // 5 emails per minute per user
  const SEND_TEST_WINDOW = 60 * 1000; // 1 minute

  // Send test email
  app.post('/api/email-templates/send-test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      // Rate limiting
      const now = Date.now();
      const userKey = user.id;
      const userLimit = sendTestEmailLimiter.get(userKey) || { count: 0, resetTime: now + SEND_TEST_WINDOW };
      
      if (now > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + SEND_TEST_WINDOW;
      }
      
      if (userLimit.count >= SEND_TEST_RATE_LIMIT) {
        return res.status(429).json({ 
          message: `Rate limit exceeded. Maximum ${SEND_TEST_RATE_LIMIT} test emails per minute.`,
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        });
      }

      const { orgId, key, to, sampleData } = req.body;

      if (!key || !to || !Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ 
          message: 'Template key and recipient email addresses (to) are required' 
        });
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of to) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({ message: `Invalid email address: ${email}` });
        }
      }

      // Authorization check and organization determination
      let effectiveOrgId;
      
      // Handle SuperAdmin users who don't have an organizationId
      if (user.role === 'superadmin') {
        // SuperAdmin can test any organization's templates or use system-level settings
        effectiveOrgId = orgId || null; // Use provided orgId or null for system-level settings
        console.log(`📧 SuperAdmin test email: orgId=${orgId}, effectiveOrgId=${effectiveOrgId}`);
      } else {
        // For Admin users, stick to their organization
        effectiveOrgId = orgId || user.organisationId;
        if (user.role === 'admin' && user.organisationId !== effectiveOrgId) {
          return res.status(403).json({ message: 'Access denied - can only send tests for your organization' });
        }
      }

      // Get effective email settings
      const emailConfig = await getEffectiveEmailSettings(storage, effectiveOrgId);
      if (!emailConfig.valid) {
        return res.status(400).json({ 
          message: 'Email configuration invalid', 
          errors: emailConfig.errors 
        });
      }

      // Get and render template
      const resolvedTemplate = await emailTemplateResolver.getEffectiveTemplate(effectiveOrgId, key);
      const templateData = sampleData || emailTemplateEngine.generateSampleData(key);

      const renderedSubject = `[TEST] ${emailTemplateEngine.renderTemplate(resolvedTemplate.subject, templateData)}`;
      const renderedHtml = emailTemplateEngine.renderTemplate(resolvedTemplate.html, templateData);
      const renderedText = resolvedTemplate.text ? 
        emailTemplateEngine.renderTemplate(resolvedTemplate.text, templateData) : null;

      // Send test emails
      const results = [];
      for (const email of to) {
        try {
          await mailerService.send({
            orgId: effectiveOrgId,
            to: email,
            subject: renderedSubject,
            html: renderedHtml,
            text: renderedText || undefined
          });

          results.push({ email, status: 'sent' });
        } catch (error: any) {
          results.push({ email, status: 'failed', error: error.message });
        }
      }

      // Update rate limit
      userLimit.count++;
      sendTestEmailLimiter.set(userKey, userLimit);

      res.json({
        success: true,
        data: {
          templateKey: key,
          orgId: effectiveOrgId,
          results,
          totalSent: results.filter(r => r.status === 'sent').length,
          totalFailed: results.filter(r => r.status === 'failed').length
        },
        message: 'Test emails processed'
      });

    } catch (error: any) {
      console.error('Error sending test email:', error);
      res.status(500).json({ 
        message: 'Failed to send test email',
        error: error.message 
      });
    }
  });

  // 5. TEMPLATE LISTING
  
  // List all default templates (SuperAdmin and Admin can view)
  app.get('/api/email-templates/defaults', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - Admin or SuperAdmin required' });
      }

      console.log('📧 Fetching email templates for defaults endpoint...');

      // Get all platform templates from storage
      const platformTemplates = await storage.getAllEmailTemplates();
      console.log(`📧 Found ${platformTemplates.length} platform templates`);

      // Build the response in the format the frontend expects
      const formattedTemplates = [];

      for (const template of platformTemplates) {
        // Count overrides across all organizations (for SuperAdmin view)
        let overrideCount = 0;
        try {
          const allOrgs = await storage.getAllOrganisations();
          for (const org of allOrgs) {
            const orgOverrides = await storage.getOrgEmailTemplatesByOrg(org.id);
            const hasOverride = orgOverrides.some(override => 
              override.templateKey === template.key && override.isActive
            );
            if (hasOverride) {
              overrideCount++;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to count overrides for template ${template.key}:`, error);
          overrideCount = 0;
        }

        // Build template object matching frontend interface
        const formattedTemplate = {
          id: template.id,
          templateKey: template.key,
          category: template.category,
          name: template.name,
          description: '', // Platform templates don't have descriptions stored, frontend has hardcoded ones
          subject: template.subject || '',
          htmlContent: template.html || '',
          textContent: template.text || '',
          variables: [], // Frontend has hardcoded variable lists
          isConfigured: !!template.subject && !!template.html, // Consider configured if has subject and HTML
          overrideCount: overrideCount
        };

        formattedTemplates.push(formattedTemplate);
      }

      console.log(`📧 Returning ${formattedTemplates.length} formatted templates`);

      // Return array directly (frontend expects EmailTemplate[])
      res.json(formattedTemplates);

    } catch (error: any) {
      console.error('❌ Error fetching default templates:', error);
      res.status(500).json({ 
        message: 'Failed to fetch default templates',
        error: error.message 
      });
    }
  });

  // List all overrides for organization
  app.get('/api/email-templates/overrides/:orgId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { orgId } = req.params;

      // Authorization: Admin can only access their own org, SuperAdmin can access any
      if (user.role === 'admin' && user.organisationId !== orgId) {
        return res.status(403).json({ message: 'Access denied - can only access your own organization' });
      }

      if (user.role === 'user') {
        return res.status(403).json({ message: 'Access denied - admin or superadmin required' });
      }

      const overrides = await storage.getOrgEmailTemplatesByOrg(orgId);

      res.json({
        success: true,
        data: overrides,
        count: overrides.length,
        message: 'Template overrides retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error fetching template overrides:', error);
      res.status(500).json({ 
        message: 'Failed to fetch template overrides',
        error: error.message 
      });
    }
  });

  // SUPERADMIN EMAIL TEMPLATE SEEDING ENDPOINTS

  // Seed platform email templates (SuperAdmin only)
  app.post('/api/superadmin/email/templates/seed', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      console.log('🌱 SuperAdmin email template seeding requested by:', user.email);

      const { overwriteExisting = false, specificKeys } = req.body;

      // Run the seeding process
      const results = await emailTemplateSeedService.seedPlatformTemplates({
        overwriteExisting,
        specificKeys
      });

      if (results.success) {
        console.log(`✅ Email template seeding completed: ${results.seeded} seeded, ${results.skipped} skipped, ${results.failed} failed`);
        
        res.json({
          success: true,
          data: {
            seeded: results.seeded,
            skipped: results.skipped,
            failed: results.failed,
            details: results.details,
            errors: results.errors
          },
          message: `Template seeding completed successfully. ${results.seeded} templates processed.`
        });
      } else {
        console.error('❌ Email template seeding failed:', results.errors);
        
        res.status(500).json({
          success: false,
          data: {
            seeded: results.seeded,
            skipped: results.skipped,
            failed: results.failed,
            details: results.details,
            errors: results.errors
          },
          message: 'Template seeding completed with errors'
        });
      }

    } catch (error: any) {
      console.error('❌ Critical error during email template seeding:', error);
      res.status(500).json({ 
        success: false,
        message: 'Critical error during template seeding',
        error: error.message 
      });
    }
  });

  // Check missing email templates (SuperAdmin only)
  app.get('/api/superadmin/email/templates/status', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      // Get current template status
      const missingKeys = await emailTemplateSeedService.getMissingTemplateKeys();
      const validationResults = await emailTemplateSeedService.validateSeededTemplates();
      const allTemplates = await storage.getAllEmailTemplates();

      res.json({
        success: true,
        data: {
          totalTemplates: allTemplates.length,
          missingTemplates: missingKeys.length,
          missingKeys,
          validation: {
            isValid: validationResults.valid,
            errors: validationResults.validationErrors
          },
          templates: allTemplates.map(t => ({
            key: t.key,
            name: t.name,
            category: t.category,
            isActive: t.isActive,
            version: t.version,
            updatedAt: t.updatedAt
          }))
        },
        message: 'Email template status retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error checking email template status:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to check email template status',
        error: error.message 
      });
    }
  });

  // Auto-heal missing templates (SuperAdmin only)
  app.post('/api/superadmin/email/templates/auto-heal', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - SuperAdmin only' });
      }

      console.log('🔧 Auto-heal email templates requested by:', user.email);

      // Run auto-healing (only seeds missing templates)
      const success = await emailTemplateSeedService.autoSeedMissingTemplates();

      if (success) {
        const missingKeys = await emailTemplateSeedService.getMissingTemplateKeys();
        
        res.json({
          success: true,
          data: {
            healingCompleted: true,
            remainingMissing: missingKeys.length,
            missingKeys
          },
          message: 'Auto-healing completed successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Auto-healing failed - check server logs for details'
        });
      }

    } catch (error: any) {
      console.error('Error during auto-healing:', error);
      res.status(500).json({ 
        success: false,
        message: 'Auto-healing failed',
        error: error.message 
      });
    }
  });

  // ========================================================================
  // RESILIENT SUPERADMIN EMAIL TEMPLATE API ROUTES  
  // ========================================================================

  /**
   * Idempotent table creation function for EmailTemplate table
   * Creates the table with proper schema and indexes if it doesn't exist
   * Safe to run multiple times - will not affect existing data
   */
  async function createEmailTemplateTableIfNotExists() {
    try {
      console.log('📊 Creating EmailTemplate table if not exists...');
      
      // Create the main table with all columns and constraints
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR NOT NULL UNIQUE,
          name VARCHAR NOT NULL,
          subject TEXT NOT NULL,
          html TEXT NOT NULL,
          mjml TEXT NOT NULL,
          text TEXT,
          variables_schema JSONB,
          category VARCHAR NOT NULL DEFAULT 'learner',
          version INTEGER NOT NULL DEFAULT 1,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes if they don't exist
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_email_template_key ON email_templates(key)
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_email_template_category ON email_templates(category)
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_email_template_active ON email_templates(is_active)
      `);

      console.log('✅ EmailTemplate table and indexes created/verified successfully');
      return { success: true, created: true };
      
    } catch (error: any) {
      console.error('❌ Failed to create EmailTemplate table:', error);
      return { 
        success: false, 
        created: false, 
        error: error.message || 'Unknown table creation error' 
      };
    }
  }

  /**
   * Database health check function for EmailTemplate table
   * Returns never-failing diagnostic information
   */
  async function checkEmailTemplateDbHealth() {
    const requiredKeys = [
      'welcome', 'course_assigned', 'course_reminder', 'course_overdue',
      'training_expiring', 'training_expired', 'course_completed', 
      'course_failed', 'password_reset', 'weekly_digest', 'policy_ack_reminder'
    ];
    
    try {
      // Check if table exists and get row count
      const allTemplates = await storage.getAllEmailTemplates();
      const existingKeys = allTemplates.map(t => t.key);
      const missingKeys = requiredKeys.filter(key => !existingKeys.includes(key));
      
      return {
        tableExists: true,
        rowCount: allTemplates.length,
        missingKeys,
        existingKeys,
        isHealthy: missingKeys.length === 0
      };
    } catch (error: any) {
      console.log('💡 Table access failed, attempting repair...');
      
      // Attempt to create table if it doesn't exist
      const createResult = await createEmailTemplateTableIfNotExists();
      
      if (createResult.success) {
        // Try the health check again after table creation
        try {
          const allTemplates = await storage.getAllEmailTemplates();
          const existingKeys = allTemplates.map(t => t.key);
          const missingKeys = requiredKeys.filter(key => !existingKeys.includes(key));
          
          return {
            tableExists: true,
            rowCount: allTemplates.length,
            missingKeys,
            existingKeys,
            isHealthy: missingKeys.length === 0,
            repairAttempted: true,
            repairSuccessful: true
          };
        } catch (retryError: any) {
          return {
            tableExists: false,
            rowCount: 0,
            missingKeys: requiredKeys,
            existingKeys: [],
            isHealthy: false,
            error: retryError.message || 'Table created but still inaccessible',
            repairAttempted: true,
            repairSuccessful: false
          };
        }
      } else {
        return {
          tableExists: false,
          rowCount: 0,
          missingKeys: requiredKeys,
          existingKeys: [],
          isHealthy: false,
          error: error.message || 'Unknown database error',
          repairAttempted: true,
          repairSuccessful: false,
          repairError: createResult.error
        };
      }
    }
  }

  /**
   * 1. GET /api/superadmin/email/templates
   * List platform templates with resilient error handling
   */
  app.get('/api/superadmin/email/templates', requireAuth, async (req: any, res) => {
    console.log('email.tpl.list.start');
    
    try {
      // SuperAdmin role check
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        console.log('email.tpl.list.fail stage=auth err="Access denied"');
        return res.status(403).json({ 
          ok: false, 
          stage: 'auth', 
          error: { short: 'Access denied - SuperAdmin required', raw: 'User role check failed' },
          hasRepair: false 
        });
      }

      console.log('email.tpl.list.query');
      
      // Get database health first  
      const health = await checkEmailTemplateDbHealth();
      
      if (!health.tableExists) {
        console.log('email.tpl.list.fail stage=query err="Table missing"');
        return res.json({
          ok: false,
          stage: 'query',
          error: { 
            short: 'EmailTemplate table does not exist or is inaccessible', 
            raw: health.error || 'Database table missing' 
          },
          hasRepair: true,
          health
        });
      }

      if (health.rowCount === 0) {
        console.log('email.tpl.list.fail stage=query err="No templates found"');
        return res.json({
          ok: false,
          stage: 'query', 
          error: { 
            short: 'No email templates found in database', 
            raw: 'Template table is empty - seed required' 
          },
          hasRepair: true,
          health
        });
      }

      // Get all platform templates
      const allTemplates = await storage.getAllEmailTemplates();
      
      console.log('email.tpl.list.serialize');
      
      // Build safe response data
      const safeTemplates = allTemplates.map(template => {
        try {
          // Limit HTML size to 200KB for response
          const htmlSize = (template.html || '').length;
          const html = htmlSize > 200000 
            ? (template.html || '').substring(0, 200000) + '...[truncated]'
            : template.html;

          return {
            key: template.key || 'unknown',
            name: template.name || 'Untitled',
            category: template.category || 'uncategorized',
            subject: template.subject || '',
            html: html || '',
            text: template.text || null,
            mjml: template.mjml || null,
            isActive: template.isActive !== false,
            version: template.version || 1,
            variablesSchema: template.variablesSchema || null,
            createdAt: template.createdAt || null,
            updatedAt: template.updatedAt || null,
            htmlSize
          };
        } catch (serializeError: any) {
          console.warn('email.tpl.list.serialize_item_fail', template.key, serializeError.message);
          return {
            key: template.key || 'unknown',
            name: 'Serialization Error',
            category: 'error',
            subject: 'Template serialization failed',
            html: '',
            text: null,
            mjml: null,
            isActive: false,
            version: 1,
            variablesSchema: null,
            createdAt: null,
            updatedAt: null,
            htmlSize: 0,
            error: serializeError.message
          };
        }
      });
      
      console.log(`email.tpl.list.success count=${safeTemplates.length} missing=${health.missingKeys.length}`);
      
      // Success response
      return res.json({
        ok: true,
        data: safeTemplates,
        meta: {
          totalCount: safeTemplates.length,
          activeCount: safeTemplates.filter(t => t.isActive).length,
          categories: Array.from(new Set(safeTemplates.map(t => t.category))),
          health: {
            isHealthy: health.isHealthy,
            missingKeys: health.missingKeys,
            missingCount: health.missingKeys.length
          }
        }
      });

    } catch (error: any) {
      console.error('email.tpl.list.fail stage=unknown err="' + (error.message || 'Unknown error').substring(0, 50) + '"');
      
      // Never return 500 - always return structured error
      return res.json({
        ok: false,
        stage: 'unknown',
        error: { 
          short: 'Unexpected error retrieving email templates', 
          raw: (error.message || 'Unknown error').substring(0, 200) 
        },
        hasRepair: true
      });
    }
  });

  /**
   * 2. GET /api/superadmin/email/templates/:key
   * Get single template with error handling
   */
  app.get('/api/superadmin/email/templates/:key', requireAuth, async (req: any, res) => {
    const { key } = req.params;
    console.log(`email.tpl.get.start key=${key}`);
    
    try {
      // SuperAdmin role check
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        console.log(`email.tpl.get.fail key=${key} stage=auth err="Access denied"`);
        return res.status(403).json({ 
          ok: false, 
          stage: 'auth', 
          error: { short: 'Access denied - SuperAdmin required', raw: 'User role check failed' },
          hasRepair: false 
        });
      }

      if (!key || typeof key !== 'string' || key.length === 0) {
        console.log(`email.tpl.get.fail key=${key} stage=validation err="Invalid key"`);
        return res.json({
          ok: false,
          stage: 'validation',
          error: { short: 'Invalid template key provided', raw: `Key: "${key}"` },
          hasRepair: false
        });
      }

      console.log(`email.tpl.get.query key=${key}`);
      
      // Get database health
      const health = await checkEmailTemplateDbHealth();
      
      if (!health.tableExists) {
        console.log(`email.tpl.get.fail key=${key} stage=query err="Table missing"`);
        return res.json({
          ok: false,
          stage: 'query',
          error: { 
            short: 'EmailTemplate table does not exist or is inaccessible', 
            raw: health.error || 'Database table missing' 
          },
          hasRepair: true
        });
      }

      // Get specific template
      const template = await storage.getEmailTemplateByKey(key);
      
      if (!template) {
        console.log(`email.tpl.get.fail key=${key} stage=query err="Template not found"`);
        return res.json({
          ok: false,
          stage: 'query',
          error: { 
            short: `Template '${key}' not found`, 
            raw: `No template exists with key: ${key}` 
          },
          hasRepair: health.missingKeys.includes(key)
        });
      }

      console.log(`email.tpl.get.serialize key=${key}`);
      
      // Build safe response - limit HTML size
      const htmlSize = (template.html || '').length;
      const html = htmlSize > 200000 
        ? (template.html || '').substring(0, 200000) + '...[truncated]'
        : template.html;

      const safeTemplate = {
        key: template.key,
        name: template.name || 'Untitled',
        category: template.category || 'uncategorized',
        subject: template.subject || '',
        html: html || '',
        text: template.text || null,
        mjml: template.mjml || null,
        isActive: template.isActive !== false,
        version: template.version || 1,
        variablesSchema: template.variablesSchema || null,
        createdAt: template.createdAt || null,
        updatedAt: template.updatedAt || null,
        htmlSize
      };
      
      console.log(`email.tpl.get.success key=${key}`);
      
      return res.json({
        ok: true,
        data: safeTemplate
      });

    } catch (error: any) {
      console.error(`email.tpl.get.fail key=${key} stage=unknown err="` + (error.message || 'Unknown error').substring(0, 50) + '"');
      
      return res.json({
        ok: false,
        stage: 'unknown',
        error: { 
          short: 'Unexpected error retrieving template', 
          raw: (error.message || 'Unknown error').substring(0, 200) 
        },
        hasRepair: true
      });
    }
  });

  /**
   * 3. POST /api/superadmin/email/templates/repair  
   * Seed/repair missing defaults
   */
  app.post('/api/superadmin/email/templates/repair', requireAuth, async (req: any, res) => {
    console.log('email.tpl.repair.start');
    
    try {
      // SuperAdmin role check
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        console.log('email.tpl.repair.fail stage=auth err="Access denied"');
        return res.status(403).json({ 
          ok: false, 
          stage: 'auth', 
          error: { short: 'Access denied - SuperAdmin required', raw: 'User role check failed' },
          hasRepair: false 
        });
      }

      console.log('email.tpl.repair.health_check');
      
      // Get pre-repair health status
      const preHealth = await checkEmailTemplateDbHealth();
      const { overwriteExisting = false, specificKeys } = req.body;
      
      console.log(`email.tpl.repair.seed overwrite=${overwriteExisting}`);
      
      // Run the repair/seeding process using appropriate method
      const results = overwriteExisting 
        ? await emailTemplateSeedService.seedPlatformTemplates({
            overwriteExisting: true,
            specificKeys
          })
        : await emailTemplateSeedService.seedDefaultsIfMissing(specificKeys);

      // Get post-repair health status
      const postHealth = await checkEmailTemplateDbHealth();
      
      // Handle different result structures based on method used
      const isNewFormat = 'inserted' in results;
      const success = isNewFormat ? results.ok : results.success;
      const seeded = isNewFormat ? results.inserted?.length : results.seeded;
      const skipped = isNewFormat ? results.skipped?.length : results.skipped;
      const failed = isNewFormat ? (results.errors?.length || 0) : results.failed;
      const errorsList = isNewFormat ? (results.errors || []) : (results.errors || []);
      
      if (success) {
        const insertedKeys = isNewFormat ? results.inserted : [];
        const skippedKeys = isNewFormat ? results.skipped : [];
        
        console.log(`email.tpl.repair.success inserted=${seeded} skipped=${skipped} failed=${failed} inserted="${insertedKeys.join(',')}" missing="${insertedKeys.join(',')}"`);
        
        return res.json({
          ok: true,
          data: {
            repairCompleted: true,
            seeded: seeded || 0,
            skipped: skipped || 0,
            failed: failed || 0,
            inserted: insertedKeys,
            details: isNewFormat ? [] : (results.details || []),
            errors: errorsList
          },
          meta: {
            preRepair: preHealth,
            postRepair: postHealth,
            improvement: {
              missingBefore: preHealth.missingKeys.length,
              missingAfter: postHealth.missingKeys.length,
              fixed: preHealth.missingKeys.length - postHealth.missingKeys.length
            }
          }
        });
      } else {
        console.log(`email.tpl.repair.partial seeded=${seeded} failed=${failed}`);
        
        return res.json({
          ok: false,
          stage: 'seed',
          error: { 
            short: `Repair completed with ${failed} failures`, 
            raw: errorsList.join('; ').substring(0, 200) 
          },
          hasRepair: true,
          data: {
            partialSuccess: true,
            seeded: seeded || 0,
            skipped: skipped || 0, 
            failed: failed || 0,
            details: isNewFormat ? [] : (results.details || []),
            errors: errorsList
          },
          meta: {
            preRepair: preHealth,
            postRepair: postHealth
          }
        });
      }

    } catch (error: any) {
      console.error('email.tpl.repair.fail stage=unknown err="' + (error.message || 'Unknown error').substring(0, 50) + '"');
      
      return res.json({
        ok: false,
        stage: 'unknown',
        error: { 
          short: 'Unexpected error during template repair', 
          raw: (error.message || 'Unknown error').substring(0, 200) 
        },
        hasRepair: true
      });
    }
  });

  /**
   * 4. POST /api/superadmin/email/templates/preview
   * Render template with variables
   */
  app.post('/api/superadmin/email/templates/preview', requireAuth, async (req: any, res) => {
    console.log('email.tpl.preview.start');
    
    try {
      // SuperAdmin role check
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        console.log('email.tpl.preview.fail stage=auth err="Access denied"');
        return res.status(403).json({ 
          ok: false, 
          stage: 'auth', 
          error: { short: 'Access denied - SuperAdmin required', raw: 'User role check failed' },
          hasRepair: false 
        });
      }

      const { templateKey, orgId, variables } = req.body;

      if (!templateKey || typeof templateKey !== 'string') {
        console.log('email.tpl.preview.fail stage=validation err="Missing templateKey"');
        return res.json({
          ok: false,
          stage: 'validation',
          error: { short: 'templateKey is required', raw: 'Missing or invalid templateKey in request body' },
          hasRepair: false
        });
      }

      console.log(`email.tpl.preview.render key=${templateKey} orgId=${orgId || 'none'}`);
      
      // Use EmailTemplateService to render with variables
      const orgIdToUse = orgId || 'platform-preview';
      const variablesToUse = variables || {};
      
      // Add some default preview variables if none provided
      const defaultVariables = {
        org: { 
          name: 'Preview Organization', 
          display_name: 'Preview Organization',
          subdomain: 'preview'
        },
        user: { 
          name: 'Preview User', 
          email: 'preview@example.com', 
          full_name: 'Preview User' 
        },
        admin: { 
          name: 'Preview Admin', 
          full_name: 'Preview Admin' 
        },
        course: { 
          title: 'Preview Course', 
          description: 'This is a preview course' 
        },
        ...variablesToUse
      };

      const renderedTemplate = await emailTemplateService.render(
        templateKey, 
        orgIdToUse, 
        defaultVariables
      );

      // Limit HTML size for response
      const htmlSize = (renderedTemplate.html || '').length;
      const html = htmlSize > 200000 
        ? (renderedTemplate.html || '').substring(0, 200000) + '...[truncated]'
        : renderedTemplate.html;

      console.log(`email.tpl.preview.success key=${templateKey} htmlSize=${htmlSize}`);
      
      return res.json({
        ok: true,
        preview: {
          subject: renderedTemplate.subject || '',
          html: html || '',
          text: renderedTemplate.text || null
        },
        data: {
          templateKey,
          variables: defaultVariables,
          htmlSize,
          truncated: htmlSize > 200000
        }
      });

    } catch (error: any) {
      console.error('email.tpl.preview.fail stage=render err="' + (error.message || 'Unknown error').substring(0, 50) + '"');
      
      // Check if it's a template not found error
      if (error.name === 'TemplateNotFoundError' || error.message?.includes('not found')) {
        return res.json({
          ok: false,
          stage: 'query',
          error: { 
            short: `Template '${req.body.templateKey}' not found`, 
            raw: (error.message || 'Template not found').substring(0, 200) 
          },
          hasRepair: true
        });
      }

      // Check if it's a variable validation error
      if (error.name === 'VariableValidationError') {
        return res.json({
          ok: false,
          stage: 'render',
          error: { 
            short: 'Template variable validation failed', 
            raw: (error.message || 'Variable validation error').substring(0, 200) 
          },
          hasRepair: false
        });
      }
      
      return res.json({
        ok: false,
        stage: 'render',
        error: { 
          short: 'Template rendering failed', 
          raw: (error.message || 'Unknown rendering error').substring(0, 200) 
        },
        hasRepair: false
      });
    }
  });

  /**
   * 5. PUT /api/superadmin/email/templates/:key
   * Update an email template
   */
  app.put('/api/superadmin/email/templates/:key', requireAuth, async (req: any, res) => {
    console.log('email.tpl.update.start');
    
    try {
      // SuperAdmin role check
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        console.log('email.tpl.update.fail stage=auth err="Access denied"');
        return res.status(403).json({ 
          ok: false, 
          stage: 'auth', 
          error: { short: 'Access denied - SuperAdmin required', raw: 'User role check failed' },
          hasRepair: false 
        });
      }

      const { key } = req.params;
      const updateData = req.body;

      if (!key || typeof key !== 'string') {
        console.log('email.tpl.update.fail stage=validation err="Missing template key"');
        return res.json({
          ok: false,
          stage: 'validation',
          error: { short: 'Template key is required', raw: 'Missing or invalid key in URL params' },
          hasRepair: false
        });
      }

      console.log(`email.tpl.update.validate key=${key}`);

      // Validate the update data using the insert schema (subset for updates)
      const updateSchema = insertEmailTemplateSchema.partial().omit({ key: true });
      const validation = updateSchema.safeParse(updateData);
      
      if (!validation.success) {
        console.log('email.tpl.update.fail stage=validation err="Invalid update data"');
        return res.json({
          ok: false,
          stage: 'validation',
          error: { 
            short: 'Invalid template data provided', 
            raw: JSON.stringify(validation.error.errors).substring(0, 200) 
          },
          hasRepair: false
        });
      }

      const validatedData = validation.data;

      console.log(`email.tpl.update.query key=${key}`);

      // Check if template exists
      const existingTemplate = await storage.getEmailTemplateByKey(key);
      if (!existingTemplate) {
        console.log('email.tpl.update.fail stage=query err="Template not found"');
        return res.json({
          ok: false,
          stage: 'query',
          error: { 
            short: `Template '${key}' not found`, 
            raw: `No template found with key: ${key}` 
          },
          hasRepair: true
        });
      }

      // Prepare update data with version increment and timestamp
      const updatePayload = {
        ...validatedData,
        version: existingTemplate.version + 1,
        updatedAt: new Date()
      };

      console.log(`email.tpl.update.save key=${key} version=${updatePayload.version}`);

      // Update the template
      const updatedTemplate = await storage.updateEmailTemplate(key, updatePayload);

      if (!updatedTemplate) {
        console.log('email.tpl.update.fail stage=save err="Update failed"');
        return res.json({
          ok: false,
          stage: 'save',
          error: { 
            short: 'Failed to update template', 
            raw: 'Database update operation returned null' 
          },
          hasRepair: false
        });
      }

      console.log(`email.tpl.update.success key=${key} version=${updatedTemplate.version}`);

      return res.json({
        ok: true,
        data: {
          template: {
            id: updatedTemplate.id,
            key: updatedTemplate.key,
            name: updatedTemplate.name,
            subject: updatedTemplate.subject,
            html: updatedTemplate.html,
            mjml: updatedTemplate.mjml,
            text: updatedTemplate.text,
            variablesSchema: updatedTemplate.variablesSchema,
            category: updatedTemplate.category,
            version: updatedTemplate.version,
            isActive: updatedTemplate.isActive,
            createdAt: updatedTemplate.createdAt,
            updatedAt: updatedTemplate.updatedAt
          },
          changes: Object.keys(validatedData)
        }
      });

    } catch (error: any) {
      console.error('email.tpl.update.fail stage=unknown err="' + (error.message || 'Unknown error').substring(0, 50) + '"');
      
      return res.json({
        ok: false,
        stage: 'unknown',
        error: { 
          short: 'Unexpected error during template update', 
          raw: (error.message || 'Unknown error').substring(0, 200) 
        },
        hasRepair: false
      });
    }
  });

  /**
   * 6. GET /api/superadmin/email/templates/update/:key
   * Update an email template (Workaround for Vite middleware interception)
   * This is a workaround for the Vite development middleware interception issue.
   * Vite intercepts PUT/POST requests and returns HTML, so we use GET with action parameters.
   */
  app.get('/api/superadmin/email/templates/update/:key', requireAuth, async (req: any, res) => {
    console.log('email.tpl.update.start (GET workaround)');
    
    try {
      // SuperAdmin role check
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        console.log('email.tpl.update.fail stage=auth err="Access denied"');
        return res.status(403).json({ 
          ok: false, 
          stage: 'auth', 
          error: { short: 'Access denied - SuperAdmin required', raw: 'User role check failed' },
          hasRepair: false 
        });
      }

      const { key } = req.params;
      
      // For GET requests with JSON data, we expect it in the query parameter 'data'
      let updateData;
      try {
        if (req.query.data) {
          updateData = JSON.parse(req.query.data as string);
        } else {
          throw new Error('No update data provided');
        }
      } catch (error) {
        console.log('email.tpl.update.fail stage=validation err="Invalid JSON data"');
        return res.json({
          ok: false,
          stage: 'validation',
          error: { short: 'Invalid JSON data in request', raw: (error as Error).message },
          hasRepair: false
        });
      }

      if (!key || typeof key !== 'string') {
        console.log('email.tpl.update.fail stage=validation err="Missing template key"');
        return res.json({
          ok: false,
          stage: 'validation',
          error: { short: 'Template key is required', raw: 'Missing or invalid key in URL params' },
          hasRepair: false
        });
      }

      console.log(`email.tpl.update.validate key=${key} (GET workaround)`);

      // Validate the update data using the insert schema (subset for updates)
      const updateSchema = insertEmailTemplateSchema.partial().omit({ key: true });
      const validation = updateSchema.safeParse(updateData);
      
      if (!validation.success) {
        console.log('email.tpl.update.fail stage=validation err="Invalid update data"');
        return res.json({
          ok: false,
          stage: 'validation',
          error: { 
            short: 'Invalid template data provided', 
            raw: JSON.stringify(validation.error.errors).substring(0, 200) 
          },
          hasRepair: false
        });
      }

      const validatedData = validation.data;

      console.log(`email.tpl.update.query key=${key} (GET workaround)`);

      // Check if template exists
      const existingTemplate = await storage.getEmailTemplateByKey(key);
      if (!existingTemplate) {
        console.log('email.tpl.update.fail stage=query err="Template not found"');
        return res.json({
          ok: false,
          stage: 'query',
          error: { 
            short: `Template '${key}' not found`, 
            raw: `No template found with key: ${key}` 
          },
          hasRepair: true
        });
      }

      // Prepare update data with version increment and timestamp
      const updatePayload = {
        ...validatedData,
        version: existingTemplate.version + 1,
        updatedAt: new Date()
      };

      console.log(`email.tpl.update.save key=${key} version=${updatePayload.version} (GET workaround)`);

      // Update the template
      const updatedTemplate = await storage.updateEmailTemplate(key, updatePayload);

      if (!updatedTemplate) {
        console.log('email.tpl.update.fail stage=save err="Update failed"');
        return res.json({
          ok: false,
          stage: 'save',
          error: { 
            short: 'Failed to update template', 
            raw: 'Database update operation returned null' 
          },
          hasRepair: false
        });
      }

      console.log(`email.tpl.update.success key=${key} version=${updatedTemplate.version} (GET workaround)`);

      return res.json({
        ok: true,
        data: {
          template: {
            id: updatedTemplate.id,
            key: updatedTemplate.key,
            name: updatedTemplate.name,
            subject: updatedTemplate.subject,
            html: updatedTemplate.html,
            mjml: updatedTemplate.mjml,
            text: updatedTemplate.text,
            variablesSchema: updatedTemplate.variablesSchema,
            category: updatedTemplate.category,
            version: updatedTemplate.version,
            isActive: updatedTemplate.isActive,
            createdAt: updatedTemplate.createdAt,
            updatedAt: updatedTemplate.updatedAt
          },
          changes: Object.keys(validatedData)
        }
      });

    } catch (error: any) {
      console.error('email.tpl.update.fail stage=unknown err="' + (error.message || 'Unknown error').substring(0, 50) + '" (GET workaround)');
      
      return res.json({
        ok: false,
        stage: 'unknown',
        error: { 
          short: 'Unexpected error during template update', 
          raw: (error.message || 'Unknown error').substring(0, 200) 
        },
        hasRepair: false
      });
    }
  });

  // Email settings routes - Provider-agnostic
  app.put('/api/organisations/:id/email-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id: organisationId } = req.params;

      // Admins can only update their own organization's settings
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(organisationId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      const {
        emailProvider,
        fromEmail,
        fromName,
        replyTo,
        // SMTP fields
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpSecure,
        // API fields
        apiKey,
        apiSecret,
        apiBaseUrl,
        apiDomain,
        apiRegion
      } = req.body;

      // Get existing settings to prevent masked value override
      const existingSettings = await storage.getOrganisationSettings(organisationId);

      // Clean and validate sensitive fields - prevent masked value storage
      const cleanSensitiveField = (field: string | undefined, existingValue: string | undefined): string | undefined => {
        if (!field) return undefined;
        const cleaned = field.replace(/^["']|["']$/g, "").replace(/\r?\n/g, "").trim();
        // If it's a masked value (contains only • or similar characters), keep existing
        if (cleaned && /^[•*]+$/.test(cleaned)) {
          return existingValue || undefined;
        }
        return cleaned || undefined;
      };

      const processedApiKey = cleanSensitiveField(apiKey, existingSettings?.apiKey ?? undefined);
      const processedApiSecret = cleanSensitiveField(apiSecret, existingSettings?.apiSecret ?? undefined);
      const processedSmtpPassword = cleanSensitiveField(smtpPassword, existingSettings?.smtpPassword ?? undefined);

      // Provider-aware validation
      const missingFields = [];
      
      if (!fromEmail) missingFields.push('From Email');
      if (!fromName) missingFields.push('From Name');

      if (emailProvider === 'smtp_generic') {
        if (!smtpHost) missingFields.push('SMTP Host');
        if (!smtpUsername) missingFields.push('SMTP Username');
        if (!processedSmtpPassword) missingFields.push('SMTP Password');
      } else {
        // API providers
        if (!processedApiKey) missingFields.push('API Key');
        
        if (emailProvider === 'mailjet_api' && !processedApiSecret) {
          missingFields.push('API Secret');
        }
        if (emailProvider === 'mailgun_api' && !apiDomain) {
          missingFields.push('API Domain');
        }
      }

      if (missingFields.length > 0) {
        return res.status(400).json({ 
          message: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }

      // Build email settings object
      const emailSettings: any = {
        emailProvider: emailProvider || 'sendgrid_api',
        fromEmail,
        fromName,
        replyTo: replyTo || null,
      };

      // Add provider-specific fields
      if (emailProvider === 'smtp_generic') {
        emailSettings.smtpHost = smtpHost;
        emailSettings.smtpPort = parseInt(smtpPort) || 587;
        emailSettings.smtpUsername = smtpUsername;
        emailSettings.smtpPassword = processedSmtpPassword;
        emailSettings.smtpSecure = smtpSecure !== false;
      } else {
        // API providers
        emailSettings.apiKey = processedApiKey;
        
        if (emailProvider === 'mailjet_api') {
          emailSettings.apiSecret = processedApiSecret;
        }
        if (emailProvider === 'mailgun_api') {
          emailSettings.apiDomain = apiDomain;
        }
        if (apiBaseUrl) {
          emailSettings.apiBaseUrl = apiBaseUrl;
        }
        if (apiRegion) {
          emailSettings.apiRegion = apiRegion;
        }
      }

      const updatedSettings = await storage.updateOrganisationSettings(organisationId, emailSettings);
      res.json({ success: true, message: 'Email settings saved successfully' });
    } catch (error) {
      console.error('Error updating email settings:', error);
      res.status(500).json({ message: 'Failed to update email settings' });
    }
  });

  // Test email settings - Enhanced Brevo API implementation
  app.post('/api/organisations/:id/test-email', requireAuth, async (req: any, res) => {
    const startTime = Date.now();
    let providerUsed = 'unknown';
    
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Determine organisation ID from user context or request params
      let organisationId = req.params.id;
      if (!organisationId && user.organisationId) {
        organisationId = user.organisationId;
      }
      
      if (!organisationId) {
        return res.status(400).json({
          success: false,
          provider: 'unknown',
          httpStatus: 400,
          message: 'Organisation context missing',
          details: {
            endpoint: 'N/A',
            from: 'N/A',
            to: req.body.testEmail || 'N/A'
          }
        });
      }

      const { testEmail } = req.body;

      // Admins can only test their own organization's settings
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(organisationId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      // Get effective email settings using safe lookup
      let emailConfig;
      try {
        emailConfig = await getEffectiveEmailSettings(storage, organisationId);
      } catch (orgError: any) {
        console.error('Organisation lookup failed:', orgError);
        return res.status(404).json({
          success: false,
          provider: 'unknown',
          httpStatus: 404,
          message: 'Organisation not found',
          details: {
            endpoint: 'N/A',
            from: 'N/A',
            to: testEmail || 'N/A',
            error: orgError?.message || 'Unknown error'
          }
        });
      }

      if (!emailConfig.valid) {
        return res.status(422).json({
          success: false,
          provider: emailConfig.settings?.provider || 'unknown',
          httpStatus: 422,
          message: 'Email configuration validation failed',
          details: {
            endpoint: emailConfig.settings?.provider === 'brevo_api' ? '/v3/smtp/email' : 'smtp',
            from: emailConfig.settings?.fromEmail || 'N/A',
            to: testEmail || 'N/A',
            validationErrors: emailConfig.errors,
            helpText: emailConfig.errors.length > 0 ? 
              'Please check your email settings in the organisation configuration.' : undefined
          }
        });
      }

      const { settings } = emailConfig;
      if (!settings) {
        return res.status(500).json({
          success: false,
          provider: 'unknown',
          httpStatus: 500,
          message: 'Internal error: email settings not available',
          details: {
            endpoint: 'N/A',
            from: 'N/A',
            to: testEmail || 'N/A'
          }
        });
      }
      providerUsed = settings.provider;

      // Validate test email recipient
      if (!testEmail || testEmail.trim() === '') {
        return res.status(400).json({
          success: false,
          provider: providerUsed,
          httpStatus: 400,
          message: 'Test email recipient is required',
          details: {
            endpoint: settings.provider === 'brevo_api' ? '/v3/smtp/email' : 'smtp',
            from: settings.fromEmail,
            to: 'N/A',
            validationErrors: ['Test email recipient is missing']
          }
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
        return res.status(400).json({
          success: false,
          provider: providerUsed,
          httpStatus: 400,
          message: 'Invalid test email format',
          details: {
            endpoint: settings.provider === 'brevo_api' ? '/v3/smtp/email' : 'smtp',
            from: settings.fromEmail,
            to: testEmail,
            validationErrors: ['Test email format is invalid']
          }
        });
      }

      // UNIFIED EMAIL SYSTEM - HEALTH CHECK AND SEND VIA INTELLIGENT ROUTING
      if (settings.provider === 'brevo_api' || settings.provider === 'smtp' || true) {
        console.log(`🔄 Using MailerService intelligent routing for provider: ${settings.provider}`);
        
        // STEP 1: Health check via MailerService (uses same intelligent routing)
        const healthCheck = await mailerService.healthCheck(organisationId);
        
        if (!healthCheck.success) {
          return res.json({
            success: false,
            provider: healthCheck.provider,
            httpStatus: healthCheck.httpStatus,
            message: healthCheck.error?.short || 'Email health check failed',
            details: {
              endpoint: healthCheck.endpoint,
              from: healthCheck.details?.from || settings.fromEmail,
              to: testEmail,
              keyPreview: healthCheck.details?.keyPreview,
              keyLength: healthCheck.details?.keyLength,
              effectiveFieldSources: healthCheck.details?.effectiveFieldSources,
              helpText: healthCheck.httpStatus === 401 || healthCheck.httpStatus === 403 ? 
                'Check your API key configuration in organization or platform settings.' : 
                healthCheck.error?.raw,
              error: healthCheck.error
            }
          });
        }

        // STEP 2: Send test email via MailerService intelligent routing
        const sendResult = await mailerService.send({
          orgId: organisationId,
          to: testEmail,
          subject: `inteLMS Email Test - ${healthCheck.provider.toUpperCase()} via Intelligent Routing`,
          html: `
            <h2>✅ Email Test Successful - Intelligent Routing</h2>
            <p>This test email was sent using the intelligent routing system with org→system fallback.</p>
            <div style="background-color: #f0f8ff; padding: 15px; border-left: 4px solid #0066cc; margin: 15px 0;">
              <strong>✅ Intelligent Email Routing Active</strong><br>
              Organization: ${organisationId || 'System Level'}<br>
              Provider: ${healthCheck.provider.replace('_', ' ').toUpperCase()}<br>
              Test Timestamp: ${new Date().toISOString()}
            </div>
            <p>Your email configuration is working correctly!</p>
            <hr>
            <div style="font-size: 12px; color: #666;">
              This test uses intelligent routing that automatically tries organization settings first,
              then falls back to system settings if needed. All providers supported: SMTP, Brevo, SendGrid, Mailgun, etc.
            </div>
          `,
          templateType: 'intelligent_test'
        });

        // Return consistent EmailResult format from MailerService
        return res.json({
          success: sendResult.success,
          provider: sendResult.provider,
          endpoint: sendResult.endpoint,
          httpStatus: sendResult.httpStatus,
          smtpStatus: sendResult.smtpStatus,
          message: sendResult.success ? 
            `Test email sent successfully via ${sendResult.provider} intelligent routing` : 
            sendResult.error?.short,
          details: {
            ...sendResult.details,
            routingUsed: 'intelligent_org_system_fallback',
            helpText: sendResult.success ? 
              'Check Spam/Quarantine if email doesn\'t arrive. Intelligent routing ensures optimal delivery.' :
              'Intelligent routing tried both organization and system settings. Check your email configuration.'
          },
          error: sendResult.error
        });
      }

    } catch (error: any) {
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      
      console.error('Test email error:', error);
      
      // Handle network/timeout errors
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return res.json({
          success: false,
          provider: providerUsed,
          httpStatus: 0,
          message: `Request timed out after ${Math.round(latencyMs/1000)}s`,
          details: {
            endpoint: '/v3/smtp/email',
            from: 'N/A',
            to: req.body.testEmail || 'N/A',
            error: 'Network timeout',
            latencyMs
          }
        });
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.json({
          success: false,
          provider: providerUsed,
          httpStatus: 0,
          message: 'Network error reaching Brevo. Check outbound HTTPS and retry.',
          details: {
            endpoint: '/v3/smtp/email',
            from: 'N/A',
            to: req.body.testEmail || 'N/A',
            error: error.message,
            latencyMs
          }
        });
      }

      // Other unexpected errors
      return res.json({
        success: false,
        provider: providerUsed,
        httpStatus: 0,
        message: `Unexpected error: ${error.message}`,
        details: {
          endpoint: '/v3/smtp/email',
          from: 'N/A',
          to: req.body.testEmail || 'N/A',
          error: error.message,
          latencyMs
        }
      });
    }
  });

  // System SMTP settings routes (SuperAdmin only) - Enhanced Version
  app.get('/api/system/smtp-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. SuperAdmin role required.' });
      }

      const settings = await storage.getSystemEmailSettings();
      if (!settings) {
        return res.json(null);
      }

      // Don't expose password in response for security
      const { smtpPassword, ...safeSettings } = settings;
      res.json({
        ...safeSettings,
        hasPassword: !!settings.smtpPassword
      });
    } catch (error) {
      console.error('Error fetching system SMTP settings:', error);
      res.status(500).json({ message: 'Failed to fetch system SMTP settings' });
    }
  });

  app.post('/api/system/smtp-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. SuperAdmin role required.' });
      }

      const { 
        smtpHost, 
        smtpPort, 
        smtpUsername, 
        smtpPassword, 
        smtpSecure, 
        fromEmail, 
        fromName,
        description 
      } = req.body;

      // Validation
      if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !fromEmail || !fromName) {
        return res.status(400).json({ 
          message: 'Required fields: smtpHost, smtpPort, smtpUsername, smtpPassword, fromEmail, fromName' 
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(fromEmail)) {
        return res.status(400).json({ message: 'Invalid from email address' });
      }

      // Port validation
      if (smtpPort < 1 || smtpPort > 65535) {
        return res.status(400).json({ message: 'SMTP port must be between 1 and 65535' });
      }

      const settingsData = {
        smtpHost: smtpHost.trim(),
        smtpPort: parseInt(smtpPort),
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword,
        smtpSecure: Boolean(smtpSecure),
        fromEmail: fromEmail.trim().toLowerCase(),
        fromName: fromName.trim(),
        description: description?.trim() || 'System SMTP Configuration',
        updatedBy: user.id
      };

      const settingsDataWithProvider = {
        ...settingsData,
        emailProvider: 'smtp_generic' as const
      };
      const settings = await storage.createSystemEmailSettings(settingsDataWithProvider);
      
      // Return settings without password
      const { smtpPassword: _, ...safeSettings } = settings;
      res.status(201).json({
        ...safeSettings,
        hasPassword: true
      });
    } catch (error) {
      console.error('Error creating system SMTP settings:', error);
      res.status(500).json({ message: 'Failed to create system SMTP settings' });
    }
  });

  app.put('/api/system/smtp-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. SuperAdmin role required.' });
      }

      const updateData: any = { updatedBy: user.id };
      
      // Only update provided fields
      const fields = ['smtpHost', 'smtpPort', 'smtpUsername', 'smtpPassword', 'smtpSecure', 'fromEmail', 'fromName', 'description'];
      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          if (field === 'smtpPort') {
            updateData[field] = parseInt(req.body[field]);
          } else if (field === 'smtpSecure') {
            updateData[field] = Boolean(req.body[field]);
          } else if (field === 'fromEmail') {
            const email = req.body[field].trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
              return res.status(400).json({ message: 'Invalid from email address' });
            }
            updateData[field] = email;
          } else {
            updateData[field] = req.body[field].trim();
          }
        }
      });

      const settings = await storage.updateSystemEmailSettings(updateData);
      
      // Return settings without password
      const { smtpPassword: _, ...safeSettings } = settings;
      res.json({
        ...safeSettings,
        hasPassword: !!settings.smtpPassword
      });
    } catch (error) {
      console.error('Error updating system SMTP settings:', error);
      res.status(500).json({ message: 'Failed to update system SMTP settings' });
    }
  });

  // Provider-agnostic system email settings
  app.put('/api/system/email-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const emailSettings = req.body;

      // Provider-agnostic validation
      const provider = emailSettings.emailProvider || 'sendgrid_api';
      
      // Common required fields for all providers
      if (!emailSettings.fromEmail || !emailSettings.fromName) {
        return res.status(400).json({ 
          message: 'From email and from name are required for all email providers' 
        });
      }

      // Provider-specific validation
      if (provider === 'smtp_generic') {
        // SMTP validation
        if (!emailSettings.smtpHost || !emailSettings.smtpUsername) {
          return res.status(400).json({ 
            message: 'SMTP host and username are required for SMTP configuration' 
          });
        }
        if (!emailSettings.smtpPassword && !emailSettings.smtpPassword?.startsWith('••')) {
          return res.status(400).json({ 
            message: 'SMTP password is required' 
          });
        }
      } else {
        // API provider validation
        if (!emailSettings.apiKey) {
          return res.status(400).json({ 
            message: 'API key is required for the selected email provider' 
          });
        }

        // Provider-specific requirements
        if (provider === 'mailjet_api' && !emailSettings.apiSecret) {
          return res.status(400).json({ 
            message: 'Mailjet requires both API key and API secret' 
          });
        }
        if (provider === 'mailgun_api' && !emailSettings.apiDomain) {
          return res.status(400).json({ 
            message: 'Mailgun requires an API domain' 
          });
        }
        if (provider === 'ses_api' && !emailSettings.apiRegion) {
          return res.status(400).json({ 
            message: 'Amazon SES requires an AWS region' 
          });
        }
      }

      // Prepare settings data for storage
      const settingsData = {
        emailProvider: provider,
        fromEmail: emailSettings.fromEmail.trim().toLowerCase(),
        fromName: emailSettings.fromName.trim(),
        replyTo: emailSettings.replyTo?.trim() || null,
        description: emailSettings.description?.trim() || null,
        // SMTP fields
        smtpHost: provider === 'smtp_generic' ? emailSettings.smtpHost?.trim() : null,
        smtpPort: provider === 'smtp_generic' ? (parseInt(emailSettings.smtpPort) || 587) : null,
        smtpUsername: provider === 'smtp_generic' ? emailSettings.smtpUsername?.trim() : null,
        smtpPassword: provider === 'smtp_generic' ? emailSettings.smtpPassword : null,
        smtpSecure: provider === 'smtp_generic' ? Boolean(emailSettings.smtpSecure) : null,
        // API fields
        apiKey: provider !== 'smtp_generic' ? emailSettings.apiKey : null,
        apiSecret: provider === 'mailjet_api' ? emailSettings.apiSecret : null,
        apiBaseUrl: emailSettings.apiBaseUrl?.trim() || null,
        apiDomain: provider === 'mailgun_api' ? emailSettings.apiDomain?.trim() : null,
        apiRegion: provider === 'ses_api' ? emailSettings.apiRegion : null,
        isActive: true,
        updatedBy: user.id,
      };

      // Check if settings exist and create or update accordingly
      const existingSettings = await storage.getSystemEmailSettings();
      let savedSettings;
      
      if (existingSettings) {
        savedSettings = await storage.updateSystemEmailSettings(settingsData);
      } else {
        savedSettings = await storage.createSystemEmailSettings(settingsData);
      }
      
      res.json(savedSettings);
    } catch (error) {
      console.error('Error updating system email settings:', error);
      res.status(500).json({ message: 'Failed to update system email settings' });
    }
  });

  // Get system email settings (SuperAdmin only)
  app.get('/api/system/email-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const settings = await storage.getSystemEmailSettings();
      
      if (!settings) {
        // Return default settings if none exist
        return res.json({
          provider: 'sendgrid_api',
          fromEmail: '',
          fromName: '',
          replyTo: '',
          description: '',
          // SMTP fields
          smtpHost: '',
          smtpPort: '587',
          smtpUsername: '',
          smtpPassword: '',
          smtpSecure: true,
          // API fields
          apiKey: '',
          apiSecret: '',
          apiBaseUrl: '',
          apiDomain: '',
          apiRegion: '',
        });
      }

      // Return settings with masked sensitive fields
      const responseData = {
        provider: settings.emailProvider,
        fromEmail: settings.fromEmail || '',
        fromName: settings.fromName || '',
        replyTo: settings.replyTo || '',
        description: settings.description || '',
        // SMTP fields
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort?.toString() || '587',
        smtpUsername: settings.smtpUsername || '',
        smtpPassword: settings.smtpPassword ? '••••••••' : '',
        smtpSecure: settings.smtpSecure ?? true,
        // API fields  
        apiKey: settings.apiKey ? '••••••••' : '',
        apiSecret: settings.apiSecret ? '••••••••' : '',
        apiBaseUrl: settings.apiBaseUrl || '',
        apiDomain: settings.apiDomain || '',
        apiRegion: settings.apiRegion || '',
      };

      res.json(responseData);
    } catch (error) {
      console.error('Error fetching system email settings:', error);
      res.status(500).json({ message: 'Failed to fetch system email settings' });
    }
  });

  // Single Mailer Service - Health Check Endpoint
  app.post('/api/smtp/health-check', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied. Admin or SuperAdmin role required.' });
      }

      const { organisationId } = req.body;
      
      // For admins, restrict to their own organization
      const targetOrgId = user.role === 'admin' ? user.organisationId : organisationId;
      
      const healthResult = await mailerService.healthCheck(targetOrgId);
      
      res.json(healthResult);
    } catch (error: any) {
      console.error('Error in SMTP health check:', error);
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: (error as any)?.message || 'Health check failed',
        dnsResolution: false,
        tcpConnection: false,
        startTlsSupport: false
      });
    }
  });

  // Single Mailer Service - Admin Test Email Endpoint  
  app.post('/api/smtp/admin-test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied. Admin or SuperAdmin role required.' });
      }

      const { testEmail, organisationId } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ message: 'Test email address is required' });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmail)) {
        return res.status(400).json({ message: 'Invalid test email address' });
      }

      // For admins, restrict to their own organization
      const targetOrgId = user.role === 'admin' ? user.organisationId : organisationId;
      
      const testResult = await mailerService.send({
        orgId: targetOrgId,
        to: testEmail,
        subject: `SMTP Test Email - ${new Date().toLocaleString()}`,
        html: `
          <h2>SMTP Configuration Test - Intelligent Routing</h2>
          <p>This is a test email sent from the LMS platform to verify email configuration.</p>
          <div style="background-color: #f0f8ff; padding: 10px; border-left: 4px solid #0066cc; margin: 10px 0;">
            <strong>✅ Intelligent Email Routing Active</strong><br>
            This email was sent using the new org→system fallback routing.
          </div>
          <hr>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Timestamp: ${new Date().toISOString()}</li>
            <li>Organisation ID: ${targetOrgId || 'System Level'}</li>
            <li>Test Type: Admin Email Test</li>
            <li>Routing: Intelligent Fallback Enabled</li>
            <li>Sent by: ${user.email}</li>
          </ul>
          <p>If you received this email, your email configuration is working correctly.</p>
          <hr>
          <div style="font-size: 12px; color: #666;">
            This test uses the new intelligent routing system that tries organization settings first,
            then falls back to system settings automatically.
          </div>
        `,
        templateType: 'admin_test'
      });
      
      // Return detailed metadata for admin UI
      res.json({
        success: testResult.success,
        provider: testResult.provider,
        endpoint: testResult.endpoint,
        httpStatus: testResult.httpStatus,
        timestamp: testResult.details.timestamp,
        error: testResult.error,
        testDetails: {
          sentBy: user.email,
          sentAt: testResult.details.timestamp,
          userAgent: req.get('User-Agent'),
          clientIp: req.ip,
          organisationLevel: targetOrgId ? 'organisation' : 'system',
          messageId: testResult.details.messageId,
          effectiveFieldSources: testResult.details.effectiveFieldSources,
          routingUsed: testResult.success ? 'intelligent_routing' : 'failed'
        }
      });
    } catch (error: any) {
      console.error('Error in admin email test:', error);
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: (error as any)?.message || 'Email test failed',
        provider: 'unknown',
        testDetails: {
          sentBy: 'error',
          sentAt: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          clientIp: req.ip,
          routingUsed: 'failed'
        }
      });
    }
  });

  // System email API health check - validates API key connectivity
  app.post('/api/system/email-health-check', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const settings = await storage.getSystemEmailSettings();
      
      if (!settings) {
        return res.json({
          success: false,
          error: 'No system email settings configured',
          provider: 'none',
          timestamp: new Date().toISOString()
        });
      }

      const provider = settings.emailProvider;
      
      // Test API connectivity based on provider type
      try {
        let healthResult = {
          success: false,
          provider,
          timestamp: new Date().toISOString(),
          details: {} as any
        };

        if (provider === 'smtp_generic') {
          // Use MailerService health check with intelligent routing
          const emailHealth = await mailerService.healthCheck(undefined);
          healthResult = {
            ...healthResult,
            success: emailHealth.success,
            details: emailHealth
          };
        } else {
          // API-based providers - test basic connectivity
          // Note: API-based providers use direct configuration validation
          
          // Create a minimal test to validate API key
          try {
            // Use the provider to attempt a simple validation call
            switch (provider) {
              case 'sendgrid_api':
                if (!settings.apiKey) {
                  throw new Error('SendGrid API key not configured');
                }
                healthResult.details = {
                  apiKeyExists: !!settings.apiKey,
                  fromEmail: !!settings.fromEmail,
                  message: 'API key is configured but validation requires a test email'
                };
                healthResult.success = !!settings.apiKey && !!settings.fromEmail;
                break;
                
              case 'brevo_api':
                if (!settings.apiKey) {
                  throw new Error('Brevo API key not configured');
                }
                healthResult.details = {
                  apiKeyExists: !!settings.apiKey,
                  fromEmail: !!settings.fromEmail,
                  message: 'API key is configured but validation requires a test email'
                };
                healthResult.success = !!settings.apiKey && !!settings.fromEmail;
                break;
                
              case 'mailgun_api':
                if (!settings.apiKey || !settings.apiDomain) {
                  throw new Error('Mailgun API key and domain not configured');
                }
                healthResult.details = {
                  apiKeyExists: !!settings.apiKey,
                  domainExists: !!settings.apiDomain,
                  fromEmail: !!settings.fromEmail,
                  message: 'API key and domain configured but validation requires a test email'
                };
                healthResult.success = !!settings.apiKey && !!settings.apiDomain && !!settings.fromEmail;
                break;
                
              case 'postmark_api':
                if (!settings.apiKey) {
                  throw new Error('Postmark API key not configured');
                }
                healthResult.details = {
                  apiKeyExists: !!settings.apiKey,
                  fromEmail: !!settings.fromEmail,
                  message: 'API key is configured but validation requires a test email'
                };
                healthResult.success = !!settings.apiKey && !!settings.fromEmail;
                break;
                
              case 'mailjet_api':
                if (!settings.apiKey || !settings.apiSecret) {
                  throw new Error('Mailjet API key and secret not configured');
                }
                healthResult.details = {
                  apiKeyExists: !!settings.apiKey,
                  apiSecretExists: !!settings.apiSecret,
                  fromEmail: !!settings.fromEmail,
                  message: 'API key and secret configured but validation requires a test email'
                };
                healthResult.success = !!settings.apiKey && !!settings.apiSecret && !!settings.fromEmail;
                break;
                
              case 'sparkpost_api':
                if (!settings.apiKey) {
                  throw new Error('SparkPost API key not configured');
                }
                healthResult.details = {
                  apiKeyExists: !!settings.apiKey,
                  fromEmail: !!settings.fromEmail,
                  message: 'API key is configured but validation requires a test email'
                };
                healthResult.success = !!settings.apiKey && !!settings.fromEmail;
                break;
                
              default:
                throw new Error(`Unsupported email provider: ${provider}`);
            }
          } catch (error: any) {
            healthResult.success = false;
            healthResult.details = {
              error: error.message,
              configured: false
            };
          }
        }
        
        res.json(healthResult);
      } catch (error: any) {
        res.json({
          success: false,
          provider,
          timestamp: new Date().toISOString(),
          error: error.message,
          details: { configured: false }
        });
      }
    } catch (error: any) {
      console.error('Error in system email health check:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Enhanced system SMTP test with comprehensive logging (Legacy Support)
  app.post('/api/system/smtp-test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. SuperAdmin role required.' });
      }

      const { testEmail, connectionOnly = false } = req.body;

      if (!connectionOnly && !testEmail) {
        return res.status(400).json({ message: 'Test email address is required for email test' });
      }

      if (!connectionOnly) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmail)) {
          return res.status(400).json({ message: 'Invalid test email address' });
        }
      }

      if (connectionOnly) {
        // Test connection using appropriate service based on provider
        const settings = await storage.getSystemEmailSettings();
        const provider = settings?.emailProvider || 'sendgrid_api';
        
        // Use MailerService for all providers with intelligent routing
        const connectionResult = await mailerService.healthCheck(undefined);
        res.json({
          success: connectionResult.success,
          details: connectionResult
        });
      } else {
        // Send test email using appropriate service based on provider
        const settings = await storage.getSystemEmailSettings();
        const provider = settings?.emailProvider || 'sendgrid_api';
        
        // Use MailerService for all providers with intelligent routing
        const result = await mailerService.send({
          orgId: undefined,
          to: testEmail,
          subject: `✅ Email Configuration Test - ${new Date().toLocaleString()}`,
          html: `
            <h2>✅ Email Configuration Test - Intelligent Routing</h2>
            <p>This test email was sent to verify your email configuration using the intelligent routing system.</p>
            <div style="background-color: #f0f8ff; padding: 15px; border-left: 4px solid #0066cc; margin: 15px 0;">
              <strong>✅ Intelligent Email Routing Active</strong><br>
              Provider: ${provider.replace('_', ' ').toUpperCase()}<br>
              Test Timestamp: ${new Date().toISOString()}<br>
              Routing: System Level with Auto-Fallback
            </div>
            <p>If you received this email, your email configuration is working correctly.</p>
            <hr>
            <div style="font-size: 12px; color: #666;">
              This test uses the new intelligent routing system that automatically selects
              the best available email configuration.
            </div>
          `,
          templateType: 'smtp_test'
        });
        
        res.json({
          success: result.success,
          timestamp: new Date().toISOString(),
          provider: result.provider,
          message: result.success 
            ? `Test email sent successfully via ${result.provider.replace('_', ' ').toUpperCase()}` 
            : result.error?.short || 'Failed to send test email',
          details: result,
          routingUsed: 'intelligent_system_routing'
        });
      }
    } catch (error) {
      console.error('Error testing system SMTP:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to test SMTP settings',
        error: (error as any)?.message 
      });
    }
  });

  // Legacy test system email settings (SuperAdmin only)
  app.post('/api/system/test-email', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const { testEmail } = req.body;

      if (!testEmail) {
        return res.status(400).json({ message: 'Test email address is required' });
      }

      // Use MailerService with intelligent routing for all email delivery
      const result = await mailerService.send({
        orgId: undefined,
        to: testEmail,
        subject: `Test Email - ${new Date().toLocaleString()}`,
        html: `
          <h2>Email Test Successful - Intelligent Routing</h2>
          <p>This is a test email to verify your email configuration.</p>
          <div style="background-color: #f0f8ff; padding: 10px; border-left: 4px solid #0066cc; margin: 10px 0;">
            <strong>✅ Intelligent Email Routing Active</strong><br>
            System-level configuration with automatic provider selection.
          </div>
          <p>Your email settings are working correctly!</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
          <br>
          <p>Best regards,<br>LMS System</p>
        `,
        templateType: 'smtp_test'
      });
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Test email sent successfully',
          provider: result.provider,
          routingUsed: 'intelligent_routing'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: result.error?.short || 'Failed to send test email. Please check your email settings.',
          provider: result.provider,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error sending system test email:', error);
      res.status(500).json({ 
        success: false, 
        message: (error as any)?.message || 'Failed to send test email. Please check your email settings.',
        provider: 'unknown',
        routingUsed: 'failed'
      });
    }
  });

  // ========================================================================================
  // EMAIL PROVIDER CONFIG MANAGEMENT ENDPOINTS - Organization-specific email configuration
  // ========================================================================================

  // Get organization's email provider configuration
  app.get('/api/admin/email-provider-config/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      const { organisationId } = req.params;

      // Validate admin access
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin privileges required' });
      }

      // Admin can only access their own organization
      if (user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied - can only access your own organization' });
      }

      // Get organization's email provider config
      const config = await storage.getEmailProviderConfigByOrg(organisationId);

      if (!config) {
        return res.json({
          success: true,
          data: {
            organisationId: organisationId,
            provider: 'sendgrid_api',
            apiKey: '',
            fromEmail: '',
            fromName: '',
            enabled: false,
            hasApiKey: false
          },
          message: 'No custom email configuration found - using system default'
        });
      }

      // Return config status without exposing sensitive data (API keys)
      const configJson = config.configJson as any;
      
      res.json({
        success: true,
        data: {
          id: config.id,
          organisationId: config.orgId,
          provider: config.provider,
          // Never return actual API keys - only masked status
          apiKey: configJson?.apiKey ? '••••••••••••••••' : '',
          fromEmail: configJson?.fromEmail || '',
          fromName: configJson?.fromName || '',
          enabled: true, // If config exists, it's enabled
          hasApiKey: !!configJson?.apiKey,
          isDefaultForOrg: config.isDefaultForOrg,
          updatedAt: config.updatedAt
        }
      });
    } catch (error) {
      console.error('Error fetching email provider config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch email provider configuration'
      });
    }
  });

  // Save organization's email provider configuration
  app.post('/api/admin/email-provider-config', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);

      // Validate admin access
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin privileges required' });
      }

      if (!user.organisationId) {
        return res.status(400).json({ message: 'Admin user not associated with an organization' });
      }

      // Transform frontend flat structure to backend configJson structure
      const { provider, apiKey, fromEmail, fromName, enabled } = req.body;
      
      if (!provider || !apiKey || !fromEmail || !fromName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: provider, apiKey, fromEmail, fromName'
        });
      }

      // Build provider-specific configJson
      const configJson = {
        apiKey,
        fromEmail,
        fromName
      };

      // Validate request body with proper schema structure
      const validation = insertEmailProviderConfigsSchema.safeParse({
        provider,
        configJson,
        orgId: user.organisationId,
        updatedBy: user.id
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration data',
          errors: validation.error.errors
        });
      }

      const configData = validation.data;

      // Additional validation for required fields based on provider
      if (configData.provider === 'sendgrid_api') {
        const config = configData.configJson as any;
        if (!config?.apiKey || !config?.fromEmail) {
          return res.status(400).json({
            success: false,
            message: 'SendGrid configuration requires apiKey and fromEmail'
          });
        }
      }

      // Upsert the configuration (creates new or updates existing)
      const savedConfig = await storage.upsertEmailProviderConfig(user.organisationId, configData);

      res.json({
        success: true,
        message: 'Email provider configuration saved successfully',
        config: {
          id: savedConfig.id,
          provider: savedConfig.provider,
          isDefaultForOrg: savedConfig.isDefaultForOrg,
          updatedAt: savedConfig.updatedAt
        }
      });
    } catch (error) {
      console.error('Error saving email provider config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save email provider configuration'
      });
    }
  });

  // Test email provider configuration
  app.post('/api/admin/test-email-config', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);

      // Validate admin access
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - admin privileges required' });
      }

      if (!user.organisationId) {
        return res.status(400).json({ message: 'Admin user not associated with an organization' });
      }

      // Define test configuration validation schema
      const testConfigSchema = z.object({
        provider: z.enum(['smtp_generic', 'sendgrid_api', 'brevo_api', 'mailgun_api', 'postmark_api', 'mailjet_api', 'sparkpost_api']),
        apiKey: z.string().min(1, 'API key is required'),
        fromEmail: z.string().email('Invalid fromEmail address format'),
        fromName: z.string().min(1, 'From name is required'),
        testEmail: z.string().email('Invalid test email address format')
      });

      // Validate request body with Zod
      const validation = testConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration data',
          errors: validation.error.errors
        });
      }

      const { provider, apiKey, fromEmail, fromName, testEmail } = validation.data;

      console.log(`📧 Testing Email Config: ${provider} for org ${user.organisationId} by ${user.email}`);

      // Create test configuration without saving to database
      const testConfig = {
        provider,
        fromEmail,
        fromName,
        apiKey
      };

      // Use the mailer service to test the configuration
      try {
        const testResult = await mailerService.send({
          to: testEmail,
          subject: 'Email Configuration Test - inteLMS',
          html: `
            <h2>Email Configuration Test Successful! ✅</h2>
            <p>Congratulations! Your email configuration is working correctly.</p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <strong>Configuration Details:</strong><br>
              Provider: ${provider}<br>
              From Email: ${fromEmail}<br>
              From Name: ${fromName}<br>
              Test sent at: ${new Date().toISOString()}
            </div>
            <p><em>This is an automated test email from inteLMS.</em></p>
          `,
          text: `Email Configuration Test Successful!\n\nYour email configuration for ${provider} is working correctly.\n\nProvider: ${provider}\nFrom Email: ${fromEmail}\nFrom Name: ${fromName}\nTest sent at: ${new Date().toISOString()}\n\nThis is an automated test email from inteLMS.`,
          templateType: 'system_test',
          // customSettings property doesn't exist in EmailSendParams - removed
        });

        if (testResult.success) {
          res.json({
            success: true,
            message: 'Test email sent successfully! Check your inbox.',
            provider,
            sentAt: new Date().toISOString()
          });
        } else {
          res.json({
            success: false,
            message: 'Failed to send test email',
            error: testResult.error || 'Unknown error occurred'
          });
        }
      } catch (emailError: any) {
        console.error('Email test failed:', emailError);
        res.json({
          success: false,
          message: 'Email configuration test failed',
          error: emailError.message || 'Unknown error occurred'
        });
      }
    } catch (error) {
      console.error('Error testing email config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test email configuration'
      });
    }
  });

  // ========================================================================================
  // COMPREHENSIVE EMAIL TEST ENDPOINT - Provider-Agnostic Email Testing
  // Supports: SMTP Generic, SendGrid, Brevo, Mailgun, Postmark, Mailjet, SparkPost
  // ========================================================================================
  app.post('/api/admin/email/test', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      // Allow both superadmin and admin access
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied - admin privileges required' });
      }

      const { testEmail } = req.body;

      // Validate test email is provided and valid
      if (!testEmail) {
        return res.status(400).json({ message: 'Test email address is required' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmail)) {
        return res.status(400).json({ message: 'Invalid test email address format' });
      }

      // Determine organization context
      // SuperAdmin tests platform-level settings unless specific orgId provided
      // Admin tests their own organization settings
      let orgId: string | undefined;
      
      if (user.role === 'admin') {
        // Admin can only test their own organization
        if (!user.organisationId) {
          return res.status(400).json({ message: 'Admin user not associated with an organization' });
        }
        orgId = user.organisationId;
      } else if (user.role === 'superadmin') {
        // SuperAdmin can test platform-level (orgId = undefined) or specific org
        orgId = req.body.orgId; // Optional - if provided, test that org's settings
      }

      console.log(`📧 Email Test Request: ${testEmail} (by ${user.email}, context: ${orgId ? `org-${orgId}` : 'platform'})`);

      // STEP 1: Resolve effective settings and display configuration info
      const resolved = await mailerService.resolveEffectiveSettings(orgId);
      
      if (!resolved.settings) {
        return res.json({
          success: false,
          step: 'configuration',
          provider: 'none',
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Email not configured. Configure email settings at organization or platform level.',
            details: 'No valid email configuration found for the requested context.'
          },
          diagnostics: {
            context: orgId ? `Organization ${orgId}` : 'Platform level',
            effectiveSettings: null,
            fieldSources: {},
            timestamp: new Date().toISOString()
          }
        });
      }

      const settings = resolved.settings;
      console.log(`📧 Using ${settings.provider} provider with settings from ${resolved.source}`);

      // STEP 2: Perform health check first
      console.log(`🔍 Running health check for ${settings.provider}...`);
      
      const healthResult = await (mailerService as any).adapters.get(settings.provider)?.healthCheck(settings);
      
      if (!healthResult?.success) {
        return res.json({
          success: false,
          step: 'health_check',
          provider: settings.provider,
          error: {
            code: healthResult?.error?.code || 'HEALTH_CHECK_FAILED',
            message: healthResult?.error?.short || 'Health check failed',
            details: healthResult?.error?.raw || 'Provider connectivity test failed'
          },
          diagnostics: {
            context: orgId ? `Organization ${orgId}` : 'Platform level',
            provider: settings.provider,
            endpoint: healthResult?.endpoint,
            httpStatus: healthResult?.httpStatus,
            effectiveSettings: {
              provider: settings.provider,
              fromEmail: settings.fromEmail,
              fromName: settings.fromName,
              ...(settings.smtpHost && { 
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort 
              }),
              ...(settings.apiKey && { 
                apiKeyPreview: `${settings.apiKey.substring(0, 4)}...${settings.apiKey.substring(settings.apiKey.length - 4)}`,
                apiKeyLength: settings.apiKey.length
              }),
              ...(settings.apiDomain && { apiDomain: settings.apiDomain }),
              ...(settings.apiRegion && { apiRegion: settings.apiRegion })
            },
            fieldSources: resolved.sourceMap,
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log(`✅ Health check passed for ${settings.provider}`);

      // STEP 3: Send actual test email
      console.log(`📧 Sending test email via ${settings.provider}...`);
      
      const emailResult = await mailerService.send({
        orgId,
        to: testEmail,
        subject: `✅ Email Test - ${settings.provider.toUpperCase()} via inteLMS`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">✅ Email Test Successful</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Provider: ${settings.provider.toUpperCase()}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-top: none;">
              <h2 style="color: #495057; margin-top: 0;">Test Details</h2>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="background: white;">
                  <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Provider</td>
                  <td style="padding: 8px; border: 1px solid #dee2e6;">${settings.provider.replace('_', ' ').toUpperCase()}</td>
                </tr>
                <tr style="background: #f8f9fa;">
                  <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">From Email</td>
                  <td style="padding: 8px; border: 1px solid #dee2e6;">${settings.fromEmail}</td>
                </tr>
                <tr style="background: white;">
                  <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">From Name</td>
                  <td style="padding: 8px; border: 1px solid #dee2e6;">${settings.fromName}</td>
                </tr>
                <tr style="background: #f8f9fa;">
                  <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Context</td>
                  <td style="padding: 8px; border: 1px solid #dee2e6;">${orgId ? `Organization ${orgId}` : 'Platform Level'}</td>
                </tr>
                <tr style="background: white;">
                  <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Settings Source</td>
                  <td style="padding: 8px; border: 1px solid #dee2e6;">${resolved.source === 'org' ? 'Organization Override' : 'Platform Default'}</td>
                </tr>
                <tr style="background: #f8f9fa;">
                  <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Timestamp</td>
                  <td style="padding: 8px; border: 1px solid #dee2e6;">${new Date().toLocaleString()}</td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
                If you received this email, your inteLMS email configuration is working correctly. 
                This test was initiated by ${user.email}.
              </p>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 0 0 8px 8px; border: 1px solid #bbdefb; border-top: none; text-align: center;">
              <p style="margin: 0; color: #1976d2; font-size: 14px;">
                🚀 Powered by inteLMS Email Service
              </p>
            </div>
          </div>
        `,
        text: `✅ Email Test Successful

Provider: ${settings.provider.toUpperCase()}
From: ${settings.fromName} <${settings.fromEmail}>
Context: ${orgId ? `Organization ${orgId}` : 'Platform Level'}
Settings Source: ${resolved.source === 'org' ? 'Organization Override' : 'Platform Default'}
Timestamp: ${new Date().toLocaleString()}

If you received this email, your inteLMS email configuration is working correctly.
This test was initiated by ${user.email}.

🚀 Powered by inteLMS Email Service`,
        templateType: 'smtp_test'
      });

      if (emailResult.success) {
        console.log(`✅ Test email sent successfully via ${settings.provider}: ${emailResult.details.messageId}`);
        
        return res.json({
          success: true,
          step: 'sent',
          provider: settings.provider,
          message: `Test email sent successfully via ${settings.provider.replace('_', ' ').toUpperCase()}`,
          diagnostics: {
            context: orgId ? `Organization ${orgId}` : 'Platform level',
            provider: settings.provider,
            endpoint: emailResult.endpoint,
            httpStatus: emailResult.httpStatus,
            smtpStatus: emailResult.smtpStatus,
            messageId: emailResult.details.messageId,
            effectiveSettings: {
              provider: settings.provider,
              fromEmail: settings.fromEmail,
              fromName: settings.fromName,
              ...(settings.smtpHost && { 
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort,
                tls: emailResult.details.tls
              }),
              ...(settings.apiKey && { 
                apiKeyPreview: emailResult.details.keyPreview,
                apiKeyLength: emailResult.details.keyLength
              }),
              ...(settings.apiDomain && { apiDomain: settings.apiDomain }),
              ...(settings.apiRegion && { apiRegion: settings.apiRegion })
            },
            fieldSources: emailResult.details.effectiveFieldSources,
            timestamp: emailResult.details.timestamp
          }
        });
      } else {
        console.log(`❌ Test email failed via ${settings.provider}: ${emailResult.error?.short}`);
        
        return res.json({
          success: false,
          step: 'send',
          provider: settings.provider,
          error: {
            code: emailResult.error?.code || 'SEND_FAILED',
            message: emailResult.error?.short || 'Email send failed',
            details: emailResult.error?.raw || 'Unknown error occurred during email send'
          },
          diagnostics: {
            context: orgId ? `Organization ${orgId}` : 'Platform level',
            provider: settings.provider,
            endpoint: emailResult.endpoint,
            httpStatus: emailResult.httpStatus,
            smtpStatus: emailResult.smtpStatus,
            effectiveSettings: {
              provider: settings.provider,
              fromEmail: settings.fromEmail,
              fromName: settings.fromName,
              ...(settings.smtpHost && { 
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort
              }),
              ...(settings.apiKey && { 
                apiKeyPreview: emailResult.details.keyPreview,
                apiKeyLength: emailResult.details.keyLength
              }),
              ...(settings.apiDomain && { apiDomain: settings.apiDomain }),
              ...(settings.apiRegion && { apiRegion: settings.apiRegion })
            },
            fieldSources: emailResult.details.effectiveFieldSources,
            timestamp: emailResult.details.timestamp
          }
        });
      }

    } catch (error: any) {
      console.error('❌ Email test endpoint error:', error);
      
      return res.status(500).json({
        success: false,
        step: 'error',
        provider: 'unknown',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during email test',
          details: error.message || 'Unknown error occurred'
        },
        diagnostics: {
          context: 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Users routes
  app.get('/api/users', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      let users;
      if (user.role === 'superadmin') {
        // SuperAdmin can see all users
        const { role, organisationId, status, search } = req.query;
        users = await storage.getUsersWithFilters({ role, organisationId, status, search });
      } else if (user.role === 'admin' && user.organisationId) {
        // Admin can only see regular users (role = 'user') from their organisation, filtering out admin/superadmin accounts
        users = await storage.getUsersWithFilters({ 
          organisationId: user.organisationId,
          role: 'user'
        });
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Update user status (deactivate/activate)
  app.patch('/api/users/:id/status', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      const { id } = req.params;
      const { status } = req.body;

      if (!currentUser) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Only SuperAdmin and Admin can update user status
      if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get target user and validate modification permissions
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Use RBAC helper to check modification permissions
      const permission = await canUserModifyTarget(currentUser, targetUser);
      if (!permission.canModify) {
        return res.status(403).json({ message: permission.error });
      }

      // Validate status
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be active or inactive.' });
      }

      // Check license capacity if activating user  
      if (status === 'active' && targetUser.status !== 'active') {
        const licenseCheck = await checkLicenseCapacity(currentUser.id, 1);
        if (!licenseCheck.canProceed) {
          return res.status(403).json({ 
            message: licenseCheck.error,
            code: 'LICENSE_LIMIT_EXCEEDED'
          });
        }
      }

      const updatedUser = await storage.updateUser(id, { status });
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ message: 'Failed to update user status' });
    }
  });

  // Delete user
  app.delete('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      const { id } = req.params;

      if (!currentUser) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Only SuperAdmin and Admin can delete users
      if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get the target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Use RBAC helper to check modification permissions (includes self-deletion protection)
      const permission = await canUserModifyTarget(currentUser, targetUser);
      if (!permission.canModify) {
        return res.status(403).json({ message: permission.error });
      }

      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Bulk update users
  app.patch('/api/users/bulk', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      const { userIds, action, value } = req.body;

      if (!currentUser) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Only SuperAdmin and Admin can perform bulk operations
      if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required' });
      }

      if (!action) {
        return res.status(400).json({ message: 'Action is required' });
      }

      // Use RBAC helper to validate all target users before processing any
      const targetUsers = [];
      for (const userId of userIds) {
        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: `User not found: ${userId}` });
        }
        
        const permission = await canUserModifyTarget(currentUser, targetUser);
        if (!permission.canModify) {
          return res.status(403).json({ message: `${permission.error}: ${targetUser.email}` });
        }
        
        targetUsers.push(targetUser);
      }

      // Check license capacity if activating users
      if (action === 'status' && value === 'active') {
        const usersToActivate = [];
        for (const userId of userIds) {
          const targetUser = await storage.getUser(userId);
          if (targetUser && targetUser.status !== 'active') {
            usersToActivate.push(userId);
          }
        }
        
        if (usersToActivate.length > 0) {
          const licenseCheck = await checkLicenseCapacity(currentUser.id, usersToActivate.length);
          if (!licenseCheck.canProceed) {
            return res.status(403).json({ 
              message: licenseCheck.error,
              code: 'LICENSE_LIMIT_EXCEEDED'
            });
          }
        }
      }

      const updatedUsers = [];
      
      for (const userId of userIds) {
        try {
          let updatedUser;
          
          switch (action) {
            case 'status':
              updatedUser = await storage.updateUser(userId, { status: value });
              break;
            case 'certificates':
              updatedUser = await storage.updateUser(userId, { allowCertificateDownload: value });
              break;
            default:
              return res.status(400).json({ message: 'Invalid action' });
          }
          
          if (updatedUser) {
            updatedUsers.push(updatedUser);
          }
        } catch (error) {
          console.error(`Error updating user ${userId}:`, error);
          // Continue with other users even if one fails
        }
      }

      res.json({ 
        message: `Successfully updated ${updatedUsers.length} out of ${userIds.length} users`,
        updatedUsers 
      });
    } catch (error) {
      console.error("Error performing bulk user update:", error);
      res.status(500).json({ message: 'Failed to perform bulk update' });
    }
  });

  app.post('/api/users', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Extract password from request body before validation
      const { password, ...userData } = req.body;
      const validatedData = insertUserSchema.parse(userData);
      
      // If admin, can only create users in their organisation
      if (user.role === 'admin') {
        validatedData.organisationId = user.organisationId;
      }

      // Check license capacity if creating an active user
      if (validatedData.status === 'active') {
        const licenseCheck = await checkLicenseCapacity(user.id, 1);
        if (!licenseCheck.canProceed) {
          return res.status(403).json({ 
            message: licenseCheck.error,
            code: 'LICENSE_LIMIT_EXCEEDED'
          });
        }
      }

      // Check admin limit if creating an admin user
      if (validatedData.role === 'admin') {
        const orgId = validatedData.organisationId || user.organisationId;
        if (!orgId) {
          return res.status(400).json({ message: 'Organisation ID is required for admin users' });
        }
        
        const adminLimitCheck = await storage.enforceAdminLimit(orgId);
        if (!adminLimitCheck.allowed) {
          return res.status(403).json({
            message: 'Admin user limit exceeded',
            code: adminLimitCheck.error?.code || 'FEATURE_LOCKED',
            featureKey: adminLimitCheck.error?.featureKey || 'unlimited_admin_accounts',
            maxAllowed: adminLimitCheck.error?.maxAllowed || 1
          });
        }
      }

      // Generate password and hash it
      let userDataWithPassword: any = { ...validatedData };
      let actualPassword = password;
      
      // If no password provided, generate a temporary one
      if (!actualPassword) {
        // Generate a secure temporary password
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        actualPassword = '';
        for (let i = 0; i < 8; i++) {
          actualPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log(`Generated temporary password for ${validatedData.email}: ${actualPassword}`);
      }
      
      // Hash the password (either provided or generated)
      if (actualPassword) {
        if (actualPassword.length < 6) {
          return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        const saltRounds = 10;
        userDataWithPassword.passwordHash = await bcrypt.hash(actualPassword, saltRounds);
        
        // Set requiresPasswordChange to true if this is a generated password (no password was provided originally)
        userDataWithPassword.requiresPasswordChange = !password; // true if password was auto-generated
      }
      
      // Store the password for email context (use actualPassword instead of original password)
      const passwordForEmail = actualPassword;

      const newUser = await storage.createUser(userDataWithPassword);
      
      // Send notifications for new user creation
      if (newUser.organisationId) {
        try {
          if (newUser.role === 'admin') {
            await emailNotificationService.notifyNewAdminAdded(
              newUser.organisationId,
              newUser.id,
              user.id
            );
          } else if (newUser.role === 'user') {
            await emailNotificationService.notifyNewUserAdded(
              newUser.organisationId,
              newUser.id,
              user.id
            );
          }
        } catch (error) {
          console.error('[User Creation] Failed to send user notification:', error);
          // Don't break user creation flow on notification failure
        }
      }
      
      // Send welcome email using EmailOrchestrator if EMAIL_TEMPLATES_V2 is enabled
      if (EMAIL_TEMPLATES_V2_ENABLED) {
        try {
          // Get organization info for context
          let orgContext = null;
          if (newUser.organisationId) {
            const organisation = await getOrgById(storage, newUser.organisationId);
            if (organisation) {
              orgContext = {
                name: organisation.name,
                displayName: organisation.displayName || organisation.name
              };
            }
          }

          const context = {
            user: {
              name: `${newUser.firstName} ${newUser.lastName}`,
              email: newUser.email ?? undefined,
              firstName: newUser.firstName ?? undefined,
              lastName: newUser.lastName ?? undefined,
              fullName: `${newUser.firstName} ${newUser.lastName}`
            },
            org: orgContext ?? undefined,
            addedBy: {
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Administrator'
            },
            addedAt: new Date().toISOString(),
            loginUrl: `${process.env.REPLIT_URL || 'http://localhost:5000'}/api/login`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@intellms.app',
            temporaryPassword: passwordForEmail || undefined // Include temporary password for all users
          };

          // Only queue email if user has a valid email address
          if (newUser.email) {
            await emailOrchestrator.queue({
              triggerEvent: 'USER_FAST_ADD',
              templateKey: 'new_user_welcome',
              toEmail: newUser.email,
              context,
              organisationId: newUser.organisationId || undefined,
              resourceId: newUser.id,
              priority: 1
            });
          }
          
          console.log(`✅ USER_FAST_ADD email queued for ${newUser.email} (Admin/SuperAdmin created)`);
        } catch (emailError) {
          console.warn('⚠️ Failed to queue USER_FAST_ADD email:', emailError);
          // Don't fail user creation if email fails
        }
      }
      
      // LEGACY: Send welcome email for admin users with their password
      // TODO: Remove this when EMAIL_TEMPLATES_V2 is fully deployed
      if (!EMAIL_TEMPLATES_V2_ENABLED && validatedData.role === 'admin' && password) {
        try {
          // For admin users, get their organization ID
          const orgId = newUser.organisationId || validatedData.organisationId;
          if (orgId) {
            const organisation = await getOrgById(storage, orgId);
            if (organisation) {
              // TODO: DEPRECATED - Replace with EmailOrchestrator when EMAIL_TEMPLATES_V2 migration is complete
              // This legacy emailService.sendWelcomeEmail will be removed in favor of:
              // await emailOrchestrator.triggerEvent('USER_FAST_ADD', { user: newUser, organisation, password })
              // NOTE: sendWelcomeEmail method doesn't exist on emailService - using mailerService instead
              if (newUser.email) {
                await mailerService.send({
                  to: newUser.email,
                  subject: 'Welcome to your LMS - Account Created',
                  html: `<p>Your account has been created. Email: ${newUser.email}, Password: ${password}</p>`,
                  templateType: 'admin_welcome'
                });
              }
              console.log(`Welcome email sent to admin user: ${newUser.email}`);
            } else {
              console.log(`No organization found for admin user: ${newUser.email}`);
            }
          } else {
            console.log(`No organization ID for admin user: ${newUser.email}`);
          }
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the user creation if email sending fails
        }
      }
      
      // Send new user added notification to organization admins (only for regular users, not admins)
      if (newUser.role !== 'admin' && newUser.role !== 'superadmin' && newUser.organisationId) {
        const organization = await storage.getOrganisation(newUser.organisationId);
        if (organization) {
          const adminEmails = await getOrganizationAdminEmails(organization.id);
          
          await sendMultiRecipientNotification(
            'New User Added',
            adminEmails,
            (adminEmail) => emailTemplateService.sendNewUserNotification(
              adminEmail,
              buildNewUserNotificationData(organization, { name: adminEmail.split('@')[0], email: adminEmail }, newUser, user),
              organization.id
            )
          );
        }
      }
      
      res.status(201).json({ 
        ...newUser, 
        welcomeEmailSent: validatedData.role === 'admin' && password ? true : false 
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Handle duplicate email error
      if (error?.code === '23505' && error?.constraint === 'users_email_unique') {
        return res.status(409).json({ 
          message: 'A user with this email address already exists',
          error: 'DUPLICATE_EMAIL'
        });
      }
      
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  // Update user by ID (for admin updates)
  app.put('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session.user?.id;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      
      // Get the target user to update
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Use RBAC helper to check modification permissions
      const permission = await canUserModifyTarget(currentUser, targetUser);
      if (!permission.canModify) {
        return res.status(403).json({ message: permission.error });
      }

      // Prepare update data - remove any role changes for security
      const updateData: any = {
        ...req.body,
        updatedAt: new Date(),
      };
      
      // Prevent role modification through this endpoint (use dedicated promote/demote endpoints)
      if ('role' in updateData) {
        delete updateData.role;
      }

      // Check license capacity if activating a user
      if (updateData.status === 'active' && targetUser.status !== 'active') {
        const licenseCheck = await checkLicenseCapacity(currentUser.id, 1);
        if (!licenseCheck.canProceed) {
          return res.status(403).json({ 
            message: licenseCheck.error,
            code: 'LICENSE_LIMIT_EXCEEDED'
          });
        }
      }

      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // Create individual assignments
  app.post('/api/assignments', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { courseId, userId, organisationId, dueDate, notificationsEnabled, assignedBy } = req.body;

      if (!courseId || !userId) {
        return res.status(400).json({ message: 'Course ID and User ID are required' });
      }

      // Verify the course exists
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Verify the user exists and is in the right organization (for admins)
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // If admin, can only assign to users in their organisation
      if (currentUser.role === 'admin') {
        if (targetUser.organisationId !== currentUser.organisationId) {
          return res.status(403).json({ message: 'Access denied: User not in your organization' });
        }
      }

      // RACE CONDITION FIX: Create assignment data first, then handle duplicate constraint
      const assignmentData = {
        courseId,
        userId,
        organisationId: organisationId || currentUser.organisationId,
        assignedBy: assignedBy || currentUser.id,
        status: 'not_started' as const,
        dueDate: dueDate ? new Date(dueDate) : null,
        notificationsEnabled: notificationsEnabled || true
      };

      let assignment;
      try {
        // Try to create the assignment - database unique constraint will prevent duplicates
        assignment = await storage.createAssignment(assignmentData);
      } catch (error: any) {
        // Handle unique constraint violation (duplicate assignment)
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          console.log(`🔄 Duplicate assignment detected for user ${userId} and course ${courseId}, checking existing assignment`);
          const existingAssignment = await storage.getExistingAssignment(courseId, userId);
          if (existingAssignment) {
            return res.status(409).json({ 
              message: `This user is already assigned to ${course.title}. Cannot assign duplicate courses.`,
              error: 'DUPLICATE_ASSIGNMENT',
              existingAssignmentId: existingAssignment.id
            });
          }
        }
        // Re-throw other errors
        throw error;
      }
      
      // Send course assignment email using EmailOrchestrator if EMAIL_TEMPLATES_V2 is enabled
      if (EMAIL_TEMPLATES_V2_ENABLED) {
        try {
          const organisation = assignment.organisationId ? await storage.getOrganisation(assignment.organisationId) : null;
          const context = {
            user: {
              name: `${targetUser.firstName} ${targetUser.lastName}`,
              email: targetUser.email ?? undefined,
              firstName: targetUser.firstName ?? undefined,
              lastName: targetUser.lastName ?? undefined,
              fullName: `${targetUser.firstName} ${targetUser.lastName}`
            },
            course: {
              title: course.title,
              description: course.description ?? undefined,
              estimatedDuration: course.estimatedDuration
            },
            org: organisation ? {
              name: organisation.name,
              displayName: organisation.displayName || organisation.name
            } : undefined,
            assignedBy: {
              name: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Administrator'
            },
            assignedAt: new Date().toISOString(),
            dueDate: assignmentData.dueDate?.toISOString() || undefined,
            courseUrl: `${process.env.REPLIT_URL || 'http://localhost:5000'}/course/${courseId}`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@intellms.app'
          };

          // Only queue email if user has a valid email address
          if (targetUser.email) {
            await emailOrchestrator.queue({
              triggerEvent: 'COURSE_ASSIGNED',
              templateKey: 'course_assigned',
              toEmail: targetUser.email,
              context,
              organisationId: assignment.organisationId || undefined,
              priority: 2,
              resourceId: `COURSE_ASSIGNED:${targetUser.email}:${courseId}:${assignment.id}`
            });
          }
          
          console.log(`✅ COURSE_ASSIGNED email queued for ${targetUser.email} (Individual assignment: ${course.title})`);
        } catch (emailError) {
          console.warn('⚠️ Failed to queue COURSE_ASSIGNED email:', emailError);
          // Don't fail assignment if email fails
        }
      }
      
      // LEGACY: Send course assignment notification to organization admins
      // TODO: Remove this when EMAIL_TEMPLATES_V2 is fully deployed
      if (!EMAIL_TEMPLATES_V2_ENABLED && assignment.organisationId) {
        const organization = await storage.getOrganisation(assignment.organisationId);
        if (organization) {
          const adminEmails = await getOrganizationAdminEmails(organization.id);
          
          await sendMultiRecipientNotification(
            'Course Assignment',
            adminEmails,
            (adminEmail) => emailTemplateService.sendCourseAssignedNotification(
              adminEmail,
              buildCourseAssignedNotificationData(organization, { name: adminEmail.split('@')[0], email: adminEmail }, targetUser, course, currentUser, assignment.dueDate?.toISOString()),
              organization.id
            )
          );
        }
      }
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  // Clean up duplicate assignments (SUPERADMIN ONLY - global operation)
  app.delete('/api/assignments/duplicates', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      
      // SECURITY: Restrict to SUPERADMIN only - this is a GLOBAL operation that affects ALL organizations
      if (!currentUser || currentUser.role !== 'superadmin') {
        return res.status(403).json({ 
          message: 'Access denied - SuperAdmin privileges required',
          reason: 'Duplicate cleanup is a global system operation'
        });
      }

      // Find and remove duplicate assignments
      const duplicateGroups = await storage.findDuplicateAssignments();
      
      if (duplicateGroups.length === 0) {
        return res.json({ 
          message: 'No duplicate assignments found',
          duplicatesRemoved: 0,
          duplicateGroups: 0
        });
      }

      // Remove duplicate assignments (keeping earliest ones)
      const result = await storage.removeDuplicateAssignments();
      
      console.log(`✅ Duplicate cleanup completed: ${result.duplicatesRemoved} duplicates removed from ${result.duplicateGroups} groups`);
      
      res.json({ 
        message: `Successfully removed ${result.duplicatesRemoved} duplicate assignments from ${result.duplicateGroups} groups`,
        duplicatesRemoved: result.duplicatesRemoved,
        duplicateGroups: result.duplicateGroups,
        details: duplicateGroups.map(group => ({
          courseId: group.courseId,
          userId: group.userId,
          duplicatesFound: group.count,
          duplicatesRemoved: group.duplicateIds.length
        }))
      });
    } catch (error) {
      console.error('Error cleaning up duplicate assignments:', error);
      res.status(500).json({ message: 'Failed to clean up duplicate assignments' });
    }
  });

  // Clean up duplicate assignments within organization (ADMIN safe - organization-scoped)
  app.delete('/api/assignments/duplicates/organization', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // For admin users, use their organization. For superadmin, allow specifying organization
      const organisationId = currentUser.role === 'superadmin' && req.query.organisationId 
        ? req.query.organisationId as string 
        : currentUser.organisationId;

      if (!organisationId) {
        return res.status(400).json({ 
          message: 'Organization ID required',
          reason: 'Cannot determine target organization for cleanup operation'
        });
      }

      // Find and remove duplicate assignments within the organization
      const duplicateGroups = await storage.findDuplicateAssignmentsByOrganisation(organisationId);
      
      if (duplicateGroups.length === 0) {
        return res.json({ 
          message: 'No duplicate assignments found in this organization',
          duplicatesRemoved: 0,
          duplicateGroups: 0
        });
      }

      // Remove duplicate assignments within the organization (keeping earliest ones)
      const result = await storage.removeDuplicateAssignmentsByOrganisation(organisationId);
      
      console.log(`✅ Organization-scoped duplicate cleanup completed for org ${organisationId}: ${result.duplicatesRemoved} duplicates removed from ${result.duplicateGroups} groups`);
      
      res.json({ 
        message: `Successfully removed ${result.duplicatesRemoved} duplicate assignments from ${result.duplicateGroups} groups in your organization`,
        duplicatesRemoved: result.duplicatesRemoved,
        duplicateGroups: result.duplicateGroups,
        organisationId,
        details: duplicateGroups.map(group => ({
          courseId: group.courseId,
          userId: group.userId,
          duplicatesFound: group.count,
          duplicatesRemoved: group.duplicateIds.length
        }))
      });
    } catch (error) {
      console.error('Error cleaning up organization duplicate assignments:', error);
      res.status(500).json({ message: 'Failed to clean up duplicate assignments' });
    }
  });

  // Get admin users for organization
  app.get('/api/admin/admin-users/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session.user?.id;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisationId = req.params.organisationId;
      
      // Admin can only view admin users for their own organization
      if (currentUser.role === 'admin' && currentUser.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get all admin and superadmin users for the organization
      const adminUsers = await storage.getUsersWithFilters({
        organisationId,
        role: ['admin', 'superadmin']
      });

      res.json(adminUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: 'Failed to fetch admin users' });
    }
  });

  // Promote user to admin
  app.post('/api/admin/promote-user/:userId', requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session.user?.id;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Admin can only promote users within their organization
      if (currentUser.role === 'admin') {
        if (targetUser.organisationId !== currentUser.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Cannot promote superadmins or existing admins
      if (targetUser.role === 'superadmin' || targetUser.role === 'admin') {
        return res.status(400).json({ message: 'User is already an administrator' });
      }

      // Check admin limit before promoting
      const orgId = targetUser.organisationId;
      if (!orgId) {
        return res.status(400).json({ message: 'User must be associated with an organisation' });
      }
      
      const adminLimitCheck = await storage.enforceAdminLimit(orgId);
      if (!adminLimitCheck.allowed) {
        return res.status(403).json({
          message: 'Admin user limit exceeded',
          code: adminLimitCheck.error?.code || 'FEATURE_LOCKED',
          featureKey: adminLimitCheck.error?.featureKey || 'unlimited_admin_accounts',
          maxAllowed: adminLimitCheck.error?.maxAllowed || 1
        });
      }

      const updatedUser = await storage.updateUser(userId, { role: 'admin' });
      
      // Send new admin added notification using EmailNotificationService
      try {
        await emailNotificationService.notifyNewAdminAdded(
          targetUser.organisationId!,
          updatedUser.id,
          currentUser.id
        );
      } catch (error) {
        console.error('[User Promotion] Failed to send admin notification:', error);
        // Don't break promotion flow on notification failure
      }
      
      res.json({ message: 'User promoted to admin successfully', user: updatedUser });
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      res.status(500).json({ message: 'Failed to promote user to admin' });
    }
  });

  // Remove admin privileges (demote to user)
  app.post('/api/admin/demote-user/:userId', requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session.user?.id;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Admin can only demote users within their organization
      if (currentUser.role === 'admin') {
        if (targetUser.organisationId !== currentUser.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Cannot demote yourself
      if (targetUser.id === currentUser.id) {
        return res.status(400).json({ message: 'Cannot remove your own admin privileges' });
      }

      // Cannot demote superadmins unless you are a superadmin
      if (targetUser.role === 'superadmin' && currentUser.role !== 'superadmin') {
        return res.status(403).json({ message: 'Cannot demote superadmin users' });
      }

      // Cannot demote if not an admin
      if (targetUser.role !== 'admin' && targetUser.role !== 'superadmin') {
        return res.status(400).json({ message: 'User is not an administrator' });
      }

      const updatedUser = await storage.updateUser(userId, { role: 'user' });
      res.json({ message: 'Admin privileges removed successfully', user: updatedUser });
    } catch (error) {
      console.error('Error demoting admin user:', error);
      res.status(500).json({ message: 'Failed to remove admin privileges' });
    }
  });

  // Get overdue assignments count
  app.get('/api/admin/overdue-count/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const organisationId = req.params.organisationId;
      const now = new Date();
      
      // Get all assignments for the organisation
      const assignments = await storage.getAssignmentsByOrganisation(organisationId);
      
      // Get all users for the organisation to filter by active status
      const users = await storage.getUsersByOrganisation(organisationId);
      const activeUserIds = new Set(users.filter(user => user.status === 'active').map(user => user.id));
      
      // Count overdue assignments (due date passed or status is overdue) for ACTIVE users only
      const overdueCount = assignments.filter(assignment => {
        // Only count assignments for active users
        if (!activeUserIds.has(assignment.userId)) {
          return false;
        }
        
        if (assignment.status === 'overdue') {
          return true;
        }
        if (assignment.dueDate) {
          const dueDate = new Date(assignment.dueDate);
          return dueDate < now && assignment.status !== 'completed';
        }
        return false;
      }).length;
      
      res.json({ overdueCount });
    } catch (error) {
      console.error('Error fetching overdue count:', error);
      res.status(500).json({ message: 'Failed to fetch overdue count' });
    }
  });

  // Get expiring training data
  app.get('/api/admin/expiring-training/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisationId = req.params.organisationId;
      
      // For admins, ensure they can only access their own organisation's data
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied: Cannot access other organisation data' });
      }

      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(now.getDate() + 90);
      
      // Get all assignments for the organisation
      const assignments = await storage.getAssignmentsByOrganisation(organisationId);
      
      // Get all users for the organisation
      const users = await storage.getUsersByOrganisation(organisationId);
      const activeUsers = users.filter(u => u.status === 'active' && u.role === 'user');
      
      // Get all courses
      const courses = await storage.getAllCourses();
      
      // Get all completions
      const completions = await storage.getCompletionsByOrganisation(organisationId);
      
      const expiringTraining = [];
      
      for (const assignment of assignments) {
        // Skip if assignment is already completed
        if (assignment.status === 'completed') continue;
        
        const user = activeUsers.find(u => u.id === assignment.userId);
        const course = courses.find(c => c.id === assignment.courseId);
        
        if (!user || !course) continue;
        
        // Check if user has any completions for this course
        const userCompletions = completions.filter(c => 
          c.userId === assignment.userId && 
          c.courseId === assignment.courseId &&
          c.status === 'pass'
        );
        
        const latestCompletion = userCompletions.sort((a, b) => 
          new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
        )[0];
        
        let daysUntilDue = null;
        let isExpiring = false;
        
        if (latestCompletion && course.certificateExpiryPeriod) {
          // Course is completed but might be expiring
          const completionDate = new Date(latestCompletion.completedAt!);
          const expiryDate = new Date(completionDate);
          expiryDate.setMonth(expiryDate.getMonth() + course.certificateExpiryPeriod);
          
          if (expiryDate <= ninetyDaysFromNow) {
            daysUntilDue = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            isExpiring = true;
          }
        } else if (!latestCompletion && assignment.dueDate) {
          // Course is not completed and has a due date
          const dueDate = new Date(assignment.dueDate);
          if (dueDate <= ninetyDaysFromNow) {
            daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            isExpiring = true;
          }
        }
        
        if (isExpiring && daysUntilDue !== null) {
          expiringTraining.push({
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            courseId: course.id,
            courseTitle: course.title,
            dueDate: latestCompletion && course.certificateExpiryPeriod ? 
              new Date(new Date(latestCompletion.completedAt!).setMonth(
                new Date(latestCompletion.completedAt!).getMonth() + course.certificateExpiryPeriod
              )).toISOString() : 
              assignment.dueDate,
            daysUntilDue,
            isExpiry: !!latestCompletion
          });
        }
      }
      
      res.json(expiringTraining);
    } catch (error) {
      console.error('Error fetching expiring training:', error);
      res.status(500).json({ message: 'Failed to fetch expiring training' });
    }
  });

  // Get recent completions for admin dashboard
  app.get('/api/admin/recent-completions/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisationId = req.params.organisationId;
      
      // For admins, ensure they can only access their own organisation's data
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied: Cannot access other organisation data' });
      }

      // Get all users for the organisation
      const users = await storage.getUsersByOrganisation(organisationId);
      const userMap = new Map(users.map(u => [u.id, u]));
      
      // Get all courses
      const courses = await storage.getAllCourses();
      const courseMap = new Map(courses.map(c => [c.id, c]));
      
      // Get recent completions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const allCompletions = await storage.getCompletionsByOrganisation(organisationId);
      const recentCompletions = allCompletions
        .filter(completion => {
          const user = userMap.get(completion.userId);
          const completionDate = new Date(completion.completedAt!);
          return user && 
                 user.organisationId === organisationId && 
                 completion.status === 'pass' && 
                 completionDate >= thirtyDaysAgo;
        })
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 3)
        .map(completion => {
          const user = userMap.get(completion.userId);
          const course = courseMap.get(completion.courseId);
          return {
            id: completion.id,
            userId: completion.userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
            courseTitle: course?.title || 'Unknown Course',
            score: completion.score ? parseFloat(completion.score) : 0,
            completedAt: completion.completedAt
          };
        });
      
      res.json(recentCompletions);
    } catch (error) {
      console.error('Error fetching recent completions:', error);
      res.status(500).json({ message: 'Failed to fetch recent completions' });
    }
  });

  // Get analytics/completions data for admin dashboard  
  app.get('/api/admin/analytics/completions/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisationId = req.params.organisationId;
      
      // For admins, ensure they can only access their own organisation's data
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied: Cannot access other organisation data' });
      }

      // Get completion analytics for this organisation
      const organisationCompletions = await storage.getCompletionsByOrganisation(organisationId);
      const users = await storage.getUsersByOrganisation(organisationId);
      const userIds = users.map(u => u.id);
      
      // Filter completions by organisation users and format for chart
      const completionAnalytics = await storage.getCompletionAnalytics();
      const filteredAnalytics = completionAnalytics.map(monthData => ({
        ...monthData,
        // This would need to be properly filtered in a real implementation
        // For now, return the data as-is since getCompletionAnalytics may already handle filtering
      }));
      
      res.json(filteredAnalytics);
    } catch (error) {
      console.error('Error fetching completion analytics:', error);
      res.status(500).json({ message: 'Failed to fetch completion analytics' });
    }
  });

  // Audit Log API (Admin access with feature check)
  app.get('/api/admin/audit-logs/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisationId = req.params.organisationId;
      
      // For admins, ensure they can only access their own organisation's data
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied: Cannot access other organisation data' });
      }

      // Get organisation to check plan features
      const organisation = await storage.getOrganisation(organisationId);
      if (!organisation) {
        return res.status(404).json({ message: 'Organisation not found' });
      }

      // Check if audit log feature is enabled for the organisation's plan
      const hasAuditLogAccess = await hasFeatureAccess(organisationId, 'audit_log');
      if (!hasAuditLogAccess) {
        return res.status(403).json({ message: 'Audit log feature not available for your plan' });
      }

      // Get pagination parameters
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Fetch audit logs for the organisation
      const auditLogs = await storage.getAuditLogs(organisationId, limit, offset);
      
      res.json(auditLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  });

  // Create audit log entry (internal use)
  app.post('/api/admin/audit-logs', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { organisationId, action, resource, resourceId, details } = req.body;
      
      // For admins, ensure they can only create logs for their own organisation
      if (user.role === 'admin' && user.organisationId !== organisationId) {
        return res.status(403).json({ message: 'Access denied: Cannot create logs for other organisation' });
      }

      // Create audit log entry
      const auditLog = await storage.createAuditLog({
        organisationId,
        userId: user.id,
        action,
        resource,
        resourceId,
        details: details || '',
        ipAddress: req.ip || req.connection.remoteAddress || '',
        userAgent: req.get('User-Agent') || '',
      });
      
      res.status(201).json(auditLog);
    } catch (error) {
      console.error('Error creating audit log:', error);
      res.status(500).json({ message: 'Failed to create audit log' });
    }
  });

  // Get training matrix data
  app.get('/api/training-matrix', requireAuth, async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      
      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const organisationId = currentUser.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: 'Organisation ID required' });
      }

      // Extract filter parameters
      const { departments, roles, courses: coursesQuery, statuses, staff: staffFilter, mandatoryOnly } = req.query;
      const departmentFilter = departments ? departments.split(',') : [];
      const roleFilter = roles ? roles.split(',') : [];
      const courseFilter = coursesQuery ? coursesQuery.split(',') : [];
      const statusFilter = statuses ? statuses.split(',') : [];
      const staffIdFilter = staffFilter ? staffFilter.split(',') : [];
      const mandatoryOnlyFilter = mandatoryOnly === 'true';

      // Get all staff members in the organisation
      const staff = await storage.getUsersByOrganisation(organisationId);
      let activeStaff = staff.filter(u => u.status === 'active' && u.role === 'user');

      // Apply staff filter
      if (staffIdFilter.length > 0) {
        activeStaff = activeStaff.filter(s => staffIdFilter.includes(s.id));
      }

      // Apply department filter
      if (departmentFilter.length > 0) {
        activeStaff = activeStaff.filter(s => s.department && departmentFilter.includes(s.department));
      }

      // Apply role/job title filter (treating jobTitle as role)
      if (roleFilter.length > 0) {
        activeStaff = activeStaff.filter(s => s.jobTitle && roleFilter.includes(s.jobTitle));
      }

      // Get all courses assigned to users in this organisation
      const assignments = await storage.getAssignmentsByOrganisation(organisationId);
      let courseIds = Array.from(new Set(assignments.map(a => a.courseId)));
      
      const courses = await Promise.all(
        courseIds.map(async (courseId) => {
          return await storage.getCourse(courseId);
        })
      );
      let validCourses = courses.filter((c): c is NonNullable<typeof c> => Boolean(c));

      // Apply course filter
      if (courseFilter.length > 0) {
        validCourses = validCourses.filter(c => courseFilter.includes(c.id));
      }

      // Get all completions for this organisation
      const completions = await storage.getCompletionsByOrganisation(organisationId);
      
      // Get all certificates for this organisation
      const certificates = await storage.getCertificatesByOrganisation(organisationId);
      
      // Get all SCORM attempts for this organisation to show attempt status
      const scormAttempts = await storage.getScormAttemptsByOrganisation(organisationId);

      // Calculate matrix data only for filtered staff and courses
      const matrix: any[][] = [];
      const summary = { red: 0, amber: 0, green: 0, grey: 0, blue: 0, failed: 0 };

      // Current date for expiry calculations (Europe/London timezone)
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      // Build matrix for filtered staff and courses
      for (const staffMember of activeStaff) {
        const staffRow: any[] = [];
        
        for (const course of validCourses) {
          // Find assignment for this staff member and course
          const assignment = assignments.find(a => 
            a.userId === staffMember.id && a.courseId === course.id
          );

          if (!assignment) {
            // No assignment - blank cell
            staffRow.push({
              status: 'blank',
              label: '-',
              attemptCount: 0
            });
            continue;
          }

          // Find latest successful completion
          const userCompletions = completions.filter(c => 
            c.userId === staffMember.id && 
            c.courseId === course.id &&
            c.status === 'pass'
          );
          
          const latestCompletion = userCompletions.sort((a, b) => 
            new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
          )[0];

          // Check for failed attempts
          const failedCompletions = completions.filter(c => 
            c.userId === staffMember.id && 
            c.courseId === course.id &&
            c.status === 'fail'
          );

          const latestFailedCompletion = failedCompletions.sort((a, b) => 
            new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
          )[0];

          // If there are failed attempts but no successful completion, show failed status
          if (!latestCompletion && latestFailedCompletion) {
            staffRow.push({
              status: 'failed',
              label: 'Failed',
              score: latestFailedCompletion.score ? parseFloat(latestFailedCompletion.score) : null,
              completionDate: new Date(latestFailedCompletion.completedAt!).toLocaleDateString('en-GB'),
              attemptCount: completions.filter(c => 
                c.userId === staffMember.id && c.courseId === course.id
              ).length,
              assignmentId: assignment.id,
              completionId: latestFailedCompletion.id
            });
            
            // Update summary counts for failed attempts
            if (!summary.failed) summary.failed = 0;
            summary.failed++;
            continue;
          }

          if (!latestCompletion) {
            // Not completed - check SCORM attempt status and assignment due date
            // Only consider active attempts for training matrix status
            const userAttempts = scormAttempts.filter(a => 
              a.userId === staffMember.id && 
              a.courseId === course.id &&
              a.isActive // Only active attempts
            );
            
            // Only log when there are discrepancies for debugging
            const allUserAttempts = scormAttempts.filter(a => 
              a.userId === staffMember.id && a.courseId === course.id
            );
            
            if (allUserAttempts.length > 0 && userAttempts.length !== allUserAttempts.length) {
              console.log(`🎯 Training Matrix - Found inactive attempts for ${staffMember.firstName} ${staffMember.lastName}:`, {
                totalAttempts: allUserAttempts.length,
                activeAttempts: userAttempts.length,
                courseTitle: course.title
              });
            }
            
            const latestAttempt = userAttempts.sort((a, b) => 
              new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
            )[0];
            
            const now = new Date();
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(now.getDate() + 7);
            
            let cellStatus: 'red' | 'amber' | 'blue' | 'grey' | 'failed';
            let cellLabel: string;
            
            // Check SCORM attempt status first for accurate lifecycle tracking
            if (latestAttempt) {
              if (latestAttempt.status === 'completed') {
                // This shouldn't happen as we already checked for completions above
                cellStatus = 'grey';
                cellLabel = 'Completed';
              } else if (latestAttempt.status === 'in_progress') {
                cellStatus = 'blue';
                cellLabel = 'In Progress';
              } else {
                // not_started or abandoned
                cellStatus = 'grey';
                cellLabel = 'Not Started';
              }
            } else {
              // No attempt yet - check assignment status and due date
              if (assignment.status === 'overdue') {
                cellStatus = 'red';
                cellLabel = 'Overdue';
              } else {
                // Check due date for assignments that aren't overdue
                if (assignment.dueDate) {
                  const dueDate = new Date(assignment.dueDate);
                  if (dueDate < now) {
                    cellStatus = 'red';
                    cellLabel = 'Overdue';
                  } else if (dueDate <= sevenDaysFromNow) {
                    cellStatus = 'amber';
                    cellLabel = 'Due Soon';
                  } else {
                    cellStatus = 'grey';
                    cellLabel = 'Not Started';
                  }
                } else {
                  cellStatus = 'grey';
                  cellLabel = 'Not Started';
                }
              }
            }
            
            staffRow.push({
              status: cellStatus,
              label: cellLabel,
              dueDate: assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-GB') : null,
              attemptCount: completions.filter(c => 
                c.userId === staffMember.id && c.courseId === course.id
              ).length,
              assignmentId: assignment.id
            });
            
            // Update summary counts
            if (cellStatus === 'blue') {
              if (!summary.blue) summary.blue = 0;
              summary.blue++;
            } else {
              summary[cellStatus]++;
            }
            continue;
          }

          // Has completion - check expiry
          const completionDate = new Date(latestCompletion.completedAt!);
          
          // Calculate expiry date
          let expiryDate: Date | null = null;
          if (course.certificateExpiryPeriod) {
            expiryDate = new Date(completionDate);
            expiryDate.setMonth(expiryDate.getMonth() + course.certificateExpiryPeriod);
          }

          // Determine status
          let status: 'red' | 'amber' | 'green';
          let label: string;
          let dateLabel: string = '';

          if (!expiryDate) {
            // No expiry
            status = 'green';
            label = 'Complete';
            dateLabel = 'No expiry';
          } else if (expiryDate < now) {
            // Expired
            status = 'red';
            label = 'Expired';
            dateLabel = `Exp: ${expiryDate.toLocaleDateString('en-GB')}`;
          } else if (expiryDate <= thirtyDaysFromNow) {
            // Expiring within 30 days
            status = 'amber';
            label = 'Expiring';
            dateLabel = `Exp: ${expiryDate.toLocaleDateString('en-GB')}`;
          } else {
            // Valid and not expiring soon
            status = 'green';
            label = 'In date';
            dateLabel = `Exp: ${expiryDate.toLocaleDateString('en-GB')}`;
          }

          staffRow.push({
            status,
            label,
            date: dateLabel,
            score: latestCompletion.score ? parseFloat(latestCompletion.score) : null,
            completionDate: completionDate.toLocaleDateString('en-GB'),
            expiryDate: expiryDate?.toLocaleDateString('en-GB') || null,
            attemptCount: userCompletions.length,
            assignmentId: assignment.id,
            completionId: latestCompletion.id
          });

          summary[status]++;
        }
        
        matrix.push(staffRow);
      }

      // Apply status filtering if specified
      let finalStaff = activeStaff;
      let finalCourses = validCourses;
      let finalMatrix = matrix;
      let finalSummary = summary;

      if (statusFilter.length > 0) {
        const staffToKeep: boolean[] = new Array(activeStaff.length).fill(false);
        const coursesToKeep: boolean[] = new Array(validCourses.length).fill(false);
        const filteredMatrix: any[][] = [];
        const filteredSummary = { red: 0, amber: 0, green: 0, grey: 0, blue: 0 };

        // Check each staff row
        for (let staffIndex = 0; staffIndex < matrix.length; staffIndex++) {
          const staffRow = matrix[staffIndex];
          const filteredRow: any[] = [];
          let staffHasVisibleCells = false;

          // Check each course cell for this staff member
          for (let courseIndex = 0; courseIndex < staffRow.length; courseIndex++) {
            const cell = staffRow[courseIndex];
            
            // If this cell matches the status filter
            if (statusFilter.includes(cell.status)) {
              filteredRow.push(cell);
              staffHasVisibleCells = true;
              coursesToKeep[courseIndex] = true;
              filteredSummary[cell.status as keyof typeof filteredSummary]++;
            } else {
              filteredRow.push(null);
            }
          }

          // If this staff member has any visible cells, keep them
          if (staffHasVisibleCells) {
            filteredMatrix.push(filteredRow);
            staffToKeep[staffIndex] = true;
          }
        }

        // Create final filtered arrays
        finalStaff = activeStaff.filter((_, index) => staffToKeep[index]);
        finalCourses = validCourses.filter((_, index) => coursesToKeep[index]);
        
        // Remove null columns from filtered matrix
        finalMatrix = filteredMatrix.map(row => 
          row.filter((_, colIndex) => coursesToKeep[colIndex])
        );
        
        finalSummary = { ...filteredSummary, failed: 0 };
      }

      res.json({
        staff: finalStaff.map(s => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          department: s.department,
          jobTitle: s.jobTitle,
          role: s.role
        })),
        courses: finalCourses.map(c => ({
          id: c.id,
          title: c.title,
          category: c.category,
          certificateExpiryPeriod: c.certificateExpiryPeriod,
          status: c.status
        })),
        matrix: finalMatrix,
        summary: finalSummary
      });
    } catch (error) {
      console.error('Error fetching training matrix:', error);
      res.status(500).json({ message: 'Failed to fetch training matrix' });
    }
  });

  // Export training matrix data
  app.post('/api/training-matrix/export', requireAuth, async (req: any, res) => {
    try {
      const { format, filters, organisationId } = req.body;
      const currentUser = await getCurrentUser(req);

      if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get organization data for header
      const organization = await storage.getOrganisation(organisationId);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      // Use same filtering logic as main training matrix endpoint
      const {
        departments: departmentFilter = [],
        roles: roleFilter = [],
        courses: courseFilter = [],
        statuses: statusFilter = [],
        staff: staffIdFilter = [],
        mandatoryOnly = false
      } = filters || {};

      // Get all staff members in the organisation
      const staff = await storage.getUsersByOrganisation(organisationId);
      let activeStaff = staff.filter(u => u.status === 'active' && u.role === 'user');

      // Apply filters
      if (staffIdFilter.length > 0) {
        activeStaff = activeStaff.filter(s => staffIdFilter.includes(s.id));
      }
      if (departmentFilter.length > 0) {
        activeStaff = activeStaff.filter(s => s.department && departmentFilter.includes(s.department));
      }
      if (roleFilter.length > 0) {
        activeStaff = activeStaff.filter(s => s.jobTitle && roleFilter.includes(s.jobTitle));
      }

      // Get courses and apply filters
      const assignments = await storage.getAssignmentsByOrganisation(organisationId);
      let courseIds = Array.from(new Set(assignments.map(a => a.courseId)));
      
      const courses = await Promise.all(
        courseIds.map(async (courseId) => {
          return await storage.getCourse(courseId);
        })
      );
      let validCourses = courses.filter((c): c is NonNullable<typeof c> => Boolean(c));

      if (courseFilter.length > 0) {
        validCourses = validCourses.filter(c => courseFilter.includes(c.id));
      }

      // Get completions and build matrix (simplified for export)
      const completions = await storage.getCompletionsByOrganisation(organisationId);
      const now = new Date();

      // Build simplified matrix data for export
      const exportData: any[] = [];
      
      for (const staffMember of activeStaff) {
        const staffData: any = {
          'Staff Name': `${staffMember.firstName} ${staffMember.lastName}`,
          'Job Title': staffMember.jobTitle || '',
        };

        for (const course of validCourses) {
          const assignment = assignments.find(a => 
            a.userId === staffMember.id && a.courseId === course.id
          );

          let status = 'Not assigned';
          let details = '';

          if (assignment) {
            const userCompletions = completions.filter(c => 
              c.userId === staffMember.id && 
              c.courseId === course.id &&
              c.status === 'pass'
            );
            
            const latestCompletion = userCompletions.sort((a, b) => 
              new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
            )[0];

            if (latestCompletion) {
              const completionDate = new Date(latestCompletion.completedAt!);
              let expiryDate: Date | null = null;
              if (course.certificateExpiryPeriod) {
                expiryDate = new Date(completionDate);
                expiryDate.setMonth(expiryDate.getMonth() + course.certificateExpiryPeriod);
              }

              if (!expiryDate) {
                status = 'Complete';
                details = `Completed: ${completionDate.toLocaleDateString('en-GB')}`;
              } else if (expiryDate < now) {
                status = 'Expired';
                details = `Expired: ${expiryDate.toLocaleDateString('en-GB')}`;
              } else {
                status = 'In date';
                details = `Expires: ${expiryDate.toLocaleDateString('en-GB')}`;
              }
            } else {
              if (assignment.status === 'overdue') {
                status = 'Overdue';
              } else if (assignment.status === 'in_progress') {
                status = 'In progress';
              } else if (assignment.dueDate) {
                const dueDate = new Date(assignment.dueDate);
                if (dueDate < now) {
                  status = 'Overdue';
                } else {
                  status = 'Not started';
                  details = `Due: ${dueDate.toLocaleDateString('en-GB')}`;
                }
              } else {
                status = 'Not started';
              }
            }
          }

          staffData[course.title] = status;
          if (details) {
            staffData[`${course.title} - Details`] = details;
          }
        }

        exportData.push(staffData);
      }

      // Apply status filtering to export data if specified
      if (statusFilter.length > 0) {
        // This is complex for export, so we'll export the filtered view but keep all data
        // The frontend should handle this filtering before calling export
      }

      // Generate export based on format
      if (format === 'csv') {
        const { createObjectCsvWriter } = await import('csv-writer');
        
        if (exportData.length === 0) {
          return res.status(400).json({ message: 'No data to export' });
        }

        const headers = Object.keys(exportData[0]).map(key => ({
          id: key,
          title: key
        }));

        const csvWriter = createObjectCsvWriter({
          path: '/tmp/training-matrix-export.csv',
          header: headers
        });

        await csvWriter.writeRecords(exportData);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=training-matrix.csv');
        
        const fs = await import('fs');
        const csvData = fs.readFileSync('/tmp/training-matrix-export.csv');
        res.send(csvData);
        
        // Clean up
        fs.unlinkSync('/tmp/training-matrix-export.csv');
        
      } else if (format === 'pdf') {
        const puppeteer = await import('puppeteer');
        
        // Create HTML table
        const exportDate = new Date().toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric', 
          month: 'long',
          day: 'numeric'
        });
        
        let html = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 20px; }
                .header { 
                  display: flex; 
                  justify-content: space-between; 
                  align-items: center; 
                  margin-bottom: 30px; 
                  padding-bottom: 15px;
                  border-bottom: 2px solid #ddd;
                }
                .header-left { flex: 1; }
                .header-right { 
                  display: flex; 
                  align-items: center; 
                  gap: 15px;
                }
                .logo { 
                  max-width: 80px; 
                  max-height: 60px; 
                  object-fit: contain;
                }
                .title { 
                  font-size: 24px; 
                  font-weight: bold; 
                  margin: 0 0 8px 0; 
                  color: #333;
                }
                .subtitle { 
                  font-size: 14px; 
                  color: #666; 
                  margin: 0 0 5px 0;
                }
                .export-date { 
                  font-size: 12px; 
                  color: #888; 
                  margin: 0;
                }
                table { 
                  border-collapse: collapse; 
                  width: 100%; 
                  margin-top: 20px;
                }
                th, td { 
                  border: 1px solid #ddd; 
                  padding: 6px; 
                  text-align: left; 
                  font-size: 9px;
                }
                th { 
                  background-color: #f8f9fa; 
                  font-weight: bold; 
                  font-size: 10px;
                }
                .status-complete { background-color: #d4edda; }
                .status-overdue { background-color: #f8d7da; }
                .status-expiring { background-color: #fff3cd; }
                .status-progress { background-color: #d1ecf1; }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="header-left">
                  <h1 class="title">Training Matrix Report</h1>
                  <div class="subtitle">${organization.displayName}</div>
                  <div class="export-date">Generated on ${exportDate}</div>
                </div>
                <div class="header-right">
                  ${organization.logoUrl ? `<img src="${organization.logoUrl.startsWith('http') ? organization.logoUrl : req.protocol + '://' + req.hostname + organization.logoUrl}" alt="${organization.displayName} Logo" class="logo" style="width: 80px; height: 60px; object-fit: contain;">` : ''}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
        `;
        
        if (exportData.length > 0) {
          Object.keys(exportData[0]).forEach(header => {
            html += `<th>${header}</th>`;
          });
        }
        
        html += `
                  </tr>
                </thead>
                <tbody>
        `;
        
        exportData.forEach(row => {
          html += '<tr>';
          Object.values(row).forEach(value => {
            let cellClass = '';
            if (typeof value === 'string') {
              if (value.includes('Complete') || value.includes('In date')) cellClass = 'status-complete';
              else if (value.includes('Overdue') || value.includes('Expired')) cellClass = 'status-overdue';
              else if (value.includes('Expiring')) cellClass = 'status-expiring';
              else if (value.includes('In progress')) cellClass = 'status-progress';
            }
            html += `<td class="${cellClass}">${value || ''}</td>`;
          });
          html += '</tr>';
        });
        
        html += `
                </tbody>
              </table>
            </body>
          </html>
        `;
        
        // Try to find system Chromium binary
        let executablePath = undefined;
        try {
          const { execSync } = await import('child_process');
          executablePath = execSync('which chromium || which chromium-browser || which google-chrome', 
            { encoding: 'utf8' }).trim();
        } catch (e) {
          console.warn('Could not find system browser, using default Puppeteer Chrome');
        }

        const browser = await puppeteer.launch({ 
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--allow-running-insecure-content'
          ],
          executablePath: executablePath || undefined
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Wait for images to load
        await page.evaluate(async () => {
          const images = Array.from(document.querySelectorAll('img'));
          await Promise.all(images.map(img => {
            return new Promise((resolve) => {
              if (img.complete) {
                resolve(void 0);
              } else {
                img.onload = () => resolve(void 0);
                img.onerror = () => resolve(void 0);
              }
            });
          }));
        });
        
        const pdfBuffer = await page.pdf({ 
          format: 'A4',
          landscape: true,
          margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
          printBackground: true
        });
        
        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=training-matrix.pdf');
        res.setHeader('Content-Length', pdfBuffer.length.toString());
        res.end(pdfBuffer, 'binary');
        
      } else {
        return res.status(400).json({ message: 'Invalid format. Must be csv or pdf' });
      }
      
    } catch (error) {
      console.error('Error exporting training matrix:', error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });

  // Bulk import users from CSV
  app.post('/api/users/bulk-import', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { users: usersData } = req.body;
      
      if (!Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ message: 'Users array is required' });
      }

      // Count how many active users will be created (default to active if not specified)
      const activeUsersToCreate = usersData.filter(userData => 
        !userData.status || userData.status === 'active'
      ).length;
      
      // Check license capacity if creating active users
      if (activeUsersToCreate > 0) {
        const licenseCheck = await checkLicenseCapacity(user.id, activeUsersToCreate);
        if (!licenseCheck.canProceed) {
          return res.status(403).json({ 
            message: licenseCheck.error,
            code: 'LICENSE_LIMIT_EXCEEDED'
          });
        }
      }

      // Count how many admin users will be created
      const adminUsersToCreate = usersData.filter(userData => userData.role === 'admin').length;
      
      // Check admin limit if creating admin users
      if (adminUsersToCreate > 0) {
        const orgId = user.organisationId;
        if (!orgId) {
          return res.status(400).json({ message: 'Organisation ID is required for admin users' });
        }
        
        // For bulk import, we need to check if we can create ALL the admin users
        // Since enforceAdminLimit checks current count vs limit, we need to check each one
        // For simplicity, we'll reject the entire bulk import if admin limit is exceeded
        const adminLimitCheck = await storage.enforceAdminLimit(orgId);
        if (!adminLimitCheck.allowed) {
          return res.status(403).json({
            message: `Admin user limit exceeded. Cannot import ${adminUsersToCreate} admin user(s).`,
            code: adminLimitCheck.error?.code || 'FEATURE_LOCKED',
            featureKey: adminLimitCheck.error?.featureKey || 'unlimited_admin_accounts',
            maxAllowed: adminLimitCheck.error?.maxAllowed || 1,
            attemptedAdminUsers: adminUsersToCreate
          });
        }
      }

      let created = 0;
      let failed = 0;
      const errors: string[] = [];
      const createdRegularUsers: any[] = [];
      const createdAdmins: any[] = [];

      for (const userData of usersData) {
        try {
          const validatedData = insertUserSchema.parse(userData);
          
          // If admin, can only create users in their organisation
          if (user.role === 'admin') {
            validatedData.organisationId = user.organisationId;
          }

          const newUser = await storage.createUser(validatedData);
          created++;
          
          // Track created users for email notifications
          if (newUser.role === 'admin') {
            createdAdmins.push(newUser);
          } else if (newUser.role === 'user') {
            createdRegularUsers.push(newUser);
          }
        } catch (error: any) {
          failed++;
          errors.push(`${userData.email || 'Unknown'}: ${error.message}`);
        }
      }
      
      // Send email notifications for bulk user creation
      if (user.organisationId && (createdRegularUsers.length > 0 || createdAdmins.length > 0)) {
        const organization = await storage.getOrganisation(user.organisationId);
        if (organization) {
          // Send notification for new regular users using EmailNotificationService
          if (createdRegularUsers.length > 0) {
            try {
              // For bulk imports, send a summary notification about the bulk user creation
              await emailNotificationService.notifyBulkUserAdded(
                organization.id,
                createdRegularUsers,
                user.id
              );
              console.log(`[Bulk Import] Queued bulk user notification for ${createdRegularUsers.length} users`);
            } catch (error) {
              console.error('[Bulk Import] Failed to send user notification:', error);
              // Don't break the import flow on notification failure
            }
          }
          
          // Send notification for new admin users using EmailNotificationService
          if (createdAdmins.length > 0) {
            try {
              await emailNotificationService.notifyBulkAdminAdded(
                organization.id,
                createdAdmins.map(admin => admin.id),
                user.id
              );
              console.log(`[Bulk Import] Queued bulk admin notification for ${createdAdmins.length} admins`);
            } catch (error) {
              console.error('[Bulk Import] Failed to send admin notification:', error);
              // Don't break the import flow on notification failure
            }
          }
        }
      }

      res.status(200).json({ 
        created, 
        failed, 
        errors: errors.slice(0, 10) // Limit error messages
      });
    } catch (error) {
      console.error('Error bulk importing users:', error);
      res.status(500).json({ message: 'Failed to import users' });
    }
  });

  // Courses routes
  app.get('/api/courses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      // For admins doing course assignment, only return active courses from allowed categories
      if (user?.role === 'admin') {
        if (!user.organisationId) {
          return res.status(403).json({ message: 'Admin user must belong to an organization' });
        }

        // Get organization's allowed course folders/categories
        const allowedFolders = await storage.getOrganisationFolderAccess(user.organisationId);
        const allowedFolderIds = allowedFolders.map(folder => folder.id);

        // Get all courses and filter by organization's category access
        const courses = await storage.getAllCourses();
        const filteredCourses = courses.filter(course => {
          // Only show published courses
          if (course.status !== 'published') {
            return false;
          }
          
          // If no specific folder access is granted, show no courses
          if (allowedFolderIds.length === 0) {
            return false;
          }
          
          // Show courses that are in the organization's allowed categories
          // If course has no folder (folderId is null), don't show it unless organization has access to 'uncategorized'
          if (course.folderId) {
            return allowedFolderIds.includes(course.folderId);
          } else {
            // Handle uncategorized courses - only show if organization has been granted general access
            // For now, we'll exclude uncategorized courses to maintain strict category-based access
            return false;
          }
        });

        console.log(`📚 Admin ${user.email} (Org: ${user.organisationId}) can access ${filteredCourses.length} courses from ${allowedFolderIds.length} allowed categories`);
        res.json(filteredCourses);
      } else {
        // For SuperAdmin, fetch all courses (published and archived)
        const courses = await storage.getAllCourses();
        res.json(courses);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ message: 'Failed to fetch courses' });
    }
  });

  app.put('/api/courses/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      
      // Normalize cover image URL if provided
      let updateData = { ...req.body };
      if (updateData.coverImageUrl) {
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();
        updateData.coverImageUrl = objectStorageService.normalizeObjectEntityPath(updateData.coverImageUrl);
      }
      
      const updatedCourse = await storage.updateCourse(id, updateData);
      res.json(updatedCourse);
    } catch (error) {
      console.error('Error updating course:', error);
      res.status(500).json({ message: 'Failed to update course' });
    }
  });

  app.delete('/api/courses/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      
      // Verify course exists and is archived before allowing deletion
      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      
      if (course.status !== 'archived') {
        return res.status(400).json({ message: 'Only archived courses can be deleted permanently' });
      }
      
      await storage.deleteCourse(id);
      res.json({ message: 'Course deleted successfully' });
    } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ message: 'Failed to delete course' });
    }
  });

  app.post('/api/courses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Normalize cover image URL if provided
      let courseData = {
        ...req.body,
        createdBy: user.id,
      };

      if (courseData.coverImageUrl) {
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();
        courseData.coverImageUrl = objectStorageService.normalizeObjectEntityPath(courseData.coverImageUrl);
      }

      const validatedData = insertCourseSchema.parse(courseData);

      const course = await storage.createCourse(validatedData);
      res.status(201).json(course);
    } catch (error) {
      console.error('Error creating course:', error);
      res.status(500).json({ message: 'Failed to create course' });
    }
  });

  app.get('/api/courses/:courseId/analytics', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { courseId } = req.params;
      const analytics = await storage.getCourseAnalytics(courseId);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching course analytics:', error);
      res.status(500).json({ message: 'Failed to fetch course analytics' });
    }
  });

  // Course folder routes
  app.get('/api/course-folders', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const folders = await storage.getAllCourseFolders();
      res.json(folders);
    } catch (error) {
      console.error('Error fetching course folders:', error);
      res.status(500).json({ message: 'Failed to fetch course folders' });
    }
  });

  app.post('/api/course-folders', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const folderData = {
        ...req.body,
        createdBy: user.id,
      };

      const folder = await storage.createCourseFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      console.error('Error creating course folder:', error);
      res.status(500).json({ message: 'Failed to create course folder' });
    }
  });

  app.put('/api/course-folders/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const folder = await storage.updateCourseFolder(id, req.body);
      res.json(folder);
    } catch (error) {
      console.error('Error updating course folder:', error);
      res.status(500).json({ message: 'Failed to update course folder' });
    }
  });

  app.delete('/api/course-folders/:id', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      
      // Check if any courses are in this folder
      const coursesInFolder = await storage.getCoursesByFolder(id);
      if (coursesInFolder.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete folder that contains courses. Please move or delete the courses first.' 
        });
      }
      
      await storage.deleteCourseFolder(id);
      res.json({ message: 'Course folder deleted successfully' });
    } catch (error) {
      console.error('Error deleting course folder:', error);
      res.status(500).json({ message: 'Failed to delete course folder' });
    }
  });

  app.get('/api/course-folders/:id/courses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { id } = req.params;
      const courses = await storage.getCoursesByFolder(id);
      res.json(courses);
    } catch (error) {
      console.error('Error fetching courses by folder:', error);
      res.status(500).json({ message: 'Failed to fetch courses by folder' });
    }
  });

  // Organisation course folder access routes
  app.post('/api/organisations/:organisationId/folder-access', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { organisationId } = req.params;
      const { folderId } = req.body;
      
      const accessData = {
        organisationId,
        folderId,
        grantedBy: user.id,
      };

      const access = await storage.grantOrganisationFolderAccess(accessData);
      res.status(201).json(access);
    } catch (error) {
      console.error('Error granting folder access:', error);
      res.status(500).json({ message: 'Failed to grant folder access' });
    }
  });

  app.delete('/api/organisations/:organisationId/folder-access/:folderId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { organisationId, folderId } = req.params;
      
      await storage.revokeOrganisationFolderAccess(organisationId, folderId);
      res.json({ message: 'Folder access revoked successfully' });
    } catch (error) {
      console.error('Error revoking folder access:', error);
      res.status(500).json({ message: 'Failed to revoke folder access' });
    }
  });

  app.get('/api/organisations/:organisationId/folder-access', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'superadmin' && user.organisationId !== req.params.organisationId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { organisationId } = req.params;
      const folders = await storage.getOrganisationFolderAccess(organisationId);
      res.json(folders);
    } catch (error) {
      console.error('Error fetching organisation folder access:', error);
      res.status(500).json({ message: 'Failed to fetch organisation folder access' });
    }
  });

  // Assignments routes
  app.get('/api/assignments', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      let assignments: any[] = [];
      if (user.role === 'user') {
        assignments = await storage.getAssignmentsByUser(user.id);
      } else if (user.role === 'admin' && user.organisationId) {
        assignments = await storage.getAssignmentsByOrganisation(user.organisationId);
      } else if (user.role === 'superadmin') {
        // For demo, just return empty array - would need more complex filtering in real app
        assignments = [];
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Failed to fetch assignments' });
    }
  });

  app.post('/api/assignments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const validatedData = insertAssignmentSchema.parse({
        ...req.body,
        assignedBy: user.id,
      });

      // If admin, ensure assignment is within their organisation
      if (user.role === 'admin' && user.organisationId) {
        validatedData.organisationId = user.organisationId;
      }

      const assignment = await storage.createAssignment(validatedData);
      
      // Send course assignment email using EmailOrchestrator if EMAIL_TEMPLATES_V2 is enabled
      if (EMAIL_TEMPLATES_V2_ENABLED && assignment.organisationId && assignment.courseId && assignment.userId) {
        try {
          const [organization, course, targetUser] = await Promise.all([
            storage.getOrganisation(assignment.organisationId),
            storage.getCourse(assignment.courseId),
            storage.getUser(assignment.userId)
          ]);
          
          if (organization && course && targetUser) {
            const context = {
              user: {
                name: `${targetUser.firstName} ${targetUser.lastName}`,
                email: targetUser.email ?? undefined,
                firstName: targetUser.firstName ?? undefined,
                lastName: targetUser.lastName ?? undefined,
                fullName: `${targetUser.firstName} ${targetUser.lastName}`
              },
              course: {
                title: course.title,
                description: course.description ?? undefined,
                estimatedDuration: course.estimatedDuration
              },
              org: {
                name: organization.name,
                displayName: organization.displayName || organization.name
              },
              assignedBy: {
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Administrator'
              },
              assignedAt: new Date().toISOString(),
              dueDate: assignment.dueDate?.toISOString() || undefined,
              courseUrl: `${process.env.REPLIT_URL || 'http://localhost:5000'}/course/${assignment.courseId}`,
              supportEmail: process.env.SUPPORT_EMAIL || 'support@intellms.app'
            };

            // Only queue email if user has a valid email address
            if (targetUser.email) {
              await emailOrchestrator.queue({
                triggerEvent: 'COURSE_ASSIGNED',
                templateKey: 'course_assigned',
                toEmail: targetUser.email,
                context,
                organisationId: assignment.organisationId,
                priority: 2,
                resourceId: `COURSE_ASSIGNED:${targetUser.email}:${assignment.courseId}:${assignment.id}`
              });
            }
            
            console.log(`✅ COURSE_ASSIGNED email queued for ${targetUser.email} (Individual assignment v2: ${course.title})`);
          }
        } catch (emailError) {
          console.warn('⚠️ Failed to queue COURSE_ASSIGNED email:', emailError);
          // Don't fail assignment if email fails
        }
      }
      
      // LEGACY: Send course assignment notification to organization admins
      // TODO: Remove this when EMAIL_TEMPLATES_V2 is fully deployed
      if (!EMAIL_TEMPLATES_V2_ENABLED && assignment.organisationId && assignment.courseId && assignment.userId) {
        try {
          const [organization, course, targetUser] = await Promise.all([
            storage.getOrganisation(assignment.organisationId),
            storage.getCourse(assignment.courseId),
            storage.getUser(assignment.userId)
          ]);
          
          if (organization && course && targetUser) {
            const adminEmails = await getOrganizationAdminEmails(organization.id);
            
            await sendMultiRecipientNotification(
              'Course Assignment',
              adminEmails,
              (adminEmail) => emailTemplateService.sendCourseAssignedNotification(
                adminEmail,
                buildCourseAssignedNotificationData(organization, { name: adminEmail.split('@')[0], email: adminEmail }, targetUser, course, user, assignment.dueDate?.toISOString()),
                organization.id
              )
            );
          }
        } catch (emailError) {
          console.error('Error sending course assignment notification:', emailError);
          // Don't let email errors break the assignment creation
        }
      }
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  // Reset assignment status to not_started for SCORM 2004 "Don't save" functionality
  app.post('/api/assignments/:id/reset-status', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserIdFromSession(req);
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Get the assignment to verify ownership
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Verify user owns this assignment
      if (assignment.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to modify this assignment' });
      }

      // Reset assignment status to not_started
      const updatedAssignment = await storage.updateAssignment(id, {
        status: 'not_started',
        startedAt: null,
        completedAt: null
      });

      console.log(`🔄 Assignment ${id} reset to not_started for user ${userId}`);
      res.json(updatedAssignment);
    } catch (error) {
      console.error('Error resetting assignment status:', error);
      res.status(500).json({ message: 'Failed to reset assignment status' });
    }
  });

  // POST /api/lms/attempt/start - Creates or reuses IN_PROGRESS attempt
  app.post('/api/lms/attempt/start', requireAuth, async (req: any, res) => {
    console.log('🎯 POST /api/lms/attempt/start endpoint called');
    console.log('📦 Request body:', req.body);
    
    try {
      const { courseId } = req.body;
      const userId = getUserIdFromSession(req);
      
      console.log(`👤 User ID: ${userId}`);
      console.log(`📚 Course ID: ${courseId}`);
      
      if (!userId) {
        console.log('❌ User not authenticated');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!courseId) {
        console.log('❌ Missing courseId');
        return res.status(400).json({ message: 'courseId is required' });
      }

      // Find the assignment for this user and course
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find(a => a.courseId === courseId);
      
      if (!assignment) {
        console.log('❌ Assignment not found for courseId:', courseId);
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Look for existing IN_PROGRESS attempt
      let attempt = await storage.getActiveScormAttempt(userId, assignment.id);
      
      if (!attempt) {
        // Create new attempt
        const newAttemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('🆕 Creating new attempt:', newAttemptId);
        
        attempt = await storage.createScormAttempt({
          attemptId: newAttemptId,
          assignmentId: assignment.id,
          userId,
          courseId: assignment.courseId,
          organisationId: assignment.organisationId,
          scormVersion: '2004',
          status: 'in_progress',
          completed: false,
          passmark: 80
        });
      } else {
        console.log('🔄 Reusing existing attempt:', attempt.attemptId);
        // Ensure it's IN_PROGRESS
        if (attempt.status !== 'in_progress') {
          await storage.updateScormAttempt(attempt.attemptId, { status: 'in_progress' });
        }
      }

      console.log(`✅ Attempt ready: ${attempt.attemptId}, status: in_progress, location: ${attempt.location || 'none'}, suspendData: ${attempt.suspendData ? 'present' : 'none'}`);
      
      return res.json({ 
        attemptId: attempt.attemptId, 
        status: 'IN_PROGRESS',
        lastLocation: attempt.location || '',
        suspendData: attempt.suspendData || ''
      });
    } catch (error) {
      console.error('❌ Error starting attempt:', error);
      res.status(500).json({ message: 'Failed to start attempt' });
    }
  });

  // POST /scorm/runtime/commit - Exact patch implementation
  app.post('/api/scorm/runtime/commit', requireAuth, async (req: any, res) => {
    try {
      const { attemptId, values } = req.body;
      const get = (k: string) => (values?.[k] ?? '').toString();

      const patch: any = {
        location: get('cmi.location') || null,
        suspendData: get('cmi.suspend_data') || null,
        completionStatus: get('cmi.completion_status') || null,
        successStatus: get('cmi.success_status') || null,
        scoreRaw: get('cmi.score.raw') ? parseFloat(get('cmi.score.raw')) : null,
        progressMeasure: get('cmi.progress_measure') ? parseFloat(get('cmi.progress_measure')) : null,
        lastCommitAt: new Date(),
        status: 'in_progress'
      };

      const completed = (patch.completionStatus === 'completed') || (patch.successStatus === 'passed');
      if (completed) {
        Object.assign(patch, {
          status: 'completed',
          completed: true, 
          closed: true, 
          terminatedAt: new Date()
        });
      }

      await storage.updateScormAttempt(attemptId, patch);
      return res.json({ 
        ok: true, 
        status: patch.status, 
        completed 
      });
    } catch (error) {
      console.error('Error committing SCORM data:', error);
      res.status(500).json({ message: 'Failed to commit SCORM data' });
    }
  });

  // GET /lms/enrolments/:courseId/state - Exact patch implementation
  app.get('/api/lms/enrolments/:courseId/state', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserIdFromSession(req);
      const { courseId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Find the assignment for this user and course
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find(a => a.courseId === courseId);
      
      if (!assignment) {
        return res.json({ 
          status: 'not_started', 
          hasOpenAttempt: false, 
          canResume: false 
        });
      }

      // Get latest attempt (prefer open attempt)
      const attempt = await storage.getActiveScormAttempt(userId, assignment.id);
      
      console.log(`🔍 State query for course ${courseId}, user ${userId}:`, {
        attemptFound: !!attempt,
        attemptId: attempt?.attemptId,
        status: attempt?.status,
        isActive: attempt?.isActive
      });
      
      // If no attempt or attempt is inactive, return not_started
      if (!attempt || !attempt.isActive) {
        console.log(`📝 Returning not_started (no attempt or inactive attempt)`);
        return res.json({ 
          status: 'not_started', 
          hasOpenAttempt: false, 
          canResume: false 
        });
      }

      const canResume = (attempt.isActive && attempt.status === 'in_progress');
      const response = {
        status: attempt.status,
        hasOpenAttempt: attempt.isActive,
        canResume,
        attemptId: attempt.attemptId,
        lastActivity: attempt.lastCommitAt || attempt.createdAt,
        score: attempt.completed ? Number(attempt.scoreRaw ?? 0) : null,
        pass: attempt.completed ? (attempt.successStatus === 'passed') : null
      };
      
      console.log(`📝 Returning state:`, response);
      return res.json(response);
    } catch (error) {
      console.error('Error getting enrolment state:', error);
      res.status(500).json({ message: 'Failed to get enrolment state' });
    }
  });

  // POST /api/lms/enrolments/:courseId/start-over - Reset course progress
  app.post('/api/lms/enrolments/:courseId/start-over', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserIdFromSession(req);
      const { courseId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Find the assignment for this user and course
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find(a => a.courseId === courseId);
      
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Get ALL active attempts for this assignment and close them
      const allActiveAttempts = await storage.getScormAttemptsByAssignment(assignment.id);
      const userActiveAttempts = allActiveAttempts.filter(a => 
        a.userId === userId && a.isActive
      );
      
      if (userActiveAttempts.length > 0) {
        // Close ALL active attempts for this user/assignment
        for (const attempt of userActiveAttempts) {
          await storage.updateScormAttempt(attempt.attemptId, {
            isActive: false,
            finishedAt: new Date()
          });
          console.log(`✅ Closed attempt ${attempt.attemptId} for user ${userId}, course ${courseId}`);
        }
        
        return res.json({ 
          success: true, 
          message: 'Course progress reset successfully'
        });
      } else {
        return res.json({ 
          success: true, 
          message: 'No active attempt to reset'
        });
      }
      
    } catch (error) {
      console.error('Error resetting course progress:', error);
      res.status(500).json({ message: 'Failed to reset course progress' });
    }
  });

  // GET /lms/attempt/:attemptId - Get attempt data for SCORM initialization
  app.get('/api/lms/attempt/:attemptId', requireAuth, async (req: any, res) => {
    try {
      const { attemptId } = req.params;
      const userId = getUserIdFromSession(req);
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const attempt = await storage.getScormAttemptByAttemptId(attemptId);
      
      if (!attempt) {
        return res.status(404).json({ message: 'Attempt not found' });
      }

      // Verify the attempt belongs to the current user
      if (attempt.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      return res.json({
        ok: true,
        attempt: {
          attemptId: attempt.attemptId,
          location: attempt.location,
          suspendData: attempt.suspendData,
          completionStatus: attempt.completionStatus,
          successStatus: attempt.successStatus,
          scoreRaw: attempt.scoreRaw,
          progressMeasure: attempt.progressMeasure,
          status: attempt.status,
          closed: !attempt.isActive
        }
      });
    } catch (error) {
      console.error('Error getting attempt data:', error);
      res.status(500).json({ message: 'Failed to get attempt data' });
    }
  });

  // POST /api/lms/attempt/save - Save progress (specification-compliant)
  app.post('/api/lms/attempt/save', requireAuth, async (req: any, res) => {
    console.log('🎯 POST /api/lms/attempt/save endpoint called');
    console.log('📦 Request body:', req.body);
    
    try {
      const userId = getUserIdFromSession(req);
      const { courseId, attemptId, location, suspendData, progressPct } = req.body;
      
      console.log(`👤 User ID: ${userId}`);
      console.log(`📚 Course ID: ${courseId}`);
      console.log(`🎯 Attempt ID: ${attemptId}`);
      
      if (!userId) {
        console.log('❌ User not authenticated');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!attemptId) {
        console.log('❌ Missing attemptId');
        return res.status(400).json({ message: 'attemptId is required' });
      }

      console.log(`💾 Saving progress: location="${location || 'none'}", suspendData=${suspendData ? 'present' : 'none'}, progressPct=${progressPct || 0}%`);

      // Store lastLocation, suspendData, progressPct, set/keep status=IN_PROGRESS
      const updateData = {
        location: location || null,
        suspendData: suspendData || null,
        progressMeasure: progressPct ? (parseFloat(progressPct) / 100).toString() : null,
        status: 'in_progress' as const,
        lastCommitAt: new Date()
      };

      await storage.updateScormAttempt(attemptId, updateData);

      console.log(`✅ Progress saved: ${attemptId}, status=IN_PROGRESS, progressPct=${progressPct || 0}%`);

      // Return confirmation with the same values (per specification)
      res.json({ 
        lastLocation: location || '',
        suspendData: suspendData || '',
        progressPct: progressPct || 0,
        status: 'IN_PROGRESS',
        attemptId: attemptId
      });
    } catch (error) {
      console.error('❌ Error saving attempt progress:', error);
      res.status(500).json({ message: 'Failed to save attempt progress' });
    }
  });

  // POST /api/lms/attempt/complete - Mark attempt as completed
  app.post('/api/lms/attempt/complete', requireAuth, async (req: any, res) => {
    console.log('🎯 POST /api/lms/attempt/complete endpoint called');
    console.log('📦 Request body:', req.body);
    
    try {
      const userId = getUserIdFromSession(req);
      const { courseId, attemptId, score, passed } = req.body;
      
      console.log(`👤 User ID: ${userId}`);
      console.log(`📚 Course ID: ${courseId}`);
      console.log(`🎯 Attempt ID: ${attemptId}`);
      
      if (!userId) {
        console.log('❌ User not authenticated');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!attemptId) {
        console.log('❌ Missing attemptId');
        return res.status(400).json({ message: 'attemptId is required' });
      }

      console.log(`🏁 Completing attempt: ${attemptId}`);
      console.log(`🎯 Score: ${score || 0}`);
      console.log(`✅ Passed: ${passed || false}`);

      // Mark attempt as completed
      const updateData = {
        status: 'completed' as const,
        completed: true,
        isActive: false,
        scoreRaw: score ? parseFloat(score).toString() : '0',
        passed: Boolean(passed),
        finishedAt: new Date()
      };

      await storage.updateScormAttempt(attemptId, updateData);

      console.log(`✅ Attempt completed: ${attemptId}, status: completed, score: ${score || 0}, passed: ${passed || false}`);

      res.json({ 
        success: true, 
        message: 'Attempt completed successfully',
        attemptId,
        status: 'COMPLETED',
        score: score || 0,
        passed: Boolean(passed)
      });
    } catch (error) {
      console.error('❌ Error completing attempt:', error);
      res.status(500).json({ message: 'Failed to complete attempt' });
    }
  });

  // GET /api/lms/attempt/latest - Get latest attempt for course
  app.get('/api/lms/attempt/latest', requireAuth, async (req: any, res) => {
    console.log('🎯 GET /api/lms/attempt/latest endpoint called');
    console.log('📦 Query params:', req.query);
    
    try {
      const userId = getUserIdFromSession(req);
      const { courseId } = req.query;
      
      console.log(`👤 User ID: ${userId}`);
      console.log(`📚 Course ID: ${courseId}`);
      
      if (!userId) {
        console.log('❌ User not authenticated');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!courseId) {
        console.log('❌ Missing courseId');
        return res.status(400).json({ message: 'courseId is required' });
      }

      // Find the assignment for this user and course
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find(a => a.courseId === courseId);
      
      if (!assignment) {
        console.log('❌ Assignment not found for courseId:', courseId);
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Get latest attempt (prefer IN_PROGRESS)
      const attempt = await storage.getActiveScormAttempt(userId, assignment.id);
      
      if (!attempt) {
        console.log('📄 No attempt found');
        return res.json({ 
          success: true,
          attempt: null,
          message: 'No attempt found'
        });
      }

      console.log(`✅ Latest attempt found: ${attempt.attemptId}, status: ${attempt.status}, location: ${attempt.location || 'none'}, suspendData: ${attempt.suspendData ? 'present' : 'none'}`);

      res.json({ 
        success: true,
        attempt: {
          attemptId: attempt.attemptId,
          status: attempt.status?.toUpperCase() || 'NOT_STARTED',
          lastLocation: attempt.location || '',
          suspendData: attempt.suspendData || '',
          progressPct: attempt.progressMeasure ? Math.round(parseFloat(attempt.progressMeasure) * 100) : 0,
          score: attempt.scoreRaw || 0,
          passed: attempt.passed || false,
          createdAt: attempt.createdAt,
          updatedAt: attempt.lastCommitAt || attempt.createdAt
        }
      });
    } catch (error) {
      console.error('❌ Error getting latest attempt:', error);
      res.status(500).json({ message: 'Failed to get latest attempt' });
    }
  });

  // Get assignments for a specific user (admin only)
  app.get('/api/assignments/user/:userId', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { userId } = req.params;
      
      // For admins, verify the user belongs to their organisation
      if (user.role === 'admin') {
        const targetUser = await storage.getUser(userId);
        if (!targetUser || targetUser.organisationId !== user.organisationId) {
          return res.status(404).json({ message: 'User not found' });
        }
      }

      const assignments = await storage.getAssignmentsByUser(userId);
      
      // Enrich assignments with course information
      const enrichedAssignments = await Promise.all(
        assignments.map(async (assignment) => {
          const course = await storage.getCourse(assignment.courseId);
          return {
            ...assignment,
            courseTitle: course?.title || 'Unknown Course'
          };
        })
      );

      res.json(enrichedAssignments);
    } catch (error) {
      console.error('Error fetching user assignments:', error);
      res.status(500).json({ message: 'Failed to fetch user assignments' });
    }
  });

  // SCORM player route
  app.get('/api/scorm/:assignmentId/player', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserIdFromSession(req);
      const { assignmentId } = req.params;
      const { retry } = req.query;

      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || assignment.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const course = await storage.getCourse(assignment.courseId);
      if (!course || !course.scormPackageUrl) {
        return res.status(404).json({ message: 'Course or SCORM package not found' });
      }

      // If this is a retry, clear the cache first
      if (retry === 'true') {
        console.log('🔄 Retrying SCORM player, clearing cache first');
        scormService.clearPackageCache(course.scormPackageUrl);
      }

      let playerHtml;
      try {
        playerHtml = await scormService.getPlayerHtml(course.scormPackageUrl, userId, assignmentId);
      } catch (scormError) {
        console.error('SCORM player generation failed:', scormError);
        
        // Provide a user-friendly error page with retry option
        playerHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Course Loading Error</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; background: #f8f9fa; text-align: center; }
              .error-container { background: white; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
              .error-title { color: #dc3545; margin-bottom: 20px; }
              .retry-btn { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; margin: 10px; font-size: 16px; }
              .retry-btn:hover { background: #0056b3; }
              .home-btn { background: #6c757d; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; margin: 10px; font-size: 16px; }
              .home-btn:hover { background: #545b62; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1 class="error-title">📚 Course Loading Error</h1>
              <p>We're having trouble loading your course content. This might be temporary.</p>
              <p><strong>Course:</strong> ${course.title}</p>
              <p><strong>Error:</strong> ${scormError instanceof Error ? scormError.message : 'Unknown error'}</p>
              <div>
                <button class="retry-btn" onclick="window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'retry=true'">🔄 Try Again</button>
                <button class="home-btn" onclick="window.location.href = '/user'">🏠 Go to Dashboard</button>
              </div>
            </div>
          </body>
          </html>
        `;
      }
      
      res.setHeader('Content-Type', 'text/html');
      res.send(playerHtml);
    } catch (error) {
      console.error('Error loading SCORM player:', error);
      
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>System Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f8f9fa; text-align: center; }
            .error-container { background: white; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
            .error-title { color: #dc3545; margin-bottom: 20px; }
            .home-btn { background: #6c757d; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; margin: 10px; font-size: 16px; }
            .home-btn:hover { background: #545b62; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1 class="error-title">⚠️ System Error</h1>
            <p>A system error occurred while loading your course. Please try again later or contact support.</p>
            <button class="home-btn" onclick="window.location.href = '/user'">🏠 Return to Dashboard</button>
          </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(errorHtml);
    }
  });

  // NEW: POST /api/scorm/attempts/discard - Discard attempt and reset assignment
  app.post('/api/scorm/attempts/discard', requireAuth, async (req: any, res) => {
    try {
      const { assignmentId, attemptId } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!assignmentId) {
        return res.status(400).json({ message: 'assignmentId is required' });
      }

      console.log(`🗑️ DISCARD REQUEST: Assignment ${assignmentId}, Attempt ${attemptId}, User ${userId}`);

      // Verify assignment ownership
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || assignment.userId !== userId) {
        return res.status(403).json({ message: 'Assignment not found or access denied' });
      }

      // Find the attempt to discard (latest active if attemptId not specified)
      let targetAttempt;
      if (attemptId) {
        targetAttempt = await storage.getScormAttemptByAttemptId(attemptId);
        if (!targetAttempt || targetAttempt.userId !== userId || targetAttempt.assignmentId !== assignmentId) {
          return res.status(403).json({ message: 'Attempt not found or access denied' });
        }
      } else {
        targetAttempt = await storage.getActiveScormAttempt(userId, assignmentId);
      }

      if (targetAttempt) {
        // Mark attempt as abandoned (keep for audit trail)
        await storage.updateScormAttempt(targetAttempt.attemptId, {
          status: 'abandoned',
          isActive: false,
          suspendData: null, // Clear suspend data
          location: null,    // Clear location
          finishedAt: new Date()
        });
        console.log(`🗑️ Attempt ${targetAttempt.attemptId} marked as abandoned`);
      }

      // Reset assignment to not_started state (idempotent operation)
      await storage.updateAssignment(assignmentId, {
        status: 'not_started',
        startedAt: null,
        completedAt: null
      });
      console.log(`🔄 Assignment ${assignmentId} reset to not_started`);

      res.json({
        success: true,
        message: 'Progress discarded and assignment reset',
        assignmentId,
        attemptId: targetAttempt?.attemptId,
        status: 'not_started'
      });

    } catch (error) {
      console.error('Error discarding SCORM attempt:', error);
      res.status(500).json({ 
        message: 'Failed to discard attempt', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // COMPREHENSIVE SCORM runtime result endpoint - handles commit and finish events
  app.post('/api/scorm/result', requireAuth, async (req: any, res) => {
    try {
      const {
        learnerId,
        courseId: assignmentId, // Frontend sends assignmentId as courseId
        attemptId,
        standard, // "1.2" or "2004"
        reason, // "commit" or "finish"
        scormData // Complete SCORM field data
      } = req.body;

      const userId = req.session.user?.id;

      if (learnerId !== userId) {
        return res.status(403).json({ message: 'Unauthorized - learner ID mismatch' });
      }

      if (!scormData) {
        return res.status(400).json({ message: 'Missing SCORM data' });
      }

      // NEW: Check if attempt is abandoned - ignore writes for abandoned attempts
      if (attemptId) {
        const attempt = await storage.getScormAttemptByAttemptId(attemptId);
        if (attempt && attempt.status === 'abandoned') {
          console.log(`🗑️ IGNORED: Write to abandoned attempt ${attemptId}`);
          return res.json({
            success: true,
            ignored: true,
            message: 'Write ignored - attempt was abandoned',
            attemptId,
            reason
          });
        }
      }

      console.log(`📊 Processing SCORM ${standard} result (${reason}):`, {
        attemptId: attemptId || '(generated)',
        userId,
        assignmentId,
        dataKeys: Object.keys(scormData)
      });

      // Get assignment and course details
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || assignment.userId !== userId) {
        return res.status(403).json({ message: 'Assignment not found or access denied' });
      }

      const course = await storage.getCourse(assignment.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      const passmark = course.passmark || 80;

      // Generate attempt ID if not provided
      const finalAttemptId = attemptId || `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Extract SCORM values based on standard
      let attemptData: any = {
        attemptId: finalAttemptId,
        assignmentId,
        userId,
        courseId: assignment.courseId,
        organisationId: assignment.organisationId,
        scormVersion: standard, // SCORM version field
        passmark,
        rawScormData: scormData
      };

      if (standard === '1.2') {
        // SCORM 1.2 fields
        attemptData = {
          ...attemptData,
          lessonStatus: scormData['cmi.core.lesson_status'],
          lessonLocation: scormData['cmi.core.lesson_location'],
          scoreRaw: scormData['cmi.core.score.raw'] ? parseFloat(scormData['cmi.core.score.raw']) : null,
          scoreMin: scormData['cmi.core.score.min'] ? parseFloat(scormData['cmi.core.score.min']) : null,
          scoreMax: scormData['cmi.core.score.max'] ? parseFloat(scormData['cmi.core.score.max']) : null,
          sessionTime: scormData['cmi.core.session_time'],
          suspendData: scormData['cmi.suspend_data']
        };
      } else if (standard === '2004') {
        // SCORM 2004 fields
        attemptData = {
          ...attemptData,
          completionStatus: scormData['cmi.completion_status'],
          successStatus: scormData['cmi.success_status'],
          location: scormData['cmi.location'],
          progressMeasure: scormData['cmi.progress_measure'] ? parseFloat(scormData['cmi.progress_measure']) : null,
          scoreRaw: scormData['cmi.score.raw'] ? parseFloat(scormData['cmi.score.raw']) : null,
          scoreScaled: scormData['cmi.score.scaled'] ? parseFloat(scormData['cmi.score.scaled']) : null,
          sessionTime: scormData['cmi.session_time'],
          suspendData: scormData['cmi.suspend_data']
        };
      }

      // Compute derived fields using priority rules
      
      // 1. Progress Percent (0-100) - Direct SCORM data calculation
      let progressPercent = 0;
      
      // Log what SCORM data we received for debugging
      console.log('📊 Raw SCORM data received:', {
        standard,
        lessonStatus: attemptData.lessonStatus,
        completionStatus: attemptData.completionStatus,
        successStatus: attemptData.successStatus,
        progressMeasure: attemptData.progressMeasure,
        suspendData: attemptData.suspendData ? `${attemptData.suspendData.length} chars` : 'none',
        sessionTime: attemptData.sessionTime,
        location: attemptData.lessonLocation || attemptData.location
      });

      // Debug: Show all received SCORM data keys and check for progress indicators
      if (scormData) {
        console.log('📊 All SCORM data keys:', Object.keys(scormData));
        // Look for any fields that might contain slide/page information
        for (const [key, value] of Object.entries(scormData)) {
          if (typeof value === 'string' && (
            value.includes('of') || 
            value.includes('/') || 
            /\d+/.test(value)
          )) {
            console.log(`📊 SCORM field "${key}" contains potential progress data: "${value}"`);
          }
        }
      }
      
      // Special handling: Try to extract progress from common course patterns
      // This handles courses that display "X of Y" but don't store it in SCORM fields
      let estimatedProgressFromTime = 0;
      if (attemptData.sessionTime) {
        // Parse session time and estimate progress (rough heuristic)
        const timeMatch = attemptData.sessionTime.match(/PT(\d+)H(\d+)M(\d+)S/);
        if (timeMatch) {
          const totalSeconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
          // Assume average course takes 10-15 minutes, scale accordingly
          estimatedProgressFromTime = Math.min(85, Math.round((totalSeconds / 600) * 100)); // Max 85% from time
          if (estimatedProgressFromTime > 5) {
            console.log(`⏱️ Estimated progress from session time (${totalSeconds}s): ${estimatedProgressFromTime}%`);
          }
        }
      }
      
      if (standard === '2004') {
        // SCORM 2004: Use direct SCORM data only
        if (attemptData.completionStatus === 'completed' || attemptData.successStatus === 'passed') {
          progressPercent = 100;
          console.log('✅ SCORM 2004: Completed/Passed -> 100%');
        } else if (attemptData.successStatus === 'failed') {
          progressPercent = 100;
          console.log('❌ SCORM 2004: Failed -> 100% (completed assessment)');
        } else if (attemptData.progressMeasure !== null && attemptData.progressMeasure !== undefined) {
          // Use cmi.progress_measure directly from SCORM content (0-1 scale)
          const progressValue = parseFloat(attemptData.progressMeasure);
          if (!isNaN(progressValue) && progressValue >= 0 && progressValue <= 1) {
            progressPercent = Math.round(progressValue * 100);
            console.log(`📊 SCORM 2004: Using progress_measure ${progressValue} -> ${progressPercent}%`);
          } else {
            console.log(`⚠️ SCORM 2004: Invalid progress_measure value: ${attemptData.progressMeasure}`);
            progressPercent = 0;
          }
        } else if (attemptData.suspendData) {
          // Try to extract progress from SCORM 2004 suspend_data
          let scormProgress = 0;
          try {
            // First try to decode base64 encoded data (common in HTML5/JS SCORM packages)
            let decodedData = attemptData.suspendData;
            if (attemptData.suspendData.length > 100 && !attemptData.suspendData.includes('{')) {
              try {
                decodedData = Buffer.from(attemptData.suspendData, 'base64').toString('utf-8');
                console.log('📊 SCORM 2004: Decoded base64 suspend_data');
              } catch {
                // Not base64, use original data
              }
            }
            
            // Try to parse as JSON first
            try {
              const suspendJson = JSON.parse(decodedData);
              if (typeof suspendJson.progress === 'number') {
                scormProgress = Math.round(suspendJson.progress);
                console.log(`📊 SCORM 2004: Found progress in suspend_data: ${scormProgress}%`);
              } else if (typeof suspendJson.percentage === 'number') {
                scormProgress = Math.round(suspendJson.percentage);
                console.log(`📊 SCORM 2004: Found percentage in suspend_data: ${scormProgress}%`);
              } else if (typeof suspendJson.slideIndex === 'number' && typeof suspendJson.totalSlides === 'number') {
                scormProgress = Math.round((suspendJson.slideIndex / suspendJson.totalSlides) * 100);
                console.log(`📊 SCORM 2004: Calculated progress from slides ${suspendJson.slideIndex}/${suspendJson.totalSlides}: ${scormProgress}%`);
              } else if (typeof suspendJson.currentPage === 'number' && typeof suspendJson.totalPages === 'number') {
                scormProgress = Math.round((suspendJson.currentPage / suspendJson.totalPages) * 100);
                console.log(`📊 SCORM 2004: Calculated progress from pages ${suspendJson.currentPage}/${suspendJson.totalPages}: ${scormProgress}%`);
              }
            } catch {
              // Try comprehensive pattern matching for non-JSON suspend data
              console.log(`📊 SCORM 2004: Decoded data sample (first 200 chars): ${decodedData.substring(0, 200)}`);
              
              // Enhanced slide/page pattern matching with multiple formats
              const slidePatterns = [
                /(\d+)\s*of\s*(\d+)/i,                          // "4 of 12"
                /(\d+)\s*\/\s*(\d+)/,                           // "4/12" 
                /slide[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,  // "slide: 4 of 12"
                /page[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,   // "page: 4 of 12"
                /current[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i, // "current: 4 total: 12"
                /index[":=\s]*(\d+).*?(?:of|total|max|count)[":=\s]*(\d+)/i, // "index: 4 count: 12"
              ];
              
              // Direct progress patterns
              const progressPatterns = [
                /(?:progress|percentage)[":=\s]*(\d+(?:\.\d+)?)/i,
                /completion[":=\s]*(\d+(?:\.\d+)?)/i,
                /percent[":=\s]*(\d+(?:\.\d+)?)/i,
              ];
              
              let matchFound = false;
              
              // Try slide/page patterns first
              for (const pattern of slidePatterns) {
                const match = decodedData.match(pattern);
                if (match) {
                  const current = parseInt(match[1]);
                  const total = parseInt(match[2]);
                  if (current > 0 && total > 0 && current <= total) {
                    scormProgress = Math.round((current / total) * 100);
                    console.log(`📊 SCORM 2004: Found progress from pattern "${match[0]}" -> ${current}/${total} = ${scormProgress}%`);
                    matchFound = true;
                    break;
                  }
                }
              }
              
              // Try direct progress patterns if no slide pattern found
              if (!matchFound) {
                for (const pattern of progressPatterns) {
                  const match = decodedData.match(pattern);
                  if (match) {
                    const progressValue = parseFloat(match[1]);
                    if (!isNaN(progressValue) && progressValue >= 0 && progressValue <= 100) {
                      scormProgress = Math.round(progressValue);
                      console.log(`📊 SCORM 2004: Found progress from pattern "${match[0]}" = ${scormProgress}%`);
                      matchFound = true;
                      break;
                    }
                  }
                }
              }
              
              // Fallback: estimate from data complexity
              if (!matchFound) {
                const dataLength = decodedData.length;
                if (dataLength > 500) {
                  scormProgress = Math.min(75, Math.max(5, Math.round(dataLength / 100)));
                  console.log(`📊 SCORM 2004: No patterns found, estimated progress from data size (${dataLength} chars): ${scormProgress}%`);
                } else {
                  console.log('📊 SCORM 2004: No progress patterns found in suspend_data');
                }
              }
            }
          } catch (error) {
            console.log('📊 SCORM 2004: Error processing suspend_data:', error);
          }
          
          progressPercent = Math.min(100, Math.max(0, scormProgress));
          if (progressPercent === 0 && estimatedProgressFromTime > 5) {
            progressPercent = estimatedProgressFromTime;
            console.log(`📊 SCORM 2004: Using time-based progress estimate: ${progressPercent}%`);
          } else if (progressPercent === 0) {
            console.log('📊 SCORM 2004: No progress data in suspend_data -> 0%');
          }
        } else {
          // No progress measure or suspend data provided by SCORM - try time estimation
          if (estimatedProgressFromTime > 5) {
            progressPercent = estimatedProgressFromTime;
            console.log(`📊 SCORM 2004: Using time-based progress estimate: ${progressPercent}%`);
          } else {
            progressPercent = 0;
            console.log('📊 SCORM 2004: No progress_measure or suspend_data provided -> 0%');
          }
        }
      } else if (standard === '1.2') {
        // SCORM 1.2: Use lesson_status as primary indicator
        if (attemptData.lessonStatus === 'completed' || attemptData.lessonStatus === 'passed') {
          progressPercent = 100;
          console.log('✅ SCORM 1.2: Completed/Passed -> 100%');
        } else if (attemptData.lessonStatus === 'failed') {
          progressPercent = 100;
          console.log('❌ SCORM 1.2: Failed -> 100% (completed assessment)');
        } else {
          // For incomplete, look for explicit progress in suspend_data or lesson_location
          let scormProgress = 0;
          let progressFound = false;
          
          // Check lesson_location first (common for slide-based progress)
          if (attemptData.lessonLocation) {
            console.log(`📊 SCORM 1.2: Checking lesson_location: ${attemptData.lessonLocation}`);
            const slidePatterns = [
              /(\d+)\s*of\s*(\d+)/i,                          // "4 of 12"
              /(\d+)\s*\/\s*(\d+)/,                           // "4/12"
              /slide[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,
              /page[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,
            ];
            
            for (const pattern of slidePatterns) {
              const match = attemptData.lessonLocation.match(pattern);
              if (match) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                if (current > 0 && total > 0 && current <= total) {
                  scormProgress = Math.round((current / total) * 100);
                  console.log(`📊 SCORM 1.2: Found progress from lesson_location "${match[0]}" -> ${current}/${total} = ${scormProgress}%`);
                  progressFound = true;
                  break;
                }
              }
            }
          }
          
          // If no progress in lesson_location, check suspend_data
          if (!progressFound && attemptData.suspendData) {
            try {
              // First try to decode base64 encoded data
              let decodedData = attemptData.suspendData;
              if (attemptData.suspendData.length > 100 && !attemptData.suspendData.includes('{')) {
                try {
                  decodedData = Buffer.from(attemptData.suspendData, 'base64').toString('utf-8');
                  console.log('📊 SCORM 1.2: Decoded base64 suspend_data');
                } catch {
                  // Not base64, use original data
                }
              }
              
              // Try to parse as JSON
              try {
                const suspendJson = JSON.parse(decodedData);
                if (typeof suspendJson.progress === 'number') {
                  scormProgress = Math.round(suspendJson.progress);
                  console.log(`📊 SCORM 1.2: Found progress in suspend_data: ${scormProgress}%`);
                  progressFound = true;
                } else if (typeof suspendJson.percentage === 'number') {
                  scormProgress = Math.round(suspendJson.percentage);
                  console.log(`📊 SCORM 1.2: Found percentage in suspend_data: ${scormProgress}%`);
                  progressFound = true;
                } else if (typeof suspendJson.currentPage === 'number' && typeof suspendJson.totalPages === 'number') {
                  scormProgress = Math.round((suspendJson.currentPage / suspendJson.totalPages) * 100);
                  console.log(`📊 SCORM 1.2: Calculated progress from pages ${suspendJson.currentPage}/${suspendJson.totalPages}: ${scormProgress}%`);
                  progressFound = true;
                }
              } catch {
                // Try comprehensive pattern matching for non-JSON suspend data
                console.log(`📊 SCORM 1.2: Decoded data sample (first 200 chars): ${decodedData.substring(0, 200)}`);
                
                const slidePatterns = [
                  /(\d+)\s*of\s*(\d+)/i,                          // "4 of 12"
                  /(\d+)\s*\/\s*(\d+)/,                           // "4/12" 
                  /slide[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,
                  /page[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,
                  /current[":=\s]*(\d+).*?(?:of|total|max)[":=\s]*(\d+)/i,
                  /index[":=\s]*(\d+).*?(?:of|total|max|count)[":=\s]*(\d+)/i,
                ];
                
                const progressPatterns = [
                  /(?:progress|percentage)[":=\s]*(\d+(?:\.\d+)?)/i,
                  /completion[":=\s]*(\d+(?:\.\d+)?)/i,
                  /percent[":=\s]*(\d+(?:\.\d+)?)/i,
                ];
                
                // Try slide/page patterns first
                for (const pattern of slidePatterns) {
                  const match = decodedData.match(pattern);
                  if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    if (current > 0 && total > 0 && current <= total) {
                      scormProgress = Math.round((current / total) * 100);
                      console.log(`📊 SCORM 1.2: Found progress from pattern "${match[0]}" -> ${current}/${total} = ${scormProgress}%`);
                      progressFound = true;
                      break;
                    }
                  }
                }
                
                // Try direct progress patterns if no slide pattern found
                if (!progressFound) {
                  for (const pattern of progressPatterns) {
                    const match = decodedData.match(pattern);
                    if (match) {
                      const progressValue = parseFloat(match[1]);
                      if (!isNaN(progressValue) && progressValue >= 0 && progressValue <= 100) {
                        scormProgress = Math.round(progressValue);
                        console.log(`📊 SCORM 1.2: Found progress from pattern "${match[0]}" = ${scormProgress}%`);
                        progressFound = true;
                        break;
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.log('📊 SCORM 1.2: Error processing suspend_data:', error);
            }
          }
          
          progressPercent = Math.min(100, Math.max(0, scormProgress));
          if (progressPercent === 0 && estimatedProgressFromTime > 5) {
            progressPercent = estimatedProgressFromTime;
            console.log(`📊 SCORM 1.2: Using time-based progress estimate: ${progressPercent}%`);
          } else if (progressPercent === 0) {
            console.log('📊 SCORM 1.2: No progress data found in lesson_location or suspend_data -> 0%');
          }
        }
      }
      
      console.log(`📊 Final calculated progress: ${progressPercent}%`);
      
      // 2. Completed (boolean)
      let completed = false;
      if (standard === '1.2') {
        completed = ['completed', 'passed', 'failed'].includes(attemptData.lessonStatus);
      } else if (standard === '2004') {
        // SCORM 2004: completed when completion_status = "completed" OR success_status = "passed" (per debugging guide)
        completed = (attemptData.completionStatus === 'completed') || (attemptData.successStatus === 'passed');
      }
      
      // 3. Passed (boolean) - Status first, then score fallback
      let passed = false;
      if (standard === '1.2') {
        // Status-first approach
        if (attemptData.lessonStatus === 'passed') {
          passed = true;
        } else if (attemptData.lessonStatus === 'failed') {
          passed = false;
        } else if (attemptData.scoreRaw !== null && attemptData.scoreRaw >= passmark) {
          // Score fallback
          passed = true;
        }
      } else if (standard === '2004') {
        // Status-first approach
        if (attemptData.successStatus === 'passed') {
          passed = true;
        } else if (attemptData.successStatus === 'failed') {
          passed = false;
        } else if (attemptData.scoreRaw !== null && attemptData.scoreRaw >= passmark) {
          // Score fallback with raw score
          passed = true;
        } else if (attemptData.scoreScaled !== null && attemptData.scoreScaled >= (passmark / 100)) {
          // Score fallback with scaled score
          passed = true;
        }
      }

      // Add derived fields to attempt data
      attemptData.progressPercent = Math.max(0, Math.min(100, progressPercent));
      attemptData.completed = completed;
      attemptData.passed = passed;
      attemptData.lastCommitAt = new Date();
      
      // SCORM 2004 (3rd Ed.) compliant attempt lifecycle
      if (completed) {
        // When either cmi.completion_status = "completed" OR cmi.success_status = "passed"
        attemptData.status = 'completed';
        attemptData.completed = true;
        if (reason === 'finish') {
          attemptData.finishedAt = new Date();
        }
      } else {
        // Keep as "In Progress" until completion is achieved
        attemptData.status = 'in_progress';
      }

      console.log(`📊 SCORM ${standard} derived fields:`, {
        attemptId: finalAttemptId,
        progressPercent,
        passed,
        completed,
        rawScore: attemptData.scoreRaw,
        reason
      });

      // Upsert SCORM attempt record
      let wasAlreadyPassed = false;
      try {
        const existingAttempt = await storage.getScormAttemptByAttemptId(finalAttemptId);
        if (existingAttempt) {
          wasAlreadyPassed = existingAttempt.passed || false;
          await storage.updateScormAttempt(finalAttemptId, attemptData);
        } else {
          await storage.createScormAttempt(attemptData);
        }
      } catch (attemptError) {
        console.error('Error upserting SCORM attempt:', attemptError);
        // Continue processing even if attempt storage fails
      }

      // Generate certificate if passed status changed from false to true
      if (passed && !wasAlreadyPassed) {
        try {
          const user = await storage.getUser(userId);
          const organisation = await storage.getOrganisation(assignment.organisationId);
          
          if (user && organisation) {
            const certificateService = (global as any).certificateService;
            if (certificateService) {
              const certificateUrl = await certificateService.generateCertificate({
                id: finalAttemptId,
                userId,
                courseId: assignment.courseId,
                organisationId: assignment.organisationId,
                score: attemptData.scoreRaw?.toString() || '0'
              }, user, course, organisation);
              
              // Update attempt with certificate URL
              await storage.updateScormAttempt(finalAttemptId, {
                certificateUrl,
                certificateGeneratedAt: new Date()
              });

              console.log(`🏆 Certificate generated for attempt ${finalAttemptId}: ${certificateUrl}`);
              attemptData.certificateUrl = certificateUrl;
            }
          }
        } catch (certError) {
          console.error('Certificate generation error:', certError);
        }
      }

      // Update assignment status based on progress
      try {
        if (reason === 'finish' && completed) {
          // Course completed - update to completed status
          await storage.updateAssignment(assignmentId, {
            status: 'completed',
            completedAt: new Date(),
          });

          // Create or update completion record for compatibility
          const existingCompletions = await storage.getCompletionsByAssignment(assignmentId);
          if (existingCompletions.length === 0) {
            const completion = await storage.createCompletion({
              assignmentId,
              userId,
              courseId: assignment.courseId,
              organisationId: assignment.organisationId,
              score: attemptData.scoreRaw?.toString() || '0',
              status: passed ? 'pass' : 'fail',
              timeSpent: 0, // Could be derived from session time if needed
              scormData: scormData,
            });
            
            // Send course completion/failure notification to organization admins using EmailNotificationService
            try {
              if (passed) {
                await emailNotificationService.notifyLearnerCompletedCourse(
                  assignment.organisationId,
                  userId,
                  assignment.courseId,
                  completion.id
                );
              } else {
                await emailNotificationService.notifyLearnerFailedCourse(
                  assignment.organisationId,
                  userId,
                  assignment.courseId,
                  completion.id
                );
              }
            } catch (notificationError) {
              console.error('Error sending course completion/failure notification:', notificationError);
              // Don't let notification errors break the completion process
            }
          }
        } else if (assignment.status === 'not_started' && (attemptData.progressPercent > 0 || reason === 'commit' || reason === 'finish')) {
          // Course started - update to in_progress status
          await storage.updateAssignment(assignmentId, {
            status: 'in_progress',
            startedAt: new Date(),
          });
          console.log(`🚀 Assignment ${assignmentId} updated to in_progress (${attemptData.progressPercent}% progress)`);
        }
      } catch (statusError) {
        console.error('Error updating assignment status:', statusError);
      }

      // Enhanced response with derived fields
      const derivedFields = {
        progressPercent: attemptData.progressPercent,
        passed: attemptData.passed,
        completed: attemptData.completed,
        certificateUrl: attemptData.certificateUrl || null
      };

      console.log(`✅ SCORM ${standard} processing complete:`, {
        attemptId: finalAttemptId,
        reason,
        ...derivedFields
      });

      res.json({
        success: true,
        attemptId: finalAttemptId,
        reason,
        derivedFields,
        message: `SCORM ${standard} result processed (${reason})`,
        // Legacy fields for compatibility
        passed: attemptData.passed,
        score: attemptData.scoreRaw || attemptData.scoreScaled
      });

    } catch (error) {
      console.error('Error processing SCORM result:', error);
      res.status(500).json({ message: 'Failed to process SCORM result', error: error instanceof Error ? error.message : String(error) });
    }
  });


  // SCORM completion route
  app.post('/api/scorm/:assignmentId/complete', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserIdFromSession(req);
      const { assignmentId } = req.params;
      const scormData = req.body;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || assignment.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const course = await storage.getCourse(assignment.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Process SCORM completion data
      const completionData = await scormService.processCompletion(scormData, course.passmark || 80);

      // Create completion record
      const completion = await storage.createCompletion({
        assignmentId,
        userId,
        courseId: assignment.courseId,
        organisationId: assignment.organisationId,
        score: completionData.score?.toString() || '0',
        status: completionData.status === 'passed' ? 'pass' : 'fail',
        timeSpent: completionData.timeSpent,
        scormData: completionData.sessionData,
      });
      
      // Send course completion/failure notification to organization admins using EmailNotificationService
      try {
        const isPassed = completionData.status === 'passed';
        if (isPassed) {
          await emailNotificationService.notifyLearnerCompletedCourse(
            assignment.organisationId,
            userId,
            assignment.courseId,
            completion.id
          );
        } else {
          await emailNotificationService.notifyLearnerFailedCourse(
            assignment.organisationId,
            userId,
            assignment.courseId,
            completion.id
          );
        }
      } catch (notificationError) {
        console.error('Error sending course completion/failure notification:', notificationError);
        // Don't let notification errors break the completion process
      }

      // Update assignment status
      await storage.updateAssignment(assignmentId, {
        status: 'completed',
        completedAt: new Date(),
      });

      // Generate certificate if passed
      if (completionData.status === 'passed') {
        const user = await storage.getUser(userId);
        const organisation = await storage.getOrganisation(assignment.organisationId);
        
        if (user && organisation) {
          const certificateUrl = await certificateService.generateCertificate(completion, user, course, organisation);
          
          await storage.createCertificate({
            completionId: completion.id,
            userId,
            courseId: assignment.courseId,
            organisationId: assignment.organisationId,
            certificateUrl,
            expiryDate: course.certificateExpiryPeriod ? 
              new Date(Date.now() + course.certificateExpiryPeriod * 30 * 24 * 60 * 60 * 1000) : 
              null,
          });
        }
      }

      res.json({ completion, certificateGenerated: completionData.status === 'passed' });
    } catch (error) {
      console.error('Error processing SCORM completion:', error);
      res.status(500).json({ message: 'Failed to process completion' });
    }
  });

  // Idempotent finish endpoint - trusts SCORM completion status
  app.post('/lms/attempt/finish', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserIdFromSession(req);
      if (!userId) {
        return res.status(401).json({ ok: false, message: 'User not authenticated' });
      }

      const { snapshot, complete: completeFlag, progress: clientProgress } = req.body;
      const snap = snapshot || { version: 'none' };
      const now = new Date();

      // Find current active attempt based on session or latest attempt
      // For now, we'll use the latest attempt for this user (you may need to adjust based on your session management)
      const currentAttemptId = req.session.currentAttemptId; 
      if (!currentAttemptId) {
        console.log('⚠️ No active attempt ID found in session, trying to find latest...');
        
        // Try to find from recent SCORM activity
        const recentAttempts = await storage.getScormAttemptsByUser(userId);
        if (recentAttempts.length === 0) {
          return res.status(400).json({ ok: false, message: 'No active attempt found' });
        }
        
        // Use the most recent attempt that's not closed
        const activeAttempt = recentAttempts.find((a: any) => !a.closed) || recentAttempts[0];
        req.session.currentAttemptId = activeAttempt.attemptId;
      }

      const attemptId = req.session.currentAttemptId;
      console.log(`🏁 Processing finish request for attempt: ${attemptId}`);

      // Get existing attempt from database
      const attempt = await storage.getScormAttemptByAttemptId(attemptId);
      if (!attempt) {
        return res.status(404).json({ ok: false, message: 'Attempt not found' });
      }

      // Derive completion status from SCORM snapshot
      let isComplete = !!completeFlag;
      let status = null, success = null, score = null, progress = null;

      if (snap.version === '2004') {
        status = snap.completion_status || attempt.completionStatus || 'unknown';
        success = snap.success_status || attempt.successStatus || 'unknown'; 
        score = snap.score_raw !== undefined ? parseFloat(snap.score_raw) : attempt.scoreRaw;
        if (snap.progress_measure && !isNaN(parseFloat(snap.progress_measure))) {
          progress = Math.round(parseFloat(snap.progress_measure) * 100);
        }
        // SCORM 2004: completion_status="completed" OR success_status="passed"
        isComplete = isComplete || (status === 'completed') || (success === 'passed');
      } else if (snap.version === '1.2') {
        status = snap.lesson_status || attempt.lessonStatus || 'not attempted';
        success = attempt.successStatus || null; // 1.2 doesn't have success_status
        score = snap.score_raw !== undefined ? parseFloat(snap.score_raw) : attempt.scoreRaw;
        // SCORM 1.2: lesson_status in ["completed", "passed"]  
        isComplete = isComplete || (status === 'completed' || status === 'passed');
      } else {
        // Use existing attempt data if no valid snapshot
        isComplete = attempt.completed || false;
        status = attempt.completionStatus || attempt.lessonStatus;
        success = attempt.successStatus;
        score = attempt.scoreRaw;
        progress = attempt.progressPercent;
      }

      console.log(`🔍 Finish analysis: complete=${isComplete}, status=${status}, success=${success}, score=${score}`);

      // If not complete according to SCORM, return gentle failure (allow retry)
      if (!isComplete) {
        return res.status(409).json({ 
          ok: false, 
          message: 'Course has not reported completion yet. Please re-open the course and reach the final screen.' 
        });
      }

      // Persist final state (idempotent updates)
      const finalProgress = Number.isFinite(progress) ? progress : (isComplete ? 100 : attempt.progressPercent || 0);
      const updates = {
        scormVersion: (snap.version === '2004' ? '2004' : '1.2') as '1.2' | '2004',
        completionStatus: status,
        successStatus: success,
        scoreRaw: score !== null ? score.toString() : null,
        progressPercent: finalProgress,
        completed: isComplete,
        status: isComplete ? 'completed' as const : 'in_progress' as const,
        isActive: false,
        finishedAt: now,
        lastCommitAt: now
      };

      console.log(`💾 Updating attempt ${attemptId} with final state:`, updates);
      await storage.updateScormAttempt(attemptId, updates);

      // Create or update completion record for admin interface
      try {
        const assignments = await storage.getAssignmentsByUser(userId);
        const relatedAssignment = assignments.find((a: any) => 
          a.courseId === attempt.courseId && a.status !== 'completed'
        );

        if (relatedAssignment) {
          // Check if completion record already exists
          const existingCompletions = await storage.getCompletionsByAssignment(relatedAssignment.id);
          const existingCompletion = existingCompletions.find((c: any) => c.userId === userId && c.status === 'pass');

          if (!existingCompletion) {
            // Convert score to percentage format for admin interface
            let percentageScore: number | null = null;
            if (score !== null && score !== undefined) {
              // Ensure score is a number for calculations
              const numericScore = typeof score === 'string' ? parseFloat(score) : score;
              if (!isNaN(numericScore)) {
                // If it's in 0-1 format, multiply by 100 to get percentage
                percentageScore = numericScore <= 1 ? numericScore * 100 : numericScore;
              }
            }

            // Determine pass/fail status
            const completionStatus = (success === 'passed' || status === 'passed') ? 'pass' : 'fail';

            // Create completion record
            const completionData = {
              userId: userId,
              courseId: attempt.courseId,
              assignmentId: relatedAssignment.id,
              organisationId: relatedAssignment.organisationId,
              score: percentageScore?.toString() || null,
              status: completionStatus as 'pass' | 'fail',
              completedAt: now,
              scormData: {} // Could include SCORM snapshot if needed
            };

            console.log(`📋 Creating completion record:`, completionData);
            const completion = await storage.createCompletion(completionData);
            
            // Send course completion/failure notification to organization admins using EmailNotificationService
            if (completionData.organisationId && completionData.courseId) {
              try {
                const isPassed = completionData.status === 'pass';
                if (isPassed) {
                  await emailNotificationService.notifyLearnerCompletedCourse(
                    completionData.organisationId,
                    completionData.userId,
                    completionData.courseId,
                    completion.id
                  );
                } else {
                  await emailNotificationService.notifyLearnerFailedCourse(
                    completionData.organisationId,
                    completionData.userId,
                    completionData.courseId,
                    completion.id
                  );
                }
              } catch (emailError) {
                console.error('Error sending completion/failure notification:', emailError);
                // Don't let email errors break completion recording
              }
            }
          }
        }
      } catch (completionError) {
        console.warn('Warning: Could not create completion record:', completionError);
        // Don't fail the finish process if completion creation fails
      }

      // Also update assignment status if we can find it
      try {
        const assignments = await storage.getAssignmentsByUser(userId);
        const relatedAssignment = assignments.find((a: any) => 
          a.courseId === attempt.courseId && a.status !== 'completed'
        );
        
        if (relatedAssignment) {
          await storage.updateAssignment(relatedAssignment.id, {
            status: 'completed',
            completedAt: now
          });
          console.log(`✅ Updated assignment ${relatedAssignment.id} to completed`);
        }
      } catch (assignmentError) {
        console.warn('Warning: Could not update assignment status:', assignmentError);
        // Don't fail the finish process if assignment update fails
      }

      // Clear the current attempt from session
      delete req.session.currentAttemptId;

      console.log(`🏁 Finish completed successfully for attempt ${attemptId}`);
      
      return res.json({ 
        ok: true, 
        completed: true, 
        status, 
        success, 
        score, 
        progress: finalProgress,
        message: 'Course finished successfully'
      });

    } catch (error) {
      console.error('❌ Error in finish endpoint:', error);
      return res.status(500).json({ 
        ok: false, 
        message: 'Server error during finish processing. Please try again.' 
      });
    }
  });

  // Todo items routes
  app.get('/api/todos', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const todos = await storage.getTodoItemsByUser(userId);
      res.json(todos);
    } catch (error) {
      console.error('Error fetching todos:', error);
      res.status(500).json({ message: 'Failed to fetch todos' });
    }
  });

  app.post('/api/todos', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const { task } = req.body;

      if (!task || task.trim() === '') {
        return res.status(400).json({ message: 'Task is required' });
      }

      const todo = await storage.createTodoItem({
        userId,
        task: task.trim(),
      });

      res.status(201).json(todo);
    } catch (error) {
      console.error('Error creating todo:', error);
      res.status(500).json({ message: 'Failed to create todo' });
    }
  });

  app.patch('/api/todos/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const { id } = req.params;
      const updates = req.body;

      const todo = await storage.getTodoItem(id);
      if (!todo || todo.userId !== userId) {
        return res.status(404).json({ message: 'Todo not found' });
      }

      const updatedTodo = await storage.updateTodoItem(id, updates);
      res.json(updatedTodo);
    } catch (error) {
      console.error('Error updating todo:', error);
      res.status(500).json({ message: 'Failed to update todo' });
    }
  });

  app.delete('/api/todos/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const { id } = req.params;

      const todo = await storage.getTodoItem(id);
      if (!todo || todo.userId !== userId) {
        return res.status(404).json({ message: 'Todo not found' });
      }

      await storage.deleteTodoItem(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting todo:', error);
      res.status(500).json({ message: 'Failed to delete todo' });
    }
  });

  // Serve SCORM API Injector as static file
  app.get('/client/lms/scorm-api-injector.js', (req, res) => {
    const injectorPath = path.join(process.cwd(), 'client', 'lms', 'scorm-api-injector.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache'); // Disable caching for development
    res.sendFile(injectorPath);
  });

  // New iSpring 11 Compatible Launch Route
  app.get('/lms/launch/:courseId', requireAuth, async (req: any, res) => {
    try {
      const { courseId } = req.params;
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || !user.organisationId) {
        return res.status(403).json({ error: 'User not found or not associated with organisation' });
      }

      // Find the course
      const course = await storage.getCourse(courseId);
      if (!course || course.createdBy !== user.organisationId) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Find active assignment for this user and course
      const assignments = await storage.getAssignmentsByUser(userId);
      const assignment = assignments.find((a: any) => a.courseId === courseId && a.status !== 'completed');
      
      if (!assignment) {
        return res.status(403).json({ error: 'No active assignment found for this course' });
      }

      // Generate unique attempt ID
      const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Determine SCORM version (default to 1.2 if not specified)
      const scormVersion = course.scormVersion || '1.2';
      const standard = scormVersion.includes('2004') ? '2004' : '1.2';
      
      console.log(`🚀 LMS Launch: Course ${courseId}, User ${userId}, SCORM ${standard}`);
      
      // Create SCORM API configuration
      const apiConfig = {
        attemptId,
        assignmentId: assignment.id,
        userId,
        courseId,
        organisationId: user.organisationId,
        itemId: undefined,
        scormVersion: standard as '1.2' | '2004',
        standard: standard as '1.2' | '2004',
        learnerId: userId,
        learnerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Learner'
      };

      // Initialize SCORM APIs
      const scormApiDispatcher = new ScormApiDispatcher();
      const scormApis = await scormApiDispatcher.createApis(apiConfig);
      
      console.log(`✅ SCORM APIs created for attempt: ${attemptId}`);
      
      // Generate launch page HTML with embedded SCORM content
      const launchHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${course.title} - Launch</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .launch-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; }
    .header { background: #634396; color: white; padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
    .course-title { font-size: 1.2rem; font-weight: 600; }
    .progress-indicator { background: rgba(255,255,255,0.2); border-radius: 8px; padding: 0.5rem 1rem; }
    .content-frame { flex: 1; border: none; width: 100%; }
    .loading { display: flex; justify-content: center; align-items: center; height: 200px; color: #666; }
    @media (max-width: 768px) { .header { flex-direction: column; gap: 1rem; } }
  </style>
</head>
<body>
  <div class="launch-container">
    <div class="header">
      <div class="course-title">${course.title}</div>
      <div class="progress-indicator" id="progress">Starting...</div>
    </div>
    <iframe id="content-frame" class="content-frame" 
            src="${course.scormPackageUrl}" 
            allow="fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals">
      <div class="loading">Loading course content...</div>
    </iframe>
  </div>

  <!-- Load SCORM API Injector -->
  <script src="/client/lms/scorm-api-injector.js"></script>
  
  <!-- Initialize SCORM APIs -->
  <script>
    // Configuration from server
    const scormConfig = ${JSON.stringify(apiConfig)};
    const initialData = ${JSON.stringify({})}; // Resume data would go here
    
    // Initialize SCORM APIs
    if (window.initializeScormAPI) {
      const success = window.initializeScormAPI({
        ...scormConfig,
        initialData
      });
      
      if (success) {
        console.log('✅ SCORM APIs initialized for launch');
      } else {
        console.error('❌ Failed to initialize SCORM APIs');
      }
    } else {
      console.error('❌ SCORM API Injector not loaded');
    }
    
    // Progress polling
    setInterval(async () => {
      try {
        const response = await fetch('/api/scorm/attempt/${attemptId}');
        if (response.ok) {
          const data = await response.json();
          const progress = document.getElementById('progress');
          if (progress && data.progressPercent !== undefined) {
            progress.textContent = \`Progress: \${data.progressPercent}%\`;
            if (data.completed) {
              progress.textContent += data.passed ? ' ✅ Passed' : ' ❌ Failed';
            }
          }
        }
      } catch (err) {
        console.warn('Progress update failed:', err);
      }
    }, 5000); // Update every 5 seconds
    
    // Handle iframe load errors
    document.getElementById('content-frame').onerror = function() {
      console.error('Failed to load SCORM content');
      const progress = document.getElementById('progress');
      if (progress) {
        progress.textContent = 'Content load failed';
        progress.style.background = '#dc3545';
      }
    };
  </script>
</body>
</html>`;

      // Set CORS headers for SCORM content
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none';");
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      
      console.log(`🎯 Serving launch page for attempt: ${attemptId}`);
      res.send(launchHtml);

    } catch (error) {
      console.error('❌ LMS Launch error:', error);
      res.status(500).json({ 
        error: 'Failed to launch course',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register new SCORM runtime routes
  app.use('/api/scorm', scormRoutes);


  const httpServer = createServer(app);
  
  // Auto-seed demo data if database is empty
  setTimeout(() => autoSeedIfEmpty(), 2000); // Delay to ensure database is ready
  
  return httpServer;
}

// Auto-seed demo data on startup if no users exist
async function autoSeedIfEmpty() {
  try {
    const allUsers = await storage.getAllUsers();
    if (allUsers.length === 0) {
      console.log('🔍 No users found in database, auto-seeding demo data...');
      await seedDemoData();
    } else {
      console.log(`📊 Found ${allUsers.length} users in database, skipping auto-seed`);
    }
  } catch (error) {
    console.log('⚠️ Could not check user count for auto-seeding:', error);
  }
}

// Demo data seeding function
async function seedDemoData() {
  console.log('🌱 Seeding demo data...');

  try {
    // Create demo organisations
    const acmeOrg = await storage.createOrganisation({
      name: 'Acme Care Ltd',
      displayName: 'Acme Care Ltd',
      subdomain: 'acme',
      theme: 'corporate',
      contactEmail: 'contact@acme.demo',
      contactPhone: '+1 (555) 123-4567',
      status: 'active',
    });

    const oceanOrg = await storage.createOrganisation({
      name: 'Ocean Nurseries CIC',
      displayName: 'Ocean Nurseries CIC',
      subdomain: 'ocean',
      theme: 'pastel',
      contactEmail: 'info@ocean.demo',
      contactPhone: '+1 (555) 987-6543',
      status: 'active',
    });

    // Create organisation settings
    await storage.createOrganisationSettings({
      organisationId: acmeOrg.id,
      signerName: 'Sarah Johnson',
      signerTitle: 'Learning & Development Manager',
      certificateText: 'has successfully completed',
    });

    await storage.createOrganisationSettings({
      organisationId: oceanOrg.id,
      signerName: 'Mark Thompson',
      signerTitle: 'Training Coordinator',
      certificateText: 'has successfully completed',
    });

    // Create demo courses
    const gdprCourse = await storage.createCourse({
      title: 'Safeguarding Children — Level 1',
      description: 'Essential training for anyone working with children',
      estimatedDuration: 60,
      passmark: 80,
      category: 'Safeguarding',
      tags: 'safeguarding,children,protection',
      status: 'published',
      createdBy: 'system',
    });

    const dataCourse = await storage.createCourse({
      title: 'Data Protection Essentials',
      description: 'Understanding GDPR and data protection requirements',
      estimatedDuration: 45,
      passmark: 70,
      category: 'Compliance',
      tags: 'gdpr,data protection,privacy',
      status: 'published',
      createdBy: 'system',
    });

    const fireCourse = await storage.createCourse({
      title: 'Fire Safety in the Workplace',
      description: 'Essential fire safety procedures and protocols',
      estimatedDuration: 40,
      passmark: 70,
      category: 'Health & Safety',
      tags: 'fire safety,workplace,emergency',
      status: 'published',
      createdBy: 'system',
    });

    // Create demo users with different roles using upsertUser to allow custom IDs
    // SuperAdmin user
    await storage.upsertUser({
      id: 'demo-superadmin',
      email: 'superadmin@demo.app',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      status: 'active',
    });

    // Admin users for each organization
    await storage.upsertUser({
      id: 'demo-admin-acme',
      email: 'admin.acme@demo.app',
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'admin',
      status: 'active',
      organisationId: acmeOrg.id,
      jobTitle: 'Learning & Development Manager',
    });

    await storage.upsertUser({
      id: 'demo-admin-ocean',
      email: 'admin.ocean@demo.app',
      firstName: 'Mark',
      lastName: 'Thompson',
      role: 'admin',
      status: 'active',
      organisationId: oceanOrg.id,
      jobTitle: 'Training Coordinator',
    });

    // Regular users
    await storage.upsertUser({
      id: 'demo-user-alice',
      email: 'alice@acme.demo',
      firstName: 'Alice',
      lastName: 'Williams',
      role: 'user',
      status: 'active',
      organisationId: acmeOrg.id,
      jobTitle: 'Care Assistant',
      allowCertificateDownload: true,
    });

    await storage.upsertUser({
      id: 'demo-user-dan',
      email: 'dan@ocean.demo',
      firstName: 'Dan',
      lastName: 'Clark',
      role: 'user',
      status: 'active',
      organisationId: oceanOrg.id,
      jobTitle: 'Childcare Worker',
      allowCertificateDownload: true,
    });

    console.log('✅ Demo data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}
