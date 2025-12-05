import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const isCI = process.env.CI === 'true';
const skipWebServer = process.env.PW_SKIP_WEBSERVER === 'true';

const webServerConfig = skipWebServer ? undefined : {
  command: isCI ? 'node dist/index.js' : 'npm run dev',
  url: 'http://localhost:5000',
  reuseExistingServer: !isCI,
  timeout: 120 * 1000,
  env: {
    ALLOWED_HOSTS: 'localhost:5000,127.0.0.1:5000',
    ADMIN_PASSWORD: 'admin123',
    SEED_DEFAULTS: 'true',
    NODE_ENV: 'development',
    DATABASE_URL: process.env.DATABASE_URL || '',
    SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret',
  },
};

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line']
  ],
  // Global setup for seeding test data
  globalSetup: './test/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: webServerConfig,
});
