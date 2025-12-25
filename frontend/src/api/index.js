// ============================================
// API CLIENT
// ============================================
// Centralized API client for all backend calls

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
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
export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  me: () => 
    api.get('/auth/me'),
  
  logout: () => 
    api.post('/auth/logout')
};

// ============================================
// OBLIGATIONS API
// ============================================
export const obligationsAPI = {
  list: (filters = {}) => 
    api.get('/obligations', { params: filters }),
  
  get: (id) => 
    api.get(`/obligations/${id}`),
  
  create: (data) => 
    api.post('/obligations', data),
  
  updateStatus: (id, status) => 
    api.patch(`/obligations/${id}/status`, { status }),
  
  reassignOwner: (id, newOwnerId, reason) => 
    api.post(`/obligations/${id}/reassign`, { newOwnerId, reason })
};

// ============================================
// SLA API
// ============================================
export const slaAPI = {
  extend: (obligationId, newDueDate, reason) => 
    api.post(`/sla/${obligationId}/extend`, { newDueDate, reason }),
  
  history: (obligationId) => 
    api.get(`/sla/${obligationId}/history`),
  
  dashboard: () => 
    api.get('/sla/dashboard/risk')
};

// ============================================
// EVIDENCE API
// ============================================
export const evidenceAPI = {
  list: (obligationId) => 
    api.get(`/evidence/${obligationId}`),
  
  upload: (obligationId, file, referenceNote) => {
    const formData = new FormData();
    formData.append('file', file);
    if (referenceNote) {
      formData.append('referenceNote', referenceNote);
    }
    return api.post(`/evidence/${obligationId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  downloadUrl: (obligationId, evidenceId) => 
    `${API_BASE_URL}/evidence/${obligationId}/${evidenceId}/download`
};

// ============================================
// EXPORT API
// ============================================
export const exportAPI = {
  obligationPdf: (id) => 
    `${API_BASE_URL}/export/obligation/${id}/pdf`,
  
  obligationZip: (id) => 
    `${API_BASE_URL}/export/obligation/${id}/zip`,
  
  allZip: () => 
    `${API_BASE_URL}/export/all/zip`
};

// ============================================
// USERS API
// ============================================
export const usersAPI = {
  list: () => 
    api.get('/users'),
  
  get: (id) => 
    api.get(`/users/${id}`)
};

export default api;
