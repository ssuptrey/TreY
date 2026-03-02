// ============================================
// OWNERSHIP TIMELINE COMPONENT
// ============================================
// Vertical timeline showing ownership transfers with immutability indicators

import React from 'react';

interface Owner {
  id: string;
  user_id: string;
  owner_name: string;
  owner_email: string;
  assigned_at: string;
  assigned_by_name: string;
  is_current: boolean;
  reassignment_reason?: string;
}

interface OwnershipTimelineProps {
  owners: Owner[];
  obligationCreatedAt: string;
}

const OwnershipTimeline: React.FC<OwnershipTimelineProps> = ({ owners, obligationCreatedAt }) => {
  // Sort owners by assignment date (oldest first)
  const sortedOwners = [...owners].sort(
    (a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime()
  );

  const getTimeElapsed = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const getOwnershipDuration = (owner: Owner, index: number) => {
    const start = new Date(owner.assigned_at);
    const end = owner.is_current 
      ? new Date() 
      : (sortedOwners[index + 1] 
        ? new Date(sortedOwners[index + 1].assigned_at) 
        : new Date());
    const diff = end.getTime() - start.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="ownership-timeline">
      <div className="timeline-header">
        <h3>Ownership Trail</h3>
        <span className="immutable-badge">
          <span className="lock-icon">■</span>
          IMMUTABLE RECORD
        </span>
      </div>
      
      <div className="timeline-track">
        {/* Obligation Created Node */}
        <div className="timeline-node origin">
          <div className="node-connector"></div>
          <div className="node-dot origin-dot"></div>
          <div className="node-content">
            <div className="node-title">Obligation Created</div>
            <div className="node-meta">
              {new Date(obligationCreatedAt).toLocaleDateString()} at{' '}
              {new Date(obligationCreatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {sortedOwners.map((owner, index) => {
          const duration = getOwnershipDuration(owner, index);
          const isReassignment = index > 0;
          
          return (
            <div 
              key={owner.id} 
              className={`timeline-node ${owner.is_current ? 'current' : 'past'} ${isReassignment ? 'reassignment' : 'initial'}`}
            >
              <div className="node-connector"></div>
              <div className={`node-dot ${owner.is_current ? 'current-dot' : ''}`}>
                {owner.is_current && <span className="pulse"></span>}
              </div>
              <div className="node-content">
                <div className="node-header">
                  <span className={`node-action ${isReassignment ? 'reassigned' : 'assigned'}`}>
                    {isReassignment ? 'Reassigned' : 'Assigned'}
                  </span>
                  {owner.is_current && <span className="current-badge">CURRENT</span>}
                </div>
                <div className="node-title">{owner.owner_name}</div>
                <div className="node-email">{owner.owner_email}</div>
                <div className="node-meta">
                  <span className="meta-date">
                    {new Date(owner.assigned_at).toLocaleDateString()} at{' '}
                    {new Date(owner.assigned_at).toLocaleTimeString()}
                  </span>
                  <span className="meta-ago">({getTimeElapsed(owner.assigned_at)})</span>
                </div>
                <div className="node-assigner">
                  Assigned by <strong>{owner.assigned_by_name}</strong>
                </div>
                {owner.reassignment_reason && (
                  <div className="node-reason">
                    <span className="reason-label">Reason:</span>
                    <span className="reason-text">{owner.reassignment_reason}</span>
                  </div>
                )}
                <div className="node-duration">
                  <span className="duration-icon">—</span>
                  {owner.is_current 
                    ? `Owning for ${duration} days` 
                    : `Owned for ${duration} days`}
                </div>
              </div>
            </div>
          );
        })}

        {sortedOwners.length === 0 && (
          <div className="timeline-empty">
            <div className="empty-icon">!</div>
            <div className="empty-text">No owner assigned</div>
            <div className="empty-warning">OWNERSHIP AMBIGUITY DETECTED</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnershipTimeline;
