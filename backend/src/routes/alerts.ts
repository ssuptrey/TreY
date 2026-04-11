import { Router } from 'express';
import { AlertController } from '../controllers/alertController';
import { authenticate } from '../middlewares/auth';

const router = Router();

const alertController = new AlertController({
  alertService: {} as any,
  auditRepository: {} as any
});

router.get('/history/:obligationId', authenticate, alertController.getHistory);
router.post('/send/:obligationId', authenticate, alertController.sendManual);
router.post('/trigger-job', authenticate, alertController.triggerJob);

export default router;
