// SLA Controller - Request/Response handling for SLA operations
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface SLAControllerDeps {
  slaService: any;
  slaRepository: any;
  auditRepository: any;
}

export class SLAController {
  private slaService: any;
  private slaRepository: any;
  private auditRepository: any;

  constructor(deps: SLAControllerDeps) {
    this.slaService = deps.slaService;
    this.slaRepository = deps.slaRepository;
    this.auditRepository = deps.auditRepository;
  }

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligation_id, deadline } = req.body;

      const result = await this.slaService.create({
        obligation_id,
        deadline: new Date(deadline)
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'SLA_CREATED',
        resource_type: 'sla',
        resource_id: result.sla.id,
        metadata: { obligation_id, deadline }
      });

      res.status(201).json({
        success: true,
        data: result.sla,
        message: 'SLA created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  extend = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligation_id, new_deadline, extension_reason } = req.body;

      // SLA extension creates a new row (append-only per rulebook)
      const result = await this.slaService.extend({
        obligation_id,
        new_deadline: new Date(new_deadline),
        extension_reason,
        extended_by: userId
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'SLA_EXTENDED',
        resource_type: 'sla',
        resource_id: result.sla.id,
        metadata: { 
          obligation_id, 
          new_deadline, 
          extension_reason,
          previous_sla_id: result.previous_sla_id
        }
      });

      res.status(201).json({
        success: true,
        data: result.sla,
        message: 'SLA extended successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getByObligation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;

      const slas = await this.slaRepository.findByObligation(obligationId);

      res.json({
        success: true,
        data: slas
      });
    } catch (error) {
      next(error);
    }
  };

  getActive = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;

      const sla = await this.slaRepository.findActiveByObligation(obligationId);

      if (!sla) {
        res.status(404).json({ success: false, error: 'No active SLA found' });
        return;
      }

      res.json({
        success: true,
        data: sla
      });
    } catch (error) {
      next(error);
    }
  };
}
