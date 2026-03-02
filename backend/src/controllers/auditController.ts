// Audit Controller - Request/Response handling for audit log operations
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface AuditControllerDeps {
  auditRepository: any;
}

export class AuditController {
  private auditRepository: any;

  constructor(deps: AuditControllerDeps) {
    this.auditRepository = deps.auditRepository;
  }

  getLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user?.organization_id;

      if (!organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await this.auditRepository.findByOrganization(organizationId, limit);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      next(error);
    }
  };

  getLogsByResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resourceType, resourceId } = req.params;

      const logs = await this.auditRepository.findByResource(resourceType, resourceId);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      next(error);
    }
  };

  exportLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;

      if (!userId || !organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const logs = await this.auditRepository.findByOrganization(organizationId, 10000);

      // Convert to CSV
      const headers = ['ID', 'User', 'Action', 'Resource Type', 'Resource ID', 'Timestamp', 'Metadata'];
      const csvRows = [headers.join(',')];

      for (const log of logs) {
        const row = [
          log.id,
          log.user_email || log.user_id,
          log.action,
          log.resource_type,
          log.resource_id,
          log.timestamp,
          JSON.stringify(log.metadata).replace(/,/g, ';')
        ];
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');

      // Log this export action
      await this.auditRepository.create({
        user_id: userId,
        action: 'AUDIT_LOGS_EXPORTED',
        resource_type: 'audit_logs',
        resource_id: organizationId,
        metadata: { record_count: logs.length }
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };
}
