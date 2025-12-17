/**
 * Shared Groq Client Configuration
 *
 * Centralized Groq SDK client with:
 * - Configurable timeout (default 30s)
 * - Lazy initialization
 * - Shared across all AI features
 */

import Groq from 'groq-sdk';

// Configurable timeout (default 30 seconds)
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

let groqClient: Groq | null = null;

/**
 * Get the shared Groq client instance.
 * Throws if GROQ_API_KEY is not configured.
 */
export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API key not configured. AI features are disabled.');
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: AI_TIMEOUT_MS,
    });
  }

  return groqClient;
}

/**
 * Check if AI features are available (API key is configured)
 */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Reset the client (useful for testing)
 */
export function resetGroqClient(): void {
  groqClient = null;
}
