import { Storage } from '@google-cloud/storage';
import { Request } from 'express';
import multer from 'multer';
import fileTypeMod from 'file-type';

// Initialize Google Cloud Storage
let storage: Storage | null = null;
let bucketName: string | null = null;

try {
  if (!process.env.GCS_PROJECT_ID || !process.env.GCS_BUCKET_NAME || !process.env.GCS_SERVICE_ACCOUNT_KEY) {
    console.warn('Google Cloud Storage environment variables not set. File uploads will be disabled.');
  } else {
    // Parse service account key from environment variable (JSON string)
    const serviceAccountKey = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY);

    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: serviceAccountKey,
    });

    bucketName = process.env.GCS_BUCKET_NAME;
    console.log(`✅ Google Cloud Storage initialized: ${bucketName}`);
  }
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
  console.warn('File uploads will be disabled.');
}

// Multer configuration for file upload (memory storage)
const multerStorage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Basic MIME type check (can be spoofed - real validation happens in validateFileType)
  const allowed = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // Allow generic type, will validate with magic bytes
  ]);
  if (allowed.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, or DOCX files are allowed'));
  }
};

// Validate file type using magic bytes (more secure than MIME type)
async function validateFileType(buffer: Buffer): Promise<boolean> {
  try {
    const anyMod: any = fileTypeMod as any;
    const detector = anyMod?.fileTypeFromBuffer || anyMod?.fromBuffer;
    const fileType = detector ? await detector(buffer) : null;

    if (!fileType) {
      // Could be a text-based format like older DOC files
      // Check first few bytes for DOC signature
      const header = buffer.slice(0, 8).toString('hex');
      // DOC files start with D0CF11E0A1B11AE1 (OLE2 signature)
      if (header.startsWith('d0cf11e0a1b11ae1')) {
        return true;
      }
      return false;
    }

    // Allowed file types based on magic bytes
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['pdf', 'doc', 'docx'];

    return allowedTypes.includes(fileType.mime) || allowedExtensions.includes(fileType.ext);
  } catch (error) {
    console.error('Error validating file type:', error);
    return false;
  }
}

export const upload = multer({
  storage: multerStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * Upload file to Google Cloud Storage
 * @param buffer - File buffer
 * @param originalName - Original filename
 * @returns Public GCS path (gs://bucket/path)
 */
export async function uploadToGCS(buffer: Buffer, originalName: string): Promise<string> {
  if (!storage || !bucketName) {
    throw new Error('Google Cloud Storage not configured');
  }

  // Validate file type using magic bytes (security check)
  const isValid = await validateFileType(buffer);
  if (!isValid) {
    throw new Error('Invalid file format. Only genuine PDF, DOC, or DOCX files are allowed.');
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `resumes/${timestamp}_${sanitizedName}`;

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filename);

  // Upload file to GCS
  await file.save(buffer, {
    metadata: {
      contentType: getContentType(originalName),
      metadata: {
        originalName: originalName,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  // Return the GCS path (we'll generate signed URLs for access)
  return `gs://${bucketName}/${filename}`;
}

/**
 * Delete file from Google Cloud Storage
 * @param gcsPath - Full GCS path (gs://bucket/path)
 */
export async function deleteFromGCS(gcsPath: string): Promise<void> {
  if (!storage) {
    throw new Error('Google Cloud Storage not configured');
  }

  // Extract bucket and filename from gs:// URL
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid GCS path format');
  }

  const [, bucket, filepath] = match;
  if (!bucket || !filepath) {
    throw new Error('Invalid GCS path components');
  }
  await storage.bucket(bucket).file(filepath).delete();
}

/**
 * Generate signed URL for downloading file from GCS
 * @param gcsPath - Full GCS path (gs://bucket/path)
 * @param filename - Original filename for download
 * @param expiresInMinutes - URL expiration time (default: 60 minutes)
 * @returns Signed URL for file download
 */
export async function getSignedDownloadUrl(
  gcsPath: string,
  filename?: string | null,
  expiresInMinutes: number = 60
): Promise<string> {
  if (!storage) {
    throw new Error('Google Cloud Storage not configured');
  }

  // Extract bucket and filename from gs:// URL
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid GCS path format');
  }

  const [, bucket, filepath] = match;
  if (!bucket || !filepath) {
    throw new Error('Invalid GCS path components');
  }
  const file = storage.bucket(bucket).file(filepath);

  // Generate signed URL valid for specified duration
  // Note: GCS SDK handles encoding of the responseDisposition parameter
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
    responseDisposition: filename
      ? `attachment; filename="${filename}"`
      : 'attachment',
  });

  return signedUrl;
}

/**
 * Download file buffer from GCS
 * @param gcsPath - Full GCS path (gs://bucket/path)
 * @returns File buffer
 */
export async function downloadFromGCS(gcsPath: string): Promise<Buffer> {
  if (!storage) {
    throw new Error('Google Cloud Storage not configured');
  }

  // Extract bucket and filename from gs:// URL
  const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid GCS path format');
  }

  const [, bucket, filepath] = match;
  if (!bucket || !filepath) {
    throw new Error('Invalid GCS path components');
  }

  const file = storage.bucket(bucket).file(filepath);
  const [buffer] = await file.download();
  return buffer;
}

/**
 * Check if file exists in GCS
 * @param gcsPath - Full GCS path (gs://bucket/path)
 * @returns True if file exists
 */
export async function fileExists(gcsPath: string): Promise<boolean> {
  if (!storage) {
    return false;
  }

  try {
    const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      return false;
    }

    const [, bucket, filepath] = match;
    if (!bucket || !filepath) {
      return false;
    }
    const [exists] = await storage.bucket(bucket).file(filepath).exists();
    return exists;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}
