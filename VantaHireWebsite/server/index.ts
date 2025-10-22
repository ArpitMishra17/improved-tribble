import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startJobScheduler } from "./jobScheduler";
import { createAdminUser, createTestRecruiter, syncAdminPasswordIfEnv } from "./createAdminUser";
import { createTestJobs } from "./createTestJobs";
import { seedAllATSDefaults } from "./seedATSDefaults";
import { ensureAtsSchema } from "./bootstrapSchema";

const app = express();

// Enable GZIP compression for all responses
app.use(compression({
  level: 6, // Compression level (0-9, 6 is default and good balance)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// WWW to non-WWW redirect for SEO (301 permanent redirect)
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    return res.redirect(301, `${protocol}://${host.slice(4)}${req.url}`);
  }
  next();
});

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
    // Normalize common upload/validation errors to 400 instead of 500
    let status = err.status || err.statusCode || 500;
    const isMulter = err?.name === 'MulterError' || err?.code === 'LIMIT_FILE_SIZE' || /Only PDF files/.test(err?.message || '');
    if (isMulter && status === 500) status = 400;

    const message = err.message || "Internal Server Error";

    res.status(status).json({ error: message });
    console.error('Server error:', err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Bind to platform-provided PORT (e.g., Railway/Heroku), fallback to 5000
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);

    // Initialize database: Create schema, sync admin, seed data
    try {
      // 1. Ensure ATS tables exist (creates them if missing)
      await ensureAtsSchema();

      // 2. Create/sync admin user
      await createAdminUser();
      await syncAdminPasswordIfEnv();
      await createTestRecruiter();

      // 3. Seed ATS defaults (pipeline stages, email templates, consultants)
      await seedAllATSDefaults();

      // 4. Create test jobs
      await createTestJobs();
    } catch (error) {
      console.error('Error initializing database:', error);
    }

    // Start job scheduler for automatic job expiration
    startJobScheduler();
  });
})();
