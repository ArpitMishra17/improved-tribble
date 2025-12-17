/**
 * Install status and setup routes
 *
 * GET /api/install/:id - Get install status (requires auth)
 * POST /api/setup/:token - Complete setup with admin password
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/index.js';
import { railInstalls, customers, purchases } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getInstallStatus, completeSetup } from '../services/provisioning.js';

const app = new Hono();

/**
 * GET /api/install/:id
 *
 * Get install status. Requires customer authentication.
 * For now, we use email in query param and verify ownership (replace with signed token/JWT).
 */
app.get('/install/:id', async (c) => {
  const installId = parseInt(c.req.param('id'), 10);

  if (isNaN(installId)) {
    return c.json({ error: 'Invalid install ID' }, 400);
  }

  // TODO: Implement proper auth (JWT or signed token)
  // For now, require email in query param and verify ownership
  const email = c.req.query('email');

  if (!email) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Find customer by email
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email.toLowerCase()));

  if (!customer) {
    return c.json({ error: 'Customer not found' }, 404);
  }

  // Get install status (verifies ownership)
  const install = await getInstallStatus(installId, customer.id);

  if (!install) {
    return c.json({ error: 'Install not found' }, 404);
  }

  // Return sanitized status (no internal IDs)
  return c.json({
    id: install.id,
    status: install.status,
    domain: install.domain,
    customDomain: install.customDomain,
    errorMessage: install.status === 'failed' ? install.errorMessage : undefined,
    createdAt: install.createdAt,
    provisionedAt: install.provisionedAt,
    activatedAt: install.activatedAt,
  });
});

/**
 * GET /api/install/by-purchase/:orderId
 *
 * Get install by Razorpay order ID (for frontend redirect after payment)
 */
app.get('/install/by-purchase/:orderId', async (c) => {
  const orderId = c.req.param('orderId');

  if (!orderId) {
    return c.json({ error: 'Order ID required' }, 400);
  }

  // Find purchase
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.providerOrderId, orderId));

  if (!purchase) {
    return c.json({ error: 'Purchase not found' }, 404);
  }

  // Find install
  const [install] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.purchaseId, purchase.id));

  if (!install) {
    // Purchase exists but no install yet - still processing
    return c.json({
      status: 'pending',
      message: 'Your instance is being provisioned. Please wait...',
    });
  }

  return c.json({
    id: install.id,
    status: install.status,
    domain: install.domain,
    errorMessage: install.status === 'failed' ? install.errorMessage : undefined,
  });
});

// Setup password schema with validation
const setupSchema = z.object({
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      'Password must contain lowercase, uppercase, digit, and special character'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * POST /api/setup/:token
 *
 * Complete setup with admin password.
 * This is called when the customer clicks the one-time setup link.
 */
app.post('/setup/:token', zValidator('json', setupSchema), async (c) => {
  const token = c.req.param('token');
  const { password } = c.req.valid('json');

  if (!token || token.length !== 64) {
    return c.json({ error: 'Invalid setup token' }, 400);
  }

  try {
    const result = await completeSetup(token, password);

    return c.json({
      success: true,
      domain: result.domain,
      message: `Your VantaHire instance is ready at https://${result.domain}`,
      loginUrl: `https://${result.domain}/auth`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup failed';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/setup/:token
 *
 * Validate setup token (for frontend to check before showing form)
 */
app.get('/setup/:token', async (c) => {
  const token = c.req.param('token');

  if (!token || token.length !== 64) {
    return c.json({ valid: false, error: 'Invalid token format' }, 400);
  }

  // Import hashToken and check
  const { hashToken } = await import('../services/encryption.js');
  const { setupTokens } = await import('../db/schema.js');

  const tokenHash = await hashToken(token);

  const [setupToken] = await db
    .select()
    .from(setupTokens)
    .where(eq(setupTokens.tokenHash, tokenHash));

  if (!setupToken) {
    return c.json({ valid: false, error: 'Token not found' }, 404);
  }

  if (setupToken.used) {
    return c.json({ valid: false, error: 'Token already used' }, 400);
  }

  if (new Date() > setupToken.expiresAt) {
    return c.json({ valid: false, error: 'Token expired' }, 400);
  }

  // Get install info
  const [install] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.id, setupToken.installId));

  return c.json({
    valid: true,
    domain: install?.domain,
    expiresAt: setupToken.expiresAt,
  });
});

export default app;
