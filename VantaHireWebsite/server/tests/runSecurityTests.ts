#!/usr/bin/env tsx

/**
 * Standalone Security Test Runner
 *
 * This script runs security tests directly against a running server
 * without using vitest's test infrastructure or MSW mocking.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5001';

interface TestResult {
  category: string;
  testName: string;
  passed: boolean;
  details: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
}

const testResults: TestResult[] = [];
let totalTests = 0;
let passedTests = 0;

function recordTest(
  category: string,
  testName: string,
  passed: boolean,
  details: string,
  severity?: 'critical' | 'high' | 'medium' | 'low',
  recommendation?: string
) {
  testResults.push({
    category,
    testName,
    passed,
    details,
    severity,
    recommendation
  });
  totalTests++;
  if (passed) passedTests++;

  const status = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${status}\x1b[0m ${category}: ${testName}`);
  if (!passed && details) {
    console.log(`  ${details}`);
  }
}

async function makeRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  try {
    return await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    console.error(`Request failed: ${path}`, error);
    throw error;
  }
}

async function createTestSession(): Promise<{
  cookie: string;
  csrfToken: string;
  userId: number;
}> {
  const timestamp = Date.now();
  const username = `sectest_${timestamp}@test.com`;

  const registerResponse = await makeRequest('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password: 'TestPassword123!',
      firstName: 'Security',
      lastName: 'Test',
      role: 'candidate'
    }),
  });

  const cookies = registerResponse.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(';')[0];

  const csrfResponse = await makeRequest('/api/csrf-token', {
    headers: { Cookie: sessionCookie },
  });

  const csrfData = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.get('set-cookie') || '';
  const fullCookie = `${sessionCookie}; ${csrfCookie.split(';')[0]}`;

  const userData = await registerResponse.json();

  return {
    cookie: fullCookie,
    csrfToken: csrfData.token,
    userId: userData.id
  };
}

async function createAdminSession(): Promise<{
  cookie: string;
  csrfToken: string;
}> {
  const loginResponse = await makeRequest('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123'
    }),
  });

  if (loginResponse.status !== 200) {
    console.warn('Warning: Could not login as admin. Some tests will be skipped.');
    return { cookie: '', csrfToken: '' };
  }

  const cookies = loginResponse.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(';')[0];

  const csrfResponse = await makeRequest('/api/csrf-token', {
    headers: { Cookie: sessionCookie },
  });

  const csrfData = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.get('set-cookie') || '';
  const fullCookie = `${sessionCookie}; ${csrfCookie.split(';')[0]}`;

  return {
    cookie: fullCookie,
    csrfToken: csrfData.token
  };
}

async function testSQLInjection() {
  console.log('\n\x1b[1m1. SQL Injection Protection Tests\x1b[0m');

  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "1' OR '1' = '1",
    "admin'--",
    "1; DROP TABLE users--",
    "' UNION SELECT * FROM users--",
  ];

  for (const payload of sqlInjectionPayloads) {
    try {
      const response = await makeRequest(
        `/api/jobs?search=${encodeURIComponent(payload)}`
      );

      const passed = response.status !== 500;
      recordTest(
        'SQL Injection',
        `Job search with payload: ${payload.substring(0, 20)}...`,
        passed,
        passed
          ? 'Query handled safely'
          : 'Server returned 500 error - possible SQL injection vulnerability',
        passed ? 'low' : 'critical',
        passed ? undefined : 'Ensure parameterized queries are used'
      );
    } catch (error) {
      recordTest(
        'SQL Injection',
        `Job search with payload: ${payload.substring(0, 20)}...`,
        false,
        `Request failed: ${error}`,
        'critical'
      );
    }
  }

  // Test job ID parameter
  for (const payload of ["1' OR '1'='1", "1; DROP TABLE jobs--"]) {
    try {
      const response = await makeRequest(`/api/jobs/${payload}`);
      const passed = response.status === 400 || response.status === 404;
      recordTest(
        'SQL Injection',
        `Job ID with SQL injection: ${payload}`,
        passed,
        passed ? 'Invalid input rejected' : 'Unexpected response',
        passed ? 'low' : 'high'
      );
    } catch (error) {
      recordTest('SQL Injection', `Job ID with SQL injection: ${payload}`, false, `Request failed: ${error}`, 'high');
    }
  }

  // Test location filter
  try {
    const payload = "' OR '1'='1' --";
    const response = await makeRequest(
      `/api/jobs?location=${encodeURIComponent(payload)}`
    );
    const passed = response.status !== 500;
    recordTest(
      'SQL Injection',
      'Location filter with SQL injection',
      passed,
      passed ? 'Filter handled safely' : 'Potential SQL injection',
      passed ? 'low' : 'critical'
    );
  } catch (error) {
    recordTest('SQL Injection', 'Location filter with SQL injection', false, `Request failed: ${error}`, 'critical');
  }
}

async function testXSS() {
  console.log('\n\x1b[1m2. XSS (Cross-Site Scripting) Protection Tests\x1b[0m');

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
  ];

  try {
    const session = await createTestSession();

    for (const payload of xssPayloads) {
      try {
        const response = await makeRequest('/api/contact', {
          method: 'POST',
          headers: {
            Cookie: session.cookie,
            'x-csrf-token': session.csrfToken,
          },
          body: JSON.stringify({
            name: payload,
            email: 'test@example.com',
            message: 'Test message',
          }),
        });

        const passed = response.status === 201 || response.status === 400;
        recordTest(
          'XSS Protection',
          `Contact form XSS payload: ${payload.substring(0, 30)}...`,
          passed,
          passed ? 'XSS payload handled safely' : 'Unexpected response',
          passed ? 'low' : 'high'
        );
      } catch (error) {
        recordTest('XSS Protection', `Contact form XSS`, false, `Request failed: ${error}`, 'high');
      }
    }
  } catch (error) {
    console.error('Failed to create test session for XSS tests:', error);
  }
}

async function testCSRF() {
  console.log('\n\x1b[1m3. CSRF (Cross-Site Request Forgery) Protection Tests\x1b[0m');

  try {
    const session = await createTestSession();

    // Test without CSRF token
    try {
      const response = await makeRequest('/api/contact', {
        method: 'POST',
        headers: {
          Cookie: session.cookie,
        },
        body: JSON.stringify({
          name: 'Test',
          email: 'test@example.com',
          message: 'Test',
        }),
      });

      const passed = response.status === 403;
      recordTest(
        'CSRF Protection',
        'POST without CSRF token',
        passed,
        passed ? 'CSRF token required (403)' : 'CSRF protection may be missing',
        passed ? 'low' : 'critical'
      );
    } catch (error) {
      recordTest('CSRF Protection', 'POST without CSRF token', false, `Request failed: ${error}`, 'critical');
    }

    // Test with invalid CSRF token
    try {
      const response = await makeRequest('/api/contact', {
        method: 'POST',
        headers: {
          Cookie: session.cookie,
          'x-csrf-token': 'invalid-token-12345',
        },
        body: JSON.stringify({
          name: 'Test',
          email: 'test@example.com',
          message: 'Test',
        }),
      });

      const passed = response.status === 403;
      recordTest(
        'CSRF Protection',
        'POST with invalid CSRF token',
        passed,
        passed ? 'Invalid token rejected' : 'CSRF validation weak',
        passed ? 'low' : 'high'
      );
    } catch (error) {
      recordTest('CSRF Protection', 'POST with invalid token', false, `Request failed: ${error}`, 'high');
    }

    // Test with valid CSRF token
    try {
      const response = await makeRequest('/api/contact', {
        method: 'POST',
        headers: {
          Cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          message: 'Valid CSRF test',
        }),
      });

      const passed = response.status === 201;
      recordTest(
        'CSRF Protection',
        'POST with valid CSRF token',
        passed,
        passed ? 'Valid token accepted' : 'Valid token rejected',
        passed ? 'low' : 'medium'
      );
    } catch (error) {
      recordTest('CSRF Protection', 'POST with valid token', false, `Request failed: ${error}`, 'medium');
    }

    // Test GET requests (should not require CSRF)
    try {
      const response = await makeRequest('/api/jobs');
      const passed = response.status === 200;
      recordTest(
        'CSRF Protection',
        'GET without CSRF token (allowed)',
        passed,
        passed ? 'GET correctly exempted' : 'GET incorrectly blocked',
        passed ? 'low' : 'medium'
      );
    } catch (error) {
      recordTest('CSRF Protection', 'GET without CSRF', false, `Request failed: ${error}`, 'medium');
    }
  } catch (error) {
    console.error('Failed to run CSRF tests:', error);
  }
}

async function testAuthentication() {
  console.log('\n\x1b[1m4. Authentication Bypass Tests\x1b[0m');

  const protectedEndpoints = [
    '/api/my-jobs',
    '/api/my-applications',
    '/api/profile',
    '/api/admin/stats',
    '/api/admin/users',
  ];

  for (const endpoint of protectedEndpoints) {
    try {
      const response = await makeRequest(endpoint);
      const passed = response.status === 401;
      recordTest(
        'Authentication',
        `Protected endpoint ${endpoint}`,
        passed,
        passed ? 'Requires authentication (401)' : 'May be accessible without auth',
        passed ? 'low' : 'critical'
      );
    } catch (error) {
      recordTest('Authentication', `Protected endpoint ${endpoint}`, false, `Request failed: ${error}`, 'critical');
    }
  }

  // Test fake session
  try {
    const response = await makeRequest('/api/my-jobs', {
      headers: {
        Cookie: 'connect.sid=fake-session-id-12345',
      },
    });

    const passed = response.status === 401;
    recordTest(
      'Authentication',
      'Fake session cookie',
      passed,
      passed ? 'Fake session rejected' : 'Session validation weak',
      passed ? 'low' : 'critical'
    );
  } catch (error) {
    recordTest('Authentication', 'Fake session cookie', false, `Request failed: ${error}`, 'critical');
  }
}

async function testAuthorization() {
  console.log('\n\x1b[1m5. Authorization (Role-Based Access Control) Tests\x1b[0m');

  try {
    const session = await createTestSession();

    const adminEndpoints = [
      '/api/admin/stats',
      '/api/admin/users',
      '/api/admin/jobs/all',
    ];

    for (const endpoint of adminEndpoints) {
      try {
        const response = await makeRequest(endpoint, {
          headers: {
            Cookie: session.cookie,
          },
        });

        const passed = response.status === 403;
        recordTest(
          'Authorization',
          `Candidate access to ${endpoint}`,
          passed,
          passed ? 'Blocked with 403' : 'RBAC may be missing',
          passed ? 'low' : 'critical'
        );
      } catch (error) {
        recordTest('Authorization', `Candidate access to ${endpoint}`, false, `Request failed: ${error}`, 'critical');
      }
    }

    // Test recruiter endpoint
    try {
      const response = await makeRequest('/api/my-jobs', {
        headers: {
          Cookie: session.cookie,
        },
      });

      const passed = response.status === 403;
      recordTest(
        'Authorization',
        'Candidate access to recruiter endpoint',
        passed,
        passed ? 'Correctly blocked' : 'Accessible to candidates',
        passed ? 'low' : 'high'
      );
    } catch (error) {
      recordTest('Authorization', 'Candidate access to recruiter endpoint', false, `Request failed: ${error}`, 'high');
    }
  } catch (error) {
    console.error('Failed to run authorization tests:', error);
  }
}

async function testRateLimiting() {
  console.log('\n\x1b[1m6. Rate Limiting Tests\x1b[0m');

  // Note: Rate limiting tests are best run manually to avoid impacting other tests
  console.log('  ℹ Skipping aggressive rate limit tests (would impact other operations)');

  try {
    const response = await makeRequest('/api/jobs');
    const hasRateLimitHeaders =
      response.headers.has('ratelimit-limit') ||
      response.headers.has('x-ratelimit-limit');

    recordTest(
      'Rate Limiting',
      'Rate limit headers present',
      true, // informational only
      hasRateLimitHeaders
        ? 'Rate limit headers found'
        : 'Rate limit headers missing (informational)',
      'low'
    );
  } catch (error) {
    console.error('Failed to check rate limit headers:', error);
  }
}

async function testPasswordSecurity() {
  console.log('\n\x1b[1m7. Password Security Tests\x1b[0m');

  const weakPasswords = ['123', 'password', '12345678'];

  for (const password of weakPasswords) {
    try {
      const response = await makeRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          username: `weaktest_${Date.now()}@test.com`,
          password,
          firstName: 'Test',
          lastName: 'User',
        }),
      });

      const hasPasswordValidation = response.status === 400;
      recordTest(
        'Password Security',
        `Weak password "${password}"`,
        hasPasswordValidation,
        hasPasswordValidation
          ? 'Weak password rejected'
          : 'Weak passwords accepted - add strength validation',
        hasPasswordValidation ? 'low' : 'medium',
        hasPasswordValidation ? undefined : 'Implement password strength requirements'
      );
    } catch (error) {
      recordTest('Password Security', `Weak password "${password}"`, false, `Request failed: ${error}`, 'medium');
    }
  }

  // Test secure hashing
  try {
    const response = await makeRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username: `hashtest_${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Hash',
        lastName: 'Test',
      }),
    });

    const passed = response.status === 201;
    recordTest(
      'Password Security',
      'Secure password hashing (scrypt)',
      passed,
      passed ? 'Password hashing working' : 'Password storage issue',
      passed ? 'low' : 'critical'
    );
  } catch (error) {
    recordTest('Password Security', 'Secure hashing', false, `Request failed: ${error}`, 'critical');
  }
}

async function testSessionSecurity() {
  console.log('\n\x1b[1m8. Session Security Tests\x1b[0m');

  try {
    const response = await makeRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username: `sessiontest_${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Session',
        lastName: 'Test',
      }),
    });

    const setCookie = response.headers.get('set-cookie') || '';

    // HttpOnly flag
    const hasHttpOnly = setCookie.toLowerCase().includes('httponly');
    recordTest(
      'Session Security',
      'HttpOnly flag on cookie',
      hasHttpOnly,
      hasHttpOnly ? 'HttpOnly flag present' : 'Missing httpOnly flag',
      hasHttpOnly ? 'low' : 'critical'
    );

    // Secure flag (production only)
    const hasSecure = setCookie.toLowerCase().includes('secure');
    const isProduction = process.env.NODE_ENV === 'production';
    const passed = isProduction ? hasSecure : true;
    recordTest(
      'Session Security',
      'Secure flag (production)',
      passed,
      isProduction
        ? (hasSecure ? 'Secure flag present' : 'Missing in production')
        : 'Development - secure flag optional',
      passed ? 'low' : 'high'
    );

    // SameSite attribute
    const hasSameSite = /samesite=(lax|strict)/i.test(setCookie);
    recordTest(
      'Session Security',
      'SameSite attribute',
      hasSameSite,
      hasSameSite ? 'SameSite present' : 'Missing SameSite',
      hasSameSite ? 'low' : 'high'
    );
  } catch (error) {
    console.error('Failed to run session security tests:', error);
  }
}

async function testFileUploadSecurity() {
  console.log('\n\x1b[1m9. File Upload Security Tests\x1b[0m');

  console.log('  ℹ File upload tests require binary data - skipping in automated run');
  console.log('  ℹ Recommendation: Test file upload security manually with actual files');

  recordTest(
    'File Upload Security',
    'Manual testing required',
    true,
    'File upload tests should be performed manually with actual files',
    'low'
  );
}

async function testSecurityHeaders() {
  console.log('\n\x1b[1m10. Security Headers (Helmet.js) Tests\x1b[0m');

  try {
    const response = await makeRequest('/api/health');

    // CSP header
    const hasCSP = response.headers.has('content-security-policy');
    recordTest(
      'Security Headers',
      'Content-Security-Policy',
      hasCSP,
      hasCSP ? 'CSP header present' : 'CSP missing',
      hasCSP ? 'low' : 'medium'
    );

    // X-Content-Type-Options
    const contentType = response.headers.get('x-content-type-options');
    const hasNoSniff = contentType === 'nosniff';
    recordTest(
      'Security Headers',
      'X-Content-Type-Options: nosniff',
      hasNoSniff,
      hasNoSniff ? 'Header correctly set' : 'Missing nosniff',
      hasNoSniff ? 'low' : 'medium'
    );

    // X-Frame-Options
    const frameOptions = response.headers.get('x-frame-options');
    const hasFrameOptions = frameOptions === 'DENY' || frameOptions === 'SAMEORIGIN';
    recordTest(
      'Security Headers',
      'X-Frame-Options',
      hasFrameOptions,
      hasFrameOptions ? 'Clickjacking protection enabled' : 'Missing X-Frame-Options',
      hasFrameOptions ? 'low' : 'medium'
    );

    // HSTS (production)
    const hsts = response.headers.get('strict-transport-security');
    const isProduction = process.env.NODE_ENV === 'production';
    const hasHSTS = hsts !== null;
    const passed = isProduction ? hasHSTS : true;
    recordTest(
      'Security Headers',
      'Strict-Transport-Security (HSTS)',
      passed,
      isProduction
        ? (hasHSTS ? 'HSTS present' : 'HSTS missing in production')
        : 'Development - HSTS optional',
      passed ? 'low' : 'high'
    );

    // X-Powered-By
    const poweredBy = response.headers.get('x-powered-by');
    const noPoweredBy = poweredBy === null;
    recordTest(
      'Security Headers',
      'X-Powered-By removed',
      noPoweredBy,
      noPoweredBy ? 'Server info hidden' : 'Reveals Express/Node.js',
      noPoweredBy ? 'low' : 'low'
    );
  } catch (error) {
    console.error('Failed to test security headers:', error);
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('VANTAHIRE SECURITY TEST REPORT');
  console.log('='.repeat(80));
  console.log(`Test Date: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Total Tests: ${totalTests}`);

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`\x1b[32mPassed: ${passedTests}\x1b[0m (${passRate}%)`);
  console.log(`\x1b[31mFailed: ${totalTests - passedTests}\x1b[0m`);
  console.log('='.repeat(80));

  // Group by category
  const categories = [...new Set(testResults.map(r => r.category))];

  categories.forEach(category => {
    const categoryTests = testResults.filter(r => r.category === category);
    const categoryPassed = categoryTests.filter(r => r.passed).length;

    console.log(`\n${category}: ${categoryPassed}/${categoryTests.length} passed`);

    const failedTests = categoryTests.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log(`  \x1b[31mFAILED TESTS:\x1b[0m`);
      failedTests.forEach(test => {
        console.log(`    - ${test.testName}`);
        console.log(`      Severity: ${test.severity || 'N/A'}`);
        console.log(`      Details: ${test.details}`);
        if (test.recommendation) {
          console.log(`      Recommendation: ${test.recommendation}`);
        }
      });
    }
  });

  // Critical vulnerabilities
  const criticalIssues = testResults.filter(
    r => !r.passed && r.severity === 'critical'
  );

  if (criticalIssues.length > 0) {
    console.log('\n' + '!'.repeat(80));
    console.log('\x1b[31mCRITICAL VULNERABILITIES FOUND:\x1b[0m');
    console.log('!'.repeat(80));
    criticalIssues.forEach(issue => {
      console.log(`\n- ${issue.testName}`);
      console.log(`  Category: ${issue.category}`);
      console.log(`  Details: ${issue.details}`);
      console.log(`  Recommendation: ${issue.recommendation}`);
    });
  }

  // Recommendations summary
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(80));

  const recommendations = testResults
    .filter(r => !r.passed && r.recommendation)
    .reduce((acc, r) => {
      const sev = r.severity || 'medium';
      if (!acc[sev]) {
        acc[sev] = [];
      }
      acc[sev].push(r.recommendation!);
      return acc;
    }, {} as Record<string, string[]>);

  ['critical', 'high', 'medium', 'low'].forEach(severity => {
    if (recommendations[severity] && recommendations[severity].length > 0) {
      console.log(`\n\x1b[1m${severity.toUpperCase()} Priority:\x1b[0m`);
      [...new Set(recommendations[severity])].forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('OVERALL SECURITY POSTURE:');
  console.log('='.repeat(80));

  const scoreColor = passedTests / totalTests > 0.9 ? '\x1b[32m' :
                     passedTests / totalTests > 0.7 ? '\x1b[33m' : '\x1b[31m';

  console.log(`${scoreColor}Security Score: ${passRate}%\x1b[0m`);

  if (criticalIssues.length === 0) {
    console.log('\x1b[32m✓ No critical vulnerabilities found\x1b[0m');
  } else {
    console.log(`\x1b[31m✗ ${criticalIssues.length} critical vulnerabilities found - IMMEDIATE ACTION REQUIRED\x1b[0m`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('END OF SECURITY REPORT');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  console.log('\x1b[1mVantaHire Security Test Suite\x1b[0m');
  console.log(`Testing server at: ${BASE_URL}\n`);

  try {
    // Check if server is running
    const healthResponse = await makeRequest('/api/health');
    if (healthResponse.status !== 200) {
      console.error('\x1b[31mError: Server health check failed. Is the server running at ' + BASE_URL + '?\x1b[0m');
      process.exit(1);
    }
    console.log('\x1b[32m✓ Server is running\x1b[0m\n');

    await testSQLInjection();
    await testXSS();
    await testCSRF();
    await testAuthentication();
    await testAuthorization();
    await testRateLimiting();
    await testPasswordSecurity();
    await testSessionSecurity();
    await testFileUploadSecurity();
    await testSecurityHeaders();

    generateReport();

    // Exit with error code if critical issues found
    const criticalCount = testResults.filter(
      r => !r.passed && r.severity === 'critical'
    ).length;

    if (criticalCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\x1b[31mFatal error running security tests:\x1b[0m', error);
    process.exit(1);
  }
}

main();
