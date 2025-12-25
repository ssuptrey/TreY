// ============================================
// DATABASE SEED SCRIPT
// ============================================
// Creates sample data for testing

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function seed() {
  console.log('Seeding database with sample data...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create organization
    const orgResult = await client.query(`
      INSERT INTO organizations (name, type) 
      VALUES ('Demo NBFC Ltd', 'NBFC')
      RETURNING id
    `);
    const orgId = orgResult.rows[0].id;
    console.log('Created organization:', orgId);

    // Create users
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const adminResult = await client.query(`
      INSERT INTO users (email, password_hash, name, role, organization_id)
      VALUES ('admin@demo.com', $1, 'Admin User', 'admin', $2)
      RETURNING id
    `, [passwordHash, orgId]);
    const adminId = adminResult.rows[0].id;
    console.log('Created admin user: admin@demo.com / password123');

    const managerResult = await client.query(`
      INSERT INTO users (email, password_hash, name, role, organization_id)
      VALUES ('manager@demo.com', $1, 'Manager User', 'manager', $2)
      RETURNING id
    `, [passwordHash, orgId]);
    const managerId = managerResult.rows[0].id;
    console.log('Created manager user: manager@demo.com / password123');

    const operatorResult = await client.query(`
      INSERT INTO users (email, password_hash, name, role, organization_id)
      VALUES ('operator@demo.com', $1, 'Operator User', 'operator', $2)
      RETURNING id
    `, [passwordHash, orgId]);
    const operatorId = operatorResult.rows[0].id;
    console.log('Created operator user: operator@demo.com / password123');

    // Create sample obligations
    // Obligation 1: On track (green)
    const obl1Result = await client.query(`
      INSERT INTO obligations (title, description, regulation_tag, organization_id, created_by)
      VALUES (
        'Monthly Compliance Report Submission',
        'Submit monthly compliance report to RBI as per regulatory requirements',
        'RBI/2024-25/001',
        $1, $2
      )
      RETURNING id
    `, [orgId, adminId]);
    const obl1Id = obl1Result.rows[0].id;

    // Add owner and SLA for obligation 1
    await client.query(`
      INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current)
      VALUES ($1, $2, $3, true)
    `, [obl1Id, managerId, adminId]);

    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30);
    await client.query(`
      INSERT INTO slas (obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, true)
    `, [obl1Id, futureDate1.toISOString().split('T')[0], adminId]);

    console.log('Created obligation: Monthly Compliance Report (GREEN - 30 days)');

    // Obligation 2: At risk (amber)
    const obl2Result = await client.query(`
      INSERT INTO obligations (title, description, regulation_tag, organization_id, created_by)
      VALUES (
        'KYC Documentation Update',
        'Update KYC documentation for all high-value customers',
        'RBI/2024-25/KYC-002',
        $1, $2
      )
      RETURNING id
    `, [orgId, adminId]);
    const obl2Id = obl2Result.rows[0].id;

    await client.query(`
      INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current)
      VALUES ($1, $2, $3, true)
    `, [obl2Id, operatorId, adminId]);

    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 10);
    await client.query(`
      INSERT INTO slas (obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, true)
    `, [obl2Id, futureDate2.toISOString().split('T')[0], adminId]);

    console.log('Created obligation: KYC Documentation Update (AMBER - 10 days)');

    // Obligation 3: Breached (red)
    const obl3Result = await client.query(`
      INSERT INTO obligations (title, description, regulation_tag, organization_id, created_by)
      VALUES (
        'Annual Audit Report Filing',
        'File annual audit report with regulatory authority',
        'RBI/2023-24/AUDIT',
        $1, $2
      )
      RETURNING id
    `, [orgId, adminId]);
    const obl3Id = obl3Result.rows[0].id;

    await client.query(`
      INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current)
      VALUES ($1, $2, $3, true)
    `, [obl3Id, managerId, adminId]);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    await client.query(`
      INSERT INTO slas (obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, true)
    `, [obl3Id, pastDate.toISOString().split('T')[0], adminId]);

    console.log('Created obligation: Annual Audit Report Filing (RED - 5 days overdue)');

    // Create audit logs for the seed data
    await client.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, new_value)
      VALUES 
        ('obligation', $1, 'OBLIGATION_CREATE', $4, '{"title": "Monthly Compliance Report Submission"}'),
        ('obligation', $2, 'OBLIGATION_CREATE', $4, '{"title": "KYC Documentation Update"}'),
        ('obligation', $3, 'OBLIGATION_CREATE', $4, '{"title": "Annual Audit Report Filing"}')
    `, [obl1Id, obl2Id, obl3Id, adminId]);

    await client.query('COMMIT');
    
    console.log('');
    console.log('Seed completed successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  admin@demo.com / password123');
    console.log('  manager@demo.com / password123');
    console.log('  operator@demo.com / password123');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
