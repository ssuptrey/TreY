// AuthService.ts - Core Authentication Logic & Security Rules
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { JWT_SECRET } from '../middlewares/auth';
import { validatePasswordHistory } from '../utils/passwordValidator';

export class AuthService {
  async login(email: string, password: string) {
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name, o.type as organization_type
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return { success: false, error: 'USER_INACTIVE' };
    }

    // 1. Enforce Account Lockout
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return { 
        success: false, 
        error: 'ACCOUNT_LOCKED', 
        message: 'Account locked due to too many failed attempts. Try again later.' 
      };
    }

    // Verify Password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Trigger Lockout logic via Postgres function
      await pool.query('SELECT increment_failed_login($1)', [user.id]);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    // 2. Enforce Password Expiry (90 days rotation)
    if (user.password_expires_at && new Date(user.password_expires_at) < new Date()) {
      return { 
        success: false, 
        error: 'PASSWORD_EXPIRED', 
        requires_password_change: true 
      };
    }

    // 3. Enforce Forced Resets
    if (user.force_password_change) {
      return { 
        success: false, 
        error: 'PASSWORD_CHANGE_REQUIRED', 
        requires_password_change: true 
      };
    }

    // On Success: Reset failed attempt counters
    await pool.query('SELECT reset_failed_login($1)', [user.id]);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name
      }
    };
  }

  async register(data: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [data.email.toLowerCase()]);
      if (existingUser.rows.length > 0) return { success: false, error: 'EMAIL_EXISTS' };

      const passwordHash = await bcrypt.hash(data.password, 10);
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

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const userResult = await pool.query('SELECT password_hash, password_history FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) return { success: false, error: 'INVALID_PASSWORD' };

    // Prevent reuse of last 5 passwords
    const historyValidation = validatePasswordHistory(newPassword, user.password_history, async (hash: string) => await bcrypt.compare(newPassword, hash));
    const isHistoryValid = await historyValidation;
    if (!isHistoryValid) return { success: false, error: 'PASSWORD_REUSED' };

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [newPasswordHash, userId]
    );

    return { success: true };
  }

  async forcePasswordReset(userId: string) {
    const result = await pool.query(
      `UPDATE users SET force_password_change = true WHERE id = $1 RETURNING id`,
      [userId]
    );
    if (result.rows.length === 0) return { success: false, error: 'NOT_FOUND' };
    return { success: true };
  }

  async refreshToken(_refreshToken: string) {
    // Implement refresh token validation logic here if needed
    return { success: true, token: 'new-token' };
  }
}
