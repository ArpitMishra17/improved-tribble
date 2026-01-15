/**
 * Email Template Service
 * Handles template rendering with variable replacement and sending
 */

import { db } from './db';
import { emailTemplates, applications, emailAuditLog, automationEvents } from '../shared/schema';
import { eq, asc } from 'drizzle-orm';
import { getEmailService } from './simpleEmailService';
import type { EmailTemplate } from '../shared/schema';

/**
 * Log an automation event for the Operations Command Center
 */
export async function logAutomationEvent(
  automationKey: string,
  targetType: 'application' | 'job' | 'user',
  targetId: number,
  outcome: 'success' | 'failed' | 'skipped' = 'success',
  options?: {
    errorMessage?: string;
    metadata?: Record<string, any>;
    triggeredBy?: number;
  }
): Promise<void> {
  try {
    await db.insert(automationEvents).values({
      automationKey,
      targetType,
      targetId,
      outcome,
      errorMessage: options?.errorMessage || null,
      metadata: options?.metadata || null,
      triggeredBy: options?.triggeredBy || null,
    });
  } catch (error) {
    console.error('[AutomationEvent] Failed to log event:', error);
    // Don't throw - logging should not break the main flow
  }
}

export interface TemplateVariables {
  candidate_name?: string;
  job_title?: string;
  interview_date?: string;
  interview_time?: string;
  interview_location?: string;
  recruiter_name?: string;
  company_name?: string;
  new_status?: string;
  // Co-recruiter invitation variables
  inviter_name?: string;
  invitee_name?: string;
  greeting?: string;
  accept_url?: string;
  dashboard_url?: string;
  expiry_days?: string;
  [key: string]: string | undefined;
}

/**
 * Replace template variables like {{variable_name}} with actual values
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  let rendered = template;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value || '');
  });

  // Remove any remaining unreplaced variables
  rendered = rendered.replace(/{{[^}]+}}/g, '');

  return rendered;
}

/**
 * Render both subject and body of an email template
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  variables: TemplateVariables
): { subject: string; body: string } {
  return {
    subject: renderTemplate(template.subject, variables),
    body: renderTemplate(template.body, variables),
  };
}

/**
 * Send an email using a template with application context
 */
export async function sendTemplatedEmail(
  applicationId: number,
  templateId: number,
  customVariables: Partial<TemplateVariables> = {}
): Promise<void> {
  // Fetch application with job and recruiter data
  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
    with: {
      job: {
        with: {
          postedBy: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }

  // Fetch email template
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.id, templateId),
  });

  if (!template) {
    throw new Error(`Email template ${templateId} not found`);
  }

  // Build variables from application data
  const variables: TemplateVariables = {
    candidate_name: application.name,
    job_title: application.job?.title || 'Position',
    recruiter_name: application.job?.postedBy
      ? `${application.job.postedBy.firstName || ''} ${application.job.postedBy.lastName || ''}`.trim()
      : 'Hiring Team',
    company_name: 'VantaHire',
    ...customVariables,
  };

  // Render template
  const { subject, body } = renderEmailTemplate(template, variables);

  let previewUrl: string | null = null;
  let status: 'success' | 'failed' = 'success';
  let errorMessage: string | null = null;

  try {
    // Send email
    const svc = await getEmailService();
    if (!svc || typeof svc.sendEmail !== 'function') {
      console.warn('Email service unavailable; skipping send.');
      status = 'failed';
      errorMessage = 'Email service unavailable';
    } else {
      const result = await svc.sendEmail({
        to: application.email,
        subject,
        text: body,
      });

      // Extract preview URL if available (Ethereal)
      if (result && typeof result === 'object' && 'messageId' in result) {
        const nodemailerInfo = result as any;
        if (nodemailerInfo.messageId && process.env.SMTP_HOST?.includes('ethereal')) {
          previewUrl = `https://ethereal.email/message/${nodemailerInfo.messageId}`;
        }
      }

      console.log(`✉️  Sent ${template.name} to ${application.email}`);
    }
  } catch (error: any) {
    status = 'failed';
    errorMessage = error?.message || 'Unknown error';
    console.error(`Failed to send ${template.name} to ${application.email}:`, error);
  }

  // Log to audit table
  await db.insert(emailAuditLog).values({
    applicationId,
    templateId,
    templateType: template.templateType,
    recipientEmail: application.email,
    subject,
    status,
    errorMessage,
    previewUrl,
  });
}

