/**
 * Provisioning orchestration service
 *
 * Handles the complete flow:
 * 1. Payment received -> Create install record
 * 2. Deploy from Railway template
 * 3. Configure customer-specific variables
 * 4. Generate setup token for admin access
 * 5. Notify customer with setup link
 *
 * State machine:
 * pending -> provisioning -> setup_pending -> active
 *                       \-> failed
 */

import { eq, and, lte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  railInstalls,
  provisioningJobs,
  setupTokens,
  customers,
  purchases,
  type RailInstall,
  type ProvisioningJob,
} from '../db/schema.js';
import * as railway from './railway.js';
import * as encryption from './encryption.js';
import { config } from '../config.js';

// ============================================
// JOB CREATION
// ============================================

/**
 * Create a provisioning job for a purchase
 * Called after payment is confirmed
 */
export async function createProvisioningJob(purchaseId: number): Promise<number> {
  // Get purchase and customer
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId));

  if (!purchase) {
    throw new Error(`Purchase ${purchaseId} not found`);
  }

  if (purchase.status !== 'paid') {
    throw new Error(`Purchase ${purchaseId} is not paid (status: ${purchase.status})`);
  }

  // Check for existing install (idempotency)
  const [existingInstall] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.purchaseId, purchaseId));

  if (existingInstall) {
    // Already have an install - check if we need to retry
    if (existingInstall.status === 'active' || existingInstall.status === 'setup_pending') {
      console.log(`Install ${existingInstall.id} already exists for purchase ${purchaseId}`);
      return existingInstall.id;
    }

    // If failed, we can retry by creating a new job
    if (existingInstall.status === 'failed') {
      await db
        .update(railInstalls)
        .set({ status: 'pending', errorMessage: null })
        .where(eq(railInstalls.id, existingInstall.id));

      await createJob(existingInstall.id, 'provision');
      return existingInstall.id;
    }

    // If provisioning is in progress, don't create duplicate
    return existingInstall.id;
  }

  // Create new install record
  const [install] = await db
    .insert(railInstalls)
    .values({
      customerId: purchase.customerId,
      purchaseId: purchase.id,
      status: 'pending',
    })
    .returning({ id: railInstalls.id });

  // Create provisioning job
  await createJob(install.id, 'provision');

  return install.id;
}

/**
 * Create a job in the queue
 */
async function createJob(
  installId: number,
  jobType: string,
  delayMs: number = 0
): Promise<void> {
  const nextRunAt = new Date(Date.now() + delayMs);

  await db.insert(provisioningJobs).values({
    installId,
    jobType,
    status: 'pending',
    maxAttempts: config.JOB_MAX_ATTEMPTS,
    nextRunAt,
  });
}

// ============================================
// JOB PROCESSING
// ============================================

/**
 * Claim and process pending jobs
 * Called by the worker process
 */
