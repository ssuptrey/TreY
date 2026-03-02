// Frontend Type Definitions

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'operator';
  organization_id: string;
  organization_name?: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
}

export interface Obligation {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  owner_name?: string;
  owner_email?: string;
  sla_deadline?: string;
  sla_due_date?: string;
  days_remaining?: number;
  risk_level?: 'safe' | 'warning' | 'critical' | 'overdue';
  risk_status?: string;
  regulation_tag?: string;
  evidence_count?: number;
}

export interface SLA {
  id: string;
  obligation_id: string;
  deadline: string;
  extension_reason: string | null;
  extended_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Evidence {
  id: string;
  obligation_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  upload_time: string;
  is_late: boolean;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  performed_by_name?: string;
  previous_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  timestamp: string;
}

export interface ObligationOwner {
  id: string;
  obligation_id: string;
  user_id: string;
  assigned_by: string;
  is_active: boolean;
  assigned_at: string;
  email?: string;
  full_name?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message?: string;
}

export interface DashboardSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  closed: number;
}

export interface DashboardObligation {
  id: string;
  title: string;
  status: string;
  regulation_tag: string | null;
  owner_name: string | null;
  due_date: string | null;
  days_remaining: number | null;
  risk_status: string;
  evidence_count: number;
  late_evidence_count: number;
}

export interface DashboardData {
  obligations: DashboardObligation[];
  summary: DashboardSummary;
}

export interface ObligationData {
  obligation: {
    id: string;
    title: string;
    description?: string;
    regulation_tag?: string;
    status: string;
    created_at: string;
    created_by_name: string;
    daysRemaining: number | null;
    riskStatus: string;
  };
  ownerHistory: any[];
  currentOwner?: any;
  slaHistory: any[];
  currentSla?: any;
  evidence: any[];
  auditTimeline: any[];
}