/**
 * Send interview invitation email
 */
export async function sendInterviewInvitation(
  applicationId: number,
  interviewDetails: {
    date: string;
    time: string;
    location: string;
  }
): Promise<void> {
  // Find the interview invitation template
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'interview_invite'),
  });

  if (!template) {
    await logAutomationEvent('email.interview_invite', 'application', applicationId, 'failed', {
      errorMessage: 'Interview invitation template not found',
    });
    throw new Error('Interview invitation template not found. Run seed script.');
  }

  try {
    await sendTemplatedEmail(applicationId, template.id, {
      interview_date: interviewDetails.date,
      interview_time: interviewDetails.time,
      interview_location: interviewDetails.location,
    });
    await logAutomationEvent('email.interview_invite', 'application', applicationId, 'success', {
      metadata: { templateId: template.id, ...interviewDetails },
    });
  } catch (error: any) {
    await logAutomationEvent('email.interview_invite', 'application', applicationId, 'failed', {
      errorMessage: error?.message || 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send application status update email
 */
export async function sendStatusUpdateEmail(
  applicationId: number,
  newStatus: string
): Promise<void> {
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'status_update'),
  });

  if (!template) {
    console.warn('Status update template not found, skipping email');
    await logAutomationEvent('email.status_update', 'application', applicationId, 'skipped', {
      errorMessage: 'Status update template not found',
      metadata: { newStatus },
    });
    return;
  }

  try {
    await sendTemplatedEmail(applicationId, template.id, {
      new_status: newStatus,
    });
    await logAutomationEvent('email.status_update', 'application', applicationId, 'success', {
      metadata: { templateId: template.id, newStatus },
    });
  } catch (error: any) {
    await logAutomationEvent('email.status_update', 'application', applicationId, 'failed', {
      errorMessage: error?.message || 'Unknown error',
      metadata: { newStatus },
    });
  }
}

/**
 * Send application received confirmation
 */
export async function sendApplicationReceivedEmail(
  applicationId: number
): Promise<void> {
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'application_received'),
  });

  if (!template) {
    console.warn('Application received template not found, skipping email');
    await logAutomationEvent('email.application_received', 'application', applicationId, 'skipped', {
      errorMessage: 'Application received template not found',
    });
    return;
  }

  try {
    await sendTemplatedEmail(applicationId, template.id);
    await logAutomationEvent('email.application_received', 'application', applicationId, 'success', {
      metadata: { templateId: template.id },
    });
  } catch (error: any) {
    await logAutomationEvent('email.application_received', 'application', applicationId, 'failed', {
      errorMessage: error?.message || 'Unknown error',
    });
  }
}

/**
 * Send job offer email
 */
export async function sendOfferEmail(
  applicationId: number
): Promise<void> {
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'offer_extended'),
  });

  if (!template) {
    console.warn('Offer template not found, skipping email');
    await logAutomationEvent('email.offer_extended', 'application', applicationId, 'skipped', {
      errorMessage: 'Offer template not found',
    });
    return;
  }

  try {
    await sendTemplatedEmail(applicationId, template.id);
    await logAutomationEvent('email.offer_extended', 'application', applicationId, 'success', {
      metadata: { templateId: template.id },
    });
  } catch (error: any) {
    await logAutomationEvent('email.offer_extended', 'application', applicationId, 'failed', {
      errorMessage: error?.message || 'Unknown error',
    });
  }
}

/**
 * Send rejection email
 */
