# VantaHire Error Handling - Fix Examples

This document provides specific code examples for fixing the identified error handling issues.

---

## CRITICAL FIXES

### 1. Fix: Unvalidated Automation Settings Key (Line 720)

**BEFORE (Current - INSECURE):**
```typescript
app.patch("/api/admin/automation-settings/:key", requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;  // ⚠️ NO VALIDATION
      const { value } = req.body;
      
      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: 'value must be a boolean' });
      }
      
      const setting = await storage.updateAutomationSetting(key, value, req.user!.id);
      res.json(setting);
    } catch (e) { next(e); }
  }
);
```

**AFTER (SECURE):**
```typescript
// Add at top of routes.ts
const validAutomationKeys = z.enum(['emailAutomation', 'smsAutomation', 'slackNotification']);

app.patch("/api/admin/automation-settings/:key", requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyValidation = validAutomationKeys.safeParse(req.params.key);
      if (!keyValidation.success) {
        return res.status(400).json({ 
          error: 'Invalid setting key',
          details: keyValidation.error.errors 
        });
      }
      
      const { value } = req.body;
      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: 'value must be a boolean' });
      }
      
      const setting = await storage.updateAutomationSetting(
        keyValidation.data, 
        value, 
        req.user!.id
      );
      res.json(setting);
    } catch (e) { next(e); }
  }
);
```

---

### 2. Fix: Bulk Operations Without Validation (Line 894)

**BEFORE (Current - VULNERABLE TO DoS):**
```typescript
app.patch("/api/applications/bulk", requireRole(['recruiter', 'admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationIds, status, notes } = req.body;
      
      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(400).json({ error: "applicationIds must be a non-empty array" });
      }
      
      // ⚠️ NO TYPE CHECKING, NO SIZE LIMIT
      if (!['submitted', 'reviewed', 'shortlisted', 'rejected', 'downloaded'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const updatedCount = await storage.updateApplicationsStatus(
        applicationIds.map(id => parseInt(id)), 
        status, 
        notes
      );
      // ...
    } catch (error) { next(error); }
  }
);
```

**AFTER (SECURE WITH LIMITS):**
```typescript
const bulkUpdateSchema = z.object({
  applicationIds: z.array(z.number().int().positive()).min(1).max(100),
  status: z.enum(['submitted', 'reviewed', 'shortlisted', 'rejected', 'downloaded']),
  notes: z.string().max(5000).optional(),
});

app.patch("/api/applications/bulk", requireRole(['recruiter', 'admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = bulkUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation error',
          details: validation.error.errors 
        });
      }
      
      const { applicationIds, status, notes } = validation.data;
      
      // Verify all applications belong to recruiter's jobs (if not admin)
      if (req.user!.role !== 'admin') {
        const applications = await Promise.all(
          applicationIds.map(id => storage.getApplication(id))
        );
        
        const jobIds = applications
          .filter(app => app)
          .map(app => app!.jobId);
        
        const jobs = await Promise.all(
          jobIds.map(id => storage.getJob(id))
        );
        
        const unauthorizedJob = jobs.find(job => !job || job.postedBy !== req.user!.id);
        if (unauthorizedJob) {
          return res.status(403).json({ error: "Access denied to one or more applications" });
        }
      }
      
      const updatedCount = await storage.updateApplicationsStatus(
        applicationIds, 
        status, 
        notes
      );
      
      res.json({ 
        success: true, 
        updatedCount,
        message: `${updatedCount} applications updated successfully` 
      });
    } catch (error) { next(error); }
  }
);
```

---

### 3. Fix: Fire-and-Forget Email Promises Without Audit (Multiple Lines)

**BEFORE (Current - NO TRACKING):**
```typescript
// Lines 351-354
const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
if (autoEmails) {
  sendApplicationReceivedEmail(application.id).catch(err => console.error('Application received email error:', err));
}

// Lines 580, 583, 586, 648 - Similar patterns
```

**AFTER (WITH AUDIT LOGGING):**
```typescript
const autoEmails = process.env.EMAIL_AUTOMATION_ENABLED === 'true' || process.env.EMAIL_AUTOMATION_ENABLED === '1';
if (autoEmails) {
  sendApplicationReceivedEmail(application.id)
    .then(() => {
      // Log success (already done in emailTemplateService, but good to track)
      console.log(`Application received email sent for application ${application.id}`);
    })
    .catch(err => {
      console.error(`Failed to send application received email for application ${application.id}:`, err);
      // Log failure to database for monitoring
      storage.logEmailFailure(
        application.id,
        'application_received',
        err instanceof Error ? err.message : String(err)
      ).catch(logErr => console.error('Failed to log email failure:', logErr));
    });
}

// For stage changes, offer email:
if (autoEmails && stageName.includes('offer')) {
  sendOfferEmail(appId)
    .catch(err => {
      console.error(`Failed to send offer email for application ${appId}:`, err);
      storage.logEmailFailure(appId, 'offer', err instanceof Error ? err.message : String(err))
        .catch(logErr => console.error('Failed to log email failure:', logErr));
    });
}
```

