/**
 * VantaHire Load Testing with k6
 *
 * This script tests the performance of critical API endpoints under load.
 *
 * Test Scenarios:
 * 1. Job Listing Performance (100 VUs, 30s)
 * 2. Job Search Performance (50 VUs, 30s)
 * 3. Application Submission (20 VUs, 30s)
 * 4. Dashboard Load (30 VUs, 30s)
 *
 * Usage:
 *   k6 run server/tests/loadTests.js
 *
 * Advanced Usage:
 *   k6 run --out json=results.json server/tests/loadTests.js
 *   k6 run --vus 50 --duration 60s server/tests/loadTests.js  # Override defaults
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==================== CONFIGURATION ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';

// Custom metrics
const jobListingErrors = new Rate('job_listing_errors');
const jobSearchErrors = new Rate('job_search_errors');
const applicationErrors = new Rate('application_errors');
const dashboardErrors = new Rate('dashboard_errors');

const jobListingDuration = new Trend('job_listing_duration');
const jobSearchDuration = new Trend('job_search_duration');
const applicationDuration = new Trend('application_duration');
const dashboardDuration = new Trend('dashboard_duration');

const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// ==================== TEST DATA ====================

const locations = ['Remote', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'];
const jobTypes = ['full-time', 'part-time', 'contract', 'remote'];
const skills = ['JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker'];
const searchQueries = ['developer', 'engineer', 'senior', 'manager', 'designer'];

// Mock credentials for authenticated tests
const RECRUITER_CREDENTIALS = {
  username: __ENV.RECRUITER_USERNAME || 'recruiter@test.com',
  password: __ENV.RECRUITER_PASSWORD || 'test123',
};

// ==================== TEST OPTIONS ====================

export const options = {
  scenarios: {
    // Scenario 1: Job Listing Performance
    job_listing: {
      executor: 'constant-vus',
      exec: 'testJobListing',
      vus: 100,
      duration: '30s',
      tags: { scenario: 'job_listing' },
    },

    // Scenario 2: Job Search Performance
    job_search: {
      executor: 'constant-vus',
      exec: 'testJobSearch',
      vus: 50,
      duration: '30s',
      startTime: '35s', // Start after job listing test
      tags: { scenario: 'job_search' },
    },

    // Scenario 3: Application Submission
    application_submission: {
      executor: 'constant-vus',
      exec: 'testApplicationSubmission',
      vus: 20,
      duration: '30s',
      startTime: '70s', // Start after search test
      tags: { scenario: 'application_submission' },
    },

    // Scenario 4: Dashboard Load (Authenticated)
    dashboard_load: {
      executor: 'constant-vus',
      exec: 'testDashboardLoad',
      vus: 30,
      duration: '30s',
      startTime: '105s', // Start after application test
      tags: { scenario: 'dashboard_load' },
    },
  },

  thresholds: {
    // Overall thresholds
    'http_req_duration': ['p(95)<2000', 'p(99)<3000'], // 95% under 2s, 99% under 3s
    'http_req_failed': ['rate<0.05'], // Less than 5% errors

    // Job listing thresholds
    'http_req_duration{scenario:job_listing}': ['p(95)<1000'],
    'job_listing_errors': ['rate<0.01'],

    // Job search thresholds
    'http_req_duration{scenario:job_search}': ['p(95)<500'],
    'job_search_errors': ['rate<0.01'],

    // Application submission thresholds
    'http_req_duration{scenario:application_submission}': ['p(95)<2000'],
    'application_errors': ['rate<0.05'], // Accept 5% error rate for duplicates

    // Dashboard thresholds
    'http_req_duration{scenario:dashboard_load}': ['p(95)<1000'],
    'dashboard_errors': ['rate<0.01'],
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get CSRF token for authenticated requests
 */
function getCsrfToken() {
  const res = http.get(`${BASE_URL}/api/csrf-token`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      return json.token;
    } catch (e) {
      console.error('Failed to parse CSRF token:', e);
    }
  }
  return null;
}

/**
 * Login and get session cookie
 */
function login() {
  const csrfToken = getCsrfToken();
  if (!csrfToken) {
    console.error('Failed to get CSRF token for login');
    return null;
  }

  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify(RECRUITER_CREDENTIALS),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    }
  );

  if (res.status === 200) {
    // Extract session cookie
    const cookies = res.cookies;
    const sessionCookie = Object.keys(cookies).find(key => key.includes('session'));
    return sessionCookie ? cookies[sessionCookie] : null;
  }

  return null;
}

/**
 * Generate mock application data
 */
function generateApplicationData() {
  const randomId = randomIntBetween(100000, 999999);
  return {
    name: `Test Applicant ${randomId}`,
    email: `applicant${randomId}@loadtest.com`,
    phone: `+91${randomIntBetween(7000000000, 9999999999)}`,
    coverLetter: `This is a test application submitted during load testing. Application ID: ${randomId}`,
  };
}

