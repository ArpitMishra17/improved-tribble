/**
 * Webhook routes
 *
 * POST /api/webhooks/razorpay - Handle Razorpay payment webhooks
 *
 * CRITICAL: Webhook signature must be verified using raw request body bytes,
 * NOT a re-serialized JSON object.
 */

import { Hono } from 'hono';
import { db } from '../db/index.js';
import { webhookEvents, purchases } from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import * as razorpay from '../services/razorpay.js';
import { createProvisioningJob } from '../services/provisioning.js';

const app = new Hono();

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay sends webhook events for payment lifecycle.
 * We handle: payment.captured, order.paid
 *
 * Flow:
 * 1. Verify signature using raw body
 * 2. Store event for idempotency
 * 3. Update purchase status
 * 4. Queue provisioning job
 * 5. Return 200 immediately (processing is async)
 */
app.post('/razorpay', async (c) => {
  // Get raw body for signature verification
  const rawBody = await c.req.arrayBuffer();
  const rawBodyBuffer = Buffer.from(rawBody);

  // Get signature from header
  const signature = c.req.header('x-razorpay-signature');

  if (!signature) {
    console.error('Webhook missing signature header');
    return c.json({ error: 'Missing signature' }, 400);
  }

  // Verify signature with raw body bytes
  if (!razorpay.verifyWebhookSignature(rawBodyBuffer, signature)) {
    console.error('Webhook signature verification failed');
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Parse the verified payload
  let payload: any;
  try {
    payload = JSON.parse(rawBodyBuffer.toString('utf-8'));
  } catch (e) {
    console.error('Failed to parse webhook payload');
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = razorpay.parseWebhookPayload(payload);

  // Idempotency: treat duplicate deliveries as retries unless already processed/ignored.
  // This avoids a critical race where a webhook arrives before checkout writes the purchase row.
  const [existingEvent] = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, 'razorpay'), eq(webhookEvents.eventId, parsed.eventId)));

  if (existingEvent && (existingEvent.status === 'processed' || existingEvent.status === 'ignored')) {
    console.log(`Duplicate webhook event already handled: ${parsed.eventId}`);
    return c.json({ status: 'duplicate', eventId: parsed.eventId });
  }

  // Handle race condition: use ON CONFLICT DO NOTHING and re-select if needed
  let event = existingEvent;
  if (!event) {
    const inserted = await db
      .insert(webhookEvents)
      .values({
        provider: 'razorpay',
        eventId: parsed.eventId,
        eventType: parsed.eventType,
        entityId: parsed.paymentId || parsed.orderId,
        payloadJson: payload,
        status: 'received',
      })
      .onConflictDoNothing({
        target: [webhookEvents.provider, webhookEvents.eventId],
      })
      .returning();

    if (inserted.length > 0) {
      event = inserted[0];
    } else {
      // Another request won the race - fetch the existing record
      const [raceWinner] = await db
        .select()
        .from(webhookEvents)
        .where(and(eq(webhookEvents.provider, 'razorpay'), eq(webhookEvents.eventId, parsed.eventId)));

      if (raceWinner && (raceWinner.status === 'processed' || raceWinner.status === 'ignored')) {
        console.log(`Race condition resolved - event already handled: ${parsed.eventId}`);
        return c.json({ status: 'duplicate', eventId: parsed.eventId });
      }
      event = raceWinner;
    }
  }

  if (!event) {
    console.error(`Failed to create or find webhook event: ${parsed.eventId}`);
    return c.json({ error: 'Internal error' }, 500);
  }

  // Handle payment events
  if (parsed.eventType === 'payment.captured' || parsed.eventType === 'order.paid') {
    if (!parsed.orderId) {
      console.error(`No order_id in ${parsed.eventType} event`);
      await db
        .update(webhookEvents)
        .set({ status: 'failed', errorMessage: 'Missing order_id' })
        .where(eq(webhookEvents.id, event.id));
      return c.json({ error: 'Missing order_id' }, 400);
    }

    // Find purchase by order ID
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.providerOrderId, parsed.orderId));

    if (!purchase) {
      console.error(`Purchase not found for order ${parsed.orderId}`);
      await db
        .update(webhookEvents)
        .set({ status: 'failed', errorMessage: 'Purchase not found' })
        .where(eq(webhookEvents.id, event.id));
      // Return 200 so the provider doesn't retry forever; this event can be replayed safely.
      return c.json({ status: 'purchase_not_found', eventId: parsed.eventId });
    }

    // Check if already processed (payment.captured and order.paid can both arrive)
    if (purchase.status === 'paid') {
      console.log(`Purchase ${purchase.id} already paid`);
      await db
        .update(webhookEvents)
        .set({ status: 'ignored', processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));
      return c.json({ status: 'already_processed', purchaseId: purchase.id });
    }

    // Update purchase status
    await db
      .update(purchases)
      .set({
        status: 'paid',
        providerPaymentId: parsed.paymentId,
        paidAt: new Date(),
      })
      .where(eq(purchases.id, purchase.id));

    // Queue provisioning job (durable, async)
    try {
      const installId = await createProvisioningJob(purchase.id);
      console.log(`Queued provisioning job for install ${installId}`);

      await db
        .update(webhookEvents)
        .set({ status: 'processed', processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));

      return c.json({
        status: 'ok',
        purchaseId: purchase.id,
        installId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to queue provisioning: ${errorMessage}`);

      await db
        .update(webhookEvents)
        .set({ status: 'failed', errorMessage, processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));

      // Still return 200 to prevent Razorpay retries
      // The webhook event is stored, we can manually retry
      return c.json({ status: 'queued_failed', error: errorMessage });
    }
  }

  // Handle other events (refund, failed, etc.)
  if (parsed.eventType === 'payment.failed') {
    if (parsed.orderId) {
      await db
        .update(purchases)
        .set({ status: 'failed' })
        .where(eq(purchases.providerOrderId, parsed.orderId));
    }

    await db
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(webhookEvents.id, event.id));

    return c.json({ status: 'payment_failed' });
  }

  if (parsed.eventType === 'refund.created' || parsed.eventType === 'refund.processed') {
    if (parsed.paymentId) {
      await db
        .update(purchases)
        .set({ status: 'refunded' })
        .where(eq(purchases.providerPaymentId, parsed.paymentId));
    }

    await db
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(webhookEvents.id, event.id));

    return c.json({ status: 'refund_processed' });
  }

  // Unknown event type - store but ignore
  await db
    .update(webhookEvents)
    .set({ status: 'ignored', processedAt: new Date() })
    .where(eq(webhookEvents.id, event.id));

  return c.json({ status: 'ignored', eventType: parsed.eventType });
});

export default app;
