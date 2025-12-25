// ============================================
// SLA ALERT SERVICE
// ============================================
// Basic, non-automated alerts for SLA deadlines (Core Value #6)
// 
// ENFORCEMENT:
// - Alerts are logged in audit_logs
// - Alerts respect user preferences
// - NO automated workflows
// - NO AI predictions
// - Simple time-based notifications only

const { pool } = require('../config/database');
const { createAuditLog, AuditActions } = require('./auditService');
const nodemailer = require('nodemailer');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

/**
 * Get obligations that need alerts
 * 
 * Alert thresholds:
 * - 7 days before SLA
 * - 3 days before SLA
 * - 1 day after SLA breach (overdue)
 */
async function getObligationsNeedingAlerts() {
  const query = `
    SELECT 
      o.id,
      o.title,
      o.description,
      o.regulation_tag,
      o.status,
      s.due_date,
      s.id as sla_id,
      (s.due_date - CURRENT_DATE) as days_remaining,
      oo.user_id as owner_id,
      u.name as owner_name,
      u.email as owner_email,
      org.name as organization_name,
      CASE 
        WHEN (s.due_date - CURRENT_DATE) = 7 THEN '7_DAYS_WARNING'
        WHEN (s.due_date - CURRENT_DATE) = 3 THEN '3_DAYS_WARNING'
        WHEN (s.due_date - CURRENT_DATE) = -1 THEN 'BREACH_ALERT'
        ELSE NULL
      END as alert_type
    FROM obligations o
    JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
    JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
    JOIN users u ON oo.user_id = u.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE o.status = 'open'
      AND (
        (s.due_date - CURRENT_DATE) = 7 OR
        (s.due_date - CURRENT_DATE) = 3 OR
        (s.due_date - CURRENT_DATE) = -1
      )
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Check if alert was already sent today for this obligation
 */
async function wasAlertSentToday(obligationId, alertType) {
  const query = `
    SELECT id 
    FROM audit_logs 
    WHERE entity_type = 'obligation'
      AND entity_id = $1
      AND action = $2
      AND timestamp::date = CURRENT_DATE
    LIMIT 1
  `;

  const result = await pool.query(query, [
    obligationId,
    `SLA_ALERT_${alertType}`
  ]);

  return result.rows.length > 0;
}

/**
 * Send SLA alert email
 */
async function sendAlertEmail(obligation) {
  const { alert_type, owner_email, owner_name, title, due_date, days_remaining, organization_name } = obligation;

  let subject, body;

  if (alert_type === '7_DAYS_WARNING') {
    subject = `⚠️ SLA Warning: 7 Days Remaining - ${title}`;
    body = `
Dear ${owner_name},

This is a reminder that the following compliance obligation is due in 7 days:

Obligation: ${title}
Due Date: ${new Date(due_date).toLocaleDateString('en-IN')}
Days Remaining: 7 days
Organization: ${organization_name}

Please ensure evidence is uploaded BEFORE the deadline to avoid late flagging.

---
This is an automated alert from your Compliance Execution System.
Do not reply to this email.
    `.trim();
  } else if (alert_type === '3_DAYS_WARNING') {
    subject = `🚨 URGENT: SLA Warning - 3 Days Remaining - ${title}`;
    body = `
Dear ${owner_name},

URGENT REMINDER: The following compliance obligation is due in 3 days:

Obligation: ${title}
Due Date: ${new Date(due_date).toLocaleDateString('en-IN')}
Days Remaining: 3 days
Organization: ${organization_name}

ACTION REQUIRED: Upload evidence immediately to avoid SLA breach.

---
This is an automated alert from your Compliance Execution System.
Do not reply to this email.
    `.trim();
  } else if (alert_type === 'BREACH_ALERT') {
    subject = `❌ SLA BREACHED: ${title}`;
    body = `
Dear ${owner_name},

CRITICAL: The following compliance obligation has BREACHED its SLA:

Obligation: ${title}
Due Date: ${new Date(due_date).toLocaleDateString('en-IN')}
Status: 1 day overdue
Organization: ${organization_name}

Any evidence uploaded now will be flagged as LATE.

Please update the obligation status or extend the SLA with proper justification.

---
This is an automated alert from your Compliance Execution System.
Do not reply to this email.
    `.trim();
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@compliance-system.com',
    to: owner_email,
    subject: subject,
    text: body
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error(`[ALERT] Failed to send email to ${owner_email}:`, error.message);
    return false;
  }
}

/**
 * Process SLA alerts for all obligations
 * Should be called by a cron job daily
 */
async function processSLAAlerts() {
  console.log('[ALERT] Starting SLA alert processing...');

  try {
    const obligations = await getObligationsNeedingAlerts();
    console.log(`[ALERT] Found ${obligations.length} obligations needing alerts`);

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const obligation of obligations) {
      // Check if alert already sent today
      const alreadySent = await wasAlertSentToday(obligation.id, obligation.alert_type);
      
      if (alreadySent) {
        console.log(`[ALERT] Alert already sent today for obligation ${obligation.id}, skipping`);
        skippedCount++;
        continue;
      }

      // Send email
      const emailSent = await sendAlertEmail(obligation);

      if (emailSent) {
        // Log alert in audit trail
        await createAuditLog({
          entityType: 'obligation',
          entityId: obligation.id,
          action: `SLA_ALERT_${obligation.alert_type}`,
          performedBy: obligation.owner_id,
          newValue: {
            alertType: obligation.alert_type,
            daysRemaining: obligation.days_remaining,
            dueDate: obligation.due_date,
            emailSent: true,
            recipientEmail: obligation.owner_email
          },
          additionalContext: {
            systemGenerated: true,
            cronJob: true
          }
        });

        console.log(`[ALERT] Sent ${obligation.alert_type} alert for obligation ${obligation.id} to ${obligation.owner_email}`);
        sentCount++;
      } else {
        // Log failed attempt
        await createAuditLog({
          entityType: 'obligation',
          entityId: obligation.id,
          action: `SLA_ALERT_${obligation.alert_type}_FAILED`,
          performedBy: obligation.owner_id,
          newValue: {
            alertType: obligation.alert_type,
            emailSent: false,
            error: 'Email delivery failed'
          },
          additionalContext: {
            systemGenerated: true,
            cronJob: true
          }
        });

        console.error(`[ALERT] Failed to send alert for obligation ${obligation.id}`);
        failedCount++;
      }
    }

    console.log(`[ALERT] Alert processing complete. Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
    
    return {
      total: obligations.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount
    };
  } catch (error) {
    console.error('[ALERT] Error processing SLA alerts:', error);
    throw error;
  }
}

