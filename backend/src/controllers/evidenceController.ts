// Evidence Controller - Request/Response handling for evidence operations
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import { EvidenceService } from '../services/evidenceService';

export class EvidenceController {
  private evidenceService: EvidenceService;

  constructor() {
    this.evidenceService = new EvidenceService();
  }

  upload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organization_id;
      const { obligationId } = req.params;
      const { referenceNote } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'File is required' });
        return;
      }

      const result = await this.evidenceService.upload({
        obligationId, file, referenceNote, userId, organizationId, ipAddress: req.ipAddress, userAgent: req.userAgent
      });

      if (!result.success) {
        res.status(result.error === 'NOT_FOUND' ? 404 : 400).json({ error: result.error, message: result.message });
        return;
      }

      res.status(201).json({
        message: result.isLate 
          ? 'Evidence uploaded successfully (WARNING: Uploaded after SLA due date)'
          : 'Evidence uploaded successfully',
        evidence: {
          id: result.evidence.id,
          fileName: result.evidence.file_name,
          fileSize: result.evidence.file_size_bytes,
          uploadedAt: result.evidence.uploaded_at,
          isLate: result.evidence.is_late
        },
        warning: result.isLate ? 'Evidence was uploaded after the SLA due date and has been flagged as late' : null
      });
    } catch (error) {
      console.error('[EVIDENCE] Upload error:', error);
      res.status(500).json({ error: 'UPLOAD_ERROR', message: 'Failed to upload evidence' });
    }
  };

  listByObligation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { obligationId } = req.params;
      const organizationId = req.user!.organization_id;

      const result = await this.evidenceService.list(obligationId, organizationId);

      if (!result.success) {
        res.status(404).json({ error: result.error, message: result.message });
        return;
      }

      res.json({
        evidence: result.evidence,
        total: result.evidence.length,
        lateCount: result.evidence.filter((e: any) => e.is_late).length
      });
    } catch (error) {
      console.error('[EVIDENCE] List error:', error);
      res.status(500).json({ error: 'LIST_ERROR', message: 'Failed to list evidence' });
    }
  };

  download = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { obligationId, evidenceId } = req.params;
      const organizationId = req.user!.organization_id;

      const result = await this.evidenceService.getFileDetails(obligationId, evidenceId, organizationId);

      if (!result.success) {
        res.status(404).json({ error: result.error, message: result.message });
        return;
      }

      res.download(result.evidence.file_path, result.evidence.file_name);
    } catch (error) {
      console.error('[EVIDENCE] Download error:', error);
      res.status(500).json({ error: 'DOWNLOAD_ERROR', message: 'Failed to download evidence' });
    }
  };
}
