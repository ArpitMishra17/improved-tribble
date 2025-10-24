# Forms Feature - Complete Implementation Guide

## Overview

The Forms Feature enables recruiters to send custom questionnaires to candidates and collect structured responses. This feature includes comprehensive security measures, file upload support, and CSV export capabilities.

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Security Features](#security-features)
5. [Frontend Components](#frontend-components)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Usage Guide](#usage-guide)

---

## Architecture

### Tech Stack
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas
- **File Storage**: Cloudinary with magic-byte validation
- **Rate Limiting**: express-rate-limit
- **Frontend**: React with Wouter routing
- **UI Components**: shadcn/ui with Tailwind CSS

### Design Patterns
- **Modular Router**: Separate forms router (`server/forms.routes.ts`)
- **Field Snapshots**: Immutable JSON snapshots preserve form structure
- **Token-Based Auth**: Public forms use 32-byte base64url tokens
- **Transaction Locks**: Prevent double-submission with row-level locking
- **CSRF Protection**: Double-submit cookie pattern for authenticated endpoints

---

## Database Schema

### Tables

#### `forms`
```sql
CREATE TABLE forms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

#### `form_fields`
```sql
CREATE TABLE form_fields (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- short_text, long_text, yes_no, select, date, file, email
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options TEXT, -- JSON array for select fields
  "order" INTEGER NOT NULL
);
```

#### `form_invitations`
```sql
CREATE TABLE form_invitations (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  form_id INTEGER NOT NULL REFERENCES forms(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, viewed, answered, expired, failed
  sent_by INTEGER NOT NULL REFERENCES users(id),
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  answered_at TIMESTAMP,
  field_snapshot TEXT NOT NULL, -- JSON snapshot of form fields at invitation time
  custom_message TEXT,
  reminder_sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

#### `form_responses`
```sql
CREATE TABLE form_responses (
  id SERIAL PRIMARY KEY,
  invitation_id INTEGER NOT NULL REFERENCES form_invitations(id) ON DELETE CASCADE UNIQUE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

#### `form_response_answers`
```sql
CREATE TABLE form_response_answers (
  id SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES form_fields(id),
  value TEXT,
  file_url TEXT
);
```

### Indexes
```sql
CREATE INDEX forms_created_by_idx ON forms(created_by);
CREATE INDEX forms_is_published_idx ON forms(is_published);
CREATE INDEX form_fields_form_id_order_idx ON form_fields(form_id, "order");
CREATE INDEX form_invitations_token_idx ON form_invitations(token);
CREATE INDEX form_invitations_app_status_idx ON form_invitations(application_id, status);
CREATE INDEX form_invitations_created_at_idx ON form_invitations(created_at);
CREATE INDEX form_invitations_form_id_idx ON form_invitations(form_id);
CREATE INDEX form_responses_application_id_idx ON form_responses(application_id);
CREATE INDEX form_response_answers_response_id_idx ON form_response_answers(response_id);
```

---

## API Endpoints

### Template Management (Authenticated)

#### `POST /api/forms/templates`
Create a new form template with fields.

**Auth**: Recruiter or Admin
**CSRF**: Required

**Request**:
```json
{
  "name": "Additional Information",
  "description": "Request additional details from candidate",
  "isPublished": true,
  "fields": [
    {
      "type": "short_text",
      "label": "What is your expected salary?",
      "required": false,
      "order": 0
    },
    {
      "type": "date",
      "label": "Earliest start date?",
      "required": true,
      "order": 1
    }
  ]
}
```

**Response**: `201 Created`
```json
{
  "id": 1,
  "name": "Additional Information",
  "description": "...",
  "isPublished": true,
  "createdBy": 5,
  "fields": [...]
}
```

#### `GET /api/forms/templates`
List templates visible to current user.

**Auth**: Recruiter or Admin

**Visibility Rules**:
- **Admins**: See ALL templates (published + drafts)
- **Recruiters**: See published templates OR their own templates

**Response**: `200 OK`
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Additional Information",
      "description": "...",
      "isPublished": true,
      "fields": [...]
    }
  ]
}
```

#### `GET /api/forms/templates/:id`
Get single template by ID.

**Auth**: Recruiter or Admin
**Ownership**: Admins can access all, recruiters only their own

#### `PATCH /api/forms/templates/:id`
Update template (name, description, isPublished, or fields).

**Auth**: Recruiter or Admin
**CSRF**: Required
**Transaction**: Field replacement is atomic

**Request**:
```json
{
  "name": "Updated Name",
  "fields": [...]
}
```

#### `DELETE /api/forms/templates/:id`
Delete template (blocked if invitations exist).

**Auth**: Recruiter or Admin
**CSRF**: Required

### Invitation Management (Authenticated)

#### `POST /api/forms/invitations`
Send form invitation to candidate.

**Auth**: Recruiter or Admin
**CSRF**: Required
**Rate Limit**: 50 per day per recruiter

**Request**:
```json
{
  "applicationId": 42,
  "formId": 1,
  "customMessage": "Please complete this at your earliest convenience."
}
```

**Validation**:
- ✅ Ownership check: `job.postedBy === user.id`
- ✅ Template access: Own template OR published
- ✅ Duplicate prevention: No pending/sent invitations for same form+application

**Response**: `201 Created`
```json
{
  "invitation": {
    "id": 10,
    "token": "...",
    "status": "sent",
    "expiresAt": "2024-02-15T00:00:00.000Z"
  },
  "emailStatus": "sent",
  "previewUrl": "http://ethereal.email/messages" // Development only
}
```

#### `GET /api/forms/invitations?applicationId=X`
List invitations for an application.

**Auth**: Recruiter or Admin
**Ownership**: Verified via job.postedBy

**Response**: `200 OK`
```json
{
  "invitations": [
    {
      "id": 10,
      "formId": 1,
      "token": "...",
      "status": "answered",
      "sentAt": "...",
      "answeredAt": "...",
      "form": { "id": 1, "name": "Additional Information" }
    }
  ]
}
```

### Public Endpoints (No Auth, CSRF-Exempt)

#### `GET /api/forms/public/:token`
Retrieve form for candidate to fill out.

**Rate Limit**: 10 per minute per IP

**Status Codes**:
- `200 OK`: Form retrieved successfully
- `403 Forbidden`: Invalid token
- `409 Conflict`: Already submitted
- `410 Gone`: Expired (invitation marked as expired)

**Response**: `200 OK`
```json
{
  "formName": "Additional Information",
  "formDescription": "...",
  "fields": [
    {
      "id": 1,
      "type": "short_text",
      "label": "What is your expected salary?",
      "required": false,
      "order": 0
    }
  ],
  "expiresAt": "2024-02-15T00:00:00.000Z"
}
```

**Side Effects**:
- Sets `viewedAt` timestamp on first view
- Updates status to `'viewed'` if currently `'pending'` or `'sent'`

#### `POST /api/forms/public/:token/upload`
Upload file for file-type fields.

**Rate Limit**: 10 per minute per IP
**Validation**: Magic-byte validation (not just MIME type)

**Request**: `multipart/form-data` with `file` field

**Response**: `200 OK`
```json
{
  "fileUrl": "https://cloudinary.com/...",
  "filename": "resume.pdf",
  "size": 251234
}
```

**Status Codes**:
- `200 OK`: File uploaded successfully
- `400 Bad Request`: No file provided
- `403 Forbidden`: Invalid token
- `409 Conflict`: Already submitted
- `410 Gone`: Expired
- `500 Internal Server Error`: Upload failed

#### `POST /api/forms/public/:token/submit`
Submit form answers.

**Rate Limit**: 10 per minute per IP

**Request**:
```json
{
  "answers": [
    {
      "fieldId": 1,
      "value": "100000-120000"
    },
    {
      "fieldId": 2,
      "value": "2024-03-01"
    },
    {
      "fieldId": 3,
      "fileUrl": "https://cloudinary.com/..."
    }
  ]
}
```

**Validation**:
- ✅ Required fields present
- ✅ Email format (for email fields)
- ✅ Select options (value must be in allowed options)
- ✅ Date format (must be parseable)
- ✅ Yes/No values (`yes`, `no`, `true`, `false`)

**Transaction**:
1. Lock invitation row (`FOR UPDATE`)
2. Re-validate token, expiry, status
3. Validate all answers against field snapshot
4. Create response record
5. Insert all answers
6. Mark invitation as `'answered'`

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Thank you! Your response has been submitted successfully."
}
```

### Response Viewing (Authenticated)

#### `GET /api/forms/responses?applicationId=X`
List response summaries for an application.

**Auth**: Recruiter or Admin
**Ownership**: Verified via job.postedBy

**Response**: `200 OK`
```json
{
  "responses": [
    {
      "id": 5,
      "formName": "Additional Information",
      "submittedAt": "2024-01-20T10:30:00.000Z",
      "invitationId": 10,
      "answeredAt": "2024-01-20T10:30:00.000Z"
    }
  ]
}
```

#### `GET /api/forms/responses/:id`
Get detailed response with questions and answers.

**Auth**: Recruiter or Admin
**Ownership**: Verified via job.postedBy

**Response**: `200 OK`
```json
{
  "id": 5,
  "formName": "Additional Information",
  "formDescription": "...",
  "submittedAt": "2024-01-20T10:30:00.000Z",
  "candidateName": "John Doe",
  "candidateEmail": "john@example.com",
  "questionsAndAnswers": [
    {
      "fieldId": 1,
      "question": "What is your expected salary?",
      "fieldType": "short_text",
      "answer": "100000-120000",
      "fileUrl": null
    }
  ]
}
```

#### `GET /api/forms/export?applicationId=X&format=csv`
Export responses to CSV.

**Auth**: Recruiter or Admin
**Ownership**: Verified via job.postedBy

**Response**: `200 OK` (CSV file download)

**CSV Format**:
```csv
Application ID,Candidate Name,Candidate Email,Form Name,Submitted At,Question,Answer,File URL
42,John Doe,john@example.com,Additional Information,2024-01-20T10:30:00.000Z,Expected salary?,100000-120000,
```

**CSV Escaping**:
- Quotes, commas, newlines properly escaped
- Compatible with Excel, Google Sheets

---

## Security Features

### Authentication & Authorization
- ✅ Session-based auth for internal endpoints
- ✅ Role-based access control (recruiter, admin)
- ✅ Ownership verification (`job.postedBy === user.id`)
- ✅ Template access guard (recruiters: own or published only)
- ✅ Admin oversight (admins see all templates)

### CSRF Protection
- ✅ Double-submit cookie pattern
- ✅ Applied to all mutating endpoints (POST/PATCH/DELETE)
- ✅ Public endpoints CSRF-exempt (token-based auth)

### Rate Limiting
- ✅ Public endpoints: 10 requests/minute per IP
- ✅ Invitation creation: 50 per day per recruiter
- ✅ Standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`)

### Token Security
- ✅ 32-byte random tokens (base64url encoding)
- ✅ Single-use (marked answered after submission)
- ✅ Time-limited (configurable expiry, default 14 days)
- ✅ Status tracking (prevents reuse)

### File Upload Security
- ✅ Magic-byte validation (not just MIME type)
- ✅ Size limits enforced by Cloudinary
- ✅ Token validation before upload
- ✅ Rate limiting (10/min per IP)

### Data Integrity
- ✅ Transaction locks prevent double-submit
- ✅ Field snapshots preserve form structure
- ✅ Foreign key constraints
- ✅ Cascading deletes configured properly

---

## Frontend Components

### Public Form Page
**Path**: `/form/:token`
**File**: `client/src/pages/public-form-page.tsx`

**Features**:
- Mobile-responsive Tailwind UI
- Dynamic field rendering (7 field types)
- Client-side validation
- File upload with progress indicator
- Error handling (expired, already submitted, invalid token)
- Success confirmation

**Field Types**:
- `short_text` - Single-line text input
- `long_text` - Multi-line textarea
- `email` - Email input with validation
- `yes_no` - Yes/No dropdown
- `select` - Dropdown with custom options
- `date` - Date picker
- `file` - File upload with metadata display

### Forms Modal
**File**: `client/src/components/FormsModal.tsx`

**Features**:
- Send new form invitations
- View sent forms with status badges
- View detailed responses (Q/A format)
- CSV export button
- Invitation status tracking

**Status Badges**:
- 🕒 **Pending**: Not sent yet
- 📧 **Sent**: Email delivered
- 👁️ **Viewed**: Candidate opened form
- ✅ **Answered**: Form submitted
- ⏰ **Expired**: Invitation expired
- ❌ **Failed**: Email send failed

### Application Card Integration
**File**: `client/src/pages/application-management-page.tsx`

**Features**:
- "Forms" button on each application card
- Opens FormsModal when clicked
- Integrated with existing ATS workflow

---

## Testing

### Test Suite
**File**: `test/integration/forms.test.ts`
**Framework**: Vitest + Supertest

### Coverage Areas

#### Template CRUD ✅
- Create template with fields
- List templates (visibility rules)
- Update template (atomic field replacement)
- Delete template (blocked if invitations exist)
- Validation (missing fields, invalid types)

#### Invitations ✅
- Create invitation with field snapshot
- Duplicate prevention (pending/sent blocked)
- Template access guard enforcement
- Ownership verification (job.postedBy)
- Email sending and audit logging

#### Public Form GET ✅
- Invalid token (403)
- Expired invitation (410, marks expired)
- Already submitted (409)
- First view (sets viewedAt, status='viewed')
- Returns correct field snapshot

#### Public Form POST ✅
- Transaction lock prevents double-submit
- Required field validation
- Email format validation
- Select options validation
- Date format validation
- Yes/No values validation
- Saves answers correctly
- Marks invitation as answered

#### Public File Upload ✅
- Token validation (403/410/409)
- Magic-byte validation
- Returns file metadata (fileUrl, filename, size)
- Rate limiting enforced

#### Response Viewing ✅
- List summaries
- Detail with Q/A mapping (via snapshot)
- CSV export format and escaping
- Ownership verification

#### Rate Limiting ✅
- Headers present (`RateLimit-*`)
- Limits enforced (10/min public, 50/day invitations)

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test:coverage

# Run in watch mode
npm test:watch

# Run specific test file
npm test test/integration/forms.test.ts
```

### Test Factories
**File**: `test/factories.ts`

Functions:
- `createMockFormTemplate()`
- `createMockFormInvitation()`
- `createMockFormAnswers(fields)`

---

## Deployment

### Environment Variables

#### Required
```env
# Base URL for form links in emails (MUST be HTTPS in production)
BASE_URL=https://vantahire.com
```

#### Optional (with defaults)
```env
# Form invitation expiry (days)
FORM_INVITE_EXPIRY_DAYS=14

# Public endpoint rate limit (requests per minute per IP)
FORM_PUBLIC_RATE_LIMIT=10

# Invitation creation rate limit (per day per recruiter)
FORM_INVITE_DAILY_LIMIT=50
```

### Database Migrations
Migrations run automatically on startup via `ensureAtsSchema()`.

Tables created:
- `forms`
- `form_fields`
- `form_invitations`
- `form_responses`
- `form_response_answers`

Indexes created for optimal query performance.

### Seeding Default Templates
```bash
npm run seed:forms
```

Creates 3 default templates:
1. **Additional Information Request** (6 fields)
2. **Availability & Scheduling** (6 fields)
3. **Professional References** (12 fields)

Idempotent - safe to run multiple times.

### Railway Deployment
See `DEPLOY_RAILWAY.md` for complete deployment guide.

**Checklist**:
- ✅ Set `BASE_URL` to HTTPS production URL
- ✅ Configure `CLOUDINARY_*` for file uploads
- ✅ Set `EMAIL_PROVIDER` for production emails
- ✅ Run `npm run seed:forms` after first deployment

---

## Usage Guide

### For Recruiters

#### 1. Create Form Template
1. Navigate to Application Management page
2. Click on any application
3. Click "Forms" button
4. In Forms modal, select a template from dropdown
5. Add custom message (optional)
6. Click "Send Form"

#### 2. View Responses
1. Open Forms modal for application
2. Sent forms appear in "Sent Forms" section
3. Status badge shows current state
4. Click "View Response" button when answered
5. See Q/A format with all answers

#### 3. Export to CSV
1. Open Forms modal
2. Click "Export CSV" button
3. Download includes all responses for application

### For Candidates

#### 1. Receive Email
Email contains:
- Form name
- Custom message from recruiter
- Link to form: `https://vantahire.com/form/TOKEN`
- Expiration date

#### 2. Fill Out Form
1. Click link in email
2. Fill out all required fields (marked with *)
3. Upload files if requested
4. Click "Submit Form"

#### 3. Confirmation
- See success message
- Cannot submit again (link disabled)
- Recruiter notified of submission

### For Admins

#### 1. Template Management
- See ALL templates (published + drafts)
- Can send any template
- Can edit/delete any template

#### 2. Oversight
- Monitor invitation activity
- View all responses
- Export data for compliance

---

## Troubleshooting

### Email Not Sending
**Symptom**: Invitation status shows "failed"

**Solutions**:
1. Check `EMAIL_PROVIDER` configuration
2. Verify SMTP credentials in `.env`
3. In development, emails go to Ethereal (check `previewUrl`)
4. Check `email_audit_log` table for error messages

### Form Link Not Working
**Symptom**: 403 Invalid Token or 410 Expired

**Solutions**:
1. Verify link hasn't expired (check expiration in email)
2. Ensure candidate hasn't already submitted
3. Check `form_invitations` table status column
4. Resend invitation if needed

### File Upload Failing
**Symptom**: Upload error or 500 response

**Solutions**:
1. Verify Cloudinary credentials configured
2. Check file size (may exceed limits)
3. Ensure file type is supported
4. Check browser console for errors

### Double Submit Protection
**Symptom**: "Already submitted" error

**How it works**:
- Transaction with row lock (`FOR UPDATE`)
- Prevents race conditions
- Status checked inside transaction
- Expected behavior - not a bug

### CSV Export Empty
**Symptom**: No responses in export

**Solutions**:
1. Verify candidate has submitted (status = 'answered')
2. Check ownership (only see your own job applications)
3. Ensure `form_responses` and `form_response_answers` populated

---

## API Reference Summary

| Endpoint | Method | Auth | CSRF | Rate Limit | Purpose |
|----------|--------|------|------|------------|---------|
| `/api/forms/templates` | GET | ✅ | ❌ | - | List templates |
| `/api/forms/templates` | POST | ✅ | ✅ | - | Create template |
| `/api/forms/templates/:id` | GET | ✅ | ❌ | - | Get template |
| `/api/forms/templates/:id` | PATCH | ✅ | ✅ | - | Update template |
| `/api/forms/templates/:id` | DELETE | ✅ | ✅ | - | Delete template |
| `/api/forms/invitations` | POST | ✅ | ✅ | 50/day | Send invitation |
| `/api/forms/invitations` | GET | ✅ | ❌ | - | List invitations |
| `/api/forms/public/:token` | GET | ❌ | ❌ | 10/min | Get form |
| `/api/forms/public/:token/upload` | POST | ❌ | ❌ | 10/min | Upload file |
| `/api/forms/public/:token/submit` | POST | ❌ | ❌ | 10/min | Submit answers |
| `/api/forms/responses` | GET | ✅ | ❌ | - | List responses |
| `/api/forms/responses/:id` | GET | ✅ | ❌ | - | Get response |
| `/api/forms/export` | GET | ✅ | ❌ | - | Export CSV |

---

## Version History

### v1.0.0 (Current)
- ✅ Complete backend API
- ✅ Public form page with file uploads
- ✅ Forms modal in recruiter dashboard
- ✅ Comprehensive test suite
- ✅ Production deployment guide
- ✅ Default template seeds

### Future Enhancements (Roadmap)
- 📋 Template library with categories
- 🔔 Reminder emails for pending invitations
- 📊 Analytics dashboard (response rates, completion times)
- 🎨 Form theming and branding
- 📱 Mobile app support
- 🔗 Webhook integrations
- 🤖 AI-powered form suggestions
- 📧 Multi-language email templates

---

## Support & Contributing

### Reporting Issues
1. Check existing issues in repository
2. Include error messages and logs
3. Provide reproduction steps
4. Note environment (dev/staging/prod)

### Contributing
1. Write tests for new features
2. Follow existing code style
3. Update documentation
4. Run `npm test` before submitting PR
5. Ensure CSRF protection on authenticated endpoints

---

**Last Updated**: January 2024
**Maintained By**: VantaHire Engineering Team
