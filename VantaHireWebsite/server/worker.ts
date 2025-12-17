import { startJobScheduler } from "./jobScheduler";
import { pool } from "./db";

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await pool?.end?.();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function main(): Promise<void> {
  console.log("[worker] Starting scheduler worker...");
  startJobScheduler();
  console.log("[worker] Running");
}

main().catch(async (err) => {
  console.error("[worker] Fatal error:", err);
  await pool?.end?.();
  process.exit(1);
});

