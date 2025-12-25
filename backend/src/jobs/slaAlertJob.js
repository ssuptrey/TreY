// ============================================
// SLA ALERT CRON JOB
// ============================================
// Runs daily to process SLA alerts
// Uses node-cron for scheduling

const cron = require('node-cron');
const { processSLAAlerts } = require('../services/alertService');

/**
 * Schedule SLA alert job to run daily at 9 AM
 * Cron pattern: '0 9 * * *' = Every day at 9:00 AM
 */
function startSLAAlertJob() {
  console.log('[CRON] Scheduling SLA alert job to run daily at 9:00 AM');

  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log(`[CRON] Starting scheduled SLA alert job at ${new Date().toISOString()}`);
    
    try {
      const result = await processSLAAlerts();
      console.log('[CRON] SLA alert job completed:', result);
    } catch (error) {
      console.error('[CRON] SLA alert job failed:', error);
    }
  }, {
    timezone: process.env.TZ || 'Asia/Kolkata' // Indian Standard Time
  });

  console.log('[CRON] SLA alert job scheduled successfully');

  // Optional: Run immediately on startup in development
  if (process.env.NODE_ENV === 'development' && process.env.RUN_ALERTS_ON_STARTUP === 'true') {
    console.log('[CRON] Running SLA alerts on startup (development mode)');
    processSLAAlerts().catch(err => {
      console.error('[CRON] Startup alert job failed:', err);
    });
  }
}

/**
 * Manual trigger endpoint (for testing/admin use)
 */
async function triggerManualAlertJob() {
  console.log('[CRON] Manual SLA alert job triggered');
  return await processSLAAlerts();
}

module.exports = {
  startSLAAlertJob,
  triggerManualAlertJob
};
