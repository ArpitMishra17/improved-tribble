import * as schema from "@shared/schema";

// Support both Neon (serverless) and standard Postgres on Railway
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Configure it in Railway Variables (see DEPLOY_RAILWAY.md).",
  );
}

const isNeon = /neon\.tech/i.test(databaseUrl) || process.env.DATABASE_USE_NEON === '1';

let db: any;
let pool: any;

if (isNeon) {
  // Neon serverless driver over WebSocket
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const ws = (await import('ws')).default as any;
  const { drizzle } = await import('drizzle-orm/neon-serverless');

  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: databaseUrl });
  db = drizzle({ client: pool, schema });
} else {
  // Standard Postgres (Railway, RDS, etc.)
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  // Enable SSL in production. Prefer verified TLS; allow explicit override via env for providers
  // with self-signed certs (use DATABASE_CA_CERT for strong verification).
  const useSsl = process.env.DATABASE_SSL === 'true' || /sslmode=require/i.test(databaseUrl) || process.env.NODE_ENV === 'production';
  let ssl: any = undefined;
  if (useSsl) {
    const ca = process.env.DATABASE_CA_CERT;
    const rejectUnauthorizedEnv = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase();
    const rejectUnauthorized = rejectUnauthorizedEnv !== 'false';
    ssl = ca
      ? { ca, rejectUnauthorized: true }
      : { rejectUnauthorized };
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl,
    max: Number(process.env.PGPOOL_MAX || process.env.DB_POOL_MAX || '5'),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || '30000'),
    connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_TIMEOUT_MS || '10000'),
  } as any);
  db = drizzle(pool, { schema });
}

export { db, pool };
