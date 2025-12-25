// ============================================
// AUTHENTICATION ROUTES
// ============================================
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { createAuditLog, AuditActions } = require('../services/auditService');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { validatePassword, validatePasswordHistory, getPasswordRequirements } = require('../utils/passwordValidator');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (admin only, or first user of an organization)
 */
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password, name, role, organizationId, organizationName, organizationType } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email, password, and name are required'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: getPasswordRequirements()
      });
    }

    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists'
      });
    }

    let orgId = organizationId;

    // If no organization provided, create a new one
    if (!orgId) {
      if (!organizationName || !organizationType) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Organization name and type are required for new organizations'
        });
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required'
      });
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
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        error: 'USER_INACTIVE',
        message: 'This account is inactive'
      });
    }

    // Check if account is locked
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return res.status(401).json({
        error: 'ACCOUNT_LOCKED',
        message: 'Account is locked due to multiple failed login attempts. Please try again later.',
        locked_until: user.account_locked_until
      });
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
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Check if password is expired
    if (user.password_expires_at && new Date(user.password_expires_at) < new Date()) {
      return res.status(401).json({
        error: 'PASSWORD_EXPIRED',
        message: 'Your password has expired. Please reset your password.',
        requires_password_change: true
      });
    }

    // Check if forced password change is required
    if (user.force_password_change) {
      return res.status(401).json({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before logging in.',
        requires_password_change: true
      });
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
      ipAddress: req.ip,
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
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      organizationId: req.user.organization_id,
      organizationName: req.user.organization_name,
      organizationType: req.user.organization_type
    }
  });
});

/**
 * POST /api/auth/logout
 * Logout (just logs the action - actual token invalidation would need a blocklist)
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await createAuditLog({
      entityType: 'user',
      entityId: req.user.id,
      action: AuditActions.USER_LOGOUT,
      performedBy: req.user.id,
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
router.post('/change-password', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: getPasswordRequirements()
      });
    }

    await client.query('BEGIN');

    // Get user with password history
    const userResult = await client.query(
      'SELECT password_hash, password_history FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Current password is incorrect'
      });
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
      return res.status(400).json({
        error: 'PASSWORD_REUSED',
        message: 'Cannot reuse any of your last 5 passwords'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password (trigger will handle history and expiry)
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.id]
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
router.get('/password-requirements', (req, res) => {
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

module.exports = router;

