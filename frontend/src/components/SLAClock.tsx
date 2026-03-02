// ============================================
// SLA CLOCK COMPONENT
// ============================================
// Circular timer showing SLA consumption percentage

import React from 'react';

interface SLAClockProps {
  dueDate: string;
  createdAt: string;
  status: string;
}

const SLAClock: React.FC<SLAClockProps> = ({ dueDate, createdAt, status }) => {
  const now = new Date();
  const due = new Date(dueDate);
  const created = new Date(createdAt);
  
  // Calculate total SLA duration and consumed time
  const totalDuration = due.getTime() - created.getTime();
  const consumedDuration = now.getTime() - created.getTime();
  
  // Calculate percentage consumed (cap at 100% for display, but track overdue)
  let percentageConsumed = Math.round((consumedDuration / totalDuration) * 100);
  const isOverdue = percentageConsumed > 100;
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysOverdue = Math.abs(Math.min(0, daysRemaining));
  
  // For visual display, cap at 100
  const displayPercentage = Math.min(100, Math.max(0, percentageConsumed));
  
  // Determine color based on status
  const getColor = () => {
    if (status === 'closed') return '#6c757d';
    if (status === 'breached' || isOverdue) return '#dc3545';
    if (percentageConsumed >= 80) return '#dc3545'; // Critical
    if (percentageConsumed >= 60) return '#fd7e14'; // Warning
    if (percentageConsumed >= 40) return '#ffc107'; // Caution
    return '#28a745'; // Safe
  };

  // SVG circle parameters
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  const color = getColor();

  if (status === 'closed') {
    return (
      <div className="sla-clock-container">
        <div className="sla-clock closed">
          <div className="clock-check">✓</div>
          <div className="clock-label">CLOSED</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sla-clock-container">
      <div className="sla-clock">
        <svg width={size} height={size} className="clock-svg">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e9ecef"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          {/* Percentage text */}
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            className="clock-percentage"
            fill={color}
          >
            {isOverdue ? '100%+' : `${displayPercentage}%`}
          </text>
          <text
            x="50%"
            y="62%"
            textAnchor="middle"
            className="clock-sublabel"
            fill="#666"
          >
            SLA Consumed
          </text>
        </svg>
        <div className="clock-details">
          {isOverdue ? (
            <span className="clock-overdue">
              {daysOverdue} days overdue
            </span>
          ) : (
            <span className={`clock-remaining ${daysRemaining <= 15 ? 'warning' : ''}`}>
              {daysRemaining} days remaining
            </span>
          )}
        </div>
      </div>
      <div className="clock-meta">
        <div className="meta-item">
          <span className="meta-label">Started</span>
          <span className="meta-value">{new Date(createdAt).toLocaleDateString()}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Due Date</span>
          <span className="meta-value" style={{ color: isOverdue ? '#dc3545' : 'inherit' }}>
            {new Date(dueDate).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SLAClock;
