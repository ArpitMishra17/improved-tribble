/**
 * Applications Routes Module
 *
 * All application, candidate, and pipeline management endpoints:
 * - Application submission (/api/jobs/:id/apply)
 * - Recruiter add candidate (/api/jobs/:id/applications/recruiter-add)
 * - Application management (stage, interview, notes, rating, feedback)
 * - Pipeline stages (/api/pipeline/stages)
 * - Candidate views (/api/candidates, /api/my-applications)
 * - User profile (/api/profile)
 * - Resume download
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Multer } from 'multer';
import { sql, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { storage } from './storage';
import { requireAuth, requireRole } from './auth';
import {
  insertApplicationSchema,
  recruiterAddApplicationSchema,
  insertPipelineStageSchema,
  insertApplicationFeedbackSchema,
  applications,
  pipelineStages,
  applicationStageHistory,
  candidateResumes,
  userAiUsage,
  applicationFeedback,
} from '@shared/schema';
import { uploadToGCS, getSignedDownloadUrl, downloadFromGCS } from './gcs-storage';
import { getEmailService } from './simpleEmailService';
import {
  sendStatusUpdateEmail,
  sendInterviewInvitation,
  sendApplicationReceivedEmail,
  sendOfferEmail,
  sendRejectionEmail,
} from './emailTemplateService';
import { generateInterviewICS, getICSFilename } from './lib/icsGenerator';
import { extractResumeText, validateResumeText } from './lib/resumeExtractor';
import { isAIEnabled, generateCandidateSummary } from './aiJobAnalyzer';
import { applicationRateLimit, recruiterAddRateLimit, aiAnalysisRateLimit } from './rateLimit';
import type { CsrfMiddleware } from './types/routes';

// Base URL for email links
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Validation schemas
const updateStageSchema = z.object({
  stageId: z.number().int().positive(),
  notes: z.string().optional(),
});

const scheduleInterviewSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Register all application-related routes
 */
