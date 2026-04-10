// Obligation Controller - Request/Response handling for obligations
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import { ObligationService } from '../services/obligationService';

export class ObligationController {
  private obligationService: ObligationService;

  constructor() {
    this.obligationService = new ObligationService();
  }

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.obligationService.create({
        ...req.body,
        userId: req.user!.id,
        organizationId: req.user!.organization_id,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent
      });

      if (!result.success) {
        if (result.error === 'ENFORCEMENT_VIOLATION') {
          res.status(400).json({ error: result.error, message: result.message, violations: result.violations });
          return;
        }
        res.status(400).json({ error: result.error, message: result.message });
        return;
      }
      res.status(201).json({ message: 'Obligation created successfully', obligation: result.obligation });
    } catch (error) {
      console.error('[OBLIGATIONS] Create error:', error);
      res.status(500).json({ error: 'CREATE_ERROR', message: 'Failed to create obligation' });
    }
  };

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const obligations = await this.obligationService.list(req.user!.organization_id, req.query.status as string, req.query.ownerId as string);
      res.json({ obligations, total: obligations.length });
    } catch (error) {
      console.error('[OBLIGATIONS] List error:', error);
      res.status(500).json({ error: 'LIST_ERROR', message: 'Failed to list obligations' });
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.obligationService.getDetails(req.params.id, req.user!.organization_id);
      if (!result.success) {
        res.status(404).json({ error: result.error, message: result.message });
        return;
      }
      res.json(result.data);
    } catch (error) {
      console.error('[OBLIGATIONS] Get detail error:', error);
      res.status(500).json({ error: 'GET_ERROR', message: 'Failed to get obligation details' });
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.obligationService.updateStatus(
        req.params.id, req.user!.organization_id, req.body.status, req.user!.id, req.ipAddress, req.userAgent
      );
      if (!result.success) {
        res.status(result.error === 'NOT_FOUND' ? 404 : 400).json({ error: result.error, message: result.message });
        return;
      }
      res.json({ message: result.message, obligation: result.obligation });
    } catch (error) {
      console.error('[OBLIGATIONS] Status update error:', error);
      res.status(500).json({ error: 'UPDATE_ERROR', message: 'Failed to update obligation status' });
    }
  };

  reassignOwner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.obligationService.reassignOwner(
        req.params.id, req.user!.organization_id, req.body.newOwnerId, req.body.reason, req.user!.id, req.ipAddress, req.userAgent
      );
      if (!result.success) {
        res.status(result.error === 'NOT_FOUND' ? 404 : 400).json({ error: result.error, message: result.message });
        return;
      }
      res.json({ message: result.message, owner: result.owner });
    } catch (error) {
      console.error('[OBLIGATIONS] Reassign owner error:', error);
      res.status(500).json({ error: 'REASSIGN_ERROR', message: 'Failed to reassign obligation owner' });
    }
  };
}
