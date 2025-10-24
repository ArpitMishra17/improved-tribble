# Forms Feature - Post-Deployment Roadmap

This document outlines recommended next steps after deploying the Forms feature to production.

## ✅ Pre-Deployment Checklist

Before deploying to production, verify:

### Environment Configuration
```bash
# Required - MUST be HTTPS in production
BASE_URL=https://vantahire.com

# Optional - tune based on your scale
FORM_INVITE_EXPIRY_DAYS=14          # Days until invitations expire
FORM_PUBLIC_RATE_LIMIT=10            # Requests per minute per IP
FORM_INVITE_DAILY_LIMIT=50           # Invitations per day per recruiter

# Required for file uploads
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Required for emails
EMAIL_PROVIDER=brevo
SEND_FROM_EMAIL=no-reply@vantahire.com
BREVO_SMTP_PASSWORD=your-smtp-key
```

### Database
```bash
# Migrations run automatically on startup
# Verify in logs:
# ✅ ATS schema ready

# Seed default templates
npm run seed:forms
```

### Smoke Tests
After deployment:
1. ✅ Create a test template (recruiter account)
2. ✅ Send invitation to test email
3. ✅ Open form link (verify HTTPS, no mixed content warnings)
4. ✅ Submit form with all field types
5. ✅ View response in Forms modal
6. ✅ Export CSV
7. ✅ Verify rate limit headers present (`RateLimit-Limit`, `RateLimit-Remaining`)

---

## Priority 1: Immediate (Week 1)

### 1.1 Production Monitoring

**Goal**: Detect and respond to issues before users report them

**Implementation**:

#### Error Tracking (Sentry, Datadog, or similar)

```typescript
// server/index.ts
import * as Sentry from "@sentry/node";

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Don't send PII
    beforeSend(event) {
      // Strip form answers from error context
      if (event.request?.data?.answers) {
        event.request.data.answers = '[REDACTED]';
      }
      return event;
    },
  });
}
```

**Critical Errors to Track**:
- `/api/forms/public/:token` errors (403/410/500)
- Invitation creation failures (email send failures)
- File upload failures (Cloudinary errors)
- Transaction deadlocks (rare but critical)

#### Health Check Endpoint

```typescript
// server/routes.ts
app.get('/api/health/forms', async (req, res) => {
  try {
    // Check database connectivity
    await db.select().from(forms).limit(1);

    // Check Cloudinary
    const cloudinaryOk = !!process.env.CLOUDINARY_CLOUD_NAME;

    // Check email
    const emailOk = !!process.env.EMAIL_PROVIDER;

    res.json({
      status: 'healthy',
      checks: {
        database: true,
        cloudinary: cloudinaryOk,
        email: emailOk,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database check failed',
    });
  }
});
```

**Uptime Monitoring**:
- Set up external probe (UptimeRobot, Pingdom)
- Monitor: `/api/health/forms` every 5 minutes
- Alert on: 3 consecutive failures

#### Metrics Dashboard

**Track**:
- Invitations sent per day
- Response rate (answered / sent)
- Time to response (sentAt → answeredAt)
- Error rate by endpoint
- Rate limit hit rate

**Query for Daily Stats**:
```sql
-- Invitation statistics
SELECT
  DATE(created_at) as date,
  COUNT(*) as invitations_sent,
  COUNT(CASE WHEN status = 'answered' THEN 1 END) as responses_received,
  ROUND(COUNT(CASE WHEN status = 'answered' THEN 1 END)::numeric / COUNT(*) * 100, 2) as response_rate_pct
FROM form_invitations
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 1.2 Data Governance & Privacy

**Goal**: Comply with GDPR, CCPA, and best practices

#### No PII in Logs

```typescript
// server/forms.routes.ts
// ✅ GOOD - Log metadata only
console.log('[Forms] Invitation created', {
  invitationId: invitation.id,
  applicationId,
  formId,
  status: 'sent'
});

