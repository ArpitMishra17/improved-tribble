import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertJobSchema, insertApplicationSchema, insertPipelineStageSchema, insertEmailTemplateSchema, type InsertEmailTemplate } from "@shared/schema";
import { z } from "zod";
import { getEmailService } from "./simpleEmailService";
import { setupAuth, requireAuth, requireRole } from "./auth";
import { upload, uploadToCloudinary } from "./cloudinary";
import rateLimit from "express-rate-limit";
import { analyzeJobDescription, generateJobScore, calculateOptimizationSuggestions, isAIEnabled } from "./aiJobAnalyzer";
import { sendTemplatedEmail, sendStatusUpdateEmail, sendInterviewInvitation, sendApplicationReceivedEmail, sendOfferEmail, sendRejectionEmail } from "./emailTemplateService";
import helmet from "helmet";
// Import csrf-csrf with compatibility for CJS/ESM builds
import * as csrfCsrfMod from "csrf-csrf";

// ATS Validation Schemas
const updateStageSchema = z.object({
  stageId: z.number().int().positive(),
  notes: z.string().optional(),
});

// Be lenient: allow date-only (YYYY-MM-DD) or full ISO datetime; empty strings treated as undefined
const scheduleInterviewSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup security middleware with environment-aware CSP
  const isDevelopment = process.env.NODE_ENV === 'development';

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // scriptSrc: Only allow unsafe directives in development
        scriptSrc: isDevelopment
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://assets.apollo.io"]
          : ["'self'", "https://assets.apollo.io"],
        // styleSrc: Only allow unsafe-inline in development
        styleSrc: isDevelopment
          ? ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
          : ["'self'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        // connectSrc: Restrict WebSocket connections in production
        connectSrc: isDevelopment
          ? ["'self'", "ws:", "wss:", "https://assets.apollo.io"]
          : ["'self'", "https://assets.apollo.io"],
        fontSrc: [
          "'self'",
          "data:",
          "https://fonts.gstatic.com",
          "https://r2cdn.perplexity.ai",
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));

  // Enable HSTS in production to enforce HTTPS (prevents protocol downgrade)
  if (!isDevelopment) {
    app.use(helmet.hsts({
      // 180 days in seconds (recommended minimum); here ~180 days
      maxAge: 60 * 60 * 24 * 180,
      includeSubDomains: true,
      preload: false,
    }));
  }
  
  // Setup authentication
  setupAuth(app);

  // Setup CSRF protection for session-backed mutations
  const anyCsrf: any = csrfCsrfMod as any;
  const doubleCsrfFactory: any = anyCsrf?.doubleCsrf || anyCsrf?.default?.doubleCsrf || (typeof anyCsrf === 'function' ? anyCsrf : null);
  if (!doubleCsrfFactory) {
    throw new Error('csrf-csrf: doubleCsrf factory not found (CJS/ESM interop)');
  }
  const cookieName = isDevelopment ? 'x-csrf-token' : '__Host-psifi.x-csrf-token';
  const { doubleCsrfProtection, generateToken } = doubleCsrfFactory({
    getSecret: () => process.env.SESSION_SECRET || 'default-secret-please-change',
    // __Host- prefix requires secure flag; only use in production
    cookieName,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: !isDevelopment,
      path: '/',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  // CSRF token endpoint - must be called before making mutating requests
  app.get("/api/csrf-token", (req: Request, res: Response) => {
    const token = generateToken(req, res);
    res.json({ token });
  });

  // Rate limiting configurations
  const applicationRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 applications per hour per IP
    message: { error: 'Too many applications. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  const jobPostingRateLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 10, // 10 job posts per day per user
    message: { error: 'Job posting limit reached. Try again tomorrow.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiting for AI analysis - 5 requests per hour per user
  const aiAnalysisRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each user to 5 AI requests per hour
    message: { error: "AI analysis limit reached. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'anonymous',
  });
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Public client configuration (non-sensitive)
  app.get("/api/client-config", (_req: Request, res: Response) => {
    res.json({
      apolloAppId: process.env.APOLLO_APP_ID || null,
    });
  });

  // AI features status
  app.get("/api/features/ai", (req: Request, res: Response) => {
    res.json({
      enabled: isAIEnabled(),
      features: {
        jobAnalysis: isAIEnabled(),
        jobScoring: isAIEnabled(),
      },
      message: isAIEnabled()
        ? 'AI features are available'
        : 'AI features require OPENAI_API_KEY to be configured'
    });
  });

  // Contact form submission endpoint
  app.post("/api/contact", doubleCsrfProtection, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extend the schema with additional validation
      const contactValidationSchema = insertContactSchema.extend({
        email: z.string().email("Please enter a valid email address"),
        message: z.string().min(1, "Please enter a message"),
      });
      
      const contactData = contactValidationSchema.parse(req.body);
      const submission = await storage.createContactSubmission(contactData);
      
      // Send email notification
      try {
        const emailService = await getEmailService();
        if (emailService) {
          const result = await emailService.sendContactNotification(submission);
          if (result) {
            console.log(`Email notification sent for submission ID: ${submission.id}`);
          } else {
            console.log(`Failed to send email notification for submission ID: ${submission.id}`);
          }
        } else {
          console.log('Email service not available. Skipping notification email.');
        }
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the request if email sending fails
      }
      
      res.status(201).json({ 
        success: true, 
        message: "Thank you for your message! We'll get back to you soon.",
        id: submission.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false,
          error: error.errors.map(e => ({ 
            field: e.path.join('.'), 
            message: e.message 
          }))
        });
      } else {
        next(error);
      }
    }
  });
  
  // Get all contact submissions (admin access)
  app.get("/api/contact", requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submissions = await storage.getAllContactSubmissions();
      res.json(submissions);
    } catch (error) {
      next(error);
    }
  });

  // Test email notification (for admin use)
  app.get("/api/test-email", requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const emailService = await getEmailService();
      
      if (emailService) {
        const testSubmission = {
          id: 0,
          name: "Test User",
          email: "test@example.com",
          phone: "+1234567890",
          company: "Test Company",
          location: "Test Location",
          message: "This is a test email from VantaHire.",
          submittedAt: new Date()
        };
        
        const result = await emailService.sendContactNotification(testSubmission);
        
        if (result) {
          res.json({ success: true, message: "Test email sent successfully" });
        } else {
          res.status(500).json({ success: false, message: "Failed to send test email" });
        }
      } else {
        res.status(400).json({ 
          success: false, 
          message: "Email service not available. Please check server logs for details." 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Error sending test email", 
        error: String(error) 
      });
    }
  });

  // ============= JOB MANAGEMENT ROUTES =============
  
  // Create a new job posting (recruiters/admins only)
  app.post("/api/jobs", jobPostingRateLimit, doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const job = await storage.createJob({
        ...jobData,
        postedBy: req.user!.id
      });
      
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation error',
          details: error.errors.map(e => ({ 
            field: e.path.join('.'), 
            message: e.message 
          }))
        });
      } else {
        next(error);
      }
    }
  });

  // Get all jobs with filtering and pagination
  app.get("/api/jobs", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const location = req.query.location as string;
      const type = req.query.type as string;
      const search = req.query.search as string;
      const skills = req.query.skills ? (req.query.skills as string).split(',') : undefined;

      const result = await storage.getJobs({
        page,
        limit,
        location,
        type,
        search,
        skills
      });

      res.json({
        jobs: result.jobs,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Get a specific job by ID
  app.get("/api/jobs/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Increment view count for analytics
      await storage.incrementJobViews(jobId);

      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // Submit job application with resume upload
  app.post("/api/jobs/:id/apply", applicationRateLimit, doubleCsrfProtection, upload.single('resume'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      // Check if job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Resume file is required' });
      }

      // Increment apply click count for analytics
      await storage.incrementApplyClicks(jobId);

      // Validate application data
      const applicationData = insertApplicationSchema.parse(req.body);

      // Upload resume to Cloudinary or use placeholder if not configured
      let resumeUrl = 'placeholder-resume.pdf';
      if (req.file) {
        try {
          resumeUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        } catch (error) {
          console.log('Cloudinary not configured, using placeholder resume URL');
          resumeUrl = `resume-${Date.now()}-${req.file.originalname}`;
        }
      }

      // Create application record
      const application = await storage.createApplication({
        ...applicationData,
        jobId,
        resumeUrl,
        // Bind to user account if authenticated (for candidate access control)
        userId: req.user?.id
      });

      // Fire-and-forget: candidate confirmation (if enabled)
      const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
      if (autoEmails) {
        sendApplicationReceivedEmail(application.id).catch(err => console.error('Application received email error:', err));
      }

      // Send notification email to recruiter
      try {
        const emailService = await getEmailService();
        if (emailService) {
          // Create a notification for the recruiter
          const recruiterNotification = {
            id: application.id,
            name: `New Application for ${job.title}`,
            email: application.email,
            phone: application.phone,
            company: `Applied for: ${job.title}`,
            location: job.location,
            message: `
New job application received:
- Applicant: ${application.name}
- Email: ${application.email}
- Phone: ${application.phone}
- Job: ${job.title}
- Resume: ${resumeUrl}
- Cover Letter: ${application.coverLetter || 'Not provided'}
            `,
            submittedAt: application.appliedAt
          };
          
          await emailService.sendContactNotification(recruiterNotification);
        }
      } catch (emailError) {
        console.error('Failed to send recruiter notification:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.id
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation error',
          details: error.errors.map(e => ({ 
            field: e.path.join('.'), 
            message: e.message 
          }))
        });
      } else {
        next(error);
      }
    }
  });

  // Get applications for a specific job (recruiters only)
  app.get("/api/jobs/:id/applications", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      const applications = await storage.getApplicationsByJob(jobId);
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  // Secure resume download via permission-gated redirect
  app.get("/api/applications/:id/resume", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) return res.status(400).json({ error: 'Invalid application ID' });

      const appRecord = await storage.getApplication(applicationId);
      if (!appRecord) return res.status(404).json({ error: 'Application not found' });

      // Permission checks
      const role = req.user!.role;
      if (role === 'admin') {
        // allowed
      } else if (role === 'recruiter') {
        const job = await storage.getJob(appRecord.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
        // Mark as downloaded for recruiter/admin access
        await storage.markApplicationDownloaded(applicationId);
      } else if (role === 'candidate') {
        // Candidate can only access their own application (bound by userId, not email)
        if (!appRecord.userId || appRecord.userId !== req.user!.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }

      const url = appRecord.resumeUrl;
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(404).json({ error: 'Resume not available' });
      }

      // Simple, practical approach: redirect to stored URL (do not expose it elsewhere in UI)
      return res.redirect(302, url);
    } catch (error) {
      next(error);
    }
  });

  // Get jobs posted by current user (recruiters only)
  app.get("/api/my-jobs", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobs = await storage.getJobsByUser(req.user!.id);
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  // Update job status (activate/deactivate)
  app.patch("/api/jobs/:id/status", doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      const job = await storage.updateJobStatus(jobId, isActive);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // ============= ADMIN ROUTES =============
  
  // Get jobs by status for admin review
  app.get("/api/admin/jobs", requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status = 'pending', page = 1, limit = 10 } = req.query;
      
      const result = await storage.getJobsByStatus(
        status as string,
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      res.json({
        jobs: result.jobs,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // ============= ATS: PIPELINE & APPLICATION MANAGEMENT =============

  // Get pipeline stages
  app.get("/api/pipeline/stages", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stages = await storage.getPipelineStages();
      res.json(stages);
    } catch (e) { next(e); }
  });

  // Create pipeline stage (recruiters/admin)
  app.post("/api/pipeline/stages", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = insertPipelineStageSchema.parse(req.body);
      const stage = await storage.createPipelineStage({ ...body, createdBy: req.user!.id });
      res.status(201).json(stage);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: e.errors });
      next(e);
    }
  });

  // Move application to a new stage
  app.patch("/api/applications/:id/stage", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = parseInt(req.params.id);
      if (isNaN(appId)) return res.status(400).json({ error: 'Invalid application ID' });

      // Validate input with Zod
      const validation = updateStageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      const { stageId, notes } = validation.data;

      // Validate stage exists before updating
      const stages = await storage.getPipelineStages();
      const targetStage = stages.find(s => s.id === stageId);
      if (!targetStage) {
        return res.status(400).json({ error: `Invalid stage ID: ${stageId}` });
      }

      // Update stage (now in transaction)
      await storage.updateApplicationStage(appId, stageId, req.user!.id, notes);

      // Fire-and-forget: automated status email (if enabled)
      const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
      if (autoEmails && targetStage.name) {
        // Map stage names to specialized templates
        const stageName = targetStage.name.toLowerCase();
        if (stageName.includes('offer') || stageName.includes('hired')) {
          // Send specialized offer email
          sendOfferEmail(appId).catch(err => console.error('Offer email error:', err));
        } else if (stageName.includes('reject')) {
          // Send specialized rejection email
          sendRejectionEmail(appId).catch(err => console.error('Rejection email error:', err));
        } else {
          // Generic status update for other stages
          sendStatusUpdateEmail(appId, targetStage.name).catch(err => console.error('Status email error:', err));
        }
      }

      res.json({ success: true });
    } catch (e) { next(e); }
  });

  // Get application stage history
  app.get("/api/applications/:id/history", requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = parseInt(req.params.id);
      const hist = await storage.getApplicationStageHistory(appId);
      res.json(hist);
    } catch (e) { next(e); }
  });

  // Schedule interview
  app.patch("/api/applications/:id/interview", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = parseInt(req.params.id);
      if (isNaN(appId)) return res.status(400).json({ error: 'Invalid application ID' });

      // Coerce empty strings to undefined before validation
      const payload = {
        date: typeof req.body?.date === 'string' && req.body.date.trim() !== '' ? req.body.date.trim() : undefined,
        time: typeof req.body?.time === 'string' && req.body.time.trim() !== '' ? req.body.time.trim() : undefined,
        location: typeof req.body?.location === 'string' && req.body.location.trim() !== '' ? req.body.location.trim() : undefined,
        notes: typeof req.body?.notes === 'string' && req.body.notes.trim() !== '' ? req.body.notes.trim() : undefined,
      };

      // Validate input with Zod (lenient)
      const validation = scheduleInterviewSchema.safeParse(payload);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      // Normalize date: accept YYYY-MM-DD or full ISO
      let { date, time, location, notes } = validation.data;
      let ts: Date | undefined = undefined;
      if (date) {
        // If only date provided (no 'T'), convert to midnight UTC
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          ts = new Date(`${date}T00:00:00Z`);
        } else {
          const parsed = new Date(date);
          if (!isNaN(parsed.getTime())) ts = parsed;
        }
      }
      const updated = await storage.scheduleInterview(appId, {
        date: ts,
        time,
        location,
        notes
      });

      // Fire-and-forget: interview invite (if enabled and fields provided)
      const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
      if (autoEmails && date && time && location) {
        sendInterviewInvitation(appId, { date, time, location }).catch(err => console.error('Interview email error:', err));
      }

      res.json(updated);
    } catch (e) { next(e); }
  });

  // Add recruiter note
  app.post("/api/applications/:id/notes", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = parseInt(req.params.id);
      const { note } = req.body;
      if (!note) return res.status(400).json({ error: 'note required' });
      const updated = await storage.addRecruiterNote(appId, note);
      res.json(updated);
    } catch (e) { next(e); }
  });

  // Set rating
  app.patch("/api/applications/:id/rating", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = parseInt(req.params.id);
      const { rating } = req.body;
      if (typeof rating !== 'number' || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating 1-5' });
      const updated = await storage.setApplicationRating(appId, rating);
      res.json(updated);
    } catch (e) { next(e); }
  });

  // Email templates
  app.get("/api/email-templates", requireRole(['recruiter','admin']), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await storage.getEmailTemplates();
      res.json(list);
    } catch (e) { next(e); }
  });

  app.post("/api/email-templates", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = insertEmailTemplateSchema.parse(req.body as InsertEmailTemplate);
      const tpl = await storage.createEmailTemplate({ ...body, createdBy: req.user!.id });
      res.status(201).json(tpl);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: e.errors });
      next(e);
    }
  });

  // Send email using template
  app.post("/api/applications/:id/send-email", doubleCsrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = parseInt(req.params.id);
      const { templateId, customizations } = req.body as { templateId: number; customizations?: Record<string,string> };
      if (!templateId) return res.status(400).json({ error: 'templateId required' });
      const appData = await storage.getApplication(appId);
      if (!appData) return res.status(404).json({ error: 'application not found' });
      const [tpl] = (await storage.getEmailTemplates()).filter(t => t.id === templateId);
      if (!tpl) return res.status(404).json({ error: 'template not found' });
      await sendTemplatedEmail(appId, templateId, customizations || {});
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  // Automation settings - Get all settings
  app.get("/api/admin/automation-settings", requireRole(['admin']), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await storage.getAutomationSettings();
      res.json(settings);
    } catch (e) { next(e); }
  });

  // Automation settings - Update a specific setting
  app.patch("/api/admin/automation-settings/:key", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      // Whitelist valid automation setting keys to prevent arbitrary key injection
      const validKeys = [
        'email_on_application_received',
        'email_on_status_change',
        'email_on_interview_scheduled',
        'email_on_offer_sent',
        'email_on_rejection',
        'auto_acknowledge_applications',
        'notify_recruiter_new_application',
        'reminder_interview_upcoming',
      ];

      if (!validKeys.includes(key)) {
        return res.status(400).json({ error: 'Invalid automation setting key' });
      }

      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: 'value must be a boolean' });
      }

      const setting = await storage.updateAutomationSetting(key, value, req.user!.id);
      res.json(setting);
    } catch (e) { next(e); }
  });

  // Review a job (approve/decline)
  app.patch("/api/admin/jobs/:id/review", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      const { status, reviewComments } = req.body;
      
      if (isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }
      
      if (!['approved', 'declined'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'declined'" });
      }
      
      const job = await storage.reviewJob(jobId, status, reviewComments, req.user!.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // ============= CONSULTANT SHOWCASE ROUTES =============

  // Public: Get all active consultants
  app.get("/api/consultants", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const consultants = await storage.getActiveConsultants();
      res.json(consultants);
    } catch (error) {
      next(error);
    }
  });

  // Public: Get a specific consultant
  app.get("/api/consultants/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid consultant ID" });
      }

      const consultant = await storage.getConsultant(id);
      if (!consultant || !consultant.isActive) {
        return res.status(404).json({ error: "Consultant not found" });
      }

      res.json(consultant);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get all consultants (including inactive)
  app.get("/api/admin/consultants", requireRole(['admin']), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const consultants = await storage.getConsultants();
      res.json(consultants);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Create a new consultant
  app.post("/api/admin/consultants", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consultantData = req.body;
      const consultant = await storage.createConsultant(consultantData);
      res.status(201).json(consultant);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update a consultant
  app.patch("/api/admin/consultants/:id", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid consultant ID" });
      }

      const consultant = await storage.updateConsultant(id, req.body);
      if (!consultant) {
        return res.status(404).json({ error: "Consultant not found" });
      }

      res.json(consultant);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Delete a consultant
  app.delete("/api/admin/consultants/:id", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid consultant ID" });
      }

      const deleted = await storage.deleteConsultant(id);
      if (!deleted) {
        return res.status(404).json({ error: "Consultant not found" });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============= PHASE 3: APPLICATION MANAGEMENT ROUTES =============
  
  // Update single application status (recruiters/admins only)
  app.patch("/api/applications/:id/status", doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const { status, notes } = req.body;
      
      if (isNaN(applicationId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }
      
      if (!['submitted', 'reviewed', 'shortlisted', 'rejected', 'downloaded'].includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status. Must be one of: submitted, reviewed, shortlisted, rejected, downloaded" 
        });
      }
      
      // Verify the recruiter owns this job if not admin
      if (req.user!.role !== 'admin') {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        
        const job = await storage.getJob(application.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const application = await storage.updateApplicationStatus(applicationId, status, notes);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // Bulk update application statuses (recruiters/admins only)
  app.patch("/api/applications/bulk", doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationIds, status, notes } = req.body;
      
      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(400).json({ error: "applicationIds must be a non-empty array" });
      }
      
      if (!['submitted', 'reviewed', 'shortlisted', 'rejected', 'downloaded'].includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status. Must be one of: submitted, reviewed, shortlisted, rejected, downloaded" 
        });
      }
      
      // Verify all applications belong to the recruiter's jobs if not admin
      if (req.user!.role !== 'admin') {
        const applications = await Promise.all(
          applicationIds.map(id => storage.getApplication(parseInt(id)))
        );
        
        const jobIds = applications
          .filter(app => app)
          .map(app => app!.jobId);
        
        const jobs = await Promise.all(
          jobIds.map(id => storage.getJob(id))
        );
        
        const unauthorizedJob = jobs.find(job => !job || job.postedBy !== req.user!.id);
        if (unauthorizedJob) {
          return res.status(403).json({ error: "Access denied to one or more applications" });
        }
      }
      
      const updatedCount = await storage.updateApplicationsStatus(
        applicationIds.map(id => parseInt(id)), 
        status, 
        notes
      );
      
      res.json({ 
        success: true, 
        updatedCount,
        message: `${updatedCount} applications updated successfully` 
      });
    } catch (error) {
      next(error);
    }
  });

  // Mark application as viewed (automatically updates status to 'reviewed')
  app.patch("/api/applications/:id/view", doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      
      if (isNaN(applicationId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }
      
      // Verify the recruiter owns this job if not admin
      if (req.user!.role !== 'admin') {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        
        const job = await storage.getJob(application.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const application = await storage.markApplicationViewed(applicationId);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // Mark application as downloaded (when resume is downloaded)
  app.patch("/api/applications/:id/download", doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      
      if (isNaN(applicationId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }
      
      // Verify the recruiter owns this job if not admin
      if (req.user!.role !== 'admin') {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        
        const job = await storage.getJob(application.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const application = await storage.markApplicationDownloaded(applicationId);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // ============= PHASE 5: ADMIN SUPER DASHBOARD ROUTES =============
  
  // Get admin statistics
  app.get("/api/admin/stats", requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Get all jobs with details for admin
  app.get("/api/admin/jobs/all", requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobs = await storage.getAllJobsWithDetails();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  // Get all applications with details for admin
  app.get("/api/admin/applications/all", requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applications = await storage.getAllApplicationsWithDetails();
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  // Get all users for admin
  app.get("/api/admin/users", requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await storage.getAllUsersWithDetails();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      if (!['candidate', 'recruiter', 'admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be candidate, recruiter, or admin" });
      }
      
      const user = await storage.updateUserRole(userId, role);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  // Delete job (admin only)
  app.delete("/api/admin/jobs/:id", doubleCsrfProtection, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      
      if (isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }
      
      const success = await storage.deleteJob(jobId);
      
      if (!success) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // ============= PHASE 4: CANDIDATE DASHBOARD & PROFILE ROUTES =============
  
  // Get user profile
  app.get("/api/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await storage.getUserProfile(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      next(error);
    }
  });

  // Create or update user profile
  app.post("/api/profile", doubleCsrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profileData = req.body;
      
      // Check if profile exists
      const existingProfile = await storage.getUserProfile(req.user!.id);
      
      let profile;
      if (existingProfile) {
        profile = await storage.updateUserProfile(req.user!.id, profileData);
      } else {
        profile = await storage.createUserProfile({
          ...profileData,
          userId: req.user!.id
        });
      }
      
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  // Update user profile
  app.patch("/api/profile", doubleCsrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profileData = req.body;
      const profile = await storage.updateUserProfile(req.user!.id, profileData);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  // Get user's applications
  app.get("/api/my-applications", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applications = await storage.getApplicationsByEmail(req.user!.username);
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  // Get applications received for recruiter's jobs
  app.get("/api/my-applications-received", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applications = await storage.getRecruiterApplications(req.user!.id);
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  // Withdraw application
  app.delete("/api/applications/:id/withdraw", doubleCsrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      
      if (isNaN(applicationId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }
      
      const success = await storage.withdrawApplication(applicationId, req.user!.id);
      
      if (!success) {
        return res.status(404).json({ error: "Application not found or access denied" });
      }
      
      res.json({ success: true, message: "Application withdrawn successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Get job analytics for admin/recruiter
  app.get("/api/analytics/jobs", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
      const jobsWithAnalytics = await storage.getJobsWithAnalytics(userId);
      res.json(jobsWithAnalytics);
    } catch (error) {
      next(error);
    }
  });

  // Get analytics for a specific job
  app.get("/api/analytics/jobs/:id", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      // Verify ownership if not admin
      if (req.user!.role !== 'admin') {
        const job = await storage.getJob(jobId);
        if (!job || job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const analytics = await storage.getJobAnalytics(jobId);
      if (!analytics) {
        return res.status(404).json({ error: 'Analytics not found' });
      }

      res.json(analytics);
    } catch (error) {
      next(error);
    }
  });

  // AI-powered job description analysis
  app.post("/api/ai/analyze-job-description", aiAnalysisRateLimit, doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if AI features are enabled
      if (!isAIEnabled()) {
        return res.status(503).json({
          error: 'AI features are not configured',
          message: 'OpenAI API key is not set. AI-powered analysis is currently unavailable.'
        });
      }

      const { title, description } = req.body;

      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }

      if (title.length > 200 || description.length > 5000) {
        return res.status(400).json({ error: 'Title or description too long' });
      }

      console.log(`AI analysis requested by user ${req.user!.id} for job: ${title}`);
      
      const analysis = await analyzeJobDescription(title, description);
      const suggestions = calculateOptimizationSuggestions(analysis);
      
      res.json({
        ...analysis,
        suggestions,
        analysis_timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      if (error instanceof Error && error.message.includes('AI analysis unavailable')) {
        return res.status(502).json({ error: 'AI service temporarily unavailable' });
      }
      next(error);
    }
  });

  // AI-powered job scoring
  app.post("/api/ai/score-job", aiAnalysisRateLimit, doubleCsrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if AI features are enabled
      if (!isAIEnabled()) {
        return res.status(503).json({
          error: 'AI features are not configured',
          message: 'OpenAI API key is not set. AI-powered scoring is currently unavailable.'
        });
      }

      const { title, description, jobId } = req.body;

      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }

      // Get historical data if jobId provided
      let historicalData;
      if (jobId) {
        const analytics = await storage.getJobAnalytics(jobId);
        if (analytics) {
          historicalData = {
            averageViews: analytics.views,
            averageConversion: parseFloat(analytics.conversionRate || "0")
          };
        }
      }

      const score = await generateJobScore(title, description, historicalData);
      
      // Cache the score if jobId provided
      if (jobId) {
        await storage.updateJobAnalytics(jobId, {
          aiScoreCache: score,
          aiModelVersion: "llama-3.3-70b-versatile"
        });
      }

      res.json({
        score,
        model_version: "llama-3.3-70b-versatile",
        timestamp: new Date().toISOString(),
        factors: {
          content_analysis: true,
          historical_data: !!historicalData
        }
      });
    } catch (error) {
      console.error('AI scoring error:', error);
      next(error);
    }
  });

  // Export analytics data as CSV
  app.get("/api/analytics/export", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format = 'json', dateRange = '30' } = req.query;
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
      
      const jobs = await storage.getJobsWithAnalytics(userId);
      
      // Filter by date range
      const days = parseInt(dateRange as string) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredJobs = jobs.filter(job => 
        new Date(job.createdAt) >= cutoffDate
      );

      if (format === 'csv') {
        // Generate CSV data with anonymized information
        const csvHeader = 'Job Title,Location,Type,Status,Views,Apply Clicks,Conversion Rate,AI Score,Created Date\n';
        const csvData = filteredJobs.map(job => [
          `"${job.title}"`,
          `"${job.location}"`,
          job.type,
          job.status,
          job.analytics.views || 0,
          job.analytics.applyClicks || 0,
          job.analytics.conversionRate || "0.00",
          job.analytics.aiScoreCache || "N/A",
          new Date(job.createdAt).toLocaleDateString()
        ].join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="job_analytics.csv"');
        res.send(csvHeader + csvData);
      } else {
        // Return JSON with anonymized data
        const exportData = filteredJobs.map(job => ({
          id: job.id,
          title: job.title,
          location: job.location,
          type: job.type,
          status: job.status,
          isActive: job.isActive,
          createdAt: job.createdAt,
          analytics: {
            views: job.analytics.views || 0,
            applyClicks: job.analytics.applyClicks || 0,
            conversionRate: job.analytics.conversionRate || "0.00",
            aiScore: job.analytics.aiScoreCache || null
          }
        }));

        res.json({
          data: exportData,
          summary: {
            totalJobs: exportData.length,
            totalViews: exportData.reduce((sum, job) => sum + job.analytics.views, 0),
            totalApplyClicks: exportData.reduce((sum, job) => sum + job.analytics.applyClicks, 0),
            averageConversion: exportData.length > 0 
              ? (exportData.reduce((sum, job) => sum + parseFloat(job.analytics.conversionRate), 0) / exportData.length).toFixed(2)
              : "0.00",
            dateRange: `${days} days`,
            exportedAt: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      next(error);
    }
  });

  // WhatsApp integration removed - was unused placeholder code
  // If you need WhatsApp integration in the future:
  // 1. Set up WhatsApp Business API account
  // 2. Add WHATSAPP_APP_SECRET to environment variables
  // 3. Implement proper webhook signature validation
  // 4. Add error handling and input validation
  // See COMPREHENSIVE_SECURITY_AUDIT.md for implementation details

  const httpServer = createServer(app);
  return httpServer;
}
