// ============================================
// DATABASE CONFIGURATION
// ============================================
import { Pool, PoolConfig } from 'pg';

interface DatabaseConfig extends PoolConfig {
  connectionString?: string;
  ssl?: {
    rejectUnauthorized: boolean;
  };
  keepAlive?: boolean;
  keepAliveInitialDelayMillis?: number;
}

// Support both cloud database (DATABASE_URL) and legacy config
const poolConfig: DatabaseConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for cloud databases (Neon, Supabase, Railway)
      },
      max: 5,                          // Neon free tier: keep pool small
      idleTimeoutMillis: 10000,        // Close idle connections after 10s (Neon drops them anyway)
      connectionTimeoutMillis: 15000,  // Wait up to 15s for connection
      keepAlive: true,                 // TCP keep-alive to prevent Neon timeout
      keepAliveInitialDelayMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'compliance_execution',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

// Log connection status (only first time)
let connected = false;
pool.on('connect', (): void => {
  if (!connected) {
    console.log('[DB] Connected to PostgreSQL');
    connected = true;
  }
});

pool.on('error', (err: Error): void => {
  console.error('[DB] Pool error (non-fatal):', err.message);
  // NEVER crash - Neon drops idle connections frequently, pool will reconnect
});

export { pool };
