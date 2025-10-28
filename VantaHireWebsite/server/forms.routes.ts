import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { forms, formFields, formInvitations, formResponses, formResponseAnswers, applications, jobs, emailAuditLog } from "@shared/schema";
import { insertFormSchema, insertFormFieldSchema, insertFormInvitationSchema, insertFormResponseAnswerSchema } from "@shared/schema";
import { requireAuth, requireRole } from "./auth";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { getEmailService } from "./simpleEmailService";
import { upload, uploadToCloudinary } from "./cloudinary";
import type { FormSnapshot, FormFieldSnapshot, FormAnswer, FileUploadResult } from "@shared/forms.types";
import { parseFormSnapshot, isValidFieldType, parseSelectOptions, normalizeYesNoValue } from "@shared/forms.types";

// Environment configuration
const FORM_INVITE_EXPIRY_DAYS = parseInt(process.env.FORM_INVITE_EXPIRY_DAYS || '14', 10);
const FORM_PUBLIC_RATE_LIMIT = parseInt(process.env.FORM_PUBLIC_RATE_LIMIT || '10', 10);
const FORM_INVITE_DAILY_LIMIT = parseInt(process.env.FORM_INVITE_DAILY_LIMIT || '50', 10);
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Error constants (exported for reuse in public endpoints)
export const FORM_ERRORS = {
  EXPIRED: {
    status: 410,
    code: 'FORM_EXPIRED',
    message: 'This form invitation has expired. Please contact the recruiter for a new link.'
  },
  ALREADY_SUBMITTED: {
    status: 409,
    code: 'ALREADY_SUBMITTED',
    message: "You've already submitted this form. Thank you for your response!"
  },
  INVALID_TOKEN: {
    status: 403,
    code: 'INVALID_TOKEN',
    message: 'Invalid invitation link. Please check the URL or contact the recruiter.'
  },
  RATE_LIMITED: {
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many attempts. Please try again in a few minutes.'
  }
} as const;

// Rate limiters
const publicFormRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: FORM_PUBLIC_RATE_LIMIT,
  message: FORM_ERRORS.RATE_LIMITED,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(FORM_ERRORS.RATE_LIMITED);
  }
});

const invitationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: FORM_INVITE_DAILY_LIMIT,
  message: { error: 'Daily invitation limit reached. Please try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'anonymous',
});

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
  fields: z.array(insertFormFieldSchema).min(1).max(50),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
  fields: z.array(insertFormFieldSchema).optional(),
});