**Also, add to storage.ts:**
```typescript
async logEmailFailure(
  applicationId: number,
  emailType: string,
  errorMessage: string
): Promise<void> {
  try {
    await db.insert(emailAuditLog).values({
      applicationId,
      templateType: emailType,
      status: 'failed',
      errorMessage,
      recipientEmail: (await this.getApplication(applicationId))?.email || 'unknown',
      subject: `${emailType} (failed)`,
    });
  } catch (error) {
    console.error('Failed to log email failure:', error);
  }
}
```

---

### 4. Fix: WhatsApp Webhooks With Zero Error Handling (Lines 1401-1412)

**BEFORE (Current - NO VALIDATION):**
```typescript
app.post('/api/whatsapp/incoming', (req: Request, res: Response) => {
  console.log('Incoming WhatsApp message:', req.body);
  res.type('text/xml');
  res.send('<Response></Response>');
});

app.post('/api/whatsapp/status', (req: Request, res: Response) => {
  console.log('WhatsApp status update:', req.body);
  res.sendStatus(200);
});
```

**AFTER (WITH VALIDATION & ERROR HANDLING):**
```typescript
const whatsappMessageSchema = z.object({
  MessageSid: z.string(),
  From: z.string(),
  Body: z.string().max(5000),
  NumMedia: z.string().optional(),
});

const whatsappStatusSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.enum(['queued', 'failed', 'sent', 'delivered', 'undelivered', 'received']),
  ErrorCode: z.string().optional(),
});

app.post('/api/whatsapp/incoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = whatsappMessageSchema.safeParse(req.body);
    if (!validation.success) {
      console.warn('Invalid WhatsApp message format:', validation.error);
      res.type('text/xml');
      res.send('<Response></Response>');
      return;
    }
    
    const message = validation.data;
    console.log(`Incoming WhatsApp message from ${message.From}: ${message.Body.substring(0, 50)}...`);
    
    // TODO: Process message (store in DB, trigger workflows, etc.)
    
    res.type('text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('Error processing incoming WhatsApp message:', error);
    next(error);
  }
});

app.post('/api/whatsapp/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = whatsappStatusSchema.safeParse(req.body);
    if (!validation.success) {
      console.warn('Invalid WhatsApp status format:', validation.error);
      res.sendStatus(400);
      return;
    }
    
    const status = validation.data;
    console.log(`WhatsApp message ${status.MessageSid} status: ${status.MessageStatus}`);
    
    if (status.ErrorCode) {
      console.error(`WhatsApp delivery error (${status.ErrorCode}) for message ${status.MessageSid}`);
      // TODO: Log error and trigger notification
    }
    
    // TODO: Update message status in DB
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing WhatsApp status:', error);
    next(error);
  }
});
```

---

## HIGH PRIORITY FIXES

### 5. Fix: Missing Validation on Consultant Operations (Lines 802-829)

**BEFORE:**
```typescript
app.post("/api/admin/consultants", requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consultantData = req.body;  // ⚠️ NO VALIDATION
      const consultant = await storage.createConsultant(consultantData);
      res.status(201).json(consultant);
    } catch (error) {
      next(error);
    }
  }
);
```

**AFTER:**
```typescript
const createConsultantSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  bio: z.string().max(5000).optional(),
  expertise: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

const updateConsultantSchema = createConsultantSchema.partial();

app.post("/api/admin/consultants", requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = createConsultantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation error',
          details: validation.error.errors 
        });
      }
      
      const consultant = await storage.createConsultant(validation.data);
      res.status(201).json(consultant);
    } catch (error) {
      next(error);
    }
  }
);

app.patch("/api/admin/consultants/:id", requireRole(['admin']), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid consultant ID" });
      }
      
      const validation = updateConsultantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation error',
          details: validation.error.errors 
        });
      }
      
      const consultant = await storage.updateConsultant(id, validation.data);
      if (!consultant) {
        return res.status(404).json({ error: "Consultant not found" });
      }
      
      res.json(consultant);
    } catch (error) {
      next(error);
    }
  }
);
```

