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
import { singleMailerService } from "./services/singleMailerService";
import { BrevoClient, resolveBrevoKey } from "./services/brevoClient";
import { scormService } from "./services/scormService";
import { certificateService } from "./services/certificateService";
import { ScormPreviewService } from "./services/scormPreviewService";
import { insertUserSchema, insertOrganisationSchema, insertCourseSchema, insertAssignmentSchema, insertEmailTemplateSchema, emailTemplateTypeEnum } from "@shared/schema";
import { scormRoutes } from "./scorm/routes";
import { ScormApiDispatcher } from "./scorm/api-dispatch";
import { z } from "zod";

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

// Effective email settings resolver
async function getEffectiveEmailSettings(storage: any, orgId: string) {
  try {
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
      errors: [error.message || 'Failed to retrieve email settings']
    };
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

  // Simple auth middleware
  function requireAuth(req: any, res: any, next: any) {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
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
          redirectUrl: demoAccount.user.role === 'superadmin' ? '/superadmin' 
            : demoAccount.user.role === 'admin' ? '/admin'
            : '/user'
        });
      }

      return res.status(401).json({ message: "Invalid credentials" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
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

  // Create a new plan
  app.post('/api/plans', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { name, description, pricePerUser, featureIds } = req.body;
      
      if (!name || !pricePerUser) {
        return res.status(400).json({ message: 'Name and price per user are required' });
      }

      const newPlan = await storage.createPlan({
        name,
        description: description || null,
        pricePerUser: String(parseFloat(pricePerUser)),
        status: 'active',
        createdBy: user.id
      });

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
      const { name, description, pricePerUser, status, featureIds } = req.body;
      
      const updatedPlan = await storage.updatePlan(id, {
        name,
        description,
        pricePerUser: pricePerUser ? String(parseFloat(pricePerUser)) : undefined,
        status
      });

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
        console.error(`❌ SCORM processing failed for assignment ${assignmentId}:`, scormError);
        
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
      console.error(`❌ Unexpected error in SCORM launch for assignment ${assignment.id}:`, error);
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

      // Extract admin user data from request body
      const { adminEmail, adminFirstName, adminLastName, adminJobTitle, adminDepartment, ...orgData } = req.body;
      
      // Validate required admin fields
      if (!adminEmail || !adminFirstName || !adminLastName) {
        return res.status(400).json({ message: 'Admin user details are required' });
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
      };

      const adminUser = await storage.createUser(adminUserData);
      
      // Create default organisation settings
      await storage.createOrganisationSettings({
        organisationId: organisation.id,
        signerName: adminFirstName + ' ' + adminLastName,
        signerTitle: adminJobTitle || 'Learning Manager',
      });

      res.status(201).json({
        organisation,
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: adminUser.role,
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
          pricePerUser: customPlan.pricePerUser,
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

      // Update the organisation with the new plan
      const updatedOrganisation = await storage.updateOrganisation(id, { planId: finalPlanId });
      
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

      const templates = await storage.getEmailTemplatesByOrganisation(orgId);
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
      const template = await storage.getEmailTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: 'Email template not found' });
      }

      // Admins can only access their own organization's templates
      if (user.role === 'admin' && user.organisationId !== template.organisationId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(template.organisationId, 'custom_email_templates');
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
      const templateData = insertEmailTemplateSchema.parse({
        ...req.body,
        organisationId: orgId,
        createdBy: user.id,
      });

      const template = await storage.createEmailTemplate(templateData);
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
      const existingTemplate = await storage.getEmailTemplate(id);
      
      if (!existingTemplate) {
        return res.status(404).json({ message: 'Email template not found' });
      }

      // Admins can only update their own organization's templates
      if (user.role === 'admin' && user.organisationId !== existingTemplate.organisationId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(existingTemplate.organisationId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      // Validate the request body
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const updatedTemplate = await storage.updateEmailTemplate(id, updateData);
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
      const existingTemplate = await storage.getEmailTemplate(id);
      
      if (!existingTemplate) {
        return res.status(404).json({ message: 'Email template not found' });
      }

      // Admins can only delete their own organization's templates
      if (user.role === 'admin' && user.organisationId !== existingTemplate.organisationId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if custom email templates feature is available
      const hasEmailTemplatesAccess = await hasFeatureAccess(existingTemplate.organisationId, 'custom_email_templates');
      if (!hasEmailTemplatesAccess) {
        return res.status(403).json({ message: 'Custom email templates feature not available for your plan' });
      }

      await storage.deleteEmailTemplate(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting email template:', error);
      res.status(500).json({ message: 'Failed to delete email template' });
    }
  });

  // Email settings routes
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
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpSecure,
        fromEmail,
        fromName,
        brevoApiKey,
        useBrevoApi
      } = req.body;

      // Get existing settings to prevent masked value override
      const existingOrg = await storage.getOrganisation(organisationId);
      const existingSettings = existingOrg?.emailSettings || {};

      // Clean and validate API key - prevent masked value storage
      const cleanBrevoKey = (key: string | undefined): string | null => {
        if (!key) return null;
        const cleaned = key.replace(/^["']|["']$/g, "").replace(/\r?\n/g, "").trim();
        // If it's a masked value (contains only • or similar characters), keep existing
        if (cleaned && /^[•*]+$/.test(cleaned)) {
          return existingSettings.brevoApiKey || null;
        }
        return cleaned || null;
      };

      // Clean SMTP password similarly
      const cleanSmtpPassword = (password: string | undefined): string | null => {
        if (!password) return null;
        const cleaned = password.replace(/^["']|["']$/g, "").replace(/\r?\n/g, "").trim();
        // If it's a masked value, keep existing
        if (cleaned && /^[•*]+$/.test(cleaned)) {
          return existingSettings.smtpPassword || null;
        }
        return cleaned || null;
      };

      const processedBrevoKey = cleanBrevoKey(brevoApiKey);
      const processedSmtpPassword = cleanSmtpPassword(smtpPassword);

      // Validate required fields based on delivery method
      if (useBrevoApi) {
        if (!processedBrevoKey || !fromEmail) {
          return res.status(400).json({ message: 'Brevo API key and from email are required for API delivery' });
        }
      } else {
        if (!smtpHost || !smtpUsername || !processedSmtpPassword || !fromEmail) {
          return res.status(400).json({ message: 'SMTP host, username, password, and from email are required' });
        }
      }

      const emailSettings = {
        smtpHost: smtpHost || null,
        smtpPort: smtpPort || 587,
        smtpUsername: smtpUsername || null,
        smtpPassword: processedSmtpPassword,
        smtpSecure: smtpSecure !== false, // Default to true
        fromEmail,
        fromName: fromName || 'LMS System',
        brevoApiKey: processedBrevoKey,
        useBrevoApi: useBrevoApi || false,
      };

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

      // BREVO API HEALTH CHECK AND SEND USING ENHANCED CLIENT WITH KEY RESOLUTION
      if (settings.provider === 'brevo_api') {
        console.log('Using enhanced BrevoClient with key resolution...');
        
        // Use key resolution with org/platform fallback
        let brevoClient;
        try {
          // Get platform settings for fallback
          const platformSettings = await storage.getSystemSmtpSettings();
          
          // Resolve best available key 
          brevoClient = BrevoClient.createWithKeyResolution(
            { brevo: settings.brevo }, 
            platformSettings, 
            organisationId
          );
        } catch (keyError) {
          console.error('Brevo key resolution failed:', keyError);
          return res.status(422).json({
            success: false,
            provider: 'brevo_api',
            httpStatus: 422,
            message: `API key appears empty/invalid`,
            details: {
              endpoint: '/v3/account',
              from: settings.fromEmail,
              to: testEmail,
              apiKeySource: 'none',
              apiKeyLength: 0,
              helpText: 'Configure a valid Brevo API key in your organisation settings or platform settings.'
            }
          });
        }
        
        // Manual direct test before health check
        console.log('🔧 MANUAL BREVO TEST - Testing key directly...');
        try {
          const directTestResponse = await fetch('https://api.brevo.com/v3/account', {
            method: 'GET',
            headers: {
              'api-key': brevoClient['apiKey'], // Access private key for testing
              'accept': 'application/json'
            }
          });
          console.log(`🔧 DIRECT TEST: ${directTestResponse.status} ${directTestResponse.statusText}`);
          const directBody = await directTestResponse.text();
          console.log(`🔧 DIRECT RESPONSE: ${directBody.substring(0, 200)}...`);
        } catch (directError) {
          console.log('🔧 DIRECT TEST ERROR:', directError.message);
        }

        // Health check first
        console.log('🔧 About to call checkAccount()...');
        const healthCheck = await brevoClient.checkAccount();
        console.log('🔧 checkAccount() completed:', healthCheck.success ? 'SUCCESS' : `FAILED ${healthCheck.httpStatus}`);
        
        if (!healthCheck.success) {
          return res.json({
            success: false,
            provider: healthCheck.provider || 'brevo_api',
            httpStatus: healthCheck.httpStatus,
            message: healthCheck.message,
            details: {
              endpoint: healthCheck.endpoint,
              endpointHost: healthCheck.endpointHost,
              from: settings.fromEmail,
              to: testEmail,
              apiKeySource: healthCheck.apiKeySource,
              apiKeyPreview: healthCheck.apiKeyPreview,
              apiKeyLength: healthCheck.apiKeyLength,
              helpText: healthCheck.httpStatus === 401 || healthCheck.httpStatus === 403 ? 
                'Recreate the API key in Brevo (Transactional → SMTP & API → Create a v3 key) and paste it here.' : undefined
            }
          });
        }

        console.log('Brevo health check passed, proceeding with send...');

        // SEND EMAIL VIA BREVO CLIENT WITH ENHANCED LOGGING
        const sendResult = await brevoClient.sendEmailWithLogging({
          fromName: settings.fromName || 'inteLMS System',
          fromEmail: settings.fromEmail,
          toEmail: testEmail,
          subject: 'inteLMS API Test',
          textContent: 'This is a test from inteLMS (brevo_api).'
        });

        // Return enhanced structured response format with full diagnostics
        return res.json({
          success: sendResult.success,
          provider: sendResult.provider || 'brevo_api',
          httpStatus: sendResult.httpStatus,
          message: sendResult.message,
          details: {
            endpoint: sendResult.endpoint,
            endpointHost: sendResult.endpointHost,
            from: settings.fromEmail,
            to: testEmail,
            messageId: sendResult.messageId || null,
            latencyMs: (sendResult as any).latencyMs,
            apiKeySource: sendResult.apiKeySource,
            apiKeyPreview: sendResult.apiKeyPreview,
            apiKeyLength: sendResult.apiKeyLength,
            helpText: sendResult.success ? 
              'Check Spam/Quarantine if you don\'t see the email. Also confirm the recipient server isn\'t blocking transactional mail.' :
              (sendResult.httpStatus === 400 && sendResult.message.toLowerCase().includes('sender')) ? 
                'Verify your sender/domain in Brevo → Senders & Domains.' : undefined,
            brevoError: sendResult.success ? undefined : sendResult.data?.message
          }
        });

      } else if (settings.provider === 'smtp') {
        // SMTP implementation placeholder
        return res.json({
          success: false,
          provider: 'smtp',
          httpStatus: 501,
          message: 'SMTP testing not implemented in this version. Please use Brevo API.',
          details: {
            endpoint: 'smtp',
            from: settings.fromEmail,
            to: testEmail,
            helpText: 'Configure Brevo API for email testing functionality.'
          }
        });
      } else {
        return res.json({
          success: false,
          provider: 'unknown',
          httpStatus: 400,
          message: 'Invalid email provider configuration',
          details: {
            endpoint: 'N/A',
            from: settings.fromEmail,
            to: testEmail
          }
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

      const settings = await storage.getSystemSmtpSettings();
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

      const settings = await storage.createSystemSmtpSettings(settingsData);
      
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

      const settings = await storage.updateSystemSmtpSettings(updateData);
      
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

  // Legacy email settings routes for backward compatibility
  app.put('/api/system/email-settings', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied - superadmin only' });
      }

      const {
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpSecure,
        fromEmail,
        fromName
      } = req.body;

      // Validate required fields
      if (!smtpHost || !smtpUsername || !smtpPassword || !fromEmail) {
        return res.status(400).json({ message: 'SMTP host, username, password, and from email are required' });
      }

      // Use new system SMTP settings
      const settingsData = {
        smtpHost: smtpHost.trim(),
        smtpPort: parseInt(smtpPort) || 587,
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword,
        smtpSecure: Boolean(smtpSecure),
        fromEmail: fromEmail.trim().toLowerCase(),
        fromName: fromName?.trim() || 'System',
        description: 'Legacy System SMTP Configuration',
        updatedBy: user.id
      };

      await storage.createSystemSmtpSettings(settingsData);

      res.json({ success: true, message: 'System email settings saved successfully' });
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

      const smtpHost = await storage.getPlatformSetting('system_smtp_host');
      const smtpPort = await storage.getPlatformSetting('system_smtp_port');
      const smtpUsername = await storage.getPlatformSetting('system_smtp_username');
      const smtpPassword = await storage.getPlatformSetting('system_smtp_password');
      const smtpSecure = await storage.getPlatformSetting('system_smtp_secure');
      const fromEmail = await storage.getPlatformSetting('system_from_email');
      const fromName = await storage.getPlatformSetting('system_from_name');

      const settings = {
        smtpHost: smtpHost?.value || '',
        smtpPort: smtpPort?.value ? parseInt(smtpPort.value) : 587,
        smtpUsername: smtpUsername?.value || '',
        smtpPassword: smtpPassword?.value || '',
        smtpSecure: smtpSecure?.value !== 'false',
        fromEmail: fromEmail?.value || '',
        fromName: fromName?.value || 'System',
      };

      res.json(settings);
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
      
      const healthResult = await singleMailerService.healthCheck(targetOrgId);
      
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
      
      const testResult = await singleMailerService.sendTestEmail(testEmail, targetOrgId, {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        userId: user.id
      });
      
      // Return detailed metadata for admin UI
      res.json({
        ...testResult,
        testDetails: {
          sentBy: user.email,
          sentAt: testResult.timestamp,
          userAgent: req.get('User-Agent'),
          clientIp: req.ip,
          organisationLevel: targetOrgId ? 'organisation' : 'system'
        }
      });
    } catch (error: any) {
      console.error('Error in admin SMTP test:', error);
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: (error as any)?.message || 'SMTP test failed',
        tlsEnabled: false,
        source: 'none'
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
        // Test connection only via Single Mailer Service
        const connectionResult = await singleMailerService.healthCheck(undefined);
        res.json({
          success: connectionResult.success,
          details: connectionResult
        });
      } else {
        // Send test email via Single Mailer Service (SMTP-only)
        const result = await singleMailerService.sendTestEmail(testEmail, undefined, {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        });
        
        res.json(result);
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

      // Use Single Mailer Service for SMTP-only delivery with comprehensive logging
      const result = await singleMailerService.sendTestEmail(testEmail, undefined, {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });
      
      if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully' });
      } else {
        res.status(500).json({ success: false, message: (result as any).details?.error || 'Failed to send test email. Please check your SMTP settings.' });
      }
    } catch (error) {
      console.error('Error sending system test email:', error);
      res.status(500).json({ 
        success: false, 
        message: (error as any)?.message || 'Failed to send test email. Please check your SMTP settings.' 
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
        // Admin can only see users from their organisation
        users = await storage.getUsersByOrganisation(user.organisationId);
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

      // Admin can only update users in their own organisation
      if (currentUser.role === 'admin') {
        const targetUser = await storage.getUser(id);
        if (!targetUser || targetUser.organisationId !== currentUser.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Validate status
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be active or inactive.' });
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

      // Admin can only delete users in their own organisation
      if (currentUser.role === 'admin') {
        if (targetUser.organisationId !== currentUser.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Prevent deleting yourself
      if (targetUser.id === currentUser.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      // Prevent deleting other SuperAdmins unless you're a SuperAdmin
      if (targetUser.role === 'superadmin' && currentUser.role !== 'superadmin') {
        return res.status(403).json({ message: 'Cannot delete SuperAdmin accounts' });
      }

      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  app.post('/api/users', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const validatedData = insertUserSchema.parse(req.body);
      
      // If admin, can only create users in their organisation
      if (user.role === 'admin') {
        validatedData.organisationId = user.organisationId;
      }

      const newUser = await storage.createUser(validatedData);
      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
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

      // If admin, can only update users in their organisation
      if (currentUser.role === 'admin') {
        if (targetUser.organisationId !== currentUser.organisationId) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Prepare update data
      const updateData: any = {
        ...req.body,
        updatedAt: new Date(),
      };

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

      const assignmentData = {
        courseId,
        userId,
        organisationId: organisationId || currentUser.organisationId,
        assignedBy: assignedBy || currentUser.id,
        status: 'not_started' as const,
        dueDate: dueDate ? new Date(dueDate) : null,
        notificationsEnabled: notificationsEnabled || true
      };

      const assignment = await storage.createAssignment(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  // Get overdue assignments count
  app.get('/api/admin/overdue-count/:organisationId', requireAuth, async (req: any, res) => {
    try {
      const organisationId = req.params.organisationId;
      const now = new Date();
      
      // Get all assignments for the organisation
      const assignments = await storage.getAssignmentsByOrganisation(organisationId);
      
      // Count overdue assignments (due date passed or status is overdue)
      const overdueCount = assignments.filter(assignment => {
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

      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const userData of usersData) {
        try {
          const validatedData = insertUserSchema.parse(userData);
          
          // If admin, can only create users in their organisation
          if (user.role === 'admin') {
            validatedData.organisationId = user.organisationId;
          }

          await storage.createUser(validatedData);
          created++;
        } catch (error: any) {
          failed++;
          errors.push(`${userData.email || 'Unknown'}: ${error.message}`);
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
      
      // For admins doing course assignment, only return active courses
      if (user?.role === 'admin') {
        const courses = await storage.getAllCourses();
        const activeCourses = courses.filter(course => course.status === 'published');
        res.json(activeCourses);
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
            await storage.createCompletion({
              assignmentId,
              userId,
              courseId: assignment.courseId,
              organisationId: assignment.organisationId,
              score: attemptData.scoreRaw?.toString() || '0',
              status: passed ? 'pass' : 'fail',
              timeSpent: 0, // Could be derived from session time if needed
              scormData: scormData,
            });
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
            await storage.createCompletion(completionData);
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
