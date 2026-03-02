// ============================================
// EVIDENCE WALL PAGE
// ============================================
// Centralized evidence library with late/on-time tracking

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Evidence {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  obligation_id: string;
  obligation_title: string;
  obligation_due_date: string;
  is_late: boolean;
  days_late?: number;
  status: 'verified' | 'pending' | 'rejected';
  notes?: string;
}

interface FilterState {
  status: 'all' | 'late' | 'on-time';
  type: 'all' | 'pdf' | 'image' | 'document' | 'other';
  dateRange: 'all' | 'today' | 'week' | 'month';
  quality: 'all' | 'verified' | 'pending' | 'rejected';
}

const EvidenceWall: React.FC = () => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    type: 'all',
    dateRange: 'all',
    quality: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEvidence();
  }, []);

  const loadEvidence = async () => {
    // Simulate API call - replace with real API
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Demo data
    const demoEvidence: Evidence[] = [
      {
        id: '1',
        file_name: 'KYC_Verification_Report_Q4.pdf',
        file_type: 'application/pdf',
        file_size: 2456789,
        uploaded_at: '2026-01-15T10:30:00Z',
        uploaded_by: 'Rahul Sharma',
        obligation_id: '101',
        obligation_title: 'KYC Documentation Update',
        obligation_due_date: '2026-01-10T00:00:00Z',
        is_late: true,
        days_late: 5,
        status: 'verified',
        notes: 'Delayed due to vendor system downtime'
      },
      {
        id: '2',
        file_name: 'Monthly_Compliance_Report_Jan.pdf',
        file_type: 'application/pdf',
        file_size: 1234567,
        uploaded_at: '2026-01-28T14:20:00Z',
        uploaded_by: 'Priya Patel',
        obligation_id: '102',
        obligation_title: 'Monthly Compliance Report Submission',
        obligation_due_date: '2026-01-31T00:00:00Z',
        is_late: false,
        status: 'pending'
      },
      {
        id: '3',
        file_name: 'AML_Training_Completion.xlsx',
        file_type: 'application/vnd.ms-excel',
        file_size: 567890,
        uploaded_at: '2026-01-20T09:15:00Z',
        uploaded_by: 'Amit Kumar',
        obligation_id: '103',
        obligation_title: 'AML/CFT Training Records',
        obligation_due_date: '2026-01-25T00:00:00Z',
        is_late: false,
        status: 'verified'
      },
      {
        id: '4',
        file_name: 'Grievance_Resolution_Log.pdf',
        file_type: 'application/pdf',
        file_size: 890123,
        uploaded_at: '2026-01-22T16:45:00Z',
        uploaded_by: 'Sneha Reddy',
        obligation_id: '104',
        obligation_title: 'Grievance Redressal Report',
        obligation_due_date: '2026-01-15T00:00:00Z',
        is_late: true,
        days_late: 7,
        status: 'verified'
      },
      {
        id: '5',
        file_name: 'IT_Security_Audit_Screenshot.png',
        file_type: 'image/png',
        file_size: 345678,
        uploaded_at: '2026-01-27T11:00:00Z',
        uploaded_by: 'Vikram Singh',
        obligation_id: '105',
        obligation_title: 'IT Security Assessment',
        obligation_due_date: '2026-02-15T00:00:00Z',
        is_late: false,
        status: 'pending',
        notes: 'Preliminary screenshot - full report pending'
      },
      {
        id: '6',
        file_name: 'CERSAI_Filing_Confirmation.pdf',
        file_type: 'application/pdf',
        file_size: 234567,
        uploaded_at: '2026-01-18T13:30:00Z',
        uploaded_by: 'Neha Gupta',
        obligation_id: '106',
        obligation_title: 'CERSAI Registration Filing',
        obligation_due_date: '2026-01-20T00:00:00Z',
        is_late: false,
        status: 'verified'
      },
      {
        id: '7',
        file_name: 'RBI_Return_Dec2025.pdf',
        file_type: 'application/pdf',
        file_size: 3456789,
        uploaded_at: '2026-01-05T17:00:00Z',
        uploaded_by: 'Compliance Team',
        obligation_id: '107',
        obligation_title: 'RBI Monthly Return',
        obligation_due_date: '2025-12-31T00:00:00Z',
        is_late: true,
        days_late: 5,
        status: 'rejected',
        notes: 'Format error - resubmission required'
      }
    ];

    setEvidence(demoEvidence);
    setLoading(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (type: string): string => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('word') || type.includes('document')) return '📝';
    return '📁';
  };

  const getFileTypeLabel = (type: string): string => {
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'Image';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'Spreadsheet';
    if (type.includes('word') || type.includes('document')) return 'Document';
    return 'File';
  };

  // Apply filters
  const filteredEvidence = evidence.filter(e => {
    // Status filter
    if (filters.status === 'late' && !e.is_late) return false;
    if (filters.status === 'on-time' && e.is_late) return false;

    // Type filter
    if (filters.type === 'pdf' && !e.file_type.includes('pdf')) return false;
    if (filters.type === 'image' && !e.file_type.includes('image')) return false;
    if (filters.type === 'document' && !e.file_type.includes('word') && !e.file_type.includes('document')) return false;

    // Quality filter
    if (filters.quality !== 'all' && e.status !== filters.quality) return false;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        e.file_name.toLowerCase().includes(search) ||
        e.obligation_title.toLowerCase().includes(search) ||
        e.uploaded_by.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Statistics
  const stats = {
    total: evidence.length,
    late: evidence.filter(e => e.is_late).length,
    onTime: evidence.filter(e => !e.is_late).length,
    pending: evidence.filter(e => e.status === 'pending').length,
    verified: evidence.filter(e => e.status === 'verified').length,
    rejected: evidence.filter(e => e.status === 'rejected').length
  };

  if (loading) {
    return <div className="loading">Loading evidence library...</div>;
  }

  return (
    <div className="evidence-wall">
      <div className="page-header">
        <div className="header-left">
          <h1>Evidence Library</h1>
          <span className="header-subtitle">All compliance evidence in one place</span>
        </div>
        <div className="header-actions">
          {selectedEvidence.size > 0 && (
            <span className="selection-count">{selectedEvidence.size} selected</span>
          )}
          <button 
            className="btn btn-outline"
            onClick={() => {
              // Bulk export functionality
              alert(`Exporting ${selectedEvidence.size > 0 ? selectedEvidence.size : evidence.length} evidence files...`);
            }}
          >
            {selectedEvidence.size > 0 ? `Export Selected (${selectedEvidence.size})` : 'Export All Evidence'}
          </button>
          <button className="btn btn-primary">
            Upload Evidence
          </button>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="evidence-stats-bar">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Files</div>
        </div>
        <div className="stat-card on-time">
          <div className="stat-number">{stats.onTime}</div>
          <div className="stat-label">On Time</div>
        </div>
        <div className="stat-card late">
          <div className="stat-number">{stats.late}</div>
          <div className="stat-label">Late Uploads</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card verified">
          <div className="stat-number">{stats.verified}</div>
          <div className="stat-label">Verified</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-number">{stats.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Late Evidence Alert */}
      {stats.late > 0 && (
        <div className="late-evidence-alert">
          <div className="alert-icon">⚠</div>
          <div className="alert-content">
            <strong>{stats.late} evidence files</strong> were uploaded after their obligation deadlines.
            This impacts compliance scoring and may be flagged during audits.
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setFilters({...filters, status: 'late'})}>
            View Late Files
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="evidence-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by filename, obligation, or uploader..."
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
            <option value="all">All</option>
            <option value="on-time">On Time</option>
            <option value="late">Late</option>
          </select>
        </div>
        <div className="filter-group">
          <label>File Type:</label>
          <select 
            value={filters.type}
            onChange={e => setFilters({...filters, type: e.target.value as FilterState['type']})}
          >
            <option value="all">All Types</option>
            <option value="pdf">PDF</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Quality:</label>
          <select 
            value={filters.quality}
            onChange={e => setFilters({...filters, quality: e.target.value as FilterState['quality']})}
          >
            <option value="all">All Status</option>
            <option value="verified">Verified ✓</option>
            <option value="pending">Pending Review</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Evidence Quality Summary */}
      <div className="evidence-quality-summary">
        <div className="quality-card">
          <div className="quality-icon verified">✓</div>
          <div className="quality-info">
            <div className="quality-number">{stats.verified}</div>
            <div className="quality-label">Verified</div>
          </div>
        </div>
        <div className="quality-card">
          <div className="quality-icon pending">◷</div>
          <div className="quality-info">
            <div className="quality-number">{stats.pending}</div>
            <div className="quality-label">Pending Review</div>
          </div>
        </div>
        <div className="quality-card">
          <div className="quality-icon rejected">✗</div>
          <div className="quality-info">
            <div className="quality-number">{stats.rejected}</div>
            <div className="quality-label">Rejected</div>
          </div>
        </div>
        <div className="quality-card late-highlight">
          <div className="quality-icon late">!</div>
          <div className="quality-info">
            <div className="quality-number">{stats.late}</div>
            <div className="quality-label">Late Uploads</div>
          </div>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="evidence-table-container">
        <table className="evidence-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input 
                  type="checkbox" 
                  checked={selectedEvidence.size === filteredEvidence.length && filteredEvidence.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEvidence(new Set(filteredEvidence.map(ev => ev.id)));
                    } else {
                      setSelectedEvidence(new Set());
                    }
                  }}
                />
              </th>
              <th>File</th>
              <th>Related Obligation</th>
              <th>Uploaded By</th>
              <th>Upload Time</th>
              <th>Timeliness</th>
              <th>Quality</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvidence.map(e => (
              <tr key={e.id} className={e.is_late ? 'late-row' : ''}>
                <td className="checkbox-col">
                  <input 
                    type="checkbox" 
                    checked={selectedEvidence.has(e.id)}
                    onChange={(ev) => {
                      const newSelection = new Set(selectedEvidence);
                      if (ev.target.checked) {
                        newSelection.add(e.id);
                      } else {
                        newSelection.delete(e.id);
                      }
                      setSelectedEvidence(newSelection);
                    }}
                  />
                </td>
                <td className="file-cell">
                  <span className="file-icon">{getFileIcon(e.file_type)}</span>
                  <div className="file-info">
                    <div className="file-name">{e.file_name}</div>
                    <div className="file-meta">
                      {getFileTypeLabel(e.file_type)} • {formatFileSize(e.file_size)}
                    </div>
                  </div>
                </td>
                <td>
                  <Link to={`/obligations/${e.obligation_id}`} className="obligation-link">
                    {e.obligation_title}
                  </Link>
                  <div className="obligation-due">Due: {formatDate(e.obligation_due_date).split(',')[0]}</div>
                </td>
                <td className="uploader-cell">{e.uploaded_by}</td>
                <td className="timestamp-cell">
                  <div className="timestamp">{formatDate(e.uploaded_at)}</div>
                </td>
                <td className="timeliness-cell">
                  {e.is_late ? (
                    <span className="late-badge">
                      {e.days_late}d LATE
                    </span>
                  ) : (
                    <span className="on-time-badge">On Time</span>
                  )}
                </td>
                <td className="quality-cell">
                  <span className={`quality-badge ${e.status}`}>
                    {e.status === 'verified' && '✓ '}
                    {e.status === 'rejected' && '✗ '}
                    {e.status === 'pending' && '◷ '}
                    {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                  </span>
                  {e.notes && (
                    <span className="quality-note" title={e.notes}>ⓘ</span>
                  )}
                </td>
                <td className="actions-cell">
                  <button className="action-btn" title="Download">↓</button>
                  <button className="action-btn" title="View">👁</button>
                  {e.status === 'pending' && (
                    <button className="action-btn verify" title="Verify">✓</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Missing Evidence Section */}
      <div className="missing-evidence-section">
        <h3>Missing Evidence Alerts</h3>
        <p className="section-subtitle">Obligations approaching deadline with no evidence uploaded</p>
        <div className="missing-evidence-list">
          <div className="missing-item">
            <div className="missing-icon">!</div>
            <div className="missing-content">
              <div className="missing-title">Fair Practice Code - Quarterly Review</div>
              <div className="missing-meta">Due in 3 days • No evidence uploaded • Owner: Compliance Team</div>
            </div>
            <button className="btn btn-sm btn-outline">Upload Now</button>
          </div>
          <div className="missing-item">
            <div className="missing-icon">!</div>
            <div className="missing-content">
              <div className="missing-title">Data Privacy Assessment</div>
              <div className="missing-meta">Due in 5 days • No evidence uploaded • Owner: IT Security</div>
            </div>
            <button className="btn btn-sm btn-outline">Upload Now</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceWall;
