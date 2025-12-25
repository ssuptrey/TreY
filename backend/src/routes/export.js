// ============================================
// EXPORT ROUTES
// ============================================
// Inspection Export: Export obligations + SLA + evidence + audit logs as PDF or ZIP
// Read-only snapshot for compliance inspection

const express = require('express');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { createAuditLog, AuditActions, getAuditLogsForEntity } = require('../services/auditService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/export/obligation/:id/pdf
 * Export single obligation as PDF (read-only snapshot)
 */
router.get('/obligation/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    // Get complete obligation data
    const obligationData = await getCompleteObligationData(id, organizationId);
    
    if (!obligationData) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    // Create audit log for export
    await createAuditLog({
      entityType: 'obligation',
      entityId: id,
      action: AuditActions.EXPORT_GENERATE,
      performedBy: userId,
      newValue: { format: 'PDF', type: 'single_obligation' },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="obligation-${id}-export.pdf"`);
    
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).text('COMPLIANCE OBLIGATION REPORT', { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.fontSize(10).text('READ-ONLY SNAPSHOT - SYSTEM OF RECORD', { align: 'center' });
    doc.moveDown(2);

    // Obligation Details
    doc.fontSize(16).text('OBLIGATION DETAILS', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`ID: ${obligationData.obligation.id}`);
    doc.text(`Title: ${obligationData.obligation.title}`);
    doc.text(`Description: ${obligationData.obligation.description || 'N/A'}`);
    doc.text(`Regulation Tag: ${obligationData.obligation.regulation_tag || 'N/A'}`);
    doc.text(`Status: ${obligationData.obligation.status.toUpperCase()}`);
    doc.text(`Created At: ${obligationData.obligation.created_at}`);
    doc.text(`Created By: ${obligationData.obligation.created_by_name}`);
    doc.moveDown(2);

    // Current Owner
    doc.fontSize(16).text('CURRENT OWNER', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    if (obligationData.currentOwner) {
      doc.text(`Name: ${obligationData.currentOwner.owner_name}`);
      doc.text(`Email: ${obligationData.currentOwner.owner_email}`);
      doc.text(`Assigned At: ${obligationData.currentOwner.assigned_at}`);
    }
    doc.moveDown(2);

    // Owner History
    doc.fontSize(16).text('OWNER HISTORY (Append-Only)', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    obligationData.ownerHistory.forEach((owner, idx) => {
      doc.text(`${idx + 1}. ${owner.owner_name} - Assigned: ${owner.assigned_at}${owner.is_current ? ' (CURRENT)' : ''}`);
      if (owner.reassignment_reason) {
        doc.text(`   Reason: ${owner.reassignment_reason}`);
      }
    });
    doc.moveDown(2);

    // Current SLA
    doc.fontSize(16).text('CURRENT SLA', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    if (obligationData.currentSla) {
      doc.text(`Due Date: ${obligationData.currentSla.due_date}`);
      doc.text(`Created At: ${obligationData.currentSla.created_at}`);
      if (obligationData.currentSla.extension_reason) {
        doc.text(`Extension Reason: ${obligationData.currentSla.extension_reason}`);
      }
    }
    doc.moveDown(2);

    // SLA History
    doc.fontSize(16).text('SLA HISTORY (Append-Only)', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    obligationData.slaHistory.forEach((sla, idx) => {
      doc.text(`${idx + 1}. Due: ${sla.due_date} - Created: ${sla.created_at}${sla.is_current ? ' (CURRENT)' : ''}`);
      if (sla.extension_reason) {
        doc.text(`   Extension Reason: ${sla.extension_reason}`);
      }
    });
    doc.moveDown(2);

    // Evidence List
    doc.addPage();
    doc.fontSize(16).text('EVIDENCE LIST (Append-Only)', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    if (obligationData.evidence.length === 0) {
      doc.text('No evidence uploaded');
    } else {
      obligationData.evidence.forEach((e, idx) => {
        doc.text(`${idx + 1}. ${e.file_name}`);
        doc.text(`   Uploaded: ${e.uploaded_at}`);
        doc.text(`   Uploaded By: ${e.uploaded_by_name}`);
        doc.text(`   Late Upload: ${e.is_late ? 'YES - FLAGGED' : 'No'}`);
        if (e.is_late) {
          doc.text(`   SLA Due Date at Upload: ${e.sla_due_date_at_upload}`);
        }
        doc.moveDown();
      });
    }
    doc.moveDown(2);

    // Audit Trail
    doc.addPage();
    doc.fontSize(16).text('COMPLETE AUDIT TRAIL', { underline: true });
    doc.moveDown();
    doc.fontSize(8);
    obligationData.auditLogs.forEach((log, idx) => {
      doc.text(`${idx + 1}. [${log.timestamp}] ${log.action} by ${log.performed_by_name}`);
      if (log.previous_value) {
        doc.text(`   Previous: ${JSON.stringify(log.previous_value)}`);
      }
      if (log.new_value) {
        doc.text(`   New: ${JSON.stringify(log.new_value)}`);
      }
      doc.moveDown(0.5);
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text('--- END OF REPORT ---', { align: 'center' });
    doc.text('This document is a read-only snapshot from the System of Record for Compliance Execution', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('[EXPORT] PDF error:', error);
    res.status(500).json({
      error: 'EXPORT_ERROR',
      message: 'Failed to export obligation as PDF'
    });
  }
});

/**
 * GET /api/export/obligation/:id/zip
 * Export single obligation as ZIP with evidence files
 */
router.get('/obligation/:id/zip', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    // Get complete obligation data
    const obligationData = await getCompleteObligationData(id, organizationId);
    
    if (!obligationData) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Obligation not found'
      });
    }

    // Create audit log for export
    await createAuditLog({
      entityType: 'obligation',
      entityId: id,
      action: AuditActions.EXPORT_GENERATE,
      performedBy: userId,
      newValue: { format: 'ZIP', type: 'single_obligation_with_evidence' },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="obligation-${id}-export.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Add JSON manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.name,
      systemNote: 'READ-ONLY SNAPSHOT - SYSTEM OF RECORD FOR COMPLIANCE EXECUTION',
      obligation: obligationData.obligation,
      currentOwner: obligationData.currentOwner,
      ownerHistory: obligationData.ownerHistory,
      currentSla: obligationData.currentSla,
      slaHistory: obligationData.slaHistory,
      evidence: obligationData.evidence.map(e => ({
        ...e,
        file_path: undefined // Don't expose server paths
      })),
      auditLogs: obligationData.auditLogs
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add evidence files
    for (const evidence of obligationData.evidence) {
      if (fs.existsSync(evidence.file_path)) {
        archive.file(evidence.file_path, { 
          name: `evidence/${evidence.uploaded_at.split('T')[0]}-${evidence.file_name}` 
        });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('[EXPORT] ZIP error:', error);
    res.status(500).json({
      error: 'EXPORT_ERROR',
      message: 'Failed to export obligation as ZIP'
    });
  }
});

/**
 * GET /api/export/all/zip
 * Export all obligations for organization as ZIP
 */
router.get('/all/zip', authenticate, async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    // Get all obligation IDs for organization
    const obligationsResult = await pool.query(
      'SELECT id FROM obligations WHERE organization_id = $1 ORDER BY created_at',
      [organizationId]
    );

    // Create audit log for export
    await createAuditLog({
      entityType: 'organization',
      entityId: organizationId,
      action: AuditActions.EXPORT_GENERATE,
      performedBy: userId,
      newValue: { 
        format: 'ZIP', 
        type: 'full_organization_export',
        obligationCount: obligationsResult.rows.length
      },
      ipAddress: req.ipAddress,
      userAgent: req.userAgent
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-export-${new Date().toISOString().split('T')[0]}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const allObligations = [];

    for (const row of obligationsResult.rows) {
      const obligationData = await getCompleteObligationData(row.id, organizationId);
      if (obligationData) {
        allObligations.push({
          ...obligationData,
          evidence: obligationData.evidence.map(e => ({
            ...e,
            file_path: undefined
          }))
        });

        // Add evidence files
        for (const evidence of obligationData.evidence) {
          if (fs.existsSync(evidence.file_path)) {
            archive.file(evidence.file_path, { 
              name: `obligations/${row.id}/evidence/${evidence.file_name}` 
            });
          }
        }
      }
    }

    // Add master manifest
    const masterManifest = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.name,
      organizationId: organizationId,
      organizationName: req.user.organization_name,
      systemNote: 'COMPLETE ORGANIZATION EXPORT - SYSTEM OF RECORD FOR COMPLIANCE EXECUTION',
      totalObligations: allObligations.length,
      obligations: allObligations
    };

    archive.append(JSON.stringify(masterManifest, null, 2), { name: 'master-manifest.json' });

    await archive.finalize();
  } catch (error) {
    console.error('[EXPORT] Full export error:', error);
    res.status(500).json({
      error: 'EXPORT_ERROR',
      message: 'Failed to export organization data'
    });
  }
});

/**
 * Helper function to get complete obligation data
 */
async function getCompleteObligationData(obligationId, organizationId) {
  // Get obligation
  const obligationResult = await pool.query(
    `SELECT o.*, creator.name as created_by_name
     FROM obligations o
     JOIN users creator ON o.created_by = creator.id
     WHERE o.id = $1 AND o.organization_id = $2`,
    [obligationId, organizationId]
  );

  if (obligationResult.rows.length === 0) {
    return null;
  }

  const obligation = obligationResult.rows[0];

  // Get owner history
  const ownerHistoryResult = await pool.query(
    `SELECT oo.*, u.name as owner_name, u.email as owner_email,
            assigner.name as assigned_by_name
     FROM obligation_owners oo
     JOIN users u ON oo.user_id = u.id
     JOIN users assigner ON oo.assigned_by = assigner.id
     WHERE oo.obligation_id = $1
     ORDER BY oo.assigned_at DESC`,
    [obligationId]
  );

  // Get SLA history
  const slaHistoryResult = await pool.query(
    `SELECT s.*, creator.name as created_by_name
     FROM slas s
     JOIN users creator ON s.created_by = creator.id
     WHERE s.obligation_id = $1
     ORDER BY s.created_at DESC`,
    [obligationId]
  );

  // Get evidence
  const evidenceResult = await pool.query(
    `SELECT e.*, uploader.name as uploaded_by_name
     FROM evidence e
     JOIN users uploader ON e.uploaded_by = uploader.id
     WHERE e.obligation_id = $1
     ORDER BY e.uploaded_at DESC`,
    [obligationId]
  );

  // Get audit logs
  const auditLogs = await getAuditLogsForEntity('obligation', obligationId);

  // Get related audit logs
  const ownerIds = ownerHistoryResult.rows.map(o => o.id);
  const slaIds = slaHistoryResult.rows.map(s => s.id);
  const evidenceIds = evidenceResult.rows.map(e => e.id);

  const relatedAuditResult = await pool.query(
    `SELECT al.*, u.name as performed_by_name
     FROM audit_logs al
     JOIN users u ON al.performed_by = u.id
     WHERE (al.entity_type = 'obligation_owner' AND al.entity_id = ANY($1))
        OR (al.entity_type = 'sla' AND al.entity_id = ANY($2))
        OR (al.entity_type = 'evidence' AND al.entity_id = ANY($3))
     ORDER BY al.timestamp DESC`,
    [ownerIds, slaIds, evidenceIds]
  );

  const allAuditLogs = [...auditLogs, ...relatedAuditResult.rows]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    obligation,
    ownerHistory: ownerHistoryResult.rows,
    currentOwner: ownerHistoryResult.rows.find(o => o.is_current),
    slaHistory: slaHistoryResult.rows,
    currentSla: slaHistoryResult.rows.find(s => s.is_current),
    evidence: evidenceResult.rows,
    auditLogs: allAuditLogs
  };
}

module.exports = router;
