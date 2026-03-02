// ============================================
// AUTHENTICATION ROUTES
// ============================================
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { createAuditLog, AuditActions } from '../services/auditService';
import { authenticate, JWT_SECRET } from '../middlewares/auth';
import { validatePassword, validatePasswordHistory, getPasswordRequirements } from '../utils/passwordValidator';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user (admin only, or first user of an organization)
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  
  try {
    const { email, password, name, role, organizationId, organizationName, organizationType } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email, password, and name are required'
      });
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: getPasswordRequirements()
      });
      return;
    }

    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists'
      });
      return;
    }

    let orgId = organizationId;

    // If no organization provided, create a new one
    if (!orgId) {
      if (!organizationName || !organizationType) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Organization name and type are required for new organizations'
        });
        return;
      }

      const orgResult = await client.query(
        'INSERT INTO organizations (name, type) VALUES ($1, $2) RETURNING id',
        [organizationName, organizationType]
      );
      orgId = orgResult.rows[0].id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name, role, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, organization_id, created_at`,
      [email.toLowerCase(), passwordHash, name, role || 'operator', orgId]
    );

    const user = userResult.rows[0];

    // Create audit log
    await createAuditLog({
      entityType: 'user',
      entityId: user.id,
      action: AuditActions.USER_CREATE,
      performedBy: user.id, // Self-registration
      newValue: { email: user.email, name: user.name, role: user.role },
      additionalContext: { selfRegistration: true }
    });

    await client.query('COMMIT');

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id
      },
      token
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AUTH] Registration error:', error);
    res.status(500).json({
      error: 'REGISTRATION_ERROR',
      message: 'Failed to register user'
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required'
      });
      return;
    }

    // Find user
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name, o.type as organization_type
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(401).json({
        error: 'USER_INACTIVE',
        message: 'This account is inactive'
      });
      return;
    }

    // Check if account is locked
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      res.status(401).json({
        error: 'ACCOUNT_LOCKED',
        message: 'Account is locked due to multiple failed login attempts. Please try again later.',
        locked_until: user.account_locked_until
      });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      // Increment failed login attempts
      await pool.query(
        'SELECT increment_failed_login($1)',
        [user.id]
      );

      // Create audit log for failed login
      await createAuditLog({
        entityType: 'user',
        entityId: user.id,
        action: 'USER_LOGIN_FAILED',
        performedBy: user.id,
        ipAddress: req.ip || undefined,
        userAgent: req.headers['user-agent']
      });

      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if password is expired
    if (user.password_expires_at && new Date(user.password_expires_at) < new Date()) {
      res.status(401).json({
        error: 'PASSWORD_EXPIRED',
        message: 'Your password has expired. Please reset your password.',
        requires_password_change: true
      });
      return;
    }

    // Check if forced password change is required
    if (user.force_password_change) {
      res.status(401).json({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before logging in.',
        requires_password_change: true
      });
      return;
    }

    // Reset failed login attempts on successful login
    await pool.query(
      'SELECT reset_failed_login($1)',
      [user.id]
    );

    // Create audit log
    await createAuditLog({
      entityType: 'user',
      entityId: user.id,
      action: AuditActions.USER_LOGIN,
      performedBy: user.id,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent']
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        organizationType: user.organization_type
      },
      token
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({
      error: 'LOGIN_ERROR',
      message: 'Failed to login'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      role: req.user!.role,
      organizationId: req.user!.organization_id,
      organizationName: req.user!.organization_name,
      organizationType: req.user!.organization_type
    }
  });
});

/**
 * POST /api/auth/logout
 * Logout (just logs the action - actual token invalidation would need a blocklist)
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await createAuditLog({
      entityType: 'user',
      entityId: req.user!.id,
      action: AuditActions.USER_LOGOUT,
      performedBy: req.user!.id,
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    res.status(500).json({
      error: 'LOGOUT_ERROR',
      message: 'Failed to logout'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (authenticated)
 */
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Current password and new password are required'
      });
      return;
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: getPasswordRequirements()
      });
      return;
    }

    await client.query('BEGIN');

    // Get user with password history
    const userResult = await client.query(
      'SELECT password_hash, password_history FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      await client.query('ROLLBACK');
      res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Current password is incorrect'
      });
      return;
    }

    // Check password history (prevent reuse of last 5 passwords)
    const passwordHistory = user.password_history || [];
    const isPasswordReused = await validatePasswordHistory(
      newPassword,
      [user.password_hash, ...passwordHistory],
      bcrypt.compare
    );

    if (!isPasswordReused) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'PASSWORD_REUSED',
        message: 'Cannot reuse any of your last 5 passwords'
      });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password (trigger will handle history and expiry)
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user!.id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Password changed successfully',
      password_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AUTH] Password change error:', error);
    res.status(500).json({
      error: 'PASSWORD_CHANGE_ERROR',
      message: 'Failed to change password'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/auth/password-requirements
 * Get password requirements for UI display
 */
router.get('/password-requirements', (_req: Request, res: Response): void => {
  res.json({
    requirements: getPasswordRequirements(),
    min_length: 12,
    requires_uppercase: true,
    requires_lowercase: true,
    requires_number: true,
    requires_special: true,
    expiry_days: 90,
    history_count: 5
  });
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token (get new token before current expires)
 */
router.post('/refresh', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // User is already authenticated, just issue a new token
    const user = req.user!;

    // Generate new JWT
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await createAuditLog({
      entityType: 'user',
      entityId: user.id,
      action: 'TOKEN_REFRESH',
      performedBy: user.id,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error);
    res.status(500).json({
      error: 'REFRESH_ERROR',
      message: 'Failed to refresh token'
    });
  }
});

/**
 * POST /api/auth/force-password-reset
 * Admin can force a user to change their password on next login
 */
router.post('/force-password-reset', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    const adminUser = req.user!;

    // Only admin and manager can force password reset
    if (!['admin', 'manager'].includes(adminUser.role)) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Only admin or manager can force password reset'
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'User ID is required'
      });
      return;
    }

    // Check that target user is in same organization (unless admin)
    const targetUser = await pool.query(
      'SELECT id, organization_id, email FROM users WHERE id = $1',
      [userId]
    );

    if (targetUser.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    // Manager can only affect users in their organization
    if (adminUser.role === 'manager' && targetUser.rows[0].organization_id !== adminUser.organization_id) {
      res.status(403).json({
        error: 'ORGANIZATION_MISMATCH',
        message: 'Can only manage users in your organization'
      });
      return;
    }

    // Set force_password_change flag
    await pool.query(
      'UPDATE users SET force_password_change = TRUE WHERE id = $1',
      [userId]
    );

    await createAuditLog({
      entityType: 'user',
      entityId: userId,
      action: 'FORCE_PASSWORD_RESET',
      performedBy: adminUser.id,
      newValue: { targetEmail: targetUser.rows[0].email },
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'User will be required to change password on next login'
    });
  } catch (error) {
    console.error('[AUTH] Force password reset error:', error);
    res.status(500).json({
      error: 'FORCE_RESET_ERROR',
      message: 'Failed to force password reset'
    });
  }
});

export default router;