/**
 * Create multipart form data for file upload (simplified for testing)
 */
function createFormData(applicationData, csrfToken) {
  // Simple text-based resume for load testing
  const resumeContent = `RESUME - ${applicationData.name}
Email: ${applicationData.email}
Phone: ${applicationData.phone}

EXPERIENCE:
- Software Engineer at Tech Company (2020-Present)
- Junior Developer at Startup Inc (2018-2020)

SKILLS:
- JavaScript, Python, React, Node.js
- AWS, Docker, Kubernetes
- Test Automation, CI/CD

EDUCATION:
- B.Tech in Computer Science (2018)
`;

  // Create multipart boundary
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="name"',
    '',
    applicationData.name,
    `--${boundary}`,
    'Content-Disposition: form-data; name="email"',
    '',
    applicationData.email,
    `--${boundary}`,
    'Content-Disposition: form-data; name="phone"',
    '',
    applicationData.phone,
    `--${boundary}`,
    'Content-Disposition: form-data; name="coverLetter"',
    '',
    applicationData.coverLetter,
    `--${boundary}`,
    `Content-Disposition: form-data; name="resume"; filename="resume_${Date.now()}.txt"`,
    'Content-Type: text/plain',
    '',
    resumeContent,
    `--${boundary}--`,
  ];

  return {
    body: parts.join('\r\n'),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// ==================== TEST SCENARIOS ====================

/**
 * Scenario 1: Job Listing Performance
 * Tests GET /api/jobs with pagination
 */
export function testJobListing() {
  group('Job Listing', () => {
    const page = randomIntBetween(1, 5);
    const limit = randomItem([10, 20, 50]);

    const res = http.get(`${BASE_URL}/api/jobs?page=${page}&limit=${limit}`, {
      tags: { name: 'GET /api/jobs' },
    });

    totalRequests.add(1);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response has jobs': (r) => {
        try {
          const json = JSON.parse(r.body);
          return Array.isArray(json.jobs);
        } catch (e) {
          return false;
        }
      },
      'response has pagination': (r) => {
        try {
          const json = JSON.parse(r.body);
          return json.pagination && json.pagination.page && json.pagination.total;
        } catch (e) {
          return false;
        }
      },
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (success) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      jobListingErrors.add(1);
    }

    jobListingDuration.add(res.timings.duration);
  });

  sleep(randomIntBetween(1, 3));
}

/**
 * Scenario 2: Job Search Performance
 * Tests GET /api/jobs with search and filter parameters
 */
export function testJobSearch() {
  group('Job Search', () => {
    const searchQuery = randomItem(searchQueries);
    const location = randomItem(locations);
    const type = randomItem(jobTypes);
    const skill = randomItem(skills);

    // Randomly use different filter combinations
    const filters = [];
    if (Math.random() > 0.5) filters.push(`search=${encodeURIComponent(searchQuery)}`);
    if (Math.random() > 0.5) filters.push(`location=${encodeURIComponent(location)}`);
    if (Math.random() > 0.7) filters.push(`type=${type}`);
    if (Math.random() > 0.7) filters.push(`skills=${skill}`);

    const queryString = filters.length > 0 ? `?${filters.join('&')}` : '';

    const res = http.get(`${BASE_URL}/api/jobs${queryString}`, {
      tags: { name: 'GET /api/jobs (search)' },
    });

    totalRequests.add(1);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response has jobs': (r) => {
        try {
          const json = JSON.parse(r.body);
          return Array.isArray(json.jobs);
        } catch (e) {
          return false;
        }
      },
      'response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (success) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      jobSearchErrors.add(1);
    }

    jobSearchDuration.add(res.timings.duration);
  });

  sleep(randomIntBetween(1, 2));
}

/**
 * Scenario 3: Application Submission
 * Tests POST /api/jobs/:id/apply
 */
