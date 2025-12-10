/**
 * Pipeline Action Checklist - Rule Engine
 *
 * Generates actionable items from pipeline data using rule-based logic.
 * Designed to be instant (no AI dependency) for immediate display.
 */

import {
  ActionItem,
  PipelineData,
  ChecklistSession,
  LightweightSnapshot,
  GroupedActionItems,
  ReanalyzeCheck,
  VerificationResult,
  LOW_PIPELINE_THRESHOLD,
  STUCK_DAYS_URGENT,
  STUCK_DAYS_IMPORTANT,
  UNREVIEWED_HOURS_URGENT,
  OFFER_FOLLOW_UP_DAYS,
  STALE_JOB_DAYS,
  SESSION_EXPIRY_HOURS,
  REANALYZE_COMPLETION_THRESHOLD,
} from './pipeline-types';

/**
 * Generate action items from pipeline data
 * Rules are applied in priority order
 */
export function generateActionItems(data: PipelineData): ActionItem[] {
  const items: ActionItem[] = [];

  // Rule 1: Pending offers (URGENT) - follow up after 3+ days
  data.pendingOffers.forEach((offer) => {
    if (offer.daysSinceSent >= OFFER_FOLLOW_UP_DAYS) {
      items.push({
        id: `pending-offer-${offer.applicationId}`,
        priority: 'urgent',
        category: 'communication',
        title: `Follow up on offer to ${offer.candidateName} (${offer.daysSinceSent} days)`,
        completionType: 'action',
        link: `/applications/${offer.applicationId}`,
        metadata: {
          type: 'pending_offer',
          daysSince: offer.daysSinceSent,
          candidateName: offer.candidateName,
        },
      });
    }
  });

  // Rule 2: Stuck candidates (URGENT if > 7 days, IMPORTANT if > 3 days)
  Object.entries(data.stuckByStage).forEach(([stageId, info]) => {
    if (info.count > 0 && info.maxDays >= STUCK_DAYS_IMPORTANT) {
      const isUrgent = info.maxDays >= STUCK_DAYS_URGENT;
      items.push({
        id: `stuck-stage-${stageId}`,
        priority: isUrgent ? 'urgent' : 'important',
        category: 'candidate',
        title: `Review ${info.count} candidate${info.count > 1 ? 's' : ''} stuck in ${info.stageName} (${info.maxDays}+ days)`,
        completionType: 'action',
        link: `/applications?stage=${stageId}&stale=true`,
        metadata: {
          type: 'stuck_candidates',
          stageId: Number(stageId),
          count: info.count,
          stageName: info.stageName,
          daysSince: info.maxDays,
        },
      });
    }
  });

  // Rule 3: Unreviewed applications (URGENT if > 48hrs)
  if (data.unreviewedCount > 0) {
    const isUrgent = data.oldestUnreviewedHours >= UNREVIEWED_HOURS_URGENT;
    items.push({
      id: 'unreviewed-apps',
      priority: isUrgent ? 'urgent' : 'important',
      category: 'candidate',
      title: `Review ${data.unreviewedCount} new application${data.unreviewedCount > 1 ? 's' : ''}`,
      completionType: 'action',
      link: '/applications?status=new',
      metadata: {
        type: 'unreviewed_apps',
        count: data.unreviewedCount,
      },
    });
  }

  // Rule 4: No interviews scheduled for shortlisted candidates
  if (data.shortlistedNoInterview > 0) {
    items.push({
      id: 'schedule-interviews',
      priority: 'important',
      category: 'candidate',
      title: `Schedule interviews for ${data.shortlistedNoInterview} shortlisted candidate${data.shortlistedNoInterview > 1 ? 's' : ''}`,
      completionType: 'action',
      link: '/applications?status=shortlisted&noInterview=true',
      metadata: {
        type: 'no_interviews',
        count: data.shortlistedNoInterview,
      },
    });
  }

  // Rule 5: Low pipeline jobs (< 3 active candidates)
  data.jobsWithLowPipeline.forEach((job) => {
    items.push({
      id: `low-pipeline-${job.jobId}`,
      priority: 'important',
      category: 'job',
      title: `Source more for "${job.title}" (only ${job.activeCount} candidate${job.activeCount !== 1 ? 's' : ''})`,
      completionType: 'action',
      link: `/jobs/${job.jobId}`,
      metadata: {
        type: 'low_pipeline',
        jobId: job.jobId,
        count: job.activeCount,
        jobTitle: job.title,
      },
    });
  });

  // Rule 6: JD quality issues
  data.jdIssues.forEach((job) => {
    items.push({
      id: `jd-quality-${job.jobId}`,
      priority: 'important',
      category: 'job',
      title: `Improve JD for "${job.title}" - ${job.issue}`,
      completionType: 'action',
      link: `/jobs/${job.jobId}`,
      metadata: {
        type: 'jd_quality',
        jobId: job.jobId,
        jobTitle: job.title,
        issue: job.issue,
      },
    });
  });

  // Rule 7: Stale jobs (no activity > 30 days)
  data.staleJobs.forEach((job) => {
    if (job.daysSinceActivity >= STALE_JOB_DAYS) {
      items.push({
        id: `stale-job-${job.jobId}`,
        priority: 'maintenance',
        category: 'job',
        title: `Review or archive "${job.title}" (${job.daysSinceActivity} days inactive)`,
        completionType: 'action',
        link: `/jobs/${job.jobId}`,
        metadata: {
          type: 'stale_job',
          jobId: job.jobId,
          jobTitle: job.title,
          daysSince: job.daysSinceActivity,
        },
      });
    }
  });

  // Rule 8: Candidates needing status updates (> 14 days no communication)
  if (data.candidatesNeedingUpdate > 0) {
    items.push({
      id: 'status-updates',
      priority: 'maintenance',
      category: 'communication',
      title: `Send updates to ${data.candidatesNeedingUpdate} candidate${data.candidatesNeedingUpdate > 1 ? 's' : ''} awaiting response`,
      completionType: 'action',
      link: '/applications?needsUpdate=true',
      metadata: {
        type: 'status_updates',
        count: data.candidatesNeedingUpdate,
      },
    });
  }

  return items;
}

