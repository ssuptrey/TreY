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
  days_remaining?: number;
  risk_level?: 'safe' | 'warning' | 'critical' | 'overdue';
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
  overdue: number;
  critical: number;
  warning: number;
  safe: number;
}

export interface DashboardData {
  obligations: Obligation[];
  summary: DashboardSummary;
}
