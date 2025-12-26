// Export Controller - Request/Response handling for export operations
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface ExportControllerDeps {
  exportService: any;
  auditRepository: any;
}

export class ExportController {
  private exportService: any;
  private auditRepository: any;

  constructor(deps: ExportControllerDeps) {
    this.exportService = deps.exportService;
    this.auditRepository = deps.auditRepository;
  }

  exportPDF = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;

      if (!userId || !organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligation_id } = req.params;

      const result = await this.exportService.generatePDF(obligation_id, organizationId);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'PDF_EXPORTED',
        resource_type: 'obligation',
        resource_id: obligation_id,
        metadata: { export_type: 'pdf' }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=obligation-${obligation_id}.pdf`);
      result.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  exportZIP = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;

      if (!userId || !organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligation_id } = req.params;

      const result = await this.exportService.generateZIP(obligation_id, organizationId);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'ZIP_EXPORTED',
        resource_type: 'obligation',
        resource_id: obligation_id,
        metadata: { export_type: 'zip', files_included: result.file_count }
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=obligation-${obligation_id}-evidence.zip`);
      result.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  exportCSV = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;

      if (!userId || !organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await this.exportService.generateCSV(organizationId);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'CSV_EXPORTED',
        resource_type: 'organization',
        resource_id: organizationId,
        metadata: { export_type: 'csv', record_count: result.record_count }
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=obligations-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(result.csv);
    } catch (error) {
      next(error);
    }
  };
}
