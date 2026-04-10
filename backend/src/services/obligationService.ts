import { pool } from '../config/database';
import { createAuditLog, AuditActions, getAuditLogsForEntity } from './auditService';

export class ObligationService {
  async create(data: any): Promise<any> {
    const { title, description, regulationTag, ownerId, slaDueDate, organizationId, userId, ipAddress, userAgent } = data;

    const errors: string[] = [];
    if (!title || title.trim().length === 0) errors.push('Title is required');
    if (!ownerId) errors.push('Owner is required. Every obligation must have exactly ONE owner.');
    if (!slaDueDate) errors.push('SLA due date is required. Every obligation must have a fixed SLA.');

    if (errors.length > 0) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Cannot create obligation: missing required fields', violations: errors };

    const dueDate = new Date(slaDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate <= today) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'SLA due date must be in the future' };

    const ownerCheck = await pool.query('SELECT id, name FROM users WHERE id = $1 AND organization_id = $2', [ownerId, organizationId]);
    if (ownerCheck.rows.length === 0) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Owner must be a valid user in your organization' };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const obligationResult = await client.query(
        `INSERT INTO obligations (title, description, regulation_tag, organization_id, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title.trim(), description, regulationTag, organizationId, userId]
      );
      const obligation = obligationResult.rows[0];

      const ownerResult = await client.query(
        `INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current)
         VALUES ($1, $2, $3, true) RETURNING *`,
        [obligation.id, ownerId, userId]
      );

      const slaResult = await client.query(
        `INSERT INTO slas (obligation_id, due_date, created_by, is_current)
         VALUES ($1, $2, $3, true) RETURNING *`,
        [obligation.id, slaDueDate, userId]
      );

      await createAuditLog({
        entityType: 'obligation', entityId: obligation.id, action: AuditActions.OBLIGATION_CREATE,
        performedBy: userId, newValue: { title: obligation.title, description: obligation.description, regulationTag: obligation.regulation_tag, status: obligation.status },
        ipAddress, userAgent
      });

      await createAuditLog({
        entityType: 'obligation_owner', entityId: ownerResult.rows[0].id, action: AuditActions.OWNER_ASSIGN,
        performedBy: userId, newValue: { obligationId: obligation.id, ownerId: ownerId, ownerName: ownerCheck.rows[0].name },
        ipAddress, userAgent
      });

      await createAuditLog({
        entityType: 'sla', entityId: slaResult.rows[0].id, action: AuditActions.SLA_CREATE,
        performedBy: userId, newValue: { obligationId: obligation.id, dueDate: slaDueDate },
        ipAddress, userAgent
      });

      await client.query('COMMIT');
      return { success: true, obligation: { ...obligation, owner: ownerCheck.rows[0], sla: slaResult.rows[0] } };
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.message?.includes('ENFORCEMENT VIOLATION')) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: error.message };
      throw error;
    } finally {
      client.release();
    }
  }

  async list(organizationId: string, status?: string, ownerId?: string): Promise<any[]> {
    let query = `
      SELECT o.*, s.due_date as sla_due_date, s.id as current_sla_id, oo.user_id as owner_id,
             u.name as owner_name, creator.name as created_by_name,
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

    if (status) { query += ` AND o.status = $${paramIndex}`; params.push(status); paramIndex++; }
    if (ownerId) { query += ` AND oo.user_id = $${paramIndex}`; params.push(ownerId); paramIndex++; }

    query += ' ORDER BY s.due_date ASC NULLS LAST, o.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getDetails(id: string, organizationId: string): Promise<any> {
    const obligationResult = await pool.query(
      `SELECT o.*, creator.name as created_by_name, cc.code as category_code, cc.name as category_name, cc.department as category_department, cc.priority as category_priority, cc.regulation_reference
       FROM obligations o
       JOIN users creator ON o.created_by = creator.id
       LEFT JOIN complaint_categories cc ON cc.id = o.category_id
       WHERE o.id = $1 AND o.organization_id = $2`,
      [id, organizationId]
    );

    if (obligationResult.rows.length === 0) return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' };

    const obligation = obligationResult.rows[0];
    const ownerHistoryResult = await pool.query(
      `SELECT oo.*, u.name as owner_name, u.email as owner_email, assigner.name as assigned_by_name
       FROM obligation_owners oo
       JOIN users u ON oo.user_id = u.id
       JOIN users assigner ON oo.assigned_by = assigner.id
       WHERE oo.obligation_id = $1 ORDER BY oo.assigned_at DESC`,
      [id]
    );

    const slaHistoryResult = await pool.query(
      `SELECT s.*, creator.name as created_by_name FROM slas s
       JOIN users creator ON s.created_by = creator.id
       WHERE s.obligation_id = $1 ORDER BY s.created_at DESC`,
      [id]
    );

    const evidenceResult = await pool.query(
      `SELECT e.*, uploader.name as uploaded_by_name FROM evidence e
       JOIN users uploader ON e.uploaded_by = uploader.id
       WHERE e.obligation_id = $1 ORDER BY e.uploaded_at DESC`,
      [id]
    );

    const auditLogs = await getAuditLogsForEntity('obligation', id);
    const ownerIds = ownerHistoryResult.rows.map(o => o.id);
    const slaIds = slaHistoryResult.rows.map(s => s.id);
    const evidenceIds = evidenceResult.rows.map(e => e.id);

    const relatedAuditQuery = `
      SELECT al.*, u.name as performed_by_name FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE (al.entity_type = 'obligation_owner' AND al.entity_id = ANY($1))
         OR (al.entity_type = 'sla' AND al.entity_id = ANY($2))
         OR (al.entity_type = 'evidence' AND al.entity_id = ANY($3))
      ORDER BY al.timestamp DESC
    `;
    const relatedAuditResult = await pool.query(relatedAuditQuery, [ownerIds, slaIds, evidenceIds]);
    const allAuditLogs = [...auditLogs, ...relatedAuditResult.rows].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const currentSla = slaHistoryResult.rows.find(s => s.is_current);
    const daysRemaining = currentSla ? Math.ceil((new Date(currentSla.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

    let riskStatus = 'UNKNOWN';
    if (obligation.status === 'breached') riskStatus = 'RED';
    else if (obligation.status === 'closed') riskStatus = 'CLOSED';
    else if (daysRemaining !== null) {
      if (daysRemaining < 0) riskStatus = 'RED';
      else if (daysRemaining <= 15) riskStatus = 'AMBER';
      else riskStatus = 'GREEN';
    }

    return {
      success: true,
      data: {
        obligation: { ...obligation, daysRemaining, riskStatus },
        ownerHistory: ownerHistoryResult.rows,
        currentOwner: ownerHistoryResult.rows.find(o => o.is_current),
        slaHistory: slaHistoryResult.rows,
        currentSla, evidence: evidenceResult.rows, auditTimeline: allAuditLogs
      }
    };
  }

  async updateStatus(id: string, organizationId: string, status: string, userId: string, ipAddress?: string, userAgent?: string): Promise<any> {
    if (!['closed', 'breached'].includes(status)) return { success: false, error: 'VALIDATION_ERROR', message: 'Status can only be changed to "closed" or "breached"' };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query('SELECT * FROM obligations WHERE id = $1 AND organization_id = $2', [id, organizationId]);
      if (currentResult.rows.length === 0) { await client.query('ROLLBACK'); return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' }; }

      const current = currentResult.rows[0];
      if (current.status !== 'open') { await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: `Cannot change status from "${current.status}". Only open obligations can be closed or marked breached.` }; }

      const updateResult = await client.query(
        `UPDATE obligations SET status = $1, closed_at = NOW() WHERE id = $2 RETURNING *`,
        [status, id]
      );

      await createAuditLog({
        entityType: 'obligation', entityId: id, action: AuditActions.OBLIGATION_STATUS_CHANGE,
        performedBy: userId, previousValue: { status: current.status }, newValue: { status: status },
        ipAddress, userAgent
      });

      await client.query('COMMIT');
      return { success: true, obligation: updateResult.rows[0], message: `Obligation ${status === 'closed' ? 'closed' : 'marked as breached'} successfully` };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async reassignOwner(id: string, organizationId: string, newOwnerId: string, reason: string, userId: string, ipAddress?: string, userAgent?: string): Promise<any> {
    if (!reason || reason.trim().length === 0) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Reassignment reason is required for audit trail' };
    if (!newOwnerId) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'New owner is required' };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const obligationCheck = await pool.query('SELECT id, status FROM obligations WHERE id = $1 AND organization_id = $2', [id, organizationId]);
      if (obligationCheck.rows.length === 0) { await client.query('ROLLBACK'); return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' }; }

      const obligation = obligationCheck.rows[0];
      if (obligation.status === 'closed') { await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Cannot reassign a closed obligation' }; }

      const userCheck = await pool.query('SELECT id, name FROM users WHERE id = $1 AND organization_id = $2', [newOwnerId, organizationId]);
      if (userCheck.rows.length === 0) { await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'New owner must be a valid user in your organization' }; }

      const currentOwnerResult = await client.query('SELECT user_id FROM obligation_owners WHERE obligation_id = $1 AND is_current = true', [id]);
      if (currentOwnerResult.rows.length > 0 && currentOwnerResult.rows[0].user_id === newOwnerId) {
        await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'User is already the current owner of this obligation' };
      }

      await client.query('UPDATE obligation_owners SET is_current = false, ended_at = NOW() WHERE obligation_id = $1 AND is_current = true', [id]);

      const ownerResult = await client.query(
        `INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current) VALUES ($1, $2, $3, true) RETURNING *`,
        [id, newOwnerId, userId]
      );

      await createAuditLog({
        entityType: 'obligation_owner', entityId: ownerResult.rows[0].id, action: AuditActions.OWNER_REASSIGN,
        performedBy: userId, newValue: { obligationId: id, ownerId: newOwnerId, reason: reason },
        ipAddress, userAgent
      });

      await client.query('COMMIT');
      return { success: true, owner: ownerResult.rows[0], message: 'Obligation reassigned successfully' };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
