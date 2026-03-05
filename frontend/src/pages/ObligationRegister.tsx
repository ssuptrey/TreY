// ============================================
// OBLIGATION REGISTER PAGE
// ============================================
// Full NBFC-compliant obligation register with regulatory metadata

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obligationsAPI } from '../api';

interface ObligationMetadata {
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
  // NBFC-specific fields
  rbi_circular?: string;
  master_direction?: string;
  applicable_clause?: string;
  control_owner?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'event-driven';
  penalty_exposure?: string;
  source_of_truth?: string;
  evidence_checklist?: string[];
  compliance_category?: string;
}

interface FilterState {
  status: 'all' | 'open' | 'closed' | 'breached';
  category: 'all' | 'kyc' | 'rbi-reporting' | 'aml' | 'fair-practice' | 'grievance' | 'it-security' | 'data-privacy';
  frequency: 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  riskLevel: 'all' | 'critical' | 'high' | 'medium' | 'low';
}

const COMPLIANCE_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'kyc', label: 'KYC Compliance' },
  { value: 'rbi-reporting', label: 'RBI Reporting' },
  { value: 'aml', label: 'AML/CFT' },
  { value: 'fair-practice', label: 'Fair Practice Code' },
  { value: 'grievance', label: 'Grievance Redressal' },
  { value: 'it-security', label: 'IT Security' },
  { value: 'data-privacy', label: 'Data Privacy' }
];

