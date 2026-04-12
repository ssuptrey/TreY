import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { ObligationAlert } from '../services/alertService';

export class AlertRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async getObligationsNeedingAlerts(): Promise<ObligationAlert[]> {
    const query = `
      SELECT 
        o.id,
        o.title,
        o.description,
        o.regulation_tag,
        o.status,
        s.due_date,
        s.id as sla_id,
        (s.due_date - CURRENT_DATE) as days_remaining,
        oo.user_id as owner_id,
        u.name as owner_name,
        u.email as owner_email,
        org.name as organization_name,
        CASE 
          WHEN (s.due_date - CURRENT_DATE) = 7 THEN '7_DAYS_WARNING'
          WHEN (s.due_date - CURRENT_DATE) = 3 THEN '3_DAYS_WARNING'
          WHEN (s.due_date - CURRENT_DATE) = -1 THEN 'BREACH_ALERT'
          ELSE NULL
        END as alert_type
      FROM obligations o
      JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
      JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
      JOIN users u ON oo.user_id = u.id
      JOIN organizations org ON o.organization_id = org.id
      WHERE o.status = 'open'
        AND (
          (s.due_date - CURRENT_DATE) = 7 OR
          (s.due_date - CURRENT_DATE) = 3 OR
          (s.due_date - CURRENT_DATE) = -1
        )
    `;
    const result = await this.query<any>(query);
    return result.rows as ObligationAlert[];
  }

  async wasAlertSentToday(obligationId: string, alertType: string): Promise<boolean> {
    const query = `
      SELECT id 
      FROM audit_logs 
      WHERE entity_type = 'obligation'
        AND entity_id = $1
        AND action = $2
        AND timestamp::date = CURRENT_DATE
      LIMIT 1
    `;
    const result = await this.query<any>(query, [obligationId, `SLA_ALERT_${alertType}`]);
    return result.rows.length > 0;
  }

  async getAlertHistory(obligationId: string): Promise<any[]> {
    const query = `
      SELECT *
      FROM audit_logs
      WHERE entity_type = 'obligation'
        AND entity_id = $1
        AND action LIKE 'SLA_ALERT_%'
      ORDER BY timestamp DESC
    `;
    const result = await this.query<any>(query, [obligationId]);
    return result.rows;
  }

  async getObligationForManualAlert(obligationId: string): Promise<ObligationAlert | null> {
    const query = `
      SELECT 
        o.id,
        o.title,
        s.due_date,
        (s.due_date - CURRENT_DATE) as days_remaining,
        u.email as owner_email,
        u.name as owner_name,
        org.name as organization_name
      FROM obligations o
      JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
      JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
      JOIN users u ON oo.user_id = u.id
      JOIN organizations org ON o.organization_id = org.id
      WHERE o.id = $1
    `;
    const result = await this.query<any>(query, [obligationId]);
    return result.rows[0] ? (result.rows[0] as ObligationAlert) : null;
  }
}
