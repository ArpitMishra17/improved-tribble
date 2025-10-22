import { storage } from './storage';
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function generateSecurePassword(length: number = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await storage.getUserByUsername('admin');
    if (existingAdmin) {
      console.log('✓ Admin user already exists');
      return existingAdmin;
    }

    // Use env variable or generate secure random password
    const adminPassword = process.env.ADMIN_PASSWORD || generateSecurePassword(24);
    const wasGenerated = !process.env.ADMIN_PASSWORD;

    // Create admin user
    const hashedPassword = await hashPassword(adminPassword);
    const adminUser = await storage.createUser({
      username: 'admin',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin'
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 ADMIN USER CREATED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Username: admin');
    console.log(`Password: ${adminPassword}`);
    console.log('Role: admin');
    if (wasGenerated) {
      console.log('');
      console.log('⚠️  PASSWORD WAS AUTO-GENERATED');
      console.log('💡 Set ADMIN_PASSWORD env variable to use a custom password');
      console.log('🔒 SAVE THIS PASSWORD - it cannot be retrieved later!');
    }
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    return adminUser;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
}

export async function createTestRecruiter() {
  try {
    // Check if recruiter user already exists
    const existingRecruiter = await storage.getUserByUsername('recruiter');
    if (existingRecruiter) {
      console.log('Test recruiter already exists');
      return existingRecruiter;
    }

    // Create recruiter user
    const hashedPassword = await hashPassword('recruiter123');
    const recruiterUser = await storage.createUser({
      username: 'recruiter',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Recruiter',
      role: 'recruiter'
    });

    console.log('Test recruiter created successfully:');
    console.log('Username: recruiter');
    console.log('Password: recruiter123');
    console.log('Role: recruiter');
    
    return recruiterUser;
  } catch (error) {
    console.error('Error creating test recruiter:', error);
    throw error;
  }
}