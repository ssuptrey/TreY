#!/usr/bin/env node

/**
 * Database Setup Script
 * Runs migrations on cloud PostgreSQL database (Neon/Supabase/Railway)
 */

// Load environment variables
require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function runMigration(client, filePath) {
  console.log(`\n📄 Running migration: ${path.basename(filePath)}`);
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    await client.query(sql);
    console.log(`✅ Migration completed: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed: ${path.basename(filePath)}`);
    console.error(error.message);
    return false;
  }
}

async function testConnection(connectionString) {
  const client = new Client({ connectionString });
  
  try {
    console.log('\n🔌 Testing database connection...');
    await client.connect();
    
    const result = await client.query('SELECT version()');
    console.log('✅ Connected successfully!');
    console.log(`📊 PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function checkExistingTables(client) {
  const result = await client.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  
  return result.rows.map(row => row.tablename);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Compliance Execution System - Database Setup        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Get connection string
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.log('No DATABASE_URL found in environment.\n');
    console.log('Expected format:');
    console.log('postgresql://user:password@host:port/database?sslmode=require\n');
    
    connectionString = await question('Enter your database connection string: ');
    
    if (!connectionString || !connectionString.startsWith('postgresql://')) {
      console.error('\n❌ Invalid connection string. Must start with "postgresql://"');
      process.exit(1);
    }
  }

  // Test connection
  const connected = await testConnection(connectionString);
  if (!connected) {
    console.error('\n❌ Cannot proceed without database connection.');
    console.log('\nTroubleshooting:');
    console.log('1. Check your connection string is correct');
    console.log('2. Verify database is not paused (Neon/Supabase auto-pause)');
    console.log('3. Check firewall/network settings');
    process.exit(1);
  }

  // Connect for migrations
  const client = new Client({ connectionString });
  await client.connect();

  // Check existing tables
  console.log('\n📋 Checking existing database schema...');
  const existingTables = await checkExistingTables(client);
  
  if (existingTables.length > 0) {
    console.log(`Found ${existingTables.length} existing tables:`);
    existingTables.forEach(table => console.log(`   - ${table}`));
    
    const proceed = await question('\nDatabase already has tables. Continue with migrations? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled.');
      await client.end();
      rl.close();
      process.exit(0);
    }
  } else {
    console.log('✅ Database is empty, ready for migrations.');
  }

  // Run migrations
  console.log('\n🚀 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  let successCount = 0;
  let failCount = 0;

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const success = await runMigration(client, filePath);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
      
      const continueOnError = await question('\nContinue with remaining migrations? (y/n): ');
      if (continueOnError.toLowerCase() !== 'y') {
        break;
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('═'.repeat(60));

  // Verify tables
  console.log('\n🔍 Verifying database schema...');
  const finalTables = await checkExistingTables(client);
  
  const expectedTables = [
    'organizations',
    'users',
    'obligations',
    'evidence',
    'sla_history',
    'audit_logs',
    'attachments'
  ];

  console.log(`\n📋 Created tables (${finalTables.length}):`);
  expectedTables.forEach(table => {
    const exists = finalTables.includes(table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  });

  // Get table counts
  console.log('\n📊 Table row counts:');
  for (const table of expectedTables) {
    if (finalTables.includes(table)) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${result.rows[0].count} rows`);
      } catch (err) {
        console.log(`   ${table}: Error counting rows`);
      }
    }
  }

  await client.end();
  rl.close();

  console.log('\n✅ Database setup complete!');
  console.log('\nNext steps:');
  console.log('1. Update backend/.env with your DATABASE_URL');
  console.log('2. Run: cd backend && npm install');
  console.log('3. Run: cd frontend && npm install');
  console.log('4. Start backend: cd backend && npm start');
  console.log('5. Start frontend: cd frontend && npm start');
}

main().catch(error => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
