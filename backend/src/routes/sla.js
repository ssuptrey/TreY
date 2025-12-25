// ============================================
// SLA ROUTES
// ============================================
// ENFORCEMENT RULES:
// 1. SLA cannot be edited once created
// 2. SLA can only be extended by creating NEW SLA record with reason
// 3. Old SLA remains visible (append-only)

const express = require('express');
const { pool } = require('../config/database');
const { createAuditLog, AuditActions } = require('../services/auditService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/sla/:obligationId/extend
 * Extend SLA by creating a new record (old SLA remains visible)
 * 
 * ENFORCEMENT: 
 * - Extension reason is required
 * - New due date must be after current due date
 */
router.post('/:obligationId/extend', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { obligationId } = req.params;
    const { newDueDate, reason } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // ============================================
    // ENFORCEMENT: Validate required fields
    // ============================================
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'Extension reason is required for audit trail'
      });
    }

    if (!newDueDate) {
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'New due date is required'
      });
    }

    await client.query('BEGIN');

    // Verify obligation exists and belongs to organization
    const obligationCheck = await client.query(
      'SELECT id, status FROM obligations WHERE id = $1 AND organization_id = $2',
      [obligationId, organizationId]
    );

    if (obligationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    if (obligationCheck.rows[0].status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'Cannot extend SLA for closed or breached obligations'
      });
    }

    // Get current SLA
    const currentSlaResult = await client.query(
      'SELECT * FROM slas WHERE obligation_id = $1 AND is_current = true',
      [obligationId]
    );

    if (currentSlaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'No current SLA found for this obligation'
      });
    }

    const currentSla = currentSlaResult.rows[0];
    const currentDueDate = new Date(currentSla.due_date);
    const newDueDateObj = new Date(newDueDate);

    // ENFORCEMENT: New due date must be after current due date
    if (newDueDateObj <= currentDueDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'New due date must be after current due date. SLA can only be extended, not shortened.'
      });
    }

    // Mark current SLA as not current
    await client.query(
      'UPDATE slas SET is_current = false WHERE id = $1',
      [currentSla.id]
    );

    // Create new SLA record (append-only)
    const newSlaResult = await client.query(
      `INSERT INTO slas (obligation_id, due_date, created_by, is_current, extension_reason, previous_sla_id)
       VALUES ($1, $2, $3, true, $4, $5)
       RETURNING *`,
      [obligationId, newDueDate, userId, reason.trim(), currentSla.id]
    );

    const newSla = newSlaResult.rows[0];

    // Create audit log
    await createAuditLog({
      entityType: 'sla',
      entityId: newSla.id,
      action: AuditActions.SLA_EXTEND,
      performedBy: userId,
      previousValue: {
        slaId: currentSla.id,
        dueDate: currentSla.due_date
      },
      newValue: {
        slaId: newSla.id,
        dueDate: newDueDate,
        reason: reason.trim()
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    await client.query('COMMIT');

    res.json({
      message: 'SLA extended successfully',
      previousSla: {
        id: currentSla.id,
        dueDate: currentSla.due_date
      },
      newSla: {
        id: newSla.id,
        dueDate: newSla.due_date,
        reason: newSla.extension_reason
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SLA] Extend error:', error);
    
    if (error.message.includes('ENFORCEMENT VIOLATION')) {
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'EXTEND_ERROR',
      message: 'Failed to extend SLA'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/sla/:obligationId/history
 * Get full SLA history for an obligation
 */
router.get('/:obligationId/history', authenticate, async (req, res) => {
  try {
    const { obligationId } = req.params;
    const organizationId = req.user.organization_id;

    // Verify obligation exists and belongs to organization
    const obligationCheck = await pool.query(
      'SELECT id FROM obligations WHERE id = $1 AND organization_id = $2',
      [obligationId, organizationId]
    );

    if (obligationCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    // Get all SLA records (shows full history)
    const slaHistory = await pool.query(
      `SELECT s.*, creator.name as created_by_name
       FROM slas s
       JOIN users creator ON s.created_by = creator.id
       WHERE s.obligation_id = $1
       ORDER BY s.created_at DESC`,
      [obligationId]
    );

    res.json({
      slaHistory: slaHistory.rows,
      currentSla: slaHistory.rows.find(s => s.is_current)
    });
  } catch (error) {
    console.error('[SLA] History error:', error);
    res.status(500).json({
      error: 'HISTORY_ERROR',
      message: 'Failed to get SLA history'
    });
  }
});

/**
 * GET /api/sla/dashboard
 * Get SLA risk dashboard data
 */
router.get('/dashboard/risk', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const dashboardQuery = `
      SELECT 
        o.id,
        o.title,
        o.status,
        o.regulation_tag,
        s.due_date,
        (s.due_date - CURRENT_DATE) as days_remaining,
        CASE 
          WHEN o.status = 'breached' THEN 'RED'
          WHEN o.status = 'closed' THEN 'CLOSED'
          WHEN s.due_date < CURRENT_DATE THEN 'RED'
          WHEN (s.due_date - CURRENT_DATE) <= 15 THEN 'AMBER'
          ELSE 'GREEN'
        END as risk_status,
        owner_user.id as owner_id,
        owner_user.name as owner_name,
        (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id) as evidence_count,
        (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id AND e.is_late = true) as late_evidence_count
      FROM obligations o
      LEFT JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
      LEFT JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
      LEFT JOIN users owner_user ON oo.user_id = owner_user.id
      WHERE o.organization_id = $1
      ORDER BY 
        CASE 
          WHEN o.status = 'breached' THEN 0
          WHEN s.due_date < CURRENT_DATE THEN 1
          WHEN (s.due_date - CURRENT_DATE) <= 15 THEN 2
          ELSE 3
        END,
        s.due_date ASC NULLS LAST
    `;

    const result = await pool.query(dashboardQuery, [organizationId]);

    // Calculate summary
    const summary = {
      total: result.rows.length,
      green: result.rows.filter(r => r.risk_status === 'GREEN').length,
      amber: result.rows.filter(r => r.risk_status === 'AMBER').length,
      red: result.rows.filter(r => r.risk_status === 'RED').length,
      closed: result.rows.filter(r => r.risk_status === 'CLOSED').length
    };

    res.json({
      summary,
      obligations: result.rows
    });
  } catch (error) {
    console.error('[SLA] Dashboard error:', error);
    res.status(500).json({
      error: 'DASHBOARD_ERROR',
      message: 'Failed to get dashboard data'
    });
  }
});

module.exports = router;
