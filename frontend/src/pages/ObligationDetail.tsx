// ============================================
// OBLIGATION DETAIL PAGE
// ============================================
// Shows: owner history, SLA history, evidence list, audit timeline

import React, { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { obligationsAPI, evidenceAPI, exportAPI, usersAPI, slaAPI } from '../api';
import SLAClock from '../components/SLAClock';
import OwnershipTimeline from '../components/OwnershipTimeline';
import EvidenceList from '../components/EvidenceList';
import '../styles/EvidenceList.css';

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
  category_code?: string;
  category_name?: string;
  category_department?: string;
  category_priority?: string;
  regulation_reference?: string;
  ingestion_source?: string;
}

/** Produce a short fake hash from a string (demo only — not cryptographic) */
const fakeHash = (input: string): string => {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 8).padStart(8, '0');
};

/** Human-friendly relative time */
const timeAgo = (dateStr: string): string => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

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
  const [data, setData] = useState<ObligationData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  
  // Modal states
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [showExtendModal, setShowExtendModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showExportPreview, setShowExportPreview] = useState<boolean>(false);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const [obligationRes, usersRes] = await Promise.all([
        obligationsAPI.get(id!),
        usersAPI.list()
      ]);
      setData(obligationRes.data as any || null);
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

  // Auto-hide overlay after 4 seconds
  useEffect(() => {
    if (showOverlay) {
      const timer = setTimeout(() => setShowOverlay(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showOverlay]);

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

  const getSeverityTag = (): { label: string; class: string } => {
    if (obligation.status === 'breached') return { label: 'REGULATORY BREACH', class: 'critical' };
    if (obligation.daysRemaining !== null && obligation.daysRemaining < 0) return { label: 'OVERDUE - AUDIT EXPOSURE', class: 'critical' };
    if (obligation.daysRemaining !== null && obligation.daysRemaining <= 7) return { label: 'CRITICAL - IMMEDIATE ACTION', class: 'critical' };
    if (obligation.daysRemaining !== null && obligation.daysRemaining <= 15) return { label: 'AT RISK - ESCALATION NEEDED', class: 'warning' };
    return { label: 'ON TRACK', class: 'safe' };
  };

  const severityTag = getSeverityTag();

  return (
    <div className="obligation-detail-page">

      {/* Demo Overlay — auto-fades */}
      {showOverlay && (
        <div className="demo-proof-overlay">
          <span className="demo-proof-text">SLA assigned. Owner mapped. Logged for audit.</span>
        </div>
      )}

      {/* Live Intake Banner — makes the complaint feel captured in real-time */}
      <div className="od-intake-banner">
        <div className="od-intake-item">
          <span className="od-intake-icon od-intake-icon--source">
            {(obligation.ingestion_source || 'manual') === 'email' ? 'EM' :
             (obligation.ingestion_source || 'manual') === 'whatsapp' ? 'WA' :
             (obligation.ingestion_source || 'manual') === 'csv' ? 'CSV' :
             (obligation.ingestion_source || 'manual') === 'api' ? 'API' :
             (obligation.ingestion_source || 'manual') === 'forward' ? 'FW' : 'MAN'}
          </span>
          <div>
            <span className="od-intake-label">SOURCE</span>
            <span className="od-intake-value">{(obligation.ingestion_source || 'manual').charAt(0).toUpperCase() + (obligation.ingestion_source || 'manual').slice(1)}</span>
          </div>
        </div>
        <div className="od-intake-divider" />
        <div className="od-intake-item">
          <span className="od-intake-icon od-intake-icon--time">IN</span>
          <div>
            <span className="od-intake-label">INGESTED</span>
            <span className="od-intake-value od-intake-value--live">{timeAgo(obligation.created_at)}</span>
          </div>
        </div>
        <div className="od-intake-divider" />
        <div className="od-intake-item">
          <span className={`od-intake-icon od-intake-icon--status od-intake-icon--status-${obligation.status}`}>
            {obligation.status === 'open' ? (obligation.category_name ? 'CL' : 'UC') : obligation.status === 'closed' ? 'OK' : '!!'}
          </span>
          <div>
            <span className="od-intake-label">STATUS</span>
            <span className="od-intake-value">
              {obligation.category_name ? obligation.category_name : obligation.status === 'open' ? 'Unclassified' : obligation.status.charAt(0).toUpperCase() + obligation.status.slice(1)}
            </span>
          </div>
        </div>
        <div className="od-intake-divider" />
        <div className="od-intake-item">
          <span className="od-intake-icon od-intake-icon--owner">
            {currentOwner ? currentOwner.owner_name.split(' ').map(n => n[0]).join('') : '--'}
          </span>
          <div>
            <span className="od-intake-label">OWNER</span>
            <span className="od-intake-value">{currentOwner ? currentOwner.owner_name : 'Unassigned'}</span>
          </div>
        </div>
        <div className="od-intake-divider" />
        <div className="od-intake-item">
          <span className="od-intake-icon od-intake-icon--sla">SLA</span>
          <div>
            <span className="od-intake-label">DUE DATE</span>
            <span className="od-intake-value">
              {currentSla ? new Date(currentSla.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="od-header">
        <div className="od-header__left">
          <Link to="/obligations" className="od-back-link">Back to Obligations</Link>
          <h1 className="od-title">{obligation.title}</h1>
          <div className="od-meta">
            <span className={`od-severity od-severity--${severityTag.class}`}>
              {severityTag.label}
            </span>
            {currentOwner && (
              <span className="od-owner-pill">
                Owned by <strong>{currentOwner.owner_name}</strong>
              </span>
            )}
          </div>
        </div>
        <button className="od-export-btn" onClick={() => setShowExportPreview(true)}>
          Export Audit Package
        </button>
      </div>

      {/* Two-Column Layout */}
      <div className="od-grid">
        {/* Left Column */}
        <div className="od-main">
          {/* Status Banner */}
          <div className={`od-status-banner od-status-banner--${getRiskStatusClass()}`}>
            <div className="od-status-banner__left">
              <span className={`od-risk-badge od-risk-badge--${getRiskStatusClass()}`}>
                {obligation.riskStatus}
              </span>
              <span className="od-status-text">
                Status: <strong>{obligation.status.toUpperCase()}</strong>
              </span>
              {currentSla && obligation.status === 'open' && (
                <span className="od-due-text">
                  Due: <strong>{new Date(currentSla.due_date) .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }</strong>
                  {' '}
                  <span className={`od-days ${
                    obligation.daysRemaining !== null && obligation.daysRemaining < 0 ? 'od-days--neg' :
                    obligation.daysRemaining !== null && obligation.daysRemaining <= 15 ? 'od-days--warn' : 'od-days--ok'
                  }`}>
                    ({obligation.daysRemaining !== null && obligation.daysRemaining < 0 
                      ? `${Math.abs(obligation.daysRemaining)} days overdue`
                      : `${obligation.daysRemaining} days remaining`})
                  </span>
                </span>
              )}
            </div>
            {obligation.status === 'open' && (
              <button className="od-status-btn" onClick={() => setShowStatusModal(true)}>
                Change Status
              </button>
            )}
          </div>

          {/* Obligation Details Card */}
          <div className="od-card">
            <div className="od-card__header">
              <h3>Obligation Details</h3>
            </div>
            <div className="od-detail-grid">
              <div className="od-detail-item">
                <div className="od-detail-label">ID</div>
                <div className="od-detail-value od-detail-value--mono">{obligation.id}</div>
              </div>
              <div className="od-detail-item">
                <div className="od-detail-label">Regulation Tag</div>
                <div className="od-detail-value">{obligation.regulation_tag || '—'}</div>
              </div>
              <div className="od-detail-item">
                <div className="od-detail-label">Created At</div>
                <div className="od-detail-value">
                  {new Date(obligation.created_at) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }
                  <span className="od-immutable-tag">immutable</span>
                </div>
              </div>
              <div className="od-detail-item">
                <div className="od-detail-label">Created By</div>
                <div className="od-detail-value">{obligation.created_by_name}</div>
              </div>
            </div>
            {obligation.description && (
              <div className="od-description">
                <div className="od-detail-label">Description</div>
                <p className="od-description-text">{obligation.description}</p>
              </div>
            )}
          </div>

          {/* NBFC Regulation Reference */}
          <div className="od-card">
            <div className="od-card__header">
              <h3>Regulation Reference</h3>
              <span className="od-badge od-badge--blue">NBFC Compliance</span>
            </div>
            <div className="od-reg-grid">
              <div className="od-reg-item">
                <div className="od-detail-label">RBI Circular Number</div>
                <div className="od-detail-value">
                  {obligation.regulation_tag?.includes('RBI') 
                    ? `RBI/2024-25/${obligation.id.toString().padStart(3, '0')}`
                    : 'RBI/2024-25/001'}
                </div>
              </div>
              <div className="od-reg-item">
                <div className="od-detail-label">Master Direction / Act</div>
                <div className="od-detail-value">
                  {obligation.regulation_tag === 'RBI Master Direction' 
                    ? 'Master Direction - Non-Banking Financial Company - Systemically Important Non-Deposit taking Company (Reserve Bank) Directions, 2016'
                    : obligation.regulation_tag === 'Fair Practice Code'
                    ? 'Fair Practices Code for NBFCs - RBI/DNBR/2016-17/45'
                    : obligation.regulation_tag === 'KYC-AML Guidelines'
                    ? 'Master Direction - Know Your Customer (KYC) Direction, 2016'
                    : 'Scale Based Regulation (SBR) Framework for NBFCs'}
                </div>
              </div>
              <div className="od-reg-item">
                <div className="od-detail-label">Applicable Clause</div>
                <div className="od-detail-value od-detail-value--highlight">
                  Section 45-IA of RBI Act, 1934 &bull; Chapter III, Clause 6(b)
                </div>
              </div>
              <div className="od-reg-item od-reg-item--penalty">
                <div className="od-detail-label">Penalty Exposure</div>
                <div className="od-detail-value od-detail-value--penalty">
                  Non-compliance: Up to &#8377;1 Crore per instance + potential license revocation
                </div>
              </div>
            </div>
            <div className="od-reg-source">
              <span className="od-reg-source__label">Source of Truth:</span>
              <a href="https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx" target="_blank" rel="noopener noreferrer" className="od-reg-source__link">
                RBI Master Directions Portal
              </a>
            </div>
          </div>

          {/* Ownership Timeline */}
          <OwnershipTimeline 
            owners={ownerHistory}
            obligationCreatedAt={obligation.created_at}
          />
          {obligation.status === 'open' && (
            <div className="od-action-row">
              <button className="od-outline-btn" onClick={() => setShowReassignModal(true)}>
                Reassign Owner
              </button>
            </div>
          )}

          {/* SLA History */}
          <div className="od-card">
            <div className="od-card__header">
              <h3>SLA History</h3>
              <div className="od-card__actions">
                <span className="od-append-badge">APPEND-ONLY</span>
                {obligation.status === 'open' && (
                  <button className="od-outline-btn od-outline-btn--sm" onClick={() => setShowExtendModal(true)}>
                    Extend SLA
                  </button>
                )}
              </div>
            </div>
            <div className="od-timeline">
              {slaHistory.map((sla) => (
                <div key={sla.id} className="od-timeline-item">
                  <div className="od-timeline-dot" />
                  <div className="od-timeline-content">
                    <div className="od-timeline-time">
                      {new Date(sla.created_at) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }
                      {sla.is_current && <span className="od-badge od-badge--green">Current</span>}
                    </div>
                    <div className="od-timeline-action">Due Date: {new Date(sla.due_date) .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }</div>
                    <div className="od-timeline-detail">Set by {sla.created_by_name}</div>
                    {sla.extension_reason && (
                      <div className="od-extension-reason">
                        <strong>Extension Reason:</strong> {sla.extension_reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Section */}
          <EvidenceList
            evidence={evidence}
            obligationId={id!}
            downloadUrl={evidenceAPI.downloadUrl}
            onUpload={() => setShowUploadModal(true)}
            canUpload={obligation.status === 'open'}
          />
        </div>

        {/* Right Column */}
        <div className="od-sidebar">
          {/* Decision Record */}
          <div className="od-card od-card--decision">
            <div className="od-card__header">
              <h3>DECISION RECORD</h3>
              <span className="od-append-badge">IMMUTABLE</span>
            </div>
            <div className="od-decisions">
              {auditTimeline.filter(log => 
                ['OWNER_ASSIGN', 'OWNER_REASSIGN', 'SLA_EXTEND', 'OBLIGATION_STATUS_CHANGE', 'STATUS_CHANGED', 'EVIDENCE_UPLOAD', 'EVIDENCE_LATE_UPLOAD', 'ESCALATION_TRIGGERED', 'OBLIGATION_CREATE'].includes(log.action)
              ).length > 0 ? (
                auditTimeline
                  .filter(log => ['OWNER_ASSIGN', 'OWNER_REASSIGN', 'SLA_EXTEND', 'OBLIGATION_STATUS_CHANGE', 'STATUS_CHANGED', 'EVIDENCE_UPLOAD', 'EVIDENCE_LATE_UPLOAD', 'ESCALATION_TRIGGERED', 'OBLIGATION_CREATE'].includes(log.action))
                  .slice(0, 5)
                  .map((log) => (
                    <div key={log.id} className="od-decision">
                      <div className="od-decision__icon">
                        {log.action === 'OBLIGATION_CREATE' && '\u25CF'}
                        {(log.action === 'OWNER_ASSIGN' || log.action === 'OWNER_REASSIGN') && '\u2192'}
                        {log.action === 'SLA_EXTEND' && '\u27F3'}
                        {(log.action === 'EVIDENCE_UPLOAD' || log.action === 'EVIDENCE_LATE_UPLOAD') && '\u2191'}
                        {(log.action === 'OBLIGATION_STATUS_CHANGE' || log.action === 'STATUS_CHANGED') && '\u25CF'}
                        {log.action === 'ESCALATION_TRIGGERED' && '!'}
                      </div>
                      <div className="od-decision__body">
                        <div className="od-decision__action">
                          {log.action === 'OBLIGATION_CREATE' && 'Obligation created'}
                          {(log.action === 'OWNER_ASSIGN' || log.action === 'OWNER_REASSIGN') && `Assigned to ${users?.find(u => u.id === log.new_value?.user_id)?.name || log.new_value?.new_owner || 'new owner'}`}
                          {log.action === 'SLA_EXTEND' && `SLA extended to ${log.new_value?.new_due_date || 'new date'}`}
                          {(log.action === 'EVIDENCE_UPLOAD' || log.action === 'EVIDENCE_LATE_UPLOAD') && `Evidence uploaded: ${log.new_value?.fileName || log.new_value?.file_name || 'document'}`}
                          {(log.action === 'OBLIGATION_STATUS_CHANGE' || log.action === 'STATUS_CHANGED') && `Status changed to ${log.new_value?.status || 'updated'}`}
                          {log.action === 'ESCALATION_TRIGGERED' && `Escalated to ${log.new_value?.level || 'L2'}`}
                        </div>
                        <div className="od-decision__meta">
                          <span>{log.performed_by_name}</span>
                          <span>{new Date(log.timestamp) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }</span>
                        </div>
                        {log.new_value?.reason && (
                          <div className="od-decision__reason">Reason: {log.new_value.reason}</div>
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <>
                  <div className="od-decision">
                    <div className="od-decision__icon">{'\u25CF'}</div>
                    <div className="od-decision__body">
                      <div className="od-decision__action">Obligation created</div>
                      <div className="od-decision__meta">
                        <span>{obligation.created_by_name}</span>
                        <span>{new Date(obligation.created_at) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }</span>
                      </div>
                    </div>
                  </div>
                  {currentOwner && (
                    <div className="od-decision">
                      <div className="od-decision__icon">{'\u2192'}</div>
                      <div className="od-decision__body">
                        <div className="od-decision__action">Assigned to {currentOwner.owner_name}</div>
                        <div className="od-decision__meta">
                          <span>{currentOwner.assigned_by_name}</span>
                          <span>{new Date(currentOwner.assigned_at) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentSla && (
                    <div className="od-decision">
                      <div className="od-decision__icon">{'\u27F3'}</div>
                      <div className="od-decision__body">
                        <div className="od-decision__action">SLA set: {new Date(currentSla.due_date) .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }</div>
                        <div className="od-decision__meta">
                          <span>{currentSla.created_by_name}</span>
                          <span>{new Date(currentSla.created_at) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }</span>
                        </div>
                        {currentSla.extension_reason && (
                          <div className="od-decision__reason">Reason: {currentSla.extension_reason}</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* SLA Clock */}
          {currentSla && (
            <div className="od-sla-clock-wrap">
              <SLAClock
                dueDate={currentSla.due_date}
                createdAt={obligation.created_at}
                status={obligation.status}
              />
            </div>
          )}

          {/* Forensic Audit Record */}
          <div className="od-card od-card--sticky od-card--audit">
            <div className="od-card__header">
              <h3>AUDIT RECORD</h3>
              <span className="od-audit-immutable">IMMUTABLE</span>
            </div>
            <div className="od-audit-log">
              {auditTimeline.map((log) => {
                const ts = new Date(log.timestamp);
                const eventLabel = log.action.replace(/_/g, ' ');
                const hash = fakeHash(log.id + log.action + log.timestamp);
                return (
                  <div key={log.id} className="od-audit-entry">
                    <div className="od-audit-entry__time">
                      {ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </div>
                    <div className="od-audit-entry__body">
                      <div className="od-audit-entry__event">{eventLabel}</div>
                      <div className="od-audit-entry__user">{log.performed_by_name}</div>
                      <div className="od-audit-entry__meta">
                        <span className="od-audit-entry__date">
                          {ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="od-audit-entry__hash">HASH: {hash}</span>
                      </div>
                      {log.new_value && typeof log.new_value === 'object' && log.new_value.reason && (
                        <div className="od-audit-entry__reason">Reason: {log.new_value.reason}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {auditTimeline.length === 0 && (
                <div className="od-audit-empty">No audit entries yet</div>
              )}
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

      {showExportPreview && (
        <ExportPreviewModal
          obligationId={id!}
          obligation={obligation}
          evidence={evidence}
          ownerHistory={ownerHistory}
          slaHistory={slaHistory}
          onClose={() => setShowExportPreview(false)}
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
          Current due date: <strong>{new Date(currentDueDate) .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }</strong>
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
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'valid' | 'warning'>('pending');

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      validateFile(droppedFile);
    }
  };

  const validateFile = (f: File): void => {
    // Simulate validation
    if (f.size > 10 * 1024 * 1024) { // 10MB
      setValidationStatus('warning');
    } else {
      setValidationStatus('valid');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      validateFile(selectedFile);
    }
  };

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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <h2>Upload Evidence</h2>
        
        {/* Evidence Upload Rules */}
        <div className="evidence-rules">
          <div className="rule-header">EVIDENCE UPLOAD PROTOCOL</div>
          <div className="rule-items">
            <div className="rule-item">
              <span className="rule-icon">■</span>
              <span>Upload timestamp is immutable and locked at submission</span>
            </div>
            <div className="rule-item">
              <span className="rule-icon">■</span>
              <span>Evidence uploaded after SLA due date flagged as LATE</span>
            </div>
            <div className="rule-item">
              <span className="rule-icon">■</span>
              <span>Files cannot be replaced or deleted after upload</span>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          {/* Drag & Drop Zone */}
          <div 
            className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('evidence-file')?.click()}
          >
            <input 
              type="file" 
              id="evidence-file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {!file ? (
              <>
                <div className="drop-icon">↑</div>
                <div className="drop-text">Drag & drop file here</div>
                <div className="drop-subtext">or click to browse</div>
                <div className="drop-formats">Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 10MB)</div>
              </>
            ) : (
              <div className="file-preview">
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">{formatFileSize(file.size)}</div>
                </div>
                <div className={`validation-badge ${validationStatus}`}>
                  {validationStatus === 'valid' && '✓ Valid'}
                  {validationStatus === 'warning' && '! Large file'}
                  {validationStatus === 'pending' && '○ Validating...'}
                </div>
              </div>
            )}
          </div>

          {/* Auto-captured metadata */}
          <div className="auto-metadata">
            <div className="metadata-header">AUTO-CAPTURED METADATA</div>
            <div className="metadata-grid">
              <div className="metadata-item">
                <span className="metadata-label">Upload Timestamp</span>
                <span className="metadata-value">{new Date() .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) } IST</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Uploaded By</span>
                <span className="metadata-value">Current User (logged)</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Late Status</span>
                <span className="metadata-value">Will be calculated on upload</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Reference Note</label>
            <textarea 
              value={referenceNote} 
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReferenceNote(e.target.value)}
              placeholder="Optional: Describe what this evidence demonstrates or references..."
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !file}>
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
  const [showEscalation, setShowEscalation] = useState<boolean>(false);
  const [escalationLevel, setEscalationLevel] = useState<string>('L1');
  const [escalationReason, setEscalationReason] = useState<string>('');

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

  const handleEscalation = async (): Promise<void> => {
    setLoading(true);
    try {
      // API call for escalation would go here
      // For now, we simulate success
      await new Promise(resolve => setTimeout(resolve, 500));
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to escalate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-tabs">
          <button 
            className={`modal-tab ${!showEscalation ? 'active' : ''}`}
            onClick={() => setShowEscalation(false)}
          >
            Change Status
          </button>
          <button 
            className={`modal-tab ${showEscalation ? 'active' : ''}`}
            onClick={() => setShowEscalation(true)}
          >
            Escalate
          </button>
        </div>

        {!showEscalation ? (
          <>
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
          </>
        ) : (
          <>
            <h2>Escalation Workflow</h2>
            <div className="escalation-flow">
              <div className="escalation-levels">
                <div 
                  className={`escalation-level ${escalationLevel === 'L1' ? 'selected' : ''}`}
                  onClick={() => setEscalationLevel('L1')}
                >
                  <div className="level-header">
                    <span className="level-badge">L1</span>
                    <span className="level-name">Manager Escalation</span>
                  </div>
                  <div className="level-desc">Notify department manager for immediate attention</div>
                  <div className="level-sla">Response SLA: 4 hours</div>
                </div>
                <div className="escalation-arrow">↓</div>
                <div 
                  className={`escalation-level ${escalationLevel === 'L2' ? 'selected' : ''}`}
                  onClick={() => setEscalationLevel('L2')}
                >
                  <div className="level-header">
                    <span className="level-badge">L2</span>
                    <span className="level-name">Compliance Head</span>
                  </div>
                  <div className="level-desc">Escalate to Compliance Head for regulatory risk review</div>
                  <div className="level-sla">Response SLA: 2 hours</div>
                </div>
                <div className="escalation-arrow">↓</div>
                <div 
                  className={`escalation-level ${escalationLevel === 'L3' ? 'selected' : ''}`}
                  onClick={() => setEscalationLevel('L3')}
                >
                  <div className="level-header">
                    <span className="level-badge critical">L3</span>
                    <span className="level-name">CRO / Board Level</span>
                  </div>
                  <div className="level-desc">Critical escalation to Chief Risk Officer</div>
                  <div className="level-sla">Response SLA: 1 hour</div>
                </div>
              </div>
              <div className="escalation-form">
                <div className="form-group">
                  <label>Escalation Reason <span className="required">*</span></label>
                  <textarea 
                    value={escalationReason} 
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEscalationReason(e.target.value)}
                    placeholder="Describe the reason for escalation and urgency level..."
                    required
                  />
                </div>
                <div className="escalation-summary">
                  <div className="summary-row">
                    <span className="summary-label">Escalation Level:</span>
                    <span className="summary-value">{escalationLevel}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Notified Role:</span>
                    <span className="summary-value">
                      {escalationLevel === 'L1' && 'Department Manager'}
                      {escalationLevel === 'L2' && 'Compliance Head'}
                      {escalationLevel === 'L3' && 'Chief Risk Officer'}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Timestamp:</span>
                    <span className="summary-value">{new Date() .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }</span>
                  </div>
                </div>
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-danger" 
                disabled={loading || !escalationReason.trim()}
                onClick={handleEscalation}
              >
                {loading ? 'Escalating...' : `Escalate to ${escalationLevel}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// EXPORT PREVIEW MODAL
// ============================================
interface ExportPreviewModalProps {
  obligationId: string;
  obligation: Obligation;
  evidence: Evidence[];
  ownerHistory: Owner[];
  slaHistory: SLA[];
  onClose: () => void;
}

const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({ 
  obligationId, 
  obligation, 
  evidence, 
  ownerHistory, 
  slaHistory, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'zip'>('pdf');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="export-preview-header">
          <h2>AUDIT EXPORT PACKAGE</h2>
          <div className="export-badge">Regulatory Ready</div>
        </div>

        <div className="export-tabs">
          <button 
            className={`export-tab ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            PDF Report
          </button>
          <button 
            className={`export-tab ${activeTab === 'zip' ? 'active' : ''}`}
            onClick={() => setActiveTab('zip')}
          >
            Evidence Bundle (ZIP)
          </button>
        </div>

        {activeTab === 'pdf' ? (
          <div className="export-preview-content">
            <div className="pdf-preview">
              <div className="pdf-page">
                <div className="pdf-header">
                  <div className="pdf-logo">COMPLIANCE EXECUTION SYSTEM</div>
                  <div className="pdf-title">REGULATORY COMPLIANCE REPORT</div>
                  <div className="pdf-subtitle">Obligation Audit Trail</div>
                </div>
                
                <div className="pdf-section">
                  <div className="pdf-section-title">OBLIGATION DETAILS</div>
                  <div className="pdf-table">
                    <div className="pdf-row">
                      <span className="pdf-label">Title:</span>
                      <span className="pdf-value">{obligation.title}</span>
                    </div>
                    <div className="pdf-row">
                      <span className="pdf-label">ID:</span>
                      <span className="pdf-value">{obligation.id}</span>
                    </div>
                    <div className="pdf-row">
                      <span className="pdf-label">Regulation Tag:</span>
                      <span className="pdf-value">{obligation.regulation_tag || 'N/A'}</span>
                    </div>
                    <div className="pdf-row">
                      <span className="pdf-label">Status:</span>
                      <span className="pdf-value">{obligation.status.toUpperCase()}</span>
                    </div>
                    <div className="pdf-row">
                      <span className="pdf-label">Created:</span>
                      <span className="pdf-value">{new Date(obligation.created_at) .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }</span>
                    </div>
                  </div>
                </div>

                <div className="pdf-section">
                  <div className="pdf-section-title">OWNERSHIP HISTORY ({ownerHistory.length} records)</div>
                  <div className="pdf-mini-table">
                    <div className="pdf-mini-header">
                      <span>Owner</span>
                      <span>Assigned</span>
                      <span>By</span>
                    </div>
                    {ownerHistory.slice(0, 3).map((owner, idx) => (
                      <div key={idx} className="pdf-mini-row">
                        <span>{owner.owner_name}</span>
                        <span>{new Date(owner.assigned_at) .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }</span>
                        <span>{owner.assigned_by_name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pdf-section">
                  <div className="pdf-section-title">SLA HISTORY ({slaHistory.length} records)</div>
                  <div className="pdf-mini-table">
                    <div className="pdf-mini-header">
                      <span>Due Date</span>
                      <span>Set By</span>
                      <span>Reason</span>
                    </div>
                    {slaHistory.slice(0, 3).map((sla, idx) => (
                      <div key={idx} className="pdf-mini-row">
                        <span>{new Date(sla.due_date) .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }</span>
                        <span>{sla.created_by_name}</span>
                        <span>{sla.extension_reason || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pdf-section">
                  <div className="pdf-section-title">EVIDENCE RECORDS ({evidence.length} files)</div>
                  <div className="pdf-evidence-list">
                    {evidence.slice(0, 4).map((ev, idx) => (
                      <div key={idx} className="pdf-evidence-item">
                        <span className="pdf-file-icon">■</span>
                        <span>{ev.file_name}</span>
                        <span className={ev.is_late ? 'pdf-late' : 'pdf-ontime'}>
                          {ev.is_late ? 'LATE' : 'ON-TIME'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pdf-footer">
                  <div className="pdf-footer-line">
                    Generated: {new Date() .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) } | System of Record - Immutable Audit Trail
                  </div>
                  <div className="pdf-footer-line">
                    This document is cryptographically signed and admissible in regulatory proceedings
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="export-preview-content">
            <div className="zip-preview">
              <div className="folder-structure">
                <div className="folder-title">{obligation.title.slice(0, 30)}_{obligation.id.slice(0, 8)}.zip</div>
                <div className="folder-tree">
                  <div className="tree-item folder">
                    <span className="tree-icon tree-icon--folder"></span>
                    <span className="tree-name">/audit_report</span>
                  </div>
                  <div className="tree-item file indent-1">
                    <span className="tree-icon tree-icon--file"></span>
                    <span className="tree-name">obligation_report.pdf</span>
                    <span className="tree-meta">Complete audit trail</span>
                  </div>
                  <div className="tree-item file indent-1">
                    <span className="tree-icon tree-icon--file"></span>
                    <span className="tree-name">ownership_history.csv</span>
                    <span className="tree-meta">{ownerHistory.length} records</span>
                  </div>
                  <div className="tree-item file indent-1">
                    <span className="tree-icon tree-icon--file"></span>
                    <span className="tree-name">sla_history.csv</span>
                    <span className="tree-meta">{slaHistory.length} records</span>
                  </div>
                  <div className="tree-item folder">
                    <span className="tree-icon tree-icon--folder"></span>
                    <span className="tree-name">/evidence</span>
                  </div>
                  {evidence.slice(0, 5).map((ev, idx) => (
                    <div key={idx} className="tree-item file indent-1">
                      <span className="tree-icon tree-icon--attach"></span>
                      <span className="tree-name">{ev.file_name}</span>
                      <span className={`tree-badge ${ev.is_late ? 'late' : 'ontime'}`}>
                        {ev.is_late ? 'LATE' : 'ON-TIME'}
                      </span>
                    </div>
                  ))}
                  <div className="tree-item file indent-1">
                    <span className="tree-icon tree-icon--file"></span>
                    <span className="tree-name">evidence_manifest.json</span>
                    <span className="tree-meta">Timestamps & checksums</span>
                  </div>
                  <div className="tree-item folder">
                    <span className="tree-icon tree-icon--folder"></span>
                    <span className="tree-name">/audit_log</span>
                  </div>
                  <div className="tree-item file indent-1">
                    <span className="tree-icon tree-icon--file"></span>
                    <span className="tree-name">complete_audit_trail.json</span>
                    <span className="tree-meta">All actions logged</span>
                  </div>
                  <div className="tree-item file">
                    <span className="tree-icon tree-icon--file"></span>
                    <span className="tree-name">MANIFEST.json</span>
                    <span className="tree-meta">Package integrity hash</span>
                  </div>
                </div>
              </div>
              <div className="zip-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Files:</span>
                  <span className="summary-value">{4 + evidence.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Evidence Files:</span>
                  <span className="summary-value">{evidence.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Late Evidence:</span>
                  <span className="summary-value">{evidence.filter(e => e.is_late).length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <a 
            href={activeTab === 'pdf' ? exportAPI.obligationPdf(obligationId) : exportAPI.obligationZip(obligationId)}
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download {activeTab === 'pdf' ? 'PDF Report' : 'Evidence Bundle'}
          </a>
        </div>
      </div>
    </div>
  );
};

export default ObligationDetail;
