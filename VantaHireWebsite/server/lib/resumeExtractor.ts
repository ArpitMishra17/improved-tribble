/**
 * Resume text extraction with PDF/DOCX parsing, timeouts, and PII stripping
 *
 * Features:
 * - PDF parsing via pdf-parse (dynamic import for CJS/ESM compatibility)
 * - DOCX parsing via mammoth (dynamic import)
 * - 30s timeout with graceful fallback
 * - 5MB file size limit
 * - Optional PII stripping (controlled by AI_STRIP_PII env var)
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const EXTRACTION_TIMEOUT_MS = 30_000; // 30 seconds
const STRIP_PII = process.env.AI_STRIP_PII === 'true';

export interface ExtractionResult {
  text: string;
  success: boolean;
  error?: string;
  piiStripped?: boolean;
}

/**
 * Strip PII from resume text while preserving performance metrics
 *
 * Removes:
 * - Emails
 * - Phone numbers (context-aware)
 * - SSN patterns
 * - Script tags and URLs
 *
 * Preserves:
 * - Percentages (35%)
 * - Monetary values ($2M)
 * - Date ranges (2018-2023)
 * - Metrics (10,000 TPS)
 */
export function stripPII(text: string): string {
  if (!STRIP_PII) {
    return text;
  }

  return text
    // Remove emails
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    // Remove phone numbers (context-aware - only near phone indicators)
    .replace(/\b(phone|mobile|tel|cell|contact):\s*\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '$1: [PHONE]')
    .replace(/\b(phone|mobile|tel|cell|contact)\s*\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '$1 [PHONE]')
    // Remove SSN patterns (XXX-XX-XXXX)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '[URL]')
    .trim();
}

/**
 * Extract text from PDF buffer
 */
async function extractPDF(buffer: Buffer): Promise<string> {
  const mod: any = await import('pdf-parse');
  const parseFn = mod?.default || mod; // Support both default and namespace
  const pdfData = await parseFn(buffer, { max: 10 });
  return pdfData.text;
}

/**
 * Extract text from DOCX buffer
 */
async function extractDOCX(buffer: Buffer): Promise<string> {
  const mod: any = await import('mammoth');
  const mammothMod = mod?.default || mod;
  const result = await mammothMod.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from resume file with timeout
 *
 * @param buffer - File buffer
 * @returns Extraction result with text and metadata
 */
export async function extractResumeText(buffer: Buffer): Promise<ExtractionResult> {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      text: '',
      success: false,
      error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    };
  }

  try {
    // Detect file type (support both CJS and ESM variations via dynamic import)
    const ft: any = await import('file-type');
    const detector = ft?.fileTypeFromBuffer || ft?.fromBuffer || ft?.default?.fileTypeFromBuffer || ft?.default?.fromBuffer;
    const detectedType = detector ? await detector(buffer) : null;
    const mimeType = detectedType?.mime || '';

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timeout after 30s')), EXTRACTION_TIMEOUT_MS);
    });

    // Create extraction promise
    let extractionPromise: Promise<string>;

    if (mimeType === 'application/pdf') {
      extractionPromise = extractPDF(buffer);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractionPromise = extractDOCX(buffer);
    } else {
      return {
        text: '',
        success: false,
        error: `Unsupported file type: ${mimeType || 'unknown'}. Only PDF and DOCX are supported.`,
      };
    }

    // Race between extraction and timeout
    const rawText = await Promise.race([extractionPromise, timeoutPromise]);

    // Strip PII if enabled
    const text = stripPII(rawText);

    return {
      text,
      success: true,
      piiStripped: STRIP_PII,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      text: '',
      success: false,
      error: `Extraction failed: ${errorMessage}`,
    };
  }
}

/**
 * Validate resume text quality
 *
 * Checks:
 * - Minimum 50 characters
 * - Not just whitespace/newlines
 * - Contains some alphabetic characters
 */
export function validateResumeText(text: string): boolean {
  if (!text || text.length < 50) {
    return false;
  }

  const trimmed = text.trim();
  if (trimmed.length < 50) {
    return false;
  }

  // Must contain at least some alphabetic characters
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
  return alphaCount >= 20;
}