export async function processNextJob(workerId: string): Promise<boolean> {
  const now = new Date();
  const lockDuration = 5 * 60 * 1000; // 5 minutes
  const lockedUntil = new Date(now.getTime() + lockDuration);

  // IMPORTANT: Claim exactly one job.
  // A plain UPDATE ... WHERE can match many rows; we select the next job with SKIP LOCKED.
  const claimed = await db.execute(sql`
    UPDATE provisioning_jobs
    SET
      status = 'processing',
      locked_until = ${lockedUntil},
      locked_by = ${workerId},
      started_at = COALESCE(started_at, ${now}),
      attempts = attempts + 1
    WHERE id = (
      SELECT id
      FROM provisioning_jobs
      WHERE
        status = 'pending'
        AND next_run_at <= ${now}
        AND (locked_until IS NULL OR locked_until < ${now})
      ORDER BY next_run_at ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      id,
      install_id AS "installId",
      job_type AS "jobType",
      attempts,
      max_attempts AS "maxAttempts";
  `);

  const job = (claimed as any)?.rows?.[0] as Pick<
    ProvisioningJob,
    'id' | 'installId' | 'jobType' | 'attempts' | 'maxAttempts'
  > | undefined;

  if (!job) {
    return false; // No jobs to process
  }

  try {
    await executeJob(job);

    // Mark as completed
    await db
      .update(provisioningJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        lockedUntil: null,
        lockedBy: null,
      })
      .where(eq(provisioningJobs.id, job.id));

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Job ${job.id} failed:`, errorMessage);

    if (job.attempts >= job.maxAttempts) {
      // Max retries reached - mark as failed
      await db
        .update(provisioningJobs)
        .set({
          status: 'failed',
          lastError: errorMessage,
          lockedUntil: null,
          lockedBy: null,
        })
        .where(eq(provisioningJobs.id, job.id));

      // Also mark install as failed
      await db
        .update(railInstalls)
        .set({
          status: 'failed',
          errorMessage,
        })
        .where(eq(railInstalls.id, job.installId));
    } else {
      // Schedule retry with exponential backoff
      const retryDelay = config.JOB_RETRY_DELAY_MS * Math.pow(2, job.attempts - 1);
      const nextRunAt = new Date(Date.now() + retryDelay);

      await db
        .update(provisioningJobs)
        .set({
          status: 'pending',
          lastError: errorMessage,
          nextRunAt,
          lockedUntil: null,
          lockedBy: null,
        })
        .where(eq(provisioningJobs.id, job.id));
    }

    return true; // We did process a job, even if it failed
  }
}

/**
 * Execute a provisioning job
 */
async function executeJob(
  job: Pick<ProvisioningJob, 'id' | 'installId' | 'jobType' | 'attempts' | 'maxAttempts'>
): Promise<void> {
  switch (job.jobType) {
    case 'provision':
      await executeProvision(job.installId);
      break;
    case 'configure':
      await executeConfigure(job.installId);
      break;
    case 'deploy':
      await executeDeploy(job.installId);
      break;
    default:
      throw new Error(`Unknown job type: ${job.jobType}`);
  }
}

// ============================================
// PROVISIONING STEPS
// ============================================

/**
 * Step 1: Deploy from Railway template
 */
async function executeProvision(installId: number): Promise<void> {
  const [install] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.id, installId));

  if (!install) {
    throw new Error(`Install ${installId} not found`);
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, install.customerId));

  if (!customer) {
    throw new Error(`Customer ${install.customerId} not found`);
  }

  // Update status
  await db
    .update(railInstalls)
    .set({ status: 'provisioning' })
    .where(eq(railInstalls.id, installId));

  // Generate project name
  const projectName = railway.generateProjectName(customer.email);

  // Deploy from template
  const result = await railway.deployFromTemplate({
    templateId: config.RAILWAY_TEMPLATE_ID,
    projectName,
    teamId: config.RAILWAY_TEAM_ID,
  });

  // Wait for project details to be available (template deploy is async)
  const project = await railway.waitForProjectReady({ projectId: result.projectId });

  // Find the production environment
  const prodEnv = project.environments.edges.find(
    (e) => e.node.name === 'production'
  );
  const environmentId = prodEnv?.node.id || project.environments.edges[0]?.node.id;
  if (!environmentId) {
    throw new Error(`No Railway environment found for project ${result.projectId}`);
  }

  // Find services by name
  const webService = project.services.edges.find(
    (s) => s.node.name === 'web' || s.node.name.includes('web')
  );
  const workerService = project.services.edges.find(
    (s) => s.node.name === 'worker' || s.node.name.includes('worker')
  );
  if (!webService?.node?.id) {
    throw new Error(`No 'web' service found in Railway project ${result.projectId} (template misconfigured)`);
  }
  if (!workerService?.node?.id) {
    throw new Error(`No 'worker' service found in Railway project ${result.projectId} (template misconfigured)`);
  }

  // Rename project to customer-specific name
  await railway.renameProject(result.projectId, projectName);

  // Update install record
  await db
    .update(railInstalls)
    .set({
      railwayProjectId: result.projectId,
      railwayProjectName: projectName,
      railwayEnvironmentId: environmentId,
      railwayWebServiceId: webService?.node.id,
      railwayWorkerServiceId: workerService?.node.id,
    })
    .where(eq(railInstalls.id, installId));

  // Create next job: configure
  await createJob(installId, 'configure');
}

/**
 * Step 2: Configure customer-specific variables
 */
async function executeConfigure(installId: number): Promise<void> {
  const [install] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.id, installId));

  if (!install || !install.railwayProjectId || !install.railwayEnvironmentId) {
    throw new Error(`Install ${installId} not ready for configuration`);
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, install.customerId));

  if (!customer) {
    throw new Error(`Customer ${install.customerId} not found`);
  }

  // Generate session secret (encrypted storage for audit, sent to Railway)
  const sessionSecret = await encryption.generateSecureToken(32);

  // Create domain for web service
  let domain = install.domain;
  if (!domain && install.railwayWebServiceId) {
    const domainResult = await railway.createServiceDomain({
      serviceId: install.railwayWebServiceId,
      environmentId: install.railwayEnvironmentId,
    });
    domain = domainResult.domain;
  }
  if (!domain) {
    throw new Error(`Failed to create/get domain for install ${installId}`);
  }

  // Set variables for web service
  if (install.railwayWebServiceId) {
    await railway.setServiceVariables({
      projectId: install.railwayProjectId,
      environmentId: install.railwayEnvironmentId,
      serviceId: install.railwayWebServiceId,
      variables: {
        NODE_ENV: 'production',
        SESSION_SECRET: sessionSecret,
        BASE_URL: `https://${domain}`,
        ALLOWED_HOSTS: domain || '',
        PGPOOL_MAX: '5',
        // Note: ADMIN_PASSWORD will be set via setup link
        // DATABASE_URL and REDIS_URL are auto-wired by Railway template
      },
    });
  }

  // Set variables for worker service
  if (install.railwayWorkerServiceId) {
    await railway.setServiceVariables({
      projectId: install.railwayProjectId,
      environmentId: install.railwayEnvironmentId,
      serviceId: install.railwayWorkerServiceId,
      variables: {
        NODE_ENV: 'production',
        SESSION_SECRET: sessionSecret,
        ENABLE_SCHEDULER: 'true',
        PGPOOL_MAX: '3',
      },
    });
  }

  // Store encrypted session secret
  const { encrypted: sessionSecretEnc, nonce: sessionSecretNonce } =
    await encryption.encrypt(sessionSecret);

  // Generate setup token (one-time link for admin to set password)
  const setupToken = await encryption.generateSecureToken(32);
  const tokenHash = await encryption.hashToken(setupToken);
  const expiresAt = new Date(Date.now() + config.SETUP_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

  // Revoke any prior unused setup tokens for this install (job retries can create multiple).
  await db
    .update(setupTokens)
    .set({ used: true, usedAt: new Date() })
    .where(and(eq(setupTokens.installId, installId), eq(setupTokens.used, false)));

  await db.insert(setupTokens).values({
    installId,
    tokenHash,
    sessionSecretEncrypted: sessionSecretEnc,
    sessionSecretNonce,
    expiresAt,
  });

  // Update install with domain
  await db
    .update(railInstalls)
    .set({ domain })
    .where(eq(railInstalls.id, installId));

  // Create next job: deploy
  await createJob(installId, 'deploy');

  // TODO: Send email to customer with setup link
  console.log(`Setup link for customer ${customer.email}:`);
  console.log(`${config.APP_BASE_URL}/setup/${setupToken}`);
}

