import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { emailService } from "./services/emailService";
import { scormService } from "./services/scormService";
import { certificateService } from "./services/certificateService";
import { insertUserSchema, insertOrganisationSchema, insertCourseSchema, insertAssignmentSchema } from "@shared/schema";
import { z } from "zod";

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

  // Helper function to get current user
  async function getCurrentUser(req: any) {
    return req.session?.user || null;
  }

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
            : '/dashboard'
        });
      }

      return res.status(401).json({ message: "Invalid credentials" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post('/api/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
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

  // Object storage routes
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    const userId = req.session.user?.id;
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

  app.post('/api/organisations', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const validatedData = insertOrganisationSchema.parse(req.body);
      const organisation = await storage.createOrganisation(validatedData);
      
      // Create default organisation settings
      await storage.createOrganisationSettings({
        organisationId: organisation.id,
        signerName: 'Administrator',
        signerTitle: 'Learning Manager',
      });

      res.status(201).json(organisation);
    } catch (error) {
      console.error('Error creating organisation:', error);
      res.status(500).json({ message: 'Failed to create organisation' });
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

  // Courses routes
  app.get('/api/courses', requireAuth, async (req: any, res) => {
    try {
      const courses = await storage.getCoursesByStatus('published');
      res.json(courses);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ message: 'Failed to fetch courses' });
    }
  });

  app.post('/api/courses', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const validatedData = insertCourseSchema.parse({
        ...req.body,
        createdBy: user.id,
      });

      const course = await storage.createCourse(validatedData);
      res.status(201).json(course);
    } catch (error) {
      console.error('Error creating course:', error);
      res.status(500).json({ message: 'Failed to create course' });
    }
  });

  // Assignments routes
  app.get('/api/assignments', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return res.status(403).json({ message: 'Access denied' });
      }

      let assignments;
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
      if (user.role === 'admin') {
        validatedData.organisationId = user.organisationId;
      }

      const assignment = await storage.createAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  // SCORM player route
  app.get('/api/scorm/:assignmentId/player', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      const { assignmentId } = req.params;

      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment || assignment.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const course = await storage.getCourse(assignment.courseId);
      if (!course || !course.scormPackageUrl) {
        return res.status(404).json({ message: 'Course or SCORM package not found' });
      }

      const playerHtml = await scormService.getPlayerHtml(course.scormPackageUrl, userId, assignmentId);
      res.setHeader('Content-Type', 'text/html');
      res.send(playerHtml);
    } catch (error) {
      console.error('Error loading SCORM player:', error);
      res.status(500).json({ message: 'Failed to load SCORM player' });
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
        score: completionData.score,
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
