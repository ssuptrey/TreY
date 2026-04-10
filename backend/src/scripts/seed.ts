import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/trey_db'
});

async function seed() {
  console.log('Seeding TreY DEMO database with enterprise sample data...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE table audit_logs, evidence, slas, obligation_owners, obligations, users, organizations CASCADE');

    console.log('Formulating Acme Fintech Corp (Demo Corp)...');
    const orgResult = await client.query("INSERT INTO organizations (name, type) VALUES ('Acme Fintech Corp', 'NBFC') RETURNING id");
    const orgId = orgResult.rows[0].id;

    console.log('Hiring staff (Admin, SecEng, Legal, Dev)...');
    const passwordHash = await bcrypt.hash('demo123', 10);
    
    const adminRes = await client.query("INSERT INTO users (email, password_hash, name, role, organization_id) VALUES ('ciso@acme.com', $1, 'Sarah Chen (CISO)', 'admin', $2) RETURNING id", [passwordHash, orgId]);
    const cisoId = adminRes.rows[0].id;

    const secRes = await client.query("INSERT INTO users (email, password_hash, name, role, organization_id) VALUES ('seceng@acme.com', $1, 'Marcus Wright (SecEng)', 'manager', $2) RETURNING id", [passwordHash, orgId]);
    const secId = secRes.rows[0].id;

    const legalRes = await client.query("INSERT INTO users (email, password_hash, name, role, organization_id) VALUES ('legal@acme.com', $1, 'Jessica Vance (Legal)', 'manager', $2) RETURNING id", [passwordHash, orgId]);
    const legalId = legalRes.rows[0].id;

    const devRes = await client.query("INSERT INTO users (email, password_hash, name, role, organization_id) VALUES ('devops@acme.com', $1, 'Tom OConnor (DevOps)', 'operator', $2) RETURNING id", [passwordHash, orgId]);
    const devId = devRes.rows[0].id;

    const hrRes = await client.query("INSERT INTO users (email, password_hash, name, role, organization_id) VALUES ('hr@acme.com', $1, 'Alicia Keys (HR)', 'operator', $2) RETURNING id", [passwordHash, orgId]);
    const hrId = hrRes.rows[0].id;

    console.log('Loading massive SOC 2 & ISO 27001 Policy set...');

    const insertObligation = async (title: string, desc: string, tag: string, status: string, ownerId: string, daysOffset: number) => {
      const oblRes = await client.query("INSERT INTO obligations (title, description, regulation_tag, status, organization_id, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [title, desc, tag, status, orgId, cisoId]);
      const oblId = oblRes.rows[0].id;

      await client.query("INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current) VALUES ($1, $2, $3, true)", [oblId, ownerId, cisoId]);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysOffset);
      await client.query("INSERT INTO slas (obligation_id, due_date, created_by, is_current) VALUES ($1, $2, $3, true)", [oblId, dueDate.toISOString().split('T')[0], cisoId]);

      return oblId;
    };

    // Note: The enums in postgres are 'open', 'closed', 'breached' - using 'open' for pending/in-progress and 'closed' for completed
    await insertObligation('Quarterly Access Review', 'Perform complete audit of AWS IAM roles to prune inactive users.', 'SOC2:CC6.1', 'open', secId, -12);
    await insertObligation('Penetration Test Remediation', 'Fix HIGH vulnerabilities discovered in pentest.', 'ISO:A.12.6.1', 'open', devId, -4);
    await insertObligation('Privacy Policy Update', 'Update employee privacy policy to match new GDPR standard.', 'GDPR:Art.13', 'open', legalId, -2);
    
    await insertObligation('Endpoint Antivirus Validation', 'Ensure CrowdStrike is installed on 100% of employee laptops.', 'SOC2:CC6.6', 'open', secId, 2);
    await insertObligation('Database Backup Testing', 'Perform disaster recovery test by restoring Production DB to staging.', 'SOC2:CC7.1', 'open', devId, 4);
    await insertObligation('Vendor Risk Assessment (AWS)', 'Review AWS SOC 2 Type 2 report and log exceptions.', 'ISO:A.15.1.1', 'open', cisoId, 5);
    await insertObligation('Onboard New Hire Security Training', 'Ensure all hires have completed KnowBe4 training.', 'SOC2:CC2.2', 'open', hrId, 7);

    await insertObligation('Cloud WAF Configuration', 'Review AWS WAF blocking rules against SQLi and XSS.', 'ISO:A.13.1.1', 'open', secId, 15);
    await insertObligation('Incident Response Tabletop', 'Conduct annual table-top exercise for ransomware scenario.', 'SOC2:CC7.3', 'open', cisoId, 22);
    await insertObligation('Offboarding Access Checklist', 'Ensure all terminated employees have revoked GitHub/AWS access.', 'SOC2:CC6.2', 'open', hrId, 30);
    await insertObligation('Key Rotation (Auth0)', 'Rotate production API keys for auth services.', 'ISO:A.10.1.1', 'open', devId, 45);
    
    const comp1 = await insertObligation('Annual Penetration Testing', 'Execute white-box pentest on core platform.', 'SOC2:CC4.1', 'closed', secId, 14);

    console.log('Attaching sample evidence files to completed tasks...');
    await client.query("INSERT INTO evidence (obligation_id, file_name, file_path, mime_type, file_size_bytes, uploaded_by, reference_note) VALUES ($1, '2026_NCC_Group_Pentest_Report.pdf', '/uploads/mock1.pdf', 'application/pdf', 2450000, $2, 'Final executive summary attached. All criticals patched.')", [comp1, secId]);

    console.log('Generating Audit Trail history...');
      await client.query("INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, new_value, timestamp) VALUES ('obligation', $1, 'OBLIGATION_CREATE', $2, '{\"title\": \"Quarterly Access Review\"}', NOW() - INTERVAL '14 days')", [comp1, cisoId]);
    await client.query('COMMIT');
    
    console.log('================================================');
    console.log('SEED SCRIPT COMPLETED! YOUR DASHBOARD IS READY!');
    console.log('================================================');
    console.log('Login credentials for your demo:');
    console.log('  1. ciso@acme.com   / demo123  (Master Admin View)');
    console.log('  2. seceng@acme.com / demo123  (Engineering Workflow)');
    console.log('  3. hr@acme.com     / demo123  (Non-Technical Workflow)');
    
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();