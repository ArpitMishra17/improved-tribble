import rateLimit from "express-rate-limit";

/**
 * Rate limiter for AI analysis endpoints
 * - 20 requests per day per user
 * - Keyed by user ID (or IP if anonymous)
 */
export const aiAnalysisRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // 20 AI requests per day per user
  message: { error: "AI analysis limit reached (20/day). Try again tomorrow." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip || 'anonymous',
});
