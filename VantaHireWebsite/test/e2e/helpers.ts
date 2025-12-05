/**
 * E2E Test Helpers
 *
 * Shared utilities for Playwright E2E tests
 */

import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Test fixtures interface
export interface TestFixtures {
  pendingJobId?: number;
  approvedJobId?: number;
  expiredJobId?: number;
  pipelineJobId?: number;
  publicFormToken?: string;
  applicationId?: number;
}

const FIXTURES_FILE = path.join(process.cwd(), 'test-results', 'e2e-fixtures.json');

/**
 * Load test fixtures from global setup
 */
export function loadFixtures(): TestFixtures {
  try {
    if (fs.existsSync(FIXTURES_FILE)) {
      const content = fs.readFileSync(FIXTURES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Could not load fixtures:', error);
  }
  return {};
}

/**
 * Get a specific fixture or skip test if not available
 */
export function getFixture<K extends keyof TestFixtures>(
  fixtures: TestFixtures,
  key: K
): TestFixtures[K] | null {
  return fixtures[key] ?? null;
}

export interface TestUser {
  username: string;
  password: string;
  role: 'admin' | 'recruiter' | 'candidate';
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: { username: 'admin', password: 'admin123', role: 'admin' },
  recruiter: { username: 'recruiter', password: 'recruiter123', role: 'recruiter' },
};

/**
 * Login as a specific user role
 */
export async function loginAs(page: Page, role: 'admin' | 'recruiter') {
  const user = TEST_USERS[role];
  if (!user) {
    throw new Error(`Unknown test user role: ${role}`);
  }

  await page.goto('/auth');

  // Wait for page to be ready - try multiple selectors
  await page.waitForLoadState('networkidle');

  // Try to find the login form with various possible selectors
  const usernameSelectors = [
    '[data-testid="username"]',
    'input[name="username"]',
    'input[type="text"]:first-of-type',
    '#username',
  ];

  const passwordSelectors = [
    '[data-testid="password"]',
    'input[name="password"]',
    'input[type="password"]',
    '#password',
  ];

  let usernameInput = null;
  let passwordInput = null;

  // Find username input
  for (const selector of usernameSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
      usernameInput = element;
      break;
    }
  }

  // Find password input
  for (const selector of passwordSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
      passwordInput = element;
      break;
    }
  }

  if (!usernameInput || !passwordInput) {
    // Take a screenshot for debugging
    await page.screenshot({ path: `test-results/login-failed-${role}.png` });
    throw new Error(`Could not find login form elements for ${role}. Screenshot saved.`);
  }

  // Fill credentials
  await usernameInput.fill(user.username);
  await passwordInput.fill(user.password);

  // Submit form
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();

  // Wait for navigation away from auth page
  await page.waitForURL((url) => !url.pathname.includes('/auth'), {
    timeout: 10000,
  });
}

/**
 * Check if currently logged in as specific role
 */
export async function isLoggedInAs(page: Page, role: 'admin' | 'recruiter'): Promise<boolean> {
  try {
    const response = await page.request.get('/api/user');
    if (!response.ok()) return false;

    const user = await response.json();
    return user.role === role;
  } catch {
    return false;
  }
}

/**
 * Logout current user
 */
export async function logout(page: Page) {
  await page.request.post('/api/logout');
  await page.goto('/auth');
}

/**
 * Wait for API response and validate
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number; status?: number }
) {
  const { timeout = 10000, status = 200 } = options || {};

  const response = await page.waitForResponse(
    (resp) => {
      const matches = typeof urlPattern === 'string'
        ? resp.url().includes(urlPattern)
        : urlPattern.test(resp.url());
      return matches && resp.status() === status;
    },
    { timeout }
  );

  return response;
}

/**
 * Safe click that waits for element to be visible and enabled
 */
export async function safeClick(page: Page, selector: string, options?: { timeout?: number }) {
  const { timeout = 5000 } = options || {};
  const element = page.locator(selector);

  await element.waitFor({ state: 'visible', timeout });
  await element.waitFor({ state: 'attached', timeout });

  // Check if enabled (not disabled)
  const isDisabled = await element.isDisabled();
  if (isDisabled) {
    throw new Error(`Element ${selector} is disabled`);
  }

  await element.click();
}

