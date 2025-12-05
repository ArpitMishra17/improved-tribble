/**
 * Playwright Global Setup
 *
 * Runs once before all E2E tests to:
 * 1. Verify environment is configured
 * 2. Wait for server to be ready
 * 3. Verify test users exist
 * 4. Seed deterministic test fixtures (jobs/applications)
 */

import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../../server/db';
import {
  jobs,
  applications,
  users,
  forms,
  formInvitations,
  emailTemplates,
  pipelineStages,
} from '@shared/schema';
import { randomUUID } from 'crypto';

interface TestFixtures {
  pendingJobId?: number;
  declinePendingJobId?: number;  // Separate pending job for decline test
  approvedJobId?: number;
  expiredJobId?: number;
  pipelineJobId?: number;
  applicationId?: number;
  publicFormToken?: string;
  interviewTemplateId?: number;
  stageIds?: number[];  // Pipeline stage IDs for drag/drop tests
}

const FIXTURES_FILE = path.join(process.cwd(), 'test-results', 'e2e-fixtures.json');

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:5000';
  const isCI = process.env.CI === 'true';
  const distIndex = path.resolve(process.cwd(), 'dist', 'index.js');

  console.log('\n📋 E2E Test Global Setup');
  console.log('========================');

  // Ensure required env vars
  const requiredEnvVars = ['DATABASE_URL'];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  } else {
    console.log('✅ Required environment variables present');
  }

  // In CI, build the server if needed
  if (isCI && !fs.existsSync(distIndex)) {
    console.log('\n🔧 CI mode: building server bundle for tests...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build complete');
  }

  // Wait for server readiness
  console.log(`\n🔄 Waiting for server at ${baseURL}...`);
  const maxRetries = 30;
  const retryDelay = 2000;
  let serverReady = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${baseURL}/api/jobs`, { headers: { Host: 'localhost:5000' } });
      if (response.ok || response.status === 401) {
        serverReady = true;
        console.log(`✅ Server ready (attempt ${i + 1})`);
        break;
      }
    } catch {
      // continue retrying
    }
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  if (!serverReady) {
    throw new Error(`Server at ${baseURL} not ready after ${maxRetries} attempts`);
  }

  // Quick auth page sanity check
  console.log('\n🔄 Verifying auth page...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${baseURL}/auth`, { timeout: 30000 });
    await Promise.race([
      page.waitForSelector('form', { timeout: 10000 }),
      page.waitForSelector('[data-testid="error"]', { timeout: 10000 }),
      page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 }),
    ]);
    console.log('✅ Auth page accessible');
  } catch (error) {
    console.warn(`⚠️  Auth page check failed: ${error}`);
  } finally {
    await browser.close();
  }

  // Verify test users via API login
  console.log('\n🔄 Verifying test users...');
  const verifyUser = async (username: string, password: string) => {
    try {
      const response = await fetch(`${baseURL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Host: 'localhost:5000' },
        body: JSON.stringify({ username, password }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const adminOk = await verifyUser('admin', 'admin123');
  const recruiterOk = await verifyUser('recruiter', 'recruiter123');
  console.log(adminOk ? '✅ Admin user verified' : '⚠️  Admin login failed');
  console.log(recruiterOk ? '✅ Recruiter user verified' : '⚠️  Recruiter login failed');

  // Seed fixtures directly via DB to avoid flaky UI dependencies
  console.log('\n🔄 Seeding test fixtures...');
  const fixtures: TestFixtures = {};

  try {
    const adminUser = await db.query.users.findFirst({ where: eq(users.username, 'admin') });
    const recruiterUser = await db.query.users.findFirst({ where: eq(users.username, 'recruiter') });

    if (!adminUser || !recruiterUser) {
      console.warn('⚠️  Admin or recruiter user not found; skipping fixture seeding.');
    } else {
      const baseJob = {
        title: `E2E Job ${Date.now()}`,
        location: 'Remote',
        type: 'full-time',
        description: 'Seeded job for automated E2E tests.',
        skills: ['javascript', 'react'],
        postedBy: recruiterUser.id,
      } as const;

      // Pending job (for approval test)
      const pendingJob = await db.insert(jobs).values({
        ...baseJob,
        status: 'pending',
        isActive: false,
      }).returning({ id: jobs.id });
      fixtures.pendingJobId = pendingJob[0]?.id;

      // Second pending job (for decline test - won't be touched by approval test)
      const declinePendingJob = await db.insert(jobs).values({
        ...baseJob,
        title: `${baseJob.title} For Decline`,
        status: 'pending',
        isActive: false,
      }).returning({ id: jobs.id });
      fixtures.declinePendingJobId = declinePendingJob[0]?.id;

      // Approved job (with reviewer info)
      const approvedJob = await db.insert(jobs).values({
        ...baseJob,
        title: `${baseJob.title} Approved`,
        status: 'approved',
        isActive: true,
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
      }).returning({ id: jobs.id });
      fixtures.approvedJobId = approvedJob[0]?.id;

      // Expired/inactive job
      const expiredJob = await db.insert(jobs).values({
        ...baseJob,
        title: `${baseJob.title} Expired`,
        status: 'approved',
        isActive: false,
        expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      }).returning({ id: jobs.id });
      fixtures.expiredJobId = expiredJob[0]?.id;

      // Seed pipeline stages if not already present
      const existingStages = await db.query.pipelineStages.findMany();
      if (existingStages.length === 0) {
        const stageData = [
          { name: 'Applied', order: 0, color: '#3b82f6', isDefault: true },
          { name: 'Screening', order: 1, color: '#8b5cf6', isDefault: false },
          { name: 'Interview', order: 2, color: '#f59e0b', isDefault: false },
          { name: 'Offer', order: 3, color: '#10b981', isDefault: false },
        ];
        const stageResults = await db.insert(pipelineStages).values(
          stageData.map((s) => ({ ...s, createdBy: adminUser.id }))
        ).returning({ id: pipelineStages.id });
        fixtures.stageIds = stageResults.map((s) => s.id);
      } else {
        fixtures.stageIds = existingStages.map((s) => s.id);
      }

      // Pipeline job with one application
      const pipelineJob = await db.insert(jobs).values({
        ...baseJob,
        title: `${baseJob.title} Pipeline`,
        status: 'approved',
        isActive: true,
      }).returning({ id: jobs.id });
      fixtures.pipelineJobId = pipelineJob[0]?.id;

      // Get the first stage ID for the application
      const firstStageId = fixtures.stageIds?.[0] || null;

      if (fixtures.pipelineJobId) {
        const appResult = await db.insert(applications).values({
          jobId: fixtures.pipelineJobId,
          name: 'E2E Candidate',
          email: `candidate-${Date.now()}@example.com`,
          phone: '1234567890',
          resumeUrl: 'seed-resume.pdf',
          resumeFilename: 'seed-resume.pdf',
          status: 'submitted',
          currentStage: firstStageId,  // Assign to first pipeline stage
          appliedAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: applications.id });
        fixtures.applicationId = appResult[0]?.id;
      }

      // Public form + token (with fields for UI/validation tests)
      const formResult = await db.insert(forms).values({
        name: `E2E Public Form ${Date.now()}`,
        description: 'Public form for automated E2E tests',
        isPublished: true,
        createdBy: recruiterUser.id,
      }).returning({ id: forms.id });
      const formId = formResult[0]?.id;

      if (formId && fixtures.applicationId) {
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const snapshot = {
          formName: `E2E Public Form ${Date.now()}`,
          formDescription: 'Public form snapshot',
          fields: [
            { id: 1, name: 'fullName', type: 'text', label: 'Full Name', required: true },
            { id: 2, name: 'email', type: 'email', label: 'Email Address', required: true },
            { id: 3, name: 'phone', type: 'tel', label: 'Phone Number', required: false },
            { id: 4, name: 'experience', type: 'textarea', label: 'Work Experience', required: false },
          ],
        };

        const invitationResult = await db.insert(formInvitations).values({
          applicationId: fixtures.applicationId,
          formId,
          token,
          expiresAt,
          status: 'pending',
          sentBy: recruiterUser.id,
          sentAt: new Date(),
          fieldSnapshot: JSON.stringify(snapshot),
        }).returning({ token: formInvitations.token });
        fixtures.publicFormToken = invitationResult[0]?.token || token;
      }

      // Interview email template (if missing)
      const existingTemplate = await db.query.emailTemplates.findFirst({
        where: eq(emailTemplates.name, 'E2E Interview Template'),
      });
      if (!existingTemplate) {
        const tplResult = await db.insert(emailTemplates).values({
          name: 'E2E Interview Template',
          subject: 'Interview Invitation',
          body: 'Please join the interview at {{time}}',
          createdBy: adminUser.id,
          isDefault: false,
          templateType: 'interview',
        }).returning({ id: emailTemplates.id });
        fixtures.interviewTemplateId = tplResult[0]?.id;
      } else {
        fixtures.interviewTemplateId = existingTemplate.id;
      }

      console.log('✅ Seeded jobs: pending, approved, expired, pipeline with candidate');
    }
  } catch (error) {
    console.warn(`⚠️  Error seeding fixtures: ${error}`);
  }

  // Persist fixtures for tests
  try {
    fs.mkdirSync(path.dirname(FIXTURES_FILE), { recursive: true });
    fs.writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2));
    if (fixtures.pendingJobId) process.env.TEST_PENDING_JOB_ID = String(fixtures.pendingJobId);
    if (fixtures.declinePendingJobId) process.env.TEST_DECLINE_PENDING_JOB_ID = String(fixtures.declinePendingJobId);
    if (fixtures.approvedJobId) process.env.TEST_APPROVED_JOB_ID = String(fixtures.approvedJobId);
    if (fixtures.expiredJobId) process.env.TEST_EXPIRED_JOB_ID = String(fixtures.expiredJobId);
    if (fixtures.pipelineJobId) process.env.TEST_PIPELINE_JOB_ID = String(fixtures.pipelineJobId);
    if (fixtures.applicationId) process.env.TEST_APPLICATION_ID = String(fixtures.applicationId);
    if (fixtures.publicFormToken) process.env.TEST_PUBLIC_FORM_TOKEN = fixtures.publicFormToken;
    if (fixtures.interviewTemplateId) process.env.TEST_INTERVIEW_TEMPLATE_ID = String(fixtures.interviewTemplateId);
    if (fixtures.stageIds?.length) process.env.TEST_STAGE_IDS = JSON.stringify(fixtures.stageIds);
    console.log(`✅ Fixtures saved to ${FIXTURES_FILE}`);
  } catch (error) {
    console.warn(`⚠️  Failed to save fixtures file: ${error}`);
  }

  console.log('\n========================');
  console.log('Global setup complete\n');
}

export default globalSetup;
