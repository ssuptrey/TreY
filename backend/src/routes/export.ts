import { Router } from 'express';
import { ExportController } from '../controllers/exportController';
import { authenticate } from '../middlewares/auth';

const router = Router();

const exportController = new ExportController({
  exportService: {} as any,
  auditRepository: {} as any
});

router.get('/pdf', authenticate, exportController.exportPDF);
router.get('/zip', authenticate, exportController.exportZIP);
router.get('/csv', authenticate, exportController.exportCSV);

export default router;
