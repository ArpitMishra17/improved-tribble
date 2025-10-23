# Deploying to Railway

This guide covers deploying the VantaHireWebsite (Express + React) to Railway, with optional SpotAxis integration.

## 1) Prerequisites
- Railway project created
- A Postgres database (Railway Postgres or Neon). Capture the connection string.
- Node 18+ environment

## 2) Environment Variables
Set these in Railway → Variables:

### Required (Security Critical)
- `NODE_ENV=production` **[REQUIRED]**
- `PORT` (Railway injects this automatically; app reads it)
- `DATABASE_URL` **[REQUIRED]**
  - If using Railway Postgres: copy the full connection string from the Railway Postgres plugin.
    - Note: SSL certificate verification is enabled by default in production
  - If using Neon: use the Neon connection string (often ends with `.neon.tech`), keep `sslmode=require`.
- `SESSION_SECRET` **[REQUIRED]** - Must be a random string (minimum 32 characters)
  - Generate with: `openssl rand -hex 32`
  - Application will fail to start in production if not set
- `ALLOWED_HOSTS` **[REQUIRED for production]**
  - Comma-separated list of allowed hostnames
  - Example: `improved-tribble-production.up.railway.app,vantahire.com,www.vantahire.com`
  - Prevents host header injection attacks
- `SEED_DEFAULTS=false` **[REQUIRED for production]**
  - Prevents test data from being created in production
  - Set to `true` only in development environments
- `ADMIN_PASSWORD` **[REQUIRED on first deployment]**
  - Set a secure password for the admin account
  - Used only for initial account creation; can be removed after first deployment
  - Password will be hashed using scrypt

### Optional Features
- Cloudinary for resume uploads (files validated using magic bytes):
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Email sending (choose one; defaults to Ethereal previews if unset):
  - Brevo (Sendinblue) via SMTP:
    - `EMAIL_PROVIDER=brevo`
    - `SEND_FROM_EMAIL=no-reply@yourdomain.com`
    - `SEND_FROM_NAME=VantaHire`
    - `NOTIFICATION_EMAIL=alerts@yourdomain.com` (optional)
    - `BREVO_SMTP_HOST=smtp-relay.brevo.com` (default)
    - `BREVO_SMTP_PORT=587` (default; use 465 for SSL)
    - `BREVO_SMTP_USER=apikey` (default)
    - `BREVO_SMTP_PASSWORD=<your-brevo-smtp-key>`
- SpotAxis integration:
  - `SPOTAXIS_BASE_URL` (e.g. `https://your-spotaxis-app.railway.app`)
  - `SPOTAXIS_CAREERS_URL` (e.g. `https://org-subdomain.your-spotaxis.com/jobs/`)
- Email automation (ATS):
  - `EMAIL_AUTOMATION_ENABLED` = `true` to auto-send emails on stage changes, scheduling, and application received
- Cron scheduler (job expiration, cleanup):
  - `ENABLE_SCHEDULER` = `true` to enable scheduled tasks (set on ONE instance only in multi-instance deployments)

## 3) Build & Deployment Configuration

**Important**: This service (VantaHireWebsite) uses **Nixpacks** for deployment, not the root Dockerfile.

### Configuration Files:
- `VantaHireWebsite/railway.json` - Defines the build/deploy configuration
- Root `Dockerfile` - Used for SpotAxis (Python app), **NOT** for this service

### Build & Start Commands:
The repo already defines:
- Build: `npm run build`
- Start: `npm start`

Railway auto-detects Node via `VantaHireWebsite/railway.json` and runs these commands. No Procfile is required for this service.

## 4) Health Check
Configure Railway’s health check path to `/api/health` (200 OK when healthy).

## 5) Deploy Steps
- Connect the GitHub repo to Railway or push to a Railway Git repository.
- Set variables in Railway as described above.
- Optional: set `MIGRATE_ON_START=true` in your Web service to auto-apply schema (drizzle-kit push) on boot.
- Deploy. Railway builds the client to `dist/public` and the server to `dist/index.js`.
- On successful start, logs include the bound port and optional SpotAxis config.

