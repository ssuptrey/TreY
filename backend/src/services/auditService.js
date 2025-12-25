// ============================================
// AUDIT SERVICE
// ============================================
// ALL actions must generate audit logs. NO exceptions.
// This service provides centralized audit logging.

const { pool } = require('../config/database');

/**
 * Create an audit log entry
 * CRITICAL: This function should be called for EVERY state change in the system
 * 
 * @param {Object} params
 * @param {string} params.entityType - Type of entity (obligation, sla, evidence, etc.)
 * @param {string} params.entityId - UUID of the entity
 * @param {string} params.action - Action performed (CREATE, UPDATE, DELETE, etc.)
 * @param {string} params.performedBy - UUID of user who performed the action
 * @param {Object} params.previousValue - Previous state (null for CREATE)
 * @param {Object} params.newValue - New state (null for DELETE)
 * @param {string} params.ipAddress - IP address of the request
 * @param {string} params.userAgent - User agent of the request
 * @param {Object} params.additionalContext - Any additional context
 */
async function createAuditLog({
  entityType,
  entityId,
  action,
  performedBy,
  previousValue = null,
  newValue = null,
  ipAddress = null,
  userAgent = null,
  additionalContext = null
}) {
  // ENFORCEMENT: All audit log fields that are required must be present
  if (!entityType || !entityId || !action || !performedBy) {
    throw new Error('ENFORCEMENT VIOLATION: Audit log requires entityType, entityId, action, and performedBy');
  }

  const query = `
    INSERT INTO audit_logs (
      entity_type, entity_id, action, performed_by,
      previous_value, new_value, ip_address, user_agent, additional_context
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, timestamp
  `;

  const result = await pool.query(query, [
    entityType,
    entityId,
    action,
    performedBy,
    previousValue ? JSON.stringify(previousValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    ipAddress,
    userAgent,
    additionalContext ? JSON.stringify(additionalContext) : null
  ]);

  return result.rows[0];
}

/**
 * Get audit logs for an entity
 */
async function getAuditLogsForEntity(entityType, entityId) {
  const query = `
    SELECT 
      al.*,
      u.name as performed_by_name,
      u.email as performed_by_email
    FROM audit_logs al
    JOIN users u ON al.performed_by = u.id
    WHERE al.entity_type = $1 AND al.entity_id = $2
    ORDER BY al.timestamp DESC
  `;

  const result = await pool.query(query, [entityType, entityId]);
  return result.rows;
}

/**
 * Get all audit logs for an organization (with pagination)
 */
async function getAuditLogsForOrganization(organizationId, { limit = 100, offset = 0 } = {}) {
  const query = `
    SELECT 
      al.*,
      u.name as performed_by_name
    FROM audit_logs al
    JOIN users u ON al.performed_by = u.id
    WHERE u.organization_id = $1
    ORDER BY al.timestamp DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [organizationId, limit, offset]);
  return result.rows;
}

// Predefined action types for consistency
const AuditActions = {
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
};

module.exports = {
  createAuditLog,
  getAuditLogsForEntity,
  getAuditLogsForOrganization,
  AuditActions
};
