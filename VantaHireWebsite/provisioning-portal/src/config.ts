import { z } from 'zod';

/**
 * Environment configuration with strict validation
 *
 * Note: DATABASE_URL uses z.string() not z.url() because
 * postgres:// DSNs are not valid URLs per URL spec
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Razorpay (India payments)
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET required'),

  // Railway API
  RAILWAY_API_TOKEN: z.string().min(1, 'RAILWAY_API_TOKEN required'),
  RAILWAY_TEAM_ID: z.string().optional(),
  // Template ID for VantaHire (web + worker + postgres + redis)
  RAILWAY_TEMPLATE_ID: z.string().min(1, 'RAILWAY_TEMPLATE_ID required'),

  // Control Plane Database (postgres DSN, not URL)
  CONTROL_PLANE_DATABASE_URL: z.string().min(1, 'CONTROL_PLANE_DATABASE_URL required'),

  // Encryption - 32 bytes = 64 hex chars
  ENCRYPTION_MASTER_KEY: z.string().length(64, 'ENCRYPTION_MASTER_KEY must be 64 hex chars (32 bytes)'),

  // App Config
  APP_BASE_URL: z.string().url('APP_BASE_URL must be valid URL'),

  // GitHub repo for Railway to clone (must be accessible by Railway)
  GITHUB_REPO_URL: z.string().min(1).default('https://github.com/your-org/vantahire'),

  // Pricing
  DEFAULT_PLAN_AMOUNT: z.coerce.number().default(99900), // ₹999 in paise
  CURRENCY: z.string().default('INR'),

  // Job processing
  JOB_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  JOB_MAX_ATTEMPTS: z.coerce.number().default(3),
  JOB_RETRY_DELAY_MS: z.coerce.number().default(30000),

  // Setup link expiry (for one-time admin password setup)
  SETUP_LINK_EXPIRY_HOURS: z.coerce.number().default(24),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
