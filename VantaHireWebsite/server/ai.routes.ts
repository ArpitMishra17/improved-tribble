/**
 * AI Matching API Routes
 *
 * Features:
 * - Resume management (save up to 3 resumes)
 * - On-demand fit computation
 * - Batch endpoint with deduplication and free-tier handling
 * - Cache awareness (don't recompute fresh fits)
 * - Feature flags for gradual rollout
 */

import type { Express, Request, Response } from 'express';
import { requireAuth, requireRole } from './auth';
import rateLimit from 'express-rate-limit';
import { db } from './db';
import { candidateResumes, applications, jobs, users } from '../shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { upload, uploadToGCS } from './gcs-storage';
import { extractResumeText, validateResumeText } from './lib/resumeExtractor';
import { generateJDDigest, JDDigest } from './lib/jdDigest';
import { computeFitScore, isFitStale, getStalenessReason } from './lib/aiMatchingEngine';
import { getUserLimits, canUseFitComputation } from './lib/aiLimits';
import { z } from 'zod';

const AI_MATCH_ENABLED = process.env.AI_MATCH_ENABLED === 'true';
const AI_RESUME_ENABLED = process.env.AI_RESUME_ENABLED === 'true';

// Validation schemas
const saveResumeSchema = z.object({
  label: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
});

const computeFitSchema = z.object({
  applicationId: z.number().int().positive(),
});

const batchComputeFitSchema = z.object({
  applicationIds: z.array(z.number().int().positive()).min(1).max(20),
});

// Rate limiters
const resumeUploadLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 5,
  message: 'Too many resume uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const fitComputeLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  message: 'Too many fit computation requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const batchComputeLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 3,
  message: 'Too many batch computation requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Feature flag check middleware
 */
function requireFeatureFlag(flag: 'match' | 'resume') {
  return (req: any, res: any, next: any): void => {
    const enabled = flag === 'match' ? AI_MATCH_ENABLED : AI_RESUME_ENABLED;

    if (!enabled) {
      res.status(503).json({
        error: 'Feature not available',
        message: `AI ${flag} feature is currently disabled`,
      });
     return;
    }

    next();
  };
}

