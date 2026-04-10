import { pool } from '../config/database';
import { createAuditLog, AuditActions } from './auditService';
import fs from 'fs';

export class EvidenceService {
  async upload(data: any): Promise<any> {
    const { obligationId, file, referenceNote, userId, organizationId, ipAddress, userAgent } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const obligationCheck = await client.query('SELECT id, status FROM obligations WHERE id = $1 AND organization_id = $2', [obligationId, organizationId]);
      if (obligationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' };
      }

      const slaCheck = await client.query('SELECT due_date FROM slas WHERE obligation_id = $1 AND is_current = true', [obligationId]);
      if (slaCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { success: false, error: 'ENFORCEMENT_VIOLATION', message: 'Cannot upload evidence for obligation without SLA' };
      }

      const slaDueDate = new Date(slaCheck.rows[0].due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      slaDueDate.setHours(0, 0, 0, 0);
      
      const isLate = today > slaDueDate;

      const evidenceResult = await client.query(
        `INSERT INTO evidence (
          obligation_id, file_path, file_name, file_size_bytes, 
          mime_type, reference_note, uploaded_by, is_late, sla_due_date_at_upload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [obligationId, file.path, file.originalname, file.size, file.mimetype, referenceNote, userId, isLate, slaCheck.rows[0].due_date]
      );

      const evidence = evidenceResult.rows[0];

      await createAuditLog({
        entityType: 'evidence',
        entityId: evidence.id,
        action: isLate ? AuditActions.EVIDENCE_LATE_UPLOAD : AuditActions.EVIDENCE_UPLOAD,
        performedBy: userId,
        newValue: { obligationId, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, isLate, slaDueDate: slaCheck.rows[0].due_date },
        ipAddress,
        userAgent,
        additionalContext: isLate ? { warning: 'Evidence uploaded after SLA due date' } : undefined
      });

      await client.query('COMMIT');
      return { success: true, evidence, isLate };
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      if (error.message?.includes('ENFORCEMENT VIOLATION')) return { success: false, error: 'ENFORCEMENT_VIOLATION', message: error.message };
      throw error;
    } finally {
      client.release();
    }
  }

  async list(obligationId: string, organizationId: string): Promise<any> {
    const obligationCheck = await pool.query('SELECT id FROM obligations WHERE id = $1 AND organization_id = $2', [obligationId, organizationId]);
    if (obligationCheck.rows.length === 0) return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' };

    const evidenceResult = await pool.query(
      `SELECT e.*, u.name as uploaded_by_name FROM evidence e
       JOIN users u ON e.uploaded_by = u.id
       WHERE e.obligation_id = $1 ORDER BY e.uploaded_at DESC`,
      [obligationId]
    );

    return { success: true, evidence: evidenceResult.rows };
  }

  async getFileDetails(obligationId: string, evidenceId: string, organizationId: string): Promise<any> {
    const obligationCheck = await pool.query('SELECT id FROM obligations WHERE id = $1 AND organization_id = $2', [obligationId, organizationId]);
    if (obligationCheck.rows.length === 0) return { success: false, error: 'NOT_FOUND', message: 'Obligation not found' };

    const evidenceResult = await pool.query('SELECT * FROM evidence WHERE id = $1 AND obligation_id = $2', [evidenceId, obligationId]);
    if (evidenceResult.rows.length === 0) return { success: false, error: 'NOT_FOUND', message: 'Evidence not found' };

    const evidence = evidenceResult.rows[0];
    if (!fs.existsSync(evidence.file_path)) return { success: false, error: 'FILE_NOT_FOUND', message: 'Evidence file not found on server' };

    return { success: true, evidence };
  }
}
