# VantaHire Critical Issues - Quick Reference

**Status**: 🔴 **NOT PRODUCTION READY**
**Critical Issues**: 7 blockers (code-verified)
**Estimated Fix Time**: 3-5 hours

---

## 🚨 PRODUCTION BLOCKERS (Fix Before Deployment)

### 1. Admin Password Bypass (15 min fix)
```typescript
// FILE: VantaHireWebsite/server/auth.ts:85-91
// ISSUE: Admin password compared as plaintext, bypasses scrypt hashing
// FIX: Remove ADMIN_PASSWORD bypass after initial bootstrap
```

### 2. Hardcoded Test Credentials (30 min fix)
```typescript
// FILE: VantaHireWebsite/server/createAdminUser.ts:69,79,90
// ISSUE: Creates "recruiter/recruiter123" on every boot, logs password
// FIX: Gate with if (NODE_ENV !== 'production' && SEED_DEFAULTS === 'true')
```

### 3. Unprotected PII Endpoints (10 min fix)
```typescript
// FILE: VantaHireWebsite/server/routes.ts:178,187
// ISSUE: /api/contact and /api/test-email have NO authentication
// FIX: Add requireRole(['admin']) to both endpoints
```

### 4. Weak Session Secret (15 min fix) ✅ PostgreSQL sessions OK
```typescript
// FILE: VantaHireWebsite/server/auth.ts:58,66-68
// ISSUE: Defaults to 'vantahire-dev-secret', missing SameSite
// NOTE: Sessions ARE properly stored in PostgreSQL (GOOD)
// FIX:
if (NODE_ENV === 'production' && !SESSION_SECRET) {
  throw new Error('SESSION_SECRET required');
}
cookie: { sameSite: 'lax', httpOnly: true, secure: true }
```

### 5. Over-Permissive CSP (1-2 hrs fix)
```typescript
// FILE: VantaHireWebsite/server/routes.ts:30
// ISSUE: 'unsafe-inline' and 'unsafe-eval' in production
// FIX: Branch on NODE_ENV, remove unsafe directives in prod
```

### 6. PII in Logs (30 min fix)
```typescript
// FILE: VantaHireWebsite/server/index.ts:43-61
// ISSUE: Wraps res.json, logs full response (GDPR violation)
// FIX: Remove response body logging, keep only method/path/status/duration
```

### 7. File Upload MIME Bypass (2-3 hrs fix)
```typescript
// FILE: VantaHireWebsite/server/cloudinary.ts:16-47
// ISSUE: Only checks mimetype (client-controlled, spoofable)
// ALSO: Memory storage can spike RAM
// FIX: Use magic byte validation or direct-to-Cloudinary uploads
```

### 7. Webhook Without Validation (1-2 hrs fix)
```typescript
// FILE: VantaHireWebsite/server/routes.ts:1401,1409
// PATHS: POST /api/whatsapp/incoming, POST /api/whatsapp/status
// ISSUE: WhatsApp webhooks accept any payload, no signature check
// FIX: Validate X-Hub-Signature-256 header with HMAC-SHA256
```

---

## 🔧 QUICK FIXES (Can Complete in 90 Minutes)

```bash
# 1. Protect admin endpoints (10 min)
# In routes.ts:178
app.get("/api/contact", requireRole(['admin']), async (req, res) => {

# 2. Add .gitignore entry (5 min)
echo "test/test-results/" >> .gitignore

# 3. Require session secret (10 min)
# In auth.ts:58
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}

# 4. Add SameSite cookie (5 min)
# In auth.ts:66
cookie: { sameSite: 'lax', httpOnly: true, secure: true }

# 5. Fix SSL config (5 min)
# In db.ts:26
ssl: { rejectUnauthorized: true }

# 6. Validate host header (10 min)
# In index.ts:29
const ALLOWED_HOSTS = ['vantahire.com', 'www.vantahire.com'];
if (!ALLOWED_HOSTS.includes(req.headers.host)) return next();

# 7. Remove password logging (5 min)
# In createAdminUser.ts:90
// DELETE: console.log('Test recruiter password:', password);

# 8. Fix AI model name (10 min)
# In routes.ts:1307,1313
model: "llama-3.3-70b-versatile" // Match aiJobAnalyzer.ts

# 9. Gate dev seeding (15 min)
# In index.ts:106
if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEFAULTS === 'true') {

# 10. Remove PII logging (15 min)
# In index.ts:51
// DELETE: response: JSON.stringify(res.locals.data || {}).substring(0, 200)
```

