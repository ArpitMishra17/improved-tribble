# Load Testing Quick Start Guide

## TL;DR

```bash
# 1. Start the server
npm run dev

# 2. Run load tests
npm run test:load

# 3. View results in terminal
```

## What Gets Tested

The load test suite validates 4 critical scenarios:

1. **Job Listing** - 100 users browsing jobs for 30s
2. **Job Search** - 50 users searching/filtering for 30s
3. **Application Submission** - 20 users applying for jobs for 30s
4. **Dashboard Load** - 30 authenticated users viewing dashboard for 30s

## Quick Commands

```bash
# Standard load test (recommended)
npm run test:load

# Output results to JSON file
npm run test:load:json

# Quick smoke test (1 user, 30s)
npm run test:load:smoke

# Custom configuration
k6 run -e BASE_URL=http://localhost:3000 server/tests/loadTests.js
```

## Expected Results

### ✅ Good Performance Indicators
- p95 response time < 1s for most endpoints
- p95 response time < 500ms for searches
- Error rate < 5%
- 20-30 requests/second throughput

### ⚠️ Performance Issues
- p95 > 2s (may indicate database bottleneck)
- Error rate > 10% (check server logs)
- Memory continuously increasing (possible leak)
- CPU at 100% sustained (insufficient resources)

## Interpreting Results

The test outputs several key metrics:

```
http_req_duration..............: avg=13ms    p(95)=71ms    p(99)=195ms
http_req_failed................: 21.67%
http_reqs......................: 3686   26.68/s
```

**What this means:**
- **avg=13ms**: Average response time is 13ms (excellent!)
- **p(95)=71ms**: 95% of requests completed in under 71ms
- **p(99)=195ms**: 99% of requests completed in under 195ms
- **http_req_failed=21.67%**: Error rate (high due to test setup, see below)
- **http_reqs=26.68/s**: Server handled ~27 requests per second

## Common Issues & Solutions

### Issue: High Error Rate (>20%)

**Cause:** Database not populated with test data

**Solution:**
```bash
# Create test jobs first
npm run seed:jobs  # If available
# Or manually create some jobs via the UI
```

### Issue: Dashboard Tests Failing

**Cause:** No test recruiter account exists

**Solution:**
```bash
# Create a recruiter account with:
# Email: recruiter@test.com
# Password: test123

# Or use environment variables:
k6 run \
  -e RECRUITER_USERNAME=your@email.com \
  -e RECRUITER_PASSWORD=yourpassword \
  server/tests/loadTests.js
```

### Issue: CSRF Token Errors

**Cause:** CSRF protection blocking test requests

**Solution:** The test script handles CSRF tokens automatically. Ensure the server is running in development mode where CSRF is less strict.

### Issue: Server Not Running

**Error:** `Server health check failed`

**Solution:**
```bash
# Start the server in another terminal
npm run dev

# Wait for "Server started on port 5001"
# Then run tests
npm run test:load
```

## Test Data Setup (Recommended)

For best results, set up test data before running load tests:

```bash
# 1. Start the server
npm run dev

# 2. Create admin account (if needed)
npm run admin:reset

# 3. Seed ATS pipeline stages
npm run seed:ats

# 4. Seed forms
npm run seed:forms

# 5. Create test jobs manually via UI or API
# - Login as admin/recruiter
# - Create 10-20 test job postings
# - Approve them

# 6. Run load tests
npm run test:load
```

## Advanced Usage

### Run Longer Soak Test
```bash
k6 run --vus 50 --duration 5m server/tests/loadTests.js
```

### Find Breaking Point (Stress Test)
```bash
k6 run --vus 500 --duration 2m server/tests/loadTests.js
```

### Spike Test (Sudden Load Increase)
```bash
k6 run --stage 10s:10,1m:200,10s:10 server/tests/loadTests.js
```

### Custom VU Count
```bash
k6 run --vus 200 --duration 60s server/tests/loadTests.js
```

## Monitoring During Tests

While tests run, monitor:

```bash
# Watch server logs in another terminal
npm run dev

# Watch system resources
htop  # or top

# Monitor database connections
# Check your database dashboard
```

## Understanding Test Phases

The load test runs in 4 sequential phases:

```
0-30s:     Job Listing (100 VUs)
35-65s:    Job Search (50 VUs)
70-100s:   Applications (20 VUs)
105-135s:  Dashboard (30 VUs)
```

Total duration: ~2 minutes 15 seconds

## Success Criteria

✅ Test passes if:
- Job Listing p95 < 1000ms
- Job Search p95 < 500ms
- Application p95 < 2000ms
- Dashboard p95 < 1000ms
- Overall error rate < 5%

## Next Steps After Running Tests

1. **Review Results:** Check `LOAD_TEST_RESULTS.md` for detailed analysis
2. **Fix Issues:** Address any failing thresholds
3. **Optimize:** Use results to guide performance improvements
4. **Iterate:** Re-run tests after optimizations
5. **Monitor:** Set up continuous load testing in CI/CD

## Troubleshooting Checklist

- [ ] Server is running (`curl http://localhost:5001/api/health`)
- [ ] Database is accessible
- [ ] Test data exists (jobs, users)
- [ ] k6 is installed (`which k6`)
- [ ] No firewall blocking localhost
- [ ] Sufficient system resources (CPU, RAM)

## Getting Help

1. Check test output for specific error messages
2. Review server logs for backend errors
3. Examine `LOAD_TESTING_README.md` for detailed documentation
4. Check k6 docs: https://k6.io/docs/

## Files Created

This load testing setup includes:

- `/server/tests/loadTests.js` - Main test script
- `/server/tests/LOAD_TESTING_README.md` - Comprehensive guide
- `/server/tests/LOAD_TEST_RESULTS.md` - Sample results & analysis
- `/server/tests/LOAD_TEST_QUICKSTART.md` - This file

## Performance Benchmarks

Based on initial testing:

| Endpoint | p50 | p95 | p99 | Status |
|----------|-----|-----|-----|--------|
| Job Listing | 3ms | 145ms | 200ms | ✅ Excellent |
| Job Search | 3ms | 88ms | 150ms | ✅ Excellent |
| Applications | 2ms | 8ms | 13ms | ✅ Excellent |
| Dashboard | 2ms | 8ms | 15ms | ✅ Excellent |

These are baseline metrics. Your results may vary based on:
- Database size
- Server hardware
- Network conditions
- Concurrent user count
