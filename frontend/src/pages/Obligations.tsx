// ============================================
// OBLIGATIONS LIST PAGE
// ============================================
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadObligations();
  }, [filter]);

  const loadObligations = async (): Promise<void> => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      const response = await obligationsAPI.list(params);
      setObligations(response.data.obligations);
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
      <div className="page-header">
        <h1>Obligations</h1>
        <Link to="/obligations/new" className="btn btn-primary">
          + New Obligation
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: '500' }}>Filter:</span>
          <button 
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`btn btn-sm ${filter === 'open' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('open')}
          >
            Open
          </button>
          <button 
            className={`btn btn-sm ${filter === 'closed' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('closed')}
          >
            Closed
          </button>
          <button 
            className={`btn btn-sm ${filter === 'breached' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('breached')}
          >
            Breached
          </button>
        </div>
      </div>

      {/* Obligations Table */}
      <div className="card">
        {obligations.length === 0 ? (
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
            <table>
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Title</th>
                  <th>Regulation Tag</th>
                  <th>Owner</th>
                  <th>Due Date</th>
                  <th>Days Remaining</th>
                  <th>Evidence</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {obligations.map((obligation) => (
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
                    </td>
                    <td>{obligation.regulation_tag || '-'}</td>
                    <td>{obligation.owner_name || 'Unassigned'}</td>
                    <td>
                      {obligation.sla_due_date 
                        ? new Date(obligation.sla_due_date).toLocaleDateString()
                        : 'No SLA'}
                    </td>
                    <td>
                      {obligation.days_remaining !== null && (
                        <span className={`days-remaining ${getDaysRemainingClass(obligation.days_remaining)}`}>
                          {obligation.days_remaining < 0 
                            ? `${Math.abs(obligation.days_remaining)} days overdue`
                            : `${obligation.days_remaining} days`}
                        </span>
                      )}
                    </td>
                    <td>{obligation.evidence_count || 0}</td>
                    <td>{new Date(obligation.created_at).toLocaleDateString()}</td>
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
