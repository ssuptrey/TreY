// SLA Repository - Database access for SLA operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { SLA } from '../types/models';

export class SLARepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findByObligation(obligationId: string): Promise<SLA[]> {
    const result = await this.query<SLA>(
      'SELECT * FROM slas WHERE obligation_id = $1 ORDER BY created_at DESC',
      [obligationId]
    );
    return result.rows;
  }

  async findActiveByObligation(obligationId: string): Promise<SLA | null> {
    const result = await this.query<SLA>(
      'SELECT * FROM slas WHERE obligation_id = $1 AND is_active = true',
      [obligationId]
    );
    return result.rows[0] || null;
  }

  async create(slaData: {
    obligation_id: string;
    deadline: Date;
    extension_reason?: string;
    extended_by?: string;
  }): Promise<SLA> {
    const result = await this.query<SLA>(
      `INSERT INTO slas (obligation_id, deadline, extension_reason, extended_by, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [slaData.obligation_id, slaData.deadline, slaData.extension_reason || null, slaData.extended_by || null]
    );
    return result.rows[0];
  }

  async deactivatePrevious(obligationId: string): Promise<void> {
    await this.query(
      'UPDATE slas SET is_active = false WHERE obligation_id = $1 AND is_active = true',
      [obligationId]
    );
  }

  async findUpcomingDeadlines(daysAhead: number): Promise<any[]> {
    const result = await this.query(
      `SELECT s.*, o.title, o.organization_id, u.email as owner_email, u.full_name as owner_name
       FROM slas s
       JOIN obligations o ON s.obligation_id = o.id
       LEFT JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_active = true
       LEFT JOIN users u ON oo.user_id = u.id
       WHERE s.is_active = true 
       AND s.deadline BETWEEN NOW() AND NOW() + INTERVAL '${daysAhead} days'
       AND s.deadline > NOW()
       ORDER BY s.deadline ASC`
    );
    return result.rows;
  }

  async findBreached(): Promise<any[]> {
    const result = await this.query(
      `SELECT s.*, o.title, o.organization_id, u.email as owner_email, u.full_name as owner_name
       FROM slas s
       JOIN obligations o ON s.obligation_id = o.id
       LEFT JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_active = true
       LEFT JOIN users u ON oo.user_id = u.id
       WHERE s.is_active = true 
       AND s.deadline < NOW()
       ORDER BY s.deadline ASC`
    );
    return result.rows;
  }
}
