/**
 * Standalone migration script
 * Run with: npx tsx server/scripts/runMigrations.ts
 */
import { ensureAtsSchema } from '../bootstrapSchema';

async function main() {
  console.log('🚀 Running database migrations...');

  try {
    await ensureAtsSchema();
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
