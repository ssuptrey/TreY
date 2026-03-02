// ============================================
// MY TASKS PAGE
// ============================================
// Personal compliance task dashboard for logged-in user

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Task {
  id: string;
  obligation_id: string;
  obligation_title: string;
  type: 'evidence_upload' | 'review' | 'approval' | 'escalation' | 'action_required';
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date: string;
  days_remaining: number;
  status: 'pending' | 'in_progress' | 'completed';
  description: string;
  regulation_tag?: string;
}

interface TaskStats {
  overdue: number;
  today: number;
  upcoming: number;
  pendingApprovals: number;
}

const MyTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'upcoming' | 'approvals'>('overdue');
  const currentUser = 'Rahul Sharma'; // Would come from auth context

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    await new Promise(resolve => setTimeout(resolve, 600));

    // Demo tasks
    const demoTasks: Task[] = [
      {
        id: '1',
        obligation_id: '101',
        obligation_title: 'KYC Documentation Update',
        type: 'evidence_upload',
        priority: 'critical',
        due_date: '2026-01-25T00:00:00Z',
        days_remaining: -4,
        status: 'pending',
        description: 'Upload updated KYC verification documents',
        regulation_tag: 'RBI/KYC/2025'
      },
      {
        id: '2',
        obligation_id: '102',
        obligation_title: 'Monthly Compliance Report',
        type: 'action_required',
        priority: 'critical',
        due_date: '2026-01-29T00:00:00Z',
        days_remaining: 0,
        status: 'in_progress',
        description: 'Complete monthly compliance report submission',
        regulation_tag: 'RBI/DNBS/2024'
      },
      {
        id: '3',
        obligation_id: '103',
        obligation_title: 'AML Transaction Review',
        type: 'review',
        priority: 'high',
        due_date: '2026-01-30T00:00:00Z',
        days_remaining: 1,
        status: 'pending',
        description: 'Review flagged transactions for AML compliance',
        regulation_tag: 'PMLA/2025'
      },
      {
        id: '4',
        obligation_id: '104',
        obligation_title: 'Grievance Report Q4',
        type: 'approval',
        priority: 'high',
        due_date: '2026-01-31T00:00:00Z',
        days_remaining: 2,
        status: 'pending',
        description: 'Approve quarterly grievance redressal report',
        regulation_tag: 'RBI/GRMD/2024'
      },
      {
        id: '5',
        obligation_id: '105',
        obligation_title: 'IT Security Assessment',
        type: 'evidence_upload',
        priority: 'medium',
        due_date: '2026-02-05T00:00:00Z',
        days_remaining: 7,
        status: 'pending',
        description: 'Upload IT security audit findings',
        regulation_tag: 'RBI/IT/2025'
      },
      {
        id: '6',
        obligation_id: '106',
        obligation_title: 'Fair Practice Code Review',
        type: 'approval',
        priority: 'medium',
        due_date: '2026-02-10T00:00:00Z',
        days_remaining: 12,
        status: 'pending',
        description: 'Final approval for FPC compliance attestation',
        regulation_tag: 'RBI/FPC/2024'
      },
      {
        id: '7',
        obligation_id: '107',
        obligation_title: 'CERSAI Filing Verification',
        type: 'review',
        priority: 'high',
        due_date: '2026-01-28T00:00:00Z',
        days_remaining: -1,
        status: 'pending',
        description: 'Verify CERSAI registration data accuracy',
        regulation_tag: 'SARFAESI/2024'
      }
    ];

    setTasks(demoTasks);
    setLoading(false);
  };

  const getStats = (): TaskStats => {
    return {
      overdue: tasks.filter(t => t.days_remaining < 0 && t.status !== 'completed').length,
      today: tasks.filter(t => t.days_remaining === 0 && t.status !== 'completed').length,
      upcoming: tasks.filter(t => t.days_remaining > 0 && t.days_remaining <= 7 && t.status !== 'completed').length,
      pendingApprovals: tasks.filter(t => t.type === 'approval' && t.status === 'pending').length
    };
  };

  const getFilteredTasks = (): Task[] => {
    switch (activeTab) {
      case 'overdue':
        return tasks.filter(t => t.days_remaining < 0 && t.status !== 'completed');
      case 'today':
        return tasks.filter(t => t.days_remaining === 0 && t.status !== 'completed');
      case 'upcoming':
        return tasks.filter(t => t.days_remaining > 0 && t.days_remaining <= 7 && t.status !== 'completed');
      case 'approvals':
        return tasks.filter(t => t.type === 'approval' && t.status === 'pending');
      default:
        return tasks;
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type: Task['type']): string => {
    switch (type) {
      case 'evidence_upload': return '📎';
      case 'review': return '🔍';
      case 'approval': return '✓';
      case 'escalation': return '⚡';
      case 'action_required': return '!';
      default: return '•';
    }
  };

  const getTypeLabel = (type: Task['type']): string => {
    switch (type) {
      case 'evidence_upload': return 'Upload Evidence';
      case 'review': return 'Review Required';
      case 'approval': return 'Approval Needed';
      case 'escalation': return 'Escalation';
      case 'action_required': return 'Action Required';
      default: return type;
    }
  };

  const getPriorityClass = (priority: Task['priority']): string => {
    return `priority-${priority}`;
  };

  const stats = getStats();
  const filteredTasks = getFilteredTasks();

  if (loading) {
    return <div className="loading">Loading your tasks...</div>;
  }

  return (
    <div className="my-tasks-page">
      <div className="page-header">
        <div className="header-left">
          <h1>My Tasks</h1>
          <span className="header-subtitle">Welcome back, {currentUser}</span>
        </div>
        <div className="header-meta">
          <span className="current-date">{new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="task-stats">
        <div 
          className={`stat-tab ${activeTab === 'overdue' ? 'active' : ''} ${stats.overdue > 0 ? 'has-items critical' : ''}`}
          onClick={() => setActiveTab('overdue')}
        >
          <div className="stat-number">{stats.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div 
          className={`stat-tab ${activeTab === 'today' ? 'active' : ''} ${stats.today > 0 ? 'has-items warning' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          <div className="stat-number">{stats.today}</div>
          <div className="stat-label">Due Today</div>
        </div>
        <div 
          className={`stat-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <div className="stat-number">{stats.upcoming}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div 
          className={`stat-tab ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          <div className="stat-number">{stats.pendingApprovals}</div>
          <div className="stat-label">Approvals</div>
        </div>
      </div>

      {/* Urgent Alert */}
      {stats.overdue > 0 && activeTab !== 'overdue' && (
        <div className="urgent-alert" onClick={() => setActiveTab('overdue')}>
          <span className="alert-icon">⚠</span>
          <span>You have <strong>{stats.overdue} overdue tasks</strong> requiring immediate attention</span>
          <span className="view-link">View →</span>
        </div>
      )}

      {/* Task List */}
      <div className="task-list-section">
        <div className="section-header">
          <h2>
            {activeTab === 'overdue' && 'Overdue Tasks'}
            {activeTab === 'today' && "Today's Tasks"}
            {activeTab === 'upcoming' && 'Upcoming Tasks (7 days)'}
            {activeTab === 'approvals' && 'Pending Approvals'}
          </h2>
          <span className="task-count">{filteredTasks.length} tasks</span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="no-tasks">
            <div className="no-tasks-icon">✓</div>
            <div className="no-tasks-text">No tasks in this category</div>
            <div className="no-tasks-subtext">You're all caught up!</div>
          </div>
        ) : (
          <div className="task-list">
            {filteredTasks.map(task => (
              <div key={task.id} className={`task-card ${getPriorityClass(task.priority)}`}>
                <div className="task-priority-indicator"></div>
                <div className="task-icon">{getTypeIcon(task.type)}</div>
                <div className="task-content">
                  <div className="task-header">
                    <Link to={`/obligations/${task.obligation_id}`} className="task-title">
                      {task.obligation_title}
                    </Link>
                    <span className={`task-type ${task.type}`}>{getTypeLabel(task.type)}</span>
                  </div>
                  <div className="task-description">{task.description}</div>
                  <div className="task-meta">
                    {task.regulation_tag && (
                      <span className="regulation-tag">{task.regulation_tag}</span>
                    )}
                    <span className="due-date">
                      Due: {formatDate(task.due_date)}
                      {task.days_remaining < 0 && (
                        <span className="overdue-badge">{Math.abs(task.days_remaining)}d overdue</span>
                      )}
                      {task.days_remaining === 0 && (
                        <span className="today-badge">Today</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="task-actions">
                  {task.type === 'evidence_upload' && (
                    <button className="btn btn-sm btn-primary">Upload</button>
                  )}
                  {task.type === 'approval' && (
                    <>
                      <button className="btn btn-sm btn-outline">Reject</button>
                      <button className="btn btn-sm btn-primary">Approve</button>
                    </>
                  )}
                  {task.type === 'review' && (
                    <button className="btn btn-sm btn-primary">Review</button>
                  )}
                  {task.type === 'action_required' && (
                    <Link to={`/obligations/${task.obligation_id}`} className="btn btn-sm btn-primary">
                      Take Action
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Approvals Queue */}
      {activeTab !== 'approvals' && stats.pendingApprovals > 0 && (
        <div className="approvals-preview">
          <div className="preview-header">
            <h3>Pending Approvals</h3>
            <button className="view-all" onClick={() => setActiveTab('approvals')}>
              View All ({stats.pendingApprovals})
            </button>
          </div>
          <div className="approval-queue">
            {tasks
              .filter(t => t.type === 'approval' && t.status === 'pending')
              .slice(0, 3)
              .map(task => (
                <div key={task.id} className="approval-item">
                  <div className="approval-content">
                    <div className="approval-title">{task.obligation_title}</div>
                    <div className="approval-meta">
                      Submitted for approval • Due {formatDate(task.due_date)}
                    </div>
                  </div>
                  <div className="approval-actions">
                    <button className="btn btn-sm btn-outline">Reject</button>
                    <button className="btn btn-sm btn-primary">Approve</button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
