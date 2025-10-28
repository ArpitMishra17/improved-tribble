# VantaHire Security Test Suite

This directory contains comprehensive security tests for the VantaHire application.

## Quick Start

```bash
# Ensure the server is running
npm run dev

# In another terminal, run security tests
npm run test:security
```

## Test Files

### `runSecurityTests.ts`
Standalone security test runner that performs live tests against a running server.

**Features:**
- SQL Injection protection testing
- XSS (Cross-Site Scripting) protection
- CSRF (Cross-Site Request Forgery) validation
- Authentication & Authorization checks
- Rate limiting verification
- Password security testing
- Session security checks
- File upload security
- Security headers validation (Helmet.js)

**Usage:**
```bash
# Test against localhost:5001 (default)
npm run test:security

# Test against custom URL
TEST_URL=https://staging.vantahire.com npx tsx server/tests/runSecurityTests.ts

# Test with admin credentials
ADMIN_PASSWORD=your_admin_password npm run test:security
```

### `security.test.ts`
Vitest-compatible version of security tests for CI/CD integration.

**Note:** Currently incompatible with MSW (Mock Service Worker) setup. Use `runSecurityTests.ts` instead.

## Test Categories

### 1. SQL Injection Protection (8 tests)
Tests parameterized queries and input sanitization:
- Job search queries
- Job ID parameters
- Location filters
- Skills filters

### 2. XSS Protection (3 tests)
Tests HTML/script injection prevention:
- Contact form inputs
- Job descriptions
- Application notes

### 3. CSRF Protection (4 tests)
Validates double-submit cookie pattern:
- POST without token (should fail)
- POST with invalid token (should fail)
- POST with valid token (should succeed)
- GET without token (should succeed)

### 4. Authentication Bypass (6 tests)
Verifies protected endpoints require auth:
- `/api/my-jobs`
- `/api/my-applications`
- `/api/profile`
- `/api/admin/stats`
- `/api/admin/users`
- Fake session rejection

### 5. Authorization (RBAC) (4 tests)
Tests role-based access control:
- Candidate cannot access admin endpoints
- Candidate cannot access recruiter endpoints
- Recruiter cannot access admin endpoints

### 6. Rate Limiting (1 test)
Checks rate limit configuration:
- Application submissions (10/day per IP)
- Job postings (10/day per user)
- AI analysis (20/day per user)

### 7. Password Security (4 tests)
Validates password handling:
- Weak password rejection
- Secure hashing (scrypt)
- Password storage security

### 8. Session Security (3 tests)
Checks session cookie flags:
- HttpOnly flag (XSS protection)
- Secure flag (HTTPS only)
- SameSite attribute (CSRF protection)

### 9. File Upload Security (1 test)
Tests file upload restrictions:
- File type validation
- File size limits
- Malicious content filtering

### 10. Security Headers (5 tests)
Validates Helmet.js configuration:
- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security (HSTS)
- X-Powered-By removal

## Understanding Test Results

### Test Output

```
✓ Test Name - Test passed (green checkmark)
✗ Test Name - Test failed (red X)
  Details: Why the test failed
  Recommendation: How to fix it
```

### Security Score

- **90-100%**: Excellent security posture
- **80-89%**: Good security, minor improvements needed
- **70-79%**: Acceptable security, some vulnerabilities exist
- **Below 70%**: Significant security concerns

### Severity Levels

- **Critical**: Immediate action required (exploitable vulnerabilities)
- **High**: Should be fixed soon (significant security risk)
- **Medium**: Should be fixed (moderate security risk)
- **Low**: Nice to have (minimal security impact)

## Current Status

Last Test Run: October 28, 2025

**Overall Score: 87.2%** (34/39 tests passed)

**Status: GOOD** - No critical vulnerabilities

### Known Issues

1. **Weak Password Acceptance** (Medium)
   - Current: Application accepts weak passwords
   - Recommendation: Add password strength validation

2. **Job ID Parameter Handling** (Low-Medium)
   - Current: Malformed IDs return unexpected status codes
   - Recommendation: Add input validation for job IDs

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Security Tests

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Start server
        run: npm run dev &

      - name: Wait for server
        run: npx wait-on http://localhost:5001/api/health

      - name: Run security tests
        run: npm run test:security
```

## Best Practices

### Before Each Release

1. Run security tests: `npm run test:security`
2. Review the security report
3. Fix any critical or high severity issues
4. Document any accepted risks

### Regular Maintenance

- Run tests weekly during active development
- Run before each production deployment
- Update test suite when adding new endpoints
- Keep dependencies updated

### Adding New Tests

1. Add test to appropriate category in `runSecurityTests.ts`
2. Use `recordTest()` to track results
3. Include severity level and recommendations
4. Document the test in this README

Example:
```typescript
async function testNewFeature() {
  console.log('\n\x1b[1m11. New Feature Security Tests\x1b[0m');

  try {
    const response = await makeRequest('/api/new-endpoint');
    const passed = response.status === 200;

    recordTest(
      'New Feature',
      'Test description',
      passed,
      passed ? 'Success message' : 'Failure message',
      passed ? 'low' : 'high',
      passed ? undefined : 'How to fix this issue'
    );
  } catch (error) {
    recordTest('New Feature', 'Test description', false, `Error: ${error}`, 'high');
  }
}
```

## Troubleshooting

### Server not running
```
Error: Server health check failed
```
**Solution:** Start the server with `npm run dev`

### Connection refused
```
Request failed: fetch failed
```
**Solution:** Check if port 5001 is blocked or server is running on different port

### Admin login failed
```
Warning: Could not login as admin
```
**Solution:** Set `ADMIN_PASSWORD` environment variable or check admin credentials

### Tests timeout
**Solution:** Increase timeout in test runner or check server performance

## Additional Resources

- [SECURITY_TEST_SUMMARY.md](/SECURITY_TEST_SUMMARY.md) - Detailed test results and recommendations
- [COMPREHENSIVE_SECURITY_AUDIT.md](/COMPREHENSIVE_SECURITY_AUDIT.md) - Full security audit
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Web application security risks
- [Helmet.js Documentation](https://helmetjs.github.io/) - Security headers middleware

## Contributing

When adding new security tests:
1. Follow existing test patterns
2. Add clear descriptions and recommendations
3. Update this README
4. Test against both development and production environments
5. Document any environment-specific behavior

## License

MIT
