import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticate, requireRole } from '../middlewares/auth';
import { handleValidation } from '../validators/validationMiddleware';
import { auditValidators } from '../validators/auditValidator';

const router = Router();
const controller = new AuditController({
  auditRepository: {} as any,
  exportService: {} as any
});

// GET /api/audit
router.get(
  '/',
  authenticate,
  requireRole('SuperAdmin', 'Admin'),
  auditValidators.getLogs(),
  handleValidation,
  controller.getLogs
);

// GET /api/audit/resource/:resourceType/:resourceId
router.get(
  '/resource/:resourceType/:resourceId',
  authenticate,
  requireRole('SuperAdmin', 'Admin'),
  auditValidators.getLogsByResource(),
  handleValidation,
  controller.getLogsByResource
);

// GET /api/audit/export
router.get(
  '/export',
  authenticate,
  requireRole('SuperAdmin', 'Admin'),
  controller.exportLogs
);

export default router;
