/**
 * Redis client with automatic retry/backoff and in-memory fallback
 *
 * Features:
 * - Exponential backoff with max 3s delay
 * - Environment-aware namespacing
 * - In-memory fallback when Redis unavailable
 * - Single warning log on fallback (no spam)
 */

import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_NAMESPACE = process.env.NODE_ENV || 'development';

let redisClient: RedisClientType | null = null;
let usingFallback = false;
let fallbackWarningLogged = false;

// In-memory fallback store
const memoryStore = new Map<string, string>();

// Initialize Redis client with retry strategy
async function initRedis(): Promise<void> {
  if (!REDIS_URL) {
    if (!fallbackWarningLogged) {
      console.warn('⚠️  REDIS_URL not set. Using in-memory fallback for AI circuit breaker.');
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    return;
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, 3000ms (max)
          const delay = Math.min(3000, Math.pow(2, retries) * 100);
          console.log(`🔄 Redis reconnecting (attempt ${retries + 1}), delay: ${delay}ms`);
          return delay;
        },
      },
    });

    redisClient.on('error', (err) => {
      if (!fallbackWarningLogged) {
        console.error('❌ Redis error. Falling back to in-memory store:', err.message);
        fallbackWarningLogged = true;
      }
      usingFallback = true;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      usingFallback = false;
      fallbackWarningLogged = false;
    });

    await redisClient.connect();
  } catch (error) {
    if (!fallbackWarningLogged) {
      console.error('❌ Failed to connect to Redis. Using in-memory fallback:', error);
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    redisClient = null;
  }
}

// Namespaced key generation
export function redisKey(suffix: string): string {
  return `${REDIS_NAMESPACE}:ai:${suffix}`;
}

// Get value from Redis or fallback
export async function redisGet(key: string): Promise<string | null> {
  const namespacedKey = redisKey(key);

  if (usingFallback || !redisClient) {
    return memoryStore.get(namespacedKey) || null;
  }

  try {
    return await redisClient.get(namespacedKey);
  } catch (error) {
    if (!fallbackWarningLogged) {
      console.warn('⚠️  Redis GET failed. Using in-memory fallback.');
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    return memoryStore.get(namespacedKey) || null;
  }
}

// Set value in Redis or fallback
export async function redisSet(key: string, value: string, expirySeconds?: number): Promise<void> {
  const namespacedKey = redisKey(key);

  if (usingFallback || !redisClient) {
    memoryStore.set(namespacedKey, value);
    if (expirySeconds) {
      // In-memory expiration (basic implementation)
      setTimeout(() => memoryStore.delete(namespacedKey), expirySeconds * 1000);
    }
    return;
  }

  try {
    if (expirySeconds) {
      await redisClient.setEx(namespacedKey, expirySeconds, value);
    } else {
      await redisClient.set(namespacedKey, value);
    }
  } catch (error) {
    if (!fallbackWarningLogged) {
      console.warn('⚠️  Redis SET failed. Using in-memory fallback.');
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    memoryStore.set(namespacedKey, value);
  }
}

// Increment value in Redis or fallback
export async function redisIncr(key: string): Promise<number> {
  const namespacedKey = redisKey(key);

  if (usingFallback || !redisClient) {
    const current = parseInt(memoryStore.get(namespacedKey) || '0', 10);
    const next = current + 1;
    memoryStore.set(namespacedKey, next.toString());
    return next;
  }

  try {
    return await redisClient.incr(namespacedKey);
  } catch (error) {
    if (!fallbackWarningLogged) {
      console.warn('⚠️  Redis INCR failed. Using in-memory fallback.');
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    const current = parseInt(memoryStore.get(namespacedKey) || '0', 10);
    const next = current + 1;
    memoryStore.set(namespacedKey, next.toString());
    return next;
  }
}

// Decrement value in Redis or fallback
export async function redisDecr(key: string): Promise<number> {
  const namespacedKey = redisKey(key);

  if (usingFallback || !redisClient) {
    const current = parseInt(memoryStore.get(namespacedKey) || '0', 10);
    const next = Math.max(0, current - 1); // Don't go negative
    memoryStore.set(namespacedKey, next.toString());
    return next;
  }

  try {
    return await redisClient.decr(namespacedKey);
  } catch (error) {
    if (!fallbackWarningLogged) {
      console.warn('⚠️  Redis DECR failed. Using in-memory fallback.');
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    const current = parseInt(memoryStore.get(namespacedKey) || '0', 10);
    const next = Math.max(0, current - 1);
    memoryStore.set(namespacedKey, next.toString());
    return next;
  }
}

// Delete key from Redis or fallback
export async function redisDel(key: string): Promise<void> {
  const namespacedKey = redisKey(key);

  if (usingFallback || !redisClient) {
    memoryStore.delete(namespacedKey);
    return;
  }

  try {
    await redisClient.del(namespacedKey);
  } catch (error) {
    if (!fallbackWarningLogged) {
      console.warn('⚠️  Redis DEL failed. Using in-memory fallback.');
      fallbackWarningLogged = true;
    }
    usingFallback = true;
    memoryStore.delete(namespacedKey);
  }
}

// Check if using fallback (for testing/monitoring)
export function isUsingFallback(): boolean {
  return usingFallback;
}

// Initialize on module load
initRedis().catch((err) => {
  console.error('❌ Redis initialization failed:', err);
  usingFallback = true;
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (redisClient) {
    await redisClient.quit();
  }
});
