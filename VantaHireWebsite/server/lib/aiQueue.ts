/**
 * AI Queue Module with BullMQ
 *
 * Provides async job processing for AI fit scoring.
 * Uses ioredis (required by BullMQ) alongside existing redis package.
 *
 * Features:
 * - Two queues: interactive (single) and batch (bulk)
 * - Graceful connection handling
 * - Queue health monitoring
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Queue names
export const QUEUES = {
  INTERACTIVE: 'ai:interactive',
  BATCH: 'ai:batch',
} as const;

// Configuration from environment
const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_NAMESPACE = process.env.NODE_ENV || 'development';

// Connection state
let ioRedisConnection: IORedis | null = null;
let interactiveQueue: Queue | null = null;
let batchQueue: Queue | null = null;
let connectionReady = false;
let connectionError: Error | null = null;

// Job data types
export interface FitJobData {
  applicationId: number;
  userId: number;
  dbJobId: number;
}

export interface BatchFitJobData {
  applicationIds: number[];
  userId: number;
  dbJobId: number;
  processedIds?: number[];
}

// Summary batch job data (for recruiter bulk AI summary generation)
export interface SummaryBatchJobData {
  applicationIds: number[];
  recruiterId: number;
  dbJobId: number;
  regenerate: boolean;
  processedIds?: number[];
  jobType: 'summary';
}

export interface QueueHealthMetrics {
  interactive: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  batch: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  redis: {
    connected: boolean;
    latencyMs?: number;
  };
}

/**
 * Get or create ioredis connection for BullMQ
 */
export function getIoRedisConnection(): IORedis {
  if (ioRedisConnection && ioRedisConnection.status === 'ready') {
    return ioRedisConnection;
  }

  if (!REDIS_URL) {
    throw new Error('REDIS_URL is required for AI queue');
  }

  ioRedisConnection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, max 3000ms
      const delay = Math.min(3000, Math.pow(2, times) * 100);
      console.log(`[AI Queue] Redis reconnecting (attempt ${times}), delay: ${delay}ms`);
      return delay;
    },
  });

  ioRedisConnection.on('connect', () => {
    console.log('[AI Queue] Redis connected');
    connectionReady = true;
    connectionError = null;
  });

  ioRedisConnection.on('error', (err: Error) => {
    console.error('[AI Queue] Redis error:', err.message);
    connectionError = err;
  });

  ioRedisConnection.on('close', () => {
    console.warn('[AI Queue] Redis connection closed');
    connectionReady = false;
  });

  return ioRedisConnection;
}

/**
 * Initialize queues (lazy initialization)
 */
function initQueues(): { interactive: Queue; batch: Queue } {
  if (interactiveQueue && batchQueue) {
    return { interactive: interactiveQueue, batch: batchQueue };
  }

  // Cast connection to any - BullMQ bundles its own ioredis with slightly different types
  const connection = getIoRedisConnection() as any;

  interactiveQueue = new Queue(QUEUES.INTERACTIVE, {
    connection,
    prefix: `{${REDIS_NAMESPACE}}`,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // 7 days
      },
    },
  });

  batchQueue = new Queue(QUEUES.BATCH, {
    connection,
    prefix: `{${REDIS_NAMESPACE}}`,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 100,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
      },
    },
  });

  return { interactive: interactiveQueue, batch: batchQueue };
}

/**
 * Get queue instances
 */
export function getQueues(): { interactive: Queue; batch: Queue } {
  return initQueues();
}

/**
 * Check if queue system is available
 * This triggers connection initialization if not already started
 */
export function isQueueAvailable(): boolean {
  if (!REDIS_URL) {
    return false;
  }

  // Trigger connection initialization if not started
  if (!ioRedisConnection) {
    try {
      getIoRedisConnection();
      // Connection is being established - return true optimistically
      // The actual queue operations will wait for connection
      return true;
    } catch {
      return false;
    }
  }

  // Connection exists - check if it's errored out permanently
  if (connectionError) {
    return false;
  }

  // Connection is ready or still connecting
  return true;
}

