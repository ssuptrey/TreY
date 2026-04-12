import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { AuditLogEntry, AuditLogParams, AuditLogResult } from '../services/auditService';

export class AuditRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(auditData: AuditLogParams): Promise<AuditLogResult> {
    const result = await this.query<AuditLogResult>(
      `INSERT INTO audit_logs (
        entity_type, entity_id, action, performed_by,
        previous_value, new_value, ip_address, user_agent, additional_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, timestamp`,
      [
        auditData.entityType,
        auditData.entityId,
        auditData.action,
        auditData.performedBy,
        auditData.previousValue ? JSON.stringify(auditData.previousValue) : null,
        auditData.newValue ? JSON.stringify(auditData.newValue) : null,
        auditData.ipAddress || null,
        auditData.userAgent || null,
        auditData.additionalContext ? JSON.stringify(auditData.additionalContext) : null
      ]
    );
    return result.rows[0];
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    const result = await this.query<AuditLogEntry>(
      `SELECT 
        al.*,
        u.name as performed_by_name,
        u.email as performed_by_email
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE al.entity_type = $1 AND al.entity_id = $2
      ORDER BY al.timestamp DESC`,
      [entityType, entityId]
    );
    return result.rows;
  }

  async findByOrganization(organizationId: string, limit: number = 100, offset: number = 0): Promise<AuditLogEntry[]> {
    const result = await this.query<AuditLogEntry>(
      `SELECT 
        al.*,
        u.name as performed_by_name
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE u.organization_id = $1
      ORDER BY al.timestamp DESC
      LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return result.rows;
  }
}
