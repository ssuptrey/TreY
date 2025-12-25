// ============================================
// EVIDENCE ROUTES
// ============================================
// ENFORCEMENT RULES:
// 1. Evidence uploaded AFTER SLA due_date must be flagged as late
// 2. Evidence cannot be replaced, only appended
// 3. Evidence is immutable after upload

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { createAuditLog, AuditActions } = require('../services/auditService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgDir = path.join(uploadDir, req.user.organization_id);
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir, { recursive: true });
    }
    cb(null, orgDir);
  },
  filename: (req, file, cb) => {
    // Use timestamp + original name to prevent overwrites
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * POST /api/evidence/:obligationId
 * Upload evidence for an obligation
 * 
 * ENFORCEMENT:
 * - Evidence uploaded after SLA due date is automatically flagged as late
 * - Evidence cannot be modified after upload
 */
router.post('/:obligationId', authenticate, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { obligationId } = req.params;
    const { referenceNote } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!req.file) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'File is required'
      });
    }

    await client.query('BEGIN');

    // Verify obligation exists and belongs to organization
    const obligationCheck = await client.query(
      'SELECT id, status FROM obligations WHERE id = $1 AND organization_id = $2',
      [obligationId, organizationId]
    );

    if (obligationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    // Get current SLA to check if evidence is late
    const slaCheck = await client.query(
      'SELECT due_date FROM slas WHERE obligation_id = $1 AND is_current = true',
      [obligationId]
    );

    if (slaCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: 'Cannot upload evidence for obligation without SLA'
      });
    }

    const slaDueDate = new Date(slaCheck.rows[0].due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    slaDueDate.setHours(0, 0, 0, 0);
    
    const isLate = today > slaDueDate;

    // Store evidence record
    // Note: The database trigger will also compute is_late, but we do it here for consistency
    const evidenceResult = await client.query(
      `INSERT INTO evidence (
        obligation_id, file_path, file_name, file_size_bytes, 
        mime_type, reference_note, uploaded_by, is_late, sla_due_date_at_upload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        obligationId,
        req.file.path,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        referenceNote,
        userId,
        isLate,
        slaCheck.rows[0].due_date
      ]
    );

    const evidence = evidenceResult.rows[0];

    // Create audit log
    await createAuditLog({
      entityType: 'evidence',
      entityId: evidence.id,
      action: isLate ? AuditActions.EVIDENCE_LATE_UPLOAD : AuditActions.EVIDENCE_UPLOAD,
      performedBy: userId,
      newValue: {
        obligationId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        isLate,
        slaDueDate: slaCheck.rows[0].due_date
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
      additionalContext: isLate ? {
        warning: 'Evidence uploaded after SLA due date'
      } : null
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: isLate 
        ? 'Evidence uploaded successfully (WARNING: Uploaded after SLA due date)'
        : 'Evidence uploaded successfully',
      evidence: {
        id: evidence.id,
        fileName: evidence.file_name,
        fileSize: evidence.file_size_bytes,
        uploadedAt: evidence.uploaded_at,
        isLate: evidence.is_late
      },
      warning: isLate ? 'Evidence was uploaded after the SLA due date and has been flagged as late' : null
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('[EVIDENCE] Upload error:', error);
    
    if (error.message.includes('ENFORCEMENT VIOLATION')) {
      return res.status(400).json({
        error: 'ENFORCEMENT_VIOLATION',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'UPLOAD_ERROR',
      message: 'Failed to upload evidence'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/evidence/:obligationId
 * List all evidence for an obligation
 */
router.get('/:obligationId', authenticate, async (req, res) => {
  try {
    const { obligationId } = req.params;
    const organizationId = req.user.organization_id;

    // Verify obligation exists and belongs to organization
    const obligationCheck = await pool.query(
      'SELECT id FROM obligations WHERE id = $1 AND organization_id = $2',
      [obligationId, organizationId]
    );

    if (obligationCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    // Get all evidence (append-only list)
    const evidenceResult = await pool.query(
      `SELECT e.*, u.name as uploaded_by_name
       FROM evidence e
       JOIN users u ON e.uploaded_by = u.id
       WHERE e.obligation_id = $1
       ORDER BY e.uploaded_at DESC`,
      [obligationId]
    );

    res.json({
      evidence: evidenceResult.rows,
      total: evidenceResult.rows.length,
      lateCount: evidenceResult.rows.filter(e => e.is_late).length
    });
  } catch (error) {
    console.error('[EVIDENCE] List error:', error);
    res.status(500).json({
      error: 'LIST_ERROR',
      message: 'Failed to list evidence'
    });
  }
});

/**
 * GET /api/evidence/:obligationId/:evidenceId/download
 * Download a specific evidence file
 */
router.get('/:obligationId/:evidenceId/download', authenticate, async (req, res) => {
  try {
    const { obligationId, evidenceId } = req.params;
    const organizationId = req.user.organization_id;

    // Verify obligation exists and belongs to organization
    const obligationCheck = await pool.query(
      'SELECT id FROM obligations WHERE id = $1 AND organization_id = $2',
      [obligationId, organizationId]
    );

    if (obligationCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    // Get evidence
    const evidenceResult = await pool.query(
      'SELECT * FROM evidence WHERE id = $1 AND obligation_id = $2',
      [evidenceId, obligationId]
    );

    if (evidenceResult.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Evidence not found'
      });
    }

    const evidence = evidenceResult.rows[0];

    if (!fs.existsSync(evidence.file_path)) {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'Evidence file not found on server'
      });
    }

    res.download(evidence.file_path, evidence.file_name);
  } catch (error) {
    console.error('[EVIDENCE] Download error:', error);
    res.status(500).json({
      error: 'DOWNLOAD_ERROR',
      message: 'Failed to download evidence'
    });
  }
});

module.exports = router;
