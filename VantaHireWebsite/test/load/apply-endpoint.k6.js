/**
 * K6 Load Test: Job Application Endpoint
 *
 * Tests the /api/jobs/:id/apply endpoint under load
 *
 * Run with: k6 run test/load/apply-endpoint.k6.js
 * Or with options: k6 run --vus 50 --duration 30s test/load/apply-endpoint.k6.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const applicationSuccess = new Rate('application_success');
const applicationDuration = new Trend('application_duration');
const rateLimitHits = new Counter('rate_limit_hits');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 25 },   // Ramp up to 25 users
    { duration: '2m', target: 25 },   // Stay at 25 users
    { duration: '30s', target: 50 },  // Spike to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be < 2s
    http_req_failed: ['rate<0.1'],     // Less than 10% failure rate
    application_success: ['rate>0.8'], // 80% success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Generate realistic application data
function generateApplication() {
  const firstName = randomString(8);
  const lastName = randomString(10);
  const domain = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'][randomIntBetween(0, 3)];

  return {
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    phone: `+1${randomIntBetween(2000000000, 9999999999)}`,
    coverLetter: `I am very interested in this position. I have ${randomIntBetween(2, 15)} years of experience in the field. ${randomString(100)}`,
  };
}

// Helper to create form data with file
function createFormData(application) {
  const fd = new FormData();
  fd.append('name', application.name);
  fd.append('email', application.email);
  fd.append('phone', application.phone);
  fd.append('coverLetter', application.coverLetter);

  // Simulate resume file
  const resumeContent = `Resume for ${application.name}\n\nExperience:\n- Software Developer\n- ${randomString(500)}`;
  fd.append('resume', http.file(resumeContent, 'resume.pdf', 'application/pdf'));

  return fd;
}

export default function () {
  // Get list of jobs first
  group('Get Jobs', () => {
    const jobsRes = http.get(`${BASE_URL}/api/jobs?limit=10`);
    check(jobsRes, {
      'jobs list status 200': (r) => r.status === 200,
    });
  });

  // Apply to a job
  group('Submit Application', () => {
    const jobId = randomIntBetween(1, 10); // Assuming jobs 1-10 exist
    const application = generateApplication();

    const startTime = Date.now();

    const res = http.post(
      `${BASE_URL}/api/jobs/${jobId}/apply`,
      JSON.stringify(application),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: '30s',
      }
    );

    const duration = Date.now() - startTime;
    applicationDuration.add(duration);

    // Check response
    const success = check(res, {
      'application status 201 or 200': (r) => [200, 201].includes(r.status),
      'response has application id': (r) => {
        if (r.status === 201 || r.status === 200) {
          try {
            const body = JSON.parse(r.body);
            return body.id !== undefined || body.applicationId !== undefined;
          } catch {
            return false;
          }
        }
        return true; // Don't fail for non-success responses
      },
    });

    applicationSuccess.add(success ? 1 : 0);

    // Track rate limiting
    if (res.status === 429) {
      rateLimitHits.add(1);
      console.log(`Rate limited! Retry-After: ${res.headers['Retry-After']}`);
    }

    // Check for validation errors
    if (res.status === 400) {
      console.log(`Validation error: ${res.body}`);
    }
  });

  // Simulate user think time
  sleep(randomIntBetween(1, 3));
}

// Setup - runs once at the start
export function setup() {
  // Verify the server is reachable
  const res = http.get(`${BASE_URL}/api/jobs`);
  if (res.status !== 200) {
    throw new Error(`Server not reachable. Status: ${res.status}`);
  }

  console.log('Load test setup complete. Server is reachable.');

  return {
    startTime: Date.now(),
  };
}

// Teardown - runs once at the end
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed. Total duration: ${duration}s`);
}