/**
 * Enqueue a single fit computation job
 *
 * @returns BullMQ job ID (internal use only)
 */
export async function enqueueInteractive(data: FitJobData): Promise<string> {
  const { interactive } = getQueues();

  const job = await interactive.add('fit', data, {
    jobId: `fit-${data.applicationId}-${Date.now()}`,
  });

  console.log(`[AI Queue] Enqueued interactive job: ${job.id} for app ${data.applicationId}`);
  return job.id!;
}

/**
 * Enqueue a batch fit computation job
 *
 * @returns BullMQ job ID (internal use only)
 */
export async function enqueueBatch(data: BatchFitJobData): Promise<string> {
  const { batch } = getQueues();

  const job = await batch.add('batch-fit', data, {
    jobId: `batch-${data.dbJobId}-${Date.now()}`,
  });

  console.log(`[AI Queue] Enqueued batch job: ${job.id} for ${data.applicationIds.length} apps`);
  return job.id!;
}

/**
 * Enqueue a summary batch job (for recruiter bulk AI summary generation)
 *
 * @returns BullMQ job ID (internal use only)
 */
export async function enqueueSummaryBatch(data: SummaryBatchJobData): Promise<string> {
  const { batch } = getQueues();

  const job = await batch.add('batch-summary', data, {
    jobId: `summary-${data.dbJobId}-${Date.now()}`,
  });

  console.log(`[AI Queue] Enqueued summary batch job: ${job.id} for ${data.applicationIds.length} apps`);
  return job.id!;
}

/**
 * Get queue health metrics
 */
export async function getQueueHealth(): Promise<QueueHealthMetrics> {
  const startTime = Date.now();

  try {
    const { interactive, batch } = getQueues();

    const [interactiveCounts, batchCounts] = await Promise.all([
      interactive.getJobCounts('waiting', 'active', 'completed', 'failed'),
      batch.getJobCounts('waiting', 'active', 'completed', 'failed'),
    ]);

    const latencyMs = Date.now() - startTime;

    return {
      interactive: {
        waiting: interactiveCounts.waiting || 0,
        active: interactiveCounts.active || 0,
        completed: interactiveCounts.completed || 0,
        failed: interactiveCounts.failed || 0,
      },
      batch: {
        waiting: batchCounts.waiting || 0,
        active: batchCounts.active || 0,
        completed: batchCounts.completed || 0,
        failed: batchCounts.failed || 0,
      },
      redis: {
        connected: connectionReady,
        latencyMs,
      },
    };
  } catch (error) {
    return {
      interactive: { waiting: 0, active: 0, completed: 0, failed: 0 },
      batch: { waiting: 0, active: 0, completed: 0, failed: 0 },
      redis: {
        connected: false,
        latencyMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Remove a job from the queue by BullMQ job ID
 */
export async function removeJob(queueName: typeof QUEUES[keyof typeof QUEUES], bullJobId: string): Promise<boolean> {
  try {
    const { interactive, batch } = getQueues();
    const queue = queueName === QUEUES.INTERACTIVE ? interactive : batch;

    const job = await queue.getJob(bullJobId);
    if (job) {
      await job.remove();
      console.log(`[AI Queue] Removed job: ${bullJobId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[AI Queue] Failed to remove job ${bullJobId}:`, error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeQueues(): Promise<void> {
  console.log('[AI Queue] Closing queues...');

  const closePromises: Promise<void>[] = [];

  if (interactiveQueue) {
    closePromises.push(interactiveQueue.close());
  }
  if (batchQueue) {
    closePromises.push(batchQueue.close());
  }
  if (ioRedisConnection) {
    closePromises.push(
      ioRedisConnection.quit().then(() => {
        ioRedisConnection = null;
      })
    );
  }

  await Promise.all(closePromises);
  console.log('[AI Queue] Queues closed');
}

// Graceful shutdown handlers
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);