export function registerAIRoutes(app: Express): void {
  // ========================================
  // Resume Management Routes
  // ========================================

  /**
   * POST /api/ai/resume
   * Save a resume to the candidate's library (max 3)
   */
  app.post(
    '/api/ai/resume',
    requireAuth,
    requireRole(['candidate']),
    requireFeatureFlag('resume'),
    resumeUploadLimiter,
    upload.single('resume'),
    async (req, res): Promise<void> => {
      try {
        const userId = req.user!.id;
        const file = req.file;

        if (!file) {
          res.status(400).json({ error: 'Resume file is required' });
         return;
        }

        // Validate body
        const body = saveResumeSchema.safeParse(req.body);
        if (!body.success) {
          res.status(400).json({ error: 'Invalid request body', details: body.error });
         return;
        }

        const { label, isDefault } = body.data;

        // Check resume limit (max 3)
        const existingResumes = await db.query.candidateResumes.findMany({
          where: eq(candidateResumes.userId, userId),
        });

        if (existingResumes.length >= 3) {
          res.status(400).json({
            error: 'Maximum 3 resumes allowed',
            message: 'Please delete an existing resume before adding a new one.',
          });
       return;
        }

        // Extract text from resume
        const extractionResult = await extractResumeText(file.buffer);

        if (!extractionResult.success) {
          res.status(400).json({
            error: 'Resume extraction failed',
            message: extractionResult.error,
          });
       return;
        }

        // Validate extracted text
        if (!validateResumeText(extractionResult.text)) {
          res.status(400).json({
            error: 'Invalid resume',
            message: 'Resume must contain at least 50 characters of text.',
          });
       return;
        }

        // Upload to GCS
        const gcsPath = await uploadToGCS(file.buffer, file.originalname);

        // If this is set as default, unset other defaults
        if (isDefault) {
          await db
            .update(candidateResumes)
            .set({ isDefault: false })
            .where(eq(candidateResumes.userId, userId));
        }

        // Save resume
        const [resume] = await db
          .insert(candidateResumes)
          .values({
            userId,
            label,
            gcsPath,
            extractedText: extractionResult.text,
            isDefault: isDefault || false,
          })
          .returning();

        // Mark applications stale if they used a previous resume from this user
        await db
          .update(applications)
          .set({
            aiStaleReason: 'resume_updated',
          })
          .where(
            and(
              eq(applications.userId, userId),
              sql`${applications.aiComputedAt} IS NOT NULL`
            )
          );

        res.json({
          message: 'Resume saved successfully',
          resume: {
            id: resume.id,
            label: resume.label,
            isDefault: resume.isDefault,
            createdAt: resume.createdAt,
          },
        });
      } catch (error) {
        console.error('Resume upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
     return;
      }
    }
  );

  /**
   * GET /api/ai/resume
   * List all saved resumes for the authenticated candidate
   */
  app.get(
    '/api/ai/resume',
    requireAuth,
    requireRole(['candidate']),
    requireFeatureFlag('resume'),
    async (req, res): Promise<void> => {
      try {
        const userId = req.user!.id;

        const resumes = await db.query.candidateResumes.findMany({
          where: eq(candidateResumes.userId, userId),
          columns: {
            id: true,
            label: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        res.json({ resumes });
      } catch (error) {
        console.error('Resume list error:', error);
        res.status(500).json({ error: 'Internal server error' });
     return;
      }
    }
  );

  /**
   * DELETE /api/ai/resume/:id
   * Delete a saved resume
   */
  app.delete(
    '/api/ai/resume/:id',
    requireAuth,
    requireRole(['candidate']),
    requireFeatureFlag('resume'),
    async (req, res): Promise<void> => {
      try {
        const userId = req.user!.id;
        const resumeId = parseInt(req.params.id, 10);

        if (isNaN(resumeId)) {
          res.status(400).json({ error: 'Invalid resume ID' });
       return;
        }

        // Check ownership
        const resume = await db.query.candidateResumes.findFirst({
          where: and(
            eq(candidateResumes.id, resumeId),
            eq(candidateResumes.userId, userId)
          ),
        });

        if (!resume) {
          res.status(404).json({ error: 'Resume not found' });
       return;
        }

        // Delete resume
        await db.delete(candidateResumes).where(eq(candidateResumes.id, resumeId));

        res.json({ message: 'Resume deleted successfully' });
      } catch (error) {
        console.error('Resume delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
     return;
      }
    }
  );

  // ========================================
  // AI Fit Computation Routes
  // ========================================

  /**
   * POST /api/ai/match
   * Compute fit score for a single application
   */
  app.post(
    '/api/ai/match',
    requireAuth,
    requireRole(['candidate']),
    requireFeatureFlag('match'),
    fitComputeLimiter,
    async (req, res): Promise<void> => {
      try {
        const userId = req.user!.id;

        // Validate body
        const body = computeFitSchema.safeParse(req.body);
        if (!body.success) {
          res.status(400).json({ error: 'Invalid request body', details: body.error });
       return;
        }

        const { applicationId } = body.data;

        // Check free tier limit
        const canCompute = await canUseFitComputation(userId);
        if (!canCompute) {
          const limits = await getUserLimits(userId);
          res.status(403).json({
            error: 'Free tier limit reached',
            message: `You have used all ${limits.fitUsedThisMonth} free fit computations this month.`,
            limits,
          });
       return;
        }

        // Get application with job data
        const application = await db.query.applications.findFirst({
          where: eq(applications.id, applicationId),
          with: {
            job: true,
          },
        });

        if (!application) {
          res.status(404).json({ error: 'Application not found' });
       return;
        }

        // Check ownership
        if (application.userId !== userId) {
          res.status(403).json({ error: 'Unauthorized' });
       return;
        }

        // Check if fit is fresh (cache-aware)
        const resumeData = application.resumeId
          ? await db.query.candidateResumes.findFirst({
              where: eq(candidateResumes.id, application.resumeId),
            })
          : null;

        const stale = isFitStale(
          application.aiComputedAt,
          resumeData?.updatedAt || null,
          application.job.updatedAt,
          application.job.jdDigestVersion || 1,
          application.job.jdDigestVersion || null
        );

        if (!stale && application.aiFitScore !== null) {
          // Return cached result (doesn't consume free tier)
          res.json({
            message: 'Fit score retrieved from cache',
            fit: {
              score: application.aiFitScore,
              label: application.aiFitLabel,
              reasons: application.aiFitReasons,
              computedAt: application.aiComputedAt,
              cached: true,
            },
          });
        }

        // Get resume text
        let resumeText = resumeData?.extractedText || '';

        if (!resumeText && application.resumeUrl) {
          // Fall back to application resume URL if no library resume
          // TODO: Extract text from application.resumeUrl
          res.status(400).json({
            error: 'Resume text not available',
            message: 'Please save your resume to your library first.',
          });
       return;
        }

        // Get or generate JD digest
        let jdDigest: JDDigest = application.job.jdDigest as JDDigest;

        if (!jdDigest || !application.job.jdDigestVersion || application.job.jdDigestVersion < 1) {
          jdDigest = await generateJDDigest(application.job.title, application.job.description);

          // Cache digest
          await db
            .update(jobs)
            .set({
              jdDigest,
              jdDigestVersion: jdDigest.version,
            })
            .where(eq(jobs.id, application.job.id));
        }

        // Compute fit score
        const result = await computeFitScore(resumeText, jdDigest, userId, applicationId);

        // Update application with fit score
        await db
          .update(applications)
          .set({
            aiFitScore: result.score,
            aiFitLabel: result.label,
            aiFitReasons: result.reasons,
            aiModelVersion: result.modelVersion,
            aiComputedAt: new Date(),
            aiStaleReason: null,
          })
          .where(eq(applications.id, applicationId));

        res.json({
          message: 'Fit score computed successfully',
          fit: {
            score: result.score,
            label: result.label,
            reasons: result.reasons,
            computedAt: new Date(),
            cached: false,
            cost: result.costUsd,
            durationMs: result.durationMs,
          },
        });
      } catch (error: any) {
        console.error('Fit computation error:', error);

        if (error.message?.includes('Circuit breaker') || error.message?.includes('budget')) {
          res.status(503).json({
            error: 'Service temporarily unavailable',
            message: error.message,
          });
       return;
        }

        res.status(500).json({ error: 'Internal server error' });
     return;
      }
    }
  );

  /**
   * POST /api/ai/match/batch
   * Compute fit scores for multiple applications (batch processing)
   */
  app.post(
    '/api/ai/match/batch',
    requireAuth,
    requireRole(['candidate']),
    requireFeatureFlag('match'),
    batchComputeLimiter,
    async (req, res): Promise<void> => {
      try {
        const userId = req.user!.id;

        // Validate body
        const body = batchComputeFitSchema.safeParse(req.body);
        if (!body.success) {
          res.status(400).json({ error: 'Invalid request body', details: body.error });
       return;
        }

        let { applicationIds } = body.data;

        // Deduplicate input
        applicationIds = [...new Set(applicationIds)];

        // Check free tier limit
        const limits = await getUserLimits(userId);
        const remaining = limits.fitRemainingThisMonth;

        // Fetch all applications (validate ownership)
        const apps = await db.query.applications.findMany({
          where: inArray(applications.id, applicationIds),
          with: {
            job: true,
          },
        });

        const results: Array<{
          applicationId: number;
          success: boolean;
          status: 'success' | 'cached' | 'requiresPaid' | 'unauthorized' | 'error';
          error?: string;
          fit?: any;
        }> = [];

        let computedCount = 0;

        for (const appId of applicationIds) {
          const app = apps.find((application: typeof apps[number]) => application.id === appId);

          // Ownership check
          if (!app || app.userId !== userId) {
            results.push({
              applicationId: appId,
              success: false,
              status: 'unauthorized',
              error: 'Unauthorized or invalid application ID',
            });
            continue;
          }

          // Check if fit is fresh
          const resumeData = app.resumeId
            ? await db.query.candidateResumes.findFirst({
                where: eq(candidateResumes.id, app.resumeId),
              })
            : null;

          const stale = isFitStale(
            app.aiComputedAt,
            resumeData?.updatedAt || null,
            app.job.updatedAt,
            app.job.jdDigestVersion || 1,
            app.job.jdDigestVersion || null
          );

          // If fresh, return cached (doesn't consume free tier)
          if (!stale && app.aiFitScore !== null) {
            results.push({
              applicationId: appId,
              success: true,
              status: 'cached',
              fit: {
                score: app.aiFitScore,
                label: app.aiFitLabel,
                reasons: app.aiFitReasons,
                computedAt: app.aiComputedAt,
                cached: true,
              },
            });
            continue;
          }

          // Check free tier limit
          if (computedCount >= remaining) {
            results.push({
              applicationId: appId,
              success: false,
              status: 'requiresPaid',
              error: `Free tier limit reached. ${remaining} free computations remaining this month.`,
            });
            continue;
          }

          // Compute fit score
          try {
            let resumeText = resumeData?.extractedText || '';

            if (!resumeText && app.resumeUrl) {
              results.push({
                applicationId: appId,
                success: false,
                status: 'error',
                error: 'Resume text not available. Please save your resume to your library first.',
              });
              continue;
            }

            // Get or generate JD digest
            let jdDigest: JDDigest = app.job.jdDigest as JDDigest;

            if (!jdDigest || !app.job.jdDigestVersion || app.job.jdDigestVersion < 1) {
              jdDigest = await generateJDDigest(app.job.title, app.job.description);

              await db
                .update(jobs)
                .set({
                  jdDigest,
                  jdDigestVersion: jdDigest.version,
                })
                .where(eq(jobs.id, app.job.id));
            }

            const result = await computeFitScore(resumeText, jdDigest, userId, appId);

            // Update application
            await db
              .update(applications)
              .set({
                aiFitScore: result.score,
                aiFitLabel: result.label,
                aiFitReasons: result.reasons,
                aiModelVersion: result.modelVersion,
                aiComputedAt: new Date(),
                aiStaleReason: null,
              })
              .where(eq(applications.id, appId));

            results.push({
              applicationId: appId,
              success: true,
              status: 'success',
              fit: {
                score: result.score,
                label: result.label,
                reasons: result.reasons,
                computedAt: new Date(),
                cached: false,
              },
            });

            computedCount++;

            // Server-side pacing (200ms between calls)
            if (computedCount < applicationIds.length) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          } catch (error: any) {
            results.push({
              applicationId: appId,
              success: false,
              status: 'error',
              error: error.message || 'Computation failed',
            });
          }
        }

        res.json({
          message: 'Batch computation completed',
          results,
          summary: {
            total: applicationIds.length,
            successful: results.filter((r) => r.success).length,
            cached: results.filter((r) => r.status === 'cached').length,
            requiresPaid: results.filter((r) => r.status === 'requiresPaid').length,
            errors: results.filter((r) => r.status === 'error' || r.status === 'unauthorized').length,
          },
        });
      } catch (error) {
        console.error('Batch computation error:', error);
        res.status(500).json({ error: 'Internal server error' });
     return;
      }
    }
  );

  /**
   * GET /api/ai/limits
   * Get user's AI usage limits and remaining quota
   */
  app.get(
    '/api/ai/limits',
    requireAuth,
    requireRole(['candidate']),
    requireFeatureFlag('match'),
    async (req, res): Promise<void> => {
      try {
        const userId = req.user!.id;
        const limits = await getUserLimits(userId);

        res.json({ limits });
      } catch (error) {
        console.error('Limits error:', error);
        res.status(500).json({ error: 'Internal server error' });
     return;
      }
    }
  );
}
