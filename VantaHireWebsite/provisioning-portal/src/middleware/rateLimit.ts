/**
 * Simple in-memory rate limiter
 *
 * For production, use Redis-backed rate limiting
 * to work across multiple instances.
 */

import { Context, Next } from 'hono';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 60000); // Every minute

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (c: Context) => string; // Function to generate key
  message?: string; // Error message
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = (c) => c.req.header('x-forwarded-for') || 'unknown',
    message = 'Too many requests, please try again later',
  } = options;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    store[key].count++;

    // Set rate limit headers
    const remaining = Math.max(0, max - store[key].count);
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(store[key].resetAt / 1000)));

    if (store[key].count > max) {
      c.header('Retry-After', String(Math.ceil((store[key].resetAt - now) / 1000)));
      return c.json({ error: message }, 429);
    }

    await next();
  };
}
