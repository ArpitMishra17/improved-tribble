import cron from 'node-cron';
import { storage } from './storage';
import { db } from './db';
import { jobs, applications, users } from '@shared/schema';
import { lt, eq, and, sql } from 'drizzle-orm';
import { getEmailService } from './simpleEmailService';

// Job lifecycle scheduler with activity-based deactivation
export function startJobScheduler() {
  // Gate scheduler to prevent duplicate runs in multi-instance deployments
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('⏸️  Job scheduler disabled (ENABLE_SCHEDULER not set to true)');
    console.log('   Set ENABLE_SCHEDULER=true on ONE instance to enable scheduled jobs');
    return;
  }

  console.log('✅ Job scheduler enabled - starting cron jobs');

  // Run daily at 2 AM: Send warning emails (7 days before deactivation)
  cron.schedule('0 2 * * *', async () => {
    console.log('Running job expiration warning check...');

    try {
      await sendDeactivationWarnings();
    } catch (error) {
      console.error('Error during warning email send:', error);
    }
  });

  // Run daily at 3 AM: Deactivate old inactive jobs (activity-based)
  cron.schedule('0 3 * * *', async () => {
    console.log('Running activity-based job deactivation check...');

    try {
      await deactivateInactiveJobs();
    } catch (error) {
      console.error('Error during job deactivation:', error);
    }
  });

  // Run weekly on Sunday at 4 AM: Clean up declined jobs
  cron.schedule('0 4 * * 0', async () => {
    console.log('Running declined job cleanup...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Archive declined jobs older than 30 days
      const archivedJobs = await db
        .update(jobs)
        .set({
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: 'declined'
        })
        .where(
          and(
            eq(jobs.status, 'declined'),
            lt(jobs.createdAt, thirtyDaysAgo)
          )
        )
        .returning();

      if (archivedJobs.length > 0) {
        console.log(`Archived ${archivedJobs.length} declined jobs`);
      } else {
        console.log('No declined jobs to archive');
      }
    } catch (error) {
      console.error('Error during declined job cleanup:', error);
    }
  });

  console.log('📅 Job scheduler started successfully:');
  console.log('   - Warning emails: Daily at 2 AM (7 days before deactivation)');
  console.log('   - Job deactivation: Daily at 3 AM (activity-based)');
  console.log('   - Declined job cleanup: Weekly on Sunday at 4 AM');
}

/**
 * Send warning emails 7 days before auto-deactivation
 */
async function sendDeactivationWarnings(): Promise<void> {
  const fiftyThreeDaysAgo = new Date();
  fiftyThreeDaysAgo.setDate(fiftyThreeDaysAgo.getDate() - 53); // 60 - 7 = 53 days old

  // Find jobs that are 53 days old and haven't received warning email yet
  const jobsNearExpiry = await db
    .select({
      job: jobs,
      recruiter: users
    })
    .from(jobs)
    .leftJoin(users, eq(jobs.postedBy, users.id))
    .where(
      and(
        eq(jobs.isActive, true),
        eq(jobs.status, 'approved'),
        lt(jobs.createdAt, fiftyThreeDaysAgo),
        eq(jobs.warningEmailSent, false)
      )
    );

  if (jobsNearExpiry.length === 0) {
    console.log('No jobs need warning emails');
    return;
  }

  console.log(`Sending warning emails for ${jobsNearExpiry.length} jobs...`);

  const emailService = await getEmailService();
  if (!emailService) {
    console.warn('Email service not configured - skipping warning emails');
    return;
  }

  for (const { job, recruiter } of jobsNearExpiry) {
    if (!recruiter) continue;

    try {
      await emailService.sendEmail({
        to: recruiter.username, // Assuming username is email
        subject: `Action Required: Job "${job.title}" will auto-close in 7 days`,
        html: `
          <h2>Job Expiration Warning</h2>
          <p>Hello ${recruiter.firstName || recruiter.username},</p>
          <p>Your job posting <strong>"${job.title}"</strong> will be automatically deactivated in 7 days due to inactivity.</p>

          <h3>Job Details:</h3>
          <ul>
            <li><strong>Title:</strong> ${job.title}</li>
            <li><strong>Location:</strong> ${job.location}</li>
            <li><strong>Posted:</strong> ${new Date(job.createdAt).toLocaleDateString()}</li>
            <li><strong>Auto-closes:</strong> ${new Date(new Date(job.createdAt).getTime() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
          </ul>

          <h3>Why is this happening?</h3>
          <p>Jobs are automatically deactivated after 60 days to ensure our listings stay fresh and relevant.</p>

          <h3>What can you do?</h3>
          <ul>
            <li>If the position is still open: No action needed, it will deactivate automatically</li>
            <li>If you filled the position: You can manually close it now</li>
            <li>After deactivation: Contact an admin to reactivate if needed</li>
          </ul>

          <p>Login to your dashboard to manage this job posting.</p>
          <p>Thank you for using VantaHire!</p>
        `
      });

      // Mark warning as sent
      await db
        .update(jobs)
        .set({ warningEmailSent: true })
        .where(eq(jobs.id, job.id));

      console.log(`Warning email sent for job ${job.id}: "${job.title}"`);
    } catch (error) {
      console.error(`Failed to send warning for job ${job.id}:`, error);
    }
  }

  console.log(`Sent ${jobsNearExpiry.length} warning emails`);
}

