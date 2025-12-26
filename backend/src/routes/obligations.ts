// ============================================
// OBLIGATIONS ROUTES
// ============================================
// ENFORCEMENT RULES:
// 1. Obligation cannot be deleted after creation
// 2. Obligation must have exactly ONE owner
// 3. Obligation must have an SLA
// 4. All changes must be audit logged

import { Router, Response } from 'express';
import { pool } from '../config/database';
import { createAuditLog, AuditActions, getAuditLogsForEntity } from '../services/auditService';
import { authenticate } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

/**
 * POST /api/obligations
 * Create a new obligation with owner and SLA (atomic operation)
 * 
 * ENFORCEMENT: Blocks if owner or SLA is missing
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  
  try {
    const { title, description, regulationTag, ownerId, slaDueDate } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // ============================================
    // ENFORCEMENT: Validate required fields
    // ============================================
    const errors: string[] = [];
    
    if (!title || title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (!ownerId) {
      errors.push('Owner is required. Every obligation must have exactly ONE owner.');
    }
    
    if (!slaDueDate) {
      errors.push('SLA due date is required. Every obligation must have a fixed SLA.');
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'Cannot create obligation: missing required fields',
        violations: errors
      });
      return;
    }

    // Validate SLA is in the future
    const dueDate = new Date(slaDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate <= today) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'SLA due date must be in the future'
      });
      return;
    }

    // Verify owner exists and belongs to same organization
    const ownerCheck = await pool.query(
      'SELECT id, name FROM users WHERE id = $1 AND organization_id = $2',
      [ownerId, organizationId]
    );
    
    if (ownerCheck.rows.length === 0) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'Owner must be a valid user in your organization'
      });
      return;
    }

    await client.query('BEGIN');

    // Create obligation
    const obligationResult = await client.query(
      `INSERT INTO obligations (title, description, regulation_tag, organization_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description, regulationTag, organizationId, userId]
    );
    const obligation = obligationResult.rows[0];

    // Create initial owner record
    const ownerResult = await client.query(
      `INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [obligation.id, ownerId, userId]
    );

    // Create initial SLA record
    const slaResult = await client.query(
      `INSERT INTO slas (obligation_id, due_date, created_by, is_current)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [obligation.id, slaDueDate, userId]
    );

    // Create audit logs (ALL actions must generate audit logs)
    await createAuditLog({
      entityType: 'obligation',
      entityId: obligation.id,
      action: AuditActions.OBLIGATION_CREATE,
      performedBy: userId,
      newValue: {
        title: obligation.title,
        description: obligation.description,
        regulationTag: obligation.regulation_tag,
        status: obligation.status
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    await createAuditLog({
      entityType: 'obligation_owner',
      entityId: ownerResult.rows[0].id,
      action: AuditActions.OWNER_ASSIGN,
      performedBy: userId,
      newValue: {
        obligationId: obligation.id,
        ownerId: ownerId,
        ownerName: ownerCheck.rows[0].name
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    await createAuditLog({
      entityType: 'sla',
      entityId: slaResult.rows[0].id,
      action: AuditActions.SLA_CREATE,
      performedBy: userId,
      newValue: {
        obligationId: obligation.id,
        dueDate: slaDueDate
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Obligation created successfully',
      obligation: {
        ...obligation,
        owner: ownerCheck.rows[0],
        sla: slaResult.rows[0]
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[OBLIGATIONS] Create error:', error);
    
    // Check if it's a database enforcement violation
    if (error.message?.includes('ENFORCEMENT VIOLATION')) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'CREATE_ERROR',
      message: 'Failed to create obligation'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/obligations
 * List all obligations for the organization
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user!.organization_id;
    const { status, ownerId } = req.query;

    let query = `
      SELECT 
        o.*,
        s.due_date as sla_due_date,
        s.id as current_sla_id,
        oo.user_id as owner_id,
        u.name as owner_name,
        creator.name as created_by_name,
        (s.due_date - CURRENT_DATE) as days_remaining,
        CASE 
          WHEN o.status = 'breached' THEN 'RED'
          WHEN o.status = 'closed' THEN 'CLOSED'
          WHEN s.due_date < CURRENT_DATE THEN 'RED'
          WHEN (s.due_date - CURRENT_DATE) <= 15 THEN 'AMBER'
          ELSE 'GREEN'
        END as risk_status,
        (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id) as evidence_count
      FROM obligations o
      LEFT JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
      LEFT JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
      LEFT JOIN users u ON oo.user_id = u.id
      LEFT JOIN users creator ON o.created_by = creator.id
      WHERE o.organization_id = $1
    `;

    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (ownerId) {
      query += ` AND oo.user_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    query += ' ORDER BY s.due_date ASC NULLS LAST, o.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      obligations: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('[OBLIGATIONS] List error:', error);
    res.status(500).json({
      error: 'LIST_ERROR',
      message: 'Failed to list obligations'
    });
  }
});

/**
 * GET /api/obligations/:id
 * Get obligation detail with full history
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organization_id;

    // Get obligation
    const obligationResult = await pool.query(
      `SELECT o.*, creator.name as created_by_name
       FROM obligations o
       JOIN users creator ON o.created_by = creator.id
       WHERE o.id = $1 AND o.organization_id = $2`,
      [id, organizationId]
    );

    if (obligationResult.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
      return;
    }

    const obligation = obligationResult.rows[0];

    // Get owner history (append-only, shows all owners)
    const ownerHistoryResult = await pool.query(
      `SELECT oo.*, u.name as owner_name, u.email as owner_email,
              assigner.name as assigned_by_name
       FROM obligation_owners oo
       JOIN users u ON oo.user_id = u.id
       JOIN users assigner ON oo.assigned_by = assigner.id
       WHERE oo.obligation_id = $1
       ORDER BY oo.assigned_at DESC`,
      [id]
    );

    // Get SLA history (append-only, shows all SLAs)
    const slaHistoryResult = await pool.query(
      `SELECT s.*, creator.name as created_by_name
       FROM slas s
       JOIN users creator ON s.created_by = creator.id
       WHERE s.obligation_id = $1
       ORDER BY s.created_at DESC`,
      [id]
    );

    // Get evidence list
    const evidenceResult = await pool.query(
      `SELECT e.*, uploader.name as uploaded_by_name
       FROM evidence e
       JOIN users uploader ON e.uploaded_by = uploader.id
       WHERE e.obligation_id = $1
       ORDER BY e.uploaded_at DESC`,
      [id]
    );

    // Get audit timeline
    const auditLogs = await getAuditLogsForEntity('obligation', id);

    // Also get related audit logs (owners, SLAs, evidence)
    const ownerIds = ownerHistoryResult.rows.map(o => o.id);
    const slaIds = slaHistoryResult.rows.map(s => s.id);
    const evidenceIds = evidenceResult.rows.map(e => e.id);

    const relatedAuditQuery = `
      SELECT al.*, u.name as performed_by_name
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE (al.entity_type = 'obligation_owner' AND al.entity_id = ANY($1))
         OR (al.entity_type = 'sla' AND al.entity_id = ANY($2))
         OR (al.entity_type = 'evidence' AND al.entity_id = ANY($3))
      ORDER BY al.timestamp DESC
    `;
    
    const relatedAuditResult = await pool.query(relatedAuditQuery, [
      ownerIds,
      slaIds,
      evidenceIds
    ]);

    // Combine and sort all audit logs
    const allAuditLogs = [...auditLogs, ...relatedAuditResult.rows]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate risk status
    const currentSla = slaHistoryResult.rows.find(s => s.is_current);
    const daysRemaining = currentSla 
      ? Math.ceil((new Date(currentSla.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let riskStatus = 'UNKNOWN';
    if (obligation.status === 'breached') {
      riskStatus = 'RED';
    } else if (obligation.status === 'closed') {
      riskStatus = 'CLOSED';
    } else if (daysRemaining !== null) {
      if (daysRemaining < 0) {
        riskStatus = 'RED';
      } else if (daysRemaining <= 15) {
        riskStatus = 'AMBER';
      } else {
        riskStatus = 'GREEN';
      }
    }

    res.json({
      obligation: {
        ...obligation,
        daysRemaining,
        riskStatus
      },
      ownerHistory: ownerHistoryResult.rows,
      currentOwner: ownerHistoryResult.rows.find(o => o.is_current),
      slaHistory: slaHistoryResult.rows,
      currentSla,
      evidence: evidenceResult.rows,
      auditTimeline: allAuditLogs
    });
  } catch (error) {
    console.error('[OBLIGATIONS] Get detail error:', error);
    res.status(500).json({
      error: 'GET_ERROR',
      message: 'Failed to get obligation details'
    });
  }
});

/**
 * PATCH /api/obligations/:id/status
 * Update obligation status (open -> closed OR open -> breached)
 */
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // Validate status
    if (!['closed', 'breached'].includes(status)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Status can only be changed to "closed" or "breached"'
      });
      return;
    }

    await client.query('BEGIN');

    // Get current obligation
    const currentResult = await client.query(
      'SELECT * FROM obligations WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
      return;
    }

    const current = currentResult.rows[0];

    if (current.status !== 'open') {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: `Cannot change status from "${current.status}". Only open obligations can be closed or marked breached.`
      });
      return;
    }

    // Update status
    const updateResult = await client.query(
      `UPDATE obligations 
       SET status = $1, closed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    // Create audit log
    await createAuditLog({
      entityType: 'obligation',
      entityId: id,
      action: AuditActions.OBLIGATION_STATUS_CHANGE,
      performedBy: userId,
      previousValue: { status: current.status },
      newValue: { status: status },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    await client.query('COMMIT');

    res.json({
      message: `Obligation ${status === 'closed' ? 'closed' : 'marked as breached'} successfully`,
      obligation: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[OBLIGATIONS] Status update error:', error);
    res.status(500).json({
      error: 'UPDATE_ERROR',
      message: 'Failed to update obligation status'
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/obligations/:id/reassign
 * Reassign obligation owner (append-only)
 */
router.post('/:id/reassign', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { newOwnerId, reason } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // ENFORCEMENT: Reason is required
    if (!reason || reason.trim().length === 0) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'Reassignment reason is required for audit trail'
      });
      return;
    }

    if (!newOwnerId) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'New owner is required'
      });
      return;
    }

    // Verify new owner exists in same organization
    const ownerCheck = await pool.query(
      'SELECT id, name FROM users WHERE id = $1 AND organization_id = $2',
      [newOwnerId, organizationId]
    );

    if (ownerCheck.rows.length === 0) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'New owner must be a valid user in your organization'
      });
      return;
    }

    await client.query('BEGIN');

    // Verify obligation exists
    const obligationCheck = await client.query(
      'SELECT id FROM obligations WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (obligationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
      return;
    }

    // Get current owner
    const currentOwnerResult = await client.query(
      `SELECT oo.*, u.name as owner_name 
       FROM obligation_owners oo
       JOIN users u ON oo.user_id = u.id
       WHERE oo.obligation_id = $1 AND oo.is_current = true`,
      [id]
    );

    const previousOwner = currentOwnerResult.rows[0];

    // Mark current owner as not current
    await client.query(
      'UPDATE obligation_owners SET is_current = false WHERE obligation_id = $1 AND is_current = true',
      [id]
    );

    // Create new owner record (append-only)
    const newOwnerResult = await client.query(
      `INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current, reassignment_reason)
       VALUES ($1, $2, $3, true, $4)
       RETURNING *`,
      [id, newOwnerId, userId, reason.trim()]
    );

    // Create audit log
    await createAuditLog({
      entityType: 'obligation_owner',
      entityId: newOwnerResult.rows[0].id,
      action: AuditActions.OWNER_REASSIGN,
      performedBy: userId,
      previousValue: previousOwner ? {
        ownerId: previousOwner.user_id,
        ownerName: previousOwner.owner_name
      } : null,
      newValue: {
        ownerId: newOwnerId,
        ownerName: ownerCheck.rows[0].name,
        reason: reason.trim()
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    await client.query('COMMIT');

    res.json({
      message: 'Owner reassigned successfully',
      previousOwner: previousOwner ? {
        id: previousOwner.user_id,
        name: previousOwner.owner_name
      } : null,
      newOwner: {
        id: newOwnerId,
        name: ownerCheck.rows[0].name
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[OBLIGATIONS] Reassign error:', error);
    
    if (error.message?.includes('ENFORCEMENT VIOLATION')) {
      res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      error: 'REASSIGN_ERROR',
      message: 'Failed to reassign owner'
    });
  } finally {
    client.release();
  }
});

export default router;
