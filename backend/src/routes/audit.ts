// ============================================
// AUDIT ROUTES
// ============================================
import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, requireRole } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

/**
 * GET /api/audit/logs
 * Get audit logs with filtering and pagination
 */
router.get('/logs', authenticate, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { 
      entity_type, 
      entity_id, 
      action, 
      performed_by,
      start_date,
      end_date,
      limit = '100',
      offset = '0'
    } = req.query;

    let query = `
      SELECT 
        al.*,
        u.name as performed_by_name,
        u.email as performed_by_email
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by organization for non-admin users
    if (req.user?.role !== 'admin') {
      query += ` AND u.organization_id = $${paramIndex}`;
      params.push(req.user?.organizationId);
      paramIndex++;
    }

    if (entity_type) {
      query += ` AND al.entity_type = $${paramIndex}`;
      params.push(entity_type);
      paramIndex++;
    }

    if (entity_id) {
      query += ` AND al.entity_id = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }

    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (performed_by) {
      query += ` AND al.performed_by = $${paramIndex}`;
      params.push(performed_by);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND al.timestamp >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND al.timestamp <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ` ORDER BY al.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) 
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (req.user?.role !== 'admin') {
      countQuery += ` AND u.organization_id = $${countParamIndex}`;
      countParams.push(req.user?.organizationId);
      countParamIndex++;
    }

    if (entity_type) {
      countQuery += ` AND al.entity_type = $${countParamIndex}`;
      countParams.push(entity_type);
      countParamIndex++;
    }

    if (entity_id) {
      countQuery += ` AND al.entity_id = $${countParamIndex}`;
      countParams.push(entity_id);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count, 10),
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  } catch (error) {
    console.error('[AUDIT] Get logs error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to get audit logs'
    });
  }
});

/**
 * GET /api/audit/export
 * Export audit logs as CSV
 */
router.get('/export', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { start_date, end_date, entity_type } = req.query;

    let query = `
      SELECT 
        al.id,
        al.entity_type,
        al.entity_id,
        al.action,
        u.name as performed_by_name,
        u.email as performed_by_email,
        al.timestamp,
        al.previous_value,
        al.new_value,
        al.ip_address
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND al.timestamp >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND al.timestamp <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (entity_type) {
      query += ` AND al.entity_type = $${paramIndex}`;
      params.push(entity_type);
      paramIndex++;
    }

    query += ` ORDER BY al.timestamp DESC`;

    const result = await pool.query(query, params);

    // Generate CSV
    const headers = ['ID', 'Entity Type', 'Entity ID', 'Action', 'Performed By', 'Email', 'Timestamp', 'Previous Value', 'New Value', 'IP Address'];
    const rows = result.rows.map(row => [
      row.id,
      row.entity_type,
      row.entity_id,
      row.action,
      row.performed_by_name,
      row.performed_by_email,
      row.timestamp,
      JSON.stringify(row.previous_value || {}),
      JSON.stringify(row.new_value || {}),
      row.ip_address || ''
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('[AUDIT] Export error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to export audit logs'
    });
  }
});

/**
 * GET /api/audit/entity/:entityType/:entityId
 * Get audit logs for a specific entity
 */
router.get('/entity/:entityType/:entityId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { entityType, entityId } = req.params;

    const result = await pool.query(
      `SELECT 
        al.*,
        u.name as performed_by_name
       FROM audit_logs al
       JOIN users u ON al.performed_by = u.id
       WHERE al.entity_type = $1 AND al.entity_id = $2
       ORDER BY al.timestamp DESC`,
      [entityType, entityId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[AUDIT] Get entity logs error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to get entity audit logs'
    });
  }
});

export default router;
