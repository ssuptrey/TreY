import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { AuditController } from '../controllers/auditController';

const router = Router();
const auditController = new AuditController();

router.get('/', authenticate, auditController.getLogs);
router.get('/resource/:resourceType/:resourceId', authenticate, auditController.getLogsByResource);
router.get('/export', authenticate, requireRole('admin', 'compliance_officer'), auditController.exportLogs);

export default router;