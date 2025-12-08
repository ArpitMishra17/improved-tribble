/**
 * Communications Routes Module
 *
 * All email and communication endpoints:
 * - Email templates CRUD (/api/email-templates)
 * - Send email to candidate (/api/applications/:id/send-email)
 * - AI-drafted emails (/api/email/draft)
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { storage } from './storage';
import { requireRole } from './auth';
import {
  insertEmailTemplateSchema,
  type InsertEmailTemplate,
  emailTemplates,
  userAiUsage,
} from '@shared/schema';
import { sendTemplatedEmail } from './emailTemplateService';
import { isAIEnabled, generateEmailDraft } from './aiJobAnalyzer';
import { aiAnalysisRateLimit } from './rateLimit';
import type { CsrfMiddleware } from './types/routes';

// Validation schemas
const updateEmailTemplateSchema = z.object({
  isDefault: z.boolean().optional(),
});

const emailDraftSchema = z.object({
  templateId: z.number().int().positive(),
  applicationId: z.number().int().positive(),
  tone: z.enum(['friendly', 'formal']).optional().default('friendly'),
});

/**
 * Register all communication-related routes
 */
export function registerCommunicationsRoutes(
  app: Express,
  csrfProtection: CsrfMiddleware
): void {
  // ============= EMAIL TEMPLATE ROUTES =============

  // Get all email templates
  app.get("/api/email-templates", requireRole(['recruiter','admin']), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const list = await storage.getEmailTemplates();
      res.json(list);
      return;
    } catch (e) { next(e); }
  });

  // Create email template
  app.post("/api/email-templates", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = insertEmailTemplateSchema.parse(req.body as InsertEmailTemplate);
      const tpl = await storage.createEmailTemplate({ ...body, createdBy: req.user!.id });
      res.status(201).json(tpl);
      return;
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: e.errors });
        return;
      }
      next(e);
    }
  });

  // Update email template (admin-only approval for default flag)
  app.patch("/api/email-templates/:id", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: "Missing ID parameter" });
        return;
      }
      const templateId = Number(idParam);
      if (!Number.isFinite(templateId) || templateId <= 0 || !Number.isInteger(templateId)) {
        res.status(400).json({ error: "Invalid template ID" });
        return;
      }

      const parsed = updateEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation error", details: parsed.error.errors });
        return;
      }

      const updates: Partial<InsertEmailTemplate> & { isDefault?: boolean } = {};

      // Only admins can approve/mark templates as default
      if (parsed.data.isDefault !== undefined) {
        if (req.user!.role !== "admin") {
          res.status(403).json({ error: "Only admins can approve email templates" });
          return;
        }
        updates.isDefault = parsed.data.isDefault;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No updatable fields provided" });
        return;
      }

      const [updated] = await db
        .update(emailTemplates)
        .set(updates)
        .where(eq(emailTemplates.id, templateId))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Email template not found" });
        return;
      }

      res.json(updated);
      return;
    } catch (e) {
      next(e);
    }
  });

  // ============= EMAIL SENDING ROUTES =============

  // Send email using template
  app.post("/api/applications/:id/send-email", csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      const { templateId, customizations } = req.body as { templateId: number; customizations?: Record<string,string> };
      if (!templateId) {
        res.status(400).json({ error: 'templateId required' });
        return;
      }
      const appData = await storage.getApplication(appId);
      if (!appData) {
        res.status(404).json({ error: 'application not found' });
        return;
      }
      const [tpl] = (await storage.getEmailTemplates()).filter(t => t.id === templateId);
      if (!tpl) {
        res.status(404).json({ error: 'template not found' });
        return;
      }
      await sendTemplatedEmail(appId, templateId, customizations || {});
      res.json({ success: true });
      return;
    } catch (e) { next(e); }
  });

  // ============= AI EMAIL DRAFT ROUTES =============

  // Generate AI-drafted email from template
  app.post("/api/email/draft", aiAnalysisRateLimit, csrfProtection, requireRole(['recruiter','admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if AI features are enabled
      if (!isAIEnabled()) {
        res.status(503).json({ error: 'AI features are not enabled. Please configure GROQ_API_KEY.' });
        return;
      }

      // Validate request body
      const parsed = emailDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
        return;
      }

      const { templateId, applicationId, tone } = parsed.data;
      const startTime = Date.now();

      // 1. Fetch email template
      const templates = await storage.getEmailTemplates();
      const template = templates.find((t: any) => t.id === templateId);
      if (!template) {
        res.status(404).json({ error: 'Email template not found' });
        return;
      }

      // 2. Fetch application
      const application = await storage.getApplication(applicationId);
      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      // 3. Fetch job details
      const job = await storage.getJob(application.jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // 4. Generate AI draft
      const draftResult = await generateEmailDraft(
        template.subject,
        template.body,
        application.name,
        application.email,
        job.title,
        'VantaHire',
        tone
      );

      const durationMs = Date.now() - startTime;

      // 5. Calculate cost using Groq pricing for llama-3.3-70b-versatile
      const PRICE_PER_1M_INPUT_TOKENS = 0.59;
      const PRICE_PER_1M_OUTPUT_TOKENS = 0.79;
      const costUsd = (
        (draftResult.tokensUsed.input / 1_000_000) * PRICE_PER_1M_INPUT_TOKENS +
        (draftResult.tokensUsed.output / 1_000_000) * PRICE_PER_1M_OUTPUT_TOKENS
      ).toFixed(8);

      // 6. Track AI usage for billing/analytics
      await db.insert(userAiUsage).values({
        userId: req.user!.id,
        kind: 'email_draft',
        tokensIn: draftResult.tokensUsed.input,
        tokensOut: draftResult.tokensUsed.output,
        costUsd,
        metadata: {
          applicationId,
          templateId,
          jobTitle: job.title,
          candidateName: application.name,
          tone,
          durationMs,
        },
      });

      // 7. Return the drafted email
      res.json({
        subject: draftResult.subject,
        body: draftResult.body,
      });
      return;
    } catch (e) {
      console.error('[Email Draft] Error generating AI draft:', e);
      next(e);
    }
  });

  console.log('✅ Communications routes registered');
}