// ❌ BAD - Don't log answers
console.log('[Forms] Response received', response); // Contains PII!
```

**Audit**:
```bash
# Search for potential PII logging
grep -r "console.log.*answer" server/
grep -r "console.log.*response" server/
```

#### Privacy Notice on Public Forms

Add to `client/src/pages/public-form-page.tsx`:

```tsx
// Before form fields
<div className="mb-6 p-3 bg-white/5 rounded-lg border border-white/10">
  <p className="text-xs text-slate-400">
    By submitting this form, you consent to VantaHire storing and processing
    your responses for recruitment purposes. See our{" "}
    <a
      href="/privacy"
      target="_blank"
      className="text-purple-400 hover:text-purple-300 underline"
    >
      Privacy Policy
    </a> for details.
  </p>
</div>
```

#### Data Retention Policy

**Option A: Manual Cleanup**
```sql
-- Delete invitations older than 90 days (and cascade to responses)
DELETE FROM form_invitations
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Option B: Automated Cron Job**

Create `server/jobs/cleanupOldForms.ts`:
```typescript
import { db } from '../db';
import { formInvitations } from '@shared/schema';
import { sql } from 'drizzle-orm';
import cron from 'node-cron';

const RETENTION_DAYS = parseInt(process.env.FORM_RETENTION_DAYS || '90', 10);

export function scheduleFormCleanup() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    return;
  }

  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Running form cleanup...');

    try {
      const result = await db.delete(formInvitations)
        .where(sql`created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`)
        .returning();

      console.log(`[Cron] Deleted ${result.length} old form invitations`);
    } catch (error) {
      console.error('[Cron] Form cleanup failed:', error);
    }
  });
}
```

Register in `server/index.ts`:
```typescript
import { scheduleFormCleanup } from './jobs/cleanupOldForms';

// After ensureAtsSchema()
scheduleFormCleanup();
```

### 1.3 Verify Production Behavior

**Checklist**:

```bash
# 1. Test public form email links
curl -I https://vantahire.com/form/test-token
# Verify: HTTPS, no mixed content, correct headers

# 2. Verify rate limit headers
curl -v https://vantahire.com/api/forms/public/test-token
# Look for: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset

# 3. Test file upload
curl -X POST https://vantahire.com/api/forms/public/test-token/upload \
  -F "file=@test.pdf"
# Verify: Cloudinary URL returned, magic-byte validation working

# 4. Verify CSRF protection
curl -X POST https://vantahire.com/api/forms/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
# Expected: 403 (CSRF token missing)

# 5. Test rate limiting
for i in {1..12}; do
  curl -I https://vantahire.com/api/forms/public/test-token
done
# Expected: 11th or 12th request returns 429
```

---

## Priority 2: Short-Term (Month 1)

### 2.1 UX Enhancements

#### Resend Failed/Expired Invitations

**Goal**: Recruiters can easily resend without creating duplicates

**Implementation** in `FormsModal.tsx`:

```tsx
const resendInvitation = useMutation({
  mutationFn: async (invitationId: number) => {
    // Call same POST /api/forms/invitations endpoint
    // Backend relaxes duplicate check for failed/expired status
    return apiRequest("/api/forms/invitations/resend", {
      method: "POST",
      body: JSON.stringify({ invitationId }),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/forms/invitations"] });
    toast({ title: "Form Resent", description: "Invitation sent successfully." });
  },
});

// In invitation list, show Resend button for failed/expired
{invitation.status === 'failed' || invitation.status === 'expired' ? (
  <Button
    onClick={() => resendInvitation.mutate(invitation.id)}
    size="sm"
    variant="outline"
  >
    <Send className="w-4 h-4 mr-2" />
    Resend
  </Button>
) : null}
```

**Backend** (`server/forms.routes.ts`):

