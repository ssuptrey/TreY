// ============================================
// ORGANIZATION ROUTES
// ============================================
import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, requireRole } from '../middlewares/auth';
import { createAuditLog } from '../services/auditService';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

/**
 * POST /api/organizations
 * Create a new organization (admin only)
 */
router.post('/', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, type } = req.body;
    const userId = req.user?.id;

    if (!name || !type) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Name and type are required'
      });
      return;
    }

    const result = await pool.query(
      'INSERT INTO organizations (name, type) VALUES ($1, $2) RETURNING *',
      [name, type]
    );

    const organization = result.rows[0];

    // Audit log
    await createAuditLog({
      entityType: 'organization',
      entityId: organization.id,
      action: 'ORGANIZATION_CREATE',
      performedBy: userId!,
      newValue: { name, type }
    });

    res.status(201).json({
      success: true,
      data: organization,
      message: 'Organization created successfully'
    });
  } catch (error) {
    console.error('[ORGANIZATIONS] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to create organization'
    });
  }
});

/**
 * GET /api/organizations
 * List all organizations (admin only)
 */
router.get('/', authenticate, requireRole('admin'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT o.*, 
        (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) as user_count,
        (SELECT COUNT(*) FROM obligations ob WHERE ob.organization_id = o.id) as obligation_count
       FROM organizations o
       ORDER BY o.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[ORGANIZATIONS] List error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to list organizations'
    });
  }
});

/**
 * GET /api/organizations/:id
 * Get organization details
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT o.*, 
        (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) as user_count,
        (SELECT COUNT(*) FROM obligations ob WHERE ob.organization_id = o.id) as obligation_count
       FROM organizations o
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Organization not found'
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[ORGANIZATIONS] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to get organization'
    });
  }
});

export default router;