/**
 * Create a lightweight snapshot from pipeline data for verification
 */
export function createSnapshot(data: PipelineData): LightweightSnapshot {
  const stuckByStage: Record<number, number> = {};
  Object.entries(data.stuckByStage).forEach(([stageId, info]) => {
    stuckByStage[Number(stageId)] = info.count;
  });

  return {
    stuckByStage,
    unreviewedCount: data.unreviewedCount,
    pendingOfferCount: data.pendingOffers.length,
    lowPipelineJobIds: data.jobsWithLowPipeline.map((j) => j.jobId),
    staleJobIds: data.staleJobs.map((j) => j.jobId),
    shortlistedNoInterviewCount: data.shortlistedNoInterview,
  };
}

/**
 * Create a new checklist session
 */
export function createSession(
  userId: number,
  role: string,
  data: PipelineData,
  items: ActionItem[]
): ChecklistSession {
  return {
    id: crypto.randomUUID(),
    userId,
    role,
    generatedAt: new Date().toISOString(),
    snapshot: createSnapshot(data),
    items,
    completedIds: [],
    aiEnhanced: false,
  };
}

/**
 * Get localStorage key for a user's session
 */
export function getStorageKey(userId: number, role: string): string {
  return `pipeline-checklist-${userId}-${role}`;
}

/**
 * Save session to localStorage
 */
export function saveSession(session: ChecklistSession): void {
  const key = getStorageKey(session.userId, session.role);
  localStorage.setItem(key, JSON.stringify(session));
}

/**
 * Load session from localStorage
 */
export function loadSession(userId: number, role: string): ChecklistSession | null {
  const key = getStorageKey(userId, role);
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ChecklistSession;
  } catch {
    return null;
  }
}

/**
 * Check if session is stale (> 24 hours old)
 */
export function isSessionStale(session: ChecklistSession): boolean {
  const ageHours =
    (Date.now() - new Date(session.generatedAt).getTime()) / (1000 * 60 * 60);
  return ageHours > SESSION_EXPIRY_HOURS;
}

/**
 * Check if reanalyze is allowed
 * Conditions: 70%+ completed OR 24hrs elapsed
 */
export function canReanalyze(
  session: ChecklistSession,
  completedIds: Set<string>
): ReanalyzeCheck {
  if (session.items.length === 0) {
    return { allowed: true, reason: 'No items to complete' };
  }

  const completionRate = completedIds.size / session.items.length;
  const ageHours =
    (Date.now() - new Date(session.generatedAt).getTime()) / (1000 * 60 * 60);

  // Allow if 70%+ completed
  if (completionRate >= REANALYZE_COMPLETION_THRESHOLD) {
    return {
      allowed: true,
      reason: `${Math.round(completionRate * 100)}% completed`,
    };
  }

  // Allow if 24hrs elapsed
  if (ageHours >= SESSION_EXPIRY_HOURS) {
    return { allowed: true, reason: 'Session expired (24hrs)' };
  }

  // Not allowed - show helpful message
  const remaining = session.items.length - completedIds.size;
  const hoursLeft = Math.ceil(SESSION_EXPIRY_HOURS - ageHours);
  const percentNeeded = Math.ceil(REANALYZE_COMPLETION_THRESHOLD * 100);

  return {
    allowed: false,
    reason: `Complete ${remaining} more item${remaining > 1 ? 's' : ''} (${percentNeeded}%) or wait ${hoursLeft}hr${hoursLeft > 1 ? 's' : ''}`,
  };
}

/**
 * Group action items by priority for rendering
 */
export function groupByPriority(items: ActionItem[]): GroupedActionItems {
  return {
    urgent: items.filter((i) => i.priority === 'urgent'),
    important: items.filter((i) => i.priority === 'important'),
    maintenance: items.filter((i) => i.priority === 'maintenance'),
  };
}

/**
 * Verify completions by comparing snapshots
 */
