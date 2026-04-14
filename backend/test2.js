const { Pool } = require('pg');
const pool = new Pool({connectionString: 'postgresql://postgres:Guccigeng77@db.crkhtiuwxeznikxrqdnd.supabase.co:6543/postgres', ssl: {rejectUnauthorized: false}});

async function test() {
  try {
    const email = 'ciso@acme.com';
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name, o.type as organization_type FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.email = $1`,
      [email]
    );
    const user = result.rows[0];
    console.log('USER ID:', user.id);

    // Call reset failed login
    try {
      await pool.query(`SELECT reset_failed_login($1) WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_failed_login')`, [user.id]);
      console.log('RESET FAILED LOGIN SUCCESS');
    } catch(e) {
      console.error('RESET FAIL:', e.message);
    }

    // Call create audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        ['user', user.id, 'USER_LOGIN', user.id, '127.0.0.1', 'test']
      );
      console.log('AUDIT LOG SUCCESS');
    } catch(e) {
      console.error('AUDIT ERROR:', e.message);
    }

  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    pool.end();
  }
}
test();