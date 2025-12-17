/**
 * Razorpay payment integration
 *
 * Uses Razorpay Orders API flow:
 * 1. Create order server-side
 * 2. Pass order_id to Razorpay Checkout on frontend
 * 3. Verify webhook signature on payment.captured
 *
 * CRITICAL: Webhook signature verification MUST use raw request body bytes,
 * NOT JSON.stringify(req.body) which can be forged.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config.js';

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

export interface CreateOrderParams {
  amount: number; // In paise (smallest currency unit)
  currency: string;
  customerId: number;
  customerEmail: string;
  customerName: string;
}

export interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  customerName: string;
  customerEmail: string;
}

/**
 * Create a Razorpay order
 *
 * The order_id is required for Razorpay Checkout to work properly.
 * Payments without an order_id are problematic.
 */
export async function createOrder(params: CreateOrderParams): Promise<OrderResponse> {
  const receipt = `cust_${params.customerId}_${Date.now()}`;

  const order = await razorpay.orders.create({
    amount: params.amount,
    currency: params.currency,
    receipt,
    notes: {
      customer_id: params.customerId.toString(),
      customer_email: params.customerEmail,
      customer_name: params.customerName,
    },
  });

  return {
    orderId: order.id,
    amount: order.amount as number,
    currency: order.currency,
    keyId: config.RAZORPAY_KEY_ID,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
  };
}

/**
 * Verify Razorpay webhook signature
 *
 * CRITICAL: rawBody MUST be the exact bytes received from the HTTP request,
 * NOT a re-serialized JSON object. Use express.raw() or equivalent.
 *
 * @param rawBody - Raw request body as Buffer
 * @param signature - X-Razorpay-Signature header value
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string
): boolean {
  if (!signature || !rawBody || rawBody.length === 0) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison with length check to prevent timing attacks
  // and avoid timingSafeEqual throwing on length mismatch
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verify payment signature (for frontend callback verification)
 *
 * This is used when the frontend sends back the payment details
 * after successful checkout.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!params.orderId || !params.paymentId || !params.signature) {
    return false;
  }

  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  const sigBuffer = Buffer.from(params.signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPayment(paymentId: string) {
  return razorpay.payments.fetch(paymentId);
}

/**
 * Fetch order details from Razorpay
 */
export async function fetchOrder(orderId: string) {
  return razorpay.orders.fetch(orderId);
}

/**
 * Extract relevant info from webhook payload
 */
export function parseWebhookPayload(payload: any): {
  eventId: string;
  eventType: string;
  orderId: string | null;
  paymentId: string | null;
  amount: number | null;
  currency: string | null;
} {
  const eventId = payload.event_id || payload.id || `unknown_${Date.now()}`;
  const eventType = payload.event || 'unknown';

  // Handle different event structures
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;

  return {
    eventId,
    eventType,
    orderId: payment?.order_id || order?.id || null,
    paymentId: payment?.id || null,
    amount: payment?.amount || order?.amount || null,
    currency: payment?.currency || order?.currency || null,
  };
}
