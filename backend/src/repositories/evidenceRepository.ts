// Evidence Repository - Database access for evidence operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { Evidence } from '../types/models';

export class EvidenceRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findByObligation(obligationId: string): Promise<Evidence[]> {
    const result = await this.query<Evidence>(
      'SELECT * FROM evidence WHERE obligation_id = $1 ORDER BY upload_time DESC',
      [obligationId]
    );
    return result.rows;
  }

  async create(evidenceData: {
    obligation_id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    uploaded_by: string;
  }): Promise<Evidence> {
    const result = await this.query<Evidence>(
      `INSERT INTO evidence (obligation_id, file_name, file_path, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        evidenceData.obligation_id,
        evidenceData.file_name,
        evidenceData.file_path,
        evidenceData.file_size,
        evidenceData.uploaded_by
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Evidence | null> {
    const result = await this.query<Evidence>(
      'SELECT * FROM evidence WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async countByObligation(obligationId: string): Promise<number> {
    const result = await this.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM evidence WHERE obligation_id = $1',
      [obligationId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}
