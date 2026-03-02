// ============================================
// USERS ROUTES
// ============================================

import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, requireRole } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';
import { createAuditLog } from '../services/auditService';

const router = Router();

/**
 * GET /api/users
 * List all users in the organization
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user!.organization_id;

    const result = await pool.query(
      `SELECT id, email, name, role, is_active, created_at,
              account_locked_until, failed_login_attempts, force_password_change
       FROM users
       WHERE organization_id = $1
       ORDER BY name`,
      [organizationId]
    );

    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('[USERS] List error:', error);
    res.status(500).json({
      error: 'LIST_ERROR',
      message: 'Failed to list users'
    });
  }
});

/**
 * GET /api/users/:id
 * Get user details
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organization_id;

    const result = await pool.query(
      `SELECT id, email, name, role, is_active, created_at,
              account_locked_until, failed_login_attempts, force_password_change
       FROM users
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('[USERS] Get error:', error);
    res.status(500).json({
      error: 'GET_ERROR',
      message: 'Failed to get user'
    });
  }
});

/**
 * PUT /api/users/:id/lock
 * Lock a user account (admin/manager only)
 */
router.put('/:id/lock', authenticate, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { duration_minutes = 30 } = req.body;
    const adminUser = req.user!;

    // Get target user
    const targetResult = await pool.query(
      'SELECT id, organization_id, email, role FROM users WHERE id = $1',
      [id]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const targetUser = targetResult.rows[0];

    // Manager can only affect users in their organization
    if (adminUser.role === 'manager' && targetUser.organization_id !== adminUser.organization_id) {
      res.status(403).json({
        error: 'ORGANIZATION_MISMATCH',
        message: 'Can only manage users in your organization'
      });
      return;
    }

    // Cannot lock admin accounts unless you are admin
    if (targetUser.role === 'admin' && adminUser.role !== 'admin') {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Only admin can lock other admin accounts'
      });
      return;
    }

    // Lock the account
    const lockUntil = new Date(Date.now() + duration_minutes * 60 * 1000);
    await pool.query(
      'UPDATE users SET account_locked_until = $1 WHERE id = $2',
      [lockUntil, id]
    );

    await createAuditLog({
      entityType: 'user',
      entityId: id,
      action: 'USER_LOCK',
      performedBy: adminUser.id,
      newValue: { lockedUntil: lockUntil.toISOString(), duration_minutes },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.json({
      success: true,
      message: 'User account locked',
      locked_until: lockUntil
    });
  } catch (error) {
    console.error('[USERS] Lock error:', error);
    res.status(500).json({
      error: 'LOCK_ERROR',
      message: 'Failed to lock user'
    });
  }
});

/**
 * PUT /api/users/:id/unlock
 * Unlock a user account (admin/manager only)
 */
router.put('/:id/unlock', authenticate, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminUser = req.user!;

    // Get target user
    const targetResult = await pool.query(
      'SELECT id, organization_id, email FROM users WHERE id = $1',
      [id]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const targetUser = targetResult.rows[0];

    // Manager can only affect users in their organization
    if (adminUser.role === 'manager' && targetUser.organization_id !== adminUser.organization_id) {
      res.status(403).json({
        error: 'ORGANIZATION_MISMATCH',
        message: 'Can only manage users in your organization'
      });
      return;
    }

    // Unlock the account and reset failed attempts
    await pool.query(
      'UPDATE users SET account_locked_until = NULL, failed_login_attempts = 0 WHERE id = $1',
      [id]
    );

    await createAuditLog({
      entityType: 'user',
      entityId: id,
      action: 'USER_UNLOCK',
      performedBy: adminUser.id,
      previousValue: { email: targetUser.email },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.json({
      success: true,
      message: 'User account unlocked'
    });
  } catch (error) {
    console.error('[USERS] Unlock error:', error);
    res.status(500).json({
      error: 'UNLOCK_ERROR',
      message: 'Failed to unlock user'
    });
  }
});

/**
 * PUT /api/users/:id/roles
 * Update user role (admin only)
 */
router.put('/:id/roles', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminUser = req.user!;

    if (!role || !['admin', 'manager', 'operator'].includes(role)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Valid role is required: admin, manager, or operator'
      });
      return;
    }

    // Get target user
    const targetResult = await pool.query(
      'SELECT id, email, role as current_role FROM users WHERE id = $1',
      [id]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const targetUser = targetResult.rows[0];

    // Cannot change own role
    if (id === adminUser.id) {
      res.status(400).json({
        error: 'INVALID_OPERATION',
        message: 'Cannot change your own role'
      });
      return;
    }

    // Update the role
    await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [role, id]
    );

    await createAuditLog({
      entityType: 'user',
      entityId: id,
      action: 'USER_ROLE_CHANGE',
      performedBy: adminUser.id,
      previousValue: { role: targetUser.current_role },
      newValue: { role },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.json({
      success: true,
      message: 'User role updated',
      previous_role: targetUser.current_role,
      new_role: role
    });
  } catch (error) {
    console.error('[USERS] Update role error:', error);
    res.status(500).json({
      error: 'ROLE_UPDATE_ERROR',
      message: 'Failed to update user role'
    });
  }
});