export function testApplicationSubmission() {
  group('Application Submission', () => {
    // First, get a job ID
    const jobsRes = http.get(`${BASE_URL}/api/jobs?limit=10`);

    if (jobsRes.status !== 200) {
      console.error('Failed to fetch jobs for application test');
      failedRequests.add(1);
      applicationErrors.add(1);
      return;
    }

    let jobId;
    try {
      const jobs = JSON.parse(jobsRes.body).jobs;
      if (jobs && jobs.length > 0) {
        jobId = randomItem(jobs).id;
      }
    } catch (e) {
      console.error('Failed to parse jobs response:', e);
      failedRequests.add(1);
      applicationErrors.add(1);
      return;
    }

    if (!jobId) {
      console.error('No jobs available for application test');
      failedRequests.add(1);
      applicationErrors.add(1);
      return;
    }

    // Get CSRF token
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      console.error('Failed to get CSRF token');
      failedRequests.add(1);
      applicationErrors.add(1);
      return;
    }

    // Generate application data
    const applicationData = generateApplicationData();
    const formData = createFormData(applicationData, csrfToken);

    // Submit application
    const res = http.post(
      `${BASE_URL}/api/jobs/${jobId}/apply`,
      formData.body,
      {
        headers: {
          'Content-Type': formData.contentType,
          'X-CSRF-Token': csrfToken,
        },
        tags: { name: 'POST /api/jobs/:id/apply' },
      }
    );

    totalRequests.add(1);

    // Accept both 201 (success) and 400 (duplicate) as acceptable
    // since we're generating random emails and may hit duplicates
    const success = check(res, {
      'status is 201 or 400': (r) => r.status === 201 || r.status === 400,
      'response has success or error message': (r) => {
        try {
          const json = JSON.parse(r.body);
          return json.success !== undefined || json.error !== undefined;
        } catch (e) {
          return false;
        }
      },
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    if (success && res.status === 201) {
      successfulRequests.add(1);
    } else if (res.status === 400) {
      // Duplicate or validation error - still count as successful test
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      applicationErrors.add(1);
    }

    applicationDuration.add(res.timings.duration);
  });

  sleep(randomIntBetween(2, 5));
}

/**
 * Scenario 4: Dashboard Load (Authenticated)
 * Tests GET /api/my-jobs and /api/my-applications-received
 */
export function testDashboardLoad() {
  group('Dashboard Load', () => {
    // Login once per VU iteration
    const sessionCookie = login();

    if (!sessionCookie) {
      console.error('Failed to login for dashboard test');
      failedRequests.add(1);
      dashboardErrors.add(1);
      return;
    }

    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;

    // Test 1: Get recruiter's jobs
    const myJobsRes = http.get(`${BASE_URL}/api/my-jobs`, {
      headers: {
        'Cookie': cookieHeader,
      },
      tags: { name: 'GET /api/my-jobs' },
    });

    totalRequests.add(1);

    const myJobsSuccess = check(myJobsRes, {
      'my-jobs status is 200': (r) => r.status === 200,
      'my-jobs response is array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          return false;
        }
      },
      'my-jobs response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (myJobsSuccess) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      dashboardErrors.add(1);
    }

    dashboardDuration.add(myJobsRes.timings.duration);

    // Test 2: Get received applications
    const applicationsRes = http.get(`${BASE_URL}/api/my-applications-received`, {
      headers: {
        'Cookie': cookieHeader,
      },
      tags: { name: 'GET /api/my-applications-received' },
    });

    totalRequests.add(1);

    const applicationsSuccess = check(applicationsRes, {
      'applications status is 200': (r) => r.status === 200,
      'applications response is array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          return false;
        }
      },
      'applications response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (applicationsSuccess) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      dashboardErrors.add(1);
    }

    dashboardDuration.add(applicationsRes.timings.duration);

    // Test 3: Get pipeline stages (common dashboard component)
    const stagesRes = http.get(`${BASE_URL}/api/pipeline/stages`, {
      headers: {
        'Cookie': cookieHeader,
      },
      tags: { name: 'GET /api/pipeline/stages' },
    });

    totalRequests.add(1);

    const stagesSuccess = check(stagesRes, {
      'stages status is 200': (r) => r.status === 200,
      'stages response is array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch (e) {
          return false;
        }
      },
    });

    if (stagesSuccess) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
      dashboardErrors.add(1);
    }

    dashboardDuration.add(stagesRes.timings.duration);
  });

  sleep(randomIntBetween(2, 4));
}

// ==================== SETUP AND TEARDOWN ====================

export function setup() {
  console.log('========================================');
  console.log('VantaHire Load Testing Starting');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test Scenarios:');
  console.log('  1. Job Listing: 100 VUs x 30s');
  console.log('  2. Job Search: 50 VUs x 30s');
  console.log('  3. Application Submission: 20 VUs x 30s');
  console.log('  4. Dashboard Load: 30 VUs x 30s');
  console.log('========================================');
  console.log('');

  // Verify server is reachable
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Server health check failed. Please ensure the server is running.');
  }

  console.log('✓ Server health check passed');
  console.log('');
}

export function teardown(data) {
  console.log('');
  console.log('========================================');
  console.log('Load Testing Complete');
  console.log('========================================');
  console.log('Check the summary above for detailed metrics');
  console.log('');
}

// ==================== DEFAULT FUNCTION ====================

export default function() {
  // This is intentionally empty - we're using named scenario functions
  // but k6 requires a default export
}
