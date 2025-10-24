# Testing Guide

This directory contains unit and integration tests for the VantaHire application.

## Test Framework

- **Vitest** - Fast unit test framework
- **Supertest** - HTTP assertion library for integration tests
- **Test Factories** - Mock data generators in `test/factories.ts`

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test test/integration/forms.test.ts

# Run tests matching a pattern
npm test -- -t "Public Form"
```

## Test Structure

### Integration Tests

Located in `test/integration/`, these tests verify end-to-end API functionality:

- **`forms.test.ts`** - Comprehensive forms feature tests covering:
  - Template CRUD operations
  - Form invitation creation and validation
  - Public form access (GET/POST)
  - File upload security and validation
  - Response viewing and CSV export
  - Rate limiting enforcement
  - Token validation (403/410/409 status codes)
  - Transaction locks preventing double-submit
  - Field-specific validation (email, select, date, yes_no)

### Test Factories

Located in `test/factories.ts`, factory functions create mock test data:

- `createMockUser()` - User accounts (candidate, recruiter, admin)
- `createMockJob()` - Job postings
- `createMockApplication()` - Job applications
- `createMockFormTemplate()` - Form templates with fields
- `createMockFormInvitation()` - Form invitations
- `createMockFormAnswers()` - Form submission answers

## Test Database

Tests use the same database connection as the application. Ensure:

1. **Test Database**: Use a separate test database (not production!)
2. **Environment**: Set `DATABASE_URL` to test database in `.env.test`
3. **Cleanup**: Tests clean up their own data in `afterEach`/`afterAll` hooks

### Setting Up Test Database

```bash
# Create test database
createdb vantahire_test

# Set test environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/vantahire_test"

# Run migrations
npm run db:push

# (Optional) Reset test database between test runs
npm run test:db:reset

# Run tests
npm test
```

### Resetting Test Data

For clean test isolation, you can reset the test database:

```bash
# Truncates all tables (CAUTION: only works with databases containing "test" in name)
npm run test:db:reset

# Then run tests
npm test
```

**Safety Note**: The reset script includes a safety check—it will only run if `DATABASE_URL` contains "test" to prevent accidental data loss.

## Writing Tests

### Integration Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { db } from '../../server/db';
import { tableName } from '@shared/schema';
import { createMockUser } from '../factories';

describe('Feature Tests', () => {
  let testData: any;

  beforeAll(async () => {
    // Setup test data
    const [data] = await db.insert(tableName).values({...}).returning();
    testData = data;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(tableName).where(eq(tableName.id, testData.id));
  });

  it('should test something', async () => {
    const response = await request(app).get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

### Test Coverage Goals

- **Critical Paths**: 100% coverage on security-critical endpoints (auth, CSRF, rate limiting)
- **Business Logic**: 80%+ coverage on forms, applications, jobs
- **Validation**: All Zod schemas tested with valid/invalid inputs
- **Error Handling**: All error codes (400/401/403/404/409/410/429/500) tested

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to `main` branch
- Before deployment

### Recommended CI Configuration

Create `.github/workflows/test.yml`:

```yaml
name: Tests and Build
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: vantahire_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run check

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/vantahire_test
        run: npm run db:push

      - name: Run unit tests
        run: npm test -- --reporter=verbose

      - name: Run integration tests with coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/vantahire_test
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

      - name: Check coverage thresholds
        run: |
          if [ -f coverage/coverage-summary.json ]; then
            node -e "
              const coverage = require('./coverage/coverage-summary.json');
              const totals = coverage.total;
              const minCoverage = 80;

              const metrics = ['lines', 'statements', 'functions', 'branches'];
              for (const metric of metrics) {
                const pct = totals[metric].pct;
                console.log(\`\${metric}: \${pct}%\`);
                if (pct < minCoverage) {
                  console.error(\`Coverage for \${metric} (\${pct}%) is below threshold (\${minCoverage}%)\`);
                  process.exit(1);
                }
              }
            "
          fi

      - name: Build
        run: npm run build

      - name: Archive production artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run check  # TypeScript type checking
```

### Coverage Gates

The project enforces minimum coverage thresholds in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

These thresholds are checked both locally (`npm run test:coverage`) and in CI.

## Test Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterEach` or `afterAll`
3. **Factories**: Use factories for creating test data, not hardcoded values
4. **Assertions**: Be specific - test exact values, not just truthy/falsy
5. **Coverage**: Test both success and failure paths
6. **Performance**: Keep integration tests fast (< 100ms per test ideally)

## Debugging Tests

```bash
# Run with debugging output
DEBUG=* npm test

# Run single test file with verbose output
npm test test/integration/forms.test.ts -- --reporter=verbose

# Inspect test failure details
npm test -- --reporter=verbose --no-coverage
```

## Common Issues

### Test Database Connection Errors

**Problem**: `connection refused` or `database does not exist`

**Solution**:
```bash
# Ensure test database exists
createdb vantahire_test

# Verify DATABASE_URL points to test database
echo $DATABASE_URL
```

### Test Timeouts

**Problem**: Tests hang or timeout

**Solution**:
- Check for missing `await` keywords
- Ensure proper cleanup in `afterEach`/`afterAll`
- Increase timeout for slow operations:
  ```typescript
  it('slow test', async () => {
    // ...
  }, 10000); // 10 second timeout
  ```

### Cleanup Failures

**Problem**: Foreign key constraint errors during cleanup

**Solution**: Delete in reverse dependency order:
```typescript
afterAll(async () => {
  await db.delete(childTable).where(...);  // Delete children first
  await db.delete(parentTable).where(...); // Then parents
});
```

## Test Coverage Reports

```bash
# Generate HTML coverage report
npm test -- --coverage

# View coverage report
open coverage/index.html
```

Coverage thresholds are configured in `vitest.config.ts`:
```typescript
export default {
  test: {
    coverage: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
};
```

## Contributing

When adding new features:

1. Write tests FIRST (TDD approach)
2. Ensure all tests pass: `npm test`
3. Add test coverage for edge cases
4. Update this README if adding new test utilities

## Forms Feature Test Coverage

The forms feature has comprehensive test coverage across:

### Security Tests ✅
- CSRF protection on internal endpoints
- Token validation (403/410/409)
- Rate limiting (10/min public, 50/day invitations)
- Authorization checks (job ownership)
- Template access guards

### Functional Tests ✅
- Template CRUD with field snapshots
- Duplicate prevention logic
- Transaction locks (prevents double-submit)
- Field validation (email, select, date, yes_no, file)
- CSV export with proper escaping
- File upload with magic-byte validation

### Integration Tests ✅
- Full invitation workflow (create → send → view → submit)
- Public form access patterns
- Response viewing and export
- Rate limit enforcement
- Status transitions (pending → sent → viewed → answered/expired)

See `test/integration/forms.test.ts` for complete test suite.
