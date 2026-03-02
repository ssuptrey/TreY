// ============================================
// UNIFIED INBOX - Single Queue for All Channels
// ============================================
// The one page NBFC ops teams actually need

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

interface InboxItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  channel: string;
  external_reference_id: string | null;
  category_code: string | null;
  category_name: string | null;
  department: string | null;
  classification_confidence: string;
  due_date: string;
  days_remaining: number;
  sla_status: string;
  owner_name: string | null;
  owner_email: string | null;
  organization_name: string;
  is_duplicate: boolean;
  evidence_count: number;
}

interface InboxStats {
  total_open: number;
  breached: number;
  due_today: number;
  at_risk: number;
  unclassified: number;
  unassigned: number;
  from_email: number;
  from_whatsapp: number;
  from_api: number;
  from_csv: number;
}

interface Category {
  code: string;
  name: string;
  description: string;
  default_sla_days: number;
  department: string;
  priority: string;
}

const UnifiedInbox: React.FC = () => {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track new items for highlight animation
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  
  // Demo mode state
  const [demoTriggering, setDemoTriggering] = useState(false);
  const [showDemoPanel, setShowDemoPanel] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'open',
    category: '',
    channel: '',
    sla_status: '',
    department: '',
    unassigned: false,
    unclassified: false
  });

  // Classification modal
  const [classifyModal, setClassifyModal] = useState<{ open: boolean; item: InboxItem | null }>({ open: false, item: null });
  const [selectedCategory, setSelectedCategory] = useState('');

  // Demo forward trigger - simulates receiving a forwarded email
  // Optional complaintIndex: 0=KYC, 1=Interest, 2=Harassment
  const triggerDemoForward = useCallback(async (complaintIndex?: number) => {
    if (demoTriggering) return;
    
    try {
      setDemoTriggering(true);
      const demoNames = ['KYC update', 'Incorrect interest', 'Harassment complaint'];
      const label = typeof complaintIndex === 'number' ? demoNames[complaintIndex] : 'random';
      console.log(`[Demo] Triggering: ${label}`);
      
      const response = await api.post('/ingestion/demo-forward', 
        typeof complaintIndex === 'number' ? { complaintIndex } : {}
      );
      
      if (response.data.success) {
        console.log(`[Demo] ✓ Created: ${response.data.obligation_number} - "${response.data.title}"`);
        // The auto-refresh will pick up the new item
      }
    } catch (err: any) {
      console.error('[Demo] Failed to trigger:', err);
    } finally {
      setDemoTriggering(false);
    }
  }, [demoTriggering]);

  // Hidden keyboard shortcuts for demo:
  // Alt+1 = KYC complaint
  // Alt+2 = Interest complaint  
  // Alt+3 = Harassment complaint
  // Alt+D = Random complaint
  // Alt+P = Toggle demo panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if Alt is held (not Ctrl - Chrome intercepts Ctrl+Shift+number)
      if (!e.altKey) return;
      
      // Alt+1 - KYC update complaint
      if (e.code === 'Digit1' || e.key === '1') {
        e.preventDefault();
        console.log('[Demo] Shortcut: Alt+1 → KYC update');
        triggerDemoForward(0);
        return;
      }
      // Alt+2 - Interest charge complaint
      if (e.code === 'Digit2' || e.key === '2') {
        e.preventDefault();
        console.log('[Demo] Shortcut: Alt+2 → Incorrect interest');
        triggerDemoForward(1);
        return;
      }
      // Alt+3 - Harassment complaint
      if (e.code === 'Digit3' || e.key === '3') {
        e.preventDefault();
        console.log('[Demo] Shortcut: Alt+3 → Harassment');
        triggerDemoForward(2);
        return;
      }
      // Alt+D - Random demo forward trigger
      if (e.code === 'KeyD' || e.key === 'D' || e.key === 'd') {
        e.preventDefault();
        console.log('[Demo] Shortcut: Alt+D → Random complaint');
        triggerDemoForward();
        return;
      }
      // Alt+P - Toggle demo panel
      if (e.code === 'KeyP' || e.key === 'P' || e.key === 'p') {
        e.preventDefault();
        console.log('[Demo] Toggling demo panel');
        setShowDemoPanel(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerDemoForward]);

  const loadInbox = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.channel) params.append('channel', filters.channel);
      if (filters.sla_status) params.append('sla_status', filters.sla_status);
      if (filters.department) params.append('department', filters.department);
      if (filters.unassigned) params.append('unassigned', 'true');
      if (filters.unclassified) params.append('unclassified', 'true');
      
      const response = await api.get(`/ingestion/inbox?${params.toString()}`);
      const newItems: InboxItem[] = response.data.data;
      
      setItems(prevItems => {
        // Detect new items for highlight animation
        const prevIds = new Set(prevItems.map(item => item.id));
        const freshItems = newItems.filter(item => !prevIds.has(item.id));
        
        if (freshItems.length > 0 && prevItems.length > 0) {
          // New items detected - add to highlight set
          setNewItemIds(new Set(freshItems.map(item => item.id)));
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setNewItemIds(new Set());
          }, 3000);
        }
        
        return newItems;
      });
      
      setStats(response.data.stats);
      setError(null);
    } catch (err: any) {
      // Don't show error for rate limiting (429) - just skip this refresh
      if (err.response?.status !== 429) {
        setError(err.response?.data?.error || 'Failed to load inbox');
      }
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/ingestion/categories');
      setCategories(response.data.data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadInbox();
  }, [loadInbox]);

  // Auto-refresh every 5 seconds for real-time demo experience
  useEffect(() => {
    const interval = setInterval(loadInbox, 5000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  useEffect(() => {
    loadCategories();
  }, []);

  const getChannelBadge = (channel: string) => {
    const badges: Record<string, { icon: string; color: string }> = {
      email: { icon: 'E', color: '#4285f4' },
      whatsapp: { icon: 'W', color: '#25d366' },
      api: { icon: 'A', color: '#6c757d' },
      csv: { icon: 'C', color: '#fd7e14' },
      forward: { icon: 'F', color: '#17a2b8' },
      manual: { icon: 'M', color: '#6f42c1' }
    };
    const badge = badges[channel] || { icon: '?', color: '#999' };
    return (
      <span 
        className="channel-badge-icon" 
        style={{ backgroundColor: badge.color }}
        title={channel.toUpperCase()}
      >
        {badge.icon}
      </span>
    );
  };

  const getSLABadge = (status: string, daysRemaining: number) => {
    const config: Record<string, { label: string; className: string }> = {
      breached: { label: `${Math.abs(daysRemaining)}d OVERDUE`, className: 'sla-breached' },
      due_today: { label: 'DUE TODAY', className: 'sla-due-today' },
      at_risk: { label: `${daysRemaining}d left`, className: 'sla-at-risk' },
      on_track: { label: `${daysRemaining}d left`, className: 'sla-on-track' }
    };
    const badge = config[status] || { label: '—', className: '' };
    return <span className={`sla-badge ${badge.className}`}>{badge.label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, string> = {
      critical: 'priority-critical',
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low'
    };
    return <span className={`priority-badge ${config[priority] || ''}`}>{priority}</span>;
  };

  const handleClassify = async () => {
    if (!classifyModal.item || !selectedCategory) return;
    
    try {
      await api.post(`/ingestion/classify/${classifyModal.item.id}`, {
        category_code: selectedCategory
      });
      setClassifyModal({ open: false, item: null });
      setSelectedCategory('');
      loadInbox();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to classify');
    }
  };

  return (
    <div className="unified-inbox">
      {/* Header with Stats */}
      <div className="inbox-header">
        <div className="inbox-title">
          <h1>Unified Inbox</h1>
          <span className="inbox-subtitle">All complaints from all channels</span>
        </div>
        
        {stats && (
          <div className="inbox-stats-bar">
            <div className="stat-pill total">
              <span className="stat-value">{stats.total_open}</span>
              <span className="stat-label">Open</span>
            </div>
            <div className="stat-pill breached" onClick={() => setFilters({...filters, sla_status: 'breached'})}>
              <span className="stat-value">{stats.breached}</span>
              <span className="stat-label">Breached</span>
            </div>
            <div className="stat-pill due-today" onClick={() => setFilters({...filters, sla_status: 'due_today'})}>
              <span className="stat-value">{stats.due_today}</span>
              <span className="stat-label">Due Today</span>
            </div>
            <div className="stat-pill at-risk" onClick={() => setFilters({...filters, sla_status: 'at_risk'})}>
              <span className="stat-value">{stats.at_risk}</span>
              <span className="stat-label">At Risk</span>
            </div>
            <div className="stat-pill unclassified" onClick={() => setFilters({...filters, unclassified: true})}>
              <span className="stat-value">{stats.unclassified}</span>
              <span className="stat-label">Unclassified</span>
            </div>
            <div className="stat-pill unassigned" onClick={() => setFilters({...filters, unassigned: true})}>
              <span className="stat-value">{stats.unassigned}</span>
              <span className="stat-label">Unassigned</span>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="inbox-filters">
        <div className="filter-group">
          <label>Status</label>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Category</label>
          <select 
            value={filters.category} 
            onChange={(e) => setFilters({...filters, category: e.target.value})}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.code} value={cat.code}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Channel</label>
          <select 
            value={filters.channel} 
            onChange={(e) => setFilters({...filters, channel: e.target.value})}
          >
            <option value="">All Channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="api">API</option>
            <option value="csv">CSV Import</option>
          </select>
        </div>

        <div className="filter-group">
          <label>SLA</label>
          <select 
            value={filters.sla_status} 
            onChange={(e) => setFilters({...filters, sla_status: e.target.value})}
          >
            <option value="">All</option>
            <option value="breached">Breached</option>
            <option value="due_today">Due Today</option>
            <option value="at_risk">At Risk</option>
            <option value="on_track">On Track</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Department</label>
          <select 
            value={filters.department} 
            onChange={(e) => setFilters({...filters, department: e.target.value})}
          >
            <option value="">All Departments</option>
            <option value="Customer Service">Customer Service</option>
            <option value="Operations">Operations</option>
            <option value="Collections">Collections</option>
            <option value="Fraud & Risk">Fraud & Risk</option>
            <option value="Compliance">Compliance</option>
            <option value="Technology">Technology</option>
          </select>
        </div>

        <div className="filter-toggles">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={filters.unassigned}
              onChange={(e) => setFilters({...filters, unassigned: e.target.checked})}
            />
            Unassigned Only
          </label>
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={filters.unclassified}
              onChange={(e) => setFilters({...filters, unclassified: e.target.checked})}
            />
            Unclassified Only
          </label>
        </div>

        <button className="reset-filters" onClick={() => setFilters({
          status: 'open', category: '', channel: '', sla_status: '', department: '', unassigned: false, unclassified: false
        })}>
          Reset
        </button>
      </div>

      {/* Error */}
      {error && <div className="inbox-error">{error}</div>}

      {/* Inbox Table */}
      <div className="inbox-table-wrapper">
        {loading ? (
          <div className="inbox-loading">Loading...</div>
        ) : items.length === 0 ? (
          <div className="inbox-empty">
            <p>No complaints match your filters</p>
          </div>
        ) : (
          <table className="inbox-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Complaint</th>
                <th style={{ width: '140px' }}>Category</th>
                <th style={{ width: '120px' }}>Department</th>
                <th style={{ width: '120px' }}>Owner</th>
                <th style={{ width: '100px' }}>SLA</th>
                <th style={{ width: '80px' }}>Priority</th>
                <th style={{ width: '50px' }}>Ev.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.id} 
                  className={`sla-row-${item.sla_status}${newItemIds.has(item.id) ? ' new-item-highlight' : ''}`}
                >
                  <td className="channel-col">
                    {getChannelBadge(item.channel)}
                  </td>
                  <td className="title-col">
                    <Link to={`/obligations/${item.id}`} className="item-link">
                      <span className="item-title">{item.title}</span>
                    </Link>
                    <span className="item-meta">
                      {new Date(item.created_at).toLocaleDateString()} 
                      {item.external_reference_id && ` • Ref: ${item.external_reference_id}`}
                    </span>
                  </td>
                  <td className="category-col">
                    {item.category_code ? (
                      <span className="category-badge" title={item.category_name || ''}>
                        {item.category_code}
                        {item.classification_confidence === 'low' && (
                          <span className="confidence-warning" title="Low confidence - review needed">?</span>
                        )}
                      </span>
                    ) : (
                      <button 
                        className="classify-btn"
                        onClick={() => setClassifyModal({ open: true, item })}
                      >
                        Classify
                      </button>
                    )}
                  </td>
                  <td className="department-col">
                    {item.department || '—'}
                  </td>
                  <td className="owner-col">
                    {item.owner_name ? (
                      <span className="owner-badge" title={item.owner_email || ''}>
                        {item.owner_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    ) : (
                      <span className="no-owner">Unassigned</span>
                    )}
                  </td>
                  <td className="sla-col">
                    {getSLABadge(item.sla_status, item.days_remaining)}
                  </td>
                  <td className="priority-col">
                    {getPriorityBadge(item.priority)}
                  </td>
                  <td className="evidence-col">
                    {item.evidence_count > 0 ? (
                      <span className="evidence-count">{item.evidence_count}</span>
                    ) : (
                      <span className="no-evidence">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Channel Stats Footer */}
      {stats && (
        <div className="channel-stats-footer">
          <span className="channel-stat">
            <span className="channel-icon email">E</span> Email: {stats.from_email}
          </span>
          <span className="channel-stat">
            <span className="channel-icon whatsapp">W</span> WhatsApp: {stats.from_whatsapp}
          </span>
          <span className="channel-stat">
            <span className="channel-icon api">A</span> API: {stats.from_api}
          </span>
          <span className="channel-stat">
            <span className="channel-icon csv">C</span> CSV: {stats.from_csv}
          </span>
        </div>
      )}

      {/* Hidden Demo Control Panel - Toggle with Alt+P */}
      {showDemoPanel && (
        <div className="demo-control-panel">
          <div className="demo-panel-header">
            <span>🎬 Demo Controls</span>
            <button onClick={() => setShowDemoPanel(false)}>×</button>
          </div>
          <div className="demo-panel-content">
            <p className="demo-hint">Use keyboard shortcuts for specific complaints:</p>
            <div className="demo-shortcuts">
              <button 
                className="demo-trigger-btn"
                onClick={() => triggerDemoForward(0)}
                disabled={demoTriggering}
              >
                <kbd>Alt+1</kbd> KYC Update Request
              </button>
              <button 
                className="demo-trigger-btn"
                onClick={() => triggerDemoForward(1)}
                disabled={demoTriggering}
              >
                <kbd>Alt+2</kbd> Interest Overcharge
              </button>
              <button 
                className="demo-trigger-btn"
                onClick={() => triggerDemoForward(2)}
                disabled={demoTriggering}
              >
                <kbd>Alt+3</kbd> Collection Harassment
              </button>
            </div>
            <p className="demo-note">
              {demoTriggering ? '⏳ Creating obligation...' : 'New obligations appear with highlight animation'}
            </p>
          </div>
        </div>
      )}

      {/* Floating demo indicator (only when triggering) */}
      {demoTriggering && (
        <div className="demo-processing-indicator">
          📧 Processing incoming email...
        </div>
      )}

      {/* Classification Modal */}
      {classifyModal.open && classifyModal.item && (
        <div className="modal-overlay" onClick={() => setClassifyModal({ open: false, item: null })}>
          <div className="classify-modal" onClick={e => e.stopPropagation()}>
            <h3>Classify Complaint</h3>
            <p className="modal-complaint-title">{classifyModal.item.title}</p>
            
            <div className="category-select-group">
              <label>Select Category:</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                autoFocus
              >
                <option value="">-- Select --</option>
                {categories.map(cat => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name} ({cat.default_sla_days} days SLA)
                  </option>
                ))}
              </select>
            </div>

            {selectedCategory && (
              <div className="category-preview">
                {(() => {
                  const cat = categories.find(c => c.code === selectedCategory);
                  return cat ? (
                    <>
                      <p><strong>Department:</strong> {cat.department}</p>
                      <p><strong>Default SLA:</strong> {cat.default_sla_days} days</p>
                      <p><strong>Priority:</strong> {cat.priority}</p>
                    </>
                  ) : null;
                })()}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setClassifyModal({ open: false, item: null })}>
                Cancel
              </button>
              <button 
                className="btn-classify" 
                onClick={handleClassify}
                disabled={!selectedCategory}
              >
                Apply Classification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedInbox;
