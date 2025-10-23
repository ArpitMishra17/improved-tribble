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
