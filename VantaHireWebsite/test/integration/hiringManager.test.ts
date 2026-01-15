/**
 * Hiring Manager Invitation Feature Integration Tests
 *
 * Tests for hiring manager invitations.
 * These tests focus on API structure and public endpoint behavior.
 * Full authentication flow tests require E2E testing with proper session handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';

describe('Hiring Manager Invitation Integration Tests', () => {
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
    it('should register hiring manager invitation routes', async () => {
      // Test that the routes exist by checking 401/403 (auth required) vs 404 (not found)
      const res = await request(app).get('/api/hiring-manager-invitations');
      expect([401, 403]).toContain(res.status); // Auth required, not 404
    });

    it('should register invitation validation route', async () => {
      const res = await request(app).get('/api/hiring-manager-invitations/validate/test');
      // Should return 400 (invalid format) not 404
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/hiring-manager-invitations/validate/:token', () => {
    it('should reject invalid token format (too short)', async () => {
      const res = await request(app)
        .get('/api/hiring-manager-invitations/validate/short-token');

      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toContain('Invalid token format');
    });

    it('should reject non-existent token', async () => {
      // Valid format (64 hex chars) but doesn't exist
      const fakeToken = 'a'.repeat(64);
      const res = await request(app)
        .get(`/api/hiring-manager-invitations/validate/${fakeToken}`);

      expect(res.status).toBe(404);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/hiring-manager-invitations', () => {
    it('should require authentication or CSRF token', async () => {
      const res = await request(app)
        .post('/api/hiring-manager-invitations')
        .send({ email: 'test@example.com' });

      // 401 = auth required, 403 = CSRF required (both indicate proper protection)
      expect([401, 403]).toContain(res.status);
    });

    it('should require CSRF token for authenticated requests', async () => {
      // Even with a fake cookie, CSRF should block
      const res = await request(app)
        .post('/api/hiring-manager-invitations')
        .set('Cookie', 'connect.sid=fake-session')
        .send({ email: 'test@example.com' });

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('DELETE /api/hiring-manager-invitations/:id', () => {
    it('should require authentication or CSRF token', async () => {
      const res = await request(app)
        .delete('/api/hiring-manager-invitations/999');

      // 401 = auth required, 403 = CSRF required (both indicate proper protection)
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('GET /api/hiring-manager-invitations (list)', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/hiring-manager-invitations');

      // 401 = auth required, 403 = insufficient role
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Registration with invitation token', () => {
    it('should reject registration with invalid invitation token format', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          username: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          invitationToken: 'invalid-short-token',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid invitation token');
    });

    it('should reject registration with non-existent invitation token', async () => {
      const fakeToken = 'c'.repeat(64);
      const res = await request(app)
        .post('/api/register')
        .send({
          username: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          invitationToken: fakeToken,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid invitation token');
    });
  });
});
