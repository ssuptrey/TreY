// Alert Controller - Request/Response handling for SLA alerts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface AlertControllerDeps {
  alertService: any;
  auditRepository: any;
}

export class AlertController {
  private alertService: any;
  private auditRepository: any;

  constructor(deps: AlertControllerDeps) {
    this.alertService = deps.alertService;
    this.auditRepository = deps.auditRepository;
  }

  getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { obligationId } = req.params;

      const alerts = await this.alertService.getAlertHistory(obligationId);

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  };

  sendManual = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { obligationId } = req.params;

      const result = await this.alertService.sendManualAlert(obligationId);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'MANUAL_ALERT_SENT',
        resource_type: 'obligation',
        resource_id: obligationId,
        metadata: { triggered_by: userId }
      });

      res.json({
        success: true,
        message: 'Alert sent successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  triggerJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Only admin can trigger the job manually
      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
      }

      const result = await this.alertService.processSLAAlerts();

      await this.auditRepository.create({
        user_id: userId,
        action: 'ALERT_JOB_TRIGGERED',
        resource_type: 'system',
        resource_id: 'sla_alert_job',
        metadata: { 
          alerts_sent: result.alerts_sent,
          triggered_by: userId 
        }
      });

      res.json({
        success: true,
        data: {
          alerts_sent: result.alerts_sent
        },
        message: 'Alert job completed'
      });
    } catch (error) {
      next(error);
    }
  };
}
