// ============================================
// OBLIGATION DETAIL PAGE
// ============================================
// Shows: owner history, SLA history, evidence list, audit timeline

import React, { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { obligationsAPI, evidenceAPI, exportAPI, usersAPI, slaAPI } from '../api';

interface Owner {
  id: string;
  user_id: string;
  owner_name: string;
  owner_email: string;
  assigned_at: string;
  assigned_by_name: string;
  is_current: boolean;
  reassignment_reason?: string;
}

interface SLA {
  id: string;
  due_date: string;
  created_at: string;
  created_by_name: string;
  is_current: boolean;
  extension_reason?: string;
}

interface Evidence {
  id: string;
  file_name: string;
  uploaded_at: string;
  uploaded_by_name: string;
  is_late: boolean;
  sla_due_date_at_upload?: string;
  reference_note?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  performed_by_name: string;
  new_value?: Record<string, any>;
  previous_value?: Record<string, any>;
}

interface Obligation {
  id: string;
  title: string;
  description?: string;
  regulation_tag?: string;
  status: string;
  created_at: string;
  created_by_name: string;
  daysRemaining: number | null;
  riskStatus: string;
}

interface ObligationData {
  obligation: Obligation;
  ownerHistory: Owner[];
  currentOwner?: Owner;
  slaHistory: SLA[];
  currentSla?: SLA;
  evidence: Evidence[];
  auditTimeline: AuditLog[];
}

interface User {
  id: string;
  name: string;
}

const ObligationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Modal states
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [showExtendModal, setShowExtendModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const [obligationRes, usersRes] = await Promise.all([
        obligationsAPI.get(id!),
        usersAPI.list()
      ]);
      setData(obligationRes.data.data || null);
      setUsers(usersRes.data.data || []);
    } catch (err) {
      setError('Failed to load obligation details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="loading">Loading obligation details...</div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!data) {
    return <div className="alert alert-error">Obligation not found</div>;
  }

  const { obligation, ownerHistory, currentOwner, slaHistory, currentSla, evidence, auditTimeline } = data;

  const getRiskStatusClass = (): string => {
    if (obligation.status === 'breached') return 'red';
    if (obligation.status === 'closed') return 'closed';
    if (obligation.daysRemaining !== null && obligation.daysRemaining < 0) return 'red';
    if (obligation.daysRemaining !== null && obligation.daysRemaining <= 15) return 'amber';
    return 'green';
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <Link to="/obligations" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
            Back to Obligations
          </Link>
          <h1 style={{ marginTop: '8px' }}>{obligation.title}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a 
            href={exportAPI.obligationPdf(id!)} 
            className="btn btn-outline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Export PDF
          </a>
          <a 
            href={exportAPI.obligationZip(id!)} 
            className="btn btn-outline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Export ZIP
          </a>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`card status-${getRiskStatusClass()}`} style={{ 
        borderLeft: `4px solid ${
          getRiskStatusClass() === 'red' ? '#dc3545' :
          getRiskStatusClass() === 'amber' ? '#ffc107' :
          getRiskStatusClass() === 'green' ? '#28a745' : '#6c757d'
        }`,
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className={`status-badge status-${getRiskStatusClass()}`}>
              {obligation.riskStatus}
            </span>
            <span style={{ marginLeft: '16px', fontSize: '14px' }}>
              Status: <strong>{obligation.status.toUpperCase()}</strong>
            </span>
            {currentSla && obligation.status === 'open' && (
              <span style={{ marginLeft: '16px', fontSize: '14px' }}>
                Due: <strong>{new Date(currentSla.due_date).toLocaleDateString()}</strong>
                {' '}
                <span className={`days-remaining ${
                  obligation.daysRemaining !== null && obligation.daysRemaining < 0 ? 'negative' :
                  obligation.daysRemaining !== null && obligation.daysRemaining <= 15 ? 'warning' : 'safe'
                }`}>
                  ({obligation.daysRemaining !== null && obligation.daysRemaining < 0 
                    ? `${Math.abs(obligation.daysRemaining)} days overdue`
                    : `${obligation.daysRemaining} days remaining`})
                </span>
              </span>
            )}
          </div>
          {obligation.status === 'open' && (
            <button className="btn btn-sm btn-secondary" onClick={() => setShowStatusModal(true)}>
              Change Status
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column */}
        <div>
          {/* Obligation Info */}
          <div className="card">
            <div className="card-header">
              <h3>Obligation Details</h3>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">ID</div>
                <div className="value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {obligation.id}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">Regulation Tag</div>
                <div className="value">{obligation.regulation_tag || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">Created At</div>
                <div className="value">
                  {new Date(obligation.created_at).toLocaleString()}
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>(immutable)</span>
                </div>
              </div>
              <div className="detail-item">
                <div className="label">Created By</div>
                <div className="value">{obligation.created_by_name}</div>
              </div>
            </div>
            {obligation.description && (
              <div style={{ marginTop: '16px' }}>
                <div className="label">Description</div>
                <p style={{ marginTop: '4px' }}>{obligation.description}</p>
              </div>
            )}
          </div>

          {/* Current Owner */}
          <div className="card">
            <div className="card-header">
              <h3>Current Owner</h3>
              {obligation.status === 'open' && (
                <button className="btn btn-sm btn-outline" onClick={() => setShowReassignModal(true)}>
                  Reassign
                </button>
              )}
            </div>
            {currentOwner ? (
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="label">Name</div>
                  <div className="value">{currentOwner.owner_name}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Email</div>
                  <div className="value">{currentOwner.owner_email}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Assigned At</div>
                  <div className="value">{new Date(currentOwner.assigned_at).toLocaleString()}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Assigned By</div>
                  <div className="value">{currentOwner.assigned_by_name}</div>
                </div>
              </div>
            ) : (
              <p>No owner assigned</p>
            )}
          </div>

          {/* Owner History */}
          <div className="card">
            <div className="card-header">
              <h3>Owner History (Append-Only)</h3>
            </div>
            <div className="timeline">
              {ownerHistory.map((owner: any) => (
                <div key={owner.id} className="timeline-item">
                  <div className="time">
                    {new Date(owner.assigned_at).toLocaleString()}
                    {owner.is_current && <span className="status-badge status-green" style={{ marginLeft: '8px' }}>Current</span>}
                  </div>
                  <div className="action">{owner.owner_name}</div>
                  <div className="details">
                    Assigned by {owner.assigned_by_name}
                    {owner.reassignment_reason && (
                      <div>Reason: {owner.reassignment_reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SLA History */}
          <div className="card">
            <div className="card-header">
              <h3>SLA History (Append-Only)</h3>
              {obligation.status === 'open' && (
                <button className="btn btn-sm btn-outline" onClick={() => setShowExtendModal(true)}>
                  Extend SLA
                </button>
              )}
            </div>
            <div className="timeline">
              {slaHistory.map((sla: any) => (
                <div key={sla.id} className="timeline-item">
                  <div className="time">
                    Created: {new Date(sla.created_at).toLocaleString()}
                    {sla.is_current && <span className="status-badge status-green" style={{ marginLeft: '8px' }}>Current</span>}
                  </div>
                  <div className="action">Due Date: {new Date(sla.due_date).toLocaleDateString()}</div>
                  <div className="details">
                    Set by {sla.created_by_name}
                    {sla.extension_reason && (
                      <div>Extension Reason: {sla.extension_reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div className="card">
            <div className="card-header">
              <h3>Evidence (Append-Only)</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowUploadModal(true)}>
                Upload Evidence
              </button>
            </div>
            {evidence.length === 0 ? (
              <div className="empty-state">
                <p>No evidence uploaded yet</p>
              </div>
            ) : (
              <div>
                {evidence.map((e: any) => (
                  <div key={e.id} className={`evidence-item ${e.is_late ? 'late' : ''}`}>
                    <div className="file-info">
                      <div className="file-name">
                        {e.file_name}
                        {e.is_late && <span className="late-badge">LATE</span>}
                      </div>
                      <div className="file-meta">
                        Uploaded by {e.uploaded_by_name} on {new Date(e.uploaded_at).toLocaleString()}
                        {e.is_late && (
                          <span style={{ color: '#dc3545' }}>
                            {' '}(SLA was {new Date(e.sla_due_date_at_upload!).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                      {e.reference_note && (
                        <div className="file-meta">Note: {e.reference_note}</div>
                      )}
                    </div>
                    <a 
                      href={evidenceAPI.downloadUrl(id!, e.id)}
                      className="btn btn-sm btn-outline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Audit Timeline */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '24px' }}>
            <div className="card-header">
              <h3>Audit Timeline</h3>
            </div>
            <div className="timeline" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {auditTimeline.map((log: any) => (
                <div key={log.id} className="timeline-item">
                  <div className="time">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="action">{log.action.replace(/_/g, ' ')}</div>
                  <div className="details">
                    by {log.performed_by_name}
                    {log.new_value && typeof log.new_value === 'object' && log.new_value.reason && (
                      <div>Reason: {log.new_value.reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showReassignModal && (
        <ReassignModal 
          obligationId={id!}
          users={users}
          currentOwnerId={currentOwner?.user_id}
          onClose={() => setShowReassignModal(false)}
          onSuccess={() => { setShowReassignModal(false); loadData(); }}
        />
      )}

      {showExtendModal && (
        <ExtendSLAModal
          obligationId={id!}
          currentDueDate={currentSla?.due_date || ''}
          onClose={() => setShowExtendModal(false)}
          onSuccess={() => { setShowExtendModal(false); loadData(); }}
        />
      )}

      {showUploadModal && (
        <UploadEvidenceModal
          obligationId={id!}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => { setShowUploadModal(false); loadData(); }}
        />
      )}

      {showStatusModal && (
        <ChangeStatusModal
          obligationId={id!}
          onClose={() => setShowStatusModal(false)}
          onSuccess={() => { setShowStatusModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

// ============================================
// MODALS
// ============================================

interface ReassignModalProps {
  obligationId: string;
  users: User[];
  currentOwnerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ReassignModal: React.FC<ReassignModalProps> = ({ obligationId, users, currentOwnerId, onClose, onSuccess }) => {
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reassignment reason is required for audit trail');
      return;
    }
    setLoading(true);
    try {
      await obligationsAPI.reassignOwner(obligationId, newOwnerId, reason);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reassign owner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Reassign Owner</h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          This will create a new owner record. The previous owner record will remain in history.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Owner <span className="required">*</span></label>
            <select value={newOwnerId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewOwnerId(e.target.value)} required>
              <option value="">-- Select New Owner --</option>
              {users.filter(u => u.id !== currentOwnerId).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Reason <span className="required">*</span></label>
            <textarea 
              value={reason} 
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="Reason for reassignment (required for audit trail)"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Reassigning...' : 'Reassign Owner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ExtendSLAModalProps {
  obligationId: string;
  currentDueDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ExtendSLAModal: React.FC<ExtendSLAModalProps> = ({ obligationId, currentDueDate, onClose, onSuccess }) => {
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Minimum date is day after current due date
  const minDate = new Date(currentDueDate);
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Extension reason is required for audit trail');
      return;
    }
    setLoading(true);
    try {
      await slaAPI.extend(obligationId, newDueDate, reason);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to extend SLA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Extend SLA</h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Current due date: <strong>{new Date(currentDueDate).toLocaleDateString()}</strong>
          <br />
          This will create a new SLA record. The previous SLA remains in history.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Due Date <span className="required">*</span></label>
            <input 
              type="date" 
              value={newDueDate} 
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDueDate(e.target.value)}
              min={minDateStr}
              required
            />
            <p className="help-text">Must be after the current due date</p>
          </div>
          <div className="form-group">
            <label>Reason <span className="required">*</span></label>
            <textarea 
              value={reason} 
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="Reason for SLA extension (required for audit trail)"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Extending...' : 'Extend SLA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UploadEvidenceModalProps {
  obligationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const UploadEvidenceModal: React.FC<UploadEvidenceModalProps> = ({ obligationId, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [referenceNote, setReferenceNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }
    setLoading(true);
    try {
      await evidenceAPI.upload(obligationId, file, referenceNote);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload evidence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Upload Evidence</h2>
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>
          <strong>Note:</strong> Evidence uploaded after the SLA due date will be automatically flagged as late.
          Evidence cannot be replaced or deleted after upload.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>File <span className="required">*</span></label>
            <div className="file-upload" onClick={() => document.getElementById('evidence-file')?.click()}>
              <input 
                type="file" 
                id="evidence-file"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="selected-file">Selected: {file.name}</div>
              ) : (
                <div>Click to select a file</div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Reference Note</label>
            <textarea 
              value={referenceNote} 
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReferenceNote(e.target.value)}
              placeholder="Optional note about this evidence..."
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Uploading...' : 'Upload Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ChangeStatusModalProps {
  obligationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ChangeStatusModal: React.FC<ChangeStatusModalProps> = ({ obligationId, onClose, onSuccess }) => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    try {
      await obligationsAPI.updateStatus(obligationId, status);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Change Status</h2>
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <strong>Warning:</strong> This action cannot be undone. Once closed or marked breached,
          the obligation status cannot be changed back to open.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Status <span className="required">*</span></label>
            <select value={status} onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)} required>
              <option value="">-- Select Status --</option>
              <option value="closed">Closed (Completed successfully)</option>
              <option value="breached">Breached (Failed to meet SLA)</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={loading || !status}>
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ObligationDetail;