```typescript
app.post("/api/forms/invitations/resend", requireAuth, requireRole(['recruiter', 'admin']), csrf, async (req, res) => {
  const { invitationId } = req.body;

  // Get original invitation
  const original = await db.query.formInvitations.findFirst({
    where: eq(formInvitations.id, invitationId),
    with: { application: { with: { job: true } } },
  });

  if (!original) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  // Verify ownership
  if (original.application.job.postedBy !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Only allow resend for failed/expired
  if (!['failed', 'expired'].includes(original.status)) {
    return res.status(400).json({ error: 'Can only resend failed or expired invitations' });
  }

  // Create new invitation (same form, new token)
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + FORM_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const [newInvitation] = await db.insert(formInvitations).values({
    applicationId: original.applicationId,
    formId: original.formId,
    token,
    expiresAt,
    status: 'pending',
    sentBy: req.user.id,
    fieldSnapshot: original.fieldSnapshot, // Reuse snapshot
    customMessage: original.customMessage,
  }).returning();

  // Send email
  const emailResult = await sendFormInvitationEmail(/* ... */);

  // Update status
  await db.update(formInvitations)
    .set({ status: emailResult.success ? 'sent' : 'failed', sentAt: new Date() })
    .where(eq(formInvitations.id, newInvitation.id));

  res.status(201).json({ invitation: newInvitation, emailStatus: emailResult.success ? 'sent' : 'failed' });
});
```

#### Copy to Clipboard (Q/A)

Add to response detail view:

```tsx
const copyToClipboard = () => {
  const text = detailedResponse.questionsAndAnswers
    .map(qa => `${qa.question}\n${qa.answer || '(No answer)'}`)
    .join('\n\n');

  navigator.clipboard.writeText(text);
  toast({ title: "Copied!", description: "Response copied to clipboard." });
};

// In DialogHeader
<Button onClick={copyToClipboard} variant="outline" size="sm">
  <Copy className="w-4 h-4 mr-2" />
  Copy
</Button>
```

#### Print to PDF Styling

Add print CSS to `FormsModal.tsx`:

```tsx
<style>{`
  @media print {
    .forms-modal-header,
    .forms-modal-actions,
    .forms-modal-sidebar {
      display: none !important;
    }

    .forms-response-detail {
      background: white !important;
      color: black !important;
      padding: 2cm;
    }

    .forms-qa-card {
      page-break-inside: avoid;
      margin-bottom: 1cm;
      border: 1px solid #ccc;
      padding: 0.5cm;
    }
  }
`}</style>

// Add Print button
<Button onClick={() => window.print()} variant="outline" size="sm">
  <Printer className="w-4 h-4 mr-2" />
  Print
</Button>
```

### 2.2 Template Manager UI (Admin)

**Goal**: Admins can easily manage all templates

Create `client/src/pages/admin-forms-manager.tsx`:

```tsx
export default function AdminFormsManager() {
  const { data: templatesData } = useQuery({
    queryKey: ["/api/forms/templates"],
    queryFn: async () => apiRequest("/api/forms/templates"),
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Form Templates</h1>

        <div className="grid gap-4">
          {templatesData?.templates.map(template => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{template.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.isPublished ? "default" : "secondary"}>
                      {template.isPublished ? "Published" : "Draft"}
                    </Badge>
                    <Button size="sm" variant="outline">Edit</Button>
                    <Button size="sm" variant="outline">Clone</Button>
                    <Button size="sm" variant="destructive">Delete</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                <p className="text-xs text-gray-500">{template.fields.length} fields</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
```

Add route in `App.tsx`:
```tsx
<ProtectedRoute path="/admin/forms" component={AdminFormsManager} requiredRole={['admin']} />
```

---

## Priority 3: Medium-Term (Quarter 1)

### 3.1 Performance Optimizations

#### Stream Large CSV Exports

For applications with many responses:

