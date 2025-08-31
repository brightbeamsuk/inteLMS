import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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
