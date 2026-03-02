// ============================================
// NOTIFICATIONS PANEL COMPONENT
// ============================================
// Real-time enforcement notifications showing active alerts

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EscalationModal from './EscalationModal';

interface Notification {
  id: string;
  type: 'breach_imminent' | 'evidence_overdue' | 'ownership_ambiguity' | 'escalation' | 'breach_occurred';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  obligationId?: string;
  obligationTitle?: string;
  ownerName?: string;
  dueDate?: string;
  daysOverdue?: number;
  timestamp: Date;
  action?: string;
}

interface NotificationsPanelProps {
  obligations?: any[];
  collapsed?: boolean;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ obligations = [], collapsed = false }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [escalationObligation, setEscalationObligation] = useState<any>(null);

  // Generate notifications based on obligation data
  useEffect(() => {
    const generateNotifications = (): Notification[] => {
      const now = new Date();
      const alerts: Notification[] = [];

      obligations.forEach((obl) => {
        const daysRemaining = obl.days_remaining ?? obl.daysRemaining;
        const lateEvidence = obl.late_evidence_count ?? 0;
        const hasOwner = obl.owner_name !== null && obl.owner_name !== undefined;
        const status = obl.status?.toLowerCase() || obl.risk_status?.toLowerCase();

        // Breach imminent (within 48 hours = 2 days)
        if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 2 && status !== 'closed') {
          alerts.push({
            id: `breach-imminent-${obl.id}`,
            type: 'breach_imminent',
            severity: 'critical',
            title: 'SLA Breach Imminent',
            message: `SLA breach expected in ${daysRemaining * 24} hours`,
            obligationId: obl.id,
            obligationTitle: obl.title,
            ownerName: obl.owner_name,
            dueDate: obl.due_date,
            timestamp: now,
            action: 'Assign backup owner'
          });
        }

        // Already breached
        if (daysRemaining !== null && daysRemaining < 0 && status !== 'closed' && status !== 'breached') {
          alerts.push({
            id: `breach-occurred-${obl.id}`,
            type: 'breach_occurred',
            severity: 'critical',
            title: 'SLA Breached',
            message: `Overdue by ${Math.abs(daysRemaining)} days`,
            obligationId: obl.id,
            obligationTitle: obl.title,
            ownerName: obl.owner_name,
            dueDate: obl.due_date,
            daysOverdue: Math.abs(daysRemaining),
            timestamp: now,
            action: 'Escalate immediately'
          });
        }

        // Evidence overdue
        if (lateEvidence > 0) {
          alerts.push({
            id: `evidence-overdue-${obl.id}`,
            type: 'evidence_overdue',
            severity: 'warning',
            title: 'Evidence Overdue',
            message: `${lateEvidence} evidence file(s) uploaded after SLA deadline`,
            obligationId: obl.id,
            obligationTitle: obl.title,
            ownerName: obl.owner_name,
            dueDate: obl.due_date,
            timestamp: now,
            action: 'Review late submissions'
          });
        }

        // No owner assigned
        if (!hasOwner && status !== 'closed' && status !== 'breached') {
          alerts.push({
            id: `no-owner-${obl.id}`,
            type: 'ownership_ambiguity',
            severity: 'warning',
            title: 'Ownership Ambiguity',
            message: 'No owner currently assigned',
            obligationId: obl.id,
            obligationTitle: obl.title,
            dueDate: obl.due_date,
            timestamp: now,
            action: 'Assign owner now'
          });
        }

        // Escalation needed (at risk, 1-15 days)
        if (daysRemaining !== null && daysRemaining > 2 && daysRemaining <= 7 && status !== 'closed') {
          alerts.push({
            id: `escalation-${obl.id}`,
            type: 'escalation',
            severity: 'warning',
            title: 'Escalation Required',
            message: `Only ${daysRemaining} days remaining`,
            obligationId: obl.id,
            obligationTitle: obl.title,
            timestamp: now,
            action: 'Trigger escalation protocol'
          });
        }
      });

      // Sort by severity (critical first) then by timestamp
      return alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
    };

    setNotifications(generateNotifications());
  }, [obligations]);

  const getIconForType = (type: Notification['type']) => {
    switch (type) {
      case 'breach_imminent': return '!';
      case 'breach_occurred': return '!!';
      case 'evidence_overdue': return 'E';
      case 'ownership_ambiguity': return 'O';
      case 'escalation': return '^';
      default: return '*';
    }
  };

  const handleEscalate = (notification: Notification) => {
    setEscalationObligation({
      id: notification.obligationId,
      title: notification.obligationTitle,
      owner_name: notification.ownerName,
      due_date: notification.dueDate,
      days_overdue: notification.daysOverdue
    });
  };

  const criticalCount = notifications.filter(n => n.severity === 'critical').length;
  const warningCount = notifications.filter(n => n.severity === 'warning').length;

  return (
    <>
      <div className={`notifications-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="notifications-header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="header-left">
            <span className="header-icon">●</span>
            <span className="header-title">Enforcement Alerts</span>
            {notifications.length > 0 && (
              <div className="alert-counts">
                {criticalCount > 0 && (
                  <span className="count critical">{criticalCount}</span>
                )}
                {warningCount > 0 && (
                  <span className="count warning">{warningCount}</span>
                )}
              </div>
            )}
          </div>
          <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
        </div>

        {isExpanded && (
          <div className="notifications-body">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <span className="check-icon">—</span>
                <span>No active enforcement alerts</span>
              </div>
            ) : (
              <div className="notification-list">
                {notifications.slice(0, 10).map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`notification-item severity-${notification.severity}`}
                  >
                    <div className="notification-icon">
                      {getIconForType(notification.type)}
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      {notification.obligationTitle && (
                        <Link 
                          to={`/obligations/${notification.obligationId}`}
                          className="notification-obligation"
                        >
                          {notification.obligationTitle}
                        </Link>
                      )}
                      <div className="notification-message">{notification.message}</div>
                      {notification.action && notification.type === 'breach_occurred' ? (
                        <button 
                          className="escalate-btn"
                          onClick={() => handleEscalate(notification)}
                        >
                          <span className="action-arrow">→</span>
                          {notification.action}
                        </button>
                      ) : notification.action && (
                        <div className="notification-action">
                          <span className="action-arrow">→</span>
                          {notification.action}
                        </div>
                      )}
                    </div>
                    <div className={`notification-severity ${notification.severity}`}>
                      {notification.severity.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Escalation Modal */}
      {escalationObligation && (
        <EscalationModal
          isOpen={true}
          onClose={() => setEscalationObligation(null)}
          obligation={escalationObligation}
        />
      )}
    </>
  );
};

export default NotificationsPanel;
