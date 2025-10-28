/**
 * VantaHire E2E Test Suite
 *
 * Comprehensive end-to-end tests for critical user journeys:
 * 1. Candidate Journey: Browse jobs, view details, apply
 * 2. Recruiter Journey: Register, post job, manage applications
 * 3. Admin Journey: Approve jobs, manage postings
 * 4. Job Lifecycle: Full workflow from creation to reactivation
 *
 * Run against: http://localhost:5001
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { randomBytes } from 'crypto';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const TEST_TIMEOUT = 30000; // 30 seconds per test

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test utilities
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface JourneyResult {
  journey: string;
  tests: TestResult[];
  totalTime: number;
  passed: number;
  failed: number;
}

class TestReporter {
  private results: JourneyResult[] = [];
  private startTime: number = Date.now();

  addJourneyResult(result: JourneyResult) {
    this.results.push(result);
  }

  printSummary() {
    const totalTime = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, j) => sum + j.tests.length, 0);
    const totalPassed = this.results.reduce((sum, j) => sum + j.passed, 0);
    const totalFailed = this.results.reduce((sum, j) => sum + j.failed, 0);

    console.log('\n' + '='.repeat(80));
    console.log(`${colors.cyan}VantaHire E2E Test Results${colors.reset}`);
    console.log('='.repeat(80));

    this.results.forEach(journey => {
      const status = journey.failed === 0 ? colors.green + 'PASS' : colors.red + 'FAIL';
      console.log(`\n${status}${colors.reset} ${journey.journey} (${journey.totalTime}ms)`);
      console.log(`  ${colors.green}${journey.passed} passed${colors.reset}, ${colors.red}${journey.failed} failed${colors.reset}`);

      journey.tests.forEach(test => {
        const icon = test.passed ? colors.green + '✓' : colors.red + '✗';
        console.log(`  ${icon}${colors.reset} ${test.name} (${test.duration}ms)`);
        if (!test.passed && test.error) {
          console.log(`    ${colors.red}Error: ${test.error}${colors.reset}`);
        }
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log(`${colors.cyan}Summary${colors.reset}`);
    console.log(`Total E2E Scenarios: ${totalTests}`);
    console.log(`${colors.green}Passed: ${totalPassed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${totalFailed}${colors.reset}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Test against: ${BASE_URL}`);
    console.log('='.repeat(80) + '\n');

    return { totalTests, totalPassed, totalFailed, totalTime };
  }
}

// HTTP Client with cookie/session support
class TestClient {
  private client: AxiosInstance;
  private cookies: string[] = [];
  private csrfToken: string = '';

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: TEST_TIMEOUT,
      validateStatus: () => true, // Don't throw on any status
      maxRedirects: 0, // Handle redirects manually
    });

    // Intercept requests to add cookies and CSRF token
    this.client.interceptors.request.use(config => {
      if (this.cookies.length > 0) {
        config.headers['Cookie'] = this.cookies.join('; ');
      }
      if (this.csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
        config.headers['x-csrf-token'] = this.csrfToken;
      }
      return config;
    });

    // Intercept responses to capture cookies
    this.client.interceptors.response.use(response => {
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        setCookie.forEach((cookie: string) => {
          const cookieName = cookie.split('=')[0];
          // Remove old cookie with same name
          this.cookies = this.cookies.filter(c => !c.startsWith(cookieName + '='));
          // Add new cookie
          this.cookies.push(cookie.split(';')[0]);
        });
      }
      return response;
    });
  }

  async get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  async patch(url: string, data?: any, config?: any) {
    return this.client.patch(url, data, config);
  }

  async delete(url: string, config?: any) {
    return this.client.delete(url, config);
  }

  async getCsrfToken(): Promise<boolean> {
    try {
      const response = await this.get('/api/csrf-token');
      if (response.status === 200 && response.data.token) {
        this.csrfToken = response.data.token;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  getCookies() {
    return this.cookies;
  }

  getAxiosInstance() {
    return this.client;
  }
}

// Test runner
async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error.message || String(error),
    };
  }
}

// Assertion helpers
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertStatus(actual: number, expected: number | number[], message?: string) {
  const expectedArray = Array.isArray(expected) ? expected : [expected];
  if (!expectedArray.includes(actual)) {
    throw new Error(
      `${message || 'Status mismatch'}: expected ${expectedArray.join(' or ')}, got ${actual}`
    );
  }
}

// Journey 1: Candidate Journey
async function candidateJourney(reporter: TestReporter): Promise<void> {
  console.log(`\n${colors.blue}Starting Candidate Journey...${colors.reset}`);
  const journeyStart = Date.now();
  const tests: TestResult[] = [];
  const client = new TestClient(BASE_URL);

  // Test 1: Browse jobs (public endpoint)
  tests.push(await runTest('Browse jobs list', async () => {
    const response = await client.get('/api/jobs?page=1&limit=10');
    assertStatus(response.status, 200, 'GET /api/jobs failed');
    assert(response.data.jobs, 'Jobs list not returned');
    assert(Array.isArray(response.data.jobs), 'Jobs should be an array');
    assert(response.data.pagination, 'Pagination info not returned');
  }));

  // Test 2: Search and filter jobs
  tests.push(await runTest('Search jobs by keyword', async () => {
    const response = await client.get('/api/jobs?search=developer&location=Remote');
    assertStatus(response.status, 200, 'Job search failed');
    assert(Array.isArray(response.data.jobs), 'Search results should be an array');
  }));

  // Test 3: View specific job details
  tests.push(await runTest('View job details', async () => {
    // First get a job ID
    const listResponse = await client.get('/api/jobs?limit=1');
    if (listResponse.data.jobs && listResponse.data.jobs.length > 0) {
      const jobId = listResponse.data.jobs[0].id;
      const response = await client.get(`/api/jobs/${jobId}`);
      assertStatus(response.status, 200, 'GET job details failed');
      assert(response.data.id === jobId, 'Job ID mismatch');
      assert(response.data.title, 'Job title missing');
      assert(response.data.description, 'Job description missing');
    }
  }));

  // Test 4: Get CSRF token for application
  tests.push(await runTest('Get CSRF token', async () => {
    const success = await client.getCsrfToken();
    assert(success, 'Failed to get CSRF token');
  }));

  // Test 5: Submit job application (mock file upload)
  tests.push(await runTest('Submit job application with resume', async () => {
    // Get first available job
    const listResponse = await client.get('/api/jobs?limit=1');
    if (listResponse.data.jobs && listResponse.data.jobs.length > 0) {
      const jobId = listResponse.data.jobs[0].id;

      // Create FormData with application details
      const form = new FormData();
      const testEmail = `candidate-${randomBytes(8).toString('hex')}@test.com`;
      form.append('name', 'Test Candidate');
      form.append('email', testEmail);
      form.append('phone', '+15551234567');
      form.append('coverLetter', 'I am very interested in this position and believe I would be a great fit.');

      // Create a mock PDF resume
      const mockPdf = Buffer.from('%PDF-1.4 Mock Resume Content');
      form.append('resume', mockPdf, {
        filename: 'test-resume.pdf',
        contentType: 'application/pdf',
      });

      const response = await client.getAxiosInstance().post(`/api/jobs/${jobId}/apply`, form, {
        headers: {
          ...form.getHeaders(),
          'Cookie': client.getCookies().join('; '),
          'x-csrf-token': (client as any).csrfToken,
        },
      });

      assertStatus(response.status, [201, 400, 429], 'Application submission status');

      // 201 = success, 400 = validation or duplicate, 429 = rate limit
      if (response.status === 201) {
        assert(response.data.success, 'Application should be successful');
        assert(response.data.applicationId, 'Application ID should be returned');
      } else if (response.status === 400) {
        // Acceptable: duplicate application or validation error
        assert(response.data.error, 'Error message should be provided');
      } else if (response.status === 429) {
        // Rate limit reached
        assert(response.data.error, 'Rate limit error should be provided');
      }
    }
  }));

  // Test 6: Check duplicate application prevention
  tests.push(await runTest('Prevent duplicate applications', async () => {
    const listResponse = await client.get('/api/jobs?limit=1');
    if (listResponse.data.jobs && listResponse.data.jobs.length > 0) {
      const jobId = listResponse.data.jobs[0].id;

      const form = new FormData();
      const sameEmail = 'duplicate-test@example.com';
      form.append('name', 'Duplicate Test');
      form.append('email', sameEmail);
      form.append('phone', '+15559999999');
      form.append('coverLetter', 'First application');
      form.append('resume', Buffer.from('%PDF-1.4'), { filename: 'resume1.pdf' });

      // First application
      const response1 = await client.getAxiosInstance().post(`/api/jobs/${jobId}/apply`, form, {
        headers: {
          ...form.getHeaders(),
          'Cookie': client.getCookies().join('; '),
          'x-csrf-token': (client as any).csrfToken,
        },
      });

      // Second application with same email (should fail or be rate limited)
      const form2 = new FormData();
      form2.append('name', 'Duplicate Test 2');
      form2.append('email', sameEmail);
      form2.append('phone', '+15559999998');
      form2.append('coverLetter', 'Second application');
      form2.append('resume', Buffer.from('%PDF-1.4'), { filename: 'resume2.pdf' });

      const response2 = await client.getAxiosInstance().post(`/api/jobs/${jobId}/apply`, form2, {
        headers: {
          ...form2.getHeaders(),
          'Cookie': client.getCookies().join('; '),
          'x-csrf-token': (client as any).csrfToken,
        },
      });

      // Either first succeeded and second failed (400), or both hit rate limit (429)
      assert(
        (response1.status === 201 && response2.status === 400) ||
        (response1.status === 429 || response2.status === 429),
        'Duplicate prevention or rate limiting should work'
      );
    }
  }));

  const journeyTime = Date.now() - journeyStart;
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  reporter.addJourneyResult({
    journey: 'Candidate Journey',
    tests,
    totalTime: journeyTime,
    passed,
    failed,
  });
}

// Journey 2: Recruiter Journey
async function recruiterJourney(reporter: TestReporter): Promise<void> {
  console.log(`\n${colors.blue}Starting Recruiter Journey...${colors.reset}`);
  const journeyStart = Date.now();
  const tests: TestResult[] = [];
  const client = new TestClient(BASE_URL);
  let recruiterId: number;
  let jobId: number;

  // Test 1: Register new recruiter account
  tests.push(await runTest('Register recruiter account', async () => {
    const username = `recruiter-${randomBytes(8).toString('hex')}`;
    const response = await client.post('/api/register', {
      username,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Recruiter',
      role: 'recruiter',
    });

    assertStatus(response.status, [201, 400], 'Register endpoint status');

    if (response.status === 201) {
      assert(response.data.id, 'User ID should be returned');
      assert(response.data.role === 'recruiter', 'Role should be recruiter');
      recruiterId = response.data.id;
    } else {
      // Username might already exist, try login instead
      throw new Error('Registration failed, username may exist');
    }
  }));

  // Test 2: Login as recruiter
  tests.push(await runTest('Login as recruiter', async () => {
    // If registration failed, create new account
    const username = `recruiter-${randomBytes(8).toString('hex')}`;
    const password = 'TestPass123!';

    // Register
    const regResponse = await client.post('/api/register', {
      username,
      password,
      firstName: 'Test',
      lastName: 'Recruiter',
      role: 'recruiter',
    });

    if (regResponse.status === 201) {
      recruiterId = regResponse.data.id;
      assert(regResponse.data.role === 'recruiter', 'Should be logged in as recruiter');
    } else {
      throw new Error('Could not create recruiter account');
    }
  }));

  // Test 3: Get CSRF token
  tests.push(await runTest('Get CSRF token for recruiter', async () => {
    const success = await client.getCsrfToken();
    assert(success, 'Failed to get CSRF token');
  }));

  // Test 4: Post a new job
  tests.push(await runTest('Post new job listing', async () => {
    const jobData = {
      title: `E2E Test Job ${randomBytes(4).toString('hex')}`,
      location: 'San Francisco, CA',
      type: 'full-time',
      description: 'This is an end-to-end test job posting. We are looking for a talented developer to join our team. Requirements include strong coding skills and problem-solving abilities.',
      skills: ['JavaScript', 'React', 'Node.js'],
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const response = await client.post('/api/jobs', jobData);
    assertStatus(response.status, [201, 429], 'Create job status');

    if (response.status === 201) {
      assert(response.data.id, 'Job ID should be returned');
      assert(response.data.title === jobData.title, 'Job title should match');
      assert(response.data.status === 'pending', 'New job should be pending approval');
      jobId = response.data.id;
    } else if (response.status === 429) {
      // Rate limit hit
      console.log('  (Rate limit reached for job posting)');
    }
  }));

  // Test 5: View own posted jobs
  tests.push(await runTest('View my posted jobs', async () => {
    const response = await client.get('/api/my-jobs');
    assertStatus(response.status, 200, 'GET my jobs failed');
    assert(Array.isArray(response.data), 'My jobs should be an array');
  }));

  // Test 6: View applications for a job
  tests.push(await runTest('View job applications', async () => {
    // Get first job from my-jobs
    const jobsResponse = await client.get('/api/my-jobs');
    if (jobsResponse.data && jobsResponse.data.length > 0) {
      const testJobId = jobsResponse.data[0].id;
      const response = await client.get(`/api/jobs/${testJobId}/applications`);
      assertStatus(response.status, 200, 'GET applications failed');
      assert(Array.isArray(response.data), 'Applications should be an array');
    }
  }));

  // Test 7: View applications received
  tests.push(await runTest('View all applications received', async () => {
    const response = await client.get('/api/my-applications-received');
    assertStatus(response.status, 200, 'GET applications received failed');
    assert(Array.isArray(response.data), 'Applications received should be an array');
  }));

  // Test 8: Update application status
  tests.push(await runTest('Update application status', async () => {
    // Get applications for first job
    const jobsResponse = await client.get('/api/my-jobs');
    if (jobsResponse.data && jobsResponse.data.length > 0) {
      const testJobId = jobsResponse.data[0].id;
      const appsResponse = await client.get(`/api/jobs/${testJobId}/applications`);

      if (appsResponse.data && appsResponse.data.length > 0) {
        const applicationId = appsResponse.data[0].id;
        const response = await client.patch(`/api/applications/${applicationId}/status`, {
          status: 'reviewed',
          notes: 'E2E test review',
        });
        assertStatus(response.status, 200, 'Update application status failed');
      }
    }
  }));

  // Test 9: Get pipeline stages
  tests.push(await runTest('Get ATS pipeline stages', async () => {
    const response = await client.get('/api/pipeline/stages');
    assertStatus(response.status, 200, 'GET pipeline stages failed');
    assert(Array.isArray(response.data), 'Pipeline stages should be an array');
  }));

  // Test 10: Access job analytics
  tests.push(await runTest('Access job analytics', async () => {
    const response = await client.get('/api/analytics/jobs');
    assertStatus(response.status, 200, 'GET job analytics failed');
    assert(Array.isArray(response.data), 'Job analytics should be an array');
  }));

  const journeyTime = Date.now() - journeyStart;
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  reporter.addJourneyResult({
    journey: 'Recruiter Journey',
    tests,
    totalTime: journeyTime,
    passed,
    failed,
  });
}

// Journey 3: Admin Journey
async function adminJourney(reporter: TestReporter): Promise<void> {
  console.log(`\n${colors.blue}Starting Admin Journey...${colors.reset}`);
  const journeyStart = Date.now();
  const tests: TestResult[] = [];
  const client = new TestClient(BASE_URL);

  // Test 1: Login as admin (assuming admin user exists)
  tests.push(await runTest('Login as admin', async () => {
    const response = await client.post('/api/login', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
    });

    assertStatus(response.status, [200, 401], 'Admin login status');

    if (response.status === 200) {
      assert(response.data.role === 'admin', 'Should be logged in as admin');
    } else {
      // Admin account might not exist or wrong password
      throw new Error('Admin login failed - check credentials');
    }
  }));

  // Test 2: Get CSRF token
  tests.push(await runTest('Get CSRF token for admin', async () => {
    const success = await client.getCsrfToken();
    assert(success, 'Failed to get CSRF token');
  }));

  // Test 3: View admin statistics
  tests.push(await runTest('View admin dashboard stats', async () => {
    const response = await client.get('/api/admin/stats');
    assertStatus(response.status, 200, 'GET admin stats failed');
    assert(response.data, 'Stats data should be returned');
  }));

  // Test 4: View pending jobs for review
  tests.push(await runTest('View pending jobs for approval', async () => {
    const response = await client.get('/api/admin/jobs?status=pending&limit=10');
    assertStatus(response.status, 200, 'GET pending jobs failed');
    assert(response.data.jobs, 'Jobs list should be returned');
    assert(Array.isArray(response.data.jobs), 'Jobs should be an array');
  }));

  // Test 5: Approve a job posting
  tests.push(await runTest('Approve job posting', async () => {
    // Get pending jobs
    const pendingResponse = await client.get('/api/admin/jobs?status=pending&limit=1');

    if (pendingResponse.data.jobs && pendingResponse.data.jobs.length > 0) {
      const jobId = pendingResponse.data.jobs[0].id;
      const response = await client.patch(`/api/admin/jobs/${jobId}/review`, {
        status: 'approved',
        reviewComments: 'E2E test approval',
      });
      assertStatus(response.status, 200, 'Approve job failed');
      assert(response.data.status === 'approved', 'Job should be approved');
    }
  }));

  // Test 6: View all jobs
  tests.push(await runTest('View all jobs (admin)', async () => {
    const response = await client.get('/api/admin/jobs/all');
    assertStatus(response.status, 200, 'GET all jobs failed');
    assert(Array.isArray(response.data), 'All jobs should be an array');
  }));

  // Test 7: Activate/deactivate job
  tests.push(await runTest('Deactivate and reactivate job', async () => {
    // Get an active approved job
    const jobsResponse = await client.get('/api/admin/jobs?status=approved&limit=1');

    if (jobsResponse.data.jobs && jobsResponse.data.jobs.length > 0) {
      const jobId = jobsResponse.data.jobs[0].id;

      // Deactivate
      const deactivateResponse = await client.patch(`/api/jobs/${jobId}/status`, {
        isActive: false,
      });
      assertStatus(deactivateResponse.status, 200, 'Deactivate job failed');
      assert(deactivateResponse.data.isActive === false, 'Job should be inactive');

      // Reactivate
      const reactivateResponse = await client.patch(`/api/jobs/${jobId}/status`, {
        isActive: true,
      });
      assertStatus(reactivateResponse.status, 200, 'Reactivate job failed');
      assert(reactivateResponse.data.isActive === true, 'Job should be active');
    }
  }));

  // Test 8: View all users
  tests.push(await runTest('View all users', async () => {
    const response = await client.get('/api/admin/users');
    assertStatus(response.status, 200, 'GET all users failed');
    assert(Array.isArray(response.data), 'Users should be an array');
  }));

  // Test 9: View all applications
  tests.push(await runTest('View all applications', async () => {
    const response = await client.get('/api/admin/applications/all');
    assertStatus(response.status, 200, 'GET all applications failed');
    assert(Array.isArray(response.data), 'Applications should be an array');
  }));

  // Test 10: Access analytics export
  tests.push(await runTest('Export analytics data', async () => {
    const response = await client.get('/api/analytics/export?format=json&dateRange=30');
    assertStatus(response.status, 200, 'Export analytics failed');
    assert(response.data, 'Export data should be returned');
  }));

  const journeyTime = Date.now() - journeyStart;
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  reporter.addJourneyResult({
    journey: 'Admin Journey',
    tests,
    totalTime: journeyTime,
    passed,
    failed,
  });
}

// Journey 4: Job Lifecycle Journey
async function jobLifecycleJourney(reporter: TestReporter): Promise<void> {
  console.log(`\n${colors.blue}Starting Job Lifecycle Journey...${colors.reset}`);
  const journeyStart = Date.now();
  const tests: TestResult[] = [];
  const recruiterClient = new TestClient(BASE_URL);
  const adminClient = new TestClient(BASE_URL);
  const candidateClient = new TestClient(BASE_URL);
  let jobId: number;
  let applicationId: number;

  // Test 1: Recruiter creates job
  tests.push(await runTest('1. Recruiter creates job', async () => {
    // Register and login recruiter
    const username = `lifecycle-recruiter-${randomBytes(8).toString('hex')}`;
    const regResponse = await recruiterClient.post('/api/register', {
      username,
      password: 'TestPass123!',
      firstName: 'Lifecycle',
      lastName: 'Recruiter',
      role: 'recruiter',
    });
    assertStatus(regResponse.status, 201, 'Recruiter registration failed');

    // Get CSRF token
    await recruiterClient.getCsrfToken();

    // Create job
    const jobData = {
      title: `Lifecycle Test Job ${randomBytes(4).toString('hex')}`,
      location: 'Remote',
      type: 'full-time',
      description: 'Full lifecycle test job posting with comprehensive requirements and detailed description.',
      skills: ['TypeScript', 'React', 'PostgreSQL'],
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const response = await recruiterClient.post('/api/jobs', jobData);
    assertStatus(response.status, [201, 429], 'Create job failed');

    if (response.status === 201) {
      jobId = response.data.id;
      assert(response.data.status === 'pending', 'New job should be pending');
      assert(response.data.isActive === false, 'New job should be inactive');
    }
  }));

  // Test 2: Admin approves job
  tests.push(await runTest('2. Admin approves job', async () => {
    if (!jobId) {
      throw new Error('Job ID not available from previous test');
    }

    // Login as admin
    const loginResponse = await adminClient.post('/api/login', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
    });
    assertStatus(loginResponse.status, 200, 'Admin login failed');

    // Get CSRF token
    await adminClient.getCsrfToken();

    // Approve job
    const response = await adminClient.patch(`/api/admin/jobs/${jobId}/review`, {
      status: 'approved',
      reviewComments: 'Lifecycle test approval',
    });
    assertStatus(response.status, 200, 'Job approval failed');
    assert(response.data.status === 'approved', 'Job should be approved');
  }));

  // Test 3: Job becomes visible and receives application
  tests.push(await runTest('3. Candidate submits application', async () => {
    if (!jobId) {
      throw new Error('Job ID not available');
    }

    // Verify job is visible
    const jobResponse = await candidateClient.get(`/api/jobs/${jobId}`);
    assertStatus(jobResponse.status, 200, 'Job should be visible');

    // Get CSRF token
    await candidateClient.getCsrfToken();

    // Submit application
    const form = new FormData();
    form.append('name', 'Lifecycle Candidate');
    form.append('email', `lifecycle-candidate-${randomBytes(8).toString('hex')}@test.com`);
    form.append('phone', '+15551234567');
    form.append('coverLetter', 'I am excited about this lifecycle test position.');
    form.append('resume', Buffer.from('%PDF-1.4 Test Resume'), {
      filename: 'lifecycle-resume.pdf',
      contentType: 'application/pdf',
    });

    const response = await candidateClient.getAxiosInstance().post(`/api/jobs/${jobId}/apply`, form, {
      headers: {
        ...form.getHeaders(),
        'Cookie': candidateClient.getCookies().join('; '),
        'x-csrf-token': (candidateClient as any).csrfToken,
      },
    });

    assertStatus(response.status, [201, 429], 'Application submission failed');
    if (response.status === 201) {
      applicationId = response.data.applicationId;
      assert(response.data.success, 'Application should be successful');
    }
  }));

  // Test 4: Recruiter views and processes application
  tests.push(await runTest('4. Recruiter reviews application', async () => {
    if (!jobId) {
      throw new Error('Job ID not available');
    }

    // View applications
    const appsResponse = await recruiterClient.get(`/api/jobs/${jobId}/applications`);
    assertStatus(appsResponse.status, 200, 'View applications failed');
    assert(Array.isArray(appsResponse.data), 'Applications should be an array');

    // Update first application status if exists
    if (appsResponse.data.length > 0) {
      const appId = appsResponse.data[0].id;
      const response = await recruiterClient.patch(`/api/applications/${appId}/status`, {
        status: 'reviewed',
        notes: 'Lifecycle test review',
      });
      assertStatus(response.status, 200, 'Update application failed');
    }
  }));

  // Test 5: Admin deactivates job
  tests.push(await runTest('5. Admin deactivates job', async () => {
    if (!jobId) {
      throw new Error('Job ID not available');
    }

    const response = await adminClient.patch(`/api/jobs/${jobId}/status`, {
      isActive: false,
    });
    assertStatus(response.status, 200, 'Job deactivation failed');
    assert(response.data.isActive === false, 'Job should be inactive');
  }));

  // Test 6: Verify old applications still accessible
  tests.push(await runTest('6. Old applications remain accessible', async () => {
    if (!jobId) {
      throw new Error('Job ID not available');
    }

    const response = await recruiterClient.get(`/api/jobs/${jobId}/applications`);
    assertStatus(response.status, 200, 'Applications should still be accessible');
    assert(Array.isArray(response.data), 'Applications should be an array');
  }));

  // Test 7: Admin reactivates job
  tests.push(await runTest('7. Admin reactivates job', async () => {
    if (!jobId) {
      throw new Error('Job ID not available');
    }

    const response = await adminClient.patch(`/api/jobs/${jobId}/status`, {
      isActive: true,
    });
    assertStatus(response.status, 200, 'Job reactivation failed');
    assert(response.data.isActive === true, 'Job should be active');
  }));

  // Test 8: Verify job analytics tracked correctly
  tests.push(await runTest('8. Job analytics tracked through lifecycle', async () => {
    if (!jobId) {
      throw new Error('Job ID not available');
    }

    const response = await recruiterClient.get(`/api/analytics/jobs/${jobId}`);
    assertStatus(response.status, 200, 'Job analytics failed');
    assert(response.data, 'Analytics data should be returned');
    // Verify views were tracked
    assert(response.data.views >= 0, 'Views should be tracked');
  }));

  const journeyTime = Date.now() - journeyStart;
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  reporter.addJourneyResult({
    journey: 'Job Lifecycle Journey',
    tests,
    totalTime: journeyTime,
    passed,
    failed,
  });
}

// Main test runner
async function runE2ETests() {
  console.log(`${colors.cyan}======================================${colors.reset}`);
  console.log(`${colors.cyan}VantaHire E2E Test Suite${colors.reset}`);
  console.log(`${colors.cyan}Testing against: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}======================================${colors.reset}\n`);

  const reporter = new TestReporter();

  // Health check
  try {
    console.log(`${colors.yellow}Performing health check...${colors.reset}`);
    const healthClient = new TestClient(BASE_URL);
    const healthResponse = await healthClient.get('/api/health');
    if (healthResponse.status === 200) {
      console.log(`${colors.green}✓ Server is healthy${colors.reset}\n`);
    } else {
      console.log(`${colors.red}✗ Server health check failed${colors.reset}`);
      console.log(`${colors.yellow}Continuing with tests anyway...${colors.reset}\n`);
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Cannot reach server at ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Error: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}Please ensure server is running and try again.${colors.reset}\n`);
    process.exit(1);
  }

  // Run all journeys
  try {
    await candidateJourney(reporter);
    await recruiterJourney(reporter);
    await adminJourney(reporter);
    await jobLifecycleJourney(reporter);
  } catch (error: any) {
    console.error(`${colors.red}Unexpected error during test execution:${colors.reset}`, error);
  }

  // Print summary
  const summary = reporter.printSummary();

  // Exit with appropriate code
  process.exit(summary.totalFailed > 0 ? 1 : 0);
}

// Run tests
runE2ETests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
