// Obligation Controller - Request/Response handling for obligations
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface ObligationControllerDeps {
  obligationService: any;
  obligationRepository: any;
  auditRepository: any;
}

export class ObligationController {
  private obligationService: any;
  private obligationRepository: any;
  private auditRepository: any;

  constructor(deps: ObligationControllerDeps) {
    this.obligationService = deps.obligationService;
    this.obligationRepository = deps.obligationRepository;
    this.auditRepository = deps.auditRepository;
  }

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organization_id;

      if (!userId || !organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { title, description, owner_id, sla_deadline } = req.body;

      const result = await this.obligationService.create({
        title,
        description,
        organization_id: organizationId,
        created_by: userId,
        owner_id,
        sla_deadline
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'OBLIGATION_CREATED',
        resource_type: 'obligation',
        resource_id: result.obligation.id,
        metadata: { title, owner_id, sla_deadline }
      });

      res.status(201).json({
        success: true,
        data: result.obligation,
        message: 'Obligation created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user?.organization_id;

      if (!organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const obligations = await this.obligationRepository.findByOrganization(organizationId);

      res.json({
        success: true,
        data: obligations
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;

      if (!organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await this.obligationService.getDetails(id, organizationId);

      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        data: result.obligation
      });
    } catch (error) {
      next(error);
    }
  };

  getDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user?.organization_id;

      if (!organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const obligations = await this.obligationRepository.findWithSLARisk(organizationId);

      const summary = {
        total: obligations.length,
        overdue: obligations.filter((o: any) => o.risk_level === 'overdue').length,
        critical: obligations.filter((o: any) => o.risk_level === 'critical').length,
        warning: obligations.filter((o: any) => o.risk_level === 'warning').length,
        safe: obligations.filter((o: any) => o.risk_level === 'safe').length
      };

      res.json({
        success: true,
        data: {
          obligations,
          summary
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await this.obligationService.updateStatus(id, status);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'OBLIGATION_STATUS_UPDATED',
        resource_type: 'obligation',
        resource_id: id,
        metadata: { new_status: status }
      });

      res.json({
        success: true,
        message: 'Obligation status updated'
      });
    } catch (error) {
      next(error);
    }
  };
}
