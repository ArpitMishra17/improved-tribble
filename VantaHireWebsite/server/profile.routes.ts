/**
 * Profile Routes Module
 *
 * User profile management and public recruiter profiles:
 * - GET /api/profile - Get current user's profile
 * - PATCH /api/profile - Update current user's profile
 * - GET /api/recruiters/:id - Get public recruiter profile
 * - GET /api/recruiters/:id/jobs - Get recruiter's active jobs
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { requireAuth, requireRole } from './auth';
import type { CsrfMiddleware } from './types/routes';

// Validation schema for profile updates
const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  skills: z.array(z.string()).max(20).optional().nullable(),
  linkedin: z.string().url().max(500).optional().nullable().or(z.literal('')),
  location: z.string().max(200).optional().nullable(),
  isPublic: z.boolean().optional(),
});

/**
 * Register all profile-related routes
 */
export function registerProfileRoutes(
  app: Express,
  csrfProtection: CsrfMiddleware
): void {
  // ============= CURRENT USER PROFILE =============

  /**
   * GET /api/profile
   * Get the current authenticated user's profile
   */
  app.get("/api/profile", requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Get user profile (may not exist yet)
      let profile = await storage.getUserProfile(userId);

      // If no profile exists, create a default one
      if (!profile) {
        profile = await storage.createUserProfile({
          userId,
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
        });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        profile: {
          displayName: profile.displayName,
          company: profile.company,
          photoUrl: profile.photoUrl,
          bio: profile.bio,
          skills: profile.skills,
          linkedin: profile.linkedin,
          location: profile.location,
          isPublic: profile.isPublic,
        },
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/profile
   * Update the current user's profile
   */
  app.patch("/api/profile", csrfProtection, requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Validate input
      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const updates = parseResult.data;

      // Convert empty string linkedin to undefined
      if (updates.linkedin === '') {
        updates.linkedin = undefined;
      }

      // Convert null values to undefined for type compatibility
      const sanitizedUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        sanitizedUpdates[key] = value === null ? undefined : value;
      }

      // Ensure profile exists
      let profile = await storage.getUserProfile(userId);
      if (!profile) {
        profile = await storage.createUserProfile({ userId });
      }

      // Update profile
      const updatedProfile = await storage.updateUserProfile(userId, sanitizedUpdates);
      if (!updatedProfile) {
        res.status(500).json({ error: 'Failed to update profile' });
        return;
      }

      res.json({
        message: 'Profile updated successfully',
        profile: {
          displayName: updatedProfile.displayName,
          company: updatedProfile.company,
          photoUrl: updatedProfile.photoUrl,
          bio: updatedProfile.bio,
          skills: updatedProfile.skills,
          linkedin: updatedProfile.linkedin,
          location: updatedProfile.location,
          isPublic: updatedProfile.isPublic,
        },
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  // ============= PUBLIC RECRUITER PROFILES =============

  /**
   * GET /api/recruiters/:id
   * Get a public recruiter profile
   * Returns 404 if profile is not public
   */
  app.get("/api/recruiters/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const recruiterId = Number(idParam);
      if (!Number.isFinite(recruiterId) || recruiterId <= 0 || !Number.isInteger(recruiterId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      // Get recruiter and their profile
      const recruiter = await storage.getUser(recruiterId);
      if (!recruiter || recruiter.role !== 'recruiter') {
        res.status(404).json({ error: 'Recruiter not found' });
        return;
      }

      const profile = await storage.getUserProfile(recruiterId);
      if (!profile || !profile.isPublic) {
        res.status(404).json({ error: 'Profile not found or is private' });
        return;
      }

      // Return public profile info only
      res.json({
        id: recruiter.id,
        displayName: profile.displayName || [recruiter.firstName, recruiter.lastName].filter(Boolean).join(' ') || 'Recruiter',
        company: profile.company,
        photoUrl: profile.photoUrl,
        bio: profile.bio,
        skills: profile.skills,
        linkedin: profile.linkedin,
        location: profile.location,
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/recruiters/:id/jobs
   * Get a recruiter's active jobs (only if profile is public)
   */
  app.get("/api/recruiters/:id/jobs", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = req.params.id;
      if (!idParam) {
        res.status(400).json({ error: 'Missing ID parameter' });
        return;
      }
      const recruiterId = Number(idParam);
      if (!Number.isFinite(recruiterId) || recruiterId <= 0 || !Number.isInteger(recruiterId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      // Get recruiter and check profile visibility
      const recruiter = await storage.getUser(recruiterId);
      if (!recruiter || recruiter.role !== 'recruiter') {
        res.status(404).json({ error: 'Recruiter not found' });
        return;
      }

      const profile = await storage.getUserProfile(recruiterId);
      if (!profile || !profile.isPublic) {
        res.status(404).json({ error: 'Profile not found or is private' });
        return;
      }

      // Get recruiter's active, approved jobs
      const jobs = await storage.getPublicJobsByRecruiter(recruiterId);

      res.json({
        jobs: jobs.map(job => ({
          id: job.id,
          title: job.title,
          location: job.location,
          type: job.type,
          createdAt: job.createdAt,
          slug: job.slug,
        })),
      });
      return;
    } catch (error) {
      next(error);
    }
  });

  console.log('✅ Profile routes registered');
}
