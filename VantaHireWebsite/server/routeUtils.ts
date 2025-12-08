/**
 * Route Utilities - Central re-exports for route modules
 *
 * This module provides a single import point for common middleware and utilities
 * needed by route modules, avoiding circular dependencies.
 */

// CSRF Protection
export { doubleCsrfProtection, generateToken } from './csrf';

// Rate Limiting
export {
  createRateLimitHandler,
  aiAnalysisRateLimit,
  applicationRateLimit,
  jobPostingRateLimit,
  recruiterAddRateLimit,
  type RateLimitInfo,
} from './rateLimit';

// Authentication
export { requireAuth, requireRole } from './auth';

// Database
export { db } from './db';

// Storage
export { storage } from './storage';

// File Upload (GCS)
export { upload, uploadToGCS, getSignedDownloadUrl, downloadFromGCS } from './gcs-storage';
