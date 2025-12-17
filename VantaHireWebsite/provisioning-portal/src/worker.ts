/**
 * Provisioning Worker
 *
 * Background process that:
 * 1. Polls for pending provisioning jobs
 * 2. Executes jobs with retry logic
 * 3. Handles job failures gracefully
 *
 * Run separately from the web server:
 * npm run start:worker
 */

import { config } from './config.js';
import { closeDb } from './db/index.js';
import { processNextJob, reapStuckJobs } from './services/provisioning.js';
import crypto from 'crypto';

// Reaper interval: check for stuck jobs every 60 seconds
const REAPER_INTERVAL_MS = 60 * 1000;

// Unique worker ID for job locking
const WORKER_ID = `worker-${crypto.randomBytes(4).toString('hex')}`;

let running = true;
let processing = false;

/**
 * Main worker loop
 */
async function runWorker(): Promise<void> {
  console.log(`Provisioning worker started: ${WORKER_ID}`);
  console.log(`Poll interval: ${config.JOB_POLL_INTERVAL_MS}ms`);
  console.log(`Max attempts per job: ${config.JOB_MAX_ATTEMPTS}`);

  while (running) {
    try {
      processing = true;
      const processedJob = await processNextJob(WORKER_ID);
      processing = false;

      if (processedJob) {
        // Processed a job, immediately check for more
        continue;
      }

      // No jobs available, wait before polling again
      await sleep(config.JOB_POLL_INTERVAL_MS);
    } catch (error) {
      processing = false;
      console.error('Worker error:', error);
      // Wait before retrying after error
      await sleep(config.JOB_POLL_INTERVAL_MS * 2);
    }
  }

  console.log('Worker loop exited');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reaper loop - periodically check for and reset stuck jobs
 */
async function runReaper(): Promise<void> {
  console.log(`Job reaper started (interval: ${REAPER_INTERVAL_MS}ms)`);

  while (running) {
    try {
      const reapedCount = await reapStuckJobs();
      if (reapedCount > 0) {
        console.log(`Reaper: reset ${reapedCount} stuck job(s)`);
      }
    } catch (error) {
      console.error('Reaper error:', error);
    }

    await sleep(REAPER_INTERVAL_MS);
  }

  console.log('Reaper loop exited');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down worker...`);
  running = false;

  // Wait for current job to finish (if any)
  if (processing) {
    console.log('Waiting for current job to complete...');
    // Give up to 30 seconds for job to complete
    for (let i = 0; i < 30 && processing; i++) {
      await sleep(1000);
    }
  }

  await closeDb();
  console.log('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start worker and reaper
Promise.all([
  runWorker(),
  runReaper(),
]).catch((error) => {
  console.error('Worker fatal error:', error);
  process.exit(1);
});
