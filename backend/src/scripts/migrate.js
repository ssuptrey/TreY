// ============================================
// DATABASE MIGRATION SCRIPT
// ============================================
// Run this to apply the schema to PostgreSQL

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function migrate() {
  console.log('Starting database migration...');
  
  try {
    // Run all migrations in order
    const migrations = [
      '001_initial_schema.sql',
      '002_password_security.sql'
    ];
    
    for (const migrationFile of migrations) {
      console.log(`Running migration: ${migrationFile}...`);
      const migrationPath = path.join(__dirname, '../../migrations', migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      console.log(`✓ ${migrationFile} completed`);
    }
    
    console.log('');
    console.log('Migration completed successfully!');
    console.log('');
    console.log('Database tables created:');
    console.log('  - organizations');
    console.log('  - users');
    console.log('  - obligations');
    console.log('  - obligation_owners');
    console.log('  - slas');
    console.log('  - evidence');
    console.log('  - audit_logs');
    console.log('');
    console.log('Enforcement triggers installed:');
    console.log('  - trg_prevent_obligation_delete');
    console.log('  - trg_obligation_created_at_immutable');
    console.log('  - trg_prevent_owner_delete');
    console.log('  - trg_owner_assigned_at_immutable');
    console.log('  - trg_prevent_sla_delete');
    console.log('  - trg_sla_immutable');
    console.log('  - trg_prevent_evidence_delete');
    console.log('  - trg_evidence_immutable');
    console.log('  - trg_check_evidence_late');
    console.log('  - trg_audit_log_immutable');
    console.log('');
    console.log('Password security features:');
    console.log('  - Password expiry (90 days)');
    console.log('  - Password history tracking');
    console.log('  - Account lockout after failed attempts');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
