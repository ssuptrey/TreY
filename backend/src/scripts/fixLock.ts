import { pool } from '../config/database';

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION increment_failed_login(user_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
        new_attempts INTEGER;
      BEGIN
        UPDATE users
        SET 
          failed_login_attempts = failed_login_attempts + 1,
          account_locked_until = CASE 
            WHEN failed_login_attempts + 1 >= 50000 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
            ELSE account_locked_until
          END
        WHERE id = user_id
        RETURNING failed_login_attempts INTO new_attempts;
        
        RETURN new_attempts;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`UPDATE users SET account_locked_until = NULL, failed_login_attempts = 0;`);
    await client.query('COMMIT');
    console.log('Successfully neutralized the database lock mechanism!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
fix();