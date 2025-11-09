import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

async function checkPermissions() {
  console.log('🔍 Checking GCS Service Account Permissions\n');

  const projectId = process.env.GCS_PROJECT_ID;
  if (!projectId) {
    throw new Error('GCS_PROJECT_ID environment variable is required');
  }

  const serviceAccountKey = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!);
  const storage = new Storage({
    projectId,
    credentials: serviceAccountKey,
  });

  const bucketName = process.env.GCS_BUCKET_NAME!;
  const bucket = storage.bucket(bucketName);

  console.log(`Service Account: ${serviceAccountKey.client_email}`);
  console.log(`Project: ${projectId}`);
  console.log(`Bucket: ${bucketName}\n`);

  // Test which permissions we have
  const permissions = [
    'storage.objects.create',
    'storage.objects.delete',
    'storage.objects.get',
    'storage.objects.list',
    'storage.buckets.get',
    'storage.buckets.getIamPolicy',
  ];

  console.log('Testing permissions:');
  try {
    const [result] = await bucket.iam.testPermissions(permissions);
    if (!result || !Array.isArray(result)) {
      console.log('\n❌ No permissions result returned');
      return;
    }

    console.log('\n✅ Permissions granted:');
    result.forEach((perm: string) => console.log(`  ✓ ${perm}`));

    console.log('\n❌ Permissions NOT granted:');
    const missing = permissions.filter(p => !result.includes(p));
    missing.forEach((perm: string) => console.log(`  ✗ ${perm}`));

    // Check if we have essential permissions
    const essentialPerms = ['storage.objects.create', 'storage.objects.get', 'storage.objects.delete'];
    const hasEssential = essentialPerms.every(p => result.includes(p));

    if (hasEssential) {
      console.log('\n🎉 All essential permissions for the app are granted!');
    } else {
      console.log('\n⚠️  Missing essential permissions. Please attach the service account to the bucket.');
    }
  } catch (error) {
    console.log('\n❌ Error testing permissions:');
    console.log(error instanceof Error ? error.message : error);
    console.log('\nThis likely means the service account has NO permissions on this bucket.');
    console.log('You need to grant "Storage Object Admin" role to the service account.');
  }
}

checkPermissions();
