// ============================================
// API CLIENT
// ============================================
// Centralized API client for all backend calls

import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { 
  User, 
  Obligation, 
  SLA, 
  Evidence, 
  AuditLog, 
  LoginResponse,
  DashboardData,
  ApiResponse 
} from '../types';

const API_BASE_URL: string = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: string;
  organizationId?: string;
  organizationName?: string;
  organizationType?: string;
}

export const authAPI = {
  login: (email: string, password: string): Promise<AxiosResponse<LoginResponse>> => 
    api.post('/auth/login', { email, password }),
  
  register: (data: RegisterData): Promise<AxiosResponse<LoginResponse>> => 
    api.post('/auth/register', data),
  
  me: (): Promise<AxiosResponse<ApiResponse<User>>> => 
    api.get('/auth/me'),
  
  logout: (): Promise<AxiosResponse<void>> => 
    api.post('/auth/logout')
};

// ============================================
// OBLIGATIONS API
// ============================================
interface ObligationFilters {
  status?: string;
  owner?: string;
  search?: string;
}

interface CreateObligationData {
  title: string;
  description: string;
  ownerId: string;
  dueDate: string;
  regulationTag?: string;
}

export const obligationsAPI = {
  list: (filters: ObligationFilters = {}): Promise<AxiosResponse<ApiResponse<Obligation[]>>> => 
    api.get('/obligations', { params: filters }),
  
  get: (id: string): Promise<AxiosResponse<ApiResponse<Obligation>>> => 
    api.get(`/obligations/${id}`),
  
  create: (data: CreateObligationData): Promise<AxiosResponse<ApiResponse<Obligation>>> => 
    api.post('/obligations', data),
  
  updateStatus: (id: string, status: string): Promise<AxiosResponse<ApiResponse<Obligation>>> => 
    api.patch(`/obligations/${id}/status`, { status }),
  
  reassignOwner: (id: string, newOwnerId: string, reason: string): Promise<AxiosResponse<ApiResponse<void>>> => 
    api.post(`/obligations/${id}/reassign`, { newOwnerId, reason })
};

// ============================================
// SLA API
// ============================================
export const slaAPI = {
  extend: (obligationId: string, newDueDate: string, reason: string): Promise<AxiosResponse<ApiResponse<SLA>>> => 
    api.post(`/sla/${obligationId}/extend`, { newDueDate, reason }),
  
  history: (obligationId: string): Promise<AxiosResponse<ApiResponse<SLA[]>>> => 
    api.get(`/sla/${obligationId}/history`),
  
  dashboard: (): Promise<AxiosResponse<ApiResponse<DashboardData>>> => 
    api.get('/sla/dashboard/risk')
};

// ============================================
// EVIDENCE API
// ============================================
export const evidenceAPI = {
  list: (obligationId: string): Promise<AxiosResponse<ApiResponse<Evidence[]>>> => 
    api.get(`/evidence/${obligationId}`),
  
  upload: (obligationId: string, file: File, referenceNote?: string): Promise<AxiosResponse<ApiResponse<Evidence>>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (referenceNote) {
      formData.append('referenceNote', referenceNote);
    }
    return api.post(`/evidence/${obligationId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  downloadUrl: (obligationId: string, evidenceId: string): string => 
    `${API_BASE_URL}/evidence/${obligationId}/${evidenceId}/download`
};

// ============================================
// EXPORT API
// ============================================
export const exportAPI = {
  obligationPdf: (id: string): string => 
    `${API_BASE_URL}/export/obligation/${id}/pdf`,
  
  obligationZip: (id: string): string => 
    `${API_BASE_URL}/export/obligation/${id}/zip`,
  
  allZip: (): string => 
    `${API_BASE_URL}/export/all/zip`
};

// ============================================
// USERS API
// ============================================
export const usersAPI = {
  list: (): Promise<AxiosResponse<ApiResponse<User[]>>> => 
    api.get('/users'),
  
  get: (id: string): Promise<AxiosResponse<ApiResponse<User>>> => 
    api.get(`/users/${id}`)
};

// ============================================
// AUDIT API
// ============================================
export const auditAPI = {
  getForEntity: (entityType: string, entityId: string): Promise<AxiosResponse<ApiResponse<AuditLog[]>>> => 
    api.get(`/audit/${entityType}/${entityId}`),
  
  list: (limit?: number): Promise<AxiosResponse<ApiResponse<AuditLog[]>>> => 
    api.get('/audit', { params: { limit } })
};

export default api;
