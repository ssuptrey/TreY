// Obligation Repository - Database access for obligation operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { Obligation } from '../types/models';

export class ObligationRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findById(id: string): Promise<Obligation | null> {
    const result = await this.query<Obligation>(
      'SELECT * FROM obligations WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByOrganization(organizationId: string): Promise<Obligation[]> {
    const result = await this.query<Obligation>(
      'SELECT * FROM obligations WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    return result.rows;
  }

  async create(obligationData: {
    title: string;
    description: string;
    organization_id: string;
    created_by: string;
  }): Promise<Obligation> {
    const result = await this.query<Obligation>(
      `INSERT INTO obligations (title, description, organization_id, created_by, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [obligationData.title, obligationData.description, obligationData.organization_id, obligationData.created_by]
    );
    return result.rows[0];
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.query(
      'UPDATE obligations SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
  }

  async findWithSLARisk(organizationId: string): Promise<any[]> {
    const result = await this.query(
      `SELECT 
        o.*,
        s.deadline,
        s.is_active as sla_active,
        EXTRACT(DAY FROM (s.deadline - NOW())) as days_remaining,
        CASE 
          WHEN s.deadline < NOW() THEN 'overdue'
          WHEN s.deadline < NOW() + INTERVAL '3 days' THEN 'critical'
          WHEN s.deadline < NOW() + INTERVAL '7 days' THEN 'warning'
          ELSE 'safe'
        END as risk_level
      FROM obligations o
      LEFT JOIN slas s ON o.id = s.obligation_id AND s.is_active = true
      WHERE o.organization_id = $1
      ORDER BY s.deadline ASC NULLS LAST`,
      [organizationId]
    );
    return result.rows;
  }
}
