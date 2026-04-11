// Database Repository Base
import { Pool, QueryResult } from 'pg';

export class BaseRepository {
  constructor(protected pool: Pool) {}

  protected async query<T extends import('pg').QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return await this.pool.query<T>(text, params);
  }
}
