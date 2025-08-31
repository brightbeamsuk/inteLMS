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
      const { firstName, lastName, jobTitle, department, phone, bio, profileImageUrl } = req.body;

      console.log('Profile update request body:', req.body);
      console.log('Extracted fields:', {
        firstName,
        lastName,
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
      if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
      if (department !== undefined) updateData.department = department;
      if (phone !== undefined) updateData.phone = phone;
      if (bio !== undefined) updateData.bio = bio;
      if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;

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
      
      // Process the upload
      const packageInfo = await scormPreviewService.processUpload(packageUrl);
      
      res.json({
        success: true,
        packageInfo,
        message: `Package processed successfully with ID: ${packageInfo.packageId}`
      });
      
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
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
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

      // Normalize logo URL if provided
      if (updateData.logoUrl) {
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();
        updateData.logoUrl = objectStorageService.normalizeObjectEntityPath(updateData.logoUrl);
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
      const summary = { red: 0, amber: 0, green: 0, grey: 0 };

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
            // Not completed - grey cell
            staffRow.push({
              status: 'grey',
              label: 'Not completed',
              attemptCount: completions.filter(c => 
                c.userId === staffMember.id && c.courseId === course.id
              ).length,
              assignmentId: assignment.id
            });
            summary.grey++;
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
      // Fetch all courses (published and archived) for SuperAdmin
      const courses = await storage.getAllCourses();
      res.json(courses);
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
      const userId = req.session.user?.id;
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

  // SCORM completion route
  app.post('/api/scorm/:assignmentId/complete', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const { assignmentId } = req.params;
      const scormData = req.body;

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
