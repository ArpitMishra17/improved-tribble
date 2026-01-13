/**
 * Async AI Queue Integration Tests
 *
 * Tests for async job processing of AI fit scoring.
 * These tests focus on API structure and public endpoint behavior.
 * Full authentication flow tests require E2E testing with proper session handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';

describe('Async AI Queue Integration Tests', () => {
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
    it('should register async queue routes', async () => {
      // Test that the routes exist by checking 401/403/503 (auth/csrf/queue) vs 404 (not found)
      const res = await request(app).post('/api/ai/match/queue');
      // 401 = auth required, 403 = CSRF required, 503 = queue not enabled (all valid - not 404)
      expect([401, 403, 503]).toContain(res.status);
    });

    it('should register batch queue route', async () => {
      const res = await request(app).post('/api/ai/match/batch/queue');
      expect([401, 403, 503]).toContain(res.status);
    });

    it('should register job status route', async () => {
      const res = await request(app).get('/api/ai/match/jobs/1');
      expect([401, 403]).toContain(res.status);
    });

    it('should register job list route', async () => {
      const res = await request(app).get('/api/ai/match/jobs');
      expect([401, 403]).toContain(res.status);
    });

    it('should register job cancel route', async () => {
      const res = await request(app).delete('/api/ai/match/jobs/1');
      expect([401, 403]).toContain(res.status);
    });

    it('should register queue health route', async () => {
      const res = await request(app).get('/api/admin/ai/queue-health');
      // 401 = auth required, 403 = admin role required (both valid)
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('POST /api/ai/match/queue', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/ai/match/queue')
        .send({ applicationId: 123 });

      // 401 = auth required, 403 = CSRF required, 503 = queue not enabled
      expect([401, 403, 503]).toContain(res.status);
    });

    it('should require CSRF token for authenticated requests', async () => {
      const res = await request(app)
        .post('/api/ai/match/queue')
        .set('Cookie', 'connect.sid=fake-session')
        .send({ applicationId: 123 });

      expect([401, 403, 503]).toContain(res.status);
    });
  });

  describe('POST /api/ai/match/batch/queue', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/ai/match/batch/queue')
        .send({ applicationIds: [1, 2, 3] });

      expect([401, 403, 503]).toContain(res.status);
    });

    it('should require CSRF token for authenticated requests', async () => {
      const res = await request(app)
        .post('/api/ai/match/batch/queue')
        .set('Cookie', 'connect.sid=fake-session')
        .send({ applicationIds: [1, 2, 3] });

      expect([401, 403, 503]).toContain(res.status);
    });
  });

  describe('GET /api/ai/match/jobs/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/ai/match/jobs/1');

      // 401 = auth required, 403 = role required
      expect([401, 403]).toContain(res.status);
    });

    it('should handle invalid job ID format', async () => {
      const res = await request(app)
        .get('/api/ai/match/jobs/invalid')
        .set('Cookie', 'connect.sid=fake-session');

      // Could be 400 (bad request) or 401/403 (auth)
      expect([400, 401, 403]).toContain(res.status);
    });
  });

  describe('GET /api/ai/match/jobs', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/ai/match/jobs');

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('DELETE /api/ai/match/jobs/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).delete('/api/ai/match/jobs/1');

      expect([401, 403]).toContain(res.status);
    });

    it('should require CSRF token', async () => {
      const res = await request(app)
        .delete('/api/ai/match/jobs/1')
        .set('Cookie', 'connect.sid=fake-session');

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('GET /api/admin/ai/queue-health', () => {
    it('should require admin role', async () => {
      const res = await request(app).get('/api/admin/ai/queue-health');

      // 401 = auth required, 403 = role required
      expect([401, 403]).toContain(res.status);
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .get('/api/admin/ai/queue-health')
        .set('Cookie', 'connect.sid=fake-session');

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Error Handling', () => {
    it('should return proper JSON error for invalid requests', async () => {
      const res = await request(app)
        .post('/api/ai/match/queue')
        .set('Content-Type', 'application/json')
        .send({ applicationId: 'not-a-number' });

      // Should return JSON error, not HTML
      expect(res.header['content-type']).toContain('json');
    });

    it('should return proper JSON for batch with empty array', async () => {
      const res = await request(app)
        .post('/api/ai/match/batch/queue')
        .set('Content-Type', 'application/json')
        .send({ applicationIds: [] });

      expect(res.header['content-type']).toContain('json');
    });
  });
});
