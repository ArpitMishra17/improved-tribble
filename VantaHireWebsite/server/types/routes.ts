/**
 * Shared types for route registration
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Multer } from 'multer';

/**
 * CSRF protection middleware type
 */
export type CsrfMiddleware = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Options passed to route registration functions
 */
export interface RegisterRoutesOptions {
  app: Express;
  csrfProtection: CsrfMiddleware;
  upload: Multer;
}

/**
 * Authenticated request with user attached
 * Uses Express.User from the global declaration in auth.ts
 */
export interface AuthenticatedRequest extends Request {
  user: Express.User;
}
