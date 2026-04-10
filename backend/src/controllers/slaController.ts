// SLA Controller - Request/Response handling for SLA operations
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/requests';
import { SLAService } from '../services/slaService';

export class SLAController {
  private slaService: SLAService;

  constructor() {
    this.slaService = new SLAService();
  }

  extend = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { obligationId } = req.params;
      const { newDueDate, reason } = req.body;
      const userId = req.user!.id;
      const organizationId = req.user!.organization_id;

      const result = await this.slaService.extend({
        obligationId, newDueDate, reason, userId, organizationId, ipAddress: req.ipAddress, userAgent: req.userAgent
      });

      if (!result.success) {
        res.status(result.error === 'NOT_FOUND' ? 404 : 400).json({ error: result.error, message: result.message });
        return;
      }

      res.status(201).json({
        message: 'SLA extended successfully',
        previousSla: result.previousSla,
        newSla: result.newSla
      });
    } catch (error) {
      console.error('[SLA] Extend error:', error);
      res.status(500).json({ error: 'EXTEND_ERROR', message: 'Failed to extend SLA' });
    }
  };

  getHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { obligationId } = req.params;
      const organizationId = req.user!.organization_id;

      const result = await this.slaService.getHistory(obligationId, organizationId);

      if (!result.success) {
        res.status(404).json({ error: result.error, message: result.message });
        return;
      }

      res.json({
        slaHistory: result.slaHistory,
        currentSla: result.currentSla
      });
    } catch (error) {
      console.error('[SLA] History error:', error);
      res.status(500).json({ error: 'HISTORY_ERROR', message: 'Failed to get SLA history' });
    }
  };

  getDashboardRisk = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const organizationId = req.user!.organization_id;

      const result = await this.slaService.getDashboardRisk(organizationId);

      res.json({
        summary: result.summary,
        obligations: result.obligations,
        breach_reasons: result.breach_reasons,
        recent_breaches: result.recent_breaches,
        discipline_score: result.discipline_score
      });
    } catch (error) {
      console.error('[SLA] Dashboard error:', error);
      res.status(500).json({ error: 'DASHBOARD_ERROR', message: 'Failed to get dashboard data' });
    }
  };
}
