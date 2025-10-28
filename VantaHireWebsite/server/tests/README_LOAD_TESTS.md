# Load Testing Documentation Index

This directory contains comprehensive k6 load testing for the VantaHire application.

## Quick Start

```bash
# 1. Ensure server is running
npm run dev

# 2. Run load tests
npm run test:load
```

## Documentation Files

### For New Users
**Start here:** [LOAD_TEST_QUICKSTART.md](./LOAD_TEST_QUICKSTART.md)
- Quick commands
- Common issues & solutions
- Expected results
- 5-minute guide to running tests

### For Detailed Information
**Comprehensive guide:** [LOAD_TESTING_README.md](./LOAD_TESTING_README.md)
- Full configuration options
- Advanced scenarios
- Environment setup
- Monitoring integration
- Best practices

### For Results Analysis
**Sample results:** [LOAD_TEST_RESULTS.md](./LOAD_TEST_RESULTS.md)
- Detailed test results
- Performance analysis
- Recommendations
- Next steps

**Quick snapshot:** [RESULTS_SNAPSHOT.txt](./RESULTS_SNAPSHOT.txt)
- One-page results summary
- Key metrics at a glance
- Threshold compliance
- Performance assessment

### Test Script
**Main script:** [loadTests.js](./loadTests.js)
- k6 test implementation
- 4 comprehensive scenarios
- Custom metrics
- Configurable thresholds

## NPM Scripts

```bash
# Standard load test (recommended)
npm run test:load

# Output results to JSON file
npm run test:load:json

# Quick smoke test (1 VU, 30s)
npm run test:load:smoke
```

## Test Scenarios

1. **Job Listing** - 100 VUs, 30s, GET /api/jobs
2. **Job Search** - 50 VUs, 30s, GET /api/jobs (with filters)
3. **Application Submission** - 20 VUs, 30s, POST /api/jobs/:id/apply
4. **Dashboard Load** - 30 VUs, 30s, authenticated endpoints

## Performance Benchmarks

| Scenario | p95 Response Time | Threshold | Status |
|----------|-------------------|-----------|--------|
| Job Listing | 145ms | < 1000ms | ✅ PASS |
| Job Search | 88ms | < 500ms | ✅ PASS |
| Applications | 8ms | < 2000ms | ✅ PASS |
| Dashboard | 8ms | < 1000ms | ✅ PASS |

## Common Commands

```bash
# Basic test
k6 run server/tests/loadTests.js

# Custom base URL
k6 run -e BASE_URL=http://localhost:3000 server/tests/loadTests.js

# Custom VU count
k6 run --vus 200 --duration 60s server/tests/loadTests.js

# Stress test
k6 run --vus 500 --duration 5m server/tests/loadTests.js

# Soak test
k6 run --vus 100 --duration 1h server/tests/loadTests.js
```

## File Structure

```
server/tests/
├── loadTests.js                  # Main k6 test script
├── README_LOAD_TESTS.md          # This index file
├── LOAD_TEST_QUICKSTART.md       # Quick start guide
├── LOAD_TESTING_README.md        # Comprehensive documentation
├── LOAD_TEST_RESULTS.md          # Sample results & analysis
└── RESULTS_SNAPSHOT.txt          # One-page results summary
```

## Requirements

- k6 installed (included in package.json)
- Server running on http://localhost:5001
- (Optional) Test data for realistic results
- (Optional) Test credentials for dashboard tests

## Support

- **k6 Documentation:** https://k6.io/docs/
- **Quick Issues:** Check LOAD_TEST_QUICKSTART.md
- **Detailed Help:** Check LOAD_TESTING_README.md
- **Results Analysis:** Check LOAD_TEST_RESULTS.md

## Next Steps

1. Read the [Quick Start Guide](./LOAD_TEST_QUICKSTART.md)
2. Run your first test: `npm run test:load`
3. Review results in terminal
4. Check [comprehensive guide](./LOAD_TESTING_README.md) for advanced usage
5. Integrate into CI/CD pipeline

---

**Last Updated:** 2025-10-28
**Version:** 1.0
**Status:** Production Ready