---

## 📋 VERIFICATION CHECKLIST

Before deploying to production, verify:

- [ ] Admin password uses scrypt hashing (no plaintext bypass)
- [ ] No test credentials auto-created in production
- [ ] SESSION_SECRET is set and not default value
- [ ] /api/contact requires admin authentication
- [ ] /api/test-email requires admin authentication
- [ ] Cookie has `sameSite: 'lax'` configured
- [ ] CSP doesn't allow 'unsafe-inline' in production
- [ ] Response bodies not logged (no PII in logs)
- [ ] File uploads validate magic bytes, not just MIME type
- [ ] Webhook endpoints validate signatures
- [ ] SSL rejectUnauthorized is true
- [ ] Host header is validated against whitelist
- [ ] Test data seeding is disabled in production

---

## 🎯 PHASE 1 IMPLEMENTATION ORDER

**Total Time**: ~3-5 hours (code-verified)

1. **Security Hardening** (90 min)
   - Require SESSION_SECRET in production
   - Add SameSite cookie flag
   - Fix SSL configuration
   - Validate host headers

2. **Access Control** (45 min)
   - Add requireRole to /api/contact
   - Add requireRole to /api/test-email
   - Remove admin password bypass
   - Gate dev/test data seeding

3. **Privacy & Compliance** (45 min)
   - Remove PII from logs
   - Remove password console.log statements
   - Add .gitignore for test artifacts

4. **Input Validation** (90-120 min)
   - Implement webhook signature validation
   - Add file upload magic byte validation
   - Add CSRF protection (phase 2, but start here if time)

---

## 🔍 TESTING AFTER FIXES

```bash
# 1. Test admin endpoints require auth
curl http://localhost:5000/api/contact
# Should return 401 or 403

# 2. Test session secret requirement
unset SESSION_SECRET
NODE_ENV=production npm start
# Should fail with error

# 3. Test no test credentials created
grep -r "recruiter123" logs/
# Should return nothing

# 4. Test cookies have SameSite
curl -I http://localhost:5000/api/login
# Should show Set-Cookie with SameSite=lax

# 5. Test CSP in production
NODE_ENV=production npm start
curl -I http://localhost:5000
# Should NOT show 'unsafe-inline' in Content-Security-Policy header
```

---

## 📞 ESCALATION

If any of these issues cannot be fixed in Phase 1:

1. **Do NOT deploy to production**
2. Document why the issue cannot be fixed
3. Implement compensating controls (WAF rules, network isolation, etc.)
4. Get security team approval before proceeding

---

## 📊 RISK ASSESSMENT

| Issue | Exploitability | Impact | Risk Score |
|-------|----------------|--------|------------|
| Admin password bypass | HIGH | CRITICAL | 9.5/10 |
| Hardcoded credentials | HIGH | HIGH | 8.5/10 |
| Unprotected PII endpoint | HIGH | HIGH | 8.5/10 |
| Weak session secret ✅ | MEDIUM | HIGH | 7.5/10 |
| PII in logs | LOW | HIGH | 7.0/10 |
| File upload bypass | MEDIUM | HIGH | 7.0/10 |
| Webhook injection | MEDIUM | MEDIUM | 6.5/10 |

**✅ Session storage uses PostgreSQL (verified correct) - only secret and SameSite need fixing**

**Overall Risk**: 🔴 **HIGH** - Do not deploy until Phase 1 complete

---

**Last Updated**: 2025-10-23 (Code-verified)
**Verification**: 93% accuracy (14/15 findings correct)
**Next Review**: After Phase 1 fixes implemented
**Owner**: Development team
