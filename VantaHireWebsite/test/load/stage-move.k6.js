/**
 * K6 Load Test: Pipeline Stage Move Endpoint
 *
 * Tests the /api/applications/:id/stage endpoint under load
 * Simulates recruiters moving candidates through pipeline stages
 *
 * Run with: k6 run test/load/stage-move.k6.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const stageMoveSuccess = new Rate('stage_move_success');
const stageMoveDuration = new Trend('stage_move_duration');
const rateLimitHits = new Counter('rate_limit_hits');
const concurrentMoveConflicts = new Counter('concurrent_move_conflicts');

// Test configuration
export const options = {
  scenarios: {
    // Normal recruiter workflow
    steady_recruiters: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
    },
    // Burst scenario - many recruiters active at once
    burst_activity: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      startTime: '2m',
    },
    // Stress test
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      startTime: '4m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],  // 95% of requests < 1.5s
    http_req_failed: ['rate<0.05'],      // Less than 5% failure rate
    stage_move_success: ['rate>0.9'],    // 90% success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Typical pipeline stages (assuming these IDs exist)
const STAGES = [
  { id: 1, name: 'New' },
  { id: 2, name: 'Screening' },
  { id: 3, name: 'Interview' },
  { id: 4, name: 'Offer' },
  { id: 5, name: 'Hired' },
];

// Simulated recruiter session
let sessionCookie = null;

// Login as recruiter
function loginAsRecruiter() {
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({
      username: 'recruiter',
      password: 'recruiter123',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (res.status === 200 && res.cookies['connect.sid']) {
    sessionCookie = res.cookies['connect.sid'][0].value;
    return true;
  }
  return false;
}

// Get applications for a job
function getApplications(jobId) {
  const res = http.get(`${BASE_URL}/api/jobs/${jobId}/applications`, {
    headers: {
      Cookie: `connect.sid=${sessionCookie}`,
    },
  });

  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      return data.applications || data || [];
    } catch {
      return [];
    }
  }
  return [];
}

// Move application to a new stage
function moveToStage(applicationId, toStageId, notes = null) {
  const startTime = Date.now();

  const payload = {
    stageId: toStageId,
  };

  if (notes) {
    payload.notes = notes;
  }

  const res = http.patch(
    `${BASE_URL}/api/applications/${applicationId}/stage`,
    JSON.stringify(payload),
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `connect.sid=${sessionCookie}`,
      },
      timeout: '10s',
    }
  );

  const duration = Date.now() - startTime;
  stageMoveDuration.add(duration);

  return res;
}

export default function () {
  // Ensure we're logged in
  if (!sessionCookie) {
    group('Login', () => {
      const success = loginAsRecruiter();
      check(success, { 'login successful': (s) => s === true });
      if (!success) {
        console.error('Failed to login as recruiter');
        return;
      }
    });
  }

  group('Stage Move Operations', () => {
    // Get applications from a random job
    const jobId = randomIntBetween(1, 5);
    const applications = getApplications(jobId);

    if (applications.length === 0) {
      console.log(`No applications found for job ${jobId}`);
      sleep(1);
      return;
    }

    // Pick a random application
    const app = applications[randomIntBetween(0, applications.length - 1)];
    const currentStageId = app.currentStage || 1;

    // Move to next stage (or random stage for variety)
    let nextStageId;
    if (Math.random() > 0.7) {
      // Sometimes jump to a random stage
      nextStageId = STAGES[randomIntBetween(0, STAGES.length - 1)].id;
    } else {
      // Usually move to next stage
      const currentIndex = STAGES.findIndex((s) => s.id === currentStageId);
      nextStageId = STAGES[Math.min(currentIndex + 1, STAGES.length - 1)].id;
    }

    // Skip if already at target stage
    if (nextStageId === currentStageId) {
      sleep(0.5);
      return;
    }

    // Perform stage move
    const notes = Math.random() > 0.5 ? `Moved via load test at ${new Date().toISOString()}` : null;
    const res = moveToStage(app.id, nextStageId, notes);

    // Check results
    const success = check(res, {
      'stage move successful': (r) => [200, 204].includes(r.status),
      'response is valid': (r) => {
        if ([200, 204].includes(r.status)) {
          return true;
        }
        return false;
      },
    });

    stageMoveSuccess.add(success ? 1 : 0);

    // Track specific error types
    if (res.status === 429) {
      rateLimitHits.add(1);
      const retryAfter = res.headers['Retry-After'] || 'unknown';
      console.log(`Rate limited on stage move! Retry-After: ${retryAfter}`);
    }

    if (res.status === 409) {
      concurrentMoveConflicts.add(1);
      console.log('Concurrent modification conflict detected');
    }

    if (res.status >= 400 && res.status !== 429 && res.status !== 409) {
      console.log(`Stage move failed: ${res.status} - ${res.body}`);
    }
  });

  // Simulate think time between operations
  sleep(randomIntBetween(1, 3));
}

// Concurrent move test - multiple users trying to move same application
export function concurrentMoveTest() {
  if (!sessionCookie) {
    loginAsRecruiter();
  }

  // All VUs try to move the same application
  const targetApplicationId = 1;
  const targetStageId = randomIntBetween(1, 5);

  const res = moveToStage(targetApplicationId, targetStageId, 'Concurrent test');

  check(res, {
    'concurrent move handled': (r) => [200, 204, 409, 429].includes(r.status),
  });

  if (res.status === 409) {
    concurrentMoveConflicts.add(1);
  }

  sleep(0.1);
}

export function setup() {
  // Verify server and login
  const healthCheck = http.get(`${BASE_URL}/api/jobs`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not reachable: ${healthCheck.status}`);
  }

  // Test login works
  const loginRes = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({
      username: 'recruiter',
      password: 'recruiter123',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    console.warn('Login test failed - some tests may not work');
  }

  console.log('Stage move load test setup complete');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Stage move load test completed. Duration: ${duration}s`);
}
