/**
 * Checkout routes
 *
 * POST /api/checkout - Create Razorpay order and return checkout config
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/index.js';
import { customers, purchases } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import * as razorpay from '../services/razorpay.js';
import { config } from '../config.js';

const app = new Hono();

const checkoutSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(1, 'Name required').max(100),
});

/**
 * POST /api/checkout
 *
 * Creates a Razorpay order and returns the checkout configuration
 * for the frontend to initiate payment.
 */
app.post('/', zValidator('json', checkoutSchema), async (c) => {
  const { email, name } = c.req.valid('json');

  // Get or create customer
  let [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email.toLowerCase()));

  if (!customer) {
    [customer] = await db
      .insert(customers)
      .values({
        email: email.toLowerCase(),
        name,
      })
      .returning();
  }

  // Create Razorpay order
  const order = await razorpay.createOrder({
    amount: config.DEFAULT_PLAN_AMOUNT,
    currency: config.CURRENCY,
    customerId: customer.id,
    customerEmail: customer.email,
    customerName: customer.name,
  });

  // Store purchase record (pending)
  await db.insert(purchases).values({
    customerId: customer.id,
    provider: 'razorpay',
    providerOrderId: order.orderId,
    status: 'pending',
    amount: order.amount,
    currency: order.currency,
  });

  // Return checkout config for frontend
  return c.json({
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    keyId: order.keyId,
    prefill: {
      name: customer.name,
      email: customer.email,
    },
    notes: {
      customer_id: customer.id.toString(),
    },
  });
});

export default app;
