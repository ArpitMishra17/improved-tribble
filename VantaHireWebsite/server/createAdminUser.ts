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

    // Security: Never log passwords (even in development)
    console.log('✅ Admin user created/verified successfully');
    if (wasGenerated && process.env.NODE_ENV !== 'production') {
      console.log('⚠️  Auto-generated admin password - set ADMIN_PASSWORD env variable for custom password');
    }

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

    console.log('Test recruiter created successfully');
    console.log('Username: recruiter');
    console.log('Role: recruiter');
    // Password intentionally not logged for security
    
    return recruiterUser;
  } catch (error) {
    console.error('Error creating test recruiter:', error);
    throw error;
  }
}

// Ensure admin password matches ADMIN_PASSWORD if provided via env.
export async function syncAdminPasswordIfEnv() {
  try {
    const newPassword = process.env.ADMIN_PASSWORD;
    if (!newPassword) return;

    const existingAdmin = await storage.getUserByUsername('admin');
    const hashedPassword = await hashPassword(newPassword);

    if (existingAdmin) {
      // Update password
      await storage.updateUserPassword(existingAdmin.id, hashedPassword);
      console.log('✓ Admin password synchronized from ADMIN_PASSWORD');
      return;
    }

    // Create admin if missing
    await storage.createUser({
      username: 'admin',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin'
    });
    console.log('✓ Admin created from ADMIN_PASSWORD');
  } catch (error) {
    console.error('Error syncing admin password:', error);
  }
}
