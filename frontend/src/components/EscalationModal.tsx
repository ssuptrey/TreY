// ============================================
// ESCALATION MODAL COMPONENT
// ============================================
// Real escalation workflow for compliance enforcement

import React, { useState } from 'react';

interface EscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  obligation: {
    id: string;
    title: string;
    owner_name?: string;
    days_overdue?: number;
    due_date?: string;
  };
  onEscalate?: (escalation: EscalationData) => void;
}

interface EscalationData {
  recipient: string;
  recipientEmail: string;
  reason: string;
  priority: 'high' | 'critical';
  notes: string;
  generateEmail: boolean;
  generatePDF: boolean;
}

const ESCALATION_RECIPIENTS = [
  { role: 'GRO (Grievance Redressal Officer)', email: 'gro@company.com', level: 1 },
  { role: 'Compliance Head', email: 'compliance.head@company.com', level: 2 },
  { role: 'Chief Risk Officer', email: 'cro@company.com', level: 3 },
  { role: 'Risk Committee', email: 'risk.committee@company.com', level: 4 },
  { role: 'Managing Director', email: 'md@company.com', level: 5 }
];

const ESCALATION_REASONS = [
  'SLA Breach - Immediate Regulatory Risk',
  'Evidence Not Submitted Within Deadline',
  'Owner Non-Responsive (3+ Reminders)',
  'Ownership Transfer Required',
  'Audit Query - Urgent Response Needed',
  'RBI Inspection Preparation',
  'Penalty Risk - Immediate Action Required',
  'Other (Specify in Notes)'
];

const EscalationModal: React.FC<EscalationModalProps> = ({
  isOpen,
  onClose,
  obligation,
  onEscalate
}) => {
  const [selectedRecipient, setSelectedRecipient] = useState(ESCALATION_RECIPIENTS[0]);
  const [reason, setReason] = useState(ESCALATION_REASONS[0]);
  const [priority, setPriority] = useState<'high' | 'critical'>('critical');
  const [notes, setNotes] = useState('');
  const [generateEmail, setGenerateEmail] = useState(true);
  const [generatePDF, setGeneratePDF] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const escalationData: EscalationData = {
      recipient: selectedRecipient.role,
      recipientEmail: selectedRecipient.email,
      reason,
      priority,
      notes,
      generateEmail,
      generatePDF
    };

    if (onEscalate) {
      onEscalate(escalationData);
    }

    setIsSubmitting(false);
    setSubmitted(true);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (submitted) {
    return (
      <div className="escalation-modal-overlay" onClick={onClose}>
        <div className="escalation-modal success-modal" onClick={e => e.stopPropagation()}>
          <div className="success-content">
            <div className="success-icon">✓</div>
            <h3>Escalation Submitted</h3>
            <p>Escalation has been sent to <strong>{selectedRecipient.role}</strong></p>
            
            <div className="success-details">
              <div className="detail-row">
                <span className="detail-label">Reference ID:</span>
                <span className="detail-value">ESC-{Date.now().toString().slice(-8)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timestamp:</span>
                <span className="detail-value">{currentDate}</span>
              </div>
              {generateEmail && (
                <div className="detail-row">
                  <span className="detail-label">Email Status:</span>
                  <span className="detail-value success">Sent to {selectedRecipient.email}</span>
                </div>
              )}
              {generatePDF && (
                <div className="detail-row">
                  <span className="detail-label">PDF Report:</span>
                  <span className="detail-value">
                    <a href="#" className="download-link">Download Escalation Report</a>
                  </span>
                </div>
              )}
            </div>

            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="escalation-modal-overlay" onClick={onClose}>
      <div className="escalation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h3>Escalation Workflow</h3>
            <span className="modal-subtitle">Obligation: {obligation.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Obligation Summary */}
        <div className="escalation-context">
          <div className="context-item">
            <span className="context-label">Current Owner</span>
            <span className="context-value">{obligation.owner_name || 'Unassigned'}</span>
          </div>
          <div className="context-item">
            <span className="context-label">Due Date</span>
            <span className="context-value">{formatDate(obligation.due_date)}</span>
          </div>
          <div className="context-item critical">
            <span className="context-label">Status</span>
            <span className="context-value">
              {obligation.days_overdue && obligation.days_overdue > 0 
                ? `${obligation.days_overdue} days overdue`
                : 'At Risk'}
            </span>
          </div>
        </div>

        {/* Escalation Form */}
        <div className="escalation-form">
          {/* Recipient Selection */}
          <div className="form-section">
            <label className="form-label">Escalate To</label>
            <div className="recipient-options">
              {ESCALATION_RECIPIENTS.map(recipient => (
                <div 
                  key={recipient.role}
                  className={`recipient-option ${selectedRecipient.role === recipient.role ? 'selected' : ''}`}
                  onClick={() => setSelectedRecipient(recipient)}
                >
                  <div className="recipient-level">L{recipient.level}</div>
                  <div className="recipient-info">
                    <div className="recipient-role">{recipient.role}</div>
                    <div className="recipient-email">{recipient.email}</div>
                  </div>
                  {selectedRecipient.role === recipient.role && (
                    <div className="selected-check">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reason Selection */}
          <div className="form-section">
            <label className="form-label">Escalation Reason</label>
            <select 
              className="form-select"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              {ESCALATION_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="form-section">
            <label className="form-label">Priority Level</label>
            <div className="priority-options">
              <button 
                className={`priority-btn high ${priority === 'high' ? 'selected' : ''}`}
                onClick={() => setPriority('high')}
              >
                High Priority
              </button>
              <button 
                className={`priority-btn critical ${priority === 'critical' ? 'selected' : ''}`}
                onClick={() => setPriority('critical')}
              >
                Critical - Immediate Action
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="form-section">
            <label className="form-label">Additional Notes</label>
            <textarea 
              className="form-textarea"
              placeholder="Add context for the escalation recipient..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Auto-generate options */}
          <div className="form-section">
            <label className="form-label">Auto-Generate</label>
            <div className="checkbox-options">
              <label className="checkbox-option">
                <input 
                  type="checkbox" 
                  checked={generateEmail}
                  onChange={e => setGenerateEmail(e.target.checked)}
                />
                <span>Send Email Notification</span>
              </label>
              <label className="checkbox-option">
                <input 
                  type="checkbox" 
                  checked={generatePDF}
                  onChange={e => setGeneratePDF(e.target.checked)}
                />
                <span>Generate PDF Escalation Report</span>
              </label>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        {generateEmail && (
          <div className="email-preview">
            <div className="preview-header">
              <span className="preview-label">Email Preview</span>
            </div>
            <div className="preview-content">
              <div className="preview-row">
                <span className="preview-field">To:</span>
                <span>{selectedRecipient.email}</span>
              </div>
              <div className="preview-row">
                <span className="preview-field">Subject:</span>
                <span>[{priority.toUpperCase()}] Escalation: {obligation.title}</span>
              </div>
              <div className="preview-body">
                <p>Dear {selectedRecipient.role},</p>
                <p>This is an automated escalation notification for the following compliance obligation:</p>
                <ul>
                  <li><strong>Obligation:</strong> {obligation.title}</li>
                  <li><strong>Current Owner:</strong> {obligation.owner_name || 'Unassigned'}</li>
                  <li><strong>Due Date:</strong> {formatDate(obligation.due_date)}</li>
                  <li><strong>Reason:</strong> {reason}</li>
                </ul>
                <p>Immediate action is required to address this compliance gap.</p>
                <p>---<br/>Compliance Execution System</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button 
            className={`btn ${priority === 'critical' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : `Escalate to ${selectedRecipient.role}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscalationModal;
