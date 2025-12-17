# VantaHire Provisioning Portal

Automated SaaS provisioning system that creates dedicated VantaHire instances after successful payment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PROVISIONING FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Customer fills checkout form                                     │
│          ↓                                                           │
│  2. POST /api/checkout                                              │
│     - Create customer record                                         │
│     - Create Razorpay order                                         │
│     - Return checkout config                                         │
│          ↓                                                           │
│  3. Frontend opens Razorpay Checkout                                │
│          ↓                                                           │
│  4. Customer completes payment                                       │
│          ↓                                                           │
│  5. Razorpay sends webhook (payment.captured)                       │
│          ↓                                                           │
│  6. POST /api/webhooks/razorpay                                     │
│     - Verify signature (raw body!)                                   │
│     - Store event (idempotency)                                      │
│     - Update purchase status                                         │
│     - Queue provisioning job                                         │
│     - Return 200 immediately                                         │
│          ↓                                                           │
│  7. Worker picks up job                                             │
│     - Deploy from Railway template                                   │
│     - Configure customer variables                                   │
│     - Generate setup token                                           │
│     - Send setup email                                               │
│          ↓                                                           │
│  8. Customer clicks setup link                                      │
│     - Sets admin password                                            │
│     - Instance marked as active                                      │
│          ↓                                                           │
│  9. Customer uses their VantaHire instance                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## State Machine

### Purchase States
- `pending` - Order created, awaiting payment
- `paid` - Payment captured
- `failed` - Payment failed
- `refunded` - Payment refunded

### Install States
- `pending` - Waiting for payment
- `provisioning` - Railway project being created
- `setup_pending` - Provisioned, awaiting admin setup
- `active` - Fully provisioned and running
- `failed` - Provisioning failed
- `suspended` - Suspended (non-payment, abuse)

### Job States
- `pending` - Ready to process
- `processing` - Currently being processed
- `completed` - Successfully completed
- `failed` - Failed after max retries
- `cancelled` - Manually cancelled

## Setup

### 1. Prerequisites

- Node.js 18+
- PostgreSQL database for control plane
- Razorpay account (Indian payments)
- Railway account with API token
- Railway template for VantaHire

### 2. Create Railway Template

1. Create a "golden" Railway project manually:
   - Web service (VantaHireWebsite)
   - Worker service (VantaHireWebsite with ENABLE_SCHEDULER=true)
   - Postgres plugin
   - Redis plugin

2. Configure service linking:
   - DATABASE_URL should reference Postgres
   - REDIS_URL should reference Redis

3. Publish as template:
   - Railway Dashboard > Project > Settings > Publish Template
   - Copy the Template ID

### 3. Configure Razorpay Webhook

1. Go to Razorpay Dashboard > Webhooks
2. Create new webhook:
   - URL: `https://your-portal.com/api/webhooks/razorpay`
   - Events: `payment.captured`, `order.paid`, `payment.failed`, `refund.created`
   - Active: Yes
3. Copy the **Webhook Secret** (not the API secret!)

### 4. Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Generate encryption key
openssl rand -hex 32
```

### 5. Database Setup

```bash
cd provisioning-portal
npm install
npm run db:push   # Create tables
```

### 6. Run Locally

```bash
# Terminal 1: Web server
npm run dev

# Terminal 2: Worker
npm run start:worker
```

## API Endpoints

### POST /api/checkout
Create a payment order.

**Request:**
```json
{
  "email": "customer@example.com",
  "name": "Customer Name"
}
```

**Response:**
```json
{
  "orderId": "order_xxxxx",
  "amount": 99900,
  "currency": "INR",
  "keyId": "rzp_xxxxx",
  "prefill": {
    "name": "Customer Name",
    "email": "customer@example.com"
  }
}
```

### POST /api/webhooks/razorpay
Razorpay webhook endpoint. **Do not call directly.**

### GET /api/install/:id
Get install status.

**Query params:** `email` (for auth)

**Response:**
```json
{
  "id": 1,
  "status": "active",
  "domain": "vantahire-customer-abc123.up.railway.app",
  "createdAt": "2024-01-01T00:00:00Z",
  "activatedAt": "2024-01-01T00:05:00Z"
}
```

### GET /api/install/by-purchase/:orderId
Get install by Razorpay order ID (for frontend redirect).

### GET /api/setup/:token
Validate setup token.

### POST /api/setup/:token
Complete setup with admin password.

**Request:**
```json
{
  "password": "SecureP@ssw0rd123!",
  "confirmPassword": "SecureP@ssw0rd123!"
}
```

## Security Considerations

### Webhook Signature Verification

**CRITICAL:** Razorpay webhook signature must be verified using the **raw request body bytes**, NOT `JSON.stringify(req.body)`.

```typescript
// CORRECT - use raw body buffer
const rawBody = await req.arrayBuffer();
const rawBodyBuffer = Buffer.from(rawBody);
verifyWebhookSignature(rawBodyBuffer, signature);

// WRONG - re-serialized JSON can differ from original
const body = JSON.stringify(req.body);  // DON'T DO THIS
```

### Encryption

- Uses XChaCha20-Poly1305 (via libsodium)
- **Each secret gets a unique random nonce** - no nonce reuse
- Master key should be rotated periodically
- Consider using KMS (AWS KMS, GCP KMS) for production

### Credential Handling

Instead of storing admin passwords:
1. Generate one-time setup token
2. Token expires after 24 hours
3. Customer sets password via setup link
4. Password is sent directly to Railway, not stored locally

### Rate Limiting

- Checkout endpoint: Implement rate limiting per IP
- Webhook endpoint: Razorpay handles retries
- Status endpoints: Rate limit per customer

## Deployment

### Railway (Recommended)

1. Create new Railway project for the portal
2. Add Postgres plugin
3. Set environment variables
4. Deploy web service: `npm run start`
5. Deploy worker service: `npm run start:worker`

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

## Monitoring

### Health Checks

- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe

### Logs to Watch

```bash
# Successful provisioning
"Queued provisioning job for install 123"
"Setup link for customer email@example.com"

# Errors
"Webhook signature verification failed"
"Job 123 failed: [error message]"
"Worker error: [error message]"
```

### Metrics (TODO)

- Payment conversion rate
- Provisioning success rate
- Average provisioning time
- Failed jobs by type

## Troubleshooting

### Webhook not received

1. Check Razorpay webhook logs
2. Verify webhook URL is accessible
3. Check signature secret matches

### Provisioning stuck

1. Check `provisioning_jobs` table for errors
2. Check Railway API token is valid
3. Check template ID is correct

### Setup link not working

1. Verify token hasn't expired (24h default)
2. Check token hasn't been used
3. Verify install is in `setup_pending` state

## Future Enhancements

- [ ] Subscription support (recurring payments)
- [ ] Custom domain configuration
- [ ] Instance scaling controls
- [ ] Usage-based billing
- [ ] Multi-region deployment
- [ ] Instance backup/restore
