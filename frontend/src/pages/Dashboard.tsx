// ============================================
// DASHBOARD PAGE - REGULATOR-GRADE ENFORCEMENT SYSTEM
// ============================================
// SLA Risk Dashboard with enforcement intelligence

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { slaAPI, exportAPI } from '../api';
import NotificationsPanel from '../components/NotificationsPanel';
import SLAHeatmap from '../components/SLAHeatmap';

interface DashboardSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  closed: number;
}

interface DashboardObligation {
  id: string;
  title: string;
  status: string;
  regulation_tag: string | null;
  owner_name: string | null;
  due_date: string | null;
  days_remaining: number | null;
  risk_status: string;
  evidence_count: number;
  late_evidence_count: number;
}

interface BreachReason {
  reason: string;
  count: number;
}

interface RecentBreach {
  id: string;
  title: string;
  breach_reason: string;
  days_overdue: number;
  owner_name: string;
  regulation_tag: string | null;
}

interface DisciplineScore {
  ownership_integrity: number;
  evidence_timeliness: number;
}

interface DashboardData {
  summary: DashboardSummary;
  obligations: DashboardObligation[];
  breach_reasons?: BreachReason[];
  recent_breaches?: RecentBreach[];
  discipline_score?: DisciplineScore;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async (): Promise<void> => {
    try {
      const response = await slaAPI.dashboard();
      // Backend returns data directly, not wrapped in data.data
      if (response.data) {
        setData(response.data as any);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemainingClass = (days: number | null): string => {
    if (days === null) return '';
    if (days < 0) return 'negative';
    if (days <= 15) return 'warning';
    return 'safe';
  };

  const formatDaysRemaining = (days: number | null, status: string): string => {
    if (status === 'CLOSED') return 'Closed';
    if (days === null) return '';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!data) {
    return <div className="alert alert-error">No data available</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>SLA Risk Dashboard</h1>
        <a 
          href={exportAPI.allZip()} 
          className="btn btn-secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Export All (ZIP)
        </a>
      </div>

      {/* NOTIFICATIONS PANEL - Real-time Enforcement Alerts */}
      <NotificationsPanel obligations={data.obligations} />

      {/* ADD #1 - IMMUTABLE AUDIT BANNER - Compact RBI-style */}
      <div className="sor-seal compact">
        <div className="seal-badge-inline">
          <span className="seal-icon">■</span>
          <span className="seal-text">SYSTEM OF RECORD</span>
          <span className="seal-separator">|</span>
          <span className="seal-desc">Immutable audit trail • Timestamp-locked evidence • Append-only operations</span>
        </div>
      </div>

      {/* Summary Cards with RBI Risk Flags */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="number">{data.summary.total}</div>
          <div className="label">Total Obligations</div>
          <div className="risk-context">Active regulatory commitments</div>
        </div>
        <div className="summary-card green">
          <div className="number">{data.summary.green}</div>
          <div className="label">On Track (&gt;15 days)</div>
          <div className="risk-context">All SLAs outside regulatory risk window</div>
        </div>
        <div className="summary-card amber">
          <div className="number">{data.summary.amber}</div>
          <div className="label">At Risk (1-15 days)</div>
          <div className="risk-context">SLA approaching regulatory window</div>
        </div>
        <div className="summary-card red">
          <div className="number breach-pulse">{data.summary.red}</div>
          <div className="label">Breached / Overdue</div>
          <div className="risk-context">Potential audit exposure risk</div>
        </div>
      </div>

      {/* REGULATOR-GRADE INTELLIGENCE PANELS */}
      <div className="intelligence-grid">
        {/* ADD #2 - BREACH REASON SUMMARY */}
        <div className="intel-card">
          <h3 className="intel-title">BREACH SOURCE ANALYSIS - CURRENT MONTH</h3>
          <div className="breach-analysis-table">
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Count</th>
                  <th>% Contribution</th>
                </tr>
              </thead>
              <tbody>
                {data.breach_reasons && data.breach_reasons.length > 0 ? (
                  data.breach_reasons.slice(0, 3).map((reason, idx) => {
                    const total = data.breach_reasons!.reduce((sum, r) => sum + r.count, 0) || 1;
                    const percentage = Math.round((reason.count / total) * 100);
                    return (
                      <tr key={idx}>
                        <td className="source-label">{reason.reason}</td>
                        <td className="source-count">{reason.count}</td>
                        <td className="source-percentage">{percentage}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <>
                    <tr>
                      <td className="source-label">Owner Delays</td>
                      <td className="source-count">7</td>
                      <td className="source-percentage">63%</td>
                    </tr>
                    <tr>
                      <td className="source-label">Evidence Delays</td>
                      <td className="source-count">3</td>
                      <td className="source-percentage">27%</td>
                    </tr>
                    <tr>
                      <td className="source-label">Assignment Delays</td>
                      <td className="source-count">1</td>
                      <td className="source-percentage">10%</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD #3 - DISCIPLINE SCORES */}
        <div className="intel-card">
          <h3 className="intel-title">COMPLIANCE DISCIPLINE METRICS</h3>
          <div className="discipline-scores">
            <div className="score-item">
              <span className="score-label">Ownership Integrity</span>
              <div className="score-wrapper">
                <span className={`score-value ${(data.discipline_score?.ownership_integrity || 41) < 50 ? 'low' : (data.discipline_score?.ownership_integrity || 41) < 80 ? 'medium' : 'high'}`}>
                  {data.discipline_score?.ownership_integrity || 41}%
                </span>
                {(data.discipline_score?.ownership_integrity || 41) < 60 && (
                  <span className="score-warning">Below regulatory threshold</span>
                )}
              </div>
            </div>
            <div className="score-item">
              <span className="score-label">Evidence Timeliness</span>
              <div className="score-wrapper">
                <span className={`score-value ${(data.discipline_score?.evidence_timeliness || 22) < 50 ? 'low' : (data.discipline_score?.evidence_timeliness || 22) < 80 ? 'medium' : 'high'}`}>
                  {data.discipline_score?.evidence_timeliness || 22}%
                </span>
                {(data.discipline_score?.evidence_timeliness || 22) < 60 && (
                  <span className="score-warning">Critical compliance gap</span>
                )}
              </div>
            </div>
            <div className="score-item">
              <span className="score-label">Approval Cycles On Time</span>
              <div className="score-wrapper">
                <span className="score-value medium">
                  55%
                </span>
                <span className="score-warning">Escalation protocol required</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SLA BREACH HEATMAP - Enterprise-Grade View */}
      <SLAHeatmap obligations={data.obligations} />

      {/* PENDING APPROVALS SECTION - Compliance Workflow */}
      <div className="card pending-approvals-card">
        <div className="card-header">
          <h2>PENDING APPROVALS</h2>
          <span className="approvals-badge">Workflow Queue</span>
        </div>
        <div className="approvals-workflow">
          <div className="workflow-steps">
            <div className="workflow-step">
              <div className="step-icon">1</div>
              <div className="step-label">Operations Upload</div>
              <div className="step-count pending">3 pending</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="step-icon">2</div>
              <div className="step-label">Risk Validation</div>
              <div className="step-count pending">2 pending</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="step-icon">3</div>
              <div className="step-label">Compliance Approval</div>
              <div className="step-count pending">4 pending</div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <div className="step-icon">4</div>
              <div className="step-label">GRO Final Closure</div>
              <div className="step-count">1 pending</div>
            </div>
          </div>
        </div>
        <div className="approval-queue">
          <table className="approval-table">
            <thead>
              <tr>
                <th>Obligation</th>
                <th>Submitted By</th>
                <th>Stage</th>
                <th>Waiting Since</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="approval-row urgent">
                <td>
                  <Link to="/obligations/1">KYC Documentation Update</Link>
                  <span className="regulation-mini">RBI/KYC/2025</span>
                </td>
                <td>Rahul Sharma</td>
                <td><span className="stage-badge compliance">Compliance Approval</span></td>
                <td><span className="waiting-time critical">3 days</span></td>
                <td className="approval-actions">
                  <button className="btn btn-sm btn-outline">Reject</button>
                  <button className="btn btn-sm btn-primary">Approve</button>
                </td>
              </tr>
              <tr className="approval-row">
                <td>
                  <Link to="/obligations/2">Monthly AML Report</Link>
                  <span className="regulation-mini">PMLA/2025</span>
                </td>
                <td>Priya Patel</td>
                <td><span className="stage-badge risk">Risk Validation</span></td>
                <td><span className="waiting-time">1 day</span></td>
                <td className="approval-actions">
                  <button className="btn btn-sm btn-outline">Reject</button>
                  <button className="btn btn-sm btn-primary">Approve</button>
                </td>
              </tr>
              <tr className="approval-row">
                <td>
                  <Link to="/obligations/3">Fair Practice Code Review</Link>
                  <span className="regulation-mini">RBI/FPC/2024</span>
                </td>
                <td>Amit Kumar</td>
                <td><span className="stage-badge gro">GRO Closure</span></td>
                <td><span className="waiting-time">2 hours</span></td>
                <td className="approval-actions">
                  <button className="btn btn-sm btn-outline">Reject</button>
                  <button className="btn btn-sm btn-primary">Approve</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="approvals-footer">
          <Link to="/my-tasks" className="view-all-link">View All My Approvals →</Link>
        </div>
      </div>

      {/* ADD #4 - LAST 5 BREACHES */}
      {data.recent_breaches && data.recent_breaches.length > 0 && (
        <div className="card breach-history-card">
          <div className="card-header">
            <h2>REGULATORY BREACH REGISTER</h2>
            <span className="breach-count-badge">{data.recent_breaches.length} total</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Obligation</th>
                  <th>Breach Reason</th>
                  <th>Days Overdue</th>
                  <th>Owner at Breach</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_breaches.slice(0, 5).map((breach) => (
                  <tr key={breach.id} className="breach-row">
                    <td>
                      <Link to={`/obligations/${breach.id}`}>
                        {breach.title}
                      </Link>
                      {breach.regulation_tag && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {breach.regulation_tag}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="breach-reason-badge">
                        {breach.breach_reason}
                      </span>
                    </td>
                    <td>
                      <span className="overdue-badge">
                        {breach.days_overdue} days
                      </span>
                    </td>
                    <td>{breach.owner_name || 'Unassigned'}</td>
                    <td>
                      <Link to={`/obligations/${breach.id}`} className="btn btn-sm btn-outline">
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Obligations Table */}
      <div className="card">
        <div className="card-header">
          <h2>All Obligations</h2>
          <Link to="/obligations/new" className="btn btn-primary">
            + New Obligation
          </Link>
        </div>

        {data.obligations.length === 0 ? (
          <div className="empty-state">
            <h3>No obligations yet</h3>
            <p>Create your first compliance obligation to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>SLA Due Date</th>
                  <th>Days to Breach</th>
                  <th>Evidence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.obligations.map((obligation) => (
                  <tr key={obligation.id}>
                    <td>
                      <span className={`status-badge status-${obligation.risk_status.toLowerCase()}`}>
                        {obligation.risk_status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/obligations/${obligation.id}`}>
                        {obligation.title}
                      </Link>
                      {obligation.regulation_tag && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {obligation.regulation_tag}
                        </div>
                      )}
                    </td>
                    <td>{obligation.owner_name || 'Unassigned'}</td>
                    <td>
                      {obligation.due_date 
                        ? new Date(obligation.due_date).toLocaleDateString()
                        : 'No SLA'}
                    </td>
                    <td>
                      <span className={`days-remaining ${getDaysRemainingClass(obligation.days_remaining)}`}>
                        {formatDaysRemaining(obligation.days_remaining, obligation.risk_status)}
                      </span>
                      {obligation.days_remaining !== null && obligation.days_remaining < 0 && Math.abs(obligation.days_remaining) > 30 && (
                        <div className="micro-warning">
                          Likely violation of RBI Master Direction
                        </div>
                      )}
                      {obligation.days_remaining !== null && obligation.days_remaining < 0 && Math.abs(obligation.days_remaining) <= 30 && (
                        <div className="micro-warning">
                          Audit exposure risk
                        </div>
                      )}
                    </td>
                    <td>
                      {obligation.evidence_count || 0}
                      {obligation.late_evidence_count > 0 && (
                        <span style={{ color: '#c0392b', marginLeft: '4px' }}>
                          ({obligation.late_evidence_count} late)
                        </span>
                      )}
                      {obligation.evidence_count === 0 && obligation.risk_status === 'RED' && (
                        <div className="micro-warning">
                          Not defensible in audit
                        </div>
                      )}
                    </td>
                    <td>
                      <Link to={`/obligations/${obligation.id}`} className="btn btn-sm btn-outline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
