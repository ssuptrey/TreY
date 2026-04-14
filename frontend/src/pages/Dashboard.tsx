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
    <div className="dashboard-container">
      <div className="dashboard-header-bar">
        <div className="dashboard-title-group">
          <h1>SLA Risk Dashboard</h1>
          <span className="subtitle">Real-time Regulatory Enforcement Engine</span>
        </div>
        <div className="dashboard-actions">
          <a 
            href={exportAPI.allZip()} 
            className="btn btn-secondary btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            REST API EXPORT (ZIP)
          </a>
        </div>
      </div>

      {/* DENSE METRICS RIBBON (Replaces boxes) */}
      <div className="metrics-ribbon">
        <Link to="/obligations" className="metric-column" style={{ textDecoration: 'none' }}>
          <span className="metric-label">TOTAL OBLIGATIONS</span>
          <span className="metric-value">{data.summary.total}</span>
          <span className="metric-context">ACTIVE COMMITMENTS</span>
        </Link>
        <div className="metric-divider"></div>
        <Link to="/obligations?status=ontrack" className="metric-column safe-status" style={{ textDecoration: 'none' }}>
          <span className="metric-label">ON TRACK (&gt;15 DAYS)</span>
          <span className="metric-value">{data.summary.green}</span>
          <span className="metric-context">OUTSIDE RISK WINDOW</span>
        </Link>
        <div className="metric-divider"></div>
        <Link to="/obligations?status=atrisk" className="metric-column warning-status" style={{ textDecoration: 'none' }}>
          <span className="metric-label">AT RISK (1-15 DAYS)</span>
          <span className="metric-value">{data.summary.amber}</span>
          <span className="metric-context">APPROACHING WINDOW</span>
        </Link>
        <div className="metric-divider"></div>
        <Link to="/obligations?status=breached" className="metric-column critical-status" style={{ textDecoration: 'none' }}>
          <span className="metric-label">BREACHED / OVERDUE</span>
          <span className="metric-value risk-pulse">{data.summary.red}</span>
          <span className="metric-context">ACTIVE AUDIT EXPOSURE</span>
        </Link>
      </div>

      <div className="dashboard-grid-layout">
        {/* Main Content Column */}
        <div className="dashboard-main-column">

      {/* REGULATOR-GRADE INTELLIGENCE PANELS */}
      <div className="intelligence-grid-dense">
        {/* ADD #2 - BREACH REASON SUMMARY */}
        <div className="dense-panel">
          <div className="panel-header">
            <h3>BREACH SOURCE ANALYSIS (CURRENT MTH)</h3>
          </div>
          <div className="panel-body">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>SOURCE</th>
                  <th className="text-right">COUNT</th>
                  <th className="text-right">% CONTRIB</th>
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
                        <td className="source-count text-right">{reason.count}</td>
                        <td className="source-percentage text-right">{percentage}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <>
                    <tr>
                      <td className="source-label">OWNER DELAYS</td>
                      <td className="text-right">7</td>
                      <td className="text-right">63%</td>
                    </tr>
                    <tr>
                      <td className="source-label">EVIDENCE LACKING</td>
                      <td className="text-right">3</td>
                      <td className="text-right">27%</td>
                    </tr>
                    <tr>
                      <td className="source-label">APPROVAL DELAYS</td>
                      <td className="text-right">1</td>
                      <td className="text-right">10%</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD #3 - DISCIPLINE SCORES */}
        <div className="dense-panel">
          <div className="panel-header">
            <h3>COMPLIANCE DISCIPLINE METRICS</h3>
          </div>
          <div className="panel-body">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>METRIC</th>
                  <th className="text-right">SCORE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>OWNER INTEGRITY</td>
                  <td className="text-right">41%</td>
                  <td className="status-critical">CRITICAL</td>
                </tr>
                <tr>
                  <td>EVIDENCE TIMELINESS</td>
                  <td className="text-right">22%</td>
                  <td className="status-critical">CRITICAL</td>
                </tr>
                <tr>
                  <td>APPROVAL CYCLES</td>
                  <td className="text-right">55%</td>
                  <td className="status-warning">WARNING</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SLA BREACH HEATMAP - Enterprise-Grade View */}
      <SLAHeatmap obligations={data.obligations} />

      {/* PENDING APPROVALS SECTION - Compliance Workflow */}
      <div className="dense-panel pending-approvals-panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>PENDING APPROVALS</h3>
          <span className="approvals-badge" style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', letterSpacing: '1px' }}>WORKFLOW QUEUE</span>
        </div>
        
        {/* Sleek inline workflow status (replaced clunky boxes) */}
        <div className="approvals-workflow-dense" style={{ padding: '12px 16px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
          <div className="workflow-steps-inline" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>
            <span className="dense-step" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="step-num" style={{ backgroundColor: '#111827', color: 'white', padding: '2px 6px' }}>1</span> OPs UPLOAD: <span className="step-val text-red" style={{ fontSize: '13px', fontWeight: 700 }}>3</span>
            </span>
            <span className="workflow-sep" style={{ color: '#D1D5DB' }}>/</span>
            <span className="dense-step" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="step-num" style={{ backgroundColor: '#111827', color: 'white', padding: '2px 6px' }}>2</span> RISK VALIDATION: <span className="step-val text-amber" style={{ fontSize: '13px', fontWeight: 700 }}>2</span>
            </span>
            <span className="workflow-sep" style={{ color: '#D1D5DB' }}>/</span>
            <span className="dense-step" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="step-num" style={{ backgroundColor: '#111827', color: 'white', padding: '2px 6px' }}>3</span> COMPLIANCE APPROVAL: <span className="step-val text-amber" style={{ fontSize: '13px', fontWeight: 700 }}>4</span>
            </span>
            <span className="workflow-sep" style={{ color: '#D1D5DB' }}>/</span>
            <span className="dense-step" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="step-num" style={{ backgroundColor: '#111827', color: 'white', padding: '2px 6px' }}>4</span> GRO CLOSURE: <span className="step-val" style={{ fontSize: '13px', fontWeight: 700 }}>1</span>
            </span>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          <table className="dense-table" style={{ width: '100%' }}>
            <thead style={{ backgroundColor: '#F9FAFB' }}>
              <tr>
                <th>OBLIGATION</th>
                <th>SUBMITTED BY</th>
                <th>STAGE</th>
                <th className="text-right">WAITING SINCE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Link to="/obligations/1" style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>KYC Documentation Update</Link>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>RBI/KYC/2025</div>
                </td>
                <td style={{ color: '#374151' }}>Rahul Sharma</td>
                <td><span style={{ fontSize: '10px', padding: '2px 6px', background: '#F3F4F6', color: '#374151', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>COMPLIANCE</span></td>
                <td className="text-right status-critical">3 DAYS</td>
                <td className="text-right">
                  <button style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D1D5DB', borderRadius: '4px', marginRight: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>REJECT</button>
                  <button style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: '#111827', color: 'white', border: '1px solid #111827', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>APPROVE</button>
                </td>
              </tr>
              <tr>
                <td>
                  <Link to="/obligations/2" style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>Monthly AML Report</Link>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>PMLA/2025</div>
                </td>
                <td style={{ color: '#374151' }}>Priya Patel</td>
                <td><span style={{ fontSize: '10px', padding: '2px 6px', background: '#F3F4F6', color: '#374151', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>RISK VAL</span></td>
                <td className="text-right" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>1 DAY</td>
                <td className="text-right">
                  <button style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D1D5DB', borderRadius: '4px', marginRight: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>REJECT</button>
                  <button style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: '#111827', color: 'white', border: '1px solid #111827', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>APPROVE</button>
                </td>
              </tr>
              <tr>
                <td>
                  <Link to="/obligations/3" style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>Fair Practice Code Review</Link>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>RBI/FPC/2024</div>
                </td>
                <td style={{ color: '#374151' }}>Amit Kumar</td>
                <td><span style={{ fontSize: '10px', padding: '2px 6px', background: '#F3F4F6', color: '#374151', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>GRO CLOSURE</span></td>
                <td className="text-right" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>2 HOURS</td>
                <td className="text-right">
                  <button style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D1D5DB', borderRadius: '4px', marginRight: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>REJECT</button>
                  <button style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: '#111827', color: 'white', border: '1px solid #111827', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>APPROVE</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>
          <Link to="/my-tasks" style={{ fontSize: '12px', fontWeight: 600, color: '#111827', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            VIEW ALL MY APPROVALS <span style={{ marginLeft: '4px', fontFamily: 'var(--font-mono)' }}>→</span>
          </Link>
        </div>
      </div>

      {/* ADD #4 - LAST 5 BREACHES */}
      {data.recent_breaches && data.recent_breaches.length > 0 && (
        <div className="dense-panel">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '0.05em' }}>REGULATORY BREACH REGISTER</h2>
            <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{data.recent_breaches.length} TOTAL</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="dense-table">
              <thead>
                <tr>
                  <th>OBLIGATION</th>
                  <th>BREACH REASON</th>
                  <th className="text-right">DAYS OVERDUE</th>
                  <th>OWNER AT BREACH</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_breaches.slice(0, 5).map((breach) => (
                  <tr key={breach.id}>
                    <td>
                      <Link to={`/obligations/${breach.id}`} style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>
                        {breach.title}
                      </Link>
                      {breach.regulation_tag && (
                        <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {breach.regulation_tag}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: '#FEE2E2', color: '#B91C1C', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {breach.breach_reason.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right" style={{ color: '#B91C1C', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {breach.days_overdue} DAYS
                    </td>
                    <td style={{ color: '#374151' }}>{breach.owner_name || 'UNASSIGNED'}</td>
                    <td className="text-right">
                      <Link to={`/obligations/${breach.id}`} style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D1D5DB', borderRadius: '4px', color: '#374151', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                        INVESTIGATE
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
      <div className="dense-panel">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '0.05em' }}>ALL OBLIGATIONS</h2>
          <Link to="/obligations/new" style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 600, backgroundColor: '#111827', color: 'white', border: '1px solid #111827', borderRadius: '4px', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
            + NEW OBLIGATION
          </Link>
        </div>

        {data.obligations.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>No obligations yet</h3>
            <p style={{ fontSize: '12px', color: '#6B7280' }}>Create your first compliance obligation to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dense-table">
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>TITLE</th>
                  <th>OWNER</th>
                  <th>SLA DUE DATE</th>
                  <th className="text-right">DAYS TO BREACH</th>
                  <th>EVIDENCE</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {data.obligations.map((obligation) => (
                  <tr key={obligation.id}>
                    <td>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: obligation.risk_status === 'CRITICAL' ? '#FEE2E2' : obligation.risk_status === 'HIGH' ? '#FEF3C7' : '#D1FAE5', color: obligation.risk_status === 'CRITICAL' ? '#B91C1C' : obligation.risk_status === 'HIGH' ? '#B45309' : '#047857', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {obligation.risk_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <Link to={`/obligations/${obligation.id}`} style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>
                        {obligation.title}
                      </Link>
                      {obligation.regulation_tag && (
                        <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {obligation.regulation_tag}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#374151' }}>{obligation.owner_name || 'UNASSIGNED'}</td>
                    <td style={{ color: '#374151', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {obligation.due_date 
                        ? new Date(obligation.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() 
                        : 'NO SLA'}
                    </td>
                    <td className="text-right">
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: obligation.days_remaining && obligation.days_remaining < 3 ? '#B91C1C' : '#374151' }}>
                        {formatDaysRemaining(obligation.days_remaining, obligation.risk_status).toUpperCase()}
                      </span>
                      {obligation.days_remaining !== null && obligation.days_remaining < 0 && Math.abs(obligation.days_remaining) > 30 && (
                        <div style={{ fontSize: '9px', color: '#B91C1C', marginTop: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          LIKELY VIOLATION OF RBI MASTER DIRECTION
                        </div>
                      )}
                      {obligation.days_remaining !== null && obligation.days_remaining < 0 && Math.abs(obligation.days_remaining) <= 30 && (
                        <div style={{ fontSize: '9px', color: '#B91C1C', marginTop: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          AUDIT EXPOSURE RISK
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#374151', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {obligation.evidence_count || 0}
                      {obligation.late_evidence_count > 0 && (
                        <span style={{ color: '#B91C1C', marginLeft: '4px', fontWeight: 600 }}>
                          ({obligation.late_evidence_count} LATE)
                        </span>
                      )}
                      {obligation.evidence_count === 0 && obligation.risk_status === 'CRITICAL' && (
                        <div style={{ fontSize: '9px', color: '#B91C1C', marginTop: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          NOT DEFENSIBLE IN AUDIT
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <Link to={`/obligations/${obligation.id}`} style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D1D5DB', borderRadius: '4px', color: '#374151', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                        VIEW
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

        {/* Right Content Column (Enforcement Alerter) */}
        <div className="dashboard-side-column">
          
          {/* IMMUTABLE AUDIT BANNER - Vertical Style */}
          <div className="sor-vertical-seal">
            <span className="seal-icon">■</span>
            <span className="seal-title">SYSTEM OF RECORD</span>
            <hr className="seal-divider" />
            <span className="seal-desc">Immutable audit ledger. Timestamp-locked operations.</span>
          </div>

          {/* NOTIFICATIONS PANEL - Shifted to side column */}
          <div className="enforcement-alert-section">
            <NotificationsPanel obligations={data.obligations} />
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
