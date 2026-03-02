// ============================================
// DATABASE MIGRATION SCRIPT
// ============================================
// Run this to apply the schema to PostgreSQL
// Handles existing tables gracefully with IF NOT EXISTS

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Migration tracking table
async function ensureMigrationTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function hasMigrationRun(name: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM _migrations WHERE name = $1',
    [name]
  );
  return result.rows.length > 0;
}

async function recordMigration(name: string): Promise<void> {
  await pool.query(
    'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [name]
  );
}

async function migrate(): Promise<void> {
  console.log('Starting database migration...');
  console.log('');
  
  try {
    // Ensure migration tracking table exists
    await ensureMigrationTable();
    
    // Get all migration files in order
    const migrationsDir = path.join(__dirname, '../../migrations');
    const allFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${allFiles.length} migration files`);
    console.log('');
    
    let applied = 0;
    let skipped = 0;
    
    for (const migrationFile of allFiles) {
      const alreadyRun = await hasMigrationRun(migrationFile);
      
      if (alreadyRun) {
        console.log(`[SKIP] ${migrationFile} (already applied)`);
        skipped++;
        continue;
      }
      
      console.log(`[RUN]  ${migrationFile}...`);
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await pool.query(sql);
        await recordMigration(migrationFile);
        console.log(`       ✓ Completed`);
        applied++;
      } catch (err: any) {
        // Handle "already exists" errors gracefully
        if (err.code === '42P07' || err.message.includes('already exists')) {
          console.log(`       ⚠ Tables already exist, marking as applied`);
          await recordMigration(migrationFile);
          skipped++;
        } else {
          throw err;
        }
      }
    }
    
    console.log('');
    console.log('════════════════════════════════════════');
    console.log('Migration completed successfully!');
    console.log(`  Applied: ${applied} new migrations`);
    console.log(`  Skipped: ${skipped} (already applied)`);
    console.log('════════════════════════════════════════');
    console.log('');
    
    if (applied > 0) {
      console.log('Database tables available:');
      console.log('  - organizations');
      console.log('  - users');
      console.log('  - obligations');
      console.log('  - obligation_owners');
      console.log('  - slas');
      console.log('  - evidence');
      console.log('  - audit_logs');
      console.log('  - ingestion_logs');
      console.log('  - api_keys');
      console.log('  - whatsapp_mappings');
    }
    
  } catch (error: any) {
    console.error('');
    console.error('Migration failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
