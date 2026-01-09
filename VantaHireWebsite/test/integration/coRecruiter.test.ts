/**
 * Co-Recruiter Feature Integration Tests
 *
 * Tests for multi-recruiter collaboration on job postings.
 * These tests focus on API structure and public endpoint behavior.
 * Full authentication flow tests require E2E testing with proper session handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';

describe('Co-Recruiter Feature Integration Tests', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server?.close) {
      server.close();
    }
  });

  describe('Route Registration', () => {
    it('should register co-recruiter routes', async () => {
      // Test that the routes exist by checking 401 (auth required) vs 404 (not found)
      const res = await request(app).get('/api/jobs/1/co-recruiters');
      expect(res.status).toBe(401); // Auth required, not 404
    });

    it('should register invitation validation route', async () => {
      const res = await request(app).get('/api/co-recruiter-invitations/validate/test');
      // Should return 400 (invalid format) not 404
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/co-recruiter-invitations/validate/:token', () => {
    it('should reject invalid token format (too short)', async () => {
      const res = await request(app)
        .get('/api/co-recruiter-invitations/validate/short-token');

      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toContain('Invalid token format');
    });

    it('should reject non-existent token', async () => {
      // Valid format (64 hex chars) but doesn't exist
      const fakeToken = 'a'.repeat(64);
      const res = await request(app)
        .get(`/api/co-recruiter-invitations/validate/${fakeToken}`);

      expect(res.status).toBe(404);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/jobs/:jobId/co-recruiters/invite', () => {
    it('should require authentication or CSRF token', async () => {
      const res = await request(app)
        .post('/api/jobs/1/co-recruiters/invite')
        .send({ email: 'test@example.com' });

      // 401 = auth required, 403 = CSRF required (both indicate proper protection)
      expect([401, 403]).toContain(res.status);
    });

    it('should require CSRF token for authenticated requests', async () => {
      // Even with a fake cookie, CSRF should block
      const res = await request(app)
        .post('/api/jobs/1/co-recruiters/invite')
        .set('Cookie', 'connect.sid=fake-session')
        .send({ email: 'test@example.com' });

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('DELETE /api/jobs/:jobId/co-recruiters/:recruiterId', () => {
    it('should require authentication or CSRF token', async () => {
      const res = await request(app)
        .delete('/api/jobs/1/co-recruiters/999');

      // 401 = auth required, 403 = CSRF required (both indicate proper protection)
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('DELETE /api/co-recruiter-invitations/:id', () => {
    it('should require authentication or CSRF token', async () => {
      const res = await request(app)
        .delete('/api/co-recruiter-invitations/999');

      // 401 = auth required, 403 = CSRF required (both indicate proper protection)
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('POST /api/co-recruiter-invitations/:token/accept', () => {
    it('should require authentication or CSRF token', async () => {
      const fakeToken = 'b'.repeat(64);
      const res = await request(app)
        .post(`/api/co-recruiter-invitations/${fakeToken}/accept`);

      // 401 = auth required, 403 = CSRF required (both indicate proper protection)
      expect([401, 403]).toContain(res.status);
    });

    it('should reject invalid token format', async () => {
      const res = await request(app)
        .post('/api/co-recruiter-invitations/invalid/accept')
        .set('Cookie', 'connect.sid=fake');

      expect([400, 401, 403]).toContain(res.status);
    });
  });

  describe('Job ID validation', () => {
    it('should reject invalid job ID format', async () => {
      const res = await request(app)
        .get('/api/jobs/invalid/co-recruiters')
        .set('Cookie', 'connect.sid=fake');

      expect([400, 401]).toContain(res.status);
    });

    it('should reject negative job ID', async () => {
      const res = await request(app)
        .get('/api/jobs/-1/co-recruiters')
        .set('Cookie', 'connect.sid=fake');

      expect([400, 401]).toContain(res.status);
    });
  });
});