export async function sendRejectionEmail(
  applicationId: number
): Promise<void> {
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'rejection'),
  });

  if (!template) {
    console.warn('Rejection template not found, skipping email');
    await logAutomationEvent('email.rejection', 'application', applicationId, 'skipped', {
      errorMessage: 'Rejection template not found',
    });
    return;
  }

  try {
    await sendTemplatedEmail(applicationId, template.id);
    await logAutomationEvent('email.rejection', 'application', applicationId, 'success', {
      metadata: { templateId: template.id },
    });
  } catch (error: any) {
    await logAutomationEvent('email.rejection', 'application', applicationId, 'failed', {
      errorMessage: error?.message || 'Unknown error',
    });
  }
}

/**
 * Send co-recruiter invitation email using database template
 */
export async function sendCoRecruiterInvitationEmail(
  email: string,
  opts: {
    inviterName: string;
    inviteeName?: string;
    jobTitle: string;
    acceptUrl: string;
    expiryDays: number;
  }
): Promise<boolean> {
  const svc = await getEmailService();
  if (!svc) {
    console.warn('[CoRecruiterEmail] Email service unavailable');
    return false;
  }

  // Try to find the template
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'co_recruiter_invitation'),
  });

  const greeting = opts.inviteeName ? `Hi ${opts.inviteeName},` : 'Hi,';

  let subject: string;
  let body: string;

  if (template) {
    const templateVars: TemplateVariables = {
      inviter_name: opts.inviterName,
      greeting,
      job_title: opts.jobTitle,
      accept_url: opts.acceptUrl,
      expiry_days: String(opts.expiryDays),
    };
    if (opts.inviteeName) {
      templateVars.invitee_name = opts.inviteeName;
    }
    const rendered = renderEmailTemplate(template, templateVars);
    subject = rendered.subject;
    body = rendered.body;
  } else {
    // Fallback to hardcoded template if not in database
    subject = `You're invited to collaborate on "${opts.jobTitle}"`;
    body = `${greeting}

${opts.inviterName} has invited you to collaborate as a co-recruiter on the job posting:

${opts.jobTitle}

As a co-recruiter, you'll have full access to:
- View and manage all applications for this job
- Update candidate stages and statuses
- Send forms and emails to candidates
- Access job analytics and reports

Accept your invitation: ${opts.acceptUrl}

This invitation expires in ${opts.expiryDays} days.

If you didn't expect this invitation, you can safely ignore this email.`;
  }

  try {
    await svc.sendEmail({
      to: email,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    console.log(`[CoRecruiterEmail] Invitation sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[CoRecruiterEmail] Failed to send invitation to ${email}:`, err);
    return false;
  }
}

/**
 * Send co-recruiter added notification email using database template
 */
export async function sendCoRecruiterAddedEmail(
  email: string,
  opts: {
    inviterName: string;
    recruiterFirstName?: string | null;
    jobTitle: string;
    dashboardUrl: string;
  }
): Promise<boolean> {
  const svc = await getEmailService();
  if (!svc) {
    console.warn('[CoRecruiterEmail] Email service unavailable');
    return false;
  }

  // Try to find the template
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.templateType, 'co_recruiter_added'),
  });

  const greeting = opts.recruiterFirstName ? `Hi ${opts.recruiterFirstName},` : 'Hi,';

  let subject: string;
  let body: string;

  if (template) {
    const rendered = renderEmailTemplate(template, {
      inviter_name: opts.inviterName,
      greeting,
      job_title: opts.jobTitle,
      dashboard_url: opts.dashboardUrl,
    });
    subject = rendered.subject;
    body = rendered.body;
  } else {
    // Fallback to hardcoded template
    subject = `You've been added as a co-recruiter on "${opts.jobTitle}"`;
    body = `${greeting}

${opts.inviterName} has added you as a co-recruiter on the job posting:

${opts.jobTitle}

You now have full access to manage applications and collaborate on this hiring process.

View your dashboard: ${opts.dashboardUrl}`;
  }

  try {
    await svc.sendEmail({
      to: email,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    console.log(`[CoRecruiterEmail] Added notification sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[CoRecruiterEmail] Failed to send added notification to ${email}:`, err);
    return false;
  }
}

/**
 * Notify all recruiters on a job about a new application
 */
export async function notifyRecruitersNewApplication(
  applicationId: number,
  jobId: number,
  application: {
    name: string;
    email: string;
    phone?: string | null;
    coverLetter?: string | null;
  },
  job: {
    title: string;
    location: string;
  }
): Promise<void> {
  const svc = await getEmailService();
  if (!svc) {
    console.warn('[RecruiterNotify] Email service unavailable, skipping notification');
    return;
  }

  // Import storage dynamically to avoid circular dependency
  const { storage } = await import('./storage');

  // Get all recruiters on this job
  const recruiters = await storage.getJobRecruiters(jobId);

  if (recruiters.length === 0) {
    console.warn(`[RecruiterNotify] No recruiters found for job ${jobId}`);
    return;
  }

  const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
  const applicationUrl = `${BASE_URL}/jobs/${jobId}/applications`;
  const resumeUrl = `${BASE_URL}/api/applications/${applicationId}/resume`;

  const subject = `New Application: ${application.name} applied for ${job.title}`;
  const html = `
    <h2>New Application Received</h2>
    <p>A new candidate has applied for your job posting.</p>

    <h3>Candidate Details</h3>
    <ul>
      <li><strong>Name:</strong> ${application.name}</li>
      <li><strong>Email:</strong> ${application.email}</li>
      <li><strong>Phone:</strong> ${application.phone || 'Not provided'}</li>
    </ul>

    <h3>Job Details</h3>
    <ul>
      <li><strong>Position:</strong> ${job.title}</li>
      <li><strong>Location:</strong> ${job.location}</li>
    </ul>

    ${application.coverLetter ? `<h3>Cover Letter</h3><p>${application.coverLetter}</p>` : ''}

    <p style="margin-top: 20px;">
      <a href="${applicationUrl}" style="background-color: #7B38FB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        View Application
      </a>
      &nbsp;&nbsp;
      <a href="${resumeUrl}" style="background-color: #6b7280; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Download Resume
      </a>
    </p>

    <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
      This is an automated notification from VantaHire ATS.
    </p>
  `;

  // Send to all recruiters and track results
  let successCount = 0;
  let failedCount = 0;
  const failedEmails: string[] = [];

  const sendPromises = recruiters.map(async (recruiter) => {
    try {
      await svc.sendEmail({
        to: recruiter.username,
        subject,
        html,
      });
      successCount++;
      console.log(`[RecruiterNotify] Notified ${recruiter.username} about application ${applicationId}`);
    } catch (err) {
      failedCount++;
      failedEmails.push(recruiter.username);
      console.error(`[RecruiterNotify] Failed to notify ${recruiter.username}:`, err);
    }
  });

  await Promise.all(sendPromises);

  // Log automation event with detailed results
  const outcome = failedCount === 0 ? 'success' : (successCount === 0 ? 'failed' : 'success');
  const logOpts: Parameters<typeof logAutomationEvent>[4] = {
    metadata: {
      jobId,
      totalRecruiters: recruiters.length,
      successCount,
      failedCount,
    },
  };
  if (failedEmails.length > 0) {
    logOpts.metadata!.failedEmails = failedEmails;
  }
  if (failedCount > 0) {
    logOpts.errorMessage = `Failed to notify ${failedCount} recruiter(s)`;
  }
  await logAutomationEvent('email.notify_recruiters_new_application', 'application', applicationId, outcome, logOpts);
}

/**
 * Get all available email templates
 */
export async function getAllTemplates(): Promise<EmailTemplate[]> {
  return db.query.emailTemplates.findMany({
    orderBy: (templates: any, { asc }: any) => [asc(templates.templateType), asc(templates.name)],
  });
}

/**
 * Get templates by type
 */
export async function getTemplatesByType(
  templateType: string
): Promise<EmailTemplate[]> {
  return db.query.emailTemplates.findMany({
    where: eq(emailTemplates.templateType, templateType),
  });
}

/**
 * Create a new email template
 */
export async function createEmailTemplate(
  templateData: {
    name: string;
    subject: string;
    body: string;
    templateType: string;
    createdBy?: number;
  }
): Promise<EmailTemplate> {
  const [newTemplate] = await db
    .insert(emailTemplates)
    .values({
      ...templateData,
      isDefault: false,
    })
    .returning();

  return newTemplate;
}
