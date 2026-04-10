import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import * as auditService from '../services/auditService';

export class AuditController {
  getLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await auditService.getAuditLogsForOrganization(organizationId, { limit });
      res.json({ success: true, data: logs });
    } catch (error) { next(error); }
  };

  getLogsByResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resourceType, resourceId } = req.params;
      const logs = await auditService.getAuditLogsForEntity(resourceType, resourceId);
      res.json({ success: true, data: logs });
    } catch (error) { next(error); }
  };

  exportLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;
      if (!userId || !organizationId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const logs = await auditService.getAuditLogsForOrganization(organizationId, { limit: 10000 });
      const headers = ['ID', 'User', 'Action', 'Entity Type', 'Entity ID', 'Timestamp', 'New Value', 'Previous Value'];
      const csvRows = [headers.join(',')];
      for (const log of logs) {
        const row = [
          log.id, log.performed_by_email || log.performed_by, log.action, log.entity_type, log.entity_id, log.timestamp, JSON.stringify(log.new_value).replace(/,/g, ';'), JSON.stringify(log.previous_value).replace(/,/g, ';')
        ];
        csvRows.push(row.join(','));
      }
      const csv = csvRows.join('\n');
      await auditService.createAuditLog({ entityType: 'system', entityId: organizationId, action: auditService.AuditActions.EXPORT_GENERATE, performedBy: userId, additionalContext: { record_count: logs.length } });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', "attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv");
      res.send(csv);
    } catch (error) { next(error); }
  };
}