/**
 * PUT /api/users/:id/deactivate
 * Deactivate a user (soft delete - admin/manager only)
 */
router.put('/:id/deactivate', authenticate, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminUser = req.user!;

    // Get target user
    const targetResult = await pool.query(
      'SELECT id, organization_id, email, role FROM users WHERE id = $1',
      [id]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const targetUser = targetResult.rows[0];

    // Manager can only affect users in their organization
    if (adminUser.role === 'manager' && targetUser.organization_id !== adminUser.organization_id) {
      res.status(403).json({
        error: 'ORGANIZATION_MISMATCH',
        message: 'Can only manage users in your organization'
      });
      return;
    }

    // Cannot deactivate own account
    if (id === adminUser.id) {
      res.status(400).json({
        error: 'INVALID_OPERATION',
        message: 'Cannot deactivate your own account'
      });
      return;
    }

    // Cannot deactivate admin accounts unless you are admin
    if (targetUser.role === 'admin' && adminUser.role !== 'admin') {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Only admin can deactivate other admin accounts'
      });
      return;
    }

    await pool.query(
      'UPDATE users SET is_active = FALSE WHERE id = $1',
      [id]
    );

    await createAuditLog({
      entityType: 'user',
      entityId: id,
      action: 'USER_DEACTIVATE',
      performedBy: adminUser.id,
      previousValue: { email: targetUser.email, is_active: true },
      newValue: { is_active: false },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.json({
      success: true,
      message: 'User deactivated'
    });
  } catch (error) {
    console.error('[USERS] Deactivate error:', error);
    res.status(500).json({
      error: 'DEACTIVATE_ERROR',
      message: 'Failed to deactivate user'
    });
  }
});

/**
 * PUT /api/users/:id/reactivate
 * Reactivate a user (admin/manager only)
 */
router.put('/:id/reactivate', authenticate, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminUser = req.user!;

    // Get target user
    const targetResult = await pool.query(
      'SELECT id, organization_id, email FROM users WHERE id = $1',
      [id]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const targetUser = targetResult.rows[0];

    // Manager can only affect users in their organization
    if (adminUser.role === 'manager' && targetUser.organization_id !== adminUser.organization_id) {
      res.status(403).json({
        error: 'ORGANIZATION_MISMATCH',
        message: 'Can only manage users in your organization'
      });
      return;
    }

    await pool.query(
      'UPDATE users SET is_active = TRUE WHERE id = $1',
      [id]
    );

    await createAuditLog({
      entityType: 'user',
      entityId: id,
      action: 'USER_REACTIVATE',
      performedBy: adminUser.id,
      previousValue: { email: targetUser.email, is_active: false },
      newValue: { is_active: true },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.json({
      success: true,
      message: 'User reactivated'
    });
  } catch (error) {
    console.error('[USERS] Reactivate error:', error);
    res.status(500).json({
      error: 'REACTIVATE_ERROR',
      message: 'Failed to reactivate user'
    });
  }
});

export default router;