---

### 6. Fix: Missing Validation on Profile Operations (Lines 1114-1135)

**BEFORE:**
```typescript
app.post("/api/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileData = req.body;  // ⚠️ NO VALIDATION
    
    const existingProfile = await storage.getUserProfile(req.user!.id);
    
    let profile;
    if (existingProfile) {
      profile = await storage.updateUserProfile(req.user!.id, profileData);
    } else {
      profile = await storage.createUserProfile({
        ...profileData,
        userId: req.user!.id
      });
    }
    
    res.json(profile);
  } catch (error) {
    next(error);
  }
});
```

**AFTER:**
```typescript
const profileSchema = z.object({
  bio: z.string().max(5000).optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  linkedin: z.string().url().optional(),
  location: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  website: z.string().url().optional(),
});

app.post("/api/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: validation.error.errors 
      });
    }
    
    const profileData = validation.data;
    const existingProfile = await storage.getUserProfile(req.user!.id);
    
    let profile;
    if (existingProfile) {
      profile = await storage.updateUserProfile(req.user!.id, profileData);
    } else {
      profile = await storage.createUserProfile({
        ...profileData,
        userId: req.user!.id
      });
    }
    
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = profileSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: validation.error.errors 
      });
    }
    
    const profileData = validation.data;
    const profile = await storage.updateUserProfile(req.user!.id, profileData);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json(profile);
  } catch (error) {
    next(error);
  }
});
```

---

### 7. Fix: Test Email Route Without Try-Catch (Lines 188-224)

**BEFORE:**
```typescript
app.get("/api/test-email", async (req: Request, res: Response) => {
  // ⚠️ NO TRY-CATCH
  const emailService = await getEmailService();
  
  if (emailService) {
    const testSubmission = { /* ... */ };
    const result = await emailService.sendContactNotification(testSubmission);
    
    if (result) {
      res.json({ success: true, message: "Test email sent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send test email" });
    }
  } else {
    res.status(400).json({ /* ... */ });
  }
});
```

**AFTER:**
```typescript
app.get("/api/test-email", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const emailService = await getEmailService();
    
    if (!emailService) {
      return res.status(400).json({ 
        success: false, 
        message: "Email service not available. Please check server logs for details." 
      });
    }
    
    const testSubmission = {
      id: 0,
      name: "Test User",
      email: "test@example.com",
      phone: "+1234567890",
      company: "Test Company",
      location: "Test Location",
      message: "This is a test email from VantaHire.",
      submittedAt: new Date()
    };
    
    const result = await emailService.sendContactNotification(testSubmission);
    
    if (result) {
      res.json({ success: true, message: "Test email sent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send test email" });
    }
  } catch (error) {
    console.error('Error in test email route:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error sending test email",
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});
```

---

### 8. Fix: Cloudinary Silent Failure (Lines 335-341)

**BEFORE:**
```typescript
let resumeUrl = 'placeholder-resume.pdf';
if (req.file) {
  try {
    resumeUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
  } catch (error) {
    console.log('Cloudinary not configured, using placeholder resume URL');
    resumeUrl = `resume-${Date.now()}-${req.file.originalname}`;
  }
}
```

**AFTER:**
```typescript
let resumeUrl: string | null = null;
let uploadError: string | null = null;

if (req.file) {
  try {
    resumeUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to upload resume to Cloudinary:', errorMsg);
    uploadError = 'Resume upload failed. Using temporary storage.';
    // Generate temporary storage ID instead of placeholder
    resumeUrl = `temp-upload-${Date.now()}-${req.file.originalname}`;
  }
}

// Create application with warning if upload failed
const application = await storage.createApplication({
  ...applicationData,
  jobId,
  resumeUrl: resumeUrl || 'NO_RESUME',
  uploadStatus: uploadError ? 'temporary' : 'permanent'
});

// Notify user if resume upload failed
const response = {
  success: true,
  message: 'Application submitted successfully',
  applicationId: application.id
};

if (uploadError) {
  response.message += ' (Note: Resume upload failed, using temporary storage)';
  response.warning = uploadError;
}

res.status(201).json(response);
```

---

## MEDIUM PRIORITY FIXES

### 9. Fix: Standardize Error Response Format

**Create a unified response type (in shared/schema.ts or new utils file):**
```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  } | null;
  timestamp: string;
  requestId?: string;
}

export function createSuccessResponse<T>(
  data: T,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, any>,
  requestId?: string
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
    requestId,
  };
}
```

