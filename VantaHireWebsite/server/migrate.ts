import { ensureAtsSchema } from "./bootstrapSchema";
import { pool } from "./db";

async function main(): Promise<void> {
  console.log("🚀 Running migrations (ensureAtsSchema)...");
  await ensureAtsSchema();
  console.log("✅ Migrations complete");
}

main()
  .then(async () => {
    await pool?.end?.();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("❌ Migration failed:", err);
    await pool?.end?.();
    process.exit(1);
  });

