// Request & Response Types

import { Request } from 'express';

// Auth Request Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  organization_id: string;
  role: 'admin' | 'manager' | 'operator';
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// Obligation Request Types
export interface CreateObligationRequest {
  title: string;
  description: string;
  organization_id: string;
  owner_id: string;
  sla_deadline: string;
}

export interface UpdateObligationRequest {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

// SLA Request Types
export interface CreateSLARequest {
  obligation_id: string;
  deadline: string;
}

export interface ExtendSLARequest {
  obligation_id: string;
  new_deadline: string;
  extension_reason: string;
}

// Evidence Request Types
export interface UploadEvidenceRequest {
  obligation_id: string;
}

// User Request Types
export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  organization_id: string;
  role: 'admin' | 'manager' | 'operator';
}

export interface UpdateUserRoleRequest {
  role: 'admin' | 'manager' | 'operator';
}

// Extended Request with User
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization_id: string;
    organizationId?: string;
    is_active: boolean;
    organization_name?: string;
    organization_type?: string;
  };
  ipAddress?: string;
  userAgent?: string;
}

// Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