export function verifyCompletions(
  items: ActionItem[],
  oldSnapshot: LightweightSnapshot,
  newData: PipelineData
): VerificationResult {
  const results: VerificationResult['results'] = {};

  items.forEach((item) => {
    switch (item.metadata.type) {
      case 'stuck_candidates': {
        const stageId = item.metadata.stageId!;
        const oldCount = oldSnapshot.stuckByStage[stageId] || 0;
        const newCount = newData.stuckByStage[stageId]?.count || 0;
        results[item.id] = {
          verified: newCount < oldCount,
          change: `${oldCount} -> ${newCount}`,
          mode: 'auto',
        };
        break;
      }

      case 'unreviewed_apps': {
        results[item.id] = {
          verified: newData.unreviewedCount < oldSnapshot.unreviewedCount,
          change: `${oldSnapshot.unreviewedCount} -> ${newData.unreviewedCount}`,
          mode: 'auto',
        };
        break;
      }

      case 'pending_offer': {
        results[item.id] = {
          verified: newData.pendingOffers.length < oldSnapshot.pendingOfferCount,
          change: `${oldSnapshot.pendingOfferCount} -> ${newData.pendingOffers.length}`,
          mode: 'auto',
        };
        break;
      }

      case 'low_pipeline': {
        const jobId = item.metadata.jobId!;
        const wasLow = oldSnapshot.lowPipelineJobIds.includes(jobId);
        const newJob = newData.jobsWithLowPipeline.find((j) => j.jobId === jobId);
        // Verified if: removed from low list OR count >= threshold
        const isHealthy = !newJob || newJob.activeCount >= LOW_PIPELINE_THRESHOLD;
        results[item.id] = {
          verified: wasLow && isHealthy,
          change: newJob
            ? `${item.metadata.count} -> ${newJob.activeCount}`
            : 'healthy',
          mode: 'auto',
        };
        break;
      }

      case 'no_interviews': {
        results[item.id] = {
          verified:
            newData.shortlistedNoInterview <
            oldSnapshot.shortlistedNoInterviewCount,
          change: `${oldSnapshot.shortlistedNoInterviewCount} -> ${newData.shortlistedNoInterview}`,
          mode: 'auto',
        };
        break;
      }

      // Manual verification types - trust the checkbox
      case 'jd_quality':
      case 'stale_job':
      case 'status_updates':
        results[item.id] = {
          verified: true,
          change: 'manual check',
          mode: 'manual',
        };
        break;

      default:
        results[item.id] = {
          verified: true,
          change: 'n/a',
          mode: 'auto',
        };
    }
  });

  const verifiedCount = Object.values(results).filter((r) => r.verified).length;
  const manualCount = Object.values(results).filter((r) => r.mode === 'manual').length;

  return {
    results,
    verifiedCount,
    totalCount: items.length,
    manualCount,
    readyForAi: verifiedCount >= items.length * REANALYZE_COMPLETION_THRESHOLD,
  };
}

/**
 * Calculate pipeline health score based on action items
 * Higher score = healthier pipeline (fewer urgent issues)
 */
export function calculateHealthImpact(items: ActionItem[]): {
  urgentCount: number;
  importantCount: number;
  maintenanceCount: number;
  projectedImprovement: number;
} {
  const grouped = groupByPriority(items);

  // Each urgent item represents ~10% health impact
  // Each important item represents ~5% health impact
  // Each maintenance item represents ~2% health impact
  const projectedImprovement =
    grouped.urgent.length * 10 +
    grouped.important.length * 5 +
    grouped.maintenance.length * 2;

  return {
    urgentCount: grouped.urgent.length,
    importantCount: grouped.important.length,
    maintenanceCount: grouped.maintenance.length,
    projectedImprovement: Math.min(projectedImprovement, 40), // Cap at 40%
  };
}

/**
 * AI enhancement result types
 */
export interface AIEnhancement {
  itemId: string;
  description: string;
  impact: string;
}

export interface AIEnhancementResult {
  enhancements: AIEnhancement[];
  additionalInsights: string[];
  model_version: string;
  timestamp: string;
}

/**
 * Fetch AI enhancements for action items
 */
export async function fetchAIEnhancements(
  items: ActionItem[],
  pipelineStats: { healthScore: number; totalCandidates: number; openJobs: number }
): Promise<AIEnhancementResult | null> {
  try {
    const response = await fetch('/api/ai/enhance-pipeline-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          priority: item.priority,
          category: item.category,
        })),
        pipelineStats,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('AI enhancement failed:', errorData.error || response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('AI enhancement request failed:', error);
    return null;
  }
}

/**
 * Merge AI enhancements into action items
 */
export function mergeAIEnhancements(
  items: ActionItem[],
  enhancements: AIEnhancement[]
): ActionItem[] {
  const enhancementMap = new Map(
    enhancements.map((e) => [e.itemId, e])
  );

  return items.map((item) => {
    const enhancement = enhancementMap.get(item.id);
    if (enhancement) {
      return {
        ...item,
        description: enhancement.description,
      };
    }
    return item;
  });
}
