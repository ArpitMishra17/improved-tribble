/**
 * K6 Load Test: Bulk Form Invitation Endpoint
 *
 * Tests the /api/forms/invitations/external endpoint under load
 * Simulates admins/recruiters sending bulk form invitations
 *
 * Run with: k6 run test/load/bulk-invite.k6.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const inviteSuccess = new Rate('invite_success');
const inviteDuration = new Trend('invite_duration');
const rateLimitHits = new Counter('rate_limit_hits');
const quotaExceeded = new Counter('quota_exceeded');
const batchInviteSuccess = new Rate('batch_invite_success');

// Test configuration
export const options = {
  scenarios: {
    // Single invite requests
    single_invites: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      exec: 'singleInviteTest',
    },
    // Bulk invite simulation (sequential invites)
    bulk_invites: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 10,
      exec: 'bulkInviteTest',
      startTime: '2m',
    },
    // Rate limit stress test
    rate_limit_test: {
      executor: 'constant-arrival-rate',
      rate: 20, // 20 requests per second
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 30,
      maxVUs: 50,
      exec: 'rateLimitStressTest',
      startTime: '4m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],   // 95% of requests < 3s
    http_req_failed: ['rate<0.2'],        // Less than 20% failure (includes rate limits)
    invite_success: ['rate>0.7'],         // 70% success rate (accounting for rate limits)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

let sessionCookie = null;
let csrfToken = null;

// Login as admin/recruiter
function login() {
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({
      username: 'admin',
      password: 'admin123',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (res.status === 200) {
    if (res.cookies['connect.sid']) {
      sessionCookie = res.cookies['connect.sid'][0].value;
    }
    // Extract CSRF token if present
    try {
      const body = JSON.parse(res.body);
      csrfToken = body.csrfToken || null;
    } catch {
      // Ignore parse errors
    }
    return true;
  }
  return false;
}

// Generate random email
function generateEmail() {
  const name = randomString(8).toLowerCase();
  const domain = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com'][randomIntBetween(0, 3)];
  return `${name}@${domain}`;
}

// Send single form invitation
function sendInvitation(formId, email) {
  const startTime = Date.now();

  const headers = {
    'Content-Type': 'application/json',
    Cookie: `connect.sid=${sessionCookie}`,
  };

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = http.post(
    `${BASE_URL}/api/forms/invitations/external`,
    JSON.stringify({
      formId: formId,
      email: email,
    }),
    {
      headers,
      timeout: '15s',
    }
  );

  const duration = Date.now() - startTime;
  inviteDuration.add(duration);

  return res;
}

// Get invitation quota
function getQuota() {
  const res = http.get(`${BASE_URL}/api/forms/invitations/quota`, {
    headers: {
      Cookie: `connect.sid=${sessionCookie}`,
    },
  });

  if (res.status === 200) {
    try {
      return JSON.parse(res.body);
    } catch {
      return null;
    }
  }
  return null;
}

// Single invite test scenario
export function singleInviteTest() {
  if (!sessionCookie) {
    group('Login', () => {
      const success = login();
      check(success, { 'login successful': (s) => s === true });
      if (!success) {
        console.error('Failed to login');
        return;
      }
    });
  }

  group('Send Single Invitation', () => {
    const formId = randomIntBetween(1, 3); // Assuming forms 1-3 exist
    const email = generateEmail();

    const res = sendInvitation(formId, email);

    const success = check(res, {
      'invite created': (r) => [200, 201].includes(r.status),
      'response has invitation data': (r) => {
        if ([200, 201].includes(r.status)) {
          try {
            const body = JSON.parse(r.body);
            return body.id !== undefined || body.token !== undefined;
          } catch {
            return false;
          }
        }
        return true;
      },
    });

    inviteSuccess.add(success ? 1 : 0);

    // Track rate limiting
    if (res.status === 429) {
      rateLimitHits.add(1);
      const remaining = res.headers['X-RateLimit-Remaining'] || 'unknown';
      console.log(`Rate limited! Remaining: ${remaining}`);
    }

    // Track quota exceeded
    if (res.status === 403 && res.body && res.body.includes('quota')) {
      quotaExceeded.add(1);
      console.log('Quota exceeded!');
    }
  });

  sleep(randomIntBetween(1, 3));
}

// Bulk invite test scenario - simulates sending to multiple emails
export function bulkInviteTest() {
  if (!sessionCookie) {
    const success = login();
    if (!success) {
      console.error('Failed to login for bulk invite');
      return;
    }
  }

  group('Bulk Invite Batch', () => {
    // Check quota first
    const quota = getQuota();
    if (quota && quota.remaining <= 0) {
      console.log('No quota remaining, skipping bulk invite');
      quotaExceeded.add(1);
      return;
    }

    const formId = randomIntBetween(1, 3);
    const batchSize = randomIntBetween(3, 10);
    const emails = [];

    for (let i = 0; i < batchSize; i++) {
      emails.push(generateEmail());
    }

    let successCount = 0;
    let failCount = 0;

    // Send invitations sequentially (like the UI does)
    for (const email of emails) {
      const res = sendInvitation(formId, email);

      if ([200, 201].includes(res.status)) {
        successCount++;
      } else {
        failCount++;

        if (res.status === 429) {
          rateLimitHits.add(1);
          // Back off on rate limit
          sleep(2);
        }

        if (res.status === 403) {
          quotaExceeded.add(1);
          break; // Stop if quota exceeded
        }
      }

      // Small delay between sends
      sleep(0.2);
    }

    const batchSuccess = successCount > failCount;
    batchInviteSuccess.add(batchSuccess ? 1 : 0);

    console.log(`Bulk batch complete: ${successCount}/${batchSize} successful`);
  });

  sleep(randomIntBetween(2, 5));
}

// Rate limit stress test
export function rateLimitStressTest() {
  if (!sessionCookie) {
    login();
  }

  const formId = 1;
  const email = generateEmail();
  const res = sendInvitation(formId, email);

  check(res, {
    'request completed': (r) => r.status !== 0,
    'rate limit has remaining header': (r) => {
      if (r.status === 429) {
        return r.headers['X-RateLimit-Remaining'] !== undefined;
      }
      return true;
    },
  });

  if (res.status === 429) {
    rateLimitHits.add(1);
  } else if ([200, 201].includes(res.status)) {
    inviteSuccess.add(1);
  }
}

// Concurrent quota check test
export function concurrentQuotaTest() {
  if (!sessionCookie) {
    login();
  }

  // Multiple VUs check quota simultaneously
  const quota = getQuota();

  check(quota, {
    'quota retrieved': (q) => q !== null,
    'quota has expected fields': (q) => {
      if (q) {
        return q.limit !== undefined && q.used !== undefined && q.remaining !== undefined;
      }
      return false;
    },
  });
}

export function setup() {
  // Verify server
  const healthCheck = http.get(`${BASE_URL}/api/jobs`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not reachable: ${healthCheck.status}`);
  }

  // Test login
  const loginRes = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({ username: 'admin', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    console.warn('Admin login test failed');
  }

  // Check if forms endpoint exists
  const formsCheck = http.get(`${BASE_URL}/api/forms/templates`, {
    headers: {
      Cookie: loginRes.cookies['connect.sid']
        ? `connect.sid=${loginRes.cookies['connect.sid'][0].value}`
        : '',
    },
  });

  if (formsCheck.status !== 200) {
    console.warn('Forms endpoint may not be accessible');
  }

  console.log('Bulk invite load test setup complete');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Bulk invite load test completed. Duration: ${duration}s`);
}

// Helper to run all scenarios manually
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'test/load/results/bulk-invite-summary.json': JSON.stringify(data),
  };
}

// Custom text summary (K6 built-in)
function textSummary(data, options) {
  const indent = options.indent || '  ';
  let output = '\n=== Bulk Invite Load Test Summary ===\n\n';

  // Key metrics
  output += `${indent}Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Request Duration (p95): ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
  output += `${indent}Invite Success Rate: ${((data.metrics.invite_success?.values?.rate || 0) * 100).toFixed(1)}%\n`;
  output += `${indent}Rate Limit Hits: ${data.metrics.rate_limit_hits?.values?.count || 0}\n`;
  output += `${indent}Quota Exceeded: ${data.metrics.quota_exceeded?.values?.count || 0}\n`;

  return output;
}
