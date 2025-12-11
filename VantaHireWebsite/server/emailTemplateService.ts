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
