import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
  error?: string;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

async function runGCSTests() {
  console.log('🧪 Google Cloud Storage Integration Test\n');
  console.log('=' .repeat(60));

  // Test 1: Environment Variables Check
  console.log('\n1️⃣  Checking Environment Variables...');
  try {
    const hasProjectId = !!process.env.GCS_PROJECT_ID;
    const hasBucket = !!process.env.GCS_BUCKET_NAME;
    const hasKey = !!process.env.GCS_SERVICE_ACCOUNT_KEY;

    if (hasProjectId && hasBucket && hasKey) {
      logResult({
        name: 'Environment Variables',
        status: 'PASS',
        message: `All GCS env vars present (Project: ${process.env.GCS_PROJECT_ID}, Bucket: ${process.env.GCS_BUCKET_NAME})`,
      });
    } else {
      const missing = [];
      if (!hasProjectId) missing.push('GCS_PROJECT_ID');
      if (!hasBucket) missing.push('GCS_BUCKET_NAME');
      if (!hasKey) missing.push('GCS_SERVICE_ACCOUNT_KEY');

      logResult({
        name: 'Environment Variables',
        status: 'FAIL',
        message: `Missing: ${missing.join(', ')}`,
      });
      return; // Can't continue without env vars
    }
  } catch (error) {
    logResult({
      name: 'Environment Variables',
      status: 'FAIL',
      message: 'Failed to check env vars',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Test 2: Service Account Key Parsing
  console.log('\n2️⃣  Parsing Service Account Key...');
  let serviceAccountKey: any;
  try {
    serviceAccountKey = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!);

    // Check required fields
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccountKey[field]);

    if (missingFields.length === 0) {
      logResult({
        name: 'Service Account Key',
        status: 'PASS',
        message: `Valid JSON with all required fields (Email: ${serviceAccountKey.client_email})`,
      });
    } else {
      logResult({
        name: 'Service Account Key',
        status: 'FAIL',
        message: `Missing fields: ${missingFields.join(', ')}`,
      });
      return;
    }
  } catch (error) {
    logResult({
      name: 'Service Account Key',
      status: 'FAIL',
      message: 'Failed to parse JSON',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Test 3: GCS Client Initialization
  console.log('\n3️⃣  Initializing GCS Client...');
  const projectId = process.env.GCS_PROJECT_ID;
  if (!projectId) {
    throw new Error('GCS_PROJECT_ID environment variable is required');
  }
  let storage: Storage;
  try {
    storage = new Storage({
      projectId,
      credentials: serviceAccountKey,
    });

    logResult({
      name: 'GCS Client',
      status: 'PASS',
      message: 'Storage client initialized successfully',
    });
  } catch (error) {
    logResult({
      name: 'GCS Client',
      status: 'FAIL',
      message: 'Failed to initialize Storage client',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Test 4: Bucket Access
  console.log('\n4️⃣  Testing Bucket Access...');
  const bucketName = process.env.GCS_BUCKET_NAME!;
  const bucket = storage.bucket(bucketName);

  try {
    const [exists] = await bucket.exists();

    if (exists) {
      logResult({
        name: 'Bucket Access',
        status: 'PASS',
        message: `Bucket '${bucketName}' exists and is accessible`,
      });
    } else {
      logResult({
        name: 'Bucket Access',
        status: 'FAIL',
        message: `Bucket '${bucketName}' does not exist`,
      });
      return;
    }
  } catch (error) {
    logResult({
      name: 'Bucket Access',
      status: 'FAIL',
      message: 'Failed to check bucket existence',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Test 5: File Upload
  console.log('\n5️⃣  Testing File Upload...');
  const testFileName = `test-uploads/test-${Date.now()}.txt`;
  const testContent = `GCS Test Upload - ${new Date().toISOString()}`;
  const testBuffer = Buffer.from(testContent, 'utf-8');

  try {
    const file = bucket.file(testFileName);
    await file.save(testBuffer, {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          testFile: 'true',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    logResult({
      name: 'File Upload',
      status: 'PASS',
      message: `Successfully uploaded test file: ${testFileName}`,
    });
  } catch (error) {
    logResult({
      name: 'File Upload',
      status: 'FAIL',
      message: 'Failed to upload test file',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Test 6: File Exists Check
  console.log('\n6️⃣  Testing File Existence Check...');
  try {
    const file = bucket.file(testFileName);
    const [exists] = await file.exists();

    if (exists) {
      logResult({
        name: 'File Exists',
        status: 'PASS',
        message: 'Successfully verified uploaded file exists',
      });
    } else {
      logResult({
        name: 'File Exists',
        status: 'FAIL',
        message: 'Uploaded file not found',
      });
    }
  } catch (error) {
    logResult({
      name: 'File Exists',
      status: 'FAIL',
      message: 'Failed to check file existence',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 7: File Download
  console.log('\n7️⃣  Testing File Download...');
  try {
    const file = bucket.file(testFileName);
    const [contents] = await file.download();
    const downloadedContent = contents.toString('utf-8');

    if (downloadedContent === testContent) {
      logResult({
        name: 'File Download',
        status: 'PASS',
        message: 'Successfully downloaded file with matching content',
      });
    } else {
      logResult({
        name: 'File Download',
        status: 'FAIL',
        message: 'Downloaded content does not match',
        error: `Expected: "${testContent}", Got: "${downloadedContent}"`,
      });
    }
  } catch (error) {
    logResult({
      name: 'File Download',
      status: 'FAIL',
      message: 'Failed to download file',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 8: Signed URL Generation
  console.log('\n8️⃣  Testing Signed URL Generation...');
  try {
    const file = bucket.file(testFileName);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    if (signedUrl && signedUrl.startsWith('https://')) {
      logResult({
        name: 'Signed URL',
        status: 'PASS',
        message: `Generated valid signed URL (length: ${signedUrl.length} chars)`,
      });
      console.log(`   URL preview: ${signedUrl.substring(0, 80)}...`);
    } else {
      logResult({
        name: 'Signed URL',
        status: 'FAIL',
        message: 'Invalid signed URL format',
        error: `URL: ${signedUrl}`,
      });
    }
  } catch (error) {
    logResult({
      name: 'Signed URL',
      status: 'FAIL',
      message: 'Failed to generate signed URL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 9: Signed URL with Download Disposition
  console.log('\n9️⃣  Testing Signed URL with Download Disposition...');
  try {
    const file = bucket.file(testFileName);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
      responseDisposition: `attachment; filename="test-download.txt"`,
    });

    if (signedUrl && signedUrl.includes('response-content-disposition')) {
      logResult({
        name: 'Download Disposition',
        status: 'PASS',
        message: 'Signed URL includes download disposition',
      });
    } else {
      logResult({
        name: 'Download Disposition',
        status: 'FAIL',
        message: 'Signed URL missing download disposition parameter',
      });
    }
  } catch (error) {
    logResult({
      name: 'Download Disposition',
      status: 'FAIL',
      message: 'Failed to generate signed URL with disposition',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 10: File Metadata
  console.log('\n🔟 Testing File Metadata...');
  try {
    const file = bucket.file(testFileName);
    const [metadata] = await file.getMetadata();

    if (metadata.contentType === 'text/plain' && metadata.metadata?.testFile === 'true') {
      logResult({
        name: 'File Metadata',
        status: 'PASS',
        message: 'Metadata correctly stored and retrieved',
      });
      console.log(`   Content Type: ${metadata.contentType}`);
      console.log(`   Size: ${metadata.size} bytes`);
      console.log(`   Updated: ${metadata.updated}`);
    } else {
      logResult({
        name: 'File Metadata',
        status: 'FAIL',
        message: 'Metadata incorrect or missing',
        error: JSON.stringify(metadata.metadata),
      });
    }
  } catch (error) {
    logResult({
      name: 'File Metadata',
      status: 'FAIL',
      message: 'Failed to retrieve metadata',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 11: File Deletion
  console.log('\n1️⃣1️⃣  Testing File Deletion...');
  try {
    const file = bucket.file(testFileName);
    await file.delete();

    // Verify deletion
    const [exists] = await file.exists();
    if (!exists) {
      logResult({
        name: 'File Deletion',
        status: 'PASS',
        message: 'Successfully deleted test file',
      });
    } else {
      logResult({
        name: 'File Deletion',
        status: 'FAIL',
        message: 'File still exists after deletion',
      });
    }
  } catch (error) {
    logResult({
      name: 'File Deletion',
      status: 'FAIL',
      message: 'Failed to delete test file',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 12: Test with PDF (Resume Upload Simulation)
  console.log('\n1️⃣2️⃣  Testing PDF Upload (Resume Simulation)...');
  try {
    // Create a minimal valid PDF buffer
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n210\n%%EOF';
    const pdfBuffer = Buffer.from(pdfHeader + pdfContent, 'utf-8');

    const timestamp = Date.now();
    const pdfFileName = `resumes/${timestamp}_test-resume.pdf`;
    const file = bucket.file(pdfFileName);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          originalName: 'test-resume.pdf',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    logResult({
      name: 'PDF Upload',
      status: 'PASS',
      message: `Successfully uploaded test PDF to resumes/ folder`,
    });

    // Clean up
    await file.delete();
  } catch (error) {
    logResult({
      name: 'PDF Upload',
      status: 'FAIL',
      message: 'Failed to upload PDF',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! GCS is fully operational.');
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

// Run tests
runGCSTests().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
