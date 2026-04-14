import { pool } from '../config/database';

async function test() {
  const result = await pool.query(`SELECT prosrc FROM pg_proc WHERE proname = 'increment_failed_login'`);
  console.log(result.rows[0].prosrc);
  process.exit(0);
}
test();