// Evidence Controller - Request/Response handling for evidence operations
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface EvidenceControllerDeps {
  evidenceService: any;
  evidenceRepository: any;
  auditRepository: any;
}

export class EvidenceController {
  private evidenceService: any;
  private evidenceRepository: any;
  private auditRepository: any;

  constructor(deps: EvidenceControllerDeps) {
    this.evidenceService = deps.evidenceService;
    this.evidenceRepository = deps.evidenceRepository;
    this.auditRepository = deps.auditRepository;
  }

  upload = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligation_id } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      // Evidence is immutable once uploaded (per rulebook)
      const result = await this.evidenceService.upload({
        obligation_id,
        file_name: file.originalname,
        file_path: file.path,
        file_size: file.size,
        uploaded_by: userId
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'EVIDENCE_UPLOADED',
        resource_type: 'evidence',
        resource_id: result.evidence.id,
        metadata: { 
          obligation_id, 
          file_name: file.originalname,
          file_size: file.size,
          is_late: result.evidence.is_late
        }
      });

      res.status(201).json({
        success: true,
        data: result.evidence,
        message: result.evidence.is_late 
          ? 'Evidence uploaded (flagged as late - past SLA deadline)' 
          : 'Evidence uploaded successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  listByObligation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;

      const evidence = await this.evidenceRepository.findByObligation(obligationId);

      res.json({
        success: true,
        data: evidence
      });
    } catch (error) {
      next(error);
    }
  };

  download = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const evidence = await this.evidenceRepository.findById(id);

      if (!evidence) {
        res.status(404).json({ success: false, error: 'Evidence not found' });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'EVIDENCE_DOWNLOADED',
        resource_type: 'evidence',
        resource_id: id,
        metadata: { file_name: evidence.file_name }
      });

      res.download(evidence.file_path, evidence.file_name);
    } catch (error) {
      next(error);
    }
  };
}
