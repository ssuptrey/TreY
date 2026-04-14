// ============================================
// OBLIGATIONS LIST PAGE
// ============================================
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { obligationsAPI } from '../api';

interface Obligation {
  id: string;
  title: string;
  status: string;
  regulation_tag: string | null;
  owner_name: string | null;
  sla_due_date: string | null;
  days_remaining: number | null;
  risk_status: string;
  evidence_count: number;
  created_at: string;
}


const Obligations: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('status') || 'all';

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [displayedObligations, setDisplayedObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<string>(initialFilter);

  useEffect(() => {
    loadObligations();
  }, []);

  useEffect(() => {
    // Apply client-side filtering for statuses not supported natively by DB
    if (filter === 'ontrack') {
      setDisplayedObligations(obligations.filter(o => (o.days_remaining ?? 0) > 15 && o.status !== 'closed' && o.status !== 'breached'));
    } else if (filter === 'atrisk') {
      setDisplayedObligations(obligations.filter(o => (o.days_remaining ?? 0) > 0 && (o.days_remaining ?? 0) <= 15 && o.status !== 'closed' && o.status !== 'breached'));
    } else if (filter === 'breached') {
      setDisplayedObligations(obligations.filter(o => o.status === 'breached' || (o.days_remaining !== null && o.days_remaining < 0)));
    } else if (filter === 'open' || filter === 'closed') {
      setDisplayedObligations(obligations.filter(o => o.status === filter));
    } else {
      setDisplayedObligations(obligations);
    }
  }, [filter, obligations]);

  const loadObligations = async (): Promise<void> => {
    try {
      const params: Record<string, string> = {};
      const response = await obligationsAPI.list(params);
      const data = response.data as any;
      setObligations(data.obligations || data.data || []);
    } catch (err) {
      setError('Failed to load obligations');
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

  if (loading) {
    return <div className="loading">Loading obligations...</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ padding: '24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>OBLIGATIONS</h1>
        <Link to="/obligations/new" style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, backgroundColor: '#111827', color: 'white', border: '1px solid #111827', borderRadius: '0px', textDecoration: 'none', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
          + New Obligation
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="dense-panel" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px' }}>FILTER:</span>
          {['all', 'open', 'closed', 'ontrack', 'atrisk', 'breached'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                border: `1px solid ${filter === f ? '#111827' : '#D1D5DB'}`,
                backgroundColor: filter === f ? '#111827' : 'transparent',
                color: filter === f ? 'white' : '#6B7280',
                borderRadius: '0px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {f === 'ontrack' ? 'On Track' : f === 'atrisk' ? 'At Risk' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Obligations Table */}
      <div className="dense-panel">
        {displayedObligations.length === 0 ? (
          <div className="empty-state">
            <h3>No obligations found</h3>
            <p>
              {filter === 'all' 
                ? 'Create your first compliance obligation to get started.'
                : `No ${filter} obligations found.`}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>RISK</th>
                  <th>TITLE</th>
                  <th>REGULATION TAG</th>
                  <th>OWNER</th>
                  <th>DUE DATE</th>
                  <th className="text-right">DAYS REMAINING</th>
                  <th className="text-right">EVIDENCE</th>
                  <th className="text-right">CREATED</th>
                </tr>
              </thead>
              <tbody>
                {displayedObligations.map((obligation) => (
                  <tr key={obligation.id}>
                    <td>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: obligation.risk_status === 'CRITICAL' || obligation.risk_status === 'RED' ? '#FEE2E2' : obligation.risk_status === 'HIGH' || obligation.risk_status === 'AMBER' ? '#FEF3C7' : '#D1FAE5', color: obligation.risk_status === 'CRITICAL' || obligation.risk_status === 'RED' ? '#B91C1C' : obligation.risk_status === 'HIGH' || obligation.risk_status === 'AMBER' ? '#B45309' : '#047857', borderRadius: '4px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {obligation.risk_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <Link to={`/obligations/${obligation.id}`} style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>
                        {obligation.title}
                      </Link>
                    </td>
                    <td style={{ color: '#6B7280', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{obligation.regulation_tag || '-'}</td>
                    <td style={{ color: '#374151' }}>{obligation.owner_name || 'UNASSIGNED'}</td>
                    <td style={{ color: '#374151', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {obligation.sla_due_date 
                        ? new Date(obligation.sla_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() 
                        : 'NO SLA'}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: obligation.days_remaining !== null && obligation.days_remaining < 3 ? '#B91C1C' : '#374151' }}>
                      {obligation.days_remaining !== null && (
                        <span>
                          {obligation.days_remaining < 0 
                            ? `${Math.abs(obligation.days_remaining)} DAYS OVERDUE`
                            : `${obligation.days_remaining} DAYS`}
                        </span>
                      )}
                    </td>
                    <td className="text-right" style={{ color: '#374151', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{obligation.evidence_count || 0}</td>
                    <td className="text-right" style={{ color: '#6B7280', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{new Date(obligation.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</td>
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

export default Obligations;
