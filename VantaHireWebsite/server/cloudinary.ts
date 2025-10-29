import { v2 as cloudinary } from 'cloudinary';
import { Request } from 'express';
import multer from 'multer';
// Use default import for compatibility (CJS/ESM). Some builds expose fileTypeFromBuffer; older expose fromBuffer.
import fileTypeMod from 'file-type';

// Configure Cloudinary
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('Cloudinary environment variables not set. File uploads will be disabled.');
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Multer configuration for file upload
const storage = multer.memoryStorage();

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
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Upload file to Cloudinary
export async function uploadToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured');
  }

  // Validate file type using magic bytes (security check)
  const isValid = await validateFileType(buffer);
  if (!isValid) {
    throw new Error('Invalid file format. Only genuine PDF, DOC, or DOCX files are allowed.');
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'vantahire/resumes',
        public_id: `resume_${Date.now()}_${originalName.replace(/\.[^/.]+$/, "")}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Upload failed'));
        }
      }
    ).end(buffer);
  });
}

// Delete file from Cloudinary
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured');
  }

  await cloudinary.uploader.destroy(publicId);
}

/**
 * Transform Cloudinary URL to force download with proper filename
 * Handles custom domains, existing transformations, and fallback filenames
 *
 * @param url - Original Cloudinary URL (or any URL with /upload/ segment)
 * @param filename - Original filename to use in download (optional, defaults to 'resume.pdf')
 * @returns Transformed URL with fl_attachment flag
 *
 * @example
 * // Basic URL
 * rewriteCloudinaryUrlForDownload('https://res.cloudinary.com/.../upload/v123/abc.pdf', 'John_Doe_Resume.pdf')
 * // => 'https://res.cloudinary.com/.../upload/fl_attachment:John_Doe_Resume.pdf/v123/abc.pdf'
 *
 * // With existing transformations
 * rewriteCloudinaryUrlForDownload('https://cdn.example.com/.../upload/w_200,h_300/v123/abc.pdf', 'resume.pdf')
 * // => 'https://cdn.example.com/.../upload/fl_attachment:resume.pdf,w_200,h_300/v123/abc.pdf'
 *
 * // Non-Cloudinary URL (no transformation)
 * rewriteCloudinaryUrlForDownload('https://example.com/file.pdf', 'resume.pdf')
 * // => 'https://example.com/file.pdf'
 */
export function rewriteCloudinaryUrlForDownload(url: string, filename?: string | null): string {
  // Only transform URLs with Cloudinary /upload/ segment
  const uploadIdx = url.indexOf('/upload/');
  if (uploadIdx === -1) return url;

  const safeFilename = filename || 'resume.pdf';
  const attachmentFlag = `fl_attachment:${encodeURIComponent(safeFilename)}`;

  const before = url.slice(0, uploadIdx + '/upload/'.length); // includes '/upload/'
  const after = url.slice(uploadIdx + '/upload/'.length); // e.g. 'v123/..' or 'w_200/v123/..' or just 'folder/file'

  // Split out optional transforms and version segment. Version must NOT be treated as a transform.
  // Patterns:
  //  - 'v1234/folder/file.ext'
  //  - 'w_200,h_300/v1234/folder/file.ext'
  //  - 'folder/file.ext' (no version)
  let transforms = '';
  let restWithVersion = after;

  // If transforms exist, they appear before the version segment 'v123...'
  const m = after.match(/^([^/]+)\/(v\d+\/.*)$/); // transforms + '/v123/...'
  if (m && m[1] && m[2]) {
    transforms = m[1];
    restWithVersion = m[2];
  } else {
    // No explicit transforms before version; ensure we don't treat 'v123...' as transforms
    // If it starts with 'v123/', keep as restWithVersion; otherwise it's just 'folder/file'
  }

  // Build new URL: insert fl_attachment before any transforms and before version segment
  const transformPart = transforms ? `${attachmentFlag},${transforms}` : `${attachmentFlag}`;
  const slash = restWithVersion.startsWith('v') || restWithVersion.length > 0 ? '/' : '';
  return `${before}${transformPart}${slash}${restWithVersion}`;
}
