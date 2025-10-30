/**
 * AI Usage Limits and Free Tier Tracking
 *
 * Free tier limits:
 * - 5 fit computations per month
 * - 1 content suggestion per lifetime
 *
 * This module tracks usage and enforces limits
 */

import { db } from '../db';
import { userAiUsage, users } from '../../shared/schema';
import { eq, and, sql, gte } from 'drizzle-orm';

const FREE_FIT_LIMIT_PER_MONTH = 5;
const FREE_CONTENT_LIMIT_LIFETIME = 1;

export interface UserLimits {
  fitUsedThisMonth: number;
  fitRemainingThisMonth: number;
  contentUsedLifetime: boolean;
  contentRemainingLifetime: number;
  canUseFit: boolean;
  canUseContent: boolean;
}

/**
 * Get user's AI usage limits
 */
export async function getUserLimits(userId: number): Promise<UserLimits> {
  // Get start of current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count fit computations this month
  const fitUsage = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(userAiUsage)
    .where(
      and(
        eq(userAiUsage.userId, userId),
        eq(userAiUsage.kind, 'fit'),
        gte(userAiUsage.computedAt, startOfMonth)
      )
    );

  const fitUsedThisMonth = fitUsage[0]?.count || 0;
  const fitRemainingThisMonth = Math.max(0, FREE_FIT_LIMIT_PER_MONTH - fitUsedThisMonth);

  // Check if content suggestion used
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { aiContentFreeUsed: true },
  });

  const contentUsedLifetime = user?.aiContentFreeUsed || false;
  const contentRemainingLifetime = contentUsedLifetime ? 0 : 1;

  return {
    fitUsedThisMonth,
    fitRemainingThisMonth,
    canUseFit: fitRemainingThisMonth > 0,
    contentUsedLifetime,
    contentRemainingLifetime,
    canUseContent: !contentUsedLifetime,
  };
}

/**
 * Check if user can use fit computation
 */
export async function canUseFitComputation(userId: number): Promise<boolean> {
  const limits = await getUserLimits(userId);
  return limits.canUseFit;
}

/**
 * Check if user can use content suggestion
 */
export async function canUseContentSuggestion(userId: number): Promise<boolean> {
  const limits = await getUserLimits(userId);
  return limits.canUseContent;
}

/**
 * Mark content suggestion as used (one-time flag)
 */
export async function markContentSuggestionUsed(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ aiContentFreeUsed: true })
    .where(eq(users.id, userId));
}

/**
 * Get monthly reset date
 */
export function getMonthlyResetDate(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
}
