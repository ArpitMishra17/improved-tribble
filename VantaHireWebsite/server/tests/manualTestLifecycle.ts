#!/usr/bin/env tsx
/**
 * Manual testing script for job lifecycle functionality
 * Run with: tsx server/tests/manualTestLifecycle.ts
 */

import { storage } from '../storage';
import { db } from '../db';
import { jobs, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('🧪 Starting Manual Job Lifecycle Tests\n');

  let testJobId: number | null = null;
  let testUserId: number = 1; // Admin user

  try {
    // ===== TEST 1: Storage Layer - Job Deactivation =====
    console.log('📝 TEST 1: Job Deactivation via Storage Layer');

    // Create a test job
    const [testJob] = await db.insert(jobs).values({
      title: 'Test Job for Lifecycle Manual Testing',
      location: 'Test Location',
      type: 'full-time',
      description: 'Test description for manual testing',
      postedBy: testUserId,
      status: 'approved',
      isActive: true
    }).returning();

    testJobId = testJob.id;
    console.log(`   ✓ Created test job ID: ${testJobId}`);

    // Deactivate the job
    const deactivated = await storage.updateJobStatus(testJobId!, false, 'test_deactivation', testUserId);

    if (!deactivated) {
      throw new Error('Failed to deactivate job');
    }

    console.log('   ✓ Job deactivated successfully');
    console.log(`   ✓ deactivatedAt: ${deactivated.deactivatedAt}`);
    console.log(`   ✓ deactivationReason: ${deactivated.deactivationReason}`);
    console.log(`   ✓ isActive: ${deactivated.isActive}`);

    if (deactivated.isActive !== false) {
      throw new Error('Job should be inactive after deactivation');
    }
    if (!deactivated.deactivatedAt) {
      throw new Error('deactivatedAt should be set');
    }
    if (deactivated.deactivationReason !== 'test_deactivation') {
      throw new Error('deactivationReason should match');
    }

    console.log('   ✅ PASS: Job deactivation works correctly\n');

    // ===== TEST 2: Storage Layer - Job Reactivation =====
    console.log('📝 TEST 2: Job Reactivation via Storage Layer');

    const reactivated = await storage.updateJobStatus(testJobId!, true, 'test_reactivation', testUserId);

    if (!reactivated) {
      throw new Error('Failed to reactivate job');
    }

    console.log('   ✓ Job reactivated successfully');
    console.log(`   ✓ reactivatedAt: ${reactivated.reactivatedAt}`);
    console.log(`   ✓ reactivationCount: ${reactivated.reactivationCount}`);
    console.log(`   ✓ isActive: ${reactivated.isActive}`);
    console.log(`   ✓ deactivationReason: ${reactivated.deactivationReason}`);

    if (reactivated.isActive !== true) {
      throw new Error('Job should be active after reactivation');
    }
    if (!reactivated.reactivatedAt) {
      throw new Error('reactivatedAt should be set');
    }
    if (reactivated.reactivationCount !== 1) {
      throw new Error('reactivationCount should be 1');
    }
    if (reactivated.deactivationReason !== null) {
      throw new Error('deactivationReason should be cleared on reactivation');
    }

    console.log('   ✅ PASS: Job reactivation works correctly\n');

    // ===== TEST 3: Multiple Reactivations =====
    console.log('📝 TEST 3: Multiple Reactivation Counter');

    await storage.updateJobStatus(testJobId!, false, 'test2', testUserId);
    const reactivated2 = await storage.updateJobStatus(testJobId!, true, 'test2', testUserId);

    if (reactivated2?.reactivationCount !== 2) {
      throw new Error(`reactivationCount should be 2, got ${reactivated2?.reactivationCount}`);
    }

    console.log(`   ✓ reactivationCount correctly incremented to ${reactivated2.reactivationCount}`);
    console.log('   ✅ PASS: Multiple reactivations tracked correctly\n');

    // ===== TEST 4: API Endpoint - Public Access to Inactive Job =====
    console.log('📝 TEST 4: API - Public Access to Inactive Job (should return 404)');

    // Deactivate for testing
    await storage.updateJobStatus(testJobId!, false, 'test_api', testUserId);

    const response = await fetch(`http://localhost:5001/api/jobs/${testJobId}`);
    const data = await response.json();

    console.log(`   ✓ Response status: ${response.status}`);
    console.log(`   ✓ Response body: ${JSON.stringify(data)}`);

    if (response.status !== 404) {
      throw new Error(`Expected 404 for inactive job, got ${response.status}`);
    }
    if (data.error !== 'Job not found') {
      throw new Error(`Expected "Job not found" error, got ${data.error}`);
    }

    console.log('   ✅ PASS: Inactive jobs return 404 to public users\n');

    // ===== TEST 5: Verify Job Schema Has All Lifecycle Fields =====
    console.log('📝 TEST 5: Verify Schema Has All Lifecycle Fields');

    const finalJob = await storage.getJob(testJobId!);

    if (!finalJob) {
      throw new Error('Job should exist');
    }

    const requiredFields = [
      'deactivatedAt',
      'reactivatedAt',
      'reactivationCount',
      'deactivationReason',
      'warningEmailSent'
    ];

    for (const field of requiredFields) {
      if (!(field in finalJob)) {
        throw new Error(`Job schema missing field: ${field}`);
      }
    }

    console.log('   ✓ All lifecycle fields present in schema');
    console.log(`   ✓ deactivatedAt: ${finalJob.deactivatedAt}`);
    console.log(`   ✓ reactivatedAt: ${finalJob.reactivatedAt}`);
    console.log(`   ✓ reactivationCount: ${finalJob.reactivationCount}`);
    console.log(`   ✓ deactivationReason: ${finalJob.deactivationReason}`);
    console.log(`   ✓ warningEmailSent: ${finalJob.warningEmailSent}`);

    console.log('   ✅ PASS: Schema has all required lifecycle fields\n');

    // ===== TEST 6: Audit Logging =====
    console.log('📝 TEST 6: Audit Logging');

    const auditLogs = await db.query.jobAuditLog.findMany({
      where: (log: any, { eq }: any) => eq(log.jobId, testJobId),
      orderBy: (log: any, { asc }: any) => [asc(log.timestamp)]
    });

    console.log(`   ✓ Found ${auditLogs.length} audit log entries`);

    const deactivationLogs = auditLogs.filter((l: any) => l.action === 'deactivated');
    const reactivationLogs = auditLogs.filter((l: any) => l.action === 'reactivated');

    console.log(`   ✓ Deactivation logs: ${deactivationLogs.length}`);
    console.log(`   ✓ Reactivation logs: ${reactivationLogs.length}`);

    if (deactivationLogs.length < 2) {
      throw new Error('Expected at least 2 deactivation log entries');
    }
    if (reactivationLogs.length < 2) {
      throw new Error('Expected at least 2 reactivation log entries');
    }

    // Check log structure
    const sampleLog = auditLogs[0];
    console.log(`   ✓ Sample log: action=${sampleLog.action}, reason=${sampleLog.reason}, performedBy=${sampleLog.performedBy}`);

    if (!sampleLog.performedBy) {
      throw new Error('Audit log should have performedBy field');
    }

    console.log('   ✅ PASS: Audit logging works correctly\n');

    // ===== CLEANUP =====
    console.log('🧹 Cleaning up test data...');
    await db.delete(jobs).where(eq(jobs.id, testJobId!));
    console.log('   ✓ Test job deleted\n');

    console.log('✅ ALL TESTS PASSED!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Job deactivation tracking (storage layer)');
    console.log('   ✓ Job reactivation tracking (storage layer)');
    console.log('   ✓ Multiple reactivation counter increments correctly');
    console.log('   ✓ Public API returns 404 for inactive jobs');
    console.log('   ✓ Schema has all required lifecycle fields');
    console.log('   ✓ Audit logging captures all lifecycle events');
    console.log('\nℹ️  Note: CSRF-protected endpoints tested separately in integration tests');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);

    // Cleanup on error
    if (testJobId) {
      try {
        await db.delete(jobs).where(eq(jobs.id, testJobId!));
        console.log('   ✓ Cleaned up test job');
      } catch (cleanupError) {
        console.error('   ✗ Failed to cleanup test job:', cleanupError);
      }
    }

    process.exit(1);
  }

  process.exit(0);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
