/**
 * Jobs Routes Module
 *
 * All job management and analytics endpoints:
 * - Job CRUD (/api/jobs)
 * - Job status management
 * - Job analytics and metrics
 * - AI job analysis and scoring
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { requireAuth, requireRole } from './auth';
import { insertJobSchema, applications, applicationStageHistory, jobs, pipelineStages, users } from '@shared/schema';
import { getHiringMetrics } from './lib/analyticsHelper';
import {
  analyzeJobDescription,
  generateJobScore,
  calculateOptimizationSuggestions,
  isAIEnabled,
} from './aiJobAnalyzer';
import { aiAnalysisRateLimit, jobPostingRateLimit } from './rateLimit';
import type { CsrfMiddleware } from './types/routes';
import { db } from './db';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';

/**
 * Register all job-related routes
 */
export function registerJobsRoutes(
  app: Express,
  csrfProtection: CsrfMiddleware
): void {
  // ============= JOB CRUD ROUTES =============

  // Create a new job posting (recruiters/admins only)
  app.post("/api/jobs", jobPostingRateLimit, csrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const job = await storage.createJob({
        ...jobData,
        postedBy: req.user!.id
      });

      res.status(201).json(job);
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

  // Get all jobs with filtering and pagination
  app.get("/api/jobs", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const location = req.query.location as string;
      const type = req.query.type as string;
      const search = req.query.search as string;
      const skills = req.query.skills as string;

      const filters = {
        ...(page !== undefined && { page: Number(page) }),
        ...(limit !== undefined && { limit: Number(limit) }),
        ...(location && { location }),
        ...(type && { type }),
        ...(search && { search }),
        ...(skills && { skills: skills.split(',').map(s => s.trim()).filter(Boolean) })
      };

      const result = await storage.getJobs(filters);

      res.json({
        jobs: result.jobs,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get a specific job by ID
  app.get("/api/jobs/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const job = await storage.getJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // Increment view count for analytics
      await storage.incrementJobViews(jobId);

      res.json(job);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get audit log for a job
  app.get("/api/jobs/:id/audit-log", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Verify job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const auditLog = await storage.getJobAuditLog(jobId);
      res.json(auditLog);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get jobs posted by current user (recruiters only)
  app.get("/api/my-jobs", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobs = await storage.getJobsByUser(req.user!.id);
      res.json(jobs);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Update job status (activate/deactivate)
  app.patch("/api/jobs/:id/status", csrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const jobId = Number(idParam);
      const { isActive } = req.body;

      if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isInteger(jobId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ error: 'isActive must be a boolean' });
        return;
      }

      const { reason } = req.body;
      const job = await storage.updateJobStatus(jobId, isActive, reason, req.user!.id);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json(job);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= JOB ANALYTICS ROUTES =============

  /**
   * GET /api/analytics/hiring-metrics
   * Get comprehensive hiring metrics: time-to-fill, time-in-stage, conversion rates
   */
  app.get("/api/analytics/hiring-metrics", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, jobId } = req.query;

      // Parse optional date parameters
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;
      let parsedJobId: number | undefined;

      if (startDate && typeof startDate === 'string') {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) {
          res.status(400).json({ error: 'Invalid startDate format' });
          return;
        }
      }

      if (endDate && typeof endDate === 'string') {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          res.status(400).json({ error: 'Invalid endDate format' });
          return;
        }
      }

      if (jobId) {
        parsedJobId = Number(jobId);
        if (!Number.isFinite(parsedJobId) || parsedJobId <= 0 || !Number.isInteger(parsedJobId)) {
          res.status(400).json({ error: 'Invalid jobId parameter' });
          return;
        }
      }

      // Get metrics from analytics helper
      const metrics = await getHiringMetrics(parsedStartDate, parsedEndDate, parsedJobId);

      res.json(metrics);
      return;
    } catch (error) {
      console.error('[Analytics] Error fetching hiring metrics:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/job-health
   * Returns health summaries for all jobs for the current user.
   */
  app.get("/api/analytics/job-health", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
      const jobHealth = await storage.getJobHealthSummary(userId);
      res.json(jobHealth);
      return;
    } catch (error) {
      console.error('[Analytics] Error fetching job health:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/nudges
   * Returns jobs needing attention and stale candidate counts for the current user.
   */
  app.get("/api/analytics/nudges", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
      const nudges = await storage.getAnalyticsNudges(userId);
      res.json(nudges);
      return;
    } catch (error) {
      console.error('[Analytics] Error fetching nudges:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/clients
   * Returns aggregated metrics per client (roles, applications, placements)
   */
  app.get("/api/analytics/clients", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
      const metrics = await storage.getClientAnalytics(userId);
      res.json(metrics);
      return;
    } catch (error) {
      console.error('[Analytics] Error fetching client analytics:', error);
      next(error);
    }
  });

  // Get job analytics for admin/recruiter
  app.get("/api/analytics/jobs", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
      const jobsWithAnalytics = await storage.getJobsWithAnalytics(userId);
      res.json(jobsWithAnalytics);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Get analytics for a specific job
  app.get("/api/analytics/jobs/:id", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Verify ownership if not admin
      if (req.user!.role !== 'admin') {
        const job = await storage.getJob(jobId);
        if (!job || job.postedBy !== req.user!.id) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      const analytics = await storage.getJobAnalytics(jobId);
      if (!analytics) {
        res.status(404).json({ error: 'Analytics not found' });
        return;
      }

      res.json(analytics);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Export analytics data as CSV
  app.get("/api/analytics/export", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        return;
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
        return;
      }
    } catch (error) {
      console.error('Export error:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/dropoff
   * Returns stage counts and conversion rates for the selected window.
   */
  app.get("/api/analytics/dropoff", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, jobId } = req.query;

      let parsedStart: Date | undefined;
      let parsedEnd: Date | undefined;
      let parsedJobId: number | undefined;

      if (typeof startDate === 'string') {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) parsedStart = d;
      }
      if (typeof endDate === 'string') {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) parsedEnd = d;
      }
      if (jobId) {
        const idNum = Number(jobId);
        if (!Number.isNaN(idNum) && idNum > 0) parsedJobId = idNum;
      }

      // Fetch relevant applications (scoped to recruiter if not admin)
      const whereClauses: any[] = [];
      if (parsedStart) whereClauses.push(gte(applications.appliedAt, parsedStart));
      if (parsedEnd) whereClauses.push(lte(applications.appliedAt, parsedEnd));
      if (parsedJobId) whereClauses.push(eq(applications.jobId, parsedJobId));
      if (req.user!.role !== 'admin') whereClauses.push(eq(jobs.postedBy, req.user!.id));

      let appsQuery = db
        .select({
          jobId: applications.jobId,
          currentStage: applications.currentStage,
          appliedAt: applications.appliedAt,
        })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id));
      if (whereClauses.length > 0) {
        appsQuery = appsQuery.where(and(...whereClauses));
      }
      const appRows = await appsQuery as Array<{
        jobId: number;
        currentStage: number | null;
        appliedAt: Date;
      }>;

      // Load stages in order
      const stages = await db.select().from(pipelineStages).orderBy(pipelineStages.order);

      const counts = stages.map((stage: typeof stages[number]) => ({
        stageId: stage.id,
        name: stage.name,
        order: stage.order,
        count: appRows.filter((a: { currentStage: number | null }) => a.currentStage === stage.id).length,
      }));
      const unassignedCount = appRows.filter((a: { currentStage: number | null }) => a.currentStage == null).length;

      const conversions = counts.map((row: typeof counts[number], idx: number) => {
        if (idx === 0) return { name: row.name, count: row.count, rate: 100 };
        const prev = counts[idx - 1]?.count ?? 0;
        const rate = prev > 0 ? Math.round((row.count / prev) * 100) : 0;
        return { name: row.name, count: row.count, rate };
      });

      res.json({
        stages: counts,
        unassigned: unassignedCount,
        conversions,
      });
      return;
    } catch (error) {
      console.error('[Analytics] dropoff error:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/source-performance
   * Applications, shortlist/interview, hires grouped by source.
   */
  app.get("/api/analytics/source-performance", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, jobId } = req.query;
      let parsedStart: Date | undefined;
      let parsedEnd: Date | undefined;
      let parsedJobId: number | undefined;
      if (typeof startDate === 'string') {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) parsedStart = d;
      }
      if (typeof endDate === 'string') {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) parsedEnd = d;
      }
      if (jobId) {
        const idNum = Number(jobId);
        if (!Number.isNaN(idNum) && idNum > 0) parsedJobId = idNum;
      }

      const whereClauses: any[] = [];
      if (parsedStart) whereClauses.push(gte(applications.appliedAt, parsedStart));
      if (parsedEnd) whereClauses.push(lte(applications.appliedAt, parsedEnd));
      if (parsedJobId) whereClauses.push(eq(applications.jobId, parsedJobId));
      if (req.user!.role !== 'admin') whereClauses.push(eq(jobs.postedBy, req.user!.id));

      let sourceQuery = db
        .select({
          jobId: applications.jobId,
          source: applications.source,
          status: applications.status,
        })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id));
      if (whereClauses.length > 0) {
        sourceQuery = sourceQuery.where(and(...whereClauses));
      }
      const rows = await sourceQuery;

      const grouped: Record<string, { apps: number; shortlist: number; hires: number }> = {};
      rows.forEach((row: { source: string | null; status: string }) => {
        const key = row.source || 'unknown';
        if (!grouped[key]) grouped[key] = { apps: 0, shortlist: 0, hires: 0 };
        grouped[key].apps += 1;
        if (row.status === 'shortlisted' || row.status === 'interview') grouped[key].shortlist += 1;
        if (row.status === 'hired') grouped[key].hires += 1;
      });

      const result = Object.entries(grouped).map(([source, metrics]: [string, { apps: number; shortlist: number; hires: number }]) => ({
        source,
        ...metrics,
        conversion: metrics.apps > 0 ? Math.round((metrics.hires / metrics.apps) * 1000) / 10 : 0,
      }));

      res.json(result);
      return;
    } catch (error) {
      console.error('[Analytics] source performance error:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/hm-feedback
   * Approximate Hiring Manager feedback latency from review stage entry to next movement.
   */
  app.get("/api/analytics/hm-feedback", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, jobId, reviewStageIds, nextStageIds, waitBuckets } = req.query;
      let parsedStart: Date | undefined;
      let parsedEnd: Date | undefined;
      let parsedJobId: number | undefined;
      if (typeof startDate === 'string') {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) parsedStart = d;
      }
      if (typeof endDate === 'string') {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) parsedEnd = d;
      }
      if (jobId) {
        const idNum = Number(jobId);
        if (!Number.isNaN(idNum) && idNum > 0) parsedJobId = idNum;
      }

      const parseIds = (input: unknown): number[] => {
        if (!input) return [];
        if (Array.isArray(input)) return input.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
        if (typeof input === 'string') {
          return input
            .split(',')
            .map((v) => Number(v.trim()))
            .filter((v) => Number.isFinite(v) && v > 0);
        }
        return [];
      };

      const explicitReviewIds = parseIds(reviewStageIds);
      const explicitNextIds = parseIds(nextStageIds);
      const bucketDefs = parseIds(waitBuckets).sort((a, b) => a - b); // e.g., [2,3,5]

      // Identify review stages by name match
      const stages = await db.select().from(pipelineStages);
      const reviewStageIdsResolved = explicitReviewIds.length
        ? explicitReviewIds
        : stages
            .filter((s: typeof stages[number]) => s.name.toLowerCase().includes('review'))
            .map((s: typeof stages[number]) => s.id);

      if (reviewStageIdsResolved.length === 0) {
        res.json({ averageDays: null, waitingCount: 0, sampleSize: 0, buckets: [] });
        return;
      }

      const whereClauses: any[] = [];
      if (parsedStart) whereClauses.push(gte(applicationStageHistory.changedAt, parsedStart));
      if (parsedEnd) whereClauses.push(lte(applicationStageHistory.changedAt, parsedEnd));
      if (parsedJobId) whereClauses.push(eq(applications.jobId, parsedJobId));
      if (req.user!.role !== 'admin') whereClauses.push(eq(jobs.postedBy, req.user!.id));

      let historyQuery = db
        .select({
          applicationId: applicationStageHistory.applicationId,
          fromStage: applicationStageHistory.fromStage,
          toStage: applicationStageHistory.toStage,
          changedAt: applicationStageHistory.changedAt,
          jobId: applications.jobId,
        })
        .from(applicationStageHistory)
        .innerJoin(applications, eq(applicationStageHistory.applicationId, applications.id))
        .innerJoin(jobs, eq(applications.jobId, jobs.id))
        .orderBy(applicationStageHistory.applicationId, applicationStageHistory.changedAt);
      if (whereClauses.length > 0) {
        historyQuery = historyQuery.where(and(...whereClauses));
      }
      const historyRows = await historyQuery as Array<{
        applicationId: number;
        fromStage: number | null;
        toStage: number;
        changedAt: Date;
        jobId: number;
      }>;

      // Group by application to compute latency
      const perApp = new Map<number, Array<typeof historyRows[number]>>();
      historyRows.forEach((row: typeof historyRows[number]) => {
        if (!perApp.has(row.applicationId)) perApp.set(row.applicationId, []);
        perApp.get(row.applicationId)!.push(row);
      });

      const durations: number[] = [];
      let waitingCount = 0;

      perApp.forEach((entries) => {
        // find first entry into review stage
        const entryIdx = entries.findIndex((e) => reviewStageIdsResolved.includes(e.toStage));
        if (entryIdx === -1 || !entries[entryIdx]) return;
        const entryTime = new Date(entries[entryIdx].changedAt).getTime();
        // find next transition after review
        const next = entries.slice(entryIdx + 1).find((e) =>
          explicitNextIds.length ? explicitNextIds.includes(e.toStage) : true
        );
        if (!next) {
          waitingCount += 1;
          return;
        }
        const nextTime = new Date(next.changedAt).getTime();
        const days = (nextTime - entryTime) / (1000 * 60 * 60 * 24);
        if (days >= 0) durations.push(days);
      });

      const averageDays = durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;

      // Optional buckets for wait times (e.g., thresholds [2,3,5] => <=2, 2-3, 3-5, >5)
      let buckets: Array<{ label: string; count: number }> = [];
      if (bucketDefs.length > 0) {
        const sorted = bucketDefs;
        const bucketCounts = new Array(sorted.length + 1).fill(0);
        durations.forEach((d) => {
          const idx = sorted.findIndex((threshold) => d <= threshold);
          if (idx === -1) bucketCounts[bucketCounts.length - 1] += 1;
          else bucketCounts[idx] += 1;
        });
        buckets = bucketCounts.map((count, idx) => {
          if (idx === 0) return { label: `<= ${sorted[0]}d`, count };
          if (idx === bucketCounts.length - 1) return { label: `> ${sorted[sorted.length - 1]}d`, count };
          return { label: `${sorted[idx - 1]}-${sorted[idx]}d`, count };
        });
      }

      res.json({
        averageDays,
        waitingCount,
        sampleSize: durations.length,
        buckets,
      });
      return;
    } catch (error) {
      console.error('[Analytics] HM feedback error:', error);
      next(error);
    }
  });

  /**
   * GET /api/analytics/performance
   * Recruiter & hiring manager performance metrics.
   */
  app.get("/api/analytics/performance", requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, jobId } = req.query;
      let parsedStart: Date | undefined;
      let parsedEnd: Date | undefined;
      let parsedJobId: number | undefined;
      if (typeof startDate === 'string') {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) parsedStart = d;
      }
      if (typeof endDate === 'string') {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) parsedEnd = d;
      }
      if (jobId) {
        const idNum = Number(jobId);
        if (!Number.isNaN(idNum) && idNum > 0) parsedJobId = idNum;
      }

      // Scoped jobs for current user (recruiter sees own jobs only)
      const jobFilters: any[] = [];
      if (parsedJobId) jobFilters.push(eq(jobs.id, parsedJobId));
      if (req.user!.role !== 'admin') jobFilters.push(eq(jobs.postedBy, req.user!.id));

      let jobsQuery = db
        .select({
          id: jobs.id,
          postedBy: jobs.postedBy,
          hiringManagerId: jobs.hiringManagerId,
        })
        .from(jobs);
      if (jobFilters.length > 0) jobsQuery = jobsQuery.where(and(...jobFilters));
      const jobRows = await jobsQuery as Array<{ id: number; postedBy: number; hiringManagerId: number | null }>;

      const jobIds = jobRows.map((j) => j.id);
      const recruiterIds: number[] = Array.from(new Set(jobRows.map((j) => j.postedBy))) as number[];
      const hmIds: number[] = Array.from(
        new Set(
          jobRows
            .map((j) => j.hiringManagerId)
            .filter((v): v is number => typeof v === 'number')
        )
      ) as number[];

      // Early exit if no data
      if (jobIds.length === 0) {
        res.json({ recruiters: [], hiringManagers: [] });
        return;
      }

      // Load applications within range for these jobs
      const appFilters: any[] = [];
      if (jobIds.length) appFilters.push(inArray(applications.jobId, jobIds));
      if (parsedStart) appFilters.push(gte(applications.appliedAt, parsedStart));
      if (parsedEnd) appFilters.push(lte(applications.appliedAt, parsedEnd));

      let appsQuery = db
        .select({
          id: applications.id,
          jobId: applications.jobId,
          appliedAt: applications.appliedAt,
          stageChangedAt: applications.stageChangedAt,
          stageChangedBy: applications.stageChangedBy,
        })
        .from(applications);
      if (appFilters.length > 0) appsQuery = appsQuery.where(and(...appFilters));
      const appRows = await appsQuery as Array<{
        id: number;
        jobId: number;
        appliedAt: Date;
        stageChangedAt: Date | null;
        stageChangedBy: number | null;
      }>;

      const appIds = appRows.map((a) => a.id);

      // Stage history for latency calculations
      let histQuery = db
        .select({
          applicationId: applicationStageHistory.applicationId,
          fromStage: applicationStageHistory.fromStage,
          toStage: applicationStageHistory.toStage,
          changedAt: applicationStageHistory.changedAt,
          changedBy: applicationStageHistory.changedBy,
        })
        .from(applicationStageHistory);
      if (appIds.length > 0) {
        histQuery = histQuery.where(inArray(applicationStageHistory.applicationId, appIds));
      }
      const histRows = (appIds.length ? await histQuery : []) as Array<{
        applicationId: number;
        fromStage: number | null;
        toStage: number;
        changedAt: Date;
        changedBy: number;
      }>;

      // Recruiter performance
      const recruiterPerf = (recruiterIds as number[]).map((rid: number) => {
        const jobsFor = jobRows.filter((j) => j.postedBy === rid).map((j) => j.id);
        const appsFor = appRows.filter((a) => jobsFor.includes(a.jobId));
        const jobsHandled = jobsFor.length;
        const candidatesScreened = appsFor.length;

        // Time to first action (applied -> first stage change)
        const firstActionDurations: number[] = [];
        appsFor.forEach((app) => {
          const appHist = histRows
            .filter((h) => h.applicationId === app.id)
            .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
          const first = appHist[0];
          const applied = new Date(app.appliedAt).getTime();
          if (first) {
            const delta = (new Date(first.changedAt).getTime() - applied) / (1000 * 60 * 60 * 24);
            if (delta >= 0) firstActionDurations.push(delta);
          } else if (app.stageChangedAt) {
            const delta = (new Date(app.stageChangedAt).getTime() - applied) / (1000 * 60 * 60 * 24);
            if (delta >= 0) firstActionDurations.push(delta);
          }
        });
        const avgFirstAction =
          firstActionDurations.length > 0
            ? Math.round((firstActionDurations.reduce((a, b) => a + b, 0) / firstActionDurations.length) * 10) / 10
            : null;

        // Stage move latency (average gap between consecutive stage changes)
        const moveDurations: number[] = [];
        const byApp = new Map<number, Array<typeof histRows[number]>>();
        histRows.forEach((h: typeof histRows[number]) => {
          if (!byApp.has(h.applicationId)) byApp.set(h.applicationId, []);
          byApp.get(h.applicationId)!.push(h);
        });
        byApp.forEach((entries: Array<typeof histRows[number]>) => {
          const sorted = entries.sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
          if (sorted.length > 1) {
            for (let i = 1; i < sorted.length; i++) {
              const current = sorted[i];
              const prev = sorted[i - 1];
              if (!current || !prev) continue;
              const delta = (new Date(current.changedAt).getTime() - new Date(prev.changedAt).getTime()) / (1000 * 60 * 60 * 24);
              if (delta >= 0) moveDurations.push(delta);
            }
          }
        });
        const avgStageMove =
          moveDurations.length > 0 ? Math.round((moveDurations.reduce((a, b) => a + b, 0) / moveDurations.length) * 10) / 10 : null;

        return {
          id: rid,
          jobsHandled,
          candidatesScreened,
          avgFirstActionDays: avgFirstAction,
          avgStageMoveDays: avgStageMove,
        };
      });

      // HM performance
      const stagesList = await db.select().from(pipelineStages);
      const reviewStageIdsResolved = stagesList
        .filter((s: typeof stagesList[number]) => s.name.toLowerCase().includes('review'))
        .map((s: typeof stagesList[number]) => s.id);

      const appJobMap = new Map<number, number>();
      appRows.forEach((a) => appJobMap.set(a.id, a.jobId));

      const hmPerf = (hmIds as number[]).map((hid: number) => {
        const hmJobIds = jobRows.filter((j) => j.hiringManagerId === hid).map((j) => j.id);
        const appsForHm = appRows.filter((a) => hmJobIds.includes(a.jobId));
        const jobsOwned = hmJobIds.length;

        // Feedback timing: first review entry to next change
        const durations: number[] = [];
        let waitingCount = 0;
        const appHist = new Map<number, Array<typeof histRows[number]>>();
        histRows
          .filter((h: typeof histRows[number]) => {
            const jobForApp = appJobMap.get(h.applicationId);
            return jobForApp ? hmJobIds.includes(jobForApp) : false;
          })
          .forEach((h: typeof histRows[number]) => {
            if (!appHist.has(h.applicationId)) appHist.set(h.applicationId, []);
            appHist.get(h.applicationId)!.push(h);
          });

        appHist.forEach((entries) => {
          const sorted = entries.sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
          const reviewEntryIdx = sorted.findIndex((e) => reviewStageIdsResolved.includes(e.toStage));
          if (reviewEntryIdx === -1 || !sorted[reviewEntryIdx]) return;
          const entryTime = new Date(sorted[reviewEntryIdx].changedAt).getTime();
          const next = sorted[reviewEntryIdx + 1];
          if (!next) {
            waitingCount += 1;
            return;
          }
          const delta = (new Date(next.changedAt).getTime() - entryTime) / (1000 * 60 * 60 * 24);
          if (delta >= 0) durations.push(delta);
        });

        const avgFeedback =
          durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;

        return {
          id: hid,
          jobsOwned,
          avgFeedbackDays: avgFeedback,
          waitingCount,
        };
      });

      // Load user display names
      const userIds = Array.from(new Set([...recruiterIds, ...hmIds])).filter((v) => Number.isFinite(v)) as number[];
      const usersMap = new Map<number, { name: string; role: string }>();
      if (userIds.length) {
        const userRows = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
            role: users.role,
          })
          .from(users)
          .where(inArray(users.id, userIds));
        userRows.forEach((u: typeof userRows[number]) => {
          const name = u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : u.username;
          usersMap.set(u.id, { name, role: u.role });
        });
      }

      const recruitersWithNames = recruiterPerf.map((r) => ({
        ...r,
        name: usersMap.get(r.id)?.name ?? `Recruiter #${r.id}`,
      }));
      const hmsWithNames = hmPerf.map((h) => ({
        ...h,
        name: usersMap.get(h.id)?.name ?? `HM #${h.id}`,
      }));

      res.json({
        recruiters: recruitersWithNames,
        hiringManagers: hmsWithNames,
      });
      return;
    } catch (error) {
      console.error('[Analytics] performance error:', error);
      next(error);
    }
  });

  // ============= AI JOB ANALYSIS ROUTES =============

  // AI-powered job description analysis
  // Note: CSRF removed - endpoint is auth-protected, role-protected, rate-limited, and read-only
  app.post("/api/ai/analyze-job-description", aiAnalysisRateLimit, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if AI features are enabled
      if (!isAIEnabled()) {
        res.status(503).json({
          error: 'AI features are not configured',
          message: 'OpenAI API key is not set. AI-powered analysis is currently unavailable.'
        });
        return;
      }

      const { title, description } = req.body;

      if (!title || !description) {
        res.status(400).json({ error: 'Title and description are required' });
        return;
      }

      if (title.length > 200 || description.length > 5000) {
        res.status(400).json({ error: 'Title or description too long' });
        return;
      }

      console.log(`AI analysis requested by user ${req.user!.id} for job: ${title}`);

      const analysis = await analyzeJobDescription(title, description);
      const suggestions = calculateOptimizationSuggestions(analysis);

      res.json({
        ...analysis,
        suggestions,
        analysis_timestamp: new Date().toISOString()
      });
      return;
    } catch (error) {
      console.error('AI analysis error:', error);
      if (error instanceof Error && error.message.includes('AI analysis unavailable')) {
        res.status(502).json({ error: 'AI service temporarily unavailable' });
        return;
      }
      next(error);
    }
  });

  // AI-powered job scoring
  app.post("/api/ai/score-job", aiAnalysisRateLimit, csrfProtection, requireRole(['recruiter', 'admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if AI features are enabled
      if (!isAIEnabled()) {
        res.status(503).json({
          error: 'AI features are not configured',
          message: 'OpenAI API key is not set. AI-powered scoring is currently unavailable.'
        });
        return;
      }

      const { title, description, jobId } = req.body;

      if (!title || !description) {
        res.status(400).json({ error: 'Title and description are required' });
        return;
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
      return;
    } catch (error) {
      console.error('AI scoring error:', error);
      next(error);
    }
  });

  console.log('✅ Jobs routes registered');
}
