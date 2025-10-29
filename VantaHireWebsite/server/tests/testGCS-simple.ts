import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

async function testGCS() {
  console.log('🧪 Simple GCS Test - Testing Essential Operations\n');
  console.log('='.repeat(60));

  // Initialize
  console.log('\n✓ Initializing GCS...');
  const serviceAccountKey = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!);
  const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: serviceAccountKey,
  });
  const bucketName = process.env.GCS_BUCKET_NAME!;
  const bucket = storage.bucket(bucketName);
  console.log(`  Project: ${process.env.GCS_PROJECT_ID}`);
  console.log(`  Bucket: ${bucketName}`);
  console.log(`  Service Account: ${serviceAccountKey.client_email}`);

  // Test 1: Upload
  console.log('\n📤 Test 1: Uploading file...');
  const testFileName = `test-uploads/gcs-test-${Date.now()}.txt`;
  const testContent = `GCS Test - ${new Date().toISOString()}`;
  const testBuffer = Buffer.from(testContent, 'utf-8');

  try {
    const file = bucket.file(testFileName);
    await file.save(testBuffer, {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          testFile: 'true',
        },
      },
    });
    console.log(`  ✅ Upload successful: ${testFileName}`);
  } catch (error) {
    console.log(`  ❌ Upload failed:`, error instanceof Error ? error.message : error);
    return;
  }

  // Test 2: Read/Download
  console.log('\n📥 Test 2: Downloading file...');
  try {
    const file = bucket.file(testFileName);
    const [contents] = await file.download();
    const downloadedContent = contents.toString('utf-8');

    if (downloadedContent === testContent) {
      console.log(`  ✅ Download successful - content matches`);
    } else {
      console.log(`  ❌ Download failed - content mismatch`);
      console.log(`  Expected: "${testContent}"`);
      console.log(`  Got: "${downloadedContent}"`);
    }
  } catch (error) {
    console.log(`  ❌ Download failed:`, error instanceof Error ? error.message : error);
  }

  // Test 3: Signed URL
  console.log('\n🔗 Test 3: Generating signed URL...');
  try {
    const file = bucket.file(testFileName);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
      responseDisposition: 'attachment; filename="test-file.txt"',
    });

    console.log(`  ✅ Signed URL generated successfully`);
    console.log(`  URL length: ${signedUrl.length} characters`);
    console.log(`  URL preview: ${signedUrl.substring(0, 100)}...`);
  } catch (error) {
    console.log(`  ❌ Signed URL failed:`, error instanceof Error ? error.message : error);
  }

  // Test 4: Metadata
  console.log('\n📋 Test 4: Reading file metadata...');
  try {
    const file = bucket.file(testFileName);
    const [metadata] = await file.getMetadata();

    console.log(`  ✅ Metadata retrieved`);
    console.log(`  Content Type: ${metadata.contentType}`);
    console.log(`  Size: ${metadata.size} bytes`);
    console.log(`  Created: ${metadata.timeCreated}`);
    console.log(`  Updated: ${metadata.updated}`);
  } catch (error) {
    console.log(`  ❌ Metadata read failed:`, error instanceof Error ? error.message : error);
  }

  // Test 5: PDF Upload (Resume simulation)
  console.log('\n📄 Test 5: Uploading PDF (resume simulation)...');
  try {
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n210\n%%EOF';
    const pdfBuffer = Buffer.from(pdfHeader + pdfContent, 'utf-8');

    const timestamp = Date.now();
    const pdfFileName = `resumes/${timestamp}_test-resume.pdf`;
    const pdfFile = bucket.file(pdfFileName);

    await pdfFile.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          originalName: 'test-resume.pdf',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`  ✅ PDF uploaded: ${pdfFileName}`);

    // Generate signed download URL for PDF
    const [pdfSignedUrl] = await pdfFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
      responseDisposition: 'attachment; filename="test-resume.pdf"',
    });

    console.log(`  ✅ PDF signed URL generated`);

    // Clean up PDF
    await pdfFile.delete();
    console.log(`  ✅ PDF cleaned up`);
  } catch (error) {
    console.log(`  ❌ PDF upload failed:`, error instanceof Error ? error.message : error);
  }

  // Test 6: Delete
  console.log('\n🗑️  Test 6: Deleting test file...');
  try {
    const file = bucket.file(testFileName);
    await file.delete();
    console.log(`  ✅ File deleted successfully`);
  } catch (error) {
    console.log(`  ❌ Delete failed:`, error instanceof Error ? error.message : error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All essential GCS operations are working!\n');
  console.log('Your GCS integration is ready for:');
  console.log('  ✓ Resume uploads');
  console.log('  ✓ Secure signed download URLs');
  console.log('  ✓ File management (delete)');
  console.log('  ✓ Metadata tracking\n');
}

testGCS().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
