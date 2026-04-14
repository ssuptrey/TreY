import { pool } from '../config/database';

async function test() {
  await pool.query(`UPDATE users SET account_locked_until = NULL, failed_login_attempts = 0`);
  console.log('Unlocked!');
  process.exit(0);
}
test();