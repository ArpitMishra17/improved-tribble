import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error('❌ Invalid password format (missing hash or salt)');
      return false;
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('❌ Error comparing passwords:', error);
    return false;
  }
}

async function main() {
  console.log('🔍 Admin Login Diagnostics');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check environment variables
  console.log('1️⃣  Environment Variables:');
  console.log(`   ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ Set (length: ' + process.env.ADMIN_PASSWORD.length + ')' : '❌ Not set'}`);
  console.log(`   SESSION_SECRET: ${process.env.SESSION_SECRET ? '✓ Set' : '❌ Not set'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '❌ Not set'}\n`);

  // Check if admin user exists
  console.log('2️⃣  Admin User Status:');
  try {
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);

    if (adminUser.length === 0) {
      console.log('   ❌ Admin user does NOT exist in database');
      console.log('   💡 Solution: Run `npm run admin:reset` to create admin user\n');
      process.exit(1);
    }

    const admin = adminUser[0];
    console.log('   ✓ Admin user EXISTS');
    console.log(`   - ID: ${admin.id}`);
    console.log(`   - Username: ${admin.username}`);
    console.log(`   - Role: ${admin.role}`);
    console.log(`   - First Name: ${admin.firstName}`);
    console.log(`   - Last Name: ${admin.lastName}\n`);

    // Check password format
    console.log('3️⃣  Password Hash Analysis:');
    const passwordParts = admin.password.split('.');
    if (passwordParts.length !== 2) {
      console.log('   ❌ Password format is INVALID (should be hash.salt)');
      console.log('   💡 Solution: Run `npm run admin:reset` to fix password\n');
      process.exit(1);
    }
    console.log('   ✓ Password format is valid (hash.salt)');
    console.log(`   - Hash length: ${passwordParts[0].length} chars`);
    console.log(`   - Salt length: ${passwordParts[1].length} chars\n`);

    // Test password if ADMIN_PASSWORD is set
    if (process.env.ADMIN_PASSWORD) {
      console.log('4️⃣  Password Verification Test:');
      console.log('   Testing ADMIN_PASSWORD against stored hash...');

      const isValid = await comparePasswords(process.env.ADMIN_PASSWORD, admin.password);

      if (isValid) {
        console.log('   ✅ PASSWORD MATCHES!');
        console.log('   ℹ️  Login should work with:');
        console.log('      Username: admin');
        console.log('      Password: [ADMIN_PASSWORD from env]');
      } else {
        console.log('   ❌ PASSWORD DOES NOT MATCH!');
        console.log('   💡 This means the stored password is different from ADMIN_PASSWORD');
        console.log('   💡 Solution: Run `npm run admin:reset` to sync the password');
      }
    } else {
      console.log('4️⃣  Password Verification Test:');
      console.log('   ⚠️  Skipped (ADMIN_PASSWORD not set)');
      console.log('   💡 Set ADMIN_PASSWORD env variable to test password verification');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('Diagnostic Complete\n');

  } catch (error) {
    console.error('❌ Database error:', error);
    console.log('\n💡 Possible issues:');
    console.log('   - Database connection failed');
    console.log('   - DATABASE_URL not set correctly');
    console.log('   - Database schema not pushed (run: npm run db:push)');
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
