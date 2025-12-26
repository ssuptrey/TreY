// ============================================
// ALERTS ROUTES
// ============================================
// Manual alert triggers and alert history

import { Router, Response } from 'express';
import { getAlertHistory, sendManualAlert } from '../services/alertService';
import { triggerManualAlertJob } from '../jobs/slaAlertJob';
import { authenticate, requireRole } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';

const router = Router();

/**
 * GET /api/alerts/history/:obligationId
 * Get alert history for an obligation
 */
router.get('/history/:obligationId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { obligationId } = req.params;
    const history = await getAlertHistory(obligationId);
    
    res.json({
      obligationId,
      alerts: history
    });
  } catch (error) {
    console.error('[ALERTS] Get history error:', error);
    res.status(500).json({
      error: 'ALERT_HISTORY_ERROR',
      message: 'Failed to get alert history'
    });
  }
});

/**
 * POST /api/alerts/send/:obligationId
 * Send manual alert for an obligation
 */
router.post('/send/:obligationId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { obligationId } = req.params;
    const userId = req.user!.id;
    
    const sent = await sendManualAlert(obligationId, userId);
    
    res.json({
      message: sent ? 'Alert sent successfully' : 'Failed to send alert',
      sent
    });
  } catch (error: any) {
    console.error('[ALERTS] Send manual alert error:', error);
    res.status(500).json({
      error: 'SEND_ALERT_ERROR',
      message: error.message || 'Failed to send alert'
    });
  }
});

/**
 * POST /api/alerts/trigger-job
 * Manually trigger the SLA alert job (admin only)
 */
router.post('/trigger-job', authenticate, requireRole('admin'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await triggerManualAlertJob();
    
    res.json({
      message: 'Alert job completed',
      result
    });
  } catch (error) {
    console.error('[ALERTS] Trigger job error:', error);
    res.status(500).json({
      error: 'TRIGGER_JOB_ERROR',
      message: 'Failed to trigger alert job'
    });
  }
});

export default router;
