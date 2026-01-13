/**
 * Public ID generation utilities for non-enumerable URLs.
 * Uses NanoID for URL-safe, non-sequential identifiers.
 */
import { customAlphabet } from 'nanoid';

// URL-safe alphabet (no lookalikes: 0O, 1lI)
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// 12 characters gives ~68 bits of entropy (good collision resistance)
const ID_LENGTH = 12;

// Create the generator
const nanoid = customAlphabet(ALPHABET, ID_LENGTH);

/**
 * Generate a new public ID for use in URLs.
 * Format: 12 characters, URL-safe, non-sequential.
 * Example: "Vk7q2HxNpR3m"
 */
export function generatePublicId(): string {
  return nanoid();
}

/**
 * Validate that a string looks like a valid public ID.
 * Used for route parameter validation.
 */
export function isValidPublicId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length !== ID_LENGTH) return false;
  return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(id);
}

/**
 * Check if a string is a numeric ID (for backwards compatibility).
 * Helps distinguish between /recruiters/123 and /recruiters/Vk7q2HxNpR3m
 */
export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}
