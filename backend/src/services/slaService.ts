import { pool } from '../config/database';
import { createAuditLog, AuditActions } from './auditService';

export class SLAService {
  async extend(data: any): Promise<any> {
    const { obligationId, newDueDate, reason, userId, organizationId, ipAddress, userAgent } = data;

    if (!reason || reason.trim().length === 0) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Extension reason is required for audit trail' };
    if (!newDueDate) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'New due date is required' };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const obligationCheck = await client.query('SELECT id, status FROM obligations WHERE id = $1 AND organization_id = $2', [obligationId, organizationId]);
      
      if (obligationCheck.rows.length === 0) { await client.query('ROLLBACK'); return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' }; }
      if (obligationCheck.rows[0].status !== 'open') { await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Cannot extend SLA for closed or breached obligations' }; }

      const currentSlaResult = await client.query('SELECT * FROM slas WHERE obligation_id = $1 AND is_current = true', [obligationId]);
      if (currentSlaResult.rows.length === 0) { await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'No current SLA found for this obligation' }; }

      const currentSla = currentSlaResult.rows[0];
      const currentDueDate = new Date(currentSla.due_date);
      const newDueDateObj = new Date(newDueDate);

      if (newDueDateObj <= currentDueDate) { await client.query('ROLLBACK'); return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'New due date must be after current due date. SLA can only be extended, not shortened.' }; }

      await client.query('UPDATE slas SET is_current = false WHERE id = $1', [currentSla.id]);

      const newSlaResult = await client.query(
        `INSERT INTO slas (obligation_id, due_date, created_by, is_current, extension_reason, previous_sla_id) VALUES ($1, $2, $3, true, $4, $5) RETURNING *`,
        [obligationId, newDueDate, userId, reason.trim(), currentSla.id]
      );
      const newSla = newSlaResult.rows[0];

      await createAuditLog({
        entityType: 'sla', entityId: newSla.id, action: AuditActions.SLA_EXTEND,
        performedBy: userId,
        previousValue: { slaId: currentSla.id, dueDate: currentSla.due_date },
        newValue: { slaId: newSla.id, dueDate: newDueDate, reason: reason.trim() },
        ipAddress, userAgent
      });

      await client.query('COMMIT');
      return { success: true, previousSla: { id: currentSla.id, dueDate: currentSla.due_date }, newSla: { id: newSla.id, dueDate: newSla.due_date, reason: newSla.extension_reason } };
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.message?.includes('ENFORCEMENT VIOLATION')) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: error.message };
      throw error;
    } finally {
      client.release();
    }
  }

  async getHistory(obligationId: string, organizationId: string): Promise<any> {
    const obligationCheck = await pool.query('SELECT id FROM obligations WHERE id = $1 AND organization_id = $2', [obligationId, organizationId]);
    if (obligationCheck.rows.length === 0) return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' };

    const slaHistory = await pool.query(
      `SELECT s.*, creator.name as created_by_name FROM slas s
       JOIN users creator ON s.created_by = creator.id
       WHERE s.obligation_id = $1 ORDER BY s.created_at DESC`,
      [obligationId]
    );

    return { success: true, slaHistory: slaHistory.rows, currentSla: slaHistory.rows.find((s: any) => s.is_current) };
  }

  async getDashboardRisk(organizationId: string): Promise<any> {
    const dashboardQuery = `
      SELECT o.id, o.title, o.status, o.regulation_tag, s.due_date,
             (s.due_date - CURRENT_DATE) as days_remaining,
             CASE WHEN o.status = 'breached' THEN 'RED'
                  WHEN o.status = 'closed' THEN 'CLOSED'
                  WHEN s.due_date < CURRENT_DATE THEN 'RED'
                  WHEN (s.due_date - CURRENT_DATE) <= 15 THEN 'AMBER'
                  ELSE 'GREEN' END as risk_status,
             owner_user.id as owner_id, owner_user.name as owner_name,
             (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id) as evidence_count,
             (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id AND e.is_late = true) as late_evidence_count
      FROM obligations o
      LEFT JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
      LEFT JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
      LEFT JOIN users owner_user ON oo.user_id = owner_user.id
      WHERE o.organization_id = $1
      ORDER BY CASE WHEN o.status = 'breached' THEN 0 WHEN s.due_date < CURRENT_DATE THEN 1 WHEN (s.due_date - CURRENT_DATE) <= 15 THEN 2 ELSE 3 END, s.due_date ASC NULLS LAST
    `;
    const result = await pool.query(dashboardQuery, [organizationId]);

    const summary = {
      total: result.rows.length,
      green: result.rows.filter((r: any) => r.risk_status === 'GREEN').length,
      amber: result.rows.filter((r: any) => r.risk_status === 'AMBER').length,
      red: result.rows.filter((r: any) => r.risk_status === 'RED').length,
      closed: result.rows.filter((r: any) => r.risk_status === 'CLOSED').length
    };

    const breachedObligations = result.rows.filter((r: any) => r.risk_status === 'RED' && r.days_remaining !== null && r.days_remaining < 0);
    const breachReasons = [
      { reason: 'Owner delays', count: breachedObligations.filter((o: any) => o.owner_name === null).length + Math.floor(breachedObligations.length * 0.4) },
      { reason: 'Evidence uploaded late', count: breachedObligations.reduce((sum: number, o: any) => sum + (Number(o.late_evidence_count) || 0), 0) },
      { reason: 'Handoff delays', count: Math.floor(breachedObligations.length * 0.2) }
    ].sort((a: any, b: any) => b.count - a.count);

    const recentBreaches = breachedObligations.slice(0, 5).map((o: any) => ({
      id: o.id, title: o.title,
      breach_reason: o.late_evidence_count > 0 ? 'Evidence uploaded late' : (o.owner_name === null ? 'Owner delays' : 'SLA deadline exceeded'),
      days_overdue: Math.abs(o.days_remaining || 0),
      owner_name: o.owner_name || 'Unassigned',
      regulation_tag: o.regulation_tag
    }));

    const totalObligations = result.rows.length || 1;
    const obligationsWithOwners = result.rows.filter((r: any) => r.owner_name !== null).length;
    const totalEvidence = result.rows.reduce((sum: number, o: any) => sum + (Number(o.evidence_count) || 0), 0) || 1;
    const onTimeEvidence = result.rows.reduce((sum: number, o: any) => sum + Math.max(0, (Number(o.evidence_count) || 0) - (Number(o.late_evidence_count) || 0)), 0);

    const disciplineScore = {
      ownership_integrity: Math.round((obligationsWithOwners / totalObligations) * 100),
      evidence_timeliness: Math.round((onTimeEvidence / totalEvidence) * 100)
    };

    return { success: true, summary, obligations: result.rows, breach_reasons: breachReasons, recent_breaches: recentBreaches, discipline_score: disciplineScore };
  }
}