/**
 * Deactivate jobs older than 60 days with no recent activity
 */
async function deactivateInactiveJobs(): Promise<void> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Find old active jobs
  const oldJobs = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.isActive, true),
        eq(jobs.status, 'approved'),
        lt(jobs.createdAt, sixtyDaysAgo)
      )
    );

  if (oldJobs.length === 0) {
    console.log('No jobs to deactivate');
    return;
  }

  console.log(`Checking ${oldJobs.length} old jobs for activity...`);

  let deactivatedCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < oldJobs.length; i += BATCH_SIZE) {
    const batch = oldJobs.slice(i, i + BATCH_SIZE);

    for (const job of batch) {
      try {
        // Check for recent applications (last 14 days)
        const recentApplications = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(applications)
          .where(
            and(
              eq(applications.jobId, job.id),
              sql`${applications.appliedAt} > ${fourteenDaysAgo}`
            )
          );

        const hasRecentActivity = recentApplications[0]?.count > 0;

        // Check for upcoming interviews
        const upcomingInterviews = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(applications)
          .where(
            and(
              eq(applications.jobId, job.id),
              sql`${applications.interviewDate} > NOW()`
            )
          );

        const hasUpcomingInterviews = upcomingInterviews[0]?.count > 0;

        // Only deactivate if no recent activity and no upcoming interviews
        if (!hasRecentActivity && !hasUpcomingInterviews) {
          await storage.updateJobStatus(job.id, false, 'auto_expired', 1); // performedBy: system admin (ID 1)
          deactivatedCount++;
          console.log(`Deactivated job ${job.id}: "${job.title}" (no recent activity)`);
        } else {
          console.log(`Keeping job ${job.id}: "${job.title}" (has recent activity or interviews)`);
        }
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
      }
    }
  }

  console.log(`Deactivated ${deactivatedCount} of ${oldJobs.length} old jobs`);
}

// Utility function to manually expire a job
export async function expireJob(jobId: number, reason?: string, performedBy?: number): Promise<boolean> {
  try {
    const result = await storage.updateJobStatus(jobId, false, reason || 'manual', performedBy);
    return !!result;
  } catch (error) {
    console.error('Error expiring job:', error);
    return false;
  }
}

// Get jobs that are about to expire (within 7 days)
export async function getJobsNearExpiry(): Promise<any[]> {
  try {
    const fiftyThreeDaysAgo = new Date();
    fiftyThreeDaysAgo.setDate(fiftyThreeDaysAgo.getDate() - 53);

    const nearExpiryJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.isActive, true),
          lt(jobs.createdAt, fiftyThreeDaysAgo),
          eq(jobs.warningEmailSent, false)
        )
      );

    return nearExpiryJobs;
  } catch (error) {
    console.error('Error getting jobs near expiry:', error);
    return [];
  }
}
