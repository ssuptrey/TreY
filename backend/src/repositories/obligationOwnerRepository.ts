// Obligation Owner Repository - Database access for obligation owner operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { ObligationOwner } from '../types/models';

export class ObligationOwnerRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findByObligation(obligationId: string): Promise<ObligationOwner[]> {
    const result = await this.query<ObligationOwner>(
      `SELECT oo.*, u.email, u.full_name
       FROM obligation_owners oo
       JOIN users u ON oo.user_id = u.id
       WHERE oo.obligation_id = $1
       ORDER BY oo.assigned_at DESC`,
      [obligationId]
    );
    return result.rows;
  }

  async findActiveByObligation(obligationId: string): Promise<ObligationOwner | null> {
    const result = await this.query<ObligationOwner>(
      `SELECT oo.*, u.email, u.full_name
       FROM obligation_owners oo
       JOIN users u ON oo.user_id = u.id
       WHERE oo.obligation_id = $1 AND oo.is_active = true`,
      [obligationId]
    );
    return result.rows[0] || null;
  }

  async create(ownerData: {
    obligation_id: string;
    user_id: string;
    assigned_by: string;
  }): Promise<ObligationOwner> {
    const result = await this.query<ObligationOwner>(
      `INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [ownerData.obligation_id, ownerData.user_id, ownerData.assigned_by]
    );
    return result.rows[0];
  }

  async deactivatePrevious(obligationId: string): Promise<void> {
    await this.query(
      'UPDATE obligation_owners SET is_active = false WHERE obligation_id = $1 AND is_active = true',
      [obligationId]
    );
  }
}
