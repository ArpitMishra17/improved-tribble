/**
 * CSRF Protection Middleware
 * Lightweight double-submit cookie pattern for session-backed mutations
 */

import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const isDevelopment = process.env.NODE_ENV === 'development';
const cookieName = isDevelopment ? 'x-csrf-token' : '__Host-psifi.x-csrf-token';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: !isDevelopment,
  path: '/',
};

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = decodeURIComponent(pair.slice(idx + 1).trim());
      out[key] = val;
    }
  });
  return out;
}

export function generateToken(_req: Request, res: Response): string {
  const token = randomBytes(32).toString('base64url');
  // Use Express's cookie setter
  (res as any).cookie?.(cookieName, token, cookieOptions) ??
    res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; SameSite=Lax${cookieOptions.secure ? '; Secure' : ''}; HttpOnly`);
  return token;
}

export function doubleCsrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  // Exempt public form endpoints from CSRF (they use token-based auth, not session cookies)
  if (req.path.startsWith('/api/forms/public/')) {
    next();
    return;
  }

  // Compare header token with cookie token (double submit cookie)
  const headerToken = (req.headers['x-csrf-token'] as string) || '';
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[cookieName] || '';

  if (headerToken && cookieToken && headerToken === cookieToken) {
    next();
    return;
  }

  res.status(403).json({ error: 'Invalid CSRF token' });
}