/**
 * Step 3: Trigger deployment
 */
async function executeDeploy(installId: number): Promise<void> {
  const [install] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.id, installId));

  if (!install || !install.railwayProjectId || !install.railwayEnvironmentId) {
    throw new Error(`Install ${installId} not ready for deployment`);
  }

  // Trigger deployment for web service
  if (install.railwayWebServiceId) {
    await railway.triggerDeployment({
      serviceId: install.railwayWebServiceId,
      environmentId: install.railwayEnvironmentId,
    });
  }

  // Trigger deployment for worker service
  if (install.railwayWorkerServiceId) {
    await railway.triggerDeployment({
      serviceId: install.railwayWorkerServiceId,
      environmentId: install.railwayEnvironmentId,
    });
  }

  // Mark as setup_pending (waiting for admin to set password)
  await db
    .update(railInstalls)
    .set({
      status: 'setup_pending',
      provisionedAt: new Date(),
    })
    .where(eq(railInstalls.id, installId));
}

// ============================================
// SETUP COMPLETION
// ============================================

/**
 * Complete setup with admin password
 * Called when admin uses the setup link
 */
export async function completeSetup(
  setupToken: string,
  adminPassword: string
): Promise<{ domain: string }> {
  const tokenHash = await encryption.hashToken(setupToken);

  const [token] = await db
    .select()
    .from(setupTokens)
    .where(eq(setupTokens.tokenHash, tokenHash));

  if (!token) {
    throw new Error('Invalid setup token');
  }

  if (token.used) {
    throw new Error('Setup token already used');
  }

  if (new Date() > token.expiresAt) {
    throw new Error('Setup token expired');
  }

  const [install] = await db
    .select()
    .from(railInstalls)
    .where(eq(railInstalls.id, token.installId));

  if (!install || !install.railwayProjectId || !install.railwayWebServiceId) {
    throw new Error('Install not ready');
  }

  // Set admin password on Railway
  await railway.setServiceVariables({
    projectId: install.railwayProjectId,
    environmentId: install.railwayEnvironmentId!,
    serviceId: install.railwayWebServiceId,
    variables: {
      ADMIN_PASSWORD: adminPassword,
    },
  });

  // Trigger redeploy to pick up new password
  await railway.triggerDeployment({
    serviceId: install.railwayWebServiceId,
    environmentId: install.railwayEnvironmentId!,
  });

  // Mark token as used
  await db
    .update(setupTokens)
    .set({ used: true, usedAt: new Date() })
    .where(eq(setupTokens.id, token.id));

  // Mark install as active
  await db
    .update(railInstalls)
    .set({
      status: 'active',
      activatedAt: new Date(),
    })
    .where(eq(railInstalls.id, install.id));

  return { domain: install.domain! };
}

