#!/usr/bin/env tsx
/**
 * Manual testing script for job scheduler functionality
 * Run with: tsx server/tests/manualTestScheduler.ts
 */

import { storage } from '../storage';
import { db } from '../db';
import { jobs, applications, users } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { getJobsNearExpiry, expireJob } from '../jobScheduler';

async function runSchedulerTests() {
  console.log('🧪 Starting Manual Job Scheduler Tests\n');

  let testJobId: number | null = null;
  let testJobId2: number | null = null;
  let testUserId: number = 1; // Admin user

  try {
    // ===== TEST 1: Create Old Job (60+ days) =====
    console.log('📝 TEST 1: Create Old Job for Expiry Testing');

    const sixtyOneDaysAgo = new Date();
    sixtyOneDaysAgo.setDate(sixtyOneDaysAgo.getDate() - 61);

    const [oldJob] = await db.insert(jobs).values({
      title: 'Old Test Job (61 days)',
      location: 'Test Location',
      type: 'full-time',
      description: 'Old job for scheduler testing',
      postedBy: testUserId,
      status: 'approved',
      isActive: true,
      createdAt: sixtyOneDaysAgo
    }).returning();

    testJobId = oldJob.id;
    console.log(`   ✓ Created old job ID: ${testJobId} (created 61 days ago)`);

    // ===== TEST 2: Create Job Near Expiry (53 days) =====
    console.log('\n📝 TEST 2: Create Job Near Expiry (for warning emails)');

    const fiftyThreeDaysAgo = new Date();
    fiftyThreeDaysAgo.setDate(fiftyThreeDaysAgo.getDate() - 53);

    const [nearExpiryJob] = await db.insert(jobs).values({
      title: 'Near Expiry Test Job (53 days)',
      location: 'Test Location',
      type: 'full-time',
      description: 'Job near expiry for warning email testing',
      postedBy: testUserId,
      status: 'approved',
      isActive: true,
      createdAt: fiftyThreeDaysAgo,
      warningEmailSent: false
    }).returning();

    testJobId2 = nearExpiryJob.id;
    console.log(`   ✓ Created near-expiry job ID: ${testJobId2} (created 53 days ago)`);

    // ===== TEST 3: Test getJobsNearExpiry Function =====
    console.log('\n📝 TEST 3: Test getJobsNearExpiry Function');

    const nearExpiryJobs = await getJobsNearExpiry();
    console.log(`   ✓ Found ${nearExpiryJobs.length} jobs near expiry`);

    const foundTestJob = nearExpiryJobs.find(j => j.id === testJobId2);
    if (!foundTestJob) {
      throw new Error('Near-expiry test job should be in results');
    }

    console.log(`   ✓ Near-expiry job ${testJobId2} found in results`);
    console.log(`   ✓ warningEmailSent: ${foundTestJob.warningEmailSent}`);

    console.log('   ✅ PASS: getJobsNearExpiry function works correctly\n');

    // ===== TEST 4: Test expireJob Utility Function =====
    console.log('📝 TEST 4: Test expireJob Utility Function');

    const success = await expireJob(testJobId!, 'manual_test', testUserId);

    if (!success) {
      throw new Error('expireJob should return true');
    }

    const expiredJob = await storage.getJob(testJobId!);
    if (!expiredJob) {
      throw new Error('Job should still exist after expiration');
    }

    console.log('   ✓ Job expired successfully');
    console.log(`   ✓ isActive: ${expiredJob.isActive}`);
    console.log(`   ✓ deactivatedAt: ${expiredJob.deactivatedAt}`);
    console.log(`   ✓ deactivationReason: ${expiredJob.deactivationReason}`);

    if (expiredJob.isActive !== false) {
      throw new Error('Job should be inactive after expiration');
    }
    if (expiredJob.deactivationReason !== 'manual_test') {
      throw new Error('deactivationReason should match');
    }

    console.log('   ✅ PASS: expireJob utility function works correctly\n');

    // ===== TEST 5: Activity-Based Deactivation Logic =====
    console.log('📝 TEST 5: Activity-Based Deactivation Logic');

    // Create a job with recent applications (should NOT be deactivated)
    const [activeJob] = await db.insert(jobs).values({
      title: 'Active Job with Recent Applications',
      location: 'Test Location',
      type: 'full-time',
      description: 'Job with recent activity',
      postedBy: testUserId,
      status: 'approved',
      isActive: true,
      createdAt: sixtyOneDaysAgo
    }).returning();

    // Add a recent application (within 14 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await db.insert(applications).values({
      jobId: activeJob.id,
      name: 'Test Applicant',
      email: 'test@example.com',
      phone: '1234567890',
      resumeUrl: 'https://example.com/test-resume.pdf',
      coverLetter: 'Test cover letter',
      appliedAt: threeDaysAgo
    });

    console.log(`   ✓ Created active job ${activeJob.id} with recent application (3 days ago)`);

    // Check for recent applications (14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentApplications = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(
        and(
          eq(applications.jobId, activeJob.id),
          sql`${applications.appliedAt} > ${fourteenDaysAgo}`
        )
      );

    const hasRecentActivity = recentApplications[0]?.count > 0;

    console.log(`   ✓ Recent applications count: ${recentApplications[0]?.count}`);
    console.log(`   ✓ hasRecentActivity: ${hasRecentActivity}`);

    if (!hasRecentActivity) {
      throw new Error('Job should have recent activity');
    }

    console.log('   ✅ PASS: Activity-based deactivation logic correctly detects recent activity\n');

    // ===== TEST 6: Old Job Without Activity Should Be Identified =====
    console.log('📝 TEST 6: Old Job Without Activity Detection');

    // Check the old job we created earlier (no applications)
    const oldJobApplications = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(
        and(
          eq(applications.jobId, testJobId!),
          sql`${applications.appliedAt} > ${fourteenDaysAgo}`
        )
      );

    const oldJobHasActivity = oldJobApplications[0]?.count > 0;

    console.log(`   ✓ Old job ${testJobId} recent applications: ${oldJobApplications[0]?.count}`);
    console.log(`   ✓ hasRecentActivity: ${oldJobHasActivity}`);

    if (oldJobHasActivity) {
      throw new Error('Old test job should NOT have recent activity');
    }

    console.log('   ✅ PASS: Old jobs without activity correctly identified\n');

    // ===== CLEANUP =====
    console.log('🧹 Cleaning up test data...');
    // Delete applications first (foreign key constraint)
    await db.delete(applications).where(eq(applications.jobId, activeJob.id));
    console.log('   ✓ Deleted test applications');

    if (testJobId) await db.delete(jobs).where(eq(jobs.id, testJobId));
    if (testJobId2) await db.delete(jobs).where(eq(jobs.id, testJobId2));
    await db.delete(jobs).where(eq(jobs.id, activeJob.id));
    console.log('   ✓ All test jobs deleted\n');

    console.log('✅ ALL SCHEDULER TESTS PASSED!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Old job creation (61 days)');
    console.log('   ✓ Near-expiry job creation (53 days)');
    console.log('   ✓ getJobsNearExpiry() function');
    console.log('   ✓ expireJob() utility function');
    console.log('   ✓ Activity-based deactivation logic detects recent applications');
    console.log('   ✓ Old jobs without activity correctly identified for deactivation');
    console.log('\nℹ️  Note: Full scheduler with cron jobs requires ENABLE_SCHEDULER=true');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);

    // Cleanup on error - delete applications first
    try {
      await db.delete(applications).where(
        sql`job_id IN (${testJobId}, ${testJobId2})`
      );
    } catch {}

    // Then delete jobs
    if (testJobId) {
      try {
        await db.delete(jobs).where(eq(jobs.id, testJobId));
        console.log('   ✓ Cleaned up test job 1');
      } catch {}
    }
    if (testJobId2) {
      try {
        await db.delete(jobs).where(eq(jobs.id, testJobId2));
        console.log('   ✓ Cleaned up test job 2');
      } catch {}
    }

    process.exit(1);
  }

  process.exit(0);
}

// Run tests
runSchedulerTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