export function registerApplicationsRoutes(
  app: Express,
  csrfProtection: CsrfMiddleware,
  upload: Multer
): void {
  // ============= APPLICATION SUBMISSION ROUTES =============

  // Submit job application with resume upload
  app.post("/api/jobs/:id/apply", applicationRateLimit, csrfProtection, upload.single('resume'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const jobId = Number(idParam);
      if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      // Check if job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Resume file is required' });
        return;
      }

      // Validate application data
      const applicationData = insertApplicationSchema.parse(req.body);

      // Duplicate detection (case-insensitive email check)
      const existingApp = await db.query.applications.findFirst({
        where: and(
          eq(applications.jobId, jobId),
          sql`LOWER(${applications.email}) = LOWER(${applicationData.email})`
        )
      });

      if (existingApp) {
        res.status(400).json({
          error: 'Duplicate application',
          message: `You have already applied for this position with ${applicationData.email}`,
          existingApplicationId: existingApp.id
        });
        return;
      }

      // Increment apply click count for analytics (after duplicate check)
      await storage.incrementApplyClicks(jobId);

      // Upload resume to Google Cloud Storage or use placeholder if not configured
      let resumeUrl = 'placeholder-resume.pdf';
      let resumeRecordId: number | null = null;
      if (req.file) {
        try {
          resumeUrl = await uploadToGCS(req.file.buffer, req.file.originalname);
        } catch (error) {
          console.log('Google Cloud Storage not configured, using placeholder resume URL');
          resumeUrl = `resume-${Date.now()}-${req.file.originalname}`;
        }
      }

      // If candidate is authenticated, persist resume + extracted text for AI
      if (req.user?.id && req.file?.buffer) {
        try {
          // Enforce soft limit of 3 resumes like resume upload endpoint
          const existingResumes = await db.query.candidateResumes.findMany({
            where: eq(candidateResumes.userId, req.user.id),
            columns: { id: true, isDefault: true },
          });

          if (existingResumes.length < 3) {
            const extraction = await extractResumeText(req.file.buffer);
            if (extraction.success && validateResumeText(extraction.text)) {
              const shouldBeDefault = !existingResumes.some((r: { isDefault: boolean }) => r.isDefault);
              const [resume] = await db
                .insert(candidateResumes)
                .values({
                  userId: req.user.id,
                  label: req.file.originalname || 'Uploaded Resume',
                  gcsPath: resumeUrl,
                  extractedText: extraction.text,
                  isDefault: shouldBeDefault,
                })
                .returning();
              resumeRecordId = resume.id;
            }
          }
        } catch (resumeErr) {
          console.error('Resume save/extraction failed (non-blocking):', resumeErr);
        }
      }

      // Determine default pipeline stage for new applications (if stages are configured)
      let initialStageId: number | null = null;
      try {
        const stages = await storage.getPipelineStages();
        if (stages && stages.length > 0) {
          const explicitDefault = stages.find((s) => s.isDefault);
          const chosen = explicitDefault ?? stages[0]!;
          initialStageId = chosen.id;
        }
      } catch (stageError) {
        console.error("Failed to load pipeline stages for default assignment:", stageError);
      }

      const now = new Date();

      // Create application record (with optional initial stage assignment)
      const application = await storage.createApplication({
        ...applicationData,
        jobId,
        resumeUrl,
        resumeFilename: req.file?.originalname ?? null,
        ...(resumeRecordId !== null && { resumeId: resumeRecordId }),
        ...(req.user?.id !== undefined && { userId: req.user.id }),
        ...(initialStageId !== null && {
          currentStage: initialStageId,
          stageChangedAt: now,
          stageChangedBy: job.postedBy,
        }),
      });

      // Log initial stage assignment to history table (if a default stage was applied)
      if (initialStageId !== null) {
        await db.insert(applicationStageHistory).values({
          applicationId: application.id,
          fromStage: null,
          toStage: initialStageId,
          changedBy: job.postedBy,
          notes: "Initial stage assigned automatically at application submission",
        });
      }

      // Fire-and-forget: candidate confirmation (if enabled)
      const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
      if (autoEmails) {
        sendApplicationReceivedEmail(application.id).catch(err => console.error('Application received email error:', err));
      }

      // Send notification email to recruiter
      try {
        const emailService = await getEmailService();
        if (emailService) {
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
- Resume: ${BASE_URL}/api/applications/${application.id}/resume
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
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      } else {
        next(error);
      }
    }
  });

  // Recruiter adds candidate on behalf (MVP: Add Candidate feature)
  app.post(
    "/api/jobs/:id/applications/recruiter-add",
    requireRole(['recruiter', 'super_admin']),
    recruiterAddRateLimit,
    csrfProtection,
    upload.single('resume'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const idParam = req.params.id;
        if (!idParam) {
          res.status(400).json({ error: 'Missing ID parameter' });
          return;
        }
        const jobId = Number(idParam);
        if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
          res.status(400).json({ error: 'Invalid ID parameter' });
          return;
        }

        // Permission guard: Verify job ownership (recruiters must own job, admins bypass)
        const job = await storage.getJob(jobId);
        if (!job) {
          res.status(404).json({ error: 'Job not found' });
          return;
        }

        if (req.user!.role === 'recruiter' && job.postedBy !== req.user!.id) {
          res.status(403).json({ error: 'Access denied: You can only add candidates to your own jobs' });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: 'Resume file is required' });
          return;
        }

        // Validate with dedicated schema
        const applicationData = recruiterAddApplicationSchema.parse(req.body);

        // Duplicate detection (case-insensitive email check)
        const existingApp = await db.query.applications.findFirst({
          where: and(
            eq(applications.jobId, jobId),
            sql`LOWER(${applications.email}) = LOWER(${applicationData.email})`
          )
        });

        if (existingApp) {
          res.status(400).json({
            error: 'Duplicate application',
            message: `An application from ${applicationData.email} already exists for this job`,
            existingApplicationId: existingApp.id
          });
          return;
        }

        // Upload resume
        let resumeUrl = 'placeholder-resume.pdf';
        try {
          resumeUrl = await uploadToGCS(req.file.buffer, req.file.originalname);
        } catch (error) {
          console.log('Google Cloud Storage not configured, using placeholder resume URL');
          resumeUrl = `resume-${Date.now()}-${req.file.originalname}`;
        }

        // Determine default pipeline stage for recruiter-added candidates (if stages are configured)
        let defaultStageId: number | null = null;
        try {
          const stages = await storage.getPipelineStages();
          if (stages && stages.length > 0) {
            const explicitDefault = stages.find((s) => s.isDefault);
            const chosen = explicitDefault ?? stages[0]!;
            defaultStageId = chosen.id;
          }
        } catch (stageError) {
          console.error("Failed to load pipeline stages for recruiter-add default assignment:", stageError);
        }

        // Validate initial stage if provided, otherwise fall back to default (if available)
        let initialStage: number | null = null;
        if (applicationData.currentStage) {
          const stageExists = await db.query.pipelineStages.findFirst({
            where: eq(pipelineStages.id, applicationData.currentStage)
          });

          if (!stageExists) {
            res.status(400).json({ error: 'Invalid stage ID' });
            return;
          }

          initialStage = applicationData.currentStage;
        } else if (defaultStageId !== null) {
          initialStage = defaultStageId;
        }

        // Create application with recruiter metadata
        const application = await storage.createApplication({
          name: applicationData.name,
          email: applicationData.email,
          phone: applicationData.phone,
          ...(applicationData.coverLetter && { coverLetter: applicationData.coverLetter }),
          jobId,
          resumeUrl,
          resumeFilename: req.file.originalname,
          submittedByRecruiter: true,
          createdByUserId: req.user!.id,
          source: applicationData.source,
          ...(applicationData.sourceMetadata && { sourceMetadata: applicationData.sourceMetadata }),
          ...(initialStage !== null && {
            currentStage: initialStage,
            stageChangedAt: new Date(),
            stageChangedBy: req.user!.id,
          }),
        });

        // Log initial stage assignment to history table
        if (initialStage) {
          await db.insert(applicationStageHistory).values({
            applicationId: application.id,
            fromStage: null,
            toStage: initialStage,
            changedBy: req.user!.id,
            notes: 'Initial stage assigned by recruiter during candidate addition',
          });
        }

        // Audit log (simple console log for MVP)
        console.log('[RECRUITER_ADD]', {
          applicationId: application.id,
          recruiterId: req.user!.id,
          jobId,
          candidateEmail: applicationData.email,
          source: applicationData.source,
          timestamp: new Date().toISOString()
        });

        res.status(201).json({
          success: true,
          message: 'Candidate added successfully',
          applicationId: application.id,
        });
        return;
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Validation error',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          });
          return;
        }
        next(error);
      }
    }
  );

  // ====== ATS: Bulk interview scheduling ======
  app.patch(
    "/api/applications/bulk/interview",
    csrfProtection,
    requireRole(['recruiter','admin']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const bodySchema = z.object({
          applicationIds: z.array(z.number().int().positive()).min(1),
          start: z.string(),
          intervalHours: z.number().min(0).max(24).default(0),
          location: z.string().min(1),
          timeRangeLabel: z.string().optional(),
          notes: z.string().optional(),
          stageId: z.number().int().positive().optional(),
        });

        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation error",
            details: parsed.error.errors,
          });
          return;
        }

        const data = parsed.data as z.infer<typeof bodySchema>;
        const {
          applicationIds,
          start,
          intervalHours,
          location,
          timeRangeLabel,
          notes,
          stageId,
        } = data;

        // Normalize base start date
        let baseDate: Date | undefined;
        if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
          baseDate = new Date(`${start}T00:00:00Z`);
        } else {
          const parsedStart = new Date(start);
          if (!isNaN(parsedStart.getTime())) {
            baseDate = parsedStart;
          }
        }

        if (!baseDate) {
          res.status(400).json({ error: "Invalid start datetime" });
          return;
        }

        const results: { id: number; success: boolean; error?: string }[] = [];

        // Preload pipeline stages and map stageId -> order
        let stageOrderMap = new Map<number, number>();
        let targetStageOrder: number | null = null;
        const targetStageId = stageId ?? null;
        if (targetStageId !== null) {
          const stages = await storage.getPipelineStages();
          stageOrderMap = new Map(stages.map((s) => [s.id, s.order ?? 0]));
          targetStageOrder = stageOrderMap.get(targetStageId) ?? null;
        }

        for (let index = 0; index < applicationIds.length; index++) {
          const appId = Number(applicationIds[index]);
          try {
            const offsetMs = intervalHours * 60 * 60 * 1000 * index;
            const slotDate = new Date(baseDate.getTime() + offsetMs);

            // Persist interview details
            const interviewFields: { date?: Date; time?: string; location?: string; notes?: string } = {
              date: slotDate,
              location,
            };
            if (typeof timeRangeLabel === "string" && timeRangeLabel.length > 0) {
              interviewFields.time = timeRangeLabel;
            }
            if (typeof notes === "string" && notes.length > 0) {
              interviewFields.notes = notes;
            }
            await storage.scheduleInterview(appId, interviewFields);

            // Optional: move to a specific stage
            if (targetStageId !== null && targetStageOrder !== null) {
              const appRecord = await storage.getApplication(appId);
              const currentStageId = appRecord?.currentStage ?? null;

              if (currentStageId == null) {
                await storage.updateApplicationStage(appId, targetStageId, req.user!.id, notes);
              } else {
                const currentOrder = stageOrderMap.get(currentStageId) ?? null;
                if (currentOrder === null || currentOrder < targetStageOrder) {
                  await storage.updateApplicationStage(appId, targetStageId, req.user!.id, notes);
                }
              }
            }

            // Fire-and-forget interview invite (if automation enabled)
            const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === "true" || process.env.EMAIL_AUTOMATION_ENABLED === "1";
            if (autoEmails) {
              const dateStr = slotDate.toISOString();
              const timeLabel = timeRangeLabel ?? "";
              sendInterviewInvitation(appId, {
                date: dateStr,
                time: timeLabel,
                location,
              }).catch((err) =>
                console.error("Bulk interview email error:", err)
              );
            }

            results.push({ id: appId, success: true });
          } catch (err: any) {
            console.error("Bulk interview scheduling error:", err);
            results.push({
              id: appId,
              success: false,
              error: err?.message ?? "Unknown error",
            });
          }
        }

        const scheduledCount = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success);

        res.json({
          total: applicationIds.length,
          scheduledCount,
          failedCount: failed.length,
          failed,
        });
        return;
      } catch (error) {
        next(error);
      }
    }
  );

  // Get applications for a specific job (recruiters only)
  app.get("/api/jobs/:id/applications", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const jobId = Number(idParam);
      if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const applicationsList = await storage.getApplicationsByJob(jobId);
      res.json(applicationsList);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get AI-suggested similar candidates from other jobs
  app.get("/api/jobs/:id/ai-similar-candidates", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }

      const jobId = Number(idParam);
      if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
        res.status(400).json({ error: 'Invalid job ID' });
        return;
      }

      const minFitScore = req.query.minFitScore
        ? parseInt(String(req.query.minFitScore), 10)
        : undefined;
      const limit = req.query.limit
        ? parseInt(String(req.query.limit), 10)
        : undefined;

      const recruiterId = req.user!.id;

      const options: { minFitScore?: number; limit?: number } = {};
      if (typeof minFitScore === "number" && !Number.isNaN(minFitScore)) {
        options.minFitScore = minFitScore;
      }
      if (typeof limit === "number" && !Number.isNaN(limit)) {
        options.limit = limit;
      }

      const candidates = await storage.getSimilarCandidatesForJob(jobId, recruiterId, options);

      res.json(candidates);
      return;
    } catch (error) {
      console.error('[Similar Candidates] Error fetching similar candidates:', error);
      next(error);
    }
  });

  // Secure resume download via permission-gated redirect
  app.get("/api/applications/:id/resume", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const applicationId = Number(idParam);
      if (!Number.isFinite(applicationId) || applicationId <= 0 || !Number.isInteger(applicationId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const appRecord = await storage.getApplication(applicationId);
      if (!appRecord) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      // Permission checks
      const role = req.user!.role;
      if (role === 'super_admin') {
        // allowed
      } else if (role === 'recruiter') {
        const job = await storage.getJob(appRecord.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
        await storage.markApplicationDownloaded(applicationId);
      } else if (role === 'candidate') {
        if (!appRecord.userId || appRecord.userId !== req.user!.id) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      } else {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const url = appRecord.resumeUrl;
      if (!url) {
        res.status(404).json({ error: 'Resume not available' });
        return;
      }

      let downloadUrl: string;
      if (url.startsWith('gs://')) {
        downloadUrl = await getSignedDownloadUrl(url, appRecord.resumeFilename);
      } else if (/^https?:\/\//i.test(url)) {
        downloadUrl = url;
      } else {
        res.status(404).json({ error: 'Resume not available' });
        return;
      }

      res.redirect(302, downloadUrl);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= PIPELINE MANAGEMENT ROUTES =============

  // Get pipeline stages
  app.get("/api/pipeline/stages", requireAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stages = await storage.getPipelineStages();
      res.json(stages);
      return;
    } catch (e) { next(e); }
  });

  // Create pipeline stage (recruiters/admin)
  app.post("/api/pipeline/stages", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = insertPipelineStageSchema.parse(req.body);
      const stage = await storage.createPipelineStage({ ...body, createdBy: req.user!.id });
      res.status(201).json(stage);
      return;
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: e.errors });
        return;
      }
      next(e);
    }
  });

  // Move application to a new stage
  app.patch("/api/applications/:id/stage", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const validation = updateStageSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
        return;
      }

      const { stageId, notes } = validation.data;

      const stages = await storage.getPipelineStages();
      const targetStage = stages.find(s => s.id === stageId);
      if (!targetStage) {
        res.status(400).json({ error: `Invalid stage ID: ${stageId}` });
        return;
      }

      await storage.updateApplicationStage(appId, stageId, req.user!.id, notes);

      // Fire-and-forget: automated status email (if enabled)
      const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
      if (autoEmails && targetStage.name) {
        const stageName = targetStage.name.toLowerCase();
        if (stageName.includes('offer') || stageName.includes('hired')) {
          sendOfferEmail(appId).catch(err => console.error('Offer email error:', err));
        } else if (stageName.includes('reject')) {
          sendRejectionEmail(appId).catch(err => console.error('Rejection email error:', err));
        } else {
          sendStatusUpdateEmail(appId, targetStage.name).catch(err => console.error('Status email error:', err));
        }
      }

      res.json({ success: true });
      return;
    } catch (e) { next(e); }
  });

  // Get application stage history
  app.get("/api/applications/:id/history", requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }
      const hist = await storage.getApplicationStageHistory(appId);
      res.json(hist);
      return;
    } catch (e) { next(e); }
  });

  // ============= INTERVIEW MANAGEMENT ROUTES =============

  // Download interview calendar invite (ICS file)
  app.get("/api/applications/:id/interview/ics", requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const application = await storage.getApplication(appId);
      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      const job = await storage.getJob(application.jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (!application.interviewDate || !application.interviewTime) {
        res.status(400).json({
          error: 'Interview not scheduled',
          message: 'Interview date and time must be set before generating calendar invite'
        });
        return;
      }

      const recruiter = req.user;
      const interviewDateString = new Date(application.interviewDate).toISOString().slice(0, 10);

      const interviewDetails: any = {
        candidateName: application.name,
        candidateEmail: application.email,
        jobTitle: job.title,
        interviewDate: interviewDateString,
        interviewTime: application.interviewTime,
        interviewLocation: application.interviewLocation || 'TBD',
      };

      if (recruiter?.firstName) {
        interviewDetails.recruiterName = `${recruiter.firstName} ${recruiter.lastName || ''}`.trim();
      }
      if (recruiter?.username) {
        interviewDetails.recruiterEmail = recruiter.username;
      }
      if (application.interviewNotes) {
        interviewDetails.notes = application.interviewNotes;
      }

      const icsContent = generateInterviewICS(interviewDetails);
      const filename = getICSFilename(job.title, application.name);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(icsContent);
      return;
    } catch (error) {
      console.error('[ICS Download] Error:', error);
      next(error);
    }
  });

  // Schedule interview
  app.patch("/api/applications/:id/interview", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const payload = {
        date: typeof req.body?.date === 'string' && req.body.date.trim() !== '' ? req.body.date.trim() : undefined,
        time: typeof req.body?.time === 'string' && req.body.time.trim() !== '' ? req.body.time.trim() : undefined,
        location: typeof req.body?.location === 'string' && req.body.location.trim() !== '' ? req.body.location.trim() : undefined,
        notes: typeof req.body?.notes === 'string' && req.body.notes.trim() !== '' ? req.body.notes.trim() : undefined,
      };

      const validation = scheduleInterviewSchema.safeParse(payload);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
        return;
      }

      let { date, time, location, notes } = validation.data;
      let ts: Date | undefined = undefined;
      if (date) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          ts = new Date(`${date}T00:00:00Z`);
        } else {
          const parsed = new Date(date);
          if (!isNaN(parsed.getTime())) ts = parsed;
        }
      }
      const updated = await storage.scheduleInterview(appId, {
        ...(ts !== undefined && { date: ts }),
        ...(time !== undefined && { time }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes })
      });

      const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
      if (autoEmails && date && time && location) {
        sendInterviewInvitation(appId, { date, time, location }).catch(err => console.error('Interview email error:', err));
      }

      res.json(updated);
      return;
    } catch (e) { next(e); }
  });

  // ============= APPLICATION NOTES, RATING, EMAIL HISTORY =============

  // Get email history for an application
  app.get("/api/applications/:id/email-history", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const applicationId = Number(idParam);
      if (!Number.isFinite(applicationId) || applicationId <= 0 || !Number.isInteger(applicationId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const application = await storage.getApplication(applicationId);
      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      const emailHistory = await storage.getApplicationEmailHistory(applicationId);
      res.json(emailHistory);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Add recruiter note
  app.post("/api/applications/:id/notes", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }
      const { note } = req.body;
      if (!note) {
        res.status(400).json({ error: 'note required' });
        return;
      }
      const updated = await storage.addRecruiterNote(appId, note);
      res.json(updated);
      return;
    } catch (e) { next(e); }
  });

  // Set rating
  app.patch("/api/applications/:id/rating", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }
      const { rating } = req.body;
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'rating 1-5' });
        return;
      }
      const updated = await storage.setApplicationRating(appId, rating);
      res.json(updated);
      return;
    } catch (e) { next(e); }
  });

  // ============= AI SUMMARY =============

  // Generate AI candidate summary
  app.post("/api/applications/:id/ai-summary", aiAnalysisRateLimit, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      if (!isAIEnabled()) {
        res.status(503).json({
          error: 'AI features not available',
          message: 'AI summary generation is currently unavailable'
        });
        return;
      }

      const application = await storage.getApplication(appId);
      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      const job = await storage.getJob(application.jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      let resumeText = '';

      if (application.resumeId) {
        const resumeData = await db.query.candidateResumes.findFirst({
          where: eq(candidateResumes.id, application.resumeId)
        });
        resumeText = resumeData?.extractedText || '';
      }

      if (!resumeText && application.resumeUrl && application.resumeUrl.startsWith('gs://')) {
        try {
          const buffer = await downloadFromGCS(application.resumeUrl);
          const extraction = await extractResumeText(buffer);
          if (extraction.success && validateResumeText(extraction.text)) {
            resumeText = extraction.text;
          }
        } catch (err) {
          console.error('[AI Summary] Resume download/extract failed:', err);
        }
      }

      const effectiveText = resumeText || application.coverLetter || job.description || '';

      if (!effectiveText) {
        res.status(400).json({
          error: 'Resume text not available',
          message: 'We could not find any candidate text to summarize. Please ensure a resume or cover letter is available.',
        });
        return;
      }

      const startTime = Date.now();
      const summaryResult = await generateCandidateSummary(
        effectiveText,
        job.title,
        job.description,
        application.name
      );
      const durationMs = Date.now() - startTime;

      const PRICE_PER_1M_INPUT_TOKENS = 0.59;
      const PRICE_PER_1M_OUTPUT_TOKENS = 0.79;
      const costUsd = (
        (summaryResult.tokensUsed.input / 1_000_000) * PRICE_PER_1M_INPUT_TOKENS +
        (summaryResult.tokensUsed.output / 1_000_000) * PRICE_PER_1M_OUTPUT_TOKENS
      ).toFixed(8);

      await db
        .update(applications)
        .set({
          aiSummary: summaryResult.summary,
          aiSummaryVersion: 1,
          aiSuggestedAction: summaryResult.suggestedAction,
          aiSuggestedActionReason: summaryResult.suggestedActionReason,
          aiSummaryComputedAt: new Date(),
        })
        .where(eq(applications.id, appId));

      await db.insert(userAiUsage).values({
        userId: req.user!.id,
        kind: 'summary',
        tokensIn: summaryResult.tokensUsed.input,
        tokensOut: summaryResult.tokensUsed.output,
        costUsd,
        metadata: {
          applicationId: appId,
          durationMs,
          jobTitle: job.title,
          candidateName: application.name,
        },
      });

      res.json({
        message: 'AI summary generated successfully',
        summary: {
          text: summaryResult.summary,
          suggestedAction: summaryResult.suggestedAction,
          suggestedActionReason: summaryResult.suggestedActionReason,
          strengths: summaryResult.strengths,
          concerns: summaryResult.concerns,
          keyHighlights: summaryResult.keyHighlights,
          modelVersion: summaryResult.model_version,
          computedAt: new Date(),
          cost: parseFloat(costUsd),
          durationMs,
        }
      });
      return;
    } catch (error) {
      console.error('[AI Summary] Error:', error);
      if (error instanceof Error) {
        res.status(500).json({
          error: 'AI summary generation failed',
          message: error.message
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
      return;
    }
  });

  // ============= APPLICATION FEEDBACK =============

  // Get feedback for an application
  app.get("/api/applications/:id/feedback", requireRole(['recruiter', 'super_admin', 'hiring_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const feedback = await db
        .select({
          id: applicationFeedback.id,
          applicationId: applicationFeedback.applicationId,
          authorId: applicationFeedback.authorId,
          overallScore: applicationFeedback.overallScore,
          recommendation: applicationFeedback.recommendation,
          notes: applicationFeedback.notes,
          createdAt: applicationFeedback.createdAt,
          updatedAt: applicationFeedback.updatedAt,
        })
        .from(applicationFeedback)
        .where(eq(applicationFeedback.applicationId, appId))
        .orderBy(sql`${applicationFeedback.createdAt} DESC`);

      const feedbackWithAuthors = await Promise.all(
        feedback.map(async (fb: typeof feedback[0]) => {
          const author = await storage.getUser(fb.authorId);
          return {
            ...fb,
            author: author ? {
              id: author.id,
              firstName: author.firstName,
              lastName: author.lastName,
              role: author.role,
            } : null,
          };
        })
      );

      res.json(feedbackWithAuthors);
      return;
    } catch (error) {
      console.error('[Feedback Get] Error:', error);
      next(error);
    }
  });

  // Add feedback to an application
  app.post("/api/applications/:id/feedback", csrfProtection, requireRole(['recruiter', 'super_admin', 'hiring_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const appId = Number(idParam);
      if (!Number.isFinite(appId) || appId <= 0 || !Number.isInteger(appId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const validation = insertApplicationFeedbackSchema.safeParse({
        ...req.body,
        applicationId: appId,
      });

      if (!validation.success) {
        res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors,
        });
        return;
      }

      const [newFeedback] = await db
        .insert(applicationFeedback)
        .values({
          applicationId: appId,
          authorId: req.user!.id,
          overallScore: validation.data.overallScore,
          recommendation: validation.data.recommendation,
          notes: validation.data.notes || null,
        })
        .returning();

      const author = await storage.getUser(req.user!.id);

      res.status(201).json({
        message: 'Feedback added successfully',
        feedback: {
          ...newFeedback,
          author: author ? {
            id: author.id,
            firstName: author.firstName,
            lastName: author.lastName,
            role: author.role,
          } : null,
        },
      });
      return;
    } catch (error) {
      console.error('[Feedback Add] Error:', error);
      next(error);
    }
  });

  // ============= APPLICATION STATUS MANAGEMENT =============

  // Update single application status (recruiters/admins only)
  app.patch("/api/applications/:id/status", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const applicationId = Number(idParam);
      const { status, notes } = req.body;

      if (!Number.isFinite(applicationId) || applicationId <= 0 || !Number.isInteger(applicationId)) {
        res.status(400).json({ error: "Invalid ID parameter" });
        return;
      }

      if (!['submitted', 'reviewed', 'shortlisted', 'rejected', 'downloaded'].includes(status)) {
        res.status(400).json({
          error: "Invalid status. Must be one of: submitted, reviewed, shortlisted, rejected, downloaded"
        });
        return;
      }

      if (req.user!.role !== 'super_admin') {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          res.status(404).json({ error: "Application not found" });
          return;
        }

        const job = await storage.getJob(application.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      const application = await storage.updateApplicationStatus(applicationId, status, notes);

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      res.json(application);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Bulk update application statuses (recruiters/admins only)
  app.patch("/api/applications/bulk", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationIds, status, notes } = req.body;

      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        res.status(400).json({ error: "applicationIds must be a non-empty array" });
        return;
      }

      if (!['submitted', 'reviewed', 'shortlisted', 'rejected', 'downloaded'].includes(status)) {
        res.status(400).json({
          error: "Invalid status. Must be one of: submitted, reviewed, shortlisted, rejected, downloaded"
        });
        return;
      }

      if (req.user!.role !== 'super_admin') {
        const applicationsList = await Promise.all(
          applicationIds.map(id => storage.getApplication(parseInt(id)))
        );

        const jobIds = applicationsList
          .filter(app => app)
          .map(app => app!.jobId);

        const jobs = await Promise.all(
          jobIds.map(id => storage.getJob(id))
        );

        const unauthorizedJob = jobs.find(job => !job || job.postedBy !== req.user!.id);
        if (unauthorizedJob) {
          res.status(403).json({ error: "Access denied to one or more applications" });
          return;
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
      return;
    } catch (error) {
      next(error);
    }
  });

  // Mark application as viewed (automatically updates status to 'reviewed')
  app.patch("/api/applications/:id/view", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const applicationId = Number(idParam);

      if (!Number.isFinite(applicationId) || applicationId <= 0 || !Number.isInteger(applicationId)) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      if (req.user!.role !== 'super_admin') {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          res.status(404).json({ error: "Application not found" });
          return;
        }

        const job = await storage.getJob(application.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      const application = await storage.markApplicationViewed(applicationId);

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      res.json(application);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Mark application as downloaded (when resume is downloaded)
  app.patch("/api/applications/:id/download", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const applicationId = Number(idParam);

      if (!Number.isFinite(applicationId) || applicationId <= 0 || !Number.isInteger(applicationId)) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      if (req.user!.role !== 'super_admin') {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          res.status(404).json({ error: "Application not found" });
          return;
        }

        const job = await storage.getJob(application.jobId);
        if (!job || job.postedBy !== req.user!.id) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      const application = await storage.markApplicationDownloaded(applicationId);

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      res.json(application);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= CANDIDATE DASHBOARD & PROFILE ROUTES =============

  // Get user profile
  app.get("/api/profile", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await storage.getUserProfile(req.user!.id);
      res.json(profile || null);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Create or update user profile
  app.post("/api/profile", csrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profileData = req.body;
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
      return;
    } catch (error) {
      next(error);
    }
  });

  // Update user profile
  app.patch("/api/profile", csrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profileData = req.body;
      const profile = await storage.updateUserProfile(req.user!.id, profileData);

      if (!profile) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      res.json(profile);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get user's applications (bound to userId)
  app.get("/api/my-applications", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const applicationsList = await storage.getApplicationsByUserId(req.user!.id);
      res.json(applicationsList);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get applications received for recruiter's jobs
  app.get("/api/my-applications-received", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const applicationsList = await storage.getRecruiterApplications(req.user!.id);
      res.json(applicationsList);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get global candidates view (aggregated by email)
  app.get("/api/candidates", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q: search, minRating, tags } = req.query;

      const filters: {
        search?: string;
        minRating?: number;
        hasTags?: string[];
      } = {};

      if (search && typeof search === 'string') {
        filters.search = search;
      }

      if (minRating && typeof minRating === 'string') {
        const rating = parseInt(minRating, 10);
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
          filters.minRating = rating;
        }
      }

      if (tags && typeof tags === 'string') {
        filters.hasTags = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      }

      const candidates = await storage.getCandidatesForRecruiter(req.user!.id, filters);
      res.json(candidates);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Withdraw application
  app.delete("/api/applications/:id/withdraw", csrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const applicationId = Number(idParam);

      if (!Number.isFinite(applicationId) || applicationId <= 0 || !Number.isInteger(applicationId)) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      const success = await storage.withdrawApplication(applicationId, req.user!.id);

      if (!success) {
        res.status(404).json({ error: "Application not found or access denied" });
        return;
      }

      res.json({ success: true, message: "Application withdrawn successfully" });
      return;
    } catch (error) {
      next(error);
    }
  });

  console.log('✅ Applications routes registered');
}
