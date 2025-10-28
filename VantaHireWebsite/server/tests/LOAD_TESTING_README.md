# VantaHire Load Testing Guide

This directory contains k6 load testing scripts for the VantaHire application.

## Prerequisites

- k6 installed (already in package.json)
- VantaHire server running on `http://localhost:5001`
- Database populated with test data (recommended)
- Test recruiter account (optional, for dashboard tests)

## Quick Start

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Run the load tests:**
   ```bash
   k6 run server/tests/loadTests.js
   ```

## Test Scenarios

The load test script includes 4 comprehensive scenarios:

### 1. Job Listing Performance
- **Virtual Users:** 100
- **Duration:** 30 seconds
- **Endpoint:** `GET /api/jobs`
- **Features Tested:**
  - Pagination (random pages 1-5)
  - Variable limits (10, 20, 50)
  - Response validation
- **Success Criteria:** p95 < 1000ms

### 2. Job Search Performance
- **Virtual Users:** 50
- **Duration:** 30 seconds
- **Endpoint:** `GET /api/jobs` (with filters)
- **Features Tested:**
  - Search queries
  - Location filtering
  - Job type filtering
  - Skills filtering
- **Success Criteria:** p95 < 500ms

### 3. Application Submission
- **Virtual Users:** 20
- **Duration:** 30 seconds
- **Endpoint:** `POST /api/jobs/:id/apply`
- **Features Tested:**
  - CSRF token handling
  - Multipart form data
  - Resume upload (mock text files)
  - Duplicate detection
- **Success Criteria:**
  - p95 < 2000ms
  - Success rate > 95%

### 4. Dashboard Load (Authenticated)
- **Virtual Users:** 30
- **Duration:** 30 seconds
- **Endpoints:**
  - `GET /api/my-jobs`
  - `GET /api/my-applications-received`
  - `GET /api/pipeline/stages`
- **Features Tested:**
  - Login flow
  - Session management
  - Dashboard data loading
- **Success Criteria:** p95 < 1000ms

## Configuration

### Environment Variables

You can customize the test execution using environment variables:

```bash
# Custom base URL
k6 run -e BASE_URL=http://localhost:3000 server/tests/loadTests.js

# Custom recruiter credentials (for dashboard tests)
k6 run \
  -e RECRUITER_USERNAME=recruiter@example.com \
  -e RECRUITER_PASSWORD=password123 \
  server/tests/loadTests.js
```

### Override Test Parameters

```bash
# Run with custom VU count and duration
k6 run --vus 200 --duration 60s server/tests/loadTests.js

# Run with iterations instead of duration
k6 run --vus 50 --iterations 1000 server/tests/loadTests.js
```

## Output Formats

### JSON Output
```bash
k6 run --out json=results.json server/tests/loadTests.js
```

### CSV Output
```bash
k6 run --out csv=results.csv server/tests/loadTests.js
```

### InfluxDB (for Grafana dashboards)
```bash
k6 run --out influxdb=http://localhost:8086/k6 server/tests/loadTests.js
```

## Understanding Results

### Key Metrics

- **http_req_duration**: Response time for HTTP requests
  - p50: Median response time
  - p95: 95th percentile (95% of requests faster than this)
  - p99: 99th percentile

- **http_req_failed**: Percentage of failed requests
  - Should be < 5% overall
  - Should be < 1% for listing/search endpoints

- **http_reqs**: Total number of requests per second (throughput)

- **Custom Metrics:**
  - `job_listing_errors`: Error rate for job listing requests
  - `job_search_errors`: Error rate for search requests
  - `application_errors`: Error rate for application submissions
  - `dashboard_errors`: Error rate for dashboard requests

### Sample Output

```
     ✓ status is 200
     ✓ response has jobs
     ✓ response has pagination
     ✓ response time < 1000ms

     checks.........................: 98.50% ✓ 3940      ✗ 60
     data_received..................: 12 MB  400 kB/s
     data_sent......................: 1.2 MB 40 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s     med=1ms      max=45ms   p(90)=2ms    p(95)=3ms
     http_req_duration..............: avg=250ms    min=50ms   med=200ms    max=1.5s   p(90)=450ms  p(95)=650ms
     http_req_failed................: 1.50%  ✓ 60        ✗ 3940
     http_reqs......................: 4000   133.33/s
     iteration_duration.............: avg=750ms    min=500ms  med=700ms    max=2s     p(90)=1.2s   p(95)=1.5s
     iterations.....................: 1000   33.33/s
     vus............................: 100    min=20      max=100
     vus_max........................: 100    min=100     max=100
```

## Performance Thresholds

The test script includes predefined thresholds that will cause the test to fail if not met:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<2000', 'p(99)<3000'],
  'http_req_failed': ['rate<0.05'],
  'http_req_duration{scenario:job_listing}': ['p(95)<1000'],
  'http_req_duration{scenario:job_search}': ['p(95)<500'],
  'http_req_duration{scenario:application_submission}': ['p(95)<2000'],
  'http_req_duration{scenario:dashboard_load}': ['p(95)<1000'],
}
```

## Troubleshooting

### Server Not Running
```
Error: Server health check failed
```
**Solution:** Start the server with `npm run dev`

### CSRF Token Errors
```
Error: Invalid CSRF token
```
**Solution:** Ensure the server's CSRF protection is configured correctly for the test environment

### High Error Rates
```
http_req_failed: 15.00%
```
**Solution:**
- Check server logs for errors
- Ensure database is not overloaded
- Reduce VU count or increase server resources

### Memory Issues
```
Error: Out of memory
```
**Solution:**
- Reduce the number of VUs
- Decrease test duration
- Check for memory leaks in application code

## Best Practices

1. **Baseline Testing:** Run tests against a baseline dataset to establish performance benchmarks
2. **Incremental Load:** Start with low VU counts and gradually increase
3. **Monitor Server:** Watch server CPU, memory, and database connections during tests
4. **Consistent Environment:** Run tests in a consistent environment for comparable results
5. **Database State:** Reset database to a known state between test runs
6. **CI/CD Integration:** Integrate load tests into your CI/CD pipeline

## Advanced Scenarios

### Smoke Test (Quick Validation)
```bash
k6 run --vus 1 --duration 30s server/tests/loadTests.js
```

### Stress Test (Find Breaking Point)
```bash
k6 run --vus 500 --duration 5m server/tests/loadTests.js
```

### Soak Test (Sustained Load)
```bash
k6 run --vus 100 --duration 1h server/tests/loadTests.js
```

### Spike Test (Sudden Traffic Increase)
```bash
k6 run --stage 10s:10,1m:200,10s:10 server/tests/loadTests.js
```

## Test Data Setup

For realistic load testing, populate your database with test data:

```bash
# Seed test jobs
npm run seed:jobs

# Create test recruiter account
npm run create:test-recruiter

# Generate test applications
npm run seed:applications
```

## Metrics to Watch

1. **Response Times:** p50, p95, p99
2. **Error Rates:** Overall and per-endpoint
3. **Throughput:** Requests per second
4. **Resource Usage:** CPU, Memory, Database connections
5. **Database Performance:** Query times, connection pool usage

## Integration with Monitoring

Consider integrating k6 with monitoring tools:

- **Grafana:** Real-time visualization
- **Prometheus:** Metrics storage
- **Datadog:** APM integration
- **New Relic:** Performance monitoring

## Support

For issues or questions:
- Check server logs: `npm run dev`
- Review k6 documentation: https://k6.io/docs/
- Examine test script: `server/tests/loadTests.js`