## 6) SpotAxis Integration (optional)
When `SPOTAXIS_BASE_URL` is set:
- VantaHire proxies SpotAxis job listings/details.
- Job details show “Apply on SpotAxis” if an application URL exists.
- Recruiter dashboard and job post page surface helper links:
  - `/spotaxis/admin`, `/spotaxis/recruiter`, `/spotaxis/job/new`, `/spotaxis/jobs`

If you deploy SpotAxis separately on Railway, use its public URL as `SPOTAXIS_BASE_URL`.

## 7) Security Notes

### Phase 1 & 2 Security Improvements Implemented:
- ✅ **Session Security**: SameSite cookies, required SESSION_SECRET
- ✅ **Admin Endpoints**: Protected with role-based access control
- ✅ **PII Protection**: Response bodies never logged
- ✅ **Test Data**: Only created in development (gated by SEED_DEFAULTS)
- ✅ **Host Header Validation**: Prevents injection attacks (ALLOWED_HOSTS)
- ✅ **CSP**: Strict Content Security Policy in production
- ✅ **Database SSL**: Certificate verification enabled in production

### Phase 3 & 4 Improvements:
- ✅ **File Upload Security**: Magic byte validation (not just MIME type)
- ✅ **AI Model Metadata**: Accurate tracking (Groq llama-3.3-70b-versatile)
- ✅ **SEO**: robots.txt and sitemap.xml included
- ✅ **Code Cleanup**: Removed unused WhatsApp webhooks and duplicate email service

### Phase 5 Security & Infrastructure Improvements:
- ✅ **CSRF Protection**: Double-submit cookie pattern on all mutating endpoints (POST/PATCH/DELETE)
- ✅ **Candidate Authorization**: Applications bound to userId, not email comparison
- ✅ **Automation Settings**: Whitelisted valid keys to prevent arbitrary injection
- ✅ **Cron Scheduler**: Gated by ENABLE_SCHEDULER env var for multi-instance safety
- ✅ **Database Indexes**: Performance indexes on jobs (status, postedBy, isActive) and applications (status)
- ✅ **Test Stack**: Standardized on Vitest, removed Jest
- ✅ **Repository Hygiene**: Updated .gitignore for test artifacts and IDE files

### Verification Checklist:
Before deploying, verify:
- [ ] `SESSION_SECRET` is set (minimum 32 random characters)
- [ ] `ALLOWED_HOSTS` includes all production domains
- [ ] `SEED_DEFAULTS=false` in production
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` is correct and SSL-enabled
- [ ] `ADMIN_PASSWORD` is set for initial deployment

## 8) Database Migrations

### Automatic Migrations (Recommended)
The application automatically runs migrations on startup via `ensureAtsSchema()` in `server/index.ts`. This includes:
- Creating ATS tables (pipeline_stages, email_templates, etc.)
- Adding userId column to applications table
- Creating performance indexes on jobs and applications tables

No manual intervention required - migrations run on every deployment.

### Manual Migration (Optional)
If you need to run migrations manually:
```bash
npm run db:push
```

This runs the standalone migration script at `server/scripts/runMigrations.ts`.

## 9) Troubleshooting
- Port binding: ensure the app logs show it's listening on the PORT Railway provided.
- Database: verify `DATABASE_URL` and SSL options.
  - Railway Postgres: set `DATABASE_URL` and (if needed) `DATABASE_SSL=true`.
  - Neon: ensure `DATABASE_URL` points to `.neon.tech` and includes `sslmode=require`.
- Missing tables (e.g., `relation "users" does not exist`):
  - Migrations run automatically on startup
  - Check logs for "✅ ATS schema ready" confirmation
  - If issues persist, run `npm run db:push` manually
- Cloudinary: if unset, file upload falls back to placeholders (info logged).
- Emails: current implementation uses Nodemailer Ethereal for testing; replace with a real provider for production.
- CSRF errors (403 on POST/PATCH/DELETE): Ensure client is fetching CSRF token from `/api/csrf-token` and including it in headers.
