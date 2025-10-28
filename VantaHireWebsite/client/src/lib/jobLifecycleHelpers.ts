import type { Job, Application } from "@shared/schema";

/**
 * Check if an application was submitted before the job was last reactivated
 * @param application - The application to check
 * @param job - The job the application belongs to
 * @returns true if application is considered "old" (applied before reactivation)
 */
export function isOldApplicant(application: Application, job: Job): boolean {
  if (!job.reactivatedAt) return false;

  const appliedDate = new Date(application.appliedAt);
  const reactivatedDate = new Date(job.reactivatedAt);

  return appliedDate < reactivatedDate;
}

/**
 * Get candidate-friendly status message for job applications
 * @param application - The application
 * @param job - The job
 * @returns Status object with message and severity
 */
export function getCandidateApplicationStatus(application: Application, job: Job): {
  status: 'active' | 'recently_closed' | 'closed' | 'error';
  message: string;
  severity?: 'info' | 'warning' | 'error';
} {
  if (job.isActive) {
    return {
      status: 'active',
      message: 'Application in review',
      severity: 'info'
    };
  }

  // Job is inactive
  const deactivatedDate = job.deactivatedAt || job.updatedAt;
  const appliedDate = new Date(application.appliedAt);
  const closedDate = new Date(deactivatedDate);

  const daysBetween = Math.floor(
    (closedDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysBetween < 0) {
    // Applied after deactivation (race condition)
    return {
      status: 'error',
      message: 'Job closed shortly after your application',
      severity: 'warning'
    };
  }

  if (daysBetween < 7) {
    return {
      status: 'recently_closed',
      message: `Job closed ${daysBetween} days after your application`,
      severity: 'warning'
    };
  }

  return {
    status: 'closed',
    message: 'Job position closed',
    severity: 'info'
  };
}

/**
 * Calculate days until job auto-deactivation
 * @param job - The job
 * @param maxAgeDays - Max age before deactivation (default 60)
 * @returns Days remaining, or null if not applicable
 */
export function getDaysUntilAutoDeactivation(job: Job, maxAgeDays: number = 60): number | null {
  if (!job.isActive || !job.createdAt) return null;

  const createdDate = new Date(job.createdAt);
  const now = new Date();
  const ageInDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  const daysRemaining = maxAgeDays - ageInDays;
  return daysRemaining > 0 ? daysRemaining : 0;
}

/**
 * Check if job is read-only for recruiter
 * @param job - The job
 * @returns true if job is inactive (read-only)
 */
export function isJobReadOnly(job: Job): boolean {
  return !job.isActive;
}
