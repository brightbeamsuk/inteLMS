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
import { emailService } from "./services/emailService";
import { scormService } from "./services/scormService";
import { certificateService } from "./services/certificateService";
import { ScormPreviewService } from "./services/scormPreviewService";
import { insertUserSchema, insertOrganisationSchema, insertCourseSchema, insertAssignmentSchema } from "@shared/schema";
import { z } from "zod";

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

      const completions = await storage.getCompletionsByUser(user.id);
      const completedCourses = completions.filter(c => c.status === 'completed');
      const completedCount = completedCourses.length;
      
      // Calculate average score from completed courses
      const scoresWithValues = completedCourses.filter(c => c.score !== null && c.score !== undefined);
      const averageScore = scoresWithValues.length > 0 
        ? Math.round(scoresWithValues.reduce((sum, c) => sum + (c.score || 0), 0) / scoresWithValues.length)
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

      // Get certificate and verify ownership
      const certificate = await storage.getCertificate(certificateId);
      if (!certificate) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      if (certificate.userId !== userId) {
        return res.status(403).json({ message: 'Access denied - certificate does not belong to you' });
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
        userId: userId,
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
        const content = await fs.promises.readFile(filePath, 'utf-8');
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
            (match, src) => {
              const resolvedPath = resolveRelativePath(src);
              return `src="/api/scorm/content?packageUrl=${encodedPackageUrl}&file=${resolvedPath}"`;
            })
          .replace(/href\s*=\s*["'](?!https?:\/\/)(?!\/api\/scorm\/)([^"']+)["']/gi, 
            (match, href) => {
              const resolvedPath = resolveRelativePath(href);
              return `href="/api/scorm/content?packageUrl=${encodedPackageUrl}&file=${resolvedPath}"`;
            })
          .replace(/url\s*\(\s*["']?(?!https?:\/\/)(?!\/api\/scorm\/)([^"')]+)["']?\s*\)/gi, 
            (match, url) => {
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
      console.error(`❌ Unexpected error in SCORM launch for assignment ${assignmentId}:`, error);
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
        error: error.message
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

      res.json(organisation);
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
      global.impersonationTokens = global.impersonationTokens || new Map();
      global.impersonationTokens.set(impersonationToken, {
        userId: adminUser.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
      });
      
      // Clean up expired tokens
      for (const [token, data] of global.impersonationTokens.entries()) {
        if (data.expiresAt < Date.now()) {
          global.impersonationTokens.delete(token);
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
      
      if (!token || !global.impersonationTokens?.has(token)) {
        return res.status(404).send('Invalid or expired impersonation token');
      }
      
      const tokenData = global.impersonationTokens.get(token);
      if (tokenData.expiresAt < Date.now()) {
        global.impersonationTokens.delete(token);
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
      global.impersonationTokens.delete(token);
      
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

      const updatedUser = await storage.updateUser(id, { status, updatedAt: new Date() });
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
      let courseIds = [...new Set(assignments.map(a => a.courseId))];
      
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

      // Calculate matrix data only for filtered staff and courses
      const matrix: any[][] = [];
      const summary = { red: 0, amber: 0, green: 0, grey: 0, blue: 0 };

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

          // Find latest completion
          const userCompletions = completions.filter(c => 
            c.userId === staffMember.id && 
            c.courseId === course.id &&
            c.status === 'pass'
          );
          
          const latestCompletion = userCompletions.sort((a, b) => 
            new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
          )[0];

          if (!latestCompletion) {
            // Not completed - check assignment status and due date
            const now = new Date();
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(now.getDate() + 7);
            
            let cellStatus: 'red' | 'amber' | 'blue' | 'grey';
            let cellLabel: string;
            
            // Check assignment status first
            if (assignment.status === 'overdue') {
              cellStatus = 'red';
              cellLabel = 'Overdue';
            } else if (assignment.status === 'in_progress') {
              cellStatus = 'blue';
              cellLabel = 'In progress';
            } else {
              // Check due date for assignments that aren't overdue
              if (assignment.dueDate) {
                const dueDate = new Date(assignment.dueDate);
                if (dueDate < now) {
                  cellStatus = 'red';
                  cellLabel = 'Overdue';
                } else if (dueDate <= sevenDaysFromNow) {
                  cellStatus = 'amber';
                  cellLabel = 'Due soon';
                } else {
                  cellStatus = 'grey';
                  cellLabel = 'Not started';
                }
              } else {
                cellStatus = 'grey';
                cellLabel = 'Not started';
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
        const filteredSummary = { red: 0, amber: 0, green: 0, grey: 0 };

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
        
        finalSummary = filteredSummary;
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
      let courseIds = [...new Set(assignments.map(a => a.courseId))];
      
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
        standard,
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
        } else {
          // No progress measure provided by SCORM
          progressPercent = 0;
          console.log('📊 SCORM 2004: No progress_measure provided -> 0%');
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
          // For incomplete, look for explicit progress in suspend_data
          let scormProgress = 0;
          if (attemptData.suspendData) {
            try {
              const suspendJson = JSON.parse(attemptData.suspendData);
              if (typeof suspendJson.progress === 'number') {
                scormProgress = Math.round(suspendJson.progress);
                console.log(`📊 SCORM 1.2: Found progress in suspend_data: ${scormProgress}%`);
              } else if (typeof suspendJson.percentage === 'number') {
                scormProgress = Math.round(suspendJson.percentage);
                console.log(`📊 SCORM 1.2: Found percentage in suspend_data: ${scormProgress}%`);
              }
            } catch {
              // Try pattern matching for non-JSON suspend data
              const progressMatch = attemptData.suspendData.match(/(?:progress|percentage)[":=\s]*(\d+(?:\.\d+)?)/i);
              if (progressMatch) {
                scormProgress = Math.round(parseFloat(progressMatch[1]));
                console.log(`📊 SCORM 1.2: Extracted progress from suspend_data: ${scormProgress}%`);
              }
            }
          }
          progressPercent = Math.min(100, Math.max(0, scormProgress));
          if (progressPercent === 0) {
            console.log('📊 SCORM 1.2: No progress data in suspend_data -> 0%');
          }
        }
      }
      
      console.log(`📊 Final calculated progress: ${progressPercent}%`);
          
          // Check if suspend data contains progress information
          if (attemptData.suspendData && attemptData.suspendData.trim()) {
            try {
              // Try to parse JSON suspend data for progress
              const suspendJson = JSON.parse(attemptData.suspendData);
              if (suspendJson.progress && !isNaN(parseInt(suspendJson.progress))) {
                extractedProgress = parseInt(suspendJson.progress);
              } else if (suspendJson.percentage && !isNaN(parseInt(suspendJson.percentage))) {
                extractedProgress = parseInt(suspendJson.percentage);
              }
            } catch {
              // Try to extract percentage from string patterns
              const percentMatch = attemptData.suspendData.match(/(\d+)%/);
              const progressMatch = attemptData.suspendData.match(/progress[:\s]*(\d+)/i);
              
              if (percentMatch && !isNaN(parseInt(percentMatch[1]))) {
                extractedProgress = parseInt(percentMatch[1]);
              } else if (progressMatch && !isNaN(parseInt(progressMatch[1]))) {
                extractedProgress = parseInt(progressMatch[1]);
              }
            }
            
            // If suspend data exists but no percentage found, assume progress based on data length
            if (!extractedProgress) {
              const dataLength = attemptData.suspendData.length;
              if (dataLength > 1000) extractedProgress = 80;      // Substantial data
              else if (dataLength > 500) extractedProgress = 60;  // Moderate data  
              else if (dataLength > 100) extractedProgress = 40;  // Some data
              else extractedProgress = 25;                        // Minimal data
            }
          }
          
          // Check lesson location for slide/page progress
          if (!extractedProgress && attemptData.lessonLocation && attemptData.lessonLocation.trim()) {
            const slideMatch = attemptData.lessonLocation.match(/slide[:\s]*(\d+)/i);
            const pageMatch = attemptData.lessonLocation.match(/page[:\s]*(\d+)/i);
            const sectionMatch = attemptData.lessonLocation.match(/section[:\s]*(\d+)/i);
            
            if (slideMatch && !isNaN(parseInt(slideMatch[1]))) {
              const currentSlide = parseInt(slideMatch[1]);
              extractedProgress = Math.min(90, Math.max(25, Math.round((currentSlide / 15) * 100))); // Assume 15 slides
            } else if (pageMatch && !isNaN(parseInt(pageMatch[1]))) {
              const currentPage = parseInt(pageMatch[1]);
              extractedProgress = Math.min(90, Math.max(25, Math.round((currentPage / 8) * 100))); // Assume 8 pages
            } else if (sectionMatch && !isNaN(parseInt(sectionMatch[1]))) {
              const currentSection = parseInt(sectionMatch[1]);
              extractedProgress = Math.min(90, Math.max(25, Math.round((currentSection / 5) * 100))); // Assume 5 sections
            } else {
              extractedProgress = 35; // Generic location bookmark exists
            }
          }
          
          // Use session time as a progress indicator if available
          if (!extractedProgress && attemptData.sessionTime && attemptData.sessionTime !== '00:00:00') {
            const timeMatch = attemptData.sessionTime.match(/(\d+):(\d+):(\d+)/);
            if (timeMatch) {
              const totalMinutes = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]) + Math.floor(parseInt(timeMatch[3]) / 60);
              if (totalMinutes > 0) {
                // Progressive time-based calculation
                if (totalMinutes >= 30) extractedProgress = 85;      // 30+ minutes = substantial progress
                else if (totalMinutes >= 20) extractedProgress = 70; // 20+ minutes = good progress
                else if (totalMinutes >= 10) extractedProgress = 50; // 10+ minutes = moderate progress
                else if (totalMinutes >= 5) extractedProgress = 35;  // 5+ minutes = some progress
                else extractedProgress = 20;                        // < 5 minutes = minimal progress
              }
            }
          }
          
          // Final progress assignment
          if (extractedProgress > 0) {
            progressPercent = Math.min(95, Math.max(10, extractedProgress)); // Cap incomplete at 95%, minimum 10%
          } else {
            // No indicators - check if any data exists at all
            const hasAnyData = attemptData.suspendData || attemptData.lessonLocation || 
                             (attemptData.sessionTime && attemptData.sessionTime !== '00:00:00');
            progressPercent = hasAnyData ? 25 : 5; // Minimal progress if any data, otherwise near-zero
          }
        } else if (attemptData.lessonStatus === 'failed') {
          progressPercent = 100; // Failed means they completed the content
        } else if (attemptData.lessonStatus === 'browsed') {
          progressPercent = 90; // Browsed typically means substantial interaction
        } else {
          progressPercent = 0; // Default for other statuses
        }
      } else if (standard === '2004') {
        // Enhanced SCORM 2004 progress calculation
        const completionStatus = attemptData.completionStatus;
        const successStatus = attemptData.successStatus;
        const progressMeasure = attemptData.progressMeasure ? parseFloat(attemptData.progressMeasure) : null;
        
        // Completion logic: completed OR passed = course complete
        if (completionStatus === 'completed' || successStatus === 'passed') {
          progressPercent = 100;
        } else if (successStatus === 'failed') {
          progressPercent = 100; // Failed means they completed the assessment
        } else if (progressMeasure !== null && !isNaN(progressMeasure) && progressMeasure >= 0 && progressMeasure <= 1) {
          // Use cmi.progress_measure if valid (0-1 scale)
          progressPercent = Math.round(progressMeasure * 100);
        } else if (completionStatus === 'incomplete') {
          // Similar logic to SCORM 1.2 for incomplete content
          let extractedProgress = 0;
          
          if (attemptData.suspendData && attemptData.suspendData.trim()) {
            try {
              const suspendJson = JSON.parse(attemptData.suspendData);
              if (suspendJson.progress && !isNaN(parseInt(suspendJson.progress))) {
                extractedProgress = parseInt(suspendJson.progress);
              }
            } catch {
              const percentMatch = attemptData.suspendData.match(/(\d+)%/);
              if (percentMatch && !isNaN(parseInt(percentMatch[1]))) {
                extractedProgress = parseInt(percentMatch[1]);
              }
            }
            
            if (!extractedProgress) {
              const dataLength = attemptData.suspendData.length;
              if (dataLength > 1000) extractedProgress = 75;
              else if (dataLength > 500) extractedProgress = 55;
              else if (dataLength > 100) extractedProgress = 35;
              else extractedProgress = 20;
            }
          }
          
          if (!extractedProgress && attemptData.location && attemptData.location.trim()) {
            extractedProgress = 40; // Has bookmark location
          }
          
          if (!extractedProgress && attemptData.sessionTime && attemptData.sessionTime !== 'PT0H0M0S') {
            // Parse ISO 8601 duration format PT[n]H[n]M[n]S
            const timeMatch = attemptData.sessionTime.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (timeMatch) {
              const hours = parseInt(timeMatch[1] || '0');
              const minutes = parseInt(timeMatch[2] || '0');
              const totalMinutes = hours * 60 + minutes;
              
              if (totalMinutes >= 25) extractedProgress = 80;
              else if (totalMinutes >= 15) extractedProgress = 60;
              else if (totalMinutes >= 8) extractedProgress = 45;
              else if (totalMinutes >= 3) extractedProgress = 30;
              else extractedProgress = 15;
            }
          }
          
          progressPercent = extractedProgress > 0 ? Math.min(95, Math.max(10, extractedProgress)) : 5;
        } else {
          progressPercent = 0; // not attempted, unknown, etc.
        }
      } else if (attemptData.suspendData) {
        // Fallback: Try to extract progress from suspend data
        let extractedProgress = 0;
        try {
          const suspendJson = JSON.parse(attemptData.suspendData);
          if (suspendJson.progress) extractedProgress = parseInt(suspendJson.progress);
        } catch {
          const percentMatch = attemptData.suspendData.match(/(\d+)%/);
          if (percentMatch) extractedProgress = parseInt(percentMatch[1]);
        }
        progressPercent = extractedProgress || 15; // Conservative fallback
      }
      
      // 2. Completed (boolean)
      let completed = false;
      if (standard === '1.2') {
        completed = ['completed', 'passed', 'failed'].includes(attemptData.lessonStatus);
      } else if (standard === '2004') {
        completed = attemptData.completionStatus === 'completed';
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
      
      if (reason === 'finish') {
        attemptData.finishedAt = new Date();
        attemptData.status = 'completed';
      } else {
        attemptData.status = 'active';
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
          wasAlreadyPassed = existingAttempt.passed;
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

      // Update assignment status if needed
      if (reason === 'finish' && completed) {
        try {
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
        } catch (statusError) {
          console.error('Error updating assignment status:', statusError);
        }
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
      res.status(500).json({ message: 'Failed to process SCORM result', error: error.message });
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