// ============================================
// JOB REAPER (for stuck jobs)
// ============================================

/**
 * Reap stuck jobs - reset jobs that have been locked too long
 * Should be called periodically (e.g., every minute)
 */
export async function reapStuckJobs(): Promise<number> {
  const now = new Date();

  // Find jobs that are processing but lock has expired
  const result = await db.execute(sql`
    UPDATE provisioning_jobs
    SET
      status = CASE
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'pending'
      END,
      locked_until = NULL,
      locked_by = NULL,
      last_error = CASE
        WHEN attempts >= max_attempts THEN 'Job timed out after max retries'
        ELSE COALESCE(last_error, 'Job lock expired - rescheduled')
      END,
      next_run_at = ${now}
    WHERE
      status = 'processing'
      AND locked_until IS NOT NULL
      AND locked_until < ${now}
    RETURNING id, install_id AS "installId", attempts, max_attempts AS "maxAttempts"
  `);

  const reaped = (result as any)?.rows || [];

  // For jobs that hit max attempts, also mark their installs as failed
  for (const job of reaped) {
    if (job.attempts >= job.maxAttempts) {
      await db
        .update(railInstalls)
        .set({
          status: 'failed',
          errorMessage: 'Provisioning timed out after max retries',
        })
        .where(eq(railInstalls.id, job.installId));

      console.log(`Job ${job.id} for install ${job.installId} marked as failed (max retries exceeded)`);
    } else {
      console.log(`Job ${job.id} for install ${job.installId} reset for retry (lock expired)`);
    }
  }

  return reaped.length;
}

// ============================================
// STATUS QUERIES
// ============================================

/**
 * Get install status for a customer
 */
export async function getInstallStatus(
  installId: number,
  customerId: number
): Promise<RailInstall | null> {
  const [install] = await db
    .select()
    .from(railInstalls)
    .where(
      and(
        eq(railInstalls.id, installId),
        eq(railInstalls.customerId, customerId)
      )
    );

  return install || null;
}
