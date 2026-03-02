// ============================================
// SLA BREACH HEATMAP COMPONENT
// ============================================
// Interactive heatmap with drill-down capability and escalation workflow

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import EscalationModal from './EscalationModal';

interface Obligation {
  id: string;
  title: string;
  status: string;
  regulation_tag: string | null;
  owner_name: string | null;
  due_date: string | null;
  days_remaining: number | null;
  risk_status: string;
  evidence_count?: number;
  late_evidence_count?: number;
}

interface HeatmapCell {
  value: number;
  count: number;
  breached: number;
  obligations: Obligation[];
}

interface SelectedCell {
  category: string;
  department: string;
  cell: HeatmapCell;
}

interface SLAHeatmapProps {
  obligations?: Obligation[];
}

const SLAHeatmap: React.FC<SLAHeatmapProps> = ({ obligations = [] }) => {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [escalationObligation, setEscalationObligation] = useState<Obligation | null>(null);

  // Standard NBFC categories
  const categories = [
    'KYC Compliance',
    'RBI Reporting',
    'Fair Practice Code',
    'Grievance Redressal',
    'CERSAI Filing',
    'AML/CFT',
    'IT Security',
    'Data Privacy'
  ];

  const departments = [
    'Operations',
    'Risk',
    'Collections',
    'Legal',
    'IT',
    'Customer Service'
  ];

  // Map obligations to categories based on regulation_tag
  const categorizeObligation = (obl: Obligation): string => {
    const tag = (obl.regulation_tag || obl.title || '').toLowerCase();
    if (tag.includes('kyc') || tag.includes('know your')) return 'KYC Compliance';
    if (tag.includes('rbi') || tag.includes('report')) return 'RBI Reporting';
    if (tag.includes('fair') || tag.includes('practice')) return 'Fair Practice Code';
    if (tag.includes('grievance') || tag.includes('complaint')) return 'Grievance Redressal';
    if (tag.includes('cersai') || tag.includes('security')) return 'CERSAI Filing';
    if (tag.includes('aml') || tag.includes('money') || tag.includes('cft')) return 'AML/CFT';
    if (tag.includes('it') || tag.includes('cyber') || tag.includes('tech')) return 'IT Security';
    if (tag.includes('data') || tag.includes('privacy')) return 'Data Privacy';
    // Default distribution
    return categories[Math.floor(Math.random() * categories.length)];
  };

  // Assign department based on owner or random
  const getDepartment = (obl: Obligation): string => {
    const owner = (obl.owner_name || '').toLowerCase();
    if (owner.includes('ops') || owner.includes('operations')) return 'Operations';
    if (owner.includes('risk')) return 'Risk';
    if (owner.includes('collect')) return 'Collections';
    if (owner.includes('legal')) return 'Legal';
    if (owner.includes('it') || owner.includes('tech')) return 'IT';
    if (owner.includes('service') || owner.includes('support')) return 'Customer Service';
    return departments[Math.floor(Math.random() * departments.length)];
  };

  // Generate heatmap data
  const generateHeatmapData = (): HeatmapCell[][] => {
    const data: HeatmapCell[][] = categories.map(() =>
      departments.map(() => ({
        value: 0,
        count: 0,
        breached: 0,
        obligations: []
      }))
    );

    // If we have real obligations, use them
    if (obligations.length > 0) {
      obligations.forEach(obl => {
        const catIndex = categories.indexOf(categorizeObligation(obl));
        const deptIndex = departments.indexOf(getDepartment(obl));
        
        if (catIndex >= 0 && deptIndex >= 0) {
          data[catIndex][deptIndex].count++;
          data[catIndex][deptIndex].obligations.push(obl);
          
          const isBreached = 
            (obl.days_remaining !== null && obl.days_remaining < 0) ||
            obl.status?.toLowerCase() === 'breached' ||
            obl.risk_status === 'RED';
          
          if (isBreached) {
            data[catIndex][deptIndex].breached++;
          }
        }
      });

      // Calculate percentages
      data.forEach(row => {
        row.forEach(cell => {
          cell.value = cell.count > 0 ? cell.breached / cell.count : 0;
        });
      });
    } else {
      // Generate demo data
      categories.forEach((_, catIndex) => {
        departments.forEach((_, deptIndex) => {
          const baseValue = Math.random() * 0.6;
          data[catIndex][deptIndex].value = Math.round(baseValue * 100) / 100;
          data[catIndex][deptIndex].count = Math.floor(Math.random() * 10) + 1;
          data[catIndex][deptIndex].breached = Math.floor(data[catIndex][deptIndex].count * baseValue);
        });
      });
    }

    return data;
  };

  const heatmapData = generateHeatmapData();

  // Simplified 4-color scale: Green → Yellow → Orange → Red
  const getCellColor = (value: number): string => {
    if (value === 0) return '#e8f5e9';  // Light green - clean
    if (value < 0.25) return '#c8e6c9'; // Green - low risk
    if (value < 0.50) return '#fff3cd'; // Yellow - warning
    if (value < 0.75) return '#ffe0b2'; // Orange - at risk
    return '#ffcdd2';                    // Red - critical
  };

  const getTextColor = (value: number): string => {
    return value >= 0.75 ? '#c62828' : value >= 0.5 ? '#e65100' : '#333';
  };

  const handleCellClick = (category: string, department: string, cell: HeatmapCell) => {
    if (cell.count > 0 || cell.value > 0) {
      setSelectedCell({ category, department, cell });
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Row and column averages
  const rowTotals = heatmapData.map(row =>
    row.reduce((sum, cell) => sum + cell.value, 0) / row.length
  );

  const colTotals = departments.map((_, colIndex) =>
    heatmapData.reduce((sum, row) => sum + row[colIndex].value, 0) / heatmapData.length
  );

  return (
    <div className="sla-heatmap">
      <div className="heatmap-header">
        <h3>SLA Breach Heatmap</h3>
        <div className="heatmap-legend">
          <span className="legend-label">Risk Level:</span>
          <div className="legend-scale">
            <span className="scale-item" style={{ backgroundColor: '#c8e6c9' }}>Low</span>
            <span className="scale-item" style={{ backgroundColor: '#fff3cd' }}>Med</span>
            <span className="scale-item" style={{ backgroundColor: '#ffe0b2' }}>High</span>
            <span className="scale-item" style={{ backgroundColor: '#ffcdd2', color: '#c62828' }}>Critical</span>
          </div>
        </div>
      </div>

      <div className="heatmap-container">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th className="category-header">Category</th>
              {departments.map(dept => (
                <th key={dept} className="dept-header">{dept}</th>
              ))}
              <th className="total-header">Avg</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, rowIndex) => (
              <tr key={category}>
                <td className="category-cell">{category}</td>
                {heatmapData[rowIndex].map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="heatmap-cell clickable"
                    style={{
                      backgroundColor: getCellColor(cell.value),
                      color: getTextColor(cell.value),
                      cursor: 'pointer'
                    }}
                    onClick={() => handleCellClick(category, departments[colIndex], cell)}
                    title={`Click to view ${cell.count} obligations`}
                  >
                    {cell.value > 0 ? `${Math.round(cell.value * 100)}%` : '—'}
                    {cell.count > 0 && (
                      <span className="cell-count">({cell.count})</span>
                    )}
                  </td>
                ))}
                <td className="total-cell" style={{
                  backgroundColor: rowTotals[rowIndex] >= 0.4 ? '#ffcdd2' : '#f5f5f5'
                }}>
                  {Math.round(rowTotals[rowIndex] * 100)}%
                </td>
              </tr>
            ))}
            <tr className="totals-row">
              <td className="category-cell total-label">Dept Average</td>
              {colTotals.map((total, colIndex) => (
                <td key={colIndex} className="total-cell" style={{
                  backgroundColor: total >= 0.4 ? '#ffcdd2' : '#f5f5f5'
                }}>
                  {Math.round(total * 100)}%
                </td>
              ))}
              <td className="total-cell overall">
                {Math.round((colTotals.reduce((a, b) => a + b, 0) / colTotals.length) * 100)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DRILL-DOWN MODAL */}
      {selectedCell && (
        <div className="heatmap-modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="heatmap-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <h3>{selectedCell.category}</h3>
                <span className="modal-subtitle">{selectedCell.department} Department</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedCell(null)}>×</button>
            </div>

            <div className="modal-stats">
              <div className="stat-box">
                <div className="stat-value">{selectedCell.cell.count}</div>
                <div className="stat-label">Total Obligations</div>
              </div>
              <div className="stat-box critical">
                <div className="stat-value">{selectedCell.cell.breached}</div>
                <div className="stat-label">Breached</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{Math.round(selectedCell.cell.value * 100)}%</div>
                <div className="stat-label">Breach Rate</div>
              </div>
            </div>

            <div className="modal-obligations">
              <h4>Obligations in this Category</h4>
              {selectedCell.cell.obligations.length > 0 ? (
                <table className="obligations-table">
                  <thead>
                    <tr>
                      <th>Obligation</th>
                      <th>Owner</th>
                      <th>Due Date</th>
                      <th>SLA Gap</th>
                      <th>Evidence</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCell.cell.obligations.map(obl => (
                      <tr key={obl.id} className={obl.days_remaining !== null && obl.days_remaining < 0 ? 'breached-row' : ''}>
                        <td className="obl-title">{obl.title}</td>
                        <td>{obl.owner_name || <span className="no-owner">Unassigned</span>}</td>
                        <td>{formatDate(obl.due_date)}</td>
                        <td className={`sla-gap ${obl.days_remaining !== null && obl.days_remaining < 0 ? 'negative' : ''}`}>
                          {obl.days_remaining !== null ? (
                            obl.days_remaining < 0 
                              ? <span className="overdue">{Math.abs(obl.days_remaining)}d overdue</span>
                              : <span>{obl.days_remaining}d remaining</span>
                          ) : '—'}
                        </td>
                        <td className="evidence-cell">
                          {obl.evidence_count || 0} uploaded
                          {(obl.late_evidence_count || 0) > 0 && (
                            <span className="late-badge">{obl.late_evidence_count} late</span>
                          )}
                          {(obl.evidence_count || 0) === 0 && (
                            <span className="missing-evidence-flag">⚠ Missing</span>
                          )}
                        </td>
                        <td className="action-cell">
                          <Link to={`/obligations/${obl.id}`} className="view-link">
                            View →
                          </Link>
                          {obl.days_remaining !== null && obl.days_remaining < 0 && (
                            <button 
                              className="escalate-btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEscalationObligation(obl);
                              }}
                            >
                              Escalate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="demo-obligations">
                  <p className="demo-note">Demo data - Connect real obligations for full drill-down</p>
                  <table className="obligations-table">
                    <thead>
                      <tr>
                        <th>Obligation</th>
                        <th>Owner</th>
                        <th>Due Date</th>
                        <th>SLA Gap</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="breached-row">
                        <td>{selectedCell.category} - Monthly Filing</td>
                        <td>Compliance Team</td>
                        <td>15 Jan 2026</td>
                        <td className="sla-gap negative"><span className="overdue">14d overdue</span></td>
                        <td>2 uploaded <span className="late-badge">1 late</span></td>
                      </tr>
                      <tr>
                        <td>{selectedCell.category} - Quarterly Review</td>
                        <td>Risk Officer</td>
                        <td>31 Mar 2026</td>
                        <td className="sla-gap">62d remaining</td>
                        <td>0 uploaded</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSelectedCell(null)}>
                Close
              </button>
              <Link to="/obligations" className="btn btn-primary">
                View All Obligations
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Modal */}
      {escalationObligation && (
        <EscalationModal
          isOpen={true}
          onClose={() => setEscalationObligation(null)}
          obligation={{
            id: escalationObligation.id,
            title: escalationObligation.title,
            owner_name: escalationObligation.owner_name || undefined,
            days_overdue: escalationObligation.days_remaining !== null && escalationObligation.days_remaining < 0 
              ? Math.abs(escalationObligation.days_remaining) 
              : undefined,
            due_date: escalationObligation.due_date || undefined
          }}
        />
      )}
    </div>
  );
};

export default SLAHeatmap;
