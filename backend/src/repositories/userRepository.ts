// User Repository - Database access for user operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { User } from '../types/models';

export class UserRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async getPasswordData(userId: string): Promise<any> {
    const result = await this.query<any>(
      'SELECT password_hash, password_history FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async forcePasswordReset(userId: string): Promise<boolean> {
    const result = await this.query<any>(
      'UPDATE users SET force_password_change = true WHERE id = $1 RETURNING id',
      [userId]
    );
    return result.rows.length > 0;
  }

  async changePasswordOnly(userId: string, newPasswordHash: string): Promise<void> {
    await this.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findByEmailWithOrg(email: string): Promise<any> {
    const result = await this.query<any>(
      `SELECT u.*, o.name as organization_name, o.type as organization_type
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(userData: {
    email: string;
    password_hash: string;
    full_name: string;
    organization_id: string;
    role: string;
  }): Promise<User> {
    const result = await this.query<User>(
      `INSERT INTO users (email, password_hash, full_name, organization_id, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userData.email, userData.password_hash, userData.full_name, userData.organization_id, userData.role]
    );
    return result.rows[0];
  }

  async updatePassword(userId: string, passwordHash: string, passwordHistory: any[]): Promise<void> {
    await this.query(
      `UPDATE users 
       SET password_hash = $1, 
           password_history = $2, 
           password_expires_at = NOW() + INTERVAL '90 days',
           updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, JSON.stringify(passwordHistory), userId]
    );
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    await this.query('SELECT increment_failed_login($1)', [userId]);
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.query('SELECT reset_failed_login($1)', [userId]);
  }

  async lockUser(userId: string): Promise<void> {
    await this.query(
      'UPDATE users SET is_locked = true WHERE id = $1',
      [userId]
    );
  }

  async unlockUser(userId: string): Promise<void> {
    await this.query(
      'UPDATE users SET is_locked = false, failed_login_attempts = 0 WHERE id = $1',
      [userId]
    );
  }

  async updateRole(userId: string, role: string): Promise<void> {
    await this.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [role, userId]
    );
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    return result.rows;
  }

  async registerUserTx(data: any, passwordHash: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [data.email.toLowerCase()]);
      if (existingUser.rows.length > 0) return { success: false, error: 'EMAIL_EXISTS' };
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, role, organization_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
        [data.email.toLowerCase(), passwordHash, data.full_name, data.role || 'operator', data.organization_id]
      );
      await client.query('COMMIT');
      return { success: true, user: userResult.rows[0] };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
