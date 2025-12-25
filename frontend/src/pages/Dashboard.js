// ============================================
// DASHBOARD PAGE
// ============================================
// SLA Risk Dashboard with color-coded status

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { slaAPI, exportAPI } from '../api';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await slaAPI.dashboard();
      setData(response.data);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemainingClass = (days) => {
    if (days < 0) return 'negative';
    if (days <= 15) return 'warning';
    return 'safe';
  };

  const formatDaysRemaining = (days, status) => {
    if (status === 'CLOSED') return 'Closed';
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

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="number">{data.summary.total}</div>
          <div className="label">Total Obligations</div>
        </div>
        <div className="summary-card green">
          <div className="number">{data.summary.green}</div>
          <div className="label">On Track (&gt;15 days)</div>
        </div>
        <div className="summary-card amber">
          <div className="number">{data.summary.amber}</div>
          <div className="label">At Risk (1-15 days)</div>
        </div>
        <div className="summary-card red">
          <div className="number">{data.summary.red}</div>
          <div className="label">Breached / Overdue</div>
        </div>
      </div>

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
                    </td>
                    <td>
                      {obligation.evidence_count || 0}
                      {obligation.late_evidence_count > 0 && (
                        <span style={{ color: '#dc3545', marginLeft: '4px' }}>
                          ({obligation.late_evidence_count} late)
                        </span>
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
}

export default Dashboard;
