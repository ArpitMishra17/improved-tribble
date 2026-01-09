/**
 * Clients Routes Module
 *
 * All client and shortlist-related endpoints:
 * - Client CRUD (/api/clients)
 * - Client shortlists (/api/client-shortlists, /client-shortlist/:token)
 * - Client feedback on candidates
 * - Job-specific shortlist listing
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { storage } from './storage';
import { requireAuth, requireRole } from './auth';
import {
  insertClientSchema,
  insertClientShortlistSchema,
  insertClientFeedbackSchema,
  clientShortlistItems,
  type InsertClient,
} from '@shared/schema';
import type { CsrfMiddleware } from './types/routes';

// Validation schema for client updates
const updateClientSchema = insertClientSchema.partial();

/**
 * Register all client-related routes
 */
export function registerClientsRoutes(
  app: Express,
  csrfProtection: CsrfMiddleware
): void {
  // ============= CLIENT MANAGEMENT ROUTES =============

  // Get all clients (recruiter/admin)
  app.get("/api/clients", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const clients = await storage.getClients();

      const filtered = search
        ? clients.filter((client) => {
            const haystack = `${client.name} ${client.domain ?? ''} ${client.primaryContactName ?? ''} ${client.primaryContactEmail ?? ''}`.toLowerCase();
            return haystack.includes(search.toLowerCase());
          })
        : clients;

      res.json(filtered);
      return;
    } catch (error) {
      next(error);
    }
  });

  // Create a new client
  app.post("/api/clients", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = insertClientSchema.parse(req.body as InsertClient);
      const client = await storage.createClient({
        ...body,
        createdBy: req.user!.id,
      });
      res.status(201).json(client);
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  });

  // Update an existing client
  app.patch("/api/clients/:id", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const clientId = Number(idParam);
      if (!Number.isFinite(clientId) || clientId <= 0 || !Number.isInteger(clientId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const parsed = updateClientSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parsed.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const updates = parsed.data as Partial<InsertClient>;
      const updated = await storage.updateClient(clientId, updates);
      if (!updated) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json(updated);
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= CLIENT SHORTLIST ROUTES =============

  /**
   * POST /api/client-shortlists
   * Create a new client shortlist for sharing candidates
   * Requires: recruiter or admin role
   */
  app.post("/api/client-shortlists", csrfProtection, requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = insertClientShortlistSchema.parse(req.body);

      // Verify client exists and job has that clientId
      const client = await storage.getClient(body.clientId);
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const job = await storage.getJob(body.jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (job.clientId !== body.clientId) {
        res.status(400).json({ error: 'Job is not associated with this client' });
        return;
      }

      // Create shortlist
      const shortlist = await storage.createClientShortlist({
        clientId: body.clientId,
        jobId: body.jobId,
        applicationIds: body.applicationIds,
        ...(body.title ? { title: body.title } : {}),
        ...(body.message ? { message: body.message } : {}),
        ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
        createdBy: req.user!.id,
      });

      // Return shortlist with public URL
      const publicUrl = `/client-shortlist/${shortlist.token}`;
      res.status(201).json({
        ...shortlist,
        publicUrl,
        fullUrl: `${req.protocol}://${req.get('host')}${publicUrl}`,
      });
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /client-shortlist/:token
   * View a client shortlist (public, no auth required)
   */
  app.get("/client-shortlist/:token", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({ error: 'Missing token' });
        return;
      }

      const shortlistData = await storage.getClientShortlistByToken(token);

      if (!shortlistData.shortlist || !shortlistData.client || !shortlistData.job) {
        res.status(410).json({ error: 'Shortlist not found or expired' });
        return;
      }

      // Return sanitized data (no internal IDs, emails, etc.)
      const candidates = shortlistData.items.map((item, index) => ({
        id: item.application.id,
        name: item.application.name,
        email: item.application.email,
        phone: item.application.phone || null,
        position: item.position,
        notes: item.notes,
        resumeUrl: item.application.resumeUrl || null,
        coverLetter: item.application.coverLetter || null,
        appliedAt: item.application.appliedAt,
      }));

      res.json({
        title: shortlistData.shortlist.title || shortlistData.job.title,
        message: shortlistData.shortlist.message,
        client: {
          name: shortlistData.client.name,
        },
        job: {
          title: shortlistData.job.title,
          location: shortlistData.job.location,
          type: shortlistData.job.type,
        },
        candidates,
        createdAt: shortlistData.shortlist.createdAt,
        expiresAt: shortlistData.shortlist.expiresAt,
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /client-shortlist/:token/feedback
   * Submit client feedback on candidates (public, no auth required)
   */
  app.post("/client-shortlist/:token/feedback", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({ error: 'Missing token' });
        return;
      }

      // Verify shortlist exists and is active
      const shortlistData = await storage.getClientShortlistByToken(token);

      if (!shortlistData.shortlist || !shortlistData.client) {
        res.status(410).json({ error: 'Shortlist not found or expired' });
        return;
      }

      // Parse feedback (can be single or multiple)
      const feedbackArray = Array.isArray(req.body) ? req.body : [req.body];

      const savedFeedback = [];
      for (const feedbackData of feedbackArray) {
        const parsed = insertClientFeedbackSchema.parse(feedbackData);

        // Verify application is in this shortlist
        const inShortlist = shortlistData.items.some(
          item => item.application.id === parsed.applicationId
        );

        if (!inShortlist) {
          res.status(400).json({
            error: `Application ${parsed.applicationId} is not in this shortlist`
          });
          return;
        }

        const feedback = await storage.addClientFeedback({
          ...parsed,
          clientId: shortlistData.client.id,
          shortlistId: shortlistData.shortlist.id,
        });

        savedFeedback.push(feedback);
      }

      res.status(201).json({
        success: true,
        count: savedFeedback.length,
        message: 'Feedback submitted successfully',
      });
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /api/applications/:id/client-feedback
   * Get client feedback for an application (requires auth)
  */
  app.get("/api/applications/:id/client-feedback", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const applicationId = Number(req.params.id);

      if (!Number.isFinite(applicationId) || applicationId <= 0) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      const feedback = await storage.getClientFeedbackForApplication(applicationId);
      res.json(feedback);
      return;
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/jobs/:id/client-shortlists
   * Returns all client shortlists for a given job (recruiter/admin)
   */
  app.get("/api/jobs/:id/client-shortlists", requireRole(['recruiter', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Verify job access (use isRecruiterOnJob to include co-recruiters)
      const hasAccess = await storage.isRecruiterOnJob(jobId, req.user!.id);
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const shortlists = await storage.getClientShortlistsByJob(jobId);
      const shortlistIds = shortlists.map((s) => s.id);

      let countsByShortlistId: Record<number, number> = {};
      if (shortlistIds.length > 0) {
        const counts: { shortlistId: number; count: number }[] = await db
          .select({
            shortlistId: clientShortlistItems.shortlistId,
            count: sql<number>`COUNT(${clientShortlistItems.id})::int`,
          })
          .from(clientShortlistItems)
          .where(inArray(clientShortlistItems.shortlistId, shortlistIds))
          .groupBy(clientShortlistItems.shortlistId);

        countsByShortlistId = counts.reduce((acc: Record<number, number>, row) => {
          acc[row.shortlistId] = row.count;
          return acc;
        }, {} as Record<number, number>);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const responsePayload = shortlists.map((s) => ({
        id: s.id,
        title: s.title,
        message: s.message,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        status: s.status,
        client: s.client ? { id: s.client.id, name: s.client.name } : null,
        candidateCount: countsByShortlistId[s.id] ?? 0,
        publicUrl: `/client-shortlist/${s.token}`,
        fullUrl: `${baseUrl}/client-shortlist/${s.token}`,
      }));

      res.json(responsePayload);
      return;
    } catch (error) {
      next(error);
    }
  });

  console.log('✅ Clients routes registered');
}
