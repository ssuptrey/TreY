// Obligation Owner Controller - Request/Response handling for owner assignment
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface ObligationOwnerControllerDeps {
  obligationOwnerService: any;
  obligationOwnerRepository: any;
  auditRepository: any;
}

export class ObligationOwnerController {
  private obligationOwnerService: any;
  private obligationOwnerRepository: any;
  private auditRepository: any;

  constructor(deps: ObligationOwnerControllerDeps) {
    this.obligationOwnerService = deps.obligationOwnerService;
    this.obligationOwnerRepository = deps.obligationOwnerRepository;
    this.auditRepository = deps.auditRepository;
  }

  // Assign owner (append-only per rulebook)
  assign = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligation_id, user_id: newOwnerId } = req.body;

      // This will deactivate previous owner and create new record (append-only)
      const result = await this.obligationOwnerService.assignOwner({
        obligation_id,
        user_id: newOwnerId,
        assigned_by: userId
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'OWNER_ASSIGNED',
        resource_type: 'obligation_owner',
        resource_id: result.owner.id,
        metadata: { 
          obligation_id, 
          new_owner_id: newOwnerId,
          previous_owner_id: result.previous_owner_id
        }
      });

      res.status(201).json({
        success: true,
        data: result.owner,
        message: 'Owner assigned successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;

      const owners = await this.obligationOwnerRepository.findByObligation(obligationId);

      res.json({
        success: true,
        data: owners
      });
    } catch (error) {
      next(error);
    }
  };

  getActive = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;

      const owner = await this.obligationOwnerRepository.findActiveByObligation(obligationId);

      if (!owner) {
        res.status(404).json({ success: false, error: 'No active owner found' });
        return;
      }

      res.json({
        success: true,
        data: owner
      });
    } catch (error) {
      next(error);
    }
  };
}
