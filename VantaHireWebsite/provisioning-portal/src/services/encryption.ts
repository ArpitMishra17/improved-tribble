/**
 * Encryption service using libsodium XChaCha20-Poly1305 (IETF variant)
 *
 * CRITICAL: Each encryption MUST use a fresh random nonce.
 * Nonce reuse with the same key is catastrophic for security.
 *
 * XChaCha20-Poly1305 uses 192-bit (24 byte) nonces, making random
 * nonce collisions practically impossible (birthday bound ~2^96).
 */

import sodium from 'libsodium-wrappers';
import crypto from 'crypto';
import { config } from '../config.js';

let initialized = false;

async function ensureInit(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

function getMasterKey(): Uint8Array {
  const key = Buffer.from(config.ENCRYPTION_MASTER_KEY, 'hex');
  if (key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new Error(
      `Master key must be ${sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES} bytes (${sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES * 2} hex chars)`
    );
  }
  return key;
}

/**
 * Encrypt a plaintext string
 *
 * @param plaintext - The string to encrypt
 * @returns Object with encrypted data (hex) and nonce (hex) - ALWAYS fresh nonce
 */
export async function encrypt(plaintext: string): Promise<{
  encrypted: string;
  nonce: string;
}> {
  await ensureInit();

  // ALWAYS generate a fresh random nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

  const encrypted = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    sodium.from_string(plaintext),
    null, // additional data (AAD)
    null, // nsec (not used)
    nonce,
    getMasterKey()
  );

  return {
    encrypted: Buffer.from(encrypted).toString('hex'),
    nonce: Buffer.from(nonce).toString('hex'),
  };
}

/**
 * Decrypt encrypted data
 *
 * @param encrypted - Hex-encoded encrypted data
 * @param nonce - Hex-encoded nonce used during encryption
 * @returns Decrypted plaintext string
 */
export async function decrypt(encrypted: string, nonce: string): Promise<string> {
  await ensureInit();

  const encryptedBytes = Buffer.from(encrypted, 'hex');
  const nonceBytes = Buffer.from(nonce, 'hex');

  if (nonceBytes.length !== sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) {
    throw new Error('Invalid nonce length');
  }

  const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // nsec (not used)
    encryptedBytes,
    null, // additional data (AAD)
    nonceBytes,
    getMasterKey()
  );

  if (!decrypted) {
    throw new Error('Decryption failed - data may be corrupted or tampered');
  }

  return sodium.to_string(decrypted);
}

/**
 * Hash a token for storage (one-way, for setup tokens)
 * Uses BLAKE2b which is faster than SHA and built into libsodium
 */
export async function hashToken(token: string): Promise<string> {
  await ensureInit();

  const hash = sodium.crypto_generichash(
    32, // 256-bit hash
    sodium.from_string(token)
  );

  return Buffer.from(hash).toString('hex');
}

/**
 * Generate a secure random token (for setup links, etc.)
 *
 * @param bytes - Number of random bytes (default 32 = 256 bits)
 * @returns Hex-encoded random token
 */
export async function generateSecureToken(bytes: number = 32): Promise<string> {
  await ensureInit();
  return Buffer.from(sodium.randombytes_buf(bytes)).toString('hex');
}

/**
 * Generate a secure random password
 *
 * @param length - Password length (default 20)
 * @returns Random password with mixed characters
 */
export async function generatePassword(length: number = 20): Promise<string> {
  await ensureInit();

  // Character set excluding ambiguous chars (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const randomBytes = sodium.randombytes_buf(length);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }

  return password;
}

/**
 * Constant-time comparison for tokens/signatures
 */
export function constantTimeEqual(a: Buffer | string, b: Buffer | string): boolean {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
