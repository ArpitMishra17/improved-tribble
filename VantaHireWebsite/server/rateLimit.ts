import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response } from "express";

// Type for rate limit info attached to request by express-rate-limit
export interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetTime: Date;
}

/**
 * Helper to create rate limit handler with remaining count
 */
export const createRateLimitHandler = (errorMsg: string) => (req: Request, res: Response) => {
  const info = (req as Request & { rateLimit?: RateLimitInfo }).rateLimit;
  const retryAfter = info?.resetTime ? Math.ceil((info.resetTime.getTime() - Date.now()) / 1000) : undefined;
  res.status(429).json({
    error: errorMsg,
    limit: info?.limit,
    remaining: info?.remaining ?? 0,
    used: info?.used,
    retryAfterSeconds: retryAfter,
  });
};

/**
 * Rate limiter for AI analysis endpoints
 * - 20 requests per day per user
 * - Keyed by user ID (or IP if anonymous)
 */
export const aiAnalysisRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // 20 AI requests per day per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'anonymous',
  handler: createRateLimitHandler('AI analysis limit reached (20/day). Try again tomorrow.'),
});

/**
 * Rate limiter for job applications
 * - 10 applications per day per IP
 */
export const applicationRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 applications per day per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Application limit reached (10/day). Try again tomorrow.'),
});

/**
 * Rate limiter for job postings
 * - 10 job posts per day per user
 */
export const jobPostingRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 job posts per day per user
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Job posting limit reached (10/day). Try again tomorrow.'),
});

/**
 * Rate limiter for recruiter-add candidates
 * - 50 candidates per day per recruiter
 */
export const recruiterAddRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50, // 50 candidates per day per recruiter
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'anonymous',
  handler: createRateLimitHandler('Candidate addition limit reached (50/day). Try again tomorrow.'),
});
