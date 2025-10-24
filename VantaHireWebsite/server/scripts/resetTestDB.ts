import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Reset test database by truncating all tables
 *
 * Usage: tsx server/scripts/resetTestDB.ts
 *
 * WARNING: This will DELETE ALL DATA in the database.
 * Only use this with a dedicated test database!
 */
async function resetTestDB() {
  // Safety check: only run on databases with "test" in the name
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  if (!databaseUrl.includes('test')) {
    throw new Error(
      'Safety check failed: DATABASE_URL must contain "test" to prevent accidental data loss.\n' +
      'This script is only for test databases.'
    );
  }

  console.log('🔄 Resetting test database...');

  try {
    // Disable foreign key checks temporarily
    await db.execute(sql`SET session_replication_role = 'replica';`);

    // Truncate tables in dependency order (children first, then parents)
    // Forms feature tables
    await db.execute(sql`TRUNCATE TABLE form_response_answers CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE form_responses CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE form_invitations CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE form_fields CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE forms CASCADE;`);

    // ATS core tables
    await db.execute(sql`TRUNCATE TABLE applications CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE jobs CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE users CASCADE;`);

    // Re-enable foreign key checks
    await db.execute(sql`SET session_replication_role = 'origin';`);

    console.log('✅ Test database reset complete.');
    console.log('   All tables truncated. You can now run your tests.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting test database:', error);

    // Try to re-enable foreign key checks even on error
    try {
      await db.execute(sql`SET session_replication_role = 'origin';`);
    } catch (e) {
      // Ignore
    }

    process.exit(1);
  }
}

resetTestDB();
