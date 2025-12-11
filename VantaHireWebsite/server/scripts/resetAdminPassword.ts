import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function main() {
  const newPassword = process.env.ADMIN_PASSWORD;
  if (!newPassword) {
    console.error('ADMIN_PASSWORD is not set. Please set it and rerun.');
    process.exit(1);
  }

  const hashed = await hashPassword(newPassword);

  // Try update existing admin
  const updated = await db
    .update(users)
    .set({ password: hashed })
    .where(eq(users.username, 'admin'))
    .returning();

  if (updated.length > 0) {
    console.log('✅ Updated existing admin password.');
    process.exit(0);
  }

  // Create admin if missing
  const created = await db
    .insert(users)
    .values({
      username: 'admin',
      password: hashed,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'super_admin',
    })
    .returning();

  if (created.length > 0) {
    console.log('✅ Admin user did not exist. Created a new admin with the provided password.');
    process.exit(0);
  }

  console.error('❌ Failed to update or create admin user.');
  process.exit(1);
}

main().catch((e) => {
  console.error('Error resetting admin password:', e);
  process.exit(1);
});

