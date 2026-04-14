import { pool } from '../config/database';

async function test() {
  const result = await pool.query(`SELECT email, failed_login_attempts, account_locked_until, is_active FROM users WHERE email = 'ciso@acme.com'`);
  console.table(result.rows);
  process.exit(0);
}
test();