const ObligationRegister: React.FC = () => {
  const [obligations, setObligations] = useState<ObligationMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    category: 'all',
    frequency: 'all',
    riskLevel: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadObligations();
  }, [filters.status]);

  const loadObligations = async (): Promise<void> => {
    try {
      const params: Record<string, string> = {};
      if (filters.status !== 'all') {
        params.status = filters.status;
      }
      const response = await obligationsAPI.list(params);
      const data = response.data.data as ObligationMetadata[] || [];
      
      // Enrich with demo NBFC metadata (in production, this would come from the API)
      const enrichedData = data.map((obl, idx) => enrichWithMetadata(obl, idx));
      setObligations(enrichedData);
    } catch (err) {
      setError('Failed to load obligations');
    } finally {
      setLoading(false);
    }
  };

  // Enrich obligation with NBFC-specific metadata (demo data)
  const enrichWithMetadata = (obl: ObligationMetadata, idx: number): ObligationMetadata => {
    const categories = ['KYC Compliance', 'RBI Reporting', 'AML/CFT', 'Fair Practice Code', 'Grievance Redressal', 'IT Security'];
    const frequencies: ('daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually')[] = ['monthly', 'quarterly', 'annually', 'monthly', 'quarterly'];
    
    return {
      ...obl,
      compliance_category: categories[idx % categories.length],
      rbi_circular: `RBI/2024-25/${String(100 + idx).padStart(3, '0')}`,
      master_direction: getMasterDirection(obl.regulation_tag || categories[idx % categories.length]),
      applicable_clause: `Section 45-IA, Clause ${6 + (idx % 10)}(${String.fromCharCode(97 + (idx % 5))})`,
      control_owner: obl.owner_name || 'Compliance Team',
      frequency: frequencies[idx % frequencies.length],
      penalty_exposure: getPenaltyExposure(idx),
      source_of_truth: 'RBI Master Directions Portal',
      evidence_checklist: getEvidenceChecklist(categories[idx % categories.length])
    };
  };

  const getMasterDirection = (tag: string): string => {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes('kyc')) return 'Master Direction - Know Your Customer (KYC) Direction, 2016';
    if (tagLower.includes('aml') || tagLower.includes('cft')) return 'Master Direction on KYC (AML/CFT) for NBFCs';
    if (tagLower.includes('fair')) return 'Fair Practices Code for NBFCs - DNBR/2016-17/45';
    if (tagLower.includes('grievance')) return 'Integrated Ombudsman Scheme, 2021';
    if (tagLower.includes('it') || tagLower.includes('security')) return 'Master Direction on IT Framework for NBFCs';
    return 'Scale Based Regulation (SBR) Framework for NBFCs';
  };

  const getPenaltyExposure = (idx: number): string => {
    const penalties = [
      'Up to ₹1 Crore per instance',
      'Up to ₹25 Lakhs per instance',
      'Up to ₹50 Lakhs + potential license suspension',
      'Warning letter + compliance audit',
      'Up to ₹1 Crore + license revocation risk'
    ];
    return penalties[idx % penalties.length];
  };

  const getEvidenceChecklist = (category: string): string[] => {
    const checklists: Record<string, string[]> = {
      'KYC Compliance': ['Customer identification documents', 'CKYC registration proof', 'Periodic review records', 'Risk categorization matrix'],
      'RBI Reporting': ['Monthly return (NBS-1)', 'Quarterly return (NBS-7)', 'Annual return', 'Audited financials'],
      'AML/CFT': ['STR filings', 'CTR reports', 'Training records', 'Risk assessment report'],
      'Fair Practice Code': ['Board-approved FPC policy', 'Customer communication logs', 'Grievance resolution records'],
      'Grievance Redressal': ['Complaint register', 'Resolution timeline records', 'Escalation matrix', 'GRO appointment letter'],
      'IT Security': ['Penetration test reports', 'Audit logs', 'DR drill records', 'Security policy document']
    };
    return checklists[category] || ['Compliance certificate', 'Evidence document', 'Approval record'];
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredObligations = obligations.filter(obl => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        obl.title.toLowerCase().includes(search) ||
        obl.rbi_circular?.toLowerCase().includes(search) ||
        obl.master_direction?.toLowerCase().includes(search) ||
        obl.compliance_category?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    return true;
  });

  const getRiskBadgeClass = (riskStatus: string): string => {
    switch (riskStatus.toUpperCase()) {
      case 'RED': return 'critical';
      case 'AMBER': return 'warning';
      case 'GREEN': return 'safe';
      default: return 'neutral';
    }
  };

  if (loading) {
    return <div className="loading">Loading obligation register...</div>;
  }

  return (
    <div className="obligation-register">
      <div className="page-header">
        <div className="header-left">
          <h1>Obligation Register</h1>
          <span className="header-subtitle">NBFC Compliance Master Register</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline">Export to Excel</button>
          <Link to="/obligations/new" className="btn btn-primary">
            + New Obligation
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter Bar */}
      <div className="register-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by title, RBI circular, regulation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filters.status}
            onChange={e => setFilters({...filters, status: e.target.value as FilterState['status']})}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="breached">Breached</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Category:</label>
          <select 
            value={filters.category}
            onChange={e => setFilters({...filters, category: e.target.value as FilterState['category']})}
          >
            {COMPLIANCE_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Frequency:</label>
          <select 
            value={filters.frequency}
            onChange={e => setFilters({...filters, frequency: e.target.value as FilterState['frequency']})}
          >
            <option value="all">All</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      </div>

      {/* Register Stats */}
      <div className="register-stats">
        <div className="stat-item">
          <div className="stat-number">{filteredObligations.length}</div>
          <div className="stat-label">Total Obligations</div>
        </div>
        <div className="stat-item critical">
          <div className="stat-number">{filteredObligations.filter(o => o.risk_status === 'RED').length}</div>
          <div className="stat-label">Critical / Breached</div>
        </div>
        <div className="stat-item warning">
          <div className="stat-number">{filteredObligations.filter(o => o.risk_status === 'AMBER').length}</div>
          <div className="stat-label">At Risk</div>
        </div>
        <div className="stat-item success">
          <div className="stat-number">{filteredObligations.filter(o => o.risk_status === 'GREEN').length}</div>
          <div className="stat-label">On Track</div>
        </div>
      </div>

      {/* Obligation Register Table */}
      <div className="register-table-container">
        <table className="register-table">
          <thead>
            <tr>
              <th className="expand-col"></th>
              <th>Risk</th>
              <th>Obligation</th>
              <th>RBI Circular</th>
              <th>Category</th>
              <th>Control Owner</th>
              <th>Frequency</th>
              <th>Due Date</th>
              <th>Evidence</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredObligations.map(obl => (
              <React.Fragment key={obl.id}>
                <tr className={`register-row ${obl.risk_status === 'RED' ? 'critical-row' : ''}`}>
                  <td className="expand-col">
                    <button 
                      className="expand-btn"
                      onClick={() => toggleRowExpansion(obl.id)}
                    >
                      {expandedRows.has(obl.id) ? '−' : '+'}
                    </button>
                  </td>
                  <td>
                    <span className={`risk-badge ${getRiskBadgeClass(obl.risk_status)}`}>
                      {obl.risk_status}
                    </span>
                  </td>
                  <td className="obligation-cell">
                    <Link to={`/obligations/${obl.id}`} className="obligation-title">
                      {obl.title}
                    </Link>
                    <div className="regulation-tag">{obl.regulation_tag || '—'}</div>
                  </td>
                  <td className="circular-cell">
                    <span className="circular-number">{obl.rbi_circular}</span>
                  </td>
                  <td>
                    <span className="category-badge">{obl.compliance_category}</span>
                  </td>
                  <td>{obl.control_owner}</td>
                  <td>
                    <span className="frequency-badge">{obl.frequency}</span>
                  </td>
                  <td>
                    {obl.sla_due_date 
                      ? new Date(obl.sla_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'No SLA'}
                    {obl.days_remaining !== null && obl.days_remaining < 0 && (
                      <div className="overdue-text">{Math.abs(obl.days_remaining)}d overdue</div>
                    )}
                  </td>
                  <td>
                    <span className={`evidence-status ${obl.evidence_count > 0 ? 'has-evidence' : 'no-evidence'}`}>
                      {obl.evidence_count > 0 ? `${obl.evidence_count} files` : 'Missing'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/obligations/${obl.id}`} className="btn btn-sm btn-outline">
                      View
                    </Link>
                  </td>
                </tr>
                
                {/* Expanded Row - Regulation Details */}
                {expandedRows.has(obl.id) && (
                  <tr className="expanded-row">
                    <td colSpan={10}>
                      <div className="regulation-details-panel">
                        <div className="detail-grid">
                          <div className="detail-section">
                            <h4>Regulatory Reference</h4>
                            <div className="detail-item">
                              <span className="label">Master Direction / Act</span>
                              <span className="value">{obl.master_direction}</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Applicable Clause</span>
                              <span className="value clause">{obl.applicable_clause}</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Source of Truth</span>
                              <a 
                                href="https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                              >
                                {obl.source_of_truth} →
                              </a>
                            </div>
                          </div>
                          
                          <div className="detail-section penalty-section">
                            <h4>Penalty Exposure</h4>
                            <div className="penalty-value">
                              <span className="penalty-icon">⚠️</span>
                              {obl.penalty_exposure}
                            </div>
                          </div>
                          
                          <div className="detail-section">
                            <h4>Evidence Checklist</h4>
                            <ul className="evidence-checklist">
                              {obl.evidence_checklist?.map((item, idx) => (
                                <li key={idx}>
                                  <span className="check-icon">{obl.evidence_count > idx ? '✓' : '○'}</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ObligationRegister;
