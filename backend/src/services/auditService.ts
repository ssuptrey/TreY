// ============================================
// AUDIT SERVICE
// ============================================
// ALL actions must generate audit logs. NO exceptions.
// This service provides centralized audit logging.

import { pool } from '../config/database';
import { AuditRepository } from '../repositories/auditRepository';

export interface AuditLogParams {
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  previousValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  additionalContext?: Record<string, any> | null;
}

export interface AuditLogResult {
  id: string;
  timestamp: Date;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  previous_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  additional_context: Record<string, any> | null;
  timestamp: Date;
  performed_by_name?: string;
  performed_by_email?: string;
}

/**
 * Create an audit log entry
 * CRITICAL: This function should be called for EVERY state change in the system
 */
const auditRepository = new AuditRepository(pool);

export async function createAuditLog({
  entityType,
  entityId,
  action,
  performedBy,
  previousValue = null,
  newValue = null,
  ipAddress = null,
  userAgent = null,
  additionalContext = null
}: AuditLogParams): Promise<AuditLogResult> {
  // ENFORCEMENT: All audit log fields that are required must be present
  if (!entityType || !entityId || !action || !performedBy) {
    throw new Error('ENFORCEMENT VIOLATION: Audit log requires entityType, entityId, action, and performedBy');
  }

  return await auditRepository.create({ entityType, entityId, action, performedBy, previousValue, newValue, ipAddress, userAgent, additionalContext });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogsForEntity(
  entityType: string, 
  entityId: string
): Promise<AuditLogEntry[]> {
  return await auditRepository.findByEntity(entityType, entityId);
}

/**
 * Get all audit logs for an organization (with pagination)
 */
export async function getAuditLogsForOrganization(
  organizationId: string, 
  options: { limit?: number; offset?: number } = {}
): Promise<AuditLogEntry[]> {
  const { limit = 100, offset = 0 } = options;
  
  return await auditRepository.findByOrganization(organizationId, limit, offset);
}

// Predefined action types for consistency
export const AuditActions = {
  // Obligation actions
  OBLIGATION_CREATE: 'OBLIGATION_CREATE',
  OBLIGATION_STATUS_CHANGE: 'OBLIGATION_STATUS_CHANGE',
  
  // Owner actions
  OWNER_ASSIGN: 'OWNER_ASSIGN',
  OWNER_REASSIGN: 'OWNER_REASSIGN',
  
  // SLA actions
  SLA_CREATE: 'SLA_CREATE',
  SLA_EXTEND: 'SLA_EXTEND',
  
  // Evidence actions
  EVIDENCE_UPLOAD: 'EVIDENCE_UPLOAD',
  EVIDENCE_LATE_UPLOAD: 'EVIDENCE_LATE_UPLOAD',
  
  // User actions
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  
  // Export actions
  EXPORT_GENERATE: 'EXPORT_GENERATE'
} as const;

export type AuditActionType = typeof AuditActions[keyof typeof AuditActions];
