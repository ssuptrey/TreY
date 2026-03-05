// ============================================
// EVIDENCE LIST COMPONENT
// ============================================
// Enhanced evidence display with prominent late flags

import React from 'react';

interface Evidence {
  id: string;
  file_name: string;
  uploaded_at: string;
  uploaded_by_name: string;
  is_late: boolean;
  sla_due_date_at_upload?: string;
  reference_note?: string;
}

interface EvidenceListProps {
  evidence: Evidence[];
  obligationId: string;
  downloadUrl: (obligationId: string, evidenceId: string) => string;
  onUpload?: () => void;
  canUpload?: boolean;
}

const EvidenceList: React.FC<EvidenceListProps> = ({ 
  evidence, 
  obligationId, 
  downloadUrl,
  onUpload,
  canUpload = true
}) => {
  const lateCount = evidence.filter(e => e.is_late).length;
  const onTimeCount = evidence.length - lateCount;
  const latePercentage = evidence.length > 0 ? Math.round((lateCount / evidence.length) * 100) : 0;

  return (
    <div className="evidence-section">
      <div className="evidence-header">
        <div className="header-left">
          <h3>Evidence Documents</h3>
          <span className="immutable-badge">
            <span className="lock-icon">■</span>
            APPEND-ONLY
          </span>
        </div>
        {canUpload && onUpload && (
          <button className="btn btn-sm btn-primary" onClick={onUpload}>
            + Upload Evidence
          </button>
        )}
      </div>

      {/* Evidence Summary Stats */}
      {evidence.length > 0 && (
        <div className="evidence-stats">
          <div className="stat-item on-time">
            <span className="stat-icon">✓</span>
            <span className="stat-value">{onTimeCount}</span>
            <span className="stat-label">On-Time</span>
          </div>
          <div className={`stat-item late ${lateCount > 0 ? 'has-late' : ''}`}>
            <span className="stat-icon">!</span>
            <span className="stat-value">{lateCount}</span>
            <span className="stat-label">Late</span>
          </div>
          {lateCount > 0 && (
            <div className="stat-item percentage critical">
              <span className="stat-value">{latePercentage}%</span>
              <span className="stat-label">Late Submission Rate</span>
            </div>
          )}
        </div>
      )}

      {/* Late Evidence Warning Banner */}
      {lateCount > 0 && (
        <div className="late-evidence-warning">
          <div className="warning-icon">!</div>
          <div className="warning-content">
            <div className="warning-title">Late Evidence Detected</div>
            <div className="warning-text">
              {lateCount} evidence file{lateCount > 1 ? 's were' : ' was'} uploaded after the SLA deadline.
              This may impact audit defensibility and compliance scoring.
            </div>
          </div>
          <div className="warning-badge">
            NOT DEFENSIBLE IN AUDIT
          </div>
        </div>
      )}

      {/* Evidence List */}
      {evidence.length === 0 ? (
        <div className="evidence-empty">
          <div className="empty-icon">—</div>
          <div className="empty-text">No evidence uploaded yet</div>
          <div className="empty-warning">
            Evidence is required for audit defensibility
          </div>
        </div>
      ) : (
        <div className="evidence-list">
          {evidence.map((e, index) => (
            <div 
              key={e.id} 
              className={`evidence-card ${e.is_late ? 'late' : 'on-time'}`}
            >
              <div className="evidence-number">#{index + 1}</div>
              
              <div className="evidence-main">
                <div className="evidence-file">
                  <span className="file-icon">■</span>
                  <span className="file-name">{e.file_name}</span>
                </div>
                
                <div className="evidence-meta">
                  <span className="meta-uploader">
                    Uploaded by <strong>{e.uploaded_by_name}</strong>
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="meta-date">
                    {new Date(e.uploaded_at).toLocaleString()}
                  </span>
                </div>

                {e.reference_note && (
                  <div className="evidence-note">
                    <span className="note-label">Note:</span>
                    <span className="note-text">{e.reference_note}</span>
                  </div>
                )}
              </div>

              <div className="evidence-status">
                {e.is_late ? (
                  <div className="status-late">
                    <div className="late-flag">
                      <span className="flag-icon">!</span>
                      <span className="flag-text">LATE SUBMISSION</span>
                    </div>
                    <div className="late-detail">
                      SLA was due: {new Date(e.sla_due_date_at_upload!).toLocaleDateString()}
                    </div>
                    <div className="late-impact">
                      Auto-flagged for audit review
                    </div>
                  </div>
                ) : (
                  <div className="status-on-time">
                    <span className="on-time-icon">✓</span>
                    <span className="on-time-text">ON TIME</span>
                  </div>
                )}
              </div>

              <div className="evidence-actions">
                <a 
                  href={downloadUrl(obligationId, e.id)}
                  className="btn btn-sm btn-outline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Immutability Notice */}
      <div className="evidence-footer">
        <div className="footer-icon">■</div>
        <div className="footer-text">
          Evidence cannot be modified or deleted after upload. 
          All uploads are permanently timestamped for regulatory compliance.
        </div>
      </div>
    </div>
  );
};

export default EvidenceList;
