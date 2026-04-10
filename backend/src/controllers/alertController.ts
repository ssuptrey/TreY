import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface AlertControllerDeps {
  alertService: any;
}

export class AlertController {
  private alertService: any;

  constructor(deps: AlertControllerDeps) {
    this.alertService = deps.alertService;
  }

  getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;
      const alerts = await this.alertService.getAlertHistory(obligationId);
      res.json({ success: true, data: alerts });
    } catch (error) { next(error); }
  };

  sendManual = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const { obligationId } = req.params;
      const success = await this.alertService.sendManualAlert(obligationId, userId);
      if (!success) { res.status(400).json({ success: false, error: 'Failed to send alert' }); return; }
      res.json({ success: true, message: 'Alert sent successfully' });
    } catch (error) { next(error); }
  };

  triggerJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'admin') { res.status(403).json({ success: false, error: 'Admin access required' }); return; }
      const result = await this.alertService.processSLAAlerts();
      res.json({ success: true, data: result, message: 'Alert job completed' });
    } catch (error) { next(error); }
  };
}