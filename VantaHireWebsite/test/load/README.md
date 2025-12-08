# K6 Load Tests

Performance and load testing for VantaHire API endpoints.

## Prerequisites

Install K6:

```bash
# macOS
brew install k6

# Windows (chocolatey)
choco install k6

# Linux (apt)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Running Tests

### Application Endpoint Load Test

Tests the job application submission endpoint under various load conditions.

```bash
# Basic run
k6 run test/load/apply-endpoint.k6.js

# With custom options
k6 run --vus 50 --duration 1m test/load/apply-endpoint.k6.js

# Against specific environment
BASE_URL=https://staging.vantahire.com k6 run test/load/apply-endpoint.k6.js
```

### Stage Move Load Test

Tests the pipeline stage move endpoint (drag-and-drop operations).

```bash
k6 run test/load/stage-move.k6.js
```

### Bulk Invite Load Test

Tests the bulk form invitation endpoint with rate limiting verification.

```bash
k6 run test/load/bulk-invite.k6.js
```

## Test Scenarios

### Apply Endpoint (`apply-endpoint.k6.js`)

| Stage | Duration | VUs | Purpose |
|-------|----------|-----|---------|
| Ramp up | 30s | 0→10 | Gradual load increase |
| Sustained | 1m | 10→25 | Normal load |
| Plateau | 2m | 25 | Steady state |
| Spike | 30s | 25→50 | Traffic spike |
| Peak | 1m | 50 | Maximum load |
| Ramp down | 30s | 50→0 | Graceful shutdown |

### Stage Move (`stage-move.k6.js`)

- **Steady recruiters**: Constant 10 VUs for 2 minutes
- **Burst activity**: Ramp to 30 VUs simulating busy periods
- **Stress test**: High arrival rate to find breaking points

### Bulk Invite (`bulk-invite.k6.js`)

- **Single invites**: Tests individual invitation creation
- **Bulk batches**: Tests sequential bulk operations (like UI)
- **Rate limit stress**: High request rate to verify rate limiting

## Thresholds

Each test has built-in thresholds that define pass/fail criteria:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p95 < 2000ms | 95% of requests complete in 2s |
| `http_req_failed` | rate < 10% | Less than 10% request failures |
| `*_success` | rate > 80% | At least 80% operation success |

## Custom Metrics

### Apply Endpoint
- `application_success`: Rate of successful applications
- `application_duration`: Time to complete application submission
- `rate_limit_hits`: Count of 429 responses

### Stage Move
- `stage_move_success`: Rate of successful stage moves
- `stage_move_duration`: Time to complete stage moves
- `concurrent_move_conflicts`: Count of 409 conflicts

### Bulk Invite
- `invite_success`: Rate of successful invitations
- `invite_duration`: Time to send invitation
- `quota_exceeded`: Count of quota limit hits
- `batch_invite_success`: Success rate of bulk operations

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:5000` | Target server URL |

## Output

Results can be output to various formats:

```bash
# JSON output
k6 run --out json=results.json test/load/apply-endpoint.k6.js

# InfluxDB (for Grafana dashboards)
k6 run --out influxdb=http://localhost:8086/k6 test/load/apply-endpoint.k6.js

# HTML report (requires xk6-dashboard)
k6 run --out dashboard test/load/apply-endpoint.k6.js
```

## CI Integration

Example GitHub Actions workflow:

```yaml
- name: Run Load Tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: test/load/apply-endpoint.k6.js
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
```

## Troubleshooting

### "Server not reachable"
Ensure the server is running and `BASE_URL` is correct.

### "Login failed"
Verify test credentials exist in the database:
- `admin` / `admin123`
- `recruiter` / `recruiter123`

### High failure rate
Check server logs for errors. Common issues:
- Database connection limits
- Rate limiting too aggressive
- Memory exhaustion

### Rate limit hits
This is expected behavior. The tests verify rate limiting works correctly.
