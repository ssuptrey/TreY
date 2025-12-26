// Core Domain Types

export interface User {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'admin' | 'manager' | 'operator';
  is_locked: boolean;
  password_expires_at: Date;
  password_history: PasswordHistory[];
  failed_login_attempts: number;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PasswordHistory {
  changed_at: string;
  hash: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Obligation {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ObligationOwner {
  id: string;
  obligation_id: string;
  user_id: string;
  assigned_by: string;
  is_active: boolean;
  assigned_at: Date;
}

export interface SLA {
  id: string;
  obligation_id: string;
  deadline: Date;
  extension_reason: string | null;
  extended_by: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface Evidence {
  id: string;
  obligation_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  upload_time: Date;
  is_late: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
