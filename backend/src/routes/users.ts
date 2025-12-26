// ============================================
// USERS ROUTES
// ============================================

import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, requireRole } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

/**
 * GET /api/users
 * List all users in the organization
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user!.organization_id;

    const result = await pool.query(
      `SELECT id, email, name, role, is_active, created_at
       FROM users
       WHERE organization_id = $1
       ORDER BY name`,
      [organizationId]
    );

    res.json({
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
      `SELECT id, email, name, role, is_active, created_at
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

export default router;