**Update central error handler:**
```typescript
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const errorId = crypto.randomUUID();
  let status = err.status || err.statusCode || 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  const isMulter = err?.name === 'MulterError' || err?.code === 'LIMIT_FILE_SIZE' 
    || /Only PDF files/.test(err?.message || '');
  if (isMulter && status === 500) {
    status = 400;
    errorCode = 'FILE_UPLOAD_ERROR';
  }
  
  const message = err.message || "An error occurred processing your request";
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.error(`[${errorId}] ${req.method} ${req.path} (${status}):`, err);
  
  res.status(status).json(
    createErrorResponse(
      errorCode,
      message,
      !isProduction ? { stack: err.stack } : undefined,
      errorId
    )
  );
});
```

---

### 10. Fix: Enhance Centralized Error Handler with Request Context

**Updated index.ts error handler:**
```typescript
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const errorId = crypto.randomUUID();
  const startTime = Date.now();
  
  let status = err.status || err.statusCode || 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  // Handle specific error types
  if (err instanceof z.ZodError) {
    status = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err?.name === 'MulterError' || /Only PDF files/.test(err?.message || '')) {
    status = 400;
    errorCode = 'FILE_UPLOAD_ERROR';
  } else if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') {
    status = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
  }
  
  const message = err.message || "An error occurred processing your request";
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Structured logging
  console.error({
    errorId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    code: errorCode,
    message,
    userId: req.user?.id,
    duration: `${Date.now() - startTime}ms`,
    ...(isProduction ? {} : { stack: err.stack })
  });
  
  res.status(status).json({
    success: false,
    data: null,
    error: {
      code: errorCode,
      message,
      details: !isProduction ? { stack: err.stack } : undefined
    },
    timestamp: new Date().toISOString(),
    errorId,
    ...(process.env.NODE_ENV === 'development' && { debug: { status, code: err.code } })
  });
});
```

---

## Testing These Fixes

```typescript
// Test invalid automation setting key
test('PATCH /api/admin/automation-settings/:key - invalid key', async () => {
  const res = await request(app)
    .patch('/api/admin/automation-settings/invalidKey')
    .set('Authorization', 'Bearer admin-token')
    .send({ value: true });
  
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Invalid setting key');
});

// Test bulk operation size limit
test('PATCH /api/applications/bulk - exceeds size limit', async () => {
  const ids = Array.from({ length: 101 }, (_, i) => i + 1);
  const res = await request(app)
    .patch('/api/applications/bulk')
    .send({ applicationIds: ids, status: 'reviewed' });
  
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('Maximum 100 applications');
});

// Test WhatsApp webhook validation
test('POST /api/whatsapp/incoming - invalid format', async () => {
  const res = await request(app)
    .post('/api/whatsapp/incoming')
    .send({ invalid: 'data' });
  
  expect(res.status).toBe(200); // Returns 200 but logs warning
});

// Test consultant validation
test('POST /api/admin/consultants - missing required fields', async () => {
  const res = await request(app)
    .post('/api/admin/consultants')
    .set('Authorization', 'Bearer admin-token')
    .send({ imageUrl: 'invalid-url' });
  
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Validation error');
});
```

---

## Summary of Changes

| Issue | Severity | Fix Type | Locations |
|-------|----------|----------|-----------|
| Unvalidated key parameter | CRITICAL | Add Zod validation | routes.ts:720 |
| Bulk ops without limits | CRITICAL | Add max array size | routes.ts:894 |
| Fire-forget promises | CRITICAL | Add audit logging | routes.ts:351,580,583,586,648 |
| WhatsApp no validation | CRITICAL | Add validation + try-catch | routes.ts:1401-1412 |
| Consultant no validation | HIGH | Add Zod schemas | routes.ts:802-829 |
| Profile no validation | HIGH | Add Zod schemas | routes.ts:1114-1135 |
| Test email no try-catch | HIGH | Add try-catch | routes.ts:188-224 |
| Cloudinary silent fail | HIGH | Return warning | routes.ts:335-341 |
| Inconsistent responses | MEDIUM | Create ApiResponse type | Multiple files |
| Error handler missing context | MEDIUM | Add errorId & details | index.ts:71-81 |

---

## Implementation Priority

1. **Week 1**: Fix CRITICAL issues (tests should catch injection/DoS vectors)
2. **Week 2**: Fix HIGH issues (improves reliability)
3. **Week 3**: Fix MEDIUM issues (improves debugging & standardization)

All fixes follow the existing code style and patterns in the application.
