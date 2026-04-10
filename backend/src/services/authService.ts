import { pool } from '../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditActions } from './auditService';
import { validatePassword, getPasswordRequirements } from '../utils/passwordValidator';
import { JWT_SECRET } from '../middlewares/auth';

export class AuthService {
  async register(data: any): Promise<any> {
    const { email, password, name, role, organizationId, organizationName, organizationType } = data;

    if (!email || !password || !name) {
      return { success: false, error: 'VALIDATION_ERROR', message: 'Email, password, and name are required' };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { success: false, error: 'WEAK_PASSWORD', message: 'Password does not meet security requirements', errors: passwordValidation.errors, requirements: getPasswordRequirements() };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existingUser.rows.length > 0) { await client.query('ROLLBACK'); return { success: false, error: 'EMAIL_EXISTS', message: 'An account with this email already exists' }; }

      let orgId = organizationId;
      if (!orgId) {
        if (!organizationName || !organizationType) { await client.query('ROLLBACK'); return { success: false, error: 'VALIDATION_ERROR', message: 'Organization name and type are required' }; }
        const orgResult = await client.query('INSERT INTO organizations (name, type) VALUES ($1, $2) RETURNING id', [organizationName, organizationType]);
        orgId = orgResult.rows[0].id;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, role, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, organization_id, created_at`,
        [email.toLowerCase(), passwordHash, name, role || 'operator', orgId]
      );
      const user = userResult.rows[0];

      await createAuditLog({
        entityType: 'user', entityId: user.id, action: AuditActions.USER_CREATE,
        performedBy: user.id, newValue: { email: user.email, name: user.name, role: user.role }, additionalContext: { selfRegistration: true }
      });

      await client.query('COMMIT');
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
      return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organization_id }, token };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async login(email: string, password: string, reqIp?: string, userAgent?: string): Promise<any> {
    if (!email || !password) return { success: false, error: 'VALIDATION_ERROR', message: 'Email and password required' };
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name, o.type as organization_type FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return { success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
    
    const user = result.rows[0];
    if (!user.is_active) return { success: false, error: 'USER_INACTIVE', message: 'Account inactive' };
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) return { success: false, error: 'ACCOUNT_LOCKED', message: 'Account locked.' };

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await pool.query(`SELECT increment_failed_login($1) WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_failed_login')`, [user.id]);
      await createAuditLog({ entityType: 'user', entityId: user.id, action: 'USER_LOGIN_FAILED', performedBy: user.id, ipAddress: reqIp || null, userAgent: userAgent || null });
      return { success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
    }

    if (user.password_expires_at && new Date(user.password_expires_at) < new Date()) return { success: false, error: 'PASSWORD_EXPIRED', message: 'Password expired', requires_password_change: true };
    if (user.force_password_change) return { success: false, error: 'PASSWORD_CHANGE_REQUIRED', message: 'Must change password', requires_password_change: true };

    await pool.query(`SELECT reset_failed_login($1) WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_failed_login')`, [user.id]);
    await createAuditLog({ entityType: 'user', entityId: user.id, action: AuditActions.USER_LOGIN, performedBy: user.id, ipAddress: reqIp || null, userAgent: userAgent || null });

    const token = jwt.sign({ userId: user.id, organizationId: user.organization_id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    return { success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organization_id, organizationName: user.organization_name } };
  }

  async changePassword() { return { success: false, error: 'NOT_IMPLEMENTED' }; }
  async refreshToken() { return { success: false, error: 'NOT_IMPLEMENTED' }; }
  async forcePasswordReset() { return { success: false, error: 'NOT_IMPLEMENTED' }; }

  async logout(userId: string, reqIp?: string, userAgent?: string): Promise<any> {
    try {
      await createAuditLog({ entityType: 'user', entityId: userId, action: AuditActions.USER_LOGOUT, performedBy: userId, ipAddress: reqIp || null, userAgent: userAgent || null });
      return { success: true };
    } catch(err) { return { success: false, error: 'LOGOUT_ERROR' }; }
  }
}