```typescript
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

app.get("/api/forms/export", requireAuth, requireRole(['recruiter', 'admin']), async (req, res) => {
  const applicationId = parseInt(req.query.applicationId as string, 10);

  // Verify ownership...

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="export-${applicationId}.csv"`);

  // Write CSV header
  res.write('Application ID,Candidate Name,...\n');

  // Stream results
  const responses = await db.select()
    .from(formResponses)
    .where(eq(formResponses.applicationId, applicationId));

  for (const response of responses) {
    const answers = await db.select()
      .from(formResponseAnswers)
      .where(eq(formResponseAnswers.responseId, response.id));

    for (const answer of answers) {
      res.write(`${applicationId},...\n`);
    }
  }

  res.end();
});
```

#### Response Caching

For frequently accessed responses:

```typescript
import NodeCache from 'node-cache';

const responseCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

app.get("/api/forms/responses/:id", requireAuth, requireRole(['recruiter', 'admin']), async (req, res) => {
  const responseId = parseInt(req.params.id, 10);

  // Check cache
  const cacheKey = `response:${responseId}`;
  const cached = responseCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Fetch from DB
  const response = await db.query.formResponses.findFirst({
    where: eq(formResponses.id, responseId),
    with: { invitation: true, application: { with: { job: true } }, answers: true },
  });

  // Verify ownership...

  // Build response
  const result = { /* ... */ };

  // Cache it
  responseCache.set(cacheKey, result);

  res.json(result);
});
```

### 3.2 Advanced Analytics

**Metrics to Track**:
- Response rate by form template
- Average time to complete (viewedAt → answeredAt)
- Abandonment rate (viewed but not answered)
- Most/least used templates
- Response rate by recruiter

**Query Examples**:

```sql
-- Response rate by template
SELECT
  f.name as form_name,
  COUNT(fi.id) as invitations_sent,
  COUNT(CASE WHEN fi.status = 'answered' THEN 1 END) as responses,
  ROUND(COUNT(CASE WHEN fi.status = 'answered' THEN 1 END)::numeric / COUNT(fi.id) * 100, 2) as response_rate_pct
FROM forms f
LEFT JOIN form_invitations fi ON f.id = fi.form_id
WHERE fi.created_at >= NOW() - INTERVAL '30 days'
GROUP BY f.id, f.name
ORDER BY response_rate_pct DESC;

-- Average time to complete
SELECT
  f.name,
  AVG(EXTRACT(EPOCH FROM (fi.answered_at - fi.viewed_at)) / 3600) as avg_hours_to_complete
FROM form_invitations fi
JOIN forms f ON f.id = fi.form_id
WHERE fi.status = 'answered'
  AND fi.viewed_at IS NOT NULL
  AND fi.answered_at IS NOT NULL
GROUP BY f.id, f.name
ORDER BY avg_hours_to_complete;
```

**Dashboard Component**:

```tsx
// client/src/pages/admin-forms-analytics.tsx
export default function FormsAnalytics() {
  const { data: stats } = useQuery({
    queryKey: ["/api/forms/analytics"],
    queryFn: async () => apiRequest("/api/forms/analytics"),
  });

  return (
    <Layout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Response Rate"
          value={`${stats?.responseRate}%`}
          trend={+2.5}
        />
        <MetricCard
          title="Avg Time to Complete"
          value={`${stats?.avgTimeToComplete}h`}
          trend={-0.5}
        />
        <MetricCard
          title="Forms Sent (30d)"
          value={stats?.formsSent}
          trend={+12}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Response Rate by Template</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.byTemplate}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="responseRate" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Layout>
  );
}
```

---

## Priority 4: Long-Term (Quarter 2+)

### 4.1 Multi-Language Support

**Goal**: Support non-English candidates

**Implementation**:
- Store email templates per locale
- Add `locale` field to form_invitations
- Use i18n library (react-i18next) for public form page

### 4.2 Advanced File Security

**Virus Scanning**:
- Integrate ClamAV or similar
- Scan on upload before storing in Cloudinary
- Reject infected files with clear error message

**File Type Restrictions per Field**:
```typescript
// In form_fields table, add:
allowed_file_types TEXT -- JSON array: ["application/pdf", "image/jpeg"]
max_file_size INTEGER  -- In bytes