/**
 * Get alert history for an obligation
 */
async function getAlertHistory(obligationId) {
  const query = `
    SELECT *
    FROM audit_logs
    WHERE entity_type = 'obligation'
      AND entity_id = $1
      AND action LIKE 'SLA_ALERT_%'
    ORDER BY timestamp DESC
  `;

  const result = await pool.query(query, [obligationId]);
  return result.rows;
}

/**
 * Manual alert trigger (for testing)
 */
async function sendManualAlert(obligationId, userId) {
  const query = `
    SELECT 
      o.id,
      o.title,
      s.due_date,
      (s.due_date - CURRENT_DATE) as days_remaining,
      u.email as owner_email,
      u.name as owner_name,
      org.name as organization_name
    FROM obligations o
    JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
    JOIN obligation_owners oo ON o.id = oo.obligation_id AND oo.is_current = true
    JOIN users u ON oo.user_id = u.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE o.id = $1
  `;

  const result = await pool.query(query, [obligationId]);
  
  if (result.rows.length === 0) {
    throw new Error('Obligation not found');
  }

  const obligation = result.rows[0];
  obligation.alert_type = 'MANUAL_ALERT';

  const emailSent = await sendAlertEmail({
    ...obligation,
    alert_type: '7_DAYS_WARNING' // Use standard template
  });

  if (emailSent) {
    await createAuditLog({
      entityType: 'obligation',
      entityId: obligationId,
      action: 'SLA_ALERT_MANUAL',
      performedBy: userId,
      newValue: {
        alertType: 'MANUAL',
        emailSent: true,
        recipientEmail: obligation.owner_email
      }
    });
  }

  return emailSent;
}

module.exports = {
  processSLAAlerts,
  getAlertHistory,
  sendManualAlert,
  getObligationsNeedingAlerts
};
