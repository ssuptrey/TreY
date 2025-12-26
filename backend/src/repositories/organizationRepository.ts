// Organization Repository - Database access for organization operations
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { Organization } from '../types/models';

export class OrganizationRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findById(id: string): Promise<Organization | null> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<Organization[]> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async create(name: string): Promise<Organization> {
    const result = await this.query<Organization>(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING *',
      [name]
    );
    return result.rows[0];
  }

  async findByName(name: string): Promise<Organization | null> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }
}