// Validate on upload
const allowedTypes = field.allowed_file_types ? JSON.parse(field.allowed_file_types) : null;
if (allowedTypes && !allowedTypes.includes(req.file.mimetype)) {
  return res.status(400).json({ error: 'File type not allowed' });
}
```

### 4.3 Webhook Integrations

**Goal**: Notify external systems of form submissions

**Implementation**:

```typescript
// Add webhook_url to forms table
await db.execute(sql`ALTER TABLE forms ADD COLUMN webhook_url TEXT`);

// After successful submission
if (form.webhook_url) {
  fetch(form.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'form.submitted',
      formId: form.id,
      responseId: response.id,
      applicationId: invitation.applicationId,
      timestamp: new Date().toISOString(),
    }),
  }).catch(err => {
    console.error('[Webhook] Failed to notify:', err);
    // Don't fail submission on webhook error
  });
}
```

---

## Priority 5: DevOps & CI/CD

### 5.1 Continuous Integration

Create `.github/workflows/test.yml`:

```yaml
name: Test Forms Feature

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
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

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vantahire_test

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vantahire_test
          NODE_ENV: test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### 5.2 Mock Email in Tests

Update `test/setup.ts`:

```typescript
import { vi } from 'vitest';

// Mock email service
vi.mock('../server/simpleEmailService', () => ({
  getEmailService: () => ({
    sendEmail: vi.fn().mockResolvedValue(true),
  }),
}));
```

### 5.3 Coverage Gates

Update `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Enforce higher coverage for forms feature
    './server/forms.routes.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
},
```

---

## Quick Reference: Commands

```bash
# Development
npm run dev                    # Start dev server
npm run seed:forms             # Seed default templates
npm test                       # Run tests
npm test:coverage              # Run with coverage report

# Production
npm run build                  # Build for production
npm start                      # Start production server

# Database
npm run db:push                # Run migrations

# Monitoring (Production)
curl https://vantahire.com/api/health/forms  # Health check
```

---

## Success Metrics

Track these KPIs to measure Forms feature success:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Response Rate** | > 60% | (answered / sent) × 100 |
| **Time to Response** | < 24 hours | AVG(answeredAt - sentAt) |
| **Email Delivery Rate** | > 95% | (status='sent' / total) × 100 |
| **Error Rate** | < 1% | (5xx errors / total requests) × 100 |
| **Uptime** | > 99.9% | Health check probe |

---

## Support Runbook

### Issue: "Form link not working"
**Symptoms**: 403, 410, or 409 error

**Diagnosis**:
1. Check invitation status in database
2. Verify token matches invitation
3. Check expiry date
4. Look for already answered status

**Resolution**:
- 403: Invalid token → resend invitation
- 410: Expired → resend invitation
- 409: Already submitted → view response

### Issue: "Email not sending"
**Symptoms**: Invitation status = 'failed'

**Diagnosis**:
1. Check email_audit_log for error_message
2. Verify EMAIL_PROVIDER configured
3. Test SMTP credentials

**Resolution**:
- Fix EMAIL_PROVIDER configuration
- Use "Resend" button in Forms modal
- Check SMTP quota/limits

### Issue: "File upload failing"
**Symptoms**: 500 error on upload

**Diagnosis**:
1. Check Cloudinary credentials
2. Verify file size within limits
3. Check magic-byte validation

**Resolution**:
- Verify CLOUDINARY_* env vars
- Increase Cloudinary plan if needed
- Ask candidate to reduce file size

---

**Last Updated**: January 2024
**Maintained By**: VantaHire Engineering Team
