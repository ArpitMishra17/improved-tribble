import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock server for API testing
export const server = setupServer(
  // CSRF token endpoint (matches server cookieName: 'x-csrf-token')
  http.get('/api/csrf-token', () => {
    return HttpResponse.json(
      { token: 'test-csrf-token' },
      {
        headers: {
          'Set-Cookie': 'x-csrf-token=test-csrf-token; Path=/; HttpOnly; SameSite=Lax'
        }
      }
    );
  }),
  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),
  // Client config
  http.get('/api/client-config', () => {
    return HttpResponse.json({
      recaptchaSiteKey: 'test-key',
      cloudinaryCloudName: 'test-cloud'
    });
  }),
  // Jobs endpoint - matches real API shape with pagination
  http.get('/api/jobs', () => {
    return HttpResponse.json({
      jobs: [
        {
          id: 1,
          title: 'Senior Developer',
          type: 'full-time',
          location: 'Remote',
          description: 'Test job description',
          skills: ['React', 'TypeScript'],
          deadline: null,
          postedBy: 1,
          createdAt: new Date(),
          isActive: true,
          status: 'approved',
          reviewComments: null,
          expiresAt: null,
          reviewedBy: null,
          reviewedAt: null
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      }
    });
  }),
  // User endpoint
  http.get('/api/user', () => {
    return new HttpResponse(null, { status: 401 });
  }),
  // Login endpoint
  http.post('/api/login', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'candidate',
      createdAt: new Date()
    });
  }),
  // Contact form endpoint
  http.post('/api/contact', () => {
    return HttpResponse.json({ success: true, id: 1 }, { status: 201 });
  }),
  // Job application submission endpoint
  http.post('/api/jobs/:id/apply', () => {
    return HttpResponse.json({ success: true, applicationId: 123 }, { status: 201 });
  }),
  // Pipeline stages endpoint
  http.get('/api/pipeline/stages', () => {
    return HttpResponse.json([]);
  }),
  // Email templates endpoint
  http.get('/api/email-templates', () => {
    return HttpResponse.json([]);
  }),
  // Individual job endpoint
  http.get('/api/jobs/:id', () => {
    return HttpResponse.json({
      id: 1,
      title: 'Senior Developer',
      type: 'full-time',
      location: 'Remote',
      description: 'Test job description',
      skills: ['React', 'TypeScript'],
      deadline: null,
      postedBy: 1,
      createdAt: new Date(),
      isActive: true,
      status: 'approved',
      reviewComments: null,
      expiresAt: null,
      reviewedBy: null,
      reviewedAt: null
    });
  }),
  // Job applications endpoint
  http.get('/api/jobs/:id/applications', () => {
    return HttpResponse.json([]);
  })
);

// Enable API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Reset any runtime request handlers
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => server.close());

// Mock environment variables (only for browser/jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock ResizeObserver (only if not already defined)
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// Mock IntersectionObserver (only if not already defined)
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}