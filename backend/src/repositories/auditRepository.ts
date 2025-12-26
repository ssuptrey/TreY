// Audit Repository - Database access for audit log operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { AuditLog } from '../types/models';

export class AuditRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(auditData: {
    user_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const result = await this.query<AuditLog>(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        auditData.user_id,
        auditData.action,
        auditData.resource_type,
        auditData.resource_id,
        JSON.stringify(auditData.metadata || {})
      ]
    );
    return result.rows[0];
  }

  async findByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    const result = await this.query<AuditLog>(
      `SELECT al.*, u.email as user_email, u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.resource_type = $1 AND al.resource_id = $2
       ORDER BY al.timestamp DESC`,
      [resourceType, resourceId]
    );
    return result.rows;
  }

  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await this.query<AuditLog>(
      'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }

  async findByOrganization(organizationId: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await this.query<AuditLog>(
      `SELECT al.*, u.email as user_email, u.full_name as user_name
       FROM audit_logs al
       JOIN users u ON al.user_id = u.id
       WHERE u.organization_id = $1
       ORDER BY al.timestamp DESC
       LIMIT $2`,
      [organizationId, limit]
    );
    return result.rows;
  }

  async findRecent(limit: number = 50): Promise<AuditLog[]> {
    const result = await this.query<AuditLog>(
      `SELECT al.*, u.email as user_email, u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.timestamp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}
