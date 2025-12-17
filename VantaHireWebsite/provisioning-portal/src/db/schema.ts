import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ============================================
// ENUMS for state machines
// ============================================

export const purchaseStatusEnum = pgEnum('purchase_status', [
  'pending',    // Order created, awaiting payment
  'paid',       // Payment captured
  'failed',     // Payment failed
  'refunded',   // Payment refunded
]);

export const installStatusEnum = pgEnum('install_status', [
  'pending',        // Waiting for payment
  'provisioning',   // Railway project being created
  'setup_pending',  // Provisioned, awaiting admin setup
  'active',         // Fully provisioned and running
  'failed',         // Provisioning failed
  'suspended',      // Suspended (non-payment, abuse, etc.)
]);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',     // Ready to process
  'processing',  // Currently being processed
  'completed',   // Successfully completed
  'failed',      // Failed after max retries
  'cancelled',   // Manually cancelled
]);

export const webhookStatusEnum = pgEnum('webhook_status', [
  'received',    // Stored, not yet processed
  'processed',   // Successfully processed
  'ignored',     // Intentionally skipped
  'failed',      // Processing failed
]);

// ============================================
// CUSTOMERS
// ============================================

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// PURCHASES (Razorpay orders & payments)
// ============================================

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),

  // Razorpay identifiers
  provider: text('provider').notNull().default('razorpay'),
  providerOrderId: text('provider_order_id').notNull().unique(),
  providerPaymentId: text('provider_payment_id').unique(),

  // Status
  status: purchaseStatusEnum('status').notNull().default('pending'),

  // Amount
  amount: integer('amount').notNull(), // In smallest unit (paise for INR)
  currency: text('currency').notNull().default('INR'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
}, (table) => ({
  orderIdIdx: uniqueIndex('purchases_order_id_idx').on(table.providerOrderId),
  statusIdx: index('purchases_status_idx').on(table.status),
}));

// ============================================
// WEBHOOK EVENTS (for idempotency/deduplication)
// ============================================

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),

  // Provider info
  provider: text('provider').notNull().default('razorpay'),
  eventId: text('event_id').notNull(), // Razorpay event ID
  eventType: text('event_type').notNull(), // payment.captured, order.paid, etc.

  // Entity IDs for deduplication
  entityId: text('entity_id'), // payment_id or order_id

  // Raw payload (for debugging/replay)
  payloadJson: jsonb('payload_json').notNull(),

  // Processing status
  status: webhookStatusEnum('status').notNull().default('received'),
  errorMessage: text('error_message'),

  // Timestamps
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  // Prevent duplicate event processing
  eventDedupeIdx: uniqueIndex('webhook_events_dedupe_idx').on(table.provider, table.eventId),
  statusIdx: index('webhook_events_status_idx').on(table.status),
}));

// ============================================
// RAILWAY INSTALLS (provisioned instances)
// ============================================

export const railInstalls = pgTable('rail_installs', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  purchaseId: integer('purchase_id').references(() => purchases.id).notNull().unique(),

  // Railway project info
  railwayProjectId: text('railway_project_id').unique(),
  railwayProjectName: text('railway_project_name'),
  railwayEnvironmentId: text('railway_environment_id'),

  // Service IDs
  railwayWebServiceId: text('railway_web_service_id'),
  railwayWorkerServiceId: text('railway_worker_service_id'),
  railwayPostgresServiceId: text('railway_postgres_service_id'),
  railwayRedisServiceId: text('railway_redis_service_id'),

  // Domain
  domain: text('domain'),
  customDomain: text('custom_domain'),

  // State machine
  status: installStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  provisionedAt: timestamp('provisioned_at'),
  activatedAt: timestamp('activated_at'),
});

// ============================================
// SETUP TOKENS (one-time admin setup links)
// Instead of storing admin passwords, we generate
// a one-time setup token that expires
// ============================================

export const setupTokens = pgTable('setup_tokens', {
  id: serial('id').primaryKey(),
  installId: integer('install_id').references(() => railInstalls.id).notNull(),

  // Token (hashed, not stored in plaintext)
  tokenHash: text('token_hash').notNull().unique(),

  // Generated session secret (encrypted)
  sessionSecretEncrypted: text('session_secret_encrypted').notNull(),
  sessionSecretNonce: text('session_secret_nonce').notNull(),

  // Status
  used: boolean('used').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
});

// ============================================
// PROVISIONING JOBS (durable job queue)
// ============================================

export const provisioningJobs = pgTable('provisioning_jobs', {
  id: serial('id').primaryKey(),
  installId: integer('install_id').references(() => railInstalls.id).notNull(),

  // Job type
  jobType: text('job_type').notNull(), // 'provision', 'configure', 'deploy', etc.

  // State machine
  status: jobStatusEnum('status').notNull().default('pending'),

  // Retry tracking
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastError: text('last_error'),

  // Scheduling
  nextRunAt: timestamp('next_run_at').defaultNow().notNull(),
  lockedUntil: timestamp('locked_until'), // Pessimistic lock for workers
  lockedBy: text('locked_by'), // Worker ID that has the lock

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusNextRunIdx: index('jobs_status_next_run_idx').on(table.status, table.nextRunAt),
  installJobTypeIdx: index('jobs_install_type_idx').on(table.installId, table.jobType),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type RailInstall = typeof railInstalls.$inferSelect;
export type NewRailInstall = typeof railInstalls.$inferInsert;

export type SetupToken = typeof setupTokens.$inferSelect;
export type NewSetupToken = typeof setupTokens.$inferInsert;

export type ProvisioningJob = typeof provisioningJobs.$inferSelect;
export type NewProvisioningJob = typeof provisioningJobs.$inferInsert;
