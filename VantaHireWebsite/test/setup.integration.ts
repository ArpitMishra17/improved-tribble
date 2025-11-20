/**
 * Setup file for integration tests (Node environment)
 *
 * Unlike test/setup.ts which is for browser-like tests (jsdom),
 * this setup is for Node.js integration tests that test the actual API.
 */
import { expect, afterEach } from 'vitest';
import { config } from 'dotenv';

// Load environment variables from .env
config();
