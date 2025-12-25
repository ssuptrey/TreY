// ============================================
// ALERTS ROUTES
// ============================================
// Manual alert triggers and alert history

const express = require('express');
const { getAlertHistory, sendManualAlert } = require('../services/alertService');
const { triggerManualAlertJob } = require('../jobs/slaAlertJob');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/alerts/history/:obligationId
 * Get alert history for an obligation
 */
router.get('/history/:obligationId', authenticate, async (req, res) => {
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
router.post('/send/:obligationId', authenticate, async (req, res) => {
  try {
    const { obligationId } = req.params;
    const userId = req.user.id;
    
    const sent = await sendManualAlert(obligationId, userId);
    
    res.json({
      message: sent ? 'Alert sent successfully' : 'Failed to send alert',
      sent
    });
  } catch (error) {
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
router.post('/trigger-job', authenticate, requireRole('admin'), async (req, res) => {
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

module.exports = router;
