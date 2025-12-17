/**
 * Provisioning Portal - Main Entry Point
 *
 * Web server that handles:
 * - Checkout flow (create Razorpay orders)
 * - Webhook processing (payment notifications)
 * - Install status queries
 * - Setup completion
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { config } from './config.js';
import { closeDb } from './db/index.js';

// Middleware
import { rateLimit } from './middleware/rateLimit.js';

// Routes
import checkoutRoutes from './routes/checkout.js';
import webhookRoutes from './routes/webhooks.js';
import installRoutes from './routes/install.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', secureHeaders());

// CORS config: credentials: true requires explicit origin, not '*'
// In production: only allow APP_BASE_URL
// In development: dynamically allow the requesting origin
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (config.NODE_ENV === 'production') {
        // In production, only allow APP_BASE_URL
        return origin === config.APP_BASE_URL ? origin : null;
      }
      // In development, allow any origin (echo back the origin)
      return origin || '*';
    },
    credentials: config.NODE_ENV === 'production',
  })
);

// Health checks (no rate limit)
app.get('/healthz', (c) => c.json({ status: 'ok' }));
app.get('/readyz', (c) => c.json({ status: 'ready' }));

// Rate limiters for different endpoints
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: 'Too many checkout requests, please wait before trying again',
});

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  message: 'Too many setup attempts, please wait before trying again',
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: 'Too many requests, please slow down',
});

// Webhooks - no rate limit (Razorpay controls the rate)
// But we should limit by payload signature to prevent abuse
app.route('/api/webhooks', webhookRoutes);

// API Routes with rate limiting
app.use('/api/checkout', checkoutLimiter);
app.use('/api/checkout/*', checkoutLimiter);
app.route('/api/checkout', checkoutRoutes);

app.use('/api/setup', setupLimiter);
app.use('/api/setup/*', setupLimiter);
app.use('/api/install', apiLimiter);
app.use('/api/install/*', apiLimiter);
app.route('/api', installRoutes);

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
    500
  );
});

// Not found handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server
const server = serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    console.log(`Provisioning portal running on http://localhost:${info.port}`);
    console.log(`Environment: ${config.NODE_ENV}`);
  }
);

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close database connection
  await closeDb();
  console.log('Database connection closed');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