export function registerFormsRoutes(app: Express, csrfProtection?: (req: Request, res: Response, next: NextFunction) => void): void {
  console.log('📋 Registering forms routes...');

  // Use provided CSRF middleware or no-op
  const csrf = csrfProtection || ((req: Request, res: Response, next: NextFunction) => next());

  // ==================== Template CRUD ====================

  // Create template with fields
  app.post(
    "/api/forms/templates",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    csrf,
    async (req: Request, res: Response) => {
      try {
        const body = createTemplateSchema.parse(req.body);

        // Insert form
        const [form] = await db.insert(forms).values({
          name: body.name,
          description: body.description,
          isPublished: body.isPublished ?? true,
          createdBy: req.user!.id,
        }).returning();

        // Insert fields
        const fieldsData = body.fields.map(field => ({
          formId: form.id,
          type: field.type,
          label: field.label,
          required: field.required,
          options: field.options,
          order: field.order,
        }));

        const createdFields = await db.insert(formFields).values(fieldsData).returning();

        return res.status(201).json({
          ...form,
          fields: createdFields.sort((a: any, b: any) => a.order - b.order),
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        console.error('Error creating form template:', error);
        return res.status(500).json({ error: 'Failed to create form template' });
      }
    }
  );

  // List templates
  app.get(
    "/api/forms/templates",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const isAdmin = req.user!.role === 'admin';

        // Admins see ALL templates (published + drafts for oversight)
        // Recruiters see: (published templates) OR (their own templates regardless of published status)
        const templates = await db.query.forms.findMany({
          where: isAdmin
            ? undefined // No filter - admins see everything
            : or(
                eq(forms.isPublished, true),
                eq(forms.createdBy, req.user!.id)
              ),
          with: {
            fields: {
              orderBy: (fields: any, { asc }: any) => [asc(fields.order)],
            },
          },
          orderBy: (forms: any, { desc }: any) => [desc(forms.createdAt)],
        });

        res.json({ templates });
      } catch (error: any) {
        console.error('Error fetching form templates:', error);
        res.status(500).json({ error: 'Failed to fetch form templates' });
      }
    }
  );

  // Get template by ID
  app.get(
    "/api/forms/templates/:id",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const formId = parseInt(req.params.id ?? '', 10);

        const form = await db.query.forms.findFirst({
          where: eq(forms.id, formId),
          with: {
            fields: {
              orderBy: (fields: any, { asc }: any) => [asc(fields.order)],
            },
          },
        });

        if (!form) {
          return res.status(404).json({ error: 'Form template not found' });
        }

        // Check ownership (admins can access all, recruiters only their own)
        if (req.user!.role !== 'admin' && form.createdBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        return res.json(form);
      } catch (error: any) {
        console.error('Error fetching form template:', error);
        return res.status(500).json({ error: 'Failed to fetch form template' });
      }
    }
  );

  // Update template
  app.patch(
    "/api/forms/templates/:id",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    csrf,
    async (req: Request, res: Response) => {
      try {
        const formId = parseInt(req.params.id ?? '', 10);
        const body = updateTemplateSchema.parse(req.body);

        // Check ownership
        const existingForm = await db.query.forms.findFirst({
          where: eq(forms.id, formId),
        });

        if (!existingForm) {
          return res.status(404).json({ error: 'Form template not found' });
        }

        if (req.user!.role !== 'admin' && existingForm.createdBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update form metadata
        const updateData: any = { updatedAt: new Date() };
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;

        const [updatedForm] = await db.update(forms)
          .set(updateData)
          .where(eq(forms.id, formId))
          .returning();

        // If fields provided, replace all fields atomically
        if (body.fields) {
          // Use transaction to prevent transient empty state
          const newFields = await db.transaction(async (tx: any) => {
            // Delete existing fields
            await tx.delete(formFields).where(eq(formFields.formId, formId));

            // Insert new fields
            const fieldsData = body.fields!.map(field => ({
              formId: formId,
              type: field.type,
              label: field.label,
              required: field.required,
              options: field.options,
              order: field.order,
            }));

            return await tx.insert(formFields).values(fieldsData).returning();
          });

          return res.json({
            ...updatedForm,
            fields: newFields.sort((a: any, b: any) => a.order - b.order),
          });
        }

        // Fetch existing fields if not replacing
        const existingFields = await db.query.formFields.findMany({
          where: eq(formFields.formId, formId),
          orderBy: (fields: any, { asc }: any) => [asc(fields.order)],
        });

        return res.json({
          ...updatedForm,
          fields: existingFields,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        console.error('Error updating form template:', error);
        return res.status(500).json({ error: 'Failed to update form template' });
      }
    }
  );

  // Delete template
  app.delete(
    "/api/forms/templates/:id",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    csrf,
    async (req: Request, res: Response) => {
      try {
        const formId = parseInt(req.params.id ?? '', 10);

        // Check ownership
        const existingForm = await db.query.forms.findFirst({
          where: eq(forms.id, formId),
        });

        if (!existingForm) {
          return res.status(404).json({ error: 'Form template not found' });
        }

        if (req.user!.role !== 'admin' && existingForm.createdBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if invitations exist
        const invitations = await db.query.formInvitations.findMany({
          where: eq(formInvitations.formId, formId),
          limit: 1,
        });

        if (invitations.length > 0) {
          return res.status(400).json({
            error: 'Cannot delete template with existing invitations',
            hint: 'Consider unpublishing this template instead'
          });
        }

        // Delete form (fields will cascade)
        await db.delete(forms).where(eq(forms.id, formId));

        return res.json({ success: true, message: 'Template deleted successfully' });
      } catch (error: any) {
        console.error('Error deleting form template:', error);
        return res.status(500).json({ error: 'Failed to delete form template' });
      }
    }
  );

  // ==================== Helper: Send Form Invitation Email ====================

  interface EmailResult {
    success: boolean;
    error?: string;
    previewUrl?: string;
  }

  async function sendFormInvitationEmail(
    invitationId: number,
    candidateEmail: string,
    candidateName: string,
    formName: string,
    token: string,
    customMessage?: string,
    sentBy?: number
  ): Promise<EmailResult> {
    const formLink = `${BASE_URL}/form/${token}`;
    const isDevelopment = process.env.NODE_ENV === 'development';

    try {
      const emailService = await getEmailService();

      if (!emailService) {
        console.warn('[Forms] No email service configured, using preview mode');
        // In development without email config, generate a preview URL
        if (isDevelopment) {
          return { success: false, error: 'Email service not configured', previewUrl: `http://ethereal.email/message/${Date.now()}` };
        } else {
          return { success: false, error: 'Email service not configured' };
        }
      }

      const subject = `Form Request: ${formName}`;
      const text = `Hi ${candidateName},

We'd like to request some additional information from you.

${customMessage ? customMessage + '\n\n' : ''}Please complete the form at:
${formLink}

This link will expire in ${FORM_INVITE_EXPIRY_DAYS} days.

Best regards,
VantaHire Team`;

      const emailSent = await emailService.sendEmail({
        to: candidateEmail,
        subject,
        text,
      });

      if (emailSent) {
        if (isDevelopment) {
          return {
            success: true,
            previewUrl: `http://ethereal.email/messages`,
          };
        } else {
          return {
            success: true,
          };
        }
      } else {
        if (isDevelopment) {
          return {
            success: false,
            error: 'Failed to send email',
            previewUrl: `http://ethereal.email/messages`,
          };
        } else {
          return {
            success: false,
            error: 'Failed to send email',
          };
        }
      }
    } catch (error: any) {
      console.error('[Forms] Error sending invitation email:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending email',
      };
    }
  }

  // ==================== Invitation Endpoints ====================

  // Create form invitation
  app.post(
    "/api/forms/invitations",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    csrf,
    invitationRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = insertFormInvitationSchema.parse(req.body);
        const { applicationId, formId, customMessage } = body;

        // 1. Verify ownership: application → job.postedBy === req.user.id
        const application = await db.query.applications.findFirst({
          where: eq(applications.id, applicationId),
          with: {
            job: true,
          },
        });

        if (!application) {
          return res.status(404).json({ error: 'Application not found' });
        }

        if (!application.job || application.job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized: You can only send forms for your own job postings' });
        }

        // 2. Check for duplicate pending/sent invitations
        const existingInvitation = await db.query.formInvitations.findFirst({
          where: and(
            eq(formInvitations.applicationId, applicationId),
            eq(formInvitations.formId, formId),
            or(
              eq(formInvitations.status, 'pending'),
              eq(formInvitations.status, 'sent')
            )
          ),
        });

        if (existingInvitation) {
          return res.status(400).json({
            error: 'An invitation for this form has already been sent to this candidate',
            hint: 'Wait for the candidate to respond or resend from the Forms modal',
            existingInvitationId: existingInvitation.id,
          });
        }

        // 3. Fetch form with fields to create snapshot
        const form = await db.query.forms.findFirst({
          where: eq(forms.id, formId),
          with: {
            fields: {
              orderBy: (fields: any, { asc }: any) => [asc(fields.order)],
            },
          },
        });

        if (!form) {
          return res.status(404).json({ error: 'Form template not found' });
        }

        // Template access check: recruiters can only send their own templates or published templates
        const isAdmin = req.user!.role === 'admin';
        if (!isAdmin) {
          const canAccess = form.isPublished || form.createdBy === req.user!.id;
          if (!canAccess) {
            return res.status(403).json({
              error: 'Unauthorized: You can only send your own templates or published templates'
            });
          }
        }

        // 4. Create field snapshot
        const fieldSnapshot = JSON.stringify({
          formName: form.name,
          formDescription: form.description,
          fields: form.fields.map((f: any) => ({
            id: f.id,
            type: f.type,
            label: f.label,
            required: f.required,
            options: f.options,
            order: f.order,
          })),
        });

        // 5. Generate token and expiry
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + FORM_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        // 6. Create invitation (status = 'pending')
        const [invitation] = await db.insert(formInvitations).values({
          applicationId,
          formId,
          token,
          expiresAt,
          status: 'pending',
          sentBy: req.user!.id,
          fieldSnapshot,
          customMessage,
        }).returning();

        // 7. Send email and update status
        const emailResult = await sendFormInvitationEmail(
          invitation.id,
          application.email,
          application.name,
          form.name,
          token,
          customMessage,
          req.user!.id
        );

        // Update invitation status based on email result
        const updatedStatus = emailResult.success ? 'sent' : 'failed';
        const [updatedInvitation] = await db.update(formInvitations)
          .set({
            status: updatedStatus,
            sentAt: emailResult.success ? new Date() : null,
            errorMessage: emailResult.error,
          })
          .where(eq(formInvitations.id, invitation.id))
          .returning();

        // 8. Log to email_audit_log
        await db.insert(emailAuditLog).values({
          applicationId,
          templateType: 'form_invitation',
          recipientEmail: application.email,
          subject: `Form Request: ${form.name}`,
          sentAt: new Date(),
          sentBy: req.user!.id,
          status: emailResult.success ? 'success' : 'failed',
          errorMessage: emailResult.error,
          previewUrl: emailResult.previewUrl,
        });

        return res.status(201).json({
          invitation: updatedInvitation,
          emailStatus: emailResult.success ? 'sent' : 'failed',
          previewUrl: emailResult.previewUrl,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        console.error('Error creating form invitation:', error);
        return res.status(500).json({ error: 'Failed to create form invitation' });
      }
    }
  );

  // List invitations for an application
  app.get(
    "/api/forms/invitations",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const applicationId = parseInt(req.query.applicationId as string, 10);

        if (!applicationId) {
          return res.status(400).json({ error: 'applicationId query parameter is required' });
        }

        // Verify ownership
        const application = await db.query.applications.findFirst({
          where: eq(applications.id, applicationId),
          with: { job: true },
        });

        if (!application) {
          return res.status(404).json({ error: 'Application not found' });
        }

        if (!application.job || application.job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        // Fetch invitations
        const invitations = await db.query.formInvitations.findMany({
          where: eq(formInvitations.applicationId, applicationId),
          with: {
            form: true,
          },
          orderBy: (invitations: any, { desc }: any) => [desc(invitations.createdAt)],
        });

        return res.json({ invitations });
      } catch (error: any) {
        console.error('Error fetching form invitations:', error);
        return res.status(500).json({ error: 'Failed to fetch form invitations' });
      }
    }
  );

  // ==================== Public Form Endpoints (CSRF-exempt, token-based auth) ====================

  // Get public form by token
  app.get(
    "/api/forms/public/:token",
    publicFormRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { token } = req.params;

        // Lookup invitation by token
        const invitation = await db.query.formInvitations.findFirst({
          where: eq(formInvitations.token, token ?? ''),
        });

        if (!invitation) {
          return res.status(403).json(FORM_ERRORS.INVALID_TOKEN);
        }

        // Check if expired
        if (invitation.expiresAt < new Date()) {
          // Mark as expired if not already
          if (invitation.status === 'pending' || invitation.status === 'sent') {
            await db.update(formInvitations)
              .set({ status: 'expired' })
              .where(eq(formInvitations.id, invitation.id));
          }
          return res.status(410).json(FORM_ERRORS.EXPIRED);
        }

        // Check if already answered
        if (invitation.status === 'answered') {
          return res.status(409).json(FORM_ERRORS.ALREADY_SUBMITTED);
        }

        // Mark viewedAt on first view
        if (!invitation.viewedAt && (invitation.status === 'pending' || invitation.status === 'sent')) {
          await db.update(formInvitations)
            .set({ viewedAt: new Date(), status: 'viewed' })
            .where(eq(formInvitations.id, invitation.id));
        }

        // Parse and return field snapshot (no PII beyond what's in snapshot)
        const snapshot: FormSnapshot = parseFormSnapshot(invitation.fieldSnapshot);

        return res.json({
          formName: snapshot.formName,
          formDescription: snapshot.formDescription,
          fields: snapshot.fields,
          expiresAt: invitation.expiresAt,
        });
      } catch (error: any) {
        console.error('[Forms] Error fetching public form:', error);
        return res.status(500).json({ error: 'Failed to load form' });
      }
    }
  );

  // Upload file for public form (before submitting)
  app.post(
    "/api/forms/public/:token/upload",
    publicFormRateLimit,
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        const { token } = req.params;

        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' });
        }

        // Validate token and check status (similar to form GET)
        const invitation = await db.query.formInvitations.findFirst({
          where: eq(formInvitations.token, token ?? ''),
        });

        if (!invitation) {
          return res.status(403).json(FORM_ERRORS.INVALID_TOKEN);
        }

        // Check if expired
        if (invitation.expiresAt < new Date()) {
          return res.status(410).json(FORM_ERRORS.EXPIRED);
        }

        // Check if already answered
        if (invitation.status === 'answered') {
          return res.status(409).json(FORM_ERRORS.ALREADY_SUBMITTED);
        }

        // Upload to Cloudinary (uses magic byte validation)
        const fileUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);

        if (!fileUrl) {
          return res.status(500).json({
            error: 'Failed to upload file',
            code: 'UPLOAD_FAILED'
          });
        }

        // Return metadata for richer client UI
        const result: FileUploadResult = {
          fileUrl,
          filename: req.file.originalname,
          size: req.file.size,
        };
        return res.json(result);
      } catch (error: any) {
        console.error('[Forms] Error uploading file:', error);
        return res.status(500).json({ error: 'Failed to upload file' });
      }
    }
  );

  // Submit public form
  app.post(
    "/api/forms/public/:token/submit",
    publicFormRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { token } = req.params;
        const { answers } = req.body;

        if (!Array.isArray(answers)) {
          return res.status(400).json({ error: 'Answers must be an array' });
        }

        // Use transaction with row lock to prevent concurrent submissions
        await db.transaction(async (tx: any) => {
          // Lock invitation row
          const [invitation] = await tx.select()
            .from(formInvitations)
            .where(eq(formInvitations.token, token ?? ''))
            .for('update');

          if (!invitation) {
            throw { ...FORM_ERRORS.INVALID_TOKEN };
          }

          // Re-check expiry
          if (invitation.expiresAt < new Date()) {
            if (invitation.status === 'pending' || invitation.status === 'sent' || invitation.status === 'viewed') {
              await tx.update(formInvitations)
                .set({ status: 'expired' })
                .where(eq(formInvitations.id, invitation.id));
            }
            throw { ...FORM_ERRORS.EXPIRED };
          }

          // Check if already answered
          if (invitation.status === 'answered') {
            throw { ...FORM_ERRORS.ALREADY_SUBMITTED };
          }

          // Parse field snapshot for validation
          const snapshot: FormSnapshot = parseFormSnapshot(invitation.fieldSnapshot);
          const fields: readonly FormFieldSnapshot[] = snapshot.fields;

          // Validate answers against snapshot
          const typedAnswers: FormAnswer[] = answers;
          for (const field of fields) {
            const answer = typedAnswers.find((a) => a.fieldId === field.id);

            // Required field check
            if (field.required && (!answer || (!answer.value && !answer.fileUrl))) {
              throw {
                status: 400,
                error: `Field "${field.label}" is required`,
                code: 'VALIDATION_ERROR'
              };
            }

            // Type-specific validation
            if (answer?.value) {
              switch (field.type) {
                case 'email':
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(answer.value)) {
                    throw {
                      status: 400,
                      error: `Invalid email format for "${field.label}"`,
                      code: 'VALIDATION_ERROR'
                    };
                  }
                  break;
                case 'select':
                  const options = parseSelectOptions(field.options);
                  if (options.length > 0 && !options.includes(answer.value)) {
                    throw {
                      status: 400,
                      error: `Invalid option selected for "${field.label}"`,
                      code: 'VALIDATION_ERROR'
                    };
                  }
                  break;
                case 'date':
                  if (isNaN(Date.parse(answer.value))) {
                    throw {
                      status: 400,
                      error: `Invalid date format for "${field.label}"`,
                      code: 'VALIDATION_ERROR'
                    };
                  }
                  break;
                case 'yes_no':
                  // Normalize and validate yes/no input
                  const normalizedValue = normalizeYesNoValue(answer.value);
                  if (!normalizedValue) {
                    throw {
                      status: 400,
                      error: `Invalid yes/no value for "${field.label}"`,
                      code: 'VALIDATION_ERROR'
                    };
                  }
                  break;
              }
            }
          }

          // Create response
          const [response] = await tx.insert(formResponses).values({
            invitationId: invitation.id,
            applicationId: invitation.applicationId,
          }).returning();

          // Save answers
          const answersData = answers.map((a: any) => ({
            responseId: response.id,
            fieldId: a.fieldId,
            value: a.value || null,
            fileUrl: a.fileUrl || null,
          }));

          await tx.insert(formResponseAnswers).values(answersData);

          // Mark invitation as answered
          await tx.update(formInvitations)
            .set({
              status: 'answered',
              answeredAt: new Date(),
            })
            .where(eq(formInvitations.id, invitation.id));
        });

        return res.json({
          success: true,
          message: 'Thank you! Your response has been submitted successfully.',
        });
      } catch (error: any) {
        // Handle custom errors from transaction
        if (error.status) {
          return res.status(error.status).json({
            error: error.error || error.message,
            code: error.code,
          });
        }

        console.error('[Forms] Error submitting public form:', error);
        return res.status(500).json({ error: 'Failed to submit form' });
      }
    }
  );

  // ==================== Response Endpoints ====================

  // List responses for an application
  app.get(
    "/api/forms/responses",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const applicationId = parseInt(req.query.applicationId as string, 10);

        if (!applicationId) {
          return res.status(400).json({ error: 'applicationId query parameter is required' });
        }

        // Verify ownership: application → job.postedBy === req.user.id
        const application = await db.query.applications.findFirst({
          where: eq(applications.id, applicationId),
          with: { job: true },
        });

        if (!application) {
          return res.status(404).json({ error: 'Application not found' });
        }

        if (!application.job || application.job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized: You can only view responses for your own job postings' });
        }

        // Fetch all responses for this application
        const responses = await db.query.formResponses.findMany({
          where: eq(formResponses.applicationId, applicationId),
          with: {
            invitation: {
              with: {
                form: true,
              },
            },
          },
          orderBy: (responses: any, { desc }: any) => [desc(responses.submittedAt)],
        });

        // Map to include form name and submission summary
        const responseSummaries = responses.map((response: any) => {
          const snapshot: FormSnapshot = parseFormSnapshot(response.invitation.fieldSnapshot);
          return {
            id: response.id,
            formName: snapshot.formName,
            submittedAt: response.submittedAt,
            invitationId: response.invitationId,
            answeredAt: response.invitation.answeredAt,
          };
        });

        return res.json({ responses: responseSummaries });
      } catch (error: any) {
        console.error('[Forms] Error fetching responses:', error);
        return res.status(500).json({ error: 'Failed to fetch responses' });
      }
    }
  );

  // Get detailed response with Q/A
  app.get(
    "/api/forms/responses/:id",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const responseId = parseInt(req.params.id ?? '', 10);

        // Fetch response with invitation and answers
        const response = await db.query.formResponses.findFirst({
          where: eq(formResponses.id, responseId),
          with: {
            invitation: true,
            application: {
              with: { job: true },
            },
            answers: true,
          },
        });

        if (!response) {
          return res.status(404).json({ error: 'Response not found' });
        }

        // Verify ownership
        if (!response.application?.job || response.application.job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized: You can only view responses for your own job postings' });
        }

        // Parse field snapshot to get field labels
        const snapshot: FormSnapshot = parseFormSnapshot(response.invitation.fieldSnapshot);
        const fieldsMap = new Map<number, FormFieldSnapshot>(
          snapshot.fields.map((f) => [f.id, f])
        );

        // Build Q/A array
        const questionsAndAnswers = response.answers.map((answer: any) => {
          const field = fieldsMap.get(answer.fieldId);
          return {
            fieldId: answer.fieldId,
            question: field?.label || 'Unknown field',
            fieldType: field?.type || 'unknown',
            answer: answer.value,
            fileUrl: answer.fileUrl,
          };
        });

        return res.json({
          id: response.id,
          formName: snapshot.formName,
          formDescription: snapshot.formDescription,
          submittedAt: response.submittedAt,
          candidateName: response.application.name,
          candidateEmail: response.application.email,
          questionsAndAnswers,
        });
      } catch (error: any) {
        console.error('[Forms] Error fetching response detail:', error);
        return res.status(500).json({ error: 'Failed to fetch response detail' });
      }
    }
  );

  // Export responses to CSV
  app.get(
    "/api/forms/export",
    requireAuth,
    requireRole(['recruiter', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const applicationId = parseInt(req.query.applicationId as string, 10);
        const format = (req.query.format as string) || 'csv';

        if (!applicationId) {
          return res.status(400).json({ error: 'applicationId query parameter is required' });
        }

        if (format !== 'csv') {
          return res.status(400).json({ error: 'Only CSV format is supported at this time' });
        }

        // Verify ownership
        const application = await db.query.applications.findFirst({
          where: eq(applications.id, applicationId),
          with: { job: true },
        });

        if (!application) {
          return res.status(404).json({ error: 'Application not found' });
        }

        if (!application.job || application.job.postedBy !== req.user!.id) {
          return res.status(403).json({ error: 'Unauthorized: You can only export responses for your own job postings' });
        }

        // Fetch all responses with answers
        const responses = await db.query.formResponses.findMany({
          where: eq(formResponses.applicationId, applicationId),
          with: {
            invitation: true,
            answers: true,
          },
          orderBy: (responses: any, { desc }: any) => [desc(responses.submittedAt)],
        });

        if (responses.length === 0) {
          return res.status(404).json({ error: 'No responses found for this application' });
        }

        // Build CSV
        const csvRows: string[] = [];

        // CSV header
        csvRows.push('Application ID,Candidate Name,Candidate Email,Form Name,Submitted At,Question,Answer,File URL');

        // CSV rows
        for (const response of responses) {
          const snapshot: FormSnapshot = parseFormSnapshot(response.invitation.fieldSnapshot);
          const fieldsMap = new Map<number, FormFieldSnapshot>(
            snapshot.fields.map((f) => [f.id, f])
          );

          for (const answer of response.answers) {
            const field = fieldsMap.get(answer.fieldId);
            const question = field?.label || 'Unknown field';

            // Escape CSV values (wrap in quotes and escape existing quotes)
            const escapeCsv = (val: any) => {
              if (val === null || val === undefined) return '';
              const str = String(val);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            };

            csvRows.push([
              applicationId,
              escapeCsv(application.name),
              escapeCsv(application.email),
              escapeCsv(snapshot.formName),
              response.submittedAt.toISOString(),
              escapeCsv(question),
              escapeCsv(answer.value),
              escapeCsv(answer.fileUrl),
            ].join(','));
          }
        }

        // Prepend BOM for Excel UTF-8 compatibility
        const csvContent = '\ufeff' + csvRows.join('\n');
        const filename = `form-responses-application-${applicationId}-${Date.now()}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);
      } catch (error: any) {
        console.error('[Forms] Error exporting responses:', error);
        return res.status(500).json({ error: 'Failed to export responses' });
      }
    }
  );

  console.log('✅ Forms routes registered');
}
