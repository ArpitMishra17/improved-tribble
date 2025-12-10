/**
 * Admin Routes Module
 *
 * All /api/admin/* endpoints for administrative functions:
 * - Job management (pending jobs, review, delete)
 * - User management
 * - Consultant management
 * - AI usage analytics
 * - Automation settings
 * - Form responses
 * - Feedback analytics
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { sql, eq, and, desc } from 'drizzle-orm';
import { db } from './db';
import { storage } from './storage';
import { requireRole } from './auth';
import {
  userAiUsage,
  applicationFeedback,
  formResponses,
  formInvitations,
  forms,
  applications,
  users,
} from '@shared/schema';
import type { CsrfMiddleware } from './types/routes';

/**
 * Register all admin routes
 */
export function registerAdminRoutes(
  app: Express,
  csrfProtection: CsrfMiddleware
): void {
  // ============= ADMIN JOB MANAGEMENT =============

  // Get jobs by status for admin review
  app.get("/api/admin/jobs", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      return;
    } catch (error) {
      next(error);
    }
  });

  // Review a job (approve/decline)
  app.patch("/api/admin/jobs/:id/review", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const jobId = Number(idParam);
      const { status, reviewComments } = req.body;

      if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
        res.status(400).json({ error: "Invalid ID parameter" });
        return;
      }

      if (!['approved', 'declined'].includes(status)) {
        res.status(400).json({ error: "Invalid status. Must be 'approved' or 'declined'" });
        return;
      }

      const job = await storage.reviewJob(jobId, status, reviewComments, req.user!.id);

      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      res.json(job);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Delete job (admin only)
  app.delete("/api/admin/jobs/:id", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const jobId = Number(idParam);

      if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
        res.status(400).json({ error: "Invalid job ID" });
        return;
      }

      const success = await storage.deleteJob(jobId);

      if (!success) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      res.json({ message: "Job deleted successfully" });
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get all jobs with details for admin
  app.get("/api/admin/jobs/all", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobs = await storage.getAllJobsWithDetails();
      res.json(jobs);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= ADMIN STATS & DASHBOARD =============

  // Get admin statistics
  app.get("/api/admin/stats", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get all applications with details for admin
  app.get("/api/admin/applications/all", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const applications = await storage.getAllApplicationsWithDetails();
      res.json(applications);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= ADMIN USER MANAGEMENT =============

  // Get all users for admin
  app.get("/api/admin/users", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await storage.getAllUsersWithDetails();
      res.json(users);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const userId = Number(idParam);
      const { role } = req.body;

      if (!Number.isFinite(userId) || userId <= 0 || !Number.isInteger(userId)) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      if (!['candidate', 'recruiter', 'super_admin', 'hiring_manager'].includes(role)) {
        res.status(400).json({ error: "Invalid role. Must be candidate, recruiter, super_admin, or hiring_manager" });
        return;
      }

      const user = await storage.updateUserRole(userId, role);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(user);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= ADMIN AUTOMATION SETTINGS =============

  // Automation settings - Get all settings
  app.get("/api/admin/automation-settings", requireRole(['super_admin']), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await storage.getAutomationSettings();
      res.json(settings);
      return;
    } catch (e) { next(e); }
  });

  // Automation settings - Update a specific setting
  app.patch("/api/admin/automation-settings/:key", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const keyParam = req.params.key;
      if (!keyParam) {
        res.status(400).json({ error: 'Missing key parameter' });
        return;
      }
      const key = keyParam;
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
        res.status(400).json({ error: 'Invalid automation setting key' });
        return;
      }

      if (typeof value !== 'boolean') {
        res.status(400).json({ error: 'value must be a boolean' });
        return;
      }

      const setting = await storage.updateAutomationSetting(key, value, req.user!.id);
      res.json(setting);
      return;
    } catch (e) { next(e); }
  });

  // ============= ADMIN AI USAGE =============

  // Get AI usage statistics
  app.get("/api/admin/ai/usage", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, userId, kind } = req.query;

      // Build query conditions
      const conditions: any[] = [];

      if (startDate) {
        conditions.push(sql`${userAiUsage.computedAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        conditions.push(sql`${userAiUsage.computedAt} <= ${new Date(endDate as string)}`);
      }
      if (userId) {
        const userIdNum = Number(userId);
        if (Number.isFinite(userIdNum) && userIdNum > 0) {
          conditions.push(eq(userAiUsage.userId, userIdNum));
        }
      }
      if (kind) {
        conditions.push(eq(userAiUsage.kind, kind as string));
      }

      // Get aggregated stats
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const usageRecords = await db
        .select({
          id: userAiUsage.id,
          userId: userAiUsage.userId,
          kind: userAiUsage.kind,
          tokensIn: userAiUsage.tokensIn,
          tokensOut: userAiUsage.tokensOut,
          costUsd: userAiUsage.costUsd,
          computedAt: userAiUsage.computedAt,
          metadata: userAiUsage.metadata,
          user: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(userAiUsage)
        .leftJoin(users, eq(userAiUsage.userId, users.id))
        .where(whereClause)
        .orderBy(desc(userAiUsage.computedAt))
        .limit(500);

      // Get summary stats
      const summaryResults = await db
        .select({
          kind: userAiUsage.kind,
          totalTokensIn: sql<number>`SUM(${userAiUsage.tokensIn})`.as('totalTokensIn'),
          totalTokensOut: sql<number>`SUM(${userAiUsage.tokensOut})`.as('totalTokensOut'),
          totalCost: sql<string>`SUM(${userAiUsage.costUsd})`.as('totalCost'),
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(userAiUsage)
        .where(whereClause)
        .groupBy(userAiUsage.kind);

      type SummaryRow = typeof summaryResults[number];
      type UsageRecord = typeof usageRecords[number];

      const summary = {
        byKind: summaryResults.reduce((acc: Record<string, { tokensIn: number; tokensOut: number; cost: number; count: number }>, row: SummaryRow) => {
          acc[row.kind] = {
            tokensIn: Number(row.totalTokensIn) || 0,
            tokensOut: Number(row.totalTokensOut) || 0,
            cost: parseFloat(row.totalCost || '0'),
            count: Number(row.count) || 0,
          };
          return acc;
        }, {}),
        total: {
          tokensIn: summaryResults.reduce((sum: number, r: SummaryRow) => sum + (Number(r.totalTokensIn) || 0), 0),
          tokensOut: summaryResults.reduce((sum: number, r: SummaryRow) => sum + (Number(r.totalTokensOut) || 0), 0),
          cost: summaryResults.reduce((sum: number, r: SummaryRow) => sum + parseFloat(r.totalCost || '0'), 0),
          count: summaryResults.reduce((sum: number, r: SummaryRow) => sum + (Number(r.count) || 0), 0),
        },
      };

      res.json({
        usage: usageRecords.map((record: UsageRecord) => ({
          ...record,
          user: record.user?.id ? record.user : null,
        })),
        summary,
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= ADMIN CONSULTANT MANAGEMENT =============

  // Admin: Get all consultants (including inactive)
  app.get("/api/admin/consultants", requireRole(['super_admin']), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultants = await storage.getConsultants();
      res.json(consultants);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Admin: Create a new consultant
  app.post("/api/admin/consultants", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultantData = req.body;
      const consultant = await storage.createConsultant(consultantData);
      res.status(201).json(consultant);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update a consultant
  app.patch("/api/admin/consultants/:id", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid ID parameter" });
        return;
      }

      const consultant = await storage.updateConsultant(id, req.body);
      if (!consultant) {
        res.status(404).json({ error: "Consultant not found" });
        return;
      }

      res.json(consultant);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Admin: Delete a consultant
  app.delete("/api/admin/consultants/:id", csrfProtection, requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid ID parameter" });
        return;
      }

      const deleted = await storage.deleteConsultant(id);
      if (!deleted) {
        res.status(404).json({ error: "Consultant not found" });
        return;
      }

      res.json({ success: true });
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= ADMIN FORM RESPONSES =============

  // Get all form responses (admin only)
  app.get("/api/admin/forms/responses", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = '1', limit = '20', formId, status, search } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];

      if (formId && formId !== 'all') {
        const formIdNum = parseInt(formId as string);
        if (Number.isFinite(formIdNum) && formIdNum > 0) {
          conditions.push(eq(formInvitations.formId, formIdNum));
        }
      }

      if (status && status !== 'all') {
        conditions.push(eq(formInvitations.status, status as string));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(formResponses)
        .innerJoin(formInvitations, eq(formResponses.invitationId, formInvitations.id))
        .where(whereClause);

      // Get responses with joins
      const query = db
        .select({
          id: formResponses.id,
          invitationId: formResponses.invitationId,
          applicationId: formResponses.applicationId,
          submittedAt: formResponses.submittedAt,
          formName: forms.name,
          formId: forms.id,
          candidateName: applications.name,
          candidateEmail: applications.email,
          status: formInvitations.status,
        })
        .from(formResponses)
        .innerJoin(formInvitations, eq(formResponses.invitationId, formInvitations.id))
        .innerJoin(applications, eq(formResponses.applicationId, applications.id))
        .innerJoin(forms, eq(formInvitations.formId, forms.id))
        .where(whereClause)
        .orderBy(desc(formResponses.submittedAt))
        .limit(limitNum)
        .offset(offset);

      let responses = await query;

      // Apply search filter in memory (for candidate name/email)
      if (search) {
        const searchLower = (search as string).toLowerCase();
        responses = responses.filter((r: { candidateName: string; candidateEmail: string }) =>
          r.candidateName.toLowerCase().includes(searchLower) ||
          r.candidateEmail.toLowerCase().includes(searchLower)
        );
      }

      // Get stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [statsResult] = await db
        .select({
          totalResponses: sql<number>`count(*)::int`,
          responsesToday: sql<number>`count(*) filter (where ${formResponses.submittedAt} >= ${today})::int`,
        })
        .from(formResponses);

      // Calculate completion rate (answered vs total invitations)
      const [invitationStats] = await db
        .select({
          totalInvitations: sql<number>`count(*)::int`,
          answeredInvitations: sql<number>`count(*) filter (where ${formInvitations.status} = 'answered')::int`,
        })
        .from(formInvitations);

      const completionRate = invitationStats.totalInvitations > 0
        ? (invitationStats.answeredInvitations / invitationStats.totalInvitations) * 100
        : 0;

      res.json({
        responses,
        total: countResult?.count || 0,
        page: pageNum,
        pageSize: limitNum,
        stats: {
          totalResponses: statsResult?.totalResponses || 0,
          responsesToday: statsResult?.responsesToday || 0,
          avgResponseTime: 0, // Would need invitation sentAt tracking
          completionRate: Math.round(completionRate),
        },
      });
      return;
    } catch (error) {
      console.error('[Admin Forms] Error fetching responses:', error);
      next(error);
    }
  });

  // Export form responses to CSV (admin only)
  app.get("/api/admin/forms/responses/export", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { formId, search } = req.query;
      const conditions: any[] = [];

      if (formId && formId !== 'all') {
        const formIdNum = parseInt(formId as string);
        if (Number.isFinite(formIdNum) && formIdNum > 0) {
          conditions.push(eq(formInvitations.formId, formIdNum));
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      let responses = await db
        .select({
          id: formResponses.id,
          formName: forms.name,
          candidateName: applications.name,
          candidateEmail: applications.email,
          submittedAt: formResponses.submittedAt,
          status: formInvitations.status,
        })
        .from(formResponses)
        .innerJoin(formInvitations, eq(formResponses.invitationId, formInvitations.id))
        .innerJoin(applications, eq(formResponses.applicationId, applications.id))
        .innerJoin(forms, eq(formInvitations.formId, forms.id))
        .where(whereClause)
        .orderBy(desc(formResponses.submittedAt));

      // Apply search filter
      if (search) {
        const searchLower = (search as string).toLowerCase();
        responses = responses.filter((r: { candidateName: string; candidateEmail: string }) =>
          r.candidateName.toLowerCase().includes(searchLower) ||
          r.candidateEmail.toLowerCase().includes(searchLower)
        );
      }

      // Generate CSV
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = ['Response ID,Form Name,Candidate Name,Candidate Email,Status,Submitted At'];
      for (const r of responses) {
        csvRows.push([
          r.id,
          escapeCsv(r.formName),
          escapeCsv(r.candidateName),
          escapeCsv(r.candidateEmail),
          r.status,
          r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
        ].join(','));
      }

      const csvContent = '\ufeff' + csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="form-responses-${Date.now()}.csv"`);
      res.send(csvContent);
      return;
    } catch (error) {
      console.error('[Admin Forms] Error exporting responses:', error);
      next(error);
    }
  });

  // ============= ADMIN FEEDBACK ANALYTICS =============

  // Get feedback analytics (admin only)
  app.get("/api/admin/feedback/analytics", requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      const conditions: any[] = [];

      if (startDate) {
        conditions.push(sql`${applicationFeedback.createdAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        conditions.push(sql`${applicationFeedback.createdAt} <= ${new Date(endDate as string)}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get all feedback
      const feedback = await db
        .select({
          id: applicationFeedback.id,
          applicationId: applicationFeedback.applicationId,
          score: applicationFeedback.overallScore,
          recommendation: applicationFeedback.recommendation,
          notes: applicationFeedback.notes,
          createdAt: applicationFeedback.createdAt,
          reviewerName: users.firstName,
        })
        .from(applicationFeedback)
        .leftJoin(users, eq(applicationFeedback.authorId, users.id))
        .where(whereClause)
        .orderBy(desc(applicationFeedback.createdAt))
        .limit(500);

      // Calculate stats
      type FeedbackRecord = { score: number | null; recommendation: string | null; createdAt: Date | null };
      const totalFeedback = feedback.length;
      const avgScore = totalFeedback > 0
        ? feedback.reduce((sum: number, f: FeedbackRecord) => sum + (f.score || 0), 0) / totalFeedback
        : 0;

      // Count by recommendation
      const byRecommendation = {
        advance: feedback.filter((f: FeedbackRecord) => f.recommendation === 'advance').length,
        hold: feedback.filter((f: FeedbackRecord) => f.recommendation === 'hold').length,
        reject: feedback.filter((f: FeedbackRecord) => f.recommendation === 'reject').length,
      };

      // Score distribution
      const scoreDistribution = {
        1: feedback.filter((f: FeedbackRecord) => f.score === 1).length,
        2: feedback.filter((f: FeedbackRecord) => f.score === 2).length,
        3: feedback.filter((f: FeedbackRecord) => f.score === 3).length,
        4: feedback.filter((f: FeedbackRecord) => f.score === 4).length,
        5: feedback.filter((f: FeedbackRecord) => f.score === 5).length,
      };

      // Feedback over time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const feedbackByDay: Record<string, number> = {};
      feedback.forEach((f: FeedbackRecord) => {
        if (f.createdAt && new Date(f.createdAt) >= thirtyDaysAgo) {
          const day = new Date(f.createdAt).toISOString().split('T')[0];
          feedbackByDay[day!] = (feedbackByDay[day!] || 0) + 1;
        }
      });

      res.json({
        feedback: feedback.slice(0, 100), // Recent feedback
        stats: {
          totalFeedback,
          avgScore: Math.round(avgScore * 10) / 10,
          byRecommendation,
          scoreDistribution,
        },
        timeline: feedbackByDay,
      });
      return;
    } catch (error) {
      console.error('[Admin Feedback] Error fetching analytics:', error);
      next(error);
    }
  });

  console.log('✅ Admin routes registered');
}