/**
 * Fill form field with retry logic
 */
export async function safeFill(
  page: Page,
  selector: string,
  value: string,
  options?: { timeout?: number; clear?: boolean }
) {
  const { timeout = 5000, clear = true } = options || {};
  const element = page.locator(selector);

  await element.waitFor({ state: 'visible', timeout });

  if (clear) {
    await element.clear();
  }

  await element.fill(value);
}

/**
 * Navigate with retry on failure
 */
export async function navigateWithRetry(
  page: Page,
  url: string,
  options?: { retries?: number; timeout?: number }
) {
  const { retries = 3, timeout = 30000 } = options || {};

  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { timeout, waitUntil: 'networkidle' });
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, textPattern?: string | RegExp) {
  const toastSelector = '[data-testid="toast"], [role="alert"], .toast, .Toastify__toast';
  const toast = page.locator(toastSelector).first();

  await toast.waitFor({ state: 'visible', timeout: 5000 });

  if (textPattern) {
    if (typeof textPattern === 'string') {
      await expect(toast).toContainText(textPattern);
    } else {
      const text = await toast.textContent();
      expect(text).toMatch(textPattern);
    }
  }

  return toast;
}

/**
 * Take debug screenshot with context
 */
export async function debugScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `test-results/debug-${name}-${timestamp}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`Debug screenshot saved: ${path}`);
  return path;
}

/**
 * Ensure a candidate exists for a job (via recruiter-add API)
 * Returns the application ID if created, or null if already exists
 */
export async function ensureCandidateExists(
  page: Page,
  jobId: number
): Promise<number | null> {
  // First check if applications exist
  const applicationsResponse = await page.request.get(`/api/jobs/${jobId}/applications`);
  if (applicationsResponse.ok()) {
    const applications = await applicationsResponse.json();
    if (applications && applications.length > 0) {
      return applications[0].id;
    }
  }

  // Create a test candidate via recruiter-add API
  const timestamp = Date.now();
  const formData = new FormData();
  formData.append('name', `Test Candidate ${timestamp}`);
  formData.append('email', `test-candidate-${timestamp}@example.com`);
  formData.append('phone', '555-0100');
  formData.append('source', 'e2e-test');

  // Create a minimal PDF-like resume
  const resumeContent = Buffer.from('%PDF-1.4\nTest resume content for E2E testing');
  const resumeBlob = new Blob([resumeContent], { type: 'application/pdf' });
  formData.append('resume', resumeBlob, 'test-resume.pdf');

  try {
    // Get CSRF token first
    const csrfResponse = await page.request.get('/api/csrf-token');
    const csrfData = await csrfResponse.json().catch(() => ({}));
    const csrfToken = csrfData.csrfToken || '';

    const response = await page.request.post(`/api/jobs/${jobId}/applications/recruiter-add`, {
      multipart: {
        name: `Test Candidate ${timestamp}`,
        email: `test-candidate-${timestamp}@example.com`,
        phone: '555-0100',
        source: 'e2e-test',
        resume: {
          name: 'test-resume.pdf',
          mimeType: 'application/pdf',
          buffer: resumeContent,
        },
      },
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });

    if (response.ok()) {
      const result = await response.json();
      console.log(`✅ Created test candidate for job ${jobId}: application ${result.applicationId}`);
      return result.applicationId;
    } else {
      const error = await response.text();
      console.warn(`⚠️  Failed to create candidate: ${response.status()} - ${error}`);
      return null;
    }
  } catch (error) {
    console.warn(`⚠️  Error creating candidate: ${error}`);
    return null;
  }
}

/**
 * Get the seeded pipeline job ID from fixtures or environment
 */
export function getPipelineJobId(): number | null {
  const fixtures = loadFixtures();
  if (fixtures.pipelineJobId) return fixtures.pipelineJobId;
  if (process.env.TEST_PIPELINE_JOB_ID) return parseInt(process.env.TEST_PIPELINE_JOB_ID, 10);
  return null;
}
