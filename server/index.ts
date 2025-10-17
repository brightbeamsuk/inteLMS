import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Add raw body parsing middleware for Stripe webhooks (before JSON parsing)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Standard JSON and URL-encoded parsing for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set correct Content-Type headers for images
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
    }
  }
}));

// Serve static files from public directory (for test certificates, etc.)
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

// Serve extracted SCORM files with iframe-friendly headers
app.use('/scos', (req, res, next) => {
  // Log 404/403 errors for debugging
  const originalSend = res.send;
  res.send = function(body) {
    if (res.statusCode === 404 || res.statusCode === 403) {
      const requestedUrl = req.originalUrl;
      const resolvedDiskPath = path.join(process.cwd(), 'public', 'scos', req.path);
      console.error(`🚫 SCORM static file error ${res.statusCode}: ${requestedUrl}`);
      console.error(`📁 Resolved disk path: ${resolvedDiskPath}`);
    }
    return originalSend.call(this, body);
  };
  next();
}, express.static(path.join(process.cwd(), 'public', 'scos'), {
  setHeaders: (res, filePath) => {
    // Remove X-Frame-Options to allow iframe embedding
    res.removeHeader('X-Frame-Options');
    
    // Set CSP to allow framing by same origin
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    
    // Set appropriate Content-Type for SCORM files
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.swf': 'application/x-shockwave-flash',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf'
    };
    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Schema patcher - Add missing database columns for PDF certificate templates
  console.log('🔧 Applying database schema patches...');
  try {
    const { db } = await import('./db.js');
    
    // Add PDF template URL column to certificate templates if it doesn't exist
    await db.execute(`
      ALTER TABLE certificate_templates 
      ADD COLUMN IF NOT EXISTS pdf_template_url TEXT;
    `);
    
    console.log('✅ Database schema patches applied successfully');
  } catch (error) {
    console.error('❌ Schema patch failed:', error);
    // Continue anyway - the column might already exist
  }

  // Initialize GDPR Breach Management Services
  // Critical for Articles 33 & 34 compliance - automatic deadline monitoring
  console.log('🛡️  Initializing GDPR breach management services...');
  
  try {
    // Import breach management services
    const { BreachDeadlineService } = await import('./services/BreachDeadlineService.js');
    const { BreachNotificationService } = await import('./services/BreachNotificationService.js');
    
    // Import data retention service for GDPR Article 5(e) compliance
    const { DataRetentionService } = await import('./services/DataRetentionService.js');
    
    // Initialize services
    const breachDeadlineService = new BreachDeadlineService();
    const breachNotificationService = new BreachNotificationService();
    const dataRetentionService = new DataRetentionService();
    
    // Register breach notification templates at startup
    await breachNotificationService.registerBreachTemplates();
    console.log('✅ Breach notification templates registered');
    
    // Set up automated deadline monitoring (every hour)
    // Critical: 72-hour ICO notification deadlines per Article 33
    const DEADLINE_MONITOR_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    
    const deadlineMonitorLoop = async () => {
      try {
        console.log('🚨 Starting breach deadline monitoring sweep...');
        await breachDeadlineService.monitorAllDeadlines();
        console.log('✅ Breach deadline monitoring completed successfully');
      } catch (error) {
        console.error('❌ CRITICAL: Breach deadline monitoring failed:', error);
        // Don't throw - keep the server running, but log for monitoring alerts
      }
    };
    
    // Start initial monitoring check
    setImmediate(deadlineMonitorLoop);
    
    // Schedule hourly monitoring
    setInterval(deadlineMonitorLoop, DEADLINE_MONITOR_INTERVAL_MS);
    
    console.log(`✅ Breach deadline monitoring active - checking every ${DEADLINE_MONITOR_INTERVAL_MS / 1000 / 60} minutes`);
    
    // ===== ENHANCED DATA RETENTION LIFECYCLE AUTOMATION =====
    // GDPR Article 5(e) Storage Limitation - Automated Data Lifecycle Management
    console.log('🗂️  Initializing automated data retention scanning...');
    
    // Set up automated retention scanning (every 6 hours for production efficiency)
    // Critical: Automated soft-delete and secure erase compliance
    const RETENTION_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
    
    const retentionScanLoop = async () => {
      try {
        console.log('📊 Starting automated data retention lifecycle scan...');
        
        // Get all organizations for comprehensive scanning
        const { storage } = await import('./storage.js');
        const organisations = await storage.getAllOrganisations();
        
        let totalProcessed = 0;
        let totalSoftDeleted = 0;
        let totalSecurelyErased = 0;
        
        for (const org of organisations) {
          try {
            console.log(`🔍 Scanning retention policies for organization: ${org.name} (${org.id})`);
            
            // Execute retention scanning for this organization
            const scanResult = await dataRetentionService.executeRetentionLifecycleScan(org.id);
            
            totalProcessed += scanResult.recordsProcessed || 0;
            totalSoftDeleted += scanResult.recordsSoftDeleted || 0;
            totalSecurelyErased += scanResult.recordsSecurelyErased || 0;
            
            console.log(`✅ Org ${org.name}: Processed ${scanResult.recordsProcessed}, Soft-deleted ${scanResult.recordsSoftDeleted}, Securely erased ${scanResult.recordsSecurelyErased}`);
            
          } catch (orgError) {
            console.error(`❌ Retention scan failed for organization ${org.id}:`, orgError);
            // Continue with other organizations even if one fails
          }
        }
        
        console.log(`✅ Data retention lifecycle scan completed successfully`);
        console.log(`📋 Total Summary: Processed ${totalProcessed}, Soft-deleted ${totalSoftDeleted}, Securely erased ${totalSecurelyErased} records`);
        
      } catch (error) {
        console.error('❌ CRITICAL: Data retention lifecycle scan failed:', error);
        // Don't throw - keep the server running, but log for monitoring alerts
      }
    };
    
    // Start initial retention scan (delayed by 2 minutes to let server fully start)
    setTimeout(() => {
      console.log('🚀 Starting initial data retention scan...');
      retentionScanLoop();
    }, 2 * 60 * 1000); // 2 minute delay
    
    // Schedule regular retention scanning
    setInterval(retentionScanLoop, RETENTION_SCAN_INTERVAL_MS);
    
    console.log(`✅ Data retention lifecycle scanning active - checking every ${RETENTION_SCAN_INTERVAL_MS / 1000 / 60 / 60} hours`);
    console.log('🛡️  GDPR breach management and data retention services initialized successfully');
    
  } catch (error) {
    console.error('❌ CRITICAL: Failed to initialize GDPR breach management services:', error);
    // Don't throw - continue server startup but alert that breach monitoring is disabled
    console.error('⚠️  GDPR breach monitoring is DISABLED - manual monitoring required!');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Debug middleware for API requests
  app.use('/api/*', (req, res, next) => {
    console.log(`🔍 DEBUG: API request intercepted - ${req.method} ${req.path}`);
    next();
  });

  // Handle PDF files explicitly before Vite catch-all
  app.get('*.pdf', (req, res, next) => {
    const pdfPath = path.join(process.cwd(), 'public', req.path);
    res.sendFile(pdfPath, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline'
      }
    }, (err) => {
      if (err) {
        next();
      }
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Workaround: Create POST endpoint to bypass Vite PUT interception issue
  app.post('/api/superadmin/email/templates/:key/update', async (req: any, res) => {
    try {
      // Simple auth check
      if (!req.session?.user?.role || req.session.user.role !== 'superadmin') {
        return res.status(403).json({ 
          ok: false, 
          error: 'Access denied - SuperAdmin required' 
        });
      }
      
      const { key } = req.params;
      
      if (!key) {
        return res.status(400).json({
          ok: false,
          error: 'Template key is required'
        });
      }

      // Import necessary modules
      const { storage } = await import('./storage.js');
      const { insertEmailTemplateSchema } = await import('@shared/schema.js');
      
      console.log(`🔧 WORKAROUND: email.tpl.update.start key=${key}`);

      // Validate the update data using the insert schema (subset for updates)
      const updateSchema = insertEmailTemplateSchema.partial().omit({ key: true });
      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        console.log('🔧 WORKAROUND: email.tpl.update.fail stage=validation err="Invalid update data"');
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

      console.log(`🔧 WORKAROUND: email.tpl.update.query key=${key}`);

      // Check if template exists
      const existingTemplate = await storage.getEmailTemplateByKey(key);
      if (!existingTemplate) {
        console.log('🔧 WORKAROUND: email.tpl.update.fail stage=query err="Template not found"');
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

      console.log(`🔧 WORKAROUND: email.tpl.update.save key=${key} version=${updatePayload.version}`);

      // Update the template
      const updatedTemplate = await storage.updateEmailTemplate(key, updatePayload);

      if (!updatedTemplate) {
        console.log('🔧 WORKAROUND: email.tpl.update.fail stage=save err="Update failed"');
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

      console.log(`🔧 WORKAROUND: email.tpl.update.success key=${key} version=${updatedTemplate.version}`);

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
      console.error('🔧 WORKAROUND: email.tpl.update.fail stage=unknown err="' + (error.message || 'Unknown error').substring(0, 50) + '"');
      
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
